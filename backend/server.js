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
// 🛠️ FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

const loadData = () => {
    try {
        const raw = fs.readFileSync(CONFIG.DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        log.db('Chargement OK', `${data.events?.length || 0} événements`);
        return data;
    } catch (err) {
        log.error('Erreur chargement DB', err.message);
        return { events: [], guests: [], qrCodes: [], scans: [], settings: {} };
    }
};

const saveData = (data) => {
    try {
        // S'assurer que tous les champs essentiels existent
        const completeData = {
            events: data.events || [],
            guests: data.guests || [],
            qrCodes: data.qrCodes || [],
            scans: data.scans || [],
            users: data.users || [],
            sessions: data.sessions || [],
            settings: data.settings || {},
            meta: {
                updatedAt: new Date().toISOString(),
                version: '3.0',
                server: 'SECURA-ULTRA-PRO-V3'
            }
        };
        
        fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(completeData, null, 2));
        log.db('Sauvegarde OK', `${completeData.events?.length || 0} événements, ${completeData.users?.length || 0} utilisateurs, ${completeData.sessions?.length || 0} sessions`);
    } catch (err) {
        log.error('Erreur sauvegarde DB', err.message);
    }
};



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


const validateGuest = (guest) => {
    const errors = [];

    guest.firstName = (guest.firstName || '').toString().trim();
    guest.lastName  = (guest.lastName  || '').toString().trim();
    guest.email     = (guest.email     || '').toString().trim();
    guest.phone     = (guest.phone     || '').toString().trim();
    guest.company   = (guest.company   || '').toString().trim();
    guest.notes     = (guest.notes     || '').toString().trim();

    if (guest.email === '-' || guest.email.toLowerCase() === 'n/a') {
        guest.email = '';
    }

    if (!guest.firstName && !guest.lastName) {
        errors.push('Prénom ou nom requis');
        log.validation('name', false);
    } else {

        if (guest.firstName) {
            log.validation('firstName', true, guest.firstName);
        } else {
            log.validation('firstName', true, 'vide / optionnel');
        }

        if (guest.lastName) {
            log.validation('lastName', true, guest.lastName);
        } else {
            log.validation('lastName', true, 'vide / optionnel');
        }
    }

    if (guest.email) {
        if (!validateEmail(guest.email)) {
            errors.push('Email invalide');
            log.validation('email', false, guest.email);
        } else {
            log.validation('email', true, guest.email);
        }
    } else {
        log.validation('email', true, 'vide / optionnel');
    }

    if (guest.phone) {
        if (!validatePhone(guest.phone)) {
            errors.push('Téléphone invalide');
            log.validation('phone', false, guest.phone);
        } else {
            log.validation('phone', true, guest.phone);
        }
    } else {
        log.validation('phone', true, 'vide / optionnel');
    }

    if (!guest.eventId) {
        errors.push('eventId requis');
        log.validation('eventId', false);
    } else {
        log.validation('eventId', true, guest.eventId);
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
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

        if (!data.users) data.users = [];
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




app.get('/api/auth/me', jwtAuth, (req, res) => {
    const data = loadData();
    const user = data.users?.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

    res.json({
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


// ──────────────────────────────────────────────────
// FORGOT PASSWORD
// ──────────────────────────────────────────────────
app.post('/api/auth/forgot-password', (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis.',
                code: 'MISSING_EMAIL'
            });
        }

        const data = loadData();
        const user = data.users?.find(u => u.email === email.trim().toLowerCase());
        if (!user) {
            // Ne pas révéler si l'email existe
            log.info('Demande reset - email inconnu', email);
            return res.json({
                success: true,
                message: 'Si l\'email existe, un lien a été envoyé.',
                code: 'RESET_LINK_SENT'
            });
        }

        const resetToken = generateToken(user, { expiresIn: '15m' });
        const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;

        // TODO: Envoyer email ici
        log.success('Lien de réinitialisation généré', `${email} → $resetLink`);

        res.json({
            success: true,
            message: 'Si l\'email existe, un lien a été envoyé.',
            code: 'RESET_LINK_SENT'
        });
    } catch (err) {
        log.error('POST /api/auth/forgot-password', err.message);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur.',
            code: 'SERVER_ERROR'
        });
    }
});

// ──────────────────────────────────────────────────
// RESET PASSWORD
// ──────────────────────────────────────────────────
app.post('/api/auth/reset-password', (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Token et mot de passe (6+ caractères) requis.',
                code: 'INVALID_INPUT'
            });
        }

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Lien invalide ou expiré.',
                code: 'INVALID_TOKEN'
            });
        }

        const data = loadData();
        const user = data.users?.find(u => u.id === decoded.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable.',
                code: 'USER_NOT_FOUND'
            });
        }

        user.password = hashPassword(newPassword);
        user.updatedAt = new Date().toISOString();
        saveData(data);

        log.success('Mot de passe réinitialisé', user.email);

        res.json({
            success: true,
            message: 'Mot de passe mis à jour avec succès.',
            code: 'PASSWORD_RESET_SUCCESS'
        });
    } catch (err) {
        log.error('POST /api/auth/reset-password', err.message);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur.',
            code: 'SERVER_ERROR'
        });
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




const crypto = require('crypto');

const SECRET_REGISTER_PATH = "mon_evenement_ultra_secret_2025";
const SECRET_HASH = crypto.createHash('md5').update(SECRET_REGISTER_PATH).digest('hex');
//const SECRET_ROUTE = `/secure-register-${SECRET_HASH.substring(0, 16)}`;

app.get('/regsiter', (req, res) => {
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
        const { active, limit, offset, sort } = req.query;
        
        let events = data.events || [];
        
        if (active !== undefined) {
            events = events.filter(e => e.active === (active === 'true'));
            log.info('Filtre actif appliqué', `${events.length} résultats`);
        }
        
        if (sort === 'date') {
            events.sort((a, b) => new Date(a.date) - new Date(b.date));
        } else if (sort === '-date') {
            events.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        const total = events.length;
        if (limit) {
            const l = parseInt(limit);
            const o = parseInt(offset) || 0;
            events = events.slice(o, o + l);
            log.info('Pagination appliquée', `${events.length}/${total}`);
        }
        
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
        
        event.id = generateId('evt');
        event.createdAt = now;
        event.updatedAt = now;
        event.active = event.active !== false;
        
        data.events.unshift(event);
        saveData(data);
        
        log.crud('CREATE', 'event', { id: event.id, name: event.name });
        log.success('Événement créé', event.name);
        
        res.status(201).json({ success: true, data: event });
    } catch (err) {
        log.error('POST /api/events', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPDATE (complet)
app.put('/api/events/:id', (req, res) => {
    try {
        const data = loadData();
        const index = data.events.findIndex(e => e.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        const updated = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
        const validation = validateEvent(updated);
        
        if (!validation.valid) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }
        
        data.events[index] = { ...data.events[index], ...updated };
        saveData(data);
        
        log.crud('UPDATE', 'event', { id: updated.id, name: updated.name });
        log.success('Événement mis à jour', updated.name);
        
        res.json({ success: true, data: data.events[index] });
    } catch (err) {
        log.error('PUT /api/events/:id', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH (partiel)
app.patch('/api/events/:id', (req, res) => {
    try {
        const data = loadData();
        const index = data.events.findIndex(e => e.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }
        
        data.events[index] = {
            ...data.events[index],
            ...req.body,
            id: req.params.id,
            updatedAt: new Date().toISOString()
        };
        
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
        
        const stats = {
            event: event.name,
            totalGuests: guests.length,
            scannedGuests: guests.filter(g => g.scanned).length,
            pendingGuests: guests.filter(g => !g.scanned).length,
            totalScans: scans.length,
            scanRate: guests.length > 0 ? Math.round((guests.filter(g => g.scanned).length / guests.length) * 100) : 0,
            lastScan: scans.length > 0 ? scans[0].scannedAt : null
        };
        
        res.json({ success: true, data: stats });
    } catch (err) {
        log.error('GET /api/events/:id/statistics', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 👥 CRUD INVITÉS
// ═══════════════════════════════════════════════════════════════

// GET ALL
app.get('/api/guests', (req, res) => {
    try {
        const data = loadData();
        const { eventId, scanned, limit, offset, search } = req.query;
        
        let guests = data.guests || [];
        
        if (eventId) {
            guests = guests.filter(g => g.eventId === eventId);
            log.info('Filtre eventId', `${guests.length} résultats`);
        }
        
        if (scanned !== undefined) {
            guests = guests.filter(g => g.scanned === (scanned === 'true'));
        }
        
        if (search) {
            const term = search.toLowerCase();
            guests = guests.filter(g =>
                g.firstName?.toLowerCase().includes(term) ||
                g.lastName?.toLowerCase().includes(term) ||
                g.email?.toLowerCase().includes(term)
            );
            log.info('Recherche appliquée', `"${search}" → ${guests.length} résultats`);
        }
        
        const total = guests.length;
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
        
        log.crud('READ', 'guest', { id: guest.id, name: `${guest.firstName} ${guest.lastName}` });
        res.json({ success: true, data: guest });
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
        
        guest.id = generateId('gst');
        guest.createdAt = now;
        guest.updatedAt = now;
        guest.scanned = false;
        guest.status = guest.status || 'pending';
        
        data.guests.push(guest);
        saveData(data);
        
        log.crud('CREATE', 'guest', { id: guest.id, name: `${guest.firstName} ${guest.lastName}` });
        log.success('Invité créé', `${guest.firstName} ${guest.lastName}`);
        
        res.status(201).json({ success: true, data: guest });
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
                log.validation(`Guest ${idx}`, true,
                    `${guest.firstName} ${guest.lastName} → event ${guest.eventId}`);
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
        log.success('Import CSV terminé',
            `${created.length}/${rawGuests.length} invités créés (réinitialisés)`);

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
        
        const updated = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
        const validation = validateGuest(updated);
        
        if (!validation.valid) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }
        
        data.guests[index] = { ...data.guests[index], ...updated };
        saveData(data);
        
        log.crud('UPDATE', 'guest', { id: updated.id, name: `${updated.firstName} ${updated.lastName}` });
        
        res.json({ success: true, data: data.guests[index] });
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
        
        data.guests[index] = {
            ...data.guests[index],
            ...req.body,
            id: req.params.id,
            updatedAt: new Date().toISOString()
        };
        
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
        
        data.guests = data.guests.filter(g => g.id !== req.params.id);
        data.qrCodes = data.qrCodes.filter(q => q.guestId !== req.params.id);
        data.scans = data.scans.filter(s => s.guestId !== req.params.id);
        
        saveData(data);
        
        log.crud('DELETE', 'guest', { id: req.params.id, name: `${guest.firstName} ${guest.lastName}` });
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
// 🔄 SYNCHRONISATION
// ═══════════════════════════════════════════════════════════════

// PULL
app.get('/api/sync/pull', (req, res) => {
    try {
        const data = loadData();
        
        log.sync('PULL', `${data.events?.length || 0} événements`);
        
        res.json({
            success: true,
            data: data,
            timestamp: new Date().toISOString(),
            count: {
                events: data.events?.length || 0,
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
                    map.set(item[key], item);
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
