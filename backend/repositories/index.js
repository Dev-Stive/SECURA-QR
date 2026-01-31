/**
 * @file index.js
 * @description Centralise les instances et exporte les repositories pour Secura.
 * Fournit un point d'accès unique pour tous les repositories de l'application
 * avec support complet de la JSDoc et de l'auto-complétion.
 * @module repositories/index
 * @requires ./userRepo
 * @requires ./eventRepo
 * @requires ./guestRepo
 * @requires ./qrCodeRepo
 * @requires ./scanRepo
 * @requires ./sessionRepo
 * @requires ./invitationRepo
 * @requires ./messageRepo
 * @requires ./galleryRepo
 * @requires ../utils/logger
 */

const UserRepository = require('./userRepo');
const EventRepository = require('./eventRepo');
const GuestRepository = require('./guestRepo');
const QRCodeRepository = require('./qrCodeRepo');
const ScanRepository = require('./scanRepo');
const SessionRepository = require('./sessionRepo');
const InvitationRepository = require('./invitationRepo');
const MessageRepository = require('./messageRepo');
const GalleryRepository = require('./galleryRepo');

const log = require('../utils/logger');

// ============================================================================
// DÉFINITION DES TYPES POUR L'AUTO-COMPLÉTION
// ============================================================================

/**
 * @typedef {import('./userRepo')} UserRepositoryClass
 * @typedef {import('./eventRepo')} EventRepositoryClass
 * @typedef {import('./guestRepo')} GuestRepositoryClass
 * @typedef {import('./qrCodeRepo')} QRCodeRepositoryClass
 * @typedef {import('./scanRepo')} ScanRepositoryClass
 * @typedef {import('./sessionRepo')} SessionRepositoryClass
 * @typedef {import('./invitationRepo')} InvitationRepositoryClass
 * @typedef {import('./messageRepo')} MessageRepositoryClass
 * @typedef {import('./galleryRepo')} GalleryRepositoryClass
 */

/**
 * @typedef {Object} RepositoryInstances
 * @property {UserRepositoryClass} userRepo
 * @property {EventRepositoryClass} eventRepo
 * @property {GuestRepositoryClass} guestRepo
 * @property {QRCodeRepositoryClass} qrCodeRepo
 * @property {ScanRepositoryClass} scanRepo
 * @property {SessionRepositoryClass} sessionRepo
 * @property {InvitationRepositoryClass} invitationRepo
 * @property {MessageRepositoryClass} messageRepo
 * @property {GalleryRepositoryClass} galleryRepo
 */

/**
 * @constant {RepositoryInstances|null} repositoryInstances
 * @description Stockage des instances de repositories (singleton pattern)
 * @private
 */
let repositoryInstances = null;

// ============================================================================
// FONCTIONS D'INITIALISATION
// ============================================================================

/**
 * @function initializeRepositories
 * @description Initialise toutes les instances des repositories.
 * Crée les repositories et configure les références croisées.
 * @returns {RepositoryInstances} Tous les repositories initialisés
 * @throws {Error} Si l'initialisation échoue
 */
const initializeRepositories = () => {
  try {
    log.info('🚀 Initialisation des repositories Secura...');

    // Créer toutes les instances
    const userRepo = new UserRepository();
    const eventRepo = new EventRepository();
    const guestRepo = new GuestRepository();
    const qrCodeRepo = new QRCodeRepository();
    const scanRepo = new ScanRepository();
    const sessionRepo = new SessionRepository();
    const invitationRepo = new InvitationRepository();
    const messageRepo = new MessageRepository();
    const galleryRepo = new GalleryRepository();

    // Configurer les références croisées
    // SessionRepository → UserRepository
    if (typeof sessionRepo.setUserRepository === 'function') {
      sessionRepo.setUserRepository(userRepo);
    }
    
    // UserRepository → SessionRepository
    if (userRepo.sessionRepo === null || userRepo.sessionRepo === undefined) {
      userRepo.sessionRepo = sessionRepo;
    }

    // GuestRepository → EventRepository (pour les dépendances)
    if (typeof guestRepo.setEventRepository === 'function') {
      guestRepo.setEventRepository(eventRepo);
    }

    // EventRepository → GuestRepository (pour les stats)
    if (typeof eventRepo.setGuestRepository === 'function') {
      eventRepo.setGuestRepository(guestRepo);
    }

    const repositories = {
      userRepo,
      eventRepo,
      guestRepo,
      qrCodeRepo,
      scanRepo,
      sessionRepo,
      invitationRepo,
      messageRepo,
      galleryRepo
    };

    log.success('✅ Repositories initialisés avec succès', {
      count: Object.keys(repositories).length,
      repositories: Object.keys(repositories)
    });

    return repositories;

  } catch (error) {
    log.error('❌ Erreur lors de l\'initialisation des repositories', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Échec initialisation repositories: ${error.message}`);
  }
};

/**
 * @function getRepositories
 * @description Retourne les instances des repositories (pattern Singleton).
 * Initialise les repositories lors du premier appel.
 * @returns {RepositoryInstances} Toutes les instances de repositories
 */
const getRepositories = () => {
  if (!repositoryInstances) {
    repositoryInstances = initializeRepositories();
  }
  return repositoryInstances;
};

/**
 * @function resetRepositories
 * @description Réinitialise toutes les instances des repositories.
 * Utile pour les tests ou pour forcer une nouvelle initialisation.
 * @returns {RepositoryInstances} Nouvelles instances des repositories
 */
const resetRepositories = () => {
  log.warning('⚠️ Réinitialisation des repositories demandée');
  repositoryInstances = null;
  return getRepositories();
};

/**
 * @function healthCheckAll
 * @description Vérifie la santé de tous les repositories
 * @returns {Promise<Object>} Statut de santé global
 */
const healthCheckAll = async () => {
  try {
    const repos = getRepositories();
    const results = {};

    for (const [name, repo] of Object.entries(repos)) {
      if (typeof repo.healthCheck === 'function') {
        results[name] = await repo.healthCheck();
      } else {
        results[name] = { status: 'unknown', message: 'healthCheck non disponible' };
      }
    }

    const allHealthy = Object.values(results).every(r => r.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      repositories: results
    };

  } catch (error) {
    log.error('Erreur lors du health check global', {
      error: error.message
    });
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
};

// ============================================================================
// INSTANCES ET EXPORTS
// ============================================================================

// Initialiser les instances
const repositories = getRepositories();

const {
  userRepo,
  eventRepo,
  guestRepo,
  qrCodeRepo,
  scanRepo,
  sessionRepo,
  invitationRepo,
  messageRepo,
  galleryRepo
} = repositories;

// ============================================================================
// EXPORTS COMPLETS
// ============================================================================

/**
 * @module repositories
 * @description Module principal des repositories Secura
 * @example
 * // Import complet
 * const { userRepo, eventRepo } = require('./repositories');
 * 
 * // Utilisation
 * const user = await userRepo.findById('user123');
 * const events = await eventRepo.findByOrganizer('user123');
 * 
 * @example
 * // Import des classes pour l'héritage
 * const { UserRepository, EventRepository } = require('./repositories');
 */

/**
 * Instance du UserRepository
 * @type {UserRepositoryClass}
 */
const userRepoInstance = userRepo;

/**
 * Instance du EventRepository
 * @type {EventRepositoryClass}
 */
const eventRepoInstance = eventRepo;

/**
 * Instance du GuestRepository
 * @type {GuestRepositoryClass}
 */
const guestRepoInstance = guestRepo;

/**
 * Instance du QRCodeRepository
 * @type {QRCodeRepositoryClass}
 */
const qrCodeRepoInstance = qrCodeRepo;

/**
 * Instance du ScanRepository
 * @type {ScanRepositoryClass}
 */
const scanRepoInstance = scanRepo;

/**
 * Instance du SessionRepository
 * @type {SessionRepositoryClass}
 */
const sessionRepoInstance = sessionRepo;

/**
 * Instance du InvitationRepository
 * @type {InvitationRepositoryClass}
 */
const invitationRepoInstance = invitationRepo;

/**
 * Instance du MessageRepository
 * @type {MessageRepositoryClass}
 */
const messageRepoInstance = messageRepo;

/**
 * Instance du GalleryRepository
 * @type {GalleryRepositoryClass}
 */
const galleryRepoInstance = galleryRepo;

// Export principal - instances pré-initialisées
module.exports = {
  // ==========================================================================
  // INSTANCES (pour utilisation directe)
  // ==========================================================================
  
  /** @type {UserRepositoryClass} Instance du UserRepository */
  userRepo: userRepoInstance,
  
  /** @type {EventRepositoryClass} Instance du EventRepository */
  eventRepo: eventRepoInstance,
  
  /** @type {GuestRepositoryClass} Instance du GuestRepository */
  guestRepo: guestRepoInstance,
  
  /** @type {QRCodeRepositoryClass} Instance du QRCodeRepository */
  qrCodeRepo: qrCodeRepoInstance,
  
  /** @type {ScanRepositoryClass} Instance du ScanRepository */
  scanRepo: scanRepoInstance,
  
  /** @type {SessionRepositoryClass} Instance du SessionRepository */
  sessionRepo: sessionRepoInstance,
  
  /** @type {InvitationRepositoryClass} Instance du InvitationRepository */
  invitationRepo: invitationRepoInstance,
  
  /** @type {MessageRepositoryClass} Instance du MessageRepository */
  messageRepo: messageRepoInstance,
  
  /** @type {GalleryRepositoryClass} Instance du GalleryRepository */
  galleryRepo: galleryRepoInstance,

  // ==========================================================================
  // CLASSES (pour héritage et tests)
  // ==========================================================================
  
  /** @type {typeof UserRepository} Classe UserRepository */
  UserRepository,
  
  /** @type {typeof EventRepository} Classe EventRepository */
  EventRepository,
  
  /** @type {typeof GuestRepository} Classe GuestRepository */
  GuestRepository,
  
  /** @type {typeof QRCodeRepository} Classe QRCodeRepository */
  QRCodeRepository,
  
  /** @type {typeof ScanRepository} Classe ScanRepository */
  ScanRepository,
  
  /** @type {typeof SessionRepository} Classe SessionRepository */
  SessionRepository,
  
  /** @type {typeof InvitationRepository} Classe InvitationRepository */
  InvitationRepository,
  
  /** @type {typeof MessageRepository} Classe MessageRepository */
  MessageRepository,
  
  /** @type {typeof GalleryRepository} Classe GalleryRepository */
  GalleryRepository,

  // ==========================================================================
  // FONCTIONS UTILITAIRES
  // ==========================================================================
  
  /**
   * @function getRepositories
   * @returns {RepositoryInstances}
   */
  getRepositories,
  
  /**
   * @function resetRepositories
   * @returns {RepositoryInstances}
   */
  resetRepositories,
  
  /**
   * @function healthCheckAll
   * @returns {Promise<Object>}
   */
  healthCheckAll,

  // ==========================================================================
  // ALIAS ET VERSIONS ALTERNATIVES
  // ==========================================================================
  
  /** @alias module.exports.userRepo */
  users: userRepoInstance,
  
  /** @alias module.exports.eventRepo */
  events: eventRepoInstance,
  
  /** @alias module.exports.guestRepo */
  guests: guestRepoInstance,
  
  /** @alias module.exports.qrCodeRepo */
  qrCodes: qrCodeRepoInstance,
  
  /** @alias module.exports.scanRepo */
  scans: scanRepoInstance,
  
  /** @alias module.exports.sessionRepo */
  sessions: sessionRepoInstance,

  // ==========================================================================
  // GROUPES LOGIQUES
  // ==========================================================================
  
  /**
   * @type {Object} Repositories liés aux événements
   */
  eventRepositories: {
    /** @type {EventRepositoryClass} */
    eventRepo: eventRepoInstance,
    /** @type {GuestRepositoryClass} */
    guestRepo: guestRepoInstance,
    /** @type {QRCodeRepositoryClass} */
    qrCodeRepo: qrCodeRepoInstance,
    /** @type {ScanRepositoryClass} */
    scanRepo: scanRepoInstance
  },

  /**
   * @type {Object} Repositories liés aux utilisateurs
   */
  userRepositories: {
    /** @type {UserRepositoryClass} */
    userRepo: userRepoInstance,
    /** @type {SessionRepositoryClass} */
    sessionRepo: sessionRepoInstance
  },

  /**
   * @type {Object} Repositories liés aux communications
   */
  communicationRepositories: {
    /** @type {InvitationRepositoryClass} */
    invitationRepo: invitationRepoInstance,
    /** @type {MessageRepositoryClass} */
    messageRepo: messageRepoInstance
  },

  /**
   * @type {Object} Toutes les instances regroupées
   */
  repositories
};

// ============================================================================
// AJOUTER DES MÉTHODES UTILITAIRES SUPPLÉMENTAIRES
// ============================================================================

/**
 * @function getRepository
 * @description Récupère un repository par son nom
 * @param {string} name - Nom du repository (ex: 'userRepo', 'eventRepo')
 * @returns {Object|null} Repository ou null si non trouvé
 */
module.exports.getRepository = (name) => {
  const repos = getRepositories();
  return repos[name] || null;
};

/**
 * @function listRepositories
 * @description Liste tous les repositories disponibles
 * @returns {string[]} Noms des repositories
 */
module.exports.listRepositories = () => {
  return Object.keys(getRepositories());
};

/**
 * @function isRepositoryAvailable
 * @description Vérifie si un repository est disponible
 * @param {string} name - Nom du repository
 * @returns {boolean} True si disponible
 */
module.exports.isRepositoryAvailable = (name) => {
  const repos = getRepositories();
  return repos[name] !== undefined;
};

// ============================================================================
// TYPE GUARDS POUR TYPESCRIPT (optionnel mais utile)
// ============================================================================

/**
 * @function isUserRepository
 * @description Vérifie si un objet est une instance de UserRepository
 * @param {any} obj - Objet à vérifier
 * @returns {boolean} True si c'est un UserRepository
 */
module.exports.isUserRepository = (obj) => {
  return obj && obj.constructor && obj.constructor.name === 'UserRepository';
};

/**
 * @function isEventRepository
 * @description Vérifie si un objet est une instance de EventRepository
 * @param {any} obj - Objet à vérifier
 * @returns {boolean} True si c'est un EventRepository
 */
module.exports.isEventRepository = (obj) => {
  return obj && obj.constructor && obj.constructor.name === 'EventRepository';
};

// ============================================================================
// CONFIGURATION POUR LES TESTS
// ============================================================================

/**
 * @function setupTestRepositories
 * @description Configure les repositories pour les tests
 * @param {Object} options - Options de configuration
 * @param {boolean} [options.mockDatabase=true] - Utiliser une base de données mock
 * @returns {RepositoryInstances} Repositories configurés pour les tests
 */
module.exports.setupTestRepositories = (options = {}) => {
  const { mockDatabase = true } = options;
  
  log.info('🧪 Configuration des repositories pour les tests', { options });
  
  const repos = resetRepositories();
  
  // Configurer les options de test
  Object.values(repos).forEach(repo => {
    if (repo.setTestMode) {
      repo.setTestMode(mockDatabase);
    }
  });
  
  return repos;
};
