/**
 * @file logger.js
 * @description Logger ultra-détaillé pour Secura avec formatage professionnel.
 * Supporte les couleurs, emojis, métadonnées structurées et animations.
 * @module utils/logger
 * @requires winston
 * @requires chalk
 * @requires path
 */

const winston = require('winston');
const chalk = require('chalk');
const path = require('path');
const { format } = winston;
const { combine, timestamp, printf, errors, colorize, metadata } = format;

const LOG_DIR = path.join(__dirname, '../../logs');

// ============================================================================
// CONFIGURATION DES COULEURS ET EMOJIS
// ============================================================================

// Palette de couleurs étendue avec Chalk
const colors = {
  info: chalk.greenBright,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  debug: chalk.cyan,
  fatal: chalk.magenta,
  audit: chalk.blue,
  api: chalk.blue,
  crud: chalk.cyan,
  scan: chalk.green,
  validation: chalk.white,
  timestamp: chalk.gray,
  method: chalk.blueBright,
  endpoint: chalk.cyan,
  status: chalk.white,
  duration: chalk.yellow
};

// Emojis pour chaque type de log
const emojis = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🐛',
  fatal: '💥',
  audit: '📋',
  api: '🌐',
  crud: '💾',
  scan: '📱',
  validation: '✓',
  start: '🚀',
  complete: '🎯',
  database: '🗄️',
  security: '🔒',
  performance: '⚡'
};

// ============================================================================
// FORMATAGE PERSONNALISÉ
// ============================================================================

/**
 * @function formatMetadata
 * @description Formate les métadonnées de manière structurée et colorée
 */
const formatMetadata = (meta) => {
  if (!meta || Object.keys(meta).length === 0) return '';
  
  const entries = Object.entries(meta)
    .map(([key, value]) => {
      const formattedKey = chalk.blueBright(`${key}:`);
      let formattedValue;
      
      if (typeof value === 'object') {
        formattedValue = chalk.white(JSON.stringify(value, null, 2).replace(/\n/g, '\n    '));
      } else if (typeof value === 'boolean') {
        formattedValue = value ? chalk.green('true') : chalk.red('false');
      } else if (typeof value === 'number') {
        formattedValue = chalk.yellow(value);
      } else {
        formattedValue = chalk.white(value);
      }
      
      return `    ${formattedKey} ${formattedValue}`;
    })
    .join('\n');
  
  return `\n${chalk.gray('╔═══════════════════════════════════════════════════════════════╗')}\n` +
         `${chalk.gray('║')} ${chalk.blueBright('MÉTADONNÉES')} ${chalk.gray('║')}\n` +
         `${chalk.gray('╠═══════════════════════════════════════════════════════════════╣')}\n` +
         `${entries}\n` +
         `${chalk.gray('╚═══════════════════════════════════════════════════════════════╝')}`;
};

/**
 * @function formatTimestamp
 * @description Formate le timestamp de manière élégante
 */
const formatTimestamp = (timestamp) => {
  return chalk.gray(`[${new Date(timestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}]`);
};

/**
 * @constant {Function} consoleFormat
 * @description Format personnalisé pour la console avec couleurs et structure
 */
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  const ts = formatTimestamp(timestamp);
  const metaStr = formatMetadata(metadata);
  
  return `${ts} ${level} ${message}${metaStr}`;
});

/**
 * @constant {Function} fileFormat
 * @description Format pour les fichiers (sans couleurs)
 */
const fileFormat = printf(({ level, message, timestamp, ...metadata }) => {
  const metaStr = metadata && Object.keys(metadata).length > 0 
    ? `\nMETADATA: ${JSON.stringify(metadata, null, 2)}`
    : '';
  
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
});

// ============================================================================
// CONFIGURATION WINSTON AVANCÉE
// ============================================================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    metadata({ fillExcept: ['message', 'level', 'timestamp', 'stack'] })
  ),
  transports: [
    // Fichier d'erreurs
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Fichier combiné
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Fichier d'audit
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'audit.log'),
      level: 'audit',
      format: fileFormat,
      maxsize: 10485760,
      maxFiles: 10
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'rejections.log')
    })
  ]
});

// Transport console uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      consoleFormat
    )
  }));
}

// ============================================================================
// LOGGER PERSONNALISÉ AVEC MÉTHODES SPÉCIALISÉES
// ============================================================================

const log = {
  // ==========================================================================
  // LOGS GÉNÉRAUX
  // ==========================================================================
  
  info: (msg, meta = {}) => {
    logger.info(`${emojis.info} ${colors.info(msg)}`, meta);
  },
  
  success: (msg, meta = {}) => {
    logger.info(`${emojis.success} ${colors.success(msg)}`, meta);
  },
  
  warning: (msg, meta = {}) => {
    logger.warn(`${emojis.warning} ${colors.warning(msg)}`, meta);
  },
  
  error: (msg, meta = {}) => {
    logger.error(`${emojis.error} ${colors.error(msg)}`, meta);
  },
  
  debug: (msg, meta = {}) => {
    logger.debug(`${emojis.debug} ${colors.debug(msg)}`, meta);
  },
  
  fatal: (msg, meta = {}) => {
    logger.error(`${emojis.fatal} ${colors.fatal('FATAL: ' + msg)}`, meta);
  },
  
  audit: (msg, meta = {}) => {
    logger.log('audit', `${emojis.audit} ${colors.audit(msg)}`, meta);
  },
  
  // ==========================================================================
  // LOGS SPÉCIALISÉS POUR L'APPLICATION
  // ==========================================================================
  
  api: (method, endpoint, status, duration = null, meta = {}) => {
    const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;
    const methodColor = method === 'GET' ? colors.method : 
                       method === 'POST' ? chalk.green : 
                       method === 'PUT' ? chalk.yellow : 
                       method === 'DELETE' ? chalk.red : colors.method;
    
    const durationStr = duration ? ` ${colors.duration(`(${duration}ms)`)}` : '';
    const message = `${emojis.api} ${methodColor(method.padEnd(6))} ${colors.endpoint(endpoint)} ${statusColor(status)}${durationStr}`;
    
    logger.info(message, meta);
  },
  
  crud: (action, resource, data = null, meta = {}) => {
    const actionColor = action === 'CREATE' ? chalk.green :
                       action === 'UPDATE' ? chalk.yellow :
                       action === 'DELETE' ? chalk.red : colors.crud;
    
    const dataMeta = data ? { data } : {};
    const message = `${emojis.crud} ${colors.crud('[CRUD]')} ${actionColor(action.padEnd(6))} ${chalk.white(resource)}`;
    
    logger.info(message, { ...dataMeta, ...meta });
  },
  
  scan: (guestName, eventName = null, meta = {}) => {
    const eventStr = eventName ? ` @ ${chalk.cyan(eventName)}` : '';
    const message = `${emojis.scan} ${colors.scan('[SCAN]')} ${chalk.white(guestName)}${eventStr}`;
    
    logger.info(message, meta);
  },
  
  validation: (field, status, message = '', meta = {}) => {
    const icon = status ? emojis.validation : '✗';
    const color = status ? chalk.green : chalk.red;
    const statusText = status ? 'VALID' : 'INVALID';
    
    const logMessage = `${icon} ${colors.validation(field)} ${color(statusText)} ${chalk.white(message)}`;
    logger.info(logMessage, meta);
  },
  
  // ==========================================================================
  // LOGS SPÉCIALISÉS POUR LES SERVICES
  // ==========================================================================
  
  database: (operation, collection, details = '', meta = {}) => {
    const message = `${emojis.database} ${chalk.blue('[DB]')} ${chalk.white(operation)} ${chalk.cyan(collection)} ${chalk.gray(details)}`;
    logger.info(message, meta);
  },
  
  security: (action, user = 'system', details = '', meta = {}) => {
    const message = `${emojis.security} ${chalk.yellow('[SECURITY]')} ${chalk.white(action)} ${chalk.cyan(user)} ${chalk.gray(details)}`;
    logger.info(message, meta);
  },
  
  performance: (operation, duration, details = '', meta = {}) => {
    const durationColor = duration > 1000 ? chalk.red : 
                         duration > 500 ? chalk.yellow : chalk.green;
    
    const message = `${emojis.performance} ${chalk.magenta('[PERF]')} ${chalk.white(operation)} ${durationColor(`${duration}ms`)} ${chalk.gray(details)}`;
    logger.info(message, meta);
  },
  
  startup: (service, status, details = '', meta = {}) => {
    const icon = status ? emojis.success : emojis.error;
    const color = status ? chalk.green : chalk.red;
    const statusText = status ? 'READY' : 'FAILED';
    
    const message = `${icon} ${chalk.blue('[STARTUP]')} ${chalk.white(service)} ${color(statusText)} ${chalk.gray(details)}`;
    logger.info(message, meta);
  },
  
  shutdown: (service, details = '', meta = {}) => {
    const message = `${emojis.complete} ${chalk.blue('[SHUTDOWN]')} ${chalk.white(service)} ${chalk.gray(details)}`;
    logger.info(message, meta);
  },
  
  // ==========================================================================
  // MÉTHODES AVANCÉES
  // ==========================================================================
  
  /**
   * @function withContext
   * @description Crée un logger avec un contexte spécifique
   */
  withContext: (context) => {
    return {
      info: (msg, meta = {}) => log.info(msg, { ...context, ...meta }),
      error: (msg, meta = {}) => log.error(msg, { ...context, ...meta }),
      warn: (msg, meta = {}) => log.warning(msg, { ...context, ...meta }),
      debug: (msg, meta = {}) => log.debug(msg, { ...context, ...meta }),
      crud: (action , resource ,data , meta={}) => log.crud(action, resource, data = null, meta = {}),
    };
  },
  
  /**
   * @function startTimer
   * @description Démarre un timer pour mesurer les performances
   */
  startTimer: (operation) => {
    const start = Date.now();
    return {
      end: (meta = {}) => {
        const duration = Date.now() - start;
        log.performance(operation, duration, '', meta);
        return duration;
      }
    };
  },
  
  /**
   * @function trackOperation
   * @description Track une opération avec début et fin
   */
  trackOperation: (operation, meta = {}) => {
    const timer = log.startTimer(operation);
    log.info(`${emojis.start} Début: ${operation}`, meta);
    
    return {
      success: (resultMeta = {}) => {
        const duration = timer.end(resultMeta);
        log.success(`${emojis.complete} Terminé: ${operation}`, { 
          duration, 
          ...resultMeta 
        });
        return duration;
      },
      error: (error, errorMeta = {}) => {
        timer.end(errorMeta);
        log.error(`${emojis.error} Échec: ${operation}`, { 
          error: error.message, 
          ...errorMeta 
        });
        throw error;
      }
    };
  }
};

// ============================================================================
// EXPORT AVEC CONFIGURATION GLOBALE
// ============================================================================

// Configuration globale pour les métadonnées sensibles
const sensitiveFields = ['password', 'token', 'jwt', 'secret', 'privateKey', 'authorization'];

// Middleware pour masquer les champs sensibles dans les logs
const maskSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked = { ...obj };
  sensitiveFields.forEach(field => {
    if (masked[field]) {
      masked[field] = '***MASKED***';
    }
  });
  
  return masked;
};

// Appliquer le masquage à toutes les métadonnées
const originalLog = logger.log;
logger.log = function(level, message, meta, callback) {
  const safeMeta = maskSensitiveData(meta);
  return originalLog.call(this, level, message, safeMeta, callback);
}
// Schéma pour les métadonnées du QR code;

module.exports = log;