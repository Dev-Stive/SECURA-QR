/**
 * @file qrHelper.js
 * @description Utilitaires de génération et validation de QR codes pour Secura.
 * Gère la création, validation et décodage des QR codes pour invitations et tables.
 * @module helpers/qrHelper
 * @requires qrcode
 * @requires crypto
 */

const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * @constant {Object} QR_TYPES
 * @description Types de QR codes utilisés dans Secura
 */
const QR_TYPES = {
  INVITATION: 'INV',
  TABLE_INFO: 'TBL',
  EVENT: 'EVT',
  GALLERY: 'GAL',
};

/**
 * @constant {Object} QR_OPTIONS
 * @description Options par défaut pour la génération des QR codes
 */
const QR_OPTIONS = {
  errorCorrectionLevel: 'M', // L, M, Q, H
  type: 'image/png',
  quality: 0.92,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
  width: 400, // pixels
};

/**
 * @constant {string} QR_SECRET
 * @description Secret pour la signature des QR codes (doit être en env)
 */
const QR_SECRET = process.env.QR_SECRET || 'secura_qr_secret_2025';

/**
 * @function generateInvitationData
 * @description Génère les données structurées pour un QR code d'invitation.
 * @param {Object} params - Paramètres de l'invitation
 * @param {string} params.eventId - ID de l'événement
 * @param {string} params.guestId - ID de l'invité
 * @param {string} params.guestName - Nom de l'invité
 * @param {number} [params.seats=1] - Nombre de places
 * @returns {Object} Données structurées
 * @example
 * const data = generateInvitationData({
 *   eventId: 'evt_123',
 *   guestId: 'gst_456',
 *   guestName: 'Jean Dupont',
 *   seats: 2
 * });
 */
const generateInvitationData = ({ eventId, guestId, guestName, seats = 1 }) => {
  const timestamp = new Date().toISOString();
  
  const data = {
    t: QR_TYPES.INVITATION,
    e: eventId,
    g: guestId,
    n: guestName,
    s: seats,
    d: timestamp,
  };
  
  // Ajouter une signature pour validation
  data.sig = generateSignature(data);
  
  return data;
};

/**
 * @function generateTableInfoData
 * @description Génère les données pour un QR code de table informatif.
 * @param {Object} params - Paramètres de la table
 * @param {string} params.eventId - ID de l'événement
 * @param {string|number} params.tableNumber - Numéro de table
 * @param {Object} [params.info] - Informations additionnelles
 * @returns {Object} Données structurées
 */
const generateTableInfoData = ({ eventId, tableNumber, info = {} }) => {
  const timestamp = new Date().toISOString();
  
  const data = {
    t: QR_TYPES.TABLE_INFO,
    e: eventId,
    tbl: tableNumber,
    d: timestamp,
    ...info,
  };
  
  data.sig = generateSignature(data);
  
  return data;
};

/**
 * @function generateSignature
 * @description Génère une signature HMAC pour valider l'intégrité du QR code.
 * @param {Object} data - Données à signer
 * @returns {string} Signature hexadécimale
 */
const generateSignature = (data) => {
  const { sig, ...dataToSign } = data; // Exclure la signature existante
  const payload = JSON.stringify(dataToSign);
  
  return crypto
    .createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 16);
};

/**
 * @function verifySignature
 * @description Vérifie la signature d'un QR code.
 * @param {Object} data - Données du QR code avec signature
 * @returns {boolean} True si signature valide
 */
const verifySignature = (data) => {
  if (!data || !data.sig) return false;
  
  const expectedSignature = generateSignature(data);
  return data.sig === expectedSignature;
};

/**
 * @function generateQRCode
 * @description Génère un QR code au format image.
 * @param {Object} data - Données à encoder
 * @param {Object} [options] - Options de génération
 * @returns {Promise<string>} Data URL de l'image (base64)
 * @example
 * const qrImage = await generateQRCode(invitationData);
 * // => "data:image/png;base64,iVBORw0KGgoAAAANS..."
 */
const generateQRCode = async (data, options = {}) => {
  try {
    const qrOptions = { ...QR_OPTIONS, ...options };
    const jsonData = JSON.stringify(data);
    
    // Générer le QR code en Data URL
    const dataURL = await QRCode.toDataURL(jsonData, qrOptions);
    
    return dataURL;
  } catch (error) {
    throw new Error(`Erreur génération QR code: ${error.message}`);
  }
};

/**
 * @function generateQRCodeBuffer
 * @description Génère un QR code au format buffer (pour sauvegarde fichier).
 * @param {Object} data - Données à encoder
 * @param {Object} [options] - Options de génération
 * @returns {Promise<Buffer>} Buffer de l'image PNG
 */
const generateQRCodeBuffer = async (data, options = {}) => {
  try {
    const qrOptions = { ...QR_OPTIONS, ...options };
    const jsonData = JSON.stringify(data);
    
    const buffer = await QRCode.toBuffer(jsonData, qrOptions);
    
    return buffer;
  } catch (error) {
    throw new Error(`Erreur génération QR code buffer: ${error.message}`);
  }
};

/**
 * @function generateQRCodeSVG
 * @description Génère un QR code au format SVG (vectoriel).
 * @param {Object} data - Données à encoder
 * @param {Object} [options] - Options de génération
 * @returns {Promise<string>} Code SVG
 */
const generateQRCodeSVG = async (data, options = {}) => {
  try {
    const qrOptions = {
      ...QR_OPTIONS,
      ...options,
      type: 'svg',
    };
    const jsonData = JSON.stringify(data);
    
    const svg = await QRCode.toString(jsonData, qrOptions);
    
    return svg;
  } catch (error) {
    throw new Error(`Erreur génération QR code SVG: ${error.message}`);
  }
};

/**
 * @function parseQRData
 * @description Parse les données d'un QR code scanné.
 * @param {string} qrString - Chaîne JSON du QR code
 * @returns {Object|null} Données parsées ou null si invalide
 * @example
 * const data = parseQRData('{"t":"INV","e":"evt_123",...}');
 */
const parseQRData = (qrString) => {
  try {
    const data = JSON.parse(qrString);
    
    // Vérifier que c'est un QR code Secura valide
    if (!data.t || !Object.values(QR_TYPES).includes(data.t)) {
      return null;
    }
    
    return data;
  } catch (error) {
    return null;
  }
};

/**
 * @function validateQRCode
 * @description Valide un QR code complet (structure + signature).
 * @param {string|Object} qrData - Données du QR code
 * @returns {Object} { valid: boolean, data?: Object, error?: string }
 * @example
 * const validation = validateQRCode(scannedData);
 * if (validation.valid) {
 *   console.log('QR valide:', validation.data);
 * }
 */
const validateQRCode = (qrData) => {
  try {
    // Parser si c'est une chaîne
    const data = typeof qrData === 'string' ? parseQRData(qrData) : qrData;
    
    if (!data) {
      return { valid: false, error: 'Format QR code invalide' };
    }
    
    // Vérifier les champs obligatoires selon le type
    if (data.t === QR_TYPES.INVITATION) {
      if (!data.e || !data.g || !data.n) {
        return { valid: false, error: 'Champs manquants pour invitation' };
      }
    } else if (data.t === QR_TYPES.TABLE_INFO) {
      if (!data.e || !data.tbl) {
        return { valid: false, error: 'Champs manquants pour table' };
      }
    }
    
    // Vérifier la signature
    if (!verifySignature(data)) {
      return { valid: false, error: 'Signature QR code invalide' };
    }
    
    // Vérifier l'expiration (optionnel, 30 jours)
    if (data.d) {
      const createdDate = new Date(data.d);
      const now = new Date();
      const daysDiff = (now - createdDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 30) {
        return { valid: false, error: 'QR code expiré (>30 jours)' };
      }
    }
    
    return { valid: true, data };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * @function generateInvitationQR
 * @description Génère un QR code complet pour une invitation.
 * @param {Object} params - Paramètres invitation
 * @param {string} [format='dataURL'] - 'dataURL', 'buffer', 'svg'
 * @returns {Promise<Object>} { data, qrCode }
 * @example
 * const { data, qrCode } = await generateInvitationQR({
 *   eventId: 'evt_123',
 *   guestId: 'gst_456',
 *   guestName: 'Jean Dupont'
 * });
 */
const generateInvitationQR = async (params, format = 'dataURL') => {
  const data = generateInvitationData(params);
  
  let qrCode;
  
  switch (format) {
    case 'buffer':
      qrCode = await generateQRCodeBuffer(data);
      break;
    case 'svg':
      qrCode = await generateQRCodeSVG(data);
      break;
    case 'dataURL':
    default:
      qrCode = await generateQRCode(data);
  }
  
  return { data, qrCode };
};

/**
 * @function generateTableQR
 * @description Génère un QR code pour une table informatif.
 * @param {Object} params - Paramètres table
 * @param {string} [format='dataURL'] - Format de sortie
 * @returns {Promise<Object>} { data, qrCode }
 */
const generateTableQR = async (params, format = 'dataURL') => {
  const data = generateTableInfoData(params);
  
  let qrCode;
  
  switch (format) {
    case 'buffer':
      qrCode = await generateQRCodeBuffer(data);
      break;
    case 'svg':
      qrCode = await generateQRCodeSVG(data);
      break;
    case 'dataURL':
    default:
      qrCode = await generateQRCode(data);
  }
  
  return { data, qrCode };
};

/**
 * @function generateBatchQRCodes
 * @description Génère plusieurs QR codes en lot.
 * @param {Object[]} dataArray - Tableau de données
 * @param {string} [format='dataURL'] - Format de sortie
 * @returns {Promise<Object[]>} Tableau de { data, qrCode }
 */
const generateBatchQRCodes = async (dataArray, format = 'dataURL') => {
  const results = [];
  
  for (const data of dataArray) {
    let qrCode;

    switch (format) {
        case 'buffer':
            qrCode = await generateQRCodeBuffer(data);
            break;
        case 'svg':
            qrCode = await generateQRCodeSVG(data);
            break;
        case 'dataURL':
        default:
            qrCode = await generateQRCode(data);
    }

    results.push({ data, qrCode });
  }
  
  return results;
}