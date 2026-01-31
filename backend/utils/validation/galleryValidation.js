/**
 * @file galleryValidation.js
 * @description Validation Joi pour les galeries photos Secura.
 * @module utils/validation/galleryValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { STATUS } = require('../constants');

const photoMetadataSchema = Joi.object({
  title: Joi.string().max(100).allow('').default(''),
  description: Joi.string().max(500).allow('').default(''),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  location: Joi.string().max(100).allow(null).default(null),
  takenAt: Joi.date().iso().allow(null).default(null),
  camera: Joi.string().max(100).allow(null).default(null)
});

// Schéma pour un commentaire de photo
const photoCommentSchema = Joi.object({
  id: Joi.string().required(),
  author: Joi.string().max(50).required(),
  authorId: Joi.string().optional(),
  content: Joi.string().min(2).max(500).required(),
  postedAt: Joi.date().iso().required(),
  moderated: Joi.boolean().default(false),
  likes: Joi.number().integer().min(0).default(0)
});

// Schéma pour une photo
const photoSchema = Joi.object({
  id: Joi.string().required(),
  filename: Joi.string().required(),
  originalName: Joi.string().optional(),
  url: Joi.string().uri().required(),
  thumbnailUrl: Joi.string().uri().optional(),
  previewUrl: Joi.string().uri().optional(),
  uploadedBy: Joi.string().required(),
  uploadedAt: Joi.date().iso().required(),
  size: Joi.number().integer().min(0).required(),
  dimensions: Joi.object({
    width: Joi.number().integer().min(1),
    height: Joi.number().integer().min(1)
  }).allow(null).default(null),
  format: Joi.string().valid('jpg', 'jpeg', 'png', 'webp', 'gif').required(),
  metadata: photoMetadataSchema.default(),
  status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'),
  isPublic: Joi.boolean().default(true),
  featured: Joi.boolean().default(false),
  moderated: Joi.boolean().default(false),
  moderatedBy: Joi.string().allow(null).default(null),
  moderatedAt: Joi.date().iso().allow(null).default(null),
  rejectionReason: Joi.string().max(200).allow('').default(''),
  likes: Joi.number().integer().min(0).default(0),
  views: Joi.number().integer().min(0).default(0),
  downloads: Joi.number().integer().min(0).default(0),
  comments: Joi.array().items(photoCommentSchema).default([])
});

// Schéma pour les paramètres de galerie
const gallerySettingsSchema = Joi.object({
  maxPhotos: Joi.number().integer().min(1).max(10000).default(1000),
  maxPhotoSize: Joi.number().integer().min(1024).max(52428800).default(8388608), // 8MB
  allowedFormats: Joi.array().items(Joi.string().valid('jpg', 'jpeg', 'png', 'webp', 'gif')).default(['jpg', 'jpeg', 'png', 'webp']),
  autoApprove: Joi.boolean().default(false),
  allowDownloads: Joi.boolean().default(true),
  allowComments: Joi.boolean().default(true),
  moderationRequired: Joi.boolean().default(true),
  watermark: Joi.boolean().default(false)
});

// Schéma pour les statistiques de galerie
const galleryStatsSchema = Joi.object({
  totalViews: Joi.number().integer().min(0).default(0),
  totalLikes: Joi.number().integer().min(0).default(0),
  totalDownloads: Joi.number().integer().min(0).default(0),
  totalComments: Joi.number().integer().min(0).default(0)
});

// Schéma pour la modération de galerie
const galleryModerationSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  approvedPhotos: Joi.array().items(Joi.string()).default([]),
  pendingPhotos: Joi.array().items(Joi.string()).default([]),
  rejectedPhotos: Joi.array().items(Joi.string()).default([])
});

// Schéma pour les métadonnées de galerie
const galleryMetadataSchema = Joi.object({
  createdBy: Joi.string().optional(),
  coverPhoto: Joi.string().allow(null).default(null),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  category: Joi.string().max(50).default('general'),
  location: Joi.string().max(100).allow(null).default(null)
});

// Schéma principal pour la galerie
const gallerySchema = Joi.object({
  id: Joi.string().pattern(/^gal_\d+_[a-zA-Z0-9]{12}$/).optional(),
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required()
    .messages({
      'any.required': 'ID événement requis'
    }),
  
  name: Joi.string().min(2).max(100).required().trim()
    .messages({
      'string.min': 'Nom de galerie requis (min 2 caractères)',
      'string.max': 'Nom de galerie trop long (max 100 caractères)',
      'any.required': 'Nom de la galerie requis'
    }),
  
  description: Joi.string().max(500).allow('').default(''),
  
  photos: Joi.array().items(photoSchema).default([]),
  photoCount: Joi.number().integer().min(0).default(0),
  albums: Joi.array().items(Joi.object()).default([]),
  
  status: Joi.string().valid(...Object.values(STATUS)).default(STATUS.ACTIVE),
  isPublic: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  
  settings: gallerySettingsSchema.default(),
  stats: galleryStatsSchema.default(),
  metadata: galleryMetadataSchema.default(),
  moderation: galleryModerationSchema.default(),
  
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date())
});

// Schéma pour la création de galerie
const createGallerySchema = gallerySchema.keys({
  eventId: Joi.string().pattern(/^evt_\d+_[a-zA-Z0-9]{12}$/).required(),
  name: Joi.string().min(2).max(100).required().trim()
});

// Schéma pour la mise à jour de galerie
const updateGallerySchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  description: Joi.string().max(500).allow('').optional(),
  isPublic: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  status: Joi.string().valid(...Object.values(STATUS)).optional(),
  settings: gallerySettingsSchema.optional(),
  metadata: galleryMetadataSchema.optional()
}).min(1);

// Schéma pour l'upload de photo
const photoUploadSchema = Joi.object({
  filename: Joi.string().required()
    .messages({
      'any.required': 'Nom de fichier requis'
    }),
  
  originalName: Joi.string().optional(),
  uploadedBy: Joi.string().required()
    .messages({
      'any.required': 'Uploader requis'
    }),
  
  size: Joi.number().integer().min(1).required()
    .messages({
      'number.base': 'Taille de fichier invalide',
      'any.required': 'Taille de fichier requise'
    }),
  
  metadata: photoMetadataSchema.optional(),
  featured: Joi.boolean().default(false)
});

// Schéma pour la modération de photo
const photoModerationSchema = Joi.object({
  photoId: Joi.string().required()
    .messages({
      'any.required': 'ID photo requis'
    }),
  
  moderatorId: Joi.string().required()
    .messages({
      'any.required': 'ID modérateur requis'
    }),
  
  action: Joi.string().valid('approve', 'reject').required()
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

// Schéma pour un commentaire
const createCommentSchema = Joi.object({
  author: Joi.string().min(2).max(50).required()
    .messages({
      'string.min': 'Auteur requis (min 2 caractères)',
      'string.max': 'Nom d\'auteur trop long (max 50 caractères)',
      'any.required': 'Auteur requis'
    }),
  
  authorId: Joi.string().optional(),
  content: Joi.string().min(2).max(500).required()
    .messages({
      'string.min': 'Commentaire trop court (min 2 caractères)',
      'string.max': 'Commentaire trop long (max 500 caractères)',
      'any.required': 'Contenu du commentaire requis'
    }),
  
  photoId: Joi.string().required()
    .messages({
      'any.required': 'ID photo requis'
    })
});

// Fonctions de validation
const validateGallery = (galleryData) => {
  return gallerySchema.validate(galleryData, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true
  });
};

const validateCreateGallery = (galleryData) => {
  return createGallerySchema.validate(galleryData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateGallery = (galleryData) => {
  return updateGallerySchema.validate(galleryData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validatePhotoUpload = (photoData) => {
  return photoUploadSchema.validate(photoData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validatePhotoModeration = (moderationData) => {
  return photoModerationSchema.validate(moderationData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validatePhotoComment = (commentData) => {
  return createCommentSchema.validate(commentData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  gallerySchema,
  createGallerySchema,
  updateGallerySchema,
  photoSchema,
  photoUploadSchema,
  photoModerationSchema,
  createCommentSchema,
  gallerySettingsSchema,
  galleryStatsSchema,
  
  validateGallery,
  validateCreateGallery,
  validateUpdateGallery,
  validatePhotoUpload,
  validatePhotoModeration,
  validatePhotoComment
};