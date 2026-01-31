/**
 * @file imageHelper.js
 * @description Utilitaires de traitement d'images pour Secura.
 * Gère le redimensionnement, compression, conversion et optimisation d'images.
 * @module helpers/imageHelper
 * @requires sharp
 * @requires path
 */

const sharp = require('sharp');
const path = require('path');

/**
 * @constant {Object} IMAGE_FORMATS
 * @description Formats d'images supportés
 */
const IMAGE_FORMATS = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
  AVIF: 'avif',
  GIF: 'gif',
};

/**
 * @constant {Object} IMAGE_PRESETS
 * @description Préréglages de dimensions d'images
 */
const IMAGE_PRESETS = {
  THUMBNAIL: { width: 150, height: 150 },
  SMALL: { width: 400, height: 400 },
  MEDIUM: { width: 800, height: 800 },
  LARGE: { width: 1200, height: 1200 },
  QRCODE: { width: 400, height: 400 },
  GALLERY: { width: 1920, height: 1080 },
  AVATAR: { width: 200, height: 200 },
};

/**
 * @constant {Object} COMPRESSION_QUALITY
 * @description Qualité de compression par format
 */
const COMPRESSION_QUALITY = {
  jpeg: 85,
  png: 80,
  webp: 85,
  avif: 80,
};

/**
 * @function resizeImage
 * @description Redimensionne une image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {Object} options - Options de redimensionnement
 * @param {number} [options.width] - Largeur cible
 * @param {number} [options.height] - Hauteur cible
 * @param {string} [options.fit='cover'] - 'cover', 'contain', 'fill', 'inside', 'outside'
 * @param {string} [options.position='center'] - Position du recadrage
 * @returns {Promise<sharp.Sharp>} Instance Sharp
 * @example
 * const resized = await resizeImage(buffer, { width: 800, height: 600 });
 */
const resizeImage = async (input, options = {}) => {
  const {
    width,
    height,
    fit = 'cover',
    position = 'center',
  } = options;
  
  return sharp(input).resize({
    width,
    height,
    fit,
    position,
    withoutEnlargement: true, // Ne pas agrandir les petites images
  });
};

/**
 * @function compressImage
 * @description Compresse une image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {Object} options - Options de compression
 * @param {string} [options.format='jpeg'] - Format de sortie
 * @param {number} [options.quality] - Qualité (1-100)
 * @returns {Promise<Buffer>} Buffer image compressée
 * @example
 * const compressed = await compressImage(buffer, { format: 'webp', quality: 85 });
 */
const compressImage = async (input, options = {}) => {
  const {
    format = 'jpeg',
    quality = COMPRESSION_QUALITY[format] || 85,
  } = options;
  
  let pipeline = sharp(input);
  
  switch (format) {
    case IMAGE_FORMATS.JPEG:
      pipeline = pipeline.jpeg({ quality, progressive: true });
      break;
    case IMAGE_FORMATS.PNG:
      pipeline = pipeline.png({ quality, progressive: true });
      break;
    case IMAGE_FORMATS.WEBP:
      pipeline = pipeline.webp({ quality });
      break;
    case IMAGE_FORMATS.AVIF:
      pipeline = pipeline.avif({ quality });
      break;
    default:
      pipeline = pipeline.jpeg({ quality });
  }
  
  return await pipeline.toBuffer();
};

/**
 * @function optimizeImage
 * @description Optimise une image (redimensionnement + compression).
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {Object} options - Options d'optimisation
 * @param {string} [options.preset='MEDIUM'] - Préréglage de dimensions
 * @param {number} [options.width] - Largeur personnalisée (prioritaire)
 * @param {number} [options.height] - Hauteur personnalisée (prioritaire)
 * @param {string} [options.format='jpeg'] - Format de sortie
 * @param {number} [options.quality] - Qualité de compression
 * @returns {Promise<Buffer>} Buffer image optimisée
 * @example
 * const optimized = await optimizeImage(buffer, { preset: 'GALLERY', format: 'webp' });
 */
const optimizeImage = async (input, options = {}) => {
  const {
    preset = 'MEDIUM',
    width,
    height,
    format = 'jpeg',
    quality,
  } = options;
  
  // Utiliser dimensions personnalisées ou preset
  const dimensions = width || height
    ? { width, height }
    : IMAGE_PRESETS[preset] || IMAGE_PRESETS.MEDIUM;
  
  const resized = await resizeImage(input, dimensions);
  
  return await compressImage(resized, { format, quality });
};

/**
 * @function convertFormat
 * @description Convertit une image vers un autre format.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {string} targetFormat - Format cible ('jpeg', 'png', 'webp', etc.)
 * @returns {Promise<Buffer>} Buffer image convertie
 */
const convertFormat = async (input, targetFormat) => {
  return await compressImage(input, { format: targetFormat });
};

/**
 * @function createThumbnail
 * @description Crée une miniature d'une image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {Object} [options] - Options de miniature
 * @param {number} [options.size=150] - Taille (carré)
 * @param {string} [options.format='jpeg'] - Format de sortie
 * @returns {Promise<Buffer>} Buffer miniature
 * @example
 * const thumb = await createThumbnail(buffer, { size: 200 });
 */
const createThumbnail = async (input, options = {}) => {
  const {
    size = 150,
    format = 'jpeg',
  } = options;
  
  return await optimizeImage(input, {
    width: size,
    height: size,
    format,
  });
};

/**
 * @function cropImage
 * @description Recadre une image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {Object} options - Options de recadrage
 * @param {number} options.x - Position X (pixels)
 * @param {number} options.y - Position Y (pixels)
 * @param {number} options.width - Largeur
 * @param {number} options.height - Hauteur
 * @returns {Promise<Buffer>} Buffer image recadrée
 */
const cropImage = async (input, options) => {
  const { x, y, width, height } = options;
  
  return await sharp(input)
    .extract({ left: x, top: y, width, height })
    .toBuffer();
};

/**
 * @function rotateImage
 * @description Effectue une rotation d'image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {number} degrees - Degrés de rotation (90, 180, 270)
 * @returns {Promise<Buffer>} Buffer image pivotée
 */
const rotateImage = async (input, degrees) => {
  return await sharp(input)
    .rotate(degrees)
    .toBuffer();
};

/**
 * @function flipImage
 * @description Retourne une image horizontalement ou verticalement.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {string} direction - 'horizontal' ou 'vertical'
 * @returns {Promise<Buffer>} Buffer image retournée
 */
const flipImage = async (input, direction) => {
  const pipeline = sharp(input);
  
  if (direction === 'horizontal') {
    return await pipeline.flop().toBuffer();
  } else if (direction === 'vertical') {
    return await pipeline.flip().toBuffer();
  }
  
  return await pipeline.toBuffer();
};

/**
 * @function getImageMetadata
 * @description Obtient les métadonnées d'une image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @returns {Promise<Object>} Métadonnées
 * @example
 * const metadata = await getImageMetadata(buffer);
 * // => { format, width, height, channels, space, hasAlpha, ... }
 */
const getImageMetadata = async (input) => {
  return await sharp(input).metadata();
};

/**
 * @function validateImage
 * @description Valide qu'un fichier est une image valide.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @returns {Promise<Object>} { valid: boolean, error?: string, metadata?: Object }
 */
const validateImage = async (input) => {
  try {
    const metadata = await getImageMetadata(input);
    
    if (!metadata.format) {
      return { valid: false, error: 'Format d\'image non reconnu' };
    }
    
    return { valid: true, metadata };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * @function addWatermark
 * @description Ajoute un filigrane à une image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {Buffer|string} watermark - Buffer ou chemin du filigrane
 * @param {Object} [options] - Options de filigrane
 * @param {string} [options.gravity='southeast'] - Position
 * @param {number} [options.opacity=0.5] - Opacité (0-1)
 * @returns {Promise<Buffer>} Buffer image avec filigrane
 */
const addWatermark = async (input, watermark, options = {}) => {
  const {
    gravity = 'southeast',
    opacity = 0.5,
  } = options;
  
  const watermarkBuffer = Buffer.isBuffer(watermark)
    ? watermark
    : await sharp(watermark).toBuffer();
  
  return await sharp(input)
    .composite([{
      input: watermarkBuffer,
      gravity,
      blend: 'over',
    }])
    .toBuffer();
};

/**
 * @function generateAvatar
 * @description Génère un avatar à partir d'une image (carré, centré).
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {number} [size=200] - Taille de l'avatar
 * @returns {Promise<Buffer>} Buffer avatar
 */
const generateAvatar = async (input, size = 200) => {
  return await sharp(input)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({ quality: 90 })
    .toBuffer();
};

/**
 * @function createImageVariants
 * @description Crée plusieurs variantes d'une image.
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {Object[]} variants - Tableau de configurations
 * @returns {Promise<Object[]>} Tableau de buffers avec labels
 * @example
 * const variants = await createImageVariants(buffer, [
 *   { label: 'thumb', width: 150 },
 *   { label: 'large', width: 1200 }
 * ]);
 */
const createImageVariants = async (input, variants) => {
  const results = [];
  
  for (const variant of variants) {
    const { label, ...options } = variant;
    const buffer = await optimizeImage(input, options);
    results.push({ label, buffer });
  }
  
  return results;
};

/**
 * @function convertToWebP
 * @description Convertit une image en WebP (format moderne).
 * @param {Buffer|string} input - Buffer image ou chemin fichier
 * @param {number} [quality=85] - Qualité
 * @returns {Promise<Buffer>} Buffer image WebP
 */
const convertToWebP = async (input, quality = 85) => {
  return await sharp(input)
    .webp({ quality })
    .toBuffer();
};

module.exports = {
  IMAGE_FORMATS,
  IMAGE_PRESETS,
  COMPRESSION_QUALITY,
  
  resizeImage,
  compressImage,
  optimizeImage,
  convertFormat,
  cropImage,
  rotateImage,
  flipImage,
  
  createThumbnail,
  generateAvatar,
  createImageVariants,
  
  getImageMetadata,
  validateImage,
  
  addWatermark,
  
  // Conversions spécialisées
  convertToWebP,
};