/**
 * @file eventValidation.js
 * @description Validation Joi pour les événements Secura.
 * @module utils/validation/eventValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { EVENT_TYPES, STATUS } = require('../constants');

const eventSettingsSchema = Joi.object({
  qrValidation: Joi.boolean().default(true),
  multipleEntries: Joi.boolean().default(false),
  requireConfirmation: Joi.boolean().default(false),
  sendReminders: Joi.boolean().default(true),
  autoConfirm: Joi.boolean().default(false),
  privateEvent: Joi.boolean().default(false),
  maxGuestsPerUser: Joi.number().integer().min(1).max(100).default(1),
  galleryEnabled: Joi.boolean().default(true),
  tableQRsEnabled: Joi.boolean().default(false),
  offlineMode: Joi.boolean().default(true)
});

// Schéma pour le design de l'événement
const eventDesignSchema = Joi.object({
  primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#3B82F6'),
  secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#1E40AF'),
  logo: Joi.string().uri().allow(null).default(null),
  backgroundImage: Joi.string().uri().allow(null).default(null),
  customCSS: Joi.string().max(5000).allow(null).default(null)
});

// Schéma pour les statistiques de l'événement
const eventStatsSchema = Joi.object({
  totalGuests: Joi.number().integer().min(0).default(0),
  confirmedGuests: Joi.number().integer().min(0).default(0),
  scannedGuests: Joi.number().integer().min(0).default(0),
  totalScans: Joi.number().integer().min(0).default(0),
  scanRate: Joi.number().min(0).max(100).default(0),
  lastScan: Joi.date().iso().allow(null).default(null)
});

// Schéma principal pour l'événement
const eventSchema = Joi.object({
  id: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).optional(),
  organizerId: Joi.string().pattern(/^usr_\d+_[a-zA-Z0-9]{12}$/).allow(null).default(null),
  
  name: Joi.string().min(3).max(100).required().trim()
    .messages({
      'string.min': 'Nom requis (min 3 caractères)',
      'string.max': 'Nom trop long (max 100 caractères)',
      'any.required': 'Nom de l\'événement requis'
    }),
  
  type: Joi.string().valid(...Object.values(EVENT_TYPES)).default(EVENT_TYPES.OTHER),
  
  date: Joi.date().iso().required()
    .messages({
      'date.base': 'Date invalide',
      'any.required': 'Date de l\'événement requise'
    }),
  
  time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('00:00')
    .messages({
      'string.pattern.base': 'Format d\'heure invalide (HH:MM)'
    }),
  
  location: Joi.string().min(3).max(200).required().trim()
    .messages({
      'string.min': 'Lieu requis (min 3 caractères)',
      'string.max': 'Lieu trop long (max 200 caractères)',
      'any.required': 'Lieu de l\'événement requis'
    }),
  
  capacity: Joi.number().integer().min(0).max(100000).default(0),
  
  description: Joi.string().max(1000).allow('').default(''),
  
  welcomeMessage: Joi.string().max(500).allow('').default(''),
  
  active: Joi.boolean().default(true),
  status: Joi.string().valid(...Object.values(STATUS)).default(STATUS.ACTIVE),
  
  settings: eventSettingsSchema.default(),
  design: eventDesignSchema.default(),
  stats: eventStatsSchema.default(),
  
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date())
});

// Schéma pour la création d'événement
const createEventSchema = eventSchema.keys({
  name: Joi.string().min(3).max(100).required().trim(),
  date: Joi.date().iso().required(),
  location: Joi.string().min(3).max(200).required().trim()
});

// Schéma pour la mise à jour d'événement
const updateEventSchema = Joi.object({
  name: Joi.string().min(3).max(100).trim().optional(),
  type: Joi.string().valid(...Object.values(EVENT_TYPES)).optional(),
  date: Joi.date().iso().optional(),
  time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  location: Joi.string().min(3).max(200).trim().optional(),
  capacity: Joi.number().integer().min(0).max(100000).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  welcomeMessage: Joi.string().max(500).allow('').optional(),
  active: Joi.boolean().optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  settings: eventSettingsSchema.optional(),
  design: eventDesignSchema.optional()
}).min(1);

// Schéma pour les paramètres de mise à jour
const updateEventSettingsSchema = Joi.object({
  qrValidation: Joi.boolean().optional(),
  multipleEntries: Joi.boolean().optional(),
  requireConfirmation: Joi.boolean().optional(),
  sendReminders: Joi.boolean().optional(),
  autoConfirm: Joi.boolean().optional(),
  privateEvent: Joi.boolean().optional(),
  maxGuestsPerUser: Joi.number().integer().min(1).max(100).optional(),
  galleryEnabled: Joi.boolean().optional(),
  tableQRsEnabled: Joi.boolean().optional(),
  offlineMode: Joi.boolean().optional()
});

// Schéma pour le design de mise à jour
const updateEventDesignSchema = Joi.object({
  primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  logo: Joi.string().uri().allow(null).optional(),
  backgroundImage: Joi.string().uri().allow(null).optional(),
  customCSS: Joi.string().max(5000).allow(null).optional()
});

// Fonctions de validation
const validateEvent = (eventData) => {
  return eventSchema.validate(eventData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateEvent = (eventData) => {
  return createEventSchema.validate(eventData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateEvent = (eventData) => {
  return updateEventSchema.validate(eventData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateEventSettings = (settingsData) => {
  return updateEventSettingsSchema.validate(settingsData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateEventDesign = (designData) => {
  return updateEventDesignSchema.validate(designData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  eventSchema,
  createEventSchema,
  updateEventSchema,
  eventSettingsSchema,
  eventDesignSchema,
  eventStatsSchema,
  updateEventSettingsSchema,
  updateEventDesignSchema,
  
  validateEvent,
  validateCreateEvent,
  validateUpdateEvent,
  validateEventSettings,
  validateEventDesign
};