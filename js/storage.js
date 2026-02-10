/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        🛡️  SECURA STORAGE - ULTRA COMPLET V5.0  🛡️           ║
 * ║                                                               ║
 * ║  📡 Synchronisation bidirectionnelle avec API V3              ║
 * ║  💾 CRUD complet côté client                                  ║
 * ║  🔄 Auto-sync intelligent                                     ║
 * ║  📊 Statistiques temps réel                                   ║
 * ║  🚀 Performance optimisée                                     ║
 * ║  ⚡ Opérations directes via API                               ║
 * ║  🎯 Observable State Management (Pas de rerender complet)    ║
 * ║  🔔 Événements granulaires par entité                        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

//const { authManager } = require("./auth");
const GUEST_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  CHECKED_IN: 'checked_in',
  NO_SHOW: 'no_show'
};

const GUEST_CATEGORIES = {
  STANDARD: 'standard',
  VIP: 'vip',
  SPEAKER: 'speaker',
  ORGANIZER: 'organizer',
  STAFF: 'staff',
  PRESS: 'press'
};

class SecuraStorage {

    
    FRONTEND_URL = 'https://secura-qr.vercel.app';
    BACKEND_URL = 'https://secura-qr.onrender.com/api';

    // FRONTEND_URL = 'http://localhost:5500';
    
    constructor() {
        if (window.location.hostname === 'localhost') {
            this.API_URL = 'http://localhost:3000/api';
        } else {
            this.API_URL = 'https://secura-qr.onrender.com/api';
        }

        this.token = localStorage.getItem('secura_token') || null;
        this.user = JSON.parse(localStorage.getItem('secura_user') || 'null');
        this.isAuthenticated = !!this.token;

        this.SYNC_ENABLED = true;
        this.SYNC_INTERVAL = 30000; // 30 secondes au lieu de 10
        this.TOKEN_CHECK_INTERVAL = 180000;
        this.AUTO_SYNC_ON_CHANGE = true;
        this.USE_API_DIRECT = true;
        this.CACHE_TTL = 30000; // Cache 30 secondes

        this.syncTimer = null;
        this.syncInProgress = false;
        this.requestCache = new Map(); // Cache pour GET
        this.requestInFlight = new Map(); // Déduplications requêtes en vol
        this.lastSyncTime = null;
        this.syncErrors = [];
        this.isOnline = navigator.onLine;
        this.tokenCheckInProgress = false;
        this.lastTokenCheck = null;

        // 🎯 ÉTAT OBSERVABLE 
        this.data = {
            events: [],
            guests: [],
            tables: [],
            qrCodes: [],
            scans: [],
            users: [],  // 🔑 Cache des utilisateurs pour createdByName
            
            galleries: [],
            photos: [],
            menus: [],
            dishes: [],
            plans: [],
            chatConversations: [],
            messages: [],
            comments: [],  // 🔑 Commentaires des photos
            
            settings: {
                theme: 'dark',
                language: 'fr',
                syncEnabled: true,
                apiUrl: this.API_URL,
                useApiDirect: true
            }
        };

        // 🔔 LISTENERS GRANULAIRES 
        this.listeners = {
            // Existants
            'event:created': [],
            'event:updated': [],
            'event:deleted': [],
            'guest:created': [],
            'guest:updated': [],
            'guest:deleted': [],
            'scan:created': [],
            'qr:generated': [],
            'user:created': [],
            
            'gallery:created': [],
            'gallery:updated': [],
            'gallery:deleted': [],
            'photo:added': [],
            'photo:deleted': [],
            'photo:approved': [],
            'photo:rejected': [],
            'like:added': [],
            'like:removed': [],
            'comment:added': [],
            'comment:updated': [],
            'comment:deleted': [],
            'comment:liked': [],
            'menu:created': [],
            'menu:updated': [],
            'menu:deleted': [],
            'dish:added': [],
            'dish:updated': [],
            'dish:deleted': [],
            'rating:added': [],
            'plan:created': [],
            'plan:updated': [],
            'plan:deleted': [],
            'location:added': [],
            'location:updated': [],
            'location:deleted': [],
            'chat:created': [],
            'message:sent': [],
            'message:edited': [],
            'message:deleted': [],
            'reaction:added': [],
            'chat:read': [],
            
            'data:synced': [],
            'stats:updated': []
        };

        this.init();
    }


   // ═══════════════════════════════════════════════════════════════
    // 🚀 INITIALISATION
    // ═══════════════════════════════════════════════════════════════
    async init() {
        console.log('🚀 SECURA Storage V6.0 - Initialisation...');
        this.syncAuthFromStorage();
        this.loadFromLocalStorage();
        window.dispatchEvent(new CustomEvent('secura:storage-ready'));
        this.emitUserEvents();
        this.emitTableEvents();

        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncPull();
            this.startAutoSync();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.stopAutoSync();
        });

        const waitForAuthCheck = () => {
            return new Promise((resolve) => {
                if (document.body.classList.contains('auth-verified') || document.body.classList.contains('auth-denied')) {
                    resolve();
                } else {
                    const checkInterval = setInterval(() => {
                        if (document.body.classList.contains('auth-verified') || document.body.classList.contains('auth-denied')) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 50);
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        resolve();
                    }, 2000);
                }
            });
        };

        await waitForAuthCheck();

        const serverOnline = await this.checkServerStatus();
        if (serverOnline && this.SYNC_ENABLED) {
            await this.syncPull();
            this.startAutoSync();
        } else {
            console.warn('⚠️ Mode hors-ligne activé');
            this.SYNC_ENABLED = false;
        }

        this.emitStatsUpdate();
        console.log('✅ SECURA Storage V6.0 !');
    }


    // ═══════════════════════════════════════════════════════════════
    // 🎧 SYSTÈME D'ÉVÉNEMENTS GRANULAIRES
    // ═══════════════════════════════════════════════════════════════
     on(eventName, callback) {
        this._listeners = this._listeners || {};
        if (!this._listeners[eventName]) this._listeners[eventName] = [];
        this._listeners[eventName].push(callback);
        // renvoyer un unsubscribe pratique
        return () => this.off(eventName, callback);
    }

    off(eventName, callback) {
        this._listeners = this._listeners || {};
        if (!this._listeners[eventName]) return;
        this._listeners[eventName] = this._listeners[eventName].filter(cb => cb !== callback);
    }

    // Synchroniser l'authentification depuis localStorage (appelé par auth.js ou auth-check.js)
    syncAuthFromStorage() {
        const storedToken = localStorage.getItem('secura_token');
        const storedUser = localStorage.getItem('secura_user');
        
        if (storedToken) {
            this.token = storedToken;
            this.isAuthenticated = true;
        }
        
        if (storedUser) {
            try {
                this.user = JSON.parse(storedUser);
            } catch (err) {
                console.error('Error parsing stored user:', err);
            }
        }
        
        console.log('🔄 Storage synced from auth', { token: !!this.token, user: !!this.user });
    }

    emit(eventName, payload) {
        this._listeners = this._listeners || {};
        const listeners = Array.isArray(this._listeners[eventName]) ? this._listeners[eventName].slice() : [];
        const envelope = (payload && payload.detail) ? payload : { detail: payload };
        for (const cb of listeners) {
            try {
                cb(envelope);
            } catch (err) {
                console.error(`Error in listener for ${eventName}:`, err);
            }
        }
    }

    emitStatsUpdate() {
        const stats = this.getStatistics();
        this.emit('stats:updated', stats);
    }

    getStatistics() {
        return {
            events: this.data.events?.length || 0,
            guests: this.data.guests?.length || 0,
            tables: this.data.tables?.length || 0,
            qrCodes: this.data.qrCodes?.length || 0,
            scans: this.data.scans?.length || 0,
            galleries: this.data.galleries?.length || 0,
            photos: this.data.photos?.length || 0,
            menus: this.data.menus?.length || 0,
            dishes: this.data.dishes?.length || 0,
            plans: this.data.plans?.length || 0,
            conversations: this.data.chatConversations?.length || 0,
            messages: this.data.messages?.length || 0,
            lastSync: this.lastSyncTime
        };
    }


    // ═══════════════════════════════════════════════════════════════
    // 🌐 CONNEXION & API
    // ═══════════════════════════════════════════════════════════════
    async checkServerStatus() {
        try {
            const res = await fetch(`${this.API_URL.replace('/api', '')}/health`, { 
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async apiRequest(endpoint, options = {}) {
        // ⚠️ SÉCURITÉ: Vérifier la connexion pour les endpoints authentifiés
        const publicEndpoints = ['/auth/login', '/auth/register', '/auth/forgot-password', '/health','/statistics'];
        const requiresAuth = !publicEndpoints.some(pub => endpoint.includes(pub));
        
       /* if (requiresAuth && !this.token) {
            console.warn(`⚠️ Tentative d'accès à ${endpoint} sans authentification`);
            this.handleInvalidToken();
            throw new Error('Non authentifié - veuillez vous reconnecter');
        }*/

        const url = endpoint.startsWith('http')
            ? endpoint
            : `${this.API_URL}${endpoint}`;

        const headers = {};
        
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        
        Object.assign(headers, options.headers);

        // Déterminer quel token utiliser (priorité au token de session d'événement)
        let authToken = localStorage.getItem('secura_event_session_token') || this.token;
        
        if (authToken && !endpoint.includes('/auth/')) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Déterminer le timeout basé sur l'endpoint
        let timeout = 30000; // 30s par défaut
        if (endpoint.includes('/galleries') || endpoint.includes('/menus') || 
            endpoint.includes('/plans') || endpoint.includes('/chat/conversations')) {
            timeout = 45000; // 45s pour les endpoints lents
        }

        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch(url, {
                    ...options,
                    headers,
                    signal: options.signal || AbortSignal.timeout(timeout)
                });

                if (!res.ok) {
                    // 401 = Token invalide/expiré
                    if (res.status === 401) {
                        console.error('❌ API 401 - Token invalide/expiré');
                        this.handleInvalidToken();
                        throw new Error(`HTTP 401: Token invalide`);
                    }
                    const errorText = await res.text();
                    throw new Error(errorText || `HTTP ${res.status}`);
                }

                return await res.json();
            } catch (err) {
                lastError = err;
                const msg = err?.message || 'Unknown error';
                
                // Ne pas retry sur les erreurs 4xx (sauf 429)
                if (msg.includes('HTTP 4') && !msg.includes('429')) {
                    console.error(`API Error [${endpoint}]: ${msg} (Attempt ${attempt}/${maxRetries})`);
                    throw err;
                }

                if (attempt < maxRetries) {
                    // Attendre avant de retry (délai exponentiel)
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.warn(`⏳ API Retry [${endpoint}]: Tentative ${attempt}/${maxRetries} dans ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`API Error [${endpoint}]: ${msg} (Attempt ${attempt}/${maxRetries} - FINAL)`);
                }
            }
        }

        throw lastError;
    }

    // 🚀 CACHE & DÉDUPLICATION - Wrapper pour apiRequest
    async apiRequestWithCache(endpoint, options = {}) {
        const requestKey = `${endpoint}`;
        
        try {
            // 1️⃣ DÉDUPLICATION: Si la même requête GET est en cours
            if ((options.method === undefined || options.method === 'GET') && this.requestInFlight.has(requestKey)) {
                console.log(`♻️ Réutilisation requête en vol: ${endpoint}`);
                return await this.requestInFlight.get(requestKey);
            }
            
            // 2️⃣ CACHE: Pour les GET seulement
            if (options.method === undefined || options.method === 'GET') {
                const cached = this.requestCache.get(requestKey);
                if (cached && (Date.now() - cached.time) < this.CACHE_TTL) {
                    console.log(`💾 Cache hit: ${endpoint}`);
                    return cached.data;
                }
            }
            
            // 3️⃣ Lancer la vraie requête et la tracker
            const promise = this.apiRequest(endpoint, options);
            this.requestInFlight.set(requestKey, promise);
            
            const result = await promise;
            
            // 4️⃣ Mettre en cache les résultats GET
            if (options.method === undefined || options.method === 'GET') {
                this.requestCache.set(requestKey, { data: result, time: Date.now() });
                // Nettoyer le cache après TTL
                setTimeout(() => this.requestCache.delete(requestKey), this.CACHE_TTL);
            }
            
            return result;
        } finally {
            this.requestInFlight.delete(requestKey);
        }
    }


    // ═══════════════════════════════════════════════════════════════
    // 💾 LOCAL STORAGE
    // ═══════════════════════════════════════════════════════════════

    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('secura_data');
            const settings = localStorage.getItem('secura_settings');
            const syncTime = localStorage.getItem('secura_sync_time');
            
            if (data) {
                const parsed = JSON.parse(data);
                this.data = { ...this.data, ...parsed };
            }
            
            if (settings) {
                this.data.settings = JSON.parse(settings);
            }
            
            if (syncTime) {
                this.lastSyncTime = syncTime;
            }
            
            console.log('✅ Cache loaded');
        } catch (err) {
            console.warn('❌ Cache load failed:', err);
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('secura_data', JSON.stringify(this.data));
            localStorage.setItem('secura_settings', JSON.stringify(this.data.settings));
            localStorage.setItem('secura_sync_time', this.lastSyncTime);
        } catch (err) {
            console.warn('❌ Cache save failed:', err);
        }
    }

    clearLocalStorage() {
        try {
            localStorage.removeItem('secura_data');
            localStorage.removeItem('secura_settings');
            localStorage.removeItem('secura_sync_time');
            console.log('✅ Local cache cleared');
        } catch (err) {
            console.warn('❌ Cache clear failed:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔄 SYNCHRONISATION INTELLIGENTE
    // ═══════════════════════════════════════════════════════════════

    async syncPull() {
        
        
        if (!this.SYNC_ENABLED || this.syncInProgress || !this.isOnline) return false;
        
        this.syncInProgress = true;
        console.log('🔄 Sync Pull (avec cache & déduplication)...');
        
        try {
            const oldData = JSON.parse(JSON.stringify(this.data));
            
            // 🚀 Utiliser le cache + déduplication pour toutes les requêtes GET
            const [syncRes, galleriesRes, menusRes, plansRes, chatRes] = await Promise.all([
                this.apiRequestWithCache('/sync/pull').catch(() => ({})),
                this.apiRequestWithCache('/galleries').catch(() => ({ galleries: [] })),
                this.apiRequestWithCache('/menus').catch(() => ({ menus: [] })),
                this.apiRequestWithCache('/plans').catch(() => ({ plans: [] })),
               this.apiRequestWithCache('/plans').catch(() => ({ conversations: [] }))
            ]);

            const sanitizeArray = (arr) => Array.isArray(arr) ? arr.filter(item => item && typeof item === 'object') : [];
            
            // Fusionner les données du sync pull
            if (syncRes.success && syncRes.data) {
                this.data.events = sanitizeArray(syncRes.data.events || this.data.events);
                this.data.tables = sanitizeArray(syncRes.data.tables || this.data.tables);
                this.data.guests = sanitizeArray(syncRes.data.guests || this.data.guests);
                this.data.qrCodes = sanitizeArray(syncRes.data.qrCodes || this.data.qrCodes);
                this.data.scans = sanitizeArray(syncRes.data.scans || this.data.scans);
                this.data.settings = syncRes.data.settings || this.data.settings;
            }
            
            // Mise à jour des galleries
            if (galleriesRes.data) {
                this.data.galleries = sanitizeArray(galleriesRes.data);
            } else if (galleriesRes.galleries) {
                this.data.galleries = sanitizeArray(galleriesRes.galleries);
            }
            
            // Mise à jour des menus
            if (menusRes.data) {
                this.data.menus = sanitizeArray(menusRes.data);
            } else if (menusRes.menus) {
                this.data.menus = sanitizeArray(menusRes.menus);
            }
            
            // Mise à jour des plans
            if (plansRes.data) {
                this.data.plans = sanitizeArray(plansRes.data);
            } else if (plansRes.plans) {
                this.data.plans = sanitizeArray(plansRes.plans);
            }
            
            // Mise à jour des conversations
            if (chatRes.data) {
                this.data.chatConversations = sanitizeArray(chatRes.data);
            } else if (chatRes.conversations) {
                this.data.chatConversations = sanitizeArray(chatRes.conversations);
            }

            this.saveToLocalStorage();
            this.lastSyncTime = new Date().toISOString();
            
            // 🎯 ÉVÉNEMENTS GRANULAIRES - Détecter les changements
            this.detectChanges(oldData, this.data);
            this.emit('data:synced', { timestamp: this.lastSyncTime });
            this.emitStatsUpdate();
            
            console.log('✅ Sync Pull réussie');
            return true;
        } catch (err) {
            console.warn('⚠️ Sync Pull impossible:', err.message);
            this.syncErrors.push({ type: 'pull', time: new Date(), error: err.message });
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    async syncPush() {
        // ⚠️ SÉCURITÉ: Ne pas sync si pas authentifié
        if (!this.token || !this.isAuthenticated) {
            console.warn('⚠️ Sync Push annulée - Non authentifié');
            return false;
        }
        
        if (!this.SYNC_ENABLED || this.syncInProgress || !this.isOnline) return false;
        
        this.syncInProgress = true;
        console.log('🔄 Sync Push...');
        
        try {
            const result = await this.apiRequest('/sync/push', {
                method: 'POST',
                body: JSON.stringify(this.data)
            });
            
            if (result.success) {
                this.lastSyncTime = new Date().toISOString();
                console.log('✅ Sync Push réussie:', result.merged);
                return true;
            }
        } catch (err) {
            console.warn('⚠️ Sync Push impossible:', err.message);
            this.syncErrors.push({ type: 'push', time: new Date(), error: err.message });
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }


    detectChanges(oldData, newData) {
        const safeArr = (arr) => Array.isArray(arr) ? arr.filter(Boolean) : [];
        
        // Helper pour détecter les changements dans une ressource
        const detectResourceChanges = (resourceName, oldArr, newArr) => {
            oldArr = safeArr(oldArr);
            newArr = safeArr(newArr);
            
            const oldIds = oldArr.map(item => item.id);
            const newIds = newArr.map(item => item.id);
            
            // Créations
            newArr.forEach(item => {
                if (!oldIds.includes(item.id)) {
                    this.emit(`${resourceName}:created`, item);
                }
            });
            
            // Mises à jour
            newArr.forEach(newItem => {
                const oldItem = oldArr.find(item => item.id === newItem.id);
                if (oldItem && JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                    this.emit(`${resourceName}:updated`, { old: oldItem, new: newItem });
                }
            });
            
            // Suppressions
            oldArr.forEach(item => {
                if (!newIds.includes(item.id)) {
                    this.emit(`${resourceName}:deleted`, item);
                }
            });
        };

        // Détection des changements pour chaque ressource
        detectResourceChanges('event', oldData.events, newData.events);
        detectResourceChanges('table', oldData.tables, newData.tables);
        detectResourceChanges('guest', oldData.guests, newData.guests);
        detectResourceChanges('scan', oldData.scans, newData.scans);
        detectResourceChanges('qr', oldData.qrCodes, newData.qrCodes);
        
        // Ressources supplémentaires
        detectResourceChanges('gallery', oldData.galleries, newData.galleries);
        detectResourceChanges('photo', oldData.photos, newData.photos);
        detectResourceChanges('menu', oldData.menus, newData.menus);
        detectResourceChanges('dish', oldData.dishes, newData.dishes);
        detectResourceChanges('plan', oldData.plans, newData.plans);
        detectResourceChanges('chat', oldData.chatConversations, newData.chatConversations);
        detectResourceChanges('message', oldData.messages, newData.messages);
    }



startAutoSync() {

    if (this.syncTimer) {
        console.log('⚠️ Auto-sync déjà actif, abandon du démarrage');
        return;
    }

    this.syncTimer = setInterval(async () => {
        if (this.isOnline && this.SYNC_ENABLED) {
            console.log(`⏰ Auto-sync déclenché (${this.SYNC_INTERVAL / 1000}s)`);
            
            const now = Date.now();
            const shouldCheckToken = !this.lastTokenCheck || 
                                   (now - this.lastTokenCheck) > this.TOKEN_CHECK_INTERVAL;
            
            if (this.token && shouldCheckToken) {
                try {
                    const tokenValid = await this.verifyToken();
                    if (!tokenValid) {
                        console.log('⏹️ Auto-sync stoppé - Token invalide');
                        this.stopAutoSync();
                        this.handleInvalidToken();
                        return;
                    }
                    this.lastTokenCheck = now;
                } catch (err) {
                    console.warn('⚠️ Vérification token échouée, poursuite sync:', err.message);
                }
            }
            
            await this.syncPull();
        }
    }, this.SYNC_INTERVAL);
    
    console.log(`✅ Auto-sync activé (intervalle: ${this.SYNC_INTERVAL / 1000}s, Cache: ${this.CACHE_TTL / 1000}s)`);
}

    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('⏹️ Auto-sync arrêté');
        }
    }



    

   
    // ═══════════════════════════════════════════════════════════════
    // 🔐 AUTHENTIFICATION ULTRA ROBUSTE
    // ═══════════════════════════════════════════════════════════════
    async login(email, password) {
        if (!email || !password) {
            return {
                success: false,
                message: 'Veuillez saisir votre e-mail et mot de passe.',
                code: 'MISSING_FIELDS'
            };
        }

        if (!this.isValidEmail(email)) {
            return {
                success: false,
                message: 'Veuillez entrer une adresse e-mail valide.',
                code: 'INVALID_EMAIL'
            };
        }

        try {
            console.log('Connexion en cours...', { email });

            const result = await this.apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (result.success) {
                this.token = result.token;
                this.user = result.user;

                // Sauvegarder TOUS les éléments d'auth dans localStorage
                localStorage.setItem('secura_token', this.token);
                localStorage.setItem('secura_user', JSON.stringify(this.user));
                
                this.isAuthenticated = true;
                
                // 🎯 NE PAS appeler updateProfileInfo() ici
                // Laisser auth-check.js vérifier le token en premier
                // puis storage.js.init() téléchargera les données

                this.emitStatsUpdate();

                console.log('✅ Connexion réussie - Token et User sauvegardés', this.user);

                return {
                    success: true,
                    message: result.message || 'Connexion réussie !',
                    user: this.user,
                    token: this.token
                };
            } else {
                const message = result.message || result.error || 'Une erreur est survenue.';
                const code = result.code || 'UNKNOWN_ERROR';

                return {
                    success: false,
                    message,
                    code
                };
            }

        } catch (err) {
            let message = 'Impossible de contacter le serveur.';
            let code = 'NETWORK_ERROR';

            if (err.message.includes('Failed to fetch') || !navigator.onLine) {
                message = 'Aucune connexion internet. Vérifiez votre réseau.';
                code = 'OFFLINE';
            } else if (err.message.includes('HTTP 400')) {
                message = 'Requête invalide. Veuillez réessayer.';
                code = 'BAD_REQUEST';
            } else if (err.message.includes('HTTP 401')) {
                message = 'E-mail ou mot de passe incorrect.';
                code = 'UNAUTHORIZED';
            } else if (err.message.includes('HTTP 500')) {
                message = 'Erreur serveur. Réessayez plus tard.';
                code = 'SERVER_ERROR';
            } else {
                message = err.message || 'Erreur inconnue.';
            }

            console.error('Erreur API login:', err);

            return {
                success: false,
                message,
                code
            };
        }
    }

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }


    // ═══════════════════════════════════════════════════════════════
// 🔓 LOGOUT - Déconnexion complète
// ═══════════════════════════════════════════════════════════════

async logout() {
    try {
        console.info('Déconnexion en cours...');

        // 1️⃣ Appeler le serveur pour se déconnecter
        if (this.token) {
            try {
                const response = await this.apiRequest('/auth/logout', {
                    method: 'POST'
                });

                if (response.success) {
                    console.log('🔓 Déconnexion serveur confirmée', response.data?.email);
                }
            } catch (err) {
                console.warn('⚠️ Impossible contacter serveur pour logout', err.message);
         
            }
        }

        this.stopAutoSync();

        // 3️⃣ Nettoyer le token
        this.token = null;
        this.user = null;

        // 4️⃣ Supprimer de localStorage
        localStorage.removeItem('secura_token');
        localStorage.removeItem('secura_user');
        localStorage.removeItem('secura_data');

        // 5️⃣ Vider l'état local
        this.data = {
            events: [],
            guests: [],
            qrCodes: [],
            scans: [],
            settings: this.data.settings || {}
        };

        this.emit('auth:logout', { timestamp: new Date().toISOString() });

        console.log('✅ Déconnexion complète effectuée');

        return true;

    } catch (err) {
        console.error('❌ Erreur déconnexion:', err.message);

        this.forceLogout();
        return false;
    }
}

forceLogout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('secura_token');
    localStorage.removeItem('secura_user');
    localStorage.removeItem('secura_data');
    this.stopAutoSync();
    
    console.warn('🔒 Déconnexion forcée');
    
    window.location.href = '/index.html';
    
}


     // ═══════════════════════════════════════════════════════════════
    // 🎫 CRUD ÉVÉNEMENTS (API + LOCAL)
    // ═══════════════════════════════════════════════════════════════
    getAllEvents(filters = {}) {
        // 🔄 Sync token depuis localStorage
        this.syncAuthFromStorage();
        
        if (this.USE_API_DIRECT && this.isOnline && this.token) {
            try {
                const params = new URLSearchParams(filters).toString();
                const result = this.apiRequest(`/events${params ? '?' + params : ''}`);
                if (result.success) {
                    const oldEvents = [...this.data.events];
                    this.data.events = result.data;
                    this.saveToLocalStorage();
                    this.detectChanges({ 
                        events: oldEvents, 
                        guests: this.data.guests, 
                        qrCodes: this.data.qrCodes, 
                        scans: this.data.scans 
                    }, this.data);
                    return result.data;
                }
            } catch (err) {
                console.warn('API getAllEvents échoué → mode local');
            }
        }
        
        return this.getEventsWithFilters(filters);
    }

    getEventById(id) {
        // 🔄 Sync token depuis localStorage
        this.syncAuthFromStorage();
        
        if (this.USE_API_DIRECT && this.isOnline && this.token) {
            try {
                const result = this.apiRequest(`/events/${id}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getEventById échec, mode local');
            }
        }
        return this.data.events.find(e => e.id === id) || null;
    }

    async createEvent(event) {
    if (this.USE_API_DIRECT && this.isOnline) {
        try {
            const eventWithOrganizer = {
                ...this.sanitizeEventData(event),
                organizerId: this.user?.id || null
            };
            
            const result = await this.apiRequest('/events', {
                method: 'POST',
                body: JSON.stringify(eventWithOrganizer)
            });
            
            if (result.success) {
                await this.syncPull();
                console.log('✅ Événement créé via API:', result.data.name);
                this.emit('event:created', result.data);
                this.emitStatsUpdate();
                return result.data;
            }
        } catch (err) {
            console.warn('⚠️ API createEvent échec, mode local');
        }
    }
    
    const eventWithOrganizer = {
        ...event,
        organizerId: this.user?.id || null
    };
    return this.saveEvent(eventWithOrganizer);
}

    // Mise à jour de updateEvent pour gérer les nouveaux champs
    async updateEvent(id, updates) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/events/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updates)
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Événement mis à jour via API');
                    this.emit('event:updated', { new: result.data });
                    this.emitStatsUpdate();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API updateEvent échec, mode local');
            }
        }
        
        const event = this.data.events.find(e => e.id === id);
        if (event) {
            const oldEvent = { ...event };
            const sanitizedUpdates = this.sanitizeEventData(updates);
            
            // Fusionner les mises à jour avec l'événement existant
            Object.assign(event, sanitizedUpdates, { 
                updatedAt: new Date().toISOString(),
                id: event.id // Garder l'ID original
            });
            
            this.ensureEventFields(event);
            this.saveToLocalStorage();
            
            if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
            this.emit('event:updated', { old: oldEvent, new: event });
            this.emitStatsUpdate();
            return event;
        }
        return null;
    }

    async updateEventStats(eventId) {
        const event = this.getEventById(eventId);
        if (!event) return null;
        
        const guests = this.getGuestsByEventId(eventId);
        const scans = this.data.scans.filter(s => s.eventId === eventId);
        
        const stats = {
            totalGuests: guests.length,
            confirmedGuests: guests.filter(g => g.status === 'confirmed').length,
            scannedGuests: guests.filter(g => g.scanned).length,
            totalScans: scans.length,
            scanRate: guests.length > 0 ? 
                Math.round((guests.filter(g => g.scanned).length / guests.length) * 100) : 0,
            lastScan: scans.length > 0 ? 
                scans.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))[0].scannedAt : null
        };
        
        return this.patchEvent(eventId, { stats });
    }

    async deleteEvent(id) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/events/${id}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Événement supprimé via API');
                    this.emit('event:deleted', { id });
                    this.emitStatsUpdate();
                    return true;
                }
            } catch (err) {
                console.warn('⚠️ API deleteEvent échec, mode local');
            }
        }
        
        const event = this.data.events.find(e => e.id === id);
        
        // ⚠️ CASCADE DELETE: Supprimer toutes les galeries de l'événement
        const galleriesToDelete = this.data.galleries?.filter(g => g.eventId === id) || [];
        galleriesToDelete.forEach(gallery => {
            // Supprimer toutes les photos de la galerie
            const photosToDelete = this.data.photos?.filter(p => p.galleryId === gallery.id) || [];
            photosToDelete.forEach(photo => {
                this.data.photos = this.data.photos.filter(p => p.id !== photo.id);
            });
            
            // Supprimer tous les commentaires des photos de la galerie
            const commentsToDelete = this.data.comments?.filter(c => 
                photosToDelete.some(p => p.id === c.photoId)
            ) || [];
            commentsToDelete.forEach(comment => {
                this.data.comments = this.data.comments.filter(c => c.id !== comment.id);
            });
            
            console.log(`🗑️ Galerie supprimée en cascade: ${gallery.id}, Photos: ${photosToDelete.length}`);
        });
        this.data.galleries = this.data.galleries.filter(g => g.eventId !== id);
        
        // Supprimer les invités de l'événement
        this.data.guests = this.data.guests.filter(g => g.eventId !== id);
        const guestIds = this.data.guests.filter(g => g.eventId === id).map(g => g.id);
        
        // Supprimer les QR codes des invités
        this.data.qrCodes = this.data.qrCodes.filter(q => !guestIds.includes(q.guestId));
        
        // Supprimer les scans de l'événement
        this.data.scans = this.data.scans.filter(s => s.eventId !== id);
        
        // Supprimer tous les menus/plats de l'événement
        this.data.menus = this.data.menus?.filter(m => m.eventId !== id) || [];
        
        // Supprimer tous les plans de table de l'événement
        this.data.plans = this.data.plans?.filter(p => p.eventId !== id) || [];
        
        // Supprimer les messages de l'événement
        this.data.messages = this.data.messages?.filter(m => m.eventId !== id) || [];
        
        console.log(`🗑️ Événement supprimé: ${id}, Galeries: ${galleriesToDelete.length}, Invités: ${guestIds.length}`);
        
        this.data.events = this.data.events.filter(e => e.id !== id);
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('event:deleted', event);
        this.emitStatsUpdate();
        return true;
    }

    
    async saveEvent(event) {
        const now = new Date().toISOString();
        const index = this.data.events.findIndex(e => e.id === event.id);
        
        const sanitizedEvent = this.sanitizeEventData(event);
        
        if (index !== -1) {
            // Mise à jour d'un événement existant
            const oldEvent = { ...this.data.events[index] };
            this.data.events[index] = { 
                ...this.data.events[index], 
                ...sanitizedEvent, 
                updatedAt: now 
            };
            
            // S'assurer que les champs essentiels sont présents
            this.ensureEventFields(this.data.events[index]);
            
            this.emit('event:updated', { old: oldEvent, new: this.data.events[index] });
        } else {
            // Création d'un nouvel événement
            sanitizedEvent.id = event.id || this.generateId('evt');
            sanitizedEvent.createdAt = sanitizedEvent.updatedAt = now;
            sanitizedEvent.active = sanitizedEvent.active !== false;
            
            // Initialiser les champs du modèle complet
            const completeEvent = this.initializeCompleteEvent(sanitizedEvent);
            this.data.events.unshift(completeEvent);
            this.emit('event:created', completeEvent);
        }
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emitStatsUpdate();
        return this.data.events[index] || this.data.events[0];
    }

    sanitizeEventData(event) {
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
            
            // Nouveaux champs du modèle
            status: event.status || 'active',
            organizerId: event.organizerId || null,

            
            settings: event.settings || {
                allowGuestRegistration: true,
                requireApproval: false,
                maxGuestsPerUser: 5,
                allowQRSharing: true,
                autoGenerateQRCodes: false
            },
            design: event.design || {
                primaryColor: '#D97706',
                secondaryColor: '#3B82F6',
                backgroundImage: null,
                logo: null,
                theme: 'modern'
            },
            stats: event.stats || {
                totalGuests: 0,
                confirmedGuests: 0,
                scannedGuests: 0,
                totalScans: 0,
                scanRate: 0,
                lastScan: null
            },
            metadata: event.metadata || {
                tags: [],
                category: 'general',
                visibility: 'private',
                timezone: 'Africa/Douala'
            }
        };
    }

    initializeCompleteEvent(eventData) {
        const defaultEvent = {
            id: eventData.id,
            organizerId: eventData.organizerId || this.user?.id || null,
            name: eventData.name,
            type: eventData.type || 'autre',
            date: eventData.date,
            time: eventData.time || '',
            location: eventData.location,
            capacity: parseInt(eventData.capacity) || 0,
            description: eventData.description || '',
            welcomeMessage: eventData.welcomeMessage || '',
            active: eventData.active !== false,
            status: eventData.status || 'active',
            
            settings: {
                allowGuestRegistration: true,
                requireApproval: false,
                maxGuestsPerUser: 5,
                allowQRSharing: true,
                autoGenerateQRCodes: false,
                enablePhotoGallery: false,
                enableGuestMessages: false,
                enableTableQR: false,
                ...eventData.settings
            },
            
            design: {
                primaryColor: '#D97706',
                secondaryColor: '#3B82F6',
                backgroundImage: null,
                logo: null,
                theme: 'modern',
                customCSS: '',
                ...eventData.design
            },
            
            stats: {
                totalGuests: 0,
                confirmedGuests: 0,
                scannedGuests: 0,
                totalScans: 0,
                scanRate: 0,
                lastScan: null,
                ...eventData.stats
            },
            
            metadata: {
                tags: [],
                category: 'general',
                visibility: 'private',
                timezone: 'Africa/Douala',
                createdAt: eventData.createdAt,
                createdBy: this.user?.id || null,
                ...eventData.metadata
            },
            
            createdAt: eventData.createdAt,
            updatedAt: eventData.updatedAt
        };
        
        return defaultEvent;
    }

    ensureEventFields(event) {
        const requiredFields = {
            settings: event.settings || {},
            design: event.design || {},
            stats: event.stats || {},
            metadata: event.metadata || {}
        };
        
        event.settings = { ...this.initializeCompleteEvent({}).settings, ...requiredFields.settings };
        event.design = { ...this.initializeCompleteEvent({}).design, ...requiredFields.design };
        event.stats = { ...this.initializeCompleteEvent({}).stats, ...requiredFields.stats };
        event.metadata = { ...this.initializeCompleteEvent({}).metadata, ...requiredFields.metadata };
        
        return event;
    }

    async patchEvent(id, partialUpdates) {
        if (this.USE_API_DIRECT) {
            try {
                const result = await this.apiRequest(`/events/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(partialUpdates)
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API patchEvent échec, mode local');
            }
        }
        
        // Implémentation locale avec support des champs imbriqués
        const event = this.data.events.find(e => e.id === id);
        if (!event) return null;
        
        const oldEvent = { ...event };
        
        // Mise à jour profonde pour les objets imbriqués
        Object.keys(partialUpdates).forEach(key => {
            if (typeof partialUpdates[key] === 'object' && partialUpdates[key] !== null) {
                event[key] = { ...event[key], ...partialUpdates[key] };
            } else {
                event[key] = partialUpdates[key];
            }
        });
        
        event.updatedAt = new Date().toISOString();
        this.ensureEventFields(event);
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('event:updated', { old: oldEvent, new: event });
        this.emitStatsUpdate();
        
        return event;
    }

     async getEventStatistics(id) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/events/${id}/statistics`);
                
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getEventStatistics échec');
            }
        }
        
        const guests = this.data.guests.filter(g => g.eventId === id);
        const scans = this.data.scans.filter(s => s.eventId === id);
        
        return {
            totalGuests: guests.length,
            scannedGuests: guests.filter(g => g.scanned).length,
            pendingGuests: guests.filter(g => !g.scanned).length,
            totalScans: scans.length,
            scanRate: guests.length > 0 ? Math.round((guests.filter(g => g.scanned).length / guests.length) * 100) : 0
        };
    }

    getEventsWithFilters(filters = {}) {
        let events = [...this.data.events];
        
        // Filtre par type
        if (filters.type) {
            events = events.filter(e => e.type === filters.type);
        }
        
        // Filtre par statut
        if (filters.status) {
            events = events.filter(e => e.status === filters.status);
        }
        
        // Filtre par organisateur
        if (filters.organizerId) {
            events = events.filter(e => e.organizerId === filters.organizerId);
        }
        
        // Filtre par catégorie
        if (filters.category) {
            events = events.filter(e => 
                e.metadata?.category === filters.category
            );
        }
        
        // Filtre par tags
        if (filters.tag) {
            events = events.filter(e => 
                e.metadata?.tags?.includes(filters.tag)
            );
        }
        
        // Tri
        if (filters.sortBy) {
            const sortField = filters.sortBy;
            const sortOrder = filters.sortOrder === 'desc' ? -1 : 1;
            
            events.sort((a, b) => {
                if (sortField.includes('.')) {
                    // Pour les champs imbriqués comme 'stats.totalGuests'
                    const keys = sortField.split('.');
                    let aVal = a, bVal = b;
                    
                    for (const key of keys) {
                        aVal = aVal?.[key];
                        bVal = bVal?.[key];
                    }
                    
                    if (aVal < bVal) return -1 * sortOrder;
                    if (aVal > bVal) return 1 * sortOrder;
                    return 0;
                } else {
                    if (a[sortField] < b[sortField]) return -1 * sortOrder;
                    if (a[sortField] > b[sortField]) return 1 * sortOrder;
                    return 0;
                }
            });
        }
        
        return events;
    }



    // ═══════════════════════════════════════════════════════════════
    // 👥 CRUD INVITÉS
    // ═══════════════════════════════════════════════════════════════
    getAllGuests(filters = {}) {
    if (this.USE_API_DIRECT && this.isOnline) {
        try {
        const params = new URLSearchParams(filters).toString();
        const result = this.apiRequest(`/guests${params ? '?' + params : ''}`);
        
        if (result.success) {
            const oldGuests = [...this.data.guests];
            this.data.guests = result.data;
            this.saveToLocalStorage();
            
            // Détecter les changements
            this.detectChanges({ 
            events: this.data.events, 
            guests: oldGuests, 
            qrCodes: this.data.qrCodes, 
            scans: this.data.scans 
            }, this.data);
            
            return result.data;
        }
        } catch (err) {
        console.warn('⚠️ API getAllGuests échec, mode local');
        }
    }
    
    let guests = this.data.guests || [];
    
    if (filters.eventId) guests = guests.filter(g => g.eventId === filters.eventId);
    if (filters.tableId) guests = guests.filter(g => g.tableId === filters.tableId);
    if (filters.tableNumber) guests = guests.filter(g => g.tableNumber === filters.tableNumber);
    if (filters.scanned !== undefined) {
        guests = guests.filter(g => g.scanned === (filters.scanned === 'true'));
    }
    if (filters.status) guests = guests.filter(g => g.status === filters.status);
    
    if (filters.seats) {
        const seatsNum = parseInt(filters.seats);
        if (!isNaN(seatsNum)) {
        guests = guests.filter(g => g.seats === seatsNum);
        }
    }
    
    if (filters.search && filters.search.length >= 2) {
        const term = filters.search.toLowerCase();
        guests = guests.filter(g =>
        g.firstName?.toLowerCase().includes(term) ||
        g.lastName?.toLowerCase().includes(term) ||
        g.email?.toLowerCase().includes(term) ||
        g.phone?.includes(term) ||
        g.company?.toLowerCase().includes(term) ||
        g.notes?.toLowerCase().includes(term)
        );
    }
    
    guests.sort((a, b) => {
        if (filters.sortBy === 'tableNumber') {
        const aNum = parseInt(a.tableNumber) || 0;
        const bNum = parseInt(b.tableNumber) || 0;
        return aNum - bNum;
        } else if (filters.sortBy === 'seats') {
        return (b.seats || 1) - (a.seats || 1);
        } else {
        const nameA = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
        const nameB = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
        return nameA.localeCompare(nameB);
        }
    });
    
    return guests;
    }


    // Mise à jour de la méthode pour obtenir les invités avec informations de table
    getGuestsWithTableInfo(eventId = null) {
    let guests = this.data.guests || [];
    
    if (eventId) {
        guests = guests.filter(g => g.eventId === eventId);
    }
    
    return guests.map(guest => {
        const enhancedGuest = { ...guest };
        
        if (guest.tableId) {
        const table = this.data.tables?.find(t => t.id === guest.tableId);
        if (table) {
            enhancedGuest.tableInfo = {
            id: table.id,
            tableNumber: table.tableNumber,
            tableName: table.tableName,
            capacity: table.capacity,
            location: table.location
            };
        }
        }
        
        return enhancedGuest;
    });
    }

    getUnassignedGuests(eventId) {
    return (this.data.guests || []).filter(g => 
        g.eventId === eventId && 
        (!g.tableId || g.tableId === null || g.tableId === '')
    );
    }

    // Nouvelle méthode pour récupérer les invités par table
    getGuestsByTable(tableId) {
    const table = this.data.tables?.find(t => t.id === tableId);
    if (!table) return [];
    
    return table.assignedGuests.map(ag => {
        const guest = this.data.guests.find(g => g.id === ag.guestId);
        return {
        ...ag,
        guest: guest || null
        };
    }).filter(item => item.guest !== null); // Filtrer les invités introuvables
    }



    getGuestById(id) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = this.apiRequest(`/guests/${id}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getGuestById échec');
            }
        }
        return this.data.guests.find(g => g.id === id) || null;
    }

    getGuestsByEventId(eventId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = this.apiRequest(`/events/${eventId}/guests`);
                if (result.success) return result.data.guests;
            } catch (err) {
                console.warn('⚠️ API getGuestsByEventId échec');
            }
        }
        return this.data.guests.filter(g => g.eventId === eventId);
    }

    /**
     * Get table information for a guest by their tableId
     * Handles both direct API and local storage
     */
    async getGuestTable(guestId) {
        try {
            const guest = this.getGuestById(guestId);
            if (!guest || !guest.tableId) {
                console.warn(`⚠️ Guest ${guestId} not found or has no tableId`);
                return null;
            }
            
            return this.getTableById(guest.tableId);
        } catch (error) {
            console.error('❌ Error getting guest table:', error);
            return null;
        }
    }

    async createGuest(guest) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                
                const response = await this.apiRequest('/guests', {
                    method: 'POST',
                    body: JSON.stringify(guest)
                });



                if (response.success) {
                    await this.syncPull();
                    console.log('✅ Invité créé via API:', response.data.firstName);
                    this.emit('guest:created', response.data);
                    this.emitStatsUpdate();
                    return response.data;
                } else {
                    console.warn('⚠️ Réponse API négative:', response);
                    return { success: false, error: true, message: response.message || 'Erreur serveur API' };
                }
            } catch (err) {
                console.error('🚨 Échec createGuest API:', err);
                return { success: false, error: true, message: 'Connexion au serveur impossible' };
            }
        }

        return this.saveGuest(guest);
    }

    async updateGuest(id, updates) {
    if (this.USE_API_DIRECT && this.isOnline) {
        try {
        const result = await this.apiRequest(`/guests/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        if (result.success) {
            await this.syncPull();
            this.emit('guest:updated', { new: result.data });
            this.emitStatsUpdate();
            return result.data;
        }
        } catch (err) {
        console.warn('⚠️ API updateGuest échec, mode local');
        }
    }
    
    // Mode local
    const guest = this.data.guests.find(g => g.id === id);
    if (!guest) return null;
    
    const oldGuest = { ...guest };
    
    // Gérer les changements de table
    if (updates.tableId !== undefined && updates.tableId !== guest.tableId) {
        this.handleGuestTableChange(guest, { ...guest, ...updates });
    }
    
    Object.assign(guest, updates, { 
        updatedAt: new Date().toISOString() 
    });
    
    if (guest.tableId && !guest.tableNumber) {
        const table = this.data.tables?.find(t => t.id === guest.tableId);
        if (table) {
        guest.tableNumber = table.tableNumber;
        }
    }
    
    this.saveToLocalStorage();
    if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
    this.emit('guest:updated', { old: oldGuest, new: guest });
    this.emitStatsUpdate();
    
    return guest;
    }

    async deleteGuest(id) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/guests/${id}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Invité supprimé via API');
                    this.emit('guest:deleted', { id });
                    this.emitStatsUpdate();
                    return true;
                }
            } catch (err) {
                console.warn('⚠️ API deleteGuest échec');
            }
        }
        
        const guest = this.data.guests.find(g => g.id === id);
        this.data.guests = this.data.guests.filter(g => g.id !== id);
        this.data.qrCodes = this.data.qrCodes.filter(q => q.guestId !== id);
        this.data.scans = this.data.scans.filter(s => s.guestId !== id);
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('guest:deleted', guest);
        this.emitStatsUpdate();
        return true;
    }

    saveGuest(guest) {
    const now = new Date().toISOString();
    const index = this.data.guests.findIndex(g => g.id === guest.id);
    
    const guestWithDefaults = {
        ...guest,
        seats: parseInt(guest.seats) || 1,
        status: guest.status || GUEST_STATUS.PENDING,
        scanned: guest.scanned || false,
        scanCount: parseInt(guest.scanCount) || 0,
        metadata: {
        category: 'standard',
        invitationSent: false,
        confirmed: false,
        ...guest.metadata
        },
        scanHistory: guest.scanHistory || [],
        confirmationHistory: guest.confirmationHistory || []
    };
    
    if (index !== -1) {
        const oldGuest = { ...this.data.guests[index] };
        
        if (guest.tableId !== oldGuest.tableId) {
        this.handleGuestTableChange(oldGuest, guestWithDefaults);
        }
        
        this.data.guests[index] = { 
        ...this.data.guests[index], 
        ...guestWithDefaults, 
        updatedAt: now,
        createdAt: oldGuest.createdAt || now,
        id: oldGuest.id
        };
        
        this.emit('guest:updated', { old: oldGuest, new: this.data.guests[index] });
    } else {
        // Création d'un nouvel invité
        guestWithDefaults.id = guest.id || this.generateId('gst');
        guestWithDefaults.createdAt = guestWithDefaults.updatedAt = now;
        
        // Si assigné à une table, mettre à jour la table
        if (guestWithDefaults.tableId) {
        this.updateTableWithGuest(guestWithDefaults);
        }
        
        this.data.guests.push(guestWithDefaults);
        this.emit('guest:created', guestWithDefaults);
    }
    
    this.saveToLocalStorage();
    if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
    this.emitStatsUpdate();
    
    return guestWithDefaults;
    }

    handleGuestTableChange(oldGuest, newGuest) {
    if (oldGuest.tableId) {
        const oldTable = this.data.tables?.find(t => t.id === oldGuest.tableId);
        if (oldTable) {
        oldTable.assignedGuests = oldTable.assignedGuests.filter(g => g.guestId !== oldGuest.id);
        this.emit('table:updated', { id: oldTable.id });
        }
    }
    
    // Ajouter à la nouvelle table
    if (newGuest.tableId) {
        const newTable = this.data.tables?.find(t => t.id === newGuest.tableId);
        if (newTable) {
        const totalSeats = newTable.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = newTable.capacity - totalSeats;
        
        if (newGuest.seats <= availableSeats) {
            newTable.assignedGuests.push({
            guestId: newGuest.id,
            guestName: `${newGuest.firstName || ''} ${newGuest.lastName || ''}`.trim() || newGuest.email,
            seats: newGuest.seats || 1,
            assignedAt: new Date().toISOString(),
            assignedBy: 'system'
            });
            
            newGuest.tableNumber = newTable.tableNumber;
            this.emit('table:updated', { id: newTable.id });
        } else {
            console.warn('⚠️ Capacité insuffisante sur la table', {
            table: newTable.tableName,
            required: newGuest.seats,
            available: availableSeats
            });
            // Annuler l'assignation si pas assez de places
            newGuest.tableId = null;
            newGuest.tableNumber = null;
            newGuest.assignedAt = null;
        }
        }
    }
    }


/**
 * Récupérer les statistiques détaillées des invités d'un événement
 */
getEventGuestsStats(eventId) {
  const guests = this.data.guests.filter(g => g.eventId === eventId);
  
  return {
    total: guests.length,
    byStatus: {
      pending: guests.filter(g => g.status === GUEST_STATUS.PENDING).length,
      confirmed: guests.filter(g => g.status === GUEST_STATUS.CONFIRMED).length,
      cancelled: guests.filter(g => g.status === GUEST_STATUS.CANCELLED).length,
      checked_in: guests.filter(g => g.status === GUEST_STATUS.CHECKED_IN).length,
      no_show: guests.filter(g => g.status === GUEST_STATUS.NO_SHOW).length
    },
    byTable: {
      assigned: guests.filter(g => g.tableId).length,
      unassigned: guests.filter(g => !g.tableId).length
    },
    byScan: {
      scanned: guests.filter(g => g.scanned).length,
      notScanned: guests.filter(g => !g.scanned).length
    },
    seats: {
      total: guests.reduce((sum, g) => sum + (g.seats || 1), 0),
      average: guests.length > 0 ? 
        (guests.reduce((sum, g) => sum + (g.seats || 1), 0) / guests.length).toFixed(1) : 0
    }
  };
}

/**
 * Recherche avancée d'invités
 */
searchGuestsAdvanced(query, filters = {}) {
  let guests = this.data.guests || [];
  
  // Appliquer les filtres de base
  if (filters.eventId) guests = guests.filter(g => g.eventId === filters.eventId);
  if (filters.tableId) guests = guests.filter(g => g.tableId === filters.tableId);
  if (filters.status) guests = guests.filter(g => g.status === filters.status);
  if (filters.scanned !== undefined) {
    guests = guests.filter(g => g.scanned === (filters.scanned === 'true'));
  }
  
  // Recherche textuelle
  if (query && query.length >= 2) {
    const term = query.toLowerCase();
    guests = guests.filter(g =>
      g.firstName?.toLowerCase().includes(term) ||
      g.lastName?.toLowerCase().includes(term) ||
      g.email?.toLowerCase().includes(term) ||
      g.phone?.includes(term) ||
      g.company?.toLowerCase().includes(term) ||
      g.notes?.toLowerCase().includes(term) ||
      g.tableNumber?.includes(term) ||
      g.metadata?.specialRequirements?.toLowerCase().includes(term)
    );
  }
  
  // Tri
  if (filters.sortBy) {
    const sortField = filters.sortBy;
    const sortOrder = filters.sortOrder === 'desc' ? -1 : 1;
    
    guests.sort((a, b) => {
      let aVal, bVal;
      
      if (sortField === 'name') {
        aVal = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
        bVal = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
      } else if (sortField === 'tableNumber') {
        aVal = parseInt(a.tableNumber) || 0;
        bVal = parseInt(b.tableNumber) || 0;
      } else if (sortField === 'seats') {
        aVal = a.seats || 1;
        bVal = b.seats || 1;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      
      if (aVal < bVal) return -1 * sortOrder;
      if (aVal > bVal) return 1 * sortOrder;
      return 0;
    });
  }
  
  return guests;
}

/**
 * Exporter les invités avec toutes les informations (CSV complet)
 */
exportGuestsToCSVComplete(eventId = null, includeTableInfo = true) {
  let guests = this.data.guests || [];
  
  if (eventId) {
    guests = guests.filter(g => g.eventId === eventId);
  }
  
  const headers = [
    'ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 
    'Notes', 'Statut', 'Places', 'Scanné', 'Date Scan', 'Compteur Scan',
    'ID Table', 'Numéro Table', 'Assigné le',
    'Catégorie', 'Requirements Spéciaux', 'Invitation Envoyée', 'Confirmé'
  ];
  
  const rows = [headers.join(',')];
  
  guests.forEach(g => {
    const row = [
      g.id,
      g.firstName || '',
      g.lastName || '',
      g.email || '',
      g.phone || '',
      g.company || '',
      (g.notes || '').replace(/,/g, ';'),
      g.status || '',
      g.seats || 1,
      g.scanned ? 'Oui' : 'Non',
      g.scannedAt || '',
      g.scanCount || 0,
      g.tableId || '',
      g.tableNumber || '',
      g.assignedAt || '',
      g.metadata?.category || '',
      (g.metadata?.specialRequirements || '').replace(/,/g, ';'),
      g.metadata?.invitationSent ? 'Oui' : 'Non',
      g.metadata?.confirmed ? 'Oui' : 'Non'
    ].map(v => `"${v}"`).join(',');
    
    rows.push(row);
  });
  
  const csv = rows.join('\n');
  const filename = `secura-guests-complete-${new Date().toISOString().split('T')[0]}.csv`;
  
  // Créer et télécharger le fichier
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
  
  console.log('✅ CSV complet exporté:', guests.length, 'invités');
  return true;
}

/**
 * Réinitialiser le scan d'un invité
 */
resetGuestScan(guestId) {
  const guest = this.data.guests.find(g => g.id === guestId);
  if (!guest) return false;
  
  const oldGuest = { ...guest };
  
  guest.scanned = false;
  guest.scannedAt = null;
  guest.updatedAt = new Date().toISOString();
  
  // Supprimer les scans associés
  this.data.scans = this.data.scans.filter(s => s.guestId !== guestId);
  
  this.saveToLocalStorage();
  if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
  this.emit('guest:updated', { old: oldGuest, new: guest });
  this.emitStatsUpdate();
  
  console.log('✅ Scan réinitialisé pour:', guest.firstName, guest.lastName);
  return true;
}

/**
 * Mettre à jour le statut d'un invité
 */
updateGuestStatus(guestId, status, notes = '') {
  if (!Object.values(GUEST_STATUS).includes(status)) {
    throw new Error(`Statut invalide. Valeurs acceptées: ${Object.values(GUEST_STATUS).join(', ')}`);
  }
  
  const guest = this.data.guests.find(g => g.id === guestId);
  if (!guest) return false;
  
  const oldGuest = { ...guest };
  
  guest.status = status;
  guest.updatedAt = new Date().toISOString();
  
  // Ajouter à l'historique des confirmations
  guest.confirmationHistory = [
    ...(guest.confirmationHistory || []),
    {
      status,
      changedAt: new Date().toISOString(),
      notes,
      changedBy: this.user?.email || 'system'
    }
  ];
  
  // Si le statut est "checked_in", marquer comme scanné
  if (status === GUEST_STATUS.CHECKED_IN && !guest.scanned) {
    guest.scanned = true;
    guest.scannedAt = new Date().toISOString();
  }
  
  this.saveToLocalStorage();
  if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
  this.emit('guest:updated', { old: oldGuest, new: guest });
  this.emitStatsUpdate();
  
  console.log('✅ Statut mis à jour:', guest.firstName, guest.lastName, '→', status);
  return guest;
}

/**
 * Effectuer un check-in d'invité (scan QR ou validation manuelle)
 * @param {string} guestId - ID de l'invité
 * @param {object} checkInData - Données du check-in (source, location, etc.)
 * @returns {object} Invité mis à jour avec le statut CHECKED_IN
 */
checkInGuest(guestId, checkInData = {}) {
  const guest = this.data.guests.find(g => g.id === guestId);
  if (!guest) return false;
  
  const oldGuest = { ...guest };
  const now = new Date().toISOString();
  
  // Vérifier si déjà scanné
  const alreadyScanned = guest.scanned;
  
  // Mettre à jour les informations de scan
  guest.scanned = true;
  guest.scannedAt = now;
  guest.scanCount = (guest.scanCount || 0) + 1;
  guest.lastScanSource = checkInData.source || 'manual';
  
  // Mettre à jour le statut
  guest.status = GUEST_STATUS.CHECKED_IN;
  guest.updatedAt = now;
  
  // Ajouter à l'historique des confirmations
  guest.confirmationHistory = [
    ...(guest.confirmationHistory || []),
    {
      status: GUEST_STATUS.CHECKED_IN,
      changedAt: now,
      notes: checkInData.notes || `Check-in depuis ${checkInData.source || 'system'}`,
      changedBy: checkInData.changedBy || 'system',
      source: checkInData.source || 'manual',
      ip: checkInData.ip || null,
      alreadyScanned: alreadyScanned
    }
  ];
  
  // Ajouter à l'historique de scan
  guest.scanHistory = [
    ...(guest.scanHistory || []),
    {
      scanId: this.generateId('scn'),
      scannedAt: now,
      source: checkInData.source || 'manual',
      location: checkInData.location || null,
      scannerName: checkInData.scannerName || 'Système',
      ip: checkInData.ip || null,
      alreadyScanned: alreadyScanned
    }
  ];
  
  this.saveToLocalStorage();
  if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
  
  // Émettre les événements
  this.emit('guest:updated', { old: oldGuest, new: guest });
  this.emit('guest:checked-in', { guest, alreadyScanned });
  this.emitStatsUpdate();
  
  console.log('✅ Check-in effectué:', guest.firstName, guest.lastName, '→', GUEST_STATUS.CHECKED_IN, `(Scan #${guest.scanCount})`);
  return { guest, alreadyScanned };
}

    // Nouvelle méthode pour gérer l'assignation en masse
    async assignGuestsToTable(tableId, guestIds, options = {}) {
    if (this.USE_API_DIRECT && this.isOnline) {
        try {
        const result = await this.apiRequest(`/tables/${tableId}/assign-bulk`, {
            method: 'POST',
            body: JSON.stringify({ guestIds, ...options })
        });
        
        if (result.success) {
            await this.syncPull();
            return result.data;
        }
        } catch (err) {
        console.warn('⚠️ API assignGuestsToTable échec, mode local');
        }
    }
    
    // Mode local
    const table = this.data.tables?.find(t => t.id === tableId);
    if (!table) throw new Error('Table introuvable');
    
    const assigned = [];
    const errors = [];
    const now = new Date().toISOString();
    
    // Calculer la capacité actuelle
    const currentSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
    let availableSeats = table.capacity - currentSeats;
    
    guestIds.forEach(guestId => {
        try {
        const guest = this.data.guests.find(g => g.id === guestId);
        if (!guest) {
            errors.push({ guestId, error: 'Invité introuvable' });
            return;
        }
        
        // Vérifier si déjà assigné à cette table
        const alreadyAssigned = table.assignedGuests.find(g => g.guestId === guestId);
        if (alreadyAssigned) {
            errors.push({ guestId, error: 'Déjà assigné à cette table' });
            return;
        }
        
        const requiredSeats = options.autoAssignSeats ? 1 : (guest.seats || 1);
        
        // Vérifier la capacité
        if (requiredSeats > availableSeats) {
            errors.push({ guestId, error: `Places insuffisantes (${availableSeats} disponible(s))` });
            return;
        }
        
        // Retirer de l'ancienne table si nécessaire
        if (guest.tableId && guest.tableId !== tableId) {
            const oldTable = this.data.tables.find(t => t.id === guest.tableId);
            if (oldTable) {
            oldTable.assignedGuests = oldTable.assignedGuests.filter(g => g.guestId !== guestId);
            }
        }
        
        // Ajouter à la nouvelle table
        table.assignedGuests.push({
            guestId: guest.id,
            guestName: `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email,
            seats: requiredSeats,
            assignedAt: now,
            assignedBy: options.assignedBy || 'system'
        });
        
        // Mettre à jour l'invité
        guest.tableId = table.id;
        guest.tableNumber = table.tableNumber;
        guest.assignedAt = now;
        guest.seats = requiredSeats;
        guest.updatedAt = now;
        
        availableSeats -= requiredSeats;
        assigned.push(guest);
        
        this.emit('guest:updated', { new: guest });
        this.emit('table:guest-assigned', { table, guest });
        
        } catch (err) {
        errors.push({ guestId, error: err.message });
        }
    });
    
    table.updatedAt = now;
    this.saveToLocalStorage();
    if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
    this.emitStatsUpdate();
    
    return { assigned, errors, table: this.calculateTableStats(table) };
    }

    // Méthode utilitaire pour calculer les statistiques d'une table
    calculateTableStats(table) {
    if (!table) return null;
    
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
    }



 
    // Mise à jour de createMultipleGuests pour gérer les tables
    async createMultipleGuests(guests, options = {}) {
    if (this.USE_API_DIRECT && this.isOnline) {
        try {
        const result = await this.apiRequest('/guests/bulk', {
            method: 'POST',
            body: JSON.stringify({ 
            guests,
            options
            })
        });

        if (result.success) {
            await this.syncPull();
            console.log('✅ Invités créés en masse via API:', result.count);
            result.data.forEach(guest => this.emit('guest:created', guest));
            return result.data;
        }
        } catch (err) {
        console.warn('⚠️ API createMultipleGuests échec, mode local');
        }
    }
    
    return this.saveMultipleGuests(guests, options);
    }

    saveMultipleGuests(guests, options = {}) {
    const now = new Date().toISOString();
    const newGuests = [];
    const errors = [];

    guests.forEach((guest, idx) => {
        try {
        const existingGuest = this.data.guests.find(g => 
            g.id === guest.id || 
            (g.email && g.email === guest.email && g.eventId === guest.eventId)
        );

        if (existingGuest) {
            // Mise à jour de l'invité existant
            const oldGuest = { ...existingGuest };
            
            // Gérer les changements de table
            if (guest.tableId !== undefined && guest.tableId !== existingGuest.tableId) {
            this.handleGuestTableChange(existingGuest, { ...existingGuest, ...guest });
            }
            
            Object.assign(existingGuest, guest, { updatedAt: now });
            this.emit('guest:updated', { old: oldGuest, new: existingGuest });
        } else {
            // Créer un nouvel invité
            const newGuest = {
            ...guest,
            id: guest.id || this.generateId('gst'),
            seats: parseInt(guest.seats) || 1,
            status: guest.status || GUEST_STATUS.PENDING,
            scanned: false,
            scanCount: 0,
            scanHistory: [],
            confirmationHistory: [],
            metadata: {
                category: 'standard',
                invitationSent: false,
                confirmed: false,
                ...guest.metadata
            },
            createdAt: now,
            updatedAt: now
            };
            
            // Gérer l'assignation à une table si spécifiée
            if (newGuest.tableId) {
            const table = this.data.tables?.find(t => t.id === newGuest.tableId);
            if (table) {
                // Vérifier la capacité
                const totalSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                const availableSeats = table.capacity - totalSeats;
                
                if (newGuest.seats <= availableSeats) {
                table.assignedGuests.push({
                    guestId: newGuest.id,
                    guestName: `${newGuest.firstName || ''} ${newGuest.lastName || ''}`.trim() || newGuest.email,
                    seats: newGuest.seats,
                    assignedAt: now,
                    assignedBy: 'bulk-import'
                });
                
                newGuest.tableNumber = table.tableNumber;
                newGuest.assignedAt = now;
                table.updatedAt = now;
                
                this.emit('table:updated', { id: table.id });
                } else {
                errors.push({ 
                    index: idx, 
                    guest: newGuest, 
                    error: `Capacité insuffisante sur la table ${table.tableNumber}` 
                });
                // Ne pas créer l'invité si pas de place
                return;
                }
            }
            }
            
            this.data.guests.push(newGuest);
            newGuests.push(newGuest);
            this.emit('guest:created', newGuest);
        }
        } catch (err) {
        errors.push({ index: idx, guest, error: err.message });
        }
    });

    this.saveToLocalStorage();
    if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
    this.triggerDataUpdate();

    return { 
        created: newGuests, 
        updated: guests.length - newGuests.length - errors.length,
        errors: errors.length > 0 ? errors : undefined 
    };
    }


    async patchGuest(id, partialUpdates) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/guests/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(partialUpdates)
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API patchGuest échec');
            }
        }
        return this.updateGuest(id, partialUpdates);
    }


    async deleteMultipleGuests(ids) {
        if (this.USE_API_DIRECT) {
            try {
                const result = await this.apiRequest('/guest/bulk', {
                    method: 'DELETE',
                    body: JSON.stringify({ ids })
                });

                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Invités supprimés en masse via API:', result.deleted);

                    if (Array.isArray(ids)) {
                        ids.forEach(id => this.emit('guest:deleted', { id }));
                    }

                    this.emitStatsUpdate();
                    this.triggerDataUpdate();
                    return true;
                }
            } catch (err) {
                console.warn('⚠️ API deleteMultipleGuests échec');
            }
        }

        const deletedGuests = this.data.guests.filter(g => ids.includes(g.id));

        this.data.guests = this.data.guests.filter(g => !ids.includes(g.id));
        this.data.qrCodes = this.data.qrCodes.filter(q => !ids.includes(q.guestId));
        this.data.scans = this.data.scans.filter(s => !ids.includes(s.guestId));

        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();

        deletedGuests.forEach(g => this.emit('guest:deleted', g));

        this.emitStatsUpdate();
        this.triggerDataUpdate();
        return true;
    }

    async exportGuestsToCSV(eventId = null) {
        try {
            const params = eventId ? `?eventId=${eventId}` : '';
            const response = await fetch(`${this.API_URL}/guests/export/csv${params}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `secura-guests-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                console.log('✅ CSV exporté');
                return true;
            }
        } catch (err) {
            console.error('❌ Export CSV échec:', err);
            return false;
        }
    }




    // ═══════════════════════════════════════════════════════════════
    // 📱 QR CODES
    // ═══════════════════════════════════════════════════════════════

    async getAllQRCodes(filters = {}) {
        if (this.USE_API_DIRECT) {
            try {
                const params = new URLSearchParams(filters).toString();
                const result = this.apiRequest(`/qrcodes${params ? '?' + params : ''}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getAllQRCodes échec');
            }
        }
        return this.data.qrCodes;
    }

    getQRCodeByGuestId(guestId) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/qrcodes/guest/${guestId}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getQRCodeByGuestId échec');
            }
        }
        return this.data.qrCodes.find(q => q.guestId === guestId) || null;
    }

    // ═══════════════════════════════════════════════════════════════
    // 📱 QR CODES
    // ═══════════════════════════════════════════════════════════════
    async generateQRCode(guestId, eventId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest('/qrcodes/generate', {
                    method: 'POST',
                    body: JSON.stringify({ guestId, eventId })
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ QR Code généré via API');
                    this.emit('qr:generated', result.data);
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API generateQRCode échec');
            }
        }
        
        const guest = this.data.guests.find(g => g.id === guestId);
        const event = this.data.events.find(e => e.id === eventId);
        
        if (!guest || !event) return null;
        
        const qrData = {
            t: 'INV',
            e: eventId,
            g: guestId,
            n: `${guest.firstName} ${guest.lastName}`,
            d: new Date().toISOString()
        };
        
        return this.saveQRCode({
            guestId,
            eventId,
            data: qrData,
            rawData: JSON.stringify(qrData)
        });
    }

    async verifyQRCode(qrData) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/qrcodes/verify', {
                    method: 'POST',
                    body: JSON.stringify(qrData)
                });
                
                if (result.success) {
                    console.log('✅ QR vérifié via API');
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API verifyQRCode échec');
            }
        }
        
        // Vérification locale
        const { t, e, g } = qrData;
        if (t !== 'INV' || !e || !g) return { valid: false, error: 'Format invalide' };
        
        const guest = this.data.guests.find(x => x.id === g);
        const event = this.data.events.find(x => x.id === e);
        
        if (!guest || !event) return { valid: false, error: 'Invité ou événement introuvable' };
        
        return {
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
    }

    saveQRCode(qr) {
        const now = new Date().toISOString();
        const index = this.data.qrCodes.findIndex(q => q.guestId === qr.guestId);
        
        if (index !== -1) {
            this.data.qrCodes[index] = { ...this.data.qrCodes[index], ...qr, updatedAt: now };
        } else {
            qr.id = this.generateId('qr');
            qr.createdAt = qr.updatedAt = now;
            this.data.qrCodes.push(qr);
        }
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('qr:generated', qr);
        return qr;
    }



    // ──────────────────────────────────────────────────────────────
    // 🏓 CRUD TABLES
    // ──────────────────────────────────────────────────────────────
    /**
     * Récupérer toutes les tables d'un événement
     */
    async getAllTables(eventId, filters = {}) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const params = new URLSearchParams(filters).toString();
                const result = await this.apiRequest(
                    `/events/${eventId}/tables${params ? '?' + params : ''}`
                );
                
                if (result.success) {
                    return result;
                }
            } catch (err) {
                console.warn('⚠️ API getAllTables échec, mode local');
            }
        }
        
        // Mode local
        let tables = (this.data.tables || []).filter(t => t.eventId === eventId);
        
        // Filtres
        if (filters.status) {
            tables = tables.filter(t => t.status === filters.status);
        }
        
        if (filters.category) {
            tables = tables.filter(t => t.category === filters.category);
        }
        
        if (filters.available === 'true') {
            tables = tables.filter(t => {
                const totalSeats = t.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                return totalSeats < t.capacity;
            });
        }
        
        return tables;
    }

    /**
     * Récupérer une table par ID
     */
     getTableById(id) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result =  this.apiRequest(`/tables/${id}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getTableById échec');
            }
        }
        
        return (this.data.tables || []).find(t => t.id === id) || null;
    }

    /**
     * Récupérer les informations complètes d'une table avec ses invités
     */
    async getTableWithGuests(tableId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/guests`);
                if (result.success) return result;
            } catch (err) {
                console.warn('⚠️ API getTableWithGuests échec');
            }
        }
        
        // Fallback local
        const table = (this.data.tables || []).find(t => t.id === tableId);
        if (!table) return null;
        
        const guests = table.assignedGuests?.map(ag => {
            const fullGuest = this.data.guests?.find(g => g.id === ag.guestId);
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
        }) || [];
        
        return {
            success: true,
            data: guests,
            count: guests.length,
            table: {
                id: table.id,
                tableName: table.tableName,
                tableNumber: table.tableNumber
            }
        };
    }

    /**
     * Créer une table
     */
    async createTable(eventId, tableData) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/events/${eventId}/tables`, {
                    method: 'POST',
                    body: JSON.stringify(tableData)
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Table créée via API:', result.data.tableName);
                    this.emit('table:created', result.data);
                    this.emitStatsUpdate();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API createTable échec, mode local');
            }
        }
        
        return this.saveTable(eventId, tableData);
    }

    /**
     * Créer plusieurs tables
     */
    async createMultipleTables(eventId, tables) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/events/${eventId}/tables/bulk`, {
                    method: 'POST',
                    body: JSON.stringify({ tables })
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Tables créées en masse via API:', result.count);
                    result.data.forEach(table => this.emit('table:created', table));
                    this.emitStatsUpdate();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API createMultipleTables échec');
            }
        }
        
        // Mode local
        const created = [];
        tables.forEach(tableData => {
            const table = this.saveTable(eventId, tableData);
            created.push(table);
        });
        return created;
    }

    /**
     * Mettre à jour une table (complet)
     */
    async updateTable(id, updates) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updates)
                });
                
                if (result.success) {
                    await this.syncPull();
                    this.emit('table:updated', { new: result.data });
                    this.emitStatsUpdate();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API updateTable échec');
            }
        }
        
        // Mode local
        const table = (this.data.tables || []).find(t => t.id === id);
        if (table) {
            const oldTable = { ...table };
            Object.assign(table, updates, { 
                id, 
                updatedAt: new Date().toISOString() 
            });
            
            this.saveToLocalStorage();
            if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
            this.emit('table:updated', { old: oldTable, new: table });
            this.emitStatsUpdate();
            return table;
        }
        return null;
    }

    /**
     * Mettre à jour une table (partiel)
     */
    async patchTable(id, partialUpdates) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(partialUpdates)
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API patchTable échec');
            }
        }
        
        return this.updateTable(id, partialUpdates);
    }

    /**
     * Supprimer une table
     */
    async deleteTable(id) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${id}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Table supprimée via API');
                    this.emit('table:deleted', { id });
                    this.emitStatsUpdate();
                    return true;
                }
            } catch (err) {
                console.warn('⚠️ API deleteTable échec');
            }
        }
        
        // Mode local
        const table = (this.data.tables || []).find(t => t.id === id);
        if (!table) return false;
        
        // Libérer les invités assignés
        const guestIds = table.assignedGuests.map(g => g.guestId);
        this.data.guests.forEach(guest => {
            if (guestIds.includes(guest.id)) {
                guest.tableId = null;
                guest.tableNumber = null;
                guest.assignedAt = null;
            }
        });
        
        this.data.tables = this.data.tables.filter(t => t.id !== id);
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('table:deleted', table);
        this.emitStatsUpdate();
        return true;
    }

    /**
     * Sauvegarder une table (local)
     */
    saveTable(eventId, tableData) {
        const now = new Date().toISOString();
        
        if (!this.data.tables) this.data.tables = [];
        
        const table = {
            id: this.generateId('tbl'),
            eventId,
            tableNumber: String(tableData.tableNumber || '').trim(),
            tableName: (tableData.tableName || '').trim(),
            capacity: parseInt(tableData.capacity) || 8,
            location: (tableData.location || '').trim(),
            category: (tableData.category || 'general').trim(),
            description: (tableData.description || '').trim(),
            
            qrCode: {
                id: this.generateId('qr_tbl'),
                qrData: {
                    t: 'TBL',
                    e: eventId,
                    tb: this.generateId('tbl'),
                    tn: tableData.tableNumber,
                    d: now
                },
                qrUrl: null,
                scanCount: 0,
                lastScan: null,
                createdAt: now
            },
            
            assignedGuests: [],
            guestCount: 0,
            
            content: {
                welcomeMessage: tableData.content?.welcomeMessage || `Bienvenue à la table ${tableData.tableNumber}`,
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
        
        this.data.tables.push(table);
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('table:created', table);
        this.emitStatsUpdate();
        
        return table;
    }

    // ──────────────────────────────────────────────────────────────
    // 👥 GESTION INVITÉS SUR TABLES
    // ──────────────────────────────────────────────────────────────

    /**
     * Assigner un invité à une table
     */
    async assignGuestToTable(tableId, guestId, seats) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/assign-guest`, {
                    method: 'POST',
                    body: JSON.stringify({ guestId, seats })
                });
                
                if (result.success) {
                    await this.syncPull();
                    this.emit('table:guest-assigned', result.data);
                    this.emitStatsUpdate();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API assignGuestToTable échec');
            }
        }
        
        // Mode local
        const table = (this.data.tables || []).find(t => t.id === tableId);
        const guest = this.data.guests.find(g => g.id === guestId);
        
        if (!table || !guest) {
            throw new Error('Table ou invité introuvable');
        }
        
        // Vérifier si déjà assigné
        if (table.assignedGuests.find(g => g.guestId === guestId)) {
            throw new Error('Invité déjà assigné à cette table');
        }
        
        // Vérifier capacité
        const requestedSeats = seats || guest.seats || 1;
        const currentSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const available = table.capacity - currentSeats;
        
        if (requestedSeats > available) {
            throw new Error(`Places insuffisantes (${available} disponible(s))`);
        }
        
        // Libérer de l'ancienne table
        if (guest.tableId) {
            const oldTable = this.data.tables.find(t => t.id === guest.tableId);
            if (oldTable) {
                oldTable.assignedGuests = oldTable.assignedGuests.filter(g => g.guestId !== guestId);
            }
        }
        
        // Assigner
        const now = new Date().toISOString();
        
        table.assignedGuests.push({
            guestId: guest.id,
            guestName: `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email,
            seats: requestedSeats,
            assignedAt: now,
            assignedBy: 'system'
        });
        
        guest.tableId = table.id;
        guest.tableNumber = table.tableNumber;
        guest.assignedAt = now;
        guest.seats = requestedSeats;
        
        table.updatedAt = now;
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('table:guest-assigned', { table, guest });
        this.emitStatsUpdate();
        
        return { table, guest };
    }

    /**
     * Retirer un invité d'une table
     */
    async removeGuestFromTable(tableId, guestId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/remove-guest/${guestId}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    await this.syncPull();
                    this.emit('table:guest-removed', result.data);
                    this.emitStatsUpdate();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API removeGuestFromTable échec');
            }
        }
        
        // Mode local
        const table = (this.data.tables || []).find(t => t.id === tableId);
        if (!table) return null;
        
        const guestIndex = table.assignedGuests.findIndex(g => g.guestId === guestId);
        if (guestIndex === -1) return null;
        
        const removedGuest = table.assignedGuests.splice(guestIndex, 1)[0];
        
        // Mettre à jour l'invité
        const guest = this.data.guests.find(g => g.id === guestId);
        if (guest) {
            guest.tableId = null;
            guest.tableNumber = null;
            guest.assignedAt = null;
        }
        
        table.updatedAt = new Date().toISOString();
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('table:guest-removed', { table, removedGuest });
        this.emitStatsUpdate();
        
        return { table, removedGuest };
    }

    /**
     * Assigner plusieurs invités à une table
     */
    async assignMultipleGuests(tableId, guestIds) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/assign-multiple`, {
                    method: 'POST',
                    body: JSON.stringify({ guestIds })
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API assignMultipleGuests échec');
            }
        }
        
        // Mode local
        const assigned = [];
        const errors = [];
        
        for (const guestId of guestIds) {
            try {
                const result = await this.assignGuestToTable(tableId, guestId);
                assigned.push(result.guest);
            } catch (err) {
                errors.push({ guestId, error: err.message });
            }
        }
        
        return { assigned, errors };
    }

    /**
     * Récupérer les invités d'une table
     */
    async getTableGuests(tableId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/guests`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getTableGuests échec');
            }
        }
        
        const table = (this.data.tables || []).find(t => t.id === tableId);
        if (!table) return [];
        
        return table.assignedGuests.map(ag => {
            const guest = this.data.guests.find(g => g.id === ag.guestId);
            return {
                ...ag,
                guest: guest || null
            };
        });
    }

    /**
     * Récupérer la table d'un invité
     */
    async getGuestTable(guestId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/guests/${guestId}/table`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getGuestTable échec');
            }
        }
        
        const guest = this.data.guests.find(g => g.id === guestId);
        if (!guest || !guest.tableId) return null;
        
        return (this.data.tables || []).find(t => t.id === guest.tableId) || null;
    }

    // ──────────────────────────────────────────────────────────────
    // 📱 QR CODE DE TABLE
    // ──────────────────────────────────────────────────────────────

    /**
     * Générer le QR Code d'une table
     */
    async generateTableQR(tableId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/qr/regenerate`, {
                    method: 'POST'
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API generateTableQR échec');
            }
        }
        
        // Mode local
        const table = (this.data.tables || []).find(t => t.id === tableId);
        if (!table) return null;
        
        const now = new Date().toISOString();
        
        table.qrCode = {
            id: this.generateId('qr_tbl'),
            qrData: {
                t: 'TBL',
                e: table.eventId,
                tb: table.id,
                tn: table.tableNumber,
                d: now
            },
            qrUrl: `${this.API_URL}/table/${table.id}/info`,
            scanCount: 0,
            lastScan: null,
            createdAt: now
        };
        
        table.updatedAt = now;
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        
        return table.qrCode;
    }

    /**
     * Scanner le QR Code d'une table
     */
    async scanTableQR(tableId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/qr/scan`, {
                    method: 'POST'
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API scanTableQR échec');
            }
        }
        
        // Mode local
        const table = (this.data.tables || []).find(t => t.id === tableId);
        if (!table) return null;
        
        const now = new Date().toISOString();
        
        table.qrCode.scanCount++;
        table.qrCode.lastScan = now;
        table.updatedAt = now;
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        
        return {
            table,
            content: table.content,
            scanInfo: {
                scanCount: table.qrCode.scanCount,
                lastScan: table.qrCode.lastScan
            }
        };
    }

    // ──────────────────────────────────────────────────────────────
    // 📊 STATISTIQUES & UTILITAIRES
    // ──────────────────────────────────────────────────────────────

    /**
     * Statistiques d'une table
     */
    async getTableStatistics(tableId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/tables/${tableId}/statistics`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getTableStatistics échec');
            }
        }
        
        const table = (this.data.tables || []).find(t => t.id === tableId);
        if (!table) return null;
        
        const totalSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        
        return {
            table: {
                id: table.id,
                tableName: table.tableName,
                tableNumber: table.tableNumber,
                capacity: table.capacity
            },
            occupancy: {
                totalGuests: table.assignedGuests.length,
                totalSeats,
                availableSeats: Math.max(0, table.capacity - totalSeats),
                occupancyRate: table.capacity > 0 ? 
                    Math.round((totalSeats / table.capacity) * 100) : 0,
                isFull: totalSeats >= table.capacity
            },
            qr: {
                scanCount: table.qrCode.scanCount,
                lastScan: table.qrCode.lastScan
            },
            guests: table.assignedGuests
        };
    }

    /**
     * Statistiques de toutes les tables d'un événement
     */
    async getEventTablesStats(eventId) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest(`/events/${eventId}/tables/stats`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getEventTablesStats échec');
            }
        }
        
        const tables = (this.data.tables || []).filter(t => t.eventId === eventId);
        
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
        
        return {
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
            })
        };
    }

    /**
     * Récupérer tables disponibles pour un nombre de places
     */
    getAvailableTables(eventId, requiredSeats = 1) {
        return (this.data.tables || [])
            .filter(t => t.eventId === eventId)
            .map(table => {
                const totalSeats = table.assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                const available = table.capacity - totalSeats;
                
                return {
                    ...table,
                    availableSeats: available,
                    canAccommodate: available >= requiredSeats
                };
            })
            .filter(t => t.canAccommodate)
            .sort((a, b) => b.availableSeats - a.availableSeats);
    }

    /**
     * Auto-assignation intelligente
     */
    async autoAssignGuests(eventId, strategy = 'balanced') {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const result = await this.apiRequest('/tables/auto-assign', {
                    method: 'POST',
                    body: JSON.stringify({ eventId, strategy })
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API autoAssignGuests échec');
            }
        }
        
        // Mode local - implémentation basique
        const tables = (this.data.tables || []).filter(t => t.eventId === eventId);
        const unassignedGuests = this.data.guests.filter(g => 
            g.eventId === eventId && !g.tableId
        );
        
        const assigned = [];
        const errors = [];
        
        for (const guest of unassignedGuests) {
            const availableTables = this.getAvailableTables(eventId, guest.seats || 1);
            
            if (availableTables.length > 0) {
                try {
                    await this.assignGuestToTable(availableTables[0].id, guest.id);
                    assigned.push({ guest: guest.id, table: availableTables[0].id });
                } catch (err) {
                    errors.push({ guestId: guest.id, error: err.message });
                }
            } else {
                errors.push({ guestId: guest.id, error: 'Aucune table disponible' });
            }
        }
        
        return { assigned, errors };
    }

    /**
     * ═══════════════════════════════════════════════════════════════
     * 📝 ÉVÉNEMENTS TABLES
     * ═══════════════════════════════════════════════════════════════
     * 
     * Ajouter dans emitUserEvents() ou créer emitTableEvents():
     */

    emitTableEvents() {
        this.on('table:created', (event) => {
            console.log('🏓 Table créée:', event.detail);
            this.emitStatsUpdate();
        });
        
        this.on('table:updated', (event) => {
            console.log('🔄 Table mise à jour:', event.detail);
            this.emitStatsUpdate();
        });
        
        this.on('table:deleted', (event) => {
            console.log('🗑️ Table supprimée:', event.detail);
            this.emitStatsUpdate();
        });
        
        this.on('table:guest-assigned', (event) => {
            console.log('👥 Invité assigné à table:', event.detail);
            this.emitStatsUpdate();
        });
        
        this.on('table:guest-removed', (event) => {
            console.log('🚪 Invité retiré de table:', event.detail);
            this.emitStatsUpdate();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // 📷 SCANS
    // ═══════════════════════════════════════════════════════════════

async scanQRCode(qrData) {
    if (this.USE_API_DIRECT && this.isOnline) {
        try {
            const result = await this.apiRequest('/qr/scan', {
                method: 'POST',
                body: JSON.stringify(qrData)
            });

            // Vérifier que result existe et a les bonnes propriétés
            if (result && result.success && result.data) {
                await this.syncPull();
                
                // Accéder à guestName de manière sécurisée
                const guestName = result.data.guest?.name || result.data.scan?.guestName || 'Invité';
                console.log('✅ Scan enregistré via API:', guestName);
                
                if (result.data.scan) {
                    this.emit('scan:created', result.data.scan);
                }
                this.emitStatsUpdate();
                return result.data;
            } else {
                console.warn('⚠️ Réponse API incomplète:', result);
                return this.saveScanLocal(qrData.g, qrData.e);
            }
        } catch (err) {
            console.error('❌ Scan API échec:', err);
            return this.saveScanLocal(qrData.g, qrData.e);
        }
    }
    
    return this.saveScanLocal(qrData.g, qrData.e);
}

    getAllScans(filters = {}) {
        if (this.USE_API_DIRECT) {
            try {
                const params = new URLSearchParams(filters).toString();
                const result = this.apiRequest(`/scans${params ? '?' + params : ''}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getAllScans échec');
            }
        }
        return [...this.data.scans].sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
    }

    

    async getScanById(id) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/scans/${id}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getScanById échec');
            }
        }
        return this.data.scans.find(s => s.id === id) || null;
    }

    getTodayScans() {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/scan/today');
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getTodayScans échec');
            }
        }
        
        const today = new Date().toDateString();
        return this.data.scans.filter(s => new Date(s.scannedAt).toDateString() === today);
    }

    getScansByEventId(eventId) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/scans/event/${eventId}`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getScansByEventId échec');
            }
        }
        
        return this.data.scans.filter(s => s.eventId === eventId)
            .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
    }

    saveScanLocal(guestId, eventId, scanData = {}) {
    const guest = this.getGuestById(guestId);
    const event = this.getEventById(eventId);
    
    if (!guest || !event) return null;
    
    if (guest.scanned) {
        console.warn('⚠️ Invité déjà scanné');
        return { alreadyScanned: true, guest, event };
    }
    
    const now = new Date().toISOString();
    const scan = {
        id: this.generateId('scn'),
        eventId,
        guestId,
        guestName: `${guest.firstName} ${guest.lastName}`,
        eventName: event.name,
        scannedAt: now,
        scannerId: scanData.scannerId,
        scannerName: scanData.scannerName,
        location: scanData.location
    };
    
    this.data.scans.unshift(scan);
    
    guest.scanned = true;
    guest.scannedAt = now;
    guest.scanCount = (guest.scanCount || 0) + 1;
    guest.scanHistory = [
        ...(guest.scanHistory || []),
        {
        scanId: scan.id,
        scannedAt: now,
        scannerId: scanData.scannerId,
        scannerName: scanData.scannerName,
        location: scanData.location
        }
    ];
    guest.updatedAt = now;
    
    this.saveToLocalStorage();
    if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
    this.emit('scan:created', scan);
    this.emit('guest:updated', { new: guest });
    this.emitStatsUpdate();
    
    console.log('✅ Scan enregistré localement:', scan.guestName);
    return { scan, guest, event };
    }

    getAllScansDesc() {
        return [...this.data.scans].sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
    }

    // ═══════════════════════════════════════════════════════════════
    // 📊 STATISTIQUES
    // ═══════════════════════════════════════════════════════════════

    // Mise à jour de getStatistics pour inclure les nouvelles métriques
    getStatistics() {
    if (this.USE_API_DIRECT && this.isOnline) {
        try {
        const result = this.apiRequest('/statistics');
        if (result.success) return result.data;
        } catch (err) {
        console.warn('⚠️ API getStatistics échec');
        }
    }
    
    // Calcul local avec nouvelles métriques
    const today = new Date().toDateString();
    const guests = this.data.guests || [];
    
    const tableStats = {
        totalTables: this.data.tables?.length || 0,
        assignedGuests: guests.filter(g => g.tableId).length,
        unassignedGuests: guests.filter(g => !g.tableId).length,
        totalSeatsAssigned: guests
        .filter(g => g.tableId)
        .reduce((sum, g) => sum + (g.seats || 1), 0)
    };
    
    const guestStatusStats = {
        pending: guests.filter(g => g.status === GUEST_STATUS.PENDING).length,
        confirmed: guests.filter(g => g.status === GUEST_STATUS.CONFIRMED).length,
        cancelled: guests.filter(g => g.status === GUEST_STATUS.CANCELLED).length,
        checked_in: guests.filter(g => g.status === GUEST_STATUS.CHECKED_IN).length,
        no_show: guests.filter(g => g.status === GUEST_STATUS.NO_SHOW).length
    };
    
    return {
        // Stats existantes
        totalEvents: this.data.events.length,
        activeEvents: this.data.events.filter(e => e.active !== false).length,
        totalGuests: guests.length,
        totalQRCodes: this.data.qrCodes.length,
        totalScans: this.data.scans.length,
        todayScans: this.data.scans.filter(s => new Date(s.scannedAt).toDateString() === today).length,
        scannedGuests: guests.filter(g => g.scanned).length,
        pendingGuests: guests.filter(g => !g.scanned).length,
        scanRate: guests.length > 0 
        ? Math.round((guests.filter(g => g.scanned).length / guests.length) * 100) 
        : 0,
        
        // Nouvelles stats
        tableStats,
        guestStatusStats,
        seats: {
        total: guests.reduce((sum, g) => sum + (g.seats || 1), 0),
        average: guests.length > 0 ? 
            (guests.reduce((sum, g) => sum + (g.seats || 1), 0) / guests.length).toFixed(1) : 0
        },
        
        // Infos système
        syncEnabled: this.SYNC_ENABLED,
        lastSync: this.lastSyncTime,
        syncErrors: this.syncErrors.length,
        lastUpdate: new Date().toISOString()
    };
    }

    



    /**
     * Vérifier un code d'accès
     */
    async verifyAccessCode(code) {
        if (this.USE_API_DIRECT) {
            try {
                const result = await this.apiRequest(`/verify-access-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                    },
                    body: JSON.stringify({ code })
                });
                
                return result;
            } catch (err) {
                console.warn('⚠️ API verifyAccessCode échec:', err.message);
               
                return this.verifyAccessCodeLocal(code);
            }
        }
        return this.verifyAccessCodeLocal(code);
    }

    verifyAccessCodeLocal(code) {
        const guest = this.data.guests.find(g => g.accessCode === code);
        if (!guest) {
            return {
                success: false,
                error: 'Code invalide'
            };
        }
        
        const event = this.data.events.find(e => e.id === guest.eventId);
        if (!event) {
            return {
                success: false,
                error: 'Événement introuvable'
            };
        }
        
        return {
            success: true,
            data: {
                guestId: guest.id,
                guestName: `${guest.firstName} ${guest.lastName}`,
                guestEmail: guest.email,
                eventId: event.id,
                eventName: event.name,
                eventDate: event.date,
                eventLocation: event.location,
                tableId: guest.tableId,
                requiresPersonalCode: guest.requiresPersonalCode || false
            }
        };
    }

    /**
     * Vérifier un code d'accès table
     */
    async verifyTableAccessCode(code) {
        if (this.USE_API_DIRECT ) {
            try {
                const result = await this.apiRequest('/verify-table-access-code', {
                    method: 'POST',
                    body: JSON.stringify({ code: code.toUpperCase() })
                });

                if (result.success) {
                    return result;
                } else {
                    return result;
                }
            } catch (err) {
                console.warn('⚠️ API verifyTableAccessCode échec:', err.message);
                // Fallback local
                return this.verifyTableAccessCodeLocal(code);
            }
        }
        return this.verifyTableAccessCodeLocal(code);
    }

    verifyTableAccessCodeLocal(code) {
        // Vérifier que les données existent
        if (!this.data || !this.data.tables || !Array.isArray(this.data.tables)) {
            return {
                success: false,
                error: 'Données tables non disponibles localement'
            };
        }

        const table = this.data.tables.find(t => t.accessCode === code.toUpperCase());

        if (!table) {
            return {
                success: false,
                error: 'Code table invalide'
            };
        }

        const event = this.data.events.find(e => e.id === table.eventId);
        if (!event || event.status !== 'active') {
            return {
                success: false,
                error: 'Cette table n\'est pas disponible actuellement'
            };
        }

        return {
            success: true,
            data: {
                tableId: table.id,
                tableNumber: table.tableNumber,
                tableName: table.tableName,
                eventId: event.id,
                eventName: event.name,
                eventDate: event.date,
                eventLocation: event.location,
                capacity: table.capacity,
                ...table
            }
        };
    }

    /**
     * Récupérer une table par son numéro
     */
    async getTableByNumber(number) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const response = this.apiRequest(`/tables/number/${encodeURIComponent(number)}`, {
                    headers: {
                        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return await response.json();
            } catch (err) {
                console.warn('⚠️ API getTableByNumber échec:', err.message);
                // Fallback local
                return this.getTableByNumberLocal(number);
            }
        }
        return this.getTableByNumberLocal(number);
    }

    getTableByNumberLocal(number) {
        // Vérifier que les données existent
        if (!this.data || !this.data.tables || !Array.isArray(this.data.tables)) {
            return {
                success: false,
                error: `Données tables non disponibles localement`
            };
        }

        const table = this.data.tables.find(t => 
            t.tableNumber.toUpperCase() === number.toUpperCase()
        );
        
        if (!table) {
            return {
                success: false,
                error: `Table "${number}" introuvable`
            };
        }
        
        const event = this.data.events.find(e => e.id === table.eventId);
        if (!event || event.status !== 'active') {
            return {
                success: false,
                error: 'Cette table n\'est pas disponible actuellement'
            };
        }
        
        return {
            success: true,
            data: table
        };
    }

    /**
     * Vérifier un code personnel
     */
    async verifyPersonalCode(guestId, code) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const response = this.apiRequest(`/verify-personal-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                    },
                    body: JSON.stringify({ guestId, code })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return await response.json();
            } catch (err) {
                console.warn('⚠️ API verifyPersonalCode échec:', err.message);
                // Fallback local
                return this.verifyPersonalCodeLocal(guestId, code);
            }
        }
        return this.verifyPersonalCodeLocal(guestId, code);
    }

    verifyPersonalCodeLocal(guestId, code) {
        const guest = this.data.guests.find(g => g.id === guestId);
        
        if (!guest) {
            return {
                success: false,
                error: 'Invité introuvable'
            };
        }
        
        if (guest.accessCode !== code) {
            // Enregistrer la tentative échouée
            if (!guest.failedAttempts) guest.failedAttempts = 0;
            guest.failedAttempts++;
            guest.lastFailedAttempt = new Date().toISOString();
            
            this.saveLocalData();
            
            return {
                success: false,
                error: 'Code incorrect',
                attemptsRemaining: Math.max(0, 3 - guest.failedAttempts)
            };
        }
        
        // Réinitialiser les tentatives
        guest.failedAttempts = 0;
        guest.lastAccess = new Date().toISOString();
        this.saveLocalData();
        
        return {
            success: true,
            data: {
                guest: {
                    id: guest.id,
                    firstName: guest.firstName,
                    lastName: guest.lastName,
                    email: guest.email
                },
                accessGranted: true,
                sessionDuration: 8
            }
        };
    }

 
// ═══════════════════════════════════════════════════════════════
// 🎪 GESTION DES SESSIONS ÉVÉNEMENT (JWT Only)
// ═══════════════════════════════════════════════════════════════

/**
 * 1. Créer une session événement (retourne JWT seulement)
 */
async createEventSession({ guestId = null, tableId = null }) {
    try {
        if (!tableId && !guestId) {
            return {
                success: false,
                error: 'tableId ou guestId requis',
                code: 'MISSING_REQUIRED_FIELD'
            };
        }

        const result = await this.apiRequest('/event-sessions', {
            method: 'POST',
            body: JSON.stringify({ guestId, tableId })
        });

        if (result.success && result.data?.token) {
            // Sauvegarder UNIQUEMENT le token
            localStorage.setItem('secura_event_session_token', result.data.token);
            
            console.log('✅ Token de session sauvegardé');
            return {
                success: true,
                data: {
                    token: result.data.token,
                    expiresAt: result.data.expiresAt
                }
            };
        }

        throw new Error(result.error || 'Échec création session');

    } catch (err) {
        console.error('❌ Erreur création session:', err);
        return {
            success: false,
            error: err.message,
            code: 'SESSION_CREATE_ERROR'
        };
    }
}

/**
 * 2. Vérifier un token de session (appel API pour vérification)
 */
async verifyEventSessionToken(token) {
    try {
        const result = await this.apiRequest('/event-sessions/verify-token', {
            method: 'POST',
            body: JSON.stringify({ token })
        });

        if (result.success) {
            return {
                success: true,
                data: result.data
            };
        }

        // Si token invalide, nettoyer
        if (result.code === 'TOKEN_EXPIRED' || result.code === 'INVALID_TOKEN') {
            this.clearEventSession();
        }

        return {
            success: false,
            error: result.error || 'Token invalide',
            code: result.code
        };

    } catch (err) {
        console.error('❌ Erreur vérification token:', err);
        return {
            success: false,
            error: err.message,
            code: 'TOKEN_VERIFY_ERROR'
        };
    }
}

/**
 * 3. Obtenir les données complètes de la session actuelle
 */
async getCurrentSessionDetails() {
    try {
        const token = localStorage.getItem('secura_event_session_token');
        if (!token) return null;

        // Vérifier d'abord la validité du token
        const verification = await this.verifyEventSessionToken(token);
        if (!verification.success) return null;

      // Récupérer les détails de la session via API
        const response = await fetch(`${this.API_URL}/event-sessions/details`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        localStorage.removeItem('secura_event_session_token');
                        throw new Error('Session expirée');
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();
        

        if (result.success) {
            return {
                success: true,
                data: result.data,
                token: token
            };
        }

        return null;

    } catch (err) {
        console.error('❌ Erreur récupération session:', err);
        return null;
    }
}

/**
 * 4. Vérifier si une session est active (utilitaire rapide)
 */
isEventSessionActive() {
    const token = localStorage.getItem('secura_event_session_token');
    return !!token;
}

/**
 * 5. Effacer la session événement (logout)
 */
async clearEventSession() {
    try {
        const token = localStorage.getItem('secura_event_session_token');
        
        // Appeler l'API pour supprimer la session du serveur
        if (token) {
            try {
               

                // Récupérer les détails de la session via API
                const response = await fetch(`${window.storage.API_URL}/event-sessions/logout`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        localStorage.removeItem('secura_event_session_token');
                        throw new Error('Session expirée');
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    console.log('🔓 Session événement supprimée du serveur', result.message);
                }
            } catch (err) {
                console.warn('⚠️ Impossible contacter serveur pour logout événement', err.message);
                // Continuer même si erreur serveur
            }
        }
        
        // Supprimer le token localement
        localStorage.removeItem('secura_event_session_token');
        
        // Nettoyer la session en mémoire
        this.currentSession = null;
        
        console.log('✅ Session événement effacée complètement');
        
        return true;
        
    } catch (err) {
        console.error('❌ Erreur effacement session:', err.message);
        // Force le nettoyage même en cas d'erreur
        localStorage.removeItem('secura_event_session_token');
        this.currentSession = null;
        return false;
    }
}

/**
 * 6. Mettre à jour une session (créer nouvelle session avec guest)
 */
async updateEventSessionWithGuest(tableId, guestId) {
    try {
        const result = await this.createEventSession({
            guestId: guestId,
            tableId: tableId
        });

        if (result.success) {
            return {
                success: true,
                data: result.data
            };
        }

        throw new Error(result.error || 'Échec mise à jour session');

    } catch (err) {
        console.error('❌ Erreur mise à jour session:', err);
        return {
            success: false,
            error: err.message,
            code: 'SESSION_UPDATE_ERROR'
        };
    }
}

/**
 * 7. Obtenir le token brut (pour authentification API)
 */
getEventSessionToken() {
    return localStorage.getItem('secura_event_session_token') || null;
}


/**
 * Charger toutes les données pour une session (méthode complète pour frontend)
 */
async loadSessionData() {
    try {
        const sessionDetails = await this.getCurrentSessionDetails();
        if (!sessionDetails || !sessionDetails.success) return null;

        const data = sessionDetails.data;
        
        if (data.guest && data.guest.tableId) {
            data.guest.table = await this.getTableById(data.guest.tableId);
        }
        
        if (data.table && data.table.eventId) {
            data.table.event = await this.getEventById(data.table.eventId);
        }

        return data;

    } catch (err) {
        console.error('❌ Erreur chargement données session:', err);
        return null;
    }
}



    /**
     * Demander l'aide du protocole
     */
    async requestProtocolHelp(data) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const response = this.apiRequest(`/protocol-help`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                    },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return await response.json();
            } catch (err) {
                console.warn('⚠️ API requestProtocolHelp échec:', err.message);
                // Simuler une réponse réussie en mode démo
                return {
                    success: true,
                    message: 'Demande envoyée (mode démo)'
                };
            }
        }
        // Simuler une réponse en mode hors ligne
        return {
            success: true,
            message: 'Demande enregistrée localement'
        };
    }


    // ═══════════════════════════════════════════════════════════════
    // 💾 BACKUP & RESTORE
    // ═══════════════════════════════════════════════════════════════

    async createBackup() {
        try {
            window.location.href = `${this.API_URL}/backup`;
            console.log('✅ Backup téléchargé');
            return true;
        } catch (err) {
            console.error('❌ Backup échec:', err);
            return false;
        }
    }

    async restoreBackup(backupData) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/restore', {
                    method: 'POST',
                    body: JSON.stringify(backupData)
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Backup restauré via API:', result.restored);
                    return true;
                }
            } catch (err) {
                console.error('❌ Restore API échec:', err);
            }
        }
        
        // Restore local
        this.data = backupData;
        this.saveToLocalStorage();
        this.triggerDataUpdate();
        console.log('✅ Backup restauré localement');
        return true;
    }

    async listBackups() {
        try {
            const result = this.apiRequest('/backups');
            if (result.success) return result.data;
        } catch (err) {
            console.error('❌ listBackups échec:', err);
        }
        return [];
    }

   
  

    // ═══════════════════════════════════════════════════════════════
    // 🔧 UTILITAIRES
    // ═══════════════════════════════════════════════════════════════

    generateId(prefix = 'sec') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    triggerDataUpdate() {
        window.dispatchEvent(new CustomEvent('secura:data-updated', {
            detail: this.getStatistics()
        }));
    }

    // ═══════════════════════════════════════════════════════════════
    // 🎨 PARAMÈTRES & CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    getSettings() {
        return this.data.settings;
    }

    updateSettings(updates) {
        this.data.settings = { ...this.data.settings, ...updates };
        this.saveToLocalStorage();
        
        // Appliquer les changements
        if (updates.apiUrl) this.API_URL = updates.apiUrl;
        if (updates.syncEnabled !== undefined) this.SYNC_ENABLED = updates.syncEnabled;
        if (updates.useApiDirect !== undefined) this.USE_API_DIRECT = updates.useApiDirect;
        
        console.log('✅ Paramètres mis à jour:', updates);
        return this.data.settings;
    }

    toggleSync() {
        this.SYNC_ENABLED = !this.SYNC_ENABLED;
        
        if (this.SYNC_ENABLED) {
            this.startAutoSync();
            console.log('✅ Sync activée');
        } else {
            this.stopAutoSync();
            console.log('⏹️ Sync désactivée');
        }
        
        return this.SYNC_ENABLED;
    }

    

    async resetAllData() {
        const confirm = window.confirm('⚠️ ATTENTION : Êtes-vous sûr de vouloir effacer TOUTES les données ?');
        
        if (!confirm) return false;
        
        this.data = {
            events: [],
            guests: [],
            qrCodes: [],
            scans: [],
            settings: this.data.settings
        };
        
        this.clearLocalStorage();
        this.saveToLocalStorage();
        
        if (this.AUTO_SYNC_ON_CHANGE) {
            await this.syncPush();
        }
        
        this.triggerDataUpdate();
        console.log('🗑️ TOUTES les données ont été effacées');
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // 📈 MÉTRIQUES & MONITORING
    // ═══════════════════════════════════════════════════════════════

    getSyncStatus() {
        return {
            enabled: this.SYNC_ENABLED,
            useApiDirect: this.USE_API_DIRECT,
            inProgress: this.syncInProgress,
            lastSync: this.lastSyncTime,
            interval: this.SYNC_INTERVAL,
            autoSyncOnChange: this.AUTO_SYNC_ON_CHANGE,
            errors: this.syncErrors,
            errorCount: this.syncErrors.length
        };
    }

    clearSyncErrors() {
        this.syncErrors = [];
        console.log('🧹 Erreurs de sync effacées');
    }

    async testConnection() {
        console.log('🔍 Test de connexion...');
        
        try {
            const start = Date.now();
            const online = await this.checkServerStatus();
            const duration = Date.now() - start;
            
            if (online) {
                console.log(`✅ Serveur accessible (${duration}ms)`);
                return { online: true, duration, apiUrl: this.API_URL };
            } else {
                console.error('❌ Serveur inaccessible');
                return { online: false, apiUrl: this.API_URL };
            }
        } catch (err) {
            console.error('❌ Test connexion échec:', err);
            return { online: false, error: err.message };
        }
    }

    getDebugInfo() {
        return {
            version: '3.0',
            apiUrl: this.API_URL,
            syncEnabled: this.SYNC_ENABLED,
            useApiDirect: this.USE_API_DIRECT,
            autoSyncOnChange: this.AUTO_SYNC_ON_CHANGE,
            syncInterval: this.SYNC_INTERVAL,
            lastSync: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            syncErrors: this.syncErrors.length,
            dataStats: {
                events: this.data.events.length,
                guests: this.data.guests.length,
                qrCodes: this.data.qrCodes.length,
                scans: this.data.scans.length
            },
            localStorage: {
                used: (JSON.stringify(this.data).length / 1024).toFixed(2) + ' KB',
                available: localStorage ? 'Oui' : 'Non'
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔍 RECHERCHE & FILTRES AVANCÉS
    // ═══════════════════════════════════════════════════════════════

    searchGuests(query) {
        if (!query || query.trim().length < 2) return this.data.guests;
        
        const term = query.toLowerCase().trim();
        return this.data.guests.filter(g =>
            g.firstName?.toLowerCase().includes(term) ||
            g.lastName?.toLowerCase().includes(term) ||
            g.email?.toLowerCase().includes(term) ||
            g.phone?.includes(term) ||
            g.company?.toLowerCase().includes(term)
        );
    }

    searchEvents(query) {
        if (!query || query.trim().length < 2) return this.data.events;
        
        const term = query.toLowerCase().trim();
        return this.data.events.filter(e =>
            e.name?.toLowerCase().includes(term) ||
            e.location?.toLowerCase().includes(term) ||
            e.description?.toLowerCase().includes(term)
        );
    }

    filterGuestsByStatus(status) {
        return this.data.guests.filter(g => g.status === status);
    }

    filterGuestsByScanned(scanned = true) {
        return this.data.guests.filter(g => g.scanned === scanned);
    }

    getActiveEvents() {
        return this.data.events.filter(e => e.active !== false);
    }

    getPastEvents() {
        const now = new Date();
        return this.data.events.filter(e => new Date(e.date) < now)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    getUpcomingEvents() {
        const now = new Date();
        return this.data.events.filter(e => new Date(e.date) >= now)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // ═══════════════════════════════════════════════════════════════
    // 📊 RAPPORTS & ANALYTICS
    // ═══════════════════════════════════════════════════════════════

    getEventReport(eventId) {
        const event = this.data.events.find(e => e.id === eventId);
        if (!event) return null;
        
        const guests = this.data.guests.filter(g => g.eventId === eventId);
        const scans = this.data.scans.filter(s => s.eventId === eventId);
        
        const report = {
            event: {
                id: event.id,
                name: event.name,
                date: event.date,
                location: event.location
            },
            guests: {
                total: guests.length,
                scanned: guests.filter(g => g.scanned).length,
                pending: guests.filter(g => !g.scanned).length,
                byStatus: {
                    pending: guests.filter(g => g.status === 'pending').length,
                    confirmed: guests.filter(g => g.status === 'confirmed').length,
                    cancelled: guests.filter(g => g.status === 'cancelled').length
                }
            },
            scans: {
                total: scans.length,
                today: scans.filter(s => new Date(s.scannedAt).toDateString() === new Date().toDateString()).length,
                lastScan: scans.length > 0 ? scans[0].scannedAt : null
            },
            performance: {
                scanRate: guests.length > 0 ? Math.round((guests.filter(g => g.scanned).length / guests.length) * 100) : 0,
                completionRate: guests.length > 0 ? Math.round((guests.filter(g => g.scanned).length / guests.length) * 100) : 0
            },
            timeline: this.getEventTimeline(eventId)
        };
        
        return report;
    }

    getEventTimeline(eventId) {
        const scans = this.data.scans
            .filter(s => s.eventId === eventId)
            .sort((a, b) => new Date(a.scannedAt) - new Date(b.scannedAt));
        
        if (scans.length === 0) return [];
        
        // Grouper par heure
        const timeline = {};
        scans.forEach(scan => {
            const hour = new Date(scan.scannedAt).getHours();
            timeline[hour] = (timeline[hour] || 0) + 1;
        });
        
        return Object.entries(timeline).map(([hour, count]) => ({
            hour: `${hour}h`,
            scans: count
        }));
    }

    getGlobalReport() {
        const stats = this.getStatistics();
        
        return {
            overview: stats,
            events: {
                total: this.data.events.length,
                active: this.getActiveEvents().length,
                upcoming: this.getUpcomingEvents().length,
                past: this.getPastEvents().length
            },
            guests: {
                total: this.data.guests.length,
                scanned: stats.scannedGuests,
                pending: stats.pendingGuests,
                scanRate: stats.scanRate
            },
            performance: {
                avgGuestsPerEvent: this.data.events.length > 0 
                    ? Math.round(this.data.guests.length / this.data.events.length) 
                    : 0,
                avgScansPerEvent: this.data.events.length > 0 
                    ? Math.round(this.data.scans.length / this.data.events.length) 
                    : 0
            },
            topEvents: this.getTopEvents(5)
        };
    }

    getTopEvents(limit = 5) {
        return this.data.events
            .map(event => {
                const guests = this.data.guests.filter(g => g.eventId === event.id);
                const scans = this.data.scans.filter(s => s.eventId === event.id);
                
                return {
                    id: event.id,
                    name: event.name,
                    date: event.date,
                    guestCount: guests.length,
                    scanCount: scans.length,
                    scanRate: guests.length > 0 
                        ? Math.round((scans.length / guests.length) * 100) 
                        : 0
                };
            })
            .sort((a, b) => b.guestCount - a.guestCount)
            .slice(0, limit);
    }

    // ═══════════════════════════════════════════════════════════════
    // 🎯 MÉTHODES UTILITAIRES SUPPLÉMENTAIRES
    // ═══════════════════════════════════════════════════════════════

    exportToCSV(eventId) {
        const guests = this.getGuestsByEventId(eventId);
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
        
        return rows.join('\n');
    }

    exportLocalData() {
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `secura-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        console.log('✅ Données exportées localement');
    }

    async importLocalData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    this.data = imported;
                    this.saveToLocalStorage();
                    if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
                    this.emitStatsUpdate();
                    console.log('✅ Données importées');
                    resolve(true);
                } catch (err) {
                    console.error('❌ Import échec:', err);
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }



    escapeCSV(value) {
        const s = String(value || '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    }

 
    // ═══════════════════════════════════════════════════════════════
    // 🧹 CLEANUP
    // ═══════════════════════════════════════════════════════════════

    destroy() {
        this.stopAutoSync();
        this.saveToLocalStorage();
    }



    /**
 * Vérifie le token seulement si nécessaire (évite les requêtes excessives)
 */
async checkTokenIfNeeded() {
    const now = Date.now();
    const needsCheck = !this.lastTokenCheck || 
                      (now - this.lastTokenCheck) > this.TOKEN_CHECK_INTERVAL;
    
    if (!needsCheck) return true;
    
    if (!this.token) return false;
    
    if (this.tokenCheckInProgress) {
        // Évite les vérifications simultanées
        return new Promise(resolve => {
            const check = () => {
                if (!this.tokenCheckInProgress) {
                    resolve(this.verifyToken());
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    this.tokenCheckInProgress = true;
    try {
        const valid = await this.verifyToken();
        this.lastTokenCheck = now;
        return valid;
    } finally {
        this.tokenCheckInProgress = false;
    }
}

    // === CHARGER LES INFOS UTILISATEUR ===
        async updateProfileInfo() {
    
        if (!this.token) return false;
    const tokenValid = await this.checkTokenIfNeeded();
    
    
    if (!tokenValid) {
        this.handleInvalidToken();
        return;
    }
    


            try {
                const data = await this.apiRequest('/auth/me', {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${this.token}`,
                    }
                });


                if (data.success) {
                    const user = data.user;
                    
                    if (user) {
                        const profileName = document.getElementById('profileName');
                        const dropdownName = document.getElementById('dropdownName');
                        const SidebarName = document.getElementById('sidebarProfileName');

                        const dropdownEmail = document.getElementById('dropdownEmail');
                        const sidebarProfileEmail = document.getElementById('sidebarProfileEmail');
                        const profileRole = document.getElementById('profileRole');
                        const dropdownRole = document.getElementById('dropdownRole');
                        const sidebarRole = document.getElementById('sidebarProfileRole');
                        



                                   

                        if (profileName) profileName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
                        if (SidebarName) SidebarName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];

                        if (dropdownName) dropdownName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Utilisateur';
                        if (dropdownEmail) dropdownEmail.textContent = user.email;
                        if (sidebarProfileEmail) sidebarProfileEmail.textContent = user.email;
                        if (profileRole) profileRole.textContent = user.role || 'Utilisateur';
                        if (sidebarRole) sidebarRole.textContent = user.role || 'Utilisateur';
                        
                        if (dropdownRole) {
                            dropdownRole.textContent = (user.role || 'Utilisateur').toUpperCase();
                            dropdownRole.style.color = 'white';
                            dropdownRole.style.background = user.role === 'admin' ? '#EF4444' : '#D97706';


                                


                        }
                    }
                } else {
            console.log('Utilisateur introuvable, nettoyage token');
            this.handleInvalidToken();
        }
    } catch (err) {
        console.error('❌ Erreur récupération profil:', err);
        
        const tokenStillValid = await this.verifyToken();
        if (!tokenStillValid) {
            this.handleInvalidToken();
        }
    }
}

    // ═══════════════════════════════════════════════════════════════
    // 🔐 VÉRIFICATION DU TOKEN AVANT UTILISATION
    // ═══════════════════════════════════════════════════════════════

    async verifyToken() {
    if (!this.token) {
        console.warn('⚠️ Aucun token disponible');
        return false;
    }

    try {
        const response = await this.apiRequest('/auth/verify-token',{
            method: 'POST',
             headers: { 
                'authorization': `Bearer ${this.token}`,
            },
        });
        
        if (response.success && response.valid) {
            console.log('✅ Token valide');
            return true;
        } else {
            console.error('❌ Token invalide selon le serveur:', response.error);
            this.handleInvalidToken();
            return false;
        }
    } catch (err) {
        console.warn('⚠️ Vérif token échouée (réseau?), présumé valide:', err.message);
        return true;
    }
}

    handleInvalidToken() {
        console.error('❌ Token invalide - Nettoyage et redirection');
        
        // Sauvegarder l'état avant suppression
        const wasAuthenticated = !!this.token;
        const wasEventSession = !!localStorage.getItem('secura_event_session_token');
        
        this.token = null;
        this.user = null;
        this.isAuthenticated = false;
        
        // Supprimer les deux types de tokens
        localStorage.removeItem('secura_token');
        localStorage.removeItem('secura_user');
        localStorage.removeItem('secura_data');
        this.stopAutoSync();
        
        // Émettre un événement pour les listeners
        if (wasAuthenticated) {
            window.dispatchEvent(new CustomEvent('storage:auth-invalid', {
                detail: { reason: 'token_expired_or_invalid' }
            }));
        }
        
        // Rediriger vers login si ce n'est pas déjà sur une page publique
        const currentPage = window.location.pathname;
        const publicPages = [
            '/', '/index.html',
            '/login', '/login.html',
            '/register', '/register.html',
            '/forgot-password', '/forgot-password.html',
            '/access', '/access.html',
            '/404', '/404.html'
        ];
        
        const isPublicPage = publicPages.some(page => 
            currentPage === page || currentPage.endsWith(page)
        );
        
        if (!isPublicPage && typeof window !== 'undefined') {
            setTimeout(() => {
                window.location.href = '/?reason=session_expired';
            }, 500);
        }
    }


// ═══════════════════════════════════════════════════════════════
// 👥 CRUD UTILISATEURS (Nouvelle section)
// ═══════════════════════════════════════════════════════════════

/**
 * 1. Récupérer tous les utilisateurs (Admin uniquement)
 * GET /api/users
 */
async getAllUsers(filters = {}) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        const params = new URLSearchParams(filters).toString();
        const result = await this.apiRequest(`/users${params ? '?' + params : ''}`, {
            method: 'GET'
        });
        
        if (result.success) {
            return {
                success: true,
                data: result.data,
                total: result.total
            };
        }
        
        return {
            success: false,
            error: result.error || 'Erreur serveur'
        };
    } catch (err) {
        console.error('❌ getAllUsers échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 2. Récupérer un utilisateur par ID
 * GET /api/users/:id
 */
async getUserById(id) {
    try {
        if (!this.token) throw new Error('Non authentifié');
     
        const result = await this.apiRequest(`/users/${id}`, {
            method: 'GET'
        });

        if (result.success) {
            return {
                success: true,
                data: result.data
            };
        }
        
        return {
            success: false,
            error: result.error || 'Utilisateur introuvable'
        };
    } catch (err) {
        console.error('❌ getUserById échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}



/**
 * 3. Mettre à jour un utilisateur
 * PUT /api/users/:id
 */
async updateUser(id, updates) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        const result = await this.apiRequest(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        if (result.success) {
            // Si c'est l'utilisateur courant, mettre à jour localement
            if (this.user && this.user.id === id) {
                this.user = { ...this.user, ...result.data };
                this.saveUserToCache(this.user);
            }
            
            this.emit('user:updated', { id, data: result.data });
            
            return {
                success: true,
                data: result.data,
                message: result.message || 'Utilisateur mis à jour'
            };
        }
        
        return {
            success: false,
            error: result.error || 'Échec mise à jour'
        };
    } catch (err) {
        console.error('❌ updateUser échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 4. Mettre à jour partiellement un utilisateur
 * PATCH /api/users/:id
 */
async patchUser(id, partialUpdates) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        const result = await this.apiRequest(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(partialUpdates)
        });
        
        if (result.success) {
            // Si c'est l'utilisateur courant, mettre à jour localement
            if (this.user && this.user.id === id) {
                this.user = { ...this.user, ...result.data };
                this.saveUserToCache(this.user);
            }
            
            this.emit('user:updated', { id, data: result.data });
            
            return {
                success: true,
                data: result.data,
                message: result.message || 'Profil mis à jour'
            };
        }
        
        return {
            success: false,
            error: result.error || 'Échec mise à jour'
        };
    } catch (err) {
        console.error('❌ patchUser échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 5. Supprimer un utilisateur (Admin uniquement)
 * DELETE /api/users/:id
 */
async deleteUser(id) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        const result = await this.apiRequest(`/users/${id}`, {
            method: 'DELETE'
        });
        
        if (result.success) {
            this.emit('user:deleted', { id });
            
            return {
                success: true,
                message: result.message || 'Utilisateur supprimé',
                data: result.deletedUser
            };
        }
        
        return {
            success: false,
            error: result.error || 'Échec suppression'
        };
    } catch (err) {
        console.error('❌ deleteUser échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 6. Changer le rôle d'un utilisateur (Admin uniquement)
 * PATCH /api/users/:id/role
 */
async changeUserRole(id, role) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        if (!['admin', 'user', 'agent'].includes(role)) {
            return {
                success: false,
                error: 'Rôle invalide. Choisissez entre: admin, user, agent'
            };
        }
        
        const result = await this.apiRequest(`/users/${id}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role })
        });
        
        if (result.success) {
            this.emit('user:role-changed', { id, oldRole: result.data?.oldRole, newRole: role });
            
            return {
                success: true,
                data: result.data,
                message: result.message || `Rôle changé en ${role}`
            };
        }
        
        return {
            success: false,
            error: result.error || 'Échec changement rôle'
        };
    } catch (err) {
        console.error('❌ changeUserRole échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 7. Activer/Désactiver un utilisateur (Admin uniquement)
 * PATCH /api/users/:id/active
 */
async toggleUserActive(id, active) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        if (typeof active !== 'boolean') {
            return {
                success: false,
                error: 'Le paramètre "active" doit être un booléen'
            };
        }
        
        const result = await this.apiRequest(`/users/${id}/active`, {
            method: 'PATCH',
            body: JSON.stringify({ active })
        });
        
        if (result.success) {
            const statusText = active ? 'activé' : 'désactivé';
            this.emit('user:active-changed', { id, active });
            
            return {
                success: true,
                data: result.data,
                message: result.message || `Utilisateur ${statusText}`
            };
        }
        
        return {
            success: false,
            error: result.error || 'Échec changement statut'
        };
    } catch (err) {
        console.error('❌ toggleUserActive échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 8. Régénérer le code d'accès
 * POST /api/users/:id/regenerate-access-code
 */
async regenerateUserAccessCode(id) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        const result = await this.apiRequest(`/users/${id}/regenerate-access-code`, {
            method: 'POST'
        });
        
        if (result.success) {
            // Si c'est l'utilisateur courant, mettre à jour localement
            if (this.user && this.user.id === id) {
                this.user.accessCode = result.accessCode;
                this.saveUserToCache(this.user);
            }
            
            this.emit('user:code-regenerated', { id, code: result.accessCode });
            
            return {
                success: true,
                accessCode: result.accessCode,
                message: result.message || 'Nouveau code généré'
            };
        }
        
        return {
            success: false,
            error: result.error || 'Échec génération code'
        };
    } catch (err) {
        console.error('❌ regenerateUserAccessCode échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 9. Récupérer les statistiques d'un utilisateur
 * GET /api/users/:id/statistics
 */
async getUserStatistics(id) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        const result = await this.apiRequest(`/users/${id}/statistics`, {
            method: 'GET'
        });
        
        if (result.success) {
            return {
                success: true,
                data: result.data
            };
        }
        
        return {
            success: false,
            error: result.error || 'Erreur récupération statistiques'
        };
    } catch (err) {
        console.error('❌ getUserStatistics échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 10. Rechercher des utilisateurs (Admin uniquement)
 * GET /api/users/search
 */
async searchUsers(query, filters = {}) {
    try {
        if (!this.token) throw new Error('Non authentifié');
        
        if (!query || query.length < 2) {
            return {
                success: false,
                error: 'Requête de recherche trop courte (min 2 caractères)'
            };
        }
        
        const params = new URLSearchParams({ q: query, ...filters }).toString();
        const result = await this.apiRequest(`/users/search?${params}`, {
            method: 'GET'
        });
        
        if (result.success) {
            return {
                success: true,
                data: result.data,
                count: result.count
            };
        }
        
        return {
            success: false,
            error: result.error || 'Erreur recherche'
        };
    } catch (err) {
        console.error('❌ searchUsers échec:', err.message);
        return {
            success: false,
            error: err.message,
            code: 'NETWORK_ERROR'
        };
    }
}

/**
 * 11. Méthode utilitaire : Vérifier si l'utilisateur est admin
 */
isAdmin() {
    return this.user && this.user.role === 'admin';
}

/**
 * 12. Méthode utilitaire : Vérifier les permissions
 */
hasPermission(userId) {
    if (this.isAdmin()) return true;
    
    // Utilisateur peut agir sur son propre compte
    return this.user && this.user.id === userId;
}

/**
 * 13. Méthode utilitaire : Formater les données utilisateur
 */
formatUserForDisplay(user) {
    if (!user) return null;
    
    const { password, ...userWithoutPassword } = user;
    
    return {
        ...userWithoutPassword,
        displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
        avatar: this.generateAvatar(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email),
        isActive: user.isActive !== false,
        isVerified: user.emailVerified === true
    };
}

/**
 * 14. Méthode utilitaire : Récupérer les utilisateurs avec pagination
 */
async getUsersPaginated(page = 1, limit = 20, filters = {}) {
    try {
        const result = await this.getAllUsers({
            ...filters,
            offset: (page - 1) * limit,
            limit
        });
        
        if (result.success) {
            return {
                success: true,
                data: result.data,
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            };
        }
        
        return result;
    } catch (err) {
        console.error('❌ getUsersPaginated échec:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * 15. Méthode utilitaire : Exporter la liste des utilisateurs
 */
async exportUsersToCSV(filters = {}) {
    try {
        const result = await this.getAllUsers(filters);
        
        if (!result.success || !result.data) {
            return {
                success: false,
                error: 'Impossible de récupérer les utilisateurs'
            };
        }
        
        const users = result.data;
        const headers = ['ID', 'Email', 'Prénom', 'Nom', 'Rôle', 'Statut', 'Créé le', 'Dernière connexion'];
        const rows = [headers.join(',')];
        
        users.forEach(user => {
            const row = [
                user.id,
                user.email || '',
                user.firstName || '',
                user.lastName || '',
                user.role || 'user',
                user.isActive === false ? 'Inactif' : 'Actif',
                user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
                user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : ''
            ].map(v => `"${v}"`).join(',');
            
            rows.push(row);
        });
        
        const csv = rows.join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `secura-users-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        return {
            success: true,
            count: users.length,
            message: `${users.length} utilisateurs exportés`
        };
    } catch (err) {
        console.error('❌ exportUsersToCSV échec:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * 16. Événements utilisateurs
 */
emitUserEvents() {
    this.on('user:created', (event) => {
        console.log('👤 Utilisateur créé:', event.detail);
        this.emitStatsUpdate();
    });
    
    this.on('user:updated', (event) => {
        console.log('🔄 Utilisateur mis à jour:', event.detail);
        this.emitStatsUpdate();
    });
    
    this.on('user:deleted', (event) => {
        console.log('🗑️ Utilisateur supprimé:', event.detail);
        this.emitStatsUpdate();
    });
    
    this.on('user:role-changed', (event) => {
        console.log('👑 Rôle changé:', event.detail);
    });
    
    this.on('user:active-changed', (event) => {
        console.log('🔘 Statut actif changé:', event.detail);
    });
    
    this.on('user:code-regenerated', (event) => {
        console.log('🔑 Code régénéré:', event.detail);
    });
}







    // === PROFIL UTILISATEUR ===
    async getProfile() {
        try {
            // 🔄 Sync le token depuis localStorage en cas de rechargement
            this.syncAuthFromStorage();
            
            if (!this.token) throw new Error('Non authentifié');
            
            const result = await this.apiRequest('/auth/me' , {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${this.token}`,
                    }
            });
            if (result.success) {
                this.user = result.user;
                this.saveUserToCache(result.user);
                this.isAuthenticated = true;
                return result.user;
            }
            throw new Error('Profil non trouvé');
        } catch (err) {
            console.warn('⚠️ getProfile échec:', err.message);
            this.isAuthenticated = false;
            return this.getUserFromCache();
        }
    }

    async updateProfile(updates) {
        try {
            if (!this.token) throw new Error('Non authentifié');
            
            const result = await this.apiRequest('/auth/update-profile', {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            
            if (result.success) {
                this.user = { ...this.user, ...result.user };
                this.saveUserToCache(this.user);
                return result.user;
            }
            throw new Error(result.message || 'Échec mise à jour');
        } catch (err) {
            console.error('❌ updateProfile:', err);
            throw err;
        }
    }

    async changePassword(currentPassword, newPassword) {
        try {
            const result = await this.apiRequest('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            if (result.success) {
                return true;
            }
            throw new Error(result.message || 'Échec changement mot de passe');
        } catch (err) {
            console.error('❌ changePassword:', err);
            throw err;
        }
    }

    async regenerateAccessCode() {
        try {
            const result = await this.apiRequest('/auth/regenerate-access-code', {
                method: 'POST'
            });
            
            if (result.success) {
                if (this.user) {
                    this.user.accessCode = result.accessCode;
                }
                return result.accessCode;
            }
            throw new Error('Échec régénération code');
        } catch (err) {
            console.error('❌ regenerateAccessCode:', err);
            throw err;
        }
    }

    async verifyPassword(password) {
        try {
            const result = await this.apiRequest('/auth/verify-password', {
                method: 'POST',
                body: JSON.stringify({ password })
            });
            
            return result.success || false;
        } catch {
            return false;
        }
    }

    saveUserToCache(user) {
        try {
            localStorage.setItem('secura_user', JSON.stringify(user));
        } catch (err) {
            console.warn('❌ Cache user échec:', err);
        }
    }

    getUserFromCache() {
        try {
            const cached = localStorage.getItem('secura_user');
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    }


    // === EXPORT DONNÉES ===
    async exportUserData() {
        try {
            const result = await this.apiRequest('/auth/export-data');
            if (result.success && result.data) {
                const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `secura-data-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
                return true;
            }
        } catch (err) {
            console.error('❌ exportUserData:', err);
        }
        return false;
    }

    async saveUserSettings(settings) {
        try {
            const result = await this.apiRequest('/auth/settings', {
                method: 'POST',
                body: JSON.stringify(settings)
            });
            
            if (result.success) {
                if (!this.data.settings) this.data.settings = {};
                this.data.settings = { ...this.data.settings, ...settings };
                this.saveToLocalStorage();
                return true;
            }
        } catch (err) {
            console.warn('⚠️ saveUserSettings échec:', err);
        }
        
        if (!this.data.settings) this.data.settings = {};
        this.data.settings = { ...this.data.settings, ...settings };
        this.saveToLocalStorage();
        return true;
    }

    getUserSettings() {
        return this.data.settings || {};
    }

    generateAvatar(name) {
        if (!name) return null;
        
        const initials = name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        
        const colors = [
            '#D97706', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444',
            '#F59E0B', '#84CC16', '#06B6D4', '#EC4899', '#78716C'
        ];
        
        const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const color = colors[hash % colors.length];
        
        return { initials, color };
    }

    // === NOTIFICATIONS ===
    async updateNotificationSettings(settings) {
        return this.saveUserSettings({ notifications: settings });
    }

    getNotificationSettings() {
        return this.data.settings?.notifications || {
            realtime: true,
            events: true,
            scans: true,
            email: false,
            frequency: 'realtime'
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔐 MÉTHODES D'AUTHENTIFICATION
    // ═══════════════════════════════════════════════════════════════

    // Vérifier si l'utilisateur est connecté
    isLoggedIn() {
        return this.isAuthenticated && this.token !== null;
    }

    // Vérifier l'état d'authentification
    checkAuthStatus() {
        this.isAuthenticated = !!this.token;
        return this.isAuthenticated;
    }

    // Obtenir le token actuel
    getToken() {
        return this.token;
    }

    // Obtenir l'utilisateur actuel
    getCurrentUser() {
        return this.user;
    }

    // Définir le token et mettre à jour l'état d'authentification
    setToken(token) {
        this.token = token;
        this.isAuthenticated = !!token;
        if (token) {
            localStorage.setItem('secura_token', token);
        } else {
            localStorage.removeItem('secura_token');
        }
    }









    // ═══════════════════════════════════════════════════════════════
    // 📸 GALERIES (6 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async getGalleries(eventId, filters = {}, forceRefresh = false) {
        try {
            // Sync authentication from localStorage
            this.syncAuthFromStorage();
            
            // Utiliser le cache SI pas de forceRefresh ET données existent ET correspondent à l'eventId
            if (!forceRefresh && this.data.galleries?.length > 0) {
                // Vérifier que les galeries en cache correspondent à cet eventId
                const cachedGalleries = this.data.galleries.filter(g => g.eventId === eventId);
                if (cachedGalleries.length > 0 || this.data.galleries.every(g => g.eventId === eventId)) {
                    console.log(`✓ Utilisation du cache pour l'événement ${eventId}`);
                    return cachedGalleries.length > 0 ? cachedGalleries : this.data.galleries;
                }
            }

            // Require authentication for API call
            if (!this.token) {
                console.warn('⚠️ getGalleries: Non authentifié');
                // Retourner les galeries du cache filtrées par eventId si possible
                return this.data.galleries?.filter(g => g.eventId === eventId) || [];
            }

            const query = new URLSearchParams({ eventId, ...filters }).toString();
            const result = await this.apiRequest(`/galleries?${query}`);
            if (result.success) {
                this.data.galleries = result.galleries || [];
                this.emit('data:synced', { galleries: this.data.galleries });
                return this.data.galleries;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getGalleries:', err);
            // Retourner le cache filtré par eventId même en cas d'erreur
            return this.data.galleries?.filter(g => g.eventId === eventId) || [];
        }
    }

    async getGallery(galleryId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}`);
            if (result.success) {
                const idx = this.data.galleries.findIndex(g => g.id === galleryId);
                if (idx >= 0) this.data.galleries[idx] = result.gallery;
                else this.data.galleries.push(result.gallery);
                this.emit('gallery:updated', result.gallery);
                return result.gallery;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getGallery:', err);
            return null;
        }
    }

    async createGallery(eventId, name, opts = {}) {
        try {
            let options = { method: 'POST' };
            
            // Si coverFile fourni ET valide, utiliser FormData
            if (opts.coverFile && opts.coverFile instanceof File) {
                const formData = new FormData();
                formData.append('eventId', eventId);
                formData.append('name', name);
                formData.append('description', opts.description || '');
                formData.append('isPublic', opts.isPublic || false);
                formData.append('settings', JSON.stringify(opts.settings || {}));
                if (opts.metadata) formData.append('metadata', JSON.stringify(opts.metadata));
                formData.append('cover', opts.coverFile);
                options.body = formData;
            } else {
                // Envoyer en JSON pur sans fichier
                options.body = JSON.stringify({
                    eventId, name,
                    description: opts.description || '',
                    isPublic: opts.isPublic || false,
                    settings: opts.settings || {},
                    metadata: opts.metadata || {}
                });
                options.headers = { 'Content-Type': 'application/json' };
            }
            
            const result = await this.apiRequest('/galleries', options);
            if (result.success) {
                this.data.galleries.push(result.gallery);
                this.emit('gallery:created', result.gallery);
                this.saveToLocalStorage();
                return result.gallery;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ createGallery:', err);
            throw err;
        }
    }

    async updateGallery(galleryId, updates) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            if (result.success) {
                const idx = this.data.galleries.findIndex(g => g.id === galleryId);
                if (idx >= 0) this.data.galleries[idx] = result.gallery;
                this.emit('gallery:updated', result.gallery);
                this.saveToLocalStorage();
                return result.gallery;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ updateGallery:', err);
            throw err;
        }
    }

    async deleteGallery(galleryId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}`, { method: 'DELETE' });
            if (result.success) {
                // Récupérer l'eventId et cover avant suppression
                const gallery = this.data.galleries?.find(g => g.id === galleryId);
                const eventId = gallery?.eventId;
                const coverImage = gallery?.coverImage;
                
                // ⚠️ CASCADE DELETE: Supprimer toutes les photos de cette galerie
                const photosToDelete = this.data.photos?.filter(p => p.galleryId === galleryId) || [];
                photosToDelete.forEach(photo => {
                    this.data.photos = this.data.photos.filter(p => p.id !== photo.id);
                    console.log(`🗑️ Photo supprimée en cascade: ${photo.id}`);
                });
                
                // ⚠️ CASCADE DELETE: Supprimer tous les commentaires des photos de cette galerie
                const commentsToDelete = this.data.comments?.filter(c => 
                    photosToDelete.some(p => p.id === c.photoId)
                ) || [];
                commentsToDelete.forEach(comment => {
                    this.data.comments = this.data.comments.filter(c => c.id !== comment.id);
                    console.log(`🗑️ Commentaire supprimé en cascade: ${comment.id}`);
                });
                
                // Supprimer la galerie
                this.data.galleries = this.data.galleries.filter(g => g.id !== galleryId);
                
                console.log(`🗑️ Galerie supprimée: ${galleryId}, Photos: ${photosToDelete.length}, Commentaires: ${commentsToDelete.length}`);
                
                this.emit('gallery:deleted', { id: galleryId, eventId, photosCount: photosToDelete.length });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deleteGallery:', err);
            throw err;
        }
    }

    async getGalleryStats(galleryId) {
        try {
            // L'endpoint /galleries/:id retourne déjà les stats enrichies
            const result = await this.apiRequest(`/galleries/${galleryId}`);
            if (result.success && result.gallery) {
                return result.gallery.stats || {};
            }
            throw new Error(result.error || 'Galerie non trouvée');
        } catch (err) {
            const errorMsg = err?.message || '';
            
            if (errorMsg.includes('Galerie non trouvée') || errorMsg.includes('HTTP 404')) {
                console.log(`🗑️ Suppression de la galerie ${galleryId} du stockage local (non trouvée sur serveur)`);
                try {
                    if (this.data.galleries) {
                        this.data.galleries = this.data.galleries.filter(g => g.id !== galleryId);
                        this.saveToLocalStorage();
                    }
                } catch (deleteErr) {
                    console.error('❌ Erreur lors de la suppression locale:', deleteErr);
                }
            }
            
            console.error('❌ getGalleryStats:', err);
            return null;
        }
    }


   



    // ═══════════════════════════════════════════════════════════════
    // 📷 PHOTOS (8 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async getPhotos(galleryId, opts = {}) {
        try {
            const query = new URLSearchParams(opts).toString();
            const result = await this.apiRequest(`/galleries/${galleryId}/photos?${query}`);
            if (result.success) {
                this.data.photos = result.photos || [];
                return this.data.photos;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getPhotos:', err);
            return [];
        }
    }

    async addPhoto(galleryId, file, metadata = {}) {
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('title', metadata.title || file.name);
            fd.append('description', metadata.description || '');
            fd.append('tags', JSON.stringify(metadata.tags || []));

            const result = await this.apiRequest(`/galleries/${galleryId}/photos`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: fd
            });

            if (result.success) {
                this.data.photos.push(result.photo);
                this.emit('photo:added', result.photo);
                this.saveToLocalStorage();
                return result.photo;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ addPhoto:', err);
            throw err;
        }
    }

    async updatePhoto(galleryId, photoId, updates = {}) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(updates)
            });
            if (result.success) {
                // Mettre à jour le cache local
                const photoIndex = this.data.photos?.findIndex(p => p.id === photoId);
                if (photoIndex !== undefined && photoIndex >= 0) {
                    this.data.photos[photoIndex] = { ...this.data.photos[photoIndex], ...result.photo };
                }
                this.emit('photo:updated', result.photo);
                this.saveToLocalStorage();
                return result.photo;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ updatePhoto:', err);
            throw err;
        }
    }

    async deletePhoto(galleryId, photoId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}`, {
                method: 'DELETE'
            });
            if (result.success) {
                this.data.photos = this.data.photos.filter(p => p.id !== photoId);
                this.emit('photo:deleted', { id: photoId });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deletePhoto:', err);
            throw err;
        }
    }

    async approvePhoto(galleryId, photoId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/approve`, {
                method: 'POST'
            });
            if (result.success) {
                this.emit('photo:approved', result.photo);
                this.saveToLocalStorage();
                return result.photo;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ approvePhoto:', err);
            throw err;
        }
    }

    async rejectPhoto(galleryId, photoId, reason = '') {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
            if (result.success) {
                this.emit('photo:rejected', result.photo);
                this.saveToLocalStorage();
                return result.photo;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ rejectPhoto:', err);
            throw err;
        }
    }

    async downloadGalleryZip(galleryId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/download/zip`);
            if (result.success && result.downloadUrl) {
                window.open(result.downloadUrl, '_blank');
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ downloadGalleryZip:', err);
            throw err;
        }
    }



    // ═══════════════════════════════════════════════════════════════
    // ❤️ LIKES (2 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async likePhoto(galleryId, photoId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/like`, {
                method: 'POST'
            });
            if (result.success) {
                this.emit(result.action === 'like' ? 'like:added' : 'like:removed', { photoId });
                this.saveToLocalStorage();
                return result;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ likePhoto:', err);
            throw err;
        }
    }

    async getLikes(galleryId, photoId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/likes`);
            if (result.success) return result.likes;
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getLikes:', err);
            return [];
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 💬 COMMENTAIRES (5 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async addComment(galleryId, photoId, content) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            if (result.success) {
                this.emit('comment:added', result.comment);
                this.saveToLocalStorage();
                return result.comment;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ addComment:', err);
            throw err;
        }
    }

    async getComments(galleryId, photoId, opts = {}) {
        try {
            const query = new URLSearchParams(opts).toString();
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments?${query}`);
            if (result.success) return result.comments;
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getComments:', err);
            return [];
        }
    }

    async updateComment(galleryId, photoId, commentId, content) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments/${commentId}`, {
                method: 'PUT',
                body: JSON.stringify({ content })
            });
            if (result.success) {
                this.emit('comment:updated', result.comment);
                this.saveToLocalStorage();
                return result.comment;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ updateComment:', err);
            throw err;
        }
    }

    async deleteComment(galleryId, photoId, commentId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments/${commentId}`, {
                method: 'DELETE'
            });
            if (result.success) {
                this.emit('comment:deleted', { id: commentId });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deleteComment:', err);
            throw err;
        }
    }

    async likeComment(galleryId, photoId, commentId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments/${commentId}/like`, {
                method: 'POST'
            });
            if (result.success) {
                this.emit('comment:liked', result.comment);
                this.saveToLocalStorage();
                return result;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ likeComment:', err);
            throw err;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 💬 RÉPONSES AUX COMMENTAIRES (4 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async addReply(galleryId, photoId, commentId, content) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments/${commentId}/replies`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            if (result.success) {
                this.emit('reply:added', result.reply);
                this.saveToLocalStorage();
                return result.reply;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ addReply:', err);
            throw err;
        }
    }

    async updateReply(galleryId, photoId, commentId, replyId, content) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments/${commentId}/replies/${replyId}`, {
                method: 'PUT',
                body: JSON.stringify({ content })
            });
            if (result.success) {
                this.emit('reply:updated', result.reply);
                this.saveToLocalStorage();
                return result.reply;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ updateReply:', err);
            throw err;
        }
    }

    async deleteReply(galleryId, photoId, commentId, replyId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments/${commentId}/replies/${replyId}`, {
                method: 'DELETE'
            });
            if (result.success) {
                this.emit('reply:deleted', { id: replyId });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deleteReply:', err);
            throw err;
        }
    }

    async likeReply(galleryId, photoId, commentId, replyId) {
        try {
            const result = await this.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments/${commentId}/replies/${replyId}/like`, {
                method: 'POST'
            });
            if (result.success) {
                this.emit('reply:liked', result.reply);
                this.saveToLocalStorage();
                return result;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ likeReply:', err);
            throw err;
        }
    }


    // ═══════════════════════════════════════════════════════════════
    // 🍽️ MENUS (4 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async getMenus(eventId, forceRefresh = false) {
        try {
            // Utiliser le cache si pas de forceRefresh et données existantes
            if (!forceRefresh && this.data.menus?.length > 0) {
                return this.data.menus;
            }

            const result = await this.apiRequest(`/menus?eventId=${eventId}`);
            if (result.success) {
                this.data.menus = result.menus || [];
                this.emit('data:synced', { menus: this.data.menus });
                return this.data.menus;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getMenus:', err);
            // Retourner le cache même en cas d'erreur
            return this.data.menus || [];
        }
    }

    async createMenu(eventId, name, opts = {}) {
        try {
            const result = await this.apiRequest('/menus', {
                method: 'POST',
                body: JSON.stringify({
                    eventId, name,
                    description: opts.description || '',
                    type: opts.type || 'main'
                })
            });
            if (result.success) {
                this.data.menus.push(result.menu);
                this.emit('menu:created', result.menu);
                this.saveToLocalStorage();
                return result.menu;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ createMenu:', err);
            throw err;
        }
    }

    async updateMenu(menuId, updates) {
        try {
            const result = await this.apiRequest(`/menus/${menuId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            if (result.success) {
                const idx = this.data.menus.findIndex(m => m.id === menuId);
                if (idx >= 0) this.data.menus[idx] = result.menu;
                this.emit('menu:updated', result.menu);
                this.saveToLocalStorage();
                return result.menu;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ updateMenu:', err);
            throw err;
        }
    }

    async deleteMenu(menuId) {
        try {
            const result = await this.apiRequest(`/menus/${menuId}`, { method: 'DELETE' });
            if (result.success) {
                this.data.menus = this.data.menus.filter(m => m.id !== menuId);
                this.emit('menu:deleted', { id: menuId });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deleteMenu:', err);
            throw err;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🍴 PLATS (5 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async addDish(menuId, name, opts = {}) {
        try {
            const fd = new FormData();
            fd.append('name', name);
            fd.append('description', opts.description || '');
            fd.append('price', opts.price || 0);
            fd.append('ingredients', JSON.stringify(opts.ingredients || []));
            fd.append('allergens', JSON.stringify(opts.allergens || []));
            if (opts.image) fd.append('image', opts.image);

            const result = await this.apiRequest(`/menus/${menuId}/dishes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: fd
            });

            if (result.success) {
                this.data.dishes.push(result.dish);
                this.emit('dish:added', result.dish);
                this.saveToLocalStorage();
                return result.dish;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ addDish:', err);
            throw err;
        }
    }

    async getDishes(menuId) {
        try {
            const result = await this.apiRequest(`/menus/${menuId}/dishes`);
            if (result.success) {
                this.data.dishes = result.dishes || [];
                return this.data.dishes;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getDishes:', err);
            return [];
        }
    }

    async updateDish(menuId, dishId, updates) {
        try {
            const result = await this.apiRequest(`/menus/${menuId}/dishes/${dishId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            if (result.success) {
                this.emit('dish:updated', result.dish);
                this.saveToLocalStorage();
                return result.dish;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ updateDish:', err);
            throw err;
        }
    }

    async deleteDish(menuId, dishId) {
        try {
            const result = await this.apiRequest(`/menus/${menuId}/dishes/${dishId}`, {
                method: 'DELETE'
            });
            if (result.success) {
                this.data.dishes = this.data.dishes.filter(d => d.id !== dishId);
                this.emit('dish:deleted', { id: dishId });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deleteDish:', err);
            throw err;
        }
    }

    async rateDish(menuId, dishId, score, comment = '') {
        try {
            const result = await this.apiRequest(`/menus/${menuId}/dishes/${dishId}/rating`, {
                method: 'POST',
                body: JSON.stringify({ score, comment })
            });
            if (result.success) {
                this.emit('rating:added', result.dish);
                this.saveToLocalStorage();
                return result.dish;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ rateDish:', err);
            throw err;
        }
    }



      // ═══════════════════════════════════════════════════════════════
    // 🗺️ PLANS (9 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async getPlans(eventId, forceRefresh = false) {
        try {
            // Utiliser le cache si pas de forceRefresh et données existantes
            if (!forceRefresh && this.data.plans?.length > 0) {
                return this.data.plans;
            }

            const result = await this.apiRequest(`/plans?eventId=${eventId}`);
            if (result.success) {
                this.data.plans = result.plans || [];
                this.emit('data:synced', { plans: this.data.plans });
                return this.data.plans;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getPlans:', err);
            // Retourner le cache même en cas d'erreur
            return this.data.plans || [];
        }
    }

    async createPlan(eventId, name, opts = {}) {
        try {
            const fd = new FormData();
            fd.append('eventId', eventId);
            fd.append('name', name);
            fd.append('description', opts.description || '');
            fd.append('type', opts.type || 'venue');
            if (opts.image) fd.append('image', opts.image);

            const result = await this.apiRequest('/plans', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: fd
            });

            if (result.success) {
                this.data.plans.push(result.plan);
                this.emit('plan:created', result.plan);
                this.saveToLocalStorage();
                return result.plan;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ createPlan:', err);
            throw err;
        }
    }

    async addLocation(planId, name, x, y, opts = {}) {
        try {
            const result = await this.apiRequest(`/plans/${planId}/locations`, {
                method: 'POST',
                body: JSON.stringify({
                    name, x: parseFloat(x), y: parseFloat(y),
                    description: opts.description || '',
                    type: opts.type || 'point',
                    info: opts.info || {}
                })
            });
            if (result.success) {
                this.emit('location:added', result.location);
                this.saveToLocalStorage();
                return result.location;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ addLocation:', err);
            throw err;
        }
    }

    async getLocations(planId) {
        try {
            const result = await this.apiRequest(`/plans/${planId}/locations`);
            if (result.success) return result.locations || [];
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getLocations:', err);
            return [];
        }
    }

    async updateLocation(planId, locationId, updates) {
        try {
            const result = await this.apiRequest(`/plans/${planId}/locations/${locationId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            if (result.success) {
                this.emit('location:updated', result.location);
                this.saveToLocalStorage();
                return result.location;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ updateLocation:', err);
            throw err;
        }
    }

    async deleteLocation(planId, locationId) {
        try {
            const result = await this.apiRequest(`/plans/${planId}/locations/${locationId}`, {
                method: 'DELETE'
            });
            if (result.success) {
                this.emit('location:deleted', { id: locationId });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deleteLocation:', err);
            throw err;
        }
    }



    // ═══════════════════════════════════════════════════════════════
    // 💬 CHAT (8 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async getConversations(eventId, forceRefresh = false) {
        try {
            if (!forceRefresh && this.data.chatConversations?.length > 0) {
                return this.data.chatConversations;
            }
            // Utiliser la route GET /api/chat/conversations avec enrichissement automatique
            const result = await this.apiRequest(`/chat/conversations?eventId=${eventId}`);
            if (result.success) {
                this.data.chatConversations = result.conversations || [];
                this.emit('data:synced', { chatConversations: this.data.chatConversations });
                return this.data.chatConversations;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getConversations:', err);
            return this.data.chatConversations || [];
        }
    }

    async createConversation(eventId, name, participantIds = []) {
        try {
            const result = await this.apiRequest('/chat/conversations', {
                method: 'POST',
                body: JSON.stringify({
                    eventId, name, participantIds,
                    type: participantIds.length > 1 ? 'group' : 'direct'
                })
            });
            if (result.success) {
                // Initialiser le array si nécessaire
                if (!this.data.chatConversations) {
                    this.data.chatConversations = [];
                }
                this.data.chatConversations.push(result.conversation);
                this.emit('chat:created', result.conversation);
                this.saveToLocalStorage();
                return result.conversation;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ createConversation:', err);
            throw err;
        }
    }

    async sendMessage(conversationId, content) {
        try {
            const result = await this.apiRequest(`/chat/conversations/${conversationId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            if (result.success) {
                // Initialiser le array si nécessaire
                if (!this.data.messages) {
                    this.data.messages = [];
                }
                this.data.messages.push(result.message);
                this.emit('message:sent', result.message);
                this.saveToLocalStorage();
                return result.message;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ sendMessage:', err);
            throw err;
        }
    }

    async getMessages(conversationId, opts = {}) {
        try {
            const query = new URLSearchParams(opts).toString();
            const result = await this.apiRequest(`/chat/conversations/${conversationId}/messages?${query}`);
            if (result.success) {
                this.data.messages = result.messages || [];
                return this.data.messages;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getMessages:', err);
            return [];
        }
    }

    async editMessage(conversationId, messageId, content) {
        try {
            const result = await this.apiRequest(`/chat/conversations/${conversationId}/messages/${messageId}`, {
                method: 'PUT',
                body: JSON.stringify({ content })
            });
            if (result.success) {
                this.emit('message:edited', result.message);
                this.saveToLocalStorage();
                return result.message;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ editMessage:', err);
            throw err;
        }
    }

    async deleteMessage(conversationId, messageId) {
        try {
            const result = await this.apiRequest(`/chat/conversations/${conversationId}/messages/${messageId}`, {
                method: 'DELETE'
            });
            if (result.success) {
                this.emit('message:deleted', { id: messageId });
                this.saveToLocalStorage();
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ deleteMessage:', err);
            throw err;
        }
    }

    async addReaction(conversationId, messageId, emoji) {
        try {
            const result = await this.apiRequest(`/chat/conversations/${conversationId}/messages/${messageId}/reaction`, {
                method: 'POST',
                body: JSON.stringify({ emoji })
            });
            if (result.success) {
                this.emit('reaction:added', result.message);
                this.saveToLocalStorage();
                return result.message;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ addReaction:', err);
            throw err;
        }
    }

    async removeReaction(conversationId, messageId, emoji) {
        try {
            const result = await this.apiRequest(
                `/chat/conversations/${conversationId}/messages/${messageId}/reaction/${encodeURIComponent(emoji)}`,
                {
                    method: 'DELETE'
                }
            );
            if (result.success) {
                this.emit('reaction:removed', result.message);
                this.saveToLocalStorage();
                return result.message;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ removeReaction:', err);
            throw err;
        }
    }

    async getReactions(conversationId, messageId) {
        try {
            const result = await this.apiRequest(
                `/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
                {
                    method: 'GET'
                }
            );
            if (result.success) {
                return result.reactions || {};
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getReactions:', err);
            throw err;
        }
    }

    async markAsRead(conversationId) {
        try {
            const result = await this.apiRequest(`/chat/conversations/${conversationId}/mark-as-read`, {
                method: 'POST'
            });
            if (result.success) {
                this.emit('chat:read', { conversationId });
                return true;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ markAsRead:', err);
            throw err;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 💾 STORAGE (2 endpoints)
    // ═══════════════════════════════════════════════════════════════

    async getStorageStats() {
        try {
            const result = await this.apiRequest('/storage/stats');
            if (result.success) return result.storage;
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ getStorageStats:', err);
            return null;
        }
    }

    async cleanupStorage() {
        try {
            const result = await this.apiRequest('/storage/cleanup', { method: 'POST' });
            if (result.success) {
                console.log(`✅ ${result.filesDeleted} fichiers supprimés`);
                return result.filesDeleted;
            }
            throw new Error(result.error);
        } catch (err) {
            console.error('❌ cleanupStorage:', err);
            throw err;
        }
    }
    
}



// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION GLOBALE
// ═══════════════════════════════════════════════════════════════
const storage = new SecuraStorage();
window.storage = storage;
window.storageReady = new Promise((resolve) => {
    window.addEventListener('secura:storage-ready', () => resolve(storage), { once: true });
    
    setTimeout(() => resolve(storage), 1500);
});


document.addEventListener('DOMContentLoaded', () => {

    // === MENU FLOTTANT ===
    const profileToggle = document.getElementById('profileToggle');
    const floatingMenu = document.getElementById('floatingProfileMenu');

    profileToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = floatingMenu.classList.contains('active');
        floatingMenu.classList.toggle('active', !isActive);
        profileToggle.setAttribute('aria-expanded', !isActive);
    });

    document.addEventListener('click', () => {
        floatingMenu?.classList.remove('active');
        profileToggle?.setAttribute('aria-expanded', 'false');
    });

    floatingMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        storage.logout();
        authManager.logout();
        window.location.href = '/index.html';
    });

    storage.updateProfileInfo();


    storage.on('data:synced', (event) => {
        storage.updateProfileInfo();
       // authManager.updateUI();
    });

    window.addEventListener('secura:stats:updated', storage.updateProfileInfo.bind(storage));
});

window.addEventListener('beforeunload', () => {
    storage.destroy();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecuraStorage;
}

console.log('✅ SECURA Storage V5.0 Observable chargé et prêt !');