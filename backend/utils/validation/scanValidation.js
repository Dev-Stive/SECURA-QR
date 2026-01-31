/**
 * @file scanValidation.js
 * @description Validation Joi pour les scans Secura.
 * @module utils/validation/scanValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { SCAN_TYPES } = require('../constants');

const scanMetadataSchema = Joi.object({
  sessionId: Joi.string().optional(),
  ipAddress: Joi.string().ip().optional(),
  userAgent: Joi.string().max(500).optional(),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180)
  }).optional(),
  offline: Joi.boolean().default(false),
  synced: Joi.boolean().default(false),
  syncTime: Joi.date().iso().optional()
});

// Schéma pour les informations du device
const deviceInfoSchema = Joi.object({
  platform: Joi.string().max(50).optional(),
  os: Joi.string().max(50).optional(),
  browser: Joi.string().max(50).optional(),
  version: Joi.string().max(50).optional(),
  isMobile: Joi.boolean().optional(),
  isTablet: Joi.boolean().optional(),
  isDesktop: Joi.boolean().optional()
});

// Schéma pour le résultat de validation
const validationResultSchema = Joi.object({
  valid: Joi.boolean().required(),
  error: Joi.string().optional(),
  data: Joi.object().optional()
});

// Schéma principal pour le scan
const scanSchema = Joi.object({
  id: Joi.string().pattern(/^scn_\d+_[a-zA-Z0-9]{12}$/).optional(),
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID invité requis'
    }),
  
  qrCodeId: Joi.string().pattern(/^qr_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID QR code requis'
    }),
  
  scannerId: Joi.string().required()
    .messages({
      'any.required': 'ID scanner requis'
    }),
  
  scannerName: Joi.string().max(100).allow('').default(''),
  type: Joi.string().valid(...Object.values(SCAN_TYPES)).default(SCAN_TYPES.ENTRY),
  location: Joi.string().max(100).allow('').default(''),
  deviceInfo: deviceInfoSchema.allow(null).default(null),
  
  success: Joi.boolean().default(true),
  errorMessage: Joi.string().max(200).allow(null).default(null),
  errorCode: Joi.string().max(50).allow(null).default(null),
  
  scanData: Joi.object().allow(null).default(null),
  validationResult: validationResultSchema.allow(null).default(null),
  processTime: Joi.number().integer().min(0).default(0),
  
  metadata: scanMetadataSchema.default(),
  
  scannedAt: Joi.date().iso().default(() => new Date()),
  processedAt: Joi.date().iso().default(() => new Date())
});

// Schéma pour la création de scan
const createScanSchema = scanSchema.keys({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required(),
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required(),
  qrCodeId: Joi.string().pattern(/^qr_\d+_[a-zA-Z0-9]{12}$/).required(),
  scannerId: Joi.string().required()
});

// Schéma pour la mise à jour de scan
const updateScanSchema = Joi.object({
  scannerName: Joi.string().max(100).allow('').optional(),
  type: Joi.string().valid(...Object.values(SCAN_TYPES)).optional(),
  location: Joi.string().max(100).allow('').optional(),
  deviceInfo: deviceInfoSchema.optional(),
  success: Joi.boolean().optional(),
  errorMessage: Joi.string().max(200).allow(null).optional(),
  errorCode: Joi.string().max(50).allow(null).optional(),
  processTime: Joi.number().integer().min(0).optional()
}).min(1);

// Schéma pour le scan en temps réel
const realTimeScanSchema = Joi.object({
  qrData: Joi.object({
    t: Joi.string().required(),
    e: Joi.string().required(),
    g: Joi.string().required(),
    d: Joi.number().required()
  }).required()
    .messages({
      'any.required': 'Données QR code requises'
    }),
  
  scannerId: Joi.string().required()
    .messages({
      'any.required': 'ID scanner requis'
    }),
  
  sessionId: Joi.string().required()
    .messages({
      'any.required': 'ID session requis'
    }),
  
  scannerName: Joi.string().max(100).optional(),
  location: Joi.string().max(100).allow('').default(''),
  deviceInfo: deviceInfoSchema.optional()
});

// Schéma pour le scan hors ligne
const offlineScanSchema = Joi.object({
  qrData: Joi.object({
    t: Joi.string().required(),
    e: Joi.string().required(),
    g: Joi.string().required(),
    d: Joi.number().required()
  }).required(),
  
  scannerId: Joi.string().required(),
  deviceId: Joi.string().required()
    .messages({
      'any.required': 'ID device requis'
    }),
  
  timestamp: Joi.date().iso().required()
    .messages({
      'date.base': 'Timestamp invalide',
      'any.required': 'Timestamp requis'
    }),
  
  scannerName: Joi.string().max(100).optional(),
  location: Joi.string().max(100).allow('').default(''),
  deviceInfo: deviceInfoSchema.optional()
});

// Schéma pour la synchronisation hors ligne
const offlineSyncSchema = Joi.object({
  scans: Joi.array().items(offlineScanSchema).min(1).max(1000).required()
    .messages({
      'array.min': 'Aucun scan à synchroniser',
      'array.max': 'Trop de scans à synchroniser (max 1000)'
    }),
  
  deviceId: Joi.string().required()
    .messages({
      'any.required': 'ID device requis'
    }),
  
  lastSync: Joi.date().iso().optional()
});

// Schéma pour les statistiques de scan
const scanStatsQuerySchema = Joi.object({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  groupBy: Joi.string().valid('hour', 'day', 'week', 'month').default('day'),
  scannerId: Joi.string().optional(),
  location: Joi.string().max(100).optional()
}).custom((value, helpers) => {
  const { startDate, endDate } = value;
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return helpers.error('any.custom', {
        message: 'Date de début après date de fin'
      });
    }
    
    // Limiter à 1 an maximum
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (end - start > oneYearMs) {
      return helpers.error('any.custom', {
        message: 'Période trop longue (max 1 an)'
      });
    }
  }
  
  return value;
});

// Fonctions de validation
const validateScan = (scanData) => {
  return scanSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateScan = (scanData) => {
  return createScanSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateScan = (scanData) => {
  return updateScanSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateRealTimeScan = (scanData) => {
  return realTimeScanSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateOfflineScan = (scanData) => {
  return offlineScanSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateOfflineSync = (syncData) => {
  return offlineSyncSchema.validate(syncData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateScanStatsQuery = (queryData) => {
  return scanStatsQuerySchema.validate(queryData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  scanSchema,
  createScanSchema,
  updateScanSchema,
  realTimeScanSchema,
  offlineScanSchema,
  offlineSyncSchema,
  scanStatsQuerySchema,
  scanMetadataSchema,
  deviceInfoSchema,
  validationResultSchema,
  
  validateScan,
  validateCreateScan,
  validateUpdateScan,
  validateRealTimeScan,
  validateOfflineScan,
  validateOfflineSync,
  validateScanStatsQuery
};