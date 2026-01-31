/**
 * @file baseRepo.js
 * @description Repository de base ultra-complet pour Secura.
 * Fournit toutes les opérations CRUD avancées avec cache, transactions, logs et synchronisation.
 * Améliorations : Ajout de saveStructuredData pour données nested (ex. : QR data), et indexation par subtype.
 * @module repositories/baseRepo
 * @requires ../config/database
 * @requires ../utils/logger
 * @requires ../utils/errorHandler
 * @requires ../config/cache
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/dateHelper
 */
const databaseManager = require('../config/database');
const log = require('../utils/logger');
const { AppError, NotFoundError, ValidationError } = require('../utils/errorHandler');
const cacheManager = require('../config/cache');
const { generateShortId } = require('../utils/helpers/idGenerator');
const { now, sleep } = require('../utils/helpers/dateHelper');

/**
 * @class BaseRepository
 * @description Repository de base avec toutes les opérations CRUD avancées
 */
class BaseRepository {
  /**
   * @constructor
   * @param {string} collectionName - Nom de la collection dans la base de données
   * @param {Object} options - Options de configuration
   */
  constructor(collectionName, options = {}) {
    this.collectionName = collectionName;
    this.options = {
      enableCache: true,
      cacheTTL: 300, // 5 minutes
      enableAudit: true,
      maxRetries: 3,
      retryDelay: 1000,
      validationRequired: true,
      softDelete: false,
      ...options
    };
    
    this.logger = log.withContext({
      repository: collectionName,
      collection: collectionName
    });
    this.initialized = false;
    this.initialize();
  }

  /**
   * @method initialize
   * @description Initialise le repository
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Vérifier que la base de données est prête
      await this.waitForDatabase();
      this.initialized = true;
     
      this.logger.info(`Repository ${this.collectionName} initialisé`, {
        options: this.options
      });
    } catch (error) {
      this.logger.error(`Erreur initialisation repository ${this.collectionName}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method waitForDatabase
   * @description Attend que la base de données soit initialisée
   * @returns {Promise<void>}
   */
  async waitForDatabase() {
    const maxAttempts = 30;
    const delay = 1000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (databaseManager.initialized) {
        return;
      }
     
      if (attempt === maxAttempts) {
        throw new AppError(
          `Base de données non initialisée après ${maxAttempts} tentatives`,
          500,
          'DATABASE_NOT_READY'
        );
      }
      this.logger.warning(`Attente base de données... (${attempt}/${maxAttempts})`);
      await sleep(delay);
    }
  }

  // ============================================================================
  // MÉTHODES CRUD FONDAMENTALES
  // ============================================================================

  /**
   * @method create
   * @description Crée un nouveau document avec validation et audit
   * @param {Object} data - Données du document
   * @param {Object} options - Options de création
   * @returns {Promise<Object>} Document créé
   */
  async create(data, options = {}) {
    const operation = log.trackOperation(`CREATE ${this.collectionName}`, {
      data: this.sanitizeForLog(data),
      options
    });
    try {
      // Validation des données
      if (this.options.validationRequired && typeof this.validate === 'function') {
        const validation = this.validate(data);
        if (!validation.valid) {
          throw new ValidationError('Données invalides', validation.errors);
        }
      }
      // Transaction atomique
      const result = await databaseManager.transaction(async (dbData, transactionId) => {
        const collection = dbData[this.collectionName] || [];
        // Préparer le document
        const document = this.prepareDocument(data, 'create');
       
        // Vérifier les contraintes d'unicité
        await this.checkUniqueConstraints(document, collection);
        // Ajouter le document
        collection.push(document);
        dbData[this.collectionName] = collection;
        // Mettre à jour les index
        this.updateIndexes(dbData, document, 'create');
        this.logger.crud('CREATE', this.collectionName, this.sanitizeForLog(document), {
          transactionId,
          documentId: document.id
        });
        return document;
      }, {
        maxRetries: this.options.maxRetries,
        timeout: 30000
      });
      // Invalider le cache
      await this.invalidateCache();
      // Audit
      if (this.options.enableAudit) {
        this.audit('CREATE', result.id, { data: this.sanitizeForLog(data) });
      }
      return operation.success({ created: result });
    } catch (error) {
      return operation.error(error, { data: this.sanitizeForLog(data) });
    }
  }

  /**
   * @method findById
   * @description Trouve un document par son ID avec cache
   * @param {string} id - ID du document
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object|null>} Document trouvé ou null
   */
  async findById(id, options = {}) {
    const cacheKey = this.getCacheKey(`id:${id}`);
    const operation = log.trackOperation(`FIND_BY_ID ${this.collectionName}`, { id, options });
    try {
      // Vérifier le cache
      if (this.options.enableCache && !options.forceRefresh) {
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit pour ${this.collectionName} ID: ${id}`);
          return operation.success({ found: cached, fromCache: true });
        }
      }
      const result = await databaseManager.transaction(async (dbData) => {
        const collection = dbData[this.collectionName] || [];
       
        // Appliquer le soft delete si activé
        let document;
        if (this.options.softDelete) {
          document = collection.find(doc => doc.id === id && !doc.deletedAt) || null;
        } else {
          document = collection.find(doc => doc.id === id) || null;
        }
        if (!document && options.throwIfNotFound) {
          throw new NotFoundError(`${this.collectionName} avec ID: ${id}`);
        }
        return document;
      });
      // Mettre en cache si trouvé
      if (result && this.options.enableCache) {
        await cacheManager.set(cacheKey, result, { ttl: this.options.cacheTTL });
      }
      const meta = {
        found: !!result,
        fromCache: false
      };
      return operation.success(result ? { found: result, ...meta } : { ...meta });
    } catch (error) {
      return operation.error(error, { id });
    }
  }

  /**
   * @method findAll
   * @description Trouve tous les documents avec pagination et filtres
   * @param {Object} filters - Filtres de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Résultats paginés
   */
  async findAll(filters = {}, options = {}) {
    const cacheKey = this.getCacheKey(`findAll:${JSON.stringify({ filters, options })}`);
    const operation = log.trackOperation(`FIND_ALL ${this.collectionName}`, {
      filters: this.sanitizeForLog(filters),
      options
    });
    try {
      // Vérifier le cache pour les requêtes simples
      if (this.options.enableCache && !options.forceRefresh && this.isCacheableQuery(filters, options)) {
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit pour FIND_ALL ${this.collectionName}`);
          return operation.success({ ...cached, fromCache: true });
        }
      }
      const result = await databaseManager.transaction(async (dbData) => {
        let collection = dbData[this.collectionName] || [];
        // Appliquer le soft delete si activé
        if (this.options.softDelete) {
          collection = collection.filter(doc => !doc.deletedAt);
        }
        // Appliquer les filtres
        if (filters && Object.keys(filters).length > 0) {
          collection = this.applyFilters(collection, filters);
        }
        // Appliquer le tri
        if (options.sort) {
          collection = this.applySorting(collection, options.sort);
        }
        // Pagination
        const page = options.page || 1;
        const limit = options.limit || 50;
        const skip = (page - 1) * limit;
        const total = collection.length;
        const totalPages = Math.ceil(total / limit);
        const data = options.paginate !== false ? collection.slice(skip, skip + limit) : collection;
        return {
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        };
      });
      // Mettre en cache les résultats paginés
      if (this.options.enableCache && this.isCacheableQuery(filters, options)) {
        await cacheManager.set(cacheKey, result, { ttl: this.options.cacheTTL });
      }
      this.logger.debug(`FIND_ALL ${this.collectionName} trouvé ${result.pagination.total} documents`, {
        filters: Object.keys(filters),
        pagination: result.pagination
      });
      return operation.success({ ...result, fromCache: false });
    } catch (error) {
      return operation.error(error, { filters: this.sanitizeForLog(filters) });
    }
  }

  /**
   * @method update
   * @description Met à jour un document partiellement ou complètement
   * @param {string} id - ID du document
   * @param {Object} updates - Données de mise à jour
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, updates, options = {}) {
    const operation = log.trackOperation(`UPDATE ${this.collectionName}`, {
      id,
      updates: this.sanitizeForLog(updates),
      options
    });
    try {
      // Validation des mises à jour
      if (this.options.validationRequired && typeof this.validateUpdate === 'function') {
        const validation = this.validateUpdate(updates);
        if (!validation.valid) {
          throw new ValidationError('Mises à jour invalides', validation.errors);
        }
      }
      const result = await databaseManager.transaction(async (dbData, transactionId) => {
        const collection = dbData[this.collectionName] || [];
       
        // Recherche avec soft delete
        let index;
        if (this.options.softDelete) {
          index = collection.findIndex(doc => doc.id === id && !doc.deletedAt);
        } else {
          index = collection.findIndex(doc => doc.id === id);
        }
        if (index === -1) {
          throw new NotFoundError(`${this.collectionName} avec ID: ${id}`);
        }
        const originalDocument = { ...collection[index] };
       
        // Appliquer les mises à jour
        const updatedDocument = this.applyUpdates(originalDocument, updates, options);
       
        // Préparer le document mis à jour
        const finalDocument = this.prepareDocument(updatedDocument, 'update');
       
        // Vérifier les contraintes d'unicité
        await this.checkUniqueConstraints(finalDocument, collection, id);
        // Remplacer le document
        collection[index] = finalDocument;
        dbData[this.collectionName] = collection;
        // Mettre à jour les index
        this.updateIndexes(dbData, finalDocument, 'update', originalDocument);
        this.logger.crud('UPDATE', this.collectionName, {
          id,
          updates: Object.keys(updates),
          original: this.sanitizeForLog(originalDocument),
          updated: this.sanitizeForLog(finalDocument)
        }, { transactionId });
        return finalDocument;
      });
      // Invalider le cache
      await this.invalidateCache(id);
      // Audit
      if (this.options.enableAudit) {
        this.audit('UPDATE', id, {
          updates: this.sanitizeForLog(updates),
          previous: this.sanitizeForLog(result)
        });
      }
      return operation.success({ updated: result });
    } catch (error) {
      return operation.error(error, { id, updates: this.sanitizeForLog(updates) });
    }
  }

  /**
   * @method delete
   * @description Supprime un document avec vérifications
   * @param {string} id - ID du document
   * @param {Object} options - Options de suppression
   * @returns {Promise<Object>} Résultat de suppression
   */
  async delete(id, options = {}) {
    const operation = log.trackOperation(`DELETE ${this.collectionName}`, { id, options });
    try {
      const result = await databaseManager.transaction(async (dbData, transactionId) => {
        const collection = dbData[this.collectionName] || [];
       
        // Recherche avec soft delete
        let index;
        if (this.options.softDelete) {
          index = collection.findIndex(doc => doc.id === id && !doc.deletedAt);
        } else {
          index = collection.findIndex(doc => doc.id === id);
        }
        if (index === -1) {
          if (options.throwIfNotFound === false) {
            return { deleted: false, reason: 'Non trouvé' };
          }
          throw new NotFoundError(`${this.collectionName} avec ID: ${id}`);
        }
        const document = collection[index];
        // Vérifier les dépendances
        if (options.checkDependencies !== false) {
          await this.checkDependencies(document, dbData);
        }
        // Soft delete si supporté
        if (this.options.softDelete && options.softDelete !== false) {
          collection[index] = {
            ...document,
            deletedAt: now().toISOString(),
            isActive: false,
            updatedAt: now().toISOString()
          };
         
          this.logger.crud('SOFT_DELETE', this.collectionName, { id }, { transactionId });
          return { deleted: true, soft: true, document: collection[index] };
        }
        // Suppression physique
        collection.splice(index, 1);
        dbData[this.collectionName] = collection;
        // Mettre à jour les index
        this.updateIndexes(dbData, document, 'delete');
        this.logger.crud('DELETE', this.collectionName, { id }, { transactionId });
        return { deleted: true, soft: false, document };
      });
      // Invalider le cache
      await this.invalidateCache(id);
      // Audit
      if (this.options.enableAudit && result.deleted) {
        this.audit('DELETE', id, {
          softDelete: result.soft,
          document: this.sanitizeForLog(result.document)
        });
      }
      return operation.success(result);
    } catch (error) {
      return operation.error(error, { id });
    }
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method findOne
   * @description Trouve un seul document selon les critères
   * @param {Object} criteria - Critères de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object|null>} Document trouvé ou null
   */
  async findOne(criteria, options = {}) {
    const operation = log.trackOperation(`FIND_ONE ${this.collectionName}`, {
      criteria: this.sanitizeForLog(criteria),
      options
    });
    try {
      const result = await databaseManager.transaction(async (dbData) => {
        let collection = dbData[this.collectionName] || [];
       
        // Appliquer le soft delete si activé
        if (this.options.softDelete) {
          collection = collection.filter(doc => !doc.deletedAt);
        }
       
        const document = collection.find(doc =>
          this.matchesCriteria(doc, criteria)
        ) || null;
        if (!document && options.throwIfNotFound) {
          throw new NotFoundError(`${this.collectionName} avec critères: ${JSON.stringify(criteria)}`);
        }
        return document;
      });
      return operation.success(result ? { found: result } : { found: null });
    } catch (error) {
      return operation.error(error, { criteria: this.sanitizeForLog(criteria) });
    }
  }

  /**
   * @method findByField
   * @description Trouve des documents par champ spécifique
   * @param {string} field - Nom du champ
   * @param {*} value - Valeur du champ
   * @param {Object} options - Options de recherche
   * @returns {Promise<Array>} Documents trouvés
   */
  async findByField(field, value, options = {}) {
    return this.findAll({ [field]: value }, options);
  }

  /**
   * @method count
   * @description Compte le nombre de documents selon les critères
   * @param {Object} filters - Filtres de comptage
   * @returns {Promise<number>} Nombre de documents
   */
  async count(filters = {}) {
    const operation = log.trackOperation(`COUNT ${this.collectionName}`, {
      filters: this.sanitizeForLog(filters)
    });
    try {
      const result = await databaseManager.transaction(async (dbData) => {
        let collection = dbData[this.collectionName] || [];
        // Appliquer le soft delete si activé
        if (this.options.softDelete) {
          collection = collection.filter(doc => !doc.deletedAt);
        }
        if (filters && Object.keys(filters).length > 0) {
          collection = this.applyFilters(collection, filters);
        }
        return collection.length;
      });
      return operation.success({ count: result });
    } catch (error) {
      return operation.error(error, { filters: this.sanitizeForLog(filters) });
    }
  }

  /**
   * @method exists
   * @description Vérifie si un document existe selon les critères
   * @param {Object} criteria - Critères d'existence
   * @returns {Promise<boolean>} True si existe
   */
  async exists(criteria) {
    const document = await this.findOne(criteria, { throwIfNotFound: false });
    return !!document;
  }

  // ============================================================================
  // MÉTHODES DE MISE À JOUR AVANCÉES
  // ============================================================================

  /**
   * @method updateMany
   * @description Met à jour plusieurs documents en une opération
   * @param {Object} criteria - Critères de sélection
   * @param {Object} updates - Mises à jour à appliquer
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  async updateMany(criteria, updates, options = {}) {
    const operation = log.trackOperation(`UPDATE_MANY ${this.collectionName}`, {
      criteria: this.sanitizeForLog(criteria),
      updates: this.sanitizeForLog(updates),
      options
    });
    try {
      const result = await databaseManager.transaction(async (dbData, transactionId) => {
        let collection = dbData[this.collectionName] || [];
       
        // Appliquer le soft delete si activé
        if (this.options.softDelete) {
          collection = collection.filter(doc => !doc.deletedAt);
        }
       
        const matchedDocuments = collection.filter(doc => this.matchesCriteria(doc, criteria));
       
        if (matchedDocuments.length === 0) {
          return { updated: 0, documents: [] };
        }
        const updatedDocuments = [];
       
        for (const doc of matchedDocuments) {
          const updatedDoc = this.applyUpdates(doc, updates, options);
          const finalDoc = this.prepareDocument(updatedDoc, 'update');
         
          // Remplacer dans la collection
          const index = collection.findIndex(d => d.id === doc.id);
          if (index !== -1) {
            collection[index] = finalDoc;
            updatedDocuments.push(finalDoc);
          }
        }
        dbData[this.collectionName] = collection;
        // Mettre à jour les index pour tous les documents modifiés
        updatedDocuments.forEach(doc => {
          this.updateIndexes(dbData, doc, 'update');
        });
        this.logger.crud('UPDATE_MANY', this.collectionName, {
          criteria: Object.keys(criteria),
          updated: updatedDocuments.length,
          updates: Object.keys(updates)
        }, { transactionId });
        return {
          updated: updatedDocuments.length,
          documents: updatedDocuments
        };
      });
      // Invalider le cache complet
      await this.invalidateCache();
      // Audit
      if (this.options.enableAudit && result.updated > 0) {
        this.audit('UPDATE_MANY', 'multiple', {
          criteria: this.sanitizeForLog(criteria),
          updates: this.sanitizeForLog(updates),
          updatedCount: result.updated
        });
      }
      return operation.success(result);
    } catch (error) {
      return operation.error(error, {
        criteria: this.sanitizeForLog(criteria),
        updates: this.sanitizeForLog(updates)
      });
    }
  }

  /**
   * @method upsert
   * @description Crée ou met à jour un document
   * @param {Object} criteria - Critères de recherche
   * @param {Object} data - Données à upsert
   * @param {Object} options - Options d'upsert
   * @returns {Promise<Object>} Document créé ou mis à jour
   */
  async upsert(criteria, data, options = {}) {
    const operation = log.trackOperation(`UPSERT ${this.collectionName}`, {
      criteria: this.sanitizeForLog(criteria),
      data: this.sanitizeForLog(data),
      options
    });
    try {
      const existing = await this.findOne(criteria, { throwIfNotFound: false });
     
      if (existing) {
        // Mise à jour
        const result = await this.update(existing.id, data, options);
        return operation.success({
          operation: 'update',
          document: result,
          existed: true
        });
      } else {
        // Création
        const document = { ...criteria, ...data };
        const result = await this.create(document, options);
        return operation.success({
          operation: 'create',
          document: result,
          existed: false
        });
      }
    } catch (error) {
      return operation.error(error, {
        criteria: this.sanitizeForLog(criteria),
        data: this.sanitizeForLog(data)
      });
    }
  }

  // ============================================================================
  // AJOUT : MÉTHODE POUR SAUVEGARDE DE DONNÉES STRUCTURÉES (NESTED)
  // ============================================================================
  /**
   * @method saveStructuredData
   * @description Sauvegarde des données structurées/nested dans un document
   * Amélioration : Permet de persister des objets complexes (ex. : QR data, Table content) sans flattening.
   * @param {string} id - ID du document
   * @param {string} field - Champ nested à mettre à jour (ex. 'data' pour QR)
   * @param {Object|Array} structuredData - Données structurées à sauvegarder
   * @param {Object} options - Options de sauvegarde
   * @returns {Promise<Object>} Document mis à jour
   */
  async saveStructuredData(id, field, structuredData, options = {}) {
    const operation = log.trackOperation(`SAVE_STRUCTURED_DATA ${this.collectionName}`, {
      id,
      field,
      structuredData: this.sanitizeForLog(structuredData),
      options
    });
    try {
      // Validation si nécessaire
      if (this.options.validationRequired && typeof this.validateStructuredData === 'function') {
        const validation = this.validateStructuredData(field, structuredData);
        if (!validation.valid) {
          throw new ValidationError(`Données structurées invalides pour ${field}`, validation.errors);
        }
      }
      const updates = { [field]: structuredData };
      const result = await this.update(id, updates, options);
      this.logger.debug(`Données structurées sauvegardées pour ${field} dans document ${id}`);
      return operation.success(result);
    } catch (error) {
      return operation.error(error, { id, field });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DE CACHE
  // ============================================================================
  /**
   * @method getCacheKey
   * @description Génère une clé de cache pour une opération
   * @param {string} suffix - Suffix de la clé
   * @returns {string} Clé de cache complète
   */
  getCacheKey(suffix) {
    return `repo:${this.collectionName}:${suffix}`;
  }

  /**
   * @method invalidateCache
   * @description Invalide le cache pour un document ou toute la collection
   * @param {string} [id] - ID spécifique à invalider
   * @returns {Promise<void>}
   */
  async invalidateCache(id = null) {
    if (!this.options.enableCache) return;
    try {
      if (id) {
        // Invalider un document spécifique
        const specificKeys = [
          this.getCacheKey(`id:${id}`),
          this.getCacheKey(`doc:${id}`)
        ];
       
        await Promise.all(
          specificKeys.map(key => cacheManager.delete(key))
        );
      }
      // Invalider les clés de pattern pour les requêtes
      const pattern = this.getCacheKey('*');
      await cacheManager.deleteByPattern(pattern);
      this.logger.debug(`Cache invalidé pour ${this.collectionName}`, {
        id,
        pattern
      });
    } catch (error) {
      this.logger.warning(`Erreur invalidation cache ${this.collectionName}`, {
        error: error.message
      });
    }
  }

  /**
   * @method isCacheableQuery
   * @description Détermine si une requête peut être mise en cache
   * @param {Object} filters - Filtres de la requête
   * @param {Object} options - Options de la requête
   * @returns {boolean} True si cacheable
   */
  isCacheableQuery(filters, options) {
    // Ne pas cacher les requêtes complexes ou avec pagination avancée
    if (options.forceRefresh) return false;
    if (options.page > 10) return false; // Ne pas cacher les pages trop éloignées
   
    // Vérifier la complexité des filtres
    const filterKeys = Object.keys(filters || {});
    if (filterKeys.length > 3) return false;
   
    // Ne pas cacher les recherches texte ou regex
    for (const value of Object.values(filters || {})) {
      if (typeof value === 'object' && value !== null) {
        if (value.$regex || value.$text) return false;
      }
    }
    return true;
  }

  // ============================================================================
  // MÉTHODES DE VALIDATION ET CONTRAINTES
  // ============================================================================

  /**
   * @method prepareDocument
   * @description Prépare un document avant sauvegarde
   * @param {Object} data - Données du document
   * @param {string} operation - Type d'opération (create/update)
   * @returns {Object} Document préparé
   */
  prepareDocument(data, operation = 'create') {
    const nowISO = now().toISOString();
    const document = { ...data };
    if (operation === 'create') {
      document.id = document.id || generateShortId();
      document.createdAt = document.createdAt || nowISO;
      document.updatedAt = nowISO;
     
      // Valeurs par défaut
      if (document.isActive === undefined) document.isActive = true;
      if (document.status === undefined) document.status = 'active';
    } else if (operation === 'update') {
      document.updatedAt = nowISO;
    }
    // Nettoyer les champs undefined
    Object.keys(document).forEach(key => {
      if (document[key] === undefined) {
        delete document[key];
      }
    });
    return document;
  }

  /**
   * @method applyUpdates
   * @description Applique des mises à jour à un document
   * @param {Object} document - Document original
   * @param {Object} updates - Mises à jour à appliquer
   * @param {Object} options - Options d'application
   * @returns {Object} Document mis à jour
   */
  applyUpdates(document, updates, options = {}) {
    const updated = { ...document };
    // Application standard (merge simple)
    if (options.mergeStrategy === 'deep') {
      // Merge profond pour les objets imbriqués
      Object.keys(updates).forEach(key => {
        if (typeof updates[key] === 'object' && updates[key] !== null &&
            typeof updated[key] === 'object' && updated[key] !== null &&
            !Array.isArray(updates[key])) {
          updated[key] = { ...updated[key], ...updates[key] };
        } else {
          updated[key] = updates[key];
        }
      });
    } else {
      // Merge simple (écrasement)
      Object.assign(updated, updates);
    }
    // Protéger les champs sensibles
    const protectedFields = ['id', 'createdAt', 'createdBy'];
    protectedFields.forEach(field => {
      if (updates[field] && !options.allowProtected) {
        this.logger.warning(`Tentative de modification champ protégé: ${field}`, {
          documentId: document.id,
          field
        });
        delete updated[field];
      }
    });
    return updated;
  }

  /**
   * @method checkUniqueConstraints
   * @description Vérifie les contraintes d'unicité
   * @param {Object} document - Document à vérifier
   * @param {Array} collection - Collection complète
   * @param {string} [excludeId] - ID à exclure (pour les updates)
   * @returns {Promise<void>}
   */
  async checkUniqueConstraints(document, collection, excludeId = null) {
    const uniqueFields = this.getUniqueFields();
   
    for (const field of uniqueFields) {
      if (document[field] !== undefined && document[field] !== null) {
        const existing = collection.find(doc =>
          doc[field] === document[field] &&
          doc.id !== excludeId &&
          (!this.options.softDelete || !doc.deletedAt)
        );
        if (existing) {
          throw new ValidationError(
            `La valeur '${document[field]}' existe déjà pour le champ '${field}'`,
            [{ field, value: document[field], type: 'unique' }]
          );
        }
      }
    }
  }

  /**
   * @method getUniqueFields
   * @description Retourne les champs avec contrainte d'unicité
   * @returns {string[]} Liste des champs uniques
   */
  getUniqueFields() {
    // À surcharger dans les repositories enfants
    return [];
  }

  /**
   * @method checkDependencies
   * @description Vérifie les dépendances avant suppression
   * @param {Object} document - Document à supprimer
   * @param {Object} dbData - Données complètes de la base
   * @returns {Promise<void>}
   */
  async checkDependencies(document, dbData) {
    // À surcharger dans les repositories enfants
    // Exemple: vérifier qu'un utilisateur n'a pas d'événements avant suppression
    return Promise.resolve();
  }

  // ============================================================================
  // MÉTHODES DE FILTRAGE ET RECHERCHE
  // ============================================================================

  /**
   * @method applyFilters
   * @description Applique des filtres à une collection
   * @param {Array} collection - Collection à filtrer
   * @param {Object} filters - Filtres à appliquer
   * @returns {Array} Collection filtrée
   */
  applyFilters(collection, filters) {
    return collection.filter(doc => this.matchesCriteria(doc, filters));
  }

  /**
   * @method matchesCriteria
   * @description Vérifie si un document correspond aux critères
   * @param {Object} doc - Document à vérifier
   * @param {Object} criteria - Critères de recherche
   * @returns {boolean} True si correspond
   */
  matchesCriteria(doc, criteria) {
    return Object.keys(criteria).every(key => {
      const value = criteria[key];
      const docValue = doc[key];
      // Recherche exacte
      if (typeof value !== 'object' || value === null) {
        return docValue === value;
      }
      // Opérateurs de recherche
      if (value.$eq !== undefined) return docValue === value.$eq;
      if (value.$ne !== undefined) return docValue !== value.$ne;
      if (value.$in !== undefined) return value.$in.includes(docValue);
      if (value.$nin !== undefined) return !value.$nin.includes(docValue);
      if (value.$gt !== undefined) return docValue > value.$gt;
      if (value.$gte !== undefined) return docValue >= value.$gte;
      if (value.$lt !== undefined) return docValue < value.$lt;
      if (value.$lte !== undefined) return docValue <= value.$lte;
      if (value.$regex !== undefined) {
        const regex = new RegExp(value.$regex, value.$options || '');
        return regex.test(String(docValue));
      }
      if (value.$like !== undefined) {
        const pattern = value.$like.replace(/%/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(String(docValue));
      }
      return false;
    });
  }

  /**
   * @method applySorting
   * @description Applique un tri à une collection
   * @param {Array} collection - Collection à trier
   * @param {Object} sort - Configuration du tri
   * @returns {Array} Collection triée
   */
  applySorting(collection, sort) {
    return collection.sort((a, b) => {
      for (const [field, direction] of Object.entries(sort)) {
        const aValue = a[field];
        const bValue = b[field];
        const sortOrder = direction === 'desc' ? -1 : 1;
        if (aValue < bValue) return -1 * sortOrder;
        if (aValue > bValue) return 1 * sortOrder;
      }
      return 0;
    });
  }

  // ============================================================================
  // MÉTHODES D'INDEXATION
  // ============================================================================

  /**
   * @method updateIndexes
   * @description Met à jour les index après une opération
   * @param {Object} dbData - Données de la base
   * @param {Object} document - Document affecté
   * @param {string} operation - Type d'opération
   * @param {Object} [oldDocument] - Ancien document (pour les updates)
   */
  updateIndexes(dbData, document, operation, oldDocument = null) {
    if (!dbData.indexes || !dbData.indexes[this.collectionName]) {
      return;
    }
    const indexes = dbData.indexes[this.collectionName];
    // Mettre à jour les index selon l'opération
    Object.keys(indexes).forEach(indexName => {
      const index = indexes[indexName];
     
      if (operation === 'delete') {
        this.removeFromIndex(index, document, indexName);
      } else if (operation === 'update' && oldDocument) {
        this.removeFromIndex(index, oldDocument, indexName);
        this.addToIndex(index, document, indexName);
      } else {
        this.addToIndex(index, document, indexName);
      }
    });
  }

  /**
   * @method addToIndex
   * @description Ajoute un document à un index
   * @param {Object} index - Index cible
   * @param {Object} document - Document à indexer
   * @param {string} indexName - Nom de l'index
   */
  addToIndex(index, document, indexName) {
    try {
      const indexValue = this.getIndexValue(document, indexName);
      if (indexValue !== undefined) {
        if (!index[indexValue]) {
          index[indexValue] = [];
        }
        // Éviter les doublons
        if (!index[indexValue].includes(document.id)) {
          index[indexValue].push(document.id);
        }
      }
    } catch (error) {
      this.logger.warning(`Erreur ajout à l'index ${indexName}`, {
        error: error.message,
        documentId: document.id
      });
    }
  }

  /**
   * @method removeFromIndex
   * @description Supprime un document d'un index
   * @param {Object} index - Index cible
   * @param {Object} document - Document à désindexer
   * @param {string} indexName - Nom de l'index
   */
  removeFromIndex(index, document, indexName) {
    try {
      const indexValue = this.getIndexValue(document, indexName);
      if (indexValue !== undefined && index[indexValue]) {
        index[indexValue] = index[indexValue].filter(id => id !== document.id);
        // Nettoyer les entrées vides
        if (index[indexValue].length === 0) {
          delete index[indexValue];
        }
      }
    } catch (error) {
      this.logger.warning(`Erreur suppression de l'index ${indexName}`, {
        error: error.message,
        documentId: document.id
      });
    }
  }

  /**
   * @method getIndexValue
   * @description Récupère la valeur d'index pour un document. Amélioration : Support pour subtypes (ex. : type pour QR).
   * @param {Object} document - Document
   * @param {string} indexName - Nom de l'index
   * @returns {*} Valeur d'index
   */
  getIndexValue(document, indexName) {
    // Implémentation basique - à surcharger pour des index complexes
    const fieldMap = {
      'byId': 'id',
      'byStatus': 'status',
      'byType': 'type',  // Amélioration : Index par type (ex. 'invitation', 'table')
      'byCreatedAt': 'createdAt',
      'byUpdatedAt': 'updatedAt'
    };
    const field = fieldMap[indexName] || indexName.replace('by', '').toLowerCase();
    return document[field];
  }

  // ============================================================================
  // MÉTHODES D'AUDIT ET LOGS
  // ============================================================================

  /**
   * @method audit
   * @description Enregistre un événement d'audit
   * @param {string} action - Action effectuée
   * @param {string} targetId - ID de la cible
   * @param {Object} details - Détails de l'audit
   */
  audit(action, targetId, details = {}) {
    if (!this.options.enableAudit) return;
    log.audit(`${action} ${this.collectionName}`, {
      collection: this.collectionName,
      targetId,
      action,
      timestamp: now().toISOString(),
      ...details
    });
  }

  /**
   * @method sanitizeForLog
   * @description Nettoie les données pour les logs (masque les informations sensibles)
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeForLog(data) {
    if (!data || typeof data !== 'object') return data;
    const sensitiveFields = [
      'password', 'token', 'secret', 'privateKey',
      'accessToken', 'refreshToken', 'authorization',
      'apiKey', 'jwt', 'session'
    ];
    const sanitized = { ...data };
   
    sensitiveFields.forEach(field => {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '***MASKED***';
      }
    });
    return sanitized;
  }

  // ============================================================================
  // MÉTHODES DE SANTÉ ET STATISTIQUES
  // ============================================================================

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    try {
      const count = await this.count();
      const cacheStatus = this.options.enableCache ? await cacheManager.healthCheck() : { status: 'disabled' };
      return {
        status: 'healthy',
        collection: this.collectionName,
        documentCount: count,
        cacheEnabled: this.options.enableCache,
        cacheStatus: cacheStatus.status,
        initialized: this.initialized,
        timestamp: now().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        collection: this.collectionName,
        error: error.message,
        timestamp: now().toISOString()
      };
    }
  }

  /**
   * @method getStats
   * @description Récupère les statistiques du repository
   * @returns {Promise<Object>} Statistiques
   */
  async getStats() {
    try {
      const totalCount = await this.count();
      const activeCount = this.options.softDelete ?
        await this.count({ isActive: true }) : totalCount;
      return {
        collection: this.collectionName,
        total: totalCount,
        active: activeCount,
        softDeleteEnabled: this.options.softDelete,
        cacheEnabled: this.options.enableCache,
        cacheTTL: this.options.cacheTTL,
        lastUpdated: now().toISOString()
      };
    } catch (error) {
      this.logger.error(`Erreur récupération stats ${this.collectionName}`, {
        error: error.message
      });
      throw error;
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * @method bulkCreate
   * @description Crée plusieurs documents en une opération
   * @param {Array} documents - Tableau de documents à créer
   * @param {Object} options - Options de création
   * @returns {Promise<Object>} Résultat de la création
   */
  async bulkCreate(documents, options = {}) {
    const operation = log.trackOperation(`BULK_CREATE ${this.collectionName}`, {
      count: documents.length,
      options
    });
    try {
      const results = await databaseManager.transaction(async (dbData, transactionId) => {
        const collection = dbData[this.collectionName] || [];
        const createdDocuments = [];
        for (const data of documents) {
          // Validation des données
          if (this.options.validationRequired && typeof this.validate === 'function') {
            const validation = this.validate(data);
            if (!validation.valid) {
              throw new ValidationError(`Document invalide: ${validation.errors.join(', ')}`);
            }
          }
          const document = this.prepareDocument(data, 'create');
         
          // Vérifier les contraintes d'unicité
          await this.checkUniqueConstraints(document, collection);
          collection.push(document);
          createdDocuments.push(document);
          // Mettre à jour les index
          this.updateIndexes(dbData, document, 'create');
        }
        dbData[this.collectionName] = collection;
        this.logger.crud('BULK_CREATE', this.collectionName, {
          created: createdDocuments.length
        }, { transactionId });
        return {
          created: createdDocuments.length,
          documents: createdDocuments
        };
      });
      // Invalider le cache
      await this.invalidateCache();
      // Audit
      if (this.options.enableAudit) {
        this.audit('BULK_CREATE', 'multiple', {
          count: results.created,
          documents: results.documents.map(doc => this.sanitizeForLog(doc))
        });
      }
      return operation.success(results);
    } catch (error) {
      return operation.error(error, { count: documents.length });
    }
  }

  /**
   * @method bulkUpdate
   * @description Met à jour plusieurs documents par critères
   * @param {Object} criteria - Critères de sélection
   * @param {Object} updates - Mises à jour à appliquer
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  async bulkUpdate(criteria, updates, options = {}) {
    return this.updateMany(criteria, updates, options);
  }

  /**
   * @method restore
   * @description Restaure un document supprimé (soft delete)
   * @param {string} id - ID du document à restaurer
   * @returns {Promise<Object>} Document restauré
   */
  async restore(id) {
    if (!this.options.softDelete) {
      throw new AppError('Soft delete non activé pour cette collection', 400, 'SOFT_DELETE_DISABLED');
    }
    const operation = log.trackOperation(`RESTORE ${this.collectionName}`, { id });
    try {
      const result = await databaseManager.transaction(async (dbData, transactionId) => {
        const collection = dbData[this.collectionName] || [];
        const index = collection.findIndex(doc => doc.id === id && doc.deletedAt);
        if (index === -1) {
          throw new NotFoundError(`${this.collectionName} avec ID: ${id} ou non supprimé`);
        }
        const document = collection[index];
        const restoredDocument = {
          ...document,
          deletedAt: null,
          isActive: true,
          updatedAt: now().toISOString()
        };
        collection[index] = restoredDocument;
        dbData[this.collectionName] = collection;
        // Mettre à jour les index
        this.updateIndexes(dbData, restoredDocument, 'update', document);
        this.logger.crud('RESTORE', this.collectionName, { id }, { transactionId });
        return restoredDocument;
      });
      // Invalider le cache
      await this.invalidateCache(id);
      // Audit
      if (this.options.enableAudit) {
        this.audit('RESTORE', id, { document: this.sanitizeForLog(result) });
      }
      return operation.success({ restored: result });
    } catch (error) {
      return operation.error(error, { id });
    }
  }

  /**
   * @method hardDelete
   * @description Suppression physique (ignore soft delete)
   * @param {string} id - ID du document
   * @returns {Promise<Object>} Résultat de suppression
   */
  async hardDelete(id) {
    return this.delete(id, { softDelete: false });
  }

  /**
   * @method truncate
   * @description Vide complètement la collection (DANGEREUX)
   * @param {Object} options - Options de truncate
   * @returns {Promise<Object>} Résultat du truncate
   */
  async truncate(options = {}) {
    const operation = log.trackOperation(`TRUNCATE ${this.collectionName}`, { options });
    try {
      if (!options.confirm) {
        throw new AppError(
          'Confirmation requise pour truncate. Utilisez { confirm: true }',
          400,
          'CONFIRMATION_REQUIRED'
        );
      }
      const result = await databaseManager.transaction(async (dbData, transactionId) => {
        const previousCount = dbData[this.collectionName]?.length || 0;
        dbData[this.collectionName] = [];
        // Réinitialiser les index
        if (dbData.indexes && dbData.indexes[this.collectionName]) {
          dbData.indexes[this.collectionName] = {};
        }
        this.logger.crud('TRUNCATE', this.collectionName, {
          deleted: previousCount
        }, { transactionId });
        return { deleted: previousCount };
      });
      // Invalider tout le cache
      await this.invalidateCache();
      // Audit
      if (this.options.enableAudit) {
        this.audit('TRUNCATE', 'all', { deleted: result.deleted });
      }
      return operation.success(result);
    } catch (error) {
      return operation.error(error);
    }
  }
}

module.exports = BaseRepository;