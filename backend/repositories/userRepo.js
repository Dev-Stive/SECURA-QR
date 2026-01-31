/**
 * @file userRepo.js
 * @description Repository ultra-complet pour la gestion des utilisateurs Secura.
 * Hérite de BaseRepository avec des fonctionnalités spécifiques aux utilisateurs.
 * Intègre parfaitement avec Firebase Auth et gère la synchronisation bidirectionnelle.
 * @module repositories/userRepo
 * @requires ./baseRepo
 * @requires ../models/userModel
 * @requires ../utils/validation/authValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/security
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/helpers/emailHelper
 * @requires ../utils/helpers/stringHelper
 * @requires ../config/database
 * @requires ../utils/logger
 */

const BaseRepository = require('./baseRepo');
const SessionRepository = require('./sessionRepo');
const { validateJoinSession } = require('../utils/validation/sessionValidation');

const User = require('../models/userModel');
const { 
  validateCreateUser, 
  validateUpdateUser,
  validateLogin, 
  validateResetPassword
} = require('../utils/validation/authValidation');
const { 
  AppError, 
  ValidationError, 
  NotFoundError,
  UnauthorizedError,
  ForbiddenError 
} = require('../utils/errorHandler');
const { hashPassword, comparePassword, generateSecureToken } = require('../utils/security');
const { ROLES, STATUS, PERMISSIONS } = require('../utils/constants');
const { 
  generateAccessCode, 
  generatePasswordResetToken,
  generateEmailVerificationToken,
  generateShortId 
} = require('../utils/helpers/idGenerator');
const { 
  now, 
  formatDate,
  isBefore,
  isAfter,
  addHours,
  diffInMinutes 
} = require('../utils/helpers/dateHelper');
const { 
  sendTemplateEmail,
  sendAccessCode,
  sendPasswordReset,
  validateEmail 
} = require('../utils/helpers/emailHelper');
const { 
  sanitizeString,
  maskEmail,
  generateInitials,
  parseFullName 
} = require('../utils/helpers/stringHelper');
const log = require('../utils/logger');

/**
 * @class UserRepository
 * @description Repository spécialisé pour la gestion des utilisateurs Secura
 * @extends BaseRepository
 */
class UserRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('users', {
      enableCache: true,
      cacheTTL: 600, // 10 minutes pour les utilisateurs
      enableAudit: true,
      softDelete: true,
      validationRequired: true,
      maxRetries: 3,
      ...options
    });

    this.sessionRepo = null;

    // Configuration spécifique aux utilisateurs
    this.userConfig = {
      maxLoginAttempts: 5,
      lockDurationMinutes: 30,
      passwordResetExpiryHours: 24,
      emailVerificationExpiryHours: 48,
      sessionTimeoutMinutes: 30,
      bulkOperationLimit: 1000,
      ...options.userConfig
    };

    this.logger = log.withContext({
      repository: 'UserRepository',
      collection: 'users'
    });
  }


  /**
 * @method injectSessionRepo
 * @description Injecte le SessionRepository pour les dépendances circulaires
 * @param {SessionRepository} sessionRepo - Instance du SessionRepository
 */
injectSessionRepo(sessionRepo) {
  this.sessionRepo = sessionRepo;
}

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée un nouvel utilisateur avec validation complète
   * @param {Object} userData - Données de l'utilisateur
   * @param {Object} options - Options de création
   * @returns {Promise<User>} Utilisateur créé
   */
  async create(userData, options = {}) {
    const operation = log.trackOperation('USER_CREATE', {
      data: this.sanitizeUserData(userData),
      options
    });

    try {
      // Validation des données
      const validation = validateCreateUser(userData);
      if (validation.error) {
        throw new ValidationError('Données utilisateur invalides', validation.error.details);
      }

      // Vérifier l'unicité de l'email
      await this.checkEmailUniqueness(userData.email);

      // Créer l'instance User
      const user = new User(userData);

      const modelValidation = user.validate();
      if (!modelValidation.valid) {
        throw new ValidationError('Modèle utilisateur invalide', modelValidation.errors);
      }

      // Sauvegarder via BaseRepository
      const result = await super.create(user, options);

      // Audit et logs
      this.logger.crud('CREATE', 'users', {
        userId: user.id,
        email: maskEmail(user.email),
        role: user.role
      });

      // Envoyer email de bienvenue si demandé
      if (options.sendWelcomeEmail !== false && userData.email) {
        await this.sendWelcomeEmail(user);
      }

      return operation.success({ user: result });

    } catch (error) {
      return operation.error(error, { 
        data: this.sanitizeUserData(userData) 
      });
    }
  }

  /**
   * @method findByEmail
   * @description Trouve un utilisateur par son email
   * @param {string} email - Email à rechercher
   * @param {Object} options - Options de recherche
   * @returns {Promise<User|null>} Utilisateur trouvé ou null
   */
  async findByEmail(email, options = {}) {
    const operation = log.trackOperation('USER_FIND_BY_EMAIL', {
      email: maskEmail(email),
      options
    });

    try {
      const result = await this.findOne({ email: email.toLowerCase() }, options);
      
      return operation.success(result ? { user: result } : { user: null });

    } catch (error) {
      return operation.error(error, { email: maskEmail(email) });
    }
  }

  /**
   * @method findByAccessCode
   * @description Trouve un utilisateur par son code d'accès
   * @param {string} accessCode - Code d'accès
   * @param {Object} options - Options de recherche
   * @returns {Promise<User|null>} Utilisateur trouvé ou null
   */
  async findByAccessCode(accessCode, options = {}) {
    const operation = log.trackOperation('USER_FIND_BY_ACCESS_CODE', {
      accessCode: '***' // Masqué pour sécurité
    });

    try {
      const result = await this.findOne({ accessCode }, options);
      
      return operation.success(result ? { user: result } : { user: null });

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method findByRole
   * @description Trouve les utilisateurs par rôle
   * @param {string} role - Rôle à rechercher
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Utilisateurs trouvés avec pagination
   */
  async findByRole(role, options = {}) {
    const operation = log.trackOperation('USER_FIND_BY_ROLE', {
      role,
      options
    });

    try {
      const result = await this.findAll({ role }, options);
      
      return operation.success(result);

    } catch (error) {
      return operation.error(error, { role });
    }
  }

  /**
   * @method updateProfile
   * @description Met à jour le profil utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} updates - Données de mise à jour
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<User>} Utilisateur mis à jour
   */
  async updateProfile(userId, updates, options = {}) {
    const operation = log.trackOperation('USER_UPDATE_PROFILE', {
      userId,
      updates: this.sanitizeUserData(updates),
      options
    });

    try {
      // Récupérer l'utilisateur existant
      const existingUser = await this.findById(userId, { throwIfNotFound: true });
      
      // Validation des mises à jour
      const validation = validateUpdateUser(updates);
      if (validation.error) {
        throw new ValidationError('Mises à jour invalides', validation.error.details);
      }

      // Appliquer les mises à jour via le modèle
      existingUser.updateProfile(updates);

      // Sauvegarder les modifications
      const result = await super.update(userId, existingUser, options);

      this.logger.crud('UPDATE_PROFILE', 'users', {
        userId,
        updatedFields: Object.keys(updates)
      });

      return operation.success({ user: result });

    } catch (error) {
      return operation.error(error, { 
        userId, 
        updates: this.sanitizeUserData(updates) 
      });
    }
  }

  // ============================================================================
  // MÉTHODES D'AUTHENTIFICATION ET SÉCURITÉ
  // ============================================================================

  /**
   * @method authenticate
   * @description Authentifie un utilisateur avec email/mot de passe
   * @param {string} email - Email de l'utilisateur
   * @param {string} password - Mot de passe
   * @param {Object} options - Options d'authentification
   * @returns {Promise<Object>} Résultat de l'authentification
   */
  async authenticate(email, password, options = {}) {
    const operation = log.trackOperation('USER_AUTHENTICATE', {
      email: maskEmail(email),
      options
    });

    try {
      // Validation des credentials
      const validation = validateLogin({ email, password });
      if (validation.error) {
        throw new ValidationError('Credentials invalides', validation.error.details);
      }

      // Trouver l'utilisateur
      const user = await this.findByEmail(email, { 
        throwIfNotFound: true,
        includeSensitive: true 
      });

      // Vérifier si le compte est actif
      if (!user.isActive) {
        throw new UnauthorizedError('Compte désactivé');
      }

      // Vérifier si le compte est verrouillé
      if (user.isLocked()) {
        throw new UnauthorizedError('Compte temporairement verrouillé');
      }

      // Vérifier le mot de passe
      const isPasswordValid = await user.verifyPassword(password);
      if (!isPasswordValid) {
        // Enregistrer la tentative échouée
        user.recordFailedLogin();
        await super.update(user.id, user, { 
          syncToFirebase: false,
          reason: 'failed_login' 
        });

        throw new UnauthorizedError('Email ou mot de passe incorrect');
      }

      // Connexion réussie
      user.recordSuccessfulLogin();
      const updatedUser = await super.update(user.id, user, {
        syncToFirebase: false,
        reason: 'successful_login'
      });

      // Générer le token de session
      const sessionToken = this.generateSessionToken(user);

      this.logger.security('LOGIN_SUCCESS', `User ${maskEmail(email)} logged in successfully`, {
        userId: user.id,
        role: user.role,
        loginCount: user.loginCount
      });

      return operation.success({
        user: updatedUser,
        sessionToken,
        expiresIn: this.userConfig.sessionTimeoutMinutes * 60 // en secondes
      });

    } catch (error) {
      return operation.error(error, { email: maskEmail(email) });
    }
  }

  /**
   * @method authenticateWithAccessCode
   * @description Authentifie un utilisateur agent avec code d'accès
   * @param {string} accessCode - Code d'accès
   * @param {Object} options - Options d'authentification
   * @returns {Promise<Object>} Résultat de l'authentification
   */
  async authenticateWithAccessCode(accessCode, options = {}) {
    const operation = log.trackOperation('USER_AUTHENTICATE_ACCESS_CODE', {
      accessCode: '***' // Masqué pour sécurité
    });

    try {
      // Trouver l'utilisateur par code d'accès
      const user = await this.findByAccessCode(accessCode, {
        throwIfNotFound: true,
        includeSensitive: true
      });

      // Vérifier le rôle agent
      if (!user.isAgent()) {
        throw new ForbiddenError('Code d\'accès réservé aux agents');
      }

      // Vérifier si le compte est actif
      if (!user.isActive) {
        throw new UnauthorizedError('Compte agent désactivé');
      }

      // Vérifier le code d'accès
      if (!user.verifyAccessCode(accessCode)) {
        throw new UnauthorizedError('Code d\'accès invalide');
      }

      // Connexion réussie
      user.recordSuccessfulLogin();
      const updatedUser = await super.update(user.id, user, {
        syncToFirebase: false,
        reason: 'agent_login'
      });

      // Générer le token de session
      const sessionToken = this.generateSessionToken(user);

      this.logger.security('AGENT_LOGIN_SUCCESS', `Agent ${maskEmail(user.email)} logged in with access code`, {
        userId: user.id,
        accessCode: '***'
      });

      return operation.success({
        user: updatedUser,
        sessionToken,
        expiresIn: this.userConfig.sessionTimeoutMinutes * 60
      });

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method changePassword
   * @description Change le mot de passe d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} currentPassword - Mot de passe actuel
   * @param {string} newPassword - Nouveau mot de passe
   * @param {Object} options - Options de changement
   * @returns {Promise<boolean>} True si réussi
   */
  async changePassword(userId, currentPassword, newPassword, options = {}) {
    const operation = log.trackOperation('USER_CHANGE_PASSWORD', {
      userId,
      options
    });

    try {
      // Récupérer l'utilisateur avec données sensibles
      const user = await this.findById(userId, { 
        throwIfNotFound: true,
        includeSensitive: true 
      });

      // Changer le mot de passe via le modèle
      await user.changePassword(currentPassword, newPassword);

      // Sauvegarder les modifications
      await super.update(userId, user, {
        ...options,
        reason: 'password_change'
      });

      this.logger.security('PASSWORD_CHANGED', `User ${userId} changed password successfully`, {
        userId
      });

      return operation.success({ changed: true });

    } catch (error) {
      return operation.error(error, { userId });
    }
  }

  /**
   * @method resetPassword
   * @description Réinitialise le mot de passe avec un token
   * @param {string} resetToken - Token de réinitialisation
   * @param {string} newPassword - Nouveau mot de passe
   * @param {Object} options - Options de réinitialisation
   * @returns {Promise<boolean>} True si réussi
   */
  async resetPassword(resetToken, newPassword, options = {}) {
    const operation = log.trackOperation('USER_RESET_PASSWORD', {
      resetToken: '***', 
      options
    });

    try {
      // Trouver l'utilisateur par token de réinitialisation
      const user = await this.findOne({ 
        passwordResetToken: resetToken,
        passwordResetExpires: { $gt: now().toISOString() }
      }, { 
        throwIfNotFound: true,
        includeSensitive: true 
      });

      // Validation du nouveau mot de passe
      const passwordValidation = validateResetPassword(newPassword);
      if (passwordValidation.error) {
        throw new ValidationError('Nouveau mot de passe invalide', passwordValidation.error.details);
      }

      // Mettre à jour le mot de passe
      user.password = hashPassword(newPassword);
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      user.updatedAt = now().toISOString();

      // Sauvegarder
      await super.update(user.id, user, {
        ...options,
        reason: 'password_reset'
      });

      this.logger.security('PASSWORD_RESET', `User ${maskEmail(user.email)} reset password successfully`, {
        userId: user.id
      });

      return operation.success({ reset: true });

    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES COMPTES
  // ============================================================================

  /**
   * @method deactivateAccount
   * @description Désactive un compte utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} reason - Raison de la désactivation
   * @param {Object} options - Options de désactivation
   * @returns {Promise<User>} Utilisateur désactivé
   */
  async deactivateAccount(userId, reason = 'user_request', options = {}) {
    const operation = log.trackOperation('USER_DEACTIVATE', {
      userId,
      reason,
      options
    });

    try {
      const user = await this.findById(userId, { throwIfNotFound: true });

      // Ne pas permettre la désactivation des administrateurs
      if (user.isAdmin() && options.force !== true) {
        throw new ForbiddenError('Impossible de désactiver un compte administrateur');
      }

      // Désactiver le compte
      const updates = {
        isActive: false,
        deactivatedAt: now().toISOString(),
        deactivationReason: reason
      };

      const result = await super.update(userId, updates, {
        ...options,
        reason: `deactivate_${reason}`
      });

      this.logger.crud('DEACTIVATE', 'users', {
        userId,
        reason,
        deactivatedBy: options.deactivatedBy || 'system'
      });

      return operation.success({ user: result });

    } catch (error) {
      return operation.error(error, { userId, reason });
    }
  }

  /**
   * @method reactivateAccount
   * @description Réactive un compte utilisateur désactivé
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options de réactivation
   * @returns {Promise<User>} Utilisateur réactivé
   */
  async reactivateAccount(userId, options = {}) {
    const operation = log.trackOperation('USER_REACTIVATE', {
      userId,
      options
    });

    try {
      const updates = {
        isActive: true,
        deactivatedAt: null,
        deactivationReason: null,
        failedLoginAttempts: 0,
        lockedUntil: null
      };

      const result = await super.update(userId, updates, {
        ...options,
        reason: 'reactivate'
      });

      this.logger.crud('REACTIVATE', 'users', {
        userId,
        reactivatedBy: options.reactivatedBy || 'system'
      });

      return operation.success({ user: result });

    } catch (error) {
      return operation.error(error, { userId });
    }
  }

  /**
   * @method updateRole
   * @description Met à jour le rôle d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} newRole - Nouveau rôle
   * @param {string} updatedBy - ID de l'utilisateur effectuant la modification
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<User>} Utilisateur mis à jour
   */
  async updateRole(userId, newRole, updatedBy, options = {}) {
    const operation = log.trackOperation('USER_UPDATE_ROLE', {
      userId,
      newRole,
      updatedBy,
      options
    });

    try {
      // Valider le nouveau rôle
      if (!Object.values(ROLES).includes(newRole)) {
        throw new ValidationError('Rôle invalide');
      }

      const updates = {
        role: newRole,
        permissions: this.getDefaultPermissionsForRole(newRole)
      };

      const result = await super.update(userId, updates, {
        ...options,
        reason: `role_update_${newRole}`
      });

      this.logger.crud('UPDATE_ROLE', 'users', {
        userId,
        oldRole: result.previous?.role,
        newRole,
        updatedBy
      });

      return operation.success({ user: result });

    } catch (error) {
      return operation.error(error, { userId, newRole, updatedBy });
    }
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method searchUsers
   * @description Recherche avancée d'utilisateurs avec multiples critères
   * @param {Object} criteria - Critères de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Résultats de recherche paginés
   */
  async searchUsers(criteria = {}, options = {}) {
    const operation = log.trackOperation('USER_SEARCH', {
      criteria: this.sanitizeSearchCriteria(criteria),
      options
    });

    try {
      const {
        query,
        role,
        status,
        dateFrom,
        dateTo,
        isActive,
        emailVerified,
        ...otherFilters
      } = criteria;

      // Construire les filtres
      const filters = { ...otherFilters };

      // Filtre par rôle
      if (role) {
        filters.role = role;
      }

      // Filtre par statut
      if (status) {
        filters.status = status;
      }

      // Filtre par activité
      if (isActive !== undefined) {
        filters.isActive = Boolean(isActive);
      }

      // Filtre par vérification email
      if (emailVerified !== undefined) {
        filters.emailVerified = Boolean(emailVerified);
      }

      // Filtre par date
      if (dateFrom || dateTo) {
        filters.createdAt = {};
        if (dateFrom) filters.createdAt.$gte = dateFrom;
        if (dateTo) filters.createdAt.$lte = dateTo;
      }

      // Recherche textuelle
      if (query) {
        const searchFilters = {
          $or: [
            { email: { $regex: query, $options: 'i' } },
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { phone: { $regex: query, $options: 'i' } }
          ]
        };
        Object.assign(filters, searchFilters);
      }

      const result = await this.findAll(filters, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { 
        criteria: this.sanitizeSearchCriteria(criteria) 
      });
    }
  }

  /**
   * @method getUsersStats
   * @description Récupère les statistiques des utilisateurs
   * @returns {Promise<Object>} Statistiques détaillées
   */
  async getUsersStats() {
    const operation = log.trackOperation('USER_STATS');

    try {
      const allUsers = await this.findAll({}, { paginate: false });
      
      const stats = {
        total: allUsers.data.length,
        byRole: {},
        byStatus: {
          active: 0,
          inactive: 0,
          locked: 0
        },
        verification: {
          verified: 0,
          unverified: 0
        },
        activity: {
          recentlyActive: 0, // Connectés dans les 7 derniers jours
          neverLoggedIn: 0
        }
      };

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      allUsers.data.forEach(user => {
        // Par rôle
        stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

        // Par statut
        if (!user.isActive) {
          stats.byStatus.inactive++;
        } else if (user.isLocked()) {
          stats.byStatus.locked++;
        } else {
          stats.byStatus.active++;
        }

        // Vérification email
        if (user.emailVerified) {
          stats.verification.verified++;
        } else {
          stats.verification.unverified++;
        }

        // Activité
        if (!user.lastLogin) {
          stats.activity.neverLoggedIn++;
        } else if (new Date(user.lastLogin) > sevenDaysAgo) {
          stats.activity.recentlyActive++;
        }
      });

      return operation.success({ stats });

    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES SESSIONS
  // ============================================================================



  /**
 * @method getUserActiveSessions
 * @description Récupère les sessions actives d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} options - Options de recherche
 * @returns {Promise<Object>} Sessions actives de l'utilisateur
 */
async getUserActiveSessions(userId, options = {}) {
  const operation = log.trackOperation('USER_GET_ACTIVE_SESSIONS', {
    userId,
    options
  });

  try {
    const user = await this.findById(userId, { throwIfNotFound: true });

    // Vérifier que le sessionRepo est injecté
    if (!this.sessionRepo) {
      throw new AppError('SessionRepository non disponible', 500, 'SESSION_REPO_UNAVAILABLE');
    }

    // Pour les agents, récupérer leurs sessions actives
    if (user.isAgent()) {
      const sessions = await this.sessionRepo.findSessionsByAgent(userId, {
        ...options,
        filters: {
          isActive: true,
          status: STATUS.ACTIVE
        }
      });

      return operation.success({ sessions });
    }

    // Pour les autres rôles, récupérer les sessions de leurs événements
    const sessions = await this.sessionRepo.searchSessions({
      // Logique pour trouver les événements de l'utilisateur
      createdBy: userId
    }, options);

    return operation.success({ sessions });

  } catch (error) {
    return operation.error(error, { userId });
  }
}

/**
 * @method canJoinSession
 * @description Vérifie si un utilisateur peut rejoindre une session
 * @param {string} userId - ID de l'utilisateur
 * @param {string} sessionId - ID de la session
 * @returns {Promise<boolean>} True si peut rejoindre
 */
async canJoinSession(userId, sessionId) {
  try {
    const user = await this.findById(userId, { throwIfNotFound: true });

    // Seuls les agents peuvent rejoindre des sessions
    if (!user.isAgent()) {
      this.logger.warning(`Utilisateur ${userId} n'est pas un agent - ne peut pas rejoindre de session`, {
        userId,
        sessionId,
        role: user.role
      });
      return false;
    }

    // Vérifier que l'utilisateur est actif
    if (!user.isActive) {
      this.logger.warning(`Utilisateur ${userId} inactif - ne peut pas rejoindre de session`, {
        userId,
        sessionId
      });
      return false;
    }

    // Vérifier que l'utilisateur n'est pas verrouillé
    if (user.isLocked()) {
      this.logger.warning(`Utilisateur ${userId} verrouillé - ne peut pas rejoindre de session`, {
        userId,
        sessionId
      });
      return false;
    }

    // Vérifier les permissions spécifiques
    const hasPermission = user.hasPermission('scan') || user.hasPermission('validate');
    
    if (!hasPermission) {
      this.logger.warning(`Utilisateur ${userId} n'a pas les permissions pour rejoindre une session`, {
        userId,
        sessionId,
        permissions: user.permissions
      });
    }

    return hasPermission;

  } catch (error) {
    this.logger.error('Erreur vérification permission session', {
      userId,
      sessionId,
      error: error.message
    });
    return false;
  }
}

/**
 * @method joinSessionAsAgent
 * @description Fait rejoindre un agent à une session
 * @param {string} userId - ID de l'utilisateur agent
 * @param {string} sessionId - ID de la session
 * @param {Object} agentData - Données supplémentaires de l'agent
 * @param {Object} options - Options de jointure
 * @returns {Promise<Object>} Résultat de la jointure
 */
async joinSessionAsAgent(userId, sessionId, agentData = {}, options = {}) {
  const operation = log.trackOperation('USER_JOIN_SESSION_AS_AGENT', {
    userId,
    sessionId,
    agentData: this.sanitizeAgentData(agentData),
    options
  });

  try {
    // Vérifier que le sessionRepo est injecté
    if (!this.sessionRepo) {
      throw new AppError('SessionRepository non disponible', 500, 'SESSION_REPO_UNAVAILABLE');
    }

    // Récupérer l'utilisateur
    const user = await this.findById(userId, { 
      throwIfNotFound: true,
      includeSensitive: true 
    });

    // Vérifier les permissions
    if (!(await this.canJoinSession(userId, sessionId))) {
      throw new ForbiddenError('Utilisateur non autorisé à rejoindre cette session');
    }

    // Préparer les données de l'agent
    const agentJoinData = {
      id: userId,
      name: user.getFullName(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      ...agentData
    };

    // Valider les données de jointure
    const validation = validateJoinSession(agentJoinData);
    if (validation.error) {
      throw new ValidationError('Données agent invalides', validation.error.details);
    }

    // Rejoindre la session via le SessionRepository
    const result = await this.sessionRepo.joinSession(sessionId, agentJoinData, options);

    this.logger.info(`Agent ${userId} a rejoint la session ${sessionId}`, {
      userId,
      sessionId,
      eventId: result.session.eventId
    });

    return operation.success(result);

  } catch (error) {
    return operation.error(error, { userId, sessionId });
  }
}

/**
 * @method leaveSessionAsAgent
 * @description Fait quitter une session à un agent
 * @param {string} userId - ID de l'utilisateur agent
 * @param {string} sessionId - ID de la session
 * @param {string} reason - Raison du départ
 * @param {Object} options - Options de sortie
 * @returns {Promise<Object>} Résultat de la sortie
 */
async leaveSessionAsAgent(userId, sessionId, reason = 'left', options = {}) {
  const operation = log.trackOperation('USER_LEAVE_SESSION_AS_AGENT', {
    userId,
    sessionId,
    reason,
    options
  });

  try {
    // Vérifier que le sessionRepo est injecté
    if (!this.sessionRepo) {
      throw new AppError('SessionRepository non disponible', 500, 'SESSION_REPO_UNAVAILABLE');
    }

    // Vérifier que l'utilisateur existe
    await this.findById(userId, { throwIfNotFound: true });

    // Quitter la session via le SessionRepository
    const result = await this.sessionRepo.leaveSession(sessionId, userId, reason, options);

    this.logger.info(`Agent ${userId} a quitté la session ${sessionId} (${reason})`, {
      userId,
      sessionId,
      reason
    });

    return operation.success(result);

  } catch (error) {
    return operation.error(error, { userId, sessionId, reason });
  }
}


/**
 * @method sanitizeAgentData
 * @description Nettoie les données d'agent pour les logs (NOUVELLE)
 * @param {Object} data - Données à nettoyer
 * @returns {Object} Données nettoyées
 */
sanitizeAgentData(data) {
  const sanitized = { ...data };

  if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
  if (sanitized.connectionId) sanitized.connectionId = '***';

  return sanitized;
}




/**
 * @method updateAgentPresence
 * @description Met à jour la présence d'un agent dans une session
 * @param {string} userId - ID de l'utilisateur agent
 * @param {string} sessionId - ID de la session
 * @param {string} status - Nouveau statut de présence
 * @param {Object} options - Options de mise à jour
 * @returns {Promise<Object>} Résultat de la mise à jour
 */
async updateAgentPresence(userId, sessionId, status, options = {}) {
  const operation = log.trackOperation('USER_UPDATE_AGENT_PRESENCE', {
    userId,
    sessionId,
    status,
    options
  });

  try {
    // Vérifier que le sessionRepo est injecté
    if (!this.sessionRepo) {
      throw new AppError('SessionRepository non disponible', 500, 'SESSION_REPO_UNAVAILABLE');
    }

    // Vérifier que l'utilisateur existe et est un agent
    const user = await this.findById(userId, { throwIfNotFound: true });
    if (!user.isAgent()) {
      throw new ForbiddenError('Utilisateur n\'est pas un agent');
    }

    // Mettre à jour la présence via le SessionRepository
    const result = await this.sessionRepo.updateAgentPresence(sessionId, userId, status, options);

    this.logger.debug(`Présence mise à jour pour l'agent ${userId}: ${status}`, {
      userId,
      sessionId,
      status
    });

    return operation.success(result);

  } catch (error) {
    return operation.error(error, { userId, sessionId, status });
  }
}

/**
 * @method getAgentSessionStats
 * @description Récupère les statistiques de session d'un agent
 * @param {string} userId - ID de l'agent
 * @returns {Promise<Object>} Statistiques de session
 */
async getAgentSessionStats(userId) {
  const operation = log.trackOperation('USER_AGENT_SESSION_STATS', {
    userId
  });

  try {
    const user = await this.findById(userId, { throwIfNotFound: true });

    if (!user.isAgent()) {
      throw new ValidationError('Utilisateur n\'est pas un agent');
    }

    // Vérifier que le sessionRepo est injecté
    if (!this.sessionRepo) {
      throw new AppError('SessionRepository non disponible', 500, 'SESSION_REPO_UNAVAILABLE');
    }

    const sessions = await this.sessionRepo.findSessionsByAgent(userId, { paginate: false });

    const stats = {
      totalSessions: sessions.data.length,
      activeSessions: sessions.data.filter(s => s.isActive).length,
      totalScans: 0,
      averageResponseTime: 0,
      totalDuration: 0,
      favoriteEvent: null,
      recentSessions: []
    };

    const eventCounts = {};

    sessions.data.forEach(session => {
      stats.totalScans += session.stats?.totalScans || 0;
      stats.totalDuration += session.getDuration ? session.getDuration() : 0;

      // Compter les événements
      eventCounts[session.eventId] = (eventCounts[session.eventId] || 0) + 1;

      // Sessions récentes (30 derniers jours)
      const sessionDate = new Date(session.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (sessionDate > thirtyDaysAgo) {
        stats.recentSessions.push({
          sessionId: session.id,
          eventId: session.eventId,
          eventName: session.eventName,
          date: session.createdAt,
          duration: session.getDuration ? session.getDuration() : 0,
          scans: session.stats?.totalScans || 0
        });
      }
    });

    // Trouver l'événement favori
    if (Object.keys(eventCounts).length > 0) {
      const favoriteEventId = Object.keys(eventCounts).reduce((a, b) => 
        eventCounts[a] > eventCounts[b] ? a : b
      );
      const favoriteSession = sessions.data.find(s => s.eventId === favoriteEventId);
      stats.favoriteEvent = {
        eventId: favoriteEventId,
        eventName: favoriteSession?.eventName || 'Inconnu',
        sessionCount: eventCounts[favoriteEventId]
      };
    }

    // Calculer les moyennes
    if (sessions.data.length > 0) {
      stats.averageResponseTime = sessions.data.reduce((sum, session) => 
        sum + (session.stats?.averageResponseTime || 0), 0
      ) / sessions.data.length;

      stats.averageDuration = stats.totalDuration / sessions.data.length;
      stats.averageScansPerSession = stats.totalScans / sessions.data.length;
    }

    // Trier les sessions récentes par date
    stats.recentSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    stats.recentSessions = stats.recentSessions.slice(0, 10); // Limiter à 10

    return operation.success({ stats });

  } catch (error) {
    return operation.error(error, { userId });
  }
}

/**
 * @method getAgentSessionHistory
 * @description Récupère l'historique des sessions d'un agent
 * @param {string} userId - ID de l'agent
 * @param {Object} options - Options de recherche
 * @returns {Promise<Object>} Historique des sessions
 */
async getAgentSessionHistory(userId, options = {}) {
  const operation = log.trackOperation('USER_AGENT_SESSION_HISTORY', {
    userId,
    options
  });

  try {
    const user = await this.findById(userId, { throwIfNotFound: true });

    if (!user.isAgent()) {
      throw new ValidationError('Utilisateur n\'est pas un agent');
    }

    // Vérifier que le sessionRepo est injecté
    if (!this.sessionRepo) {
      throw new AppError('SessionRepository non disponible', 500, 'SESSION_REPO_UNAVAILABLE');
    }

    const sessions = await this.sessionRepo.findSessionsByAgent(userId, {
      ...options,
      paginate: false
    });

    // Formater l'historique
    const history = sessions.data.map(session => ({
      sessionId: session.id,
      eventId: session.eventId,
      eventName: session.eventName,
      date: session.createdAt,
      duration: session.getDuration ? session.getDuration() : 0,
      status: session.status,
      isActive: session.isActive,
      agentCount: session.agentCount,
      scans: session.stats?.totalScans || 0,
      averageResponseTime: session.stats?.averageResponseTime || 0
    }));

    // Trier par date (plus récent en premier)
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    return operation.success({ history });

  } catch (error) {
    return operation.error(error, { userId });
  }
}


  /**
 * @method createAgent
 * @description Crée un nouvel utilisateur agent (VERSION MODIFIÉE)
 * @param {Object} agentData - Données de l'agent
 * @param {Object} options - Options de création
 * @returns {Promise<User>} Agent créé
 */
async createAgent(agentData, options = {}) {
  const operation = log.trackOperation('USER_CREATE_AGENT', {
    data: this.sanitizeUserData(agentData),
    options
  });

  try {
    // Forcer le rôle agent
    const agentUserData = {
      ...agentData,
      role: ROLES.AGENT,
      emailVerified: true,
      isActive: true
    };

    const agent = await this.create(agentUserData, {
      ...options,
      sendWelcomeEmail: false // On enverra un email spécifique
    });

    // Envoyer l'email avec le code d'accès
    await this.sendAccessCodeEmail(agent.id);

    if (this.sessionRepo) {
      this.logger.debug(`Agent ${agent.id} créé - prêt pour les sessions`, {
        agentId: agent.id,
        email: maskEmail(agent.email)
      });
    }

    this.logger.crud('CREATE_AGENT', 'users', {
      agentId: agent.id,
      email: maskEmail(agent.email)
    });

    return operation.success({ agent });

  } catch (error) {
    return operation.error(error, { 
      data: this.sanitizeUserData(agentData) 
    });
  }
}


  /**
   * @method validateSession
   * @description Valide une session utilisateur
   * @param {string} sessionToken - Token de session
   * @returns {Promise<Object>} Session valide
   */
  async validateSession(sessionToken) {
    const operation = log.trackOperation('USER_VALIDATE_SESSION', {
      sessionToken: '***' // Masqué pour sécurité
    });

    try {
      // Ici, vous devriez rechercher la session dans votre système de stockage
      // Pour cet exemple, nous cherchons dans les utilisateurs
      const users = await this.findAll({ 
        'sessions.token': sessionToken,
        'sessions.isActive': true,
        'sessions.expiresAt': { $gt: now().toISOString() }
      }, { paginate: false });

      if (users.data.length === 0) {
        throw new UnauthorizedError('Session invalide ou expirée');
      }

      const user = users.data[0];
      const session = user.sessions.find(s => s.token === sessionToken && s.isActive);

      if (!session) {
        throw new UnauthorizedError('Session non trouvée');
      }

      // Mettre à jour le lastActivity de la session
      session.lastActivity = now().toISOString();
      await super.update(user.id, user, {
        reason: 'session_activity'
      });

      return operation.success({ user, session });

    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES D'ENVOI D'EMAILS
  // ============================================================================

  /**
   * @method sendWelcomeEmail
   * @description Envoie un email de bienvenue à un nouvel utilisateur
   * @param {User} user - Utilisateur destinataire
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendWelcomeEmail(user) {
    try {
      const result = await sendTemplateEmail({
        to: user.email,
        subject: `Bienvenue sur Secura, ${user.getFullName()} !`,
        template: 'welcome',
        data: {
          name: user.getFullName(),
          email: user.email,
          role: user.role,
          accessCode: user.accessCode, // Pour les agents
          loginUrl: `${process.env.APP_URL}/login`
        }
      });

      this.logger.info(`Email de bienvenue envoyé à ${maskEmail(user.email)}`, {
        userId: user.id,
        messageId: result.messageId
      });

      return result;

    } catch (error) {
      this.logger.warning(`Échec envoi email bienvenue à ${maskEmail(user.email)}`, {
        userId: user.id,
        error: error.message
      });
      // Ne pas propager l'erreur pour ne pas bloquer l'inscription
      return { success: false, error: error.message };
    }
  }

  /**
   * @method sendPasswordResetEmail
   * @description Envoie un email de réinitialisation de mot de passe
   * @param {string} email - Email destinataire
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendPasswordResetEmail(email) {
    const operation = log.trackOperation('USER_SEND_PASSWORD_RESET_EMAIL', {
      email: maskEmail(email)
    });

    try {
      const user = await this.findByEmail(email, { throwIfNotFound: true });

      // Générer le token de réinitialisation
      const resetToken = generatePasswordResetToken();
      const resetExpires = addHours(now(), this.userConfig.passwordResetExpiryHours);

      // Sauvegarder le token
      await super.update(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires.toISOString()
      }, {
        reason: 'password_reset_request'
      });

      // Envoyer l'email
      const result = await sendPasswordReset({
        to: user.email,
        userName: user.getFullName(),
        resetLink: `${process.env.APP_URL}/reset-password?token=${resetToken}`,
        expiryHours: this.userConfig.passwordResetExpiryHours
      });

      this.logger.security('PASSWORD_RESET_EMAIL_SENT', `Password reset email sent to ${maskEmail(email)}`, {
        userId: user.id,
        messageId: result.messageId
      });

      return operation.success({ sent: true, messageId: result.messageId });

    } catch (error) {
      return operation.error(error, { email: maskEmail(email) });
    }
  }

  /**
   * @method sendAccessCodeEmail
   * @description Envoie le code d'accès à un utilisateur agent
   * @param {string} userId - ID de l'utilisateur agent
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendAccessCodeEmail(userId) {
    const operation = log.trackOperation('USER_SEND_ACCESS_CODE_EMAIL', {
      userId
    });

    try {
      const user = await this.findById(userId, { 
        throwIfNotFound: true,
        includeSensitive: true 
      });

      if (!user.isAgent()) {
        throw new ValidationError('Utilisateur n\'est pas un agent');
      }

      // Régénérer le code d'accès
      const newAccessCode = user.regenerateAccessCode();

      // Sauvegarder le nouveau code
      await super.update(userId, user, {
        reason: 'access_code_regeneration'
      });

      // Envoyer l'email
      const result = await sendAccessCode({
        to: user.email,
        userName: user.getFullName(),
        accessCode: newAccessCode
      });

      this.logger.info(`Code d'accès envoyé à l'agent ${maskEmail(user.email)}`, {
        userId: user.id,
        messageId: result.messageId
      });

      return operation.success({ 
        sent: true, 
        messageId: result.messageId,
        accessCode: newAccessCode // À retirer en production
      });

    } catch (error) {
      return operation.error(error, { userId });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES AGENTS
  // ============================================================================

  /**
   * @method createAgent
   * @description Crée un nouvel utilisateur agent
   * @param {Object} agentData - Données de l'agent
   * @param {Object} options - Options de création
   * @returns {Promise<User>} Agent créé
   */
  async createAgent(agentData, options = {}) {
    const operation = log.trackOperation('USER_CREATE_AGENT', {
      data: this.sanitizeUserData(agentData),
      options
    });

    try {
      // Forcer le rôle agent
      const agentUserData = {
        ...agentData,
        role: ROLES.AGENT,
        emailVerified: true,
        isActive: true
      };

      const agent = await this.create(agentUserData, {
        ...options,
        sendWelcomeEmail: false // On enverra un email spécifique
      });

      // Envoyer l'email avec le code d'accès
      await this.sendAccessCodeEmail(agent.id);

      this.logger.crud('CREATE_AGENT', 'users', {
        agentId: agent.id,
        email: maskEmail(agent.email)
      });

      return operation.success({ agent });

    } catch (error) {
      return operation.error(error, { 
        data: this.sanitizeUserData(agentData) 
      });
    }
  }

  /**
   * @method getActiveAgents
   * @description Récupère tous les agents actifs
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Agents actifs
   */
  async getActiveAgents(options = {}) {
    const operation = log.trackOperation('USER_GET_ACTIVE_AGENTS', {
      options
    });

    try {
      const result = await this.findAll({
        role: ROLES.AGENT,
        isActive: true
      }, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES DE SYNCHRONISATION FIREBASE
  // ============================================================================

  /**
   * @method syncWithFirebase
   * @description Synchronise un utilisateur avec Firebase Auth
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} firebaseUser - Données Firebase
   * @param {Object} options - Options de synchronisation
   * @returns {Promise<User>} Utilisateur synchronisé
   */
  async syncWithFirebase(userId, firebaseUser, options = {}) {
    const operation = log.trackOperation('USER_SYNC_FIREBASE', {
      userId,
      firebaseUser: this.sanitizeUserData(firebaseUser),
      options
    });

    try {
      const user = await this.findById(userId, { throwIfNotFound: true });

      // Mettre à jour les champs de synchronisation
      const updates = {
        email: firebaseUser.email || user.email,
        emailVerified: firebaseUser.emailVerified || user.emailVerified,
        lastLogin: firebaseUser.lastLoginAt || user.lastLogin,
        updatedAt: now().toISOString()
      };

      const result = await super.update(userId, updates, {
        ...options,
        reason: 'firebase_sync'
      });

      this.logger.info(`Utilisateur ${userId} synchronisé avec Firebase`, {
        userId,
        firebaseUid: firebaseUser.uid
      });

      return operation.success({ user: result });

    } catch (error) {
      return operation.error(error, { userId });
    }
  }

  /**
   * @method handleFirebaseAuthEvent
   * @description Gère les événements Firebase Auth (création, suppression, etc.)
   * @param {string} eventType - Type d'événement
   * @param {Object} userRecord - Enregistrement utilisateur Firebase
   * @returns {Promise<void>}
   */
  async handleFirebaseAuthEvent(eventType, userRecord) {
    const operation = log.trackOperation('USER_FIREBASE_AUTH_EVENT', {
      eventType,
      userId: userRecord.uid,
      email: maskEmail(userRecord.email)
    });

    try {
      switch (eventType) {
        case 'user.created':
          await this.handleFirebaseUserCreated(userRecord);
          break;
        
        case 'user.deleted':
          await this.handleFirebaseUserDeleted(userRecord);
          break;
        
        case 'user.updated':
          await this.handleFirebaseUserUpdated(userRecord);
          break;
        
        default:
          this.logger.warning(`Événement Firebase Auth non géré: ${eventType}`, {
            userId: userRecord.uid
          });
      }

      return operation.success({ handled: true });

    } catch (error) {
      return operation.error(error, { 
        eventType, 
        userId: userRecord.uid 
      });
    }
  }

  /**
   * @method handleFirebaseUserCreated
   * @description Gère la création d'un utilisateur Firebase
   * @param {Object} userRecord - Enregistrement utilisateur Firebase
   * @returns {Promise<void>}
   */
  async handleFirebaseUserCreated(userRecord) {
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.findById(userRecord.uid);
      
      if (!existingUser) {
        // Créer un utilisateur minimal
        const userData = {
          id: userRecord.uid,
          email: userRecord.email,
          firstName: userRecord.displayName?.split(' ')[0] || '',
          lastName: userRecord.displayName?.split(' ').slice(1).join(' ') || '',
          emailVerified: userRecord.emailVerified || false,
          isActive: !userRecord.disabled,
          role: ROLES.USER // Rôle par défaut
        };

        await this.create(userData, {
          syncToFirebase: false, // Éviter la boucle infinie
          reason: 'firebase_user_created'
        });

        this.logger.info(`Utilisateur créé depuis Firebase: ${userRecord.uid}`, {
          userId: userRecord.uid,
          email: maskEmail(userRecord.email)
        });
      }

    } catch (error) {
      this.logger.error(`Erreur création utilisateur depuis Firebase: ${error.message}`, {
        userId: userRecord.uid,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method handleFirebaseUserDeleted
   * @description Gère la suppression d'un utilisateur Firebase
   * @param {Object} userRecord - Enregistrement utilisateur Firebase
   * @returns {Promise<void>}
   */
  async handleFirebaseUserDeleted(userRecord) {
    try {
      // Désactiver l'utilisateur plutôt que de le supprimer (soft delete)
      await this.deactivateAccount(userRecord.uid, 'firebase_user_deleted', {
        syncToFirebase: false
      });

      this.logger.info(`Utilisateur désactivé suite suppression Firebase: ${userRecord.uid}`, {
        userId: userRecord.uid
      });

    } catch (error) {
      this.logger.error(`Erreur désactivation utilisateur Firebase: ${error.message}`, {
        userId: userRecord.uid,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method handleFirebaseUserUpdated
   * @description Gère la mise à jour d'un utilisateur Firebase
   * @param {Object} userRecord - Enregistrement utilisateur Firebase
   * @returns {Promise<void>}
   */
  async handleFirebaseUserUpdated(userRecord) {
    try {
      const updates = {
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        isActive: !userRecord.disabled,
        updatedAt: now().toISOString()
      };

      await super.update(userRecord.uid, updates, {
        syncToFirebase: false,
        reason: 'firebase_user_updated'
      });

      this.logger.debug(`Utilisateur synchronisé depuis Firebase: ${userRecord.uid}`, {
        userId: userRecord.uid,
        updatedFields: Object.keys(updates)
      });

    } catch (error) {
      this.logger.error(`Erreur synchronisation utilisateur Firebase: ${error.message}`, {
        userId: userRecord.uid,
        error: error.message
      });
      throw error;
    }
  }

  // ============================================================================
  // MÉTHODES DE VALIDATION ET CONTRAINTES
  // ============================================================================

  /**
   * @method validate
   * @description Valide les données d'un utilisateur
   * @param {Object} userData - Données à valider
   * @returns {Object} Résultat de validation
   */
  validate(userData) {
    return validateCreateUser(userData);
  }

  /**
   * @method getUniqueFields
   * @description Retourne les champs avec contrainte d'unicité
   * @returns {string[]} Liste des champs uniques
   */
  getUniqueFields() {
    return ['email', 'accessCode'];
  }

  /**
   * @method checkDependencies
   * @description Vérifie les dépendances avant suppression
   * @param {Object} user - Utilisateur à supprimer
   * @param {Object} dbData - Données complètes de la base
   * @returns {Promise<void>}
   */
  async checkDependencies(user, dbData) {
    // Vérifier si l'utilisateur a créé des événements
    const userEvents = dbData.events?.filter(event => event.createdBy === user.id) || [];
    if (userEvents.length > 0) {
      throw new AppError(
        `Impossible de supprimer l'utilisateur: ${userEvents.length} événement(s) associé(s)`,
        400,
        'USER_HAS_EVENTS'
      );
    }

    // Vérifier si l'utilisateur a des scans associés
    const userScans = dbData.scans?.filter(scan => scan.scannerId === user.id) || [];
    if (userScans.length > 0) {
      throw new AppError(
        `Impossible de supprimer l'utilisateur: ${userScans.length} scan(s) associé(s)`,
        400,
        'USER_HAS_SCANS'
      );
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES ET HELPERS
  // ============================================================================

  /**
   * @method checkEmailUniqueness
   * @description Vérifie l'unicité d'un email
   * @param {string} email - Email à vérifier
   * @param {string} [excludeUserId] - ID utilisateur à exclure (pour les updates)
   * @returns {Promise<void>}
   * @throws {ValidationError} Si l'email existe déjà
   */
  async checkEmailUniqueness(email, excludeUserId = null) {
    const existingUser = await this.findByEmail(email);
    
    if (existingUser && existingUser.id !== excludeUserId) {
      throw new ValidationError('Email déjà utilisé', [
        { field: 'email', value: email, type: 'unique' }
      ]);
    }
  }

  /**
   * @method generateSessionToken
   * @description Génère un token de session sécurisé
   * @param {User} user - Utilisateur
   * @returns {string} Token de session
   */
  generateSessionToken(user) {
    return generateSecureToken(32);
  }

  /**
   * @method getDefaultPermissionsForRole
   * @description Retourne les permissions par défaut pour un rôle
   * @param {string} role - Rôle
   * @returns {string[]} Tableau de permissions
   */
  getDefaultPermissionsForRole(role) {
    const permissionsMap = {
      [ROLES.ADMIN]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.DELETE, PERMISSIONS.MANAGE],
      [ROLES.EDITOR]: [PERMISSIONS.READ, PERMISSIONS.WRITE],
      [ROLES.VIEWER]: [PERMISSIONS.READ],
      [ROLES.AGENT]: [PERMISSIONS.READ, 'scan', 'validate'],
      [ROLES.USER]: [PERMISSIONS.READ]
    };

    return permissionsMap[role] || [PERMISSIONS.READ];
  }

  /**
   * @method sanitizeUserData
   * @description Nettoie les données utilisateur pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeUserData(data) {
    const sanitized = { ...data };
    
    // Masquer les données sensibles
    if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.accessCode) sanitized.accessCode = '***';
    if (sanitized.passwordResetToken) sanitized.passwordResetToken = '***';
    
    return sanitized;
  }

  /**
   * @method sanitizeSearchCriteria
   * @description Nettoie les critères de recherche pour les logs
   * @param {Object} criteria - Critères à nettoyer
   * @returns {Object} Critères nettoyés
   */
  sanitizeSearchCriteria(criteria) {
    const sanitized = { ...criteria };
    
    if (sanitized.query) sanitized.query = sanitizeString(sanitized.query);
    if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
    
    return sanitized;
  }

  /**
   * @method sanitizeSessionData
   * @description Nettoie les données de session pour les logs
   * @param {Object} data - Données de session
   * @returns {Object} Données nettoyées
   */
  sanitizeSessionData(data) {
    const sanitized = { ...data };
    
    if (sanitized.token) sanitized.token = '***';
    if (sanitized.ipAddress) sanitized.ipAddress = '***';
    
    return sanitized;
  }

  /**
   * @method prepareDocument
   * @description Prépare un document utilisateur avant sauvegarde
   * @param {Object} data - Données du document
   * @param {string} operation - Type d'opération (create/update)
   * @returns {Object} Document préparé
   */
  prepareDocument(data, operation = 'create') {
    const document = super.prepareDocument(data, operation);

    // S'assurer que l'email est en minuscules
    if (document.email) {
      document.email = document.email.toLowerCase().trim();
    }

    // Générer les initiales si manquantes
    if (!document.initials && (document.firstName || document.lastName)) {
      document.initials = generateInitials(`${document.firstName} ${document.lastName}`);
    }

    return document;
  }

  // ============================================================================
  // MÉTHODES DE SANTÉ ET MAINTENANCE
  // ============================================================================

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository utilisateur
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    try {
      const stats = await this.getUsersStats();
      const activeAgents = await this.getActiveAgents({ paginate: false });

      return {
        ...baseHealth,
        userSpecific: {
          totalUsers: stats.stats.total,
          activeAgents: activeAgents.data.length,
          lockedAccounts: stats.stats.byStatus.locked,
          unverifiedEmails: stats.stats.verification.unverified
        },
        status: 'healthy'
      };

    } catch (error) {
      return {
        ...baseHealth,
        userSpecific: {
          error: error.message
        },
        status: 'degraded'
      };
    }
  }

  /**
   * @method cleanupExpiredSessions
   * @description Nettoie les sessions expirées
   * @returns {Promise<number>} Nombre de sessions nettoyées
   */
  async cleanupExpiredSessions() {
    const operation = log.trackOperation('USER_CLEANUP_SESSIONS');

    try {
      const nowISO = now().toISOString();
      const users = await this.findAll({ 
        'sessions.expiresAt': { $lt: nowISO },
        'sessions.isActive': true
      }, { paginate: false });

      let cleanedCount = 0;

      for (const user of users.data) {
        const activeSessions = user.sessions.filter(session => 
          session.isActive && session.expiresAt > nowISO
        );

        if (activeSessions.length !== user.sessions.length) {
          await super.update(user.id, { sessions: activeSessions }, {
            reason: 'session_cleanup'
          });
          cleanedCount += (user.sessions.length - activeSessions.length);
        }
      }

      this.logger.info(`${cleanedCount} sessions expirées nettoyées`, {
        cleanedCount
      });

      return operation.success({ cleaned: cleanedCount });

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method cleanupExpiredPasswordResets
   * @description Nettoie les tokens de réinitialisation expirés
   * @returns {Promise<number>} Nombre de tokens nettoyés
   */
  async cleanupExpiredPasswordResets() {
    const operation = log.trackOperation('USER_CLEANUP_PASSWORD_RESETS');

    try {
      const nowISO = now().toISOString();
      const result = await this.updateMany(
        { passwordResetExpires: { $lt: nowISO } },
        { 
          passwordResetToken: null,
          passwordResetExpires: null
        },
        { reason: 'password_reset_cleanup' }
      );

      this.logger.info(`${result.updated} tokens de réinitialisation expirés nettoyés`, {
        cleanedCount: result.updated
      });

      return operation.success({ cleaned: result.updated });

    } catch (error) {
      return operation.error(error);
    }
  }
}

module.exports = UserRepository;