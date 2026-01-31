/**
 * @file responseFormatter.js
 * @description Formateur de réponses API standardisé.
 * @module utils/responseFormatter
 */

/**
 * @function successResponse
 * @description Génère une réponse de succès standardisée.
 */
const successResponse = (data = null, message = 'Opération réussie', meta = {}) => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    ...meta,
  };
};

/**
 * @function errorResponse
 * @description Génère une réponse d'erreur standardisée.
 */
const errorResponse = (error, code = 'ERROR', statusCode = 500) => {
  return {
    success: false,
    error: error.message || error,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
  };
};

/**
 * @function paginatedResponse
 * @description Génère une réponse paginée.
 */
const paginatedResponse = (data, page, limit, total) => {
  return {
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};