/**
 * @file config.js
 * @description Configuration centrale de l'application Secura.
 * Gère toutes les variables d'environnement avec validation et valeurs par défaut.
 * @module config
 * @requires dotenv
 */

require('dotenv').config();
const { AppError } = require('../utils/errorHandler');

/**
 * @class Config
 * @description Classe de configuration centralisée pour Secura
 */
class Config {
  constructor() {
    this.validateRequiredConfig();
  }

  /**
   * @function validateRequiredConfig
   * @description Valide les configurations requises pour le fonctionnement de l'application
   * @throws {AppError} Si des configurations requises sont manquantes
   */
  validateRequiredConfig() {
    const required = [
      'PORT',
      'JWT_SECRET',
      'API_KEY',
      'DB_FILE'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new AppError(
        `Configuration manquante: ${missing.join(', ')}`,
        500,
        'CONFIG_ERROR'
      );
    }
  }

  // ==============================================
  // 🌐 SERVEUR & ENVIRONNEMENT
  // ==============================================

  /**
   * @property {number} port
   */
  get port() {
    return parseInt(process.env.PORT) || 3000;
  }

  /**
   * @property {string} nodeEnv
   */
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * @property {boolean} isProduction
   */
  get isProduction() {
    return this.nodeEnv === 'production';
  }

  /**
   * @property {boolean} isDevelopment
   */
  get isDevelopment() {
    return this.nodeEnv === 'development';
  }

  /**
   * @property {string} baseUrl
   */
  get baseUrl() {
    return process.env.BASE_URL || `http://localhost:${this.port}`;
  }

  /**
   * @property {string} appUrl
   */
  get appUrl() {
    return process.env.APP_URL || this.baseUrl;
  }

  /**
   * @property {string} clientUrl
   */
  get clientUrl() {
    return process.env.CLIENT_URL || 'http://localhost:3000';
  }

  // ==============================================
  // 🔐 SÉCURITÉ & AUTHENTIFICATION
  // ==============================================

  /**
   * @property {string} jwtSecret
   */
  get jwtSecret() {
    return process.env.JWT_SECRET;
  }

  /**
   * @property {string} jwtExpiresIn
   */
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * @property {string} jwtRefreshSecret
   */
  get jwtRefreshSecret() {
    return process.env.JWT_REFRESH_SECRET || this.jwtSecret + '_refresh';
  }

  /**
   * @property {string} jwtRefreshExpiresIn
   */
  get jwtRefreshExpiresIn() {
    return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  /**
   * @property {string} apiKey
   */
  get apiKey() {
    return process.env.API_KEY;
  }

  /**
   * @property {string} defaultAccessCode
   */
  get defaultAccessCode() {
    return process.env.DEFAULT_ACCESS_CODE || '1234';
  }

  /**
   * @property {string} corsOrigin
   */
  get corsOrigin() {
    return process.env.CORS_ORIGIN || '*';
  }

  /**
   * @property {boolean} corsCredentials
   */
  get corsCredentials() {
    return process.env.CORS_CREDENTIALS === 'true';
  }

  /**
   * @property {number} rateLimitWindowMs
   */
  get rateLimitWindowMs() {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
  }

  /**
   * @property {number} rateLimitMaxRequests
   */
  get rateLimitMaxRequests() {
    return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  }

  // ==============================================
  // 💾 BASE DE DONNÉES & STOCKAGE
  // ==============================================

  /**
   * @property {string} dbFile
   */
  get dbFile() {
    return process.env.DB_FILE || './data/secura-data.json';
  }

  /**
   * @property {boolean} backupEnabled
   */
  get backupEnabled() {
    return process.env.BACKUP_ENABLED === 'true';
  }

  /**
   * @property {number} backupIntervalMinutes
   */
  get backupIntervalMinutes() {
    return parseInt(process.env.BACKUP_INTERVAL_MINUTES) || 30;
  }

  /**
   * @property {number} backupRetentionDays
   */
  get backupRetentionDays() {
    return parseInt(process.env.BACKUP_RETENTION_DAYS) || 7;
  }

  /**
   * @property {string} backupDir
   */
  get backupDir() {
    return process.env.BACKUP_DIR || './storage/backups';
  }

  /**
   * @property {string} uploadMaxFileSize
   */
  get uploadMaxFileSize() {
    return process.env.UPLOAD_MAX_FILE_SIZE || '50mb';
  }

  /**
   * @property {string[]} uploadAllowedExtensions
   */
  get uploadAllowedExtensions() {
    return (process.env.UPLOAD_ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif,webp,pdf,doc,docx,csv')
      .split(',')
      .map(ext => ext.trim());
  }

  // ==============================================
  // 📧 SERVICE EMAIL
  // ==============================================

  /**
   * @property {Object} sendgrid
   */
  get sendgrid() {
    return {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@secura.com',
      fromName: process.env.SENDGRID_FROM_NAME || 'Secura Events'
    };
  }

  /**
   * @property {Object} mailgun
   */
  get mailgun() {
    return {
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN,
      fromEmail: process.env.MAILGUN_FROM_EMAIL || 'noreply@secura.com'
    };
  }

  /**
   * @property {Object} smtp
   */
  get smtp() {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    };
  }

  // ==============================================
  // 🔥 FIREBASE & OAUTH
  // ==============================================

  /**
   * @property {Object} firebase
   */
  get firebase() {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      vapidKey: process.env.FIREBASE_VAPID_KEY,
      senderId: process.env.FIREBASE_SENDER_ID
    };
  }

  /**
   * @property {Object} oauth
   */
  get oauth() {
    return {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL
      }
    };
  }

  // ==============================================
  // 📱 SERVICES EXTERNES
  // ==============================================

  /**
   * @property {Object} twilio
   */
  get twilio() {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    };
  }

  /**
   * @property {Object} cloudinary
   */
  get cloudinary() {
    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    };
  }

  /**
   * @property {Object} redis
   */
  get redis() {
    return {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      ttl: parseInt(process.env.REDIS_TTL) || 3600
    };
  }

  // ==============================================
  // 🔄 SYNCHRONISATION & PERFORMANCE
  // ==============================================

  /**
   * @property {boolean} syncEnabled
   */
  get syncEnabled() {
    return process.env.SYNC_ENABLED === 'true';
  }

  /**
   * @property {number} syncInterval
   */
  get syncInterval() {
    return parseInt(process.env.SYNC_INTERVAL) || 30000;
  }

  /**
   * @property {number} syncBatchSize
   */
  get syncBatchSize() {
    return parseInt(process.env.SYNC_BATCH_SIZE) || 100;
  }

  /**
   * @property {number} wsHeartbeatInterval
   */
  get wsHeartbeatInterval() {
    return parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000;
  }

  /**
   * @property {number} wsTimeout
   */
  get wsTimeout() {
    return parseInt(process.env.WS_TIMEOUT) || 45000;
  }

  /**
   * @property {string} maxRequestSize
   */
  get maxRequestSize() {
    return process.env.MAX_REQUEST_SIZE || '50mb';
  }

  /**
   * @property {number} requestTimeout
   */
  get requestTimeout() {
    return parseInt(process.env.REQUEST_TIMEOUT) || 30000;
  }

  /**
   * @property {number} maxEventsPerUser
   */
  get maxEventsPerUser() {
    return parseInt(process.env.MAX_EVENTS_PER_USER) || 100;
  }

  /**
   * @property {number} maxGuestsPerEvent
   */
  get maxGuestsPerEvent() {
    return parseInt(process.env.MAX_GUESTS_PER_EVENT) || 10000;
  }

  /**
   * @property {number} maxBulkOperations
   */
  get maxBulkOperations() {
    return parseInt(process.env.MAX_BULK_OPERATIONS) || 1000;
  }

  // ==============================================
  // 📊 LOGS & MONITORING
  // ==============================================

  /**
   * @property {string} logLevel
   */
  get logLevel() {
    return process.env.LOG_LEVEL || 'info';
  }

  /**
   * @property {string} sentryDsn
   */
  get sentryDsn() {
    return process.env.SENTRY_DSN;
  }

  // ==============================================
  // 🎯 FONCTIONNALITÉS SECURA
  // ==============================================

  /**
   * @property {string} qrSecret
   */
  get qrSecret() {
    return process.env.QR_SECRET || 'secura_qr_secret_default';
  }

  /**
   * @property {number} qrExpiryDays
   */
  get qrExpiryDays() {
    return parseInt(process.env.QR_EXPIRY_DAYS) || 30;
  }

  /**
   * @property {number} qrDefaultSize
   */
  get qrDefaultSize() {
    return parseInt(process.env.QR_DEFAULT_SIZE) || 400;
  }

  /**
   * @property {number} sessionTimeout
   */
  get sessionTimeout() {
    return parseInt(process.env.SESSION_TIMEOUT) || 300000;
  }

  /**
   * @property {number} sessionCleanupInterval
   */
  get sessionCleanupInterval() {
    return parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 120000;
  }

  /**
   * @property {number} galleryMaxPhotos
   */
  get galleryMaxPhotos() {
    return parseInt(process.env.GALLERY_MAX_PHOTOS) || 1000;
  }

  /**
   * @property {string} galleryMaxSizePerPhoto
   */
  get galleryMaxSizePerPhoto() {
    return process.env.GALLERY_MAX_SIZE_PER_PHOTO || '8mb';
  }

  /**
   * @property {number} bulkInvitationLimit
   */
  get bulkInvitationLimit() {
    return parseInt(process.env.BULK_INVITATION_LIMIT) || 1000;
  }

  /**
   * @property {number} invitationReminderDays
   */
  get invitationReminderDays() {
    return parseInt(process.env.INVITATION_REMINDER_DAYS) || 3;
  }

  /**
   * @property {boolean} offlineModeEnabled
   */
  get offlineModeEnabled() {
    return process.env.OFFLINE_MODE_ENABLED === 'true';
  }

  /**
   * @property {number} offlineSyncRetryAttempts
   */
  get offlineSyncRetryAttempts() {
    return parseInt(process.env.OFFLINE_SYNC_RETRY_ATTEMPTS) || 3;
  }

  /**
   * @property {number} offlineSyncRetryDelay
   */
  get offlineSyncRetryDelay() {
    return parseInt(process.env.OFFLINE_SYNC_RETRY_DELAY) || 5000;
  }

  // ==============================================
  // 🔧 CONFIGURATIONS AVANCÉES
  // ==============================================

  /**
   * @property {string} encryptionKey
   */
  get encryptionKey() {
    return process.env.ENCRYPTION_KEY || 'default_32_char_encryption_key_';
  }

  /**
   * @property {Object} cron
   */
  get cron() {
    return {
      backup: process.env.CRON_BACKUP_SCHEDULE || '0 */6 * * *',
      cleanup: process.env.CRON_CLEANUP_SCHEDULE || '0 2 * * *',
      reminder: process.env.CRON_REMINDER_SCHEDULE || '0 9 * * *'
    };
  }

  /**
   * @property {number} apiRateLimitPerMinute
   */
  get apiRateLimitPerMinute() {
    return parseInt(process.env.API_RATE_LIMIT_PER_MINUTE) || 60;
  }

  /**
   * @property {number} apiRateLimitPerHour
   */
  get apiRateLimitPerHour() {
    return parseInt(process.env.API_RATE_LIMIT_PER_HOUR) || 1000;
  }

  /**
   * @property {string} uploadTempDir
   */
  get uploadTempDir() {
    return process.env.UPLOAD_TEMP_DIR || './storage/temp';
  }

  /**
   * @property {number} uploadMaxFiles
   */
  get uploadMaxFiles() {
    return parseInt(process.env.UPLOAD_MAX_FILES) || 10;
  }

  /**
   * @property {number} exportMaxRows
   */
  get exportMaxRows() {
    return parseInt(process.env.EXPORT_MAX_ROWS) || 50000;
  }

  /**
   * @property {number} exportChunkSize
   */
  get exportChunkSize() {
    return parseInt(process.env.EXPORT_CHUNK_SIZE) || 1000;
  }

  // ==============================================
  // 🛡️ SÉCURITÉ AVANCÉE
  // ==============================================

  /**
   * @property {boolean} helmetEnabled
   */
  get helmetEnabled() {
    return process.env.HELMET_ENABLED !== 'false';
  }

  /**
   * @property {boolean} cspEnabled
   */
  get cspEnabled() {
    return process.env.CSP_ENABLED === 'true';
  }

  /**
   * @property {boolean} validationStrictMode
   */
  get validationStrictMode() {
    return process.env.VALIDATION_STRICT_MODE === 'true';
  }

  /**
   * @property {boolean} auditLogEnabled
   */
  get auditLogEnabled() {
    return process.env.AUDIT_LOG_ENABLED === 'true';
  }

  /**
   * @property {number} dataRetentionDays
   */
  get dataRetentionDays() {
    return parseInt(process.env.DATA_RETENTION_DAYS) || 365;
  }

  // ==============================================
  // 🌍 INTERNATIONALISATION
  // ==============================================

  /**
   * @property {string} defaultLocale
   */
  get defaultLocale() {
    return process.env.DEFAULT_LOCALE || 'fr';
  }

  /**
   * @property {string} defaultTimezone
   */
  get defaultTimezone() {
    return process.env.DEFAULT_TIMEZONE || 'Africa/Douala';
  }

  // ==============================================
  // 📈 ANALYTICS & MÉTRIQUES
  // ==============================================

  /**
   * @property {string} gaTrackingId
   */
  get gaTrackingId() {
    return process.env.GA_TRACKING_ID;
  }

  /**
   * @property {boolean} metricsEnabled
   */
  get metricsEnabled() {
    return process.env.METRICS_ENABLED === 'true';
  }

  /**
   * @property {number} metricsPort
   */
  get metricsPort() {
    return parseInt(process.env.METRICS_PORT) || 9090;
  }

  // ==============================================
  // 🎯 MÉTHODES UTILITAIRES
  // ==============================================

  /**
   * @function getAllConfig
   * @description Retourne toute la configuration (sans les secrets)
   * @returns {Object} Configuration sécurisée
   */
  getAllConfig() {
    return {
      server: {
        port: this.port,
        nodeEnv: this.nodeEnv,
        baseUrl: this.baseUrl,
        appUrl: this.appUrl,
        clientUrl: this.clientUrl
      },
      security: {
        jwtExpiresIn: this.jwtExpiresIn,
        corsOrigin: this.corsOrigin,
        corsCredentials: this.corsCredentials,
        rateLimitWindowMs: this.rateLimitWindowMs,
        rateLimitMaxRequests: this.rateLimitMaxRequests
      },
      database: {
        dbFile: this.dbFile,
        backupEnabled: this.backupEnabled,
        backupIntervalMinutes: this.backupIntervalMinutes,
        backupRetentionDays: this.backupRetentionDays
      },
      features: {
        syncEnabled: this.syncEnabled,
        syncInterval: this.syncInterval,
        offlineModeEnabled: this.offlineModeEnabled,
        qrExpiryDays: this.qrExpiryDays,
        sessionTimeout: this.sessionTimeout,
        galleryMaxPhotos: this.galleryMaxPhotos,
        bulkInvitationLimit: this.bulkInvitationLimit
      },
      limits: {
        maxEventsPerUser: this.maxEventsPerUser,
        maxGuestsPerEvent: this.maxGuestsPerEvent,
        maxBulkOperations: this.maxBulkOperations,
        maxRequestSize: this.maxRequestSize,
        uploadMaxFiles: this.uploadMaxFiles
      },
      logging: {
        logLevel: this.logLevel,
        auditLogEnabled: this.auditLogEnabled
      },
      internationalization: {
        defaultLocale: this.defaultLocale,
        defaultTimezone: this.defaultTimezone
      }
    };
  }

  /**
   * @function validateConfig
   * @description Valide l'intégralité de la configuration
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateConfig() {
    const errors = [];

    // Validation des URLs
    try {
      new URL(this.baseUrl);
    } catch {
      errors.push('BASE_URL invalide');
    }

    try {
      new URL(this.clientUrl);
    } catch {
      errors.push('CLIENT_URL invalide');
    }

    // Validation des nombres
    if (this.port < 1 || this.port > 65535) {
      errors.push('PORT doit être entre 1 et 65535');
    }

    if (this.maxGuestsPerEvent < 1) {
      errors.push('MAX_GUESTS_PER_EVENT doit être positif');
    }

    if (this.backupIntervalMinutes < 1) {
      errors.push('BACKUP_INTERVAL_MINUTES doit être positif');
    }

    // Validation des chemins
    if (!this.dbFile || this.dbFile.trim() === '') {
      errors.push('DB_FILE est requis');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Instance singleton
const config = new Config();

module.exports = config;