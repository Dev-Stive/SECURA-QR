/**
 * @file stringHelper.js
 * @description Utilitaires de manipulation des chaînes de caractères pour Secura.
 * Inclut le nettoyage, la validation, le formatage et la transformation de textes.
 * @module helpers/stringHelper
 * @requires validator
 */

const validator = require('validator');

/**
 * @function sanitizeString
 * @description Nettoie une chaîne en supprimant les caractères dangereux.
 * Supprime les balises HTML, normalise les espaces.
 * @param {string} input - Chaîne à nettoyer
 * @param {Object} [options] - Options de nettoyage
 * @param {number} [options.maxLength=5000] - Longueur maximale
 * @param {boolean} [options.trim=true] - Supprimer espaces début/fin
 * @param {boolean} [options.removeHTML=true] - Supprimer balises HTML
 * @returns {string} Chaîne nettoyée
 * @example
 * const clean = sanitizeString('<script>alert("xss")</script>Hello  ');
 * // => "Hello"
 */
const sanitizeString = (input, options = {}) => {
  const {
    maxLength = 5000,
    trim = true,
    removeHTML = true,
  } = options;
  
  if (!input || typeof input !== 'string') return '';
  
  let result = input;
  
  // Supprimer les balises HTML
  if (removeHTML) {
    result = result.replace(/<[^>]*>/g, '');
  }
  
  // Normaliser les espaces
  result = result.replace(/\s+/g, ' ');
  
  // Trim
  if (trim) {
    result = result.trim();
  }
  
  // Limiter la longueur
  if (maxLength > 0) {
    result = result.substring(0, maxLength);
  }
  
  return result;
};

/**
 * @function capitalizeFirst
 * @description Met en majuscule la première lettre d'une chaîne.
 * @param {string} str - Chaîne à capitaliser
 * @returns {string} Chaîne capitalisée
 * @example
 * const capitalized = capitalizeFirst('hello world');
 * // => "Hello world"
 */
const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * @function capitalizeWords
 * @description Met en majuscule la première lettre de chaque mot.
 * @param {string} str - Chaîne à capitaliser
 * @returns {string} Chaîne avec mots capitalisés
 * @example
 * const capitalized = capitalizeWords('hello world from secura');
 * // => "Hello World From Secura"
 */
const capitalizeWords = (str) => {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * @function slugify
 * @description Convertit une chaîne en slug URL-friendly.
 * @param {string} str - Chaîne à convertir
 * @returns {string} Slug généré
 * @example
 * const slug = slugify('Mariage de Raina & Gerard');
 * // => "mariage-de-raina-gerard"
 */
const slugify = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD') // Normaliser les accents
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les diacritiques
    .replace(/[^a-z0-9]+/g, '-') // Remplacer caractères spéciaux par -
    .replace(/^-+|-+$/g, ''); // Supprimer - au début/fin
};

/**
 * @function truncate
 * @description Tronque une chaîne à une longueur maximale.
 * @param {string} str - Chaîne à tronquer
 * @param {number} [maxLength=100] - Longueur maximale
 * @param {string} [suffix='...'] - Suffixe ajouté si tronqué
 * @returns {string} Chaîne tronquée
 * @example
 * const short = truncate('Lorem ipsum dolor sit amet', 10);
 * // => "Lorem ipsu..."
 */
const truncate = (str, maxLength = 100, suffix = '...') => {
  if (!str || str.length <= maxLength) return str || '';
  return str.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * @function removeAccents
 * @description Supprime les accents d'une chaîne.
 * @param {string} str - Chaîne avec accents
 * @returns {string} Chaîne sans accents
 * @example
 * const clean = removeAccents('Événement à Yaoundé');
 * // => "Evenement a Yaounde"
 */
const removeAccents = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * @function escapeHTML
 * @description Échappe les caractères HTML dangereux.
 * @param {string} str - Chaîne à échapper
 * @returns {string} Chaîne échappée
 * @example
 * const safe = escapeHTML('<script>alert("xss")</script>');
 * // => "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
const escapeHTML = (str) => {
  if (!str) return '';
  return validator.escape(str);
};

/**
 * @function unescapeHTML
 * @description Décode les entités HTML.
 * @param {string} str - Chaîne HTML encodée
 * @returns {string} Chaîne décodée
 */
const unescapeHTML = (str) => {
  if (!str) return '';
  return validator.unescape(str);
};

/**
 * @function normalizeWhitespace
 * @description Normalise les espaces blancs (espaces, tabs, newlines).
 * @param {string} str - Chaîne à normaliser
 * @returns {string} Chaîne normalisée
 */
const normalizeWhitespace = (str) => {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
};

/**
 * @function extractEmails
 * @description Extrait toutes les adresses email d'une chaîne.
 * @param {string} str - Chaîne contenant des emails
 * @returns {string[]} Tableau d'emails trouvés
 * @example
 * const emails = extractEmails('Contact: john@example.com or jane@test.com');
 * // => ['john@example.com', 'jane@test.com']
 */
const extractEmails = (str) => {
  if (!str) return [];
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  return str.match(emailRegex) || [];
};

/**
 * @function extractPhoneNumbers
 * @description Extrait les numéros de téléphone d'une chaîne.
 * @param {string} str - Chaîne contenant des numéros
 * @returns {string[]} Tableau de numéros trouvés
 * @example
 * const phones = extractPhoneNumbers('Call 237-6-12-34-56-78 or +237655443322');
 * // => ['237-6-12-34-56-78', '+237655443322']
 */
const extractPhoneNumbers = (str) => {
  if (!str) return [];
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
  return str.match(phoneRegex) || [];
};

/**
 * @function maskEmail
 * @description Masque une partie d'un email pour la confidentialité.
 * @param {string} email - Email à masquer
 * @returns {string} Email masqué
 * @example
 * const masked = maskEmail('john.doe@example.com');
 * // => "j***e@example.com"
 */
const maskEmail = (email) => {
  if (!email || !validator.isEmail(email)) return email;
  
  const [username, domain] = email.split('@');
  if (username.length <= 2) return email;
  
  const masked = username[0] + '***' + username[username.length - 1];
  return `${masked}@${domain}`;
};

/**
 * @function maskPhone
 * @description Masque une partie d'un numéro de téléphone.
 * @param {string} phone - Numéro à masquer
 * @param {number} [visibleDigits=4] - Nombre de chiffres visibles à la fin
 * @returns {string} Numéro masqué
 * @example
 * const masked = maskPhone('+237655443322');
 * // => "+237****3322"
 */
const maskPhone = (phone, visibleDigits = 4) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, ''); // Garder que les chiffres
  if (digits.length <= visibleDigits) return phone;
  
  const visible = digits.slice(-visibleDigits);
  const masked = '*'.repeat(Math.min(digits.length - visibleDigits, 4));
  
  // Conserver les caractères non-numériques de début (ex: +237)
  const prefix = phone.match(/^[^\d]+/)?.[0] || '';
  return prefix + masked + visible;
};

/**
 * @function generateInitials
 * @description Génère les initiales d'un nom complet.
 * @param {string} fullName - Nom complet
 * @param {number} [maxInitials=2] - Nombre max d'initiales
 * @returns {string} Initiales en majuscules
 * @example
 * const initials = generateInitials('Jean Pierre Dupont');
 * // => "JP"
 */
const generateInitials = (fullName, maxInitials = 2) => {
  if (!fullName) return '';
  
  const words = fullName.trim().split(/\s+/);
  const initials = words
    .slice(0, maxInitials)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');
    
  return initials;
};

/**
 * @function formatPhoneNumber
 * @description Formate un numéro de téléphone selon un format standard.
 * @param {string} phone - Numéro brut
 * @param {string} [countryCode='+237'] - Code pays par défaut (Cameroun)
 * @returns {string} Numéro formaté
 * @example
 * const formatted = formatPhoneNumber('655443322');
 * // => "+237 6 55 44 33 22"
 */
const formatPhoneNumber = (phone, countryCode = '+237') => {
  if (!phone) return '';
  
  // Nettoyer le numéro
  let digits = phone.replace(/\D/g, '');
  
  // Ajouter code pays si absent
  if (!phone.startsWith('+')) {
    digits = countryCode.replace(/\D/g, '') + digits;
  }
  
  // Format Cameroun: +237 6 XX XX XX XX
  if (digits.startsWith('237') && digits.length === 12) {
    return `+237 ${digits.slice(3, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  
  // Format générique
  return `+${digits}`;
};

/**
 * @function parseFullName
 * @description Parse un nom complet en prénom et nom.
 * @param {string} fullName - Nom complet
 * @returns {Object} { firstName, lastName }
 * @example
 * const parsed = parseFullName('Jean Pierre Dupont');
 * // => { firstName: 'Jean Pierre', lastName: 'Dupont' }
 */
const parseFullName = (fullName) => {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const words = fullName.trim().split(/\s+/);
  
  if (words.length === 1) {
    return { firstName: words[0], lastName: '' };
  }
  
  // Dernier mot = nom de famille
  const lastName = words[words.length - 1];
  const firstName = words.slice(0, -1).join(' ');
  
  return { firstName, lastName };
};

/**
 * @function isValidURL
 * @description Vérifie si une chaîne est une URL valide.
 * @param {string} url - URL à valider
 * @returns {boolean} True si valide
 */
const isValidURL = (url) => {
  if (!url) return false;
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: false,
  });
};

/**
 * @function generateUsername
 * @description Génère un nom d'utilisateur à partir d'un nom complet.
 * @param {string} fullName - Nom complet
 * @returns {string} Username généré (lowercase, sans espaces)
 * @example
 * const username = generateUsername('Jean Pierre Dupont');
 * // => "jeanpierredupont"
 */
const generateUsername = (fullName) => {
  if (!fullName) return '';
  return slugify(fullName).replace(/-/g, '');
};

/**
 * @function highlightSearchTerm
 * @description Entoure un terme de recherche dans un texte.
 * @param {string} text - Texte source
 * @param {string} searchTerm - Terme à highlighter
 * @param {string} [tag='mark'] - Balise HTML à utiliser
 * @returns {string} Texte avec terme entouré
 * @example
 * const highlighted = highlightSearchTerm('Hello world', 'world');
 * // => "Hello <mark>world</mark>"
 */
const highlightSearchTerm = (text, searchTerm, tag = 'mark') => {
  if (!text || !searchTerm) return text;
  
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  return text.replace(regex, `<${tag}>$1</${tag}>`);
};

/**
 * @function escapeRegex
 * @description Échappe les caractères spéciaux pour regex.
 * @param {string} str - Chaîne à échapper
 * @returns {string} Chaîne échappée
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * @function randomString
 * @description Génère une chaîne aléatoire.
 * @param {number} [length=10] - Longueur de la chaîne
 * @param {string} [charset='alphanumeric'] - 'alphanumeric', 'alphabetic', 'numeric'
 * @returns {string} Chaîne aléatoire
 */
const randomString = (length = 10, charset = 'alphanumeric') => {
  const charsets = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numeric: '0123456789',
  };
  
  const characters = charsets[charset] || charsets.alphanumeric;
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
};

/**
 * @function wordCount
 * @description Compte le nombre de mots dans une chaîne.
 * @param {string} str - Chaîne à analyser
 * @returns {number} Nombre de mots
 */
const wordCount = (str) => {
  if (!str) return 0;
  return str.trim().split(/\s+/).length;
};

/**
 * @function charCount
 * @description Compte le nombre de caractères (sans espaces).
 * @param {string} str - Chaîne à analyser
 * @returns {number} Nombre de caractères
 */
const charCount = (str) => {
  if (!str) return 0;
  return str.replace(/\s/g, '').length;
};

module.exports = {
  // Nettoyage
  sanitizeString,
  normalizeWhitespace,
  escapeHTML,
  unescapeHTML,
  escapeRegex,
  
  // Transformation
  capitalizeFirst,
  capitalizeWords,
  slugify,
  truncate,
  removeAccents,
  
  // Extraction
  extractEmails,
  extractPhoneNumbers,
  
  // Masquage
  maskEmail,
  maskPhone,
  
  // Formatage
  formatPhoneNumber,
  
  // Parsing
  parseFullName,
  
  // Génération
  generateInitials,
  generateUsername,
  randomString,
  
  // Validation
  isValidURL,
  
  // Analyse
  wordCount,
  charCount,
  
  // Highlight
  highlightSearchTerm,
};