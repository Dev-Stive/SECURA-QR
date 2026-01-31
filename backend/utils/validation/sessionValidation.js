/**
 * @file sessionValidation.js
 * @description Validation Joi pour les sessions agents Secura.
 * @module utils/validation/sessionValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { STATUS } = require('../constants');

// Schéma pour un agent de session
const sessionAgentSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().max(50).required(),
  email: Joi.string().email().optional(),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  avatar: Joi.string().uri().allow(null).default(null),
  status: Joi.string().valid('active', 'inactive', 'away').default('active'),
  joinedAt: Joi.date().iso().required(),
  lastPing: Joi.date().iso().required(),
  deviceInfo: Joi.object().optional(),
  connectionId: Joi.string().required()
});

// Schéma pour les paramètres de session
const sessionSettingsSchema = Joi.object({
  heartbeatInterval: Joi.number().integer().min(1000).max(120000).default(30000),
  inactivityTimeout: Joi.number().integer().min(5000).max(300000).default(45000),
  maxSessionDuration: Joi.number().integer().min(60000).max(86400000).default(3600000),
  allowMultipleDevices: Joi.boolean().default(false),
  autoCleanup: Joi.boolean().default(true)
});

// Schéma pour les statistiques de session
const sessionStatsSchema = Joi.object({
  totalConnections: Joi.number().integer().min(0).default(0),
  peakAgents: Joi.number().integer().min(0).default(0),
  totalScans: Joi.number().integer().min(0).default(0),
  averageResponseTime: Joi.number().min(0).default(0)
});

// Schéma pour les métadonnées de session
const sessionMetadataSchema = Joi.object({
  createdBy: Joi.string().optional(),
  location: Joi.string().max(100).optional(),
  timezone: Joi.string().default('Africa/Douala'),
  version: Joi.string().default('1.0')
});

// Schéma pour l'historique de connexion
const connectionHistorySchema = Joi.object({
  agentId: Joi.string().required(),
  action: Joi.string().valid('joined', 'left', 'timeout').required(),
  timestamp: Joi.date().iso().required(),
  connectionId: Joi.string().required(),
  duration: Joi.number().optional()
});

// Schéma pour le journal d'activité
const activityLogSchema = Joi.object({
  timestamp: Joi.date().iso().required(),
  action: Joi.string().required(),
  agentId: Joi.string().optional(),
  details: Joi.object().optional()
});

// Schéma principal pour la session
const sessionSchema = Joi.object({
  id: Joi.string().pattern(/^sess_\d+_[a-zA-Z0-9]{12}$/).optional(),
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  eventName: Joi.string().min(2).max(100).required().trim()
    .messages({
      'string.min': 'Nom d\'événement requis (min 2 caractères)',
      'string.max': 'Nom d\'événement trop long (max 100 caractères)',
      'any.required': 'Nom d\'événement requis'
    }),
  
  agents: Joi.array().items(sessionAgentSchema).default([]),
  agentCount: Joi.number().integer().min(0).default(0),
  maxAgents: Joi.number().integer().min(1).max(100).default(10),
  
  status: Joi.string().valid(...Object.values(STATUS)).default(STATUS.ACTIVE),
  isActive: Joi.boolean().default(true),
  lastActivity: Joi.date().iso().default(() => new Date()),
  
  settings: sessionSettingsSchema.default(),
  stats: sessionStatsSchema.default(),
  metadata: sessionMetadataSchema.default(),
  
  connectionHistory: Joi.array().items(connectionHistorySchema).default([]),
  activityLog: Joi.array().items(activityLogSchema).default([]),
  
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date()),
  startedAt: Joi.date().iso().default(() => new Date()),
  endedAt: Joi.date().iso().allow(null).default(null)
});

// Schéma pour la création de session
const createSessionSchema = sessionSchema.keys({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required(),
  eventName: Joi.string().min(2).max(100).required().trim()
});

// Schéma pour la mise à jour de session
const updateSessionSchema = Joi.object({
  eventName: Joi.string().min(2).max(100).trim().optional(),
  maxAgents: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  isActive: Joi.boolean().optional(),
  settings: sessionSettingsSchema.optional()
}).min(1);

// Schéma pour la jointure à une session
const joinSessionSchema = Joi.object({
  agentId: Joi.string().required()
    .messages({
      'any.required': 'ID agent requis'
    }),
  
  agentName: Joi.string().max(50).optional(),
  agentEmail: Joi.string().email().optional(),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  avatar: Joi.string().uri().optional(),
  deviceInfo: Joi.object().optional()
}).or('agentName', 'agentEmail')
.messages({
  'object.missing': 'Nom ou email d\'agent requis'
});

// Schéma pour le heartbeat de session
const sessionHeartbeatSchema = Joi.object({
  agentId: Joi.string().required()
    .messages({
      'any.required': 'ID agent requis'
    }),
  
  sessionId: Joi.string().pattern(/^sess_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID session requis'
    })
});

// Schéma pour la sortie de session
const leaveSessionSchema = Joi.object({
  agentId: Joi.string().required()
    .messages({
      'any.required': 'ID agent requis'
    }),
  
  sessionId: Joi.string().pattern(/^sess_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID session requis'
    }),
  
  reason: Joi.string().max(100).allow('').default('left')
});

const agentPresenceSchema = Joi.object({
  agentId: Joi.string().required()
    .messages({
      'any.required': 'ID agent requis'
    }),
  
  sessionId: Joi.string().pattern(/^sess_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID session requis'
    }),
  
  status: Joi.string().valid('active', 'inactive', 'away').required()
    .messages({
      'any.only': 'Statut de présence invalide',
      'any.required': 'Statut de présence requis'
    })
});

// Schéma pour les statistiques de session
const sessionStatsUpdateSchema = Joi.object({
  sessionId: Joi.string().pattern(/^sess_\d+_[a-zA-Z0-9]{12}$/).required(),
  totalScans: Joi.number().integer().min(0).optional(),
  averageResponseTime: Joi.number().min(0).optional(),
  peakAgents: Joi.number().integer().min(0).optional()
});

// Fonctions de validation
const validateSession = (sessionData) => {
  return sessionSchema.validate(sessionData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateSession = (sessionData) => {
  return createSessionSchema.validate(sessionData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateSession = (sessionData) => {
  return updateSessionSchema.validate(sessionData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateJoinSession = (joinData) => {
  return joinSessionSchema.validate(joinData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateSessionHeartbeat = (heartbeatData) => {
  return sessionHeartbeatSchema.validate(heartbeatData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateLeaveSession = (leaveData) => {
  return leaveSessionSchema.validate(leaveData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateAgentPresence = (presenceData) => {
  return agentPresenceSchema.validate(presenceData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateSessionStats = (statsData) => {
  return sessionStatsUpdateSchema.validate(statsData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  sessionSchema,
  createSessionSchema,
  updateSessionSchema,
  joinSessionSchema,
  sessionHeartbeatSchema,
  leaveSessionSchema,
  agentPresenceSchema,
  sessionStatsUpdateSchema,
  sessionAgentSchema,
  sessionSettingsSchema,
  sessionStatsSchema,
  
  validateSession,
  validateCreateSession,
  validateUpdateSession,
  validateJoinSession,
  validateSessionHeartbeat,
  validateLeaveSession,
  validateAgentPresence,
  validateSessionStats
};