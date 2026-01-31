/**
 * @file storage.js
 * @description Configuration et gestion du stockage multi-backends pour Secura QR.
 * Support local, Cloudinary et Firebase Storage avec fallback automatique.
 * Gestion optimisée des uploads, transformations et CDN.
 * @module config/storage
 * @requires cloudinary
 * @requires ../utils/errorHandler
 * @requires ../utils/logger
 * @requires ./config
 * @requires ./firebase
 * @requires ../utils/helpers/fileHelper
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/helpers/idGenerator
 */

const cloudinary = require('cloudinary').v2;
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const config = require('./config');
const { db: firestore, storage: firebaseStorage } = require('./firebase');
const { ensureDirectoryExists, generateUniqueFilename, validateFileType } = require('../utils/helpers/fileHelper');
const { formatDate } = require('../utils/helpers/dateHelper');
const { generateUUID } = require('../utils/helpers/idGenerator');
const path = require('path');
const fs = require('fs').promises;




/**
 * @class StorageManager
 * @description Gestionnaire de stockage multi-backends
 */
class StorageManager {
  constructor() {
    /** @type {string} */
    this.activeBackend = 'local';
    /** @type {Object} */
    this.backends = new Map();
    /** @type {Object} */
    this.stats = {
      uploads: 0,
      downloads: 0,
      errors: 0,
      totalSize: 0
    };
    /** @type {boolean} */
    this.initialized = false;

    this.initializeStorage();
  }

  /**
   * @function initializeStorage
   * @description Initialise le système de stockage avec les backends disponibles
   * @returns {Promise<void>}
   */
  async initializeStorage() {
    try {
      logger.info('Storage: Début initialisation...');

      // Configuration des backends dans l'ordre de préférence
      await this.configureBackends();

      // Détermination du backend actif
      await this.determineActiveBackend();

      // Initialisation du stockage local
      await this.initializeLocalStorage();

      this.initialized = true;

      logger.success('Storage: Système initialisé avec succès', {
        activeBackend: this.activeBackend,
        availableBackends: Array.from(this.backends.keys()),
        environment: config.nodeEnv
      });

    } catch (error) {
      logger.error('Storage: Erreur initialisation', {
        error: error.message,
        stack: error.stack
      });
      throw new AppError(
        'Erreur initialisation système stockage',
        500,
        'STORAGE_INIT_ERROR'
      );
    }
  }

  /**
   * @function configureBackends
   * @description Configure tous les backends de stockage disponibles
   * @returns {Promise<void>}
   */
  async configureBackends() {
    const backends = [];

    // Cloudinary
    if (this.isCloudinaryConfigured()) {
      backends.push(this.configureCloudinary());
    }

    // Firebase Storage
    if (this.isFirebaseStorageConfigured()) {
      backends.push(this.configureFirebaseStorage());
    }

    // Stockage local (toujours disponible)
    backends.push(this.configureLocalStorage());

    await Promise.all(backends);
  }

  /**
   * @function isCloudinaryConfigured
   * @description Vérifie si Cloudinary est configuré
   * @returns {boolean}
   */
  isCloudinaryConfigured() {
    return !!(config.cloudinary.cloudName && 
              config.cloudinary.apiKey && 
              config.cloudinary.apiSecret);
  }

  /**
   * @function isFirebaseStorageConfigured
   * @description Vérifie si Firebase Storage est configuré
   * @returns {boolean}
   */
  isFirebaseStorageConfigured() {
    return !!(firebaseStorage && config.firebase.databaseURL);
  }

  /**
   * @function configureCloudinary
   * @description Configure le backend Cloudinary
   * @returns {Promise<void>}
   */
  async configureCloudinary() {
    try {
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
        secure: true
      });

      // Test de connexion
      await cloudinary.api.ping();

      this.backends.set('cloudinary', {
        name: 'Cloudinary',
        upload: async (fileBuffer, options) => await this.uploadToCloudinary(fileBuffer, options),
        delete: async (publicId) => await this.deleteFromCloudinary(publicId),
        getUrl: (publicId, transformations = []) => this.getCloudinaryUrl(publicId, transformations),
        test: async () => {
          await cloudinary.api.ping();
          return true;
        }
      });

      logger.info('Storage: Backend Cloudinary configuré', {
        cloudName: config.cloudinary.cloudName,
        environment: config.nodeEnv
      });

    } catch (error) {
      logger.error('Storage: Erreur configuration Cloudinary', {
        error: error.message
      });
    }
  }

  /**
   * @function configureFirebaseStorage
   * @description Configure le backend Firebase Storage
   * @returns {Promise<void>}
   */
  async configureFirebaseStorage() {
    try {
      this.backends.set('firebase', {
        name: 'Firebase Storage',
        upload: async (fileBuffer, options) => await this.uploadToFirebase(fileBuffer, options),
        delete: async (filePath) => await this.deleteFromFirebase(filePath),
        getUrl: (filePath) => this.getFirebaseUrl(filePath),
        test: async () => {
          // Test simple de Firebase Storage
          const bucket = firebaseStorage.bucket();
          const [files] = await bucket.getFiles({ maxResults: 1 });
          return true;
        }
      });

      logger.info('Storage: Backend Firebase Storage configuré');

    } catch (error) {
      logger.error('Storage: Erreur configuration Firebase Storage', {
        error: error.message
      });
    }
  }

  /**
   * @function configureLocalStorage
   * @description Configure le backend de stockage local
   * @returns {Promise<void>}
   */
  async configureLocalStorage() {
    try {
      this.backends.set('local', {
        name: 'Local Storage',
        upload: async (fileBuffer, options) => await this.uploadToLocal(fileBuffer, options),
        delete: async (filePath) => await this.deleteFromLocal(filePath),
        getUrl: (filePath) => this.getLocalUrl(filePath),
        test: async () => {
          await this.initializeLocalStorage();
          return true;
        }
      });

      logger.info('Storage: Backend Local Storage configuré');

    } catch (error) {
      logger.error('Storage: Erreur configuration Local Storage', {
        error: error.message
      });
    }
  }

  /**
   * @function initializeLocalStorage
   * @description Initialise le stockage local avec les répertoires nécessaires
   * @returns {Promise<void>}
   */
  async initializeLocalStorage() {
    const directories = [
      config.uploadTempDir,
      path.join(__dirname, '../../storage/uploads'),
      path.join(__dirname, '../../storage/qrcodes'),
      path.join(__dirname, '../../storage/galleries'),
      path.join(__dirname, '../../storage/backups')
    ];

    for (const dir of directories) {
      await ensureDirectoryExists(dir);
    }

    logger.debug('Storage: Répertoires locaux initialisés', {
      directories: directories.map(dir => path.basename(dir))
    });
  }

  /**
   * @function determineActiveBackend
   * @description Détermine le backend actif selon l'ordre de préférence
   * @returns {Promise<void>}
   */
  async determineActiveBackend() {
    const preferredOrder = ['cloudinary', 'firebase', 'local'];
    
    for (const backend of preferredOrder) {
      if (this.backends.has(backend)) {
        try {
          const backendInstance = this.backends.get(backend);
          await backendInstance.test();
          
          this.activeBackend = backend;
          logger.info('Storage: Backend actif déterminé', {
            backend: this.activeBackend
          });
          return;

        } catch (error) {
          logger.warn('Storage: Backend test échoué', {
            backend,
            error: error.message
          });
        }
      }
    }

    // Fallback sur local si aucun autre ne fonctionne
    this.activeBackend = 'local';
    logger.warn('Storage: Fallback sur stockage local');
  }

  /**
   * @function uploadFile
   * @description Upload un fichier via le backend actif
   * @param {Buffer} fileBuffer - Buffer du fichier
   * @param {Object} options - Options d'upload
   * @returns {Promise<Object>} Informations du fichier uploadé
   */
  async uploadFile(fileBuffer, options = {}) {
    if (!this.initialized) {
      throw new AppError(
        'Système de stockage non initialisé',
        500,
        'STORAGE_NOT_INITIALIZED'
      );
    }

    try {
      // Validation du fichier
      await this.validateFile(fileBuffer, options);

      const backend = this.backends.get(this.activeBackend);
      const startTime = Date.now();

      const result = await backend.upload(fileBuffer, options);

      // Mise à jour des statistiques
      this.updateStats('uploads', fileBuffer.length);

      const duration = Date.now() - startTime;

      logger.info('Storage: Fichier uploadé avec succès', {
        backend: this.activeBackend,
        type: options.fileType || 'unknown',
        size: fileBuffer.length,
        duration: `${duration}ms`,
        ...result
      });

            return {
        success: true,
        backend: this.activeBackend,
        ...result,
        metadata: {
          size: fileBuffer.length,
          uploadedAt: new Date().toISOString(),
          duration: `${duration}ms`
        }
      };

    } catch (error) {
      this.updateStats('errors');
      logger.error('Storage: Erreur upload fichier', {
        backend: this.activeBackend,
        error: error.message,
        stack: error.stack
      });
      throw new AppError(
        `Erreur upload fichier: ${error.message}`,
        500,
        'UPLOAD_ERROR'
      );
    }
  }

  /**
   * @function uploadToCloudinary
   * @description Upload un fichier vers Cloudinary
   * @param {Buffer} fileBuffer - Buffer du fichier
   * @param {Object} options - Options d'upload
   * @returns {Promise<Object>} Résultat de l'upload
   */
  async uploadToCloudinary(fileBuffer, options = {}) {
    const {
      folder = 'secura',
      publicId = generateUUID(),
      resourceType = 'auto',
      transformations = []
    } = options;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          public_id: publicId,
          folder: `${folder}/${config.nodeEnv}`,
          overwrite: false,
          tags: ['secura', 'upload'],
          context: {
            source: 'secura-api',
            environment: config.nodeEnv,
            uploadDate: formatDate(new Date(), 'YYYY-MM-DD')
          },
          transformation: transformations
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              publicId: result.public_id,
              url: result.secure_url,
              format: result.format,
              size: result.bytes,
              width: result.width,
              height: result.height,
              resourceType: result.resource_type,
              createdAt: result.created_at
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * @function uploadToFirebase
   * @description Upload un fichier vers Firebase Storage
   * @param {Buffer} fileBuffer - Buffer du fichier
   * @param {Object} options - Options d'upload
   * @returns {Promise<Object>} Résultat de l'upload
   */
  async uploadToFirebase(fileBuffer, options = {}) {
    const {
      folder = 'uploads',
      filename = generateUniqueFilename('file'),
      contentType = 'application/octet-stream'
    } = options;

    const filePath = `${config.nodeEnv}/${folder}/${filename}`;
    const file = firebaseStorage.bucket().file(filePath);

    try {
      await file.save(fileBuffer, {
        metadata: {
          contentType,
          metadata: {
            uploadedBy: 'secura-api',
            environment: config.nodeEnv,
            uploadDate: new Date().toISOString(),
            originalName: options.originalName || filename
          }
        }
      });

      // Rendre le fichier public
      await file.makePublic();

      // Générer l'URL signée (valide 10 ans)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000 // 10 ans
      });

      return {
        filePath,
        url: signedUrl,
        publicUrl: file.publicUrl(),
        size: fileBuffer.length,
        contentType,
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      throw new AppError(
        `Erreur upload Firebase: ${error.message}`,
        500,
        'FIREBASE_UPLOAD_ERROR'
      );
    }
  }

  /**
   * @function uploadToLocal
   * @description Upload un fichier vers le stockage local
   * @param {Buffer} fileBuffer - Buffer du fichier
   * @param {Object} options - Options d'upload
   * @returns {Promise<Object>} Résultat de l'upload
   */
  async uploadToLocal(fileBuffer, options = {}) {
    const {
      folder = 'uploads',
      filename = generateUniqueFilename('file'),
      subfolder = ''
    } = options;

    // Déterminer le répertoire de destination
    const baseDir = path.join(__dirname, '../../storage');
    const uploadDir = path.join(baseDir, folder, subfolder);
    const filePath = path.join(uploadDir, filename);

    await ensureDirectoryExists(uploadDir);

    // Sauvegarder le fichier
    await fs.writeFile(filePath, fileBuffer);

    // URL relative pour l'accès web
    const url = `/storage/${folder}/${subfolder ? subfolder + '/' : ''}${filename}`;

    return {
      filePath,
      url,
      size: fileBuffer.length,
      filename,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * @function deleteFile
   * @description Supprime un fichier du backend actif
   * @param {string} fileIdentifier - Identifiant du fichier
   * @param {Object} options - Options de suppression
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deleteFile(fileIdentifier, options = {}) {
    if (!this.initialized) {
      throw new AppError(
        'Système de stockage non initialisé',
        500,
        'STORAGE_NOT_INITIALIZED'
      );
    }

    try {
      const backend = this.backends.get(this.activeBackend);
      const result = await backend.delete(fileIdentifier, options);

      logger.info('Storage: Fichier supprimé avec succès', {
        backend: this.activeBackend,
        fileIdentifier,
        ...result
      });

      return {
        success: true,
        backend: this.activeBackend,
        ...result
      };

    } catch (error) {
      this.updateStats('errors');
      logger.error('Storage: Erreur suppression fichier', {
        backend: this.activeBackend,
        fileIdentifier,
        error: error.message
      });
      throw new AppError(
        `Erreur suppression fichier: ${error.message}`,
        500,
        'DELETE_ERROR'
      );
    }
  }

  /**
   * @function deleteFromCloudinary
   * @description Supprime un fichier de Cloudinary
   * @param {string} publicId - ID public du fichier
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deleteFromCloudinary(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      
      return {
        deleted: result.result === 'ok',
        publicId,
        result: result.result
      };
    } catch (error) {
      throw new AppError(
        `Erreur suppression Cloudinary: ${error.message}`,
        500,
        'CLOUDINARY_DELETE_ERROR'
      );
    }
  }

  /**
   * @function deleteFromFirebase
   * @description Supprime un fichier de Firebase Storage
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deleteFromFirebase(filePath) {
    try {
      const file = firebaseStorage.bucket().file(filePath);
      const [exists] = await file.exists();

      if (!exists) {
        return { deleted: false, error: 'Fichier non trouvé' };
      }

      await file.delete();
      return { deleted: true, filePath };
    } catch (error) {
      throw new AppError(
        `Erreur suppression Firebase: ${error.message}`,
        500,
        'FIREBASE_DELETE_ERROR'
      );
    }
  }

  /**
   * @function deleteFromLocal
   * @description Supprime un fichier du stockage local
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deleteFromLocal(filePath) {
    try {
      await fs.unlink(filePath);
      return { deleted: true, filePath };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { deleted: false, error: 'Fichier non trouvé' };
      }
      throw new AppError(
        `Erreur suppression locale: ${error.message}`,
        500,
        'LOCAL_DELETE_ERROR'
      );
    }
  }

  /**
   * @function getFileUrl
   * @description Récupère l'URL d'un fichier
   * @param {string} fileIdentifier - Identifiant du fichier
   * @param {Object} options - Options de transformation
   * @returns {Promise<string>} URL du fichier
   */
  async getFileUrl(fileIdentifier, options = {}) {
    if (!this.initialized) {
      throw new AppError(
        'Système de stockage non initialisé',
        500,
        'STORAGE_NOT_INITIALIZED'
      );
    }

    try {
      const backend = this.backends.get(this.activeBackend);
      return backend.getUrl(fileIdentifier, options);
    } catch (error) {
      logger.error('Storage: Erreur récupération URL', {
        backend: this.activeBackend,
        fileIdentifier,
        error: error.message
      });
      throw new AppError(
        `Erreur récupération URL: ${error.message}`,
        500,
        'URL_ERROR'
      );
    }
  }

  /**
   * @function getCloudinaryUrl
   * @description Génère l'URL Cloudinary avec transformations
   * @param {string} publicId - ID public du fichier
   * @param {Array} transformations - Transformations à appliquer
   * @returns {string} URL Cloudinary
   */
  getCloudinaryUrl(publicId, transformations = []) {
    return cloudinary.url(publicId, {
      secure: true,
          transformation: transformations
        });
      }

  /**
   * @function getFirebaseUrl
   * @description Génère l'URL Firebase Storage
   * @param {string} filePath - Chemin du fichier
   * @returns {string} URL Firebase
   */
  getFirebaseUrl(filePath) {
    return `https://storage.googleapis.com/${firebaseStorage.bucket().name}/${filePath}`;
  }

  /**
   * @function getLocalUrl
   * @description Génère l'URL locale
   * @param {string} filePath - Chemin du fichier
   * @returns {string} URL locale
   */
  getLocalUrl(filePath) {
    const relativePath = filePath.replace(path.join(__dirname, '../../storage'), '');
    return `/storage${relativePath}`;
  }

  /**
   * @function validateFile
   * @description Valide un fichier avant upload
   * @param {Buffer} fileBuffer - Buffer du fichier
   * @param {Object} options - Options de validation
   * @returns {Promise<void>}
   */
  async validateFile(fileBuffer, options = {}) {
    const {
      maxSize = config.uploadMaxFileSize,
      allowedTypes = config.uploadAllowedExtensions,
      fileType = 'IMAGE'
    } = options;

    // Validation de la taille
    if (fileBuffer.length > this.parseSize(maxSize)) {
      throw new AppError(
        `Fichier trop volumineux. Taille maximale: ${maxSize}`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    // Validation du type (si filename fourni)
    if (options.filename) {
      const validation = validateFileType(options.filename, fileType);
      if (!validation.valid) {
        throw new AppError(
          validation.error,
          400,
          'INVALID_FILE_TYPE'
        );
      }
    }

    // Validation basique du contenu
    if (fileBuffer.length === 0) {
      throw new AppError(
        'Fichier vide',
        400,
        'EMPTY_FILE'
      );
    }
  }

  /**
   * @function parseSize
   * @description Parse une taille de fichier en octets
   * @param {string} sizeStr - Chaîne de taille (ex: "10MB")
   * @returns {number} Taille en octets
   */
  parseSize(sizeStr) {
    const units = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMG]?B)$/i);
    if (!match) {
      return parseInt(sizeStr) || 0;
    }

    const [, value, unit] = match;
    const multiplier = units[unit.toUpperCase()] || 1;

    return parseFloat(value) * multiplier;
  }

  /**
   * @function updateStats
   * @description Met à jour les statistiques de stockage
   * @param {string} type - Type de statistique
   * @param {number} [value=1] - Valeur à ajouter
   */
  updateStats(type, value = 1) {
    switch (type) {
      case 'uploads':
        this.stats.uploads += value;
        this.stats.totalSize += value;
        break;
      case 'downloads':
        this.stats.downloads += value;
        break;
      case 'errors':
        this.stats.errors += value;
        break;
    }
  }

  /**
   * @function getStats
   * @description Récupère les statistiques de stockage
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      activeBackend: this.activeBackend,
      availableBackends: Array.from(this.backends.keys()),
      initialized: this.initialized,
      totalSizeFormatted: this.formatBytes(this.stats.totalSize)
    };
  }

  /**
   * @function formatBytes
   * @description Formate les octets en format lisible
   * @param {number} bytes - Octets
   * @returns {string} Taille formatée
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * @function switchBackend
   * @description Change le backend de stockage actif
   * @param {string} backend - Nom du backend
   * @returns {Promise<boolean>} Succès du changement
   */
  async switchBackend(backend) {
    if (!this.backends.has(backend)) {
      throw new AppError(
        `Backend non disponible: ${backend}`,
        400,
        'BACKEND_UNAVAILABLE'
      );
    }

    try {
      const backendInstance = this.backends.get(backend);
      await backendInstance.test();

      this.activeBackend = backend;

      logger.info('Storage: Backend changé', {
        newBackend: backend,
        previousBackend: this.activeBackend
      });

      return true;
    } catch (error) {
      logger.error('Storage: Impossible de changer de backend', {
        backend,
        error: error.message
      });
      return false;
    }
  }

  /**
   * @function cleanupTempFiles
   * @description Nettoie les fichiers temporaires
   * @param {number} maxAgeHours - Âge maximum en heures
   * @returns {Promise<number>} Nombre de fichiers supprimés
   */
  async cleanupTempFiles(maxAgeHours = 24) {
    try {
      const tempDir = config.uploadTempDir;
      const files = await fs.readdir(tempDir);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info('Storage: Fichiers temporaires nettoyés', {
          deletedCount,
          maxAgeHours
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Storage: Erreur nettoyage fichiers temporaires', {
        error: error.message
      });
      return 0;
    }
  }
}

// Instance singleton
const storageManager = new StorageManager();

module.exports = storageManager;