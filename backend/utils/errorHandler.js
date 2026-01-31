/**
 * @file errorHandler.js
 * @description Gestionnaire d'erreurs centralisé pour Secura.
 * @module utils/errorHandler
 */

/**
 * @class AppError
 * @description Classe d'erreur personnalisée.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @class ValidationError
 */
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

/**
 * @class NotFoundError
 */
class NotFoundError extends AppError {
  constructor(resource = 'Ressource') {
    super(`${resource} introuvable`, 404, 'NOT_FOUND');
  }
}

/**
 * @class UnauthorizedError
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Non autorisé') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * @class ForbiddenError
 */
class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * @function handleError
 * @description Middleware de gestion d'erreurs Express.
 */
const handleError = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  const response = {
    success: false,
    error: err.message || 'Erreur serveur',
    code,
    timestamp: new Date().toISOString(),
  };
  
  if (err.errors) response.errors = err.errors;
  
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
};

/**
 * @function asyncHandler
 * @description Wrapper pour gérer les erreurs async.
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  handleError,
  asyncHandler,
};