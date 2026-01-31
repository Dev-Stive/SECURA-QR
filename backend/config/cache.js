/**
 * @file cache.js
 * @description Système de cache multi-niveaux pour Secura QR.
 * Support Redis, mémoire et système de fallback avec stratégies d'invalidation avancées.
 * @module config/cache
 * @requires redis
 * @requires ../utils/errorHandler
 * @requires ../utils/logger
 * @requires ./config
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/helpers/idGenerator
 */

const redis = require('redis');
const logger = require('../utils/logger');
const config = require('./config');
const { now, addMinutes, isAfter } = require('../utils/helpers/dateHelper');

/**
 * @class CacheManager
 * @description Gestionnaire de cache multi-niveaux
 */
class CacheManager {
  constructor() {
    /** @type {redis.RedisClientType|null} */
    this.redisClient = null;
    /** @type {Map} */
    this.memoryCache = new Map();
    /** @type {string} */
    this.activeBackend = 'memory';
    /** @type {boolean} */
    this.initialized = false;
    /** @type {Object} */
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };

    this.initializeCache();
  }

  /**
   * @function initializeCache
   * @description Initialise le système de cache
   * @returns {Promise<void>}
   */
  async initializeCache() {
    try {
      logger.info('Cache: Début initialisation...');

      // Essayer Redis d'abord
      if (await this.initializeRedis()) {
        this.activeBackend = 'redis';
      } else {
        // Fallback sur mémoire
        await this.initializeMemoryCache();
        this.activeBackend = 'memory';
      }

      this.initialized = true;

      logger.success('Cache: Système initialisé avec succès', {
        backend: this.activeBackend,
        environment: config.nodeEnv
      });

    } catch (error) {
      logger.error('Cache: Erreur initialisation', {
        error: error.message,
        stack: error.stack
      });
      
      // Fallback sur mémoire en cas d'erreur
      await this.initializeMemoryCache();
      this.activeBackend = 'memory';
      this.initialized = true;
      
      logger.warn('Cache: Fallback sur mémoire après erreur');
    }
  }

  /**
   * @function initializeRedis
   * @description Initialise la connexion Redis
   * @returns {Promise<boolean>} Succès de l'initialisation
   */
  async initializeRedis() {
    try {
      if (!config.redis.url) {
        logger.warn('Cache: URL Redis non configurée');
        return false;
      }

      this.redisClient = redis.createClient({
        url: config.redis.url,
        password: config.redis.password,
        socket: {
          connectTimeout: 10000,
          timeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.error('Cache: Échec reconnexion Redis après 3 tentatives');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Gestionnaires d'événements
      this.redisClient.on('error', (error) => {
        logger.error('Cache: Erreur Redis', { error: error.message });
        this.stats.errors++;
      });

      this.redisClient.on('connect', () => {
        logger.info('Cache: Connecté à Redis');
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Cache: Déconnecté de Redis');
      });

      await this.redisClient.connect();

      // Test de connexion
      await this.redisClient.ping();
      
      logger.info('Cache: Redis opérationnel');
      return true;

    } catch (error) {
      logger.error('Cache: Erreur connexion Redis', {
        error: error.message,
        url: config.redis.url ? 'configured' : 'not configured'
      });
      
      if (this.redisClient) {
        await this.redisClient.quit().catch(() => {});
        this.redisClient = null;
      }
      
      return false;
    }
  }

  /**
   * @function initializeMemoryCache
   * @description Initialise le cache mémoire
   * @returns {Promise<void>}
   */
  async initializeMemoryCache() {
    this.memoryCache = new Map();
    
    // Nettoyage périodique des entrées expirées
    setInterval(() => {
      this.cleanupMemoryCache();
    }, 60 * 1000); // Toutes les minutes

    logger.info('Cache: Mémoire initialisée');
  }

  /**
   * @function cleanupMemoryCache
   * @description Nettoie le cache mémoire des entrées expirées
   */
  cleanupMemoryCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cache: Mémoire nettoyée', { cleanedCount });
    }
  }

  /**
   * @function get
   * @description Récupère une valeur du cache
   * @param {string} key - Clé du cache
   * @returns {Promise<*>} Valeur en cache ou null
   */
  async get(key) {
    if (!this.initialized) {
      return null;
    }

    try {
      let value = null;

      if (this.activeBackend === 'redis' && this.redisClient) {
        const cached = await this.redisClient.get(this.getRedisKey(key));
        if (cached) {
          value = this.deserialize(cached);
        }
      } else {
        const entry = this.memoryCache.get(key);
        if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
          value = entry.value;
        } else if (entry) {
          // Entrée expirée, la supprimer
          this.memoryCache.delete(key);
        }
      }

      if (value !== null) {
        this.stats.hits++;
        logger.debug('Cache: Hit', { key });
      } else {
        this.stats.misses++;
        logger.debug('Cache: Miss', { key });
      }

      return value;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache: Erreur récupération', {
        key,
        backend: this.activeBackend,
        error: error.message
      });
      return null;
    }
  }

  /**
   * @function set
   * @description Stocke une valeur dans le cache
   * @param {string} key - Clé du cache
   * @param {*} value - Valeur à stocker
   * @param {Object} options - Options de cache
   * @returns {Promise<boolean>} Succès de l'opération
   */
  async set(key, value, options = {}) {
    if (!this.initialized) {
      return false;
    }

    try {
      const {
        ttl = config.redis.ttl, // TTL par défaut en secondes
        namespace = 'default'
      } = options;

      const cacheKey = this.getCacheKey(key, namespace);
      const serializedValue = this.serialize(value);
      const expiresAt = ttl ? Date.now() + (ttl * 1000) : null;

      if (this.activeBackend === 'redis' && this.redisClient) {
        if (ttl) {
          await this.redisClient.setEx(cacheKey, ttl, serializedValue);
        } else {
          await this.redisClient.set(cacheKey, serializedValue);
        }
      } else {
        this.memoryCache.set(cacheKey, {
          value,
          expiresAt,
          createdAt: Date.now(),
          namespace
        });
      }

      this.stats.sets++;
      logger.debug('Cache: Set', { key: cacheKey, ttl, namespace });

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache: Erreur stockage', {
        key,
        backend: this.activeBackend,
        error: error.message
      });
      return false;
    }
  }

  /**
   * @function delete
   * @description Supprime une clé du cache
   * @param {string} key - Clé à supprimer
   * @param {string} namespace - Namespace (optionnel)
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async delete(key, namespace = 'default') {
    if (!this.initialized) {
      return false;
    }

    try {
      const cacheKey = this.getCacheKey(key, namespace);

      if (this.activeBackend === 'redis' && this.redisClient) {
        await this.redisClient.del(cacheKey);
      } else {
        this.memoryCache.delete(cacheKey);
      }

      this.stats.deletes++;
      logger.debug('Cache: Delete', { key: cacheKey, namespace });

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache: Erreur suppression', {
        key,
        backend: this.activeBackend,
        error: error.message
      });
      return false;
    }
  }

  /**
   * @function deleteByPattern
   * @description Supprime les clés correspondant à un motif
   * @param {string} pattern - Motif de recherche
   * @param {string} namespace - Namespace (optionnel)
   * @returns {Promise<number>} Nombre de clés supprimées
   */
  async deleteByPattern(pattern, namespace = 'default') {
    if (!this.initialized) {
      return 0;
    }

    try {
      let deletedCount = 0;

      if (this.activeBackend === 'redis' && this.redisClient) {
        const keys = await this.redisClient.keys(this.getRedisKey(`${namespace}:${pattern}`));
        if (keys.length > 0) {
          await this.redisClient.del(keys);
          deletedCount = keys.length;
        }
      } else {
        const fullPattern = this.getCacheKey(pattern, namespace);
        for (const [key] of this.memoryCache.entries()) {
          if (key.includes(fullPattern)) {
            this.memoryCache.delete(key);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        logger.debug('Cache: Delete par motif', { pattern, namespace, deletedCount });
      }

      return deletedCount;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache: Erreur suppression par motif', {
        pattern,
        namespace,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * @function getOrSet
   * @description Récupère ou stocke une valeur (pattern cache-aside)
   * @param {string} key - Clé du cache
   * @param {Function} fetchFn - Fonction pour récupérer la valeur si absente
   * @param {Object} options - Options de cache
   * @returns {Promise<*>} Valeur en cache ou récupérée
   */
  async getOrSet(key, fetchFn, options = {}) {
    // Essayer de récupérer du cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Récupérer la valeur via la fonction
    const value = await fetchFn();

    // Stocker en cache (sans attendre)
    this.set(key, value, options).catch(error => {
      logger.error('Cache: Erreur set asynchrone', {
        key,
        error: error.message
      });
    });

    return value;
  }

  /**
   * @function mget
   * @description Récupère plusieurs valeurs en une seule opération
   * @param {string[]} keys - Clés à récupérer
   * @param {string} namespace - Namespace (optionnel)
   * @returns {Promise<Object>} Objet avec les valeurs
   */
  async mget(keys, namespace = 'default') {
    if (!this.initialized || !keys.length) {
      return {};
    }

    try {
      const results = {};

      if (this.activeBackend === 'redis' && this.redisClient) {
        const cacheKeys = keys.map(key => this.getRedisKey(this.getCacheKey(key, namespace)));
        const values = await this.redisClient.mGet(cacheKeys);
        
        keys.forEach((key, index) => {
          if (values[index]) {
            results[key] = this.deserialize(values[index]);
          }
        });
      } else {
        keys.forEach(key => {
          const cacheKey = this.getCacheKey(key, namespace);
          const entry = this.memoryCache.get(cacheKey);
          if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
            results[key] = entry.value;
          }
        });
      }

      logger.debug('Cache: MGet', { 
        keys: keys.length, 
        found: Object.keys(results).length 
      });

      return results;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache: Erreur MGet', {
        keys: keys.length,
        error: error.message
      });
      return {};
    }
  }

  /**
   * @function mset
   * @description Stocke plusieurs valeurs en une seule opération
   * @param {Object} keyValuePairs - Paires clé-valeur
   * @param {Object} options - Options de cache
   * @returns {Promise<boolean>} Succès de l'opération
   */
  async mset(keyValuePairs, options = {}) {
    if (!this.initialized || !Object.keys(keyValuePairs).length) {
      return false;
    }

    try {
      const { ttl = config.redis.ttl, namespace = 'default' } = options;

      if (this.activeBackend === 'redis' && this.redisClient) {
        const pipeline = this.redisClient.multi();
        
        Object.entries(keyValuePairs).forEach(([key, value]) => {
          const cacheKey = this.getRedisKey(this.getCacheKey(key, namespace));
          const serializedValue = this.serialize(value);
          
          if (ttl) {
            pipeline.setEx(cacheKey, ttl, serializedValue);
          } else {
            pipeline.set(cacheKey, serializedValue);
          }
        });

        await pipeline.exec();
      } else {
        Object.entries(keyValuePairs).forEach(([key, value]) => {
          const cacheKey = this.getCacheKey(key, namespace);
          const expiresAt = ttl ? Date.now() + (ttl * 1000) : null;
          
          this.memoryCache.set(cacheKey, {
            value,
            expiresAt,
            createdAt: Date.now(),
            namespace
          });
        });
      }

      this.stats.sets += Object.keys(keyValuePairs).length;
      logger.debug('Cache: MSet', { 
        pairs: Object.keys(keyValuePairs).length,
        namespace 
      });

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache: Erreur MSet', {
        pairs: Object.keys(keyValuePairs).length,
        error: error.message
      });
      return false;
    }
  }

  /**
   * @function getCacheKey
   * @description Génère une clé de cache avec namespace
   * @param {string} key - Clé originale
   * @param {string} namespace - Namespace
   * @returns {string} Clé complète
   */
  getCacheKey(key, namespace = 'default') {
    return `${namespace}:${key}`;
  }

  /**
   * @function getRedisKey
   * @description Génère une clé Redis avec préfixe
   * @param {string} key - Clé de cache
   * @returns {string} Clé Redis
   */
  getRedisKey(key) {
    return `secura:${config.nodeEnv}:${key}`;
  }

  /**
   * @function serialize
   * @description Sérialise une valeur pour le stockage
   * @param {*} value - Valeur à sérialiser
   * @returns {string} Valeur sérialisée
   */
  serialize(value) {
    return JSON.stringify({
      data: value,
      _cachedAt: now(),
      _version: '1.0'
    });
  }

  /**
   * @function deserialize
   * @description Désérialise une valeur stockée
   * @param {string} value - Valeur sérialisée
   * @returns {*} Valeur désérialisée
   */
  deserialize(value) {
    try {
      const parsed = JSON.parse(value);
      return parsed.data;
    } catch {
      return null;
    }
  }

  /**
   * @function getStats
   * @description Récupère les statistiques du cache
   * @returns {Object} Statistiques
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      backend: this.activeBackend,
      initialized: this.initialized,
      memorySize: this.memoryCache.size
    };
  }

  /**
   * @function clearNamespace
   * @description Vide tout un namespace du cache
   * @param {string} namespace - Namespace à vider
   * @returns {Promise<number>} Nombre d'entrées supprimées
   */
  async clearNamespace(namespace) {
    return await this.deleteByPattern('*', namespace);
  }

  /**
   * @function clearAll
   * @description Vide tout le cache
   * @returns {Promise<boolean>} Succès de l'opération
   */
  async clearAll() {
    if (!this.initialized) {
      return false;
    }

    try {
      if (this.activeBackend === 'redis' && this.redisClient) {
        await this.redisClient.flushDb();
      } else {
        this.memoryCache.clear();
      }

      logger.info('Cache: Cache vidé complètement');
      return true;

    } catch (error) {
      logger.error('Cache: Erreur vidage complet', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * @function healthCheck
   * @description Vérifie la santé du cache
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    try {
      let backendStatus = 'unknown';
      
      if (this.activeBackend === 'redis' && this.redisClient) {
        await this.redisClient.ping();
        backendStatus = 'healthy';
      } else if (this.activeBackend === 'memory') {
        backendStatus = 'healthy';
      }

      return {
        status: 'healthy',
        backend: this.activeBackend,
        backendStatus,
        initialized: this.initialized,
        stats: this.getStats()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        backend: this.activeBackend,
        backendStatus: 'unhealthy',
        initialized: this.initialized,
        error: error.message,
        stats: this.getStats()
      };
    }
  }

  /**
   * @function shutdown
   * @description Arrête proprement le cache
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      
      this.memoryCache.clear();
      this.initialized = false;
      
      logger.info('Cache: Arrêté proprement');
    } catch (error) {
      logger.error('Cache: Erreur arrêt', {
        error: error.message
      });
    }
  }
}

const cacheManager = new CacheManager();

module.exports = cacheManager;