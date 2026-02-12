/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        🛡️  SECURA QR - SERVEUR ULTRA COMPLET V3.0  🛡️        ║
 * ║                                                               ║
 * ║  📡 API REST complète avec actions directes                   ║
 * ║  🔐 Sécurité JWT + API Key                                    ║
 * ║  💾 CRUD complet : Events, Guests, QR, Scans                  ║
 * ║  🔄 Synchronisation bidirectionnelle                          ║
 * ║  📊 Logs ultra-détaillés sur chaque opération                 ║
 * ║  🚀 Performance + validation avancée                          ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const moment = require('moment');
const cron = require('node-cron');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const multer = require('multer');
const crypto = require('crypto');
const { generateUserId } = require('./utils/helpers/idGenerator');
const { table } = require('console');
const storageManager = require('./services/storageService');

const SECRET_REGISTER_PATH = "mon_evenement_ultra_secret_2025";
const SECRET_HASH = crypto.createHash('md5').update(SECRET_REGISTER_PATH).digest('hex');
//const SECRET_ROUTE = `/secure-register-${SECRET_HASH.substring(0, 16)}`;

const generateGalleryId = () => `gal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generatePhotoId = () => `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateLikeId = () => `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateCommentId = () => `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateMenuId = () => `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateDishId = () => `dish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generatePlanId = () => `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateChatId = () => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const generatePrefixedId = (prefix, idLength = 12) => {
  const timestamp = Date.now();
  const randomPart = nanoid(idLength);
  return `${prefix}_${timestamp}_${randomPart}`;
};

//════════════════════════════════════════
// 🎨 SYSTÈME DE LOGS ULTRA PRO
// ═══════════════════════════════════════
const log = {
    banner: (text) => console.log(chalk.bold.cyan.bgBlack(`\n${'='.repeat(70)}\n${text}\n${'='.repeat(70)}\n`)),
    
    ultra: (msg, details = '') => console.log(chalk.bold.magenta(`[ULTRA]`), chalk.white(msg), chalk.gray(details)),
    info: (msg, details = '') => console.log(chalk.bold.blue(`[INFO]`), chalk.white(msg), chalk.gray(details)),
    success: (msg, details = '') => console.log(chalk.bold.green(`[✓ OK]`), chalk.white(msg), chalk.green(details)),
    warning: (msg, details = '') => console.log(chalk.bold.yellow(`[⚠ WARN]`), chalk.white(msg), chalk.yellow(details)),
    error: (msg, details = '') => console.log(chalk.bold.red(`[✗ ERR]`), chalk.white(msg), chalk.red(details)),
    
    api: (method, endpoint, status, duration = null) => {
        const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;
        const methodColor = method === 'GET' ? chalk.blue : method === 'POST' ? chalk.green : 
                           method === 'PUT' ? chalk.yellow : method === 'PATCH' ? chalk.magenta : 
                           method === 'DELETE' ? chalk.red : chalk.white;
        console.log(
            chalk.gray(`[${moment().format('HH:mm:ss.SSS')}]`),
            methodColor.bold(method.padEnd(7)),
            chalk.cyan(endpoint.padEnd(40)),
            statusColor(`→ ${status}`),
            duration ? chalk.gray(`(${duration}ms)`) : ''
        );
    },
    
    crud: (action, resource, data) => console.log(
        chalk.bold.cyan(`[💾 CRUD]`), 
        chalk.yellow(action.toUpperCase().padEnd(8)),
        chalk.white(resource.padEnd(15)),
        chalk.magenta(JSON.stringify(data).substring(0, 60) + '...')
    ),
    
    sync: (type, count) => console.log(chalk.bold.cyan(`[🔄 SYNC]`), chalk.white(`${type}:`), chalk.magenta(`${count} items`)),
    scan: (guestName) => console.log(chalk.bold.green(`[📷 SCAN]`), chalk.white(`Invité scanné:`), chalk.cyan(guestName)),
    backup: (filename) => console.log(chalk.bold.yellow(`[💾 BACKUP]`), chalk.white(`Sauvegarde:`), chalk.green(filename)),
    db: (action, count) => console.log(chalk.bold.blue(`[💾 DB]`), chalk.white(`${action}:`), chalk.magenta(`${count} records`)),
    
    validation: (field, status, message = '') => {
        const icon = status ? '✓' : '✗';
        const color = status ? chalk.green : chalk.red;
        console.log(color(`    ${icon} ${field.padEnd(20)}`), chalk.gray(message));
    },
    
    stats: (data) => {
        console.log(chalk.bold.cyan('\n📊 STATISTIQUES EN TEMPS RÉEL'));
        console.log(chalk.gray('─'.repeat(50)));
        Object.entries(data).forEach(([key, value]) => {
            console.log(chalk.white('  ' + key.padEnd(25)), chalk.bold.magenta(String(value).padStart(10)));
        });
        console.log(chalk.gray('─'.repeat(50)) + '\n');
    },
    
    separator: () => console.log(chalk.gray('─'.repeat(70))),
    
    box: (lines) => {
        const maxLen = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length));
        console.log(chalk.cyan('╔' + '═'.repeat(maxLen + 2) + '╗'));
        lines.forEach(line => {
            const cleanLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
            const padding = ' '.repeat(maxLen - cleanLen);
            console.log(chalk.cyan('║'), line + padding, chalk.cyan('║'));
        });
        console.log(chalk.cyan('╚' + '═'.repeat(maxLen + 2) + '╝'));
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
    PORT: process.env.PORT || 3000,
    BASE_URL: process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://localhost:${process.env.PORT || 3000}`,
    API_KEY: process.env.API_KEY || 'secura_ultra_2025',
    BACKUP_ENABLED: process.env.BACKUP_ENABLED === 'true',
    BACKUP_INTERVAL: parseInt(process.env.BACKUP_INTERVAL_MINUTES) || 30,
    BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
    LOG_LEVEL: process.env.LOG_LEVEL || 'ultra',
    DB_FILE: path.join(__dirname, 'data', 'secura-data.json'),
    BACKUP_DIR: path.join(__dirname, 'backups')
};

// Créer dossiers
[path.dirname(CONFIG.DB_FILE), CONFIG.BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log.success(`Dossier créé`, dir);
    }
});

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION EXPRESS
// ═══════════════════════════════════════════════════════════════

const app = express();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB pour les vidéos
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).substring(1).toLowerCase();
        
        // Images supportées
        const imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg', 'ico' , 'avif'];
        
        // Vidéos supportées
        const videoFormats = ['mp4', 'webm', 'mpeg', 'mpg', 'avi', 'mov', 'mkv', 'flv', '3gp', 'ogv', 'm4v'];
        
        // Documents supportés
        const docFormats = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
        
        const allAllowed = [...imageFormats, ...videoFormats, ...docFormats];
        
        if (allAllowed.includes(ext)) {
            cb(null, true);
        } else {
            const error = new Error(`Format ".${ext}" non supporté. Formats acceptés: ${imageFormats.join(', ')} (images), ${videoFormats.join(', ')} (vidéos), ${docFormats.join(', ')} (documents)`);
            error.code = 'INVALID_FILE_TYPE';
            error.supportedFormats = { images: imageFormats, videos: videoFormats, documents: docFormats };
            cb(error);
        }
    }
});

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key' , 'dash']
}));

// JSON parser qui ignore les requêtes multipart/form-data (gérées par multer)
app.use(express.json({ 
    limit: '50mb',
    skip: (req) => {
        // Skip JSON parsing pour les requêtes multipart (fichiers)
        return req.is('multipart/form-data');
    }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de gestion des erreurs Multer (doit être avant les autres middlewares)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        let message = 'Erreur lors du téléchargement du fichier';
        let details = err.message;
        
        if (err.code === 'FILE_TOO_LARGE') {
            message = 'Fichier trop volumineux';
            details = 'La taille maximale est 500MB';
        } else if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'Fichier trop volumineux';
            details = 'Taille maximale: 500MB';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Trop de fichiers';
            details = 'Un seul fichier par requête';
        }
        
        log.error('MULTER ERROR', `[${err.code}] ${message} - ${details}`);
        return res.status(400).json({
            success: false,
            error: message,
            details: details,
            code: err.code,
            timestamp: new Date().toISOString()
        });
    } else if (err && err.message) {
        // Erreur personnalisée du fileFilter
        if (err.code === 'INVALID_FILE_TYPE') {
            log.error('FILE TYPE ERROR', err.message);
            return res.status(400).json({
                success: false,
                error: 'Format fichier non supporté',
                details: err.message,
                supportedFormats: err.supportedFormats,
                code: 'INVALID_FILE_TYPE',
                timestamp: new Date().toISOString()
            });
        }
        
        // Autres erreurs
        log.error('UPLOAD ERROR', err.message);
        return res.status(400).json({
            success: false,
            error: 'Erreur lors du téléchargement',
            details: err.message,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
});



// ═══════════════════════════════════════════════════════════════
// 📊 MIDDLEWARE LOGGER DÉTAILLÉ
// ═══════════════════════════════════════════════════════════════

app.use((req, res, next) => {
    const start = Date.now();
    
    if (CONFIG.LOG_LEVEL === 'ultra' && req.path.startsWith('/api')) {
        log.info('Requête entrante', `${req.method} ${req.path}`);
        if (Object.keys(req.body).length > 0) {
            console.log(chalk.gray('    📦 Body:'), chalk.white(JSON.stringify(req.body).substring(0, 100)));
        }
        if (Object.keys(req.query).length > 0) {
            console.log(chalk.gray('    🔍 Query:'), chalk.white(JSON.stringify(req.query)));
        }
    }
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path.startsWith('/api')) {
            log.api(req.method, req.path, res.statusCode, duration);
        }
    });
    
    next();
});

// ═══════════════════════════════════════════════════════════════
// 🌐 MIDDLEWARE: Calcul du BaseURL dynamique
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule le baseURL basé sur la requête pour gérer
 * les différents environnements (localhost, domaine, proxy)
 */
app.use((req, res, next) => {
    // Déterminer le protocole
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    
    // Déterminer l'hôte
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost';
    
    // Construire le baseURL de la requête
    req.baseUrl = `${protocol}://${host}`;
    
    next();
});

// ═══════════════════════════════════════════════════════════════
// 🔐 MIDDLEWARE SÉCURITÉ (optionnel)
// ═══════════════════════════════════════════════════════════════

const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === CONFIG.API_KEY) {
        next();
    } else {
        log.warning('Accès refusé', req.ip);
        res.status(403).json({ success: false, error: 'API Key invalide' });
    }
};


// ═══════════════════════════════════════════════════════════════
// 🛠️ FONCTIONS UTILITAIRES MISES À JOUR
// ═══════════════════════════════════════════════════════════════

const loadData = () => {
    try {
        if (!fs.existsSync(CONFIG.DB_FILE)) {
        
        const initialData = {
            events: [],
            guests: [],
            tables: [],
            qrCodes: [],
            scans: [],
            users: [],
            sessions: [],
            eventSessions: [],
            galleries: [],          // ← NOUVEAU
            menus: [],              // ← NOUVEAU
            plans: [],              // ← NOUVEAU
            chatConversations: [],  // ← NOUVEAU
            contacts: [],
            settings: {},
            tempUsers: [],
            passwordResets: [],
            meta: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: '3.0'
            }
        };
            fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        
        const raw = fs.readFileSync(CONFIG.DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        
        return {
            events: data.events || [],
            tables: data.tables || [],
            guests: data.guests || [],
            qrCodes: data.qrCodes || [],
            scans: data.scans || [],
            users: data.users || [],
            sessions: data.sessions || [],
            eventSessions: data.eventSessions || [],
            galleries: data.galleries || [],
            menus: data.menus || [],
            plans: data.plans || [],
            chatConversations: data.chatConversations || [],
            settings: data.settings || {},
            tempUsers: data.tempUsers || [],
            passwordResets: data.passwordResets || [],
            meta: data.meta || {
                updatedAt: new Date().toISOString(),
                version: '3.0'
            }
        };
    } catch (err) {
        log.error('Erreur chargement DB', err.message);
        return { 
            events: [], 
            tables: [],
            guests: [], 
            qrCodes: [], 
            scans: [], 
            users: [], 
            sessions: [], 
            eventSessions: [],
            galleries: [],
            menus: [],
            plans: [],
            chatConversations: [],
            settings: {},
            tempUsers: [],
            passwordResets: []
        };
    }
};

const saveData = (data) => {
    try {
        const existingData = loadData();
        
        const completeData = {
            events: data.events || existingData.events || [],
            tables: data.tables || existingData.tables || [],
            guests: data.guests || existingData.guests || [],
            qrCodes: data.qrCodes || existingData.qrCodes || [],
            scans: data.scans || existingData.scans || [],
            users: data.users || existingData.users || [],
            sessions: data.sessions || existingData.sessions || [],
            eventSessions: data.eventSessions || existingData.eventSessions || [],
            galleries: data.galleries || existingData.galleries || [],
            menus: data.menus || existingData.menus || [],
            plans: data.plans || existingData.plans || [],
            chatConversations: data.chatConversations || existingData.chatConversations || [],
            tempUsers: data.tempUsers || existingData.tempUsers || [],
            passwordResets: data.passwordResets || existingData.passwordResets || [],
            settings: { ...existingData.settings, ...(data.settings || {}) },
            meta: {
                updatedAt: new Date().toISOString(),
                version: '3.0',
                server: 'SECURA-ULTRA-PRO-V3'
            }
        };
        
        fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(completeData, null, 2));
        log.db('Sauvegarde OK', `${completeData.events?.length || 0} événements, ${completeData.users?.length || 0} utilisateurs, ${completeData.galleries?.length || 0} galeries, ${completeData.tempUsers?.length || 0} inscriptions en cours`);
    } catch (err) {
        log.error('Erreur sauvegarde DB', err.message);
    }
};

// ═══════════════════════════════════════════════════════════════
// 🧹 FONCTION POUR NETTOYER LES DONNÉES TEMPORAIRES EXPIRÉES
// ═══════════════════════════════════════════════════════════════
const cleanupExpiredTempData = () => {
    try {
        const data = loadData();
        const now = new Date();
        let cleaned = false;
        
        if (data.tempUsers && data.tempUsers.length > 0) {
            const initialCount = data.tempUsers.length;
            data.tempUsers = data.tempUsers.filter(tempUser => {
                const expiresAt = new Date(tempUser.expiresAt);
                return expiresAt > now;
            });
            
            if (data.tempUsers.length !== initialCount) {
                cleaned = true;
                log.info(`Nettoyage tempUsers: ${initialCount - data.tempUsers.length} enregistrements expirés supprimés`);
            }
        }
        
        if (data.passwordResets && data.passwordResets.length > 0) {
            const initialCount = data.passwordResets.length;
            data.passwordResets = data.passwordResets.filter(reset => {
                const expiresAt = new Date(reset.expiresAt);
                return expiresAt > now;
            });
            
            if (data.passwordResets.length !== initialCount) {
                cleaned = true;
                log.info(`Nettoyage passwordResets: ${initialCount - data.passwordResets.length} codes expirés supprimés`);
            }
        }
        
        if (cleaned) {
            saveData(data);
        }
        
    } catch (err) {
        log.error('Erreur nettoyage données temporaires', err.message);
    }
};

cleanupExpiredTempData();
setInterval(cleanupExpiredTempData, 15 * 60 * 1000);

const generateId = (prefix = 'sec') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => /^[\d\s\+\-\(\)]{8,20}$/.test(phone);

const validateEvent = (event) => {
    const errors = [];
    log.info('Validation événement', event.name || 'Sans nom');
    
    if (!event.name || event.name.trim().length < 3) {
        errors.push('Nom requis (min 3 caractères)');
        log.validation('name', false, 'Trop court');
    } else {
        log.validation('name', true, event.name);
    }
    
    if (!event.date) {
        errors.push('Date requise');
        log.validation('date', false);
    } else {
        log.validation('date', true, event.date);
    }
    
    if (!event.location || event.location.trim().length < 3) {
        errors.push('Lieu requis');
        log.validation('location', false);
    } else {
        log.validation('location', true, event.location);
    }
    
    return { valid: errors.length === 0, errors };
};

const GUEST_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  CHECKED_IN: 'checked_in',
  NO_SHOW: 'no_show'
};

const validateGuest = (guest) => {
  const errors = [];

  // Nettoyage des champs
  guest.firstName = (guest.firstName || '').toString().trim();
  guest.lastName = (guest.lastName || '').toString().trim();
  guest.email = (guest.email || '').toString().trim().toLowerCase();
  guest.phone = (guest.phone || '').toString().trim();
  guest.company = (guest.company || '').toString().trim();
  guest.notes = (guest.notes || '').toString().trim();
  
  // Gestion des valeurs spéciales
  if (guest.email === '-' || guest.email.toLowerCase() === 'n/a') {
    guest.email = '';
  }

  // Validation des champs obligatoires
  if (!guest.firstName && !guest.lastName) {
    errors.push('Prénom ou nom requis');
    log.validation('name', false);
  } else {
    if (guest.firstName) log.validation('firstName', true, guest.firstName);
    if (guest.lastName) log.validation('lastName', true, guest.lastName);
  }

  // Validation email
  if (guest.email && !validateEmail(guest.email)) {
    errors.push('Email invalide');
    log.validation('email', false, guest.email);
  } else if (guest.email) {
    log.validation('email', true, guest.email);
  }

  // Validation téléphone
  if (guest.phone && !validatePhone(guest.phone)) {
    errors.push('Téléphone invalide');
    log.validation('phone', false, guest.phone);
  } else if (guest.phone) {
    log.validation('phone', true, guest.phone);
  }

  // Validation eventId obligatoire
  if (!guest.eventId) {
    errors.push('eventId requis');
    log.validation('eventId', false);
  } else {
    log.validation('eventId', true, guest.eventId);
  }

  // Validation des places (seats)
  if (guest.seats !== undefined) {
    const seats = parseInt(guest.seats);
    if (isNaN(seats) || seats < 1) {
      errors.push('Le nombre de places doit être un nombre positif');
      log.validation('seats', false, guest.seats);
    } else {
      log.validation('seats', true, seats);
    }
  }

  // Validation du statut
  if (guest.status && !Object.values(GUEST_STATUS).includes(guest.status)) {
    errors.push(`Statut invalide. Valeurs acceptées: ${Object.values(GUEST_STATUS).join(', ')}`);
    log.validation('status', false, guest.status);
  } else if (guest.status) {
    log.validation('status', true, guest.status);
  }

  // Validation du sexe/genre (optionnel)
  const validGenders = ['m', 'f', 'homme', 'femme', 'male', 'female', 'couple', 'maman', 'mother', 'autre'];
  if (guest.gender && !validGenders.includes(guest.gender.toLowerCase())) {
    // On log un warning mais on ne rejette pas (champ optionnel)
    log.validation('gender', true, guest.gender + ' (accepté comme optionnel)');
  } else if (guest.gender) {
    log.validation('gender', true, guest.gender);
  }

  return { valid: errors.length === 0, errors };
};
// Fonction pour initialiser un invité complet
const initializeGuest = (eventId, guestData) => {
  const now = new Date().toISOString();
  
  const cleanData = {
    eventId,
    firstName: (guestData.firstName || '').trim(),
    lastName: (guestData.lastName || '').trim(),
    email: (guestData.email || '').toLowerCase().trim(),
    phone: (guestData.phone || '').trim(),
    company: (guestData.company || '').trim(),
    gender: (guestData.gender || '').trim().toLowerCase() || null,
    notes: (guestData.notes || '').trim(),
    seats: parseInt(guestData.seats) || 1,
    status: guestData.status || GUEST_STATUS.PENDING,
    
    accessCode: guestData.accessCode || generateAccessCode(),
    
    tableId: guestData.tableId || null,
    tableNumber: guestData.tableNumber || null,
    assignedAt: guestData.assignedAt || null,
    
    scanned: guestData.scanned || false,
    scannedAt: guestData.scannedAt || null,
    scanCount: parseInt(guestData.scanCount) || 0,
    
    qrCodeId: guestData.qrCodeId || null,
    qrCodeData: guestData.qrCodeData || null,
    
    // Métadonnées
    metadata: {
      category: guestData.metadata?.category || 'standard',
      tableNumber: guestData.metadata?.tableNumber || null,
      specialRequirements: guestData.metadata?.specialRequirements || '',
      invitationSent: Boolean(guestData.metadata?.invitationSent) || false,
      confirmed: Boolean(guestData.metadata?.confirmed) || false,
      ...guestData.metadata
    },
    
    scanHistory: guestData.scanHistory || [],
    confirmationHistory: guestData.confirmationHistory || [],
    
    id: generateId('gst'),
    createdAt: now,
    updatedAt: now
  };
  
  return cleanData;
};

const updateGuestWithTableRelations = (guest, data) => {
  if (guest.tableId) {
    const table = (data.tables || []).find(t => t.id === guest.tableId);
    if (table) {
      guest.tableNumber = table.tableNumber;
    } else {
      guest.tableId = null;
      guest.tableNumber = null;
      guest.assignedAt = null;
    }
  }
  
  return guest;
};

const validateUser = (user, isUpdate = false) => {
    const errors = [];
    
    // Validation pour la création
    if (!isUpdate) {
        if (!user.email || !validateEmail(user.email)) {
            errors.push('Email invalide');
        }
        
        if (!user.password || user.password.length < 6) {
            errors.push('Mot de passe trop court (min 6 caractères)');
        }
    }
    
    // Validation générale
    if (user.firstName && user.firstName.length > 50) {
        errors.push('Prénom trop long (max 50 caractères)');
    }
    
    if (user.lastName && user.lastName.length > 50) {
        errors.push('Nom trop long (max 50 caractères)');
    }
    
    if (user.phone && !validatePhone(user.phone)) {
        errors.push('Téléphone invalide');
    }
    
    if (user.role && !['admin', 'user', 'agent'].includes(user.role)) {
        errors.push('Rôle invalide');
    }
    
    return { valid: errors.length === 0, errors };
};


const hashPassword = (password) => bcrypt.hashSync(password, 10);
const comparePassword = (password, hash) => bcrypt.compareSync(password, hash);

// Générer JWT
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// Middleware JWT - Authentification utilisateur standard
const jwtAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token requis' });
    
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        log.warning('Token invalide', req.ip);
        return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
    }
};

// Middleware pour authentification session d'événement OU utilisateur
const eventSessionAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            error: 'Token requis',
            code: 'MISSING_TOKEN'
        });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        // Essayer de décrypter comme un token JWT standard (user)
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        
        // Vérifier si c'est un token utilisateur ou token de session d'événement
        if (payload.sessionId) {
            // Token de session d'événement
            req.eventSession = {
                sessionId: payload.sessionId,
                guestId: payload.guestId,
                tableId: payload.tableId,
                eventId: payload.eventId,
                accessMethod: payload.accessMethod,
                isEventSession: true
            };
            req.user = null; // Pas d'utilisateur standard
        } else if (payload.role) {
            // Token utilisateur standard
            req.user = payload;
            req.eventSession = null;
        } else {
            throw new Error('Format de token invalide');
        }
        
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token expiré',
                code: 'TOKEN_EXPIRED'
            });
        }
        if (err.name === 'JsonWebTokenError' || err.message === 'Format de token invalide') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token invalide',
                code: 'INVALID_TOKEN'
            });
        }
        log.warning('Erreur authentification:', err.message, req.ip);
        return res.status(401).json({ 
            success: false, 
            error: 'Erreur authentification',
            code: 'AUTH_ERROR'
        });
    }
};

// Middleware pour vérifier que c'est un utilisateur authentifié (pas une session d'événement)
const requireUser = (req, res, next) => {
    if (!req.user) {
        return res.status(403).json({ 
            success: false, 
            error: 'Accès utilisateur requis',
            code: 'USER_REQUIRED'
        });
    }
    next();
};

// Middleware pour vérifier que c'est une session d'événement valide
const requireEventSession = (req, res, next) => {
    if (!req.eventSession) {
        return res.status(403).json({ 
            success: false, 
            error: 'Session d\'événement requise',
            code: 'EVENT_SESSION_REQUIRED'
        });
    }
    next();
};

// Helper pour obtenir l'ID utilisateur depuis la requête (user OR eventSession)
const getUserIdFromRequest = (req) => {
    return req.user?.id || req.eventSession?.guestId || null;
};

// Helper pour obtenir le nom de l'utilisateur depuis la requête
const getUserNameFromRequest = (req) => {
    return req.user?.name || `Guest ${req.eventSession?.guestId?.substring(0, 8)}` || 'Unknown';
};

// Helper pour obtenir l'ID d'événement depuis la requête
const getEventIdFromRequest = (req, query = {}) => {
    return req.eventSession?.eventId || query.eventId || null;
};

// 🔥 Helper pour enrichir les participants avec les infos utilisateur complètes
/**
 * 🎯 Construit un participant de chat COMPLET et unifié
 * Utilise les préfixes (gst_, usr_) pour déterrer le type
 * Fusionne les données user/guest avec les attributs chat
 * 
 * Schéma du participant retourné:
 * {
 *   userId: string (gst_ ou usr_),
 *   name: string (firstName + lastName),
 *   email: string,
 *   firstName: string,
 *   lastName: string,
 *   gender: string,
 *   notes: string,
 *   isOnline: boolean (statut en ligne en temps réel),
 *   status: string ('online' | 'offline'),
 *   joinedAt: ISO string | null (quand a rejoint la conversation),
 *   lastReadAt: ISO string | null (quand a lu en dernier),
 *   lastSeenAt: ISO string | null (dernière activité online)
 * }
 */
const buildChatParticipant = (userId, data) => {
    // Déterminer si c'est un guest ou user par le préfixe
    const isGuest = userId?.startsWith('gst_');
    
    // Chercher les infos dans guests ou users
    let userInfo;
    if (isGuest) {
        userInfo = data.guests?.find(g => g.id === userId);
    } else {
        userInfo = data.users?.find(u => u.id === userId);
    }
    
    // Si pas trouvé, utiliser défauts minimaux
    if (!userInfo) {
        return {
            userId: userId,
            name: 'Utilisateur',
            email: '',
            firstName: '',
            lastName: '',
            gender: '',
            notes: '',
            isOnline: false,
            status: 'offline',
            joinedAt: null,
            lastReadAt: null,
            lastSeenAt: null
        };
    }
    
    // Construire le participant enrichi avec les infos utilisateur
    return {
        userId: userId,
        // Infos de base (depuis guests ou users)
        name: userInfo.firstName && userInfo.lastName 
            ? `${userInfo.firstName} ${userInfo.lastName}` 
            : userInfo.name || 'Utilisateur',
        email: userInfo.email || '',
        firstName: userInfo.firstName || '',
        lastName: userInfo.lastName || '',
        gender: userInfo.gender || userInfo.sexe || '',
        notes: userInfo.notes || '',
        // Statut en ligne (vient de userInfo si disponible)
        isOnline: userInfo.isOnline || false,
        status: userInfo.status || 'offline',
        // Attributs de conversation (null au démarrage, mis à jour via enrichParticipants)
        joinedAt: null,
        lastReadAt: null,
        lastSeenAt: null
    };
};

/**
 * ✨ Enrichir les participants avec leurs infos complètes
 * Préserve les attributs de conversation du participant original:
 * - joinedAt, lastReadAt, lastSeenAt
 */
const enrichParticipantsWithUserInfo = (participants, data) => {
    return participants.map(participant => {
        const chatParticipant = buildChatParticipant(participant.userId, data);
        return {
            ...chatParticipant,
            // Préserver les attributs de conversation du participant original
            joinedAt: participant.joinedAt || null,
            lastReadAt: participant.lastReadAt || null,
            lastSeenAt: participant.lastSeenAt || null
        };
    });
};

const requireRole = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    next();
};


const generateAccessCode = () => {
  // Générer un code à 4 chiffres sans commencer par 0
  // Premier chiffre: 1-9, les autres: 0-9
  let code = '';
  
  // Premier chiffre: 1-9 (pas de zéro)
  code += (Math.floor(Math.random() * 9) + 1).toString();
  
  // Les 3 autres chiffres: 0-9
  for (let i = 0; i < 3; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  
  return code;
};

// Générer un code de table au format XX-YY (lettres-chiffres)
const generateTableAccessCode = (tableName) => {
    if (!tableName || tableName.length < 2) {
        return `TB-${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`;
    }
    
    // Extraire les initiales du nom (première lettre de chaque mot)
    const words = tableName
        .trim()
        .toUpperCase()
        .split(/\s+/)  // Diviser par les espaces
        .filter(word => word.length > 0);  // Supprimer les mots vides
    
    // Prendre les deux premières lettres de chaque mot (si possible) ou les deux premiers caractères
    let prefix = '';
    if (words.length >= 2) {
        // Prendre la première lettre de chaque mot jusqu'à 2 caractères
        prefix = (words[0].charAt(0) + words[1].charAt(0)).substring(0, 2);
    } else if (words.length === 1) {
        // Si un seul mot, prendre les deux premières lettres
        prefix = words[0].substring(0, 2).replace(/[^A-Z]/g, '');
    }
    
    // Fallback si aucune lettre
    prefix = prefix.padEnd(2, 'T');
    
    // Générer 2 chiffres aléatoires
    const digits = Math.floor(Math.random() * 99)
        .toString()
        .padStart(2, '0');
    
    return `${prefix}-${digits}`;
};

// ═══════════════════════════════════════════════════════════════
// 🔍 VÉRIFICATION TOKEN (BACKEND)
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/verify-token', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Token requis'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Token manquant'
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const data = loadData();
    const user = data.users?.find(u => u.id === payload.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: 'Utilisateur introuvable'
      });
    }

    log.info('Token vérifié', user.email);
    res.json({
      success: true,
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

  } catch (err) {
    log.warning('Token invalide ou expiré', req.ip);
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Token invalide ou expiré'
    });
  }
});


// ═══════════════════════════════════════════════════════════════
// 🔐 AUTHENTIFICATION - LOGIN / REGISTER
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/register', (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password || password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email et mot de passe (6+ chars) requis' 
            });
        }
        const data = loadData();

        if (data.users?.some(u => u.email === email.trim().toLowerCase())) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email déjà utilisé' 
            });
        }

        const accessCode = generateAccessCode();

        const user = {
            id: generateId('usr'),
            email: email.trim().toLowerCase(),
            password: hashPassword(password),
            firstName: firstName || '',
            lastName: lastName || '',
            role: data.users?.length === 0 ? 'admin' : 'user',
            accessCode,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.users.push(user);
        saveData(data);

        const token = generateToken(user);

        log.success('Utilisateur créé', `${email} | Code: ${accessCode}`);

        res.status(201).json({
            success: true,
            message: 'Inscription réussie. Utilisez le code d\'accès sur mobile.',
            token,
            user: { 
                id: user.id, 
                email: user.email, 
                role: user.role, 
                firstName: user.firstName, 
                lastName: user.lastName,
                accessCode // Retourné ici
            },
            accessCode
        });
    } catch (err) {
        log.error('POST /api/auth/register', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🔐 VÉRIFICATION CODE D'ACCÈS (MIS À JOUR)
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/verify-access-code', jwtAuth, (req, res) => {
    try {
        const { code } = req.body;
        if (!code || code.length !== 4 || !/^[A-Z0-9]{4}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Code à 4 caractères (chiffres/majuscules) requis'
            });
        }

        const data = loadData();
        const user = data.users?.find(u => u.id === req.user.id);

        if (!user) {
            log.warning('Utilisateur introuvable lors de la vérification', req.user.id);
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }

        if (user.accessCode !== code) {
            log.warning('Code d\'accès incorrect', `${user.email} - Code fourni: ${code}`);
            return res.status(400).json({
                success: false,
                message: 'Code d\'accès incorrect'
            });
        }

       

        user.updatedAt = new Date().toISOString();
        
        saveData(data);

        log.success('Code d\'accès validé', `${user.email} (${code})`);

        res.json({
            success: true,
            message: 'Accès activé avec succès',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });
    } catch (err) {
        log.error('POST /api/auth/verify-access-code', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({
                success: false,
                message: 'E-mail et mot de passe sont requis.',
                code: 'MISSING_FIELDS'
            });
        }

        const data = loadData();
        const user = data.users?.find(u => u.email === email.trim().toLowerCase());

        if (!user) {
            log.warning('Tentative login - utilisateur inconnu', email);
            return res.status(404).json({
                success: false,
                message: 'E-mail ou mot de passe incorrect.',
                code: 'INVALID_CREDENTIALS'
            });
        }

        if (!comparePassword(password, user.password)) {
            log.warning('Mot de passe incorrect', email);
            return res.json({
                success: false,
                message: 'E-mail ou mot de passe incorrect.',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const token = generateToken(user);
        log.success('Connexion réussie', `${email} (${user.role})`);

        res.json({
            success: true,
            message: 'Connexion réussie !',
            code: 'LOGIN_SUCCESS',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });

    } catch (err) {
        log.error('POST /api/auth/login', err.message);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur.',
            code: 'SERVER_ERROR'
        });
    }
});


// ═══════════════════════════════════════════════════════════════
// 🔓 DÉCONNEXION - LOGOUT
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/logout', jwtAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const data = loadData();

        if (data.sessions && Array.isArray(data.sessions)) {
            data.sessions = data.sessions.map(session => {
                session.agents = session.agents.filter(agent => agent.id !== userId);
                return session;
            }).filter(session => session.agents.length > 0);
        }

        saveData(data);

        const user = data.users?.find(u => u.id === userId);
        log.success('🔓 Déconnexion réussie', user?.email || userId);

        res.json({
            success: true,
            message: 'Déconnexion réussie',
            timestamp: new Date().toISOString(),
            data: {
                userId: userId,
                email: user?.email,
                loggedOutAt: new Date().toISOString()
            }
        });

    } catch (err) {
        log.error('POST /api/auth/logout', err.message);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});


app.get('/api/auth/me', jwtAuth, (req, res) => {
    const data = loadData();
    const user = data.users?.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

    res.status(200).json({
        success: true,
        user: { 
            id: user.id, 
            email: user.email, 
            role: user.role, 
            firstName: user.firstName, 
            lastName: user.lastName,
            accessCode: user.accessCode
        }
    });
});

// Régénérer un code d'accès (admin ou utilisateur)
app.post('/api/auth/regenerate-access-code', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const user = data.users?.find(u => u.id === req.user.id);
        if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

        const newCode = generateAccessCode();
        user.accessCode = newCode;
        user.updatedAt = new Date().toISOString();
        saveData(data);

        log.success('Code régénéré', `${user.email} → ${newCode}`);

        res.json({
            success: true,
            message: 'Nouveau code généré',
            accessCode: newCode
        });
    } catch (err) {
        log.error('POST /api/auth/regenerate-access-code', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});





// Étape 1: Vérification email et création temporaire
app.post('/api/auth/register-step1', (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email et mot de passe requis'
            });
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }
        
        const data = loadData();
        
        // Après la vérification de l'email existant dans users
        if (data.users?.some(u => u.email === email.toLowerCase().trim())) {
            return res.status(400).json({
                success: false,
                message: 'Cet email est déjà utilisé'
            });
        }

        const existingTempUser = data.tempUsers?.find(u => u.email === email.toLowerCase().trim());

        let verificationCode;
        let tempUser;

        if (existingTempUser) {
            // Réutiliser le même tempUser mais regénérer le code et la date d'expiration
            verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            existingTempUser.verificationCode = verificationCode;
            existingTempUser.createdAt = new Date().toISOString();
            existingTempUser.expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            
            tempUser = existingTempUser;
            
            log.info(`Code REGÉNÉRÉ pour ${email}: ${verificationCode}`);
        } else {
            // Créer un nouveau tempUser
            verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            tempUser = {
                email: email.toLowerCase().trim(),
                password: hashPassword(password),
                verificationCode,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            };
            
            if (!data.tempUsers) data.tempUsers = [];
            data.tempUsers.push(tempUser);
            
            log.info(`Code CRÉÉ pour ${email}: ${verificationCode}`);
        }
        saveData(data);
        
        log.info(`Code de vérification pour ${email}: ${verificationCode}`);
        
        // Générer un token temporaire
        const tempToken = jwt.sign(
            { email: tempUser.email, type: 'temp' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        
        res.json({
            success: true,
            message: 'Code de vérification envoyé',
            token: tempToken
        });
        
    } catch (err) {
        log.error('POST /api/auth/register-step1', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Étape 2: Vérification du code
app.post('/api/auth/register-step2', (req, res) => {
    try {
        const { verificationCode, token } = req.body;
        
        if (!verificationCode || !token) {
            return res.status(400).json({
                success: false,
                message: 'Code et token requis'
            });
        }
        
        // Vérifier le token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Token invalide ou expirés'
            });
        }
        
        if (decoded.type !== 'temp') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide'
            });
        }
        
        const data = loadData();
        const tempUser = data.tempUsers?.find(u => u.email === decoded.email);
        
        if (!tempUser) {
            return res.status(404).json({
                success: false,
                message: 'Enregistrement temporaire introuvable'
            });
        }
        
        // Vérifier l'expiration
        if (new Date(tempUser.expiresAt) < new Date()) {
            // Nettoyer les enregistrements expirés
            data.tempUsers = data.tempUsers.filter(u => u.email !== decoded.email);
            saveData(data);
            
            return res.status(400).json({
                success: false,
                message: 'Le code a expiré'
            });
        }
        
        if (tempUser.verificationCode !== verificationCode) {
            return res.status(400).json({
                success: false,
                message: 'Code de vérification incorrect'
            });
        }
        
        // Marquer comme vérifié
        tempUser.verified = true;
        tempUser.verifiedAt = new Date().toISOString();
        saveData(data);
        
        // Générer un nouveau token pour l'étape 3
        const step3Token = jwt.sign(
            { 
                email: tempUser.email, 
                type: 'step3',
                tempId: tempUser.id || tempUser.email 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30m' }
        );
        
        res.json({
            success: true,
            message: 'Code vérifié avec succès',
            token: step3Token
        });
        
    } catch (err) {
        log.error('POST /api/auth/register-step2', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Étape 3: Compléter le profil
app.post('/api/auth/register-step3', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token requis'
            });
        }
        
        const token = authHeader.split(' ')[1];
        let decoded;
        
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Token invalide ou expiré'
            });
        }
        
        if (decoded.type !== 'step3') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide'. decoded.type
            });
        }
        
        const data = loadData();
        const tempUser = data.tempUsers?.find(u => u.email === decoded.email);
        
        if (!tempUser || !tempUser.verified) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur temporaire non vérifié'
            });
        }
        
        // Créer l'utilisateur final
        const user = {
            id: generateId('usr'),
            email: tempUser.email,
            password: tempUser.password,
            firstName: req.body.firstName || '',
            lastName: req.body.lastName || '',
            phone: req.body.phone || '',
            company: req.body.company || '',
            address: req.body.address || '',
            bio: req.body.bio || '',
            role: data.users?.length === 0 ? 'admin' : 'user',
            accessCode: generateAccessCode(),
            emailVerified: true,
            isActive: true,
            preferences: {
                notifications: true,
                language: 'fr',
                theme: 'dark',
                emailNotifications: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Ajouter à la base de données
        data.users.push(user);
        
        // Supprimer l'enregistrement temporaire
        data.tempUsers = data.tempUsers.filter(u => u.email !== decoded.email);
        saveData(data);
        
        // Générer le token final
        const finalToken = generateToken(user);
        
        // Ne pas renvoyer le mot de passe
        const { password, ...userWithoutPassword } = user;
        
        log.success('Inscription complétée', user.email);
        
        res.json({
            success: true,
            message: 'Inscription terminée avec succès',
            token: finalToken,
            user: userWithoutPassword
        });
        
    } catch (err) {
        log.error('POST /api/auth/register-step3', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Supprimer les données temporaires
app.post('/api/auth/cancel-registration', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token requis'
            });
        }
        
        // Vérifier le token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.json({
                success: true,
                message: 'Session déjà expirée'
            });
        }
        
        const data = loadData();
        
        // Supprimer l'utilisateur temporaire
        if (data.tempUsers) {
            data.tempUsers = data.tempUsers.filter(u => u.email !== decoded.email);
            saveData(data);
        }
        
        log.info('Inscription annulée', decoded.email);
        
        res.json({
            success: true,
            message: 'Inscription annulée'
        });
        
    } catch (err) {
        log.error('POST /api/auth/cancel-registration', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// Demande de réinitialisation
app.post('/api/auth/forgot-password', (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis'
            });
        }
        
        const data = loadData();
        const user = data.users?.find(u => u.email === email.toLowerCase().trim());
        
        if (!user) {
            log.warning('Demande mot de passe - Email introuvable', email);
            return res.status(404).json({
                success: false,
                message: 'Ce compte n\'existe pas'
            });
        }

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Sauvegarder le code temporairement
        if (!data.passwordResets) data.passwordResets = [];
        
        // Supprimer les anciennes entrées pour cet email
        data.passwordResets = data.passwordResets.filter(r => r.email !== email);
        
        data.passwordResets.push({
            email: email.toLowerCase().trim(),
            code: resetCode,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        });
        
        saveData(data);
        
        log.info(`Code de réinitialisation pour ${email}: ${resetCode}`);
        
        res.json({
            success: true,
            message: 'Si l\'email existe, un code a été envoyé'
        });
        
    } catch (err) {
        log.error('POST /api/auth/forgot-password', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Vérification du code de réinitialisation
app.post('/api/auth/verify-reset-code', (req, res) => {
    try {
        const { email, code } = req.body;
        
        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: 'Email et code requis'
            });
        }
        
        const data = loadData();
        
        // Nettoyer les codes expirés
        const now = new Date();
        data.passwordResets = data.passwordResets?.filter(r => new Date(r.expiresAt) > now) || [];
        
        const resetRecord = data.passwordResets?.find(r => 
            r.email === email.toLowerCase().trim() && r.code === code
        );
        
        if (!resetRecord) {
            return res.status(400).json({
                success: false,
                message: 'Code invalide ou expiré'
            });
        }
        
        // Générer un token pour la réinitialisation
        const resetToken = jwt.sign(
            { 
                email: resetRecord.email, 
                code: resetRecord.code,
                type: 'password_reset' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        
        res.json({
            success: true,
            message: 'Code vérifié avec succès',
            token: resetToken
        });
        
    } catch (err) {
        log.error('POST /api/auth/verify-reset-code', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Réinitialisation du mot de passe
app.post('/api/auth/reset-password', (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        
        if (!email || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis'
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }
        
        const data = loadData();
        
        // Nettoyer les codes expirés
        const now = new Date();
        data.passwordResets = data.passwordResets?.filter(r => new Date(r.expiresAt) > now) || [];
        
        const resetRecord = data.passwordResets?.find(r => 
            r.email === email.toLowerCase().trim() && r.code === code
        );
        
        if (!resetRecord) {
            return res.status(400).json({
                success: false,
                message: 'Code invalide ou expiré'
            });
        }
        
        // Trouver l'utilisateur
        const user = data.users?.find(u => u.email === email.toLowerCase().trim());
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }
        
        // Mettre à jour le mot de passe
        user.password = hashPassword(newPassword);
        user.updatedAt = new Date().toISOString();
        
        // Supprimer le code de réinitialisation
        data.passwordResets = data.passwordResets.filter(r => r.email !== email);
        
        saveData(data);
        
        log.success('Mot de passe réinitialisé', email);
        
        res.json({
            success: true,
            message: 'Mot de passe réinitialisé avec succès'
        });
        
    } catch (err) {
        log.error('POST /api/auth/reset-password', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.post('/api/auth/verify-temp-token', (req, res) => {
    try {
        const { token } = req.body;

    if (!token) {
      return res.json({
        success: false,
        valid: false,
        error: 'Token manquant'
      });
    }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const data = loadData();
        const tempUser = data.tempUsers?.find(u => u.email === decoded.email);
        
        if (!tempUser || new Date(tempUser.expiresAt) < new Date()) {
            return res.json({ valid: false , message: 'Token temporaire vérifié' });
        }
        


 log.info('Token temporaire vérifié');
    res.json({
      valid: true,
      message: 'Token temporaire vérifié',
    });

  } catch (err) {
    log.warning('Token invalide ou expiré', req.ip);
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Token invalide ou expiré'
    });
}
});
  

// Routes supplémentaires pour le profil
app.put('/api/auth/update-profile', jwtAuth, (req, res) => {
    try {
        const { firstName, lastName, phone, secondaryEmail } = req.body;
        const data = loadData();
        const user = data.users.find(u => u.id === req.user.id);
        
        if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
        
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phone !== undefined) user.phone = phone;
        if (secondaryEmail !== undefined) user.secondaryEmail = secondaryEmail;
        
        user.updatedAt = new Date().toISOString();
        saveData(data);
        
        res.json({
            success: true,
            message: 'Profil mis à jour',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                secondaryEmail: user.secondaryEmail
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/auth/verify-password', jwtAuth, (req, res) => {
    try {
        const { password } = req.body;
        const data = loadData();
        const user = data.users.find(u => u.id === req.user.id);
        
        if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
        
        const isValid = comparePassword(password, user.password);
        res.json({ success: isValid });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/auth/change-password', jwtAuth, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const data = loadData();
        const user = data.users.find(u => u.id === req.user.id);
        
        if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
        
        if (!comparePassword(currentPassword, user.password)) {
            return res.status(400).json({ success: false, error: 'Mot de passe actuel incorrect' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit avoir au moins 6 caractères' });
        }
        
        user.password = hashPassword(newPassword);
        user.updatedAt = new Date().toISOString();
        saveData(data);
        
        res.json({ success: true, message: 'Mot de passe mis à jour' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/auth/statistics', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const userId = req.user.id;
        
        // Calcul des statistiques
        const userEvents = data.events?.filter(e => e.createdBy === userId).length || 0;
        const userGuests = data.guests?.filter(g => g.createdBy === userId).length || 0;
        const userScans = data.scans?.filter(s => s.scannedBy === userId).length || 0;
        
        res.json({
            success: true,
            data: {
                eventsCreated: userEvents,
                guestsManaged: userGuests,
                scansPerformed: userScans,
                totalStorage: '10 GB',
                storageUsed: '2.5 GB',
                storagePercent: 25,
                accountAge: Math.floor((Date.now() - new Date(data.users.find(u => u.id === userId)?.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/auth/export-data', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const userId = req.user.id;
        
        const userData = {
            user: data.users?.find(u => u.id === userId),
            events: data.events?.filter(e => e.createdBy === userId),
            guests: data.guests?.filter(g => g.createdBy === userId),
            scans: data.scans?.filter(s => s.scannedBy === userId),
            qrCodes: data.qrCodes?.filter(q => q.createdBy === userId),
            exportedAt: new Date().toISOString()
        };
        
        res.json({ success: true, data: userData });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});







// 📋 GET ALL USERS
app.get('/api/users', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const { limit, offset, search, role } = req.query;
        
        let users = data.users || [];
        
        // Filtre par rôle
        if (role) {
            users = users.filter(u => u.role === role);
        }
        
        // Recherche
        if (search) {
            const term = search.toLowerCase();
            users = users.filter(u =>
                u.email?.toLowerCase().includes(term) ||
                u.firstName?.toLowerCase().includes(term) ||
                u.lastName?.toLowerCase().includes(term)
            );
        }
        
        // Ne pas renvoyer les mots de passe
        users = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
        
        const total = users.length;
        
        // Pagination
        if (limit) {
            const l = parseInt(limit);
            const o = parseInt(offset) || 0;
            users = users.slice(o, o + l);
        }
        
        log.crud('READ', 'users', { count: users.length });
        res.json({ success: true, data: users, total });
    } catch (err) {
        log.error('GET /api/users', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 👤 GET USER BY ID - INFOS PUBLIQUES (pour créateurs de photos, sans auth restrictive)
// Endpoint public - cherche dans users ET guests
app.get('/api/users-public/:id', (req, res) => {
    try {
        const data = loadData();
        const userId = req.params.id;
        let user = null;
        
        // Chercher d'abord dans les users
        user = data.users?.find(u => u.id === userId);
        
        // Si pas trouvé et c'est un ID de guest (gst_...), chercher dans les guests
        if (!user && userId?.startsWith('gst_')) {
            user = data.guests?.find(g => g.id === userId);
        }
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        // Retourner UNIQUEMENT les infos publiques
        const publicInfo = {
            id: user.id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            gender: user.gender || '',
            company: user.company || '',
            type: user.type || (userId.startsWith('gst_') ? 'guest' : 'user')
        };
        
        log.crud('READ', 'user-public', { id: user.id, email: user.email });
        res.json({ success: true, data: publicInfo });
    } catch (err) {
        log.error('GET /api/users-public/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 👤 GET USER BY ID - INFOS COMPLETES (accès authentifié uniquement)
app.get('/api/users/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const userId = req.params.id;
        let user = data.users?.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        // Vérifier les permissions
        const isAdmin = req.user?.role === 'admin';
        const isSelf = req.user.id === userId;
        
        if (!isAdmin && !isSelf) {
            return res.status(403).json({ 
                success: false, 
                error: 'Accès non autorisé' 
            });
        }
        
        // Ne pas renvoyer le mot de passe
        const { password, ...userWithoutPassword } = user;
        
        log.crud('READ', 'user', { id: user.id, email: user.email });
        res.json({ success: true, data: userWithoutPassword });
    } catch (err) {
        log.error('GET /api/users/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// 🔄 UPDATE USER
app.put('/api/users/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const index = data.users?.findIndex(u => u.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        const user = data.users[index];
        
        // Vérifier les permissions
        if (req.user.role !== 'admin' && req.user.id !== user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Accès non autorisé' 
            });
        }
        
        const updates = req.body;
        const now = new Date().toISOString();
        
        // Champs autorisés à mettre à jour
        const allowedUpdates = [
            'firstName', 'lastName', 'phone', 'company', 
            'address', 'bio', 'avatar', 'preferences'
        ];
        
        // Si admin, autoriser plus de champs
        if (req.user.role === 'admin') {
            allowedUpdates.push('role', 'isActive', 'emailVerified');
        }
        
        // Filtrer les mises à jour autorisées
        const filteredUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });
        
        // Mettre à jour l'utilisateur
        data.users[index] = {
            ...user,
            ...filteredUpdates,
            updatedAt: now
        };
        
        saveData(data);
        
        log.crud('UPDATE', 'user', { id: user.id, email: user.email });
        log.success('Utilisateur mis à jour', user.email);
        
        // Ne pas renvoyer le mot de passe
        const { password, ...userWithoutPassword } = data.users[index];
        
        res.json({ 
            success: true, 
            data: userWithoutPassword,
            message: 'Utilisateur mis à jour avec succès'
        });
    } catch (err) {
        log.error('PUT /api/users/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔧 PATCH USER
app.patch('/api/users/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const index = data.users?.findIndex(u => u.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        const user = data.users[index];
        
        // Vérifier les permissions
        if (req.user.role !== 'admin' && req.user.id !== user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Accès non autorisé' 
            });
        }
        
        const updates = req.body;
        const now = new Date().toISOString();
        
        // Mise à jour sécurisée (ne permet pas de changer l'email ou le mot de passe)
        const safeUpdates = {};
        const safeFields = ['firstName', 'lastName', 'phone', 'company', 'address', 'bio', 'avatar', 'preferences'];
        
        if (req.user.role === 'admin') {
            safeFields.push('role', 'isActive', 'emailVerified');
        }
        
        Object.keys(updates).forEach(key => {
            if (safeFields.includes(key)) {
                safeUpdates[key] = updates[key];
            }
        });
        
        data.users[index] = {
            ...user,
            ...safeUpdates,
            updatedAt: now
        };
        
        saveData(data);
        
        log.crud('PATCH', 'user', { id: user.id, fields: Object.keys(safeUpdates) });
        
        const { password, ...userWithoutPassword } = data.users[index];
        
        res.json({ 
            success: true, 
            data: userWithoutPassword,
            message: 'Profil mis à jour'
        });
    } catch (err) {
        log.error('PATCH /api/users/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🗑️ DELETE USER (Admin only)
app.delete('/api/users/:id', jwtAuth, requireRole('admin'), (req, res) => {
    try {
        const data = loadData();
        const user = data.users?.find(u => u.id === req.params.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        // Empêcher l'admin de se supprimer lui-même
        if (user.id === req.user.id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Vous ne pouvez pas supprimer votre propre compte' 
            });
        }
        
        // Supprimer l'utilisateur
        data.users = data.users.filter(u => u.id !== req.params.id);
        
        // Nettoyer les sessions de l'utilisateur
        if (data.sessions) {
            data.sessions = data.sessions.map(session => {
                session.agents = session.agents.filter(agent => agent.id !== req.params.id);
                return session;
            }).filter(session => session.agents.length > 0);
        }
        
        saveData(data);
        
        log.crud('DELETE', 'user', { id: user.id, email: user.email });
        log.warning('Utilisateur supprimé', user.email);
        
        res.json({ 
            success: true, 
            message: 'Utilisateur supprimé avec succès',
            deletedUser: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        log.error('DELETE /api/users/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// 👑 CHANGE USER ROLE
app.patch('/api/users/:id/role', jwtAuth, requireRole('admin'), (req, res) => {
    try {
        const { role } = req.body;
        
        if (!role || !['admin', 'user', 'agent'].includes(role)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Rôle invalide. Choisissez entre: admin, user, agent' 
            });
        }
        
        const data = loadData();
        const index = data.users?.findIndex(u => u.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        const user = data.users[index];
        
        // Empêcher de changer son propre rôle
        if (user.id === req.user.id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Vous ne pouvez pas changer votre propre rôle' 
            });
        }
        
        const oldRole = user.role;
        user.role = role;
        user.updatedAt = new Date().toISOString();
        
        saveData(data);
        
        log.crud('UPDATE ROLE', 'user', { 
            id: user.id, 
            email: user.email, 
            from: oldRole, 
            to: role 
        });
        
        log.success('Rôle utilisateur changé', `${user.email}: ${oldRole} → ${role}`);
        
        const { password, ...userWithoutPassword } = user;
        
        res.json({ 
            success: true, 
            data: userWithoutPassword,
            message: `Rôle changé de ${oldRole} à ${role}`
        });
    } catch (err) {
        log.error('PATCH /api/users/:id/role', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// 🔘 TOGGLE USER ACTIVE STATUS
app.patch('/api/users/:id/active', jwtAuth, requireRole('admin'), (req, res) => {
    try {
        const { active } = req.body;
        
        if (typeof active !== 'boolean') {
            return res.status(400).json({ 
                success: false, 
                error: 'Le champ "active" doit être un booléen' 
            });
        }
        
        const data = loadData();
        const index = data.users?.findIndex(u => u.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        const user = data.users[index];
        
        // Empêcher de désactiver son propre compte
        if (user.id === req.user.id && !active) {
            return res.status(400).json({ 
                success: false, 
                error: 'Vous ne pouvez pas désactiver votre propre compte' 
            });
        }
        
        const oldStatus = user.isActive;
        user.isActive = active;
        user.updatedAt = new Date().toISOString();
        
        saveData(data);
        
        log.crud('TOGGLE ACTIVE', 'user', { 
            id: user.id, 
            email: user.email, 
            from: oldStatus, 
            to: active 
        });
        
        const statusText = active ? 'activé' : 'désactivé';
        log.success('Statut utilisateur changé', `${user.email}: ${statusText}`);
        
        const { password, ...userWithoutPassword } = user;
        
        res.json({ 
            success: true, 
            data: userWithoutPassword,
            message: `Utilisateur ${statusText} avec succès`
        });
    } catch (err) {
        log.error('PATCH /api/users/:id/active', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔑 REGENERATE ACCESS CODE
app.post('/api/users/:id/regenerate-access-code', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const user = data.users?.find(u => u.id === req.params.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        // Vérifier les permissions
        if (req.user.role !== 'admin' && req.user.id !== user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Accès non autorisé' 
            });
        }
        
        const newCode = generateAccessCode();
        user.accessCode = newCode;
        user.updatedAt = new Date().toISOString();
        
        saveData(data);
        
        log.crud('REGENERATE CODE', 'user', { id: user.id, email: user.email });
        log.success('Code régénéré', `${user.email}: ${newCode}`);
        
        res.json({
            success: true,
            message: 'Nouveau code généré',
            accessCode: newCode
        });
    } catch (err) {
        log.error('POST /api/users/:id/regenerate-access-code', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// 📊 USER STATISTICS
app.get('/api/users/:id/statistics', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const user = data.users?.find(u => u.id === req.params.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        // Vérifier les permissions
        if (req.user.role !== 'admin' && req.user.id !== user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Accès non autorisé' 
            });
        }
        
        // Calculer les statistiques
        const eventsCreated = data.events?.filter(e => e.createdBy === user.id).length || 0;
        const guestsManaged = data.guests?.filter(g => g.createdBy === user.id).length || 0;
        const scansPerformed = data.scans?.filter(s => s.scannedBy === user.id).length || 0;
        
        const statistics = {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            },
            activities: {
                eventsCreated,
                guestsManaged,
                scansPerformed,
                sessionsParticipated: data.sessions?.filter(s => 
                    s.agents?.some(a => a.id === user.id)
                ).length || 0
            },
            recentActivity: {
                lastLogin: user.lastLogin || null,
                lastEvent: data.events
                    ?.filter(e => e.createdBy === user.id)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
                    ?.createdAt || null,
                lastScan: data.scans
                    ?.filter(s => s.scannedBy === user.id)
                    .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))[0]
                    ?.scannedAt || null
            },
            performance: {
                scanRate: guestsManaged > 0 ? 
                    Math.round((scansPerformed / guestsManaged) * 100) : 0,
                activityLevel: eventsCreated + guestsManaged + scansPerformed
            }
        };
        
        res.json({ success: true, data: statistics });
    } catch (err) {
        log.error('GET /api/users/:id/statistics', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// 🔍 SEARCH USERS
app.get('/api/users/search', jwtAuth, requireRole('admin'), (req, res) => {
    try {
        const { q, role, isActive, limit = 20 } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({ 
                success: false, 
                error: 'Requête de recherche trop courte (min 2 caractères)' 
            });
        }
        
        const data = loadData();
        const term = q.toLowerCase();
        
        let users = data.users || [];
        
        // Filtre par rôle
        if (role) {
            users = users.filter(u => u.role === role);
        }
        
        // Filtre par statut actif
        if (isActive !== undefined) {
            users = users.filter(u => u.isActive === (isActive === 'true'));
        }
        
        // Recherche
        users = users.filter(u =>
            u.email?.toLowerCase().includes(term) ||
            u.firstName?.toLowerCase().includes(term) ||
            u.lastName?.toLowerCase().includes(term) ||
            `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(term)
        );
        
        // Limiter les résultats
        users = users.slice(0, parseInt(limit));
        
        // Ne pas renvoyer les mots de passe
        users = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
        
        log.info('Recherche utilisateurs', `"${q}" → ${users.length} résultats`);
        
        res.json({ 
            success: true, 
            data: users, 
            count: users.length 
        });
    } catch (err) {
        log.error('GET /api/users/search', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🚀 JOIN SESSION - Agent rejoint une session (crée si n'existe pas)
// ═══════════════════════════════════════════════════════════════
app.post('/api/sessions/:eventId/join', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;
        const data = loadData();

        // Vérifier que l'événement existe
        const event = data.events?.find(e => e.id === eventId);
        if (!event) {
            log.warning('Session join - Événement introuvable', eventId);
            return res.status(404).json({ 
                success: false, 
                error: 'Événement introuvable' 
            });
        }

        // Récupérer l'utilisateur
        const user = data.users?.find(u => u.id === userId);
        if (!user) {
            log.warning('Session join - Utilisateur introuvable', userId);
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }

        // Initialiser sessions si nécessaire
        if (!data.sessions) data.sessions = [];

        // Chercher ou créer la session
        let session = data.sessions.find(s => s.eventId === eventId);
        const now = new Date().toISOString();
        
        if (!session) {
            // Créer nouvelle session
            session = {
                id: generateId('sess'),
                eventId,
                eventName: event.name,
                agents: [],
                createdAt: now,
                updatedAt: now
            };
            data.sessions.push(session);
            log.success('🆕 Session créée', `Event: ${event.name}`);
        }

        // Nettoyer les agents inactifs (pas de ping depuis 45s)
        const nowMs = Date.now();
        session.agents = session.agents.filter(agent => {
            const lastPing = new Date(agent.lastPing).getTime();
            return (nowMs - lastPing) < 45000;
        });

        // Vérifier si l'agent est déjà dans la session
        const existingAgent = session.agents.find(a => a.id === userId);

        if (existingAgent) {
            // Mettre à jour le ping
            existingAgent.lastPing = now;
            existingAgent.status = 'active';
            log.info('Agent déjà présent, ping mis à jour', user.email);
        } else {
            // Ajouter le nouvel agent
            const agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            session.agents.push({
                id: userId,
                name: agentName || user.email.split('@')[0],
                email: user.email,
                firstName: user.firstName || null,
                lastName: user.lastName || null,
                avatar: user.avatar || null,
                joinedAt: now,
                lastPing: now,
                status: 'active'
            });
            log.success('✅ Agent rejoint session', `${user.email} → ${event.name} (${session.agents.length} agents)`);
        }

        session.updatedAt = now;
        saveData(data);

        res.json({
            success: true,
            message: 'Session rejointe',
            data: {
                session,
                currentAgent: session.agents.find(a => a.id === userId)
            }
        });
    } catch (err) {
        log.error('POST /api/sessions/:eventId/join', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 💓 PING SESSION - Heartbeat pour maintenir la connexion
// ═══════════════════════════════════════════════════════════════
app.post('/api/sessions/:eventId/ping', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;
        const data = loadData();

        if (!data.sessions) data.sessions = [];

        const session = data.sessions.find(s => s.eventId === eventId);
        if (!session) {
            return res.status(404).json({ 
                success: false, 
                error: 'Session introuvable',
                shouldRejoin: true
            });
        }

        // Nettoyer les agents inactifs
        const nowMs = Date.now();
        session.agents = session.agents.filter(agent => {
            const lastPing = new Date(agent.lastPing).getTime();
            return (nowMs - lastPing) < 45000;
        });

        // Trouver et mettre à jour l'agent
        const agent = session.agents.find(a => a.id === userId);
        if (!agent) {
            return res.status(404).json({ 
                success: false, 
                error: 'Agent non trouvé dans la session',
                shouldRejoin: true
            });
        }

        const now = new Date().toISOString();
        agent.lastPing = now;
        agent.status = 'active';
        session.updatedAt = now;

        // Si la session est vide après nettoyage, la supprimer
        if (session.agents.length === 0) {
            const sessionIndex = data.sessions.findIndex(s => s.eventId === eventId);
            if (sessionIndex !== -1) {
                data.sessions.splice(sessionIndex, 1);
                log.info('🗑️ Session vide supprimée', eventId);
            }
            saveData(data);
            return res.json({
                success: true,
                data: { agents: [], agentCount: 0, sessionDeleted: true }
            });
        }

        saveData(data);

        res.json({
            success: true,
            data: {
                agents: session.agents,
                agentCount: session.agents.length,
                updatedAt: session.updatedAt
            }
        });
    } catch (err) {
        log.error('POST /api/sessions/:eventId/ping', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🚪 LEAVE SESSION - Agent quitte une session
// ═══════════════════════════════════════════════════════════════
app.post('/api/sessions/:eventId/leave', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;
        const data = loadData();

        if (!data.sessions) {
            return res.json({ success: true, message: 'Aucune session active' });
        }

        const sessionIndex = data.sessions.findIndex(s => s.eventId === eventId);
        if (sessionIndex === -1) {
            return res.json({ success: true, message: 'Session déjà terminée' });
        }

        const session = data.sessions[sessionIndex];
        const agentIndex = session.agents.findIndex(a => a.id === userId);
        let removedAgent = null;

        if (agentIndex !== -1) {
            removedAgent = session.agents.splice(agentIndex, 1)[0];
            log.info('🚪 Agent quitte session', `${removedAgent.email} ← ${session.eventName}`);
        }

        // Si plus d'agents, supprimer la session
        if (session.agents.length === 0) {
            data.sessions.splice(sessionIndex, 1);
            log.success('🗑️ Session supprimée (dernier agent parti)', session.eventName);
            saveData(data);
            return res.json({
                success: true,
                message: 'Session terminée (vous étiez le dernier)',
                data: { 
                    removedAgent, 
                    sessionDeleted: true,
                    remainingAgents: 0
                }
            });
        }

        session.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({
            success: true,
            message: 'Session quittée',
            data: {
                removedAgent,
                sessionDeleted: false,
                remainingAgents: session.agents.length
            }
        });
    } catch (err) {
        log.error('POST /api/sessions/:eventId/leave', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 📊 GET SESSION AGENTS - Liste des agents d'une session
// ═══════════════════════════════════════════════════════════════
app.get('/api/sessions/:eventId/agents', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const data = loadData();

        if (!data.sessions) {
            return res.json({ 
                success: true, 
                data: { agents: [], count: 0 } 
            });
        }

        const session = data.sessions.find(s => s.eventId === eventId);
        if (!session) {
            return res.json({ 
                success: true, 
                data: { agents: [], count: 0 } 
            });
        }

        // Nettoyer les agents inactifs
        const nowMs = Date.now();
        const activeAgents = session.agents.filter(agent => {
            const lastPing = new Date(agent.lastPing).getTime();
            return (nowMs - lastPing) < 45000;
        });

        // Mettre à jour si des agents ont été nettoyés
        if (activeAgents.length !== session.agents.length) {
            session.agents = activeAgents;
            session.updatedAt = new Date().toISOString();
            
            // Supprimer la session si vide
            if (activeAgents.length === 0) {
                const sessionIndex = data.sessions.findIndex(s => s.eventId === eventId);
                if (sessionIndex !== -1) {
                    data.sessions.splice(sessionIndex, 1);
                }
            }
            saveData(data);
        }

        res.json({
            success: true,
            data: {
                agents: activeAgents,
                count: activeAgents.length,
                sessionId: session.id,
                eventName: session.eventName
            }
        });
    } catch (err) {
        log.error('GET /api/sessions/:eventId/agents', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🔍 GET SESSION BY EVENT - Récupérer une session
// ═══════════════════════════════════════════════════════════════
app.get('/api/sessions/event/:eventId', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const data = loadData();

        if (!data.sessions) {
            return res.json({ 
                success: true, 
                data: null,
                exists: false
            });
        }

        const session = data.sessions.find(s => s.eventId === eventId);
        
        if (!session) {
            return res.json({ 
                success: true, 
                data: null,
                exists: false
            });
        }

        // Nettoyer les agents inactifs
        const nowMs = Date.now();
        session.agents = session.agents.filter(agent => {
            const lastPing = new Date(agent.lastPing).getTime();
            return (nowMs - lastPing) < 45000;
        });

        session.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({ 
            success: true, 
            data: session,
            exists: true
        });
    } catch (err) {
        log.error('GET /api/sessions/event/:eventId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 📋 GET ALL ACTIVE SESSIONS - Liste toutes les sessions actives
// ═══════════════════════════════════════════════════════════════
app.get('/api/sessions', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const sessions = data.sessions || [];

        // Nettoyer et compter
        const nowMs = Date.now();
        const activeSessions = sessions.map(session => {
            const activeAgents = session.agents.filter(agent => {
                const lastPing = new Date(agent.lastPing).getTime();
                return (nowMs - lastPing) < 45000;
            });
            return {
                ...session,
                agents: activeAgents,
                agentCount: activeAgents.length
            };
        }).filter(s => s.agents.length > 0);

        res.json({
            success: true,
            data: activeSessions,
            count: activeSessions.length
        });
    } catch (err) {
        log.error('GET /api/sessions', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════
// 🗑️ DELETE SESSION - Terminer une session manuellement
// ═══════════════════════════════════════════════════════════════
app.delete('/api/sessions/:eventId', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const data = loadData();

        if (!data.sessions) {
            return res.json({ success: true, message: 'Aucune session' });
        }

        const sessionIndex = data.sessions.findIndex(s => s.eventId === eventId);
        
        if (sessionIndex === -1) {
            return res.json({ success: true, message: 'Session déjà supprimée' });
        }

        const removedSession = data.sessions.splice(sessionIndex, 1)[0];
        saveData(data);

        log.warning('🗑️ Session supprimée manuellement', removedSession.eventName);

        res.json({
            success: true,
            message: 'Session terminée',
            data: { removedSession }
        });
    } catch (err) {
        log.error('DELETE /api/sessions/:eventId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ═══════════════════════════════════════════════════════════════
// 🔄 CRON JOB POUR NETTOYER LES SESSIONS INACTIVES
// ═══════════════════════════════════════════════════════════════
// Ajouter ce code après l'initialisation du serveur

cron.schedule('*/2 * * * *', () => {
    try {
        const data = loadData();
        if (!data.sessions || data.sessions.length === 0) return;

        const nowMs = Date.now();
        let cleanedCount = 0;
        let deletedSessions = 0;

        data.sessions = data.sessions.filter(session => {
            const initialCount = session.agents.length;
            
            session.agents = session.agents.filter(agent => {
                const lastPing = new Date(agent.lastPing).getTime();
                return (nowMs - lastPing) < 60000;
            });

            cleanedCount += (initialCount - session.agents.length);

            // Supprimer la session si vide
            if (session.agents.length === 0) {
                deletedSessions++;
                return false;
            }
            return true;
        });

        if (cleanedCount > 0 || deletedSessions > 0) {
            saveData(data);
            log.info('🧹 Nettoyage sessions', `${cleanedCount} agents, ${deletedSessions} sessions supprimées`);
        }
    } catch (err) {
        log.error('Erreur cron nettoyage sessions', err.message);
    }
});

cron.schedule('*/30 * * * *', () => { 
    try {
        const data = loadData();
        if (!data.eventSessions || data.eventSessions.length === 0) return;
        
        const now = new Date();
        const expiredCount = data.eventSessions.filter(s => 
            new Date(s.expiresAt) <= now
        ).length;
        
        if (expiredCount > 0) {
            data.eventSessions = data.eventSessions.filter(s => 
                new Date(s.expiresAt) > now
            );
            
            saveData(data);
            log.info('🧹 Nettoyage eventSessions', `${expiredCount} sessions expirées supprimées`);
        }
    } catch (err) {
        log.error('Erreur nettoyage eventSessions', err.message);
    }
});

// Nettoyage automatique des fichiers temporaires (chaque 6 heures)
if (CONFIG.BACKUP_ENABLED) {
    cron.schedule('0 */6 * * *', () => {
        log.info('Nettoyage des fichiers temporaires', 'Tâche planifiée');
        const deleted = storageManager.cleanupTempFiles();
        if (deleted > 0) {
            log.success(`Fichiers temporaires nettoyés`, `${deleted} fichiers supprimés`);
        }
    });
}

// Archivage des anciennes conversations chat (chaque jour à 2h du matin)
cron.schedule('0 2 * * *', () => {
    try {
        const data = loadData();
        const thirtyDaysAgo = moment().subtract(30, 'days');

        let archived = 0;
        data.chatConversations?.forEach(conv => {
            if (moment(conv.updatedAt).isBefore(thirtyDaysAgo) && !conv.archived) {
                conv.archived = true;
                archived++;
            }
        });

        if (archived > 0) {
            saveData(data);
            log.success(`Conversations archivées`, `${archived} conversations`);
        }
    } catch (err) {
        log.error('Archivage conversations', err.message);
    }
});



app.get('/register', (req, res) => {
    const registerPath = path.join(__dirname, 'register.html');
    if (fs.existsSync(registerPath)) {
        log.success('Accès au register secret', req.ip);
        res.sendFile(registerPath);
    } else {
        res.status(404).send('<h1>404 - Page non trouvée</h1>');
    }
});




// ═══════════════════════════════════════════════════════════════
// 🌐 ROUTES API - DOCUMENTATION
// ═══════════════════════════════════════════════════════════════

app.get('/api', (req, res) => {
    res.json({
        name: '🛡️ SECURA QR API V3.0',
        version: '3.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        endpoints: {
            general: {
                health: 'GET /health',
                statistics: 'GET /api/statistics'
            },
            events: {
                getAll: 'GET /api/events',
                getOne: 'GET /api/events/:id',
                create: 'POST /api/events',
                update: 'PUT /api/events/:id',
                patch: 'PATCH /api/events/:id',
                delete: 'DELETE /api/events/:id',
                guests: 'GET /api/events/:id/guests',
                scans: 'GET /api/events/:id/scans',
                stats: 'GET /api/events/:id/statistics'
            },
            guests: {
                getAll: 'GET /api/guests',
                getOne: 'GET /api/guests/:id',
                create: 'POST /api/guests',
                createMultiple: 'POST /api/guests/bulk',
                update: 'PUT /api/guests/:id',
                patch: 'PATCH /api/guests/:id',
                delete: 'DELETE /api/guests/:id',
                deleteMultiple: 'DELETE /api/guests/bulk',
                exportCSV: 'GET /api/guests/export/csv'
            },
            qrCodes: {
                getAll: 'GET /api/qrcodes',
                getByGuest: 'GET /api/qrcodes/guest/:guestId',
                generate: 'POST /api/qrcodes/generate',
                verify: 'POST /api/qrcodes/verify'
            },
            scans: {
                getAll: 'GET /api/scans',
                getOne: 'GET /api/scans/:id',
                scan: 'POST /api/qr/scan',
                today: 'GET /api/scans/today',
                byEvent: 'GET /api/scans/event/:eventId'
            },
            sync: {
                pull: 'GET /api/sync/pull',
                push: 'POST /api/sync/push',
                status: 'GET /api/sync/status'
            },
            backup: {
                create: 'GET /api/backup',
                restore: 'POST /api/restore',
                list: 'GET /api/backups'
            },
            auth: {
                register: 'POST /api/auth/register',
                verify: '/api/auth/verify-access-code',
                generateCode: 'api/auth/verify-access-code',
                login: 'POST /api/auth/login',
                token: '/api/auth/verify-token',
                me: 'GET /api/auth/me (Bearer Token)'
            },
           // Dans la section endpoints de /api
            users: {
                getAll: 'GET /api/users (Admin)',
                getOne: 'GET /api/users/:id',
                update: 'PUT /api/users/:id',
                patch: 'PATCH /api/users/:id',
                delete: 'DELETE /api/users/:id (Admin)',
                changeRole: 'PATCH /api/users/:id/role (Admin)',
                toggleActive: 'PATCH /api/users/:id/active (Admin)',
                regenerateCode: 'POST /api/users/:id/regenerate-access-code',
                getStats: 'GET /api/users/:id/statistics',
                search: 'GET /api/users/search (Admin)'
            }
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// 💚 HEALTH & STATISTICS
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    
    const health = {
        status: 'OK',
        uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
            rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`
        },
        timestamp: new Date().toISOString(),
        version: '3.0.0'
    };
    res.json(health);
});

// DEBUG: Vérifier que les invités sont bien stockés avec le champ gender
app.get('/api/debug/guests/sample', (req, res) => {
    try {
        const data = loadData();
        const recentGuests = data.guests.slice(-5).map(g => ({
            id: g.id,
            name: `${g.firstName} ${g.lastName}`,
            gender: g.gender || 'non défini',
            email: g.email || 'pas d\'email',
            company: g.company || '',
            createdAt: g.createdAt,
            status: g.status
        }));
        
        res.json({
            success: true,
            message: 'Derniers 5 invités',
            totalGuests: data.guests.length,
            recent: recentGuests
        });
    } catch (err) {
        log.error('GET /api/debug/guests/sample', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ═══════════════════════════════════════════════════════════════
// 📊 MISE À JOUR DE /api/statistics POUR INCLURE LES SESSIONS
// ═══════════════════════════════════════════════════════════════

app.get('/api/statistics', (req, res) => {
    try {
        const data = loadData();
        const today = new Date().toDateString();
        
        // Compter les agents actifs dans toutes les sessions
        const nowMs = Date.now();
        let totalActiveAgents = 0;
        let activeSessions = 0;
        
        if (data.sessions) {
            data.sessions.forEach(session => {
                const activeAgents = session.agents.filter(agent => {
                    const lastPing = new Date(agent.lastPing).getTime();
                    return (nowMs - lastPing) < 45000;
                });
                if (activeAgents.length > 0) {
                    activeSessions++;
                    totalActiveAgents += activeAgents.length;
                }
            });
        }
        
        const stats = {
            activeEvents: data.events?.filter(e => e.active)?.length || 0,
            totalEvents: data.events?.length || 0,
            totalTables: data.tables?.length || 0,
            assignedGuests: data.guests?.filter(g => g.tableId)?.length || 0,
            totalGuests: data.guests?.length || 0,
            totalQRCodes: data.qrCodes?.length || 0,
            totalScans: data.scans?.length || 0,
            todayScans: data.scans?.filter(s => new Date(s.scannedAt).toDateString() === today)?.length || 0,
            scannedGuests: data.guests?.filter(g => g.scanned)?.length || 0,
            pendingGuests: data.guests?.filter(g => !g.scanned)?.length || 0,
            scanRate: data.guests?.length > 0 ? Math.round((data.guests.filter(g => g.scanned).length / data.guests.length) * 100) : 0,
            // NOUVELLES STATS SESSIONS
            activeSessions: activeSessions,
            totalActiveAgents: totalActiveAgents,
            lastUpdate: data.meta?.updatedAt || new Date().toISOString()
        };
        
        res.json({ success: true, data: stats });
    } catch (err) {
        log.error('Erreur statistiques', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ═══════════════════════════════════════════════════════════════
// 🎫 CRUD ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════

// GET ALL
app.get('/api/events', (req, res) => {
    try {
        const data = loadData();
        const { 
            active, 
            limit, 
            offset, 
            sort,
            type,
            status,
            organizerId,
            category,
            tag,
            search
        } = req.query;
        
        let events = data.events || [];
        
        // Filtre par statut actif
        if (active !== undefined) {
            events = events.filter(e => e.active === (active === 'true'));
            log.info('Filtre actif appliqué', `${events.length} résultats`);
        }
        
        // Filtre par type
        if (type) {
            events = events.filter(e => e.type === type);
            log.info('Filtre type appliqué', `${events.length} résultats`);
        }
        
        // Filtre par statut (nouveau champ)
        if (status) {
            events = events.filter(e => e.status === status);
            log.info('Filtre status appliqué', `${events.length} résultats`);
        }
        
        // Filtre par organisateur
        if (organizerId) {
            events = events.filter(e => e.organizerId === organizerId);
            log.info('Filtre organizerId appliqué', `${events.length} résultats`);
        }
        
        // Filtre par catégorie (métadonnées)
        if (category) {
            events = events.filter(e => e.metadata?.category === category);
            log.info('Filtre category appliqué', `${events.length} résultats`);
        }
        
        // Filtre par tag (métadonnées)
        if (tag) {
            events = events.filter(e => e.metadata?.tags?.includes(tag));
            log.info('Filtre tag appliqué', `${events.length} résultats`);
        }
        
        // Recherche globale
        if (search) {
            const term = search.toLowerCase();
            events = events.filter(event =>
                event.name?.toLowerCase().includes(term) ||
                (event.location && event.location.toLowerCase().includes(term)) ||
                (event.description && event.description.toLowerCase().includes(term)) ||
                (event.metadata?.tags?.some(tag => tag.toLowerCase().includes(term)))
            );
            log.info('Recherche appliquée', `"${search}" → ${events.length} résultats`);
        }
        
        // Tri
        if (sort === 'date') {
            events.sort((a, b) => new Date(a.date) - new Date(b.date));
        } else if (sort === '-date') {
            events.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else if (sort === 'name') {
            events.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === '-name') {
            events.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sort === 'created') {
            events.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (sort === '-created') {
            events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
        const total = events.length;
        if (limit) {
            const l = parseInt(limit);
            const o = parseInt(offset) || 0;
            events = events.slice(o, o + l);
            log.info('Pagination appliquée', `${events.length}/${total}`);
        }
        
        // Assurer que tous les événements ont les champs complets
        events = events.map(event => ensureCompleteEventStructure(event));
        
        log.crud('READ', 'events', { count: events.length });
        res.json({ success: true, data: events, total });
    } catch (err) {
        log.error('GET /api/events', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET ONE
app.get('/api/events/:id', (req, res) => {
    try {
        const data = loadData();
        const event = data.events.find(e => e.id === req.params.id);
        
        if (!event) {
            log.warning('Événement introuvable', req.params.id);
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        log.crud('READ', 'event', { id: event.id, name: event.name });
        res.json({ success: true, data: event });
    } catch (err) {
        log.error('GET /api/events/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE
app.post('/api/events', (req, res) => {
    try {
        const event = req.body;
        const validation = validateEvent(event);
        
        if (!validation.valid) {
            log.warning('Validation échouée', validation.errors.join(', '));
            return res.status(400).json({ success: false, errors: validation.errors });
        }
        
        const data = loadData();
        const now = new Date().toISOString();
        
        // Créer un événement avec structure complète
        const completeEvent = {
            id: generateId('evt'),
            ...sanitizeEventData(event),
            createdAt: now,
            updatedAt: now,
            active: event.active !== false,
            
            // Initialiser les structures imbriquées
            settings: {
                allowGuestRegistration: true,
                requireApproval: false,
                maxGuestsPerUser: 5,
                allowQRSharing: true,
                autoGenerateQRCodes: false,
                enablePhotoGallery: false,
                enableGuestMessages: false,
                enableTableQR: false,
                ...event.settings
            },
            
            design: {
                primaryColor: '#D97706',
                secondaryColor: '#3B82F6',
                backgroundImage: null,
                logo: null,
                theme: 'modern',
                customCSS: '',
                ...event.design
            },
            
            stats: {
                totalGuests: 0,
                confirmedGuests: 0,
                scannedGuests: 0,
                totalScans: 0,
                scanRate: 0,
                lastScan: null,
                ...event.stats
            },
            
            metadata: {
                tags: [],
                category: 'general',
                visibility: 'private',
                timezone: 'Africa/Douala',
                createdBy: event.createdBy || null,
                ...event.metadata
            },
            
            // Champs optionnels
            status: event.status || 'active',
            organizerId: event.organizerId || null
        };
        
        data.events.unshift(completeEvent);
        saveData(data);
        
        log.crud('CREATE', 'event', { id: completeEvent.id, name: completeEvent.name });
        log.success('Événement créé', completeEvent.name);
        
        res.status(201).json({ success: true, data: completeEvent });
    } catch (err) {
        log.error('POST /api/events', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE (complet) avec gestion des champs imbriqués
app.put('/api/events/:id', (req, res) => {
    try {
        const data = loadData();
        const index = data.events.findIndex(e => e.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        const existingEvent = data.events[index];
        const updates = req.body;
        
        // Validation
        const validation = validateEvent({ ...existingEvent, ...updates });
        if (!validation.valid) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }
        
        // Mise à jour avec fusion des champs imbriqués
        const updatedEvent = {
            ...existingEvent,
            ...sanitizeEventData(updates),
            id: req.params.id, 
            updatedAt: new Date().toISOString(),
            
            // Mise à jour des structures imbriquées
            settings: {
                ...existingEvent.settings,
                ...updates.settings
            },
            
            design: {
                ...existingEvent.design,
                ...updates.design
            },
            
            stats: {
                ...existingEvent.stats,
                ...updates.stats
            },
            
            metadata: {
                ...existingEvent.metadata,
                ...updates.metadata
            }
        };
        
        data.events[index] = ensureCompleteEventStructure(updatedEvent);
        saveData(data);
        
        log.crud('UPDATE', 'event', { id: updatedEvent.id, name: updatedEvent.name });
        log.success('Événement mis à jour', updatedEvent.name);
        
        res.json({ success: true, data: data.events[index] });
    } catch (err) {
        log.error('PUT /api/events/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH (partiel) avec support des champs imbriqués
app.patch('/api/events/:id', (req, res) => {
    try {
        const data = loadData();
        const index = data.events.findIndex(e => e.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        const existingEvent = data.events[index];
        const updates = req.body;
        
        // Mise à jour profonde pour les objets imbriqués
        const updatedEvent = { ...existingEvent };
        
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'object' && updates[key] !== null) {
                // Fusionner les objets imbriqués
                updatedEvent[key] = { 
                    ...updatedEvent[key], 
                    ...updates[key] 
                };
            } else {
                updatedEvent[key] = updates[key];
            }
        });
        
        updatedEvent.updatedAt = new Date().toISOString();
        data.events[index] = ensureCompleteEventStructure(updatedEvent);
        
        saveData(data);
        
        log.crud('PATCH', 'event', { id: req.params.id, fields: Object.keys(req.body) });
        
        res.json({ success: true, data: data.events[index] });
    } catch (err) {
        log.error('PATCH /api/events/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE
app.delete('/api/events/:id', (req, res) => {
    try {
        const data = loadData();
        const event = data.events.find(e => e.id === req.params.id);
        
        if (!event) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        // ⚠️ CASCADE DELETE: Supprimer toutes les galeries de l'événement
        const galleries = data.galleries?.filter(g => g.eventId === req.params.id) || [];
        let deletedGalleries = 0;
        let deletedPhotos = 0;
        let deletedComments = 0;
        let deletedLikes = 0;
        
        galleries.forEach(gallery => {
            const photoIds = gallery.photos?.map(p => p.id) || [];
            deletedPhotos += photoIds.length;
            
            // Supprimer la cover image de la galerie (coverPhotoUrl ou coverPhoto)
            if (gallery.metadata?.coverPhotoUrl) {
                storageManager.deleteFile(gallery.metadata.coverPhotoUrl);
            } else if (gallery.metadata?.coverPhoto) {
                storageManager.deleteFile(gallery.metadata.coverPhoto);
            }
            if (gallery.metadata?.coverPhotoThumbnail) {
                storageManager.deleteFile(gallery.metadata.coverPhotoThumbnail);
            }
            if (gallery.metadata?.coverImage) {
                storageManager.deleteFile(gallery.metadata.coverImage);
            }
            if (gallery.metadata?.coverImageThumbnail) {
                storageManager.deleteFile(gallery.metadata.coverImageThumbnail);
            }
            
            // Supprimer les fichiers des photos
            gallery.photos?.forEach(photo => {
                // Utiliser l'URL de la photo (plus robuste après redémarrage)
                if (photo.url) {
                    storageManager.deleteFile(photo.url);
                } else if (photo.fileId) {
                    storageManager.deleteFile(photo.fileId);
                }
                // Supprimer les thumbnails si stockés séparément
                if (photo.thumbnails?.small) storageManager.deleteFile(photo.thumbnails.small);
                if (photo.thumbnails?.medium) storageManager.deleteFile(photo.thumbnails.medium);
                if (photo.thumbnails?.large) storageManager.deleteFile(photo.thumbnails.large);
            });
            
            // Supprimer les commentaires des photos
            if (data.comments) {
                const commentsToDelete = data.comments.filter(c => photoIds.includes(c.photoId));
                deletedComments += commentsToDelete.length;
                data.comments = data.comments.filter(c => !photoIds.includes(c.photoId));
            }
            
            // Supprimer les likes des photos
            if (data.likes) {
                const likesToDelete = data.likes.filter(l => photoIds.includes(l.photoId));
                deletedLikes += likesToDelete.length;
                data.likes = data.likes.filter(l => !photoIds.includes(l.photoId));
            }
            
            deletedGalleries++;
        });
        data.galleries = data.galleries.filter(g => g.eventId !== req.params.id);
        
        // Supprimer la cover image de l'événement
        if (event.coverImage) {
            storageManager.deleteFile(event.coverImage);
        }
        if (event.coverImageThumbnail) {
            storageManager.deleteFile(event.coverImageThumbnail);
        }
        
        // Supprimer les invités et données associées
        const guestIds = data.guests.filter(g => g.eventId === req.params.id).map(g => g.id);
        data.guests = data.guests.filter(g => g.eventId !== req.params.id);
        data.qrCodes = data.qrCodes.filter(q => !guestIds.includes(q.guestId));
        data.scans = data.scans.filter(s => s.eventId !== req.params.id);
        data.tables = data.tables.filter(t => t.eventId !== req.params.id);
        
        // Supprimer les menus/plats de l'événement
        data.menus = data.menus?.filter(m => m.eventId !== req.params.id) || [];
        data.dishes = data.dishes?.filter(d => d.eventId !== req.params.id) || [];
        
        // Supprimer les plans de table
        data.plans = data.plans?.filter(p => p.eventId !== req.params.id) || [];
        
        // Supprimer les messages de l'événement
        data.messages = data.messages?.filter(m => m.eventId !== req.params.id) || [];
        
        data.events = data.events.filter(e => e.id !== req.params.id);
        saveData(data);
        
        log.crud('DELETE', 'event', { 
            id: req.params.id, 
            name: event.name,
            galleries: deletedGalleries,
            photos: deletedPhotos,
            comments: deletedComments,
            guests: guestIds.length
        });
        log.warning('Événement supprimé', `+ ${guestIds.length} invités, ${deletedGalleries} galeries, ${deletedPhotos} photos`);
        
        res.json({ 
            success: true, 
            deleted: { 
                event: 1, 
                guests: guestIds.length,
                galleries: deletedGalleries,
                photos: deletedPhotos,
                comments: deletedComments,
                likes: deletedLikes
            } 
        });
    } catch (err) {
        log.error('DELETE /api/events/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Statistiques par événement
app.get('/api/events/:id/statistics', (req, res) => {
    try {
        const data = loadData();
        const event = data.events.find(e => e.id === req.params.id);
        
        if (!event) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        const guests = data.guests.filter(g => g.eventId === req.params.id);
        const scans = data.scans.filter(s => s.eventId === req.params.id);
        const qrCodes = data.qrCodes.filter(q => {
            const guest = data.guests.find(g => g.id === q.guestId);
            return guest && guest.eventId === req.params.id;
        });
        
        const stats = {
            event: {
                id: event.id,
                name: event.name,
                date: event.date,
                type: event.type,
                capacity: event.capacity
            },
            guests: {
                total: guests.length,
                confirmed: guests.filter(g => g.status === 'confirmed').length,
                pending: guests.filter(g => g.status === 'pending').length,
                cancelled: guests.filter(g => g.status === 'cancelled').length,
                scanned: guests.filter(g => g.scanned).length,
                notScanned: guests.filter(g => !g.scanned).length
            },
            scans: {
                total: scans.length,
                today: scans.filter(s => new Date(s.scannedAt).toDateString() === new Date().toDateString()).length,
                last24h: scans.filter(s => new Date(s.scannedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length,
                lastScan: scans.length > 0 ? scans.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))[0].scannedAt : null
            },
            qrCodes: {
                total: qrCodes.length,
                generated: qrCodes.length,
                scanned: qrCodes.filter(q => q.scanCount > 0).length,
                notScanned: qrCodes.filter(q => q.scanCount === 0).length
            },
            rates: {
                scanRate: guests.length > 0 ? Math.round((guests.filter(g => g.scanned).length / guests.length) * 100) : 0,
                confirmationRate: guests.length > 0 ? Math.round((guests.filter(g => g.status === 'confirmed').length / guests.length) * 100) : 0,
                occupancyRate: event.capacity > 0 ? Math.round((guests.length / event.capacity) * 100) : 0
            },
            timeline: {
                scansByHour: getScansByHour(scans),
                guestsByStatus: {
                    confirmed: guests.filter(g => g.status === 'confirmed').length,
                    pending: guests.filter(g => g.status === 'pending').length,
                    cancelled: guests.filter(g => g.status === 'cancelled').length
                }
            }
        };
        
        res.json({ success: true, data: stats });
    } catch (err) {
        log.error('GET /api/events/:id/statistics', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.patch('/api/events/:id/stats', (req, res) => {
    try {
        const data = loadData();
        const index = data.events.findIndex(e => e.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        const statsUpdates = req.body;
        
        // Mettre à jour uniquement les statistiques
        data.events[index].stats = {
            ...data.events[index].stats,
            ...statsUpdates,
            updatedAt: new Date().toISOString()
        };
        
        data.events[index].updatedAt = new Date().toISOString();
        saveData(data);
        
        log.crud('UPDATE', 'event stats', { id: req.params.id });
        
        res.json({ 
            success: true, 
            data: data.events[index].stats,
            message: 'Statistiques mises à jour'
        });
    } catch (err) {
        log.error('PATCH /api/events/:id/stats', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

function getScansByHour(scans) {
    const scansByHour = {};
    scans.forEach(scan => {
        const hour = new Date(scan.scannedAt).getHours();
        scansByHour[hour] = (scansByHour[hour] || 0) + 1;
    });
    
    const result = [];
    for (let hour = 0; hour < 24; hour++) {
        result.push({
            hour: `${hour}h`,
            scans: scansByHour[hour] || 0
        });
    }
    
    return result;
}

function ensureCompleteEventStructure(event) {
    const defaults = {
        settings: {
            allowGuestRegistration: true,
            requireApproval: false,
            maxGuestsPerUser: 5,
            allowQRSharing: true,
            autoGenerateQRCodes: false,
            enablePhotoGallery: false,
            enableGuestMessages: false,
            enableTableQR: false
        },
        design: {
            primaryColor: '#D97706',
            secondaryColor: '#3B82F6',
            backgroundImage: null,
            logo: null,
            theme: 'modern',
            customCSS: ''
        },
        stats: {
            totalGuests: event.stats?.totalGuests || 0,
            confirmedGuests: event.stats?.confirmedGuests || 0,
            scannedGuests: event.stats?.scannedGuests || 0,
            totalScans: event.stats?.totalScans || 0,
            scanRate: event.stats?.scanRate || 0,
            lastScan: event.stats?.lastScan || null
        },
        metadata: {
            tags: event.metadata?.tags || [],
            category: event.metadata?.category || 'general',
            visibility: event.metadata?.visibility || 'private',
            timezone: event.metadata?.timezone || 'Africa/Douala',
            createdBy: event.metadata?.createdBy || null,
            updatedBy: event.metadata?.updateBy || null,
        },
        status: event.status || 'active',
        active: event.active !== false,
        organizerId: event.organizerId || null
    };
    
    return {
        ...defaults,
        ...event,
        settings: { ...defaults.settings, ...event.settings },
        design: { ...defaults.design, ...event.design },
        stats: { ...defaults.stats, ...event.stats },
        metadata: { ...defaults.metadata, ...event.metadata }
    };
}

function sanitizeEventData(event) {
    const clean = (value) => {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    };
    
    return {
        name: clean(event.name),
        type: event.type || 'autre',
        date: clean(event.date),
        time: clean(event.time),
        location: clean(event.location),
        capacity: parseInt(event.capacity) || 0,
        description: clean(event.description),
        welcomeMessage: clean(event.welcomeMessage),
        active: event.active !== false,
        status: event.status || 'active',
        organizerId: event.organizerId || null
    };
}




// ═══════════════════════════════════════════════════════════════
// 👥 CRUD INVITÉS
// ═══════════════════════════════════════════════════════════════

// GET ALL
app.get('/api/guests', (req, res) => {
  try {
    const data = loadData();
    const { 
      eventId, 
      scanned, 
      status,
      tableId,
      tableNumber,
      limit, 
      offset, 
      search,
      seats,
      includeTableInfo = 'true'
    } = req.query;
    
    let guests = data.guests || [];
    
    // Filtres de base
    if (eventId) {
      guests = guests.filter(g => g.eventId === eventId);
      log.info('Filtre eventId', `${guests.length} résultats`);
    }
    
    if (scanned !== undefined) {
      guests = guests.filter(g => g.scanned === (scanned === 'true'));
    }
    
    if (status) {
      guests = guests.filter(g => g.status === status);
    }
    
    if (tableId) {
      guests = guests.filter(g => g.tableId === tableId);
    }
    
    if (tableNumber) {
      guests = guests.filter(g => g.tableNumber === tableNumber);
    }
    
    if (seats) {
      const seatsNum = parseInt(seats);
      if (!isNaN(seatsNum)) {
        guests = guests.filter(g => g.seats === seatsNum);
      }
    }
    
    // Recherche avancée
    if (search) {
      const term = search.toLowerCase();
      guests = guests.filter(g =>
        g.firstName?.toLowerCase().includes(term) ||
        g.lastName?.toLowerCase().includes(term) ||
        g.email?.toLowerCase().includes(term) ||
        g.company?.toLowerCase().includes(term) ||
        g.notes?.toLowerCase().includes(term)
      );
      log.info('Recherche appliquée', `"${search}" → ${guests.length} résultats`);
    }
    
    // Inclure les informations de table si demandé
    if (includeTableInfo === 'true') {
      guests = guests.map(guest => {
        const enhancedGuest = { ...guest };
        
        if (guest.tableId) {
          const table = (data.tables || []).find(t => t.id === guest.tableId);
          if (table) {
            enhancedGuest.tableInfo = {
              id: table.id,
              tableNumber: table.tableNumber,
              tableName: table.tableName,
              capacity: table.capacity
            };
          }
        }
        
        return enhancedGuest;
      });
    }
    
    // Tri par défaut: nom, prénom
    guests.sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    const total = guests.length;
    
    // Pagination
    if (limit) {
      const l = parseInt(limit);
      const o = parseInt(offset) || 0;
      guests = guests.slice(o, o + l);
    }
    
    log.crud('READ', 'guests', { count: guests.length });
    res.json({ success: true, data: guests, total });
  } catch (err) {
    log.error('GET /api/guests', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET ONE
app.get('/api/guests/:id', (req, res) => {
  try {
    const data = loadData();
    const guest = data.guests.find(g => g.id === req.params.id);
    
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Invité introuvable' });
    }
    
    // Ajouter les informations de table
    const enhancedGuest = { ...guest };
    
    if (guest.tableId) {
      const table = (data.tables || []).find(t => t.id === guest.tableId);
      if (table) {
        enhancedGuest.tableInfo = {
          id: table.id,
          tableNumber: table.tableNumber,
          tableName: table.tableName,
          capacity: table.capacity,
          location: table.location,
          category: table.category
        };
      }
    }
    
    log.crud('READ', 'guest', { id: guest.id, name: `${guest.firstName} ${guest.lastName}` });
    res.json({ success: true, data: enhancedGuest });
  } catch (err) {
    log.error('GET /api/guests/:id', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE
app.post('/api/guests', (req, res) => {
  try {
    const guest = req.body;
    const validation = validateGuest(guest);
    
    if (!validation.valid) {
      log.warning('Validation invité échouée', validation.errors.join(', '));
      return res.status(400).json({ success: false, errors: validation.errors });
    }
    
    const data = loadData();
    const now = new Date().toISOString();
    
    const newGuest = initializeGuest(guest.eventId, guest);
    
    if (guest.tableId) {
      const table = (data.tables || []).find(t => t.id === guest.tableId);
      
      if (!table) {
        return res.status(404).json({ 
          success: false, 
          error: 'Table introuvable' 
        });
      }
      
      const totalSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
      const availableSeats = table.capacity - totalSeats;
      
      if (newGuest.seats > availableSeats) {
        return res.status(400).json({ 
          success: false, 
          error: `Places insuffisantes sur la table (${availableSeats} disponible(s))` 
        });
      }
      
      table.assignedGuests.push({
        guestId: newGuest.id,
        guestName: `${newGuest.firstName} ${newGuest.lastName}`.trim() || newGuest.email,
        seats: newGuest.seats,
        assignedAt: now,
        assignedBy: 'api'
      });
      
      newGuest.tableNumber = table.tableNumber;
      newGuest.assignedAt = now;
      
      table.updatedAt = now;
    }
    
    data.guests.push(newGuest);
    saveData(data);
    
    log.crud('CREATE', 'guest', { 
      id: newGuest.id, 
      name: `${newGuest.firstName} ${newGuest.lastName}`,
      gender: newGuest.gender || 'non spécifié',
      email: newGuest.email || 'pas d\'email',
      table: newGuest.tableNumber ? `Table ${newGuest.tableNumber}` : 'Sans table'
    });
    
    log.success('Invité créé', `${newGuest.firstName} ${newGuest.lastName}${newGuest.gender ? ` (${newGuest.gender})` : ''}`);
    
    res.status(201).json({ success: true, data: newGuest });
  } catch (err) {
    log.error('POST /api/guests', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ──────────────────────────────────────────────────────────────
//  POST /api/guests/bulk  –  Import CSV (réinitialisation totale)
// ──────────────────────────────────────────────────────────────
app.post('/api/guests/bulk', (req, res) => {
    try {
        const { guests: rawGuests } = req.body;      

        if (!Array.isArray(rawGuests) || rawGuests.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Le corps doit contenir un tableau "guests" non vide.'
            });
        }

        const data   = loadData();                         
        const now    = new Date().toISOString();
        const created = [];
        const errors  = [];

        // --------------------------------------------------------------
        // 1. Parcours ligne par ligne
        // --------------------------------------------------------------
        rawGuests.forEach((raw, idx) => {
            try {
                // -----------------------------------------------------------------
                //  a) Normalisation des champs (CSV → objet propre)
                // -----------------------------------------------------------------
                const guest = {
                    firstName: (raw.firstName || raw.prenom || '').trim(),
                    lastName : (raw.lastName  || raw.nom    || '').trim(),
                    email    : (raw.email || '').trim().toLowerCase() || undefined,
                    phone    : (raw.phone || raw.telephone || '').trim() || undefined,
                    company  : (raw.company || raw.entreprise || '').trim() || '',
                    gender   : (raw.gender || raw.sexe || raw.sex || '').trim().toLowerCase() || undefined,
                    notes    : (raw.notes || '').trim() || '',
                    eventId  : raw.eventId || raw.event || undefined
                };

                // -----------------------------------------------------------------
                //  b) Validation obligatoire
                // -----------------------------------------------------------------
                if (!guest.eventId) {
                    errors.push({ index: idx, reason: 'eventId manquant', raw });
                    log.validation(`Guest ${idx}`, false, 'eventId manquant');
                    return;
                }

                // -----------------------------------------------------------------
                //  c) Réinitialisation complète (NOUVEAU invité)
                // -----------------------------------------------------------------
                guest.id          = generateId('gst');   // ← **toujours** nouveau
                guest.createdAt   = now;
                guest.updatedAt   = now;
                guest.scanned     = false;
                guest.scannedAt   = null;
                guest.status      = 'pending';

                // Nettoyage de tout champ sensible qui aurait pu être copié du CSV
                delete guest.qrCodeId;
                delete guest.scans;
                delete guest.qrData;
                delete guest.previousEventId;

                // -----------------------------------------------------------------
                //  d) Validation métier (validateGuest)
                // -----------------------------------------------------------------
                const validation = validateGuest(guest);
                if (!validation.valid) {
                    errors.push({ index: idx, guest, errors: validation.errors });
                    log.validation(`Guest ${idx}`, false, validation.errors.join('; '));
                    return;
                }

                // -----------------------------------------------------------------
                //  e) Unicité **dans l’événement cible**
                // -----------------------------------------------------------------
                const duplicateInDB = data.guests.find(g =>
                    g.eventId === guest.eventId &&
                    ((guest.email && g.email === guest.email) ||
                     (!guest.email && g.firstName === guest.firstName && g.lastName === guest.lastName))
                );

                const duplicateInBatch = created.find(g =>
                    g.eventId === guest.eventId &&
                    ((guest.email && g.email === guest.email) ||
                     (!guest.email && g.firstName === guest.firstName && g.lastName === guest.lastName))
                );

                if (duplicateInDB || duplicateInBatch) {
                    errors.push({ index: idx, guest, errors: ['Doublon dans cet événement'] });
                    log.validation(`Guest ${idx}`, false, 'Doublon');
                    return;
                }

                // -----------------------------------------------------------------
                //  f) Ajout à la base
                // -----------------------------------------------------------------
                data.guests.push(guest);
                created.push(guest);
                
                // Log détaillé avec tous les champs importants
                const guestSummary = [
                    `${guest.firstName} ${guest.lastName}`,
                    guest.gender ? `(${guest.gender})` : '',
                    guest.email ? `📧 ${guest.email}` : '',
                    guest.company ? `🏢 ${guest.company}` : ''
                ].filter(Boolean).join(' ');
                
                log.validation(`Guest ${idx}`, true, guestSummary);
            } catch (e) {
                errors.push({ index: idx, error: e.message, raw });
                log.error(`Bulk guest ${idx}`, e.message);
            }
        });

        // --------------------------------------------------------------
        // 2. Nettoyage des références orphelines (facultatif mais sûr)
        // --------------------------------------------------------------
        // Si le CSV contenait d’anciens `id` (ex: export d’un autre événement),
        // on supprime toute trace dans qrCodes / scans pour éviter des liens fantômes.
        const oldIds = rawGuests
            .map(g => g.id)
            .filter(Boolean);

        if (oldIds.length) {
            data.qrCodes = data.qrCodes.filter(q => !oldIds.includes(q.guestId));
            data.scans   = data.scans.filter(s   => !oldIds.includes(s.guestId));
            log.info('Nettoyage références orphelines',
                `${oldIds.length} anciens IDs supprimés de qrCodes/scans`);
        }

        // --------------------------------------------------------------
        // 3. Sauvegarde
        // --------------------------------------------------------------
        saveData(data);

        log.crud('CREATE BULK', 'guests', { created: created.length, errors: errors.length });
        
        // Résumé avec détails des invités créés
        const createdSummary = created.slice(0, 5).map(g => 
            `${g.firstName} ${g.lastName}${g.gender ? ` (${g.gender})` : ''}`
        ).join(', ');
        
        log.success('Import CSV terminé',
            `${created.length}/${rawGuests.length} invités créés${created.length > 0 ? ': ' + createdSummary + (created.length > 5 ? '...' : '') : ''}`);

        // Détail des erreurs si présentes
        if (errors.length > 0) {
            errors.slice(0, 3).forEach(err => {
                log.warning(`Import erreur ligne ${err.index}`, err.errors?.join('; ') || err.reason);
            });
            if (errors.length > 3) {
                log.warning(`Import erreurs`, `+${errors.length - 3} erreur(s) supplémentaire(s)`);
            }
        }

        // --------------------------------------------------------------
        // 4. Réponse
        // --------------------------------------------------------------
        res.status(201).json({
            success: true,
            data   : created,
            count  : created.length,
            errors : errors.length ? errors : undefined
        });

    } catch (err) {
        log.error('POST /api/guests/bulk', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE
app.put('/api/guests/:id', (req, res) => {
  try {
    const data = loadData();
    const index = data.guests.findIndex(g => g.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Invité introuvable' });
    }
    
    const existingGuest = data.guests[index];
    const updates = req.body;
    
    const updatedGuest = {
      ...existingGuest,
      ...updates,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    };
    
    const validation = validateGuest(updatedGuest);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }
    
    if (updates.tableId !== undefined && updates.tableId !== existingGuest.tableId) {
      // Retirer de l'ancienne table si nécessaire
      if (existingGuest.tableId) {
        const oldTable = data.tables.find(t => t.id === existingGuest.tableId);
        if (oldTable) {
          oldTable.assignedGuests = oldTable.assignedGuests.filter(g => g.guestId !== existingGuest.id);
          oldTable.updatedAt = new Date().toISOString();
        }
      }
      
      // Ajouter à la nouvelle table si spécifiée
      if (updates.tableId) {
        const newTable = data.tables.find(t => t.id === updates.tableId);
        
        if (!newTable) {
          return res.status(404).json({ 
            success: false, 
            error: 'Table introuvable' 
          });
        }
        
        const totalSeats = newTable.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = newTable.capacity - totalSeats;
        const requestedSeats = updates.seats || existingGuest.seats || 1;
        
        if (requestedSeats > availableSeats) {
          return res.status(400).json({ 
            success: false, 
            error: `Places insuffisantes sur la nouvelle table (${availableSeats} disponible(s))` 
          });
        }
        
        // Ajouter à la nouvelle table
        newTable.assignedGuests.push({
          guestId: updatedGuest.id,
          guestName: `${updatedGuest.firstName || ''} ${updatedGuest.lastName || ''}`.trim() || updatedGuest.email,
          seats: requestedSeats,
          assignedAt: new Date().toISOString(),
          assignedBy: 'api'
        });
        
        newTable.updatedAt = new Date().toISOString();
        
        updatedGuest.tableNumber = newTable.tableNumber;
        updatedGuest.assignedAt = new Date().toISOString();
      } else {
        updatedGuest.tableId = null;
        updatedGuest.tableNumber = null;
        updatedGuest.assignedAt = null;
      }
    }
    
    data.guests[index] = updatedGuest;
    saveData(data);
    
    log.crud('UPDATE', 'guest', { 
      id: updatedGuest.id, 
      name: `${updatedGuest.firstName} ${updatedGuest.lastName}`,
      table: updatedGuest.tableNumber ? `→ Table ${updatedGuest.tableNumber}` : '→ Sans table'
    });
    
    res.json({ success: true, data: updatedGuest });
  } catch (err) {
    log.error('PUT /api/guests/:id', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// PATCH
app.patch('/api/guests/:id', (req, res) => {
  try {
    const data = loadData();
    const index = data.guests.findIndex(g => g.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Invité introuvable' });
    }
    
    const existingGuest = data.guests[index];
    const updates = req.body;
    const now = new Date().toISOString();
    
    const updatedGuest = { ...existingGuest };
    
    Object.keys(updates).forEach(key => {
      if (key === 'metadata' && typeof updates[key] === 'object') {
        updatedGuest[key] = { ...existingGuest[key], ...updates[key] };
      } else if (key === 'scanHistory' && Array.isArray(updates[key])) {
        updatedGuest[key] = [...(existingGuest[key] || []), ...updates[key]];
      } else if (key === 'confirmationHistory' && Array.isArray(updates[key])) {
        updatedGuest[key] = [...(existingGuest[key] || []), ...updates[key]];
      } else if (key !== 'id' && key !== 'createdAt') {
        updatedGuest[key] = updates[key];
      }
    });
    
    updatedGuest.updatedAt = now;
    
    // Gestion spéciale pour les scans
    if (updates.scanned !== undefined) {
      updatedGuest.scanned = updates.scanned;
      if (updates.scanned && !existingGuest.scanned) {
        updatedGuest.scannedAt = now;
        updatedGuest.scanCount = (existingGuest.scanCount || 0) + 1;
        
        // Ajouter à l'historique des scans
        updatedGuest.scanHistory = [
          ...(existingGuest.scanHistory || []),
          {
            scannedAt: now,
            scannedBy: updates.scannedBy || 'system',
            location: updates.scanLocation || 'unknown'
          }
        ];
      } else if (!updates.scanned) {
        updatedGuest.scannedAt = null;
      }
    }
    
    data.guests[index] = updateGuestWithTableRelations(updatedGuest, data);
    saveData(data);
    
    log.crud('PATCH', 'guest', { id: req.params.id, fields: Object.keys(req.body) });
    
    res.json({ success: true, data: data.guests[index] });
  } catch (err) {
    log.error('PATCH /api/guests/:id', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// DELETE
app.delete('/api/guests/:id', (req, res) => {
  try {
    const data = loadData();
    const guest = data.guests.find(g => g.id === req.params.id);
    
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Invité introuvable' });
    }
    
    // Retirer l'invité de sa table si assigné
    if (guest.tableId) {
      const table = data.tables.find(t => t.id === guest.tableId);
      if (table) {
        table.assignedGuests = table.assignedGuests.filter(g => g.guestId !== req.params.id);
        table.updatedAt = new Date().toISOString();
      }
    }
    
    // Supprimer l'invité et ses relations
    data.guests = data.guests.filter(g => g.id !== req.params.id);
    data.qrCodes = data.qrCodes.filter(q => q.guestId !== req.params.id);
    data.scans = data.scans.filter(s => s.guestId !== req.params.id);
    
    saveData(data);
    
    log.crud('DELETE', 'guest', { 
      id: guest.id, 
      name: `${guest.firstName} ${guest.lastName}`,
      table: guest.tableNumber ? `(Table ${guest.tableNumber})` : ''
    });
    
    log.warning('Invité supprimé', `${guest.firstName} ${guest.lastName}`);
    
    res.json({ success: true, deleted: 1 });
  } catch (err) {
    log.error('DELETE /api/guests/:id', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// DELETE MULTIPLE (BULK)
app.delete('/api/guest/bulk', (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Array ids[] requis' });
        }
        
        const data = loadData();
        const before = data.guests.length;
        
        data.guests = data.guests.filter(g => !ids.includes(g.id));
        data.qrCodes = data.qrCodes.filter(q => !ids.includes(q.guestId));
        data.scans = data.scans.filter(s => !ids.includes(s.guestId));
        
        const deleted = before - data.guests.length;
        saveData(data);
        
        log.crud('DELETE BULK', 'guests', { deleted });
        log.warning('Invités supprimés en masse', `${deleted} invités`);
        
        res.json({ success: true, deleted });
    } catch (err) {
        log.error('DELETE /api/guests/bulk', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// EXPORT CSV
app.get('/api/guests/export/csv', (req, res) => {
    try {
        const { eventId } = req.query;
        const data = loadData();
        
        let guests = data.guests;
        if (eventId) {
            guests = guests.filter(g => g.eventId === eventId);
        }
        
        const headers = ['ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Notes', 'Statut', 'Scanné', 'Date Scan'];
        const rows = [headers.join(',')];
        
        guests.forEach(g => {
            rows.push([
                g.id,
                g.firstName || '',
                g.lastName || '',
                g.email || '',
                g.phone || '',
                g.company || '',
                (g.notes || '').replace(/,/g, ';'),
                g.status || '',
                g.scanned ? 'Oui' : 'Non',
                g.scannedAt || ''
            ].map(v => `"${v}"`).join(','));
        });
        
        const csv = rows.join('\n');
        const filename = `secura-guests-${moment().format('YYYY-MM-DD')}.csv`;
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv); // BOM pour Excel
        
        log.success('Export CSV', `${guests.length} invités`);
    } catch (err) {
        log.error('GET /api/guests/export/csv', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 📱 QR CODES
// ═══════════════════════════════════════════════════════════════

// GET ALL
app.get('/api/qrcodes', (req, res) => {
    try {
        const data = loadData();
        const { eventId } = req.query;
        
        let qrCodes = data.qrCodes || [];
        
        if (eventId) {
            const guestIds = data.guests.filter(g => g.eventId === eventId).map(g => g.id);
            qrCodes = qrCodes.filter(q => guestIds.includes(q.guestId));
        }
        
        log.crud('READ', 'qrcodes', { count: qrCodes.length });
        res.json({ success: true, data: qrCodes, count: qrCodes.length });
    } catch (err) {
        log.error('GET /api/qrcodes', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET BY GUEST
app.get('/api/qrcodes/guest/:guestId', (req, res) => {
    try {
        const data = loadData();
        const qrCode = data.qrCodes.find(q => q.guestId === req.params.guestId);
        
        if (!qrCode) {
            log.info('QR Code absent pour invité', req.params.guestId);
            return res.json({
                success: true,
                found: false,
                message: "QR Code introuvable. Générer via l'interface admin.",
                action: "generate",
                guestId: req.params.guestId,
                data: null
            });
        }
        
        log.crud('READ', 'qrcode', { guestId: req.params.guestId });
        res.json({ success: true, found: true, data: qrCode });
    } catch (err) {
        log.error('GET /api/qrcodes/guest/:guestId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GENERATE QR CODE
app.post('/api/qrcodes/generate', (req, res) => {
    try {
        const { guestId, eventId } = req.body;
        
        if (!guestId || !eventId) {
            return res.status(400).json({ success: false, error: 'guestId et eventId requis' });
        }
        
        const data = loadData();
        const guest = data.guests.find(g => g.id === guestId);
        const event = data.events.find(e => e.id === eventId);
        
        if (!guest || !event) {
            return res.status(404).json({ success: false, error: 'Invité ou événement introuvable' });
        }
        
        const qrData = {
            t: 'INV',
            e: eventId,
            g: guestId,
            n: `${guest.firstName} ${guest.lastName}`,
            d: new Date().toISOString()
        };
        
        const qrCode = {
            id: generateId('qr'),
            guestId,
            eventId,
            data: qrData,
            rawData: JSON.stringify(qrData),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const index = data.qrCodes.findIndex(q => q.guestId === guestId);
        if (index !== -1) {
            data.qrCodes[index] = qrCode;
        } else {
            data.qrCodes.push(qrCode);
        }
        
        saveData(data);
        
        log.crud('CREATE', 'qrcode', { guestId, guest: qrData.n });
        log.success('QR Code généré', qrData.n);
        
        res.status(201).json({ success: true, data: qrCode });
    } catch (err) {
        log.error('POST /api/qrcodes/generate', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// VERIFY QR CODE
app.post('/api/qrcodes/verify', (req, res) => {
    try {
        const { t, e, g } = req.body;
        
        log.info('Vérification QR', `t=${t}, e=${e}, g=${g}`);
        
        if (t !== 'INV' || !e || !g) {
            log.warning('QR invalide', 'Format incorrect');
            return res.status(400).json({ success: false, error: 'QR Code invalide' });
        }
        
        const data = loadData();
        const guest = data.guests.find(x => x.id === g);
        const event = data.events.find(x => x.id === e);
        
        if (!guest || !event) {
            log.warning('Vérification échouée', 'Invité ou événement introuvable');
            return res.status(404).json({ success: false, error: 'Invité ou événement introuvable' });
        }
        
        const result = {
            valid: true,
            guest: {
                id: guest.id,
                name: `${guest.firstName} ${guest.lastName}`,
                email: guest.email,
                scanned: guest.scanned,
                scannedAt: guest.scannedAt
            },
            event: {
                id: event.id,
                name: event.name,
                date: event.date,
                location: event.location
            }
        };
        
        log.success('QR vérifié', `${result.guest.name} - ${result.event.name}`);
        
        res.json({ success: true, data: result });
    } catch (err) {
        log.error('POST /api/qrcodes/verify', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 📷 SCANS
// ═══════════════════════════════════════════════════════════════

// GET ALL
app.get('/api/scans', (req, res) => {
    try {
        const data = loadData();
        const { limit, offset } = req.query;
        
        let scans = [...data.scans].sort((a, b) => 
            new Date(b.scannedAt) - new Date(a.scannedAt)
        );
        
        const total = scans.length;
        if (limit) {
            const l = parseInt(limit);
            const o = parseInt(offset) || 0;
            scans = scans.slice(o, o + l);
        }
        
        log.crud('READ', 'scans', { count: scans.length });
        res.json({ success: true, data: scans, total });
    } catch (err) {
        log.error('GET /api/scans', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET ONE
app.get('/api/scans/:id', (req, res) => {
    try {
        const data = loadData();
        const scan = data.scans.find(s => s.id === req.params.id);
        
        if (!scan) {
            return res.status(404).json({ success: false, error: 'Scan introuvable' });
        }
        
        log.crud('READ', 'scan', { id: scan.id });
        res.json({ success: true, data: scan });
    } catch (err) {
        log.error('GET /api/scans/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// SCAN QR CODE (Principal)
app.post('/api/qr/scan', (req, res) => {
    const start = Date.now();
    
    try {
        const { t, e, g } = req.body;
        
        log.info('📷 SCAN DEMANDÉ', `t=${t}, e=${e}, g=${g}`);
        
        if (t !== 'INV' || !e || !g) {
            log.warning('QR invalide', 'Format incorrect');
            return res.status(400).json({ success: false, error: 'QR Code invalide' });
        }
        
        const data = loadData();
        const guest = data.guests.find(x => x.id === g);
        const event = data.events.find(x => x.id === e);
        
        if (!guest || !event) {
            log.warning('Scan refusé', 'Invité ou événement introuvable');
            return res.status(404).json({ success: false, error: 'Invité ou événement introuvable' });
        }
        
       // Déjà scanné ?
        if (guest.scanned) {
            // Cherche le scan existant lié à ce guest + event pour le retourner
            const existingScan = data.scans.find(s => s.guestId === g && s.eventId === e) || null;
            log.warning('Déjà scanné', `${guest.firstName} ${guest.lastName}`);
            return res.status(200).json({
                success: true,
                alreadyScanned: true,
                message: `${guest.firstName} ${guest.lastName} déjà scanné`,
                data: { scan: existingScan, guest, event }
            });
        }
        
        
        // Créer scan
        const scan = {
            id: generateId('scn'),
            eventId: e,
            guestId: g,
            guestName: `${guest.firstName} ${guest.lastName}`,
            eventName: event.name,
            scannedAt: new Date().toISOString()
        };
        
        data.scans.unshift(scan);
        guest.scanned = true;
        guest.status = GUEST_STATUS.CHECKED_IN;
        guest.scannedAt = scan.scannedAt;

        
        saveData(data);
        
        const duration = Date.now() - start;
        
        log.scan(`${guest.firstName} ${guest.lastName}`);
        log.crud('CREATE', 'scan', { id: scan.id, guest: scan.guestName });
        log.success('✅ SCAN RÉUSSI', `${duration}ms`);
        
        res.json({
            success: true,
            data: { scan, guest, event },
            message: `${guest.firstName} ${guest.lastName} scanné avec succès`,
            duration: `${duration}ms`
        });
    } catch (err) {
        log.error('POST /api/qr/scan', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/scan/today', (req, res) => {
    try {
        const data = loadData();
        const today = new Date().toDateString();
        
        const scans = data.scans.filter(s => 
            new Date(s.scannedAt).toDateString() === today
        ).sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
        
        log.crud('READ', 'scans/today', { count: scans.length });
        res.json({ success: true, data: scans, count: scans.length });
    } catch (err) {
        log.error('GET /api/scans/today', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// SCANS BY EVENT
app.get('/api/scans/event/:eventId', (req, res) => {
    try {
        const data = loadData();
        const scans = data.scans.filter(s => s.eventId === req.params.eventId)
            .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
        
        log.crud('READ', 'scans/event', { eventId: req.params.eventId, count: scans.length });
        res.json({ success: true, data: scans, count: scans.length });
    } catch (err) {
        log.error('GET /api/scans/event/:eventId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════
// 🗑️ DELETE SCAN - Réinitialiser un scan d'invité
// ═══════════════════════════════════════════════════════════════
app.delete('/api/scans/:scanId', jwtAuth, (req, res) => {
    try {
        const { scanId } = req.params;
        const data = loadData();

        const scanIndex = data.scans.findIndex(s => s.id === scanId);
        if (scanIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Scan introuvable' 
            });
        }

        const scan = data.scans[scanIndex];
        
        // Supprimer le scan
        data.scans.splice(scanIndex, 1);

        // Réinitialiser l'invité
        const guestIndex = data.guests.findIndex(g => g.id === scan.guestId);
        if (guestIndex !== -1) {
            data.guests[guestIndex].scanned = false;
            data.guests[guestIndex].scannedAt = null;
        }

        saveData(data);

        log.crud('DELETE', 'scan', { id: scanId, guest: scan.guestName });
        log.success('🗑️ Scan supprimé', `${scan.guestName} réinitialisé`);

        res.json({
            success: true,
            message: 'Scan supprimé et invité réinitialisé',
            data: {
                deletedScan: scan,
                resetGuest: guestIndex !== -1 ? data.guests[guestIndex] : null
            }
        });
    } catch (err) {
        log.error('DELETE /api/scans/:scanId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Suppression par guestId (alternative)
app.delete('/api/scans/guest/:guestId', jwtAuth, (req, res) => {
    try {
        const { guestId } = req.params;
        const data = loadData();

        // Trouver tous les scans de cet invité
        const scansToDelete = data.scans.filter(s => s.guestId === guestId);
        
        if (scansToDelete.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Aucun scan trouvé pour cet invité' 
            });
        }

        // Supprimer tous les scans
        data.scans = data.scans.filter(s => s.guestId !== guestId);

        // Réinitialiser l'invité
        const guestIndex = data.guests.findIndex(g => g.id === guestId);
        if (guestIndex !== -1) {
            data.guests[guestIndex].scanned = false;
            data.guests[guestIndex].scannedAt = null;
        }

        saveData(data);

        log.crud('DELETE BULK', 'scans', { guestId, count: scansToDelete.length });
        log.success('🗑️ Scans supprimés', `${scansToDelete.length} scan(s)`);

        res.json({
            success: true,
            message: `${scansToDelete.length} scan(s) supprimé(s)`,
            data: {
                deletedScans: scansToDelete,
                resetGuest: guestIndex !== -1 ? data.guests[guestIndex] : null
            }
        });
    } catch (err) {
        log.error('DELETE /api/scans/guest/:guestId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// SCANNER UN QR CODE (version améliorée)
app.post('/api/qr/scan', (req, res) => {
    try {
        const { t, e, g, source = 'scanner' } = req.body;
        
        log.info('Scan QR Code', `type=${t}, event=${e}, guest=${g}, source=${source}`);
        
        if (t !== 'INV' || !e || !g) {
            return res.status(400).json({ 
                success: false, 
                error: 'QR Code invalide' 
            });
        }
        
        const data = loadData();
        
        // Vérifier l'invité
        const guest = data.guests.find(x => x.id === g);
        const event = data.events.find(x => x.id === e);
        
        if (!guest || !event) {
            return res.status(404).json({ 
                success: false, 
                error: 'Invité ou événement introuvable' 
            });
        }
        
        const now = new Date().toISOString();
        
        // Vérifier si déjà scanné
        const alreadyScanned = guest.scanned;
        
        // Mettre à jour le statut avec historique
        guest.scanned = true;
        guest.scannedAt = now;
        guest.scanCount = (guest.scanCount || 0) + 1;
        guest.lastScanSource = source;
        guest.status = 'checked_in'; 
        guest.updatedAt = now;
        
        guest.confirmationHistory = [
            ...(guest.confirmationHistory || []),
            {
                status: 'checked_in',
                changedAt: now,
                notes: `Scan QR depuis ${source}`,
                changedBy: 'system',
                ip: req.ip,
                source: source
            }
        ];
        
        // Enregistrer le scan
        const scan = {
            id: generateId('scan'),
            guestId: g,
            eventId: e,
            guestName: `${guest.firstName} ${guest.lastName}`,
            eventName: event.name,
            scannedAt: now,
            source: source,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            alreadyScanned: alreadyScanned
        };
        
        if (!data.scans) data.scans = [];
        data.scans.push(scan);
        
        saveData(data);
        
        log.crud('SCAN', 'qr code', { 
            guest: `${guest.firstName} ${guest.lastName}`,
            event: event.name,
            source: source,
            status: alreadyScanned ? '⚠️ DUPLICATE' : '✅ NEW'
        });
        
        // Récupérer les infos de table
        let tableInfo = null;
        if (guest.tableId) {
            const table = data.tables.find(t => t.id === guest.tableId);
            if (table) {
                tableInfo = {
                    tableNumber: table.tableNumber,
                    tableName: table.tableName,
                    location: table.location,
                    capacity: table.capacity,
                    guestCount: table.assignedGuests?.length || 0
                };
            }
        }
        
        res.json({
            success: true,
            data: {
                scan,
                guest: {
                    id: guest.id,
                    name: `${guest.firstName} ${guest.lastName}`,
                    email: guest.email,
                    company: guest.company,
                    status: guest.status,
                    scanned: guest.scanned,
                    scanCount: guest.scanCount
                },
                event: {
                    id: event.id,
                    name: event.name,
                    date: event.date
                },
                table: tableInfo,
                requiresPersonalCode: !!guest.accessCode,
                alreadyScanned: alreadyScanned
            },
            message: alreadyScanned 
                ? `Bienvenue à nouveau ${guest.firstName} ! (Scan #${guest.scanCount})` 
                : `Bienvenue ${guest.firstName} !`
        });
        
    } catch (err) {
        log.error('POST /api/qr/scan', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/*
app.get('/api/events/:eventId/scan-stats', (req, res) => {
    try {
        const { eventId } = req.params;
        
        const data = loadData();
        const event = data.events.find(e => e.id === eventId);
        
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                error: 'Événement introuvable' 
            });
        }
        
        // Filtrer les invités de cet événement
        const eventGuests = data.guests.filter(g => g.eventId === eventId);
        const eventScans = data.scans?.filter(s => s.eventId === eventId) || [];
        
        const stats = {
            totalGuests: eventGuests.length,
            scannedGuests: eventGuests.filter(g => g.scanned).length,
            scanRate: eventGuests.length > 0 ? 
                Math.round((eventGuests.filter(g => g.scanned).length / eventGuests.length) * 100) : 0,
            
            recentScans: eventScans
                .filter(s => new Date(s.scannedAt) > new Date(Date.now() - 3600000)) // dernière heure
                .length,
            
            byTable: data.tables
                .filter(t => t.eventId === eventId)
                .map(table => {
                    const tableGuests = eventGuests.filter(g => g.tableId === table.id);
                    const scannedTableGuests = tableGuests.filter(g => g.scanned);
                    
                    return {
                        tableNumber: table.tableNumber,
                        totalGuests: tableGuests.length,
                        scannedGuests: scannedTableGuests.length,
                        scanRate: tableGuests.length > 0 ? 
                            Math.round((scannedTableGuests.length / tableGuests.length) * 100) : 0
                    };
                }),
            
            hourlyDistribution: getHourlyScanDistribution(eventScans)
        };
        
        res.json({ success: true, data: stats });
        
    } catch (err) {
        log.error('GET /api/events/:eventId/scan-stats', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

function getHourlyScanDistribution(scans) {
    const distribution = Array(24).fill(0);
    
    scans.forEach(scan => {
        const hour = new Date(scan.scannedAt).getHours();
        distribution[hour]++;
    });
    
    return distribution;
}
*/


// ──────────────────────────────────────────────────────────────
// 📊 HELPERS POUR TABLES
// ──────────────────────────────────────────────────────────────

const validateTable = (table) => {
    const errors = [];
   
    
    if (!table.tableName || table.tableName.trim().length < 2) {
        errors.push('Nom de table requis (min 2 caractères)');
    }
    
    const capacity = parseInt(table.capacity);
    if (isNaN(capacity) || capacity < 1) {
        errors.push('Capacité invalide (min 1)');
    }
    
    if (!table.eventId) {
        errors.push('eventId requis');
    }
    
    return { valid: errors.length === 0, errors };
};

const sanitizeTableData = (table) => {
    return {
        tableNumber: String(table.tableNumber || '').trim(),
        tableName: (table.tableName || '').trim(),
        capacity: parseInt(table.capacity) || 8,
        location: (table.location || '').trim(),
        category: (table.category || 'general').trim(),
        description: (table.description || '').trim(),
        eventId: table.eventId
    };
};

const initializeTable = (eventId, tableData) => {
    const now = new Date().toISOString();
    const sanitized = sanitizeTableData(tableData);
    
    // Générer le code d'accès table au format XX-YY
    const accessCode = generateTableAccessCode(sanitized.tableName);
    
    return {
        id: generateId('tbl'),
        ...sanitized,
        eventId,
        
        tableNumber: accessCode, 
        
        qrCode: {
            id: generateId('qr_tbl'),
            qrData: null,
            qrUrl: null,
            scanCount: 0,
            lastScan: null,
            createdAt: now
        },
        
        assignedGuests: [],
        guestCount: 0,
        
        content: {
            welcomeMessage: tableData.content?.welcomeMessage || `Bienvenue à la ${sanitized.tableName}`,
            menu: tableData.content?.menu || [],
            program: tableData.content?.program || [],
            specialNotes: tableData.content?.specialNotes || '',
            contactPerson: tableData.content?.contactPerson || '',
            ...tableData.content
        },
        
        status: 'active',
        isActive: true,
        
        createdAt: now,
        updatedAt: now
    };
};

const calculateTableStats = (table) => {
    const totalSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
    const availableSeats = Math.max(0, table.capacity - totalSeats);
    const occupancyRate = table.capacity > 0 ? Math.round((totalSeats / table.capacity) * 100) : 0;
    
    return {
        ...table,
        guestCount: table.assignedGuests.length,
        totalSeats,
        availableSeats,
        occupancyRate,
        isFull: totalSeats >= table.capacity
    };
};



// ──────────────────────────────────────────────────────────────
// 🏓 CRUD TABLES
// ──────────────────────────────────────────────────────────────

// CREATE TABLE
app.post('/api/events/:eventId/tables', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const tableData = req.body;
        
        const data = loadData();
        const event = data.events?.find(e => e.id === eventId);
        
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                error: 'Événement introuvable' 
            });
        }
        
        tableData.eventId = eventId;
        const validation = validateTable(tableData);
        
        if (!validation.valid) {
            log.warning('Validation table échouée', validation.errors.join(', '));
            return res.status(400).json({ 
                success: false, 
                errors: validation.errors 
            });
        }
        
        if (!data.tables) data.tables = [];
        
        const duplicate = data.tables.find(t => 
            t.eventId === eventId && 
            t.tableNumber === String(tableData.tableNumber).trim()
        );
        
        if (duplicate) {
            return res.status(400).json({ 
                success: false, 
                error: `Table ${tableData.tableNumber} existe déjà pour cet événement` 
            });
        }
        
        const table = initializeTable(eventId, tableData);
        
        const qrData = {
            t: 'TBL',
            e: eventId,
            tb: table.id,
            tn: table.tableNumber,
            d: new Date().toISOString()
        };
        
        table.qrCode.qrData = qrData;
        table.qrCode.qrUrl = `${CONFIG.BASE_URL}/table/${table.id}/info`;
        
        data.tables.push(table);
        saveData(data);
        
        log.crud('CREATE', 'table', { id: table.id, name: table.tableName });
        log.success('Table créée', `${table.tableName} (${table.tableNumber})`);
        
        res.status(201).json({ 
            success: true, 
            data: calculateTableStats(table),
            message: 'Table créée avec succès'
        });
    } catch (err) {
        log.error('POST /api/events/:eventId/tables', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE MULTIPLE TABLES
app.post('/api/events/:eventId/tables/bulk', jwtAuth, (req, res) => {
    try {
        const { eventId } = req.params;
        const { tables: rawTables } = req.body;
        
        if (!Array.isArray(rawTables) || rawTables.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Tableau "tables" requis et non vide'
            });
        }
        
        const data = loadData();
        const event = data.events?.find(e => e.id === eventId);
        
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                error: 'Événement introuvable' 
            });
        }
        
        if (!data.tables) data.tables = [];
        
        const created = [];
        const errors = [];
        
        rawTables.forEach((tableData, idx) => {
            try {
                tableData.eventId = eventId;
                
                const validation = validateTable(tableData);
                if (!validation.valid) {
                    errors.push({ index: idx, errors: validation.errors });
                    return;
                }
                
                // Vérifier doublon
                const duplicate = data.tables.find(t => 
                    t.eventId === eventId && 
                    t.tableNumber === String(tableData.tableNumber).trim()
                );
                
                if (duplicate) {
                    errors.push({ 
                        index: idx, 
                        errors: [`Table ${tableData.tableNumber} existe déjà`] 
                    });
                    return;
                }
                
                const table = initializeTable(eventId, tableData);
                
                // QR Code
                const qrData = {
                    t: 'TBL',
                    e: eventId,
                    tb: table.id,
                    tn: table.tableNumber,
                    d: new Date().toISOString()
                };
                
                table.qrCode.qrData = qrData;
                table.qrCode.qrUrl = `${CONFIG.BASE_URL}/table/${table.id}/info`;
                
                data.tables.push(table);
                created.push(table);
                
            } catch (e) {
                errors.push({ index: idx, error: e.message });
            }
        });
        
        saveData(data);
        
        log.crud('CREATE BULK', 'tables', { created: created.length, errors: errors.length });
        log.success('Tables créées en masse', `${created.length}/${rawTables.length}`);
        
        res.status(201).json({
            success: true,
            data: created.map(calculateTableStats),
            count: created.length,
            errors: errors.length > 0 ? errors : undefined,
            message: `${created.length} table(s) créée(s)`
        });
    } catch (err) {
        log.error('POST /api/events/:eventId/tables/bulk', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET ALL TABLES BY EVENT
app.get('/api/events/:eventId/tables', (req, res) => {
    try {
        const { eventId } = req.params;
        const { status, category, available } = req.query;
        
        const data = loadData();
        const event = data.events?.find(e => e.id === eventId);
        
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                error: 'Événement introuvable' 
            });
        }
        
        let tables = (data.tables || []).filter(t => t.eventId === eventId);
        
        // Filtres
        if (status) {
            tables = tables.filter(t => t.status === status);
        }
        
        if (category) {
            tables = tables.filter(t => t.category === category);
        }
        
        if (available === 'true') {
            tables = tables.filter(t => {
                const totalSeats = t.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                return totalSeats < t.capacity;
            });
        }
        
        // Tri par numéro de table
        tables.sort((a, b) => {
            const numA = parseInt(a.tableNumber) || 0;
            const numB = parseInt(b.tableNumber) || 0;
            return numA - numB;
        });
        
        const tablesWithStats = tables.map(calculateTableStats);
        
        log.crud('READ', 'tables', { eventId, count: tables.length });
        
        res.json({ 
            success: true, 
            data: tablesWithStats,
            count: tables.length,
            event: {
                id: event.id,
                name: event.name
            }
        });
    } catch (err) {
        log.error('GET /api/events/:eventId/tables', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// GET TABLE BY ID
app.get('/api/tables/:id', (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        log.crud('READ', 'table', { id: table.id, name: table.tableName });
        
        res.json({ 
            success: true, 
            data: calculateTableStats(table) 
        });
    } catch (err) {
        log.error('GET /api/tables/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// UPDATE TABLE (complet)
app.put('/api/tables/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const index = (data.tables || []).findIndex(t => t.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const existingTable = data.tables[index];
        const updates = { ...req.body, eventId: existingTable.eventId };
        
        const validation = validateTable(updates);
        if (!validation.valid) {
            return res.status(400).json({ 
                success: false, 
                errors: validation.errors 
            });
        }
        
        const updatedTable = {
            ...existingTable,
            ...sanitizeTableData(updates),
            id: req.params.id,
            updatedAt: new Date().toISOString(),
            
            // Fusionner content
            content: {
                ...existingTable.content,
                ...updates.content
            }
        };
        
        data.tables[index] = updatedTable;
        saveData(data);
        
        log.crud('UPDATE', 'table', { id: updatedTable.id, name: updatedTable.tableName });
        
        res.json({ 
            success: true, 
            data: calculateTableStats(data.tables[index]),
            message: 'Table mise à jour'
        });
    } catch (err) {
        log.error('PUT /api/tables/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH TABLE (partiel)
app.patch('/api/tables/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const index = (data.tables || []).findIndex(t => t.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const table = data.tables[index];
        const updates = req.body;
        
        // Mise à jour profonde
        Object.keys(updates).forEach(key => {
            if (key === 'content' && typeof updates[key] === 'object') {
                table.content = { ...table.content, ...updates[key] };
            } else if (key === 'qrCode' && typeof updates[key] === 'object') {
                table.qrCode = { ...table.qrCode, ...updates[key] };
            } else if (key !== 'id' && key !== 'eventId') {
                table[key] = updates[key];
            }
        });
        
        table.updatedAt = new Date().toISOString();
        saveData(data);
        
        log.crud('PATCH', 'table', { id: req.params.id, fields: Object.keys(updates) });
        
        res.json({ 
            success: true, 
            data: calculateTableStats(table),
            message: 'Table mise à jour'
        });
    } catch (err) {
        log.error('PATCH /api/tables/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE TABLE
app.delete('/api/tables/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        // Libérer les invités assignés
        const guestIds = table.assignedGuests.map(g => g.guestId);
        
        if (data.guests) {
            data.guests.forEach(guest => {
                if (guestIds.includes(guest.id)) {
                    guest.tableId = null;
                    guest.tableNumber = null;
                    guest.assignedAt = null;
                }
            });
        }
        
        data.tables = data.tables.filter(t => t.id !== req.params.id);
        saveData(data);
        
        log.crud('DELETE', 'table', { id: req.params.id, name: table.tableName });
        log.warning('Table supprimée', `${table.tableName} - ${guestIds.length} invités libérés`);
        
        res.json({ 
            success: true, 
            deleted: 1,
            guestsFreed: guestIds.length,
            message: 'Table supprimée'
        });
    } catch (err) {
        log.error('DELETE /api/tables/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// 👥 GESTION DES INVITÉS SUR LES TABLES
// ──────────────────────────────────────────────────────────────

// ASSIGN GUEST TO TABLE
// ASSIGN GUEST TO TABLE
app.post('/api/tables/:id/assign-guest', jwtAuth, (req, res) => {
    try {
        const { guestId, seats } = req.body;
        
        if (!guestId) {
            return res.status(400).json({ 
                success: false, 
                error: 'guestId requis' 
            });
        }
        
        const data = loadData();
        
        // Rechercher la table par ID
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            console.log(`Table ${req.params.id} non trouvée. Tables disponibles:`, 
                data.tables?.map(t => ({ id: t.id, tableNumber: t.tableNumber })));
            
            return res.status(404).json({ 
                success: false, 
                error: `Table introuvable (ID: ${req.params.id})` 
            });
        }
        
        // Rechercher l'invité
        const guest = (data.guests || []).find(g => g.id === guestId);
        
        if (!guest) {
            return res.status(404).json({ 
                success: false, 
                error: `Invité introuvable (ID: ${guestId})` 
            });
        }
        
        // Vérifier que l'invité appartient au même événement
        if (guest.eventId && table.eventId && guest.eventId !== table.eventId) {
            return res.status(400).json({ 
                success: false, 
                error: 'L\'invité et la table n\'appartiennent pas au même événement' 
            });
        }
        
        // Vérifier si déjà assigné à cette table
        const alreadyAssigned = (table.assignedGuests || []).find(g => g.guestId === guestId);
        if (alreadyAssigned) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invité déjà assigné à cette table' 
            });
        }
        
        // Vérifier capacité
        const requestedSeats = parseInt(seats) || guest.seats || 1;
        const currentSeats = (table.assignedGuests || []).reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = (table.capacity || 0) - currentSeats;
        
        if (requestedSeats > availableSeats) {
            return res.status(400).json({ 
                success: false, 
                error: `Places insuffisantes (${availableSeats} disponible(s), ${requestedSeats} demandée(s))` 
            });
        }
        
        // Libérer de l'ancienne table si nécessaire
        if (guest.tableId) {
            const oldTable = data.tables.find(t => t.id === guest.tableId);
            if (oldTable) {
                oldTable.assignedGuests = (oldTable.assignedGuests || []).filter(g => g.guestId !== guestId);
                oldTable.updatedAt = new Date().toISOString();
            }
        }
        
        // Assigner à la nouvelle table
        const now = new Date().toISOString();
        
        // Initialiser assignedGuests si vide
        if (!table.assignedGuests) table.assignedGuests = [];
        
        table.assignedGuests.push({
            guestId: guest.id,
            guestName: `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email,
            seats: requestedSeats,
            assignedAt: now,
            assignedBy: req.user?.id || 'system'
        });
        
        // Mettre à jour l'invité
        guest.tableId = table.id;
        guest.tableNumber = table.tableNumber;
        guest.assignedAt = now;
        guest.seats = requestedSeats;
        guest.updatedAt = now;
        
        // Mettre à jour la table
        table.updatedAt = now;
        
        saveData(data);
        
        log.crud('ASSIGN', 'guest to table', { 
            guest: guest.email, 
            table: table.tableName || table.tableNumber,
            seats: requestedSeats
        });
        
        // Calculer les statistiques mises à jour
        const updatedTable = calculateTableStats(table);
        
        res.json({ 
            success: true, 
            data: {
                table: updatedTable,
                guest: {
                    id: guest.id,
                    name: `${guest.firstName} ${guest.lastName}`.trim(),
                    email: guest.email,
                    seats: guest.seats,
                    tableId: guest.tableId,
                    tableNumber: guest.tableNumber
                }
            },
            message: `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email + 
                     ` assigné(e) à la table ${table.tableNumber}`
        });
        
    } catch (err) {
        log.error('POST /api/tables/:id/assign-guest', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// REMOVE GUEST FROM TABLE
app.delete('/api/tables/:id/remove-guest/:guestId', jwtAuth, (req, res) => {
    try {
        const { id: tableId, guestId } = req.params;
        
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === tableId);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const guestIndex = table.assignedGuests.findIndex(g => g.guestId === guestId);
        
        if (guestIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Invité non assigné à cette table' 
            });
        }
        
        const removedGuest = table.assignedGuests.splice(guestIndex, 1)[0];
        
        // Mettre à jour l'invité
        const guest = (data.guests || []).find(g => g.id === guestId);
        if (guest) {
            guest.tableId = null;
            guest.tableNumber = null;
            guest.assignedAt = null;
        }
        
        table.updatedAt = new Date().toISOString();
        saveData(data);
        
        log.crud('REMOVE', 'guest from table', { 
            guest: removedGuest.guestName, 
            table: table.tableName 
        });
        
        res.json({ 
            success: true, 
            data: {
                table: calculateTableStats(table),
                removedGuest
            },
            message: 'Invité retiré de la table'
        });
    } catch (err) {
        log.error('DELETE /api/tables/:id/remove-guest/:guestId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ASSIGN MULTIPLE GUESTS
app.post('/api/tables/:id/assign-multiple', jwtAuth, (req, res) => {
    try {
        const { guestIds } = req.body;
        
        if (!Array.isArray(guestIds) || guestIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tableau guestIds requis' 
            });
        }
        
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const assigned = [];
        const errors = [];
        
        guestIds.forEach((guestId, idx) => {
            try {
                const guest = data.guests?.find(g => g.id === guestId);
                
                if (!guest) {
                    errors.push({ index: idx, guestId, error: 'Invité introuvable' });
                    return;
                }
                
                if (table.assignedGuests.find(g => g.guestId === guestId)) {
                    errors.push({ index: idx, guestId, error: 'Déjà assigné' });
                    return;
                }
                
                const seats = guest.seats || 1;
                const currentSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                const availableSeats = table.capacity - currentSeats;
                
                if (seats > availableSeats) {
                    errors.push({ index: idx, guestId, error: 'Places insuffisantes' });
                    return;
                }
                
                const now = new Date().toISOString();
                
                table.assignedGuests.push({
                    guestId: guest.id,
                    guestName: `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email,
                    seats,
                    assignedAt: now,
                    assignedBy: req.user?.id || 'system'
                });
                
                guest.tableId = table.id;
                guest.tableNumber = table.tableNumber;
                guest.assignedAt = now;
                
                assigned.push(guest);
                
            } catch (e) {
                errors.push({ index: idx, guestId, error: e.message });
            }
        });
        
        table.updatedAt = new Date().toISOString();
        saveData(data);
        
        log.crud('ASSIGN MULTIPLE', 'guests to table', { 
            table: table.tableName,
            assigned: assigned.length 
        });
        
        res.json({ 
            success: true, 
            data: {
                table: calculateTableStats(table),
                assigned
            },
            count: assigned.length,
            errors: errors.length > 0 ? errors : undefined,
            message: `${assigned.length} invité(s) assigné(s)`
        });
    } catch (err) {
        log.error('POST /api/tables/:id/assign-multiple', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.post('/api/tables/:id/assign-bulk', jwtAuth, (req, res) => {
  try {
    const { guestIds, autoAssignSeats = false } = req.body;
    
    if (!Array.isArray(guestIds) || guestIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tableau guestIds requis et non vide' 
      });
    }
    
    const data = loadData();
    const table = (data.tables || []).find(t => t.id === req.params.id);
    
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        error: 'Table introuvable' 
      });
    }
    
    const assigned = [];
    const errors = [];
    const now = new Date().toISOString();
    
    // Calculer les places actuellement utilisées
    const currentSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
    let availableSeats = table.capacity - currentSeats;
    
    guestIds.forEach((guestId, idx) => {
      try {
        const guest = data.guests.find(g => g.id === guestId);
        
        if (!guest) {
          errors.push({ index: idx, guestId, error: 'Invité introuvable' });
          return;
        }
        
        // Vérifier si déjà assigné à cette table
        const alreadyAssigned = table.assignedGuests.find(g => g.guestId === guestId);
        if (alreadyAssigned) {
          errors.push({ index: idx, guestId, error: 'Déjà assigné à cette table' });
          return;
        }
        
        // Calculer les places nécessaires
        const requiredSeats = autoAssignSeats ? 1 : (guest.seats || 1);
        
        // Vérifier la capacité
        if (requiredSeats > availableSeats) {
          errors.push({ 
            index: idx, 
            guestId, 
            error: `Places insuffisantes (${availableSeats} disponible(s))` 
          });
          return;
        }
        
        // Retirer de l'ancienne table si nécessaire
        if (guest.tableId && guest.tableId !== table.id) {
          const oldTable = data.tables.find(t => t.id === guest.tableId);
          if (oldTable) {
            oldTable.assignedGuests = oldTable.assignedGuests.filter(g => g.guestId !== guestId);
            oldTable.updatedAt = now;
          }
        }
        
        // Ajouter à la nouvelle table
        table.assignedGuests.push({
          guestId: guest.id,
          guestName: `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email,
          seats: requiredSeats,
          assignedAt: now,
          assignedBy: req.user?.id || 'system'
        });
        
        // Mettre à jour l'invité
        guest.tableId = table.id;
        guest.tableNumber = table.tableNumber;
        guest.assignedAt = now;
        guest.seats = requiredSeats;
        guest.updatedAt = now;
        
        availableSeats -= requiredSeats;
        assigned.push(guest);
        
      } catch (e) {
        errors.push({ index: idx, guestId, error: e.message });
      }
    });
    
    table.updatedAt = now;
    saveData(data);
    
    log.crud('ASSIGN BULK', 'guests to table', { 
      table: table.tableName,
      assigned: assigned.length,
      errors: errors.length
    });
    
    res.json({ 
      success: true, 
      data: {
        table: calculateTableStats(table),
        assigned,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `${assigned.length} invité(s) assigné(s) à la table ${table.tableNumber}`
    });
  } catch (err) {
    log.error('POST /api/tables/:id/assign-bulk', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// REASSIGN GUEST
app.patch('/api/tables/:id/reassign-guest', jwtAuth, (req, res) => {
    try {
        const { guestId, newTableId } = req.body;
        const currentTableId = req.params.id;

        if (!guestId || !newTableId) {
            return res.status(400).json({ 
                success: false, 
                error: 'guestId et newTableId sont requis' 
            });
        }

        const data = loadData();
        
        // 1. Trouver les deux tables et l'invité
        const oldTable = (data.tables || []).find(t => t.id === currentTableId);
        const newTable = (data.tables || []).find(t => t.id === newTableId);
        const guest = (data.guests || []).find(g => g.id === guestId);

        if (!oldTable || !newTable || !guest) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table source, table destination ou invité introuvable' 
            });
        }

        // 2. Vérifier si l'invité est bien sur la table source
        const assignedInfo = oldTable.assignedGuests.find(g => g.guestId === guestId);
        if (!assignedInfo) {
            return res.status(400).json({ 
                success: false, 
                error: 'L\'invité n\'est pas assigné à la table source' 
            });
        }

        // 3. Vérifier la capacité de la nouvelle table
        const requestedSeats = assignedInfo.seats || guest.seats || 1;
        const currentSeatsInNewTable = newTable.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableInNew = newTable.capacity - currentSeatsInNewTable;

        if (requestedSeats > availableInNew) {
            return res.status(400).json({ 
                success: false, 
                error: `Places insuffisantes sur la nouvelle table (${availableInNew} disponible(s))` 
            });
        }

        const now = new Date().toISOString();

        // 4. Action : Retirer de l'ancienne table
        oldTable.assignedGuests = oldTable.assignedGuests.filter(g => g.guestId !== guestId);
        oldTable.updatedAt = now;

        // 5. Action : Ajouter à la nouvelle table
        newTable.assignedGuests.push({
            ...assignedInfo,
            assignedAt: now,
            assignedBy: req.user?.id || 'system'
        });
        newTable.updatedAt = now;

        // 6. Action : Mettre à jour l'objet invité
        guest.tableId = newTable.id;
        guest.tableNumber = newTable.tableNumber;
        guest.assignedAt = now;

        saveData(data);

        log.crud('REASSIGN', 'guest moved', { 
            guest: guest.email, 
            from: oldTable.tableName, 
            to: newTable.tableName 
        });

        res.json({
            success: true,
            data: {
                guest,
                sourceTable: calculateTableStats(oldTable),
                destinationTable: calculateTableStats(newTable)
            },
            message: `Invité déplacé vers la table ${newTable.tableNumber}`
        });

    } catch (err) {
        log.error('PATCH /api/tables/:id/reassign-guest', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// OBTENIR LES INVITÉS D'UNE TABLE (COMPLET)
app.get('/api/tables/:id/guests-full', (req, res) => {
    try {
        const data = loadData();
        const table = data.tables.find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({
                success: false,
                error: 'Table introuvable'
            });
        }
        
        const event = data.events.find(e => e.id === table.eventId);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                error: 'Événement introuvable'
            });
        }
        
        // Récupérer les invités avec leurs données complètes
        const guests = table.assignedGuests.map(assignment => {
            const guest = data.guests.find(g => g.id === assignment.guestId);
            
            if (!guest) return null;
            
            return {
                assignment: {
                    seats: assignment.seats,
                    assignedAt: assignment.assignedAt,
                    assignedBy: assignment.assignedBy
                },
                guest: {
                    id: guest.id,
                    firstName: guest.firstName,
                    lastName: guest.lastName,
                    email: guest.email,
                    phone: guest.phone,
                    company: guest.company,
                    seats: guest.seats,
                    status: guest.status,
                    scanned: guest.scanned,
                    scannedAt: guest.scannedAt,
                    scanCount: guest.scanCount,
                    accessCode: guest.accessCode ? '***' : null, // Masqué pour sécurité
                    metadata: guest.metadata
                }
            };
        }).filter(item => item !== null);
        
        res.json({
            success: true,
            data: {
                table: {
                    id: table.id,
                    tableNumber: table.tableNumber,
                    tableName: table.tableName,
                    capacity: table.capacity,
                    location: table.location,
                    category: table.category
                },
                event: {
                    id: event.id,
                    name: event.name,
                    date: event.date,
                    location: event.location
                },
                guests: guests,
                stats: {
                    totalGuests: guests.length,
                    totalSeats: guests.reduce((sum, g) => sum + (g.assignment.seats || 1), 0),
                    scannedGuests: guests.filter(g => g.guest.scanned).length,
                    confirmedGuests: guests.filter(g => g.guest.status === GUEST_STATUS.CONFIRMED).length
                }
            }
        });
        
    } catch (err) {
        log.error('GET /api/tables/:id/guests-full', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// 📱 QR CODE DE TABLE
// ──────────────────────────────────────────────────────────────

// GET TABLE QR CODE
app.get('/api/tables/:id/qr', (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        log.crud('READ', 'table qr', { tableId: table.id });
        
        res.json({ 
            success: true, 
            data: table.qrCode,
            table: {
                id: table.id,
                tableName: table.tableName,
                tableNumber: table.tableNumber
            }
        });
    } catch (err) {
        log.error('GET /api/tables/:id/qr', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// REGENERATE TABLE QR CODE
app.post('/api/tables/:id/qr/regenerate', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const now = new Date().toISOString();
        
        // Nouveau QR
        const qrData = {
            t: 'TBL',
            e: table.eventId,
            tb: table.id,
            tn: table.tableNumber,
            d: now
        };
        
        table.qrCode = {
            id: generateId('qr_tbl'),
            qrData,
            qrUrl: `${CONFIG.BASE_URL}/table/${table.id}/info`,
            scanCount: 0,
            lastScan: null,
            createdAt: now
        };
        
        table.updatedAt = now;
        saveData(data);
        
        log.crud('REGENERATE', 'table qr', { tableId: table.id });
        log.success('QR régénéré', table.tableName);
        
        res.json({ 
            success: true, 
            data: table.qrCode,
            message: 'QR Code régénéré'
        });
    } catch (err) {
        log.error('POST /api/tables/:id/qr/regenerate', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// SCAN TABLE QR CODE
app.post('/api/tables/:id/qr/scan', (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const now = new Date().toISOString();
        
        table.qrCode.scanCount++;
        table.qrCode.lastScan = now;
        table.updatedAt = now;
        
        saveData(data);
        
        log.crud('SCAN', 'table qr', { table: table.tableName });
        
        res.json({ 
            success: true, 
            data: {
                table: calculateTableStats(table),
                content: table.content,
                scanInfo: {
                    scanCount: table.qrCode.scanCount,
                    lastScan: table.qrCode.lastScan
                }
            },
            message: `QR scanné - ${table.tableName}`
        });
    } catch (err) {
        log.error('POST /api/tables/:id/qr/scan', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// 📊 STATISTIQUES & UTILITAIRES
// ──────────────────────────────────────────────────────────────

// GET TABLE STATISTICS
app.get('/api/tables/:id/statistics', (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const totalSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = Math.max(0, table.capacity - totalSeats);
        
        const stats = {
            table: {
                id: table.id,
                tableName: table.tableName,
                tableNumber: table.tableNumber,
                capacity: table.capacity
            },
            occupancy: {
                totalGuests: table.assignedGuests.length,
                totalSeats,
                availableSeats,
                occupancyRate: table.capacity > 0 ? Math.round((totalSeats / table.capacity) * 100) : 0,
                isFull: totalSeats >= table.capacity
            },
            qr: {
                scanCount: table.qrCode.scanCount,
                lastScan: table.qrCode.lastScan,
                qrUrl: table.qrCode.qrUrl
            },
            guests: table.assignedGuests.map(g => ({
                guestId: g.guestId,
                guestName: g.guestName,
                seats: g.seats,
                assignedAt: g.assignedAt
            })),
            timeline: {
                createdAt: table.createdAt,
                updatedAt: table.updatedAt
            }
        };
        
        res.json({ success: true, data: stats });
    } catch (err) {
        log.error('GET /api/tables/:id/statistics', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET ALL TABLES STATISTICS FOR EVENT
app.get('/api/events/:eventId/tables/stats', (req, res) => {
    try {
        const { eventId } = req.params;
        
        const data = loadData();
        const event = data.events?.find(e => e.id === eventId);
        
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                error: 'Événement introuvable' 
            });
        }
        
        const tables = (data.tables || []).filter(t => t.eventId === eventId);
        
        let totalCapacity = 0;
        let totalAssigned = 0;
        let totalGuests = 0;
        let fullTables = 0;
        let emptyTables = 0;
        
        tables.forEach(table => {
            const seats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
            
            totalCapacity += table.capacity;
            totalAssigned += seats;
            totalGuests += table.assignedGuests.length;
            
            if (seats >= table.capacity) fullTables++;
            if (seats === 0) emptyTables++;
        });
        
        const stats = {
            event: {
                id: event.id,
                name: event.name
            },
            overview: {
                totalTables: tables.length,
                totalCapacity,
                totalAssigned,
                totalGuests,
                availableSeats: totalCapacity - totalAssigned,
                overallOccupancy: totalCapacity > 0 ? 
                    Math.round((totalAssigned / totalCapacity) * 100) : 0
            },
            distribution: {
                fullTables,
                emptyTables,
                partiallyFull: tables.length - fullTables - emptyTables
            },
            tables: tables.map(t => {
                const seats = t.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                return {
                    id: t.id,
                    tableNumber: t.tableNumber,
                    tableName: t.tableName,
                    capacity: t.capacity,
                    assigned: seats,
                    available: t.capacity - seats,
                    occupancyRate: t.capacity > 0 ? Math.round((seats / t.capacity) * 100) : 0,
                    guestCount: t.assignedGuests.length
                };
            }).sort((a, b) => {
                const numA = parseInt(a.tableNumber) || 0;
                const numB = parseInt(b.tableNumber) || 0;
                return numA - numB;
            })
        };
        
        res.json({ success: true, data: stats });
    } catch (err) {
        log.error('GET /api/events/:eventId/tables/stats', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET TABLE GUESTS
app.get('/api/tables/:id/guests', (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        const guests = table.assignedGuests.map(ag => {
            const fullGuest = data.guests?.find(g => g.id === ag.guestId);
            
            return {
                ...ag,
                guest: fullGuest,
            };
        });
        
        res.json({ 
            success: true, 
            data: guests,
            count: guests.length,
            table: {
                id: table.id,
                tableName: table.tableName,
                tableNumber: table.tableNumber
            }
        });
    } catch (err) {
        log.error('GET /api/tables/:id/guests', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE TABLE CONTENT
app.patch('/api/tables/:id/content', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const table = (data.tables || []).find(t => t.id === req.params.id);
        
        if (!table) {
            return res.status(404).json({ 
                success: false, 
                error: 'Table introuvable' 
            });
        }
        
        table.content = {
            ...table.content,
            ...req.body
        };
        
        table.updatedAt = new Date().toISOString();
        saveData(data);
        
        log.crud('UPDATE', 'table content', { tableId: table.id });
        
        res.json({ 
            success: true, 
            data: table.content,
            message: 'Contenu mis à jour'
        });
    } catch (err) {
        log.error('PATCH /api/tables/:id/content', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// AUTO-ASSIGN GUESTS (Intelligent)
app.post('/api/tables/auto-assign', jwtAuth, (req, res) => {
    try {
        const { eventId, strategy = 'balanced' } = req.body;
        
        if (!eventId) {
            return res.status(400).json({ 
                success: false, 
                error: 'eventId requis' 
            });
        }
        
        const data = loadData();
        const event = data.events?.find(e => e.id === eventId);
        
        if (!event) {
            return res.status(404).json({ 
                success: false, 
                error: 'Événement introuvable' 
            });
        }
        
        const tables = (data.tables || []).filter(t => t.eventId === eventId);
        const unassignedGuests = (data.guests || []).filter(g => 
            g.eventId === eventId && !g.tableId
        );
        
        if (tables.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Aucune table disponible' 
            });
        }
        
        if (unassignedGuests.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Tous les invités sont déjà assignés',
                assigned: 0
            });
        }
        
        const assigned = [];
        const errors = [];
        const now = new Date().toISOString();
        
        // Tri tables par places disponibles (décroissant)
        const sortedTables = tables
            .map(t => {
                const seats = t.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                return {
                    ...t,
                    availableSeats: t.capacity - seats
                };
            })
            .filter(t => t.availableSeats > 0)
            .sort((a, b) => {
                if (strategy === 'fill') {
                    // Remplir tables existantes d'abord
                    return (b.capacity - b.availableSeats) - (a.capacity - a.availableSeats);
                }
                // balanced: répartir uniformément
                return b.availableSeats - a.availableSeats;
            });
        
        let tableIndex = 0;
        
        for (const guest of unassignedGuests) {
            const seats = guest.seats || 1;
            let placed = false;
            
            // Essayer de placer l'invité
            for (let i = 0; i < sortedTables.length; i++) {
                const currentTable = sortedTables[(tableIndex + i) % sortedTables.length];
                
                if (currentTable.availableSeats >= seats) {
                    // Placer l'invité
                    const table = data.tables.find(t => t.id === currentTable.id);
                    
                    table.assignedGuests.push({
                        guestId: guest.id,
                        guestName: `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email,
                        seats,
                        assignedAt: now,
                        assignedBy: guest.id
                    });
                    table.guestCount = table.assignedGuests.length;
                    
                    guest.tableId = table.id;
                    guest.tableNumber = table.tableNumber;
                    guest.assignedAt = now;
                    
                    currentTable.availableSeats -= seats;
                    assigned.push({ guest: guest.id, table: table.id });
                    placed = true;
                    
                    tableIndex = (tableIndex + 1) % sortedTables.length;
                    break;
                }
            }
            
            if (!placed) {
                errors.push({ 
                    guestId: guest.id, 
                    error: 'Aucune table avec places suffisantes' 
                });
            }
        }
        
        saveData(data);
        
        log.crud('AUTO-ASSIGN', 'guests', { 
            strategy, 
            assigned: assigned.length,
            errors: errors.length
        });
        
        res.json({ 
            success: true, 
            data: {
                assigned,
                errors: errors.length > 0 ? errors : undefined
            },
            count: assigned.length,
            message: `${assigned.length} invité(s) assigné(s) automatiquement`
        });
    } catch (err) {
        log.error('POST /api/tables/auto-assign', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// VÉRIFIER UN CODE D'ACCÈS
app.post('/api/verify-access-code', (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code || code.length !== 4) {
            return res.status(400).json({
                success: false,
                error: 'Code invalide. 4 chiffres requis.'
            });
        }
        
        const data = loadData();
        
        // Chercher un invité avec ce code d'accès
        const guest = data.guests.find(g => g.accessCode === code);
        
        if (!guest) {
            log.warning('Code invalide', `Code: ${code}`);
            return res.status(400).json({
                success: false,
                error: 'Code invalide'
            });
        }
        
       
        
        // Récupérer l'événement
        const event = data.events.find(e => e.id === guest.eventId);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                error: 'Événement introuvable'
            });
        }
        
        log.success('Code vérifié', `${guest.firstName} ${guest.lastName} - ${event.name}`);
        
        res.json({
            success: true,
            data: {
                guestId: guest.id,
                guestName: `${guest.firstName} ${guest.lastName}`,
                guestEmail: guest.email,
                eventId: event.id,
                eventName: event.name,
                tableId: guest.tableId,
                accessCode: guest.accessCode,
                guest: guest,
                event: event,
                requiresPersonalCode: true
            }
        });
        
    } catch (err) {
        log.error('POST /api/verify-access-code', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// VÉRIFIER UN CODE D'ACCÈS TABLE
app.post('/api/verify-table-access-code', (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code || code.length !== 5) {
            return res.status(400).json({
                success: false,
                error: 'Code invalide. 4 caractères requis.'
            });
        }
        
        const data = loadData();
        
        // Chercher une table avec ce code d'accès
        const table = data.tables.find(t => t.tableNumber === code.toUpperCase());
        
        if (!table) {
            log.warning('Code table invalide', `Code: ${code}`);
            return res.status(404).json({
                success: false,
                error: 'Code table invalide'
            });
        }
        
        // Vérifier que l'événement est actif
        const event = data.events.find(e => e.id === table.eventId);
        
        if (!event || event.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Cette table n\'est pas disponible actuellement'
            });
        }
        
        log.success('Code table vérifié', `${table.tableName} - ${event.name}`);
        
        res.json({
            success: true,
            data: {
                tableId: table.id,
                event: event,
                tableNumber: table.tableNumber,
                tableName: table.tableName,
                eventId: event.id,
                eventName: event.name,
                capacity: table.capacity,
                ...calculateTableStats(table)
            }
        });
        
    } catch (err) {
        log.error('POST /api/verify-table-access-code', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// VÉRIFIER UN NUMÉRO DE TABLE
app.get('/api/tables/number/:number', (req, res) => {
    try {
        const tableNumber = req.params.number.toUpperCase();
        
        const data = loadData();
        
        const table = data.tables.find(t => 
            t.tableNumber.toUpperCase() === tableNumber
        );
        
        if (!table) {
            return res.status(404).json({
                success: false,
                error: `Table "${tableNumber}" introuvable`
            });
        }
        
        const event = data.events.find(e => e.id === table.eventId);
        
        if (!event || event.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Cette table n\'est pas disponible actuellement'
            });
        }
        
        log.crud('READ', 'table by number', { number: tableNumber });
        
        res.json({
            success: true,
            data: calculateTableStats(table)
        });
        
    } catch (err) {
        log.error('GET /api/tables/number/:number', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// server.js - Endpoints simplifiés (JWT décrypté côté serveur uniquement)

// 1. CRÉER UNE SESSION (retourne JWT seulement)
app.post('/api/event-sessions', (req, res) => {
    try {
        const { guestId, tableId } = req.body;
        
        console.log('📱 POST /api/event-sessions - Données:', { guestId, tableId });
        
        // Validation
        if (!tableId && !guestId) {
            return res.status(400).json({ 
                success: false, 
                error: 'tableId ou guestId requis',
                code: 'MISSING_REQUIRED_FIELD'
            });
        }
        
        const data = loadData();
        let eventId = null;
        
        // Vérifier les références
        if (tableId) {
            const table = data.tables.find(t => t.id === tableId);
            if (!table) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Table introuvable',
                    code: 'TABLE_NOT_FOUND'
                });
            }
            eventId = table.eventId;
        }
        
        if (guestId) {
            const guest = data.guests.find(g => g.id === guestId);
            if (!guest) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invité introuvable',
                    code: 'GUEST_NOT_FOUND'
                });
            }
            if (!eventId) eventId = guest.eventId;
        }
        
        // Générer session ID
        const sessionId = generateId('sess');
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
        
        // Créer JWT (NE PAS envoyer les données complètes dans le payload)
        const token = jwt.sign(
            {
                sessionId: sessionId,
                guestId: guestId || null,
                tableId: tableId || null,
                eventId: eventId,
                accessMethod: guestId ? 'guest' : 'table',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(expiresAt.getTime() / 1000)
            },
            process.env.JWT_SECRET
        );
        
        // Enregistrer la session dans la base (optionnel pour tracking)
        if (!data.eventSessions) data.eventSessions = [];
        data.eventSessions.push({
            id: sessionId,
            guestId,
            tableId,
            eventId,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        });
        saveData(data);
        
        console.log('✅ Session créée:', { sessionId, guestId, tableId, eventId });
        
        res.json({
            success: true,
            data: { 
                token: token,  // SEULEMENT le token
                expiresAt: expiresAt.toISOString()
            },
            message: 'Session créée avec succès'
        });
        
    } catch (err) {
        console.error('❌ Erreur création session:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur interne du serveur',
            code: 'SERVER_ERROR'
        });
    }
});

// 2. VÉRIFIER UN TOKEN DE SESSION (retourne IDs seulement)
app.post('/api/event-sessions/verify-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token manquant',
                code: 'MISSING_TOKEN'
            });
        }
        
        // Décrypter JWT côté serveur uniquement
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Retourner SEULEMENT les IDs
        res.json({
            success: true,
            data: {
                sessionId: decoded.sessionId,
                guestId: decoded.guestId,
                tableId: decoded.tableId,
                eventId: decoded.eventId,
                accessMethod: decoded.accessMethod,
                expiresAt: new Date(decoded.exp * 1000).toISOString()
            }
        });
        
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token expiré',
                code: 'TOKEN_EXPIRED',
                expiredAt: new Date(err.expiredAt).toISOString()
            });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token invalide',
                code: 'INVALID_TOKEN'
            });
        }
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur',
            code: 'SERVER_ERROR'
        });
    }
});

// 3. RÉCUPÉRER LES DONNÉES COMPLÈTES D'UNE SESSION (pour le frontend)
app.get('/api/event-sessions/details', (req, res) => {
    try {
        // Récupérer le token du header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Token manquant',
                code: 'MISSING_TOKEN'
            });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const data = loadData();
        let guest = null;
        let table = null;
        let event = null;
        
        // Récupérer les données via leurs IDs
        if (decoded.guestId) {
            guest = data.guests.find(g => g.id === decoded.guestId);
        }
        
        if (decoded.tableId) {
            table = data.tables.find(t => t.id === decoded.tableId);
        }
        
        if (decoded.eventId) {
            event = data.events.find(e => e.id === decoded.eventId);
        }
        
        // Retourner les données COMPLÈTES (pour le frontend après authentification)
        res.json({
            success: true,
            data: {
                sessionId: decoded.sessionId,
                guest: guest,
                table: table,
                event: event,
                accessMethod: decoded.accessMethod,
                expiresAt: new Date(decoded.exp * 1000).toISOString(),
                isAnonymous: !decoded.guestId
            }
        });
        
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Session invalide ou expirée',
                code: 'INVALID_SESSION'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Erreur serveur',
            code: 'SERVER_ERROR'
        });
    }
});

// 4. SUPPRIMER UNE SESSION (logout)
app.delete('/api/event-sessions/logout', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(400).json({
                success: false,
                error: 'Token manquant',
                code: 'MISSING_TOKEN'
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                error: 'Token invalide ou expiré',
                code: 'INVALID_TOKEN'
            });
        }
        
        const data = loadData();
        
        if (!data.eventSessions || !Array.isArray(data.eventSessions)) {
            return res.json({
                success: true,
                message: 'Aucune session à supprimer',
                data: {
                    removedCount: 0,
                    logoutAt: new Date().toISOString()
                }
            });
        }
        
        const initialLength = data.eventSessions.length;
        
        // Filtrer par sessionId
        data.eventSessions = data.eventSessions.filter(
            session => session.id !== decoded.sessionId
        );
        
        const removedCount = initialLength - data.eventSessions.length;
        
        if (removedCount > 0) {
            // Sauvegarder les données modifiées
            saveData(data);
            console.log('✅ Session supprimée:', { sessionId: decoded.sessionId, removedCount });
            
            return res.json({
                success: true,
                message: 'Session supprimée avec succès',
                data: {
                    sessionId: decoded.sessionId,
                    removedCount: removedCount,
                    logoutAt: new Date().toISOString()
                }
            });
        } else {
            console.log('⚠️ Session non trouvée:', { sessionId: decoded.sessionId });
            return res.status(404).json({
                success: false,
                error: 'Session introuvable',
                message: 'Le sessionId n\'existe pas ou a déjà été supprimé',
                code: 'SESSION_NOT_FOUND'
            });
        }
        
    } catch (err) {
        console.error('❌ Erreur suppression session:', err);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la suppression de la session',
            code: 'SERVER_ERROR'
        });
    }
});



// GET GUEST TABLE INFO
app.get('/api/guests/:id/table', (req, res) => {
    try {
        const data = loadData();
        const guest = (data.guests || []).find(g => g.id === req.params.id);
        
        if (!guest) {
            return res.status(404).json({ 
                success: false, 
                error: 'Invité introuvable' 
            });
        }
        
        if (!guest.tableId) {
            return res.json({ 
                success: true, 
                assigned: false,
                message: 'Invité non assigné à une table'
            });
        }
        
        const table = (data.tables || []).find(t => t.id === guest.tableId);
        
        res.json({ 
            success: true, 
            assigned: true,
            data: table ? calculateTableStats(table) : null
        });
    } catch (err) {
        log.error('GET /api/guests/:id/table', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════
// 🔄 SYNCHRONISATION
// ═══════════════════════════════════════════════════════════════

// PULL
app.get('/api/sync/pull', (req, res) => {
    try {
        const data = loadData();
        
        log.sync('PULL', `${data.events?.length || 0} événements, ${data.tables?.length || 0} tables`);
        
        res.json({
            success: true,
            data: data,
            timestamp: new Date().toISOString(),
            count: {
                events: data.events?.length || 0,
                tables: data.tables?.length || 0,
                guests: data.guests?.length || 0,
                qrCodes: data.qrCodes?.length || 0,
                scans: data.scans?.length || 0
            }
        });
    } catch (err) {
        log.error('GET /api/sync/pull', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUSH
app.post('/api/sync/push', (req, res) => {
    try {
        const incoming = req.body;
        
        if (!incoming.events && !incoming.guests) {
            return res.status(400).json({ success: false, error: 'Données invalides' });
        }
        
        const existing = loadData();
        
        // Merge intelligent
        const merge = (arr1, arr2, key = 'id') => {
            const map = new Map();
            arr1.forEach(item => map.set(item[key], item));
            arr2.forEach(item => {
                const exist = map.get(item[key]);
                if (!exist || new Date(item.updatedAt || 0) > new Date(exist.updatedAt || 0)) {
                    map.set(item[key], item)
                }
            });

            return Array.from(map.values());
        };
        
        const merged = {
            events: merge(existing.events || [], incoming.events || []),
            guests: merge(existing.guests || [], incoming.guests || []),
            qrCodes: merge(existing.qrCodes || [], incoming.qrCodes || []),
            scans: merge(existing.scans || [], incoming.scans || []),
            settings: { ...existing.settings, ...incoming.settings }
        };
        
        saveData(merged);
        
        log.sync('PUSH', `${merged.events.length} événements mergés`);
        
        res.json({
            success: true,
            message: 'Synchronisation réussie',
            merged: {
                events: merged.events.length,
                guests: merged.guests.length,
                qrCodes: merged.qrCodes.length,
                scans: merged.scans.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        log.error('POST /api/sync/push', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// SYNC STATUS
app.get('/api/sync/status', (req, res) => {
    try {
        const data = loadData();
        
        const status = {
            online: true,
            lastUpdate: data.meta?.updatedAt || null,
            version: data.meta?.version || '3.0',
            counts: {
                events: data.events?.length || 0,
                guests: data.guests?.length || 0,
                qrCodes: data.qrCodes?.length || 0,
                scans: data.scans?.length || 0
            },
            timestamp: new Date().toISOString()
        };
        
        res.json({ success: true, data: status });
    } catch (err) {
        log.error('GET /api/sync/status', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 💾 BACKUP & RESTORE
// ═══════════════════════════════════════════════════════════════

// CREATE BACKUP
app.get('/api/backup', (req, res) => {
    try {
        const data = loadData();
        const filename = `secura-backup-${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(data, null, 2));
        
        log.backup(filename);
    } catch (err) {
        log.error('GET /api/backup', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// RESTORE BACKUP
app.post('/api/restore', (req, res) => {
    try {
        const backup = req.body;
        
        if (!backup.events && !backup.guests) {
            return res.status(400).json({ success: false, error: 'Backup invalide' });
        }
        
        saveData(backup);
        
        log.success('Backup restauré', `${backup.events?.length || 0} événements`);
        
        res.json({
            success: true,
            message: 'Backup restauré avec succès',
            restored: {
                events: backup.events?.length || 0,
                guests: backup.guests?.length || 0,
                qrCodes: backup.qrCodes?.length || 0,
                scans: backup.scans?.length || 0
            }
        });
    } catch (err) {
        log.error('POST /api/restore', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// LIST BACKUPS
app.get('/api/backups', (req, res) => {
    try {
        if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
            return res.json({ success: true, data: [] });
        }
        
        const files = fs.readdirSync(CONFIG.BACKUP_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const filepath = path.join(CONFIG.BACKUP_DIR, f);
                const stats = fs.statSync(filepath);
                return {
                    filename: f,
                    size: `${Math.round(stats.size / 1024)}KB`,
                    created: stats.mtime.toISOString(),
                    path: filepath
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));
        
        log.info('Liste backups', `${files.length} fichiers`);
        res.json({ success: true, data: files, count: files.length });
    } catch (err) {
        log.error('GET /api/backups', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🌐 ROUTES ÉVÉNEMENTS/INVITÉS (raccourcis)
// ═══════════════════════════════════════════════════════════════

app.get('/api/events/:id/guests', (req, res) => {
    try {
        const data = loadData();
        const event = data.events.find(e => e.id === req.params.id);
        
        if (!event) {
            return res.status(404).json({ success: false, error: 'Événement introuvable ' });
        }
        
        const guests = data.guests.filter(g => g.eventId === req.params.id);
        
        log.info('Invités récupérés', `${guests.length} pour ${event.name}`);
        res.json({ success: true, data: { event, guests }, count: guests.length });
    } catch (err) {
        log.error('GET /api/events/:id/guests', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/events/:id/scans', (req, res) => {
    try {
        const data = loadData();
        const scans = data.scans.filter(s => s.eventId === req.params.id)
            .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
        
        log.info('Scans récupérés', `${scans.length} pour événement`);
        res.json({ success: true, data: scans, count: scans.length });
    } catch (err) {
        log.error('GET /api/events/:id/scans', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});




// ═══════════════════════════════════════════════════════════════
// 📧 CONTACT FORM ENDPOINT
// ═══════════════════════════════════════════════════════════════

app.post('/api/contact/send', (req, res) => {
    try {
        const { name, email, phone = '', subject, message, acceptTerms, timestamp, userAgent } = req.body;

        // Validation
        if (!name || !email || !subject || !message || !acceptTerms) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs requis doivent être remplis'
            });
        }

        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Adresse email invalide'
            });
        }

        // Validation longueur message
        if (message.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Le message doit contenir au moins 10 caractères'
            });
        }

        // Charger les données existantes
        const data = loadData();
        if (!data.contacts) {
            data.contacts = [];
        }

        // Créer le message de contact
        const contact = {
            id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            subject: subject,
            message: message.trim(),
            acceptTerms: true,
            status: 'new',
            timestamp: timestamp || new Date().toISOString(),
            userAgent: userAgent,
            createdAt: new Date().toISOString(),
            read: false
        };

        // Ajouter le contact
        data.contacts.push(contact);

        // Sauvegarder
        saveData(data);

        log.crud('CREATE', 'CONTACT', {
            id: contact.id,
            email: contact.email,
            subject: contact.subject
        });

        // Optionnel: Envoyer un email (à implémenter si nodemailer est disponible)
        // await sendContactEmail(contact);

        res.status(201).json({
            success: true,
            message: 'Message reçu avec succès. Nous vous recontacterons bientôt.',
            contact: {
                id: contact.id,
                timestamp: contact.createdAt
            }
        });

    } catch (err) {
        log.error('Erreur envoi contact', err.message);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'envoi du message',
            message: err.message
        });
    }
});

// GET tous les contacts (pour admin/dashboard)
app.get('/api/contact/messages', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const contacts = data.contacts || [];

        res.json({
            success: true,
            total: contacts.length,
            unread: contacts.filter(c => !c.read).length,
            contacts: contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// GET un contact spécifique
app.get('/api/contact/messages/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const contact = data.contacts?.find(c => c.id === req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        // Marquer comme lu
        contact.read = true;
        saveData(data);

        res.json({
            success: true,
            contact: contact
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// DELETE un contact
app.delete('/api/contact/messages/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const initialLength = data.contacts?.length || 0;

        data.contacts = data.contacts?.filter(c => c.id !== req.params.id) || [];

        if (data.contacts.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            });
        }

        saveData(data);

        log.crud('DELETE', 'CONTACT', { id: req.params.id });

        res.json({
            success: true,
            message: 'Message supprimé avec succès'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});






// ═══════════════════════════════════════════════════════════════
// 📸 ENDPOINTS GALERIES
// ═══════════════════════════════════════════════════════════════

//k
app.get('/api/galleries', (req, res) => {
    try {
        const data = loadData();
        const { eventId, userId, status, isPublic } = req.query;

        let galleries = data.galleries || [];

        // Filtres
        if (eventId) galleries = galleries.filter(g => g.eventId === eventId);
        if (userId) galleries = galleries.filter(g => g.createdBy === userId);
        if (status) galleries = galleries.filter(g => g.status === status);
        if (isPublic !== undefined) galleries = galleries.filter(g => g.isPublic === (isPublic === 'true'));

        // Enrichissement avec stats
        galleries = galleries.map(g => ({
            ...g,
            photoCount: (g.photos || []).length,
            approvedPhotoCount: (g.photos || []).filter(p => p.status === 'approved').length,
            engagementScore: calculateGalleryEngagement(g)
        }));

        // Reconstruire les URLs avec le baseURL de la requête
        galleries = galleries.map(g => storageManager.buildGalleryUrls(g, req.baseUrl));

        log.crud('READ', 'GALLERIES', { count: galleries.length });

        res.json({
            success: true,
            galleries: galleries,
            meta: {
                total: galleries.length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (err) {
        log.error('GET /api/galleries', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



/**
 * GET /api/galleries/:id
 * Récupère une galerie spécifique avec détails complets
 */
app.get('/api/galleries/:id', (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        // Enrichissement
        const enrichedGallery = {
            ...gallery,
            photoCount: gallery.photos?.length || 0,
            approvedPhotos: gallery.photos?.filter(p => p.status === 'approved') || [],
            stats: {
                totalViews: (gallery.photos || []).reduce((sum, p) => sum + (p.views || 0), 0),
                totalLikes: (gallery.photos || []).reduce((sum, p) => sum + (p.likes?.length || 0), 0),
                totalComments: (gallery.photos || []).reduce((sum, p) => sum + (p.comments?.length || 0), 0),
                totalDownloads: (gallery.photos || []).reduce((sum, p) => sum + (p.downloads || 0), 0)
            },
            engagementScore: calculateGalleryEngagement(gallery),
            createdByUser: data.users?.find(u => u.id === gallery.createdBy),
            event: data.events?.find(e => e.id === gallery.eventId)
        };

        // Reconstruire les URLs avec le baseURL de la requête
        const enrichedGalleryWithUrls = storageManager.buildGalleryUrls(enrichedGallery, req.baseUrl);

        log.crud('READ', 'GALLERY', { id: req.params.id });

        res.json({
            success: true,
            gallery: enrichedGalleryWithUrls
        });

    } catch (err) {
        log.error('GET /api/galleries/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});




/**
 * POST /api/galleries
 * Crée une nouvelle galerie pour un événement avec support du fichier de couverture
 */
app.post('/api/galleries', jwtAuth, upload.single('cover'), async (req, res) => {
    try {
        const { eventId, name, description, isPublic, settings, metadata } = req.body;
        const data = loadData();

        // Validations
        if (!eventId || !name) {
            return res.status(400).json({ success: false, error: 'eventId et name requis' });
        }

        const event = data.events?.find(e => e.id === eventId);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Événement non trouvé' });
        }

        // Parser les settings et metadata s'ils viennent en tant que strings
        let parsedSettings = settings;
        let parsedMetadata = metadata;
        
        if (typeof settings === 'string') {
            try {
                parsedSettings = JSON.parse(settings);
            } catch (e) {
                parsedSettings = {};
            }
        }
        
        if (typeof metadata === 'string') {
            try {
                parsedMetadata = JSON.parse(metadata);
            } catch (e) {
                parsedMetadata = {};
            }
        }

        // Créer la galerie
        const gallery = {
            id: generateGalleryId(),
            eventId: eventId,
            name: name.trim(),
            description: description?.trim() || '',
            createdBy: req.user.id,
            createdByName: req.user.name,
            isPublic: Boolean(isPublic),
            status: 'active',
            photos: [],
            moderation: {
                enabled: parsedSettings?.moderationRequired !== false,
                approvedPhotos: [],
                pendingPhotos: [],
                rejectedPhotos: []
            },
            settings: {
                maxPhotos: parsedSettings?.maxPhotos || 1000,
                maxPhotoSize: parsedSettings?.maxPhotoSize || 8 * 1024 * 1024,
                allowedFormats: parsedSettings?.allowedFormats || ['jpg', 'jpeg', 'png', 'webp'],
                autoApprove: Boolean(parsedSettings?.autoApprove),
                allowDownloads: parsedSettings?.allowDownloads !== false,
                allowComments: parsedSettings?.allowComments !== false,
                allowLikes: parsedSettings?.allowLikes !== false,
                watermark: Boolean(parsedSettings?.watermark),
                ...parsedSettings
            },
            permissions: {
                viewers: parsedSettings?.viewers || ['all'],
                contributors: parsedSettings?.contributors || [req.user.id],
                moderators: parsedSettings?.moderators || [req.user.id]
            },
            stats: {
                totalPhotos: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalDownloads: 0
            },
            metadata: {
                coverPhoto: null,
                coverPhotoUrl: null,
                tags: parsedMetadata?.tags || parsedSettings?.tags || [],
                category: parsedMetadata?.category || parsedSettings?.category || 'general',
                location: parsedMetadata?.location || parsedSettings?.location || null
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Upload de la photo de couverture si fournie
        if (req.file) {
            try {
                const uploadedFile = await storageManager.uploadFile(
                    {
                        filename: req.file.originalname,
                        mimetype: req.file.mimetype,
                        size: req.file.size,
                        buffer: req.file.buffer
                    },
                    'gallery',
                    { 
                        userId: req.user.id, 
                        galleryName: name,
                        type: 'cover'
                    }
                );

                gallery.metadata.coverPhoto = uploadedFile.id;
                gallery.metadata.coverPhotoUrl = uploadedFile.path;  // Stocker seulement le chemin relatif
                
                log.info(`✅ Photo de couverture uploadée: ${uploadedFile.filename}`);
            } catch (uploadErr) {
                log.warning(`⚠️ Erreur upload couverture: ${uploadErr.message}`);
                // Continuer sans couverture, utiliser le défaut
                gallery.metadata.coverPhotoUrl = null;
            }
        }

        // Sauvegarder
        if (!data.galleries) data.galleries = [];
        data.galleries.push(gallery);
        saveData(data);

        log.crud('CREATE', 'GALLERY', { 
            name: gallery.name, 
            eventId: eventId,
            hasCover: !!gallery.metadata.coverPhotoUrl
        });

        // Reconstruire les URLs avec le baseURL de la requête
        const enrichedGallery = storageManager.buildGalleryUrls(gallery, req.baseUrl);

        res.status(201).json({
            success: true,
            gallery: enrichedGallery,
            message: 'Galerie créée avec succès'
        });

    } catch (err) {
        log.error('POST /api/galleries', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



/**
 * PUT /api/galleries/:id
 * Met à jour une galerie complètement
 */
app.put('/api/galleries/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!canEditGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        // Mise à jour des champs
        const { name, description, isPublic, settings, metadata } = req.body;

        if (name) gallery.name = name.trim();
        if (description !== undefined) gallery.description = description.trim();
        if (isPublic !== undefined) gallery.isPublic = Boolean(isPublic);
        if (settings) gallery.settings = { ...gallery.settings, ...settings };
        if (metadata) gallery.metadata = { ...gallery.metadata, ...metadata };

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('UPDATE', 'GALLERY', { id: req.params.id });

        res.json({
            success: true,
            gallery: gallery,
            message: 'Galerie mise à jour'
        });

    } catch (err) {
        log.error('PUT /api/galleries/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


/**
 * PATCH /api/galleries/:id
 * Mise à jour partielle d'une galerie
 */
app.patch('/api/galleries/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!canEditGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        // Patch sélectif
        Object.keys(req.body).forEach(key => {
            if (['name', 'description', 'isPublic', 'status'].includes(key)) {
                gallery[key] = req.body[key];
            }
        });

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({
            success: true,
            gallery: gallery
        });

    } catch (err) {
        log.error('PATCH /api/galleries/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/galleries/:id - Supprime une galerie (avec cascade: photos, commentaires)
 */
app.delete('/api/galleries/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (gallery.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Seul le créateur peut supprimer' });
        }

        // ⚠️ CASCADE DELETE: Supprimer toutes les photos de cette galerie
        const photoIds = gallery.photos?.map(p => p.id) || [];
        let deletedPhotos = 0;
        
        // Supprimer la cover image si elle existe (coverPhotoUrl ou coverPhotoId)
        if (gallery.metadata?.coverPhotoUrl) {
            storageManager.deleteFile(gallery.metadata.coverPhotoUrl);
        } else if (gallery.metadata?.coverPhoto) {
            storageManager.deleteFile(gallery.metadata.coverPhoto);
        }
        if (gallery.metadata?.coverPhotoThumbnail) {
            storageManager.deleteFile(gallery.metadata.coverPhotoThumbnail);
        }
        if (gallery.metadata?.coverImage) {
            storageManager.deleteFile(gallery.metadata.coverImage);
        }
        if (gallery.metadata?.coverImageThumbnail) {
            storageManager.deleteFile(gallery.metadata.coverImageThumbnail);
        }
        
        // Supprimer les fichiers associés aux photos
        gallery.photos?.forEach(photo => {
            // Utiliser l'URL de la photo (plus robuste après redémarrage)
            if (photo.url) {
                storageManager.deleteFile(photo.url);
            } else if (photo.fileId) {
                storageManager.deleteFile(photo.fileId);
            }
            // Supprimer les thumbnails si stockés séparément
            if (photo.thumbnails?.small) storageManager.deleteFile(photo.thumbnails.small);
            if (photo.thumbnails?.medium) storageManager.deleteFile(photo.thumbnails.medium);
            if (photo.thumbnails?.large) storageManager.deleteFile(photo.thumbnails.large);
            deletedPhotos++;
        });
        
        // ⚠️ CASCADE DELETE: Supprimer tous les commentaires des photos de cette galerie
        let deletedComments = 0;
        if (data.comments) {
            const commentsToDelete = data.comments.filter(c => photoIds.includes(c.photoId));
            deletedComments = commentsToDelete.length;
            data.comments = data.comments.filter(c => !photoIds.includes(c.photoId));
        }
        
        // ⚠️ CASCADE DELETE: Supprimer toutes les likes des photos de cette galerie
        let deletedLikes = 0;
        if (data.likes) {
            const likesToDelete = data.likes.filter(l => photoIds.includes(l.photoId));
            deletedLikes = likesToDelete.length;
            data.likes = data.likes.filter(l => !photoIds.includes(l.photoId));
        }
        
        // Supprimer la galerie
        data.galleries = data.galleries.filter(g => g.id !== req.params.id);
        saveData(data);

        log.crud('DELETE', 'GALLERY', { 
            id: req.params.id,
            photos: deletedPhotos,
            comments: deletedComments,
            likes: deletedLikes
        });

        res.json({ 
            success: true, 
            message: 'Galerie supprimée',
            deleted: {
                gallery: 1,
                photos: deletedPhotos,
                comments: deletedComments,
                likes: deletedLikes
            }
        });

    } catch (err) {
        log.error('DELETE /api/galleries/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});





// ═══════════════════════════════════════════════════════════════
// 📸 ENDPOINTS PHOTOS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/galleries/:id/photos
 * Récupère les photos d'une galerie
 */
app.get('/api/galleries/:id/photos', (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const { status, sort } = req.query;

        let photos = gallery.photos || [];

        // Filtrer par statut
        if (status) {
            photos = photos.filter(p => p.status === status);
        }

        // Tri
        if (sort === 'recent') {
            photos = photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        } else if (sort === 'likes') {
            photos = photos.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        } else if (sort === 'views') {
            photos = photos.sort((a, b) => (b.views || 0) - (a.views || 0));
        }

        // Reconstruire les URLs avec le baseURL de la requête
        // ET enrichir avec les informations utilisateur
        photos = photos.map(photo => {
            // Chercher l'utilisateur qui a uploadé la photo
            const uploader = data.users?.find(u => u.id === photo.uploadedBy);
            
            return {
                ...photo,
                uploadedByName: uploader ? `${uploader.firstName} ${uploader.lastName}`.trim() : 'Utilisateur inconnu',
                uploadedAvatar: uploader?.avatar || null,
                url: storageManager.buildFileUrl(photo.url, req.baseUrl),
                downloadUrl: storageManager.buildFileUrl(photo.url, req.baseUrl),
                thumbnails: photo.thumbnails ? {
                    small: storageManager.buildFileUrl(photo.thumbnails.small?.split('?')[0], req.baseUrl) + '?size=small',
                    medium: storageManager.buildFileUrl(photo.thumbnails.medium?.split('?')[0], req.baseUrl) + '?size=medium',
                    large: storageManager.buildFileUrl(photo.thumbnails.large?.split('?')[0], req.baseUrl) + '?size=large'
                } : {}
            };
        });

        log.crud('READ', 'PHOTOS', { count: photos.length, galleryId: req.params.id });

        res.json({
            success: true,
            photos: photos,
            meta: {
                total: photos.length,
                approved: photos.filter(p => p.status === 'approved').length,
                pending: photos.filter(p => p.status === 'pending').length
            }
        });

    } catch (err) {
        log.error('GET /api/galleries/:id/photos', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});




/**
 * POST /api/galleries/:id/photos - Ajoute une photo avec upload
 */
app.post('/api/galleries/:id/photos', jwtAuth, upload.single('file'), async (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!canContributeGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Vous ne pouvez pas contribuer' });
        }

        if (gallery.photos.length >= gallery.settings.maxPhotos) {
            return res.status(400).json({ success: false, error: 'Galerie pleine' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Fichier manquant' });
        }

        // Upload via storage
        const uploadedFile = await storageManager.uploadFile(
            {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                buffer: req.file.buffer
            },
            'gallery',
            { userId: req.user.id, tags: JSON.parse(req.body.tags || '[]') }
        );

        // Créer la photo
        const photoData = {
            id: generatePhotoId(),
            galleryId: req.params.id,
            fileId: uploadedFile.id,
            filename: uploadedFile.originalName,
            url: uploadedFile.path,  // Stocker seulement le chemin relatif
            thumbnails: uploadedFile.thumbnails,
            uploadedBy: req.user.id,
            uploadedByName: req.user.name,
            uploadedAt: new Date().toISOString(),
            size: uploadedFile.size,
            format: uploadedFile.extension,

            metadata: {
                title: req.body.title || '',
                description: req.body.description || '',
                tags: JSON.parse(req.body.tags || '[]'),
                location: req.body.location || null,
                camera: req.body.camera || null
            },

            status: gallery.settings.autoApprove ? 'approved' : 'pending',
            moderated: gallery.settings.autoApprove,
            moderatedBy: gallery.settings.autoApprove ? 'system' : null,
            moderatedAt: gallery.settings.autoApprove ? new Date().toISOString() : null,

            views: 0,
            viewedBy: [],
            likes: [],
            likedBy: [],
            comments: [],
            downloads: 0,
            downloadedBy: [],

            featured: Boolean(req.body.featured),
            isPublic: gallery.isPublic
        };

        gallery.photos.unshift(photoData);
        gallery.stats.totalPhotos = gallery.photos.length;

        if (photoData.status === 'pending') {
            gallery.moderation.pendingPhotos.push(photoData.id);
        } else {
            gallery.moderation.approvedPhotos.push(photoData.id);
        }

        if (!gallery.metadata.coverPhoto && gallery.photos.length === 1) {
            gallery.metadata.coverPhoto = photoData.id;
        }

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('CREATE', 'PHOTO', { 
            galleryId: req.params.id, 
            filename: photoData.filename,
            status: photoData.status
        });

        // Reconstruire les URLs avec le baseURL de la requête
        const photoWithUrls = {
            ...photoData,
            url: storageManager.buildFileUrl(photoData.url, req.baseUrl),
            downloadUrl: storageManager.buildFileUrl(photoData.url, req.baseUrl),
            thumbnails: photoData.thumbnails ? {
                small: storageManager.buildFileUrl(photoData.thumbnails.small?.split('?')[0], req.baseUrl) + '?size=small',
                medium: storageManager.buildFileUrl(photoData.thumbnails.medium?.split('?')[0], req.baseUrl) + '?size=medium',
                large: storageManager.buildFileUrl(photoData.thumbnails.large?.split('?')[0], req.baseUrl) + '?size=large'
            } : {}
        };

        res.status(201).json({
            success: true,
            photo: photoWithUrls,
            message: `Photo ajoutée (${photoData.status === 'pending' ? 'en attente' : 'approuvée'})`
        });


    } catch (err) {
        log.error('POST /api/galleries/:id/photos', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


/**
 * GET /api/galleries/:galleryId/photos/:photoId - Récupère une photo
 */
app.get('/api/galleries/:galleryId/photos/:photoId', (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        // Enregistrer la vue
        const userId = req.user?.id || 'anonymous';
        if (!photo.viewedBy?.includes(userId)) {
            photo.views = (photo.views || 0) + 1;
            photo.viewedBy = photo.viewedBy || [];
            photo.viewedBy.push(userId);
            gallery.stats.totalViews = (gallery.stats.totalViews || 0) + 1;
            saveData(data);
        }

        // Chercher l'utilisateur qui a uploadé la photo
        const uploader = data.users?.find(u => u.id === photo.uploadedBy);
        const uploadedByName = uploader ? `${uploader.firstName} ${uploader.lastName}`.trim() : 'Utilisateur inconnu';
        const uploadedAvatar = uploader?.avatar || null;

        // Reconstruire les URLs
        const photoWithUrls = {
            ...photo,
            uploadedByName: uploadedByName,
            uploadedAvatar: uploadedAvatar,
            url: storageManager.buildFileUrl(photo.url, req.baseUrl),
            downloadUrl: storageManager.buildFileUrl(photo.url, req.baseUrl),
            thumbnails: photo.thumbnails ? {
                small: storageManager.buildFileUrl(photo.thumbnails.small?.split('?')[0], req.baseUrl) + '?size=small',
                medium: storageManager.buildFileUrl(photo.thumbnails.medium?.split('?')[0], req.baseUrl) + '?size=medium',
                large: storageManager.buildFileUrl(photo.thumbnails.large?.split('?')[0], req.baseUrl) + '?size=large'
            } : {}
        };

        // Statistiques COMPLÈTES de la photo
        const stats = {
            // Comptages de base
            likes: photo.likes?.length || 0,
            comments: photo.comments?.length || 0,
            views: photo.views || 0,
            downloads: photo.downloads || 0,
            
            // Détails des vues
            uniqueViews: photo.viewedBy?.length || 0,
            viewedByUsers: (photo.viewedBy || []).slice(0, 10),
            
            // Détails des likes avec noms
            likeDetails: (photo.likes || []).map(like => ({
                id: like.id,
                userId: like.userId,
                userName: like.userName,
                likedAt: like.likedAt
            })),
            
            // Détails des commentaires
            commentDetails: (photo.comments || []).map(c => ({
                id: c.id,
                userId: c.userId,
                userName: c.userName,
                content: c.content.substring(0, 100),
                status: c.status,
                likeCount: c.likes?.length || 0,
                createdAt: c.createdAt
            })),
            
            // Détails des téléchargements
            downloadDetails: (photo.downloadedBy || []).slice(0, 5).map(d => ({
                userId: d.userId,
                downloadedAt: d.downloadedAt
            })),
            
            // Engagement
            engagement: {
                engagementScore: ((photo.likes?.length || 0) * 2 + (photo.comments?.length || 0) * 3 + (photo.views || 0)),
                engagementRate: photo.views > 0 
                    ? (((photo.likes?.length || 0) + (photo.comments?.length || 0)) / photo.views * 100).toFixed(2) + '%'
                    : '0%'
            },
            
            // Statut et modération
            moderation: {
                status: photo.status,
                moderated: photo.moderated,
                moderatedBy: photo.moderatedBy,
                moderatedAt: photo.moderatedAt,
                rejectionReason: photo.rejectionReason || null
            },
            
            // Métadonnées
            metadata: photo.metadata || {}
        };

        // Informations complètes pour mise à jour
        const photoData = {
            ...photoWithUrls,
            stats: stats,
            permissions: {
                canEdit: photo.uploadedBy === req.user?.id || canModerateGallery(gallery, req.user?.id),
                canDelete: photo.uploadedBy === req.user?.id || canModerateGallery(gallery, req.user?.id),
                canModerate: canModerateGallery(gallery, req.user?.id),
                canLike: gallery.settings?.allowLikes !== false,
                canComment: gallery.settings?.allowComments !== false,
                canDownload: gallery.settings?.allowDownloads !== false
            },
            gallery: {
                id: gallery.id,
                name: gallery.name,
                isPublic: gallery.isPublic,
                settings: gallery.settings
            }
        };

        log.crud('READ', 'PHOTO_DETAILS', { photoId: req.params.photoId, userId: req.user?.id });

        res.json({
            success: true,
            photo: photoData,
            message: 'Photo récupérée avec succès'
        });

    } catch (err) {
        log.error('GET /api/galleries/:galleryId/photos/:photoId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


/**
 * PATCH /api/galleries/:galleryId/photos/:photoId - Met à jour une photo (views, metadata, etc.)
 */
app.patch('/api/galleries/:galleryId/photos/:photoId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        const { views, viewedBy, title, description, tags, location, featured } = req.body;

        // Mettre à jour les vues
        if (views !== undefined) {
            photo.views = views;
        }
        if (viewedBy !== undefined) {
            photo.viewedBy = viewedBy;
        }

        // Mettre à jour les métadonnées
        if (title !== undefined || description !== undefined || tags !== undefined || location !== undefined) {
            photo.metadata = photo.metadata || {};
            if (title !== undefined) photo.metadata.title = title;
            if (description !== undefined) photo.metadata.description = description;
            if (tags !== undefined) photo.metadata.tags = tags;
            if (location !== undefined) photo.metadata.location = location;
        }

        // Marquer comme featured
        if (featured !== undefined) {
            photo.featured = featured;
        }

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('UPDATE', 'PHOTO', { photoId: req.params.photoId, userId: req.user?.id });

        // Retourner la photo complète avec toutes les stats
        const stats = {
            likes: photo.likes?.length || 0,
            comments: photo.comments?.length || 0,
            views: photo.views || 0,
            downloads: photo.downloads || 0,
            uniqueViews: photo.viewedBy?.length || 0,
            engagement: {
                engagementScore: ((photo.likes?.length || 0) * 2 + (photo.comments?.length || 0) * 3 + (photo.views || 0)),
                engagementRate: photo.views > 0 
                    ? (((photo.likes?.length || 0) + (photo.comments?.length || 0)) / photo.views * 100).toFixed(2) + '%'
                    : '0%'
            }
        };

        res.json({
            success: true,
            photo: {
                ...photo,
                url: storageManager.buildFileUrl(photo.url, req.baseUrl),
                downloadUrl: storageManager.buildFileUrl(photo.url, req.baseUrl),
                thumbnails: photo.thumbnails ? {
                    small: storageManager.buildFileUrl(photo.thumbnails.small?.split('?')[0], req.baseUrl) + '?size=small',
                    medium: storageManager.buildFileUrl(photo.thumbnails.medium?.split('?')[0], req.baseUrl) + '?size=medium',
                    large: storageManager.buildFileUrl(photo.thumbnails.large?.split('?')[0], req.baseUrl) + '?size=large'
                } : {}
            },
            stats: stats,
            message: 'Photo mise à jour avec succès'
        });

    } catch (err) {
        log.error('PATCH /api/galleries/:galleryId/photos/:photoId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


/**
 * DELETE /api/galleries/:galleryId/photos/:photoId - Supprime une photo (avec cascade: commentaires, likes)
 */
app.delete('/api/galleries/:galleryId/photos/:photoId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photoIndex = gallery.photos?.findIndex(p => p.id === req.params.photoId);

        if (photoIndex === -1) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        const photo = gallery.photos[photoIndex];

        if (photo.uploadedBy !== req.user.id && !canModerateGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        if (photo.fileId) {
            storageManager.deleteFile(photo.fileId);
        }

        // ⚠️ CASCADE DELETE: Supprimer tous les commentaires de cette photo
        let deletedComments = 0;
        if (data.comments) {
            const commentsToDelete = data.comments.filter(c => c.photoId === photo.id);
            deletedComments = commentsToDelete.length;
            data.comments = data.comments.filter(c => c.photoId !== photo.id);
        }

        // ⚠️ CASCADE DELETE: Supprimer tous les likes de cette photo
        let deletedLikes = 0;
        if (data.likes) {
            const likesToDelete = data.likes.filter(l => l.photoId === photo.id);
            deletedLikes = likesToDelete.length;
            data.likes = data.likes.filter(l => l.photoId !== photo.id);
        }

        gallery.photos.splice(photoIndex, 1);

        gallery.stats.totalPhotos = gallery.photos.length;
        gallery.moderation.pendingPhotos = gallery.moderation.pendingPhotos.filter(id => id !== photo.id);
        gallery.moderation.approvedPhotos = gallery.moderation.approvedPhotos.filter(id => id !== photo.id);

        if (gallery.metadata.coverPhoto === photo.id) {
            gallery.metadata.coverPhoto = gallery.photos[0]?.id || null;
        }

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('DELETE', 'PHOTO', { 
            photoId: req.params.photoId,
            comments: deletedComments,
            likes: deletedLikes
        });

        res.json({ 
            success: true, 
            message: 'Photo supprimée',
            deleted: {
                photo: 1,
                comments: deletedComments,
                likes: deletedLikes
            }
        });

    } catch (err) {
        log.error('DELETE /api/galleries/:galleryId/photos/:photoId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ═════════════════════════════════════════════════════════════════════════════════════
// ❤️  6. ENDPOINTS LIKES
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/galleries/:galleryId/photos/:photoId/like - Like une photo
 */
app.post('/api/galleries/:galleryId/photos/:photoId/like', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        if (!gallery.settings.allowLikes) {
            return res.status(400).json({ success: false, error: 'Les likes sont désactivés' });
        }

        photo.likes = photo.likes || [];
        photo.likedBy = photo.likedBy || [];

        const alreadyLiked = photo.likedBy.includes(req.user.id);

        if (alreadyLiked) {
            photo.likedBy = photo.likedBy.filter(id => id !== req.user.id);
            photo.likes = photo.likes.filter(like => like.userId !== req.user.id);
            gallery.stats.totalLikes = Math.max(0, gallery.stats.totalLikes - 1);
            saveData(data);

            return res.json({
                success: true,
                action: 'unlike',
                likes: photo.likes.length
            });
        }

        const like = {
            id: generateLikeId(),
            userId: req.user.id,
            userName: req.user.name,
            likedAt: new Date().toISOString()
        };

        photo.likes.push(like);
        photo.likedBy.push(req.user.id);
        gallery.stats.totalLikes++;

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('CREATE', 'LIKE', { photoId: req.params.photoId, userId: req.user.id });

        res.status(201).json({
            success: true,
            action: 'like',
            likes: photo.likes.length,
            like: like
        });

    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/like', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



/**
 * GET /api/galleries/:galleryId/photos/:photoId/likes - Récupère les likes
 */
app.get('/api/galleries/:galleryId/photos/:photoId/likes', (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        res.json({
            success: true,
            likes: photo.likes || [],
            totalLikes: (photo.likes || []).length,
            userLiked: photo.likedBy?.includes(req.user?.id) || false
        });

    } catch (err) {
        log.error('GET /api/galleries/:galleryId/photos/:photoId/likes', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ═════════════════════════════════════════════════════════════════════════════════════
// 💬 7. ENDPOINTS COMMENTAIRES COMPLETS
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/galleries/:galleryId/photos/:photoId/comments - Ajoute un commentaire
 */
app.post('/api/galleries/:galleryId/photos/:photoId/comments', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        if (!gallery.settings.allowComments) {
            return res.status(400).json({ success: false, error: 'Commentaires désactivés' });
        }

        const { content, parentCommentId } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Commentaire vide' });
        }

        photo.comments = photo.comments || [];

        const comment = {
            id: generateCommentId(),
            userId: req.user.id,
            userName: req.user.name,
            userAvatar: req.user.avatar || null,
            content: content.trim(),
            parentCommentId: parentCommentId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: gallery.moderation.enabled ? 'pending' : 'approved',
            moderated: !gallery.moderation.enabled,
            likes: [],
            likedBy: [],
            replies: []
        };

        photo.comments.push(comment);
        gallery.stats.totalComments++;

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('CREATE', 'COMMENT', { photoId: req.params.photoId, userId: req.user.id });

        res.status(201).json({
            success: true,
            comment: comment,
            message: `Commentaire ${gallery.moderation.enabled ? 'en attente' : 'publié'}`,
            totalComments: photo.comments.length
        });

    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/comments', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/galleries/:galleryId/photos/:photoId/comments - Récupère les commentaires
 */
app.get('/api/galleries/:galleryId/photos/:photoId/comments', (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        const { status } = req.query;
        let comments = photo.comments || [];

        if (status) {
            comments = comments.filter(c => c.status === status);
        }

        comments = comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            comments: comments,
            meta: {
                total: comments.length,
                approved: comments.filter(c => c.status === 'approved').length,
                pending: comments.filter(c => c.status === 'pending').length
            }
        });

    } catch (err) {
        log.error('GET /api/galleries/:galleryId/photos/:photoId/comments', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/galleries/:galleryId/photos/:photoId/comments/:commentId - Modifie un commentaire
 */
app.put('/api/galleries/:galleryId/photos/:photoId/comments/:commentId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        const comment = photo.comments?.find(c => c.id === req.params.commentId);

        if (!comment) {
            return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
        }

        if (comment.userId !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Vous ne pouvez pas modifier' });
        }

        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Commentaire vide' });
        }

        comment.content = content.trim();
        comment.updatedAt = new Date().toISOString();

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({ success: true, comment: comment, message: 'Commentaire modifié' });

    } catch (err) {
        log.error('PUT /api/galleries/:galleryId/photos/:photoId/comments/:commentId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/galleries/:galleryId/photos/:photoId/comments/:commentId - Supprime un commentaire
 */
app.delete('/api/galleries/:galleryId/photos/:photoId/comments/:commentId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        const commentIndex = photo.comments?.findIndex(c => c.id === req.params.commentId);

        if (commentIndex === -1) {
            return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
        }

        const comment = photo.comments[commentIndex];

        if (comment.userId !== req.user.id && !canModerateGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        photo.comments.splice(commentIndex, 1);
        gallery.stats.totalComments = Math.max(0, gallery.stats.totalComments - 1);

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({ success: true, message: 'Commentaire supprimé' });

    } catch (err) {
        log.error('DELETE /api/galleries/:galleryId/photos/:photoId/comments/:commentId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/galleries/:galleryId/photos/:photoId/comments/:commentId/like - Like un commentaire
 */
app.post('/api/galleries/:galleryId/photos/:photoId/comments/:commentId/like', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        const comment = photo.comments?.find(c => c.id === req.params.commentId);

        if (!comment) {
            return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
        }

        comment.likedBy = comment.likedBy || [];
        const alreadyLiked = comment.likedBy.includes(req.user.id);

        if (alreadyLiked) {
            comment.likedBy = comment.likedBy.filter(id => id !== req.user.id);
            comment.likes = (comment.likes || []).filter(like => like.userId !== req.user.id);
        } else {
            comment.likedBy.push(req.user.id);
            comment.likes = comment.likes || [];
            comment.likes.push({
                userId: req.user.id,
                likedAt: new Date().toISOString()
            });
        }

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({
            success: true,
            comment: comment,
            action: alreadyLiked ? 'unlike' : 'like',
            likes: (comment.likes || []).length
        });

    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/comments/:commentId/like', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


/**
 * POST /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies - Ajouter une reply à un commentaire
 */
app.post('/api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);
        if (!gallery) return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        const photo = gallery.photos?.find(p => p.id === req.params.photoId);
        if (!photo) return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        const comment = photo.comments?.find(c => c.id === req.params.commentId);
        if (!comment) return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
        comment.replies = comment.replies || [];
        const replyId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const reply = {
            id: replyId,
            userId: req.user.id,
            userAvatar: req.user.avatar || null,
            content: req.body.content,
            parentCommentId: comment.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'pending',
            moderated: false,
            likes: [],
            likedBy: [],
            replies: []
        };
        comment.replies.push(reply);
        gallery.updatedAt = new Date().toISOString();
        saveData(data);
        res.json({ success: true, reply });
    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId/like - Like une reply
 */
app.post('/api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId/like', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);
        if (!gallery) return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        const photo = gallery.photos?.find(p => p.id === req.params.photoId);
        if (!photo) return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        const comment = photo.comments?.find(c => c.id === req.params.commentId);
        if (!comment) return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
        const reply = comment.replies?.find(r => r.id === req.params.replyId);
        if (!reply) return res.status(404).json({ success: false, error: 'Reply non trouvée' });
        reply.likedBy = reply.likedBy || [];
        const alreadyLiked = reply.likedBy.includes(req.user.id);
        if (alreadyLiked) {
            reply.likedBy = reply.likedBy.filter(id => id !== req.user.id);
            reply.likes = (reply.likes || []).filter(like => like.userId !== req.user.id);
        } else {
            reply.likedBy.push(req.user.id);
            reply.likes = reply.likes || [];
            reply.likes.push({ userId: req.user.id, likedAt: new Date().toISOString() });
        }
        gallery.updatedAt = new Date().toISOString();
        saveData(data);
        res.json({ success: true, reply, action: alreadyLiked ? 'unlike' : 'like', likes: (reply.likes || []).length });
    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId/like', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId - Modifier une reply
 */
app.put('/api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);
        if (!gallery) return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        const photo = gallery.photos?.find(p => p.id === req.params.photoId);
        if (!photo) return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        const comment = photo.comments?.find(c => c.id === req.params.commentId);
        if (!comment) return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
        const reply = comment.replies?.find(r => r.id === req.params.replyId);
        if (!reply) return res.status(404).json({ success: false, error: 'Reply non trouvée' });
        if (reply.userId !== req.user.id) return res.status(403).json({ success: false, error: 'Non autorisé' });
        reply.content = req.body.content || reply.content;
        reply.updatedAt = new Date().toISOString();
        gallery.updatedAt = new Date().toISOString();
        saveData(data);
        res.json({ success: true, reply });
    } catch (err) {
        log.error('PUT /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId - Supprimer une reply
 */
app.delete('/api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);
        if (!gallery) return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        const photo = gallery.photos?.find(p => p.id === req.params.photoId);
        if (!photo) return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        const comment = photo.comments?.find(c => c.id === req.params.commentId);
        if (!comment) return res.status(404).json({ success: false, error: 'Commentaire non trouvé' });
        const replyIndex = comment.replies?.findIndex(r => r.id === req.params.replyId);
        if (replyIndex === -1 || replyIndex == null) return res.status(404).json({ success: false, error: 'Reply non trouvée' });
        const reply = comment.replies[replyIndex];
        if (reply.userId !== req.user.id) return res.status(403).json({ success: false, error: 'Non autorisé' });
        comment.replies.splice(replyIndex, 1);
        gallery.updatedAt = new Date().toISOString();
        saveData(data);
        res.json({ success: true });
    } catch (err) {
        log.error('DELETE /api/galleries/:galleryId/photos/:photoId/comments/:commentId/replies/:replyId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ═════════════════════════════════════════════════════════════════════════════════════
// 📊 8. ENDPOINTS MODÉRATION
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/galleries/:galleryId/photos/:photoId/approve - Approuve une photo
 */
app.post('/api/galleries/:galleryId/photos/:photoId/approve', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!canModerateGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        if (photo.status !== 'pending' && photo.status !== 'rejected' ) {
            return res.status(400).json({ success: false, error: 'Photo non en attente' });
        }

        photo.status = 'approved';
        photo.moderated = true;
        photo.moderatedBy = req.user.id;
        photo.moderatedAt = new Date().toISOString();

        gallery.moderation.pendingPhotos = gallery.moderation.pendingPhotos.filter(id => id !== photo.id);
        gallery.moderation.approvedPhotos.push(photo.id);

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('APPROVE', 'PHOTO', { photoId: req.params.photoId });

        res.json({ success: true, photo: photo, message: 'Photo approuvée' });

    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/approve', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/galleries/:galleryId/photos/:photoId/reject - Rejette une photo
 */
app.post('/api/galleries/:galleryId/photos/:photoId/reject', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!canModerateGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        if (photo.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Photo non en attente' });
        }

        const { reason } = req.body;

        photo.status = 'rejected';
        photo.moderated = true;
        photo.moderatedBy = req.user.id;
        photo.moderatedAt = new Date().toISOString();
        photo.rejectionReason = reason || 'Pas de raison';

        gallery.moderation.pendingPhotos = gallery.moderation.pendingPhotos.filter(id => id !== photo.id);
        gallery.moderation.rejectedPhotos.push(photo.id);

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('REJECT', 'PHOTO', { photoId: req.params.photoId });

        res.json({ success: true, photo: photo, message: 'Photo rejetée' });

    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/reject', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/galleries/:id/moderation - Photos en attente
 */
app.get('/api/galleries/:id/moderation', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!canModerateGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const pendingPhotos = (gallery.photos || [])
            .filter(p => p.status === 'pending')
            .map(p => {
                // Enrichir avec les infos utilisateur
                const uploader = data.users?.find(u => u.id === p.uploadedBy);
                const uploadedByName = uploader ? `${uploader.firstName} ${uploader.lastName}`.trim() : 'Utilisateur inconnu';
                
                return {
                    id: p.id,
                    filename: p.filename,
                    url: p.url,
                    uploadedByName: uploadedByName,
                    uploadedAt: p.uploadedAt
                };
            });

        res.json({
            success: true,
            pendingPhotos: pendingPhotos,
            total: pendingPhotos.length
        });

    } catch (err) {
        log.error('GET /api/galleries/:id/moderation', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/galleries/:id/stats - Statistiques galerie
 */
app.get('/api/galleries/:id/stats', (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        const stats = {
            totalPhotos: gallery.photos?.length || 0,
            approvedPhotos: (gallery.photos || []).filter(p => p.status === 'approved').length,
            pendingPhotos: (gallery.photos || []).filter(p => p.status === 'pending').length,
            rejectedPhotos: (gallery.photos || []).filter(p => p.status === 'rejected').length,

            totalViews: gallery.stats?.totalViews || 0,
            totalLikes: gallery.stats?.totalLikes || 0,
            totalComments: gallery.stats?.totalComments || 0,
            totalDownloads: gallery.stats?.totalDownloads || 0,

            engagement: {
                avgLikesPerPhoto: gallery.photos?.length > 0 
                    ? ((gallery.photos || []).reduce((sum, p) => sum + (p.likes?.length || 0), 0) / gallery.photos.length).toFixed(2)
                    : 0,
                avgCommentsPerPhoto: gallery.photos?.length > 0
                    ? ((gallery.photos || []).reduce((sum, p) => sum + (p.comments?.length || 0), 0) / gallery.photos.length).toFixed(2)
                    : 0,
                avgViewsPerPhoto: gallery.photos?.length > 0
                    ? ((gallery.photos || []).reduce((sum, p) => sum + (p.views || 0), 0) / gallery.photos.length).toFixed(2)
                    : 0
            },

             recentPhotos: (gallery.photos || [])
                .slice(0, 5)
                .map(p => ({
                    id: p.id,
                    filename: p.filename,
                    uploadedAt: p.uploadedAt,
                    likes: p.likes?.length || 0,
                    comments: p.comments?.length || 0,
                    views: p.views || 0
                })),

            topPhotos: (gallery.photos || [])
                .filter(p => p.status === 'approved')
                .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
                .slice(0, 5)
                .map(p => ({
                    id: p.id,
                    filename: p.filename,
                    likes: p.likes?.length || 0,
                    views: p.views || 0
                }))
        };

        res.json({ success: true, stats: stats });

    } catch (err) {
        log.error('GET /api/galleries/:id/stats', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



/**
 * POST /api/galleries/:id/permissions
 * Met à jour les permissions d'une galerie
 */
app.post('/api/galleries/:id/permissions', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!canEditGallery(gallery, req.user.id)) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const { viewers, contributors, moderators } = req.body;

        if (viewers) gallery.permissions.viewers = viewers;
        if (contributors) gallery.permissions.contributors = contributors;
        if (moderators) gallery.permissions.moderators = moderators;

        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('UPDATE', 'PERMISSIONS', { galleryId: req.params.id });

        res.json({
            success: true,
            permissions: gallery.permissions,
            message: 'Permissions mises à jour'
        });

    } catch (err) {
        log.error('POST /api/galleries/:id/permissions', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// ═════════════════════════════════════════════════════════════════════════════════════
// 📥 9. ENDPOINTS TÉLÉCHARGEMENTS
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/galleries/:galleryId/photos/:photoId/download - Télécharge une photo
 */
app.post('/api/galleries/:galleryId/photos/:photoId/download', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.galleryId);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!gallery.settings.allowDownloads) {
            return res.status(400).json({ success: false, error: 'Téléchargements désactivés' });
        }

        const photo = gallery.photos?.find(p => p.id === req.params.photoId);

        if (!photo) {
            return res.status(404).json({ success: false, error: 'Photo non trouvée' });
        }

        photo.downloads = (photo.downloads || 0) + 1;
        photo.downloadedBy = photo.downloadedBy || [];
        photo.downloadedBy.push({
            userId: req.user.id,
            downloadedAt: new Date().toISOString()
        });

        gallery.stats.totalDownloads++;
        gallery.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('DOWNLOAD', 'PHOTO', { photoId: req.params.photoId, userId: req.user.id });

        res.json({
            success: true,
            downloadUrl: photo.url,
            filename: photo.filename,
            message: 'Téléchargement enregistré'
        });

    } catch (err) {
        log.error('POST /api/galleries/:galleryId/photos/:photoId/download', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/galleries/:id/download/zip - Télécharge la galerie en ZIP
 */
app.get('/api/galleries/:id/download/zip', jwtAuth, async (req, res) => {
    try {
        const data = loadData();
        const gallery = data.galleries?.find(g => g.id === req.params.id);

        if (!gallery) {
            return res.status(404).json({ success: false, error: 'Galerie non trouvée' });
        }

        if (!gallery.settings.allowDownloads) {
            return res.status(400).json({ success: false, error: 'Téléchargements désactivés' });
        }

        const archive = archiver('zip', { zlib: { level: 9 } });

        res.attachment(`${gallery.name}_${moment().format('YYYY-MM-DD')}.zip`);
        archive.pipe(res);

        gallery.photos?.forEach(photo => {
            const filePath = path.join(storageManager.galleriesDir, photo.filename);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: photo.filename });
            }
        });

        await archive.finalize();

        log.crud('DOWNLOAD', 'GALLERY_ZIP', { galleryId: req.params.id });

    } catch (err) {
        log.error('GET /api/galleries/:id/download/zip', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ═════════════════════════════════════════════════════════════════════════════════════
// 💾 14. ENDPOINTS STOCKAGE & NETTOYAGE
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/storage/stats - Statistiques de stockage
 */
app.get('/api/storage/stats', jwtAuth, (req, res) => {
    try {
        const stats = storageManager.getStorageStats();

        res.json({
            success: true,
            storage: stats,
            provider: process.env.CLOUD_PROVIDER || 'local',
            quota: '100GB'
        });

    } catch (err) {
        log.error('GET /api/storage/stats', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/storage/cleanup - Nettoie les fichiers temp
 */
app.post('/api/storage/cleanup', jwtAuth, (req, res) => {
    try {
        const deleted = storageManager.cleanupTempFiles();

        res.json({
            success: true,
            message: 'Nettoyage effectué',
            filesDeleted: deleted
        });

    } catch (err) {
        log.error('POST /api/storage/cleanup', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═════════════════════════════════════════════════════════════════════════════════════
// 🛠️ 15. FONCTIONS UTILITAIRES
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si l'utilisateur peut éditer une galerie
 */
function canEditGallery(gallery, userId) {
    return gallery.createdBy === userId || gallery.permissions?.moderators?.includes(userId);
}

/**
 * Vérifie si l'utilisateur peut contribuer à une galerie
 */
function canContributeGallery(gallery, userId) {
    return gallery.createdBy === userId || 
           gallery.permissions?.contributors?.includes(userId) ||
           gallery.permissions?.moderators?.includes(userId);
}

/**
 * Vérifie si l'utilisateur peut modérer une galerie
 */
function canModerateGallery(gallery, userId) {
    return gallery.createdBy === userId || gallery.permissions?.moderators?.includes(userId);
}

/**
 * Calcule le score d'engagement d'une galerie
 */
function calculateGalleryEngagement(gallery) {
    const totalLikes = (gallery.photos || []).reduce((sum, p) => sum + (p.likes?.length || 0), 0);
    const totalComments = (gallery.photos || []).reduce((sum, p) => sum + (p.comments?.length || 0), 0);
    const totalViews = gallery.stats?.totalViews || 0;
    const photoCount = gallery.photos?.length || 1;

    return Math.round(((totalLikes * 2 + totalComments * 3 + totalViews) / photoCount) || 0);
}


// ═════════════════════════════════════════════════════════════════════════════════════
// 🍽️  10. ENDPOINTS MENUS & PLATS
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/menus - Récupère tous les menus
 */
app.get('/api/menus', (req, res) => {
    try {
        const data = loadData();
        const { eventId, status } = req.query;

        let menus = data.menus || [];

        if (eventId) menus = menus.filter(m => m.eventId === eventId);
        if (status) menus = menus.filter(m => m.status === status);

        menus = menus.map(m => ({
            ...m,
            dishCount: (m.dishes || []).length
        }));

        res.json({
            success: true,
            menus: menus,
            meta: { total: menus.length }
        });

    } catch (err) {
        log.error('GET /api/menus', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/menus - Crée un menu
 */
app.post('/api/menus', jwtAuth, (req, res) => {
    try {
        const { eventId, name, description, type } = req.body;
        const data = loadData();

        if (!eventId || !name) {
            return res.status(400).json({ success: false, error: 'eventId et name requis' });
        }

        if (!data.events?.find(e => e.id === eventId)) {
            return res.status(404).json({ success: false, error: 'Événement non trouvé' });
        }

        const menu = {
            id: generateMenuId(),
            eventId: eventId,
            name: name.trim(),
            description: description?.trim() || '',
            type: type || 'main', // main, starter, dessert, drink
            createdBy: req.user.id,
            createdByName: req.user.name,
            status: 'active',
            dishes: [],
            images: [],
            stats: {
                totalDishes: 0,
                totalRatings: 0,
                avgRating: 0
            },
            metadata: {
                tags: [],
                allergens: [],
                categories: []
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!data.menus) data.menus = [];
        data.menus.push(menu);
        saveData(data);

        log.crud('CREATE', 'MENU', { name: menu.name, eventId: eventId });

        res.status(201).json({
            success: true,
            menu: menu,
            message: 'Menu créé avec succès'
        });

    } catch (err) {
        log.error('POST /api/menus', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/menus/:id - Récupère un menu
 */
app.get('/api/menus/:id', (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.id);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        const enriched = {
            ...menu,
            dishCount: menu.dishes?.length || 0,
            stats: {
                ...menu.stats,
                totalDishes: menu.dishes?.length || 0,
                avgRating: menu.dishes?.length > 0
                    ? (menu.dishes.reduce((sum, d) => sum + (d.rating || 0), 0) / menu.dishes.length).toFixed(2)
                    : 0
            }
        };

        res.json({ success: true, menu: enriched });

    } catch (err) {
        log.error('GET /api/menus/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/menus/:id - Met à jour un menu
 */
app.put('/api/menus/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.id);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        if (menu.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const { name, description, type, metadata } = req.body;

        if (name) menu.name = name.trim();
        if (description !== undefined) menu.description = description.trim();
        if (type) menu.type = type;
        if (metadata) menu.metadata = { ...menu.metadata, ...metadata };

        menu.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({ success: true, menu: menu, message: 'Menu mis à jour' });

    } catch (err) {
        log.error('PUT /api/menus/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/menus/:id - Supprime un menu
 */
app.delete('/api/menus/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.id);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        if (menu.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        // Supprimer les images
        menu.images?.forEach(img => {
            if (img.fileId) storageManager.deleteFile(img.fileId);
        });

        data.menus = data.menus.filter(m => m.id !== req.params.id);
        saveData(data);

        log.crud('DELETE', 'MENU', { id: req.params.id });

        res.json({ success: true, message: 'Menu supprimé' });

    } catch (err) {
        log.error('DELETE /api/menus/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═════════════════════════════════════════════════════════════════════════════════════
// 🍽️  11. ENDPOINTS PLATS (DISHES)
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/menus/:menuId/dishes - Ajoute un plat au menu
 */
app.post('/api/menus/:menuId/dishes', jwtAuth, upload.single('image'), async (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.menuId);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        if (menu.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const { name, description, price, ingredients, allergens, preparation, servings, calories } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Nom du plat requis' });
        }

        let dishImage = null;

        if (req.file) {
            const uploadedFile = await storageManager.uploadFile(
                {
                    filename: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    buffer: req.file.buffer
                },
                'menu'
            );

            dishImage = {
                fileId: uploadedFile.id,
                url: uploadedFile.url,
                thumbnails: uploadedFile.thumbnails
            };
        }

        const dish = {
            id: generateDishId(),
            menuId: req.params.menuId,
            name: name.trim(),
            description: description?.trim() || '',
            price: parseFloat(price) || 0,
            image: dishImage,
            ingredients: JSON.parse(ingredients || '[]'),
            allergens: JSON.parse(allergens || '[]'),
            preparation: preparation?.trim() || '',
            servings: parseInt(servings) || 1,
            calories: parseInt(calories) || 0,
            rating: 0,
            ratings: [],
            reviews: [],
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        menu.dishes = menu.dishes || [];
        menu.dishes.push(dish);
        menu.stats.totalDishes = menu.dishes.length;
        menu.updatedAt = new Date().toISOString();

        saveData(data);

        log.crud('CREATE', 'DISH', { name: dish.name, menuId: req.params.menuId });

        res.status(201).json({
            success: true,
            dish: dish,
            message: 'Plat ajouté au menu'
        });

    } catch (err) {
        log.error('POST /api/menus/:menuId/dishes', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/menus/:menuId/dishes - Récupère les plats d'un menu
 */
app.get('/api/menus/:menuId/dishes', (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.menuId);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        const dishes = menu.dishes || [];

        res.json({
            success: true,
            dishes: dishes,
            meta: { total: dishes.length }
        });

    } catch (err) {
        log.error('GET /api/menus/:menuId/dishes', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/menus/:menuId/dishes/:dishId - Met à jour un plat
 */
app.put('/api/menus/:menuId/dishes/:dishId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.menuId);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        const dish = menu.dishes?.find(d => d.id === req.params.dishId);

        if (!dish) {
            return res.status(404).json({ success: false, error: 'Plat non trouvé' });
        }

        if (menu.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const { name, description, price, ingredients, allergens, preparation, servings, calories } = req.body;

        if (name) dish.name = name.trim();
        if (description !== undefined) dish.description = description.trim();
        if (price !== undefined) dish.price = parseFloat(price);
        if (ingredients) dish.ingredients = JSON.parse(ingredients);
        if (allergens) dish.allergens = JSON.parse(allergens);
        if (preparation !== undefined) dish.preparation = preparation.trim();
        if (servings !== undefined) dish.servings = parseInt(servings);
        if (calories !== undefined) dish.calories = parseInt(calories);

        dish.updatedAt = new Date().toISOString();
        menu.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({ success: true, dish: dish, message: 'Plat mis à jour' });

    } catch (err) {
        log.error('PUT /api/menus/:menuId/dishes/:dishId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/menus/:menuId/dishes/:dishId - Supprime un plat
 */
app.delete('/api/menus/:menuId/dishes/:dishId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.menuId);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        const dishIndex = menu.dishes?.findIndex(d => d.id === req.params.dishId);

        if (dishIndex === -1) {
            return res.status(404).json({ success: false, error: 'Plat non trouvé' });
        }

        if (menu.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const dish = menu.dishes[dishIndex];

        if (dish.image?.fileId) {
            storageManager.deleteFile(dish.image.fileId);
        }

        menu.dishes.splice(dishIndex, 1);
        menu.stats.totalDishes = menu.dishes.length;
        menu.updatedAt = new Date().toISOString();

        saveData(data);

        log.crud('DELETE', 'DISH', { dishId: req.params.dishId });

        res.json({ success: true, message: 'Plat supprimé' });

    } catch (err) {
        log.error('DELETE /api/menus/:menuId/dishes/:dishId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/menus/:menuId/dishes/:dishId/rating - Ajoute une note
 */
app.post('/api/menus/:menuId/dishes/:dishId/rating', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const menu = data.menus?.find(m => m.id === req.params.menuId);

        if (!menu) {
            return res.status(404).json({ success: false, error: 'Menu non trouvé' });
        }

        const dish = menu.dishes?.find(d => d.id === req.params.dishId);

        if (!dish) {
            return res.status(404).json({ success: false, error: 'Plat non trouvé' });
        }

        const { score, comment } = req.body;

        if (!score || score < 1 || score > 5) {
            return res.status(400).json({ success: false, error: 'Score de 1 à 5 requis' });
        }

        dish.ratings = dish.ratings || [];

        // Vérifier si l'utilisateur a déjà noté
        const existingRating = dish.ratings.find(r => r.userId === req.user.id);

        if (existingRating) {
            existingRating.score = parseInt(score);
            existingRating.comment = comment?.trim() || '';
            existingRating.ratedAt = new Date().toISOString();
        } else {
            dish.ratings.push({
                userId: req.user.id,
                userName: req.user.name,
                score: parseInt(score),
                comment: comment?.trim() || '',
                ratedAt: new Date().toISOString()
            });
        }

        // Calculer la moyenne
        dish.rating = (dish.ratings.reduce((sum, r) => sum + r.score, 0) / dish.ratings.length).toFixed(2);

        menu.stats.totalRatings = (menu.dishes || []).reduce((sum, d) => sum + (d.ratings?.length || 0), 0);
        menu.updatedAt = new Date().toISOString();

        saveData(data);

        log.crud('CREATE', 'RATING', { dishId: req.params.dishId, score: score });

        res.json({
            success: true,
            dish: dish,
            message: 'Note enregistrée'
        });

    } catch (err) {
        log.error('POST /api/menus/:menuId/dishes/:dishId/rating', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═════════════════════════════════════════════════════════════════════════════════════
// 🗺️  12. ENDPOINTS PLANS INTERACTIFS
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/plans - Récupère tous les plans
 */
app.get('/api/plans', (req, res) => {
    try {
        const data = loadData();
        const { eventId } = req.query;

        let plans = data.plans || [];

        if (eventId) plans = plans.filter(p => p.eventId === eventId);

        res.json({
            success: true,
            plans: plans,
            meta: { total: plans.length }
        });

    } catch (err) {
        log.error('GET /api/plans', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/plans - Crée un plan
 */
app.post('/api/plans', jwtAuth, upload.single('image'), async (req, res) => {
    try {
        const { eventId, name, description, type } = req.body;
        const data = loadData();

        if (!eventId || !name) {
            return res.status(400).json({ success: false, error: 'eventId et name requis' });
        }

        if (!data.events?.find(e => e.id === eventId)) {
            return res.status(404).json({ success: false, error: 'Événement non trouvé' });
        }

        let planImage = null;

        if (req.file) {
            const uploadedFile = await storageManager.uploadFile(
                {
                    filename: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    buffer: req.file.buffer
                },
                'menu'
            );

            planImage = {
                fileId: uploadedFile.id,
                url: uploadedFile.url,
                thumbnails: uploadedFile.thumbnails
            };
        }

        const plan = {
            id: generatePlanId(),
            eventId: eventId,
            name: name.trim(),
            description: description?.trim() || '',
            type: type || 'venue', // venue, seating, layout
            image: planImage,
            locations: [],
            zones: [],
            createdBy: req.user.id,
            createdByName: req.user.name,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!data.plans) data.plans = [];
        data.plans.push(plan);
        saveData(data);

        log.crud('CREATE', 'PLAN', { name: plan.name, eventId: eventId });

        res.status(201).json({
            success: true,
            plan: plan,
            message: 'Plan créé'
        });

    } catch (err) {
        log.error('POST /api/plans', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/plans/:planId/locations - Ajoute un lieu sur le plan
 */
app.post('/api/plans/:planId/locations', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const plan = data.plans?.find(p => p.id === req.params.planId);

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan non trouvé' });
        }

        if (plan.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const { name, description, x, y, type, info } = req.body;

        if (!name || x === undefined || y === undefined) {
            return res.status(400).json({ success: false, error: 'name, x, y requis' });
        }

        const location = {
            id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            description: description?.trim() || '',
            coordinates: { x: parseFloat(x), y: parseFloat(y) },
            type: type || 'point', // point, zone, room
            info: info || {},
            createdAt: new Date().toISOString()
        };

        plan.locations = plan.locations || [];
        plan.locations.push(location);
        plan.updatedAt = new Date().toISOString();

        saveData(data);

        log.crud('CREATE', 'LOCATION', { name: location.name, planId: req.params.planId });

        res.status(201).json({
            success: true,
            location: location,
            message: 'Lieu ajouté au plan'
        });

    } catch (err) {
        log.error('POST /api/plans/:planId/locations', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/plans/:planId/locations - Récupère les lieux d'un plan
 */
app.get('/api/plans/:planId/locations', (req, res) => {
    try {
        const data = loadData();
        const plan = data.plans?.find(p => p.id === req.params.planId);

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan non trouvé' });
        }

        res.json({
            success: true,
            locations: plan.locations || [],
            meta: { total: (plan.locations || []).length }
        });

    } catch (err) {
        log.error('GET /api/plans/:planId/locations', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/plans/:planId/locations/:locationId - Met à jour un lieu
 */
app.put('/api/plans/:planId/locations/:locationId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const plan = data.plans?.find(p => p.id === req.params.planId);

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan non trouvé' });
        }

        if (plan.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        const location = plan.locations?.find(l => l.id === req.params.locationId);

        if (!location) {
            return res.status(404).json({ success: false, error: 'Lieu non trouvé' });
        }

        const { name, description, x, y, info } = req.body;

        if (name) location.name = name.trim();
        if (description !== undefined) location.description = description.trim();
        if (x !== undefined) location.coordinates.x = parseFloat(x);
        if (y !== undefined) location.coordinates.y = parseFloat(y);
        if (info) location.info = { ...location.info, ...info };

        plan.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({ success: true, location: location, message: 'Lieu mis à jour' });

    } catch (err) {
        log.error('PUT /api/plans/:planId/locations/:locationId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/plans/:planId/locations/:locationId - Supprime un lieu
 */
app.delete('/api/plans/:planId/locations/:locationId', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const plan = data.plans?.find(p => p.id === req.params.planId);

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan non trouvé' });
        }

        if (plan.createdBy !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Permission refusée' });
        }

        plan.locations = plan.locations.filter(l => l.id !== req.params.locationId);
        plan.updatedAt = new Date().toISOString();

        saveData(data);

        log.crud('DELETE', 'LOCATION', { locationId: req.params.locationId });

        res.json({ success: true, message: 'Lieu supprimé' });

    } catch (err) {
        log.error('DELETE /api/plans/:planId/locations/:locationId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═════════════════════════════════════════════════════════════════════════════════════
// 💬 13. ENDPOINTS CHAT ULTRA SÉCURISÉ
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/conversations - Récupère les conversations de l'utilisateur avec participants enrichis
 */
app.get('/api/chat/conversations', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const { eventId, participantId } = req.query;

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);
        const queryEventId = eventId || getEventIdFromRequest(req, req.query);

        let conversations = data.chatConversations || [];

        // Filtrer par événement
        if (queryEventId) {
            conversations = conversations.filter(c => c.eventId === queryEventId);
        }

        // Filtrer par participant spécifique
        if (participantId) {
            conversations = conversations.filter(c => 
                c.participants.some(p => p.userId === participantId)
            );
        }

        // Filtrer par utilisateur/invité actuel (seulement ses conversations)
        conversations = conversations.filter(c => 
            c.participants.some(p => p.userId === userId)
        );

        // Enrichir chaque conversation avec les infos utilisateur des participants
        conversations = conversations.map(conversation => ({
            ...conversation,
            participants: enrichParticipantsWithUserInfo(conversation.participants, data),
            unreadCount: (conversation.messages || []).filter(m => 
                m.readBy?.some(r => r.userId === userId) === false && m.senderId !== userId
            ).length,
            lastMessage: conversation.messages?.[conversation.messages.length - 1] || null
        }));

        log.success('GET /api/chat/conversations', `${conversations.length} conversations retrieved for user ${userId}`);

        res.json({
            success: true,
            conversations: conversations,
            meta: { 
                total: conversations.length,
                eventId: queryEventId
            },
            authMethod: req.user ? 'user' : 'eventSession'
        });

    } catch (err) {
        log.error('GET /api/chat/conversations', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/chat/conversations - Crée une conversation
 */
app.post('/api/chat/conversations', eventSessionAuth, (req, res) => {
    try {
        const { eventId, name, participantIds, type } = req.body;
        const data = loadData();

        if (!eventId) {
            return res.status(400).json({ success: false, error: 'eventId requis' });
        }

        if (!data.events?.find(e => e.id === eventId)) {
            return res.status(404).json({ success: false, error: 'Événement non trouvé' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);
        const now = new Date().toISOString();

        const allParticipants = [userId, ...(participantIds || [])];
        const uniqueParticipants = [...new Set(allParticipants)];

        // Créer les participants avec enrichissement
        // ⚠️ IMPORTANT : seul le créateur a joinedAt et lastReadAt au démarrage
        let participants = uniqueParticipants.map(pid => ({
            userId: pid,
            joinedAt: pid === userId ? now : null,  // Seulement le créateur
            lastReadAt: pid === userId ? now : null  // Seulement le créateur
        }));

        // Enrichir avec les infos utilisateur (firstName, lastName, email, gender, notes, isOnline, lastSeen, status)
        participants = enrichParticipantsWithUserInfo(participants, data);

        const conversation = {
            id: generateChatId(),
            eventId: eventId,
            name: name?.trim() || `Chat ${moment().format('DD/MM HH:mm')}`,
            type: type || 'group',
            participants: participants,
            messages: [],
            settings: {
                allowDelete: true,
                allowEdit: true,
                encrypted: true,
                archiveAfterDays: 90
            },
            createdBy: userId,
            createdAt: now,
            updatedAt: now
        };

        if (!data.chatConversations) data.chatConversations = [];
        data.chatConversations.push(conversation);
        saveData(data);

        log.crud('CREATE', 'CONVERSATION', { eventId: eventId, participants: uniqueParticipants.length });

        res.status(201).json({
            success: true,
            conversation: conversation,
            message: 'Conversation créée'
        });

    } catch (err) {
        log.error('POST /api/chat/conversations', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/chat/conversations/:conversationId/messages - Ajoute un message
 */
app.post('/api/chat/conversations/:conversationId/messages', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);
        const userName = getUserNameFromRequest(req);

        // Vérifier que l'utilisateur est participant
        if (!conversation.participants.some(p => p.userId === userId)) {
            return res.status(403).json({ success: false, error: 'Vous n\'êtes pas participant' });
        }

        const { content, attachments, type, replyTo } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Message vide' });
        }

        // Vérifier que le message auquel on répond existe (si replyTo est fourni)
        if (replyTo) {
            const repliedMessage = conversation.messages?.find(m => m.id === replyTo);
            if (!repliedMessage) {
                return res.status(400).json({ success: false, error: 'Message auquel répondre introuvable' });
            }
        }

        const message = {
            id: generateMessageId(),
            conversationId: req.params.conversationId,
            senderId: userId,
            senderName: userName,
            content: content.trim(),
            type: type || 'text', 
            attachments: attachments || [],
            replyTo: replyTo || null,
            readBy: [],
            reactions: {}, 
            edited: false,
            editedAt: null,
            createdAt: new Date().toISOString(),
            deletedAt: null
        };

        conversation.messages = conversation.messages || [];
        conversation.messages.push(message);

         
            
            
        // Mettre à jour le lastReadAt
        const participant = conversation.participants.find(p => p.userId === userId);
        if (participant) {
            participant.lastReadAt = new Date().toISOString();
        }


        conversation.lastMessage = message;
        conversation.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('CREATE', 'MESSAGE', { 
            conversationId: req.params.conversationId, 
            senderId: userId,
            replyTo: replyTo || null,
            length: content.length
        });

        res.status(201).json({
            success: true,
            message: message,
            totalMessages: conversation.messages.length
        });

    } catch (err) {
        log.error('POST /api/chat/conversations/:conversationId/messages', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/chat/conversations/:conversationId/messages - Récupère les messages
 */
app.get('/api/chat/conversations/:conversationId/messages', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);

        if (!conversation.participants.some(p => p.userId === userId)) {
            return res.status(403).json({ success: false, error: 'Vous n\'êtes pas participant' });
        }

        const { limit = 50, offset = 0 } = req.query;

        let messages = conversation.messages || [];

        // Normaliser la forme des réactions pour les données legacy
        // Certains anciens enregistrements avaient `reactions: []` au lieu d'un objet { emoji: [userIds] }
        conversation.messages = (conversation.messages || []).map(m => {
            const msg = { ...m };
            if (Array.isArray(msg.reactions)) {
                msg.reactions = {};
            } else if (!msg.reactions) {
                msg.reactions = {};
            } else {
                // S'assurer que chaque clé emoji contient un tableau d'IDs
                Object.keys(msg.reactions).forEach(emoji => {
                    if (!Array.isArray(msg.reactions[emoji])) {
                        // Si la valeur était un objet { users: [...] }, récupérer users, sinon vider
                        if (msg.reactions[emoji] && Array.isArray(msg.reactions[emoji].users)) {
                            msg.reactions[emoji] = msg.reactions[emoji].users;
                        } else {
                            msg.reactions[emoji] = [];
                        }
                    }
                });
            }
            return msg;
        });
        messages = messages.filter(m => !m.deletedAt); // Exclure les messages supprimés
        messages = messages.slice(-limit - offset, -offset || undefined);

        // Marquer comme lus
        messages.forEach(msg => {
            if (msg.senderId !== userId) {
                const alreadyRead = msg.readBy.some(r => r.userId === userId);
                if (!alreadyRead) {
                    msg.readBy.push({
                        userId: userId,
                        readAt: new Date().toISOString()
                    });
                }
            }
        });

        conversation.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({
            success: true,
            messages: messages,
            meta: {
                total: (conversation.messages || []).length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (err) {
        log.error('GET /api/chat/conversations/:conversationId/messages', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/chat/conversations/:conversationId/mark-as-read - Marque une conversation comme lue
 */
app.post('/api/chat/conversations/:conversationId/mark-as-read', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);

        // Vérifier que l'utilisateur est participant
        if (!conversation.participants.some(p => p.userId === userId)) {
            return res.status(403).json({ success: false, error: 'Vous n\'êtes pas participant' });
        }

        // Marquer tous les messages comme lus
        conversation.messages?.forEach(msg => {
            if (msg.senderId !== userId) {
                const alreadyRead = msg.readBy?.some(r => r.userId === userId);
                if (!alreadyRead) {
                    msg.readBy = msg.readBy || [];
                    msg.readBy.push({
                        userId: userId,
                        readAt: new Date().toISOString()
                    });
                }
            }
        });

        // Mettre à jour le lastReadAt du participant
        const participant = conversation.participants.find(p => p.userId === userId);
        if (participant) {
            participant.lastReadAt = new Date().toISOString();
            participant.unreadCount = 0;
        }

        conversation.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('UPDATE', 'CONVERSATION_READ', {
            conversationId: req.params.conversationId,
            userId: userId
        });

        res.json({
            success: true,
            message: 'Conversation marquée comme lue',
            lastReadAt: new Date().toISOString()
        });

    } catch (err) {
        log.error('POST /api/chat/conversations/:conversationId/mark-as-read', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/chat/conversations/:conversationId/messages/:messageId/reaction - Ajoute une réaction à un message
 */
app.post('/api/chat/conversations/:conversationId/messages/:messageId/reaction', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);

        // Vérifier que l'utilisateur est participant
        if (!conversation.participants.some(p => p.userId === userId)) {
            return res.status(403).json({ success: false, error: 'Vous n\'êtes pas participant' });
        }

        // Trouver le message
        const message = conversation.messages?.find(m => m.id === req.params.messageId);
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message non trouvé' });
        }

        const { emoji } = req.body;
        if (!emoji) {
            return res.status(400).json({ success: false, error: 'Emoji requis' });
        }

        // Normaliser les réactions - convertir array en objet si nécessaire
        if (Array.isArray(message.reactions)) {
            message.reactions = {};
        } else if (!message.reactions) {
            message.reactions = {};
        }

        // Ajouter la réaction (emoji = clé)
        if (!message.reactions[emoji]) {
            message.reactions[emoji] = [];
        }

        // Vérifier que l'utilisateur n'a pas déjà mis cette réaction
        if (!Array.isArray(message.reactions[emoji])) {
            message.reactions[emoji] = [];
        }
        
        if (!message.reactions[emoji].includes(userId)) {
            message.reactions[emoji].push(userId);
        }

        conversation.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('CREATE', 'REACTION', {
            messageId: req.params.messageId,
            conversationId: req.params.conversationId,
            emoji: emoji,
            userId: userId
        });

        res.status(201).json({
            success: true,
            message: message,
            reactions: message.reactions,
            reaction: { emoji, userId }
        });

    } catch (err) {
        log.error('POST /api/chat/conversations/:conversationId/messages/:messageId/reaction', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/chat/conversations/:conversationId/messages/:messageId/reaction/:emoji - Retire une réaction
 */
app.delete('/api/chat/conversations/:conversationId/messages/:messageId/reaction/:emoji', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);

        // Vérifier que l'utilisateur est participant
        if (!conversation.participants.some(p => p.userId === userId)) {
            return res.status(403).json({ success: false, error: 'Vous n\'êtes pas participant' });
        }

        // Trouver le message
        const message = conversation.messages?.find(m => m.id === req.params.messageId);
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message non trouvé' });
        }

        // Normaliser les réactions - convertir array en objet si nécessaire
        if (Array.isArray(message.reactions)) {
            message.reactions = {};
        }
        
        if (!message.reactions || Object.keys(message.reactions).length === 0) {
            return res.status(404).json({ success: false, error: 'Pas de réactions sur ce message' });
        }

        const emoji = req.params.emoji;

        if (!message.reactions[emoji]) {
            return res.status(404).json({ success: false, error: 'Réaction non trouvée' });
        }

        // Normaliser le tableau de réactions si nécessaire
        if (!Array.isArray(message.reactions[emoji])) {
            message.reactions[emoji] = [];
        }

        // Retirer la réaction de l'utilisateur
        const reactionIndex = message.reactions[emoji].indexOf(userId);
        if (reactionIndex === -1) {
            return res.status(400).json({ success: false, error: 'Vous n\'avez pas mis cette réaction' });
        }

        message.reactions[emoji].splice(reactionIndex, 1);

        // Supprimer l'emoji s'il n'y a plus de réactions
        if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
        }

        conversation.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('DELETE', 'REACTION', {
            messageId: req.params.messageId,
            conversationId: req.params.conversationId,
            emoji: emoji,
            userId: userId
        });

        res.json({
            success: true,
            message: message,
            reactions: message.reactions
        });

    } catch (err) {
        log.error('DELETE /api/chat/conversations/:conversationId/messages/:messageId/reaction/:emoji', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/chat/conversations/:conversationId/messages/:messageId/reactions - Récupère les réactions d'un message
 */
app.get('/api/chat/conversations/:conversationId/messages/:messageId/reactions', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);

        // Vérifier que l'utilisateur est participant
        if (!conversation.participants.some(p => p.userId === userId)) {
            return res.status(403).json({ success: false, error: 'Vous n\'êtes pas participant' });
        }

        // Trouver le message
        const message = conversation.messages?.find(m => m.id === req.params.messageId);
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message non trouvé' });
        }

        const reactions = message.reactions || {};

        // Enrichir les réactions avec les infos des utilisateurs
        const enrichedReactions = {};
        for (const [emoji, userIds] of Object.entries(reactions)) {
            enrichedReactions[emoji] = userIds.map(uid => {
                const participant = conversation.participants.find(p => p.userId === uid);
                return {
                    userId: uid,
                    name: participant?.name || 'Utilisateur inconnu',
                    avatar: participant?.avatar || null
                };
            });
        }

        res.json({
            success: true,
            messageId: req.params.messageId,
            reactions: reactions,
            enrichedReactions: enrichedReactions,
            totalReactions: Object.values(reactions).reduce((sum, users) => sum + users.length, 0)
        });

    } catch (err) {
        log.error('GET /api/chat/conversations/:conversationId/messages/:messageId/reactions', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



/**
 * PUT /api/chat/conversations/:conversationId/messages/:messageId - Édite un message
 */
app.put('/api/chat/conversations/:conversationId/messages/:messageId', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        const message = conversation.messages?.find(m => m.id === req.params.messageId);

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message non trouvé' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);

        if (message.senderId !== userId) {
            return res.status(403).json({ success: false, error: 'Vous ne pouvez pas éditer' });
        }

        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Contenu vide' });
        }

        message.content = content.trim();
        message.edited = true;
        message.editedAt = new Date().toISOString();

        conversation.updatedAt = new Date().toISOString();
        saveData(data);

        res.json({ success: true, message: message, message: 'Message édité' });

    } catch (err) {
        log.error('PUT /api/chat/conversations/:conversationId/messages/:messageId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/chat/conversations/:conversationId/messages/:messageId - Supprime un message
 */
app.delete('/api/chat/conversations/:conversationId/messages/:messageId', eventSessionAuth, (req,res) => {
    try {
        const data = loadData();
        const conversation = data.chatConversations?.find(c => c.id === req.params.conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }

        const message = conversation.messages?.find(m => m.id === req.params.messageId);

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message non trouvé' });
        }

        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);

        if (message.senderId !== userId) {
            return res.status(403).json({ success: false, error: 'Vous ne pouvez pas supprimer' });
        }

        message.deletedAt = new Date().toISOString();
        message.content = 'Message supprimé';

        conversation.updatedAt = new Date().toISOString();
        saveData(data);

        log.crud('DELETE', 'MESSAGE', { messageId: req.params.messageId });

        // ✅ Notifier TOUS les participants via WebSocket
        if (io && io.of('/chat')) {
            const participantIds = conversation.participants?.map(p => p.id) || 
                                  [conversation.createdBy, ...(conversation.participantIds || [])];
            
            io.of('/chat').emit('message:deleted', {
                conversationId: req.params.conversationId,
                messageId: req.params.messageId,
                deletedAt: message.deletedAt,
                participantIds: participantIds
            });
            
            console.log(`🗑️ Message supprimé - ID: ${req.params.messageId}, Conversation: ${req.params.conversationId}`);
        }

        res.json({ success: true, message: 'Message supprimé' });

    } catch (err) {
        log.error('DELETE /api/chat/conversations/:conversationId/messages/:messageId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});





// ═══════════════════════════════════════════════════════════════
// DASHBOARD API  - RACINE /
app.get('/', (req, res) => {
    const dashboard = path.join(__dirname, 'dashboard.html');
    res.sendFile(dashboard);
});

app.get('/register', (req, res) => {
    const registerPath = path.join(__dirname, 'register.html');
        log.success('Accès au register secret', req.ip);
        res.sendFile(registerPath);
});

app.get('/logo', (req, res) => {
    const registerPath = path.join(__dirname, 'icon.png');
        log.success('logo charge', req.ip);
        res.sendFile(registerPath);
});

// ═══════════════════════════════════════════════════════════════
// 📄 FRONTEND - PAGES STATIQUES
// ═══════════════════════════════════════════════════════════════


// 404 personnalisé
app.get('*', (req, res ,next) => {

     const apiKey = req.headers['dash'];
     
    if (apiKey === "dashboard") {
        return res.status(404).json({ error: 'Endpoint non trouvé Consultez /api pour la documentation' });
    }

    if (!req.path.startsWith('/api') && !req.path.startsWith('/db')) {
        const notFoundPath = path.join(__dirname, '404.html');
        if (fs.existsSync(notFoundPath)) {
            log.warning('404', `${req.method} ${req.originalUrl}`);
            return res.status(404).sendFile(notFoundPath);
        } else {
            return res.status(404).send('<h1>404 - Endpoint non trouvé</h1><p><a href="/">Consultez /api pour la documentation</a></p>');
        }
    }
});

/**
 * DELETE /api/chat/conversations/:conversationId - Supprime une conversation
 */
app.delete('/api/chat/conversations/:conversationId', eventSessionAuth, (req, res) => {
    try {
        const data = loadData();
        const conversationId = req.params.conversationId;
        
        // Trouver la conversation
        const conversationIndex = data.chatConversations?.findIndex(c => c.id === conversationId);
        if (conversationIndex === -1) {
            return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
        }
        
        const conversation = data.chatConversations[conversationIndex];
        
        // Obtenir l'ID utilisateur/invité
        const userId = getUserIdFromRequest(req);
        
        // Vérifier que l'utilisateur est participant
        if (!conversation.participants.some(p => p.userId === userId)) {
            return res.status(403).json({ success: false, error: 'Vous ne pouvez pas supprimer cette conversation' });
        }
        
        // Supprimer la conversation
        data.chatConversations.splice(conversationIndex, 1);
        saveData(data);
        
        log.crud('DELETE', 'CONVERSATION', {
            conversationId: conversationId,
            deletedBy: userId,
            participantCount: conversation.participants.length
        });
        
        res.json({ success: true, message: 'Conversation supprimée' });
        
    } catch (err) {
        log.error('DELETE /api/chat/conversations/:conversationId', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



const cleanOldBackups = () => {
    try {
        const files = fs.readdirSync(CONFIG.BACKUP_DIR);
        const cutoff = moment().subtract(CONFIG.BACKUP_RETENTION_DAYS, 'days');
        
        let deleted = 0;
        files.forEach(file => {
            const filepath = path.join(CONFIG.BACKUP_DIR, file);
            const stats = fs.statSync(filepath);
            
            if (moment(stats.mtime).isBefore(cutoff)) {
                fs.unlinkSync(filepath);
                deleted++;
            }
        });
        
        if (deleted > 0) {
            log.info(`Backups nettoyés`, `${deleted} fichiers supprimés`);
        }
    } catch (err) {
        log.error('Erreur nettoyage backups', err.message);
    }
};

// ═══════════════════════════════════════════════════════════════
// ❌ ERROR HANDLER GLOBAL
// ═══════════════════════════════════════════════════════════════

app.use((err, req, res, next) => {
    log.error('Erreur serveur', err.message);
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: err.message || 'Erreur interne du serveur',
        timestamp: new Date().toISOString()
    });
});



// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION WEBSOCKET ET SERVEUR HTTP
// ═══════════════════════════════════════════════════════════════

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

// ═══════════════════════════════════════════════════════════════
// 💬 WEBSOCKET CHAT HANDLERS
// ═══════════════════════════════════════════════════════════════

const chatNamespace = io.of('/chat');

// Map pour tracker les utilisateurs par session
const userSessions = new Map();
const conversationRooms = new Map();

chatNamespace.on('connection', (socket) => {
    const sessionToken = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;
    const eventId = socket.handshake.auth.eventId;
    
    if (!sessionToken || !userId || !eventId) {
        socket.disconnect();
        return;
    }
    
    // Enregistrer la session utilisateur
    userSessions.set(socket.id, { userId, eventId, sessionToken, connectedAt: new Date() });
    
    log.success('💬 Chat User Connected', `User: ${userId} | Socket: ${socket.id}`);
    
    // 🔌 Événement: Utilisateur en ligne
    socket.on('user:online', (data) => {
        // Mettre à jour le status dans les données globales
        const data_obj = loadData();
        const user = data_obj.guests?.find(g => g.id === userId) || data_obj.users?.find(u => u.id === userId);
        if (user) {
            user.isOnline = true;
            user.status = 'online';
            user.lastSeen = new Date().toISOString();
        }
        
        // 🔥 IMPORTANT: Mettre à jour tous les participants avec cet userId dans TOUTES les conversations
        if (data_obj.chatConversations) {
            data_obj.chatConversations.forEach(conversation => {
                const participant = conversation.participants?.find(p => p.userId === userId);
                if (participant) {
                    participant.isOnline = true;
                    participant.status = 'online';
                    participant.lastSeenAt = new Date().toISOString();
                }
            });
        }
        
        saveData(data_obj);
        
        // Émettre le statut à tous les utilisateurs dans le namespace chat
        // Schéma: { userId, status, isOnline, lastSeenAt, timestamp }
        chatNamespace.emit('user:status', {
            userId,
            status: 'online',
            isOnline: true,
            lastSeenAt: new Date().toISOString(),
            timestamp: new Date()
        });
        
        log.success('🟢 User Online', `User: ${userId} | Socket: ${socket.id}`);
    });
    
    // 💬 Événement: Nouveau message
    socket.on('message:send', (data) => {
        const { conversationId, content, messageId, timestamp } = data;
        
        if (!conversationId || !content) return;
        
        // Charger les données pour obtenir info de la conversation et participants
        try {
            const data_obj = loadData();
            const conversation = data_obj.chatConversations?.find(c => c.id === conversationId);
            
           
           
            const participantIds = conversation.participants?.map(p => p.userId) || [];
            
            // Diffuser à tous les utilisateurs DANS la conversation
            chatNamespace.to(`conv:${conversationId}`).emit('message:new', {
                id: messageId,
                conversationId,
                senderId: userId,
                content,
                timestamp: timestamp || new Date(),
                type: 'text'
            });
            
            // Notifier TOUS les participants (y compris ceux qui ne sont pas dedans) pour mettre à jour leur liste
            chatNamespace.emit('conversation:message-received', {
                conversationId,
                senderId: userId,
                messagePreview: content.substring(0, 50),
                timestamp: new Date(),
                participantIds: participantIds,
                lastMessage: messageObj
            });
            
        } catch (err) {
            log.error('⚠️ Erreur mise à jour conversation message', err.message);
        }
        
        log.success('💬 Message sent', `Conv: ${conversationId} | User: ${userId}`);
    });
    
    socket.on('message:typing', (data) => {
        const { conversationId } = data;
        
        chatNamespace.to(`conv:${conversationId}`).emit('message:typing', {
            userId,
            conversationId,
            isTyping: true,
            timestamp: new Date()
        });

    });
    
    // 👁️ Événement: Utilisateur arrête de taper
    socket.on('message:stop-typing', (data) => {
        const { conversationId } = data;
        
        chatNamespace.to(`conv:${conversationId}`).emit('message:typing', {
            userId,
            conversationId,
            isTyping: false,
            timestamp: new Date()
        });
    });
    
    // 📍 Événement: Rejoindre une conversation
    socket.on('conversation:join', (data) => {
        const { conversationId } = data;
        
        socket.join(`conv:${conversationId}`);
        
        // Mettre à jour le count des utilisateurs dans la conversation
        const roomName = `conv:${conversationId}`;
        const userCount = chatNamespace.sockets?.adapter?.rooms?.get(roomName)?.size || 0;
        
        chatNamespace.to(roomName).emit('conversation:user-joined', {
            userId,
            userCount,
            timestamp: new Date()
        });
        
        log.success('📍 User joined conversation', `Conv: ${conversationId} | Users: ${userCount}`);
    });
    
    // 📍 Événement: Quitter une conversation
    socket.on('conversation:leave', (data) => {
        const { conversationId } = data;
        
        socket.leave(`conv:${conversationId}`);
        
        const roomName = `conv:${conversationId}`;
        const userCount = chatNamespace.sockets?.adapter?.rooms?.get(roomName)?.size || 0;
        
        chatNamespace.to(roomName).emit('conversation:user-left', {
            userId,
            userCount,
            timestamp: new Date()
        });
        
        log.success('📍 User left conversation', `Conv: ${conversationId} | Users: ${userCount}`);
    });
    
    // 👍 Événement: Réaction/Emoji - Ajouter une réaction
    socket.on('message:reaction:add', (data) => {
        const { conversationId, messageId, emoji } = data;
        
        if (!conversationId || !messageId || !emoji) {
            log.warning('⚠️ message:reaction:add - données manquantes', data);
            return;
        }
        
        // Charger les données et ajouter la réaction
        try {
            const data_obj = loadData();
            const conversation = data_obj.chatConversations?.find(c => c.id === conversationId);
            
            if (!conversation) return;
            
            const message = conversation.messages?.find(m => m.id === messageId);
            if (!message) return;
            
            // Initialiser et ajouter la réaction
            if (!message.reactions) {
                message.reactions = {};
            }
            
            if (!message.reactions[emoji]) {
                message.reactions[emoji] = [];
            }
            
            if (!message.reactions[emoji].includes(userId)) {
                message.reactions[emoji].push(userId);
                saveData(data_obj);
            }
        } catch (err) {
            log.error('⚠️ message:reaction:add', err.message);
        }
        
        // Diffuser à la conversation
        chatNamespace.to(`conv:${conversationId}`).emit('message:reaction', {
            conversationId,
            messageId,
            userId,
            emoji,
            action: 'added',
            timestamp: new Date()
        });
        
        log.success('👍 Reaction added', `Conv: ${conversationId} | Message: ${messageId} | Emoji: ${emoji}`);
    });
    
    // 👍 Événement: Réaction/Emoji - Retirer une réaction
    socket.on('message:reaction:remove', (data) => {
        const { conversationId, messageId, emoji } = data;
        
        if (!conversationId || !messageId || !emoji) {
            log.warning('⚠️ message:reaction:remove - données manquantes', data);
            return;
        }
        
        // Charger les données et retirer la réaction
        try {
            const data_obj = loadData();
            const conversation = data_obj.chatConversations?.find(c => c.id === conversationId);
            
            if (!conversation) return;
            
            const message = conversation.messages?.find(m => m.id === messageId);
            if (!message) return;
            
            if (!message.reactions) return;
            
            if (message.reactions[emoji]) {
                const index = message.reactions[emoji].indexOf(userId);
                if (index !== -1) {
                    message.reactions[emoji].splice(index, 1);
                    
                    // Supprimer l'emoji s'il n'y a plus de réactions
                    if (message.reactions[emoji].length === 0) {
                        delete message.reactions[emoji];
                    }
                    
                    saveData(data_obj);
                }
            }
        } catch (err) {
            log.error('⚠️ message:reaction:remove', err.message);
        }
        
        // Diffuser à la conversation
        chatNamespace.to(`conv:${conversationId}`).emit('message:reaction', {
            conversationId,
            messageId,
            userId,
            emoji,
            action: 'removed',
            timestamp: new Date()
        });
        
        log.success('👍 Reaction removed', `Conv: ${conversationId} | Message: ${messageId} | Emoji: ${emoji}`);
    });
    
    // 🔄 Événement: Synchronisation des conversations
    socket.on('conversations:sync', (data) => {
        socket.emit('conversations:sync-request', {
            eventId,
            userId,
            timestamp: new Date()
        });
    });
    
    // ✨ Événement: Nouvelle conversation créée
    socket.on('conversation:created', (data) => {
        const { conversationId, conversationData, participantIds } = data;
        
        if (!conversationId || !conversationData) {
            log.warning('⚠️ conversation:created - données manquantes', data);
            return;
        }
        
        // ✅ Émettre à TOUS les participants concernés SEULEMENT
        chatNamespace.emit('conversation:created', {
            conversationId,
            conversation: conversationData,
            participantIds: participantIds,
            createdBy: userId,
            createdAt: new Date(),
            timestamp: new Date()
        });
        
        log.success('✨ Conversation créée via WebSocket', `Conv: ${conversationId} | Participants: ${participantIds?.length || 0}`);
    });
    
    // 📨 Événement: Mise à jour de conversation
    socket.on('conversation:updated', (data) => {
        const { conversationId, conversationData, participantIds } = data;
        
        if (!conversationId || !conversationData) {
            log.warning('⚠️ conversation:updated - données manquantes', data);
            return;
        }
        
        // ✅ Émettre à TOUS les participants concernés
        chatNamespace.emit('conversation:updated', {
            conversationId,
            conversation: conversationData,
            participantIds: participantIds,
            updatedBy: userId,
            updatedAt: new Date(),
            timestamp: new Date()
        });
        
        log.success('📨 Conversation mise à jour via WebSocket', `Conv: ${conversationId}`);
    });
    
    // 📝 Événement: Modification de message
    socket.on('message:edit', (data) => {
        const { conversationId, messageId, newContent } = data;
        
        chatNamespace.to(`conv:${conversationId}`).emit('message:edited', {
            messageId,
            newContent,
            editedBy: userId,
            editedAt: new Date()
        });
    });
    
    // 🗑️ Événement: Suppression de message
    socket.on('message:delete', (data) => {
        const { conversationId, messageId } = data;
        
        chatNamespace.to(`conv:${conversationId}`).emit('message:deleted', {
            messageId,
            deletedBy: userId,
            deletedAt: new Date()
        });
    });
    
    // �️ Événement: Suppression de conversation
    socket.on('conversation:deleted', (data) => {
        const { conversationId, deletedBy, timestamp } = data;
        console.log('🗑️ Conversation delete received:', { conversationId, deletedBy });
        
        // ✅ Émettre à TOUS les utilisateurs du namespace
        chatNamespace.emit('conversation:deleted', {
            conversationId,
            deletedBy,
            timestamp: timestamp || new Date()
        });
        
        log.success('💬 Conversation supprimée via WebSocket', `Conv: ${conversationId} | By: ${deletedBy}`);
    });
    
    // �🔌 Déconnexion
    
    socket.on('disconnect', () => {
        userSessions.delete(socket.id);
        
        // Marquer l'utilisateur comme offline
        const data_obj = loadData();
        const user = data_obj.guests?.find(g => g.id === userId) || data_obj.users?.find(u => u.id === userId);
        if (user) {
            user.isOnline = false;
            user.status = 'offline';
            user.lastSeen = new Date().toISOString();
        }
        
        // 🔥 IMPORTANT: Mettre à jour tous les participants avec cet userId dans TOUTES les conversations
        if (data_obj.chatConversations) {
            data_obj.chatConversations.forEach(conversation => {
                const participant = conversation.participants?.find(p => p.userId === userId);
                if (participant) {
                    participant.isOnline = false;
                    participant.status = 'offline';
                    participant.lastSeenAt = new Date().toISOString();
                }
            });
        }
        
        saveData(data_obj);
        
        // Notifier les autres utilisateurs
        // Schéma: { userId, status, isOnline, lastSeenAt, timestamp }
        chatNamespace.emit('user:status', {
            userId,
            status: 'offline',
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
            timestamp: new Date()
        });
        
        log.warning('🔴 Chat User Disconnected', `User: ${userId} | Socket: ${socket.id}`);
    });
    
    // Gestion des erreurs
    socket.on('error', (err) => {
        log.error('💬 Socket Error', err.message);
    });
});

// ═══════════════════════════════════════════════════════════════
// 🚀 DÉMARRAGE SERVEUR
// ═══════════════════════════════════════════════════════════════

server.listen(CONFIG.PORT, () => {
    console.clear();
    
    log.box([
        '🛡️  SECURA QR SERVER - ULTRA PRO V3.0  🛡️',
        '',
        `📡 Serveur:      ${chalk.bold.green(CONFIG.BASE_URL)}`,
        `🌐 API:          ${chalk.bold.cyan(CONFIG.BASE_URL + '/api')}`,
        `📊 JSON DB:      ${chalk.bold.yellow(CONFIG.BASE_URL + '/db')}`,
        `💚 Health:       ${chalk.bold.blue(CONFIG.BASE_URL + '/health')}`,
        `🔐 API Key:      ${chalk.bold.magenta(CONFIG.API_KEY.substring(0, 20) + '...')}`,
        '',
        `💾 Backup:       ${CONFIG.BACKUP_ENABLED ? 'Activé (' + CONFIG.BACKUP_INTERVAL + 'min)' : 'Désactivé'}`,
        `📝 Log Level:    ${CONFIG.LOG_LEVEL.toUpperCase()}`,
    ]);
    
    log.separator();
    log.success('🎯 ENDPOINTS CRUD COMPLETS:', '');
    console.log('');
    
    console.log(chalk.bold.cyan('  📊 GÉNÉRAL'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api'));
    console.log(chalk.blue('  GET    ') + chalk.white('/health'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/statistics'));
    console.log('');
    
    console.log(chalk.bold.cyan('  🎫 ÉVÉNEMENTS'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/events'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/events/:id'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/events'));
    console.log(chalk.yellow('  PUT    ') + chalk.white('/api/events/:id'));
    console.log(chalk.magenta('  PATCH  ') + chalk.white('/api/events/:id'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/events/:id'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/events/:id/guests'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/events/:id/scans'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/events/:id/statistics'));
    console.log('');
    
    console.log(chalk.bold.cyan('  👥 INVITÉS'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/guests'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/guests/:id'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/guests'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/guests/bulk'));
    console.log(chalk.yellow('  PUT    ') + chalk.white('/api/guests/:id'));
    console.log(chalk.magenta('  PATCH  ') + chalk.white('/api/guests/:id'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/guests/:id'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/guests/bulk'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/guests/export/csv'));
    console.log('');
    
    console.log(chalk.bold.cyan('  📱 QR CODES'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/qrcodes'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/qrcodes/guest/:guestId'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/qrcodes/generate'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/qrcodes/verify'));
    console.log('');
    
    console.log(chalk.bold.cyan('  📷 SCANS'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/scans'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/scans/:id'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/qr/scan') + chalk.gray(' (Principal)'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/scans/today'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/scans/event/:eventId'));
    console.log('');
    
    console.log(chalk.bold.cyan('  📸 GALERIES'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/galleries'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/galleries/:id'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/galleries'));
    console.log(chalk.yellow('  PUT    ') + chalk.white('/api/galleries/:id'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/galleries/:id'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/galleries/:id/photos'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/galleries/:id/photos'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/galleries/:id/stats'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/galleries/:id/moderation'));
    console.log('');

    console.log(chalk.bold.cyan('  ❤️  LIKES & COMMENTAIRES'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/galleries/:gid/photos/:pid/like'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/galleries/:gid/photos/:pid/likes'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/galleries/:gid/photos/:pid/comments'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/galleries/:gid/photos/:pid/comments'));
    console.log('');

    console.log(chalk.bold.cyan('  🍽️  MENUS & PLATS'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/menus'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/menus'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/menus/:id'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/menus/:id/dishes'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/menus/:id/dishes'));
    console.log(chalk.yellow('  PUT    ') + chalk.white('/api/menus/:id/dishes/:did'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/menus/:id/dishes/:did'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/menus/:id/dishes/:did/rating'));
    console.log('');

    console.log(chalk.bold.cyan('  🗺️  PLANS INTERACTIFS'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/plans'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/plans'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/plans/:id/locations'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/plans/:id/locations'));
    console.log(chalk.yellow('  PUT    ') + chalk.white('/api/plans/:id/locations/:lid'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/plans/:id/locations/:lid'));
    console.log('');

    console.log(chalk.bold.cyan('  💬 CHAT ULTRA SÉCURISÉ'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/chat/conversations'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/chat/conversations'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/chat/conversations/:id/messages'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/chat/conversations/:id/messages'));
    console.log(chalk.yellow('  PUT    ') + chalk.white('/api/chat/conversations/:id/messages/:mid'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/chat/conversations/:id/messages/:mid'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/chat/conversations/:id/messages/:mid/reaction'));
    console.log(chalk.red('  DELETE ') + chalk.white('/api/chat/conversations/:id/messages/:mid/reaction/:emoji'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/chat/conversations/:id/messages/:mid/reactions'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/chat/conversations/:id/mark-as-read'));
    console.log('');

    console.log(chalk.bold.cyan('  💾 STOCKAGE'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/storage/stats'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/storage/cleanup'));
    console.log('');
    
    console.log(chalk.bold.cyan('  🔄 SYNCHRONISATION'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/sync/pull'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/sync/push'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/sync/status'));
    console.log('');
    
    console.log(chalk.bold.cyan('  💾 BACKUP'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/backup'));
    console.log(chalk.green('  POST   ') + chalk.white('/api/restore'));
    console.log(chalk.blue('  GET    ') + chalk.white('/api/backups'));
    console.log('');
    
    log.separator();
    log.success('🚀 Serveur prêt à recevoir des requêtes !', moment().format('DD/MM/YYYY HH:mm:ss'));
    log.separator();
    
    // Afficher statistiques initiales

   
    const data = loadData();
    log.stats({
        'Événements': data.events?.length || 0,
        'Invités': data.guests?.length || 0,
        'Galeries': data.galleries?.length || 0,
        'Photos': (data.galleries || []).reduce((sum, g) => sum + (g.photos?.length || 0), 0),
        'Menus': data.menus?.length || 0,
        'Plans': data.plans?.length || 0,
        'Conversations Chat': data.chatConversations?.length || 0,
        'Messages': (data.chatConversations || []).reduce((sum, c) => sum + (c.messages?.length || 0), 0),
        'QR Codes': data.qrCodes?.length || 0,
        'Scans': data.scans?.length || 0,
        'Utilisateurs': data.users?.length || 0,
        'Stockage': storageManager.getStorageStats().totalSizeFormatted,
        'Dernière MAJ': data.meta?.updatedAt ? moment(data.meta.updatedAt).format('DD/MM/YYYY HH:mm:ss') : 'N/A'
    });
});

// ═══════════════════════════════════════════════════════════════
// 🛑 GESTION ARRÊT PROPRE
// ═══════════════════════════════════════════════════════════════

const gracefulShutdown = (signal) => {
    console.log('\n');
    log.warning(`Signal ${signal} reçu`, 'Arrêt propre du serveur...');
    
    try {
        const data = loadData();
        const filename = `shutdown-backup-${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
        const filepath = path.join(CONFIG.BACKUP_DIR, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        log.backup(`Sauvegarde finale → ${filename}`);
    } catch (err) {
        log.error('Erreur sauvegarde finale', err.message);
    }
    
    log.separator();
    log.info('🧹 Fermeture propre terminée', moment().format('DD/MM/YYYY HH:mm:ss'));
    log.separator();
    
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
    log.error('Exception non interceptée', err.message);
    console.error(err.stack);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    log.error('Promesse rejetée non gérée', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// ═══════════════════════════════════════════════════════════════
// 📝 EXPORT MODULE
// ═══════════════════════════════════════════════════════════════

module.exports = app;
