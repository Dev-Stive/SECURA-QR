/**
 * @file eventRepo.js
 * @description Repository ultra-complet pour la gestion des événements Secura.
 * Hérite de BaseRepository avec des fonctionnalités spécifiques aux événements.
 * Gère la création, modification, statistiques et relations avec les invités.
 * @module repositories/eventRepo
 * @requires ./baseRepo
 * @requires ../models/eventModel
 * @requires ../utils/validation/eventValidation
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
const { guestRepo, guestRepo, guestRepo, userRepo } = require('./index');
const Event = require('../models/eventModel');
const { 
  validateCreateEvent, 
  validateUpdateEvent,
  validateEventSettings,
  validateEventDesign
} = require('../utils/validation/eventValidation');
const { 
  AppError, 
  ValidationError,
} = require('../utils/errorHandler');
const { EVENT_TYPES, STATUS } = require('../utils/constants');
const { generateEventId } = require('../utils/helpers/idGenerator');
const { 
  now, 
  formatDate,
  addDays,
  DATE_FORMATS
} = require('../utils/helpers/dateHelper');
const { 
  sendTemplateEmail,
  validateEmail 
} = require('../utils/helpers/emailHelper');
const { 
  sanitizeString,
  capitalizeWords
} = require('../utils/helpers/stringHelper');
const {
  parseCSV,
  exportToCSV,
  normalizeCSVData
} = require('../utils/helpers/csvHelper');
const log = require('../utils/logger');

/**
 * @class EventRepository
 * @description Repository spécialisé pour la gestion des événements Secura
 * @extends BaseRepository
 */
class EventRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('events', {
      enableCache: true,
      cacheTTL: 300,
      enableAudit: true,
      softDelete: true,
      validationRequired: true,
      maxRetries: 3,
      ...options
    });

    // Configuration spécifique aux événements
    this.eventConfig = {
      maxEventsPerUser: 100,
      defaultCapacity: 0,
      maxCapacity: 100000,
      reminderDaysBefore: [7, 3, 1],
      bulkImportLimit: 1000,
      ...options.eventConfig
    };

    this.logger = log.withContext({
      repository: 'EventRepository',
      collection: 'events'
    });
  }


  
  /**
   * @method create
   * @description Crée un nouvel événement avec validation complète
   * @param {Object} eventData - Données de l'événement
   * @param {Object} options - Options de création
   * @returns {Promise<Event>} Événement créé
   */
  async create(eventData, options = {}) {
    const operation = log.trackOperation('EVENT_CREATE', {
      data: this.sanitizeEventData(eventData),
      options
    });

    try {
      // Validation des données
      const validation = validateCreateEvent(eventData);
      if (validation.error) {
        throw new ValidationError('Données événement invalides', validation.error.details);
      }

      // Vérifier la limite d'événements par utilisateur
      if (eventData.organizerId) {
        await this.checkUserEventLimit(eventData.organizerId);
      }

      // Créer l'instance Event
      const event = new Event(eventData);

      // Validation du modèle
      const modelValidation = event.validate();
      if (!modelValidation.valid) {
        throw new ValidationError('Modèle événement invalide', modelValidation.errors);
      }

      // Sauvegarder via BaseRepository
      const result = await super.create(event, options);

      // Audit et logs
      this.logger.crud('CREATE', 'events', {
        eventId: event.id,
        eventName: event.name,
        type: event.type,
        date: event.date
      });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { 
        data: this.sanitizeEventData(eventData) 
      });
    }
  }

  /**
   * @method updateEvent
   * @description Met à jour un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} updates - Données de mise à jour
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Event>} Événement mis à jour
   */
  async updateEvent(eventId, updates, options = {}) {
    const operation = log.trackOperation('EVENT_UPDATE', {
      eventId,
      updates: this.sanitizeEventData(updates),
      options
    });

    try {
      // Récupérer l'événement existant
      const existingEvent = await this.findById(eventId, { throwIfNotFound: true });
      
      // Validation des mises à jour
      const validation = validateUpdateEvent(updates);
      if (validation.error) {
        throw new ValidationError('Mises à jour invalides', validation.error.details);
      }

      // Appliquer les mises à jour
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          existingEvent[key] = updates[key];
        }
      });

      // Sauvegarder les modifications
      const result = await super.update(eventId, existingEvent, options);

      this.logger.crud('UPDATE', 'events', {
        eventId,
        updatedFields: Object.keys(updates)
      });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { 
        eventId, 
        updates: this.sanitizeEventData(updates) 
      });
    }
  }

  /**
   * @method deleteEvent
   * @description Supprime un événement avec vérifications
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de suppression
   * @returns {Promise<Object>} Résultat de suppression
   */
  async deleteEvent(eventId, options = {}) {
    const operation = log.trackOperation('EVENT_DELETE', {
      eventId,
      options
    });

    try {
      // Vérifier les dépendances via les autres repos
      if (options.checkDependencies !== false) {
        await this.checkEventDependencies(eventId);
      }

      const result = await super.delete(eventId, options);

      this.logger.crud('DELETE', 'events', {
        eventId,
        soft: result.soft
      });

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method findByOrganizer
   * @description Trouve les événements d'un organisateur
   * @param {string} organizerId - ID de l'organisateur
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Événements trouvés avec pagination
   */
  async findByOrganizer(organizerId, options = {}) {
    const operation = log.trackOperation('EVENT_FIND_BY_ORGANIZER', {
      organizerId,
      options
    });

    try {
      const result = await this.findAll({ organizerId }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { organizerId });
    }
  }

  /**
   * @method findByType
   * @description Trouve les événements par type
   * @param {string} type - Type d'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Événements trouvés
   */
  async findByType(type, options = {}) {
    const operation = log.trackOperation('EVENT_FIND_BY_TYPE', {
      type,
      options
    });

    try {
      const result = await this.findAll({ type }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { type });
    }
  }

  /**
   * @method findActiveEvents
   * @description Trouve tous les événements actifs
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Événements actifs
   */
  async findActiveEvents(options = {}) {
    const operation = log.trackOperation('EVENT_FIND_ACTIVE', { options });

    try {
      const result = await this.findAll({ 
        active: true,
        status: STATUS.ACTIVE 
      }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method findUpcomingEvents
   * @description Trouve les événements à venir
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Événements à venir
   */
  async findUpcomingEvents(options = {}) {
    const operation = log.trackOperation('EVENT_FIND_UPCOMING', { options });

    try {
      const today = now().toISOString().split('T')[0];
      
      const result = await this.findAll({ 
        date: { $gte: today },
        active: true
      }, {
        ...options,
        sort: { date: 'asc' }
      });
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method findPastEvents
   * @description Trouve les événements passés
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Événements passés
   */
  async findPastEvents(options = {}) {
    const operation = log.trackOperation('EVENT_FIND_PAST', { options });

    try {
      const today = now().toISOString().split('T')[0];
      
      const result = await this.findAll({ 
        date: { $lt: today }
      }, {
        ...options,
        sort: { date: 'desc' }
      });
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method findEventsByDateRange
   * @description Trouve les événements dans une plage de dates
   * @param {string} startDate - Date de début
   * @param {string} endDate - Date de fin
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Événements trouvés
   */
  async findEventsByDateRange(startDate, endDate, options = {}) {
    const operation = log.trackOperation('EVENT_FIND_BY_DATE_RANGE', {
      startDate,
      endDate,
      options
    });

    try {
      const result = await this.findAll({ 
        date: { 
          $gte: startDate,
          $lte: endDate
        }
      }, {
        ...options,
        sort: { date: 'asc' }
      });
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { startDate, endDate });
    }
  }

  /**
   * @method searchEvents
   * @description Recherche avancée d'événements
   * @param {Object} criteria - Critères de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Résultats de recherche
   */
  async searchEvents(criteria = {}, options = {}) {
    const operation = log.trackOperation('EVENT_SEARCH', {
      criteria: this.sanitizeSearchCriteria(criteria),
      options
    });

    try {
      const {
        query,
        type,
        status,
        dateFrom,
        dateTo,
        active,
        organizerId,
        ...otherFilters
      } = criteria;

      // Construire les filtres
      const filters = { ...otherFilters };

      // Filtre par type
      if (type) {
        filters.type = type;
      }

      // Filtre par statut
      if (status) {
        filters.status = status;
      }

      // Filtre par activité
      if (active !== undefined) {
        filters.active = Boolean(active);
      }

      // Filtre par organisateur
      if (organizerId) {
        filters.organizerId = organizerId;
      }

      // Filtre par date
      if (dateFrom || dateTo) {
        filters.date = {};
        if (dateFrom) filters.date.$gte = dateFrom;
        if (dateTo) filters.date.$lte = dateTo;
      }

      // Recherche textuelle
      if (query) {
        const searchFilters = {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { location: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
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

  // ============================================================================
  // MÉTHODES DE GESTION DES STATISTIQUES
  // ============================================================================

  /**
   * @method updateEventStats
   * @description Met à jour les statistiques d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Event>} Événement avec stats mises à jour
   */
  async updateEventStats(eventId) {
    const operation = log.trackOperation('EVENT_UPDATE_STATS', { eventId });

    try {
      const event = await this.findById(eventId, { throwIfNotFound: true });

      const guestsResult = await guestRepo.findAll({ eventId }, { paginate: false });
      
      const guests = guestsResult.data || [];
      const confirmedGuests = guests.filter(g => g.isConfirmed());
      const scannedGuests = guests.filter(g => g.scanned);

      const scansResult = await scanRepo.findAll({ eventId }, { paginate: false });
      const totalScans = scansResult.data?.length || 0;

      // Mettre à jour les stats
      const statsData = {
        total: guests.length,
        confirmed: confirmedGuests.length,
        scanned: scannedGuests.length,
        totalScans
      };

      event.updateStats(statsData);

      // Sauvegarder
      const result = await super.update(eventId, event, {
        reason: 'stats_update'
      });

      this.logger.debug(`Statistiques mises à jour pour événement ${eventId}`, {
        eventId,
        stats: statsData
      });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method getEventStats
   * @description Récupère les statistiques détaillées d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Statistiques complètes
   */
  async getEventStats(eventId) {
    const operation = log.trackOperation('EVENT_GET_STATS', { eventId });

    try {
      const event = await this.findById(eventId, { throwIfNotFound: true });

      // Mettre à jour les stats d'abord
      await this.updateEventStats(eventId);

      // Récupérer l'événement mis à jour
      const updatedEvent = await this.findById(eventId);

      // Calculer des stats supplémentaires
      const stats = {
        ...updatedEvent.stats,
        eventInfo: {
          id: event.id,
          name: event.name,
          type: event.type,
          date: event.date,
          location: event.location,
          capacity: event.capacity,
          active: event.active
        },
        availability: {
          isFull: updatedEvent.isFull(),
          availableSpots: updatedEvent.getAvailableSpots(),
          capacityRate: event.capacity > 0 
            ? Math.round((updatedEvent.stats.confirmedGuests / event.capacity) * 100) 
            : 0
        },
        timing: {
          isPast: updatedEvent.isPast(),
          isToday: updatedEvent.isToday(),
          daysUntil: updatedEvent.getDaysUntil()
        },
        engagement: {
          confirmationRate: updatedEvent.stats.totalGuests > 0
            ? Math.round((updatedEvent.stats.confirmedGuests / updatedEvent.stats.totalGuests) * 100)
            : 0,
          scanRate: updatedEvent.stats.scanRate,
          averageScansPerGuest: updatedEvent.stats.confirmedGuests > 0
            ? (updatedEvent.stats.totalScans / updatedEvent.stats.confirmedGuests).toFixed(2)
            : 0
        }
      };

      return operation.success({ stats });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method getEventsStats
   * @description Récupère les statistiques globales des événements
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Object>} Statistiques globales
   */
  async getEventsStats(filters = {}) {
    const operation = log.trackOperation('EVENTS_GET_STATS', { filters });

    try {
      const allEvents = await this.findAll(filters, { paginate: false });
      
      const stats = {
        total: allEvents.data.length,
        byType: {},
        byStatus: {
          active: 0,
          inactive: 0
        },
        timing: {
          upcoming: 0,
          ongoing: 0,
          past: 0
        },
        capacity: {
          totalCapacity: 0,
          totalGuests: 0,
          totalConfirmed: 0,
          totalScanned: 0,
          averageCapacityRate: 0
        },
        engagement: {
          averageConfirmationRate: 0,
          averageScanRate: 0,
          totalScans: 0
        }
      };

      const today = now().toISOString().split('T')[0];

      allEvents.data.forEach(event => {
        // Par type
        stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

        // Par statut
        if (event.active) {
          stats.byStatus.active++;
        } else {
          stats.byStatus.inactive++;
        }

        // Par timing
        if (event.date < today) {
          stats.timing.past++;
        } else if (event.date === today) {
          stats.timing.ongoing++;
        } else {
          stats.timing.upcoming++;
        }

        // Capacité
        stats.capacity.totalCapacity += event.capacity || 0;
        stats.capacity.totalGuests += event.stats.totalGuests || 0;
        stats.capacity.totalConfirmed += event.stats.confirmedGuests || 0;
        stats.capacity.totalScanned += event.stats.scannedGuests || 0;

        // Engagement
        stats.engagement.totalScans += event.stats.totalScans || 0;
      });

      // Calculer les moyennes
      if (allEvents.data.length > 0) {
        const eventsWithCapacity = allEvents.data.filter(e => e.capacity > 0);
        if (eventsWithCapacity.length > 0) {
          const totalCapacityRate = eventsWithCapacity.reduce((sum, e) => {
            return sum + (e.capacity > 0 ? (e.stats.confirmedGuests / e.capacity) * 100 : 0);
          }, 0);
          stats.capacity.averageCapacityRate = Math.round(totalCapacityRate / eventsWithCapacity.length);
        }

        const eventsWithGuests = allEvents.data.filter(e => e.stats.totalGuests > 0);
        if (eventsWithGuests.length > 0) {
          const totalConfirmRate = eventsWithGuests.reduce((sum, e) => {
            return sum + (e.stats.totalGuests > 0 
              ? (e.stats.confirmedGuests / e.stats.totalGuests) * 100 
              : 0);
          }, 0);
          stats.engagement.averageConfirmationRate = Math.round(totalConfirmRate / eventsWithGuests.length);

          const totalScanRate = eventsWithGuests.reduce((sum, e) => sum + (e.stats.scanRate || 0), 0);
          stats.engagement.averageScanRate = Math.round(totalScanRate / eventsWithGuests.length);
        }
      }

      return operation.success({ stats });

    } catch (error) {
      return operation.error(error, { filters });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES PARAMÈTRES ET DESIGN
  // ============================================================================

  /**
   * @method updateEventSettings
   * @description Met à jour les paramètres d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} settings - Nouveaux paramètres
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Event>} Événement mis à jour
   */
  async updateEventSettings(eventId, settings, options = {}) {
    const operation = log.trackOperation('EVENT_UPDATE_SETTINGS', {
      eventId,
      settings,
      options
    });

    try {
      const event = await this.findById(eventId, { throwIfNotFound: true });

      // Validation des paramètres
      const validation = validateEventSettings(settings);
      if (validation.error) {
        throw new ValidationError('Paramètres invalides', validation.error.details);
      }

      // Mettre à jour les paramètres
      event.updateSettings(settings);

      // Sauvegarder
      const result = await super.update(eventId, event, {
        ...options,
        reason: 'settings_update'
      });

      this.logger.crud('UPDATE_SETTINGS', 'events', {
        eventId,
        updatedSettings: Object.keys(settings)
      });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { eventId, settings });
    }
  }

  /**
   * @method updateEventDesign
   * @description Met à jour le design d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} design - Nouveau design
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Event>} Événement mis à jour
   */
  async updateEventDesign(eventId, design, options = {}) {
    const operation = log.trackOperation('EVENT_UPDATE_DESIGN', {
      eventId,
      design,
      options
    });

    try {
      const event = await this.findById(eventId, { throwIfNotFound: true });

      // Validation du design
      const validation = validateEventDesign(design);
      if (validation.error) {
        throw new ValidationError('Design invalide', validation.error.details);
      }

      // Mettre à jour le design
      event.updateDesign(design);

      // Sauvegarder
      const result = await super.update(eventId, event, {
        ...options,
        reason: 'design_update'
      });

      this.logger.crud('UPDATE_DESIGN', 'events', {
        eventId,
        updatedDesign: Object.keys(design)
      });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { eventId, design });
    }
  }

  // ============================================================================
  // MÉTHODES D'ACTIVATION ET GESTION DU STATUT
  // ============================================================================

  /**
   * @method activateEvent
   * @description Active un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options d'activation
   * @returns {Promise<Event>} Événement activé
   */
  async activateEvent(eventId, options = {}) {
    const operation = log.trackOperation('EVENT_ACTIVATE', {
      eventId,
      options
    });

    try {
      const event = await this.findById(eventId, { throwIfNotFound: true });

      event.activate();

      const result = await super.update(eventId, event, {
        ...options,
        reason: 'activation'
      });

      this.logger.crud('ACTIVATE', 'events', { eventId });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method deactivateEvent
   * @description Désactive un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de désactivation
   * @returns {Promise<Event>} Événement désactivé
   */
  async deactivateEvent(eventId, options = {}) {
    const operation = log.trackOperation('EVENT_DEACTIVATE', {
      eventId,
      options
    });

    try {
      const event = await this.findById(eventId, { throwIfNotFound: true });

      event.deactivate();

      const result = await super.update(eventId, event, {
        ...options,
        reason: 'deactivation'
      });

      this.logger.crud('DEACTIVATE', 'events', { eventId });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  // ============================================================================
  // MÉTHODES DE DUPLICATION ET TEMPLATES
  // ============================================================================

  /**
   * @method duplicateEvent
   * @description Duplique un événement existant
   * @param {string} eventId - ID de l'événement source
   * @param {Object} overrides - Données à remplacer
   * @param {Object} options - Options de duplication
   * @returns {Promise<Event>} Événement dupliqué
   */
  async duplicateEvent(eventId, overrides = {}, options = {}) {
    const operation = log.trackOperation('EVENT_DUPLICATE', {
      eventId,
      overrides,
      options
    });

    try {
      const sourceEvent = await this.findById(eventId, { throwIfNotFound: true });

      // Créer un nouvel événement basé sur la source
      const duplicateData = {
        ...sourceEvent,
        id: generateEventId(),
        name: overrides.name || `${sourceEvent.name} (Copie)`,
        date: overrides.date || addDays(now(), 7).toISOString().split('T')[0],
        organizerId: overrides.organizerId || sourceEvent.organizerId,
        stats: {
          totalGuests: 0,
          confirmedGuests: 0,
          scannedGuests: 0,
          totalScans: 0,
          scanRate: 0,
          lastScan: null
        },
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
        ...overrides
      };

      // Ne pas copier certains champs
      delete duplicateData.scanHistory;
      delete duplicateData.generationHistory;

      const result = await this.create(duplicateData, options);

      this.logger.crud('DUPLICATE', 'events', {
        sourceEventId: eventId,
        newEventId: result.id
      });

      return operation.success({ event: result });

    } catch (error) {
      return operation.error(error, { eventId, overrides });
    }
  }

  // ============================================================================
  // MÉTHODES D'IMPORT/EXPORT
  // ============================================================================

  /**
   * @method exportEventsToCSV
   * @description Exporte les événements en CSV
   * @param {Object} filters - Filtres optionnels
   * @param {string} filePath - Chemin du fichier de sortie
   * @returns {Promise<Object>} Résultat de l'export
   */
  async exportEventsToCSV(filters = {}, filePath) {
    const operation = log.trackOperation('EVENT_EXPORT_CSV', {
      filters,
      filePath
    });

    try {
      const events = await this.findAll(filters, { paginate: false });

      // Formatter les données pour CSV
      const csvData = events.data.map(event => ({
        ID: event.id,
        Nom: event.name,
        Type: event.type,
        Date: event.date,
        Heure: event.time,
        Lieu: event.location,
        Capacité: event.capacity,
        Description: event.description,
        Actif: event.active ? 'Oui' : 'Non',
        'Total Invités': event.stats.totalGuests,
        'Invités Confirmés': event.stats.confirmedGuests,
        'Invités Scannés': event.stats.scannedGuests,
        'Taux de Scan': `${event.stats.scanRate}%`,
        'Créé le': formatDate(event.createdAt, DATE_FORMATS.FRENCH_DATETIME)
      }));

      // Exporter vers fichier
      await exportToCSV(csvData, filePath);

      this.logger.info(`${csvData.length} événements exportés vers ${filePath}`);

      return operation.success({ 
        exported: csvData.length,
        filePath
      });

    } catch (error) {
      return operation.error(error, { filters, filePath });
    }
  }

  /**
   * @method importEventsFromCSV
   * @description Importe des événements depuis un CSV
   * @param {string} filePath - Chemin du fichier CSV
   * @param {Object} options - Options d'import
   * @returns {Promise<Object>} Résultat de l'import
   */
  async importEventsFromCSV(filePath, options = {}) {
    const operation = log.trackOperation('EVENT_IMPORT_CSV', {
      filePath,
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

      // Limiter le nombre d'imports
      if (normalized.length > this.eventConfig.bulkImportLimit) {
        throw new ValidationError(
          `Import limité à ${this.eventConfig.bulkImportLimit} événements. ` +
          `Fichier contient ${normalized.length} lignes.`
        );
      }

      const results = {
        imported: 0,
        failed: 0,
        errors: []
      };

      // Importer chaque événement
      for (const row of normalized) {
        try {
          const eventData = {
            name: row.Nom || row.name,
            type: row.Type || row.type || EVENT_TYPES.OTHER,
            date: row.Date || row.date,
            time: row.Heure || row.time || '00:00',
            location: row.Lieu || row.location,
            capacity: parseInt(row.Capacité || row.capacity) || 0,
            description: row.Description || row.description || '',
            organizerId: options.organizerId
          };

          await this.create(eventData, {
            ...options,
            skipNotification: true
          });

          results.imported++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            row: row.Nom || row.name,
            error: error.message
          });
        }
      }

      this.logger.info(`Import CSV terminé: ${results.imported} réussis, ${results.failed} échecs`, {
        filePath,
        results
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { filePath });
    }
  }

  // ============================================================================
  // MÉTHODES DE VÉRIFICATION ET VALIDATION
  // ============================================================================

  /**
   * @method checkUserEventLimit
   * @description Vérifie si un utilisateur a atteint sa limite d'événements
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<void>}
   * @throws {AppError} Si limite atteinte
   */
  async checkUserEventLimit(userId) {
    const userEvents = await this.findByOrganizer(userId, { paginate: false });
    
    if (userEvents.data.length >= this.eventConfig.maxEventsPerUser) {
      throw new AppError(
        `Limite d'événements atteinte (${this.eventConfig.maxEventsPerUser})`,
        400,
        'EVENT_LIMIT_REACHED'
      );
    }
  }

  /**
   * @method checkEventDependencies
   * @description Vérifie les dépendances avant suppression d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<void>}
   * @throws {AppError} Si des dépendances existent
   */
  async checkEventDependencies(eventId) {
  
    // Vérifier les invités
    const guests = await guestRepo.findAll({ eventId }, { paginate: false });
    if (guests.data.length > 0) {
      throw new AppError(
        `Impossible de supprimer: ${guests.data.length} invité(s) associé(s)`,
        400,
        'EVENT_HAS_GUESTS'
      );
    }

    // Vérifier les QR codes
    const qrCodes = await qrCodeRepo.findAll({ eventId }, { paginate: false });
    if (qrCodes.data.length > 0) {
      throw new AppError(
        `Impossible de supprimer: ${qrCodes.data.length} QR code(s) associé(s)`,
        400,
        'EVENT_HAS_QRCODES'
      );
    }

    // Vérifier les scans
    const scans = await scanRepo.findAll({ eventId }, { paginate: false });
    if (scans.data.length > 0) {
      throw new AppError(
        `Impossible de supprimer: ${scans.data.length} scan(s) associé(s)`,
        400,
        'EVENT_HAS_SCANS'
      );
    }
  }

  /**
   * @method canUserAccessEvent
   * @description Vérifie si un utilisateur peut accéder à un événement
   * @param {string} eventId - ID de l'événement
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<boolean>} True si accès autorisé
   */
  async canUserAccessEvent(eventId, userId) {
    try {
      const event = await this.findById(eventId);
      if (!event) return false;

      const user = await userRepo.findById(userId);
      if (!user) return false;

      if (user.isAdmin()) return true;

      // Organisateur a accès
      if (event.organizerId === userId) return true;

      // Événement privé = accès refusé
      if (event.settings.privateEvent) return false;

      // Sinon, accès autorisé
      return true;

    } catch (error) {
      this.logger.error('Erreur vérification accès événement', {
        eventId,
        userId,
        error: error.message
      });
      return false;
    }
  }

  // ============================================================================
  // MÉTHODES DE NOTIFICATION ET RAPPELS
  // ============================================================================

  /**
   * @method sendEventReminders
   * @description Envoie des rappels pour un événement
   * @param {string} eventId - ID de l'événement
   * @param {number} daysBeforeEvent - Jours avant l'événement
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendEventReminders(eventId, daysBeforeEvent) {
    const operation = log.trackOperation('EVENT_SEND_REMINDERS', {
      eventId,
      daysBeforeEvent
    });

    try {
      const event = await this.findById(eventId, { throwIfNotFound: true });

      // Vérifier si les rappels sont activés
      if (!event.settings.sendReminders) {
        return operation.success({ 
          sent: 0, 
          reason: 'Rappels désactivés' 
        });
      }

      const confirmedGuests = await guestRepo.findAll({ 
        eventId,
        status: STATUS.CONFIRMED
      }, { paginate: false });

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      // Envoyer les rappels
      for (const guest of confirmedGuests.data) {
        if (!guest.email || !validateEmail(guest.email)) continue;

        try {
          await sendTemplateEmail({
            to: guest.email,
            subject: `Rappel - ${event.name}`,
            template: 'reminder',
            data: {
              guestName: guest.getFullName(),
              eventName: event.name,
              eventDate: formatDate(event.date, DATE_FORMATS.LONG_DATE),
              eventTime: event.time,
              eventLocation: event.location,
              daysUntil: daysBeforeEvent
            }
          });

          results.sent++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            guestEmail: guest.email,
            error: error.message
          });
        }
      }

      this.logger.info(`Rappels envoyés pour événement ${eventId}`, {
        eventId,
        sent: results.sent,
        failed: results.failed
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { eventId, daysBeforeEvent });
    }
  }

  /**
   * @method processScheduledReminders
   * @description Traite les rappels planifiés pour tous les événements
   * @returns {Promise<Object>} Résultats du traitement
   */
  async processScheduledReminders() {
    const operation = log.trackOperation('EVENTS_PROCESS_REMINDERS');

    try {
      const results = {
        processed: 0,
        sent: 0,
        failed: 0
      };

      // Pour chaque jour de rappel configuré
      for (const days of this.eventConfig.reminderDaysBefore) {
        const targetDate = addDays(now(), days).toISOString().split('T')[0];

        // Trouver les événements à cette date
        const events = await this.findAll({ 
          date: targetDate,
          active: true
        }, { paginate: false });

        results.processed += events.data.length;

        // Envoyer les rappels pour chaque événement
        for (const event of events.data) {
          const reminderResult = await this.sendEventReminders(event.id, days);
          results.sent += reminderResult.results?.sent || 0;
          results.failed += reminderResult.results?.failed || 0;
        }
      }

      this.logger.info('Traitement des rappels terminé', { results });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES ET HELPERS
  // ============================================================================

  /**
   * @method sanitizeEventData
   * @description Nettoie les données d'événement pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeEventData(data) {
    const sanitized = { ...data };
    
    // Limiter la longueur des champs longs
    if (sanitized.description && sanitized.description.length > 100) {
      sanitized.description = sanitized.description.substring(0, 100) + '...';
    }
    if (sanitized.welcomeMessage && sanitized.welcomeMessage.length > 100) {
      sanitized.welcomeMessage = sanitized.welcomeMessage.substring(0, 100) + '...';
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
    
    if (sanitized.query) {
      sanitized.query = sanitizeString(sanitized.query);
    }
    
    return sanitized;
  }

  /**
   * @method getUniqueFields
   * @description Retourne les champs avec contrainte d'unicité
   * @returns {string[]} Liste des champs uniques
   */
  getUniqueFields() {
    // Pas de contraintes d'unicité pour les événements
    return [];
  }

  /**
   * @method validate
   * @description Valide les données d'un événement
   * @param {Object} eventData - Données à valider
   * @returns {Object} Résultat de validation
   */
  validate(eventData) {
    return validateCreateEvent(eventData);
  }

  /**
   * @method validateUpdate
   * @description Valide les mises à jour d'un événement
   * @param {Object} updates - Mises à jour à valider
   * @returns {Object} Résultat de validation
   */
  validateUpdate(updates) {
    return validateUpdateEvent(updates);
  }

  /**
   * @method prepareDocument
   * @description Prépare un document événement avant sauvegarde
   * @param {Object} data - Données du document
   * @param {string} operation - Type d'opération (create/update)
   * @returns {Object} Document préparé
   */
  prepareDocument(data, operation = 'create') {
    const document = super.prepareDocument(data, operation);

    // Normaliser le nom
    if (document.name) {
      document.name = capitalizeWords(document.name.trim());
    }

    // Normaliser le lieu
    if (document.location) {
      document.location = document.location.trim();
    }

    return document;
  }

  // ============================================================================
  // MÉTHODES DE SANTÉ ET MAINTENANCE
  // ============================================================================

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository événement
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    try {
      const stats = await this.getEventsStats();
      const upcomingEvents = await this.findUpcomingEvents({ paginate: false });

      return {
        ...baseHealth,
        eventSpecific: {
          totalEvents: stats.stats.total,
          activeEvents: stats.stats.byStatus.active,
          upcomingEvents: upcomingEvents.data.length,
          totalGuests: stats.stats.capacity.totalGuests,
          totalScans: stats.stats.engagement.totalScans
        },
        status: 'healthy'
      };

    } catch (error) {
      return {
        ...baseHealth,
        eventSpecific: {
          error: error.message
        },
        status: 'degraded'
      };
    }
  }

  /**
   * @method archiveOldEvents
   * @description Archive les événements anciens
   * @param {number} daysOld - Nombre de jours d'ancienneté
   * @returns {Promise<number>} Nombre d'événements archivés
   */
  async archiveOldEvents(daysOld = 90) {
    const operation = log.trackOperation('EVENTS_ARCHIVE_OLD', { daysOld });

    try {
      const cutoffDate = addDays(now(), -daysOld).toISOString().split('T')[0];

      const result = await this.updateMany(
        { 
          date: { $lt: cutoffDate },
          active: true
        },
        { 
          active: false,
          status: 'archived'
        },
        { reason: 'auto_archive' }
      );

      this.logger.info(`${result.updated} événements archivés`, {
        daysOld,
        cutoffDate,
        archived: result.updated
      });

      return operation.success({ archived: result.updated });

    } catch (error) {
      return operation.error(error, { daysOld });
    }
  }

  /**
   * @method cleanupExpiredEvents
   * @description Nettoie les événements expirés
   * @param {number} daysAfterExpiry - Jours après expiration
   * @returns {Promise<number>} Nombre d'événements nettoyés
   */
  async cleanupExpiredEvents(daysAfterExpiry = 180) {
    const operation = log.trackOperation('EVENTS_CLEANUP_EXPIRED', { daysAfterExpiry });

    try {
      const cutoffDate = addDays(now(), -daysAfterExpiry).toISOString().split('T')[0];

      // Soft delete des événements très anciens
      const expiredEvents = await this.findAll({
        date: { $lt: cutoffDate },
        deletedAt: null
      }, { paginate: false });

      let cleaned = 0;

      for (const event of expiredEvents.data) {
        await this.delete(event.id, {
          softDelete: true,
          reason: 'auto_cleanup'
        });
        cleaned++;
      }

      this.logger.info(`${cleaned} événements expirés nettoyés`, {
        daysAfterExpiry,
        cutoffDate,
        cleaned
      });

      return operation.success({ cleaned });

    } catch (error) {
      return operation.error(error, { daysAfterExpiry });
    }
  }
}

module.exports = EventRepository;