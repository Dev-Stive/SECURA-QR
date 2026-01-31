/**
 * @file authValidation.js
 * @description Validation Joi pour l'authentification et les utilisateurs Secura.
 * @module utils/validation/authValidation
 * @requires joi
 * @requires utils/constants
 */

const Joi = require('joi');
const { ROLES } = require('../constants');

// Schéma pour les préférences utilisateur
const userPreferencesSchema = Joi.object({
  notifications: Joi.boolean().default(true),
  language: Joi.string().valid('fr', 'en', 'es').default('fr'),
  theme: Joi.string().valid('light', 'dark', 'auto').default('light'),
  emailNotifications: Joi.boolean().default(true),
  pushNotifications: Joi.boolean().default(true)
});

const userSchema = Joi.object({
  id: Joi.string().pattern(/^usr_\d+_[a-zA-Z0-9]{12}$/).optional(),
  email: Joi.string().email().required().trim().lowercase()
    .messages({
      'string.email': 'Format email invalide',
      'any.required': 'Email requis'
    }),
  password: Joi.string().min(6).max(100).required()
    .messages({
      'string.min': 'Mot de passe trop court (min 6 caractères)',
      'string.max': 'Mot de passe trop long (max 100 caractères)',
      'any.required': 'Mot de passe requis'
    }),
  firstName: Joi.string().max(50).trim().optional().allow('')
    .messages({
      'string.max': 'Prénom trop long (max 50 caractères)'
    }),
  lastName: Joi.string().max(50).trim().optional().allow('')
    .messages({
      'string.max': 'Nom trop long (max 50 caractères)'
    }),
  phone: Joi.string().pattern(/^[\d\s\+\-\(\)]{8,20}$/).optional().allow('')
    .messages({
      'string.pattern.base': 'Format téléphone invalide'
    }),
  role: Joi.string().valid(...Object.values(ROLES)).default(ROLES.USER),
  avatar: Joi.string().uri().optional().allow(null),
  isActive: Joi.boolean().default(true),
  emailVerified: Joi.boolean().default(false),
  timezone: Joi.string().default('Africa/Douala'),
  preferences: userPreferencesSchema.default(),
  createdAt: Joi.date().iso().default(() => new Date()),
  updatedAt: Joi.date().iso().default(() => new Date())
});

// Schéma pour la création d'utilisateur
const createUserSchema = userSchema.keys({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(6).max(100).required()
});

// Schéma pour la mise à jour d'utilisateur
const updateUserSchema = Joi.object({
  firstName: Joi.string().max(50).trim().optional().allow(''),
  lastName: Joi.string().max(50).trim().optional().allow(''),
  phone: Joi.string().pattern(/^[\d\s\+\-\(\)]{8,20}$/).optional().allow(''),
  avatar: Joi.string().uri().optional().allow(null),
  timezone: Joi.string().optional(),
  preferences: userPreferencesSchema.optional(),
  isActive: Joi.boolean().optional()
}).min(1); // Au moins un champ doit être fourni

// Schéma pour la connexion
const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase()
    .messages({
      'string.email': 'Format email invalide',
      'any.required': 'Email requis'
    }),
  password: Joi.string().required()
    .messages({
      'any.required': 'Mot de passe requis'
    }),
  rememberMe: Joi.boolean().default(false)
});

// Schéma pour l'inscription
const registerSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase()
    .messages({
      'string.email': 'Format email invalide',
      'any.required': 'Email requis'
    }),
  password: Joi.string().min(6).max(100).required()
    .messages({
      'string.min': 'Mot de passe trop court (min 6 caractères)',
      'string.max': 'Mot de passe trop long (max 100 caractères)',
      'any.required': 'Mot de passe requis'
    }),
  firstName: Joi.string().max(50).trim().optional().allow(''),
  lastName: Joi.string().max(50).trim().optional().allow(''),
  phone: Joi.string().pattern(/^[\d\s\+\-\(\)]{8,20}$/).optional().allow('')
});

// Schéma pour le changement de mot de passe
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required()
    .messages({
      'any.required': 'Mot de passe actuel requis'
    }),
  newPassword: Joi.string().min(6).max(100).required()
    .messages({
      'string.min': 'Nouveau mot de passe trop court (min 6 caractères)',
      'string.max': 'Nouveau mot de passe trop long (max 100 caractères)',
      'any.required': 'Nouveau mot de passe requis'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({
      'any.only': 'Les mots de passe ne correspondent pas',
      'any.required': 'Confirmation du mot de passe requise'
    })
});

// Schéma pour la réinitialisation de mot de passe
const resetPasswordSchema = Joi.object({
  token: Joi.string().required()
    .messages({
      'any.required': 'Token de réinitialisation requis'
    }),
  newPassword: Joi.string().min(6).max(100).required()
    .messages({
      'string.min': 'Mot de passe trop court (min 6 caractères)',
      'string.max': 'Mot de passe trop long (max 100 caractères)',
      'any.required': 'Nouveau mot de passe requis'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({
      'any.only': 'Les mots de passe ne correspondent pas',
      'any.required': 'Confirmation du mot de passe requise'
    })
});

// Schéma pour la demande de réinitialisation
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase()
    .messages({
      'string.email': 'Format email invalide',
      'any.required': 'Email requis'
    })
});

// Fonctions de validation
const validateUser = (userData) => {
  return userSchema.validate(userData, { 
    abortEarly: false,
    stripUnknown: true
  });
};

const validateCreateUser = (userData) => {
  return createUserSchema.validate(userData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateUpdateUser = (userData) => {
  return updateUserSchema.validate(userData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateLogin = (loginData) => {
  return loginSchema.validate(loginData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateRegister = (registerData) => {
  return registerSchema.validate(registerData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateChangePassword = (passwordData) => {
  return changePasswordSchema.validate(passwordData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateResetPassword = (resetData) => {
  return resetPasswordSchema.validate(resetData, {
    abortEarly: false,
    stripUnknown: true
  });
};

const validateForgotPassword = (forgotData) => {
  return forgotPasswordSchema.validate(forgotData, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = {
  userSchema,
  createUserSchema,
  updateUserSchema,
  loginSchema,
  registerSchema,
  changePasswordSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
  
  validateUser,
  validateCreateUser,
  validateUpdateUser,
  validateLogin,
  validateRegister,
  validateChangePassword,
  validateResetPassword,
  validateForgotPassword
};