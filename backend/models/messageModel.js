/**
 * @file messageModel.js
 * @description Modèle Message pour Secura avec validation complète.
 * Gère les messages, vœux et commentaires des invités.
 * @module models/messageModel
 * @requires helpers/idGenerator
 * @requires utils/constants
 */

const { generateMessageId } = require('../utils/helpers/idGenerator');
const { STATUS } = require('../utils/constants');

/**
 * @class Message
 * @description Classe représentant un message/vœu dans Secura.
 * Gère les messages des invités avec modération et interactions.
 */
class Message {
  /**
   * @constructor
   * @param {Object} data - Données du message
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {string} data.author - Auteur du message (requis)
   * @param {string} data.content - Contenu du message (requis)
   * @param {string} [data.type='message'] - Type de message
   * @param {string} [data.authorId] - ID de l'auteur
   * @param {string} [data.authorEmail] - Email de l'auteur
   * @param {string} [data.status=STATUS.PENDING] - Statut du message
   * @param {boolean} [data.isPublic=false] - Message public
   * @param {Object} [data.metadata] - Métadonnées du message
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.createdAt] - Date de création
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateMessageId();
    this.eventId = data.eventId || '';
    
    // Auteur et contenu
    this.author = data.author ? data.author.trim() : '';
    this.authorId = data.authorId || null;
    this.authorEmail = data.authorEmail || null;
    this.content = data.content ? data.content.trim() : '';
    this.type = data.type || 'message';

    this.status = data.status || STATUS.PENDING;
    this.isPublic = Boolean(data.isPublic);
    this.isAnonymous = Boolean(data.isAnonymous);
    this.featured = Boolean(data.featured);

    // Métadonnées
    this.metadata = {
      category: data.metadata?.category || 'general',
      tags: data.metadata?.tags || [],
      language: data.metadata?.language || 'fr',
      sentiment: data.metadata?.sentiment || 'neutral',
      source: data.metadata?.source || 'web',
      ipAddress: data.metadata?.ipAddress,
      userAgent: data.metadata?.userAgent,
      ...data.metadata
    };

    // Modération
    this.moderation = {
      moderated: false,
      moderatedBy: null,
      moderatedAt: null,
      moderationReason: null,
      autoModerated: false,
      ...data.moderation
    };

    // Interactions
    this.interactions = {
      likes: parseInt(data.interactions?.likes) || 0,
      likesCount: parseInt(data.interactions?.likesCount) || 0,
      reports: parseInt(data.interactions?.reports) || 0,
      shares: parseInt(data.interactions?.shares) || 0,
      likedBy: data.interactions?.likedBy || [],
      reportedBy: data.interactions?.reportedBy || [],
      ...data.interactions
    };

    // Réponses
    this.replies = data.replies || [];
    this.replyCount = this.replies.length;
    this.parentMessageId = data.parentMessageId || null;

    // Timestamps
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.publishedAt = data.publishedAt || null;
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON du message
   * @returns {Object} Message formaté pour JSON
   */
  toJSON() {
    return {
      ...this,
      isPublished: this.isPublished(),
      canBeLiked: this.canBeLiked(),
      canBeReplied: this.canBeReplied(),
      displayAuthor: this.getDisplayAuthor(),
      shortContent: this.getShortContent()
    };
  }

  /**
   * @method approve
   * @description Approuve le message
   * @param {string} moderatorId - ID du modérateur
   * @param {string} [reason] - Raison de l'approbation
   */
  approve(moderatorId, reason = '') {
    this.status = STATUS.ACTIVE;
    this.isPublic = true;
    this.moderation.moderated = true;
    this.moderation.moderatedBy = moderatorId;
    this.moderation.moderatedAt = new Date().toISOString();
    this.moderation.moderationReason = reason;
    this.publishedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method reject
   * @description Rejette le message
   * @param {string} moderatorId - ID du modérateur
   * @param {string} reason - Raison du rejet
   */
  reject(moderatorId, reason) {
    this.status = STATUS.CANCELLED;
    this.isPublic = false;
    this.moderation.moderated = true;
    this.moderation.moderatedBy = moderatorId;
    this.moderation.moderatedAt = new Date().toISOString();
    this.moderation.moderationReason = reason;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method autoModerate
   * @description Applique la modération automatique
   * @returns {string} Statut après modération
   */
  autoModerate() {
    // Règles de modération automatique basiques
    const blacklist = ['spam', 'publicité', 'http://', 'https://'];
    const contentLower = this.content.toLowerCase();

    const hasBlacklistedWord = blacklist.some(word => contentLower.includes(word));
    const isTooShort = this.content.length < 5;
    const isTooLong = this.content.length > 1000;

    if (hasBlacklistedWord || isTooShort || isTooLong) {
      this.status = STATUS.CANCELLED;
      this.isPublic = false;
      this.moderation.autoModerated = true;
      this.moderation.moderated = true;
      this.moderation.moderatedBy = 'system';
      this.moderation.moderatedAt = new Date().toISOString();
      this.moderation.moderationReason = 'Modération automatique';
    } else {
      this.status = STATUS.ACTIVE;
      this.isPublic = true;
      this.publishedAt = new Date().toISOString();
    }

    this.updatedAt = new Date().toISOString();
    return this.status;
  }

  /**
   * @method isPublished
   * @description Vérifie si le message est publié
   * @returns {boolean} True si publié
   */
  isPublished() {
    return this.status === STATUS.ACTIVE && this.isPublic;
  }

  /**
   * @method canBeLiked
   * @description Vérifie si le message peut être liké
   * @returns {boolean} True si likable
   */
  canBeLiked() {
    return this.isPublished() && !this.isAnonymous;
  }

  /**
   * @method canBeReplied
   * @description Vérifie si on peut répondre au message
   * @returns {boolean} True si on peut répondre
   */
  canBeReplied() {
    return this.isPublished() && this.type !== 'reply';
  }

  /**
   * @method getDisplayAuthor
   * @description Retourne le nom d'affichage de l'auteur
   * @returns {string} Nom d'affichage
   */
  getDisplayAuthor() {
    if (this.isAnonymous) {
      return 'Anonyme';
    }
    return this.author || 'Invité';
  }

  /**
   * @method getShortContent
   * @description Retourne une version raccourcie du contenu
   * @param {number} maxLength - Longueur maximale
   * @returns {string} Contenu raccourci
   */
  getShortContent(maxLength = 100) {
    if (this.content.length <= maxLength) {
      return this.content;
    }
    return this.content.substring(0, maxLength) + '...';
  }

  /**
   * @method addLike
   * @description Ajoute un like au message
   * @param {string} userId - ID de l'utilisateur
   * @returns {boolean} True si liké avec succès
   */
  addLike(userId) {
    if (!this.canBeLiked()) {
      return false;
    }

    if (this.interactions.likedBy.includes(userId)) {
      return false; // Déjà liké
    }

    this.interactions.likes++;
    this.interactions.likesCount++;
    this.interactions.likedBy.push(userId);
    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method removeLike
   * @description Retire un like du message
   * @param {string} userId - ID de l'utilisateur
   * @returns {boolean} True si retiré avec succès
   */
  removeLike(userId) {
    const likeIndex = this.interactions.likedBy.indexOf(userId);
    if (likeIndex === -1) {
      return false;
    }

    this.interactions.likes = Math.max(0, this.interactions.likes - 1);
    this.interactions.likesCount = Math.max(0, this.interactions.likesCount - 1);
    this.interactions.likedBy.splice(likeIndex, 1);
    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method addReport
   * @description Signale le message
   * @param {string} userId - ID de l'utilisateur
   * @param {string} reason - Raison du signalement
   * @returns {boolean} True si signalé avec succès
   */
  addReport(userId, reason = '') {
    if (this.interactions.reportedBy.includes(userId)) {
      return false; // Déjà signalé
    }

    this.interactions.reports++;
    this.interactions.reportedBy.push(userId);
    
    // Si trop de signalements, masquer automatiquement
    if (this.interactions.reports >= 3) {
      this.isPublic = false;
      this.status = STATUS.PENDING;
      this.moderation.autoModerated = true;
      this.moderation.moderationReason = 'Signalements multiples';
    }

    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method addReply
   * @description Ajoute une réponse au message
   * @param {Object} replyData - Données de la réponse
   * @returns {Object} Réponse créée
   * @throws {Error} Si on ne peut pas répondre
   */
  addReply(replyData) {
    if (!this.canBeReplied()) {
      throw new Error('Impossible de répondre à ce message');
    }

    const reply = new Message({
      ...replyData,
      eventId: this.eventId,
      type: 'reply',
      parentMessageId: this.id,
      isPublic: this.isPublic
    });

    // Auto-modérer la réponse
    reply.autoModerate();

    this.replies.push(reply.toJSON());
    this.replyCount = this.replies.length;
    this.updatedAt = new Date().toISOString();

    return reply;
  }

  /**
   * @method getReplies
   * @description Retourne les réponses approuvées
   * @returns {Array} Réponses approuvées
   */
  getReplies() {
    return this.replies.filter(reply => reply.status === STATUS.ACTIVE && reply.isPublic);
  }

  /**
   * @method markAsFeatured
   * @description Marque le message comme mis en avant
   */
  markAsFeatured() {
    this.featured = true;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method unmarkAsFeatured
   * @description Désélectionne le message comme mis en avant
   */
  unmarkAsFeatured() {
    this.featured = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method updateContent
   * @description Met à jour le contenu du message
   * @param {string} newContent - Nouveau contenu
   * @param {string} [editorId] - ID de l'éditeur
   */
  updateContent(newContent, editorId = null) {
    this.content = newContent.trim();
    
    // Réappliquer la modération si édité
    if (editorId && editorId !== this.authorId) {
      this.status = STATUS.PENDING;
      this.moderation.moderated = false;
      this.moderation.moderatedBy = null;
      this.moderation.moderatedAt = null;
    }

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method validate
   * @description Valide les données du message
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.eventId) {
      errors.push('ID événement requis');
    }

    if (!this.author || this.author.length < 2) {
      errors.push('Auteur requis (min 2 caractères)');
    }

    if (!this.content || this.content.length < 5) {
      errors.push('Contenu requis (min 5 caractères)');
    }

    if (this.content.length > 1000) {
      errors.push('Contenu trop long (max 1000 caractères)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * @method getMessageInfo
   * @description Retourne les informations du message
   * @returns {Object} Informations du message
   */
  getMessageInfo() {
    return {
      messageId: this.id,
      eventId: this.eventId,
      author: this.getDisplayAuthor(),
      content: this.content,
      type: this.type,
      status: this.status,
      isPublic: this.isPublic,
      featured: this.featured,
      likes: this.interactions.likes,
      replies: this.replyCount,
      createdAt: this.createdAt,
      publishedAt: this.publishedAt
    };
  }

  /**
   * @static fromJSON
   * @description Crée une instance Message depuis JSON
   * @param {Object} json - Données JSON
   * @returns {Message} Instance Message
   */
  static fromJSON(json) {
    return new Message(json);
  }

  /**
   * @static createWish
   * @description Crée un message de type vœu
   * @param {Object} data - Données du vœu
   * @returns {Message} Instance Message de type vœu
   */
  static createWish(data) {
    return new Message({
      ...data,
      type: 'wish',
      metadata: {
        ...data.metadata,
        category: 'wish',
        sentiment: 'positive'
      }
    });
  }

  /**
   * @static createThankYou
   * @description Crée un message de type remerciement
   * @param {Object} data - Données du remerciement
   * @returns {Message} Instance Message de type remerciement
   */
  static createThankYou(data) {
    return new Message({
      ...data,
      type: 'thankyou',
      metadata: {
        ...data.metadata,
        category: 'thankyou',
        sentiment: 'positive'
      }
    });
  }
}

module.exports = Message;