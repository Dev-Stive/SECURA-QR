/**
 * @file qrValidation.js
 * @description Validation Joi pour les QR codes Secura.
 * Amélioration : Schémas pour tous types (invitation, table), avec conditionnels et messages détaillés.
 * Unifié avec tableQRValidation pour éviter duplication ; conditionnels sur 'type'.
 * @module utils/validation/qrValidation
 * @requires joi
 * @requires utils/constants
 */
const Joi = require('joi');
const { QR_CODES } = require('../../config/constants');

// Schéma pour la configuration du QR code
const qrConfigSchema = Joi.object({
  size: Joi.number().integer().min(100).max(1000).default(QR_CODES.GENERATION.DEFAULT_SIZE),
  foreground: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default(QR_CODES.GENERATION.COLOR_DARK)
    .messages({
      'string.pattern.base': 'Couleur foreground invalide (#RRGGBB)'
    }),
  background: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default(QR_CODES.GENERATION.COLOR_LIGHT)
    .messages({
      'string.pattern.base': 'Couleur background invalide (#RRGGBB)'
    }),
  style: Joi.string().valid('square', 'dots', 'rounded').default('square'),
  errorLevel: Joi.string().valid('L', 'M', 'Q', 'H').default(QR_CODES.GENERATION.ERROR_CORRECTION),
  includeLogo: Joi.boolean().default(true),
  margin: Joi.number().integer().min(0).max(10).default(QR_CODES.GENERATION.DEFAULT_MARGIN)
});


const qrMetadataSchema = Joi.object({
  generatedBy: Joi.string().default('system'),
  generationMethod: Joi.string().default('auto'),
  version: Joi.string().default('1.0')
});

// Schéma pour l'historique de scan
const qrScanHistorySchema = Joi.object({
  timestamp: Joi.date().iso().required()
    .messages({
      'any.required': 'Timestamp de scan requis'
    }),
  scannerId: Joi.string().required()
    .messages({
      'any.required': 'ID scanner requis'
    }),
  scannerName: Joi.string().max(100).required()
    .messages({
      'any.required': 'Nom scanner requis'
    }),
  location: Joi.string().max(100).allow('').default(''),
  scanId: Joi.string().optional()
});

// Schéma pour l'historique de génération
const qrGenerationHistorySchema = Joi.object({
  timestamp: Joi.date().iso().required(),
  method: Joi.string().required(),
  data: Joi.object().required()
});

// Schéma pour données spécifiques 'invitation'
const invitationDataSchema = Joi.object({
  t: Joi.string().valid(QR_CODES.TYPES.INVITATION).required(),
  e: Joi.string().pattern(/^evt_/).required(),
  g: Joi.string().pattern(/^gst_/).required(),
  n: Joi.string().max(100).required(),
  s: Joi.number().integer().min(1).default(1),
  d: Joi.date().iso().required(),
  sig: Joi.string().length(QR_CODES.VALIDATION.SIGNATURE_LENGTH).required()
});

// Schéma pour données spécifiques 'table'
const tableDataSchema = Joi.object({
  t: Joi.string().valid(QR_CODES.TYPES.TABLE_INFO).required(),
  e: Joi.string().pattern(/^evt_/).required(),
  tbl: Joi.alternatives().try(Joi.string().max(20), Joi.number().integer()).required(),
  d: Joi.date().iso().required(),
  sig: Joi.string().length(QR_CODES.VALIDATION.SIGNATURE_LENGTH).required(),
  content: Joi.object().optional()
});

// Schéma principal pour le QR code (conditionnel par type)
const qrCodeSchema = Joi.object({
  id: Joi.string().pattern(/^qr_\d+_[a-zA-Z0-9]{12}$/).optional(),
  guestId: Joi.when('type', {
    is: QR_CODES.TYPES.INVITATION,
    then: Joi.string().pattern(/^gst_/).required().messages({
      'any.required': 'guestId requis pour invitation'
    }),
    otherwise: Joi.string().allow('')
  }),
  eventId: Joi.string().pattern(/^evt_/).required().messages({
    'any.required': 'eventId requis'
  }),
  type: Joi.string().valid(...Object.values(QR_CODES.TYPES)).default(QR_CODES.TYPES.INVITATION),
  data: Joi.when('type', {
    is: QR_CODES.TYPES.INVITATION,
    then: invitationDataSchema.required(),
    otherwise: Joi.when('type', {
      is: QR_CODES.TYPES.TABLE_INFO,
      then: tableDataSchema.required(),
      otherwise: Joi.object().required()
    })
  }),
  rawData: Joi.string().allow('').default(''),
  config: qrConfigSchema.default(),
  imageData: Joi.string().allow(null).default(null),
  imageUrl: Joi.string().uri().allow(null).default(null),
  filePath: Joi.string().allow(null).default(null),
  active: Joi.boolean().default(true),
  scanCount: Joi.number().integer().min(0).default(0),
  lastScanned: Joi.date().iso().allow(null).default(null),
  maxScans: Joi.number().integer().min(1).default(QR_CODES.MAX_SCANS_PER_CODE),
  signature: Joi.string().allow(null).default(null),
  expiresAt: Joi.date().iso().allow(null).default(null),
  isExpired: Joi.boolean().default(false),
  metadata: qrMetadataSchema.default(),
  scanHistory: Joi.array().items(qrScanHistorySchema).default([]),
  generationHistory: Joi.array().items(qrGenerationHistorySchema).default([]),
  createdAt: Joi.date().iso().default(() => new Date().toISOString()),
  updatedAt: Joi.date().iso().default(() => new Date().toISOString())
});

// Schéma pour la création de QR code
const createQRCodeSchema = qrCodeSchema.keys({
  guestId: Joi.when('type', {
    is: QR_CODES.TYPES.INVITATION,
    then: Joi.string().pattern(/^gst_/).required(),
    otherwise: Joi.string().allow('')
  }),
  eventId: Joi.string().pattern(/^evt_/).required(),
  tableNumber: Joi.when('type', {
    is: QR_CODES.TYPES.TABLE_INFO,
    then: Joi.alternatives().try(Joi.string().max(20), Joi.number().integer()).required(),
    otherwise: Joi.any().forbidden()
  }),
  content: Joi.when('type', {
    is: QR_CODES.TYPES.TABLE_INFO,
    then: Joi.object().optional(),
    otherwise: Joi.any().forbidden()
  })
});

// Schéma pour la mise à jour de QR code
const updateQRCodeSchema = Joi.object({
  active: Joi.boolean().optional(),
  maxScans: Joi.number().integer().min(1).optional(),
  expiresAt: Joi.date().iso().allow(null).optional(),
  config: qrConfigSchema.optional(),
  content: Joi.when('type', { // Conditionnel si type 'table'
    is: QR_CODES.TYPES.TABLE_INFO,
    then: Joi.object().optional(),
    otherwise: Joi.forbidden()
  })
}).min(1);

// Schéma pour la génération de QR code
const generateQRCodeSchema = Joi.object({
  guestId: Joi.when('type', {
    is: QR_CODES.TYPES.INVITATION,
    then: Joi.string().pattern(/^gst_/).required(),
    otherwise: Joi.string().allow('')
  }),
  eventId: Joi.string().pattern(/^evt_/).required(),
  type: Joi.string().valid(...Object.values(QR_CODES.TYPES)).default(QR_CODES.TYPES.INVITATION),
  tableNumber: Joi.when('type', {
    is: QR_CODES.TYPES.TABLE_INFO,
    then: Joi.alternatives().try(Joi.string().max(20), Joi.number().integer()).required(),
    otherwise: Joi.forbidden()
  }),
  format: Joi.string().valid('dataURL', 'buffer', 'svg').default('dataURL'),
  config: qrConfigSchema.optional()
});

// Schéma pour la validation de QR code scanné
const validateQRCodeSchema = Joi.object({
  qrData: Joi.object({
    t: Joi.string().valid(...Object.values(QR_CODES.TYPES)).required(),
    e: Joi.string().required(),
    g: Joi.string().optional(),
    tbl: Joi.when('t', {
      is: QR_CODES.TYPES.TABLE_INFO,
      then: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      otherwise: Joi.forbidden()
    }),
    d: Joi.date().iso().required(),
    sig: Joi.string().length(QR_CODES.VALIDATION.SIGNATURE_LENGTH).required()
  }).required()
});

// Schéma pour le scan de QR code
const scanQRCodeSchema = Joi.object({
  qrData: Joi.object().required(),
  scannerId: Joi.string().required(),
  scannerName: Joi.string().max(100).optional(),
  location: Joi.string().max(100).allow('').default(''),
  deviceInfo: Joi.object().optional()
});

// Schéma pour la création en masse de QR codes (ex. : bulk tables)
const bulkCreateQRSchema = Joi.array().items(qrCodeSchema).max(100)
.messages({
  'array.max': 'Trop de QR codes en une seule fois (max 100)'
});

// Fonctions de validation
const validateQRCode = (qrData) => {
  return qrCodeSchema.validate(qrData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateQRCode = (qrData) => {
  return createQRCodeSchema.validate(qrData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateQRCode = (qrData) => {
  return updateQRCodeSchema.validate(qrData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateGenerateQRCode = (generateData) => {
  return generateQRCodeSchema.validate(generateData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateQRCodeData = (qrData) => {
  return validateQRCodeSchema.validate(qrData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateQRScan = (scanData) => {
  return scanQRCodeSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateBulkCreateQR = (qrData) => {
  return bulkCreateQRSchema.validate(qrData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  qrCodeSchema,
  createQRCodeSchema,
  updateQRCodeSchema,
  generateQRCodeSchema,
  validateQRCodeSchema,
  scanQRCodeSchema,
  bulkCreateQRSchema,
  qrConfigSchema,
  qrMetadataSchema,
  invitationDataSchema,
  tableDataSchema,

  validateQRCode,
  validateCreateQRCode,
  validateUpdateQRCode,
  validateGenerateQRCode,
  validateQRCodeData,
  validateQRScan,
  validateBulkCreateQR
};