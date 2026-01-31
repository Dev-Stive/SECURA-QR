/**
 * @file email.js
 * @description Configuration et gestion des services d'email pour Secura QR.
 * Support multi-providers (SendGrid, Mailgun, SMTP) avec fallback automatique.
 * Gestion des templates, envoi massif et tracking des performances.
 * @module config/email
 * @requires nodemailer
 * @requires @sendgrid/mail
 * @requires mailgun.js
 * @requires ../utils/errorHandler
 * @requires ../utils/logger
 * @requires ./config
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/helpers/stringHelper
 */

const nodemailer = require('nodemailer');
const sendgrid = require('@sendgrid/mail');
const mailgun = require('mailgun.js');
const config = require('./config');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { formatDate, sleep } = require('../utils/helpers/dateHelper');
const { sanitizeString, truncate } = require('../utils/helpers/stringHelper');

/**
 * @class EmailManager
 * @description Gestionnaire de service email multi-providers
 */
class EmailManager {
  constructor() {
    /** @type {string} */
    this.activeProvider = 'none';
    /** @type {Object} */
    this.providers = new Map();
    /** @type {Object} */
    this.stats = {
      sent: 0,
      failed: 0,
      lastSent: null,
      providers: {}
    };
    /** @type {boolean} */
    this.initialized = false;

    this.initializeEmailService();
  }

  /**
   * @function initializeEmailService
   * @description Initialise le service email avec les providers disponibles
   * @returns {Promise<void>}
   */
  async initializeEmailService() {
    try {
      logger.info('Email: Début initialisation service...');

      // Configuration des providers dans l'ordre de préférence
      await this.configureProviders();

      // Détermination du provider actif
      this.determineActiveProvider();

      // Test de connexion du provider actif
      await this.testActiveProvider();

      this.initialized = true;

      logger.success('Email: Service initialisé avec succès', {
        activeProvider: this.activeProvider,
        availableProviders: Array.from(this.providers.keys()),
        environment: config.nodeEnv
      });

    } catch (error) {
      logger.error('Email: Erreur initialisation service', {
        error: error.message,
        stack: error.stack
      });
      throw new AppError(
        'Erreur initialisation service email',
        500,
        'EMAIL_INIT_ERROR'
      );
    }
  }

  /**
   * @function configureProviders
   * @description Configure tous les providers email disponibles
   * @returns {Promise<void>}
   */
  async configureProviders() {
    const providers = [];

    // SendGrid
    if (config.sendgrid.apiKey) {
      providers.push(this.configureSendGrid());
    }

    // Mailgun
    if (config.mailgun.apiKey && config.mailgun.domain) {
      providers.push(this.configureMailgun());
    }

    // SMTP (Fallback)
    if (config.smtp.host && config.smtp.user && config.smtp.pass) {
      providers.push(this.configureSMTP());
    }

    await Promise.all(providers);

    if (this.providers.size === 0) {
      logger.warn('Email: Aucun provider configuré - Emails désactivés');
    }
  }

  /**
   * @function configureSendGrid
   * @description Configure le provider SendGrid
   * @returns {Promise<void>}
   */
  async configureSendGrid() {
    try {
      sendgrid.setApiKey(config.sendgrid.apiKey);

      this.providers.set('sendgrid', {
        name: 'SendGrid',
        send: async (emailData) => {
          const msg = {
            to: emailData.to,
            from: {
              email: config.sendgrid.fromEmail,
              name: config.sendgrid.fromName
            },
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            attachments: emailData.attachments,
            trackingSettings: {
              clickTracking: { enable: true },
              openTracking: { enable: true }
            }
          };

          const response = await sendgrid.send(msg);
          return {
            provider: 'sendgrid',
            messageId: response[0]?.headers['x-message-id'],
            statusCode: response[0]?.statusCode
          };
        },
        test: async () => {
          // Test simple de l'API key
          await sendgrid.send({
            to: 'test@example.com',
            from: config.sendgrid.fromEmail,
            subject: 'Test SendGrid',
            text: 'Test de connexion SendGrid'
          });
          return true;
        }
      });

      logger.info('Email: Provider SendGrid configuré', {
        fromEmail: config.sendgrid.fromEmail,
        fromName: config.sendgrid.fromName
      });

    } catch (error) {
      logger.error('Email: Erreur configuration SendGrid', {
        error: error.message
      });
    }
  }

  /**
   * @function configureMailgun
   * @description Configure le provider Mailgun
   * @returns {Promise<void>}
   */
  async configureMailgun() {
    try {
      const mg = mailgun.client({
        username: 'api',
        key: config.mailgun.apiKey
      });

      this.providers.set('mailgun', {
        name: 'Mailgun',
        send: async (emailData) => {
          const data = {
            from: `${config.mailgun.fromName} <${config.mailgun.fromEmail}>`,
            to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            attachment: emailData.attachments
          };

          const response = await mg.messages.create(config.mailgun.domain, data);
          return {
            provider: 'mailgun',
            messageId: response.id,
            statusCode: 200
          };
        },
        test: async () => {
          await mg.messages.create(config.mailgun.domain, {
            from: config.mailgun.fromEmail,
            to: 'test@example.com',
            subject: 'Test Mailgun',
            text: 'Test de connexion Mailgun'
          });
          return true;
        }
      });

      logger.info('Email: Provider Mailgun configuré', {
        domain: config.mailgun.domain,
        fromEmail: config.mailgun.fromEmail
      });

    } catch (error) {
      logger.error('Email: Erreur configuration Mailgun', {
        error: error.message
      });
    }
  }

  /**
   * @function configureSMTP
   * @description Configure le provider SMTP (fallback)
   * @returns {Promise<void>}
   */
  async configureSMTP() {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
      });

      // Test de connexion SMTP
      await transporter.verify();

      this.providers.set('smtp', {
        name: 'SMTP',
        send: async (emailData) => {
          const mailOptions = {
            from: `${config.sendgrid.fromName || 'Secura'} <${config.smtp.user}>`,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            attachments: emailData.attachments
          };

          const info = await transporter.sendMail(mailOptions);
          return {
            provider: 'smtp',
            messageId: info.messageId,
            response: info.response
          };
        },
        test: async () => {
          await transporter.verify();
          return true;
        }
      });

      logger.info('Email: Provider SMTP configuré', {
        host: config.smtp.host,
        port: config.smtp.port,
        user: config.smtp.user
      });

    } catch (error) {
      logger.error('Email: Erreur configuration SMTP', {
        error: error.message,
        host: config.smtp.host
      });
    }
  }

  /**
   * @function determineActiveProvider
   * @description Détermine le provider actif selon l'ordre de préférence
   * @returns {void}
   */
  determineActiveProvider() {
    const preferredOrder = ['sendgrid', 'mailgun', 'smtp'];
    
    for (const provider of preferredOrder) {
      if (this.providers.has(provider)) {
        this.activeProvider = provider;
        logger.info('Email: Provider actif déterminé', {
          provider: this.activeProvider
        });
        return;
      }
    }

    this.activeProvider = 'none';
    logger.warn('Email: Aucun provider actif disponible');
  }

  /**
   * @function testActiveProvider
   * @description Teste le provider actif
   * @returns {Promise<void>}
   */
  async testActiveProvider() {
    if (this.activeProvider === 'none') {
      return;
    }

    try {
      const provider = this.providers.get(this.activeProvider);
      await provider.test();
      
      logger.info('Email: Provider actif testé avec succès', {
        provider: this.activeProvider
      });

    } catch (error) {
      logger.error('Email: Échec test provider actif', {
        provider: this.activeProvider,
        error: error.message
      });

      // Essayer un provider de fallback
      await this.fallbackToNextProvider();
    }
  }

  /**
   * @function fallbackToNextProvider
   * @description Passe au provider suivant en cas d'échec
   * @returns {Promise<void>}
   */
  async fallbackToNextProvider() {
    const currentIndex = ['sendgrid', 'mailgun', 'smtp'].indexOf(this.activeProvider);
    const nextProviders = ['sendgrid', 'mailgun', 'smtp'].slice(currentIndex + 1);

    for (const nextProvider of nextProviders) {
      if (this.providers.has(nextProvider)) {
        try {
          const provider = this.providers.get(nextProvider);
          await provider.test();
          
          this.activeProvider = nextProvider;
          logger.warn('Email: Fallback vers nouveau provider', {
            from: this.activeProvider,
            to: nextProvider
          });
          return;

        } catch (error) {
          logger.warn('Email: Fallback provider échoué', {
            provider: nextProvider,
            error: error.message
          });
        }
      }
    }

    logger.error('Email: Tous les providers ont échoué');
    this.activeProvider = 'none';
  }

  /**
   * @function sendEmail
   * @description Envoie un email via le provider actif
   * @param {Object} emailData - Données de l'email
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendEmail(emailData) {
    if (this.activeProvider === 'none') {
      throw new AppError(
        'Aucun service email configuré',
        500,
        'NO_EMAIL_PROVIDER'
      );
    }

    try {
      // Validation des données email
      this.validateEmailData(emailData);

      const provider = this.providers.get(this.activeProvider);
      const startTime = Date.now();

      const result = await provider.send({
        ...emailData,
        html: this.sanitizeEmailContent(emailData.html),
        text: emailData.text || this.htmlToText(emailData.html)
      });

      // Mise à jour des statistiques
      this.updateStats('sent', this.activeProvider);

      const duration = Date.now() - startTime;

      logger.info('Email: Envoyé avec succès', {
        provider: this.activeProvider,
        to: this.maskEmail(emailData.to),
        subject: truncate(emailData.subject, 50),
        duration: `${duration}ms`,
        messageId: result.messageId
      });

      return {
        success: true,
        provider: this.activeProvider,
        messageId: result.messageId,
        duration
      };

    } catch (error) {
      // Mise à jour des statistiques d'échec
      this.updateStats('failed', this.activeProvider);

      logger.error('Email: Échec envoi', {
        provider: this.activeProvider,
        to: this.maskEmail(emailData.to),
        subject: truncate(emailData.subject, 50),
        error: error.message
      });

      // Tentative de fallback automatique
      if (this.activeProvider !== 'smtp') {
        logger.info('Email: Tentative de fallback...');
        await this.fallbackToNextProvider();
        
        if (this.activeProvider !== 'none') {
          return await this.sendEmail(emailData);
        }
      }

      throw new AppError(
        `Échec envoi email: ${error.message}`,
        500,
        'EMAIL_SEND_ERROR',
        { originalError: error.message, provider: this.activeProvider }
      );
    }
  }

  /**
   * @function validateEmailData
   * @description Valide les données d'envoi d'email
   * @param {Object} emailData - Données email à valider
   * @throws {AppError} Si les données sont invalides
   * @returns {void}
   */
  validateEmailData(emailData) {
    if (!emailData.to) {
      throw new AppError(
        'Destinataire email requis',
        400,
        'EMAIL_TO_REQUIRED'
      );
    }

    if (!emailData.subject) {
      throw new AppError(
        'Sujet email requis',
        400,
        'EMAIL_SUBJECT_REQUIRED'
      );
    }

    if (!emailData.html && !emailData.text) {
      throw new AppError(
        'Contenu email requis (html ou text)',
        400,
        'EMAIL_CONTENT_REQUIRED'
      );
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        throw new AppError(
          `Format email invalide: ${email}`,
          400,
          'INVALID_EMAIL_FORMAT'
        );
      }
    }

    logger.debug('Email: Données validées avec succès', {
      to: this.maskEmail(emailData.to),
      subjectLength: emailData.subject.length,
      hasHtml: !!emailData.html,
      hasText: !!emailData.text
    });
  }

  /**
   * @function sanitizeEmailContent
   * @description Nettoie et sécurise le contenu HTML de l'email
   * @param {string} html - Contenu HTML brut
   * @returns {string} Contenu HTML sécurisé
   */
  sanitizeEmailContent(html) {
    if (!html) return '';

    // Suppression des balises dangereuses
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Ajout de styles de base pour la compatibilité
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          ${sanitized}
        </div>
      </body>
      </html>
    `;

    return styledHtml;
  }

  /**
   * @function htmlToText
   * @description Convertit le HTML en texte brut pour le fallback
   * @param {string} html - Contenu HTML
   * @returns {string} Texte brut
   */
  htmlToText(html) {
    if (!html) return '';
    
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * @function maskEmail
   * @description Masque un email pour la confidentialité des logs
   * @param {string|string[]} email - Email(s) à masquer
   * @returns {string} Email(s) masqué(s)
   */
  maskEmail(email) {
    if (Array.isArray(email)) {
      return email.map(e => this.maskSingleEmail(e)).join(', ');
    }
    return this.maskSingleEmail(email);
  }

  /**
   * @function maskSingleEmail
   * @description Masque un email individuel
   * @param {string} email - Email à masquer
   * @returns {string} Email masqué
   */
  maskSingleEmail(email) {
    const [username, domain] = email.split('@');
    if (!username || !domain) return '***@***';
    
    const maskedUsername = username.length <= 2 
      ? username.charAt(0) + '***'
      : username.charAt(0) + '***' + username.charAt(username.length - 1);
    
    return `${maskedUsername}@${domain}`;
  }

  /**
   * @function updateStats
   * @description Met à jour les statistiques d'envoi
   * @param {string} type - Type de statistique ('sent' ou 'failed')
   * @param {string} provider - Provider concerné
   * @returns {void}
   */
  updateStats(type, provider) {
    this.stats[type]++;
    this.stats.lastSent = formatDate();
    
    if (!this.stats.providers[provider]) {
      this.stats.providers[provider] = { sent: 0, failed: 0 };
    }
    
    this.stats.providers[provider][type]++;

    logger.debug('Email: Statistiques mises à jour', {
      type,
      provider,
      totalSent: this.stats.sent,
      totalFailed: this.stats.failed
    });
  }

  /**
   * @function sendBulkEmails
   * @description Envoie des emails en masse avec gestion de débit
   * @param {Object[]} emails - Liste d'emails à envoyer
   * @param {Object} options - Options d'envoi en masse
   * @returns {Promise<Object>} Résultats de l'envoi en masse
   */
  async sendBulkEmails(emails, options = {}) {
    const {
      batchSize = 50,
      delayBetweenBatches = 1000,
      concurrency = 1
    } = options;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new AppError(
        'Liste emails vide ou invalide',
        400,
        'INVALID_EMAIL_LIST'
      );
    }

    if (emails.length > config.bulkInvitationLimit) {
      throw new AppError(
        `Limite d'envoi en masse dépassée: ${emails.length} > ${config.bulkInvitationLimit}`,
        400,
        'BULK_EMAIL_LIMIT_EXCEEDED'
      );
    }

    const results = {
      total: emails.length,
      sent: 0,
      failed: 0,
      batches: 0,
      details: []
    };

    logger.info('Email: Début envoi en masse', {
      total: emails.length,
      batchSize,
      concurrency,
      provider: this.activeProvider
    });

    // Division en lots
    const batches = [];
    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }

    // Traitement des lots
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      results.batches++;

      logger.info(`Email: Traitement lot ${i + 1}/${batches.length}`, {
        batchSize: batch.length,
        progress: `${Math.round(((i * batchSize) / emails.length) * 100)}%`
      });

      // Envoi du lot avec gestion de concurrence
      const batchResults = await this.processBatch(batch, concurrency);
      
      // Agrégation des résultats
      results.sent += batchResults.sent;
      results.failed += batchResults.failed;
      results.details.push(...batchResults.details);

      // Délai entre les lots (sauf pour le dernier)
      if (i < batches.length - 1) {
        await sleep(delayBetweenBatches);
      }
    }

    logger.info('Email: Envoi en masse terminé', {
      total: results.total,
      sent: results.sent,
      failed: results.failed,
      successRate: `${Math.round((results.sent / results.total) * 100)}%`
    });

    return results;
  }

  /**
   * @function processBatch
   * @description Traite un lot d'emails avec gestion de concurrence
   * @param {Object[]} batch - Lot d'emails
   * @param {number} concurrency - Nombre d'emails simultanés
   * @returns {Promise<Object>} Résultats du lot
   */
  async processBatch(batch, concurrency) {
    const results = {
      sent: 0,
      failed: 0,
      details: []
    };

    // Traitement par groupes de concurrence
    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      
      const chunkPromises = chunk.map(async (emailData, index) => {
        try {
          const result = await this.sendEmail(emailData);
          results.sent++;
          results.details.push({
            to: this.maskEmail(emailData.to),
            status: 'sent',
            messageId: result.messageId,
            provider: result.provider
          });
          return { success: true, data: result };
        } catch (error) {
          results.failed++;
          results.details.push({
            to: this.maskEmail(emailData.to),
            status: 'failed',
            error: error.message,
            provider: this.activeProvider
          });
          return { success: false, error };
        }
      });

      await Promise.allSettled(chunkPromises);
    }

    return results;
  }

  /**
   * @function getProviderStatus
   * @description Retourne le statut de tous les providers
   * @returns {Object} Statut des providers
   */
  getProviderStatus() {
    const status = {
      activeProvider: this.activeProvider,
      initialized: this.initialized,
      providers: {}
    };

    for (const [name, provider] of this.providers) {
      status.providers[name] = {
        name: provider.name,
        configured: true,
        active: name === this.activeProvider
      };
    }

    return status;
  }

  /**
   * @function getStats
   * @description Retourne les statistiques d'envoi
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.sent + this.stats.failed > 0 
        ? Math.round((this.stats.sent / (this.stats.sent + this.stats.failed)) * 100)
        : 0,
      initialized: this.initialized,
      activeProvider: this.activeProvider
    };
  }

  /**
   * @function testAllProviders
   * @description Teste tous les providers configurés
   * @returns {Promise<Object>} Résultats des tests
   */
  async testAllProviders() {
    const results = {};

    for (const [name, provider] of this.providers) {
      try {
        await provider.test();
        results[name] = { success: true, error: null };
      } catch (error) {
        results[name] = { success: false, error: error.message };
      }
    }

    logger.info('Email: Tests providers terminés', results);
    return results;
  }
}

// Instance singleton
let emailManager;

try {
  emailManager = new EmailManager();
} catch (error) {
  logger.error('Email: Échec création instance', {
    error: error.message
  });
  emailManager = {
    initialized: false,
    activeProvider: 'none',
    sendEmail: () => { throw new AppError('Service email non disponible', 500, 'EMAIL_SERVICE_UNAVAILABLE'); },
    getStats: () => ({ initialized: false }),
    getProviderStatus: () => ({ activeProvider: 'none', initialized: false })
  };
}

module.exports = {
  initializeEmail: () => emailManager,
  sendEmail: emailManager.sendEmail?.bind(emailManager),
  sendBulkEmails: emailManager.sendBulkEmails?.bind(emailManager),
  getProviderStatus: emailManager.getProviderStatus?.bind(emailManager),
  getStats: emailManager.getStats?.bind(emailManager),
  testAllProviders: emailManager.testAllProviders?.bind(emailManager),
  isInitialized: () => emailManager.initialized
};