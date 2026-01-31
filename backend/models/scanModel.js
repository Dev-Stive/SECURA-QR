/**
 * @file scanModel.js
 * @description Modèle Scan pour Secura avec validation complète.
 * Gère l'enregistrement et le suivi des scans de QR codes.
 * @module models/scanModel
 * @requires helpers/idGenerator
 * @requires utils/constants
 */

const { generateScanId } = require('../utils/helpers/idGenerator');
const { SCAN_TYPES } = require('../utils/constants');

/**
 * @class Scan
 * @description Classe représentant un scan de QR code dans Secura.
 * Gère l'enregistrement, la validation et le suivi des scans.
 */
class Scan {
  /**
   * @constructor
   * @param {Object} data - Données du scan
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {string} data.guestId - ID de l'invité (requis)
   * @param {string} data.qrCodeId - ID du QR code (requis)
   * @param {string} data.scannerId - ID du scanner (requis)
   * @param {string} [data.scannerName] - Nom du scanner
   * @param {string} [data.type=SCAN_TYPES.ENTRY] - Type de scan
   * @param {string} [data.location] - Lieu du scan
   * @param {string} [data.deviceInfo] - Informations du device
   * @param {boolean} [data.success=true] - Scan réussi
   * @param {string} [data.errorMessage] - Message d'erreur
   * @param {Object} [data.scanData] - Données brutes du scan
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.scannedAt] - Date du scan
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateScanId();
    this.eventId = data.eventId || '';
    this.guestId = data.guestId || '';
    this.qrCodeId = data.qrCodeId || '';
    this.scannerId = data.scannerId || '';

    this.scannerName = data.scannerName || '';
    this.type = data.type || SCAN_TYPES.ENTRY;
    this.location = data.location || '';
    this.deviceInfo = data.deviceInfo || null;

    // Résultat du scan
    this.success = data.success !== undefined ? Boolean(data.success) : true;
    this.errorMessage = data.errorMessage || null;
    this.errorCode = data.errorCode || null;

    // Données techniques
    this.scanData = data.scanData || null;
    this.validationResult = data.validationResult || null;
    this.processTime = parseInt(data.processTime) || 0;

    // Métadonnées
    this.metadata = {
      sessionId: data.metadata?.sessionId,
      ipAddress: data.metadata?.ipAddress,
      userAgent: data.metadata?.userAgent,
      coordinates: data.metadata?.coordinates,
      offline: Boolean(data.metadata?.offline),
      synced: Boolean(data.metadata?.synced),
      ...data.metadata
    };

    // Timestamps
    this.scannedAt = data.scannedAt || new Date().toISOString();
    this.processedAt = data.processedAt || new Date().toISOString();
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON du scan
   * @returns {Object} Scan formaté pour JSON
   */
  toJSON() {
    return {
      ...this,
      isSuccessful: this.success,
      hasError: !!this.errorMessage,
      scanAge: this.getScanAge()
    };
  }

  /**
   * @method markAsSuccessful
   * @description Marque le scan comme réussi
   * @param {Object} result - Résultat du scan
   */
  markAsSuccessful(result = {}) {
    this.success = true;
    this.errorMessage = null;
    this.errorCode = null;
    this.validationResult = result;
    this.processedAt = new Date().toISOString();
  }

  /**
   * @method markAsFailed
   * @description Marque le scan comme échoué
   * @param {string} errorMessage - Message d'erreur
   * @param {string} errorCode - Code d'erreur
   */
  markAsFailed(errorMessage, errorCode = null) {
    this.success = false;
    this.errorMessage = errorMessage;
    this.errorCode = errorCode;
    this.processedAt = new Date().toISOString();
  }

  /**
   * @method getScanAge
   * @description Calcule l'âge du scan en secondes
   * @returns {number} Âge en secondes
   */
  getScanAge() {
    const scanTime = new Date(this.scannedAt);
    const now = new Date();
    return Math.floor((now - scanTime) / 1000);
  }

  /**
   * @method isRecent
   * @description Vérifie si le scan est récent
   * @param {number} maxAgeSeconds - Âge maximum en secondes
   * @returns {boolean} True si récent
   */
  isRecent(maxAgeSeconds = 300) {
    return this.getScanAge() <= maxAgeSeconds;
  }

  /**
   * @method isOffline
   * @description Vérifie si le scan était en mode hors ligne
   * @returns {boolean} True si hors ligne
   */
  isOffline() {
    return this.metadata.offline === true;
  }

  /**
   * @method markAsSynced
   * @description Marque le scan comme synchronisé
   */
  markAsSynced() {
    this.metadata.synced = true;
    this.metadata.syncTime = new Date().toISOString();
  }

  /**
   * @method setLocation
   * @description Définit la localisation du scan
   * @param {string} location - Lieu
   * @param {Object} coordinates - Coordonnées GPS
   */
  setLocation(location, coordinates = null) {
    this.location = location;
    if (coordinates) {
      this.metadata.coordinates = coordinates;
    }
  }

  /**
   * @method setDeviceInfo
   * @description Définit les informations du device
   * @param {Object} deviceInfo - Informations du device
   */
  setDeviceInfo(deviceInfo) {
    this.deviceInfo = {
      ...this.deviceInfo,
      ...deviceInfo
    };
  }

  /**
   * @method setProcessTime
   * @description Définit le temps de traitement
   * @param {number} processTime - Temps en millisecondes
   */
  setProcessTime(processTime) {
    this.processTime = processTime;
  }

  /**
   * @method getScanSummary
   * @description Retourne un résumé du scan
   * @returns {Object} Résumé du scan
   */
  getScanSummary() {
    return {
      scanId: this.id,
      eventId: this.eventId,
      guestId: this.guestId,
      scannerId: this.scannerId,
      scannerName: this.scannerName,
      type: this.type,
      success: this.success,
      scannedAt: this.scannedAt,
      location: this.location,
      errorMessage: this.errorMessage
    };
  }

  /**
   * @method validate
   * @description Valide les données du scan
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.eventId) {
      errors.push('ID événement requis');
    }

    if (!this.guestId) {
      errors.push('ID invité requis');
    }

    if (!this.qrCodeId) {
      errors.push('ID QR code requis');
    }

    if (!this.scannerId) {
      errors.push('ID scanner requis');
    }

    if (!this.scannedAt) {
      errors.push('Date de scan requise');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * @static fromJSON
   * @description Crée une instance Scan depuis JSON
   * @param {Object} json - Données JSON
   * @returns {Scan} Instance Scan
   */
  static fromJSON(json) {
    return new Scan(json);
  }

  /**
   * @static createSuccessfulScan
   * @description Crée un scan réussi
   * @param {Object} data - Données du scan
   * @returns {Scan} Instance Scan réussie
   */
  static createSuccessfulScan(data) {
    const scan = new Scan(data);
    scan.markAsSuccessful();
    return scan;
  }

  /**
   * @static createFailedScan
   * @description Crée un scan échoué
   * @param {Object} data - Données du scan
   * @param {string} errorMessage - Message d'erreur
   * @param {string} errorCode - Code d'erreur
   * @returns {Scan} Instance Scan échouée
   */
  static createFailedScan(data, errorMessage, errorCode = null) {
    const scan = new Scan(data);
    scan.markAsFailed(errorMessage, errorCode);
    return scan;
  }

  /**
   * @static createOfflineScan
   * @description Crée un scan hors ligne
   * @param {Object} data - Données du scan
   * @returns {Scan} Instance Scan hors ligne
   */
  static createOfflineScan(data) {
    const scan = new Scan({
      ...data,
      metadata: {
        ...data.metadata,
        offline: true,
        synced: false
      }
    });
    return scan;
  }
}

module.exports = Scan;