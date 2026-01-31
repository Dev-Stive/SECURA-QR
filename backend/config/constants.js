/**
 * @file constants.js
 * @description Constantes globales et configurations statiques pour Secura QR.
 * Centralise toutes les constantes de l'application avec catégorisation et documentation.
 * @module config/constants
 * @requires ../utils/constants
 */

const { STATUS, ROLES, PERMISSIONS, EVENT_TYPES, SCAN_TYPES, HTTP_STATUS, LIMITS, MESSAGES } = require('../utils/constants');

/**
 * @namespace AppConstants
 * @description Constantes globales de l'application Secura QR
 */
const AppConstants = {
  // ==============================================
  // 🎯 APPLICATION & MÉTADONNÉES
  // ==============================================

  /**
   * @constant {Object} APP
   * @description Informations générales de l'application
   */
  APP: {
    NAME: 'Secura QR',
    VERSION: '4.0.0',
    DESCRIPTION: 'Système de gestion d\'événements avec QR codes',
    AUTHOR: 'Geek Hub Startup',
    SUPPORT_EMAIL: 'support@secura.com',
    WEBSITE: 'https://secura.geekhub.com'
  },

  // ==============================================
  // 🔐 SÉCURITÉ & AUTHENTIFICATION
  // ==============================================

  /**
   * @constant {Object} SECURITY
   * @description Constantes de sécurité
   */
  SECURITY: {
    // JWT
    JWT_ISSUER: 'secura-qr-api',
    JWT_AUDIENCE: 'secura-qr-app',
    
    // Codes d'accès
    ACCESS_CODE_LENGTH: 4,
    ACCESS_CODE_CHARSET: '0123456789',
    ACCESS_CODE_EXPIRY_MINUTES: 30,
    
    // Tokens de réinitialisation
    RESET_TOKEN_LENGTH: 32,
    RESET_TOKEN_EXPIRY_MINUTES: 15,
    
    // Validation mots de passe
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_SKIP_PATHS: ['/health', '/api/health']
  },

  // ==============================================
  // 👥 UTILISATEURS & RÔLES
  // ==============================================

  /**
   * @constant {Object} USERS
   * @description Constantes liées aux utilisateurs
   */
  USERS: {
    // Rôles (importés depuis utils/constants)
    ROLES: ROLES,
    
    // Permissions (importées depuis utils/constants)
    PERMISSIONS: PERMISSIONS,
    
    // Hiérarchie des rôles
    ROLE_HIERARCHY: {
      [ROLES.ADMIN]: [ROLES.EDITOR, ROLES.VIEWER, ROLES.AGENT],
      [ROLES.EDITOR]: [ROLES.VIEWER, ROLES.AGENT],
      [ROLES.VIEWER]: [],
      [ROLES.AGENT]: []
    },
    
    // Permissions par rôle
    ROLE_PERMISSIONS: {
      [ROLES.ADMIN]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.DELETE, PERMISSIONS.MANAGE],
      [ROLES.EDITOR]: [PERMISSIONS.READ, PERMISSIONS.WRITE],
      [ROLES.VIEWER]: [PERMISSIONS.READ],
      [ROLES.AGENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE] // Pour les scans
    },
    
    // Limites
    MAX_EVENTS_PER_USER: 100,
    DEFAULT_USER_SETTINGS: {
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      preferences: {
        language: 'fr',
        timezone: 'Africa/Douala',
        dateFormat: 'DD/MM/YYYY'
      }
    }
  },

  // ==============================================
  // 🎫 ÉVÉNEMENTS
  // ==============================================

  /**
   * @constant {Object} EVENTS
   * @description Constantes liées aux événements
   */
  EVENTS: {
    // Types d'événements (importés depuis utils/constants)
    TYPES: EVENT_TYPES,
    
    // Statuts (importés depuis utils/constants)
    STATUS: STATUS,
    
    // Configuration par type
    TYPE_CONFIGS: {
      [EVENT_TYPES.WEDDING]: {
        maxGuests: 1000,
        defaultSettings: {
          requireConfirmation: true,
          allowPlusOnes: true,
          maxPlusOnes: 2,
          seatingArrangement: true
        }
      },
      [EVENT_TYPES.CONFERENCE]: {
        maxGuests: 5000,
        defaultSettings: {
          requireConfirmation: false,
          allowPlusOnes: false,
          trackAttendance: true,
          sessionTracking: true
        }
      },
      [EVENT_TYPES.PARTY]: {
        maxGuests: 500,
        defaultSettings: {
          requireConfirmation: false,
          allowPlusOnes: true,
          maxPlusOnes: 3,
          ageRestriction: false
        }
      },
      [EVENT_TYPES.CORPORATE]: {
        maxGuests: 2000,
        defaultSettings: {
          requireConfirmation: true,
          allowPlusOnes: false,
          requireCompany: true,
          trackDepartments: true
        }
      },
      [EVENT_TYPES.OTHER]: {
        maxGuests: 10000,
        defaultSettings: {
          requireConfirmation: false,
          allowPlusOnes: true,
          maxPlusOnes: 1
        }
      }
    },
    
    // Paramètres par défaut
    DEFAULT_SETTINGS: {
      active: true,
      public: false,
      allowRegistration: true,
      requireApproval: false,
      maxCapacity: 100,
      waitlistEnabled: true,
      earlyAccess: false,
      lateArrival: true
    },
    
    // Limitations
    MAX_GUESTS_PER_EVENT: 10000,
    MAX_SESSIONS_PER_EVENT: 50,
    MAX_TABLES_PER_EVENT: 200,
    MAX_GALLERY_PHOTOS: 1000
  },

  // ==============================================
  // 👥 INVITÉS
  // ==============================================

  /**
   * @constant {Object} GUESTS
   * @description Constantes liées aux invités
   */
  GUESTS: {
    // Statuts
    STATUS: {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      DECLINED: 'declined',
      CANCELLED: 'cancelled',
      WAITLIST: 'waitlist',
      CHECKED_IN: 'checked_in',
      CHECKED_OUT: 'checked_out'
    },
    
    // Types d'invités
    TYPES: {
      PRIMARY: 'primary',
      PLUS_ONE: 'plus_one',
      VIP: 'vip',
      SPEAKER: 'speaker',
      STAFF: 'staff',
      PRESS: 'press'
    },
    
    // Catégories de sièges
    SEATING_CATEGORIES: {
      STANDARD: 'standard',
      VIP: 'vip',
      PREMIUM: 'premium',
      FAMILY: 'family',
      ACCESSIBLE: 'accessible'
    },
    
    // Validation
    EMAIL_OPTIONAL: true,
    PHONE_OPTIONAL: true,
    MAX_PLUS_ONES: 5,
    DEFAULT_SEATS: 1
  },

  // ==============================================
  // 📱 QR CODES
  // ==============================================

  /**
   * @constant {Object} QR_CODES
   * @description Constantes liées aux QR codes
   */
  QR_CODES: {
    // Types de QR codes
    TYPES: {
      INVITATION: 'INV',
      TABLE_INFO: 'TBL',
      EVENT_INFO: 'EVT',
      GALLERY_ACCESS: 'GAL',
      CHECKIN: 'CHK',
      FEEDBACK: 'FDB'
    },
    
    // Formats de données
    DATA_FORMATS: {
      INVITATION: {
        version: 1,
        fields: ['t', 'e', 'g', 'n', 's', 'd', 'sig']
      },
      TABLE_INFO: {
        version: 1,
        fields: ['t', 'e', 'tbl', 'd', 'sig']
      }
    },
    
    // Configuration génération
    GENERATION: {
      DEFAULT_SIZE: 400,
      DEFAULT_MARGIN: 2,
      ERROR_CORRECTION: 'M', // L, M, Q, H
      COLOR_DARK: '#000000',
      COLOR_LIGHT: '#FFFFFF',
      FORMAT: 'png' // png, jpeg, svg, webp
    },
    
    // Validation
    SIGNATURE_LENGTH: 16,
    EXPIRY_DAYS: 30,
    MAX_SCANS_PER_CODE: 10, // Pour éviter les abus
    REUSE_INTERVAL_MS: 5000 // Temps minimum entre scans
  },

  // ==============================================
  // 📷 SCANS & VALIDATION
  // ==============================================

  /**
   * @constant {Object} SCANS
   * @description Constantes liées aux scans
   */
  SCANS: {
    // Types de scans (importés depuis utils/constants)
    TYPES: SCAN_TYPES,
    
    // Statuts de scan
    STATUS: {
      SUCCESS: 'success',
      DUPLICATE: 'duplicate',
      INVALID: 'invalid',
      EXPIRED: 'expired',
      ERROR: 'error'
    },
    
    // Sources de scan
    SOURCES: {
      AGENT_APP: 'agent_app',
      WEB_PORTAL: 'web_portal',
      KIOSK: 'kiosk',
      API: 'api',
      TEST: 'test'
    },
    
    // Configuration
    DUPLICATE_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    BATCH_PROCESSING_SIZE: 100,
    REAL_TIME_SYNC: true
  },

  // ==============================================
  // 💾 STOCKAGE & FICHIERS
  // ==============================================

  /**
   * @constant {Object} STORAGE
   * @description Constantes de stockage
   */
  STORAGE: {
    // Types de fichiers autorisés
    ALLOWED_FILE_TYPES: {
      IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
      ARCHIVES: ['application/zip', 'application/x-rar-compressed']
    },
    
    // Extensions de fichiers
    FILE_EXTENSIONS: {
      IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
      DOCUMENTS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv'],
      ARCHIVES: ['.zip', '.rar']
    },
    
    // Tailles maximales (en octets)
    MAX_FILE_SIZES: {
      IMAGES: 8 * 1024 * 1024, // 8MB
      DOCUMENTS: 10 * 1024 * 1024, // 10MB
      ARCHIVES: 20 * 1024 * 1024, // 20MB
      QR_CODES: 1 * 1024 * 1024, // 1MB
      AVATARS: 2 * 1024 * 1024 // 2MB
    },
    
    // Chemins de stockage
    PATHS: {
      UPLOADS: 'uploads',
      QRCODES: 'qrcodes',
      GALLERIES: 'galleries',
      AVATARS: 'avatars',
      BACKUPS: 'backups',
      TEMP: 'temp'
    },
    
    // Configuration Cloudinary
    CLOUDINARY: {
      DEFAULT_FOLDER: 'secura',
      TRANSFORMATIONS: {
        THUMBNAIL: { width: 150, height: 150, crop: 'fill' },
        SMALL: { width: 400, height: 400, crop: 'limit' },
        MEDIUM: { width: 800, height: 800, crop: 'limit' },
        LARGE: { width: 1200, height: 1200, crop: 'limit' }
      }
    }
  },

  // ==============================================
  // 📧 NOTIFICATIONS & EMAILS
  // ==============================================

  /**
   * @constant {Object} NOTIFICATIONS
   * @description Constantes de notifications
   */
  NOTIFICATIONS: {
    // Types de notifications
    TYPES: {
      EMAIL: 'email',
      SMS: 'sms',
      PUSH: 'push',
      IN_APP: 'in_app'
    },
    
    // Canaux de notification
    CHANNELS: {
      INVITATION: 'invitation',
      REMINDER: 'reminder',
      CONFIRMATION: 'confirmation',
      SCAN: 'scan',
      SYSTEM: 'system',
      PROMOTIONAL: 'promotional'
    },
    
    // Templates d'emails
    EMAIL_TEMPLATES: {
      INVITATION: 'invitation',
      REMINDER: 'reminder',
      CONFIRMATION: 'confirmation',
      QR_CODE: 'qrcode',
      THANK_YOU: 'thankyou',
      PASSWORD_RESET: 'password_reset',
      ACCESS_CODE: 'access_code',
      WELCOME: 'welcome'
    },
    
    // Planning des rappels
    REMINDER_SCHEDULE: {
      ONE_WEEK_BEFORE: 7 * 24 * 60 * 60 * 1000, // 7 jours
      THREE_DAYS_BEFORE: 3 * 24 * 60 * 60 * 1000, // 3 jours
      ONE_DAY_BEFORE: 24 * 60 * 60 * 1000, // 1 jour
      DAY_OF: 2 * 60 * 60 * 1000 // 2 heures avant
    },
    
    // Limites d'envoi
    SENDING_LIMITS: {
      EMAILS_PER_HOUR: 1000,
      SMS_PER_DAY: 100,
      PUSH_PER_MINUTE: 100
    }
  },

  // ==============================================
  // 🔄 SYNCHRONISATION & TEMPS RÉEL
  // ==============================================

  /**
   * @constant {Object} SYNC
   * @description Constantes de synchronisation
   */
  SYNC: {
    // Modes de synchronisation
    MODES: {
      REAL_TIME: 'realtime',
      BATCH: 'batch',
      MANUAL: 'manual',
      OFFLINE: 'offline'
    },
    
    // Intervalles de synchronisation (ms)
    INTERVALS: {
      REAL_TIME: 5000,
      BATCH: 30000,
      OFFLINE: 60000,
      CLEANUP: 120000
    },
    
    // Configuration WebSocket
    WEBSOCKET: {
      HEARTBEAT_INTERVAL: 30000,
      TIMEOUT: 45000,
      RECONNECT_DELAY: 5000,
      MAX_RECONNECT_ATTEMPTS: 5
    },
    
    // Synchronisation hors ligne
    OFFLINE: {
      MAX_QUEUE_SIZE: 1000,
      SYNC_RETRY_ATTEMPTS: 3,
      SYNC_RETRY_DELAY: 5000,
      CONFLICT_RESOLUTION: 'server_wins' // server_wins, client_wins, merge
    }
  },

  // ==============================================
  // 📊 STATISTIQUES & ANALYTICS
  // ==============================================

  /**
   * @constant {Object} ANALYTICS
   * @description Constantes d'analytics
   */
  ANALYTICS: {
    // Métriques principales
    METRICS: {
      TOTAL_GUESTS: 'total_guests',
      SCANNED_GUESTS: 'scanned_guests',
      SCAN_RATE: 'scan_rate',
      AVG_SCAN_TIME: 'avg_scan_time',
      PEAK_SCAN_HOUR: 'peak_scan_hour',
      GUEST_SATISFACTION: 'guest_satisfaction'
    },
    
    // Périodes d'analyse
    TIME_RANGES: {
      REAL_TIME: 'realtime',
      HOURLY: 'hourly',
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly'
    },
    
    // Configuration des rapports
    REPORTS: {
      MAX_DATA_POINTS: 1000,
      CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
      AUTO_GENERATE: ['daily', 'weekly']
    }
  },

  // ==============================================
  // 🎨 INTERFACE UTILISATEUR
  // ==============================================

  /**
   * @constant {Object} UI
   * @description Constantes d'interface utilisateur
   */
  UI: {
    // Pagination
    PAGINATION: {
      DEFAULT_PAGE: 1,
      DEFAULT_LIMIT: 20,
      MAX_LIMIT: 100,
      AVAILABLE_LIMITS: [10, 20, 50, 100]
    },
    
    // Tri et filtrage
    SORT: {
      ASC: 'asc',
      DESC: 'desc',
      DEFAULT_FIELD: 'createdAt',
      AVAILABLE_FIELDS: {
        EVENTS: ['name', 'date', 'createdAt', 'updatedAt'],
        GUESTS: ['firstName', 'lastName', 'email', 'createdAt'],
        SCANS: ['scannedAt', 'guestName']
      }
    },
    
    // Thèmes et couleurs
    THEMES: {
      LIGHT: 'light',
      DARK: 'dark',
      AUTO: 'auto'
    },
    
    // Couleurs de l'application
    COLORS: {
      PRIMARY: '#2563eb',
      SECONDARY: '#64748b',
      SUCCESS: '#10b981',
      WARNING: '#f59e0b',
      ERROR: '#ef4444',
      INFO: '#3b82f6'
    }
  },

  // ==============================================
  // 🌍 INTERNATIONALISATION
  // ==============================================

  /**
   * @constant {Object} I18N
   * @description Constantes d'internationalisation
   */
  I18N: {
    // Langues supportées
    LANGUAGES: {
      FR: 'fr',
      EN: 'en',
      ES: 'es',
      DE: 'de'
    },
    
    // Langue par défaut
    DEFAULT_LANGUAGE: 'fr',
    
    // Fuseaux horaires
    TIMEZONES: {
      DEFAULT: 'Africa/Douala',
      AVAILABLE: [
        'Africa/Douala',
        'Europe/Paris',
        'America/New_York',
        'UTC'
      ]
    },
    
    // Formats de date
    DATE_FORMATS: {
      DISPLAY: 'DD/MM/YYYY HH:mm',
      SHORT: 'DD/MM/YYYY',
      TIME: 'HH:mm',
      ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
    }
  },

  // ==============================================
  // 🔧 CONFIGURATION TECHNIQUE
  // ==============================================

  /**
   * @constant {Object} TECHNICAL
   * @description Constantes techniques
   */
  TECHNICAL: {

    HTTP_STATUS: HTTP_STATUS,
    
    LIMITS: LIMITS,
    
    MESSAGES: MESSAGES,
    
    JOBS: {
      CONCURRENCY: 1,
      ATTEMPTS: 3,
      BACKOFF: 'exponential',
      REMOVE_ON_COMPLETE: true,
      REMOVE_ON_FAIL: false
    },
    
    // Configuration des logs
    LOGGING: {
      LEVELS: ['error', 'warn', 'info', 'debug', 'ultra'],
      RETENTION_DAYS: 30,
      MAX_FILE_SIZE: '100m',
      COMPRESSION: true
    },
    
    // Configuration API
    API: {
      VERSION: 'v1',
      PREFIX: '/api',
      DOCS_PATH: '/api-docs',
      HEALTH_PATH: '/health',
      RATE_LIMIT_SKIP: ['/health', '/api-docs']
    }
  },

  // ==============================================
  // 🎯 FONCTIONNALITÉS SPÉCIFIQUES
  // ==============================================

  /**
   * @constant {Object} FEATURES
   * @description Configuration des fonctionnalités
   */
  FEATURES: {
    // Fonctionnalités activées/désactivées
    FLAGS: {
      MULTI_TENANCY: false,
      ADVANCED_ANALYTICS: true,
      OFFLINE_MODE: true,
      BULK_OPERATIONS: true,
      API_WEBHOOKS: true,
      CUSTOM_DOMAINS: false,
      WHITE_LABEL: false
    },
    
    // Modules
    MODULES: {
      EVENTS: true,
      GUESTS: true,
      QR_CODES: true,
      SCANNING: true,
      ANALYTICS: true,
      NOTIFICATIONS: true,
      GALLERY: true,
      MESSAGING: true
    },
    
    // Limites par plan
    PLANS: {
      FREE: {
        MAX_EVENTS: 5,
        MAX_GUESTS_PER_EVENT: 100,
        MAX_STORAGE: 100 * 1024 * 1024, // 100MB
        FEATURES: ['basic_scanning', 'email_notifications']
      },
      PRO: {
        MAX_EVENTS: 50,
        MAX_GUESTS_PER_EVENT: 1000,
        MAX_STORAGE: 10 * 1024 * 1024 * 1024, // 10GB
        FEATURES: ['advanced_analytics', 'sms_notifications', 'custom_branding']
      },
      ENTERPRISE: {
        MAX_EVENTS: -1, // Illimité
        MAX_GUESTS_PER_EVENT: -1, // Illimité
        MAX_STORAGE: -1, // Illimité
        FEATURES: ['all']
      }
    }
  }
};

// Export avec freeze pour immutabilité
module.exports = Object.freeze(AppConstants);