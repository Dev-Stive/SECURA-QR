/**
 * @file qrCodeModel.js
 * @description Modèle QR Code pour Secura avec validation complète.
 * Gère la génération, validation et gestion des QR codes pour invitations, tables, etc.
 * Amélioration : Unifié pour tous types (invitation, table), avec champs conditionnels pour table (tableNumber, content).
 * @module models/qrCodeModel
 * @requires helpers/idGenerator
 * @requires helpers/qrHelper
 * @requires utils/validation/qrValidation
 * @requires utils/constants
 */
const { generateQRCodeId } = require('../utils/helpers/idGenerator');
const { generateInvitationData, generateTableQRData, validateQRCode } = require('../utils/helpers/qrHelper');
const { validateQRCodeData } = require('../utils/validation/qrValidation');
const { QR_CODES } = require('../utils/constants');

/**
 * @class QRCode
 * @description Classe représentant un QR Code dans Secura.
 * Gère la génération, le stockage et la validation des QR codes pour tous types.
 * Pour type 'table', utilise champs comme tableNumber, content.
 */
class QRCode {
  /**
   * @constructor
   * @param {Object} data - Données du QR code
   * @param {string} data.guestId - ID de l'invité (requis pour 'invitation')
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {Object} data.data - Données encodées dans le QR
   * @param {string} [data.type='invitation'] - Type de QR code (invitation, table, etc.)
   * @param {Object} [data.config] - Configuration du QR code
   * @param {string} [data.imageData] - Image du QR code (base64)
   * @param {string} [data.imageUrl] - URL de l'image
   * @param {boolean} [data.active=true] - QR code actif
   * @param {number} [data.scanCount=0] - Nombre de scans
   * @param {Date} [data.lastScanned] - Dernier scan
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.createdAt] - Date de création
   * @param {Date} [data.updatedAt] - Date de modification
   * @param {string|number} [data.tableNumber] - Numéro de table (requis pour 'table')
   * @param {Object} [data.content] - Contenu informatif (pour 'table')
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateQRCodeId();
    this.guestId = data.guestId || '';
    this.eventId = data.eventId || '';
    // Données du QR code
    this.type = data.type || QR_CODES.TYPES.INVITATION;
    this.data = data.data || null;
    this.rawData = data.rawData || '';
    // Champs spécifiques à 'table'
    if (this.type === QR_CODES.TYPES.TABLE_INFO) {
      this.tableNumber = data.tableNumber ? data.tableNumber.toString() : '';
      this.content = data.content || {};
    }
    // Configuration
    this.config = {
      size: data.config?.size || QR_CODES.GENERATION.DEFAULT_SIZE,
      foreground: data.config?.foreground || QR_CODES.GENERATION.COLOR_DARK,
      background: data.config?.background || QR_CODES.GENERATION.COLOR_LIGHT,
      style: data.config?.style || 'square',
      errorLevel: data.config?.errorLevel || QR_CODES.GENERATION.ERROR_CORRECTION,
      includeLogo: data.config?.includeLogo !== false,
      margin: data.config?.margin || QR_CODES.GENERATION.DEFAULT_MARGIN,
      ...data.config
    };
    
    this.imageData = data.imageData || null;
    this.imageUrl = data.imageUrl || null;
    this.filePath = data.filePath || null;
    // Statut et utilisation
    this.active = data.active !== undefined ? Boolean(data.active) : true;
    this.scanCount = parseInt(data.scanCount) || 0;
    this.lastScanned = data.lastScanned || null;
    this.maxScans = parseInt(data.maxScans) || QR_CODES.MAX_SCANS_PER_CODE;
    // Sécurité
    this.signature = data.signature || null;
    this.expiresAt = data.expiresAt || null;
    this.isExpired = Boolean(data.isExpired) || false;
    // Métadonnées
    this.metadata = {
      generatedBy: data.metadata?.generatedBy || 'system',
      generationMethod: data.metadata?.generationMethod || 'auto',
      version: data.metadata?.version || '1.0',
      ...data.metadata
    };
    // Historique
    this.scanHistory = data.scanHistory || [];
    this.generationHistory = data.generationHistory || [];
    // Timestamps
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON du QR code
   * @returns {Object} QR code formaté pour JSON
   */
  toJSON() {
    return {
      ...this,
      isValid: this.isValid(),
      isExpired: this.isExpired,
      canBeScanned: this.canBeScanned(),
      scanInfo: this.getScanInfo()
    };
  }

  /**
   * @method generateData
   * @description Génère les données encodées selon le type
   * @param {Object} info - Informations spécifiques (guestInfo ou tableInfo)
   * @returns {Object} Données générées
   */
  generateData(info = {}) {
    let qrData;
    if (this.type === QR_CODES.TYPES.INVITATION) {
      qrData = generateInvitationData({
        eventId: this.eventId,
        guestId: this.guestId,
        ...info
      });
    } else if (this.type === QR_CODES.TYPES.TABLE_INFO) {
      qrData = generateTableQRData({
        eventId: this.eventId,
        tableNumber: this.tableNumber,
        ...info
      });
    } else {
      throw new Error(`Type QR non supporté: ${this.type}`);
    }
    this.data = qrData;
    this.rawData = JSON.stringify(qrData);
    // Enregistrer la génération
    this.generationHistory.unshift({
      timestamp: new Date().toISOString(),
      method: this.type,
      data: qrData
    });
    this.updatedAt = new Date().toISOString();
    return qrData;
  }

  /**
   * @method validate
   * @description Valide le QR code
   * @returns {Object} { valid: boolean, error?: string, data?: Object }
   */
  validate() {
    if (!this.active) {
      return { valid: false, error: 'QR code désactivé' };
    }
    if (this.isExpired) {
      return { valid: false, error: 'QR code expiré' };
    }
    if (this.scanCount >= this.maxScans) {
      return { valid: false, error: 'QR code déjà utilisé' };
    }
    if (!this.data) {
      return { valid: false, error: 'Données QR code manquantes' };
    }
    return validateQRCode(this.data);
  }

  /**
   * @method isValid
   * @description Vérifie si le QR code est valide
   * @returns {boolean} True si valide
   */
  isValid() {
    const validation = this.validate();
    return validation.valid;
  }

  /**
   * @method canBeScanned
   * @description Vérifie si le QR code peut être scanné
   * @returns {boolean} True si scannable
   */
  canBeScanned() {
    return this.isValid() && this.active && !this.isExpired && this.scanCount < this.maxScans;
  }

  /**
   * @method recordScan
   * @description Enregistre un scan du QR code
   * @param {Object} scanData - Données du scan
   * @returns {boolean} True si réussi
   * @throws {Error} Si non scannable
   */
  recordScan(scanData = {}) {
    if (!this.canBeScanned()) {
      throw new Error('QR code non scannable');
    }
    this.scanCount++;
    this.lastScanned = new Date().toISOString();
    // Ajouter à l'historique
    this.scanHistory.unshift({
      timestamp: this.lastScanned,
      scannerId: scanData.scannerId,
      scannerName: scanData.scannerName,
      location: scanData.location,
      scanId: scanData.scanId
    });
    // Limiter l'historique
    if (this.scanHistory.length > 10) {
      this.scanHistory = this.scanHistory.slice(0, 10);
    }
    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method deactivate
   * @description Désactive le QR code
   */
  deactivate() {
    this.active = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method activate
   * @description Active le QR code
   */
  activate() {
    this.active = true;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method expire
   * @description Expire le QR code
   */
  expire() {
    this.isExpired = true;
    this.active = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method setExpiration
   * @description Définit la date d'expiration
   * @param {Date|string} expirationDate - Date d'expiration
   */
  setExpiration(expirationDate) {
    this.expiresAt = new Date(expirationDate).toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method checkExpiration
   * @description Vérifie et met à jour l'état d'expiration
   * @returns {boolean} True si expiré
   */
  checkExpiration() {
    if (!this.expiresAt) return false;
   
    const now = new Date();
    const expires = new Date(this.expiresAt);
    this.isExpired = now > expires;
   
    if (this.isExpired) {
      this.active = false;
    }
    this.updatedAt = new Date().toISOString();
    return this.isExpired;
  }

  /**
   * @method updateConfig
   * @description Met à jour la configuration du QR code
   * @param {Object} newConfig - Nouvelle configuration
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method getScanInfo
   * @description Retourne les informations de scan
   * @returns {Object} Informations de scan
   */
  getScanInfo() {
    return {
      qrCodeId: this.id,
      guestId: this.guestId,
      eventId: this.eventId,
      type: this.type,
      scanCount: this.scanCount,
      maxScans: this.maxScans,
      lastScanned: this.lastScanned,
      active: this.active,
      isExpired: this.isExpired,
      canBeScanned: this.canBeScanned()
    };
  }

  /**
   * @method validateData
   * @description Valide les données du QR code
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateData() {
    return validateQRCodeData(this);
  }

  /**
   * @static fromJSON
   * @description Crée une instance QRCode depuis JSON
   * @param {Object} json - Données JSON
   * @returns {QRCode} Instance QRCode
   */
  static fromJSON(json) {
    return new QRCode(json);
  }

  /**
   * @static createForGuest
   * @description Crée un QR code pour un invité (type 'invitation')
   * @param {string} guestId - ID de l'invité
   * @param {string} eventId - ID de l'événement
   * @param {Object} guestInfo - Informations de l'invité
   * @returns {QRCode} Instance QRCode
   */
  static createForGuest(guestId, eventId, guestInfo = {}) {
    const qrCode = new QRCode({
      guestId,
      eventId,
      type: QR_CODES.TYPES.INVITATION
    });
    qrCode.generateData(guestInfo);
    return qrCode;
  }

  /**
   * @static createForTable
   * @description Crée un QR code pour une table (type 'table')
   * @param {string} eventId - ID de l'événement
   * @param {string|number} tableNumber - Numéro de table
   * @param {Object} tableInfo - Informations de la table
   * @returns {QRCode} Instance QRCode
   */
  static createForTable(eventId, tableNumber, tableInfo = {}) {
    const qrCode = new QRCode({
      eventId,
      type: QR_CODES.TYPES.TABLE_INFO,
      tableNumber
    });
    qrCode.generateData(tableInfo);
    return qrCode;
  }
}

module.exports = QRCode;