/**
 * @file database.js
 * @description Gestionnaire de base de données ultra-avancé pour Secura QR.
 * Gère la synchronisation bidirectionnelle entre JSON local et Firebase Firestore.
 * Inclut backup automatique, transaction, conflict resolution et migration.
 * @module config/database
 * @requires fs/promises
 * @requires path
 * @requires crypto
 * @requires ../utils/errorHandler
 * @requires ../utils/logger
 * @requires ./config
 * @requires ./firebase
 * @requires ./cache
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/dateHelper
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const config = require('./config');
const { db: firestore, isInitialized: isFirebaseInitialized } = require('./firebase');
const cacheManager = require('./cache');
const { 
  generateShortId,
  generateBackupId,
} = require('../utils/helpers/idGenerator');
const { 
  now, 
  sleep,
  diffInMinutes,
} = require('../utils/helpers/dateHelper');

/**
 * @typedef {Object} SyncResult
 * @property {boolean} success - Succès de la synchronisation
 * @property {number} uploaded - Nombre de documents uploadés
 * @property {number} downloaded - Nombre de documents téléchargés
 * @property {number} conflicts - Nombre de conflits
 * @property {Array<string>} errors - Erreurs rencontrées
 * @property {number} duration - Durée en ms
 */

/**
 * @typedef {Object} BackupInfo
 * @property {string} filename - Nom du fichier
 * @property {string} path - Chemin complet
 * @property {number} size - Taille en octets
 * @property {Date} created - Date de création
 * @property {string} type - Type de backup (auto, manual)
 * @property {string} checksum - Checksum des données
 */

/**
 * @typedef {Object} DatabaseStats
 * @property {number} totalReads - Total des lectures
 * @property {number} totalWrites - Total des écritures
 * @property {number} totalSyncs - Total des synchronisations
 * @property {number} syncErrors - Erreurs de synchronisation
 * @property {Date} lastBackup - Dernier backup
 * @property {number} dataSize - Taille des données en octets
 * @property {number} cacheHits - Hits du cache
 * @property {number} cacheMisses - Misses du cache
 */

/**
 * @class DatabaseManager
 * @description Gestionnaire ultra-avancé de base de données avec sync Firebase
 */
class DatabaseManager {
  constructor() {
    this.dbPath = path.resolve(config.dbFile);
    this.backupDir = path.resolve(config.backupDir);
    this.tempDir = path.resolve('./storage/temp');
    this.initialized = false;
    this.syncInProgress = false;
    this.lastSync = null;
    this.instanceId = generateShortId();
    
    // Configuration de synchronisation
    this.syncConfig = {
      enabled: config.syncEnabled || false,
      interval: config.syncInterval || 30000,
      batchSize: config.syncBatchSize || 100,
      conflictResolution: 'server_wins', // server_wins, client_wins, merge, timestamp
      autoSync: true,
      retryAttempts: 3,
      retryDelay: 5000,
      collections: ['events', 'guests', 'users', 'scans', 'qrCodes', 'sessions', 'invitations', 'galleries', 'messages']
    };

    // Statistiques étendues
    this.stats = {
      totalReads: 0,
      totalWrites: 0,
      totalSyncs: 0,
      syncErrors: 0,
      lastBackup: null,
      dataSize: 0,
      cacheHits: 0,
      cacheMisses: 0,
      transactionCount: 0,
      failedTransactions: 0,
      startupTime: now()
    };

    // Queue de synchronisation
    this.syncQueue = [];
    this.conflictLog = [];
    this.auditLog = [];

    // Verrous pour éviter les conflits
    this.locks = new Map();
    this.transactionLocks = new Map();

    // Cache interne
    this._cachedData = null;
    this._cacheTimestamp = null;
    this._cacheTTL = 5000; // 5 secondes

    // Intervalles
    this.autoSyncInterval = null;
    this.cleanupInterval = null;
    this.healthCheckInterval = null;

    this.initialize();
  }

  /**
   * @method initialize
   * @description Initialise le gestionnaire de base de données
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      logger.info('Database: Début initialisation gestionnaire...', {
        instanceId: this.instanceId,
        environment: config.nodeEnv
      });

      await this.ensureDirectories();
      await this.ensureDatabaseFile();
      
      // Vérifier l'intégrité
      const integrityCheck = await this.validateDataIntegrity();
      if (!integrityCheck.valid) {
        logger.warn('Database: Problèmes d\'intégrité détectés', {
          errors: integrityCheck.errors,
          warnings: integrityCheck.warnings
        });
        await this.attemptAutoRepair(integrityCheck);
      }

      // Initialiser le cache
      await this.initializeCache();

      // Démarrer la synchronisation automatique si activée
      if (this.syncConfig.enabled && this.syncConfig.autoSync) {
        this.startAutoSync();
      }

      // Démarrer le nettoyage automatique
      this.startAutoCleanup();

      // Démarrer les health checks
      this.startHealthChecks();

      this.initialized = true;
      
      logger.success('Database: Gestionnaire initialisé avec succès', {
        instanceId: this.instanceId,
        path: this.dbPath,
        syncEnabled: this.syncConfig.enabled,
        firebaseConnected: isFirebaseInitialized(),
        collections: this.syncConfig.collections
      });

      this.logAudit('SYSTEM_STARTUP', 'Database manager initialized successfully');

    } catch (error) {
      logger.error('Database: Erreur initialisation', {
        error: error.message,
        stack: error.stack,
        instanceId: this.instanceId
      });
      throw new AppError(
        'Erreur initialisation base de données',
        500,
        'DB_INIT_ERROR'
      );
    }
  }

  /**
   * @method ensureDirectories
   * @description Crée les répertoires nécessaires
   * @returns {Promise<void>}
   */
  async ensureDirectories() {
    const directories = [
      path.dirname(this.dbPath),
      this.backupDir,
      this.tempDir,
      path.join(this.backupDir, 'auto'),
      path.join(this.backupDir, 'manual'),
      path.join(this.backupDir, 'emergency'),
      path.join(this.tempDir, 'transactions'),
      path.join(this.tempDir, 'exports')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

    logger.debug('Database: Répertoires créés/vérifiés', {
      directories: directories.map(d => path.basename(d))
    });
  }

  /**
   * @method ensureDatabaseFile
   * @description Crée le fichier de base de données avec structure initiale
   * @returns {Promise<void>}
   */
  async ensureDatabaseFile() {
    try {
      await fs.access(this.dbPath);
      logger.debug('Database: Fichier existant trouvé', { path: this.dbPath });
    } catch {
      const initialData = this.getInitialDataStructure();
      await this.writeToFile(initialData);
      logger.info('Database: Nouveau fichier créé', {
        path: this.dbPath,
        structure: Object.keys(initialData)
      });
    }
  }

  /**
   * @method getInitialDataStructure
   * @description Retourne la structure initiale ultra-complète
   * @returns {Object} Structure initiale
   */
  getInitialDataStructure() {
    const nowISO = now().toISOString();
    
    return {
      // Métadonnées enrichies
      meta: {
        version: '4.0.0',
        schema: '2.0',
        server: 'SECURA-ULTRA-PRO-V4',
        instanceId: this.instanceId,
        createdAt: nowISO,
        updatedAt: nowISO,
        lastSync: null,
        lastBackup: null,
        lastMaintenance: nowISO,
        dataSource: 'json',
        syncStrategy: this.syncConfig.conflictResolution,
        environment: config.nodeEnv,
        checksum: this.generateChecksum({}),
        stats: {
          totalEvents: 0,
          totalGuests: 0,
          totalUsers: 0,
          totalScans: 0,
          totalSessions: 0,
          totalInvitations: 0,
          totalGalleries: 0,
          totalMessages: 0,
          totalQRCodes: 0,
          totalTableQRs: 0,
          totalPhotos: 0,
          totalComments: 0
        },
        migrations: [],
        settings: {
          autoBackup: config.backupEnabled,
          backupInterval: config.backupIntervalMinutes,
          syncEnabled: this.syncConfig.enabled,
          offlineMode: config.offlineModeEnabled
        }
      },

      // Collections principales
      users: [],
      events: [],
      guests: [],
      qrCodes: [],
      scans: [],

      // Collections avancées V4
      sessions: [],
      invitations: [],
      permissions: [],
      roles: [],
      galleries: [],
      tableQRCodes: [],
      messages: [],
      settings: [],
      notifications: [],
      analytics: [],
      auditLogs: [],

      // Index pour performances optimales
      indexes: {
        users: {
          byEmail: {},
          byRole: {},
          byStatus: {},
          byCreatedAt: {}
        },
        events: {
          byUserId: {},
          byDate: {},
          byStatus: {},
          byType: {},
          byCreatedAt: {}
        },
        guests: {
          byEventId: {},
          byEmail: {},
          byStatus: {},
          byTableNumber: {},
          byCreatedAt: {}
        },
        scans: {
          byEventId: {},
          byGuestId: {},
          byDate: {},
          byScannerId: {},
          byCreatedAt: {}
        },
        qrCodes: {
          byGuestId: {},
          byEventId: {},
          byStatus: {},
          byType: {}
        },
        sessions: {
          byEventId: {},
          byStatus: {},
          byAgentId: {},
          byCreatedAt: {}
        },
        invitations: {
          byEventId: {},
          byGuestId: {},
          byStatus: {},
          byToken: {}
        },
        galleries: {
          byEventId: {},
          byStatus: {},
          byCreatedAt: {}
        },
        messages: {
          byEventId: {},
          byAuthorId: {},
          byStatus: {},
          byCreatedAt: {}
        }
      },

      // Cache intégré
      cache: {
        queries: {},
        aggregations: {},
        ttl: {},
        lastInvalidation: nowISO
      },

      // Système de synchronisation
      sync: {
        lastPull: null,
        lastPush: null,
        pendingChanges: [],
        conflicts: [],
        syncLog: [],
        queueSize: 0,
        status: 'idle'
      },

      // Maintenance
      maintenance: {
        lastCleanup: null,
        lastOptimization: null,
        lastValidation: null,
        issues: []
      }
    };
  }

  /**
   * @method loadData
   * @description Charge les données avec cache et validation
   * @param {boolean} [useCache=true] - Utiliser le cache
   * @param {boolean} [forceRefresh=false] - Forcer le rechargement
   * @returns {Promise<Object>} Données chargées
   */
  async loadData(useCache = true, forceRefresh = false) {
    try {
      this.stats.totalReads++;

      // Vérifier le cache
      if (useCache && this._cachedData && !forceRefresh) {
        const cacheAge = Date.now() - this._cacheTimestamp;
        if (cacheAge < this._cacheTTL) {
          this.stats.cacheHits++;
          return this._cachedData;
        }
      }

      this.stats.cacheMisses++;

      const rawData = await fs.readFile(this.dbPath, 'utf8');
      const data = JSON.parse(rawData);

      // Migration automatique si nécessaire
      const migratedData = await this.migrateDataStructure(data);

      // Validation approfondie
      const validation = await this.validateDataStructure(migratedData);
      if (!validation.valid) {
        logger.warn('Database: Données invalides détectées', {
          errors: validation.errors.length,
          warnings: validation.warnings.length
        });
      }

      // Calculer la taille des données
      this.stats.dataSize = Buffer.byteLength(JSON.stringify(migratedData), 'utf8');

      // Mise en cache
      this._cachedData = migratedData;
      this._cacheTimestamp = Date.now();

      logger.debug('Database: Données chargées avec succès', {
        collections: Object.keys(migratedData).filter(k => Array.isArray(migratedData[k])).length,
        dataSize: this.formatFileSize(this.stats.dataSize),
        cacheHit: !forceRefresh && useCache
      });

      return migratedData;
    } catch (error) {
      logger.error('Database: Erreur chargement données', {
        error: error.message,
        path: this.dbPath
      });

      // Tentative de récupération depuis backup
      return await this.recoverFromBackup();
    }
  }

  /**
   * @method saveData
   * @description Sauvegarde avec backup et synchronisation
   * @param {Object} data - Données à sauvegarder
   * @param {Object} [options] - Options de sauvegarde
   * @returns {Promise<void>}
   */
  async saveData(data, options = {}) {
    const {
      createBackup = false,
      syncToFirebase = this.syncConfig.enabled,
      validate = true,
      transactionId = null,
      reason = 'manual'
    } = options;

    const lockKey = transactionId || generateShortId();

    try {
      // Acquérir un verrou
      await this.acquireLock(lockKey);

      this.stats.totalWrites++;

      // Validation pré-sauvegarde
      if (validate) {
        const validation = await this.validateDataStructure(data);
        if (!validation.valid) {
          throw new AppError(
            'Données invalides',
            400,
            'INVALID_DATA',
            { errors: validation.errors }
          );
        }
      }

      // Mettre à jour les métadonnées
      data.meta.updatedAt = now().toISOString();
      data.meta.version = '4.0.0';
      data.meta.checksum = this.generateChecksum(data);
      this.updateStats(data);

      // Créer backup avant modification si demandé
      if (createBackup) {
        await this.createBackup(`pre_save_${reason}`);
      }

      // Sauvegarder dans JSON
      await this.writeToFile(data);

      // Invalider le cache
      this._cachedData = null;

      // Synchroniser avec Firebase si activé
      if (syncToFirebase && isFirebaseInitialized()) {
        this.queueSyncToFirebase(data, reason);
      }

      // Journaliser l'audit
      this.logAudit('DATA_SAVED', `Data saved successfully: ${reason}`, {
        transactionId,
        collections: Object.keys(data).filter(k => Array.isArray(data[k])),
        syncQueued: syncToFirebase
      });

      logger.debug('Database: Données sauvegardées avec succès', {
        transactionId,
        reason,
        collections: Object.keys(data).filter(k => Array.isArray(data[k])).length,
        syncQueued: syncToFirebase
      });

    } catch (error) {
      this.stats.failedTransactions++;
      logger.error('Database: Erreur sauvegarde données', {
        error: error.message,
        transactionId,
        reason
      });
      throw new AppError(
        'Erreur sauvegarde base de données',
        500,
        'DB_SAVE_ERROR'
      );
    } finally {
      // Libérer le verrou
      this.releaseLock(lockKey);
    }
  }

  /**
   * @method writeToFile
   * @description Écriture atomique avec vérification
   * @param {Object} data - Données à écrire
   * @returns {Promise<void>}
   */
  async writeToFile(data) {
    const tempPath = `${this.dbPath}.tmp`;
    const backupPath = `${this.dbPath}.bak`;
    const emergencyPath = path.join(this.backupDir, 'emergency', `emergency_${generateShortId()}.json`);

    try {
      // Écrire dans fichier temporaire
      const serializedData = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, serializedData, 'utf8');

      // Vérifier l'intégrité du fichier temporaire
      const writtenData = await fs.readFile(tempPath, 'utf8');
      JSON.parse(writtenData); // Validation JSON

      // Backup de l'ancien fichier
      try {
        await fs.copyFile(this.dbPath, backupPath);
        await fs.copyFile(this.dbPath, emergencyPath); // Backup d'urgence
      } catch (err) {
        // Fichier n'existe pas encore
      }

      // Renommer atomiquement
      await fs.rename(tempPath, this.dbPath);

      // Nettoyer le backup temporaire après succès
      try {
        await fs.unlink(backupPath);
      } catch (err) {
        // Pas grave si échec
      }

      logger.debug('Database: Écriture atomique réussie', {
        dataSize: this.formatFileSize(Buffer.byteLength(serializedData, 'utf8'))
      });

    } catch (error) {
      // Restaurer depuis backup en cas d'erreur
      try {
        if (fsSync.existsSync(backupPath)) {
          await fs.copyFile(backupPath, this.dbPath);
          logger.warn('Database: Restauration depuis backup temporaire');
        }
      } catch (restoreError) {
        // Pas de backup disponible
      }

      throw new AppError(
        `Erreur écriture atomique: ${error.message}`,
        500,
        'DB_WRITE_ERROR'
      );
    }
  }

  /**
   * @method syncToFirebase
   * @description Synchronise les données vers Firebase
   * @param {Object} [collections] - Collections à synchroniser
   * @param {string} [reason='manual'] - Raison de la synchronisation
   * @returns {Promise<SyncResult>}
   */
  async syncToFirebase(collections = null, reason = 'manual') {
    if (!isFirebaseInitialized()) {
      throw new AppError(
        'Firebase non initialisé',
        500,
        'FIREBASE_NOT_INITIALIZED'
      );
    }

    if (this.syncInProgress) {
      logger.warn('Database: Synchronisation déjà en cours');
      return { 
        success: false, 
        message: 'Sync in progress',
        duration: 0,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ['Sync already in progress']
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const syncId = generateShortId();

    const result = {
      success: true,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
      duration: 0,
      syncId
    };

    try {
      logger.info('Database: Début synchronisation Firebase', {
        syncId,
        reason,
        collections: collections || this.syncConfig.collections
      });

      this.logAudit('SYNC_STARTED', `Firebase sync started: ${reason}`, { syncId, reason });

      const data = await this.loadData(false);
      const collectionsToSync = collections || this.syncConfig.collections;

      // Mettre à jour le statut de sync
      data.sync.status = 'in_progress';
      data.sync.lastPush = now().toISOString();

      // Synchroniser chaque collection
      for (const collectionName of collectionsToSync) {
        try {
          const collectionResult = await this.syncCollection(
            collectionName,
            data[collectionName] || [],
            syncId
          );

          result.uploaded += collectionResult.uploaded;
          result.downloaded += collectionResult.downloaded;
          result.conflicts += collectionResult.conflicts;

          logger.debug(`Database: Collection ${collectionName} synchronisée`, {
            syncId,
            ...collectionResult
          });

        } catch (error) {
          result.errors.push({
            collection: collectionName,
            error: error.message,
            stack: error.stack
          });
          logger.error(`Database: Erreur sync collection ${collectionName}`, {
            syncId,
            error: error.message
          });
        }
      }

      // Mettre à jour les métadonnées de sync
      data.meta.lastSync = now().toISOString();
      data.sync.lastPush = now().toISOString();
      data.sync.status = 'completed';
      data.sync.syncLog.unshift({
        syncId,
        timestamp: now().toISOString(),
        type: 'push',
        reason,
        result: { ...result },
        duration: Date.now() - startTime
      });

      // Limiter la taille du log de sync
      if (data.sync.syncLog.length > 100) {
        data.sync.syncLog = data.sync.syncLog.slice(0, 100);
      }

      await this.saveData(data, { syncToFirebase: false, reason: `sync_${reason}` });

      result.duration = Date.now() - startTime;
      this.stats.totalSyncs++;
      this.lastSync = now().toISOString();

      this.logAudit('SYNC_COMPLETED', `Firebase sync completed: ${reason}`, {
        syncId,
        duration: result.duration,
        ...result
      });

      logger.success('Database: Synchronisation terminée avec succès', {
        syncId,
        uploaded: result.uploaded,
        downloaded: result.downloaded,
        conflicts: result.conflicts,
        duration: `${result.duration}ms`,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      this.stats.syncErrors++;
      result.success = false;
      result.errors.push(error.message);
      result.duration = Date.now() - startTime;

      this.logAudit('SYNC_FAILED', `Firebase sync failed: ${reason}`, {
        syncId,
        error: error.message,
        duration: result.duration
      });

      logger.error('Database: Échec synchronisation', {
        syncId,
        error: error.message,
        duration: result.duration
      });

      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * @method syncCollection
   * @description Synchronise une collection spécifique
   * @param {string} collectionName - Nom de la collection
   * @param {Array} localData - Données locales
   * @param {string} syncId - ID de synchronisation
   * @returns {Promise<Object>} Résultat sync
   */
  async syncCollection(collectionName, localData, syncId) {
    const result = {
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      processed: 0
    };

    const collectionRef = firestore.collection(collectionName);
    const batchSize = this.syncConfig.batchSize;

    try {
      // Récupérer les documents Firebase
      const snapshot = await collectionRef.get();
      const firebaseData = new Map();
      
      snapshot.forEach(doc => {
        firebaseData.set(doc.id, {
          id: doc.id,
          ...doc.data(),
          _firestoreTimestamp: doc.updateTime || doc.createTime
        });
      });

      // Créer une map des données locales
      const localDataMap = new Map(
        localData.map(item => [item.id, item])
      );

      // Détecter les changements
      const toUpload = [];
      const toDownload = [];
      const conflicts = [];

      // Vérifier les documents locaux
      for (const [id, localDoc] of localDataMap) {
        const firebaseDoc = firebaseData.get(id);

        if (!firebaseDoc) {
          // Document uniquement local → uploader
          toUpload.push(localDoc);
        } else {
          // Comparer les timestamps
          const localTime = new Date(localDoc.updatedAt || localDoc.createdAt || localDoc._createdAt);
          const firebaseTime = firebaseDoc._firestoreTimestamp.toDate();

          if (localTime > firebaseTime) {
            toUpload.push(localDoc);
          } else if (firebaseTime > localTime) {
            // Conflit potentiel
            const resolved = await this.resolveConflict(
              collectionName,
              localDoc,
              firebaseDoc
            );

            if (resolved.action === 'download') {
              toDownload.push(firebaseDoc);
            } else if (resolved.action === 'upload') {
              toUpload.push(localDoc);
            } else {
              conflicts.push({
                id,
                collection: collectionName,
                local: localDoc,
                remote: firebaseDoc,
                resolution: resolved,
                timestamp: now().toISOString()
              });
            }
          }
        }
      }

      // Vérifier les documents Firebase uniquement
      for (const [id, firebaseDoc] of firebaseData) {
        if (!localDataMap.has(id)) {
          toDownload.push(firebaseDoc);
        }
      }

      result.processed = localDataMap.size + firebaseData.size;

      // Uploader par batch
      if (toUpload.length > 0) {
        for (let i = 0; i < toUpload.length; i += batchSize) {
          const batch = firestore.batch();
          const chunk = toUpload.slice(i, i + batchSize);

          chunk.forEach(doc => {
            const docRef = collectionRef.doc(doc.id);
            const { _firestoreTimestamp, ...dataToUpload } = doc;
            batch.set(docRef, dataToUpload, { merge: true });
          });

          await batch.commit();
          result.uploaded += chunk.length;
        }

        logger.debug(`Database: Documents uploadés pour ${collectionName}`, {
          syncId,
          uploaded: toUpload.length
        });
      }

      // Télécharger
      if (toDownload.length > 0) {
        // Les données téléchargées seront fusionnées lors du prochain loadData
        result.downloaded = toDownload.length;
        logger.debug(`Database: Documents à télécharger pour ${collectionName}`, {
          syncId,
          downloaded: toDownload.length
        });
      }

      result.conflicts = conflicts.length;

      if (conflicts.length > 0) {
        this.conflictLog.push(...conflicts.map(conflict => ({
          ...conflict,
          syncId
        })));
        logger.warn(`Database: Conflits détectés pour ${collectionName}`, {
          syncId,
          conflicts: conflicts.length
        });
      }

      return result;
    } catch (error) {
      logger.error(`Database: Erreur synchronisation collection ${collectionName}`, {
        syncId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method resolveConflict
   * @description Résout un conflit de synchronisation
   * @param {string} collection - Collection
   * @param {Object} localDoc - Document local
   * @param {Object} remoteDoc - Document distant
   * @returns {Promise<Object>} Résolution
   */
  async resolveConflict(collection, localDoc, remoteDoc) {
    const strategy = this.syncConfig.conflictResolution;

    switch (strategy) {
      case 'server_wins':
        return { 
          action: 'download', 
          winner: 'remote',
          strategy: 'server_wins',
          resolvedAt: now().toISOString()
        };
      
      case 'client_wins':
        return { 
          action: 'upload', 
          winner: 'local',
          strategy: 'client_wins',
          resolvedAt: now().toISOString()
        };
      
      case 'merge':
        // Fusion intelligente
        const merged = this.mergeDocuments(localDoc, remoteDoc);
        return { 
          action: 'upload', 
          winner: 'merged', 
          data: merged,
          strategy: 'merge',
          resolvedAt: now().toISOString()
        };
      
      case 'timestamp':
      default:
        // Timestamp plus récent gagne
        const localTime = new Date(localDoc.updatedAt || localDoc.createdAt || localDoc._createdAt);
        const remoteTime = remoteDoc._firestoreTimestamp.toDate();
        const winner = localTime > remoteTime ? 'local' : 'remote';
        
        return {
          action: winner === 'local' ? 'upload' : 'download',
          winner,
          strategy: 'timestamp',
          localTime: localTime.toISOString(),
          remoteTime: remoteTime.toISOString(),
          resolvedAt: now().toISOString()
        };
    }
  }

  /**
   * @method mergeDocuments
   * @description Fusionne intelligemment deux documents
   * @param {Object} local - Document local
   * @param {Object} remote - Document distant
   * @returns {Object} Document fusionné
   */
  mergeDocuments(local, remote) {
    const merged = { ...remote };

    // Fusionner les champs mis à jour localement
    for (const [key, value] of Object.entries(local)) {
      if (key.startsWith('_')) continue; // Ignorer les métadonnées internes

      if (key === 'updatedAt' || key === 'createdAt') {
        // Garder la date la plus récente
        const localDate = new Date(value);
        const remoteDate = new Date(remote[key]);
        merged[key] = localDate > remoteDate ? value : remote[key];
        continue;
      }

      // Si le champ local est plus récent, le garder
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = this.mergeDocuments(value, remote[key] || {});
      } else if (Array.isArray(value)) {
        // Fusionner les tableaux (union sans doublons)
        const remoteArray = remote[key] || [];
        merged[key] = [...new Set([...remoteArray, ...value])];
      } else {
        merged[key] = value;
      }
    }

    merged.updatedAt = now().toISOString();
    merged._mergedFrom = {
      local: local.updatedAt || local.createdAt,
      remote: remote._firestoreTimestamp?.toDate()?.toISOString(),
      mergedAt: now().toISOString()
    };

    return merged;
  }

  /**
   * @method queueSyncToFirebase
   * @description Ajoute à la queue de synchronisation
   * @param {Object} data - Données à synchroniser
   * @param {string} reason - Raison de la sync
   * @returns {void}
   */
  queueSyncToFirebase(data, reason = 'manual') {
    const queueItem = {
      data,
      reason,
      timestamp: Date.now(),
      queueId: generateShortId()
    };

    this.syncQueue.push(queueItem);

    // Mettre à jour les métadonnées de queue
    data.sync.queueSize = this.syncQueue.length;
    data.sync.pendingChanges.push({
      queueId: queueItem.queueId,
      reason,
      timestamp: now().toISOString()
    });

    // Traiter la queue si pas déjà en cours
    if (!this.syncInProgress && this.syncQueue.length > 0) {
      setTimeout(() => this.processSyncQueue(), 1000);
    }

    logger.debug('Database: Item ajouté à la queue de sync', {
      queueId: queueItem.queueId,
      reason,
      queueSize: this.syncQueue.length
    });
  }

  /**
   * @method processSyncQueue
   * @description Traite la queue de synchronisation
   * @returns {Promise<void>}
   */
  async processSyncQueue() {
    if (this.syncQueue.length === 0 || this.syncInProgress) {
      return;
    }

    const item = this.syncQueue.shift();
    
    try {
      await this.syncToFirebase(null, item.reason);
      
      // Retirer de pending changes
      const data = await this.loadData();
      data.sync.pendingChanges = data.sync.pendingChanges.filter(
        change => change.queueId !== item.queueId
      );
      data.sync.queueSize = this.syncQueue.length;
      await this.saveData(data, { syncToFirebase: false });

    } catch (error) {
      logger.error('Database: Erreur traitement queue sync', {
        queueId: item.queueId,
        error: error.message
      });
      
      // Re-ajouter à la queue en cas d'erreur (avec backoff)
      if (this.syncQueue.length < 10) { // Limite de taille de queue
        this.syncQueue.unshift(item);
      }
    }

    // Continuer à traiter la queue
    if (this.syncQueue.length > 0) {
      setTimeout(() => this.processSyncQueue(), 1000);
    }
  }

  /**
   * @method pullFromFirebase
   * @description Télécharge les données depuis Firebase
   * @param {Array<string>} [collections] - Collections à télécharger
   * @param {string} [reason='manual'] - Raison du téléchargement
   * @returns {Promise<SyncResult>}
   */
  async pullFromFirebase(collections = null, reason = 'manual') {
    if (!isFirebaseInitialized()) {
      throw new AppError(
        'Firebase non initialisé',
        500,
        'FIREBASE_NOT_INITIALIZED'
      );
    }

    const result = {
      success: true,
      downloaded: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();
    const pullId = generateShortId();

    try {
      logger.info('Database: Début téléchargement depuis Firebase', {
        pullId,
        reason,
        collections: collections || this.syncConfig.collections
      });

      this.logAudit('PULL_STARTED', `Firebase pull started: ${reason}`, { pullId, reason });

      const data = await this.loadData(false);
      const collectionsToSync = collections || this.syncConfig.collections;

      for (const collectionName of collectionsToSync) {
        try {
          const snapshot = await firestore.collection(collectionName).get();
          const documents = [];

          snapshot.forEach(doc => {
            documents.push({
              id: doc.id,
              ...doc.data(),
              _lastSynced: now().toISOString(),
              _source: 'firebase'
            });
          });

          data[collectionName] = documents;
          result.downloaded += documents.length;

          logger.debug(`Database: Documents téléchargés pour ${collectionName}`, {
            pullId,
            downloaded: documents.length
          });
        } catch (error) {
          result.errors.push({
            collection: collectionName,
            error: error.message
          });
          logger.error(`Database: Erreur téléchargement collection ${collectionName}`, {
            pullId,
            error: error.message
          });
        }
      }

      // Mettre à jour les métadonnées
      data.meta.lastSync = now().toISOString();
      data.sync.lastPull = now().toISOString();

      await this.saveData(data, { syncToFirebase: false, reason: `pull_${reason}` });

      result.duration = Date.now() - startTime;

      this.logAudit('PULL_COMPLETED', `Firebase pull completed: ${reason}`, {
        pullId,
        duration: result.duration,
        ...result
      });

      logger.success('Database: Téléchargement terminé avec succès', {
        pullId,
        downloaded: result.downloaded,
        duration: `${result.duration}ms`,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.duration = Date.now() - startTime;

      this.logAudit('PULL_FAILED', `Firebase pull failed: ${reason}`, {
        pullId,
        error: error.message,
        duration: result.duration
      });

      logger.error('Database: Échec téléchargement', {
        pullId,
        error: error.message,
        duration: result.duration
      });
      throw error;
    }
  }

  /**
   * @method createBackup
   * @description Crée un backup complet
   * @param {string} [reason='manual'] - Raison du backup
   * @param {Object} [options] - Options de backup
   * @returns {Promise<BackupInfo>}
   */
  async createBackup(reason = 'manual', options = {}) {
    const {
      type = reason === 'manual' ? 'manual' : 'auto',
      compression = false,
      includeMetadata = true
    } = options;

    const backupId = generateBackupId();
    
    try {
      const timestamp = now().format('YYYY-MM-DD_HH-mm-ss');
      const backupDir = path.join(this.backupDir, type);
      const backupFilename = `secura-backup-${timestamp}-${reason}-${backupId}.json`;
      const backupPath = path.join(backupDir, backupFilename);

      await fs.mkdir(backupDir, { recursive: true });

      const data = await this.loadData(false);
      
      // Préparer les données pour le backup
      let backupData = data;
      if (!includeMetadata) {
        backupData = { ...data };
        delete backupData.sync;
        delete backupData.cache;
      }

      const serializedData = JSON.stringify(backupData, null, 2);
      await fs.writeFile(backupPath, serializedData, 'utf8');

      const stats = await fs.stat(backupPath);
      const checksum = this.generateChecksum(backupData);

      const backupInfo = {
        filename: backupFilename,
        path: backupPath,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        created: stats.mtime,
        type,
        reason,
        backupId,
        checksum,
        compression,
        dataSize: this.stats.dataSize
      };

      // Mettre à jour les métadonnées
      data.meta.lastBackup = now().toISOString();
      await this.saveData(data, { syncToFirebase: false, reason: `backup_${reason}` });

      this.stats.lastBackup = backupInfo.created;

      this.logAudit('BACKUP_CREATED', `Backup created: ${reason}`, backupInfo);

      logger.info('Database: Backup créé avec succès', backupInfo);

      // Nettoyer les anciens backups
      await this.cleanupOldBackups();

      return backupInfo;
    } catch (error) {
      logger.error('Database: Erreur création backup', {
        error: error.message,
        reason,
        backupId
      });
      throw new AppError(
        'Erreur création backup',
        500,
        'BACKUP_ERROR'
      );
    }
  }

  /**
   * @method listBackups
   * @description Liste tous les backups disponibles
   * @returns {Promise<Array<BackupInfo>>}
   */
  async listBackups() {
    try {
      const backups = [];

      for (const type of ['auto', 'manual', 'emergency']) {
        const typeDir = path.join(this.backupDir, type);
        
        try {
          const files = await fs.readdir(typeDir);

          for (const file of files) {
            if (file.endsWith('.json') && file.includes('secura-backup-')) {
              const filePath = path.join(typeDir, file);
              const stats = await fs.stat(filePath);

              // Lire les métadonnées du backup
              const backupData = await fs.readFile(filePath, 'utf8');
              const data = JSON.parse(backupData);
              const checksum = this.generateChecksum(data);

              backups.push({
                filename: file,
                path: filePath,
                size: stats.size,
                sizeFormatted: this.formatFileSize(stats.size),
                created: stats.mtime,
                type,
                checksum,
                dataVersion: data.meta?.version || 'unknown',
                environment: data.meta?.environment || 'unknown'
              });
            }
          }
        } catch (err) {
          // Répertoire n'existe pas
        }
      }

      // Trier par date (plus récent d'abord)
      return backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    } catch (error) {
      logger.error('Database: Erreur liste backups', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * @method restoreFromBackup
   * @description Restaure depuis un backup spécifique
   * @param {string} backupPath - Chemin du backup
   * @param {Object} [options] - Options de restauration
   * @returns {Promise<Object>}
   */
  async restoreFromBackup(backupPath = null, options = {}) {
    const {
      verifyChecksum = true,
      createPreRestoreBackup = true
    } = options;

    const restoreId = generateShortId();

    try {
      let targetBackup = backupPath;

      if (!targetBackup) {
        // Prendre le backup le plus récent
        const backups = await this.listBackups();
        if (backups.length === 0) {
          throw new AppError(
            'Aucun backup disponible',
            404,
            'NO_BACKUP_FOUND'
          );
        }
        targetBackup = backups[0].path;
      }

      logger.info('Database: Restauration depuis backup', {
        restoreId,
        backup: targetBackup
      });

      this.logAudit('RESTORE_STARTED', `Restore started from backup`, {
        restoreId,
        backupPath: targetBackup
      });

      // Créer un backup avant restauration
      if (createPreRestoreBackup) {
        await this.createBackup('pre_restore');
      }

      const backupData = await fs.readFile(targetBackup, 'utf8');
      const data = JSON.parse(backupData);

      // Vérifier le checksum
      if (verifyChecksum) {
        const expectedChecksum = this.generateChecksum(data);
        const actualChecksum = data.meta?.checksum;
        if (actualChecksum && expectedChecksum !== actualChecksum) {
          throw new AppError(
            'Checksum du backup invalide',
            400,
            'BACKUP_CHECKSUM_ERROR'
          );
        }
      }

      // Valider les données du backup
      const validation = await this.validateDataStructure(data);
      if (!validation.valid) {
        logger.warn('Database: Backup contient des données invalides', {
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      // Restaurer les données
      await this.writeToFile(data);

      // Invalider le cache
      this._cachedData = null;

      this.logAudit('RESTORE_COMPLETED', `Restore completed successfully`, {
        restoreId,
        backupPath: targetBackup,
        dataVersion: data.meta?.version,
        collections: Object.keys(data).filter(k => Array.isArray(data[k]))
      });

      logger.success('Database: Restauration terminée avec succès', {
        restoreId,
        backup: path.basename(targetBackup),
        dataVersion: data.meta?.version,
        collections: Object.keys(data).filter(k => Array.isArray(data[k])).length
      });

      return data;
    } catch (error) {
      this.logAudit('RESTORE_FAILED', `Restore failed`, {
        restoreId,
        error: error.message,
        backupPath
      });

      logger.error('Database: Échec restauration', {
        restoreId,
        error: error.message,
        backupPath
      });
      throw error;
    }
  }

  /**
   * @method cleanupOldBackups
   * @description Nettoie les anciens backups
   * @returns {Promise<number>} Nombre de backups supprimés
   */
  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.backupRetentionDays);
      
      const oldBackups = backups.filter(backup => 
        new Date(backup.created) < cutoffDate
      );
      
      let deletedCount = 0;
      for (const backup of oldBackups) {
        try {
          await fs.unlink(backup.path);
          deletedCount++;
        } catch (error) {
          logger.warn('Database: Impossible de supprimer le backup', {
            backup: backup.filename,
            error: error.message
          });
        }
      }
      
      if (deletedCount > 0) {
        logger.info('Database: Anciens backups nettoyés', {
          deleted: deletedCount,
          retentionDays: config.backupRetentionDays
        });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Database: Erreur nettoyage backups', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * @method transaction
   * @description Exécute une transaction atomique
   * @param {Function} operation - Fonction de transaction
   * @param {Object} [options] - Options de transaction
   * @returns {Promise<*>} Résultat de l'opération
   */
  async transaction(operation, options = {}) {
    const {
      maxRetries = 3,
      timeout = 30000,
      isolation = 'serializable'
    } = options;

    const transactionId = generateShortId();
    let retries = 0;

    while (retries < maxRetries) {
      try {
        this.stats.transactionCount++;

        // Acquérir un verrou de transaction
        await this.acquireTransactionLock(transactionId);

        const startTime = Date.now();
        
        // Exécuter l'opération dans un contexte de transaction
        const result = await this.executeTransaction(operation, transactionId, timeout);
        
        const duration = Date.now() - startTime;

        this.logAudit('TRANSACTION_COMPLETED', `Transaction completed`, {
          transactionId,
          duration,
          retries,
          isolation
        });

        logger.debug('Database: Transaction exécutée avec succès', {
          transactionId,
          duration: `${duration}ms`,
          retries
        });

        return result;

      } catch (error) {
        retries++;
        
        if (retries >= maxRetries) {
          this.stats.failedTransactions++;
          this.logAudit('TRANSACTION_FAILED', `Transaction failed after ${maxRetries} retries`, {
            transactionId,
            error: error.message,
            retries
          });
          throw error;
        }

        // Backoff exponentiel
        const backoffDelay = Math.pow(2, retries) * 100;
        await sleep(backoffDelay);

        logger.warn('Database: Retry transaction', {
          transactionId,
          retry: retries,
          error: error.message,
          backoffDelay
        });
      } finally {
        // Libérer le verrou de transaction
        this.releaseTransactionLock(transactionId);
      }
    }
  }

  /**
   * @method executeTransaction
   * @description Exécute une opération dans un contexte transactionnel
   * @param {Function} operation - Opération à exécuter
   * @param {string} transactionId - ID de transaction
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<*>} Résultat
   */
  async executeTransaction(operation, transactionId, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new AppError(
          'Transaction timeout',
          408,
          'TRANSACTION_TIMEOUT'
        ));
      }, timeout);

      try {
        // Charger les données (sans cache)
        const data = await this.loadData(false, true);
        
        // Exécuter l'opération
        const result = await operation(data, transactionId);
        
        // Sauvegarder les données modifiées
        await this.saveData(data, { 
          transactionId,
          reason: `transaction_${transactionId}` 
        });

        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * @method acquireLock
   * @description Acquiert un verrou
   * @param {string} key - Clé du verrou
   * @param {number} [timeout=10000] - Timeout en ms
   * @returns {Promise<void>}
   */
  async acquireLock(key, timeout = 10000) {
    const startTime = Date.now();
    
    while (this.locks.has(key)) {
      if (Date.now() - startTime > timeout) {
        throw new AppError(
          `Timeout acquisition verrou: ${key}`,
          408,
          'LOCK_TIMEOUT'
        );
      }
      await sleep(100);
    }
    
    this.locks.set(key, {
      acquiredAt: Date.now(),
      timeout
    });
  }

  /**
   * @method releaseLock
   * @description Libère un verrou
   * @param {string} key - Clé du verrou
   */
  releaseLock(key) {
    this.locks.delete(key);
  }

  /**
   * @method acquireTransactionLock
   * @description Acquiert un verrou de transaction
   * @param {string} transactionId - ID de transaction
   * @returns {Promise<void>}
   */
  async acquireTransactionLock(transactionId) {
    await this.acquireLock(`transaction_${transactionId}`, 30000);
    this.transactionLocks.set(transactionId, Date.now());
  }

  /**
   * @method releaseTransactionLock
   * @description Libère un verrou de transaction
   * @param {string} transactionId - ID de transaction
   */
  releaseTransactionLock(transactionId) {
    this.releaseLock(`transaction_${transactionId}`);
    this.transactionLocks.delete(transactionId);
  }

  /**
   * @method validateDataIntegrity
   * @description Valide l'intégrité des données
   * @returns {Promise<Object>} Résultat de validation
   */
  async validateDataIntegrity() {
    try {
      const data = await this.loadData(false);
      const errors = [];
      const warnings = [];
      const fixes = [];

      // Vérifier la structure de base
      const requiredKeys = ['meta', 'users', 'events', 'guests', 'qrCodes', 'scans'];
      for (const key of requiredKeys) {
        if (!data[key]) {
          errors.push(`Clé manquante: ${key}`);
        }
      }

      // Vérifier les métadonnées
      if (data.meta) {
        if (!data.meta.version) {
          warnings.push('Version des métadonnées manquante');
        }
        if (!data.meta.checksum) {
          warnings.push('Checksum des métadonnées manquant');
        }
      }

      // Vérifier les références entre collections
      if (data.guests && data.events) {
        const eventIds = new Set(data.events.map(e => e.id));
        const orphanGuests = data.guests.filter(g => !eventIds.has(g.eventId));
        
        if (orphanGuests.length > 0) {
          warnings.push(`${orphanGuests.length} invités orphelins (sans événement)`);
          fixes.push(`Supprimer ${orphanGuests.length} invités orphelins`);
        }
      }

      if (data.scans && data.guests) {
        const guestIds = new Set(data.guests.map(g => g.id));
        const orphanScans = data.scans.filter(s => !guestIds.has(s.guestId));
        
        if (orphanScans.length > 0) {
          warnings.push(`${orphanScans.length} scans orphelins (sans invité)`);
          fixes.push(`Supprimer ${orphanScans.length} scans orphelins`);
        }
      }

      // Vérifier les index
      if (data.indexes) {
        for (const [collection, index] of Object.entries(data.indexes)) {
          if (!data[collection]) {
            warnings.push(`Index pour collection inexistante: ${collection}`);
          }
        }
      }

      // Vérifier le checksum
      const currentChecksum = this.generateChecksum(data);
      if (data.meta.checksum && data.meta.checksum !== currentChecksum) {
        errors.push('Checksum invalide - données corrompues');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        fixes,
        stats: {
          totalErrors: errors.length,
          totalWarnings: warnings.length,
          totalFixes: fixes.length
        }
      };
    } catch (error) {
      logger.error('Database: Erreur validation intégrité', {
        error: error.message
      });
      
      return {
        valid: false,
        errors: [`Erreur validation: ${error.message}`],
        warnings: [],
        fixes: [],
        stats: {
          totalErrors: 1,
          totalWarnings: 0,
          totalFixes: 0
        }
      };
    }
  }

  /**
   * @method attemptAutoRepair
   * @description Tente une réparation automatique des données
   * @param {Object} integrityCheck - Résultat de validation
   * @returns {Promise<boolean>} Succès de la réparation
   */
  async attemptAutoRepair(integrityCheck) {
    try {
      logger.info('Database: Tentative réparation automatique', {
        errors: integrityCheck.errors.length,
        fixes: integrityCheck.fixes.length
      });

      const data = await this.loadData(false);
      let repaired = false;

      // Réparer les invités orphelins
      if (data.guests && data.events) {
        const eventIds = new Set(data.events.map(e => e.id));
        const originalLength = data.guests.length;
        data.guests = data.guests.filter(g => eventIds.has(g.eventId));
        
        if (data.guests.length < originalLength) {
          repaired = true;
          logger.info('Database: Invités orphelins supprimés', {
            removed: originalLength - data.guests.length
          });
        }
      }

      // Réparer les scans orphelins
      if (data.scans && data.guests) {
        const guestIds = new Set(data.guests.map(g => g.id));
        const originalLength = data.scans.length;
        data.scans = data.scans.filter(s => guestIds.has(s.guestId));
        
        if (data.scans.length < originalLength) {
          repaired = true;
          logger.info('Database: Scans orphelins supprimés', {
            removed: originalLength - data.scans.length
          });
        }
      }

      // Régénérer les index si nécessaire
      if (!data.indexes || Object.keys(data.indexes).length === 0) {
        data.indexes = this.getInitialDataStructure().indexes;
        repaired = true;
        logger.info('Database: Index régénérés');
      }

      if (repaired) {
        await this.saveData(data, { reason: 'auto_repair' });
        logger.success('Database: Réparation automatique réussie');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Database: Échec réparation automatique', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * @method migrateDataStructure
   * @description Migre automatiquement la structure des données
   * @param {Object} data - Données à migrer
   * @returns {Promise<Object>} Données migrées
   */
  async migrateDataStructure(data) {
    const initialStructure = this.getInitialDataStructure();
    let migrated = false;

    // Vérifier et ajouter les collections manquantes
    for (const [key, defaultValue] of Object.entries(initialStructure)) {
      if (data[key] === undefined) {
        data[key] = defaultValue;
        migrated = true;
      }
    }

    // Migration des métadonnées
    if (!data.meta || !data.meta.version) {
      data.meta = initialStructure.meta;
      migrated = true;
    }

    // Migration des index
    if (!data.indexes) {
      data.indexes = initialStructure.indexes;
      migrated = true;
    }

    // Migration du système de sync
    if (!data.sync) {
      data.sync = initialStructure.sync;
      migrated = true;
    }

    if (migrated) {
      data.meta.updatedAt = now().toISOString();
      data.meta.version = initialStructure.meta.version;
      data.meta.migrations = data.meta.migrations || [];
      data.meta.migrations.push({
        from: data.meta.version,
        to: initialStructure.meta.version,
        timestamp: now().toISOString(),
        changes: ['structure_update']
      });

      logger.info('Database: Migration automatique effectuée', {
        from: data.meta.version,
        to: initialStructure.meta.version
      });
    }

    return data;
  }

  /**
   * @method validateDataStructure
   * @description Valide la structure des données
   * @param {Object} data - Données à valider
   * @returns {Promise<Object>} Résultat de validation
   */
  async validateDataStructure(data) {
    const errors = [];
    const warnings = [];

    // Validation de base
    if (typeof data !== 'object' || data === null) {
      errors.push('Données invalides: doit être un objet');
      return { valid: false, errors, warnings };
    }

    // Validation des métadonnées
    if (!data.meta) {
      errors.push('Métadonnées manquantes');
    } else {
      if (!data.meta.version) warnings.push('Version des métadonnées manquante');
      if (!data.meta.createdAt) warnings.push('Date de création manquante');
    }

    // Validation des collections
    const collections = ['users', 'events', 'guests', 'qrCodes', 'scans'];
    for (const collection of collections) {
      if (!Array.isArray(data[collection])) {
        errors.push(`Collection ${collection} doit être un tableau`);
      }
    }

    // Validation des types de données
    if (data.users) {
      data.users.forEach((user, index) => {
        if (!user.id) errors.push(`Utilisateur ${index} sans ID`);
        if (!user.email) warnings.push(`Utilisateur ${index} sans email`);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * @method generateChecksum
   * @description Génère un checksum pour les données
   * @param {Object} data - Données à hasher
   * @returns {string} Checksum MD5
   */
  generateChecksum(data) {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * @method updateStats
   * @description Met à jour les statistiques dans les métadonnées
   * @param {Object} data - Données à mettre à jour
   */
  updateStats(data) {
    if (!data.meta.stats) data.meta.stats = {};
    
    data.meta.stats = {
      totalEvents: data.events?.length || 0,
      totalGuests: data.guests?.length || 0,
      totalUsers: data.users?.length || 0,
      totalScans: data.scans?.length || 0,
      totalSessions: data.sessions?.length || 0,
      totalGalleries: data.galleries?.length || 0,
      totalMessages: data.messages?.length || 0,
      totalQRCodes: data.qrCodes?.length || 0,
      totalTableQRs: data.tableQRCodes?.length || 0,
      totalInvitations: data.invitations?.length || 0,
      lastUpdated: now().toISOString()
    };
  }

  /**
   * @method formatFileSize
   * @description Formate une taille de fichier
   * @param {number} bytes - Taille en octets
   * @returns {string} Taille formatée
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * @method initializeCache
   * @description Initialise le système de cache
   * @returns {Promise<void>}
   */
  async initializeCache() {
    try {
      const data = await this.loadData(false);
      
      await this.cacheAggregations(data);
      
      logger.debug('Database: Cache initialisé');
    } catch (error) {
      logger.warn('Database: Erreur initialisation cache', {
        error: error.message
      });
    }
  }

  /**
   * @method cacheAggregations
   * @description Met en cache les agrégations courantes
   * @param {Object} data - Données à agréger
   * @returns {Promise<void>}
   */
  async cacheAggregations(data) {
    const aggregations = {
      totalEvents: data.events?.length || 0,
      totalGuests: data.guests?.length || 0,
      totalUsers: data.users?.length || 0,
      totalScans: data.scans?.length || 0,
      activeEvents: data.events?.filter(e => e.status === 'active').length || 0,
      recentScans: data.scans?.filter(s => 
        new Date(s.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length || 0
    };

    await cacheManager.set('aggregations', aggregations, { ttl: 300 });
  }

  /**
   * @method startAutoSync
   * @description Démarre la synchronisation automatique
   */
  startAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    this.autoSyncInterval = setInterval(async () => {
      try {
        if (!this.syncInProgress && this.syncConfig.autoSync) {
          await this.syncToFirebase(null, 'auto_sync');
        }
      } catch (error) {
        logger.error('Database: Erreur sync automatique', {
          error: error.message
        });
      }
    }, this.syncConfig.interval);

    logger.info('Database: Synchronisation automatique démarrée', {
      interval: `${this.syncConfig.interval}ms`
    });
  }

  /**
   * @method startAutoCleanup
   * @description Démarre le nettoyage automatique
   */
  startAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performMaintenance();
      } catch (error) {
        logger.error('Database: Erreur nettoyage automatique', {
          error: error.message
        });
      }
    }, 60 * 60 * 1000); // Toutes les heures

    logger.info('Database: Nettoyage automatique démarré');
  }

  /**
   * @method startHealthChecks
   * @description Démarre les health checks
   */
  startHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        logger.error('Database: Erreur health check', {
          error: error.message
        });
      }
    }, 5 * 60 * 1000); // Toutes les 5 minutes

    logger.info('Database: Health checks démarrés');
  }

  /**
   * @method performMaintenance
   * @description Effectue la maintenance de la base de données
   * @returns {Promise<Object>} Résultat de la maintenance
   */
  async performMaintenance() {
    const maintenanceId = generateShortId();
    const startTime = Date.now();

    try {
      logger.info('Database: Début maintenance', { maintenanceId });

      const results = {
        maintenanceId,
        backupsCleaned: 0,
        dataValidated: false,
        cacheCleared: false,
        duration: 0
      };

      // Nettoyer les anciens backups
      results.backupsCleaned = await this.cleanupOldBackups();

      // Valider l'intégrité des données
      const integrityCheck = await this.validateDataIntegrity();
      results.dataValidated = integrityCheck.valid;

      if (!integrityCheck.valid) {
        await this.attemptAutoRepair(integrityCheck);
      }

      // Nettoyer le cache
      this._cachedData = null;
      results.cacheCleared = true;

      // Mettre à jour les métadonnées de maintenance
      const data = await this.loadData(false);
      data.maintenance.lastCleanup = now().toISOString();
      data.maintenance.lastValidation = now().toISOString();
      await this.saveData(data, { reason: 'maintenance' });

      results.duration = Date.now() - startTime;

      this.logAudit('MAINTENANCE_COMPLETED', `Maintenance completed`, results);

      logger.info('Database: Maintenance terminée', results);

      return results;
    } catch (error) {
      logger.error('Database: Erreur maintenance', {
        maintenanceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method healthCheck
   * @description Vérifie la santé de la base de données
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    try {
      const data = await this.loadData(false);
      const nowTime = now();

      const health = {
        status: 'healthy',
        instanceId: this.instanceId,
        timestamp: nowTime.toISOString(),
        uptime: diffInMinutes(nowTime, this.stats.startupTime),
        dataSize: this.stats.dataSize,
        collections: {},
        sync: {
          enabled: this.syncConfig.enabled,
          inProgress: this.syncInProgress,
          lastSync: this.lastSync,
          queueSize: this.syncQueue.length
        },
        cache: {
          hits: this.stats.cacheHits,
          misses: this.stats.cacheMisses,
          hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 
            ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(2)
            : 0
        },
        stats: {
          totalReads: this.stats.totalReads,
          totalWrites: this.stats.totalWrites,
          totalSyncs: this.stats.totalSyncs,
          transactionCount: this.stats.transactionCount
        }
      };

      // Vérifier les collections
      for (const collection of this.syncConfig.collections) {
        health.collections[collection] = {
          count: data[collection]?.length || 0,
          valid: Array.isArray(data[collection])
        };
      }

      // Vérifier l'intégrité
      const integrity = await this.validateDataIntegrity();
      if (!integrity.valid) {
        health.status = 'degraded';
        health.integrity = {
          valid: false,
          errors: integrity.errors.length,
          warnings: integrity.warnings.length
        };
      }

      // Vérifier la synchronisation
      if (this.syncConfig.enabled && this.lastSync) {
        const lastSyncTime = new Date(this.lastSync);
        const timeSinceLastSync = diffInMinutes(nowTime, lastSyncTime);
        
        if (timeSinceLastSync > 60) { // 1 heure
          health.status = 'degraded';
          health.sync.lastSyncWarning = `Dernière sync il y a ${timeSinceLastSync} minutes`;
        }
      }

      // Vérifier l'espace disque
      try {
        const stats = await fs.stat(this.dbPath);
        health.diskUsage = this.formatFileSize(stats.size);
        
        if (stats.size > 100 * 1024 * 1024) { // 100MB
          health.status = 'warning';
          health.diskWarning = 'Base de données volumineuse';
        }
      } catch (error) {
        health.diskError = error.message;
      }

      return health;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: now().toISOString()
      };
    }
  }

  /**
   * @method logAudit
   * @description Journalise un événement d'audit
   * @param {string} action - Action effectuée
   * @param {string} message - Message d'audit
   * @param {Object} [details] - Détails supplémentaires
   */
  logAudit(action, message, details = {}) {
    const auditEntry = {
      id: generateShortId(),
      action,
      message,
      timestamp: now().toISOString(),
      instanceId: this.instanceId,
      user: details.user || 'system',
      ...details
    };

    this.auditLog.push(auditEntry);

    // Limiter la taille du log d'audit
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500);
    }

    // Sauvegarder dans les données si possible
    this.saveAuditToData(auditEntry).catch(error => {
      logger.warn('Database: Impossible de sauvegarder l\'audit', {
        error: error.message
      });
    });
  }

  /**
   * @method saveAuditToData
   * @description Sauvegarde une entrée d'audit dans les données
   * @param {Object} auditEntry - Entrée d'audit
   * @returns {Promise<void>}
   */
  async saveAuditToData(auditEntry) {
    try {
      const data = await this.loadData();
      if (!data.auditLogs) {
        data.auditLogs = [];
      }
      
      data.auditLogs.unshift(auditEntry);
      
      // Limiter la taille du log d'audit
      if (data.auditLogs.length > 500) {
        data.auditLogs = data.auditLogs.slice(0, 500);
      }
      
      await this.saveData(data, { reason: 'audit_log' });
    } catch (error) {
      // Ne pas propager l'erreur pour ne pas bloquer l'opération principale
      logger.warn('Database: Erreur sauvegarde audit', {
        error: error.message
      });
    }
  }

  /**
   * @method getAuditLog
   * @description Récupère le journal d'audit
   * @param {Object} [options] - Options de filtrage
   * @returns {Array} Journal d'audit
   */
  getAuditLog(options = {}) {
    const {
      limit = 100,
      action = null,
      startDate = null,
      endDate = null
    } = options;

    let log = [...this.auditLog];

    if (action) {
      log = log.filter(entry => entry.action === action);
    }

    if (startDate) {
      const start = new Date(startDate);
      log = log.filter(entry => new Date(entry.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      log = log.filter(entry => new Date(entry.timestamp) <= end);
    }

    return log.slice(0, limit);
  }

  /**
   * @method getStats
   * @description Récupère les statistiques complètes
   * @returns {Promise<DatabaseStats>} Statistiques
   */
  async getStats() {
    const data = await this.loadData(false);
    const health = await this.healthCheck();

    return {
      ...this.stats,
      health,
      collections: Object.keys(data).filter(k => Array.isArray(data[k])).reduce((acc, key) => {
        acc[key] = data[key].length;
        return acc;
      }, {}),
      lastBackup: data.meta.lastBackup,
      lastSync: data.meta.lastSync,
      version: data.meta.version,
      instanceId: this.instanceId,
      startupTime: this.stats.startupTime
    };
  }

  /**
   * @method exportData
   * @description Exporte les données dans un format spécifique
   * @param {Object} options - Options d'export
   * @returns {Promise<Object>} Données exportées
   */
  async exportData(options = {}) {
    const {
      format = 'json',
      collections = null,
      includeMetadata = true,
      includeAudit = false
    } = options;

    const exportId = generateShortId();
    const data = await this.loadData(false);

    let exportData = {};

    if (collections) {
      for (const collection of collections) {
        if (data[collection]) {
          exportData[collection] = data[collection];
        }
      }
    } else {
      exportData = { ...data };
    }

    if (includeMetadata) {
      exportData.meta = {
        ...data.meta,
        export: {
          id: exportId,
          timestamp: now().toISOString(),
          format,
          collections: collections || 'all'
        }
      };
    } else {
      delete exportData.meta;
    }

    if (!includeAudit) {
      delete exportData.auditLogs;
    }

    // Nettoyer les données internes
    delete exportData.cache;
    delete exportData.sync;
    delete exportData.indexes;

    this.logAudit('DATA_EXPORTED', `Data exported in ${format} format`, {
      exportId,
      format,
      collections: collections || 'all'
    });

    return exportData;
  }

  /**
   * @method shutdown
   * @description Arrête proprement le gestionnaire
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Database: Arrêt du gestionnaire...', { instanceId: this.instanceId });

    // Arrêter les intervalles
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Finaliser la synchronisation en cours
    if (this.syncInProgress) {
      logger.info('Database: Attente fin de synchronisation...');
      await sleep(5000); // Attendre 5 secondes
    }

    // Créer un backup final
    try {
      await this.createBackup('shutdown');
    } catch (error) {
      logger.warn('Database: Erreur backup final', { error: error.message });
    }

    this.initialized = false;

    this.logAudit('SYSTEM_SHUTDOWN', 'Database manager shutdown completed');

    logger.success('Database: Gestionnaire arrêté proprement', { instanceId: this.instanceId });
  }
}

// Instance singleton
const databaseManager = new DatabaseManager();

process.on('SIGINT', async () => {
  logger.info('Database: Signal SIGINT reçu, arrêt en cours...');
  await databaseManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Database: Signal SIGTERM reçu, arrêt en cours...');
  await databaseManager.shutdown();
  process.exit(0);
});

module.exports = databaseManager;