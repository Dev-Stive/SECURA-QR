/**
 * @file messageRepo.js
 * @description Repository ultra-complet pour la gestion des messages dans Secura.
 * Gère les messages, vœux et commentaires des invités avec modération et interactions.
 * @module repositories/messageRepo
 * @requires ./baseRepo
 * @requires ../models/messageModel
 * @requires ../utils/validation/messageValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/logger
 * @requires ../utils/helpers/dateHelper
 */

const BaseRepository = require('./baseRepo');
const Message = require('../models/messageModel');
const {
  validateMessage,
  validateCreateMessage,
  validateUpdateMessage,
  validateMessageModeration,
  validateMessageComment
} = require('../utils/validation/messageValidation');
const {
  AppError,
  ValidationError,
  ConflictError
} = require('../utils/errorHandler');
const { STATUS } = require('../utils/constants');
const log = require('../utils/logger');

/**
 * @class MessageRepository
 * @description Repository spécialisé pour la gestion des messages
 * @extends BaseRepository
 */
class MessageRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('messages', {
      enableCache: true,
      cacheTTL: 240, // 4 minutes
      enableAudit: true,
      softDelete: true, // Soft delete pour conserver l'historique
      validationRequired: true,
      maxRetries: 3,
      ...options
    });
    
    // Configuration spécifique aux messages
    this.messageConfig = {
      maxMessagesPerEvent: 5000,
      maxMessageLength: 1000,
      autoModerateThreshold: 3, // Signalements avant masquage automatique
      maxRepliesPerMessage: 100,
      maxLikesPerMessage: 1000,
      moderationEnabled: true,
      retentionDays: 365,
      ...options.messageConfig
    };
    
    this.logger = log.withContext({
      repository: 'MessageRepository',
      collection: 'messages'
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
      
      // Créer les index spécifiques
      await this.createIndexes();
      
      this.logger.info('MessageRepository initialisé', {
        maxMessagesPerEvent: this.messageConfig.maxMessagesPerEvent,
        moderationEnabled: this.messageConfig.moderationEnabled
      });
    } catch (error) {
      this.logger.error('Erreur initialisation MessageRepository', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method createIndexes
   * @description Crée les index spécifiques aux messages
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      const indexes = [
        { field: 'eventId', type: 'hash' },
        { field: 'status', type: 'hash' },
        { field: 'type', type: 'hash' },
        { field: 'isPublic', type: 'hash' },
        { field: 'featured', type: 'hash' },
        { field: 'createdAt', type: 'range', descending: true },
        { field: 'parentMessageId', type: 'hash' },
        { field: 'metadata.category', type: 'hash' },
        { field: 'metadata.sentiment', type: 'hash' }
      ];
      
      this.logger.debug('Index messages créés', { indexes: indexes.length });
    } catch (error) {
      this.logger.warning('Erreur création index messages', { error: error.message });
    }
  }

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée un nouveau message
   * @param {Object} messageData - Données du message
   * @param {Object} options - Options
   * @returns {Promise<Message>} Message créé
   */
  async create(messageData, options = {}) {
    const operation = log.trackOperation('MESSAGE_CREATE', {
      data: this.sanitizeMessageData(messageData),
      options
    });
    
    try {
      // Validation
      const validation = validateCreateMessage(messageData);
      if (validation.error) {
        throw new ValidationError(
          'Données message invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      // Vérifier limite messages par événement
      await this.checkEventMessageLimit(messageData.eventId);
      
      // Créer l'instance
      const message = new Message(messageData);
      
      // Appliquer la modération automatique si configurée
      if (options.autoModerate !== false && this.messageConfig.moderationEnabled) {
        message.autoModerate();
      }
      
      // Si c'est une réponse, vérifier le message parent
      if (message.type === 'reply' && message.parentMessageId) {
        const parent = await this.findById(message.parentMessageId);
        if (!parent.found || !parent.found.canBeReplied()) {
          throw new AppError('Impossible de répondre à ce message', 400, 'CANNOT_REPLY');
        }
      }
      
      // Sauvegarder via BaseRepo
      const result = await super.create(message.toJSON(), options);
      
      // Audit
      this.logger.crud('CREATE', 'messages', {
        messageId: message.id,
        eventId: message.eventId,
        type: message.type,
        author: message.getDisplayAuthor(),
        status: message.status
      });
      
      // Invalider caches associés
      await this.invalidateEventCache(message.eventId);
      if (message.parentMessageId) {
        await this.invalidateParentCache(message.parentMessageId);
      }
      
      return operation.success({ message, saved: result.created });
    } catch (error) {
      return operation.error(error, {
        data: this.sanitizeMessageData(messageData)
      });
    }
  }

  /**
   * @method findById
   * @description Trouve un message par ID
   * @param {string} id - ID du message
   * @param {Object} options - Options
   * @returns {Promise<Message|null>} Message trouvé
   */
  async findById(id, options = {}) {
    const result = await super.findById(id, options);
    
    if (!result.found) {
      return result;
    }
    
    const message = Message.fromJSON(result.found);
    
    return { 
      found: message, 
      fromCache: result.fromCache || false 
    };
  }

  /**
   * @method findAll
   * @description Trouve tous les messages
   * @param {Object} filters - Filtres
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultats
   */
  async findAll(filters = {}, options = {}) {
    const result = await super.findAll(filters, options);
    
    // Instancier les modèles
    result.data = result.data.map(messageData => Message.fromJSON(messageData));
    
    return result;
  }

  /**
   * @method update
   * @description Met à jour un message
   * @param {string} id - ID du message
   * @param {Object} updates - Mises à jour
   * @param {Object} options - Options
   * @returns {Promise<Message>} Message mis à jour
   */
  async update(id, updates, options = {}) {
    const existing = await this.findById(id, { throwIfNotFound: true });
    const message = existing.found;
    
    // Validation
    const validation = validateUpdateMessage(updates);
    if (validation.error) {
      throw new ValidationError(
        'Mises à jour message invalides',
        validation.error.details.map(d => d.message)
      );
    }
    
    // Appliquer les mises à jour
    Object.assign(message, updates);
    message.updatedAt = new Date().toISOString();
    
    // Mettre à jour via BaseRepo
    const result = await super.update(id, message.toJSON(), options);
    
    // Invalider caches
    await this.invalidateCache(id);
    await this.invalidateEventCache(message.eventId);
    
    return { updated: message, ...result };
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE SPÉCIFIQUES
  // ============================================================================

  /**
   * @method findByEvent
   * @description Trouve les messages d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} Messages trouvés
   */
  async findByEvent(eventId, options = {}) {
    const cacheKey = this.getCacheKey(`event:${eventId}:messages:${JSON.stringify(options)}`);
    
    if (this.options.enableCache && !options.forceRefresh) {
      const cached = await this.cacheManager?.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }
    
    const filters = { eventId };
    if (options.status) filters.status = options.status;
    if (options.type) filters.type = options.type;
    if (options.isPublic !== undefined) filters.isPublic = options.isPublic;
    if (options.featured !== undefined) filters.featured = options.featured;
    
    // Exclure les réponses par défaut
    if (options.includeReplies === false) {
      filters.parentMessageId = null;
    }
    
    const result = await this.findAll(filters, {
      ...options,
      sort: options.sort || { createdAt: 'desc' }
    });
    
    if (this.options.enableCache) {
      await this.cacheManager?.set(cacheKey, result, { ttl: 300 });
    }
    
    return { ...result, fromCache: false };
  }

  /**
   * @method findByAuthor
   * @description Trouve les messages d'un auteur
   * @param {string} authorId - ID de l'auteur
   * @param {Object} options - Options
   * @returns {Promise<Object>} Messages trouvés
   */
  async findByAuthor(authorId, options = {}) {
    return this.findAll({ authorId }, options);
  }

  /**
   * @method findPublishedMessages
   * @description Trouve les messages publiés
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} Messages publiés
   */
  async findPublishedMessages(eventId, options = {}) {
    return this.findByEvent(eventId, {
      ...options,
      status: STATUS.ACTIVE,
      isPublic: true
    });
  }

  /**
   * @method findFeaturedMessages
   * @description Trouve les messages mis en avant
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} Messages mis en avant
   */
  async findFeaturedMessages(eventId, options = {}) {
    return this.findByEvent(eventId, {
      ...options,
      status: STATUS.ACTIVE,
      isPublic: true,
      featured: true
    });
  }

  /**
   * @method findPendingModeration
   * @description Trouve les messages en attente de modération
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} Messages en attente
   */
  async findPendingModeration(eventId, options = {}) {
    return this.findByEvent(eventId, {
      ...options,
      status: STATUS.PENDING
    });
  }

  /**
   * @method findMessageReplies
   * @description Trouve les réponses d'un message
   * @param {string} messageId - ID du message parent
   * @param {Object} options - Options
   * @returns {Promise<Object>} Réponses trouvées
   */
  async findMessageReplies(messageId, options = {}) {
    return this.findAll({
      parentMessageId: messageId,
      status: STATUS.ACTIVE,
      isPublic: true
    }, {
      ...options,
      sort: { createdAt: 'asc' }
    });
  }

  // ============================================================================
  // MÉTHODES DE MODÉRATION
  // ============================================================================

  /**
   * @method approveMessage
   * @description Approuve un message
   * @param {string} messageId - ID du message
   * @param {Object} moderationData - Données de modération
   * @returns {Promise<Message>} Message approuvé
   */
  async approveMessage(messageId, moderationData = {}) {
    const operation = log.trackOperation('MESSAGE_APPROVE', {
      messageId,
      moderatorId: moderationData.moderatorId
    });
    
    try {
      // Validation
      const validation = validateMessageModeration({
        messageId,
        action: 'approve',
        ...moderationData
      });
      if (validation.error) {
        throw new ValidationError(
          'Données modération invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const message = await this.findById(messageId, { throwIfNotFound: true });
      
      message.found.approve(moderationData.moderatorId, moderationData.reason);
      
      // Mettre à jour le message
      const result = await this.update(messageId, message.found.toJSON(), {
        reason: 'message_approved',
        skipValidation: true
      });
      
      this.logger.info('Message approuvé', {
        messageId,
        moderatorId: moderationData.moderatorId
      });
      
      return operation.success({ message: result.updated });
    } catch (error) {
      return operation.error(error, { messageId });
    }
  }

  /**
   * @method rejectMessage
   * @description Rejette un message
   * @param {string} messageId - ID du message
   * @param {Object} moderationData - Données de modération
   * @returns {Promise<Message>} Message rejeté
   */
  async rejectMessage(messageId, moderationData = {}) {
    const operation = log.trackOperation('MESSAGE_REJECT', {
      messageId,
      moderatorId: moderationData.moderatorId,
      reason: moderationData.reason?.substring(0, 50)
    });
    
    try {
      // Validation
      const validation = validateMessageModeration({
        messageId,
        action: 'reject',
        ...moderationData
      });
      if (validation.error) {
        throw new ValidationError(
          'Données modération invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const message = await this.findById(messageId, { throwIfNotFound: true });
      
      message.found.reject(moderationData.moderatorId, moderationData.reason);
      
      // Mettre à jour le message
      const result = await this.update(messageId, message.found.toJSON(), {
        reason: 'message_rejected',
        skipValidation: true
      });
      
      this.logger.info('Message rejeté', {
        messageId,
        moderatorId: moderationData.moderatorId,
        reason: moderationData.reason
      });
      
      return operation.success({ message: result.updated });
    } catch (error) {
      return operation.error(error, { messageId });
    }
  }

  /**
   * @method autoModerateMessage
   * @description Applique la modération automatique à un message
   * @param {string} messageId - ID du message
   * @returns {Promise<Message>} Message modéré
   */
  async autoModerateMessage(messageId) {
    const message = await this.findById(messageId, { throwIfNotFound: true });
    
    const previousStatus = message.found.status;
    message.found.autoModerate();
    
    const result = await this.update(messageId, message.found.toJSON(), {
      reason: 'auto_moderation',
      skipValidation: true
    });
    
    if (previousStatus !== message.found.status) {
      this.logger.info('Message auto-modéré', {
        messageId,
        previousStatus,
        newStatus: message.found.status
      });
    }
    
    return { message: result.updated };
  }

  // ============================================================================
  // MÉTHODES D'INTERACTION
  // ============================================================================

  /**
   * @method addLike
   * @description Ajoute un like à un message
   * @param {string} messageId - ID du message
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Message mis à jour
   */
  async addLike(messageId, userId) {
    const operation = log.trackOperation('MESSAGE_ADD_LIKE', {
      messageId,
      userId
    });
    
    try {
      const message = await this.findById(messageId, { throwIfNotFound: true });
      
      if (!message.found.canBeLiked()) {
        throw new AppError('Ce message ne peut pas être liké', 400, 'CANNOT_LIKE');
      }
      
      const liked = message.found.addLike(userId);
      if (!liked) {
        throw new ConflictError('Message déjà liké');
      }
      
      // Vérifier si le message devient mis en avant automatiquement
      if (message.found.interactions.likes >= this.messageConfig.maxLikesPerMessage / 10) {
        message.found.markAsFeatured();
      }
      
      // Mettre à jour le message
      const result = await this.update(messageId, message.found.toJSON(), {
        reason: 'like_added',
        skipValidation: true
      });
      
      return operation.success({ 
        message: result.updated,
        likes: message.found.interactions.likes 
      });
    } catch (error) {
      return operation.error(error, { messageId, userId });
    }
  }

  /**
   * @method removeLike
   * @description Retire un like d'un message
   * @param {string} messageId - ID du message
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Message mis à jour
   */
  async removeLike(messageId, userId) {
    const operation = log.trackOperation('MESSAGE_REMOVE_LIKE', {
      messageId,
      userId
    });
    
    try {
      const message = await this.findById(messageId, { throwIfNotFound: true });
      
      const removed = message.found.removeLike(userId);
      if (!removed) {
        throw new AppError('Message non liké', 400, 'NOT_LIKED');
      }
      
      // Mettre à jour le message
      const result = await this.update(messageId, message.found.toJSON(), {
        reason: 'like_removed',
        skipValidation: true
      });
      
      return operation.success({ 
        message: result.updated,
        likes: message.found.interactions.likes 
      });
    } catch (error) {
      return operation.error(error, { messageId, userId });
    }
  }

  /**
   * @method addReport
   * @description Signale un message
   * @param {string} messageId - ID du message
   * @param {string} userId - ID de l'utilisateur
   * @param {string} reason - Raison du signalement
   * @returns {Promise<Object>} Message signalé
   */
  async addReport(messageId, userId, reason = '') {
    const operation = log.trackOperation('MESSAGE_ADD_REPORT', {
      messageId,
      userId,
      reason: reason?.substring(0, 50)
    });
    
    try {
      const message = await this.findById(messageId, { throwIfNotFound: true });
      
      const reported = message.found.addReport(userId, reason);
      if (!reported) {
        throw new ConflictError('Message déjà signalé');
      }
      
      // Vérifier si besoin de masquer automatiquement
      if (message.found.interactions.reports >= this.messageConfig.autoModerateThreshold) {
        message.found.status = STATUS.PENDING;
        message.found.isPublic = false;
        message.found.moderation.autoModerated = true;
        message.found.moderation.moderationReason = 'Signalements multiples';
      }
      
      // Mettre à jour le message
      const result = await this.update(messageId, message.found.toJSON(), {
        reason: 'report_added',
        skipValidation: true
      });
      
      this.logger.warning('Message signalé', {
        messageId,
        userId,
        reports: message.found.interactions.reports,
        nowPublic: message.found.isPublic
      });
      
      return operation.success({ 
        message: result.updated,
        reports: message.found.interactions.reports 
      });
    } catch (error) {
      return operation.error(error, { messageId, userId });
    }
  }

  /**
   * @method addReply
   * @description Ajoute une réponse à un message
   * @param {string} messageId - ID du message parent
   * @param {Object} replyData - Données de la réponse
   * @param {Object} options - Options
   * @returns {Promise<Object>} Réponse créée
   */
  async addReply(messageId, replyData, options = {}) {
    const operation = log.trackOperation('MESSAGE_ADD_REPLY', {
      messageId,
      author: replyData.author
    });
    
    try {
      const parentMessage = await this.findById(messageId, { throwIfNotFound: true });
      
      if (!parentMessage.found.canBeReplied()) {
        throw new AppError('Impossible de répondre à ce message', 400, 'CANNOT_REPLY');
      }
      
      // Vérifier limite de réponses
      if (parentMessage.found.replyCount >= this.messageConfig.maxRepliesPerMessage) {
        throw new AppError(
          `Limite de réponses atteinte (max: ${this.messageConfig.maxRepliesPerMessage})`,
          400,
          'REPLY_LIMIT'
        );
      }
      
      // Créer la réponse
      const reply = parentMessage.found.addReply({
        ...replyData,
        eventId: parentMessage.found.eventId,
        parentMessageId: messageId
      });
      
      // Sauvegarder la réponse comme nouveau message
      const savedReply = await this.create(reply.toJSON(), {
        ...options,
        autoModerate: this.messageConfig.moderationEnabled
      });
      
      // Mettre à jour le message parent avec la réponse
      parentMessage.found.replies.push(reply.toJSON());
      parentMessage.found.replyCount = parentMessage.found.replies.length;
      
      await this.update(messageId, parentMessage.found.toJSON(), {
        reason: 'reply_added',
        skipValidation: true
      });
      
      this.logger.info('Réponse ajoutée', {
        parentMessageId: messageId,
        replyId: savedReply.message.id,
        author: replyData.author
      });
      
      return operation.success({ 
        reply: savedReply.message,
        parentMessage: parentMessage.found 
      });
    } catch (error) {
      return operation.error(error, { messageId });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES MESSAGES
  // ============================================================================

  /**
   * @method markAsFeatured
   * @description Marque un message comme mis en avant
   * @param {string} messageId - ID du message
   * @returns {Promise<Message>} Message mis en avant
   */
  async markAsFeatured(messageId) {
    const message = await this.findById(messageId, { throwIfNotFound: true });
    
    message.found.markAsFeatured();
    
    const result = await this.update(messageId, message.found.toJSON(), {
      reason: 'marked_featured',
      skipValidation: true
    });
    
    this.logger.info('Message mis en avant', { messageId });
    
    return { message: result.updated };
  }

  /**
   * @method unmarkAsFeatured
   * @description Désélectionne un message comme mis en avant
   * @param {string} messageId - ID du message
   * @returns {Promise<Message>} Message désélectionné
   */
  async unmarkAsFeatured(messageId) {
    const message = await this.findById(messageId, { throwIfNotFound: true });
    
    message.found.unmarkAsFeatured();
    
    const result = await this.update(messageId, message.found.toJSON(), {
      reason: 'unmarked_featured',
      skipValidation: true
    });
    
    return { message: result.updated };
  }

  /**
   * @method updateContent
   * @description Met à jour le contenu d'un message
   * @param {string} messageId - ID du message
   * @param {string} newContent - Nouveau contenu
   * @param {string} editorId - ID de l'éditeur
   * @returns {Promise<Message>} Message mis à jour
   */
  async updateContent(messageId, newContent, editorId) {
    const message = await this.findById(messageId, { throwIfNotFound: true });
    
    if (newContent.length > this.messageConfig.maxMessageLength) {
      throw new AppError(
        `Contenu trop long (max: ${this.messageConfig.maxMessageLength} caractères)`,
        400,
        'CONTENT_TOO_LONG'
      );
    }
    
    message.found.updateContent(newContent, editorId);
    
    const result = await this.update(messageId, message.found.toJSON(), {
      reason: 'content_updated',
      skipValidation: true
    });
    
    return { message: result.updated };
  }

  // ============================================================================
  // MÉTHODES DE STATISTIQUES
  // ============================================================================

  /**
   * @method getMessageStats
   * @description Récupère les statistiques d'un message
   * @param {string} messageId - ID du message
   * @returns {Promise<Object>} Statistiques
   */
  async getMessageStats(messageId) {
    const message = await this.findById(messageId, { throwIfNotFound: true });
    
    return {
      ...message.found.getMessageInfo(),
      replies: message.found.replyCount,
      approvedReplies: message.found.getReplies().length,
      likes: message.found.interactions.likes,
      reports: message.found.interactions.reports,
      likedBy: message.found.interactions.likedBy.length,
      reportedBy: message.found.interactions.reportedBy.length
    };
  }

  /**
   * @method getEventMessageStats
   * @description Statistiques globales des messages d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Statistiques
   */
  async getEventMessageStats(eventId) {
    const messages = await this.findByEvent(eventId, { paginate: false });
    const publishedMessages = await this.findPublishedMessages(eventId, { paginate: false });
    const featuredMessages = await this.findFeaturedMessages(eventId, { paginate: false });
    const pendingMessages = await this.findPendingModeration(eventId, { paginate: false });
    
    const stats = {
      totalMessages: messages.data.length,
      publishedMessages: publishedMessages.data.length,
      featuredMessages: featuredMessages.data.length,
      pendingModeration: pendingMessages.data.length,
      byType: {},
      bySentiment: {},
      byStatus: {},
      totalLikes: 0,
      totalReplies: 0,
      totalReports: 0,
      mostLikedMessage: null,
      mostRepliedMessage: null
    };
    
    // Analyser les messages publiés
    publishedMessages.data.forEach(message => {
      // Par type
      stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;
      
      // Par sentiment
      const sentiment = message.metadata.sentiment || 'neutral';
      stats.bySentiment[sentiment] = (stats.bySentiment[sentiment] || 0) + 1;
      
      // Totaux
      stats.totalLikes += message.interactions.likes;
      stats.totalReplies += message.replyCount;
      stats.totalReports += message.interactions.reports;
      
      // Message le plus aimé
      if (!stats.mostLikedMessage || message.interactions.likes > stats.mostLikedMessage.likes) {
        stats.mostLikedMessage = {
          id: message.id,
          author: message.getDisplayAuthor(),
          likes: message.interactions.likes,
          content: message.getShortContent(50)
        };
      }
      
      // Message avec le plus de réponses
      if (!stats.mostRepliedMessage || message.replyCount > stats.mostRepliedMessage.replies) {
        stats.mostRepliedMessage = {
          id: message.id,
          author: message.getDisplayAuthor(),
          replies: message.replyCount,
          content: message.getShortContent(50)
        };
      }
    });
    
    // Analyser tous les messages pour le statut
    messages.data.forEach(message => {
      stats.byStatus[message.status] = (stats.byStatus[message.status] || 0) + 1;
    });
    
    return stats;
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * @method checkEventMessageLimit
   * @description Vérifie la limite de messages par événement
   * @param {string} eventId - ID de l'événement
   * @throws {AppError} Si limite atteinte
   */
  async checkEventMessageLimit(eventId) {
    const count = await this.count({ eventId });
    if (count >= this.messageConfig.maxMessagesPerEvent) {
      throw new AppError(
        `Limite de messages atteinte pour cet événement (max: ${this.messageConfig.maxMessagesPerEvent})`,
        400,
        'MESSAGE_LIMIT'
      );
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
   * @method invalidateParentCache
   * @description Invalide le cache pour un message parent
   * @param {string} parentMessageId - ID du message parent
   */
  async invalidateParentCache(parentMessageId) {
    if (!this.options.enableCache) return;
    
    const pattern = this.getCacheKey(`parent:${parentMessageId}:*`);
    await this.cacheManager?.deleteByPattern(pattern);
  }

  /**
   * @method sanitizeMessageData
   * @description Nettoie les données de message pour les logs
   * @param {Object} data - Données
   * @returns {Object} Données nettoyées
   */
  sanitizeMessageData(data) {
    const sanitized = { ...data };
    
    if (sanitized.content) {
      sanitized.content = sanitized.content.substring(0, 100) + '...';
    }
    
    if (sanitized.authorEmail) {
      const [local, domain] = sanitized.authorEmail.split('@');
      sanitized.authorEmail = `${local.substring(0, 2)}***@${domain}`;
    }
    
    return sanitized;
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
      // Statistiques spécifiques
      const totalMessages = await this.count();
      const publishedMessages = await this.count({ 
        status: STATUS.ACTIVE, 
        isPublic: true 
      });
      
      return {
        ...baseHealth,
        messageSpecific: {
          totalMessages,
          publishedMessages,
          maxMessagesPerEvent: this.messageConfig.maxMessagesPerEvent,
          maxMessageLength: this.messageConfig.maxMessageLength,
          moderationEnabled: this.messageConfig.moderationEnabled
        },
        status: baseHealth.status === 'healthy' ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        ...baseHealth,
        messageSpecific: { error: error.message },
        status: 'degraded'
      };
    }
  }
}

module.exports = MessageRepository;