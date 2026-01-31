/**
 * @file eventModel.js
 * @description Modèle événement pour Secura avec validation complète.
 * Gère les événements, leurs paramètres et statistiques.
 * @module models/eventModel
 * @requires helpers/idGenerator
 * @requires utils/validation/eventValidation
 * @requires utils/constants
 */

const { generateEventId } = require('../utils/helpers/idGenerator');
const { validateEvent } = require('../utils/validation/eventValidation');
const { EVENT_TYPES, STATUS } = require('../utils/constants');

/**
 * @class Event
 * @description Classe représentant un événement dans Secura.
 * Gère tous les aspects d'un événement : configuration, invités, scans, statistiques.
 */
class Event {
  /**
   * @constructor
   * @param {Object} data - Données de l'événement
   * @param {string} data.name - Nom de l'événement (requis)
   * @param {string} data.type - Type d'événement (wedding, conference, etc.)
   * @param {string} data.date - Date de l'événement (requis)
   * @param {string} data.time - Heure de l'événement
   * @param {string} data.location - Lieu de l'événement (requis)
   * @param {number} data.capacity - Capacité maximale
   * @param {string} data.description - Description de l'événement
   * @param {string} data.welcomeMessage - Message de bienvenue
   * @param {boolean} data.active - Événement actif
   * @param {Object} data.settings - Paramètres de l'événement
   * @param {Object} data.design - Design et apparence
   * @param {string} data.organizerId - ID de l'organisateur
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.createdAt] - Date de création
   * @param {Date} [data.updatedAt] - Date de modification
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateEventId();
    this.organizerId = data.organizerId || null;

    // Informations de base
    this.name = data.name ? data.name.trim() : '';
    this.type = data.type || EVENT_TYPES.OTHER;
    this.date = data.date || '';
    this.time = data.time || '';
    this.location = data.location ? data.location.trim() : '';
    this.capacity = parseInt(data.capacity) || 0;
    this.description = data.description ? data.description.trim() : '';
    this.welcomeMessage = data.welcomeMessage ? data.welcomeMessage.trim() : '';

    // Statut et activation
    this.active = data.active !== undefined ? Boolean(data.active) : true;
    this.status = data.status || STATUS.ACTIVE;

 


    // Statistiques (calculées)
    this.stats = {
      totalGuests: parseInt(data.stats?.totalGuests) || 0,
      confirmedGuests: parseInt(data.stats?.confirmedGuests) || 0,
      scannedGuests: parseInt(data.stats?.scannedGuests) || 0,
      totalScans: parseInt(data.stats?.totalScans) || 0,
      scanRate: parseFloat(data.stats?.scanRate) || 0,
      lastScan: data.stats?.lastScan || null,
      ...data.stats
    };

    // Métadonnées
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON de l'événement
   * @returns {Object} Événement formaté pour JSON
   */
  toJSON() {
    return {
      ...this,
      isFull: this.isFull(),
      isPast: this.isPast(),
      isToday: this.isToday(),
      daysUntil: this.getDaysUntil()
    };
  }

  /**
   * @method isFull
   * @description Vérifie si l'événement est complet
   * @returns {boolean} True si complet
   */
  isFull() {
    return this.capacity > 0 && this.stats.confirmedGuests >= this.capacity;
  }

  /**
   * @method isPast
   * @description Vérifie si l'événement est passé
   * @returns {boolean} True si passé
   */
  isPast() {
    if (!this.date) return false;
    const eventDate = new Date(`${this.date}T${this.time || '23:59:59'}`);
    return eventDate < new Date();
  }

  /**
   * @method isToday
   * @description Vérifie si l'événement est aujourd'hui
   * @returns {boolean} True si aujourd'hui
   */
  isToday() {
    if (!this.date) return false;
    const today = new Date().toISOString().split('T')[0];
    return this.date === today;
  }

  /**
   * @method getDaysUntil
   * @description Calcule le nombre de jours jusqu'à l'événement
   * @returns {number} Nombre de jours (négatif si passé)
   */
  getDaysUntil() {
    if (!this.date) return Infinity;
    const eventDate = new Date(`${this.date}T${this.time || '00:00:00'}`);
    const today = new Date();
    const diffTime = eventDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * @method updateStats
   * @description Met à jour les statistiques de l'événement
   * @param {Object} guestData - Données des invités
   * @param {number} guestData.total - Total invités
   * @param {number} guestData.confirmed - Invités confirmés
   * @param {number} guestData.scanned - Invités scannés
   * @param {number} guestData.totalScans - Total scans
   */
  updateStats(guestData = {}) {
    this.stats.totalGuests = parseInt(guestData.total) || 0;
    this.stats.confirmedGuests = parseInt(guestData.confirmed) || 0;
    this.stats.scannedGuests = parseInt(guestData.scanned) || 0;
    this.stats.totalScans = parseInt(guestData.totalScans) || 0;
    
    // Calculer le taux de scan
    this.stats.scanRate = this.stats.totalGuests > 0 
      ? Math.round((this.stats.scannedGuests / this.stats.totalGuests) * 100) 
      : 0;

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method recordScan
   * @description Enregistre un scan pour les statistiques
   */
  recordScan() {
    this.stats.totalScans++;
    this.stats.lastScan = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method canAddGuest
   * @description Vérifie si on peut ajouter un invité
   * @returns {boolean} True si possible
   */
  canAddGuest() {
    if (this.capacity === 0) return true; // Capacité illimitée
    return this.stats.confirmedGuests < this.capacity;
  }

  /**
   * @method getAvailableSpots
   * @description Retourne le nombre de places disponibles
   * @returns {number} Places disponibles
   */
  getAvailableSpots() {
    if (this.capacity === 0) return Infinity;
    return Math.max(0, this.capacity - this.stats.confirmedGuests);
  }

  /**
   * @method updateSettings
   * @description Met à jour les paramètres de l'événement
   * @param {Object} newSettings - Nouveaux paramètres
   * @throws {ValidationError} Si les paramètres sont invalides
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method updateDesign
   * @description Met à jour le design de l'événement
   * @param {Object} newDesign - Nouveau design
   */
  updateDesign(newDesign) {
    this.design = {
      ...this.design,
      ...newDesign
    };
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method validate
   * @description Valide les données de l'événement
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    return validateEvent(this);
  }

  /**
   * @method activate
   * @description Active l'événement
   */
  activate() {
    this.active = true;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method deactivate
   * @description Désactive l'événement
   */
  deactivate() {
    this.active = false;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method getEventDateTime
   * @description Retourne la date et heure complète de l'événement
   * @returns {Date|null} Date complète ou null
   */
  getEventDateTime() {
    if (!this.date) return null;
    return new Date(`${this.date}T${this.time || '00:00:00'}`);
  }

  /**
   * @static fromJSON
   * @description Crée une instance Event depuis JSON
   * @param {Object} json - Données JSON
   * @returns {Event} Instance Event
   */
  static fromJSON(json) {
    return new Event(json);
  }

  /**
   * @static createSample
   * @description Crée un événement exemple
   * @param {string} organizerId - ID de l'organisateur
   * @returns {Event} Événement exemple
   */
  static createSample(organizerId) {
    return new Event({
      organizerId,
      name: 'Mon Événement',
      type: EVENT_TYPES.WEDDING,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '18:00',
      location: 'Salle des fêtes',
      capacity: 100,
      description: 'Description de mon événement',
      welcomeMessage: 'Bienvenue à notre événement !'
    });
  }
}

module.exports = Event;