/**
 * @file guestModel.js
 * @description Modèle invité pour Secura avec validation complète.
 * Gère les invités, leurs statuts, scans et informations personnelles.
 * @module models/guestModel
 * @requires helpers/idGenerator
 * @requires utils/validation/guestValidation
 * @requires utils/constants
 */

const { generateGuestId } = require('../utils/helpers/idGenerator');
const { validateGuest, validateUpdateGuest } = require('../utils/validation/guestValidation');
const { ValidationError } = require('../utils/errorHandler');
const { STATUS } = require('../utils/constants');

/**
 * @class Guest
 * @description Classe représentant un invité dans Secura.
 * Gère toutes les informations d'un invité et son statut de scan.
 */
class Guest {
  /**
   * @constructor
   * @param {Object} data - Données de l'invité
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {string} [data.firstName] - Prénom
   * @param {string} [data.lastName] - Nom
   * @param {string} [data.email] - Email
   * @param {string} [data.phone] - Téléphone
   * @param {string} [data.company] - Entreprise
   * @param {string} [data.notes] - Notes
   * @param {number} [data.seats=1] - Nombre de places
   * @param {string} [data.status=STATUS.PENDING] - Statut
   * @param {boolean} [data.scanned=false] - Scanné
   * @param {Date} [data.scannedAt] - Date de scan
   * @param {string} [data.qrCodeId] - ID du QR code
   * @param {Object} [data.metadata] - Métadonnées supplémentaires
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.createdAt] - Date de création
   * @param {Date} [data.updatedAt] - Date de modification
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateGuestId();
    this.eventId = data.eventId || '';

    // Informations personnelles
    this.firstName = data.firstName ? data.firstName.trim() : '';
    this.lastName = data.lastName ? data.lastName.trim() : '';
    this.email = data.email ? data.email.toLowerCase().trim() : '';
    this.phone = data.phone ? data.phone.trim() : '';
    this.company = data.company ? data.company.trim() : '';
    this.notes = data.notes ? data.notes.trim() : '';
    this.seats = parseInt(data.seats) || 1;

    // Statut et scan
    this.status = data.status || STATUS.PENDING;
    this.scanned = Boolean(data.scanned);
    this.scannedAt = data.scannedAt || null;
    this.scanCount = parseInt(data.scanCount) || 0;

    // QR Code
    this.qrCodeId = data.qrCodeId || null;
    this.qrCodeData = data.qrCodeData || null;

    // Métadonnées
    this.metadata = {
      category: data.metadata?.category || 'standard',
      tableNumber: data.metadata?.tableNumber || null,
      specialRequirements: data.metadata?.specialRequirements || '',
      invitationSent: Boolean(data.metadata?.invitationSent) || false,
      confirmed: Boolean(data.metadata?.confirmed) || false,
      ...data.metadata
    };

    // Historique
    this.scanHistory = data.scanHistory || [];
    this.confirmationHistory = data.confirmationHistory || [];

    // Timestamps
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON de l'invité
   * @returns {Object} Invité formaté pour JSON
   */
  toJSON() {
    return {
      ...this,
      fullName: this.getFullName(),
      initials: this.getInitials(),
      isConfirmed: this.isConfirmed(),
      canBeScanned: this.canBeScanned()
    };
  }

  /**
   * @method getFullName
   * @description Retourne le nom complet de l'invité
   * @returns {string} Nom complet formaté
   */
  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /**
   * @method getInitials
   * @description Retourne les initiales de l'invité
   * @returns {string} Initiales (2 caractères max)
   */
  getInitials() {
    const first = this.firstName ? this.firstName[0].toUpperCase() : '';
    const last = this.lastName ? this.lastName[0].toUpperCase() : '';
    return (first + last) || '?';
  }

  /**
   * @method isConfirmed
   * @description Vérifie si l'invité est confirmé
   * @returns {boolean} True si confirmé
   */
  isConfirmed() {
    return this.status === STATUS.CONFIRMED || this.metadata.confirmed;
  }

  /**
   * @method canBeScanned
   * @description Vérifie si l'invité peut être scanné
   * @returns {boolean} True si scannable
   */
  canBeScanned() {
    return this.isConfirmed() && !this.scanned;
  }

  /**
   * @method markAsScanned
   * @description Marque l'invité comme scanné
   * @param {Object} scanData - Données du scan
   * @param {string} scanData.scannerId - ID du scanner
   * @param {string} scanData.scannerName - Nom du scanner
   * @param {string} scanData.location - Lieu du scan
   * @returns {boolean} True si réussi
   * @throws {Error} Si déjà scanné
   */
  markAsScanned(scanData = {}) {
    if (this.scanned) {
      throw new Error('Invité déjà scanné');
    }

    if (!this.canBeScanned()) {
      throw new Error('Invité non confirmé ou déjà scanné');
    }

    this.scanned = true;
    this.scannedAt = new Date().toISOString();
    this.scanCount++;
    
    // Ajouter à l'historique
    this.scanHistory.unshift({
      timestamp: this.scannedAt,
      scannerId: scanData.scannerId,
      scannerName: scanData.scannerName,
      location: scanData.location,
      scanId: scanData.scanId
    });

    if (this.scanHistory.length > 10) {
      this.scanHistory = this.scanHistory.slice(0, 10);
    }

    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method markAsUnscanned
   * @description Marque l'invité comme non scanné
   */
  markAsUnscanned() {
    this.scanned = false;
    this.scannedAt = null;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method confirm
   * @description Confirme la présence de l'invité
   * @param {Object} confirmationData - Données de confirmation
   */
  confirm(confirmationData = {}) {
    this.status = STATUS.CONFIRMED;
    this.metadata.confirmed = true;
    
    // Ajouter à l'historique des confirmations
    this.confirmationHistory.unshift({
      timestamp: new Date().toISOString(),
      method: confirmationData.method || 'manual',
      confirmedBy: confirmationData.confirmedBy,
      notes: confirmationData.notes
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method cancel
   * @description Annule la présence de l'invité
   */
  cancel() {
    this.status = STATUS.CANCELLED;
    this.metadata.confirmed = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method updateInfo
   * @description Met à jour les informations de l'invité
   * @param {Object} updates - Données à mettre à jour
   * @throws {ValidationError} Si les données sont invalides
   */
  updateInfo(updates) {
    const validation = validateUpdateGuest(updates);
    if (!validation.valid) {
      throw new ValidationError('Données de mise à jour invalides', validation.errors);
    }

    const allowedFields = [
      'firstName', 'lastName', 'email', 'phone', 
      'company', 'notes', 'seats', 'metadata'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'metadata') {
          this.metadata = { ...this.metadata, ...updates[field] };
        } else {
          this[field] = updates[field];
        }
      }
    });

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method assignToTable
   * @description Assigne l'invité à une table
   * @param {string|number} tableNumber - Numéro de table
   */
  assignToTable(tableNumber) {
    this.metadata.tableNumber = tableNumber;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method addSpecialRequirement
   * @description Ajoute une exigence spéciale
   * @param {string} requirement - Exigence spéciale
   */
  addSpecialRequirement(requirement) {
    if (this.metadata.specialRequirements) {
      this.metadata.specialRequirements += `, ${requirement}`;
    } else {
      this.metadata.specialRequirements = requirement;
    }
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method validate
   * @description Valide les données de l'invité
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    return validateGuest(this);
  }

  /**
   * @method getScanInfo
   * @description Retourne les informations pour le scan
   * @returns {Object} Informations de scan
   */
  getScanInfo() {
    return {
      guestId: this.id,
      eventId: this.eventId,
      fullName: this.getFullName(),
      email: this.email,
      seats: this.seats,
      tableNumber: this.metadata.tableNumber,
      specialRequirements: this.metadata.specialRequirements,
      isConfirmed: this.isConfirmed(),
      scanned: this.scanned,
      scannedAt: this.scannedAt
    };
  }

  /**
   * @static fromJSON
   * @description Crée une instance Guest depuis JSON
   * @param {Object} json - Données JSON
   * @returns {Guest} Instance Guest
   */
  static fromJSON(json) {
    return new Guest(json);
  }

  /**
   * @static createSample
   * @description Crée un invité exemple
   * @param {string} eventId - ID de l'événement
   * @returns {Guest} Invité exemple
   */
  static createSample(eventId) {
    return new Guest({
      eventId,
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      phone: '+237 6 12 34 56 78',
      company: 'Entreprise ABC',
      seats: 2,
      status: STATUS.CONFIRMED,
      metadata: {
        category: 'VIP',
        confirmed: true
      }
    });
  }
}

module.exports = Guest;