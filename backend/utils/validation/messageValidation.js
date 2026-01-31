/**
 * @file messageValidation.js
 * @description Validation Joi pour les messages Secura.
 * @module utils/validation/messageValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { STATUS } = require('../constants');

// Schéma pour les métadonnées de message
const messageMetadataSchema = Joi.object({
  category: Joi.string().max(50).default('general'),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  language: Joi.string().valid('fr', 'en', 'es').default('fr'),
  sentiment: Joi.string().valid('positive', 'negative', 'neutral').default('neutral'),
  source: Joi.string().max(50).default('web'),
  ipAddress: Joi.string().ip().allow(null).default(null),
  userAgent: Joi.string().max(500).allow(null).default(null)
});

// Schéma pour la modération de message
const messageModerationSchema = Joi.object({
  moderated: Joi.boolean().default(false),
  moderatedBy: Joi.string().allow(null).default(null),
  moderatedAt: Joi.date().iso().allow(null).default(null),
  moderationReason: Joi.string().max(200).allow(null).default(null),
  autoModerated: Joi.boolean().default(false)
});

// Schéma pour les interactions de message
const messageInteractionsSchema = Joi.object({
  likes: Joi.number().integer().min(0).default(0),
  likesCount: Joi.number().integer().min(0).default(0),
  reports: Joi.number().integer().min(0).default(0),
  shares: Joi.number().integer().min(0).default(0),
  likedBy: Joi.array().items(Joi.string()).default([]),
  reportedBy: Joi.array().items(Joi.string()).default([])
});

// Schéma pour une réponse de message
const messageReplySchema = Joi.object({
  id: Joi.string().required(),
  author: Joi.string().min(2).max(50).required(),
  authorId: Joi.string().optional(),
  authorEmail: Joi.string().email().optional(),
  content: Joi.string().min(5).max(500).required(),
  type: Joi.string().valid('reply').default('reply'),
  status: Joi.string().valid(...Object.values(STATUS)).default(STATUS.PENDING),
  isPublic: Joi.boolean().default(false),
  isAnonymous: Joi.boolean().default(false),
  metadata: messageMetadataSchema.default(),
  moderation: messageModerationSchema.default(),
  interactions: messageInteractionsSchema.default(),
  createdAt: Joi.date().iso().required(),
  updatedAt: Joi.date().iso().required(),
  publishedAt: Joi.date().iso().allow(null).default(null)
});

// Schéma principal pour le message
const messageSchema = Joi.object({
  id: Joi.string().pattern(/^msg_\d+_[a-zA-Z0-9]{12}$/).optional(),
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  author: Joi.string().min(2).max(50).required().trim()
    .messages({
      'string.min': 'Auteur requis (min 2 caractères)',
      'string.max': 'Nom d\'auteur trop long (max 50 caractères)',
      'any.required': 'Auteur requis'
    }),
  
  authorId: Joi.string().allow(null).default(null),
  authorEmail: Joi.string().email().trim().lowercase().allow(null).default(null),
  
  content: Joi.string().min(5).max(1000).required().trim()
    .messages({
      'string.min': 'Message trop court (min 5 caractères)',
      'string.max': 'Message trop long (max 1000 caractères)',
      'any.required': 'Contenu du message requis'
    }),
  
  type: Joi.string().valid('message', 'wish', 'thankyou', 'reply').default('message'),
  status: Joi.string().valid(...Object.values(STATUS)).default(STATUS.PENDING),
  isPublic: Joi.boolean().default(false),
  isAnonymous: Joi.boolean().default(false),
  featured: Joi.boolean().default(false),
  
  metadata: messageMetadataSchema.default(),
  moderation: messageModerationSchema.default(),
  interactions: messageInteractionsSchema.default(),
  
  replies: Joi.array().items(messageReplySchema).default([]),
  replyCount: Joi.number().integer().min(0).default(0),
  parentMessageId: Joi.string().allow(null).default(null),
  
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date()),
  publishedAt: Joi.date().iso().allow(null).default(null)
});

// Schéma pour la création de message
const createMessageSchema = messageSchema.keys({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required(),
  author: Joi.string().min(2).max(50).required().trim(),
  content: Joi.string().min(5).max(1000).required().trim()
});


const updateMessageSchema = Joi.object({
  author: Joi.string().min(2).max(50).trim().optional(),
  content: Joi.string().min(5).max(1000).trim().optional(),
  isPublic: Joi.boolean().optional(),
  isAnonymous: Joi.boolean().optional(),
  featured: Joi.boolean().optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  metadata: messageMetadataSchema.optional()
}).min(1);

// Schéma pour la modération de message
const moderateMessageSchema = Joi.object({
  messageId: Joi.string().pattern(/^msg_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID message requis'
    }),
  
  moderatorId: Joi.string().required()
    .messages({
      'any.required': 'ID modérateur requis'
    }),
  
  action: Joi.string().valid('approve', 'reject', 'feature', 'unfeature').required()
    .messages({
      'any.only': 'Action de modération invalide',
      'any.required': 'Action de modération requise'
    }),
  
  reason: Joi.when('action', {
    is: 'reject',
    then: Joi.string().min(5).max(200).required()
      .messages({
        'string.min': 'Raison trop courte (min 5 caractères)',
        'string.max': 'Raison trop longue (max 200 caractères)',
        'any.required': 'Raison du rejet requise'
      }),
    otherwise: Joi.string().max(200).allow('').optional()
  })
});

// Schéma pour le like de message
const likeMessageSchema = Joi.object({
  messageId: Joi.string().pattern(/^msg_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID message requis'
    }),
  
  userId: Joi.string().required()
    .messages({
      'any.required': 'ID utilisateur requis'
    })
});

// Schéma pour le signalement de message
const reportMessageSchema = Joi.object({
  messageId: Joi.string().pattern(/^msg_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID message requis'
    }),
  
  userId: Joi.string().required()
    .messages({
      'any.required': 'ID utilisateur requis'
    }),
  
  reason: Joi.string().min(5).max(200).required()
    .messages({
      'string.min': 'Raison trop courte (min 5 caractères)',
      'string.max': 'Raison trop longue (max 200 caractères)',
      'any.required': 'Raison du signalement requise'
    })
});

// Schéma pour la réponse à un message
const replyMessageSchema = Joi.object({
  parentMessageId: Joi.string().pattern(/^msg_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID message parent requis'
    }),
  
  author: Joi.string().min(2).max(50).required().trim()
    .messages({
      'string.min': 'Auteur requis (min 2 caractères)',
      'string.max': 'Nom d\'auteur trop long (max 50 caractères)',
      'any.required': 'Auteur requis'
    }),
  
  authorId: Joi.string().optional(),
  authorEmail: Joi.string().email().trim().lowercase().optional(),
  
  content: Joi.string().min(5).max(500).required().trim()
    .messages({
      'string.min': 'Réponse trop courte (min 5 caractères)',
      'string.max': 'Réponse trop longue (max 500 caractères)',
      'any.required': 'Contenu de la réponse requis'
    }),
  
  isAnonymous: Joi.boolean().default(false)
});

// Schéma pour l'import en masse de messages
const bulkMessagesSchema = Joi.array().items(
  createMessageSchema
).max(100)
.messages({
  'array.max': 'Trop de messages en une seule fois (max 100)'
});

// Fonctions de validation
const validateMessage = (messageData) => {
  return messageSchema.validate(messageData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateMessage = (messageData) => {
  return createMessageSchema.validate(messageData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateMessage = (messageData) => {
  return updateMessageSchema.validate(messageData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateModerateMessage = (moderationData) => {
  return moderateMessageSchema.validate(moderationData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateLikeMessage = (likeData) => {
  return likeMessageSchema.validate(likeData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateReportMessage = (reportData) => {
  return reportMessageSchema.validate(reportData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateReplyMessage = (replyData) => {
  return replyMessageSchema.validate(replyData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateBulkMessages = (messagesData) => {
  return bulkMessagesSchema.validate(messagesData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  messageSchema,
  createMessageSchema,
  updateMessageSchema,
  moderateMessageSchema,
  likeMessageSchema,
  reportMessageSchema,
  replyMessageSchema,
  bulkMessagesSchema,
  messageMetadataSchema,
  messageModerationSchema,
  messageInteractionsSchema,
  
  validateMessage,
  validateCreateMessage,
  validateUpdateMessage,
  validateModerateMessage,
  validateLikeMessage,
  validateReportMessage,
  validateReplyMessage,
  validateBulkMessages
};