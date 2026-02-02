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

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key' , 'dash']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


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
                eventSessions: [], // ← AJOUTÉ ICI
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
            eventSessions: data.eventSessions || [], // ← AJOUTÉ ICI
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
            guests: [], 
            qrCodes: [], 
            scans: [], 
            users: [], 
            sessions: [], 
            eventSessions: [],
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
            guests: data.guests || existingData.guests || [],
            qrCodes: data.qrCodes || existingData.qrCodes || [],
            scans: data.scans || existingData.scans || [],
            users: data.users || existingData.users || [],
            tables: data.tables || existingData.tables || [],
            sessions: data.sessions || existingData.sessions || [],
            eventSessions: data.eventSessions || existingData.eventSessions || [], // ← AJOUTÉ ICI
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
        log.db('Sauvegarde OK', `${completeData.events?.length || 0} événements, ${completeData.users?.length || 0} utilisateurs, ${completeData.tempUsers?.length || 0} inscriptions en cours`);
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

// Middleware JWT
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


const requireRole = (role) => (req, res, next) => {
    if (req.user.role !== role) {
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
app.get('/api/users', jwtAuth, requireRole('admin'), (req, res) => {
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

// 👤 GET USER BY ID
app.get('/api/users/:id', jwtAuth, (req, res) => {
    try {
        const data = loadData();
        const user = data.users?.find(u => u.id === req.params.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur introuvable' 
            });
        }
        
        // Vérifier les permissions (admin ou utilisateur lui-même)
        if (req.user.role !== 'admin' && req.user.id !== user.id) {
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

cron.schedule('*/30 * * * *', () => { // Toutes les 30 minutes
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



const crypto = require('crypto');
const { generateUserId } = require('./utils/helpers/idGenerator');
const { table } = require('console');

const SECRET_REGISTER_PATH = "mon_evenement_ultra_secret_2025";
const SECRET_HASH = crypto.createHash('md5').update(SECRET_REGISTER_PATH).digest('hex');
//const SECRET_ROUTE = `/secure-register-${SECRET_HASH.substring(0, 16)}`;

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
        
        // Supprimer en cascade
        const guestIds = data.guests.filter(g => g.eventId === req.params.id).map(g => g.id);
        
        data.events = data.events.filter(e => e.id !== req.params.id);
        data.guests = data.guests.filter(g => g.eventId !== req.params.id);
        data.qrCodes = data.qrCodes.filter(q => !guestIds.includes(q.guestId));
        data.scans = data.scans.filter(s => s.eventId !== req.params.id);
        data.tables = data.tables.filter(t => t.eventId !== req.params.id);
        
        saveData(data);
        
        log.crud('DELETE', 'event', { id: req.params.id, name: event.name });
        log.warning('Événement supprimé', `+ ${guestIds.length} invités associés`);
        
        res.json({ success: true, deleted: { event: 1, guests: guestIds.length } });
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
                guest: fullGuest ? {
                    id: fullGuest.id,
                    firstName: fullGuest.firstName,
                    lastName: fullGuest.lastName,
                    email: fullGuest.email,
                    phone: fullGuest.phone,
                    company: fullGuest.company,
                    scanned: fullGuest.scanned,
                    scannedAt: fullGuest.scannedAt
                } : null
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
        // Avec JWT, on ne fait que supprimer côté client
        // Optionnel: invalider le token côté serveur si nécessaire
        res.json({
            success: true,
            message: 'Session terminée'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
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
        res.status(404).json({ error: 'Endpoint non trouvé Consultez /api pour la documentation' });
        next();
    }

    if (!req.path.startsWith('/api') && !req.path.startsWith('/db')) {
        const notFoundPath = path.join(__dirname, '404.html');
        if (fs.existsSync(notFoundPath)) {
            log.warning('404', `${req.method} ${req.originalUrl}`);
            res.status(404).sendFile(notFoundPath);
        } else {
            res.status(404).send('<h1>404 - Endpoint non trouvé</h1><p><a href="/">Consultez /api pour la documentation</a></p>');
        }
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
// 🚀 DÉMARRAGE SERVEUR
// ═══════════════════════════════════════════════════════════════

app.listen(CONFIG.PORT, () => {
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
        'QR Codes': data.qrCodes?.length || 0,
        'Scans': data.scans?.length || 0,
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
