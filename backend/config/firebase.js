/**
 * @file firebase.js
 * @description Classe d'initialisation de Firebase Admin SDK pour Secura QR.
 * Initialise l'application Firebase et expose les instances des services (Firestore, Auth, Messaging, Storage).
 * Inclut une logique de retentative robuste et gestion d'erreurs complète.
 * @module config/firebase
 * @requires firebase-admin
 * @requires ../utils/errorHandler
 * @requires ../utils/logger
 * @requires ./config
 */

const admin = require('firebase-admin');
const config = require('./config');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { generateUUID, formatDate } = require('../utils/helpers/idGenerator');
const { sleep } = require('../utils/helpers/dateHelper');

/**
 * @class Firebase
 * @description Classe pour gérer l'initialisation et les services Firebase (Firestore, Auth, Messaging, Storage).
 */
class Firebase {
  constructor() {
    /** @type {admin.firestore.Firestore | null} */
    this.db = null;
    /** @type {admin.auth.Auth | null} */
    this.auth = null;
    /** @type {admin.messaging.Messaging | null} */
    this.messaging = null;
    /** @type {admin.storage.Storage | null} */
    this.storage = null;
    /** @type {typeof admin} */
    this.admin = admin;
    /** @type {boolean} */
    this.initialized = false;
    /** @type {string} */
    this.instanceId = generateUUID();

    this.initializeFirebase();
  }

  /**
   * @function initializeFirebase
   * @description Initialise l'application Firebase Admin SDK avec validation complète des credentials.
   * Configure les services Firestore, Auth, Messaging, et Storage avec optimisations.
   * @throws {AppError} En cas d'échec de l'initialisation ou de validation des credentials.
   * @returns {void}
   */
  initializeFirebase() {
    try {
      logger.info('Firebase: Début initialisation...', {
        instanceId: this.instanceId,
        environment: config.nodeEnv
      });

      // Validation des credentials Firebase
      this.validateFirebaseConfig();

      // Configuration des services disponibles
      this.logAvailableServices();

      const serviceAccount = this.createServiceAccount();

      if (!this.admin.apps.length) {
        this.initializeAdminApp(serviceAccount);
        logger.info('Firebase Admin SDK initialisé avec succès', {
          projectId: config.firebase.projectId,
          environment: config.nodeEnv,
          instanceId: this.instanceId,
          timestamp: formatDate()
        });
      }

      // Initialisation des services
      this.initializeServices();
      
      // Test de connexion avec retry
      this.testConnectionWithRetry()
        .then(() => {
          this.initialized = true;
          logger.success('Firebase: Connexion établie et vérifiée');
        })
        .catch(error => {
          logger.error('Firebase: Échec de la connexion après retry', {
            error: error.message,
            instanceId: this.instanceId
          });
          throw error;
        });

    } catch (error) {
      logger.error('Firebase: Échec critique de l\'initialisation', {
        error: error.message,
        stack: error.stack,
        instanceId: this.instanceId
      });
      throw new AppError(
        'Échec de l\'initialisation de Firebase',
        500,
        'FIREBASE_INIT_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function validateFirebaseConfig
   * @description Valide la configuration Firebase requise
   * @throws {AppError} Si la configuration est incomplète
   * @returns {void}
   */
  validateFirebaseConfig() {
    const requiredFields = ['projectId', 'clientEmail', 'privateKey'];
    const missingFields = requiredFields.filter(field => !config.firebase[field]);
    
    if (missingFields.length > 0) {
      throw new AppError(
        `Configuration Firebase incomplète: champs manquants -> ${missingFields.join(', ')}`,
        500,
        'FIREBASE_CONFIG_INCOMPLETE'
      );
    }

    // Validation du format de la private key
    if (!config.firebase.privateKey.includes('BEGIN PRIVATE KEY')) {
      logger.warn('Firebase: Format de clé privée potentiellement incorrect');
    }

    logger.info('Firebase: Configuration validée avec succès', {
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKeyLength: config.firebase.privateKey?.length || 0
    });
  }

  /**
   * @function logAvailableServices
   * @description Log les services Firebase disponibles selon la configuration
   * @returns {void}
   */
  logAvailableServices() {
    const availableServices = {
      firestore: !!config.firebase.projectId,
      auth: !!config.firebase.clientEmail,
      messaging: !!(config.firebase.vapidKey && config.firebase.senderId),
      storage: !!config.firebase.databaseURL,
      database: !!config.firebase.databaseURL
    };

    logger.info('Firebase: Services disponibles', availableServices);

    // Avertissements pour les services manquants
    if (!availableServices.messaging) {
      logger.warn('Firebase: FCM non configuré - Notifications push désactivées');
    }
    if (!availableServices.storage) {
      logger.warn('Firebase: Storage non configuré - Uploads cloud désactivés');
    }
  }

  /**
   * @function createServiceAccount
   * @description Crée l'objet service account pour Firebase
   * @returns {Object} Service account configuré
   */
  createServiceAccount() {
    return {
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey.replace(/\\n/g, '\n')
    };
  }

  /**
   * @function initializeAdminApp
   * @description Initialise l'application Firebase Admin
   * @param {Object} serviceAccount - Service account configuré
   * @returns {void}
   */
  initializeAdminApp(serviceAccount) {
    const appConfig = {
      credential: this.admin.credential.cert(serviceAccount),
      databaseURL: config.firebase.databaseURL,
      storageBucket: config.firebase.databaseURL?.replace('firebaseio.com', 'appspot.com')
    };

    this.admin.initializeApp(appConfig);
  }

  /**
   * @function initializeServices
   * @description Initialise les services Firebase individuels
   * @returns {void}
   */
  initializeServices() {
    try {
      // Firestore avec optimisations
      this.db = this.admin.firestore();
      this.db.settings({
        ignoreUndefinedProperties: true,
        cacheSizeBytes: this.admin.firestore.CACHE_SIZE_UNLIMITED,
        timestampsInSnapshots: true
      });

      // Authentication
      this.auth = this.admin.auth();

      // Messaging (FCM)
      if (config.firebase.vapidKey && config.firebase.senderId) {
        this.messaging = this.admin.messaging();
      }

      // Storage
      if (config.firebase.databaseURL) {
        this.storage = this.admin.storage();
      }

      logger.info('Firebase: Services initialisés', {
        firestore: !!this.db,
        auth: !!this.auth,
        messaging: !!this.messaging,
        storage: !!this.storage
      });

    } catch (error) {
      logger.error('Firebase: Erreur initialisation services', {
        error: error.message,
        stack: error.stack
      });
      throw new AppError(
        'Erreur initialisation services Firebase',
        500,
        'FIREBASE_SERVICES_INIT_ERROR'
      );
    }
  }

  /**
   * @function testConnectionWithRetry
   * @description Teste la connexion Firebase avec système de retry
   * @param {number} maxRetries - Nombre maximum de tentatives (défaut: 3)
   * @param {number} initialDelay - Délai initial entre tentatives en ms (défaut: 2000)
   * @returns {Promise<boolean>} True si connexion réussie
   */
  async testConnectionWithRetry(maxRetries = 3, initialDelay = 2000) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.verifyFirestoreConnection();
        logger.info(`Firebase: Connexion établie à la tentative ${attempt}/${maxRetries}`);
        return true;
      } catch (error) {
        lastError = error;
        const delay = initialDelay * Math.pow(2, attempt - 1); // Backoff exponentiel
        
        logger.warn(`Firebase: Tentative ${attempt}/${maxRetries} échouée`, {
          error: error.message,
          nextRetryIn: `${delay}ms`
        });

        if (attempt < maxRetries) {
          await sleep(delay);
        }
      }
    }

    logger.error('Firebase: Échec toutes les tentatives de connexion', {
      maxRetries,
      lastError: lastError?.message
    });
    
    throw new AppError(
      'Impossible de se connecter à Firebase après plusieurs tentatives',
      500,
      'FIREBASE_CONNECTION_FAILED',
      { originalError: lastError?.message }
    );
  }

  /**
   * @function verifyFirestoreConnection
   * @description Vérifie la connexion Firestore via une opération de test
   * @returns {Promise<void>}
   * @throws {AppError} Si la vérification échoue
   */
  async verifyFirestoreConnection() {
    try {
      const testDoc = this.db.collection('_healthcheck').doc('connection_test');
      
      await testDoc.set({
        instanceId: this.instanceId,
        lastChecked: this.admin.firestore.FieldValue.serverTimestamp(),
        status: 'connected',
        environment: config.nodeEnv,
        timestamp: formatDate()
      }, { 
        merge: true,
        timeout: 10000 // Timeout de 10s
      });

      // Vérification que le document a bien été écrit
      const docSnapshot = await testDoc.get({ timeout: 5000 });
      
      if (!docSnapshot.exists) {
        throw new Error('Document de test non créé');
      }

      logger.debug('Firebase: Connexion Firestore vérifiée avec succès');

    } catch (error) {
      logger.error('Firebase: Échec vérification connexion Firestore', {
        error: error.message,
        stack: error.stack
      });
      throw new AppError(
        'Impossible de vérifier la connexion à Firestore',
        500,
        'FIRESTORE_CONNECTION_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function sendNotification
   * @description Envoie une notification FCM
   * @param {Object} message - Message FCM
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendNotification(message) {
    if (!this.messaging) {
      throw new AppError(
        'Service FCM non configuré',
        500,
        'FCM_NOT_CONFIGURED'
      );
    }

    try {
      const result = await this.messaging.send(message);
      
      logger.info('Firebase: Notification FCM envoyée', {
        messageId: result,
        topic: message.topic,
        token: message.token ? 'token_provided' : 'no_token'
      });

      return { success: true, messageId: result };

    } catch (error) {
      logger.error('Firebase: Erreur envoi notification FCM', {
        error: error.message,
        code: error.code
      });

      throw new AppError(
        `Erreur envoi notification: ${error.message}`,
        500,
        'FCM_SEND_ERROR',
        { originalError: error.message, code: error.code }
      );
    }
  }

  /**
   * @function verifyIdToken
   * @description Vérifie un token ID Firebase
   * @param {string} idToken - Token à vérifier
   * @returns {Promise<Object>} Token décodé
   */
  async verifyIdToken(idToken) {
    try {
      const decodedToken = await this.auth.verifyIdToken(idToken);
      
      logger.debug('Firebase: Token ID vérifié avec succès', {
        uid: decodedToken.uid,
        email: decodedToken.email
      });

      return decodedToken;

    } catch (error) {
      logger.warn('Firebase: Échec vérification token ID', {
        error: error.message,
        code: error.code
      });

      throw new AppError(
        `Token invalide: ${error.message}`,
        401,
        'INVALID_FIREBASE_TOKEN',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function createCustomToken
   * @description Crée un token personnalisé Firebase
   * @param {string} uid - UID de l'utilisateur
   * @param {Object} [additionalClaims] - Claims additionnels
   * @returns {Promise<string>} Token personnalisé
   */
  async createCustomToken(uid, additionalClaims = {}) {
    try {
      const token = await this.auth.createCustomToken(uid, additionalClaims);
      
      logger.debug('Firebase: Token personnalisé créé', {
        uid,
        claims: Object.keys(additionalClaims)
      });

      return token;

    } catch (error) {
      logger.error('Firebase: Erreur création token personnalisé', {
        error: error.message,
        uid
      });

      throw new AppError(
        `Erreur création token: ${error.message}`,
        500,
        'CUSTOM_TOKEN_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function getUser
   * @description Récupère un utilisateur Firebase par UID
   * @param {string} uid - UID de l'utilisateur
   * @returns {Promise<Object>} Données utilisateur
   */
  async getUser(uid) {
    try {
      const userRecord = await this.auth.getUser(uid);
      
      logger.debug('Firebase: Utilisateur récupéré', {
        uid,
        email: userRecord.email
      });

      return userRecord;

    } catch (error) {
      logger.warn('Firebase: Utilisateur non trouvé', {
        uid,
        error: error.message
      });

      throw new AppError(
        `Utilisateur non trouvé: ${error.message}`,
        404,
        'USER_NOT_FOUND',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function listCollections
   * @description Liste les collections disponibles dans Firestore
   * @returns {Promise<string[]>} Tableau des noms de collections
   */
  async listCollections() {
    try {
      const collections = await this.db.listCollections();
      const collectionIds = collections.map(col => col.id);
      
      logger.info('Firebase: Collections récupérées', {
        count: collectionIds.length,
        collections: collectionIds
      });

      return collectionIds;

    } catch (error) {
      logger.error('Firebase: Erreur récupération collections', {
        error: error.message
      });

      throw new AppError(
        'Erreur récupération collections Firestore',
        500,
        'FIRESTORE_COLLECTIONS_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function getDatabaseStats
   * @description Récupère les statistiques de la base Firestore
   * @returns {Promise<Object>} Statistiques de la base
   */
  async getDatabaseStats() {
    try {
      const collections = await this.listCollections();
      const stats = {
        totalCollections: collections.length,
        collections,
        instanceId: this.instanceId,
        lastChecked: formatDate(),
        environment: config.nodeEnv
      };

      logger.debug('Firebase: Statistiques base récupérées', stats);

      return stats;

    } catch (error) {
      logger.error('Firebase: Erreur récupération statistiques', {
        error: error.message
      });

      throw new AppError(
        'Erreur récupération statistiques Firestore',
        500,
        'FIRESTORE_STATS_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function uploadFile
   * @description Upload un fichier vers Firebase Storage
   * @param {string} path - Chemin de destination
   * @param {Buffer} fileBuffer - Contenu du fichier
   * @param {Object} metadata - Métadonnées du fichier
   * @returns {Promise<Object>} Informations du fichier uploadé
   */
  async uploadFile(path, fileBuffer, metadata = {}) {
    if (!this.storage) {
      throw new AppError(
        'Firebase Storage non configuré',
        500,
        'STORAGE_NOT_CONFIGURED'
      );
    }

    try {
      const bucket = this.storage.bucket();
      const file = bucket.file(path);

      await file.save(fileBuffer, {
        metadata: {
          ...metadata,
          contentType: metadata.contentType || 'application/octet-stream',
          metadata: {
            uploadedBy: 'secura-api',
            uploadedAt: formatDate(),
            instanceId: this.instanceId,
            ...metadata.metadata
          }
        },
        resumable: false
      });

      // Récupérer l'URL publique
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 jours
      });

      const fileInfo = {
        path,
        size: fileBuffer.length,
        url: signedUrl,
        contentType: metadata.contentType,
        uploadedAt: formatDate()
      };

      logger.info('Firebase: Fichier uploadé avec succès', fileInfo);

      return fileInfo;

    } catch (error) {
      logger.error('Firebase: Erreur upload fichier', {
        error: error.message,
        path,
        size: fileBuffer.length
      });

      throw new AppError(
        `Erreur upload fichier: ${error.message}`,
        500,
        'STORAGE_UPLOAD_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function isInitialized
   * @description Vérifie si Firebase est initialisé
   * @returns {boolean} True si initialisé
   */
  isInitialized() {
    return this.initialized && !!this.db && !!this.auth;
  }

  /**
   * @function getStatus
   * @description Retourne le statut des services Firebase
   * @returns {Object} Statut des services
   */
  getStatus() {
    return {
      initialized: this.initialized,
      services: {
        firestore: !!this.db,
        auth: !!this.auth,
        messaging: !!this.messaging,
        storage: !!this.storage
      },
      instanceId: this.instanceId,
      projectId: config.firebase.projectId,
      environment: config.nodeEnv,
      lastChecked: formatDate()
    };
  }

  /**
   * @function shutdown
   * @description Arrête proprement l'application Firebase
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      if (this.admin.apps.length) {
        await this.admin.app().delete();
        this.initialized = false;
        
        logger.info('Firebase: Application arrêtée proprement', {
          instanceId: this.instanceId,
          timestamp: formatDate()
        });
      }
    } catch (error) {
      logger.error('Firebase: Erreur lors de l\'arrêt', {
        error: error.message,
        instanceId: this.instanceId
      });
    }
  }
}

// Instance singleton avec gestion d'erreur
let firebaseInstance;

try {
  firebaseInstance = new Firebase();
} catch (error) {
  logger.error('Firebase: Échec création instance singleton', {
    error: error.message
  });
  // On crée une instance vide pour éviter les crashs
  firebaseInstance = {
    isInitialized: () => false,
    getStatus: () => ({ initialized: false, services: {} }),
    db: null,
    auth: null,
    messaging: null,
    storage: null
  };
}

module.exports = {
  initializeFirebase: () => firebaseInstance,
  db: firebaseInstance.db,
  auth: firebaseInstance.auth,
  messaging: firebaseInstance.messaging,
  storage: firebaseInstance.storage,
  admin: firebaseInstance.admin,
  verifyConnection: firebaseInstance.verifyFirestoreConnection?.bind(firebaseInstance),
  listCollections: firebaseInstance.listCollections?.bind(firebaseInstance),
  sendNotification: firebaseInstance.sendNotification?.bind(firebaseInstance),
  verifyIdToken: firebaseInstance.verifyIdToken?.bind(firebaseInstance),
  createCustomToken: firebaseInstance.createCustomToken?.bind(firebaseInstance),
  getUser: firebaseInstance.getUser?.bind(firebaseInstance),
  uploadFile: firebaseInstance.uploadFile?.bind(firebaseInstance),
  getStatus: firebaseInstance.getStatus?.bind(firebaseInstance),
  shutdown: firebaseInstance.shutdown?.bind(firebaseInstance),
  isInitialized: firebaseInstance.isInitialized?.bind(firebaseInstance)
};