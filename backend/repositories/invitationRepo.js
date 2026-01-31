/**
 * @file invitationRepo.js
 * @description Repository ultra-complet pour la gestion des invitations Secura.
 * Hérite de BaseRepository avec des fonctionnalités spécifiques aux invitations.
 * Gère l'envoi, le suivi, les réponses et l'analyse des invitations.
 * @module repositories/invitationRepo
 * @requires ./baseRepo
 * @requires ../models/invitationModel
 * @requires ../utils/validation/invitationValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/helpers/emailHelper
 * @requires ../utils/helpers/stringHelper
 * @requires ../utils/logger
 */

const BaseRepository = require('./baseRepo');
const Invitation = require('../models/invitationModel');
const { eventRepo } = require('./index');
const {
  validateCreateInvitation,
  validateUpdateInvitation,
  validateSendInvitation,
  validateTrackInvitation,
  validateRespondInvitation,
  validateBulkSend
} = require('../utils/validation/invitationValidation');
const {
  AppError,
  ValidationError,
  NotFoundError
} = require('../utils/errorHandler');
const { STATUS, INVITATION_STATUS } = require('../utils/constants');
const { generateInvitationToken } = require('../utils/helpers/idGenerator');
const {
  now,
  formatDate,
  addDays,
  isBefore,
  isAfter,
  DATE_FORMATS
} = require('../utils/helpers/dateHelper');
const {
  sendTemplateEmail,
  validateEmail
} = require('../utils/helpers/emailHelper');
const {
  sanitizeString,
  maskEmail,
  capitalizeWords
} = require('../utils/helpers/stringHelper');
const log = require('../utils/logger');

/**
 * @class InvitationRepository
 * @description Repository spécialisé pour la gestion des invitations Secura
 * @extends BaseRepository
 */
class InvitationRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('invitations', {
      enableCache: true,
      cacheTTL: 360, // 6 minutes pour les invitations
      enableAudit: true,
      softDelete: true,
      validationRequired: true,
      maxRetries: 3,
      ...options
    });

    // Configuration spécifique aux invitations
    this.invitationConfig = {
      maxInvitationsPerEvent: 10000,
      tokenLength: 8,
      defaultExpiryDays: 30,
      maxResendAttempts: 3,
      bulkSendLimit: 500,
      requireGuestValidation: true,
      ...options.invitationConfig
    };

    this.logger = log.withContext({
      repository: 'InvitationRepository',
      collection: 'invitations'
    });
  }

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée une nouvelle invitation avec validation complète
   * @param {Object} invitationData - Données de l'invitation
   * @param {Object} options - Options de création
   * @returns {Promise<Invitation>} Invitation créée
   */
  async create(invitationData, options = {}) {
    const operation = log.trackOperation('INVITATION_CREATE', {
      data: this.sanitizeInvitationData(invitationData),
      options
    });

    try {
      // Validation des données
      const validation = validateCreateInvitation(invitationData);
      if (validation.error) {
        throw new ValidationError('Données invitation invalides', validation.error.details);
      }

      // Vérifier la limite d'invitations par événement
      if (invitationData.eventId) {
        await this.checkEventInvitationLimit(invitationData.eventId);
      }

      // Vérifier l'unicité du token
      await this.checkTokenUniqueness(invitationData.token || generateInvitationToken());

      // Créer l'instance Invitation
      const invitation = new Invitation(invitationData);

      // Définir la date d'expiration par défaut si non fournie
      if (!invitation.expiresAt) {
        invitation.setExpiration(addDays(now(), this.invitationConfig.defaultExpiryDays));
      }

      // Sauvegarder via BaseRepository
      const result = await super.create(invitation, options);

      // Audit et logs
      this.logger.crud('CREATE', 'invitations', {
        invitationId: invitation.id,
        eventId: invitation.eventId,
        guestEmail: maskEmail(invitation.guestEmail)
      });

      return operation.success({ invitation: result });

    } catch (error) {
      return operation.error(error, {
        data: this.sanitizeInvitationData(invitationData)
      });
    }
  }

  /**
   * @method updateInvitation
   * @description Met à jour une invitation
   * @param {string} invitationId - ID de l'invitation
   * @param {Object} updates - Données de mise à jour
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Invitation>} Invitation mise à jour
   */
  async updateInvitation(invitationId, updates, options = {}) {
    const operation = log.trackOperation('INVITATION_UPDATE', {
      invitationId,
      updates: this.sanitizeInvitationData(updates),
      options
    });

    try {
      // Récupérer l'invitation existante
      const existingInvitation = await this.findById(invitationId, { throwIfNotFound: true });

      // Validation des mises à jour
      const validation = validateUpdateInvitation(updates);
      if (validation.error) {
        throw new ValidationError('Mises à jour invalides', validation.error.details);
      }

      // Appliquer les mises à jour
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          existingInvitation[key] = updates[key];
        }
      });

      existingInvitation.updatedAt = now().toISOString();

      // Sauvegarder les modifications
      const result = await super.update(invitationId, existingInvitation, options);

      this.logger.crud('UPDATE', 'invitations', {
        invitationId,
        updatedFields: Object.keys(updates)
      });

      return operation.success({ invitation: result });

    } catch (error) {
      return operation.error(error, {
        invitationId,
        updates: this.sanitizeInvitationData(updates)
      });
    }
  }

  /**
   * @method deleteInvitation
   * @description Supprime une invitation
   * @param {string} invitationId - ID de l'invitation
   * @param {Object} options - Options de suppression
   * @returns {Promise<Object>} Résultat de suppression
   */
  async deleteInvitation(invitationId, options = {}) {
    const operation = log.trackOperation('INVITATION_DELETE', {
      invitationId,
      options
    });

    try {
      const invitation = await this.findById(invitationId, { throwIfNotFound: true });

      const result = await super.delete(invitationId, options);

      this.logger.crud('DELETE', 'invitations', {
        invitationId,
        guestEmail: maskEmail(invitation.guestEmail),
        eventId: invitation.eventId
      });

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { invitationId });
    }
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method findByEvent
   * @description Trouve les invitations d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invitations trouvées avec pagination
   */
  async findByEvent(eventId, options = {}) {
    const operation = log.trackOperation('INVITATION_FIND_BY_EVENT', {
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
   * @method findByGuest
   * @description Trouve les invitations d'un invité
   * @param {string} guestId - ID de l'invité
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invitations trouvées
   */
  async findByGuest(guestId, options = {}) {
    const operation = log.trackOperation('INVITATION_FIND_BY_GUEST', {
      guestId,
      options
    });

    try {
      const result = await this.findAll({ guestId }, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { guestId });
    }
  }

  /**
   * @method findByToken
   * @description Trouve une invitation par son token
   * @param {string} token - Token de l'invitation
   * @param {Object} options - Options de recherche
   * @returns {Promise<Invitation|null>} Invitation trouvée ou null
   */
  async findByToken(token, options = {}) {
    const operation = log.trackOperation('INVITATION_FIND_BY_TOKEN', {
      token: '***' // Masqué pour sécurité
    });

    try {
      const result = await this.findOne({ token }, options);

      return operation.success(result ? { invitation: result } : { invitation: null });

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method findByStatus
   * @description Trouve les invitations par statut
   * @param {string} eventId - ID de l'événement
   * @param {string} status - Statut recherché
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invitations trouvées
   */
  async findByStatus(eventId, status, options = {}) {
    const operation = log.trackOperation('INVITATION_FIND_BY_STATUS', {
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
   * @method findSentInvitations
   * @description Trouve les invitations envoyées d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invitations envoyées
   */
  async findSentInvitations(eventId, options = {}) {
    return this.findByStatus(eventId, INVITATION_STATUS.SENT, options);
  }

  /**
   * @method findPendingInvitations
   * @description Trouve les invitations en attente d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invitations en attente
   */
  async findPendingInvitations(eventId, options = {}) {
    return this.findByStatus(eventId, INVITATION_STATUS.PENDING, options);
  }

  /**
   * @method findRespondedInvitations
   * @description Trouve les invitations avec réponse d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invitations avec réponse
   */
  async findRespondedInvitations(eventId, options = {}) {
    return this.findByStatus(eventId, INVITATION_STATUS.RESPONDED, options);
  }

  /**
   * @method findExpiredInvitations
   * @description Trouve les invitations expirées
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Invitations expirées
   */
  async findExpiredInvitations(options = {}) {
    const operation = log.trackOperation('INVITATION_FIND_EXPIRED', { options });

    try {
      const currentDate = now().toISOString();
      const result = await this.findAll({
        expiresAt: { $lt: currentDate },
        status: { $ne: INVITATION_STATUS.RESPONDED }
      }, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method searchInvitations
   * @description Recherche avancée d'invitations
   * @param {Object} criteria - Critères de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Résultats de recherche
   */
  async searchInvitations(criteria = {}, options = {}) {
    const operation = log.trackOperation('INVITATION_SEARCH', {
      criteria: this.sanitizeSearchCriteria(criteria),
      options
    });

    try {
      const {
        query,
        eventId,
        guestId,
        status,
        sent,
        delivered,
        opened,
        responded,
        expired,
        type,
        dateFrom,
        dateTo,
        ...otherFilters
      } = criteria;

      // Construire les filtres
      const filters = { ...otherFilters };

      // Filtre par événement
      if (eventId) {
        filters.eventId = eventId;
      }

      // Filtre par invité
      if (guestId) {
        filters.guestId = guestId;
      }

      // Filtre par statut
      if (status) {
        filters.status = status;
      }

      // Filtre par type
      if (type) {
        filters.type = type;
      }

      // Filtre par date de création
      if (dateFrom || dateTo) {
        filters.createdAt = {};
        if (dateFrom) filters.createdAt.$gte = dateFrom;
        if (dateTo) filters.createdAt.$lte = dateTo;
      }

      // Filtre par expiration
      if (expired !== undefined) {
        const currentDate = now().toISOString();
        if (expired) {
          filters.expiresAt = { $lt: currentDate };
        } else {
          filters.$or = [
            { expiresAt: { $gte: currentDate } },
            { expiresAt: null }
          ];
        }
      }

      // Filtres de suivi
      if (sent !== undefined) {
        filters['tracking.sentAt'] = sent ? { $ne: null } : null;
      }

      if (delivered !== undefined) {
        filters['tracking.deliveredAt'] = delivered ? { $ne: null } : null;
      }

      if (opened !== undefined) {
        filters['tracking.openedAt'] = opened ? { $ne: null } : null;
      }

      if (responded !== undefined) {
        filters['tracking.respondedAt'] = responded ? { $ne: null } : null;
      }

      // Recherche textuelle
      if (query) {
        const searchFilters = {
          $or: [
            { guestEmail: { $regex: query, $options: 'i' } },
            { guestName: { $regex: query, $options: 'i' } },
            { token: { $regex: query, $options: 'i' } }
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
  // MÉTHODES D'ENVOI ET SUIVI
  // ============================================================================

  /**
   * @method sendInvitation
   * @description Envoie une invitation par email
   * @param {string} invitationId - ID de l'invitation
   * @param {Object} sendData - Données d'envoi
   * @param {Object} options - Options d'envoi
   * @returns {Promise<Invitation>} Invitation envoyée
   */
  async sendInvitation(invitationId, sendData = {}, options = {}) {
    const operation = log.trackOperation('INVITATION_SEND', {
      invitationId,
      sendData,
      options
    });

    try {
      // Validation des données d'envoi
      const validation = validateSendInvitation({ invitationId, ...sendData });
      if (validation.error) {
        throw new ValidationError('Données d\'envoi invalides', validation.error.details);
      }

      const invitation = await this.findById(invitationId, { throwIfNotFound: true });

      // Vérifier si l'invitation peut être envoyée
      if (invitation.isSent()) {
        throw new AppError('Invitation déjà envoyée', 400, 'INVITATION_ALREADY_SENT');
      }

      if (invitation.isExpired()) {
        throw new AppError('Invitation expirée', 400, 'INVITATION_EXPIRED');
      }

      const event = await eventRepo.findById(invitation.eventId, { throwIfNotFound: true });

      // Préparer les données d'envoi
      const sendMethod = sendData.method || invitation.sendMethod || 'email';
      const content = sendData.content || invitation.content;

      let sendResult;

      // Envoyer selon la méthode
      switch (sendMethod) {
        case 'email':
          sendResult = await this.sendEmailInvitation(invitation, event, content);
          break;

        case 'sms':
          sendResult = await this.sendSMSInvitation(invitation, event, content);
          break;

        case 'whatsapp':
          sendResult = await this.sendWhatsAppInvitation(invitation, event, content);
          break;

        default:
          throw new AppError('Méthode d\'envoi non supportée', 400, 'INVALID_SEND_METHOD');
      }

      // Marquer comme envoyée
      invitation.markAsSent({
        method: sendMethod,
        details: sendResult
      });

      // Sauvegarder
      const result = await super.update(invitationId, invitation, {
        ...options,
        reason: 'invitation_sent'
      });

      this.logger.info(`Invitation envoyée à ${maskEmail(invitation.guestEmail)}`, {
        invitationId,
        eventId: invitation.eventId,
        method: sendMethod,
        sendResult
      });

      return operation.success({ invitation: result, sendResult });

    } catch (error) {
      return operation.error(error, { invitationId, sendData });
    }
  }

  /**
   * @method resendInvitation
   * @description Renvoie une invitation
   * @param {string} invitationId - ID de l'invitation
   * @param {Object} resendData - Données de renvoi
   * @param {Object} options - Options de renvoi
   * @returns {Promise<Invitation>} Invitation renvoyée
   */
  async resendInvitation(invitationId, resendData = {}, options = {}) {
    const operation = log.trackOperation('INVITATION_RESEND', {
      invitationId,
      resendData,
      options
    });

    try {
      const invitation = await this.findById(invitationId, { throwIfNotFound: true });

      // Vérifier le nombre de tentatives de renvoi
      const resendCount = invitation.history.filter(h => h.action === 'resend_prepared').length;
      if (resendCount >= this.invitationConfig.maxResendAttempts) {
        throw new AppError(
          `Nombre maximum de renvois atteint (${this.invitationConfig.maxResendAttempts})`,
          400,
          'MAX_RESEND_ATTEMPTS_REACHED'
        );
      }

      // Préparer pour le renvoi
      invitation.resend(resendData);

      // Sauvegarder l'état préparé
      await super.update(invitationId, invitation, {
        reason: 'invitation_resend_prepared'
      });

      // Renvoyer l'invitation
      const sendResult = await this.sendInvitation(invitationId, {
        method: resendData.method || invitation.sendMethod,
        content: resendData.content
      }, options);

      this.logger.info(`Invitation renvoyée à ${maskEmail(invitation.guestEmail)}`, {
        invitationId,
        eventId: invitation.eventId,
        attempt: resendCount + 1
      });

      return operation.success({ invitation: sendResult.invitation });

    } catch (error) {
      return operation.error(error, { invitationId, resendData });
    }
  }

  /**
   * @method trackInvitationAction
   * @description Enregistre une action de suivi sur une invitation
   * @param {string} invitationId - ID de l'invitation
   * @param {string} action - Action à tracker
   * @param {Object} trackData - Données de suivi
   * @param {Object} options - Options de suivi
   * @returns {Promise<Invitation>} Invitation mise à jour
   */
  async trackInvitationAction(invitationId, action, trackData = {}, options = {}) {
    const operation = log.trackOperation('INVITATION_TRACK', {
      invitationId,
      action,
      trackData,
      options
    });

    try {
      // Validation des données de suivi
      const validation = validateTrackInvitation({ invitationId, action, data: trackData });
      if (validation.error) {
        throw new ValidationError('Données de suivi invalides', validation.error.details);
      }

      const invitation = await this.findById(invitationId, { throwIfNotFound: true });

      // Appliquer l'action de suivi
      switch (action) {
        case 'sent':
          invitation.markAsSent(trackData);
          break;

        case 'delivered':
          invitation.markAsDelivered();
          break;

        case 'opened':
          invitation.markAsOpened(trackData);
          break;

        case 'clicked':
          invitation.markAsClicked(trackData);
          break;

        case 'bounced':
          invitation.recordBounce(trackData);
          break;

        case 'responded':
          invitation.recordResponse(trackData);
          break;

        default:
          throw new ValidationError('Action de suivi invalide', [{ action }]);
      }

      // Sauvegarder
      const result = await super.update(invitationId, invitation, {
        ...options,
        reason: `track_${action}`
      });

      this.logger.debug(`Action ${action} trackée pour invitation ${invitationId}`, {
        invitationId,
        action,
        trackData
      });

      return operation.success({ invitation: result });

    } catch (error) {
      return operation.error(error, { invitationId, action, trackData });
    }
  }

  // ============================================================================
  // MÉTHODES DE RÉPONSE AUX INVITATIONS
  // ============================================================================

  /**
   * @method respondToInvitation
   * @description Enregistre une réponse à une invitation
   * @param {string} token - Token de l'invitation
   * @param {Object} responseData - Données de réponse
   * @param {Object} options - Options de réponse
   * @returns {Promise<Invitation>} Invitation mise à jour avec réponse
   */
  async respondToInvitation(token, responseData, options = {}) {
    const operation = log.trackOperation('INVITATION_RESPOND', {
      token: '***', // Masqué pour sécurité
      responseData,
      options
    });

    try {
      // Validation des données de réponse
      const validation = validateRespondInvitation({ invitationToken: token, ...responseData });
      if (validation.error) {
        throw new ValidationError('Données de réponse invalides', validation.error.details);
      }

      // Trouver l'invitation par token
      const invitation = await this.findByToken(token, { throwIfNotFound: true });

      // Vérifier si l'invitation est expirée
      if (invitation.isExpired()) {
        throw new AppError('Invitation expirée', 400, 'INVITATION_EXPIRED');
      }

      // Vérifier si déjà répondue
      if (invitation.isResponded()) {
        throw new AppError('Invitation déjà répondue', 400, 'INVITATION_ALREADY_RESPONDED');
      }

      // Enregistrer la réponse
      invitation.recordResponse(responseData);

      // Sauvegarder
      const result = await super.update(invitation.id, invitation, {
        ...options,
        reason: 'invitation_response'
      });

      // Mettre à jour le statut de l'invité si nécessaire
      if (this.invitationConfig.requireGuestValidation) {
        await this.updateGuestStatusFromResponse(invitation, responseData);
      }

      this.logger.info(`Réponse enregistrée pour invitation ${invitation.id}`, {
        invitationId: invitation.id,
        guestEmail: maskEmail(invitation.guestEmail),
        responseStatus: responseData.status
      });

      return operation.success({ invitation: result });

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method getInvitationByToken
   * @description Récupère une invitation par token avec validation
   * @param {string} token - Token de l'invitation
   * @param {Object} options - Options de récupération
   * @returns {Promise<Object>} Invitation avec validation
   */
  async getInvitationByToken(token, options = {}) {
    const operation = log.trackOperation('INVITATION_GET_BY_TOKEN', {
      token: '***' // Masqué pour sécurité
    });

    try {
      const invitation = await this.findByToken(token, { throwIfNotFound: true });

      // Vérifier l'expiration
      const isExpired = invitation.isExpired();
      const isValid = !isExpired && !invitation.isResponded();

      const response = {
        invitation,
        validation: {
          isValid,
          isExpired,
          isResponded: invitation.isResponded(),
          canRespond: !isExpired && !invitation.isResponded()
        },
        eventInfo: null
      };

      // Récupérer les informations de l'événement
      if (options.includeEventInfo !== false) {
        try {
          const event = await eventRepo.findById(invitation.eventId);
          if (event) {
            response.eventInfo = {
              id: event.id,
              name: event.name,
              date: event.date,
              time: event.time,
              location: event.location,
              description: event.description
            };
          }
        } catch (error) {
          this.logger.warning('Erreur récupération événement pour invitation', {
            invitationId: invitation.id,
            error: error.message
          });
        }
      }

      return operation.success(response);

    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES D'ENVOI EN MASSE
  // ============================================================================

  /**
   * @method bulkSendInvitations
   * @description Envoie des invitations en masse
   * @param {Object} bulkData - Données d'envoi en masse
   * @param {Object} options - Options d'envoi
   * @returns {Promise<Object>} Résultat de l'envoi en masse
   */
  async bulkSendInvitations(bulkData, options = {}) {
    const operation = log.trackOperation('INVITATION_BULK_SEND', {
      bulkData: {
        eventId: bulkData.eventId,
        guestIds: bulkData.guestIds?.length || 0,
        method: bulkData.method
      },
      options
    });

    try {
      // Validation des données d'envoi en masse
      const validation = validateBulkSend(bulkData);
      if (validation.error) {
        throw new ValidationError('Données d\'envoi en masse invalides', validation.error.details);
      }

      const { eventId, guestIds, method, content, settings } = bulkData;

      // Vérifier la limite d'envoi
      if (guestIds.length > this.invitationConfig.bulkSendLimit) {
        throw new ValidationError(
          `Envoi limité à ${this.invitationConfig.bulkSendLimit} invitations. ` +
          `Demandé: ${guestIds.length}`
        );
      }

      // Récupérer les invités
      const { guestRepo } = require('./index');
      const guestsResult = await guestRepo.findAll({ eventId, id: { $in: guestIds } }, { paginate: false });

      if (guestsResult.data.length === 0) {
        throw new NotFoundError('Aucun invité trouvé pour cet événement');
      }

      const results = {
        total: guestsResult.data.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };

      // Récupérer l'événement
      const { eventRepo } = require('./index');
      const event = await eventRepo.findById(eventId, { throwIfNotFound: true });

      // Pour chaque invité, créer et envoyer l'invitation
      for (const guest of guestsResult.data) {
        try {
          // Vérifier si une invitation existe déjà
          const existingInvitation = await this.findOne({
            eventId,
            guestId: guest.id,
            status: { $ne: INVITATION_STATUS.BOUNCED }
          });

          if (existingInvitation) {
            // Si invitation existe, vérifier si on peut la renvoyer
            if (existingInvitation.isExpired() || options.forceResend) {
              await this.resendInvitation(existingInvitation.id, {
                method,
                content,
                reason: 'bulk_send'
              }, options);
            } else {
              results.skipped++;
              continue;
            }
          } else {
            // Créer une nouvelle invitation
            const invitationData = Invitation.createForGuest(guest, event, {
              template: content?.template || 'default',
              requireRSVP: settings?.requireRSVP !== false,
              allowPlusOnes: settings?.allowPlusOnes,
              maxPlusOnes: settings?.maxPlusOnes
            });

            invitationData.sendMethod = method;
            if (content) {
              invitationData.content = { ...invitationData.content, ...content };
            }

            const createResult = await this.create(invitationData, {
              ...options,
              skipNotification: true
            });

            await this.sendInvitation(createResult.invitation.id, {
              method,
              content
            }, { ...options, skipNotification: true });

            results.sent++;
          }

        } catch (error) {
          results.failed++;
          results.errors.push({
            guestId: guest.id,
            guestEmail: maskEmail(guest.email),
            error: error.message
          });
        }
      }

      this.logger.info(`Envoi en masse terminé pour événement ${eventId}`, {
        eventId,
        results: {
          sent: results.sent,
          failed: results.failed,
          skipped: results.skipped
        }
      });

      return operation.success({ results });

    } catch (error) {
      return operation.error(error, { bulkData });
    }
  }

  /**
   * @method sendReminders
   * @description Envoie des rappels pour les invitations en attente
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options d'envoi
   * @returns {Promise<Object>} Résultat de l'envoi de rappels
   */
  async sendReminders(eventId, options = {}) {
    const operation = log.trackOperation('INVITATION_SEND_REMINDERS', {
      eventId,
      options
    });

    try {
      // Récupérer les invitations en attente non expirées
      const currentDate = now().toISOString();
      const pendingInvitations = await this.findAll({
        eventId,
        status: INVITATION_STATUS.PENDING,
        expiresAt: { $gt: currentDate }
      }, { paginate: false });

      const results = {
        total: pendingInvitations.data.length,
        sent: 0,
        failed: 0,
        errors: []
      };

      // Pour chaque invitation en attente, envoyer un rappel
      for (const invitation of pendingInvitations.data) {
        try {
          // Vérifier si les rappels sont activés
          if (!invitation.settings.sendReminders) {
            results.skipped = (results.skipped || 0) + 1;
            continue;
          }

          await this.resendInvitation(invitation.id, {
            method: invitation.sendMethod,
            reason: 'reminder'
          }, options);

          results.sent++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            invitationId: invitation.id,
            guestEmail: maskEmail(invitation.guestEmail),
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
      return operation.error(error, { eventId });
    }
  }

  // ============================================================================
  // MÉTHODES DE STATISTIQUES ET ANALYSE
  // ============================================================================

  /**
   * @method getEventInvitationStats
   * @description Récupère les statistiques des invitations pour un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Statistiques complètes
   */
  async getEventInvitationStats(eventId) {
    const operation = log.trackOperation('INVITATION_GET_EVENT_STATS', {
      eventId
    });

    try {
      const invitations = await this.findByEvent(eventId, { paginate: false });

      const stats = {
        total: invitations.data.length,
        byStatus: {},
        byType: {},
        tracking: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          responded: 0,
          bounced: 0
        },
        response: {
          accepted: 0,
          declined: 0,
          tentative: 0,
          pending: 0
        },
        engagement: {
          openRate: 0,
          clickRate: 0,
          responseRate: 0,
          averageOpens: 0,
          averageClicks: 0
        }
      };

      let totalOpens = 0;
      let totalClicks = 0;

      invitations.data.forEach(invitation => {
        // Par statut
        stats.byStatus[invitation.status] = (stats.byStatus[invitation.status] || 0) + 1;

        // Par type
        stats.byType[invitation.type] = (stats.byType[invitation.type] || 0) + 1;

        // Tracking
        if (invitation.isSent()) stats.tracking.sent++;
        if (invitation.isDelivered()) stats.tracking.delivered++;
        if (invitation.isOpened()) stats.tracking.opened++;
        if (invitation.tracking.clickCount > 0) stats.tracking.clicked++;
        if (invitation.isResponded()) stats.tracking.responded++;
        if (invitation.tracking.bounceCount > 0) stats.tracking.bounced++;

        // Réponse
        if (invitation.isResponded()) {
          const responseStatus = invitation.response.status || 'pending';
          stats.response[responseStatus] = (stats.response[responseStatus] || 0) + 1;
        } else {
          stats.response.pending++;
        }

        // Engagement
        totalOpens += invitation.tracking.openCount;
        totalClicks += invitation.tracking.clickCount;
      });

      // Calculer les taux
      if (stats.tracking.sent > 0) {
        stats.engagement.openRate = Math.round((stats.tracking.opened / stats.tracking.sent) * 100);
        stats.engagement.clickRate = Math.round((stats.tracking.clicked / stats.tracking.sent) * 100);
        stats.engagement.responseRate = Math.round((stats.tracking.responded / stats.tracking.sent) * 100);
        stats.engagement.averageOpens = totalOpens / stats.tracking.opened || 0;
        stats.engagement.averageClicks = totalClicks / stats.tracking.clicked || 0;
      }

      return operation.success({ stats });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method getInvitationAnalytics
   * @description Récupère des analyses détaillées sur les invitations
   * @param {string} invitationId - ID de l'invitation
   * @returns {Promise<Object>} Analyses détaillées
   */
  async getInvitationAnalytics(invitationId) {
    const operation = log.trackOperation('INVITATION_GET_ANALYTICS', {
      invitationId
    });

    try {
      const invitation = await this.findById(invitationId, { throwIfNotFound: true });

      const analytics = {
        invitation: {
          id: invitation.id,
          guestName: invitation.guestName,
          guestEmail: maskEmail(invitation.guestEmail),
          status: invitation.status,
          type: invitation.type,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt
        },
        tracking: {
          summary: invitation.getTrackingSummary(),
          timeline: invitation.history.slice(0, 10), // 10 dernières actions
          details: {
            sentAt: invitation.tracking.sentAt,
            deliveredAt: invitation.tracking.deliveredAt,
            openedAt: invitation.tracking.openedAt,
            clickedAt: invitation.tracking.clickedAt,
            respondedAt: invitation.tracking.respondedAt
          },
          metrics: {
            openCount: invitation.tracking.openCount,
            clickCount: invitation.tracking.clickCount,
            bounceCount: invitation.tracking.bounceCount,
            lastActivity: invitation.tracking.lastOpened || invitation.tracking.lastClicked
          }
        },
        response: invitation.response || {},
        performance: {
          timeToOpen: invitation.tracking.sentAt && invitation.tracking.openedAt ?
            this.calculateTimeDifference(invitation.tracking.sentAt, invitation.tracking.openedAt) : null,
          timeToClick: invitation.tracking.openedAt && invitation.tracking.clickedAt ?
            this.calculateTimeDifference(invitation.tracking.openedAt, invitation.tracking.clickedAt) : null,
          timeToResponse: invitation.tracking.sentAt && invitation.tracking.respondedAt ?
            this.calculateTimeDifference(invitation.tracking.sentAt, invitation.tracking.respondedAt) : null
        }
      };

      return operation.success({ analytics });

    } catch (error) {
      return operation.error(error, { invitationId });
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES ET HELPERS
  // ============================================================================

  /**
   * @method sendEmailInvitation
   * @description Envoie une invitation par email (méthode interne)
   * @param {Invitation} invitation - Instance d'invitation
   * @param {Object} event - Données de l'événement
   * @param {Object} content - Contenu de l'invitation
   * @returns {Promise<Object>} Résultat de l'envoi
   * @private
   */
  async sendEmailInvitation(invitation, event, content) {
    try {
      const publicUrl = invitation.generatePublicUrl(process.env.APP_URL || 'https://secura.com');

      const result = await sendTemplateEmail({
        to: invitation.guestEmail,
        subject: content.subject || invitation.content.subject,
        template: content.template || invitation.content.template,
        data: {
          guestName: invitation.guestName,
          eventName: event.name,
          eventDate: formatDate(event.date, DATE_FORMATS.LONG_DATE),
          eventTime: event.time,
          eventLocation: event.location,
          invitationUrl: publicUrl,
          message: content.message || invitation.content.message,
          token: invitation.token
        }
      });

      return {
        method: 'email',
        messageId: result.messageId,
        success: true
      };

    } catch (error) {
      throw new AppError(`Échec envoi email: ${error.message}`, 500, 'EMAIL_SEND_FAILED');
    }
  }

  /**
   * @method sendSMSInvitation
   * @description Envoie une invitation par SMS (méthode interne)
   * @param {Invitation} invitation - Instance d'invitation
   * @param {Object} event - Données de l'événement
   * @param {Object} content - Contenu de l'invitation
   * @returns {Promise<Object>} Résultat de l'envoi
   * @private
   */
  async sendSMSInvitation(invitation, event, content) {
    // Implémentation simplifiée - à compléter avec un service SMS
    if (!invitation.guestPhone) {
      throw new AppError('Numéro de téléphone requis pour SMS', 400, 'PHONE_REQUIRED');
    }

    const publicUrl = invitation.generatePublicUrl(process.env.APP_URL || 'https://secura.com');
    const message = content.message || `Invitation à ${event.name}. Lien: ${publicUrl}`;

    // Logique d'envoi SMS à implémenter
    this.logger.info(`[SMS] Envoi à ${invitation.guestPhone}: ${message}`);

    return {
      method: 'sms',
      success: true,
      preview: message.substring(0, 50) + '...'
    };
  }

  /**
   * @method sendWhatsAppInvitation
   * @description Envoie une invitation par WhatsApp (méthode interne)
   * @param {Invitation} invitation - Instance d'invitation
   * @param {Object} event - Données de l'événement
   * @param {Object} content - Contenu de l'invitation
   * @returns {Promise<Object>} Résultat de l'envoi
   * @private
   */
  async sendWhatsAppInvitation(invitation, event, content) {
    // Implémentation simplifiée - à compléter avec WhatsApp Business API
    if (!invitation.guestPhone) {
      throw new AppError('Numéro de téléphone requis pour WhatsApp', 400, 'PHONE_REQUIRED');
    }

    const publicUrl = invitation.generatePublicUrl(process.env.APP_URL || 'https://secura.com');
    const message = content.message || `*Invitation à ${event.name}*\n\nLien: ${publicUrl}`;

    // Logique d'envoi WhatsApp à implémenter
    this.logger.info(`[WhatsApp] Envoi à ${invitation.guestPhone}`);

    return {
      method: 'whatsapp',
      success: true
    };
  }

  /**
   * @method updateGuestStatusFromResponse
   * @description Met à jour le statut d'un invité basé sur la réponse à l'invitation
   * @param {Invitation} invitation - Instance d'invitation
   * @param {Object} responseData - Données de réponse
   * @returns {Promise<void>}
   * @private
   */
  async updateGuestStatusFromResponse(invitation, responseData) {
    try {
      const { guestRepo } = require('./index');

      const guest = await guestRepo.findById(invitation.guestId);
      if (!guest) return;

      let guestStatus = 'pending';

      switch (responseData.status) {
        case 'accepted':
          guestStatus = 'confirmed';
          break;
        case 'declined':
          guestStatus = 'cancelled';
          break;
        case 'tentative':
          guestStatus = 'pending';
          break;
      }

      if (guest.status !== guestStatus) {
        await guestRepo.updateGuest(guest.id, {
          status: guestStatus,
          metadata: {
            ...guest.metadata,
            lastInvitationResponse: responseData.status,
            responseDate: new Date().toISOString()
          }
        }, { reason: 'invitation_response_update' });
      }

    } catch (error) {
      this.logger.warning('Erreur mise à jour statut invité depuis réponse', {
        invitationId: invitation.id,
        guestId: invitation.guestId,
        error: error.message
      });
    }
  }

  /**
   * @method calculateTimeDifference
   * @description Calcule la différence de temps entre deux dates
   * @param {string} startDate - Date de début
   * @param {string} endDate - Date de fin
   * @returns {string} Différence formatée
   * @private
   */
  calculateTimeDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}min`;
    }
    return `${diffMinutes}min`;
  }

  /**
   * @method checkEventInvitationLimit
   * @description Vérifie si un événement a atteint sa limite d'invitations
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<void>}
   * @throws {AppError} Si limite atteinte
   */
  async checkEventInvitationLimit(eventId) {
    const invitations = await this.findByEvent(eventId, { paginate: false });

    if (invitations.data.length >= this.invitationConfig.maxInvitationsPerEvent) {
      throw new AppError(
        `Limite d'invitations atteinte pour cet événement (${this.invitationConfig.maxInvitationsPerEvent})`,
        400,
        'INVITATION_LIMIT_REACHED'
      );
    }
  }

  /**
   * @method checkTokenUniqueness
   * @description Vérifie l'unicité d'un token d'invitation
   * @param {string} token - Token à vérifier
   * @param {string} [excludeInvitationId] - ID d'invitation à exclure
   * @returns {Promise<void>}
   * @throws {ValidationError} Si le token existe déjà
   */
  async checkTokenUniqueness(token, excludeInvitationId = null) {
    const existingInvitation = await this.findOne({ token });

    if (existingInvitation && existingInvitation.id !== excludeInvitationId) {
      throw new ValidationError('Token déjà utilisé', [
        { field: 'token', value: token, type: 'unique' }
      ]);
    }
  }

  /**
   * @method sanitizeInvitationData
   * @description Nettoie les données d'invitation pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeInvitationData(data) {
    const sanitized = { ...data };

    if (sanitized.guestEmail) sanitized.guestEmail = maskEmail(sanitized.guestEmail);
    if (sanitized.guestPhone) sanitized.guestPhone = '***';
    if (sanitized.token) sanitized.token = '***';

    return sanitized;
  }

  /**
   * @method sanitizeSearchCriteria
   * @description Nettoie les critères de recherche pour les logs
   * @param {Object} criteria - Critères à nettoyer
   * @returns {Object} Critères nettoyées
   */
  sanitizeSearchCriteria(criteria) {
    const sanitized = { ...criteria };

    if (sanitized.query) sanitized.query = sanitizeString(sanitized.query);
    if (sanitized.guestEmail) sanitized.guestEmail = maskEmail(sanitized.guestEmail);

    return sanitized;
  }

  /**
   * @method getUniqueFields
   * @description Retourne les champs avec contrainte d'unicité
   * @returns {string[]} Liste des champs uniques
   */
  getUniqueFields() {
    return ['token'];
  }

  /**
   * @method validate
   * @description Valide les données d'une invitation
   * @param {Object} invitationData - Données à valider
   * @returns {Object} Résultat de validation
   */
  validate(invitationData) {
    return validateCreateInvitation(invitationData);
  }

  /**
   * @method validateUpdate
   * @description Valide les mises à jour d'une invitation
   * @param {Object} updates - Mises à jour à valider
   * @returns {Object} Résultat de validation
   */
  validateUpdate(updates) {
    return validateUpdateInvitation(updates);
  }

  /**
   * @method prepareDocument
   * @description Prépare un document invitation avant sauvegarde
   * @param {Object} data - Données du document
   * @param {string} operation - Type d'opération (create/update)
   * @returns {Object} Document préparé
   */
  prepareDocument(data, operation = 'create') {
    const document = super.prepareDocument(data, operation);

    // Normaliser le nom de l'invité
    if (document.guestName) {
      document.guestName = capitalizeWords(document.guestName.trim());
    }

    // Normaliser l'email
    if (document.guestEmail) {
      document.guestEmail = document.guestEmail.toLowerCase().trim();
    }

    // Générer un token si manquant
    if (!document.token) {
      document.token = generateInvitationToken();
    }

    return document;
  }

  // ============================================================================
  // MÉTHODES DE SANTÉ ET MAINTENANCE
  // ============================================================================

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository invitation
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();

    try {
      const stats = await this.getEventInvitationStats('*'); // Pour tous les événements
      const expiredInvitations = await this.findExpiredInvitations({ paginate: false });

      return {
        ...baseHealth,
        invitationSpecific: {
          totalInvitations: stats.stats.total,
          sentInvitations: stats.stats.tracking.sent,
          respondedInvitations: stats.stats.tracking.responded,
          expiredInvitations: expiredInvitations.data.length
        },
        status: 'healthy'
      };

    } catch (error) {
      return {
        ...baseHealth,
        invitationSpecific: {
          error: error.message
        },
        status: 'degraded'
      };
    }
  }

  /**
   * @method cleanupExpiredInvitations
   * @description Nettoie les invitations expirées
   * @param {number} daysAfterExpiry - Jours après expiration
   * @returns {Promise<number>} Nombre d'invitations nettoyées
   */
  async cleanupExpiredInvitations(daysAfterExpiry = 30) {
    const operation = log.trackOperation('INVITATION_CLEANUP_EXPIRED', { daysAfterExpiry });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAfterExpiry);

      const expiredInvitations = await this.findAll({
        expiresAt: { $lt: cutoffDate.toISOString() },
        status: { $ne: INVITATION_STATUS.RESPONDED }
      }, { paginate: false });

      let cleaned = 0;

      for (const invitation of expiredInvitations.data) {
        await this.delete(invitation.id, {
          softDelete: true,
          reason: 'auto_cleanup_expired'
        });
        cleaned++;
      }

      this.logger.info(`${cleaned} invitations expirées nettoyées`, {
        daysAfterExpiry,
        cleaned
      });

      return operation.success({ cleaned });

    } catch (error) {
      return operation.error(error, { daysAfterExpiry });
    }
  }

  /**
   * @method fixTrackingInconsistencies
   * @description Corrige les incohérences de suivi dans les invitations
   * @returns {Promise<Object>} Résultat des corrections
   */
  async fixTrackingInconsistencies() {
    const operation = log.trackOperation('INVITATION_FIX_TRACKING');

    try {
      const results = {
        fixed: 0,
        errors: []
      };

      const allInvitations = await this.findAll({}, { paginate: false });

      for (const invitation of allInvitations.data) {
        try {
          let needsUpdate = false;
          const updates = {};

          // Incohérence 1: status=SENT mais sentAt manquant
          if (invitation.status === INVITATION_STATUS.SENT && !invitation.tracking.sentAt) {
            updates.status = INVITATION_STATUS.PENDING;
            results.fixed++;
            needsUpdate = true;
          }

          // Incohérence 2: sentAt présent mais status différent
          if (invitation.tracking.sentAt && invitation.status !== INVITATION_STATUS.SENT) {
            updates.status = INVITATION_STATUS.SENT;
            results.fixed++;
            needsUpdate = true;
          }

          // Incohérence 3: respondedAt présent mais status différent
          if (invitation.tracking.respondedAt && invitation.status !== INVITATION_STATUS.RESPONDED) {
            updates.status = INVITATION_STATUS.RESPONDED;
            results.fixed++;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await super.update(invitation.id, updates, {
              reason: 'tracking_fix',
              skipValidation: true
            });
          }

        } catch (error) {
          results.errors.push({
            invitationId: invitation.id,
            error: error.message
          });
        }
      }

      this.logger.info(`Incohérences de suivi corrigées`, results);

      return operation.success({ results });

    } catch (error) {
      return operation.error(error);
    }
  }
}

module.exports = InvitationRepository;