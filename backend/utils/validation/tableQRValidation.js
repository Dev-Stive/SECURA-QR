/**
 * @file tableQRValidation.js
 * @description Validation Joi pour les QR codes de table Secura.
 * Amélioration : Alignée avec qrValidation, avec messages en français et conditionnels.
 * @module utils/validation/tableQRValidation
 * @requires joi
 * @requires utils/constants
 */
const Joi = require('joi');
const { STATUS } = require('../utils/constants');

// Schéma pour le contenu informatif de table
const tableContentSchema = Joi.object({
  welcomeMessage: Joi.string().max(500).allow('').default(''),
  menu: Joi.array().items(Joi.string().max(200)).default([]),
  program: Joi.array().items(Joi.object({
    time: Joi.string().required().messages({
      'any.required': 'Heure d\'activité requise'
    }),
    activity: Joi.string().max(200).required().messages({
      'any.required': 'Activité requise'
    })
  })).default([]),
  specialNotes: Joi.string().max(500).allow('').default(''),
  contactPerson: Joi.string().max(100).allow('').default('')
});

// Schéma pour la configuration du QR code de table
const tableQRConfigSchema = Joi.object({
  size: Joi.number().integer().min(100).max(1000).default(250),
  foreground: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#000000').messages({
    'string.pattern.base': 'Couleur foreground invalide (#RRGGBB)'
  }),
  background: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#FFFFFF').messages({
    'string.pattern.base': 'Couleur background invalide (#RRGGBB)'
  }),
  includeLogo: Joi.boolean().default(true),
  customMessage: Joi.string().max(200).allow('').default('')
});

// Schéma pour l'assignation d'invité à table
const tableAssignmentSchema = Joi.object({
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required().messages({
    'any.required': 'ID invité requis'
  }),
  guestName: Joi.string().max(100).required().messages({
    'any.required': 'Nom invité requis'
  }),
  assignedAt: Joi.date().iso().required().messages({
    'any.required': 'Date d\'assignation requise'
  }),
  assignedBy: Joi.string().required().messages({
    'any.required': 'Assigné par requis'
  }),
  seats: Joi.number().integer().min(1).max(20).default(1),
  notes: Joi.string().max(200).allow('').default('')
});

// Schéma pour les statistiques de table
const tableStatsSchema = Joi.object({
  scans: Joi.number().integer().min(0).default(0),
  lastScan: Joi.date().iso().allow(null).default(null),
  uniqueScanners: Joi.number().integer().min(0).default(0),
  averageViewTime: Joi.number().min(0).default(0)
});

// Schéma pour les métadonnées de table
const tableMetadataSchema = Joi.object({
  createdBy: Joi.string().default('system'),
  qrVersion: Joi.string().default('1.0'),
  lastUpdatedBy: Joi.string().allow(null).default(null)
});

// Schéma pour l'historique de scan de table
const tableScanHistorySchema = Joi.object({
  timestamp: Joi.date().iso().required().messages({
    'any.required': 'Timestamp requis'
  }),
  scannerId: Joi.string().optional(),
  scannerName: Joi.string().max(100).optional(),
  duration: Joi.number().min(0).default(0),
  userAgent: Joi.string().max(500).optional()
});

// Schéma principal pour le QR code de table
const tableQRSchema = Joi.object({
  id: Joi.string().pattern(/^tqr_\d+_T\d+_[a-zA-Z0-9]{8}$/).optional(),
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
 
  tableNumber: Joi.alternatives().try(
    Joi.string().max(20),
    Joi.number().integer()
  ).required()
    .messages({
      'any.required': 'Numéro de table requis'
    }),
 
  tableName: Joi.string().min(2).max(100).default((parent) => `Table ${parent.tableNumber}`),
  description: Joi.string().max(500).allow('').default(''),
  capacity: Joi.number().integer().min(1).max(100).default(8),
  location: Joi.string().max(100).allow('').default(''),
  type: Joi.string().valid('standard', 'vip', 'family', 'corporate').default('standard'),
  category: Joi.string().max(50).default('general'),
 
  guests: Joi.array().items(Joi.string()).default([]),
  guestCount: Joi.number().integer().min(0).default(0),
  assignedGuests: Joi.array().items(tableAssignmentSchema).default([]),
 
  content: tableContentSchema.default(),
  qrConfig: tableQRConfigSchema.default(),
 
  qrData: Joi.object().allow(null).default(null),
  qrImage: Joi.string().allow(null).default(null),
  qrUrl: Joi.string().uri().allow(null).default(null),
 
  stats: tableStatsSchema.default(),
  status: Joi.string().valid(...Object.values(STATUS)).default(STATUS.ACTIVE),
  isActive: Joi.boolean().default(true),
 
  metadata: tableMetadataSchema.default(),
  scanHistory: Joi.array().items(tableScanHistorySchema).default([]),
 
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date())
});

// Schéma pour la création de QR code de table
const createTableQRSchema = tableQRSchema.keys({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required(),
  tableNumber: Joi.alternatives().try(
    Joi.string().max(20),
    Joi.number().integer()
  ).required()
});

// Schéma pour la mise à jour de QR code de table
const updateTableQRSchema = Joi.object({
  tableName: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('').optional(),
  capacity: Joi.number().integer().min(1).max(100).optional(),
  location: Joi.string().max(100).allow('').optional(),
  type: Joi.string().valid('standard', 'vip', 'family', 'corporate').optional(),
  category: Joi.string().max(50).optional(),
  content: tableContentSchema.optional(),
  qrConfig: tableQRConfigSchema.optional(),
  isActive: Joi.boolean().optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional()
}).min(1).messages({
  'object.min': 'Au moins un champ à mettre à jour requis'
});

// Schéma pour l'assignation d'invité à table
const assignGuestToTableSchema = Joi.object({
  tableId: Joi.string().pattern(/^tqr_\d+_T\d+_[a-zA-Z0-9]{8}$/).required().messages({
    'any.required': 'ID table requis'
  }),
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required().messages({
    'any.required': 'ID invité requis'
  }),
  guestName: Joi.string().max(100).required().messages({
    'any.required': 'Nom invité requis'
  }),
  assignedBy: Joi.string().required().messages({
    'any.required': 'Assigné par requis'
  }),
  seats: Joi.number().integer().min(1).max(20).default(1),
  notes: Joi.string().max(200).allow('').default('')
});

// Schéma pour le scan de QR code de table
const scanTableQRSchema = Joi.object({
  tableId: Joi.string().pattern(/^tqr_\d+_T\d+_[a-zA-Z0-9]{8}$/).required().messages({
    'any.required': 'ID table requis'
  }),
  scannerId: Joi.string().optional(),
  scannerName: Joi.string().max(100).optional(),
  duration: Joi.number().min(0).optional(),
  userAgent: Joi.string().max(500).optional()
});

// Schéma pour la génération de données QR de table
const generateTableQRDataSchema = Joi.object({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required().messages({
    'any.required': 'ID événement requis'
  }),
  tableId: Joi.string().pattern(/^tqr_\d+_T\d+_[a-zA-Z0-9]{8}$/).required().messages({
    'any.required': 'ID table requis'
  }),
  tableNumber: Joi.alternatives().try(
    Joi.string().max(20),
    Joi.number().integer()
  ).required().messages({
    'any.required': 'Numéro de table requis'
  }),
  tableName: Joi.string().max(100).required().messages({
    'any.required': 'Nom de table requis'
  }),
  eventName: Joi.string().max(100).optional(),
  eventDate: Joi.date().iso().optional(),
  content: tableContentSchema.optional()
});

// Schéma pour la création en masse de tables
const bulkCreateTablesSchema = Joi.array().items(
  Joi.object({
    tableNumber: Joi.alternatives().try(
      Joi.string().max(20),
      Joi.number().integer()
    ).required().messages({
      'any.required': 'Numéro de table requis'
    }),
    tableName: Joi.string().max(100).optional(),
    capacity: Joi.number().integer().min(1).max(100).default(8),
    location: Joi.string().max(100).allow('').default(''),
    type: Joi.string().valid('standard', 'vip', 'family', 'corporate').default('standard')
  })
).max(100)
.messages({
  'array.max': 'Trop de tables en une seule fois (max 100)'
});

// Fonctions de validation
const validateTableQR = (tableData) => {
  return tableQRSchema.validate(tableData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateTableQR = (tableData) => {
  return createTableQRSchema.validate(tableData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateTableQR = (tableData) => {
  return updateTableQRSchema.validate(tableData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateAssignGuestToTable = (assignmentData) => {
  return assignGuestToTableSchema.validate(assignmentData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateScanTableQR = (scanData) => {
  return scanTableQRSchema.validate(scanData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateGenerateTableQRData = (generateData) => {
  return generateTableQRDataSchema.validate(generateData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateBulkCreateTables = (tablesData) => {
  return bulkCreateTablesSchema.validate(tablesData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  tableQRSchema,
  createTableQRSchema,
  updateTableQRSchema,
  assignGuestToTableSchema,
  scanTableQRSchema,
  generateTableQRDataSchema,
  bulkCreateTablesSchema,
  tableContentSchema,
  tableQRConfigSchema,
  tableAssignmentSchema,
  tableStatsSchema,
 
  validateTableQR,
  validateCreateTableQR,
  validateUpdateTableQR,
  validateAssignGuestToTable,
  validateScanTableQR,
  validateGenerateTableQRData,
  validateBulkCreateTables
};