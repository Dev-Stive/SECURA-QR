/**
 * @file csvHelper.js
 * @description Utilitaires d'import/export CSV pour Secura.
 * @module helpers/csvHelper
 * @requires papaparse
 */

const Papa = require('papaparse');
const fs = require('fs').promises;

/**
 * @function parseCSV
 * @description Parse un fichier CSV.
 * @param {string|Buffer} input - Contenu CSV ou buffer
 * @param {Object} [options] - Options parsing
 * @returns {Promise<Object>} { data, errors, meta }
 */
const parseCSV = async (input, options = {}) => {
  return new Promise((resolve) => {
    Papa.parse(input, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header) => header.trim(),
      ...options,
      complete: (results) => resolve(results),
    });
  });
};

/**
 * @function parseCSVFile
 * @description Parse un fichier CSV depuis le disque.
 * @param {string} filePath - Chemin du fichier
 * @returns {Promise<Object>} Données parsées
 */
const parseCSVFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  return await parseCSV(content);
};

/**
 * @function generateCSV
 * @description Génère un CSV à partir de données.
 * @param {Object[]} data - Données à exporter
 * @param {Object} [options] - Options génération
 * @returns {string} Contenu CSV
 */
const generateCSV = (data, options = {}) => {
  return Papa.unparse(data, {
    header: true,
    skipEmptyLines: true,
    ...options,
  });
};

/**
 * @function exportToCSV
 * @description Exporte des données vers un fichier CSV.
 * @param {Object[]} data - Données à exporter
 * @param {string} filePath - Chemin de sauvegarde
 * @returns {Promise<void>}
 */
const exportToCSV = async (data, filePath) => {
  const csv = generateCSV(data);
  await fs.writeFile(filePath, '\uFEFF' + csv, 'utf8'); // BOM UTF-8
};

/**
 * @function validateCSVStructure
 * @description Valide la structure d'un CSV.
 * @param {Object} parsed - Résultat du parsing
 * @param {string[]} requiredColumns - Colonnes requises
 * @returns {Object} { valid: boolean, missing?: string[] }
 */
const validateCSVStructure = (parsed, requiredColumns) => {
  if (!parsed.data || parsed.data.length === 0) {
    return { valid: false, error: 'CSV vide' };
  }
  
  const headers = Object.keys(parsed.data[0]);
  const missing = requiredColumns.filter(col => !headers.includes(col));
  
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  
  return { valid: true };
};

/**
 * @function normalizeCSVData
 * @description Normalise les données CSV.
 * @param {Object[]} data - Données brutes
 * @returns {Object[]} Données normalisées
 */
const normalizeCSVData = (data) => {
  return data.map(row => {
    const normalized = {};
    Object.keys(row).forEach(key => {
      const value = row[key];
      normalized[key] = typeof value === 'string' ? value.trim() : value;
    });
    return normalized;
  });
};

module.exports = {
  parseCSV,
  parseCSVFile,
  generateCSV,
  exportToCSV,
  validateCSVStructure,
  normalizeCSVData,
};