/**
 * @file invitationModel.js
 * @description Modèle Invitation pour Secura avec validation complète.
 * Gère l'envoi, le suivi et la gestion des invitations.
 * @module models/invitationModel
 * @requires helpers/idGenerator
 * @requires utils/constants
 */

const { generateInvitationId, generateInvitationToken } = require('../utils/helpers/idGenerator');
const { STATUS, INVITATION_STATUS } = require('../utils/constants');

/**
 * @class Invitation
 * @description Classe représentant une invitation dans Secura.
 * Gère l'envoi, le suivi et les statistiques des invitations.
 */
class Invitation {
  /**
   * @constructor
   * @param {Object} data - Données de l'invitation
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {string} data.guestId - ID de l'invité (requis)
   * @param {string} data.guestEmail - Email de l'invité
   * @param {string} data.guestName - Nom de l'invité
   * @param {string} [data.type='email'] - Type d'invitation
   * @param {string} [data.status=INVITATION_STATUS.PENDING] - Statut de l'invitation
   * @param {Object} [data.content] - Contenu de l'invitation
   * @param {Object} [data.tracking] - Suivi de l'invitation
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.createdAt] - Date de création
   * @param {Date} [data.updatedAt] - Date de modification
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateInvitationId();
    this.eventId = data.eventId || '';
    this.guestId = data.guestId || '';
    this.token = data.token || generateInvitationToken();

    // Informations de l'invité
    this.guestEmail = data.guestEmail ? data.guestEmail.toLowerCase().trim() : '';
    this.guestName = data.guestName ? data.guestName.trim() : '';
    this.guestPhone = data.guestPhone ? data.guestPhone.trim() : '';

    // Type et statut
    this.type = data.type || 'email';
    this.status = data.status || INVITATION_STATUS.PENDING;
    this.sendMethod = data.sendMethod || 'system';

    // Contenu de l'invitation
    this.content = {
      subject: data.content?.subject || 'Invitation à un événement',
      message: data.content?.message || '',
      template: data.content?.template || 'default',
      locale: data.content?.locale || 'fr',
      ...data.content
    };

    // Suivi et statistiques
    this.tracking = {
      sentAt: data.tracking?.sentAt || null,
      deliveredAt: data.tracking?.deliveredAt || null,
      openedAt: data.tracking?.openedAt || null,
      clickedAt: data.tracking?.clickedAt || null,
      respondedAt: data.tracking?.respondedAt || null,
      openCount: parseInt(data.tracking?.openCount) || 0,
      clickCount: parseInt(data.tracking?.clickCount) || 0,
      bounceCount: parseInt(data.tracking?.bounceCount) || 0,
      lastOpened: data.tracking?.lastOpened || null,
      lastClicked: data.tracking?.lastClicked || null,
      ...data.tracking
    };

    this.settings = {
      requireRSVP: data.settings?.requireRSVP !== false,
      allowPlusOnes: Boolean(data.settings?.allowPlusOnes) || false,
      maxPlusOnes: parseInt(data.settings?.maxPlusOnes) || 0,
      sendReminders: data.settings?.sendReminders !== false,
      reminderDays: data.settings?.reminderDays || [7, 3, 1],
      ...data.settings
    };

    // Métadonnées
    this.metadata = {
      sentBy: data.metadata?.sentBy || 'system',
      campaignId: data.metadata?.campaignId || null,
      batchId: data.metadata?.batchId || null,
      ipAddress: data.metadata?.ipAddress || null,
      userAgent: data.metadata?.userAgent || null,
      ...data.metadata
    };

    // Réponse de l'invité
    this.response = {
      status: data.response?.status || 'pending',
      respondedAt: data.response?.respondedAt || null,
      message: data.response?.message || '',
      plusOnes: parseInt(data.response?.plusOnes) || 0,
      dietaryRequirements: data.response?.dietaryRequirements || '',
      specialRequests: data.response?.specialRequests || '',
      ...data.response
    };

    // Historique
    this.history = data.history || [];

    // Timestamps
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.expiresAt = data.expiresAt || null;
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON de l'invitation
   * @returns {Object} Invitation formatée pour JSON
   */
  toJSON() {
    return {
      ...this,
      isSent: this.isSent(),
      isDelivered: this.isDelivered(),
      isOpened: this.isOpened(),
      isResponded: this.isResponded(),
      isExpired: this.isExpired(),
      trackingSummary: this.getTrackingSummary()
    };
  }

  /**
   * @method markAsSent
   * @description Marque l'invitation comme envoyée
   * @param {Object} sendData - Données d'envoi
   */
  markAsSent(sendData = {}) {
    this.status = INVITATION_STATUS.SENT;
    this.tracking.sentAt = new Date().toISOString();
    
    this.history.unshift({
      action: 'sent',
      timestamp: this.tracking.sentAt,
      method: sendData.method || this.sendMethod,
      details: sendData.details || {}
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method markAsDelivered
   * @description Marque l'invitation comme délivrée
   */
  markAsDelivered() {
    this.tracking.deliveredAt = new Date().toISOString();
    
    this.history.unshift({
      action: 'delivered',
      timestamp: this.tracking.deliveredAt
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method markAsOpened
   * @description Marque l'invitation comme ouverte
   * @param {Object} openData - Données d'ouverture
   */
  markAsOpened(openData = {}) {
    this.tracking.openedAt = this.tracking.openedAt || new Date().toISOString();
    this.tracking.openCount++;
    this.tracking.lastOpened = new Date().toISOString();
    
    this.history.unshift({
      action: 'opened',
      timestamp: this.tracking.lastOpened,
      ipAddress: openData.ipAddress,
      userAgent: openData.userAgent
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method markAsClicked
   * @description Marque l'invitation comme cliquée
   * @param {Object} clickData - Données de clic
   */
  markAsClicked(clickData = {}) {
    this.tracking.clickedAt = this.tracking.clickedAt || new Date().toISOString();
    this.tracking.clickCount++;
    this.tracking.lastClicked = new Date().toISOString();
    
    this.history.unshift({
      action: 'clicked',
      timestamp: this.tracking.lastClicked,
      link: clickData.link,
      ipAddress: clickData.ipAddress
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method recordBounce
   * @description Enregistre un bounce de l'invitation
   * @param {Object} bounceData - Données de bounce
   */
  recordBounce(bounceData = {}) {
    this.tracking.bounceCount++;
    this.status = INVITATION_STATUS.BOUNCED;
    
    this.history.unshift({
      action: 'bounced',
      timestamp: new Date().toISOString(),
      reason: bounceData.reason,
      code: bounceData.code
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method recordResponse
   * @description Enregistre une réponse de l'invité
   * @param {Object} responseData - Données de réponse
   */
  recordResponse(responseData = {}) {
    this.response = {
      ...this.response,
      ...responseData,
      respondedAt: new Date().toISOString()
    };

    this.status = INVITATION_STATUS.RESPONDED;
    this.tracking.respondedAt = this.response.respondedAt;
    
    this.history.unshift({
      action: 'responded',
      timestamp: this.response.respondedAt,
      status: this.response.status,
      message: this.response.message
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method isSent
   * @description Vérifie si l'invitation a été envoyée
   * @returns {boolean} True si envoyée
   */
  isSent() {
    return !!this.tracking.sentAt;
  }

  /**
   * @method isDelivered
   * @description Vérifie si l'invitation a été délivrée
   * @returns {boolean} True si délivrée
   */
  isDelivered() {
    return !!this.tracking.deliveredAt;
  }

  /**
   * @method isOpened
   * @description Vérifie si l'invitation a été ouverte
   * @returns {boolean} True si ouverte
   */
  isOpened() {
    return !!this.tracking.openedAt;
  }

  /**
   * @method isResponded
   * @description Vérifie si l'invitation a reçu une réponse
   * @returns {boolean} True si répondue
   */
  isResponded() {
    return !!this.tracking.respondedAt;
  }

  /**
   * @method isExpired
   * @description Vérifie si l'invitation est expirée
   * @returns {boolean} True si expirée
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  }

  /**
   * @method getTrackingSummary
   * @description Retourne un résumé du suivi
   * @returns {Object} Résumé du suivi
   */
  getTrackingSummary() {
    return {
      sent: this.isSent(),
      delivered: this.isDelivered(),
      opened: this.isOpened(),
      responded: this.isResponded(),
      openCount: this.tracking.openCount,
      clickCount: this.tracking.clickCount,
      bounceCount: this.tracking.bounceCount,
      lastActivity: this.tracking.lastOpened || this.tracking.lastClicked || this.tracking.sentAt
    };
  }

  /**
   * @method generatePublicUrl
   * @description Génère l'URL publique de l'invitation
   * @param {string} baseUrl - URL de base de l'application
   * @returns {string} URL publique
   */
  generatePublicUrl(baseUrl) {
    return `${baseUrl}/invitation/${this.token}`;
  }

  /**
   * @method setExpiration
   * @description Définit la date d'expiration
   * @param {Date|string} expirationDate - Date d'expiration
   */
  setExpiration(expirationDate) {
    this.expiresAt = new Date(expirationDate).toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method updateContent
   * @description Met à jour le contenu de l'invitation
   * @param {Object} newContent - Nouveau contenu
   */
  updateContent(newContent) {
    this.content = {
      ...this.content,
      ...newContent
    };
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method resend
   * @description Prépare l'invitation pour un renvoi
   * @param {Object} resendData - Données de renvoi
   */
  resend(resendData = {}) {
    this.status = INVITATION_STATUS.PENDING;
    this.tracking.sentAt = null;
    this.tracking.deliveredAt = null;
    this.tracking.openedAt = null;
    this.tracking.clickedAt = null;
    
    if (resendData.content) {
      this.updateContent(resendData.content);
    }

    this.history.unshift({
      action: 'resend_prepared',
      timestamp: new Date().toISOString(),
      reason: resendData.reason
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @static fromJSON
   * @description Crée une instance Invitation depuis JSON
   * @param {Object} json - Données JSON
   * @returns {Invitation} Instance Invitation
   */
  static fromJSON(json) {
    return new Invitation(json);
  }

  /**
   * @static createForGuest
   * @description Crée une invitation pour un invité
   * @param {Object} guestData - Données de l'invité
   * @param {Object} eventData - Données de l'événement
   * @param {Object} options - Options d'invitation
   * @returns {Invitation} Instance Invitation
   */
  static createForGuest(guestData, eventData, options = {}) {
    return new Invitation({
      eventId: guestData.eventId,
      guestId: guestData.id,
      guestEmail: guestData.email,
      guestName: guestData.getFullName(),
      guestPhone: guestData.phone,
      content: {
        subject: `Invitation - ${eventData.name}`,
        message: eventData.welcomeMessage || `Vous êtes invité à ${eventData.name}`,
        template: options.template || 'default'
      },
      settings: {
        requireRSVP: options.requireRSVP !== false,
        allowPlusOnes: Boolean(options.allowPlusOnes),
        maxPlusOnes: parseInt(options.maxPlusOnes) || 0
      },
      metadata: {
        sentBy: options.sentBy || 'system'
      }
    });
  }
}

module.exports = Invitation;