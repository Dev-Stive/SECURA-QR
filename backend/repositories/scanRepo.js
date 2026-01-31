/**
 * @file scanRepo.js
 * @description Repository ultra-complet pour la gestion des scans de QR codes Secura.
 * Gère l'enregistrement, validation et suivi des scans avec support hors ligne.
 * @module repositories/scanRepo
 * @requires ./baseRepo
 * @requires ../models/scanModel
 * @requires ../utils/validation/scanValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/qrHelper
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/logger
 */

const BaseRepository = require('./baseRepo');
const Scan = require('../models/scanModel');
const {
  validateScan,
  validateCreateScan,
  validateUpdateScan,
  validateRealTimeScan,
  validateOfflineScan,
  validateOfflineSync,
  validateScanStatsQuery
} = require('../utils/validation/scanValidation');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../utils/errorHandler');
const { SCAN_TYPES, STATUS } = require('../utils/constants');
const { generateScanId } = require('../utils/helpers/idGenerator');
const { validateQRCode, parseQRData } = require('../utils/helpers/qrHelper');
const { now, addMinutes, addHours } = require('../utils/helpers/dateHelper');
const log = require('../utils/logger');

/**
 * @class ScanRepository
 * @description Repository spécialisé pour la gestion des scans Secura
 * @extends BaseRepository
 */
class ScanRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('scans', {
      enableCache: true,
      cacheTTL: 180, // 3 minutes pour les scans récents
      enableAudit: true,
      softDelete: false, // Les scans ne sont jamais supprimés
      validationRequired: true,
      maxRetries: 3,
      ...options
    });
    
    // Configuration spécifique aux scans
    this.scanConfig = {
      maxScansPerGuest: 10, // Max scans par invité
      duplicateWindowMs: 5000, // Fenêtre anti-doublon (5s)
      offlineSyncWindow: 24 * 60 * 60 * 1000, // 24h pour sync offline
      maxOfflineScans: 1000,
      realTimeBatchSize: 100,
      retentionDays: 90, // Conservation des scans
      ...options.scanConfig
    };
    
    this.logger = log.withContext({
      repository: 'ScanRepository',
      collection: 'scans'
    });
    
    this.initialized = false;
    this.initialize();
  }

  // ============================================================================
  // MÉTHODES D'INITIALISATION
  // ============================================================================

  /**
   * @method initialize
   * @description Initialise le repository
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.waitForDatabase();
      this.initialized = true;
      
      // Créer les index spécifiques aux scans
      await this.createIndexes();
      
      this.logger.info('ScanRepository initialisé', {
        duplicateWindowMs: this.scanConfig.duplicateWindowMs,
        retentionDays: this.scanConfig.retentionDays
      });
    } catch (error) {
      this.logger.error('Erreur initialisation ScanRepository', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method createIndexes
   * @description Crée les index spécifiques aux scans
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      // Index sur les champs fréquemment utilisés
      const indexes = [
        { field: 'eventId', type: 'hash' },
        { field: 'guestId', type: 'hash' },
        { field: 'qrCodeId', type: 'hash' },
        { field: 'scannerId', type: 'hash' },
        { field: 'type', type: 'hash' },
        { field: 'success', type: 'hash' },
        { field: 'scannedAt', type: 'range', descending: true },
        { field: 'metadata.offline', type: 'hash' },
        { field: 'metadata.synced', type: 'hash' },
        { field: 'location', type: 'hash' }
      ];
      
      // Index composite pour les requêtes fréquentes
      const compositeIndexes = [
        { fields: ['eventId', 'scannedAt'], type: 'composite' },
        { fields: ['guestId', 'scannedAt'], type: 'composite' },
        { fields: ['scannerId', 'scannedAt'], type: 'composite' }
      ];
      
      this.logger.debug('Index scans créés', { 
        indexes: indexes.length,
        compositeIndexes: compositeIndexes.length 
      });
    } catch (error) {
      this.logger.warning('Erreur création index scans', { error: error.message });
    }
  }

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée un nouveau scan avec validation
   * @param {Object} scanData - Données du scan
   * @param {Object} options - Options de création
   * @returns {Promise<Scan>} Scan créé
   */
  async create(scanData, options = {}) {
    const operation = log.trackOperation('SCAN_CREATE', {
      data: this.sanitizeScanData(scanData),
      options
    });
    
    try {
      // Validation
      const validation = validateCreateScan(scanData);
      if (validation.error) {
        throw new ValidationError(
          'Données scan invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      // Vérifier doublon récent
      if (options.checkDuplicate !== false) {
        await this.checkDuplicateScan(scanData);
      }
      
      // Vérifier limite scans par invité
      await this.checkGuestScanLimit(scanData.guestId, scanData.eventId);
      
      // Créer l'instance Scan
      const scan = new Scan(scanData);
      
      // Mettre à jour les métadonnées
      if (options.offline) {
        scan.metadata.offline = true;
        scan.metadata.synced = false;
      }
      
      if (options.sessionId) {
        scan.metadata.sessionId = options.sessionId;
      }
      
      // Sauvegarder via BaseRepo
      const result = await super.create(scan.toJSON(), options);
      
      // Audit
      this.logger.crud('CREATE', 'scans', {
        scanId: scan.id,
        eventId: scan.eventId,
        guestId: scan.guestId,
        qrCodeId: scan.qrCodeId,
        scannerId: scan.scannerId,
        success: scan.success,
        type: scan.type
      });
      
      // Invalider les caches associés
      await this.invalidateEventCache(scan.eventId);
      await this.invalidateGuestCache(scan.guestId);
      await this.invalidateScannerCache(scan.scannerId);
      
      return operation.success({ scan, saved: result.created });
    } catch (error) {
      return operation.error(error, {
        data: this.sanitizeScanData(scanData)
      });
    }
  }

  /**
   * @method findById
   * @description Trouve un scan par ID avec instantiation
   * @param {string} id - ID du scan
   * @param {Object} options - Options de recherche
   * @returns {Promise<Scan|null>} Scan trouvé
   */
  async findById(id, options = {}) {
    const result = await super.findById(id, options);
    
    if (!result.found) {
      return result;
    }
    
    const scan = Scan.fromJSON(result.found);
    
    return { 
      found: scan, 
      fromCache: result.fromCache || false 
    };
  }

  /**
   * @method findAll
   * @description Trouve tous les scans avec filtres
   * @param {Object} filters - Filtres de recherche
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultats paginés
   */
  async findAll(filters = {}, options = {}) {
    const result = await super.findAll(filters, options);
    
    // Instancier les modèles Scan
    result.data = result.data.map(scanData => Scan.fromJSON(scanData));
    
    return result;
  }

  /**
   * @method update
   * @description Met à jour un scan
   * @param {string} id - ID du scan
   * @param {Object} updates - Données de mise à jour
   * @param {Object} options - Options
   * @returns {Promise<Scan>} Scan mis à jour
   */
  async update(id, updates, options = {}) {
    const existing = await this.findById(id, { throwIfNotFound: true });
    const scan = existing.found;
    
    // Validation
    const validation = validateUpdateScan(updates);
    if (validation.error) {
      throw new ValidationError(
        'Mises à jour scan invalides',
        validation.error.details.map(d => d.message)
      );
    }
    
    // Appliquer les mises à jour
    if (updates.scannerName !== undefined) scan.scannerName = updates.scannerName;
    if (updates.type !== undefined) scan.type = updates.type;
    if (updates.location !== undefined) scan.location = updates.location;
    if (updates.deviceInfo !== undefined) scan.setDeviceInfo(updates.deviceInfo);
    
    if (updates.success !== undefined) {
      if (updates.success) {
        scan.markAsSuccessful(updates.validationResult);
      } else {
        scan.markAsFailed(updates.errorMessage, updates.errorCode);
      }
    }
    
    if (updates.processTime !== undefined) {
      scan.setProcessTime(updates.processTime);
    }
    
    // Mettre à jour via BaseRepo
    const result = await super.update(id, scan.toJSON(), options);
    
    // Invalider les caches
    await this.invalidateCache(id);
    await this.invalidateEventCache(scan.eventId);
    
    return { updated: scan, ...result };
  }

  /**
   * @method delete
   * @description Supprime un scan (rarement utilisé, conservation par défaut)
   * @param {string} id - ID du scan
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async delete(id, options = {}) {
    const existing = await this.findById(id, { throwIfNotFound: true });
    const scan = existing.found;
    
    // Logiquement, on ne supprime pas les scans normalement
    if (!options.force) {
      throw new AppError(
        'Les scans sont conservés pour audit. Utilisez force:true pour supprimer.',
        400,
        'SCAN_RETENTION_POLICY'
      );
    }
    
    const result = await super.delete(id, options);
    
    // Invalider les caches
    await this.invalidateEventCache(scan.eventId);
    await this.invalidateGuestCache(scan.guestId);
    
    return result;
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method findByEvent
   * @description Trouve les scans d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans trouvés
   */
  async findByEvent(eventId, options = {}) {
    const cacheKey = this.getCacheKey(`event:${eventId}:scans:${JSON.stringify(options)}`);
    
    if (this.options.enableCache && !options.forceRefresh) {
      const cached = await this.cacheManager?.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }
    
    const filters = { eventId };
    if (options.success !== undefined) filters.success = options.success;
    if (options.type) filters.type = options.type;
    if (options.scannerId) filters.scannerId = options.scannerId;
    if (options.location) filters.location = options.location;
    
    // Filtrage par date
    if (options.startDate || options.endDate) {
      filters.scannedAt = {};
      if (options.startDate) filters.scannedAt.$gte = options.startDate;
      if (options.endDate) filters.scannedAt.$lte = options.endDate;
    }
    
    const result = await this.findAll(filters, options);
    
    if (this.options.enableCache) {
      await this.cacheManager?.set(cacheKey, result, { ttl: 300 });
    }
    
    return { ...result, fromCache: false };
  }

  /**
   * @method findByGuest
   * @description Trouve les scans d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans trouvés
   */
  async findByGuest(guestId, options = {}) {
    const filters = { guestId };
    if (options.eventId) filters.eventId = options.eventId;
    
    return this.findAll(filters, options);
  }

  /**
   * @method findByQrCode
   * @description Trouve les scans d'un QR code
   * @param {string} qrCodeId - ID du QR code
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans trouvés
   */
  async findByQrCode(qrCodeId, options = {}) {
    return this.findAll({ qrCodeId }, options);
  }

  /**
   * @method findByScanner
   * @description Trouve les scans d'un scanner
   * @param {string} scannerId - ID du scanner
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans trouvés
   */
  async findByScanner(scannerId, options = {}) {
    const filters = { scannerId };
    if (options.eventId) filters.eventId = options.eventId;
    if (options.success !== undefined) filters.success = options.success;
    
    return this.findAll(filters, options);
  }

  /**
   * @method findRecentScans
   * @description Trouve les scans récents
   * @param {Object} filters - Filtres additionnels
   * @param {number} minutesAgo - Minutes dans le passé
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans récents
   */
  async findRecentScans(filters = {}, minutesAgo = 60, options = {}) {
    const recentDate = new Date(now().getTime() - (minutesAgo * 60 * 1000));
    
    return this.findAll({
      ...filters,
      scannedAt: { $gte: recentDate.toISOString() }
    }, {
      ...options,
      sort: { scannedAt: 'desc' }
    });
  }

  /**
   * @method findSuccessfulScans
   * @description Trouve les scans réussis
   * @param {Object} filters - Filtres
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans réussis
   */
  async findSuccessfulScans(filters = {}, options = {}) {
    return this.findAll({ ...filters, success: true }, options);
  }

  /**
   * @method findFailedScans
   * @description Trouve les scans échoués
   * @param {Object} filters - Filtres
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans échoués
   */
  async findFailedScans(filters = {}, options = {}) {
    return this.findAll({ ...filters, success: false }, options);
  }

  /**
   * @method findOfflineScans
   * @description Trouve les scans hors ligne non synchronisés
   * @param {Object} filters - Filtres
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans hors ligne
   */
  async findOfflineScans(filters = {}, options = {}) {
    return this.findAll({ 
      ...filters,
      'metadata.offline': true,
      'metadata.synced': false 
    }, options);
  }

  // ============================================================================
  // MÉTHODES DE SCAN EN TEMPS RÉEL
  // ============================================================================

  /**
   * @method processRealTimeScan
   * @description Traite un scan en temps réel avec validation QR
   * @param {Object} scanData - Données du scan
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat du scan
   */
  async processRealTimeScan(scanData, options = {}) {
    const operation = log.trackOperation('SCAN_PROCESS_REALTIME', {
      scanData: this.sanitizeScanData(scanData),
      options
    });
    
    try {
      // Validation du scan temps réel
      const validation = validateRealTimeScan(scanData);
      if (validation.error) {
        throw new ValidationError(
          'Données scan temps réel invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const { qrData, ...scanInfo } = scanData;
      
      // Valider le QR code
      const qrValidation = validateQRCode(qrData);
      if (!qrValidation.valid) {
        // Créer un scan échoué
        const failedScan = Scan.createFailedScan({
          ...scanInfo,
          eventId: qrData.e,
          guestId: qrData.g,
          qrCodeId: this.extractQRCodeId(qrData),
          scanData: qrData
        }, qrValidation.error, 'QR_INVALID');
        
        const saved = await this.create(failedScan, options);
        
        return operation.success({
          success: false,
          error: qrValidation.error,
          scan: saved.scan
        });
      }
      
      // Extraire les IDs
      const eventId = qrData.e;
      const guestId = qrData.g;
      const qrCodeId = this.extractQRCodeId(qrData);
      
      // Vérifier si le QR a déjà été scanné récemment
      const recentScan = await this.checkRecentScan(eventId, guestId, qrCodeId);
      if (recentScan) {
        // Créer un scan échoué (doublon)
        const duplicateScan = Scan.createFailedScan({
          eventId,
          guestId,
          qrCodeId,
          scannerId: scanInfo.scannerId,
          scannerName: scanInfo.scannerName,
          location: scanInfo.location,
          deviceInfo: scanInfo.deviceInfo,
          scanData: qrData,
          metadata: {
            sessionId: scanInfo.sessionId,
            duplicateOf: recentScan.id
          }
        }, 'QR déjà scanné récemment', 'DUPLICATE_SCAN');
        
        const saved = await this.create(duplicateScan, options);
        
        return operation.success({
          success: false,
          error: 'QR déjà scanné récemment',
          scan: saved.scan,
          previousScan: recentScan
        });
      }
      
      // Vérifier limite scans invité
      await this.checkGuestScanLimit(guestId, eventId);
      
      // Créer le scan réussi
      const successfulScan = Scan.createSuccessfulScan({
        eventId,
        guestId,
        qrCodeId,
        scannerId: scanInfo.scannerId,
        scannerName: scanInfo.scannerName,
        type: scanInfo.type || SCAN_TYPES.ENTRY,
        location: scanInfo.location,
        deviceInfo: scanInfo.deviceInfo,
        scanData: qrData,
        metadata: {
          sessionId: scanInfo.sessionId,
          ipAddress: scanInfo.ipAddress,
          userAgent: scanInfo.userAgent,
          coordinates: scanInfo.coordinates
        }
      });
      
      // Mesurer le temps de traitement
      const startTime = Date.now();
      
      const saved = await this.create(successfulScan, options);
      
      const processTime = Date.now() - startTime;
      saved.scan.setProcessTime(processTime);
      
      // Mettre à jour avec le temps de traitement
      await this.update(saved.scan.id, { processTime });
      
      this.logger.info('Scan temps réel traité avec succès', {
        scanId: saved.scan.id,
        eventId,
        guestId,
        processTime,
        scannerId: scanInfo.scannerId
      });
      
      return operation.success({
        success: true,
        scan: saved.scan,
        validation: qrValidation,
        processTime
      });
    } catch (error) {
      return operation.error(error, {
        scanData: this.sanitizeScanData(scanData)
      });
    }
  }

  /**
   * @method processBatchScans
   * @description Traite plusieurs scans en batch
   * @param {Array} scansData - Tableau de données de scans
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultats batch
   */
  async processBatchScans(scansData, options = {}) {
    const operation = log.trackOperation('SCAN_PROCESS_BATCH', {
      count: scansData.length,
      options
    });
    
    try {
      if (scansData.length > this.scanConfig.realTimeBatchSize) {
        throw new AppError(
          `Trop de scans en batch (max: ${this.scanConfig.realTimeBatchSize})`,
          400,
          'BATCH_LIMIT_EXCEEDED'
        );
      }
      
      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        scans: []
      };
      
      for (const scanData of scansData) {
        try {
          const result = await this.processRealTimeScan(scanData, options);
          
          results.processed++;
          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
          }
          
          results.scans.push({
            scanId: result.scan?.id,
            success: result.success,
            error: result.error
          });
        } catch (error) {
          results.failed++;
          results.scans.push({
            success: false,
            error: error.message
          });
        }
      }
      
      this.logger.info('Batch scans traité', results);
      
      return operation.success(results);
    } catch (error) {
      return operation.error(error, { count: scansData.length });
    }
  }

  // ============================================================================
  // MÉTHODES DE SCAN HORS LIGNE
  // ============================================================================

  /**
   * @method processOfflineScan
   * @description Traite un scan hors ligne
   * @param {Object} scanData - Données du scan hors ligne
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scan hors ligne enregistré
   */
  async processOfflineScan(scanData, options = {}) {
    const operation = log.trackOperation('SCAN_PROCESS_OFFLINE', {
      scanData: this.sanitizeScanData(scanData)
    });
    
    try {
      // Validation scan hors ligne
      const validation = validateOfflineScan(scanData);
      if (validation.error) {
        throw new ValidationError(
          'Données scan hors ligne invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const { qrData, deviceId, timestamp, ...scanInfo } = scanData;
      
      // Valider le QR code
      const qrValidation = validateQRCode(qrData);
      
      // Créer le scan (réussi ou échoué)
      const scan = qrValidation.valid ?
        Scan.createSuccessfulScan({
          eventId: qrData.e,
          guestId: qrData.g,
          qrCodeId: this.extractQRCodeId(qrData),
          scannerId: scanInfo.scannerId,
          scannerName: scanInfo.scannerName,
          type: scanInfo.type || SCAN_TYPES.ENTRY,
          location: scanInfo.location,
          deviceInfo: scanInfo.deviceInfo,
          scanData: qrData,
          scannedAt: timestamp,
          metadata: {
            offline: true,
            synced: false,
            deviceId,
            ...scanInfo.metadata
          }
        }) :
        Scan.createFailedScan({
          eventId: qrData.e,
          guestId: qrData.g,
          qrCodeId: this.extractQRCodeId(qrData),
          scannerId: scanInfo.scannerId,
          scannerName: scanInfo.scannerName,
          type: scanInfo.type || SCAN_TYPES.ENTRY,
          location: scanInfo.location,
          deviceInfo: scanInfo.deviceInfo,
          scanData: qrData,
          scannedAt: timestamp,
          metadata: {
            offline: true,
            synced: false,
            deviceId,
            ...scanInfo.metadata
          }
        }, qrValidation.error, 'QR_INVALID');
      
      const saved = await this.create(scan, { 
        ...options, 
        offline: true,
        checkDuplicate: false 
      });
      
      this.logger.info('Scan hors ligne enregistré', {
        scanId: saved.scan.id,
        success: saved.scan.success,
        deviceId,
        timestamp
      });
      
      return operation.success({
        scan: saved.scan,
        validation: qrValidation
      });
    } catch (error) {
      return operation.error(error, {
        scanData: this.sanitizeScanData(scanData)
      });
    }
  }

  /**
   * @method syncOfflineScans
   * @description Synchronise les scans hors ligne
   * @param {Object} syncData - Données de synchronisation
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat synchronisation
   */
  async syncOfflineScans(syncData, options = {}) {
    const operation = log.trackOperation('SCAN_SYNC_OFFLINE', {
      deviceId: syncData.deviceId,
      scanCount: syncData.scans?.length || 0
    });
    
    try {
      // Validation synchronisation
      const validation = validateOfflineSync(syncData);
      if (validation.error) {
        throw new ValidationError(
          'Données synchronisation invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const { scans, deviceId, lastSync } = syncData;
      
      // Vérifier limite scans hors ligne
      if (scans.length > this.scanConfig.maxOfflineScans) {
        throw new AppError(
          `Trop de scans hors ligne (max: ${this.scanConfig.maxOfflineScans})`,
          400,
          'OFFLINE_SCAN_LIMIT'
        );
      }
      
      const results = {
        synced: 0,
        failed: 0,
        duplicates: 0,
        scans: []
      };
      
      // Traiter chaque scan hors ligne
      for (const scanData of scans) {
        try {
          // Vérifier si le scan existe déjà (doublon)
          const duplicate = await this.checkOfflineDuplicate(scanData, deviceId);
          
          if (duplicate) {
            results.duplicates++;
            results.scans.push({
              timestamp: scanData.timestamp,
              status: 'duplicate',
              existingScanId: duplicate.id
            });
            continue;
          }
          
          // Traiter le scan
          const result = await this.processOfflineScan(scanData, options);
          
          // Marquer comme synchronisé
          if (result.scan) {
            result.scan.markAsSynced();
            await this.update(result.scan.id, result.scan.toJSON(), {
              reason: 'offline_sync',
              skipValidation: true
            });
          }
          
          results.synced++;
          results.scans.push({
            scanId: result.scan?.id,
            timestamp: scanData.timestamp,
            status: 'synced',
            success: result.scan?.success
          });
        } catch (error) {
          results.failed++;
          results.scans.push({
            timestamp: scanData.timestamp,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // Marquer les anciens scans comme synchronisés
      if (lastSync) {
        await this.markOfflineScansAsSynced(deviceId, lastSync);
      }
      
      this.logger.info('Synchronisation hors ligne terminée', results);
      
      return operation.success(results);
    } catch (error) {
      return operation.error(error, {
        deviceId: syncData.deviceId,
        scanCount: syncData.scans?.length
      });
    }
  }

  /**
   * @method getPendingOfflineScans
   * @description Récupère les scans hors ligne en attente de synchronisation
   * @param {string} deviceId - ID du device
   * @param {Object} options - Options
   * @returns {Promise<Object>} Scans en attente
   */
  async getPendingOfflineScans(deviceId, options = {}) {
    const pendingScans = await this.findOfflineScans(
      { 'metadata.deviceId': deviceId },
      options
    );
    
    return {
      pending: pendingScans.data.length,
      scans: pendingScans.data.map(scan => ({
        id: scan.id,
        scannedAt: scan.scannedAt,
        success: scan.success,
        eventId: scan.eventId,
        guestId: scan.guestId
      }))
    };
  }

  // ============================================================================
  // MÉTHODES DE STATISTIQUES
  // ============================================================================

  /**
   * @method getScanStats
   * @description Récupère les statistiques de scans
   * @param {Object} query - Paramètres de requête
   * @returns {Promise<Object>} Statistiques
   */
  async getScanStats(query = {}) {
    const operation = log.trackOperation('SCAN_GET_STATS', { query });
    
    try {
      // Validation de la requête
      const validation = validateScanStatsQuery(query);
      if (validation.error) {
        throw new ValidationError(
          'Requête statistiques invalide',
          validation.error.details.map(d => d.message)
        );
      }
      
      const { eventId, startDate, endDate, groupBy, scannerId, location } = query;
      
      // Récupérer tous les scans correspondants
      const filters = { eventId };
      if (scannerId) filters.scannerId = scannerId;
      if (location) filters.location = location;
      
      const dateFilter = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      
      if (Object.keys(dateFilter).length > 0) {
        filters.scannedAt = dateFilter;
      }
      
      const allScans = await this.findByEvent(eventId, { 
        paginate: false,
        ...filters
      });
      
      // Calculer les statistiques de base
      const stats = {
        eventId,
        period: { startDate, endDate },
        total: allScans.data.length,
        successful: 0,
        failed: 0,
        byType: {},
        byScanner: {},
        byLocation: {},
        byHour: Array(24).fill(0),
        timeline: [],
        peakTimes: []
      };
      
      // Analyser chaque scan
      allScans.data.forEach(scan => {
        // Succès/échec
        if (scan.success) {
          stats.successful++;
        } else {
          stats.failed++;
        }
        
        // Par type
        stats.byType[scan.type] = (stats.byType[scan.type] || 0) + 1;
        
        // Par scanner
        if (scan.scannerId) {
          if (!stats.byScanner[scan.scannerId]) {
            stats.byScanner[scan.scannerId] = {
              count: 0,
              name: scan.scannerName || scan.scannerId
            };
          }
          stats.byScanner[scan.scannerId].count++;
        }
        
        // Par localisation
        if (scan.location) {
          stats.byLocation[scan.location] = (stats.byLocation[scan.location] || 0) + 1;
        }
        
        // Par heure
        const scanDate = new Date(scan.scannedAt);
        const hour = scanDate.getHours();
        stats.byHour[hour]++;
        
        // Pour la timeline groupée
        if (groupBy) {
          const timeKey = this.getTimeGroupKey(scan.scannedAt, groupBy);
          if (!stats.timeline.find(item => item.time === timeKey)) {
            stats.timeline.push({
              time: timeKey,
              successful: 0,
              failed: 0,
              total: 0
            });
          }
          
          const timelineItem = stats.timeline.find(item => item.time === timeKey);
          timelineItem.total++;
          if (scan.success) {
            timelineItem.successful++;
          } else {
            timelineItem.failed++;
          }
        }
      });
      
      // Calculer les pourcentages
      stats.successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
      stats.failureRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;
      
      // Identifier les heures de pointe
      const maxScansPerHour = Math.max(...stats.byHour);
      stats.peakTimes = stats.byHour
        .map((count, hour) => ({ hour, count }))
        .filter(item => item.count === maxScansPerHour)
        .map(item => `${item.hour}:00`);
      
      // Trier la timeline
      if (stats.timeline.length > 0) {
        stats.timeline.sort((a, b) => a.time.localeCompare(b.time));
      }
      
      // Scanner le plus actif
      if (Object.keys(stats.byScanner).length > 0) {
        const scannersArray = Object.entries(stats.byScanner)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => b.count - a.count);
        
        stats.topScanner = scannersArray[0];
      }
      
      this.logger.info('Statistiques scans générées', {
        eventId,
        total: stats.total,
        successRate: stats.successRate.toFixed(2) + '%'
      });
      
      return operation.success(stats);
    } catch (error) {
      return operation.error(error, { query });
    }
  }

  /**
   * @method getEventScanSummary
   * @description Récupère un résumé des scans d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Résumé
   */
  async getEventScanSummary(eventId) {
    const recentScans = await this.findRecentScans({ eventId }, 60, { paginate: false });
    const successfulScans = await this.findSuccessfulScans({ eventId }, { paginate: false });
    const failedScans = await this.findFailedScans({ eventId }, { paginate: false });
    
    // Scans par heure récente
    const hourlyScans = {};
    const nowTime = now();
    for (let i = 0; i < 6; i++) {
      const hourStart = new Date(nowTime.getTime() - (i * 60 * 60 * 1000));
      const hourKey = hourStart.getHours() + ':00';
      hourlyScans[hourKey] = 0;
    }
    
    recentScans.data.forEach(scan => {
      const scanHour = new Date(scan.scannedAt).getHours();
      const hourKey = scanHour + ':00';
      if (hourlyScans[hourKey] !== undefined) {
        hourlyScans[hourKey]++;
      }
    });
    
    return {
      eventId,
      total: successfulScans.data.length + failedScans.data.length,
      successful: successfulScans.data.length,
      failed: failedScans.data.length,
      recentHour: recentScans.data.length,
      successRate: successfulScans.data.length > 0 ? 
        (successfulScans.data.length / (successfulScans.data.length + failedScans.data.length)) * 100 : 0,
      hourlyScans,
      lastScan: recentScans.data.length > 0 ? 
        recentScans.data[0].scannedAt : null,
      topScanner: this.getTopScanner(recentScans.data)
    };
  }

  /**
   * @method getGuestScanHistory
   * @description Récupère l'historique des scans d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options
   * @returns {Promise<Object>} Historique
   */
  async getGuestScanHistory(guestId, options = {}) {
    const scans = await this.findByGuest(guestId, { 
      ...options,
      sort: { scannedAt: 'desc' }
    });
    
    const successfulScans = scans.data.filter(scan => scan.success);
    const failedScans = scans.data.filter(scan => !scan.success);
    
    return {
      guestId,
      totalScans: scans.data.length,
      successfulScans: successfulScans.length,
      failedScans: failedScans.length,
      firstScan: scans.data.length > 0 ? 
        scans.data[scans.data.length - 1].scannedAt : null,
      lastScan: scans.data.length > 0 ? 
        scans.data[0].scannedAt : null,
      scanFrequency: this.calculateScanFrequency(scans.data),
      locations: [...new Set(scans.data.map(scan => scan.location).filter(Boolean))],
      recentScans: scans.data.slice(0, 10).map(scan => scan.getScanSummary())
    };
  }

  // ============================================================================
  // MÉTHODES DE MAINTENANCE ET NETTOYAGE
  // ============================================================================

  /**
   * @method cleanupOldScans
   * @description Nettoie les anciens scans selon la politique de rétention
   * @param {number} retentionDays - Jours de rétention
   * @returns {Promise<Object>} Résultat nettoyage
   */
  async cleanupOldScans(retentionDays = this.scanConfig.retentionDays) {
    const operation = log.trackOperation('SCAN_CLEANUP_OLD', { retentionDays });
    
    try {
      const cutoffDate = new Date(now().getTime() - (retentionDays * 24 * 60 * 60 * 1000));
      
      const oldScans = await this.findAll({
        scannedAt: { $lt: cutoffDate.toISOString() }
      }, { paginate: false });
      
      let deleted = 0;
      
      for (const scan of oldScans.data) {
        try {
          await this.delete(scan.id, { 
            force: true, 
            reason: 'auto_cleanup_old' 
          });
          deleted++;
        } catch (error) {
          this.logger.warning('Erreur suppression scan ancien', {
            scanId: scan.id,
            error: error.message
          });
        }
      }
      
      this.logger.info('Nettoyage scans anciens terminé', {
        deleted,
        totalOld: oldScans.data.length,
        cutoffDate: cutoffDate.toISOString()
      });
      
      return operation.success({ deleted, totalOld: oldScans.data.length });
    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method fixOrphanedScans
   * @description Corrige les scans orphelins (sans événement/invité correspondant)
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat correction
   */
  async fixOrphanedScans(options = {}) {
    const operation = log.trackOperation('SCAN_FIX_ORPHANED', { options });
    
    try {
      // Cette méthode dépend d'autres repositories (EventRepo, GuestRepo)
      // Pour l'instant, elle ne fait que loguer les scans potentiellement orphelins
      
      const allScans = await this.findAll({}, { paginate: false, limit: 1000 });
      
      const orphanedScans = allScans.data.filter(scan => {
        // Vérifications basiques
        return !scan.eventId || !scan.guestId || !scan.qrCodeId;
      });
      
      this.logger.warning('Scans orphelins détectés', {
        totalScans: allScans.data.length,
        orphanedScans: orphanedScans.length,
        sample: orphanedScans.slice(0, 5).map(s => ({
          id: s.id,
          eventId: s.eventId,
          guestId: s.guestId,
          scannedAt: s.scannedAt
        }))
      });
      
      return operation.success({
        totalScans: allScans.data.length,
        orphanedScans: orphanedScans.length,
        orphanedSample: orphanedScans.slice(0, 10)
      });
    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * @method checkDuplicateScan
   * @description Vérifie si un scan est un doublon récent
   * @param {Object} scanData - Données du scan
   * @throws {ConflictError} Si doublon détecté
   */
  async checkDuplicateScan(scanData) {
    const { eventId, guestId, qrCodeId } = scanData;
    
    if (!eventId || !guestId || !qrCodeId) return;
    
    const recentDate = new Date(now().getTime() - this.scanConfig.duplicateWindowMs);
    
    const recentScans = await this.findAll({
      eventId,
      guestId,
      qrCodeId,
      scannedAt: { $gte: recentDate.toISOString() },
      success: true
    }, { paginate: false, limit: 1 });
    
    if (recentScans.data.length > 0) {
      throw new ConflictError(
        `Scan dupliqué détecté (fenêtre: ${this.scanConfig.duplicateWindowMs}ms)`,
        'DUPLICATE_SCAN'
      );
    }
  }

  /**
   * @method checkRecentScan
   * @description Vérifie si un scan récent existe déjà
   * @param {string} eventId - ID événement
   * @param {string} guestId - ID invité
   * @param {string} qrCodeId - ID QR code
   * @returns {Promise<Scan|null>} Scan récent ou null
   */
  async checkRecentScan(eventId, guestId, qrCodeId) {
    const recentDate = new Date(now().getTime() - this.scanConfig.duplicateWindowMs);
    
    const recentScans = await this.findAll({
      eventId,
      guestId,
      qrCodeId,
      scannedAt: { $gte: recentDate.toISOString() }
    }, { paginate: false, limit: 1 });
    
    return recentScans.data.length > 0 ? recentScans.data[0] : null;
  }

  /**
   * @method checkOfflineDuplicate
   * @description Vérifie les doublons pour les scans hors ligne
   * @param {Object} scanData - Données scan hors ligne
   * @param {string} deviceId - ID du device
   * @returns {Promise<Scan|null>} Scan existant ou null
   */
  async checkOfflineDuplicate(scanData, deviceId) {
    const { qrData, timestamp } = scanData;
    
    // Rechercher un scan avec les mêmes données et timestamp proche
    const timeWindow = 1000; // 1 seconde de marge
    const minTime = new Date(new Date(timestamp).getTime() - timeWindow);
    const maxTime = new Date(new Date(timestamp).getTime() + timeWindow);
    
    const existingScans = await this.findAll({
      'metadata.deviceId': deviceId,
      scannedAt: { 
        $gte: minTime.toISOString(),
        $lte: maxTime.toISOString()
      },
      'metadata.offline': true
    }, { paginate: false, limit: 1 });
    
    // Vérifier si les données QR correspondent
    if (existingScans.data.length > 0) {
      const existingScan = existingScans.data[0];
      const existingQRData = existingScan.scanData;
      
      if (JSON.stringify(existingQRData) === JSON.stringify(qrData)) {
        return existingScan;
      }
    }
    
    return null;
  }

  /**
   * @method checkGuestScanLimit
   * @description Vérifie la limite de scans par invité
   * @param {string} guestId - ID invité
   * @param {string} eventId - ID événement
   * @throws {AppError} Si limite atteinte
   */
  async checkGuestScanLimit(guestId, eventId) {
    const guestScans = await this.findByGuest(guestId, { 
      eventId,
      paginate: false 
    });
    
    if (guestScans.data.length >= this.scanConfig.maxScansPerGuest) {
      throw new AppError(
        `Limite de scans atteinte pour cet invité (max: ${this.scanConfig.maxScansPerGuest})`,
        400,
        'SCAN_LIMIT_REACHED'
      );
    }
  }

  /**
   * @method markOfflineScansAsSynced
   * @description Marque les scans hors ligne comme synchronisés
   * @param {string} deviceId - ID du device
   * @param {string} lastSync - Date dernière synchronisation
   */
  async markOfflineScansAsSynced(deviceId, lastSync) {
    const offlineScans = await this.findOfflineScans(
      { 
        'metadata.deviceId': deviceId,
        scannedAt: { $lt: lastSync }
      },
      { paginate: false }
    );
    
    for (const scan of offlineScans.data) {
      scan.markAsSynced();
      await this.update(scan.id, scan.toJSON(), {
        reason: 'offline_sync_batch',
        skipValidation: true
      });
    }
  }

  /**
   * @method extractQRCodeId
   * @description Extrait l'ID du QR code depuis les données
   * @param {Object} qrData - Données du QR code
   * @returns {string} ID du QR code
   */
  extractQRCodeId(qrData) {
    // Dans un système réel, il faudrait mapper les données QR à un ID
    // Pour l'instant, on génère un ID basé sur les données
    if (qrData.qid) return qrData.qid;
    
    // Fallback: hash des données
    const dataStr = JSON.stringify(qrData);
    return `qr_${this.hashString(dataStr).substring(0, 12)}`;
  }

  /**
   * @method getTimeGroupKey
   * @description Génère une clé de regroupement temporel
   * @param {string} timestamp - Timestamp
   * @param {string} groupBy - Type de regroupement
   * @returns {string} Clé de regroupement
   */
  getTimeGroupKey(timestamp, groupBy) {
    const date = new Date(timestamp);
    
    switch (groupBy) {
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:00`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      case 'week':
        const weekNumber = Math.ceil(date.getDate() / 7);
        return `${date.getFullYear()}-W${weekNumber}`;
      case 'month':
        return `${date.getFullYear()}-${date.getMonth() + 1}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * @method getTopScanner
   * @description Identifie le scanner le plus actif
   * @param {Array} scans - Liste de scans
   * @returns {Object|null} Scanner le plus actif
   */
  getTopScanner(scans) {
    if (scans.length === 0) return null;
    
    const scannerCounts = {};
    scans.forEach(scan => {
      if (scan.scannerId) {
        scannerCounts[scan.scannerId] = (scannerCounts[scan.scannerId] || 0) + 1;
      }
    });
    
    const topScannerId = Object.keys(scannerCounts).reduce((a, b) => 
      scannerCounts[a] > scannerCounts[b] ? a : b
    );
    
    const topScan = scans.find(scan => scan.scannerId === topScannerId);
    
    return {
      scannerId: topScannerId,
      scannerName: topScan?.scannerName || topScannerId,
      scanCount: scannerCounts[topScannerId]
    };
  }

  /**
   * @method calculateScanFrequency
   * @description Calcule la fréquence des scans
   * @param {Array} scans - Liste de scans
   * @returns {Object} Fréquence
   */
  calculateScanFrequency(scans) {
    if (scans.length < 2) return { averageInterval: null, minInterval: null, maxInterval: null };
    
    const intervals = [];
    const sortedScans = [...scans].sort((a, b) => 
      new Date(a.scannedAt) - new Date(b.scannedAt)
    );
    
    for (let i = 1; i < sortedScans.length; i++) {
      const interval = new Date(sortedScans[i].scannedAt) - new Date(sortedScans[i - 1].scannedAt);
      intervals.push(interval);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const minInterval = Math.min(...intervals);
    const maxInterval = Math.max(...intervals);
    
    return {
      averageInterval: Math.round(avgInterval / 1000), // en secondes
      minInterval: Math.round(minInterval / 1000),
      maxInterval: Math.round(maxInterval / 1000),
      totalScans: scans.length,
      timeRange: (new Date(scans[scans.length - 1].scannedAt) - new Date(scans[0].scannedAt)) / 1000
    };
  }

  /**
   * @method hashString
   * @description Hash simple d'une chaîne
   * @param {string} str - Chaîne à hasher
   * @returns {string} Hash
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * @method invalidateEventCache
   * @description Invalide le cache pour un événement
   * @param {string} eventId - ID de l'événement
   */
  async invalidateEventCache(eventId) {
    if (!this.options.enableCache) return;
    
    const pattern = this.getCacheKey(`event:${eventId}:*`);
    await this.cacheManager?.deleteByPattern(pattern);
  }

  /**
   * @method invalidateGuestCache
   * @description Invalide le cache pour un invité
   * @param {string} guestId - ID de l'invité
   */
  async invalidateGuestCache(guestId) {
    if (!this.options.enableCache) return;
    
    const pattern = this.getCacheKey(`guest:${guestId}:*`);
    await this.cacheManager?.deleteByPattern(pattern);
  }

  /**
   * @method invalidateScannerCache
   * @description Invalide le cache pour un scanner
   * @param {string} scannerId - ID du scanner
   */
  async invalidateScannerCache(scannerId) {
    if (!this.options.enableCache) return;
    
    const pattern = this.getCacheKey(`scanner:${scannerId}:*`);
    await this.cacheManager?.deleteByPattern(pattern);
  }

  /**
   * @method sanitizeScanData
   * @description Nettoie les données de scan pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeScanData(data) {
    const sanitized = { ...data };
    
    // Masquer les données sensibles
    if (sanitized.scanData) {
      if (typeof sanitized.scanData === 'object') {
        sanitized.scanData = '***ENCRYPTED_SCAN_DATA***';
      } else {
        sanitized.scanData = sanitized.scanData.substring(0, 20) + '...';
      }
    }
    
    if (sanitized.deviceInfo) {
      sanitized.deviceInfo = '***DEVICE_INFO***';
    }
    
    if (sanitized.metadata?.ipAddress) {
      sanitized.metadata.ipAddress = '***IP***';
    }
    
    if (sanitized.metadata?.coordinates) {
      sanitized.metadata.coordinates = '***COORDINATES***';
    }
    
    return sanitized;
  }

  /**
   * @method getUniqueFields
   * @description Retourne les champs avec contrainte d'unicité
   * @override
   * @returns {string[]} Champs uniques
   */
  getUniqueFields() {
    return ['id'];
  }

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository
   * @override
   * @returns {Promise<Object>} Statut
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    try {
      // Statistiques spécifiques aux scans
      const recentScans = await this.findRecentScans({}, 5, { paginate: false, limit: 1 });
      const offlineScans = await this.findOfflineScans({}, { paginate: false, limit: 1 });
      const totalScans = await this.count();
      
      const lastScan = recentScans.data.length > 0 ? recentScans.data[0].scannedAt : null;
      const offlinePending = await this.count({ 
        'metadata.offline': true, 
        'metadata.synced': false 
      });
      
      return {
        ...baseHealth,
        scanSpecific: {
          totalScans,
          recentScans: recentScans.data.length,
          offlinePending,
          lastScan,
          duplicateWindowMs: this.scanConfig.duplicateWindowMs,
          retentionDays: this.scanConfig.retentionDays
        },
        status: baseHealth.status === 'healthy' ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        ...baseHealth,
        scanSpecific: { error: error.message },
        status: 'degraded'
      };
    }
  }
}

module.exports = ScanRepository;