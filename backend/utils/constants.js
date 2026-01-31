/**
 * @file constants.js
 * @description Constantes globales pour Secura.
 * @module utils/constants
 */

module.exports = {
  // Statuts
  STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  
  // Rôles utilisateurs
  ROLES: {
    ADMIN: 'admin',
    EDITOR: 'editor',
    VIEWER: 'viewer',
    AGENT: 'agent',
    USER: 'user',
  },
  
  // Permissions
  PERMISSIONS: {
    READ: 'read',
    WRITE: 'write',
    DELETE: 'delete',
    MANAGE: 'manage',
  },
  
  // Types d'événements
  EVENT_TYPES: {
    WEDDING: 'wedding',
    CONFERENCE: 'conference',
    PARTY: 'party',
    CORPORATE: 'corporate',
    OTHER: 'other',
  },
  
  // Types de scans
  SCAN_TYPES: {
    ENTRY: 'entry',
    EXIT: 'exit',
    VALIDATION: 'validation',
  },
  
  // Codes HTTP
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
  },
  
  // Limites
  LIMITS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_GUESTS_PER_EVENT: 10000,
    MAX_BULK_OPERATIONS: 1000,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  },
  
  // Messages
  MESSAGES: {
    SUCCESS: 'Opération réussie',
    ERROR: 'Une erreur est survenue',
    NOT_FOUND: 'Ressource introuvable',
    UNAUTHORIZED: 'Non autorisé',
    VALIDATION_ERROR: 'Erreur de validation',
  },
};