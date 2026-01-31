/**
 * @file emailHelper.js
 * @description Utilitaires d'envoi et formatage d'emails pour Secura.
 * Gère les templates, l'envoi massif et les notifications par email.
 * @module helpers/emailHelper
 * @requires nodemailer
 * @requires handlebars
 * @requires fs
 */

const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

/**
 * @constant {Object} EMAIL_CONFIG
 * @description Configuration du service email
 */
const EMAIL_CONFIG = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Secura Events',
    email: process.env.EMAIL_FROM || 'noreply@secura.com',
  },
};

/**
 * @constant {Object} EMAIL_TEMPLATES_PATH
 * @description Chemins des templates email
 */
const EMAIL_TEMPLATES_PATH = path.join(__dirname, '../../templates/emails');

/**
 * @constant {Object} EMAIL_TYPES
 * @description Types d'emails gérés par Secura
 */
const EMAIL_TYPES = {
  INVITATION: 'invitation',
  REMINDER: 'reminder',
  CONFIRMATION: 'confirmation',
  QR_CODE: 'qrcode',
  THANK_YOU: 'thankyou',
  PASSWORD_RESET: 'password_reset',
  ACCESS_CODE: 'access_code',
  NOTIFICATION: 'notification',
};

/**
 * @function createTransporter
 * @description Crée un transporteur Nodemailer.
 * @returns {nodemailer.Transporter} Transporteur configuré
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: EMAIL_CONFIG.auth,
  });
};

/**
 * @function loadTemplate
 * @description Charge un template email depuis le système de fichiers.
 * @param {string} templateName - Nom du template (sans extension)
 * @returns {Promise<string>} Contenu du template
 * @example
 * const template = await loadTemplate('invitation');
 */
const loadTemplate = async (templateName) => {
  try {
    const templatePath = path.join(EMAIL_TEMPLATES_PATH, `${templateName}.html`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    return templateContent;
  } catch (error) {
    throw new Error(`Template introuvable: ${templateName}`);
  }
};

/**
 * @function compileTemplate
 * @description Compile un template Handlebars avec des données.
 * @param {string} templateContent - Contenu du template
 * @param {Object} data - Données à injecter
 * @returns {string} HTML compilé
 * @example
 * const html = compileTemplate(template, { guestName: 'Jean' });
 */
const compileTemplate = (templateContent, data) => {
  const template = handlebars.compile(templateContent);
  return template(data);
};

/**
 * @function sendEmail
 * @description Envoie un email simple.
 * @param {Object} options - Options d'envoi
 * @param {string|string[]} options.to - Destinataire(s)
 * @param {string} options.subject - Sujet
 * @param {string} [options.text] - Texte brut
 * @param {string} [options.html] - Contenu HTML
 * @param {Object[]} [options.attachments] - Pièces jointes
 * @returns {Promise<Object>} Résultat de l'envoi
 * @example
 * await sendEmail({
 *   to: 'guest@example.com',
 *   subject: 'Invitation',
 *   html: '<h1>Bienvenue</h1>'
 * });
 */
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `${EMAIL_CONFIG.from.name} <${EMAIL_CONFIG.from.email}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || [],
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    throw new Error(`Erreur envoi email: ${error.message}`);
  }
};

/**
 * @function sendTemplateEmail
 * @description Envoie un email avec template.
 * @param {Object} options - Options d'envoi
 * @param {string|string[]} options.to - Destinataire(s)
 * @param {string} options.subject - Sujet
 * @param {string} options.template - Nom du template
 * @param {Object} options.data - Données pour le template
 * @param {Object[]} [options.attachments] - Pièces jointes
 * @returns {Promise<Object>} Résultat de l'envoi
 * @example
 * await sendTemplateEmail({
 *   to: 'guest@example.com',
 *   subject: 'Invitation Mariage',
 *   template: 'invitation',
 *   data: { guestName: 'Jean', eventName: 'Mariage de Raina & Gerard' }
 * });
 */
const sendTemplateEmail = async (options) => {
  try {
    const templateContent = await loadTemplate(options.template);
    const html = compileTemplate(templateContent, options.data);
    
    return await sendEmail({
      to: options.to,
      subject: options.subject,
      html,
      attachments: options.attachments,
    });
  } catch (error) {
    throw new Error(`Erreur envoi template email: ${error.message}`);
  }
};

/**
 * @function sendInvitation
 * @description Envoie une invitation par email.
 * @param {Object} params - Paramètres invitation
 * @param {string} params.to - Email destinataire
 * @param {string} params.guestName - Nom de l'invité
 * @param {string} params.eventName - Nom de l'événement
 * @param {string} params.eventDate - Date de l'événement
 * @param {string} params.eventLocation - Lieu de l'événement
 * @param {string} [params.qrCodeImage] - QR code en base64
 * @param {string} [params.message] - Message personnalisé
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendInvitation = async (params) => {
  const attachments = [];
  
  if (params.qrCodeImage) {
    attachments.push({
      filename: 'invitation-qr.png',
      content: params.qrCodeImage.split('base64,')[1],
      encoding: 'base64',
      cid: 'qrcode',
    });
  }
  
  return await sendTemplateEmail({
    to: params.to,
    subject: `Invitation - ${params.eventName}`,
    template: EMAIL_TYPES.INVITATION,
    data: {
      guestName: params.guestName,
      eventName: params.eventName,
      eventDate: params.eventDate,
      eventLocation: params.eventLocation,
      message: params.message || '',
      hasQRCode: !!params.qrCodeImage,
    },
    attachments,
  });
};

/**
 * @function sendReminder
 * @description Envoie un rappel d'événement.
 * @param {Object} params - Paramètres rappel
 * @param {string} params.to - Email destinataire
 * @param {string} params.guestName - Nom de l'invité
 * @param {string} params.eventName - Nom de l'événement
 * @param {string} params.eventDate - Date de l'événement
 * @param {number} [params.daysUntil] - Jours restants
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendReminder = async (params) => {
  return await sendTemplateEmail({
    to: params.to,
    subject: `Rappel - ${params.eventName}`,
    template: EMAIL_TYPES.REMINDER,
    data: {
      guestName: params.guestName,
      eventName: params.eventName,
      eventDate: params.eventDate,
      daysUntil: params.daysUntil || 0,
    },
  });
};

/**
 * @function sendConfirmation
 * @description Envoie une confirmation de présence.
 * @param {Object} params - Paramètres confirmation
 * @param {string} params.to - Email destinataire
 * @param {string} params.guestName - Nom de l'invité
 * @param {string} params.eventName - Nom de l'événement
 * @param {boolean} params.confirmed - Statut confirmation
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendConfirmation = async (params) => {
  return await sendTemplateEmail({
    to: params.to,
    subject: `Confirmation - ${params.eventName}`,
    template: EMAIL_TYPES.CONFIRMATION,
    data: {
      guestName: params.guestName,
      eventName: params.eventName,
      confirmed: params.confirmed,
    },
  });
};

/**
 * @function sendAccessCode
 * @description Envoie un code d'accès agent.
 * @param {Object} params - Paramètres code d'accès
 * @param {string} params.to - Email destinataire
 * @param {string} params.userName - Nom de l'utilisateur
 * @param {string} params.accessCode - Code d'accès
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendAccessCode = async (params) => {
  return await sendTemplateEmail({
    to: params.to,
    subject: 'Votre code d\'accès Secura',
    template: EMAIL_TYPES.ACCESS_CODE,
    data: {
      userName: params.userName,
      accessCode: params.accessCode,
    },
  });
};

/**
 * @function sendPasswordReset
 * @description Envoie un lien de réinitialisation de mot de passe.
 * @param {Object} params - Paramètres reset
 * @param {string} params.to - Email destinataire
 * @param {string} params.userName - Nom de l'utilisateur
 * @param {string} params.resetLink - Lien de réinitialisation
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendPasswordReset = async (params) => {
  return await sendTemplateEmail({
    to: params.to,
    subject: 'Réinitialisation de votre mot de passe',
    template: EMAIL_TYPES.PASSWORD_RESET,
    data: {
      userName: params.userName,
      resetLink: params.resetLink,
    },
  });
};

/**
 * @function sendBulkEmails
 * @description Envoie des emails en masse avec limitation de débit.
 * @param {Object[]} emails - Tableau d'emails à envoyer
 * @param {number} [batchSize=50] - Taille des lots
 * @param {number} [delayMs=1000] - Délai entre lots (ms)
 * @returns {Promise<Object>} Statistiques d'envoi
 * @example
 * const results = await sendBulkEmails([
 *   { to: 'user1@example.com', subject: 'Test', html: '<p>Hello</p>' },
 *   { to: 'user2@example.com', subject: 'Test', html: '<p>Hello</p>' }
 * ]);
 * // => { sent: 2, failed: 0, results: [...] }
 */
const sendBulkEmails = async (emails, batchSize = 50, delayMs = 1000) => {
  const results = {
    sent: 0,
    failed: 0,
    results: [],
  };
  
  // Diviser en lots
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    // Envoyer le lot en parallèle
    const batchResults = await Promise.allSettled(
      batch.map(email => sendEmail(email))
    );
    
    // Compiler les résultats
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.sent++;
        results.results.push({
          email: batch[index].to,
          status: 'sent',
          messageId: result.value.messageId,
        });
      } else {
        results.failed++;
        results.results.push({
          email: batch[index].to,
          status: 'failed',
          error: result.reason.message,
        });
      }
    });
    
    // Délai entre les lots
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};

/**
 * @function sendBulkInvitations
 * @description Envoie des invitations en masse.
 * @param {Object[]} invitations - Tableau d'invitations
 * @param {number} [batchSize=50] - Taille des lots
 * @returns {Promise<Object>} Statistiques d'envoi
 */
const sendBulkInvitations = async (invitations, batchSize = 50) => {
  const emails = invitations.map(inv => ({
    to: inv.to,
    subject: `Invitation - ${inv.eventName}`,
    template: EMAIL_TYPES.INVITATION,
    data: inv,
  }));
  
  return await sendBulkEmails(emails, batchSize);
};

/**
 * @function validateEmail
 * @description Valide un format d'email.
 * @param {string} email - Email à valider
 * @returns {boolean} True si valide
 */
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * @function validateEmailList
 * @description Valide une liste d'emails.
 * @param {string[]} emails - Liste d'emails
 * @returns {Object} { valid: string[], invalid: string[] }
 */
const validateEmailList = (emails) => {
  const valid = [];
  const invalid = [];
  
  emails.forEach(email => {
    if (validateEmail(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  });
  
  return { valid, invalid };
};

/**
 * @function createEmailPreview
 * @description Génère un aperçu HTML d'un email.
 * @param {string} templateName - Nom du template
 * @param {Object} data - Données du template
 * @returns {Promise<string>} HTML de l'aperçu
 */
const createEmailPreview = async (templateName, data) => {
  const templateContent = await loadTemplate(templateName);
  return compileTemplate(templateContent, data);
};

/**
 * @function testEmailConnection
 * @description Teste la connexion au serveur email.
 * @returns {Promise<boolean>} True si connexion OK
 */
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    throw new Error(`Échec connexion email: ${error.message}`);
  }
};

module.exports = {
  // Constantes
  EMAIL_TYPES,
  EMAIL_CONFIG,
  
  sendEmail,
  sendTemplateEmail,
  
  sendInvitation,
  sendReminder,
  sendConfirmation,
  sendAccessCode,
  sendPasswordReset,
  
  sendBulkEmails,
  sendBulkInvitations,
  
  validateEmail,
  validateEmailList,
  
  loadTemplate,
  compileTemplate,
  createEmailPreview,
  testEmailConnection,
};