/**
 * @file fileHelper.js
 * @description Utilitaires de gestion des fichiers pour Secura.
 * Gère l'upload, la validation, le stockage et la suppression de fichiers.
 * @module helpers/fileHelper
 * @requires fs
 * @requires path
 * @requires crypto
 * @requires mime-types
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');

/**
 * @constant {Object} FILE_TYPES
 * @description Types de fichiers autorisés avec leurs extensions et tailles max
 */
const FILE_TYPES = {
  IMAGE: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  DOCUMENT: {
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  GALLERY: {
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 8 * 1024 * 1024, // 8MB
  },
};

/**
 * @constant {Object} STORAGE_PATHS
 * @description Chemins de stockage des fichiers
 */
const STORAGE_PATHS = {
  UPLOADS: path.join(__dirname, '../../storage/uploads'),
  QRCODES: path.join(__dirname, '../../storage/qrcodes'),
  GALLERIES: path.join(__dirname, '../../storage/galleries'),
  BACKUPS: path.join(__dirname, '../../storage/backups'),
  TEMP: path.join(__dirname, '../../storage/temp'),
};

/**
 * @function ensureDirectoryExists
 * @description Crée un répertoire s'il n'existe pas.
 * @param {string} dirPath - Chemin du répertoire
 * @returns {Promise<void>}
 */
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

/**
 * @function initializeStorage
 * @description Initialise tous les répertoires de stockage.
 * @returns {Promise<void>}
 */
const initializeStorage = async () => {
  for (const dirPath of Object.values(STORAGE_PATHS)) {
    await ensureDirectoryExists(dirPath);
  }
};

/**
 * @function getFileExtension
 * @description Extrait l'extension d'un fichier.
 * @param {string} filename - Nom du fichier
 * @returns {string} Extension (avec le point)
 * @example
 * const ext = getFileExtension('photo.jpg');
 * // => ".jpg"
 */
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

/**
 * @function getMimeType
 * @description Obtient le type MIME d'un fichier.
 * @param {string} filename - Nom du fichier
 * @returns {string|null} Type MIME ou null
 * @example
 * const mimeType = getMimeType('photo.jpg');
 * // => "image/jpeg"
 */
const getMimeType = (filename) => {
  return mime.lookup(filename) || null;
};

/**
 * @function validateFileType
 * @description Valide le type d'un fichier.
 * @param {string} filename - Nom du fichier
 * @param {string} fileType - Type attendu ('IMAGE', 'DOCUMENT', 'GALLERY')
 * @returns {Object} { valid: boolean, error?: string }
 * @example
 * const validation = validateFileType('photo.jpg', 'IMAGE');
 * // => { valid: true }
 */
const validateFileType = (filename, fileType) => {
  const ext = getFileExtension(filename);
  const mimeType = getMimeType(filename);
  
  const config = FILE_TYPES[fileType];
  if (!config) {
    return { valid: false, error: 'Type de fichier non supporté' };
  }
  
  if (!config.extensions.includes(ext)) {
    return {
      valid: false,
      error: `Extension non autorisée. Extensions acceptées: ${config.extensions.join(', ')}`,
    };
  }
  
  if (mimeType && !config.mimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: 'Type MIME non autorisé',
    };
  }
  
  return { valid: true };
};

/**
 * @function validateFileSize
 * @description Valide la taille d'un fichier.
 * @param {number} fileSize - Taille en octets
 * @param {string} fileType - Type de fichier ('IMAGE', 'DOCUMENT', 'GALLERY')
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateFileSize = (fileSize, fileType) => {
  const config = FILE_TYPES[fileType];
  if (!config) {
    return { valid: false, error: 'Type de fichier non supporté' };
  }
  
  if (fileSize > config.maxSize) {
    const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille maximale: ${maxSizeMB}MB`,
    };
  }
  
  return { valid: true };
};

/**
 * @function generateUniqueFilename
 * @description Génère un nom de fichier unique.
 * @param {string} originalFilename - Nom original
 * @param {string} [prefix=''] - Préfixe optionnel
 * @returns {string} Nom de fichier unique
 * @example
 * const filename = generateUniqueFilename('photo.jpg', 'evt');
 * // => "evt_1701234567890_a3f2c1b4.jpg"
 */
const generateUniqueFilename = (originalFilename, prefix = '') => {
  const ext = getFileExtension(originalFilename);
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(4).toString('hex');
  
  const prefixPart = prefix ? `${prefix}_` : '';
  return `${prefixPart}${timestamp}_${randomHash}${ext}`;
};

/**
 * @function getFileSize
 * @description Obtient la taille d'un fichier.
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<number>} Taille en octets
 */
const getFileSize = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new Error(`Impossible de lire la taille du fichier: ${error.message}`);
  }
};

/**
 * @function formatFileSize
 * @description Formate une taille de fichier en format lisible.
 * @param {number} bytes - Taille en octets
 * @returns {string} Taille formatée
 * @example
 * const size = formatFileSize(1536000);
 * // => "1.46 MB"
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
};

/**
 * @function saveFile
 * @description Sauvegarde un fichier dans le stockage.
 * @param {Buffer} fileBuffer - Contenu du fichier
 * @param {string} filename - Nom du fichier
 * @param {string} [storageType='UPLOADS'] - Type de stockage
 * @returns {Promise<Object>} { path: string, url: string }
 * @example
 * const result = await saveFile(buffer, 'photo.jpg', 'GALLERIES');
 * // => { path: '/storage/galleries/photo.jpg', url: '/files/galleries/photo.jpg' }
 */
const saveFile = async (fileBuffer, filename, storageType = 'UPLOADS') => {
  const storagePath = STORAGE_PATHS[storageType];
  if (!storagePath) {
    throw new Error('Type de stockage invalide');
  }
  
  await ensureDirectoryExists(storagePath);
  
  const filePath = path.join(storagePath, filename);
  await fs.writeFile(filePath, fileBuffer);
  
  // URL relative pour accès web
  const url = `/files/${storageType.toLowerCase()}/${filename}`;
  
  return { path: filePath, url };
};

/**
 * @function deleteFile
 * @description Supprime un fichier du stockage.
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<boolean>} True si supprimé
 */
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false; // Fichier déjà supprimé
    }
    throw error;
  }
};

/**
 * @function fileExists
 * @description Vérifie si un fichier existe.
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<boolean>} True si existe
 */
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * @function readFile
 * @description Lit le contenu d'un fichier.
 * @param {string} filePath - Chemin du fichier
 * @param {string} [encoding='utf8'] - Encodage
 * @returns {Promise<string|Buffer>} Contenu du fichier
 */
const readFile = async (filePath, encoding = 'utf8') => {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error) {
    throw new Error(`Impossible de lire le fichier: ${error.message}`);
  }
};

/**
 * @function copyFile
 * @description Copie un fichier.
 * @param {string} sourcePath - Chemin source
 * @param {string} destPath - Chemin destination
 * @returns {Promise<void>}
 */
const copyFile = async (sourcePath, destPath) => {
  try {
    await fs.copyFile(sourcePath, destPath);
  } catch (error) {
    throw new Error(`Impossible de copier le fichier: ${error.message}`);
  }
};

/**
 * @function moveFile
 * @description Déplace un fichier.
 * @param {string} sourcePath - Chemin source
 * @param {string} destPath - Chemin destination
 * @returns {Promise<void>}
 */
const moveFile = async (sourcePath, destPath) => {
  try {
    await fs.rename(sourcePath, destPath);
  } catch (error) {
    // Si rename échoue (différents systèmes de fichiers), copier puis supprimer
    await copyFile(sourcePath, destPath);
    await deleteFile(sourcePath);
  }
};

/**
 * @function listFiles
 * @description Liste les fichiers d'un répertoire.
 * @param {string} dirPath - Chemin du répertoire
 * @param {Object} [options] - Options de filtrage
 * @param {string[]} [options.extensions] - Extensions à inclure
 * @returns {Promise<string[]>} Liste des fichiers
 */
const listFiles = async (dirPath, options = {}) => {
  try {
    const files = await fs.readdir(dirPath);
    
    if (options.extensions && Array.isArray(options.extensions)) {
      return files.filter(file => {
        const ext = getFileExtension(file);
        return options.extensions.includes(ext);
      });
    }
    
    return files;
  } catch (error) {
    throw new Error(`Impossible de lister les fichiers: ${error.message}`);
  }
};

/**
 * @function getFileInfo
 * @description Obtient les informations détaillées d'un fichier.
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<Object>} Informations du fichier
 * @example
 * const info = await getFileInfo('/path/to/file.jpg');
 * // => { name, size, extension, mimeType, created, modified }
 */
const getFileInfo = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const filename = path.basename(filePath);
    
    return {
      name: filename,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      extension: getFileExtension(filename),
      mimeType: getMimeType(filename),
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    throw new Error(`Impossible d'obtenir les infos du fichier: ${error.message}`);
  }
};

/**
 * @function cleanupOldFiles
 * @description Supprime les fichiers plus anciens qu'une durée donnée.
 * @param {string} dirPath - Répertoire à nettoyer
 * @param {number} maxAgeDays - Âge maximum en jours
 * @returns {Promise<number>} Nombre de fichiers supprimés
 */
const cleanupOldFiles = async (dirPath, maxAgeDays) => {
  try {
    const files = await fs.readdir(dirPath);
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile() && (now - stats.mtime.getTime()) > maxAgeMs) {
        await deleteFile(filePath);
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch (error) {
    throw new Error(`Erreur lors du nettoyage: ${error.message}`);
  }
};

/**
 * @function calculateDirectorySize
 * @description Calcule la taille totale d'un répertoire.
 * @param {string} dirPath - Chemin du répertoire
 * @returns {Promise<number>} Taille totale en octets
 */
const calculateDirectorySize = async (dirPath) => {
  let totalSize = 0;
  
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      totalSize += await calculateDirectorySize(filePath);
    }
  }
  
  return totalSize;
};

/**
 * @function createBackup
 * @description Crée une sauvegarde d'un fichier.
 * @param {string} filePath - Fichier à sauvegarder
 * @returns {Promise<string>} Chemin de la sauvegarde
 */
const createBackup = async (filePath) => {
  const filename = path.basename(filePath);
  const timestamp = Date.now();
  const backupFilename = `${path.parse(filename).name}_${timestamp}${path.parse(filename).ext}`;
  const backupPath = path.join(STORAGE_PATHS.BACKUPS, backupFilename);
  
  await ensureDirectoryExists(STORAGE_PATHS.BACKUPS);
  await copyFile(filePath, backupPath);
  
  return backupPath;
};

module.exports = {
  // Constantes
  FILE_TYPES,
  STORAGE_PATHS,
  
  // Initialisation
  initializeStorage,
  ensureDirectoryExists,
  
  // Validation
  validateFileType,
  validateFileSize,
  
  // Informations
  getFileExtension,
  getMimeType,
  getFileSize,
  getFileInfo,
  formatFileSize,
  
  // Génération
  generateUniqueFilename,
  
  // Opérations fichiers
  saveFile,
  deleteFile,
  readFile,
  copyFile,
  moveFile,
  fileExists,
  
  // Opérations répertoires
  listFiles,
  calculateDirectorySize,
  cleanupOldFiles,
  
  // Backup
  createBackup,
};