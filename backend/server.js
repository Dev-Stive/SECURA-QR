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
const jsonServer = require('json-server');
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
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
        data.meta = {
            updatedAt: new Date().toISOString(),
            version: '3.0',
            server: 'SECURA-ULTRA-PRO-V3'
        };
        fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(data, null, 2));
        log.db('Sauvegarde OK', `${data.events?.length || 0} événements`);
        return true;
    } catch (err) {
        log.error('Erreur sauvegarde', err.message);
        return false;
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
    log.info('Validation invité', `${guest.firstName} ${guest.lastName}`);
    
    if (!guest.firstName || guest.firstName.trim().length < 2) {
        errors.push('Prénom requis');
        log.validation('firstName', false);
    } else {
        log.validation('firstName', true, guest.firstName);
    }
    
    if (!guest.lastName || guest.lastName.trim().length < 2) {
        errors.push('Nom requis');
        log.validation('lastName', false);
    } else {
        log.validation('lastName', true, guest.lastName);
    }
    
    if (guest.email && !validateEmail(guest.email)) {
        errors.push('Email invalide');
        log.validation('email', false, guest.email);
    } else if (guest.email) {
        log.validation('email', true, guest.email);
    }
    
    if (guest.phone && !validatePhone(guest.phone)) {
        errors.push('Téléphone invalide');
        log.validation('phone', false);
    } else if (guest.phone) {
        log.validation('phone', true, guest.phone);
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


// ═══════════════════════════════════════════════════════════════
// 🔐 AUTHENTIFICATION - LOGIN / REGISTER
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/register', (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;

        if (!email || !password || password.length < 6) {
            return res.status(400).json({ success: false, error: 'Email et mot de passe (6+ chars) requis' });
        }

        const data = loadData();

        // Empêcher doublon email
        if (data.users?.some(u => u.email === email)) {
            return res.status(400).json({ success: false, error: 'Email déjà utilisé' });
        }


        const user = {
            id: generateId('usr'),
            email,
            password: hashPassword(password),
            firstName: firstName || '',
            lastName: lastName || '',
            role: data.users?.length === 0 ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!data.users) data.users = [];
        data.users.push(user);
        saveData(data);

        const token = generateToken(user);

        log.success('Utilisateur créé', `${email} (${user.role})`);
        res.status(201).json({
            success: true,
            message: 'Inscription réussie',
            token,
            user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }
        });
    } catch (err) {
        log.error('POST /api/auth/register', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
        }

        const data = loadData();
        const user = data.users?.find(u => u.email === email);

        if (!user || !comparePassword(password, user.password)) {
            log.warning('Login échoué', email);
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        const token = generateToken(user);

        log.success('Connexion réussie', `${email} (${user.role})`);
        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }
        });
    } catch (err) {
        log.error('POST /api/auth/login', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/auth/me', jwtAuth, (req, res) => {
    const data = loadData();
    const user = data.users?.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

    res.json({
        success: true,
        user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }
    });
});


const crypto = require('crypto');

const SECRET_REGISTER_PATH = "mon_evenement_ultra_secret_2025";
const SECRET_HASH = crypto.createHash('md5').update(SECRET_REGISTER_PATH).digest('hex');
const SECRET_ROUTE = `/secure-register-${SECRET_HASH.substring(0, 16)}`;

app.get(SECRET_ROUTE, (req, res) => {
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
                login: 'POST /api/auth/login',
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

app.get('/api/statistics', (req, res) => {
    try {
        const data = loadData();
        const today = new Date().toDateString();
        
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
            lastUpdate: data.meta?.updatedAt || new Date().toISOString()
        };
        
        log.stats(stats);
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
        
        log.stats(stats);
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

// CREATE MULTIPLE (BULK)
app.post('/api/guests/bulk', (req, res) => {
    try {
        const { guests } = req.body;
        
        if (!Array.isArray(guests) || guests.length === 0) {
            return res.status(400).json({ success: false, error: 'Array guests[] requis' });
        }
        
        const data = loadData();
        const now = new Date().toISOString();
        const created = [];
        const errors = [];
        
        guests.forEach((guest, index) => {
            const validation = validateGuest(guest);
            
            if (!validation.valid) {
                errors.push({ index, guest, errors: validation.errors });
                log.validation(`Guest ${index}`, false, validation.errors[0]);
            } else {
                guest.id = generateId('gst');
                guest.createdAt = now;
                guest.updatedAt = now;
                guest.scanned = false;
                guest.status = guest.status || 'pending';
                
                data.guests.push(guest);
                created.push(guest);
                log.validation(`Guest ${index}`, true, `${guest.firstName} ${guest.lastName}`);
            }
        });
        
        saveData(data);
        
        log.crud('CREATE BULK', 'guests', { created: created.length, errors: errors.length });
        log.success('Invités créés en masse', `${created.length}/${guests.length}`);
        
        res.status(201).json({
            success: true,
            data: created,
            count: created.length,
            errors: errors.length > 0 ? errors : undefined
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
app.delete('/api/guests/bulk', (req, res) => {
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
            return res.status(404).json({ success: false, error: 'QR Code introuvable' });
        }
        
        log.crud('READ', 'qrcode', { guestId: req.params.guestId });
        res.json({ success: true, data: qrCode });
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
            log.warning('Déjà scanné', `${guest.firstName} ${guest.lastName}`);
            return res.status(200).json({
                success: true,
                alreadyScanned: true,
                message: `${guest.firstName} ${guest.lastName} déjà scanné`,
                data: { guest, event }
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
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
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
app.get('*', (req, res) => {
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



// ═══════════════════════════════════════════════════════════════
// 💾 BACKUP AUTOMATIQUE
// ═══════════════════════════════════════════════════════════════

if (CONFIG.BACKUP_ENABLED) {
    cron.schedule(`*/${CONFIG.BACKUP_INTERVAL} * * * *`, () => {
        try {
            const data = loadData();
            const filename = `backup-${moment().format('YYYY-MM-DD_HH-mm')}.json`;
            const filepath = path.join(CONFIG.BACKUP_DIR, filename);
            
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
            log.backup(filename);
            
            cleanOldBackups();
        } catch (err) {
            log.error('Erreur backup auto', err.message);
        }
    });
    
    log.success('Backup automatique activé', `Toutes les ${CONFIG.BACKUP_INTERVAL}min`);
}

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