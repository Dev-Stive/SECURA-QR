/**
 * @file idGenerator.js
 * @description Module de génération d'identifiants uniques pour Secura.
 * Fournit plusieurs stratégies de génération (UUID, nanoid, custom prefix).
 * Optimisé pour la performance et la scalabilité.
 * @module helpers/idGenerator
 * @requires nanoid
 * @requires crypto
 */

const { nanoid, customAlphabet } = require('nanoid');
const crypto = require('crypto');

/**
 * @constant {Object} ID_PREFIXES
 * @description Préfixes pour les différents types d'entités
 */
const ID_PREFIXES = {
  EVENT: 'evt',
  GUEST: 'gst',
  QRCODE: 'qr',
  SCAN: 'scn',
  USER: 'usr',
  SESSION: 'sess',
  INVITATION: 'inv',
  GALLERY: 'gal',
  MESSAGE: 'msg',
  TABLE_QR: 'tqr',
  PERMISSION: 'prm',
  ROLE: 'rol',
  ALBUM: 'alb',
  PHOTO: 'ph',
  COMMENT: 'cmt',
  CATEGORY: 'cat',
  NOTIFICATION: 'notif',
  BACKUP: 'bak',
  TEMPLATE: 'tpl',
  SETTING: 'set',
  LOG: 'log'
};

/**
 * @constant {number} DEFAULT_ID_LENGTH
 * @description Longueur par défaut des IDs générés
 */
const DEFAULT_ID_LENGTH = 21;

/**
 * @constant {Object} ID_CONFIGS
 * @description Configuration spécifique pour chaque type d'ID
 */
const ID_CONFIGS = {
  EVENT: { prefix: ID_PREFIXES.EVENT, length: 16 },
  GUEST: { prefix: ID_PREFIXES.GUEST, length: 16 },
  QRCODE: { prefix: ID_PREFIXES.QRCODE, length: 16 },
  SCAN: { prefix: ID_PREFIXES.SCAN, length: 16 },
  USER: { prefix: ID_PREFIXES.USER, length: 16 },
  SESSION: { prefix: ID_PREFIXES.SESSION, length: 16 },
  GALLERY: { prefix: ID_PREFIXES.GALLERY, length: 16 },
  MESSAGE: { prefix: ID_PREFIXES.MESSAGE, length: 16 },
  ALBUM: { prefix: ID_PREFIXES.ALBUM, length: 12 },
  PHOTO: { prefix: ID_PREFIXES.PHOTO, length: 16 },
  COMMENT: { prefix: ID_PREFIXES.COMMENT, length: 12 },
  ACCESS_CODE: { length: 4, numeric: true },
  INVITATION_TOKEN: { length: 8, alphanumeric: true }
};

/**
 * @function generateUUID
 * @description Génère un UUID v4 standard (RFC 4122).
 * Utilisé pour les identifiants nécessitant une compatibilité maximale.
 * @returns {string} UUID v4 au format canonique (8-4-4-4-12)
 * @example
 * const id = generateUUID();
 * // => "550e8400-e29b-41d4-a716-446655440000"
 */
const generateUUID = () => {
  return crypto.randomUUID();
};

/**
 * @function generateNanoId
 * @description Génère un ID court et URL-safe avec nanoid.
 * Plus compact que UUID, idéal pour les URLs et les QR codes.
 * @param {number} [length=DEFAULT_ID_LENGTH] - Longueur de l'ID
 * @returns {string} ID nanoid généré
 * @example
 * const id = generateNanoId();
 * // => "V1StGXR8_Z5jdHi6B-myT"
 */
const generateNanoId = (length = DEFAULT_ID_LENGTH) => {
  return nanoid(length);
};

/**
 * @function generateNumericId
 * @description Génère un ID numérique pour les codes d'accès.
 * Utile pour les codes PIN ou les identifiants téléphoniques.
 * @param {number} [length=6] - Longueur du code numérique
 * @returns {string} Code numérique
 * @example
 * const code = generateNumericId(4);
 * // => "8374"
 */
const generateNumericId = (length = 6) => {
  const nanoidNumeric = customAlphabet('0123456789', length);
  return nanoidNumeric();
};

/**
 * @function generateAlphanumericId
 * @description Génère un ID alphanumérique majuscule pour les codes d'accès.
 * Exclut les caractères ambigus (0, O, I, 1).
 * @param {number} [length=8] - Longueur du code
 * @returns {string} Code alphanumérique
 * @example
 * const code = generateAlphanumericId(6);
 * // => "A3K7M9"
 */
const generateAlphanumericId = (length = 8) => {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sans 0, O, I, 1
  const nanoidAlpha = customAlphabet(alphabet, length);
  return nanoidAlpha();
};

/**
 * @function generatePrefixedId
 * @description Génère un ID avec préfixe personnalisé et timestamp.
 * Format: {prefix}_{timestamp}_{nanoid}
 * @param {string} prefix - Préfixe de l'entité (ex: 'evt', 'usr')
 * @param {number} [idLength=12] - Longueur de la partie aléatoire
 * @returns {string} ID préfixé
 * @example
 * const eventId = generatePrefixedId('evt');
 * // => "evt_1701234567890_V1StGXR8Z5jd"
 */
const generatePrefixedId = (prefix, idLength = 12) => {
  const timestamp = Date.now();
  const randomPart = nanoid(idLength);
  return `${prefix}_${timestamp}_${randomPart}`;
};

/**
 * @function generateCustomId
 * @description Génère un ID avec configuration personnalisée
 * @param {string} type - Type d'ID (ex: 'EVENT', 'USER')
 * @param {Object} [options] - Options supplémentaires
 * @returns {string} ID généré
 */
const generateCustomId = (type, options = {}) => {
  const config = ID_CONFIGS[type];
  if (!config) {
    throw new Error(`Type d'ID non supporté: ${type}`);
  }

  if (config.numeric) {
    return generateNumericId(config.length);
  }

  if (config.alphanumeric) {
    return generateAlphanumericId(config.length);
  }

  return generatePrefixedId(config.prefix, config.length);
};

// ============================================================================
// GÉNÉRATEURS SPÉCIFIQUES POUR CHAQUE ENTITÉ
// ============================================================================

/**
 * @function generateEventId
 * @description Génère un ID unique pour un événement.
 * @returns {string} ID événement
 * @example
 * const id = generateEventId();
 * // => "evt_1701234567890_V1StGXR8Z5jd"
 */
const generateEventId = () => {
  return generateCustomId('EVENT');
};

/**
 * @function generateGuestId
 * @description Génère un ID unique pour un invité.
 * @returns {string} ID invité
 * @example
 * const id = generateGuestId();
 * // => "gst_1701234567890_V1StGXR8Z5jd"
 */
const generateGuestId = () => {
  return generateCustomId('GUEST');
};

/**
 * @function generateQRCodeId
 * @description Génère un ID unique pour un QR code.
 * @returns {string} ID QR code
 * @example
 * const id = generateQRCodeId();
 * // => "qr_1701234567890_V1StGXR8Z5jd"
 */
const generateQRCodeId = () => {
  return generateCustomId('QRCODE');
};

/**
 * @function generateScanId
 * @description Génère un ID unique pour un scan.
 * @returns {string} ID scan
 */
const generateScanId = () => {
  return generateCustomId('SCAN');
};

/**
 * @function generateUserId
 * @description Génère un ID unique pour un utilisateur.
 * @returns {string} ID utilisateur
 */
const generateUserId = () => {
  return generateCustomId('USER');
};

/**
 * @function generateSessionId
 * @description Génère un ID unique pour une session d'agent.
 * @returns {string} ID session
 */
const generateSessionId = () => {
  return generateCustomId('SESSION');
};

/**
 * @function generateGalleryId
 * @description Génère un ID unique pour une galerie.
 * @returns {string} ID galerie
 */
const generateGalleryId = () => {
  return generateCustomId('GALLERY');
};

/**
 * @function generateMessageId
 * @description Génère un ID unique pour un message.
 * @returns {string} ID message
 */
const generateMessageId = () => {
  return generateCustomId('MESSAGE');
};

/**
 * @function generateAlbumId
 * @description Génère un ID unique pour un album.
 * @returns {string} ID album
 */
const generateAlbumId = () => {
  return generateCustomId('ALBUM');
};

/**
 * @function generatePhotoId
 * @description Génère un ID unique pour une photo.
 * @returns {string} ID photo
 */
const generatePhotoId = () => {
  return generateCustomId('PHOTO');
};

/**
 * @function generateCommentId
 * @description Génère un ID unique pour un commentaire.
 * @returns {string} ID commentaire
 */
const generateCommentId = () => {
  return generateCustomId('COMMENT');
};

/**
 * @function generateInvitationId
 * @description Génère un ID unique pour une invitation.
 * @returns {string} ID invitation
 */
const generateInvitationId = () => {
  return generatePrefixedId(ID_PREFIXES.INVITATION);
};

/**
 * @function generatePermissionId
 * @description Génère un ID unique pour une permission.
 * @returns {string} ID permission
 */
const generatePermissionId = () => {
  return generatePrefixedId(ID_PREFIXES.PERMISSION, 10);
};

/**
 * @function generateRoleId
 * @description Génère un ID unique pour un rôle.
 * @returns {string} ID rôle
 */
const generateRoleId = () => {
  return generatePrefixedId(ID_PREFIXES.ROLE, 10);
};

/**
 * @function generateNotificationId
 * @description Génère un ID unique pour une notification.
 * @returns {string} ID notification
 */
const generateNotificationId = () => {
  return generatePrefixedId(ID_PREFIXES.NOTIFICATION, 12);
};

/**
 * @function generateBackupId
 * @description Génère un ID unique pour une sauvegarde.
 * @returns {string} ID sauvegarde
 */
const generateBackupId = () => {
  return generatePrefixedId(ID_PREFIXES.BACKUP, 10);
};

// ============================================================================
// CODES ET TOKENS SPÉCIAUX
// ============================================================================

/**
 * @function generateAccessCode
 * @description Génère un code d'accès numérique à 4 chiffres.
 * Utilisé pour l'authentification mobile des agents.
 * @returns {string} Code d'accès (4 chiffres)
 * @example
 * const code = generateAccessCode();
 * // => "7392"
 */
const generateAccessCode = () => {
  return generateCustomId('ACCESS_CODE');
};

/**
 * @function generateInvitationToken
 * @description Génère un token sécurisé pour les invitations.
 * Format alphanumérique majuscule sans ambiguïté.
 * @param {number} [length=8] - Longueur du token
 * @returns {string} Token d'invitation
 * @example
 * const token = generateInvitationToken();
 * // => "A3K7M9XY"
 */
const generateInvitationToken = (length = 8) => {
  return generateCustomId('INVITATION_TOKEN');
};

/**
 * @function generatePasswordResetToken
 * @description Génère un token sécurisé pour la réinitialisation de mot de passe.
 * @returns {string} Token de réinitialisation
 */
const generatePasswordResetToken = () => {
  return generateSecureToken(32);
};

/**
 * @function generateEmailVerificationToken
 * @description Génère un token pour la vérification d'email.
 * @returns {string} Token de vérification
 */
const generateEmailVerificationToken = () => {
  return generateSecureToken(24);
};

/**
 * @function generateApiKey
 * @description Génère une clé API sécurisée.
 * @param {string} [prefix='sec'] - Préfixe de la clé API
 * @returns {string} Clé API
 */
const generateApiKey = (prefix = 'sec') => {
  const randomPart = generateSecureToken(32);
  return `${prefix}_${randomPart}`;
};

// ============================================================================
// IDS SPÉCIALISÉS
// ============================================================================

/**
 * @function generateTableQRId
 * @description Génère un ID pour un QR code de table informatif.
 * @param {string|number} tableNumber - Numéro de table
 * @returns {string} ID QR code table
 * @example
 * const id = generateTableQRId(15);
 * // => "tqr_1701234567890_T15_V1StGXR8"
 */
const generateTableQRId = (tableNumber) => {
  const timestamp = Date.now();
  const randomPart = nanoid(8);
  return `${ID_PREFIXES.TABLE_QR}_${timestamp}_T${tableNumber}_${randomPart}`;
};

/**
 * @function generateConnectionId
 * @description Génère un ID de connexion pour les sessions WebSocket.
 * @param {string} agentId - ID de l'agent
 * @returns {string} ID de connexion
 */
const generateConnectionId = (agentId) => {
  const timestamp = Date.now();
  const randomPart = nanoid(6);
  return `conn_${agentId}_${timestamp}_${randomPart}`;
};

/**
 * @function generateBatchId
 * @description Génère un ID pour les opérations par lot.
 * @returns {string} ID de lot
 */
const generateBatchId = () => {
  const timestamp = Date.now();
  const randomPart = nanoid(8);
  return `batch_${timestamp}_${randomPart}`;
};

/**
 * @function generateUploadId
 * @description Génère un ID pour les uploads de fichiers.
 * @returns {string} ID d'upload
 */
const generateUploadId = () => {
  const timestamp = Date.now();
  const randomPart = nanoid(10);
  return `upload_${timestamp}_${randomPart}`;
};

/**
 * @function generateExportId
 * @description Génère un ID pour les exports de données.
 * @returns {string} ID d'export
 */
const generateExportId = () => {
  const timestamp = Date.now();
  const randomPart = nanoid(8);
  return `export_${timestamp}_${randomPart}`;
};

// ============================================================================
// UTILITAIRES D'ANALYSE ET VALIDATION
// ============================================================================

/**
 * @function extractTimestampFromId
 * @description Extrait le timestamp d'un ID préfixé.
 * @param {string} id - ID préfixé
 * @returns {number|null} Timestamp ou null si invalide
 * @example
 * const timestamp = extractTimestampFromId('evt_1701234567890_V1St');
 * // => 1701234567890
 */
const extractTimestampFromId = (id) => {
  try {
    const parts = id.split('_');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1], 10);
      return isNaN(timestamp) ? null : timestamp;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * @function extractPrefixFromId
 * @description Extrait le préfixe d'un ID.
 * @param {string} id - ID préfixé
 * @returns {string|null} Préfixe ou null si invalide
 * @example
 * const prefix = extractPrefixFromId('evt_1701234567890_V1St');
 * // => "evt"
 */
const extractPrefixFromId = (id) => {
  try {
    const parts = id.split('_');
    return parts.length > 0 ? parts[0] : null;
  } catch (error) {
    return null;
  }
};

/**
 * @function validateIdFormat
 * @description Valide le format d'un ID préfixé.
 * @param {string} id - ID à valider
 * @param {string} [expectedPrefix] - Préfixe attendu (optionnel)
 * @returns {boolean} True si valide, false sinon
 * @example
 * const isValid = validateIdFormat('evt_1701234567890_V1St', 'evt');
 * // => true
 */
const validateIdFormat = (id, expectedPrefix = null) => {
  if (!id || typeof id !== 'string') return false;
  
  const parts = id.split('_');
  if (parts.length < 3) return false;
  
  const [prefix, timestamp] = parts;
  
  // Vérifier le préfixe si fourni
  if (expectedPrefix && prefix !== expectedPrefix) return false;
  
  // Vérifier que le timestamp est un nombre valide
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || ts <= 0) return false;
  
  return true;
};

/**
 * @function getAgeFromId
 * @description Calcule l'âge d'un ID en millisecondes.
 * @param {string} id - ID préfixé
 * @returns {number|null} Âge en ms ou null si invalide
 */
const getAgeFromId = (id) => {
  const timestamp = extractTimestampFromId(id);
  if (!timestamp) return null;
  
  return Date.now() - timestamp;
};

/**
 * @function isIdExpired
 * @description Vérifie si un ID a expiré.
 * @param {string} id - ID à vérifier
 * @param {number} maxAgeMs - Âge maximum en ms
 * @returns {boolean} True si expiré
 */
const isIdExpired = (id, maxAgeMs = 24 * 60 * 60 * 1000) => {
  const age = getAgeFromId(id);
  return age !== null && age > maxAgeMs;
};

/**
 * @function normalizeId
 * @description Normalise un ID (trim, lowercase).
 * @param {string} id - ID à normaliser
 * @returns {string} ID normalisé
 */
const normalizeId = (id) => {
  if (!id) return '';
  return id.toString().trim();
};

// ============================================================================
// GÉNÉRATEURS DE MASSE
// ============================================================================

/**
 * @function generateBatchIds
 * @description Génère plusieurs IDs en lot.
 * @param {string} type - Type d'ID
 * @param {number} count - Nombre d'IDs à générer
 * @returns {string[]} Tableau d'IDs
 */
const generateBatchIds = (type, count = 1) => {
  if (count < 1 || count > 10000) {
    throw new Error('Nombre d\'IDs invalide (1-10000)');
  }
  
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateCustomId(type));
  }
  return ids;
};

/**
 * @function generateUniqueBatch
 * @description Génère un lot d'IDs uniques.
 * @param {string} type - Type d'ID
 * @param {number} count - Nombre d'IDs
 * @param {number} [maxAttempts=100] - Tentatives maximum pour éviter les doublons
 * @returns {string[]} IDs uniques
 */
const generateUniqueBatch = (type, count, maxAttempts = 100) => {
  const ids = new Set();
  let attempts = 0;
  
  while (ids.size < count && attempts < maxAttempts) {
    const id = generateCustomId(type);
    ids.add(id);
    attempts++;
  }
  
  if (ids.size < count) {
    throw new Error(`Impossible de générer ${count} IDs uniques après ${maxAttempts} tentatives`);
  }
  
  return Array.from(ids);
};

// ============================================================================
// GÉNÉRATEURS DIVERS
// ============================================================================

/**
 * @function generateShortId
 * @description Génère un ID court pour les URLs (8 caractères).
 * @returns {string} ID court
 * @example
 * const shortId = generateShortId();
 * // => "V1StGXR8"
 */
const generateShortId = () => {
  return nanoid(8);
};

/**
 * @function generateSecureToken
 * @description Génère un token cryptographiquement sécurisé.
 * Utilisé pour les tokens de réinitialisation, activation, etc.
 * @param {number} [bytes=32] - Nombre d'octets aléatoires
 * @returns {string} Token hexadécimal
 * @example
 * const token = generateSecureToken();
 * // => "a3f2c1b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
 */
const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * @function generateFilename
 * @description Génère un nom de fichier unique.
 * @param {string} originalName - Nom original du fichier
 * @param {string} [prefix] - Préfixe optionnel
 * @returns {string} Nom de fichier unique
 */
const generateFilename = (originalName, prefix = '') => {
  const timestamp = Date.now();
  const randomPart = nanoid(8);
  const extension = originalName ? `.${originalName.split('.').pop()}` : '';
  const prefixPart = prefix ? `${prefix}_` : '';
  
  return `${prefixPart}${timestamp}_${randomPart}${extension}`;
};

/**
 * @function generateColorCode
 * @description Génère un code couleur hexadécimal aléatoire.
 * @returns {string} Code couleur (#RRGGBB)
 */
const generateColorCode = () => {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
};

module.exports = {
  // Constantes
  ID_PREFIXES,
  ID_CONFIGS,
  DEFAULT_ID_LENGTH,
  
  // Générateurs génériques
  generateUUID,
  generateNanoId,
  generateNumericId,
  generateAlphanumericId,
  generatePrefixedId,
  generateCustomId,
  generateShortId,
  generateSecureToken,
  
  // Générateurs spécifiques d'entités
  generateEventId,
  generateGuestId,
  generateQRCodeId,
  generateScanId,
  generateUserId,
  generateSessionId,
  generateGalleryId,
  generateMessageId,
  generateAlbumId,
  generatePhotoId,
  generateCommentId,
  generateInvitationId,
  generatePermissionId,
  generateRoleId,
  generateNotificationId,
  generateBackupId,
  
  // Codes et tokens
  generateAccessCode,
  generateInvitationToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  generateApiKey,
  
  // IDs spécialisés
  generateTableQRId,
  generateConnectionId,
  generateBatchId,
  generateUploadId,
  generateExportId,
  
  // Utilitaires d'analyse
  extractTimestampFromId,
  extractPrefixFromId,
  validateIdFormat,
  getAgeFromId,
  isIdExpired,
  normalizeId,
  
  // Génération en masse
  generateBatchIds,
  generateUniqueBatch,
  
  // Génération diverse
  generateFilename,
  generateColorCode
};