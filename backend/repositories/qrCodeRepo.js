/**
 * @file qrRepo.js
 * @description Repository ultra-complet pour la gestion des QR codes Secura.
 * Hérite de BaseRepository avec fonctionnalités spécifiques aux QR codes.
 * Gère les QR codes d'invitation et de table avec validation, génération et stats.
 * @module repositories/qrRepo
 * @requires ./baseRepo
 * @requires ../models/qrCodeModel
 * @requires ../models/tableQRModel
 * @requires ../utils/validation/qrValidation
 * @requires ../utils/validation/tableQRValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/qrHelper
 * @requires ../utils/logger
 * @requires ../utils/helpers/dateHelper
 */

const BaseRepository = require('./baseRepo');
const QRCode = require('../models/qrCodeModel');
const TableQR = require('../models/tableQRModel');
const {
  validateCreateQRCode,
  validateUpdateQRCode,
  validateGenerateQRCode,
  validateQRCodeData,
  validateQRScan,
  validateBulkCreateQR
} = require('../utils/validation/qrValidation');
const {
  validateCreateTableQR,
  validateUpdateTableQR,
  validateAssignGuestToTable,
  validateScanTableQR,
  validateBulkCreateTables
} = require('../utils/validation/tableQRValidation');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../utils/errorHandler');
const { QR_CODES, STATUS } = require('../utils/constants');
const { generateQRCodeId, generateTableQRId } = require('../utils/helpers/idGenerator');
const { 
  generateInvitationQR, 
  generateTableQR, 
  generateBatchQRCodes, 
  validateQRCode,
  generateInvitationData,
  generateTableInfoData,
  parseQRData,
  verifySignature
} = require('../utils/helpers/qrHelper');
const log = require('../utils/logger');
const { now, addDays } = require('../utils/helpers/dateHelper');

/**
 * @class QRRepository
 * @description Repository spécialisé pour la gestion des QR codes Secura (unifié pour invitation/table)
 * @extends BaseRepository
 */
class QRRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('qrcodes', {
      enableCache: true,
      cacheTTL: 360, // 6 minutes
      enableAudit: true,
      softDelete: true,
      validationRequired: true,
      maxRetries: 3,
      ...options
    });
    
    // Configuration spécifique aux QR codes
    this.qrConfig = {
      maxQRCodesPerEvent: 10000,
      defaultExpiryDays: QR_CODES.EXPIRY_DAYS,
      bulkGenerateLimit: 500,
      maxTableQRCodes: 200,
      maxScansPerCode: QR_CODES.MAX_SCANS_PER_CODE,
      ...options.qrConfig
    };
    
    this.logger = log.withContext({
      repository: 'QRRepository',
      collection: 'qrcodes'
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
      
      // Créer les index spécifiques aux QR codes
      await this.createIndexes();
      
      this.logger.info('QRRepository initialisé', {
        maxQRCodesPerEvent: this.qrConfig.maxQRCodesPerEvent,
        defaultExpiryDays: this.qrConfig.defaultExpiryDays
      });
    } catch (error) {
      this.logger.error('Erreur initialisation QRRepository', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method createIndexes
   * @description Crée les index spécifiques aux QR codes
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      // Index sur les champs fréquemment utilisés
      const indexes = [
        { field: 'eventId', type: 'hash' },
        { field: 'guestId', type: 'hash' },
        { field: 'type', type: 'hash' },
        { field: 'tableNumber', type: 'hash' },
        { field: 'status', type: 'hash' },
        { field: 'createdAt', type: 'range' },
        { field: 'expiresAt', type: 'range' },
        { field: 'rawData', type: 'hash', unique: true }
      ];
      
      this.logger.debug('Index QR codes créés', { indexes: indexes.length });
    } catch (error) {
      this.logger.warning('Erreur création index QR', { error: error.message });
    }
  }

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée un nouveau QR code avec validation complète
   * @param {Object} qrData - Données du QR code
   * @param {Object} options - Options de création
   * @returns {Promise<QRCode|TableQR>} QR code créé
   */
  async create(qrData, options = {}) {
    const operation = log.trackOperation('QR_CREATE', {
      data: this.sanitizeQRData(qrData),
      options
    });
    
    try {
      // Validation selon le type
      let validation;
      if (qrData.type === QR_CODES.TYPES.TABLE_INFO) {
        validation = validateCreateTableQR(qrData);
      } else {
        validation = validateCreateQRCode(qrData);
      }
      
      if (validation.error) {
        throw new ValidationError(
          'Données QR invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      // Vérifier limite par événement
      await this.checkEventQRCodeLimit(qrData.eventId);
      
      // Créer l'instance appropriée
      const QRModel = qrData.type === QR_CODES.TYPES.TABLE_INFO ? TableQR : QRCode;
      const qr = new QRModel(qrData);
      
      // Générer l'ID si non fourni
      if (!qr.id) {
        if (qr.type === QR_CODES.TYPES.TABLE_INFO && qr.tableNumber) {
          qr.id = generateTableQRId(qr.tableNumber);
        } else {
          qr.id = generateQRCodeId();
        }
      }
      
      // Définir expiration par défaut si non spécifiée
      if (!qr.expiresAt && qr.type === QR_CODES.TYPES.INVITATION) {
        const expiryDate = addDays(now(), this.qrConfig.defaultExpiryDays);
        qr.setExpiration(expiryDate);
      }
      
      // Générer les données QR si nécessaire
      if (!qr.data && qr.type === QR_CODES.TYPES.INVITATION) {
        qr.generateInvitationData(qrData.guestInfo || {});
      } else if (!qr.qrData && qr.type === QR_CODES.TYPES.TABLE_INFO) {
        qr.generateQRData(qrData.eventInfo || {});
      }
      
      // Vérifier contraintes d'unicité
      await this.checkQRUniqueConstraints(qr);
      
      // Sauvegarder via BaseRepo
      const result = await super.create(qr.toJSON(), options);
      
      // Audit
      this.logger.crud('CREATE', 'qrcodes', {
        qrId: qr.id,
        type: qr.type,
        eventId: qr.eventId,
        guestId: qr.guestId || 'N/A',
        tableNumber: qr.tableNumber || 'N/A'
      });
      
      // Invalider les caches spécifiques
      await this.invalidateEventCache(qr.eventId);
      if (qr.guestId) await this.invalidateGuestCache(qr.guestId);
      
      return operation.success({ qr, saved: result.created });
    } catch (error) {
      return operation.error(error, {
        data: this.sanitizeQRData(qrData)
      });
    }
  }

  /**
   * @method findById
   * @description Trouve un QR code par ID avec instantiation du bon modèle
   * @param {string} id - ID du QR code
   * @param {Object} options - Options de recherche
   * @returns {Promise<QRCode|TableQR|null>} QR code trouvé
   */
  async findById(id, options = {}) {
    const result = await super.findById(id, options);
    
    if (!result.found) {
      return result;
    }
    
    // Instancier le bon modèle
    const qrData = result.found;
    const QRModel = qrData.type === QR_CODES.TYPES.TABLE_INFO ? TableQR : QRCode;
    const qr = QRModel.fromJSON(qrData);
    
    return { 
      found: qr, 
      fromCache: result.fromCache || false 
    };
  }

  /**
   * @method findAll
   * @description Trouve tous les QR codes avec filtres et instantiation
   * @param {Object} filters - Filtres de recherche
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultats paginés avec instances
   */
  async findAll(filters = {}, options = {}) {
    const result = await super.findAll(filters, options);
    
    // Instancier les modèles appropriés
    result.data = result.data.map(qrData => {
      const QRModel = qrData.type === QR_CODES.TYPES.TABLE_INFO ? TableQR : QRCode;
      return QRModel.fromJSON(qrData);
    });
    
    return result;
  }

  /**
   * @method update
   * @description Met à jour un QR code avec validation spécifique
   * @param {string} id - ID du QR code
   * @param {Object} updates - Données de mise à jour
   * @param {Object} options - Options
   * @returns {Promise<QRCode|TableQR>} QR code mis à jour
   */
  async update(id, updates, options = {}) {
    const existing = await this.findById(id, { throwIfNotFound: true });
    const qr = existing.found;
    
    // Validation selon le type
    let validation;
    if (qr.type === QR_CODES.TYPES.TABLE_INFO) {
      validation = validateUpdateTableQR(updates);
    } else {
      validation = validateUpdateQRCode(updates);
    }
    
    if (validation.error) {
      throw new ValidationError(
        'Mises à jour QR invalides',
        validation.error.details.map(d => d.message)
      );
    }
    
    // Appliquer les mises à jour
    if (qr.type === QR_CODES.TYPES.TABLE_INFO) {
      if (updates.content) qr.updateContent(updates.content);
      if (updates.tableInfo) qr.updateTableInfo(updates.tableInfo);
      if (updates.qrConfig) qr.updateConfig(updates.qrConfig);
    } else {
      if (updates.config) qr.updateConfig(updates.config);
    }
    
    if (updates.active !== undefined) {
      updates.active ? qr.activate() : qr.deactivate();
    }
    
    if (updates.expiresAt) {
      qr.setExpiration(updates.expiresAt);
    }
    
    if (updates.maxScans !== undefined) {
      qr.maxScans = updates.maxScans;
    }
    
    // Mettre à jour via BaseRepo
    const result = await super.update(id, qr.toJSON(), options);
    
    // Invalider les caches
    await this.invalidateCache(id);
    await this.invalidateEventCache(qr.eventId);
    
    return { updated: qr, ...result };
  }

  /**
   * @method delete
   * @description Supprime un QR code avec vérifications
   * @param {string} id - ID du QR code
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async delete(id, options = {}) {
    const existing = await this.findById(id, { throwIfNotFound: true });
    const qr = existing.found;
    
    // Vérifications de sécurité
    if (qr.scanCount > 0 && !options.force) {
      throw new AppError(
        `QR code déjà scanné (${qr.scanCount} fois). Utilisez force:true pour supprimer.`,
        400,
        'QR_ALREADY_SCANNED'
      );
    }
    
    if (qr.isExpired && !options.force) {
      throw new AppError(
        'QR code expiré. Utilisez force:true pour supprimer.',
        400,
        'QR_EXPIRED'
      );
    }
    
    const result = await super.delete(id, options);
    
    // Invalider les caches
    await this.invalidateEventCache(qr.eventId);
    if (qr.guestId) await this.invalidateGuestCache(qr.guestId);
    
    return result;
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method findByEvent
   * @description Trouve les QR codes d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR codes trouvés
   */
  async findByEvent(eventId, options = {}) {
    const cacheKey = this.getCacheKey(`event:${eventId}:${JSON.stringify(options)}`);
    
    if (this.options.enableCache && !options.forceRefresh) {
      const cached = await this.cacheManager?.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }
    
    const filters = { eventId };
    if (options.type) filters.type = options.type;
    if (options.status) filters.status = options.status;
    
    const result = await this.findAll(filters, options);
    
    if (this.options.enableCache) {
      await this.cacheManager?.set(cacheKey, result, { ttl: 300 });
    }
    
    return { ...result, fromCache: false };
  }

  /**
   * @method findByGuest
   * @description Trouve les QR codes d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR codes trouvés
   */
  async findByGuest(guestId, options = {}) {
    return this.findAll({ guestId }, options);
  }

  /**
   * @method findByType
   * @description Trouve les QR codes par type
   * @param {string} type - Type de QR
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR codes trouvés
   */
  async findByType(type, options = {}) {
    return this.findAll({ type }, options);
  }

  /**
   * @method findByTableNumber
   * @description Trouve les QR codes de table par numéro
   * @param {string} eventId - ID de l'événement
   * @param {string|number} tableNumber - Numéro de table
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR codes trouvés
   */
  async findByTableNumber(eventId, tableNumber, options = {}) {
    return this.findAll({ 
      eventId, 
      type: QR_CODES.TYPES.TABLE_INFO,
      tableNumber 
    }, options);
  }

  /**
   * @method findActiveByEvent
   * @description Trouve les QR codes actifs d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR codes actifs
   */
  async findActiveByEvent(eventId, options = {}) {
    return this.findAll({ 
      eventId, 
      active: true,
      isExpired: false 
    }, options);
  }

  /**
   * @method findExpiredQR
   * @description Trouve les QR codes expirés
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR codes expirés
   */
  async findExpiredQR(options = {}) {
    const currentDate = now().toISOString();
    return this.findAll({
      expiresAt: { $lt: currentDate },
      active: true
    }, options);
  }

  /**
   * @method findScannableQR
   * @description Trouve les QR codes pouvant être scannés
   * @param {Object} filters - Filtres additionnels
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR codes scannables
   */
  async findScannableQR(filters = {}, options = {}) {
    const baseFilters = {
      active: true,
      isExpired: false,
      $expr: { $lt: ['$scanCount', '$maxScans'] }
    };
    
    return this.findAll({ ...baseFilters, ...filters }, options);
  }

  // ============================================================================
  // MÉTHODES DE GÉNÉRATION
  // ============================================================================

  /**
   * @method generateInvitationQR
   * @description Génère un QR code d'invitation complet
   * @param {string} guestId - ID de l'invité
   * @param {string} eventId - ID de l'événement
   * @param {Object} guestInfo - Informations de l'invité
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR code généré
   */
  async generateInvitationQR(guestId, eventId, guestInfo = {}, options = {}) {
    const operation = log.trackOperation('QR_GENERATE_INVITATION', {
      guestId,
      eventId,
      guestInfo: this.sanitizeGuestInfo(guestInfo)
    });
    
    try {
      // Vérifier si un QR existe déjà pour cet invité
      const existing = await this.findOne({ guestId, eventId, type: QR_CODES.TYPES.INVITATION });
      if (existing.found && !options.regenerate) {
        throw new ConflictError('QR code d\'invitation existe déjà pour cet invité');
      }
      
      // Créer le QR code
      const qrData = {
        guestId,
        eventId,
        type: QR_CODES.TYPES.INVITATION,
        config: options.config || {},
        metadata: {
          generatedBy: options.generatedBy || 'system',
          generationMethod: 'api'
        }
      };
      
      const qr = new QRCode(qrData);
      qr.generateInvitationData(guestInfo);
      
      // Générer l'image si demandé
      if (options.generateImage) {
        const { qrCode: image } = await generateInvitationQR(
          qr.data,
          options.format || 'dataURL'
        );
        qr.imageData = image;
      }
      
      // Sauvegarder
      const saved = await this.create(qr, options);
      
      this.logger.info('QR invitation généré', {
        qrId: qr.id,
        guestId,
        eventId
      });
      
      return operation.success({
        qr: saved.qr,
        image: qr.imageData,
        data: qr.data
      });
    } catch (error) {
      return operation.error(error, { guestId, eventId });
    }
  }

  /**
   * @method generateTableQR
   * @description Génère un QR code de table informatif
   * @param {string} eventId - ID de l'événement
   * @param {string|number} tableNumber - Numéro de table
   * @param {Object} tableInfo - Informations de la table
   * @param {Object} options - Options
   * @returns {Promise<Object>} QR code généré
   */
  async generateTableQR(eventId, tableNumber, tableInfo = {}, options = {}) {
    const operation = log.trackOperation('QR_GENERATE_TABLE', {
      eventId,
      tableNumber,
      tableInfo: this.sanitizeTableInfo(tableInfo)
    });
    
    try {
      // Vérifier si un QR existe déjà pour cette table
      const existing = await this.findOne({ 
        eventId, 
        tableNumber,
        type: QR_CODES.TYPES.TABLE_INFO 
      });
      
      if (existing.found && !options.regenerate) {
        throw new ConflictError('QR code de table existe déjà pour cette table');
      }
      
      // Vérifier limite tables par événement
      const tableCount = await this.count({ 
        eventId, 
        type: QR_CODES.TYPES.TABLE_INFO 
      });
      
      if (tableCount >= this.qrConfig.maxTableQRCodes) {
        throw new AppError(
          `Limite de tables atteinte (${this.qrConfig.maxTableQRCodes})`,
          400,
          'TABLE_LIMIT_REACHED'
        );
      }
      
      // Créer le QR code
      const qrData = {
        eventId,
        tableNumber,
        type: QR_CODES.TYPES.TABLE_INFO,
        ...tableInfo
      };
      
      const qr = new TableQR(qrData);
      qr.generateQRData(options.eventInfo || {});
      
      // Générer l'image si demandé
      if (options.generateImage) {
        const { qrCode: image } = await generateTableQR(
          qr.qrData,
          options.format || 'dataURL'
        );
        qr.qrImage = image;
      }
      
      // Sauvegarder
      const saved = await this.create(qr, options);
      
      this.logger.info('QR table généré', {
        qrId: qr.id,
        eventId,
        tableNumber,
        tableName: qr.tableName
      });
      
      return operation.success({
        qr: saved.qr,
        image: qr.qrImage,
        data: qr.qrData
      });
    } catch (error) {
      return operation.error(error, { eventId, tableNumber });
    }
  }

  /**
   * @method bulkGenerateInvitationQR
   * @description Génère plusieurs QR codes d'invitation en lot
   * @param {Array} guestsData - Données des invités
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultats
   */
  async bulkGenerateInvitationQR(guestsData, eventId, options = {}) {
    const operation = log.trackOperation('QR_BULK_GENERATE_INVITATIONS', {
      eventId,
      count: guestsData.length,
      options
    });
    
    try {
      if (guestsData.length > this.qrConfig.bulkGenerateLimit) {
        throw new AppError(
          `Limite de génération dépassée (max: ${this.qrConfig.bulkGenerateLimit})`,
          400,
          'BULK_LIMIT_EXCEEDED'
        );
      }
      
      const results = {
        generated: 0,
        skipped: 0,
        errors: 0,
        qrcodes: []
      };
      
      for (const guestData of guestsData) {
        try {
          const result = await this.generateInvitationQR(
            guestData.guestId,
            eventId,
            guestData,
            { ...options, regenerate: false }
          );
          
          results.generated++;
          results.qrcodes.push({
            guestId: guestData.guestId,
            qrId: result.qr.id,
            status: 'generated'
          });
        } catch (error) {
          if (error.code === 'CONFLICT') {
            results.skipped++;
            results.qrcodes.push({
              guestId: guestData.guestId,
              status: 'skipped',
              reason: 'already_exists'
            });
          } else {
            results.errors++;
            results.qrcodes.push({
              guestId: guestData.guestId,
              status: 'error',
              error: error.message
            });
          }
        }
      }
      
      this.logger.info('Bulk QR invitations terminé', results);
      
      return operation.success(results);
    } catch (error) {
      return operation.error(error, { eventId, count: guestsData.length });
    }
  }

  /**
   * @method bulkGenerateTableQR
   * @description Génère plusieurs QR codes de table en lot
   * @param {string} eventId - ID de l'événement
   * @param {Array} tablesData - Données des tables
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultats
   */
  async bulkGenerateTableQR(eventId, tablesData, options = {}) {
    const operation = log.trackOperation('QR_BULK_GENERATE_TABLES', {
      eventId,
      count: tablesData.length,
      options
    });
    
    try {
      if (tablesData.length > this.qrConfig.bulkGenerateLimit) {
        throw new AppError(
          `Limite de génération dépassée (max: ${this.qrConfig.bulkGenerateLimit})`,
          400,
          'BULK_LIMIT_EXCEEDED'
        );
      }
      
      const results = {
        generated: 0,
        skipped: 0,
        errors: 0,
        tables: []
      };
      
      for (const tableData of tablesData) {
        try {
          const result = await this.generateTableQR(
            eventId,
            tableData.tableNumber,
            tableData,
            { ...options, regenerate: false }
          );
          
          results.generated++;
          results.tables.push({
            tableNumber: tableData.tableNumber,
            qrId: result.qr.id,
            status: 'generated'
          });
        } catch (error) {
          if (error.code === 'CONFLICT') {
            results.skipped++;
            results.tables.push({
              tableNumber: tableData.tableNumber,
              status: 'skipped',
              reason: 'already_exists'
            });
          } else {
            results.errors++;
            results.tables.push({
              tableNumber: tableData.tableNumber,
              status: 'error',
              error: error.message
            });
          }
        }
      }
      
      this.logger.info('Bulk QR tables terminé', results);
      
      return operation.success(results);
    } catch (error) {
      return operation.error(error, { eventId, count: tablesData.length });
    }
  }

  // ============================================================================
  // MÉTHODES DE VALIDATION ET VÉRIFICATION
  // ============================================================================

  /**
   * @method validateQRData
   * @description Valide les données d'un QR code
   * @param {Object|string} qrData - Données du QR code
   * @returns {Object} Résultat de validation
   */
  async validateQRData(qrData) {
    try {
      const data = typeof qrData === 'string' ? parseQRData(qrData) : qrData;
      
      if (!data) {
        return { valid: false, error: 'Format QR code invalide' };
      }
      
      // Validation avec le helper
      const validation = validateQRCode(data);
      
      if (!validation.valid) {
        return validation;
      }
      
      // Vérifier la signature
      if (!verifySignature(data)) {
        return { valid: false, error: 'Signature invalide' };
      }
      
      // Rechercher dans la base
      const existing = await this.findOne({ rawData: JSON.stringify(data) });
      
      return {
        valid: true,
        data,
        stored: !!existing.found,
        qrId: existing.found?.id
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
 * @method verifyQR
 * @description Vérifie uniquement un QR code (sans enregistrer de scan)
 * @param {Object|string} qrData - Données du QR code
 * @param {Object} options - Options
 * @returns {Promise<Object>} Résultat vérification
 */
async verifyQR(qrData, options = {}) {
  const operation = log.trackOperation('QR_VERIFY', { 
    qrData: typeof qrData === 'string' ? qrData.substring(0, 50) + '...' : 'object' 
  });
  
  try {
    // Valider les données
    const validation = validateQRCodeData({ qrData: typeof qrData === 'string' ? JSON.parse(qrData) : qrData });
    if (validation.error) {
      throw new ValidationError('Données QR invalides', validation.error.details);
    }
    
    const data = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    const { valid, data: validatedData, error } = validateQRCode(data);
    
    if (!valid) {
      throw new AppError(`QR invalide: ${error}`, 400, 'QR_INVALID');
    }
    
    // Vérifier existence en BD
    const existing = await this.findOne({ rawData: JSON.stringify(validatedData) });
    
    if (!existing && options.requireStored) {
      throw new NotFoundError('QR non enregistré');
    }
    
    const qr = existing?.found;
    
    // Vérifier si scannable (sans enregistrer le scan)
    if (qr && options.checkScannable) {
      if (!qr.canBeScanned()) {
        throw new AppError(
          `QR non scannable (scans: ${qr.scanCount}/${qr.maxScans}, actif: ${qr.active}, expiré: ${qr.isExpired})`,
          400,
          'QR_NOT_SCANNABLE'
        );
      }
    }
    
    return operation.success({ 
      valid, 
      data: validatedData, 
      stored: !!existing?.found,
      qrId: existing?.found?.id,
      qrInfo: qr?.getScanInfo()
    });
  } catch (error) {
    return operation.error(error);
  }
}

/**
 * @method markQRAsScanned
 * @description Marque un QR code comme scanné (à utiliser avec ScanRepository)
 * @param {string} qrId - ID du QR code
 * @param {Object} scanInfo - Informations du scan
 * @returns {Promise<Object>} QR mis à jour
 */
async markQRAsScanned(qrId, scanInfo = {}) {
  const qr = await this.findById(qrId, { throwIfNotFound: true });
  
  // Vérifier si scannable
  if (!qr.found.canBeScanned()) {
    throw new AppError(
      `QR non scannable (scans: ${qr.found.scanCount}/${qr.found.maxScans})`,
      400,
      'QR_NOT_SCANNABLE'
    );
  }
  
  // Enregistrer le scan dans le QR
  qr.found.recordScan(scanInfo);
  
  // Mettre à jour en base
  const result = await this.update(qrId, qr.found.toJSON(), { 
    reason: 'scan_recorded',
    skipValidation: true 
  });
  
  this.logger.info('QR marqué comme scanné', {
    qrId,
    scanCount: qr.found.scanCount,
    scannerId: scanInfo.scannerId
  });
  
  return result;
}



  /**
   * @method checkQRStatus
   * @description Vérifie le statut d'un QR code
   * @param {string} qrId - ID du QR code
   * @returns {Promise<Object>} Statut
   */
  async checkQRStatus(qrId) {
    const qr = await this.findById(qrId, { throwIfNotFound: true });
    
    return {
      qrId: qr.found.id,
      type: qr.found.type,
      active: qr.found.active,
      isExpired: qr.found.isExpired,
      scanCount: qr.found.scanCount,
      maxScans: qr.found.maxScans,
      canBeScanned: qr.found.canBeScanned(),
      expiresAt: qr.found.expiresAt,
      lastScanned: qr.found.lastScanned,
      isValid: qr.found.isValid()
    };
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES TABLES
  // ============================================================================

  /**
   * @method assignGuestToTable
   * @description Assigne un invité à une table
   * @param {string} tableQRId - ID du QR table
   * @param {Object} assignmentData - Données d'assignation
   * @param {Object} options - Options
   * @returns {Promise<TableQR>} Table mise à jour
   */
  async assignGuestToTable(tableQRId, assignmentData, options = {}) {
    const operation = log.trackOperation('QR_ASSIGN_GUEST_TO_TABLE', {
      tableQRId,
      guestId: assignmentData.guestId
    });
    
    try {
      // Validation
      const validation = validateAssignGuestToTable(assignmentData);
      if (validation.error) {
        throw new ValidationError(
          'Données assignation invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      // Récupérer la table
      const tableQR = await this.findById(tableQRId, { throwIfNotFound: true });
      if (tableQR.found.type !== QR_CODES.TYPES.TABLE_INFO) {
        throw new AppError('QR non de type table', 400, 'NOT_TABLE_QR');
      }
      
      const table = tableQR.found;
      
      // Vérifier si la table est pleine
      if (table.isFull()) {
        throw new AppError(
          `Table pleine (${table.capacity} places)`,
          400,
          'TABLE_FULL'
        );
      }
      
      // Assigner l'invité
      table.assignGuest(assignmentData);
      
      // Mettre à jour
      const result = await this.update(tableQRId, table.toJSON(), options);
      
      this.logger.info('Invité assigné à table', {
        tableQRId,
        guestId: assignmentData.guestId,
        guestName: assignmentData.guestName,
        seats: assignmentData.seats || 1
      });
      
      return operation.success({ table: result.updated });
    } catch (error) {
      return operation.error(error, { tableQRId, guestId: assignmentData.guestId });
    }
  }

  /**
   * @method removeGuestFromTable
   * @description Retire un invité d'une table
   * @param {string} tableQRId - ID du QR table
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async removeGuestFromTable(tableQRId, guestId, options = {}) {
    const operation = log.trackOperation('QR_REMOVE_GUEST_FROM_TABLE', {
      tableQRId,
      guestId
    });
    
    try {
      // Récupérer la table
      const tableQR = await this.findById(tableQRId, { throwIfNotFound: true });
      if (tableQR.found.type !== QR_CODES.TYPES.TABLE_INFO) {
        throw new AppError('QR non de type table', 400, 'NOT_TABLE_QR');
      }
      
      const table = tableQR.found;
      
      // Retirer l'invité
      const removed = table.removeGuest(guestId);
      if (!removed) {
        throw new NotFoundError('Invité non trouvé sur cette table');
      }
      
      // Mettre à jour
      await this.update(tableQRId, table.toJSON(), options);
      
      this.logger.info('Invité retiré de table', {
        tableQRId,
        guestId,
        guestName: removed.guestName
      });
      
      return operation.success({ removed, table });
    } catch (error) {
      return operation.error(error, { tableQRId, guestId });
    }
  }

  /**
   * @method getTableOccupancy
   * @description Récupère l'occupation d'une table
   * @param {string} tableQRId - ID du QR table
   * @returns {Promise<Object>} Occupation
   */
  async getTableOccupancy(tableQRId) {
    const tableQR = await this.findById(tableQRId, { throwIfNotFound: true });
    
    if (tableQR.found.type !== QR_CODES.TYPES.TABLE_INFO) {
      throw new AppError('QR non de type table', 400, 'NOT_TABLE_QR');
    }
    
    const table = tableQR.found;
    
    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableName: table.tableName,
      capacity: table.capacity,
      guestCount: table.guestCount,
      assignedGuests: table.getGuestList(),
      availableSeats: table.getAvailableSeats(),
      occupancyRate: table.getOccupancyRate(),
      isFull: table.isFull()
    };
  }

  // ============================================================================
  // MÉTHODES DE STATISTIQUES
  // ============================================================================

  /**
   * @method getQRStats
   * @description Récupère les statistiques d'un QR code
   * @param {string} qrId - ID du QR code
   * @returns {Promise<Object>} Statistiques
   */
  async getQRStats(qrId) {
    const qr = await this.findById(qrId, { throwIfNotFound: true });
    
    return {
      ...qr.found.getScanInfo(),
      generationCount: qr.found.generationHistory?.length || 0,
      scanHistoryCount: qr.found.scanHistory?.length || 0,
      isValid: qr.found.isValid(),
      canBeScanned: qr.found.canBeScanned(),
      daysUntilExpiry: qr.found.expiresAt ? 
        Math.ceil((new Date(qr.found.expiresAt) - now()) / (1000 * 60 * 60 * 24)) : 
        null
    };
  }

  /**
   * @method getEventQRStats
   * @description Statistiques globales des QR codes d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Statistiques
   */
  async getEventQRStats(eventId) {
    const allQRs = await this.findByEvent(eventId, { paginate: false });
    
    const stats = {
      total: allQRs.data.length,
      byType: {},
      active: 0,
      expired: 0,
      scanned: 0,
      totalScans: 0,
      availableForScan: 0,
      tables: {
        total: 0,
        occupied: 0,
        full: 0,
        totalSeats: 0,
        occupiedSeats: 0
      }
    };
    
    allQRs.data.forEach(qr => {
      // Statistiques générales
      stats.byType[qr.type] = (stats.byType[qr.type] || 0) + 1;
      if (qr.active) stats.active++;
      if (qr.isExpired) stats.expired++;
      if (qr.scanCount > 0) stats.scanned++;
      stats.totalScans += qr.scanCount;
      if (qr.canBeScanned()) stats.availableForScan++;
      
      // Statistiques spécifiques aux tables
      if (qr.type === QR_CODES.TYPES.TABLE_INFO && qr instanceof TableQR) {
        stats.tables.total++;
        if (qr.guestCount > 0) stats.tables.occupied++;
        if (qr.isFull()) stats.tables.full++;
        stats.tables.totalSeats += qr.capacity;
        stats.tables.occupiedSeats += qr.guestCount;
      }
    });
    
    // Calculer les pourcentages
    stats.scanRate = stats.total > 0 ? (stats.scanned / stats.total) * 100 : 0;
    stats.activeRate = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;
    stats.tables.occupancyRate = stats.tables.totalSeats > 0 ? 
      (stats.tables.occupiedSeats / stats.tables.totalSeats) * 100 : 0;
    
    return stats;
  }

  /**
   * @method getGuestQRStats
   * @description Statistiques des QR codes d'un invité
   * @param {string} guestId - ID de l'invité
   * @returns {Promise<Object>} Statistiques
   */
  async getGuestQRStats(guestId) {
    const qrs = await this.findByGuest(guestId, { paginate: false });
    
    return {
      totalQRCodes: qrs.data.length,
      invitationQRCodes: qrs.data.filter(qr => qr.type === QR_CODES.TYPES.INVITATION).length,
      tableQRCodes: qrs.data.filter(qr => qr.type === QR_CODES.TYPES.TABLE_INFO).length,
      scannedQRCodes: qrs.data.filter(qr => qr.scanCount > 0).length,
      activeQRCodes: qrs.data.filter(qr => qr.active).length,
      expiredQRCodes: qrs.data.filter(qr => qr.isExpired).length,
      totalScans: qrs.data.reduce((sum, qr) => sum + qr.scanCount, 0),
      lastScan: qrs.data.reduce((latest, qr) => {
        if (!qr.lastScanned) return latest;
        return latest > qr.lastScanned ? latest : qr.lastScanned;
      }, null)
    };
  }

  // ============================================================================
  // MÉTHODES DE MAINTENANCE
  // ============================================================================

  /**
   * @method cleanupExpiredQR
   * @description Nettoie les QR codes expirés
   * @param {number} daysAfterExpiry - Jours après expiration
   * @returns {Promise<Object>} Résultat
   */
  async cleanupExpiredQR(daysAfterExpiry = 7) {
    const operation = log.trackOperation('QR_CLEANUP_EXPIRED', { daysAfterExpiry });
    
    try {
      const expiredDate = new Date(now().getTime() - (daysAfterExpiry * 24 * 60 * 60 * 1000));
      const expiredQRs = await this.findAll({
        expiresAt: { $lt: expiredDate.toISOString() },
        active: true
      }, { paginate: false });
      
      let cleaned = 0;
      let deactivated = 0;
      
      for (const qr of expiredQRs.data) {
        try {
          // Désactiver les QR codes expirés
          qr.deactivate();
          await this.update(qr.id, qr.toJSON(), { 
            reason: 'auto_deactivate_expired',
            skipValidation: true 
          });
          deactivated++;
          
          // Supprimer les QR codes très anciens
          if (daysAfterExpiry > 30) {
            await this.delete(qr.id, { 
              softDelete: true, 
              reason: 'auto_cleanup_old_expired',
              force: true 
            });
            cleaned++;
          }
        } catch (error) {
          this.logger.warning('Erreur nettoyage QR expiré', {
            qrId: qr.id,
            error: error.message
          });
        }
      }
      
      this.logger.info('Nettoyage QR expirés terminé', {
        deactivated,
        cleaned,
        totalExpired: expiredQRs.data.length
      });
      
      return operation.success({ deactivated, cleaned, totalExpired: expiredQRs.data.length });
    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method checkIntegrity
   * @description Vérifie l'intégrité des QR codes
   * @param {Object} options - Options
   * @returns {Promise<Object>} Rapport d'intégrité
   */
  async checkIntegrity(options = {}) {
    const operation = log.trackOperation('QR_CHECK_INTEGRITY', { options });
    
    try {
      const allQRs = await this.findAll({}, { paginate: false });
      
      const report = {
        total: allQRs.data.length,
        valid: 0,
        invalid: 0,
        withMissingData: 0,
        withInvalidSignature: 0,
        duplicates: 0,
        orphans: 0,
        errors: []
      };
      
      // Vérifier chaque QR code
      const seenRawData = new Set();
      
      for (const qr of allQRs.data) {
        try {
          // Vérifier les données brutes
          if (!qr.rawData && !qr.data && !qr.qrData) {
            report.withMissingData++;
            report.errors.push({
              qrId: qr.id,
              type: qr.type,
              error: 'Missing raw data'
            });
            continue;
          }
          
          // Vérifier les doublons
          const rawData = qr.rawData || JSON.stringify(qr.data || qr.qrData);
          if (seenRawData.has(rawData)) {
            report.duplicates++;
            report.errors.push({
              qrId: qr.id,
              type: qr.type,
              error: 'Duplicate raw data'
            });
          }
          seenRawData.add(rawData);
          
          // Vérifier la validité
          if (qr.isValid && typeof qr.isValid === 'function') {
            if (qr.isValid()) {
              report.valid++;
            } else {
              report.invalid++;
              report.errors.push({
                qrId: qr.id,
                type: qr.type,
                error: 'Invalid QR code'
              });
            }
          }
        } catch (error) {
          report.errors.push({
            qrId: qr.id,
            type: qr.type,
            error: `Check error: ${error.message}`
          });
        }
      }
      
      // Vérifier les orphelins (QR sans événement correspondant)
      // Cette vérification dépendrait d'un EventRepository
      
      report.integrityRate = report.total > 0 ? (report.valid / report.total) * 100 : 100;
      
      this.logger.info('Vérification intégrité QR terminée', {
        integrityRate: report.integrityRate.toFixed(2) + '%',
        valid: report.valid,
        invalid: report.invalid
      });
      
      return operation.success(report);
    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * @method checkEventQRCodeLimit
   * @description Vérifie la limite de QR codes par événement
   * @param {string} eventId - ID de l'événement
   * @throws {AppError} Si limite atteinte
   */
  async checkEventQRCodeLimit(eventId) {
    const count = await this.count({ eventId });
    if (count >= this.qrConfig.maxQRCodesPerEvent) {
      throw new AppError(
        `Limite QR par événement atteinte (${this.qrConfig.maxQRCodesPerEvent})`,
        400,
        'QR_LIMIT_REACHED'
      );
    }
  }

  /**
   * @method checkQRUniqueConstraints
   * @description Vérifie les contraintes d'unicité
   * @param {QRCode|TableQR} qr - QR code à vérifier
   * @throws {ConflictError} Si contrainte violée
   */
  async checkQRUniqueConstraints(qr) {
    // Vérifier unicité rawData
    if (qr.rawData) {
      const existing = await this.findOne({ rawData: qr.rawData });
      if (existing.found && existing.found.id !== qr.id) {
        throw new ConflictError('QR code avec ces données existe déjà');
      }
    }
    
    // Vérifier unicité invitation par invité/événement
    if (qr.type === QR_CODES.TYPES.INVITATION && qr.guestId && qr.eventId) {
      const existing = await this.findOne({ 
        type: QR_CODES.TYPES.INVITATION,
        guestId: qr.guestId,
        eventId: qr.eventId 
      });
      if (existing.found && existing.found.id !== qr.id) {
        throw new ConflictError('QR invitation existe déjà pour cet invité');
      }
    }
    
    // Vérifier unicité table par numéro/événement
    if (qr.type === QR_CODES.TYPES.TABLE_INFO && qr.tableNumber && qr.eventId) {
      const existing = await this.findOne({ 
        type: QR_CODES.TYPES.TABLE_INFO,
        tableNumber: qr.tableNumber,
        eventId: qr.eventId 
      });
      if (existing.found && existing.found.id !== qr.id) {
        throw new ConflictError('QR table existe déjà pour cette table');
      }
    }
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
   * @method sanitizeQRData
   * @description Nettoie les données QR pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeQRData(data) {
    const sanitized = { ...data };
    
    // Masquer les données sensibles
    if (sanitized.data) {
      if (typeof sanitized.data === 'object') {
        sanitized.data = '***ENCRYPTED_DATA***';
      } else {
        sanitized.data = sanitized.data.substring(0, 20) + '...';
      }
    }
    
    if (sanitized.rawData) {
      sanitized.rawData = sanitized.rawData.substring(0, 30) + '...';
    }
    
    if (sanitized.imageData) {
      sanitized.imageData = '***IMAGE_DATA***';
    }
    
    if (sanitized.signature) {
      sanitized.signature = '***SIGNATURE***';
    }
    
    return sanitized;
  }

  /**
   * @method sanitizeGuestInfo
   * @description Nettoie les infos invité pour les logs
   * @param {Object} guestInfo - Infos invité
   * @returns {Object} Infos nettoyées
   */
  sanitizeGuestInfo(guestInfo) {
    const sanitized = { ...guestInfo };
    
    if (sanitized.email) {
      const [local, domain] = sanitized.email.split('@');
      sanitized.email = `${local.substring(0, 2)}***@${domain}`;
    }
    
    if (sanitized.phone) {
      sanitized.phone = sanitized.phone.substring(0, 4) + '***';
    }
    
    return sanitized;
  }

  /**
   * @method sanitizeTableInfo
   * @description Nettoie les infos table pour les logs
   * @param {Object} tableInfo - Infos table
   * @returns {Object} Infos nettoyées
   */
  sanitizeTableInfo(tableInfo) {
    const sanitized = { ...tableInfo };
    
    if (sanitized.content) {
      sanitized.content = '***CONTENT***';
    }
    
    if (sanitized.guests) {
      sanitized.guests = '***GUESTS_LIST***';
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
    return ['rawData', 'id'];
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
      // Statistiques spécifiques QR
      const stats = await this.getEventQRStats('*').catch(() => ({
        total: 0,
        active: 0,
        expired: 0
      }));
      
      const expired = await this.findExpiredQR({ paginate: false }).catch(() => ({ data: [] }));
      
      return {
        ...baseHealth,
        qrSpecific: {
          totalQR: stats.total || 0,
          activeQR: stats.active || 0,
          expiredQR: expired.data.length || 0,
          totalScans: stats.totalScans || 0,
          tablesCount: stats.tables?.total || 0
        },
        limits: {
          maxPerEvent: this.qrConfig.maxQRCodesPerEvent,
          maxTables: this.qrConfig.maxTableQRCodes,
          bulkLimit: this.qrConfig.bulkGenerateLimit
        },
        status: baseHealth.status === 'healthy' ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        ...baseHealth,
        qrSpecific: { error: error.message },
        status: 'degraded'
      };
    }
  }

  /**
   * @method exportEventQRCodes
   * @description Exporte tous les QR codes d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options d'export
   * @returns {Promise<Object>} Données exportées
   */
  async exportEventQRCodes(eventId, options = {}) {
    const operation = log.trackOperation('QR_EXPORT_EVENT', { eventId, options });
    
    try {
      const qrs = await this.findByEvent(eventId, { paginate: false });
      
      const exportData = {
        eventId,
        exportedAt: now().toISOString(),
        total: qrs.data.length,
        byType: {},
        qrcodes: []
      };
      
      qrs.data.forEach(qr => {
        exportData.byType[qr.type] = (exportData.byType[qr.type] || 0) + 1;
        
        const qrExport = {
          id: qr.id,
          type: qr.type,
          guestId: qr.guestId,
          tableNumber: qr.tableNumber,
          active: qr.active,
          scanCount: qr.scanCount,
          maxScans: qr.maxScans,
          expiresAt: qr.expiresAt,
          isExpired: qr.isExpired,
          createdAt: qr.createdAt,
          updatedAt: qr.updatedAt
        };
        
        if (options.includeData && qr.data) {
          qrExport.data = qr.data;
        }
        
        if (options.includeRawData && qr.rawData) {
          qrExport.rawData = qr.rawData;
        }
        
        exportData.qrcodes.push(qrExport);
      });
      
      this.logger.info('Export QR codes événement', {
        eventId,
        total: exportData.total,
        byType: exportData.byType
      });
      
      return operation.success(exportData);
    } catch (error) {
      return operation.error(error, { eventId });
    }
  }
}

module.exports = QRRepository;