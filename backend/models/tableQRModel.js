/**
 * @file tableQRModel.js
 * @description Modèle Table QR Code pour Secura avec validation complète.
 * Gère les QR codes informatifs pour les tables d'événements.
 * Amélioration : Extends QRCode pour unifier, avec type 'table' fixe.
 * @module models/tableQRModel
 * @requires ./qrCodeModel
 * @requires helpers/idGenerator
 * @requires helpers/qrHelper
 * @requires utils/constants
 */
const QRCode = require('./qrCodeModel');
const { generateTableQRId } = require('../utils/helpers/idGenerator');
const { STATUS } = require('../utils/constants');

/**
 * @class TableQR
 * @description Classe représentant un QR code de table informatif dans Secura.
 * Extends QRCode avec type 'table', et méthodes spécifiques aux tables.
 * @extends QRCode
 */
class TableQR extends QRCode {
  /**
   * @constructor
   * @param {Object} data - Données du QR code de table
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {string|number} data.tableNumber - Numéro de table (requis)
   * @param {string} [data.description] - Description de la table
   * @param {number} [data.capacity=8] - Capacité de la table
   * @param {Array} [data.assignedGuests=[]] - Invités assignés à la table
   * @param {Object} [data.content] - Contenu informatif
   * @param {Object} [data.qrConfig] - Configuration du QR code
   */
  constructor(data = {}) {
    super({
      ...data,
      type: QR_CODES.TYPES.TABLE_INFO,
      id: data.id || generateTableQRId(data.tableNumber),
      tableNumber: data.tableNumber ? data.tableNumber.toString() : ''
    });
    // Champs spécifiques aux tables
    this.description = data.description ? data.description.trim() : '';
    this.capacity = parseInt(data.capacity) || 8;
    this.location = data.location || '';
    this.category = data.category || 'general';
    // Invités assignés
    this.assignedGuests = data.assignedGuests || [];
    this.guestCount = this.assignedGuests.length;
    // Contenu informatif
    this.content = {
      welcomeMessage: data.content?.welcomeMessage || `Bienvenue à la ${this.tableName}`,
      menu: data.content?.menu || [],
      program: data.content?.program || [],
      specialNotes: data.content?.specialNotes || '',
      contactPerson: data.content?.contactPerson || '',
      ...data.content
    };
    // Statut
    this.status = data.status || STATUS.ACTIVE;
    this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    // Historique des scans
    this.scanHistory = data.scanHistory || [];
  }

  /**
   * @method assignGuest
   * @description Assigne un invité à la table
   * @param {Object} guestData - Données de l'invité
   * @returns {boolean} True si assigné avec succès
   * @throws {Error} Si table pleine ou invité déjà assigné
   */
  assignGuest(guestData) {
    if (this.isFull()) {
      throw new Error('Table pleine - impossible d\'assigner plus d\'invités');
    }
    const existingGuest = this.assignedGuests.find(g => g.guestId === guestData.guestId);
    if (existingGuest) {
      throw new Error('Invité déjà assigné à cette table');
    }
    const assignment = {
      guestId: guestData.guestId,
      guestName: guestData.guestName || `${guestData.firstName} ${guestData.lastName}`,
      assignedAt: new Date().toISOString(),
      assignedBy: guestData.assignedBy || 'system',
      seats: parseInt(guestData.seats) || 1,
      notes: guestData.notes || ''
    };
    this.assignedGuests.push(assignment);
    this.guestCount = this.assignedGuests.length;
    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method removeGuest
   * @description Retire un invité de la table
   * @param {string} guestId - ID de l'invité
   * @returns {Object|null} Assignment retiré ou null
   */
  removeGuest(guestId) {
    const guestIndex = this.assignedGuests.findIndex(g => g.guestId === guestId);
   
    if (guestIndex === -1) {
      return null;
    }
    const removedGuest = this.assignedGuests.splice(guestIndex, 1)[0];
    this.guestCount = this.assignedGuests.length;
    this.updatedAt = new Date().toISOString();
    return removedGuest;
  }

  /**
   * @method isFull
   * @description Vérifie si la table est pleine
   * @returns {boolean} True si pleine
   */
  isFull() {
    const totalSeats = this.assignedGuests.reduce((sum, guest) => sum + guest.seats, 0);
    return totalSeats >= this.capacity;
  }

  /**
   * @method getAvailableSeats
   * @description Retourne le nombre de places disponibles
   * @returns {number} Places disponibles
   */
  getAvailableSeats() {
    const totalSeats = this.assignedGuests.reduce((sum, guest) => sum + guest.seats, 0);
    return Math.max(0, this.capacity - totalSeats);
  }

  /**
   * @method getOccupancyRate
   * @description Calcule le taux d'occupation de la table
   * @returns {number} Taux d'occupation (0-100)
   */
  getOccupancyRate() {
    const totalSeats = this.assignedGuests.reduce((sum, guest) => sum + guest.seats, 0);
    return this.capacity > 0 ? Math.round((totalSeats / this.capacity) * 100) : 0;
  }

  /**
   * @method recordScan
   * @description Enregistre un scan du QR code de table (surcharge pour stats table-specific)
   * @param {Object} scanData - Données du scan
   */
  recordScan(scanData = {}) {
    super.recordScan(scanData);
    // Stats spécifiques aux tables (ex. : unique scanners)
    if (scanData.scannerId && !this.scanHistory.some(scan => scan.scannerId === scanData.scannerId)) {
      this.stats.uniqueScanners++;
    }
    // Average view time
    if (scanData.duration) {
      const totalScans = this.stats.scans;
      const currentAvg = this.stats.averageViewTime;
      this.stats.averageViewTime =
        ((currentAvg * (totalScans - 1)) + scanData.duration) / totalScans;
    }
  }

  /**
   * @method updateContent
   * @description Met à jour le contenu informatif
   * @param {Object} newContent - Nouveau contenu
   */
  updateContent(newContent) {
    this.content = {
      ...this.content,
      ...newContent
    };
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method updateTableInfo
   * @description Met à jour les informations de la table
   * @param {Object} newInfo - Nouvelles informations
   */
  updateTableInfo(newInfo) {
    const allowedFields = [
      'tableName', 'description', 'capacity', 'location',
      'type', 'category'
    ];
   
    allowedFields.forEach(field => {
      if (newInfo[field] !== undefined) {
        this[field] = newInfo[field];
      }
    });
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method getQRInfo
   * @description Retourne les informations du QR code
   * @returns {Object} Informations QR
   */
  getQRInfo() {
    return {
      tableId: this.id,
      tableNumber: this.tableNumber,
      tableName: this.tableName,
      qrUrl: this.qrUrl,
      scanCount: this.stats.scans,
      lastScan: this.stats.lastScan,
      isActive: this.isActive
    };
  }

  /**
   * @method getGuestList
   * @description Retourne la liste des invités assignés
   * @returns {Array} Liste des invités
   */
  getGuestList() {
    return this.assignedGuests.map(guest => ({
      guestId: guest.guestId,
      guestName: guest.guestName,
      seats: guest.seats,
      assignedAt: guest.assignedAt,
      notes: guest.notes
    }));
  }

  /**
   * @method activate
   * @description Active le QR code de table
   */
  activate() {
    this.isActive = true;
    this.status = STATUS.ACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method deactivate
   * @description Désactive le QR code de table
   */
  deactivate() {
    this.isActive = false;
    this.status = STATUS.INACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method generatePublicUrl
   * @description Génère l'URL publique du QR code
   * @param {string} baseUrl - URL de base de l'application
   * @returns {string} URL publique
   */
  generatePublicUrl(baseUrl) {
    return `${baseUrl}/table/${this.id}/info`;
  }

  /**
   * @static fromJSON
   * @description Crée une instance TableQR depuis JSON
   * @param {Object} json - Données JSON
   * @returns {TableQR} Instance TableQR
   */
  static fromJSON(json) {
    return new TableQR(json);
  }

  /**
   * @static createForEvent
   * @description Crée un QR code de table pour un événement
   * @param {string} eventId - ID de l'événement
   * @param {string|number} tableNumber - Numéro de table
   * @param {Object} options - Options de création
   * @returns {TableQR} Instance TableQR
   */
  static createForEvent(eventId, tableNumber, options = {}) {
    return new TableQR({
      eventId,
      tableNumber,
      tableName: options.tableName || `Table ${tableNumber}`,
      capacity: options.capacity || 8,
      location: options.location || '',
      type: options.type || 'standard',
      content: options.content || {},
      qrConfig: options.qrConfig || {}
    });
  }
}

module.exports = TableQR;