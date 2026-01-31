/**
 * @file invitationValidation.js
 * @description Validation Joi pour les invitations Secura.
 * @module utils/validation/invitationValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { STATUS, INVITATION_STATUS } = require('../constants');


const invitationContentSchema = Joi.object({
  subject: Joi.string().max(200).default('Invitation à un événement'),
  message: Joi.string().max(5000).allow('').default(''),
  template: Joi.string().max(100).default('default'),
  locale: Joi.string().valid('fr', 'en', 'es').default('fr')
});

// Schéma pour le suivi de l'invitation
const invitationTrackingSchema = Joi.object({
  sentAt: Joi.date().iso().allow(null).default(null),
  deliveredAt: Joi.date().iso().allow(null).default(null),
  openedAt: Joi.date().iso().allow(null).default(null),
  clickedAt: Joi.date().iso().allow(null).default(null),
  respondedAt: Joi.date().iso().allow(null).default(null),
  openCount: Joi.number().integer().min(0).default(0),
  clickCount: Joi.number().integer().min(0).default(0),
  bounceCount: Joi.number().integer().min(0).default(0),
  lastOpened: Joi.date().iso().allow(null).default(null),
  lastClicked: Joi.date().iso().allow(null).default(null)
});

// Schéma pour les paramètres d'invitation
const invitationSettingsSchema = Joi.object({
  requireRSVP: Joi.boolean().default(true),
  allowPlusOnes: Joi.boolean().default(false),
  maxPlusOnes: Joi.number().integer().min(0).max(20).default(0),
  sendReminders: Joi.boolean().default(true),
  reminderDays: Joi.array().items(Joi.number().integer().min(1).max(30)).default([7, 3, 1])
});

// Schéma pour la réponse de l'invité
const invitationResponseSchema = Joi.object({
  status: Joi.string().valid('pending', 'accepted', 'declined', 'tentative').default('pending'),
  respondedAt: Joi.date().iso().allow(null).default(null),
  message: Joi.string().max(500).allow('').default(''),
  plusOnes: Joi.number().integer().min(0).max(20).default(0),
  dietaryRequirements: Joi.string().max(200).allow('').default(''),
  specialRequests: Joi.string().max(500).allow('').default('')
});

// Schéma pour les métadonnées d'invitation
const invitationMetadataSchema = Joi.object({
  sentBy: Joi.string().default('system'),
  campaignId: Joi.string().allow(null).default(null),
  batchId: Joi.string().allow(null).default(null),
  ipAddress: Joi.string().ip().allow(null).default(null),
  userAgent: Joi.string().max(500).allow(null).default(null)
});

// Schéma pour l'historique d'invitation
const invitationHistorySchema = Joi.object({
  action: Joi.string().required(),
  timestamp: Joi.date().iso().required(),
  method: Joi.string().optional(),
  details: Joi.object().optional(),
  reason: Joi.string().optional(),
  code: Joi.string().optional()
});

// Schéma principal pour l'invitation
const invitationSchema = Joi.object({
  id: Joi.string().pattern(/^inv_\d+_[a-zA-Z0-9]{12}$/).optional(),
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID invité requis'
    }),
  
  token: Joi.string().length(8).pattern(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/).required(),
  
  guestEmail: Joi.string().email().required().trim().lowercase()
    .messages({
      'string.email': 'Format email invité invalide',
      'any.required': 'Email invité requis'
    }),
  
  guestName: Joi.string().min(2).max(100).required().trim()
    .messages({
      'string.min': 'Nom invité requis (min 2 caractères)',
      'string.max': 'Nom invité trop long (max 100 caractères)',
      'any.required': 'Nom invité requis'
    }),
  
  guestPhone: Joi.string().pattern(/^[\d\s\+\-\(\)]{8,20}$/).trim().allow('').optional(),
  
  type: Joi.string().valid('email', 'sms', 'whatsapp', 'link').default('email'),
  status: Joi.string().valid(...Object.values(INVITATION_STATUS)).default(INVITATION_STATUS.PENDING),
  sendMethod: Joi.string().max(50).default('system'),
  
  content: invitationContentSchema.default(),
  tracking: invitationTrackingSchema.default(),
  settings: invitationSettingsSchema.default(),
  metadata: invitationMetadataSchema.default(),
  response: invitationResponseSchema.default(),
  
  history: Joi.array().items(invitationHistorySchema).default([]),
  
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date()),
  expiresAt: Joi.date().iso().allow(null).default(null)
});

// Schéma pour la création d'invitation
const createInvitationSchema = invitationSchema.keys({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required(),
  guestId: Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/).required(),
  guestEmail: Joi.string().email().required().trim().lowercase(),
  guestName: Joi.string().min(2).max(100).required().trim()
});

// Schéma pour la mise à jour d'invitation
const updateInvitationSchema = Joi.object({
  guestEmail: Joi.string().email().trim().lowercase().optional(),
  guestName: Joi.string().min(2).max(100).trim().optional(),
  guestPhone: Joi.string().pattern(/^[\d\s\+\-\(\)]{8,20}$/).trim().allow('').optional(),
  type: Joi.string().valid('email', 'sms', 'whatsapp', 'link').optional(),
  status: Joi.string().valid(...Object.values(INVITATION_STATUS)).optional(),
  content: invitationContentSchema.optional(),
  settings: invitationSettingsSchema.optional(),
  response: invitationResponseSchema.optional()
}).min(1);

// Schéma pour l'envoi d'invitation
const sendInvitationSchema = Joi.object({
  invitationId: Joi.string().pattern(/^inv_\d+_[a-zA-Z0-9]{12}$/).required(),
  method: Joi.string().valid('email', 'sms', 'whatsapp').default('email'),
  content: invitationContentSchema.optional()
});

// Schéma pour le suivi d'invitation
const trackInvitationSchema = Joi.object({
  invitationId: Joi.string().pattern(/^inv_\d+_[a-zA-Z0-9]{12}$/).required(),
  action: Joi.string().valid('sent', 'delivered', 'opened', 'clicked', 'bounced', 'responded').required(),
  data: Joi.object().optional()
});

// Schéma pour la réponse d'invitation
const respondInvitationSchema = Joi.object({
  invitationToken: Joi.string().length(8).pattern(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/).required(),
  status: Joi.string().valid('accepted', 'declined', 'tentative').required(),
  message: Joi.string().max(500).allow('').optional(),
  plusOnes: Joi.number().integer().min(0).max(20).default(0),
  dietaryRequirements: Joi.string().max(200).allow('').optional(),
  specialRequests: Joi.string().max(500).allow('').optional()
});

// Schéma pour l'envoi en masse
const bulkSendSchema = Joi.object({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required(),
  guestIds: Joi.array().items(Joi.string().pattern(/^gst_\d+_[a-zA-Z0-9]{12}$/)).min(1).max(1000),
  method: Joi.string().valid('email', 'sms', 'whatsapp').default('email'),
  content: invitationContentSchema.optional(),
  settings: invitationSettingsSchema.optional()
});

// Fonctions de validation
const validateInvitation = (invitationData) => {
  return invitationSchema.validate(invitationData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateInvitation = (invitationData) => {
  return createInvitationSchema.validate(invitationData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateInvitation = (invitationData) => {
  return updateInvitationSchema.validate(invitationData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateSendInvitation = (sendData) => {
  return sendInvitationSchema.validate(sendData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateTrackInvitation = (trackData) => {
  return trackInvitationSchema.validate(trackData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateRespondInvitation = (responseData) => {
  return respondInvitationSchema.validate(responseData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateBulkSend = (bulkData) => {
  return bulkSendSchema.validate(bulkData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  invitationSchema,
  createInvitationSchema,
  updateInvitationSchema,
  sendInvitationSchema,
  trackInvitationSchema,
  respondInvitationSchema,
  bulkSendSchema,
  invitationContentSchema,
  invitationSettingsSchema,
  invitationResponseSchema,
  
  validateInvitation,
  validateCreateInvitation,
  validateUpdateInvitation,
  validateSendInvitation,
  validateTrackInvitation,
  validateRespondInvitation,
  validateBulkSend
};