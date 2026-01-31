/**
 * @file guestValidation.js
 * @description Validation Joi pour les invités Secura.
 * @module utils/validation/guestValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { STATUS } = require('../constants');

const guestMetadataSchema = Joi.object({
  category: Joi.string().max(50).default('standard'),
  tableNumber: Joi.alternatives().try(
    Joi.string().max(20),
    Joi.number().integer()
  ).allow(null).default(null),
  specialRequirements: Joi.string().max(500).allow('').default(''),
  invitationSent: Joi.boolean().default(false),
  confirmed: Joi.boolean().default(false)
});

// Schéma pour l'historique de scan
const scanHistorySchema = Joi.object({
  timestamp: Joi.date().iso().required(),
  scannerId: Joi.string().required(),
  scannerName: Joi.string().max(100).required(),
  location: Joi.string().max(100).allow('').default(''),
  scanId: Joi.string().optional()
});

// Schéma pour l'historique de confirmation
const confirmationHistorySchema = Joi.object({
  timestamp: Joi.date().iso().required(),
  method: Joi.string().max(50).default('manual'),
  confirmedBy: Joi.string().optional(),
  notes: Joi.string().max(200).allow('').default('')
});

// Schéma principal pour l'invité
const guestSchema = Joi.object({
  id: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).optional(),
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  firstName: Joi.string().max(50).trim().allow('').optional(),
  lastName: Joi.string().max(50).trim().allow('').optional(),
  
  email: Joi.string().email().trim().lowercase().allow('').optional()
    .messages({
      'string.email': 'Format email invalide'
    }),
  
  phone: Joi.string().pattern(/^[\d\s\+\-\(\)]{8,20}$/).trim().allow('').optional()
    .messages({
      'string.pattern.base': 'Format téléphone invalide'
    }),
  
  company: Joi.string().max(100).trim().allow('').default(''),
  notes: Joi.string().max(500).trim().allow('').default(''),
  seats: Joi.number().integer().min(1).max(100).default(1),
  
  status: Joi.string().valid(...Object.values(STATUS)).default(STATUS.PENDING),
  scanned: Joi.boolean().default(false),
  scannedAt: Joi.date().iso().allow(null).default(null),
  scanCount: Joi.number().integer().min(0).default(0),
  
  qrCodeId: Joi.string().pattern(/^qr_\d+_[a-zA-Z0-9]{12}$/).allow(null).default(null),
  qrCodeData: Joi.object().allow(null).default(null),
  
  metadata: guestMetadataSchema.default(),
  scanHistory: Joi.array().items(scanHistorySchema).default([]),
  confirmationHistory: Joi.array().items(confirmationHistorySchema).default([]),
  
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date())
}).custom((value, helpers) => {
  // Validation personnalisée : au moins un prénom ou nom requis
  const { firstName, lastName } = value;
  if (!firstName && !lastName) {
    return helpers.error('any.custom', {
      message: 'Prénom ou nom requis'
    });
  }
  return value;
});

// Schéma pour la création d'invité
const createGuestSchema = guestSchema.keys({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
}).custom((value, helpers) => {
  const { firstName, lastName } = value;
  if (!firstName && !lastName) {
    return helpers.error('any.custom', {
      message: 'Prénom ou nom requis'
    });
  }
  return value;
});

// Schéma pour la mise à jour d'invité
const updateGuestSchema = Joi.object({
  firstName: Joi.string().max(50).trim().allow('').optional(),
  lastName: Joi.string().max(50).trim().allow('').optional(),
  email: Joi.string().email().trim().lowercase().allow('').optional(),
  phone: Joi.string().pattern(/^[\d\s\+\-\(\)]{8,20}$/).trim().allow('').optional(),
  company: Joi.string().max(100).trim().allow('').optional(),
  notes: Joi.string().max(500).trim().allow('').optional(),
  seats: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  metadata: guestMetadataSchema.optional()
}).min(1);

// Schéma pour l'import en masse d'invités
const bulkGuestSchema = Joi.array().items(
  createGuestSchema
).max(1000)
.messages({
  'array.max': 'Trop d\'invités en une seule fois (max 1000)'
});

// Schéma pour le scan d'invité
const guestScanSchema = Joi.object({
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID invité requis'
    }),
  
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  scannerId: Joi.string().required()
    .messages({
      'any.required': 'ID scanner requis'
    }),
  
  scannerName: Joi.string().max(100).optional(),
  location: Joi.string().max(100).allow('').default('')
});

// Schéma pour la confirmation d'invité
const guestConfirmationSchema = Joi.object({
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required(),
  method: Joi.string().max(50).default('manual'),
  confirmedBy: Joi.string().optional(),
  notes: Joi.string().max(200).allow('').default('')
});

// Fonctions de validation
const validateGuest = (guestData) => {
  return guestSchema.validate(guestData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateGuest = (guestData) => {
  return createGuestSchema.validate(guestData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateGuest = (guestData) => {
  return updateGuestSchema.validate(guestData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateBulkGuests = (guestsData) => {
  return bulkGuestSchema.validate(guestsData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateGuestScan = (scanData) => {
  return guestScanSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateGuestConfirmation = (confirmationData) => {
  return guestConfirmationSchema.validate(confirmationData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  guestSchema,
  createGuestSchema,
  updateGuestSchema,
  bulkGuestSchema,
  guestScanSchema,
  guestConfirmationSchema,
  guestMetadataSchema,
  
  validateGuest,
  validateCreateGuest,
  validateUpdateGuest,
  validateBulkGuests,
  validateGuestScan,
  validateGuestConfirmation
};