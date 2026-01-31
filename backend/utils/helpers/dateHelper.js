/**
 * @file dateHelper.js
 * @description Utilitaires de manipulation et formatage des dates pour Secura.
 * Gère les conversions, validations, calculs et formatage des dates.
 * @module helpers/dateHelper
 * @requires moment
 * @requires moment-timezone
 */

const moment = require('moment');
require('moment/locale/fr');

// Configuration de la locale par défaut
moment.locale('fr');

/**
 * @constant {string} DEFAULT_TIMEZONE
 * @description Fuseau horaire par défaut (Afrique Centrale)
 */
const DEFAULT_TIMEZONE = 'Africa/Douala';

/**
 * @constant {Object} DATE_FORMATS
 * @description Formats de date standardisés
 */
const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  ISO_DATE: 'YYYY-MM-DD',
  ISO_TIME: 'HH:mm:ss',
  FRENCH_DATE: 'DD/MM/YYYY',
  FRENCH_DATETIME: 'DD/MM/YYYY HH:mm',
  LONG_DATE: 'dddd D MMMM YYYY',
  LONG_DATETIME: 'dddd D MMMM YYYY à HH:mm',
  TIME_12H: 'hh:mm A',
  TIME_24H: 'HH:mm',
  FILENAME: 'YYYY-MM-DD_HH-mm-ss',
  HUMAN_READABLE: 'D MMM YYYY',
};

/**
 * @function now
 * @description Retourne la date/heure actuelle.
 * @param {string} [format] - Format de sortie (optionnel)
 * @returns {string|moment.Moment} Date actuelle
 * @example
 * const current = now();
 * // => Moment object
 * const formatted = now(DATE_FORMATS.ISO);
 * // => "2025-11-29T14:30:00.000+01:00"
 */
const now = (format = null) => {
  const current = moment().tz(DEFAULT_TIMEZONE);
  return format ? current.format(format) : current;
};



/**
 * @function sleep
 * @description Pause l'exécution pendant un nombre de millisecondes
 * @param {number} ms - Durée en millisecondes
 * @returns {Promise<void>} Promise résolue après le délai
 * @example
 * await sleep(1000); // Pause de 1 seconde
 * await sleep(500);  // Pause de 500ms
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};


/**
 * @function formatDate
 * @description Formate une date selon un format spécifié.
 * @param {Date|string|moment.Moment} date - Date à formater
 * @param {string} [format=DATE_FORMATS.ISO] - Format de sortie
 * @returns {string} Date formatée
 * @example
 * const formatted = formatDate(new Date(), DATE_FORMATS.FRENCH_DATE);
 * // => "29/11/2025"
 */
const formatDate = (date, format = DATE_FORMATS.ISO) => {
  if (!date) return '';
  return moment(date).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * @function parseDate
 * @description Parse une date depuis une chaîne ou un objet Date.
 * @param {string|Date} input - Date à parser
 * @param {string} [inputFormat] - Format d'entrée (optionnel)
 * @returns {moment.Moment|null} Objet moment ou null si invalide
 * @example
 * const date = parseDate('29/11/2025', 'DD/MM/YYYY');
 */
const parseDate = (input, inputFormat = null) => {
  if (!input) return null;
  
  const parsed = inputFormat 
    ? moment(input, inputFormat, true)
    : moment(input);
    
  return parsed.isValid() ? parsed.tz(DEFAULT_TIMEZONE) : null;
};

/**
 * @function isValidDate
 * @description Vérifie si une date est valide.
 * @param {string|Date} date - Date à valider
 * @param {string} [format] - Format attendu (optionnel)
 * @returns {boolean} True si valide
 * @example
 * const valid = isValidDate('29/11/2025', 'DD/MM/YYYY');
 * // => true
 */
const isValidDate = (date, format = null) => {
  if (!date) return false;
  const parsed = format 
    ? moment(date, format, true)
    : moment(date);
  return parsed.isValid();
};

/**
 * @function addDays
 * @description Ajoute des jours à une date.
 * @param {Date|string|moment.Moment} date - Date de base
 * @param {number} days - Nombre de jours à ajouter (négatif pour soustraire)
 * @param {string} [format] - Format de sortie (optionnel)
 * @returns {string|moment.Moment} Nouvelle date
 * @example
 * const future = addDays(new Date(), 7, DATE_FORMATS.ISO_DATE);
 * // => "2025-12-06"
 */
const addDays = (date, days, format = null) => {
  const result = moment(date).tz(DEFAULT_TIMEZONE).add(days, 'days');
  return format ? result.format(format) : result;
};

/**
 * @function addHours
 * @description Ajoute des heures à une date.
 * @param {Date|string|moment.Moment} date - Date de base
 * @param {number} hours - Nombre d'heures à ajouter
 * @param {string} [format] - Format de sortie (optionnel)
 * @returns {string|moment.Moment} Nouvelle date
 */
const addHours = (date, hours, format = null) => {
  const result = moment(date).tz(DEFAULT_TIMEZONE).add(hours, 'hours');
  return format ? result.format(format) : result;
};

/**
 * @function diffInDays
 * @description Calcule la différence en jours entre deux dates.
 * @param {Date|string} date1 - Première date
 * @param {Date|string} date2 - Deuxième date
 * @returns {number} Différence en jours (arrondie)
 * @example
 * const diff = diffInDays('2025-12-01', '2025-11-29');
 * // => 2
 */
const diffInDays = (date1, date2) => {
  const m1 = moment(date1).tz(DEFAULT_TIMEZONE);
  const m2 = moment(date2).tz(DEFAULT_TIMEZONE);
  return m1.diff(m2, 'days');
};

/**
 * @function diffInHours
 * @description Calcule la différence en heures entre deux dates.
 * @param {Date|string} date1 - Première date
 * @param {Date|string} date2 - Deuxième date
 * @returns {number} Différence en heures
 */
const diffInHours = (date1, date2) => {
  const m1 = moment(date1).tz(DEFAULT_TIMEZONE);
  const m2 = moment(date2).tz(DEFAULT_TIMEZONE);
  return m1.diff(m2, 'hours');
};

/**
 * @function diffInMinutes
 * @description Calcule la différence en minutes entre deux dates.
 * @param {Date|string} date1 - Première date
 * @param {Date|string} date2 - Deuxième date
 * @returns {number} Différence en minutes
 */
const diffInMinutes = (date1, date2) => {
  const m1 = moment(date1).tz(DEFAULT_TIMEZONE);
  const m2 = moment(date2).tz(DEFAULT_TIMEZONE);
  return m1.diff(m2, 'minutes');
};

/**
 * @function isBefore
 * @description Vérifie si date1 est avant date2.
 * @param {Date|string} date1 - Première date
 * @param {Date|string} date2 - Deuxième date
 * @returns {boolean} True si date1 < date2
 */
const isBefore = (date1, date2) => {
  return moment(date1).isBefore(moment(date2));
};

/**
 * @function isAfter
 * @description Vérifie si date1 est après date2.
 * @param {Date|string} date1 - Première date
 * @param {Date|string} date2 - Deuxième date
 * @returns {boolean} True si date1 > date2
 */
const isAfter = (date1, date2) => {
  return moment(date1).isAfter(moment(date2));
};

/**
 * @function isBetween
 * @description Vérifie si une date est entre deux autres dates.
 * @param {Date|string} date - Date à vérifier
 * @param {Date|string} start - Date de début
 * @param {Date|string} end - Date de fin
 * @param {string} [inclusivity='()'] - '()' | '[]' | '[)' | '(]'
 * @returns {boolean} True si date est entre start et end
 * @example
 * const between = isBetween('2025-11-29', '2025-11-01', '2025-12-31');
 * // => true
 */
const isBetween = (date, start, end, inclusivity = '()') => {
  return moment(date).isBetween(moment(start), moment(end), null, inclusivity);
};

/**
 * @function isToday
 * @description Vérifie si une date correspond à aujourd'hui.
 * @param {Date|string} date - Date à vérifier
 * @returns {boolean} True si aujourd'hui
 */
const isToday = (date) => {
  return moment(date).isSame(moment(), 'day');
};

/**
 * @function isPast
 * @description Vérifie si une date est dans le passé.
 * @param {Date|string} date - Date à vérifier
 * @returns {boolean} True si passée
 */
const isPast = (date) => {
  return moment(date).isBefore(moment());
};

/**
 * @function isFuture
 * @description Vérifie si une date est dans le futur.
 * @param {Date|string} date - Date à vérifier
 * @returns {boolean} True si future
 */
const isFuture = (date) => {
  return moment(date).isAfter(moment());
};

/**
 * @function startOfDay
 * @description Retourne le début de la journée (00:00:00).
 * @param {Date|string} date - Date de référence
 * @param {string} [format] - Format de sortie (optionnel)
 * @returns {string|moment.Moment} Début de journée
 */
const startOfDay = (date, format = null) => {
  const result = moment(date).tz(DEFAULT_TIMEZONE).startOf('day');
  return format ? result.format(format) : result;
};

/**
 * @function endOfDay
 * @description Retourne la fin de la journée (23:59:59).
 * @param {Date|string} date - Date de référence
 * @param {string} [format] - Format de sortie (optionnel)
 * @returns {string|moment.Moment} Fin de journée
 */
const endOfDay = (date, format = null) => {
  const result = moment(date).tz(DEFAULT_TIMEZONE).endOf('day');
  return format ? result.format(format) : result;
};

/**
 * @function getWeekNumber
 * @description Retourne le numéro de semaine d'une date.
 * @param {Date|string} date - Date de référence
 * @returns {number} Numéro de semaine (1-53)
 */
const getWeekNumber = (date) => {
  return moment(date).week();
};

/**
 * @function getQuarter
 * @description Retourne le trimestre d'une date.
 * @param {Date|string} date - Date de référence
 * @returns {number} Trimestre (1-4)
 */
const getQuarter = (date) => {
  return moment(date).quarter();
};

/**
 * @function timeAgo
 * @description Retourne le temps écoulé depuis une date (format humain).
 * @param {Date|string} date - Date de référence
 * @returns {string} Temps écoulé (ex: "il y a 2 heures")
 * @example
 * const ago = timeAgo('2025-11-29T12:00:00');
 * // => "il y a 2 heures"
 */
const timeAgo = (date) => {
  return moment(date).fromNow();
};

/**
 * @function timeUntil
 * @description Retourne le temps restant jusqu'à une date.
 * @param {Date|string} date - Date cible
 * @returns {string} Temps restant (ex: "dans 3 jours")
 */
const timeUntil = (date) => {
  return moment(date).toNow();
};

/**
 * @function formatDuration
 * @description Formate une durée en millisecondes en texte lisible.
 * @param {number} milliseconds - Durée en ms
 * @returns {string} Durée formatée
 * @example
 * const duration = formatDuration(90000);
 * // => "1 minute 30 secondes"
 */
const formatDuration = (milliseconds) => {
  const duration = moment.duration(milliseconds);
  const hours = duration.hours();
  const minutes = duration.minutes();
  const seconds = duration.seconds();
  
  const parts = [];
  if (hours > 0) parts.push(`${hours} heure${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} seconde${seconds > 1 ? 's' : ''}`);
  
  return parts.join(' ') || '0 seconde';
};

/**
 * @function getAge
 * @description Calcule l'âge à partir d'une date de naissance.
 * @param {Date|string} birthDate - Date de naissance
 * @returns {number} Âge en années
 */
const getAge = (birthDate) => {
  return moment().diff(moment(birthDate), 'years');
};

/**
 * @function isWeekend
 * @description Vérifie si une date tombe un weekend.
 * @param {Date|string} date - Date à vérifier
 * @returns {boolean} True si samedi ou dimanche
 */
const isWeekend = (date) => {
  const day = moment(date).day();
  return day === 0 || day === 6; // 0 = Dimanche, 6 = Samedi
};

/**
 * @function getNextWorkday
 * @description Retourne le prochain jour ouvrable.
 * @param {Date|string} date - Date de référence
 * @param {string} [format] - Format de sortie (optionnel)
 * @returns {string|moment.Moment} Prochain jour ouvrable
 */
const getNextWorkday = (date, format = null) => {
  let next = moment(date).add(1, 'day');
  while (isWeekend(next)) {
    next.add(1, 'day');
  }
  return format ? next.format(format) : next;
};

/**
 * @function formatForFilename
 * @description Formate une date pour utilisation dans un nom de fichier.
 * @param {Date|string} [date=new Date()] - Date à formater
 * @returns {string} Date formatée (YYYY-MM-DD_HH-mm-ss)
 * @example
 * const filename = `backup_${formatForFilename()}.json`;
 * // => "backup_2025-11-29_14-30-45.json"
 */
const formatForFilename = (date = new Date()) => {
  return moment(date).format(DATE_FORMATS.FILENAME);
};

/**
 * @function parseISO
 * @description Parse une date ISO 8601.
 * @param {string} isoString - Chaîne ISO
 * @returns {moment.Moment|null} Moment object ou null
 */
const parseISO = (isoString) => {
  const parsed = moment(isoString, moment.ISO_8601, true);
  return parsed.isValid() ? parsed.tz(DEFAULT_TIMEZONE) : null;
};

/**
 * @function toISO
 * @description Convertit une date en format ISO 8601.
 * @param {Date|string|moment.Moment} date - Date à convertir
 * @returns {string} Chaîne ISO
 */
const toISO = (date) => {
  return moment(date).tz(DEFAULT_TIMEZONE).toISOString();
};

/**
 * @function getDateRange
 * @description Génère un tableau de dates entre deux dates.
 * @param {Date|string} startDate - Date de début
 * @param {Date|string} endDate - Date de fin
 * @param {string} [format=DATE_FORMATS.ISO_DATE] - Format des dates
 * @returns {string[]} Tableau de dates formatées
 * @example
 * const range = getDateRange('2025-11-01', '2025-11-05', 'YYYY-MM-DD');
 * // => ['2025-11-01', '2025-11-02', '2025-11-03', '2025-11-04', '2025-11-05']
 */
const getDateRange = (startDate, endDate, format = DATE_FORMATS.ISO_DATE) => {
  const start = moment(startDate);
  const end = moment(endDate);
  const range = [];

  while (start.isSameOrBefore(end)) {
range.push(start.format(format));
start.add(1, 'day');
}
return range;
};
module.exports = {
// Constantes
DEFAULT_TIMEZONE,
DATE_FORMATS,
// Création et parsing
now,
sleep,
formatDate,
parseDate,
parseISO,
toISO,

// Validation
isValidDate,

// Manipulation
addDays,
addHours,

// Comparaison
diffInDays,
diffInHours,
diffInMinutes,
isBefore,
isAfter,
isBetween,
isToday,
isPast,
isFuture,
isWeekend,
// Extraction
startOfDay,
endOfDay,
getWeekNumber,
getQuarter,
getAge,
// Formatage humain
timeAgo,
timeUntil,
formatDuration,

// Utilitaires
getNextWorkday,
formatForFilename,
getDateRange,
};
