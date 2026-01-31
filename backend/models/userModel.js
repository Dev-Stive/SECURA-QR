/**
 * @file userModel.js
 * @description Modèle utilisateur pour Secura avec validation complète.
 * Gère les utilisateurs, leurs rôles, permissions et authentification.
 * @module models/userModel
 * @requires utils/validation/authValidation
 * @requires helpers/idGenerator
 * @requires utils/security
 * @requires utils/errorHandler
 */

const { generateUserId, generateAccessCode } = require('../utils/helpers/idGenerator');
const { hashPassword, comparePassword } = require('../utils/security');
const { validateUser, validateUserUpdate, validatePassword } = require('../utils/validation/authValidation');
const { AppError, ValidationError } = require('../utils/errorHandler');
const { ROLES, STATUS, PERMISSIONS } = require('../utils/constants');

/**
 * @class User
 * @description Classe représentant un utilisateur du système Secura.
 * Gère l'authentification, les rôles, les permissions et les préférences.
 */
class User {
  /**
   * @constructor
   * @param {Object} data - Données de l'utilisateur
   * @param {string} data.email - Email de l'utilisateur (requis)
   * @param {string} data.password - Mot de passe en clair (sera hashé)
   * @param {string} [data.firstName] - Prénom
   * @param {string} [data.lastName] - Nom
   * @param {string} [data.role=ROLES.USER] - Rôle (admin, editor, viewer, agent)
   * @param {string} [data.avatar] - URL de l'avatar
   * @param {string} [data.phone] - Numéro de téléphone
   * @param {string} [data.accessCode] - Code d'accès pour mobile
   * @param {boolean} [data.emailVerified=false] - Email vérifié
   * @param {boolean} [data.isActive=true] - Compte actif
   * @param {string} [data.timezone='Africa/Douala'] - Fuseau horaire
   * @param {Object} [data.preferences] - Préférences utilisateur
   * @param {Date} [data.lastLogin] - Dernière connexion
   * @param {number} [data.loginCount=0] - Nombre de connexions
   * @param {number} [data.failedLoginAttempts=0] - Tentatives échouées
   * @param {Date} [data.lockedUntil] - Verrouillage jusqu'à
   * @param {string} [data.id] - ID unique (généré automatiquement)
   * @param {Date} [data.createdAt] - Date de création
   * @param {Date} [data.updatedAt] - Date de modification
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateUserId();
    this.email = data.email ? data.email.toLowerCase().trim() : '';
    
    // Authentification
    this.password = data.password ? hashPassword(data.password) : data.hashedPassword || '';
    this.accessCode = data.accessCode || generateAccessCode();
    this.emailVerified = Boolean(data.emailVerified) || false;
    this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    
    // Profil
    this.firstName = data.firstName ? data.firstName.trim() : '';
    this.lastName = data.lastName ? data.lastName.trim() : '';
    this.avatar = data.avatar || null;
    this.phone = data.phone ? data.phone.trim() : '';
    
    // Rôles et permissions
    this.role = data.role || ROLES.USER;
    this.permissions = data.permissions || this._getDefaultPermissions();
    
    this.failedLoginAttempts = parseInt(data.failedLoginAttempts) || 0;
    this.lockedUntil = data.lockedUntil || null;
    this.loginCount = parseInt(data.loginCount) || 0;
    this.lastLogin = data.lastLogin || null;
    
    // Préférences
    this.timezone = data.timezone || 'Africa/Douala';
    this.preferences = {
      notifications: data.preferences?.notifications !== false,
      language: data.preferences?.language || 'fr',
      theme: data.preferences?.theme || 'light',
      emailNotifications: data.preferences?.emailNotifications !== false,
      pushNotifications: data.preferences?.pushNotifications !== false,
      ...data.preferences
    };
    
    
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * @private
   * @method _getDefaultPermissions
   * @description Retourne les permissions par défaut selon le rôle
   * @returns {string[]} Tableau de permissions
   */
  _getDefaultPermissions() {
    const permissionsMap = {
      [ROLES.ADMIN]: [
        PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.DELETE, PERMISSIONS.MANAGE
      ],
      [ROLES.EDITOR]: [
        PERMISSIONS.READ, PERMISSIONS.WRITE
      ],
      [ROLES.VIEWER]: [
        PERMISSIONS.READ
      ],
      [ROLES.AGENT]: [
        PERMISSIONS.READ, 'scan', 'validate'
      ]
    };
    
    return permissionsMap[this.role] || [PERMISSIONS.READ];
  }

  /**
   * @method toJSON
   * @description Retourne une version sécurisée de l'utilisateur (sans données sensibles)
   * @returns {Object} Utilisateur sans données sensibles
   */
  toJSON() {
    const { 
      password, 
      accessCode, 
      failedLoginAttempts, 
      lockedUntil, 
      ...safeUser 
    } = this;
    return safeUser;
  }

  /**
   * @method getFullName
   * @description Retourne le nom complet de l'utilisateur
   * @returns {string} Nom complet formaté
   */
  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim() || this.email.split('@')[0];
  }

  /**
   * @method getInitials
   * @description Retourne les initiales de l'utilisateur
   * @returns {string} Initiales (2 caractères max)
   */
  getInitials() {
    const first = this.firstName ? this.firstName[0].toUpperCase() : '';
    const last = this.lastName ? this.lastName[0].toUpperCase() : '';
    return (first + last) || this.email[0].toUpperCase();
  }

  /**
   * @method verifyPassword
   * @description Vérifie si le mot de passe correspond
   * @param {string} password - Mot de passe à vérifier
   * @returns {Promise<boolean>} True si correspond
   */
  async verifyPassword(password) {
    return await comparePassword(password, this.password);
  }

  /**
   * @method verifyAccessCode
   * @description Vérifie le code d'accès
   * @param {string} code - Code à vérifier
   * @returns {boolean} True si correspond
   */
  verifyAccessCode(code) {
    return this.accessCode === code;
  }

  /**
   * @method isAdmin
   * @description Vérifie si l'utilisateur est administrateur
   * @returns {boolean} True si admin
   */
  isAdmin() {
    return this.role === ROLES.ADMIN;
  }

  /**
   * @method isEditor
   * @description Vérifie si l'utilisateur est éditeur
   * @returns {boolean} True si éditeur
   */
  isEditor() {
    return this.role === ROLES.EDITOR;
  }

  /**
   * @method isViewer
   * @description Vérifie si l'utilisateur est viewer
   * @returns {boolean} True si viewer
   */
  isViewer() {
    return this.role === ROLES.VIEWER;
  }

  /**
   * @method isAgent
   * @description Vérifie si l'utilisateur est agent
   * @returns {boolean} True si agent
   */
  isAgent() {
    return this.role === ROLES.AGENT;
  }

  /**
   * @method hasPermission
   * @description Vérifie si l'utilisateur a une permission spécifique
   * @param {string} permission - Permission à vérifier
   * @returns {boolean} True si a la permission
   */
  hasPermission(permission) {
    if (this.isAdmin()) return true;
    return this.permissions.includes(permission);
  }

  /**
   * @method isLocked
   * @description Vérifie si le compte est verrouillé
   * @returns {boolean} True si verrouillé
   */
  isLocked() {
    if (!this.lockedUntil) return false;
    return new Date(this.lockedUntil) > new Date();
  }

  /**
   * @method recordSuccessfulLogin
   * @description Enregistre une connexion réussie
   */
  recordSuccessfulLogin() {
    this.loginCount++;
    this.lastLogin = new Date().toISOString();
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method recordFailedLogin
   * @description Enregistre une tentative de connexion échouée
   */
  recordFailedLogin() {
    this.failedLoginAttempts++;
    
    // Verrouiller après 5 tentatives échouées pendant 30 minutes
    if (this.failedLoginAttempts >= 5) {
      const lockTime = new Date();
      lockTime.setMinutes(lockTime.getMinutes() + 30);
      this.lockedUntil = lockTime.toISOString();
    }
    
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method updateProfile
   * @description Met à jour le profil utilisateur
   * @param {Object} updates - Données à mettre à jour
   * @throws {ValidationError} Si les données sont invalides
   */
  updateProfile(updates) {
    const validation = validateUserUpdate(updates);
    if (!validation.valid) {
      throw new ValidationError('Données de mise à jour invalides', validation.errors);
    }

    const allowedFields = [
      'firstName', 'lastName', 'phone', 'avatar', 
      'timezone', 'preferences'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'preferences') {
          this.preferences = { ...this.preferences, ...updates[field] };
        } else {
          this[field] = updates[field];
        }
      }
    });
    
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method changePassword
   * @description Change le mot de passe de l'utilisateur
   * @param {string} currentPassword - Mot de passe actuel
   * @param {string} newPassword - Nouveau mot de passe
   * @returns {Promise<boolean>} True si réussi
   * @throws {AppError} Si le mot de passe actuel est incorrect
   */
  async changePassword(currentPassword, newPassword) {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError('Mot de passe invalide', passwordValidation.errors);
    }

    const isCurrentValid = await this.verifyPassword(currentPassword);
    if (!isCurrentValid) {
      throw new AppError('Mot de passe actuel incorrect', 400, 'INVALID_PASSWORD');
    }

    this.password = hashPassword(newPassword);
    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method regenerateAccessCode
   * @description Régénère le code d'accès
   * @returns {string} Nouveau code d'accès
   */
  regenerateAccessCode() {
    this.accessCode = generateAccessCode();
    this.updatedAt = new Date().toISOString();
    return this.accessCode;
  }

  /**
   * @method validate
   * @description Valide les données de l'utilisateur
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    return validateUser(this);
  }

  /**
   * @method canManageEvent
   * @description Vérifie si l'utilisateur peut gérer un événement
   * @param {string} eventId - ID de l'événement
   * @returns {boolean} True si peut gérer
   */
  canManageEvent(eventId) {
    if (this.isAdmin()) return true;
    if (this.isEditor()) return true;
    // Logique supplémentaire pour vérifier les permissions spécifiques
    return this.hasPermission(PERMISSIONS.MANAGE);
  }

  /**
   * @method canViewEvent
   * @description Vérifie si l'utilisateur peut voir un événement
   * @param {string} eventId - ID de l'événement
   * @returns {boolean} True si peut voir
   */
  canViewEvent(eventId) {
    if (this.isAdmin() || this.isEditor() || this.isViewer()) return true;
    return this.hasPermission(PERMISSIONS.READ);
  }

  /**
   * @static fromJSON
   * @description Crée une instance User depuis JSON
   * @param {Object} json - Données JSON
   * @returns {User} Instance User
   */
  static fromJSON(json) {
    return new User(json);
  }

  /**
   * @static createAdmin
   * @description Crée un utilisateur administrateur
   * @param {Object} data - Données de l'admin
   * @returns {User} Instance User admin
   */
  static createAdmin(data) {
    return new User({
      ...data,
      role: ROLES.ADMIN,
      emailVerified: true,
      isActive: true
    });
  }

  /**
   * @static createAgent
   * @description Crée un utilisateur agent
   * @param {Object} data - Données de l'agent
   * @returns {User} Instance User agent
   */
  static createAgent(data) {
    return new User({
      ...data,
      role: ROLES.AGENT,
      emailVerified: true,
      isActive: true
    });
  }
}

module.exports = User;


met egalment ajour des endpoint backend sur server .js en donneant les code complet des code concerne avce une reforme avec ces nouvelle structure des models que je vais attache (..Model.js)

commencons par l'ajout de gestion des tables au complet comme le faist evenet.js pour evenement ou guest.js pour invite ajoute un fihier table.js pour gerer l'apercue avce la meme verion en communiquant avec le storage.js (avce toute les methode a jouter et mettre ajour sur la gestion des tables et attend ma validatio

  pour cette bd genere moi au complet le code uml ultra complet avce toute les relations et tables pour compiler sur planttext , donc donne le diagrammes ultra complet des shema de la base de donnees