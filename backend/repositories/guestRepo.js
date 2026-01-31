/**
 * @file guestRepo.js
 * @description Repository ultra-complet pour la gestion des invités Secura.
 * Hérite de BaseRepository avec des fonctionnalités spécifiques aux invités.
 * Gère la création, modification, scans, confirmations et import/export CSV.
 * @module repositories/guestRepo
 * @requires ./baseRepo
 * @requires ../models/guestModel
 * @requires ../utils/validation/guestValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/helpers/emailHelper
 * @requires ../utils/helpers/stringHelper
 * @requires ../utils/helpers/csvHelper
 * @requires ../utils/logger
 */

const BaseRepository = require('./baseRepo');
const Guest = require('../models/guestModel');
const { 
  validateCreateGuest, 
  validateUpdateGuest,
  validateBulkGuests,
  validateGuestScan,
  validateGuestConfirmation
} = require('../utils/validation/guestValidation');
const { 
  AppError, 
  ValidationError, 
  NotFoundError 
} = require('../utils/errorHandler');
const { STATUS } = require('../utils/constants');
const { generateGuestId } = require('../utils/helpers/idGenerator');
const { 
  now, 
  formatDate,
  DATE_FORMATS
} = require('../utils/helpers/dateHelper');
const { 
  sendTemplateEmail,
  validateEmail 
} = require('../utils/helpers/emailHelper');
const { 
  sanitizeString,
  capitalizeWords,
  maskEmail
} = require('../utils/helpers/stringHelper');
const {
  parseCSV,
  generateCSV,
  exportToCSV,
  normalizeCSVData
} = require('../utils/helpers/csvHelper');
const log = require('../utils/logger');

/**
 * @class GuestRepository
 * @description Repository spécialisé pour la gestion des invités Secura
 * @extends BaseRepository
 */
class GuestRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('guests', {
      enableCache: true,
      cacheTTL: 180, // 3 minutes pour les invités
      enableAudit: true,
      softDelete: false, // Hard delete pour les invités
      validationRequired: true,
      maxRetries: 3,
      ...options
    });

    // Configuration spécifique aux invités
    this.guestConfig = {
      maxGuestsPerEvent: 10000,
      maxSeatsPerGuest: 100,
      bulkImportLimit: 1000,
      bulkDeleteLimit: 500,
      allowDuplicateEmails: false,
      requireEmailOrName: true,
      ...options.guestConfig
    };

    this.logger = log.withContext({
      repository: 'GuestRepository',
      collection: 'guests'
    });
  }

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée un nouvel invité avec validation complète
   * @param {Object} guestData - Données de l'invité
   * @param {Object} options - Options de création
   * @returns {Promise<Guest>} Invité créé
   */
  async create(guestData, options = {}) {
    const operation = log.trackOperation('GUEST_CREATE', {
      data: this.sanitizeGuestData(guestData),
      options
    });

    try {
      // Validation des données
      const validation = validateCreateGuest(guestData);
      if (validation.error) {
        throw new ValidationError('Données invité invalides', validation.error.details);
      }

      // Vérifier la limite d'invités par événement
      if (guestData.eventId) {
        await this.checkEventGuestLimit(guestData.eventId);
      }

      // Vérifier l'unicité de l'email dans l'événement
      if (guestData.email && !this.guestConfig.allowDuplicateEmails) {
        await this.checkEmailUniquenessInEvent(guestData.eventId, guestData.email);
      }

      // Créer l'instance Guest
      const guest = new Guest(guestData);

      // Validation du modèle
      const modelValidation = guest.validate();
      if (modelValidation.error) {
        throw new ValidationError('Modèle invité invalide', modelValidation.error.details);
      }

      // Sauvegarder via BaseRepository
      const result = await super.create(guest, options);

      // Audit et logs
      this.logger.crud('CREATE', 'guests', {
        guestId: guest.id,
        guestName: guest.getFullName(),
        eventId: guest.eventId
      });

      // Envoyer invitation si demandé
      if (options.sendInvitation && guest.email) {
        await this.sendGuestInvitation(guest.id);
      }

      return operation.success({ guest: result });

    } catch (error) {
      return operation.error(error, { 
        data: this.sanitizeGuestData(guestData) 
      });
    }
  }

  /**
   * @method updateGuest
   * @description Met à jour un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} updates - Données de mise à jour
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Guest>} Invité mis à jour
   */
  async updateGuest(guestId, updates, options = {}) {
    const operation = log.trackOperation('GUEST_UPDATE', {
      guestId,
      updates: this.sanitizeGuestData(updates),
      options
    });

    try {
      // Récupérer l'invité existant
      const existingGuest = await this.findById(guestId, { throwIfNotFound: true });
      
      // Validation des mises à jour
      const validation = validateUpdateGuest(updates);
      if (validation.error) {
        throw new ValidationError('Mises à jour invalides', validation.error.details);
      }

      // Vérifier l'unicité de l'email si modifié
      if (updates.email && updates.email !== existingGuest.email) {
        await this.checkEmailUniquenessInEvent(existingGuest.eventId, updates.email, guestId);
      }

      // Appliquer les mises à jour via le modèle
      existingGuest.updateInfo(updates);

      // Sauvegarder les modifications
      const result = await super.update(guestId, existingGuest, options);

      this.logger.crud('UPDATE', 'guests', {
        guestId,
        updatedFields: Object.keys(updates)
      });

      return operation.success({ guest: result });

    } catch (error) {
      return operation.error(error, { 
        guestId, 
        updates: this.sanitizeGuestData(updates) 
      });
    }
  }

  /**
   * @method deleteGuest
   * @description Supprime un invité avec nettoyage des dépendances
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options de suppression
   * @returns {Promise<Object>} Résultat de suppression
   */
  async deleteGuest(guestId, options = {}) {
    const operation = log.trackOperation('GUEST_DELETE', {
      guestId,
      options
    });

    try {
      const guest = await this.findById(guestId, { throwIfNotFound: true });

      // Nettoyer les dépendances (QR codes et scans)
      if (options.cleanupDependencies !== false) {
        await this.cleanupGuestDependencies(guestId);
      }

      const result = await super.delete(guestId, options);

      this.logger.crud('DELETE', 'guests', {
        guestId,
        guestName: guest.getFullName(),
        eventId: guest.eventId
      });

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { guestId });
    }
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method findByEvent
   * @description Trouve les invités d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invités trouvés avec pagination
   */
  async findByEvent(eventId, options = {}) {
    const operation = log.trackOperation('GUEST_FIND_BY_EVENT', {
      eventId,
      options
    });

    try {
      const result = await this.findAll({ eventId }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method findByStatus
   * @description Trouve les invités par statut
   * @param {string} eventId - ID de l'événement
   * @param {string} status - Statut recherché
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invités trouvés
   */
  async findByStatus(eventId, status, options = {}) {
    const operation = log.trackOperation('GUEST_FIND_BY_STATUS', {
      eventId,
      status,
      options
    });

    try {
      const result = await this.findAll({ 
        eventId, 
        status 
      }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { eventId, status });
    }
  }

  /**
   * @method findConfirmedGuests
   * @description Trouve les invités confirmés d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invités confirmés
   */
  async findConfirmedGuests(eventId, options = {}) {
    return this.findByStatus(eventId, STATUS.CONFIRMED, options);
  }

  /**
   * @method findScannedGuests
   * @description Trouve les invités scannés d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invités scannés
   */
  async findScannedGuests(eventId, options = {}) {
    const operation = log.trackOperation('GUEST_FIND_SCANNED', {
      eventId,
      options
    });

    try {
      const result = await this.findAll({ 
        eventId, 
        scanned: true 
      }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method findUnscannedGuests
   * @description Trouve les invités non scannés d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invités non scannés
   */
  async findUnscannedGuests(eventId, options = {}) {
    const operation = log.trackOperation('GUEST_FIND_UNSCANNED', {
      eventId,
      options
    });

    try {
      const result = await this.findAll({ 
        eventId, 
        scanned: false 
      }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method searchGuests
   * @description Recherche avancée d'invités
   * @param {Object} criteria - Critères de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Résultats de recherche
   */
  async searchGuests(criteria = {}, options = {}) {
    const operation = log.trackOperation('GUEST_SEARCH', {
      criteria: this.sanitizeSearchCriteria(criteria),
      options
    });

    try {
      const {
        query,
        eventId,
        status,
        scanned,
        confirmed,
        category,
        tableNumber,
        ...otherFilters
      } = criteria;

      // Construire les filtres
      const filters = { ...otherFilters };

      // Filtre par événement (requis)
      if (eventId) {
        filters.eventId = eventId;
      }

      // Filtre par statut
      if (status) {
        filters.status = status;
      }

      // Filtre par scan
      if (scanned !== undefined) {
        filters.scanned = Boolean(scanned);
      }

      // Filtre par confirmation
      if (confirmed !== undefined) {
        filters['metadata.confirmed'] = Boolean(confirmed);
      }

      // Filtre par catégorie
      if (category) {
        filters['metadata.category'] = category;
      }

      // Filtre par table
      if (tableNumber) {
        filters['metadata.tableNumber'] = tableNumber;
      }

      // Recherche textuelle
      if (query) {
        const searchFilters = {
          $or: [
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { phone: { $regex: query, $options: 'i' } },
            { company: { $regex: query, $options: 'i' } }
          ]
        };
        Object.assign(filters, searchFilters);
      }

      const result = await this.findAll(filters, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { 
        criteria: this.sanitizeSearchCriteria(criteria) 
      });
    }
  }

  /**
   * @method findByEmail
   * @description Trouve un invité par email dans un événement
   * @param {string} eventId - ID de l'événement
   * @param {string} email - Email de l'invité
   * @param {Object} options - Options de recherche
   * @returns {Promise<Guest|null>} Invité trouvé ou null
   */
  async findByEmail(eventId, email, options = {}) {
    const operation = log.trackOperation('GUEST_FIND_BY_EMAIL', {
      eventId,
      email: maskEmail(email),
      options
    });

    try {
      const result = await this.findOne({ 
        eventId, 
        email: email.toLowerCase() 
      }, options);
      
      return operation.success(result ? { guest: result } : { guest: null });

    } catch (error) {
      return operation.error(error, { eventId, email: maskEmail(email) });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES SCANS
  // ============================================================================

  /**
   * @method scanGuest
   * @description Enregistre le scan d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} scanData - Données du scan
   * @param {Object} options - Options de scan
   * @returns {Promise<Guest>} Invité scanné
   */
  async scanGuest(guestId, scanData, options = {}) {
    const operation = log.trackOperation('GUEST_SCAN', {
      guestId,
      scanData: this.sanitizeScanData(scanData),
      options
    });

    try {
      // Validation des données de scan
      const validation = validateGuestScan({ guestId, ...scanData });
      if (validation.error) {
        throw new ValidationError('Données de scan invalides', validation.error.details);
      }

      const guest = await this.findById(guestId, { throwIfNotFound: true });

      // Vérifier si l'invité peut être scanné
      if (!guest.canBeScanned()) {
        throw new AppError(
          'Invité ne peut pas être scanné (non confirmé ou déjà scanné)',
          400,
          'GUEST_CANNOT_BE_SCANNED'
        );
      }

      // Marquer comme scanné via le modèle
      guest.markAsScanned(scanData);

      // Sauvegarder
      const result = await super.update(guestId, guest, {
        ...options,
        reason: 'scan'
      });

      // Enregistrer le scan dans ScanRepository
      if (options.createScanRecord !== false) {
        const { scanRepo } = require('./index');
        await scanRepo.create({
          guestId: guest.id,
          eventId: guest.eventId,
          scannerId: scanData.scannerId,
          scannerName: scanData.scannerName,
          location: scanData.location,
          scanType: 'entry',
          success: true
        });
      }

      this.logger.scan(guest.getFullName(), scanData.location, {
        guestId,
        eventId: guest.eventId,
        scannerId: scanData.scannerId
      });

      return operation.success({ guest: result });

    } catch (error) {
      return operation.error(error, { 
        guestId, 
        scanData: this.sanitizeScanData(scanData) 
      });
    }
  }

  /**
   * @method unscanGuest
   * @description Annule le scan d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options d'annulation
   * @returns {Promise<Guest>} Invité avec scan annulé
   */
  async unscanGuest(guestId, options = {}) {
    const operation = log.trackOperation('GUEST_UNSCAN', {
      guestId,
      options
    });

    try {
      const guest = await this.findById(guestId, { throwIfNotFound: true });

      if (!guest.scanned) {
        throw new AppError('Invité non scanné', 400, 'GUEST_NOT_SCANNED');
      }

      // Marquer comme non scanné
      guest.markAsUnscanned();

      // Sauvegarder
      const result = await super.update(guestId, guest, {
        ...options,
        reason: 'unscan'
      });

      this.logger.warning(`Scan annulé pour ${guest.getFullName()}`, {
        guestId,
        eventId: guest.eventId
      });

      return operation.success({ guest: result });

    } catch (error) {
      return operation.error(error, { guestId });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES CONFIRMATIONS
  // ============================================================================

  /**
   * @method confirmGuest
   * @description Confirme la présence d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} confirmationData - Données de confirmation
   * @param {Object} options - Options de confirmation
   * @returns {Promise<Guest>} Invité confirmé
   */
  async confirmGuest(guestId, confirmationData = {}, options = {}) {
    const operation = log.trackOperation('GUEST_CONFIRM', {
      guestId,
      confirmationData,
      options
    });

    try {
      // Validation des données de confirmation
      const validation = validateGuestConfirmation({ guestId, ...confirmationData });
      if (validation.error) {
        throw new ValidationError('Données de confirmation invalides', validation.error.details);
      }

      const guest = await this.findById(guestId, { throwIfNotFound: true });

      // Confirmer via le modèle
      guest.confirm(confirmationData);

      // Sauvegarder
      const result = await super.update(guestId, guest, {
        ...options,
        reason: 'confirmation'
      });

      this.logger.info(`Invité confirmé: ${guest.getFullName()}`, {
        guestId,
        eventId: guest.eventId,
        method: confirmationData.method
      });

      // Envoyer email de confirmation si demandé
      if (options.sendConfirmationEmail && guest.email) {
        await this.sendGuestConfirmation(guestId);
      }

      return operation.success({ guest: result });

    } catch (error) {
      return operation.error(error, { guestId, confirmationData });
    }
  }

  /**
   * @method cancelGuest
   * @description Annule la présence d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options d'annulation
   * @returns {Promise<Guest>} Invité annulé
   */
  async cancelGuest(guestId, options = {}) {
    const operation = log.trackOperation('GUEST_CANCEL', {
      guestId,
      options
    });

    try {
      const guest = await this.findById(guestId, { throwIfNotFound: true });

      // Annuler via le modèle
      guest.cancel();

      // Sauvegarder
      const result = await super.update(guestId, guest, {
        ...options,
        reason: 'cancellation'
      });

      this.logger.warning(`Invité annulé: ${guest.getFullName()}`, {
        guestId,
        eventId: guest.eventId
      });

      return operation.success({ guest: result });

    } catch (error) {
      return operation.error(error, { guestId });
    }
  }

  /**
   * @method bulkConfirm
   * @description Confirme plusieurs invités en masse
   * @param {string[]} guestIds - IDs des invités
   * @param {Object} confirmationData - Données de confirmation
   * @param {Object} options - Options de confirmation
   * @returns {Promise<Object>} Résultat de la confirmation
   */
  async bulkConfirm(guestIds, confirmationData = {}, options = {}) {
    const operation = log.trackOperation('GUEST_BULK_CONFIRM', {
      guestIds,
      confirmationData,
      options
    });

    try {
      const results = {
        confirmed: 0,
        failed: 0,
        errors: []
      };

      for (const guestId of guestIds) {
        try {
          await this.confirmGuest(guestId, confirmationData, {
            ...options,
            sendConfirmationEmail: false // On enverra en masse après
          });
          results.confirmed++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            guestId,
            error: error.message
          });
        }
      }

      this.logger.info(`Confirmation en masse terminée`, {
        confirmed: results.confirmed,
        failed: results.failed
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { guestIds });
    }
  }

  // ============================================================================
  // MÉTHODES D'IMPORT/EXPORT CSV
  // ============================================================================

  /**
   * @method bulkCreate
   * @description Crée plusieurs invités en masse (import CSV)
   * @param {Object[]} guestsData - Tableau d'invités
   * @param {Object} options - Options de création
   * @returns {Promise<Object>} Résultat de l'import
   */
  async bulkCreate(guestsData, options = {}) {
    const operation = log.trackOperation('GUEST_BULK_CREATE', {
      count: guestsData.length,
      options
    });

    try {
      // Validation du bulk
      const validation = validateBulkGuests(guestsData);
      if (validation.error) {
        throw new ValidationError('Données bulk invalides', validation.error.details);
      }

      // Limiter le nombre d'imports
      if (guestsData.length > this.guestConfig.bulkImportLimit) {
        throw new ValidationError(
          `Import limité à ${this.guestConfig.bulkImportLimit} invités. ` +
          `Fichier contient ${guestsData.length} lignes.`
        );
      }

      const results = {
        created: 0,
        failed: 0,
        errors: [],
        guests: []
      };

      // Créer chaque invité
      for (let i = 0; i < guestsData.length; i++) {
        const rawGuest = guestsData[i];
        
        try {
          // Normaliser les données
          const guestData = this.normalizeImportData(rawGuest);

          // Vérifier les doublons dans le batch
          const duplicateInBatch = results.guests.find(g =>
            g.eventId === guestData.eventId &&
            ((guestData.email && g.email === guestData.email) ||
             (!guestData.email && 
              g.firstName === guestData.firstName && 
              g.lastName === guestData.lastName))
          );

          if (duplicateInBatch) {
            results.failed++;
            results.errors.push({
              index: i,
              guest: guestData,
              error: 'Doublon dans ce batch'
            });
            continue;
          }

          // Créer l'invité
          const createResult = await this.create(guestData, {
            ...options,
            sendInvitation: false // On enverra en masse après
          });

          results.created++;
          results.guests.push(createResult.guest || createResult);

        } catch (error) {
          results.failed++;
          results.errors.push({
            index: i,
            guest: rawGuest,
            error: error.message
          });
        }
      }

      // Nettoyer les anciennes références si demandé
      if (options.cleanupOldReferences) {
        await this.cleanupOrphanedReferences(guestsData);
      }

      this.logger.info(`Import bulk terminé: ${results.created} créés, ${results.failed} échecs`, {
        created: results.created,
        failed: results.failed
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { count: guestsData.length });
    }
  }

  /**
   * @method exportGuestsToCSV
   * @description Exporte les invités en CSV
   * @param {Object} filters - Filtres optionnels
   * @param {string} filePath - Chemin du fichier de sortie
   * @returns {Promise<Object>} Résultat de l'export
   */
  async exportGuestsToCSV(filters = {}, filePath) {
    const operation = log.trackOperation('GUEST_EXPORT_CSV', {
      filters,
      filePath
    });

    try {
      const guests = await this.findAll(filters, { paginate: false });

      // Formatter les données pour CSV
      const csvData = guests.data.map(guest => ({
        ID: guest.id,
        Prénom: guest.firstName,
        Nom: guest.lastName,
        Email: guest.email || '',
        Téléphone: guest.phone || '',
        Entreprise: guest.company || '',
        Places: guest.seats,
        Statut: guest.status,
        Scanné: guest.scanned ? 'Oui' : 'Non',
        'Date Scan': guest.scannedAt ? formatDate(guest.scannedAt, DATE_FORMATS.FRENCH_DATETIME) : '',
        Table: guest.metadata.tableNumber || '',
        Catégorie: guest.metadata.category || '',
        Notes: guest.notes || '',
        'Créé le': formatDate(guest.createdAt, DATE_FORMATS.FRENCH_DATE)
      }));

      // Exporter vers fichier
      await exportToCSV(csvData, filePath);

      this.logger.info(`${csvData.length} invités exportés vers ${filePath}`);

      return operation.success({ 
        exported: csvData.length,
        filePath
      });

    } catch (error) {
      return operation.error(error, { filters, filePath });
    }
  }

  /**
   * @method importGuestsFromCSV
   * @description Importe des invités depuis un CSV
   * @param {string} filePath - Chemin du fichier CSV
   * @param {string} eventId - ID de l'événement cible
   * @param {Object} options - Options d'import
   * @returns {Promise<Object>} Résultat de l'import
   */
  async importGuestsFromCSV(filePath, eventId, options = {}) {
    const operation = log.trackOperation('GUEST_IMPORT_CSV', {
      filePath,
      eventId,
      options
    });

    try {
      // Parser le CSV
      const parsed = await parseCSV(filePath);

      if (parsed.errors.length > 0) {
        throw new ValidationError('Erreurs de parsing CSV', parsed.errors);
      }

      // Normaliser les données
      const normalized = normalizeCSVData(parsed.data);

      // Ajouter l'eventId à chaque invité
      const guestsData = normalized.map(row => ({
        ...this.normalizeImportData(row),
        eventId
      }));

      // Créer en masse
      const result = await this.bulkCreate(guestsData, options);

      this.logger.info(`Import CSV terminé depuis ${filePath}`, {
        created: result.results.created,
        failed: result.results.failed
      });

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { filePath, eventId });
    }
  }

  // ============================================================================
  // MÉTHODES DE SUPPRESSION EN MASSE
  // ============================================================================

  /**
   * @method bulkDelete
   * @description Supprime plusieurs invités en masse
   * @param {string[]} guestIds - IDs des invités
   * @param {Object} options - Options de suppression
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async bulkDelete(guestIds, options = {}) {
    const operation = log.trackOperation('GUEST_BULK_DELETE', {
      guestIds,
      count: guestIds.length,
      options
    });

    try {
      // Limiter le nombre de suppressions
      if (guestIds.length > this.guestConfig.bulkDeleteLimit) {
        throw new ValidationError(
          `Suppression limitée à ${this.guestConfig.bulkDeleteLimit} invités. ` +
          `Demande: ${guestIds.length}.`
        );
      }

      const results = {
        deleted: 0,
        failed: 0,
        errors: []
      };

      // Supprimer chaque invité
      for (const guestId of guestIds) {
        try {
          await this.deleteGuest(guestId, options);
          results.deleted++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            guestId,
            error: error.message
          });
        }
      }

      this.logger.warning(`Suppression en masse terminée`, {
        deleted: results.deleted,
        failed: results.failed
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { guestIds, count: guestIds.length });
    }
  }

  /**
   * @method deleteAllByEvent
   * @description Supprime tous les invités d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de suppression
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deleteAllByEvent(eventId, options = {}) {
    const operation = log.trackOperation('GUEST_DELETE_ALL_BY_EVENT', {
      eventId,
      options
    });

    try {
      // Confirmation requise pour cette opération dangereuse
      if (!options.confirm) {
        throw new AppError(
          'Confirmation requise pour supprimer tous les invités. Utilisez { confirm: true }',
          400,
          'CONFIRMATION_REQUIRED'
        );
      }

      // Récupérer tous les invités de l'événement
      const guests = await this.findByEvent(eventId, { paginate: false });
      const guestIds = guests.data.map(g => g.id);

      // Supprimer en masse
      const result = await this.bulkDelete(guestIds, options);

      this.logger.warning(`Tous les invités de l'événement ${eventId} supprimés`, {
        deleted: result.results.deleted
      });

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES TABLES
  // ============================================================================

  /**
   * @method assignToTable
   * @description Assigne un invité à une table
   * @param {string} guestId - ID de l'invité
   * @param {string|number} tableNumber - Numéro de table
   * @param {Object} options - Options d'assignation
   * @returns {Promise<Guest>} Invité mis à jour
   */
  async assignToTable(guestId, tableNumber, options = {}) {
    const operation = log.trackOperation('GUEST_ASSIGN_TABLE', {
      guestId,
      tableNumber,
      options
    });

    try {
      const guest = await this.findById(guestId, { throwIfNotFound: true });

      // Assigner la table via le modèle
      guest.assignToTable(tableNumber);

      // Sauvegarder
      const result = await super.update(guestId, guest, {
        ...options,
        reason: 'table_assignment'
      });

      this.logger.info(`Invité ${guest.getFullName()} assigné à la table ${tableNumber}`, {
        guestId,
        tableNumber
      });

      return operation.success({ guest: result });

    } catch (error) {
      return operation.error(error, { guestId, tableNumber });
    }
  }

  /**
   * @method bulkAssignTables
   * @description Assigne plusieurs invités à des tables
   * @param {Object[]} assignments - Tableau d'assignations { guestId, tableNumber }
   * @param {Object} options - Options d'assignation
   * @returns {Promise<Object>} Résultat de l'assignation
   */
  async bulkAssignTables(assignments, options = {}) {
    const operation = log.trackOperation('GUEST_BULK_ASSIGN_TABLES', {
      assignments,
      count: assignments.length,
      options
    });

    try {
      const results = {
        assigned: 0,
        failed: 0,
        errors: []
      };

      for (const { guestId, tableNumber } of assignments) {
        try {
          await this.assignToTable(guestId, tableNumber, options);
          results.assigned++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            guestId,
            tableNumber,
            error: error.message
          });
        }
      }

      this.logger.info(`Assignation tables en masse terminée`, {
        assigned: results.assigned,
        failed: results.failed
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { assignments, count: assignments.length });
    }
  }

  /**
   * @method findByTable
   * @description Trouve les invités d'une table
   * @param {string} eventId - ID de l'événement
   * @param {string|number} tableNumber - Numéro de table
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invités de la table
   */
  async findByTable(eventId, tableNumber, options = {}) {
    const operation = log.trackOperation('GUEST_FIND_BY_TABLE', {
      eventId,
      tableNumber,
      options
    });

    try {
      const result = await this.findAll({ 
        eventId, 
        'metadata.tableNumber': tableNumber 
      }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { eventId, tableNumber });
    }
  }

  // ============================================================================
  // MÉTHODES DE STATISTIQUES
  // ============================================================================

  /**
   * @method getGuestStats
   * @description Récupère les statistiques des invités d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Statistiques complètes
   */
  async getGuestStats(eventId) {
    const operation = log.trackOperation('GUEST_GET_STATS', { eventId });

    try {
      const allGuests = await this.findByEvent(eventId, { paginate: false });
      const guests = allGuests.data || [];

      const stats = {
        total: guests.length,
        byStatus: {},
        scans: {
          scanned: 0,
          unscanned: 0,
          scanRate: 0
        },
        confirmations: {
          confirmed: 0,
          pending: 0,
          cancelled: 0,
          confirmationRate: 0
        },
        seats: {
          total: 0,
          confirmed: 0
        },
        categories: {},
        tables: {},
        recentActivity: []
      };

      guests.forEach(guest => {
        // Par statut
        stats.byStatus[guest.status] = (stats.byStatus[guest.status] || 0) + 1;

        // Scans
        if (guest.scanned) {
          stats.scans.scanned++;
        } else {
          stats.scans.unscanned++;
        }

        // Confirmations
        if (guest.isConfirmed()) {
          stats.confirmations.confirmed++;
          stats.seats.confirmed += guest.seats;
        } else if (guest.status === STATUS.CANCELLED) {
          stats.confirmations.cancelled++;
        } else {
          stats.confirmations.pending++;
        }

        // Places
        stats.seats.total += guest.seats;

        // Catégories
        const category = guest.metadata.category || 'standard';
        stats.categories[category] = (stats.categories[category] || 0) + 1;

        // Tables
        if (guest.metadata.tableNumber) {
          stats.tables[guest.metadata.tableNumber] = 
            (stats.tables[guest.metadata.tableNumber] || 0) + 1;
        }
      });

      // Calculer les taux
      if (stats.total > 0) {
        stats.scans.scanRate = Math.round((stats.scans.scanned / stats.total) * 100);
        stats.confirmations.confirmationRate = 
          Math.round((stats.confirmations.confirmed / stats.total) * 100);
      }

      // Activité récente (10 derniers scans)
      const recentScans = guests
        .filter(g => g.scannedAt)
        .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))
        .slice(0, 10)
        .map(g => ({
          guestId: g.id,
          guestName: g.getFullName(),
          scannedAt: g.scannedAt,
          tableNumber: g.metadata.tableNumber
        }));

      stats.recentActivity = recentScans;

      return operation.success({ stats });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  // ============================================================================
  // MÉTHODES DE NOTIFICATION
  // ============================================================================

  /**
   * @method sendGuestInvitation
   * @description Envoie une invitation à un invité
   * @param {string} guestId - ID de l'invité
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendGuestInvitation(guestId) {
    const operation = log.trackOperation('GUEST_SEND_INVITATION', { guestId });

    try {
      const guest = await this.findById(guestId, { throwIfNotFound: true });

      if (!guest.email || !validateEmail(guest.email)) {
        throw new ValidationError('Email invité invalide ou manquant');
      }

      // Récupérer l'événement
      const { eventRepo } = require('./index');
      const event = await eventRepo.findById(guest.eventId, { throwIfNotFound: true });

      // Récupérer le QR code si disponible
      let qrCodeData = null;
      if (guest.qrCodeId) {
        const { qrCodeRepo } = require('./index');
        const qrCode = await qrCodeRepo.findById(guest.qrCodeId);
        if (qrCode && qrCode.imageData) {
          qrCodeData = qrCode.imageData;
        }
      }

      // Envoyer l'email
      await sendTemplateEmail({
        to: guest.email,
        subject: `Invitation - ${event.name}`,
        template: 'invitation',
        data: {
          guestName: guest.getFullName(),
          eventName: event.name,
          eventDate: formatDate(event.date, DATE_FORMATS.LONG_DATE),
          eventTime: event.time,
          eventLocation: event.location,
          seats: guest.seats,
          tableNumber: guest.metadata.tableNumber,
          qrCodeData
        }
      });

      // Marquer l'invitation comme envoyée
      guest.metadata.invitationSent = true;
      await super.update(guestId, guest, { reason: 'invitation_sent' });

      this.logger.info(`Invitation envoyée à ${maskEmail(guest.email)}`, {
        guestId,
        eventId: guest.eventId
      });

      return operation.success({ sent: true });

    } catch (error) {
      return operation.error(error, { guestId });
    }
  }

  /**
   * @method sendGuestConfirmation
   * @description Envoie un email de confirmation à un invité
   * @param {string} guestId - ID de l'invité
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendGuestConfirmation(guestId) {
    const operation = log.trackOperation('GUEST_SEND_CONFIRMATION', { guestId });

    try {
      const guest = await this.findById(guestId, { throwIfNotFound: true });

      if (!guest.email || !validateEmail(guest.email)) {
        throw new ValidationError('Email invité invalide ou manquant');
      }

      // Récupérer l'événement
      const { eventRepo } = require('./index');
      const event = await eventRepo.findById(guest.eventId, { throwIfNotFound: true });

      // Envoyer l'email
      await sendTemplateEmail({
        to: guest.email,
        subject: `Confirmation - ${event.name}`,
        template: 'confirmation',
        data: {
          guestName: guest.getFullName(),
          eventName: event.name,
          eventDate: formatDate(event.date, DATE_FORMATS.LONG_DATE),
          eventTime: event.time,
          eventLocation: event.location,
          seats: guest.seats,
          tableNumber: guest.metadata.tableNumber
        }
      });

      this.logger.info(`Confirmation envoyée à ${maskEmail(guest.email)}`, {
        guestId,
        eventId: guest.eventId
      });

      return operation.success({ sent: true });

    } catch (error) {
      return operation.error(error, { guestId });
    }
  }

  /**
   * @method bulkSendInvitations
   * @description Envoie des invitations en masse
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options d'envoi
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async bulkSendInvitations(eventId, options = {}) {
    const operation = log.trackOperation('GUEST_BULK_SEND_INVITATIONS', {
      eventId,
      options
    });

    try {
      // Récupérer les invités avec email
      const guests = await this.findByEvent(eventId, { paginate: false });
      const guestsWithEmail = guests.data.filter(g => 
        g.email && 
        validateEmail(g.email) &&
        !g.metadata.invitationSent
      );

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      // Envoyer les invitations
      for (const guest of guestsWithEmail) {
        try {
          await this.sendGuestInvitation(guest.id);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            guestId: guest.id,
            email: guest.email,
            error: error.message
          });
        }
      }

      this.logger.info(`Invitations en masse terminées pour événement ${eventId}`, {
        sent: results.sent,
        failed: results.failed
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES ET HELPERS
  // ============================================================================

  /**
   * @method checkEventGuestLimit
   * @description Vérifie si l'événement a atteint sa limite d'invités
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<void>}
   * @throws {AppError} Si limite atteinte
   */
  async checkEventGuestLimit(eventId) {
    const eventGuests = await this.findByEvent(eventId, { paginate: false });
    
    if (eventGuests.data.length >= this.guestConfig.maxGuestsPerEvent) {
      throw new AppError(
        `Limite d'invités atteinte pour cet événement (${this.guestConfig.maxGuestsPerEvent})`,
        400,
        'GUEST_LIMIT_REACHED'
      );
    }
  }

  /**
   * @method checkEmailUniquenessInEvent
   * @description Vérifie l'unicité de l'email dans un événement
   * @param {string} eventId - ID de l'événement
   * @param {string} email - Email à vérifier
   * @param {string} [excludeGuestId] - ID invité à exclure (pour updates)
   * @returns {Promise<void>}
   * @throws {ValidationError} Si email existe déjà
   */
  async checkEmailUniquenessInEvent(eventId, email, excludeGuestId = null) {
    if (!email) return;

    const existingGuest = await this.findByEmail(eventId, email);
    
    if (existingGuest.guest && existingGuest.guest.id !== excludeGuestId) {
      throw new ValidationError(
        `Email ${email} déjà utilisé par un autre invité dans cet événement`,
        [{ field: 'email', value: email, type: 'unique' }]
      );
    }
  }

  /**
   * @method cleanupGuestDependencies
   * @description Nettoie les dépendances d'un invité (QR codes, scans)
   * @param {string} guestId - ID de l'invité
   * @returns {Promise<void>}
   */
  async cleanupGuestDependencies(guestId) {
    try {
      const { qrCodeRepo, scanRepo } = require('./index');

      // Supprimer les QR codes
      const qrCodes = await qrCodeRepo.findAll({ guestId }, { paginate: false });
      for (const qrCode of qrCodes.data) {
        await qrCodeRepo.delete(qrCode.id);
      }

      // Supprimer les scans
      const scans = await scanRepo.findAll({ guestId }, { paginate: false });
      for (const scan of scans.data) {
        await scanRepo.delete(scan.id);
      }

      this.logger.debug(`Dépendances nettoyées pour invité ${guestId}`, {
        qrCodes: qrCodes.data.length,
        scans: scans.data.length
      });

    } catch (error) {
      this.logger.warning(`Erreur nettoyage dépendances invité ${guestId}`, {
        error: error.message
      });
    }
  }

  /**
   * @method cleanupOrphanedReferences
   * @description Nettoie les références orphelines après import CSV
   * @param {Object[]} importedGuests - Invités importés
   * @returns {Promise<void>}
   */
  async cleanupOrphanedReferences(importedGuests) {
    try {
      const oldIds = importedGuests
        .map(g => g.id)
        .filter(Boolean);

      if (oldIds.length === 0) return;

      const { qrCodeRepo, scanRepo } = require('./index');

      // Nettoyer les QR codes orphelins
      const qrCodes = await qrCodeRepo.findAll({
        guestId: { $in: oldIds }
      }, { paginate: false });

      for (const qrCode of qrCodes.data) {
        await qrCodeRepo.delete(qrCode.id);
      }

      // Nettoyer les scans orphelins
      const scans = await scanRepo.findAll({
        guestId: { $in: oldIds }
      }, { paginate: false });

      for (const scan of scans.data) {
        await scanRepo.delete(scan.id);
      }

      this.logger.info(`Références orphelines nettoyées`, {
        oldIds: oldIds.length,
        qrCodesRemoved: qrCodes.data.length,
        scansRemoved: scans.data.length
      });

    } catch (error) {
      this.logger.warning('Erreur nettoyage références orphelines', {
        error: error.message
      });
    }
  }

  /**
   * @method normalizeImportData
   * @description Normalise les données d'import CSV
   * @param {Object} rawData - Données brutes du CSV
   * @returns {Object} Données normalisées
   */
  normalizeImportData(rawData) {
    return {
      firstName: (rawData.firstName || rawData.prenom || rawData.Prénom || '').trim(),
      lastName: (rawData.lastName || rawData.nom || rawData.Nom || '').trim(),
      email: (rawData.email || rawData.Email || '').trim().toLowerCase() || undefined,
      phone: (rawData.phone || rawData.telephone || rawData.Téléphone || '').trim() || undefined,
      company: (rawData.company || rawData.entreprise || rawData.Entreprise || '').trim() || '',
      notes: (rawData.notes || rawData.Notes || '').trim() || '',
      seats: parseInt(rawData.seats || rawData.places || rawData.Places) || 1,
      eventId: rawData.eventId || rawData.event || undefined,
      status: rawData.status || rawData.statut || STATUS.PENDING,
      metadata: {
        category: rawData.category || rawData.catégorie || 'standard',
        tableNumber: rawData.tableNumber || rawData.table || null,
        specialRequirements: rawData.specialRequirements || rawData.besoins || ''
      }
    };
  }

  /**
   * @method sanitizeGuestData
   * @description Nettoie les données d'invité pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeGuestData(data) {
    const sanitized = { ...data };
    
    if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
    if (sanitized.phone) sanitized.phone = '***';
    if (sanitized.notes && sanitized.notes.length > 50) {
      sanitized.notes = sanitized.notes.substring(0, 50) + '...';
    }
    
    return sanitized;
  }

  /**
   * @method sanitizeSearchCriteria
   * @description Nettoie les critères de recherche pour les logs
   * @param {Object} criteria - Critères à nettoyer
   * @returns {Object} Critères nettoyés
   */
  sanitizeSearchCriteria(criteria) {
    const sanitized = { ...criteria };
    
    if (sanitized.query) sanitized.query = sanitizeString(sanitized.query);
    if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
    
    return sanitized;
  }

  /**
   * @method sanitizeScanData
   * @description Nettoie les données de scan pour les logs
   * @param {Object} data - Données de scan
   * @returns {Object} Données nettoyées
   */
  sanitizeScanData(data) {
    const sanitized = { ...data };
    
    if (sanitized.scannerId) sanitized.scannerId = '***';
    
    return sanitized;
  }

  /**
   * @method getUniqueFields
   * @description Retourne les champs avec contrainte d'unicité
   * @returns {string[]} Liste des champs uniques
   */
  getUniqueFields() {
    // Email unique par événement (géré manuellement)
    return [];
  }

  /**
   * @method validate
   * @description Valide les données d'un invité
   * @param {Object} guestData - Données à valider
   * @returns {Object} Résultat de validation
   */
  validate(guestData) {
    return validateCreateGuest(guestData);
  }

  /**
   * @method validateUpdate
   * @description Valide les mises à jour d'un invité
   * @param {Object} updates - Mises à jour à valider
   * @returns {Object} Résultat de validation
   */
  validateUpdate(updates) {
    return validateUpdateGuest(updates);
  }

  /**
   * @method prepareDocument
   * @description Prépare un document invité avant sauvegarde
   * @param {Object} data - Données du document
   * @param {string} operation - Type d'opération (create/update)
   * @returns {Object} Document préparé
   */
  prepareDocument(data, operation = 'create') {
    const document = super.prepareDocument(data, operation);

    // Normaliser les noms
    if (document.firstName) {
      document.firstName = capitalizeWords(document.firstName.trim());
    }
    if (document.lastName) {
      document.lastName = capitalizeWords(document.lastName.trim());
    }

    // Normaliser l'email
    if (document.email) {
      document.email = document.email.toLowerCase().trim();
    }

    return document;
  }

  // ============================================================================
  // MÉTHODES DE SANTÉ ET MAINTENANCE
  // ============================================================================

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository invité
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    try {
      const count = await this.count();

      return {
        ...baseHealth,
        guestSpecific: {
          totalGuests: count.count,
          configured: {
            maxGuestsPerEvent: this.guestConfig.maxGuestsPerEvent,
            bulkImportLimit: this.guestConfig.bulkImportLimit
          }
        },
        status: 'healthy'
      };

    } catch (error) {
      return {
        ...baseHealth,
        guestSpecific: {
          error: error.message
        },
        status: 'degraded'
      };
    }
  }
}

module.exports = GuestRepository;