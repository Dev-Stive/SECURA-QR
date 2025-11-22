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


class SecuraStorage {
    constructor() {
   //   this.API_URL = 'http://localhost:3000/api';
   this.API_URL = 'https://secura-qr.onrender.com/api';

        this.token = localStorage.getItem('secura_token') || null;
        this.user = null;

        this.SYNC_ENABLED = true;
        this.SYNC_INTERVAL = 1000;
        this.AUTO_SYNC_ON_CHANGE = true;
        this.USE_API_DIRECT = true;

        this.syncTimer = null;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.syncErrors = [];
        this.isOnline = navigator.onLine;

        // 🎯 ÉTAT OBSERVABLE
        this.data = {
            events: [],
            guests: [],
            qrCodes: [],
            scans: [],
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
            'event:created': [],
            'event:updated': [],
            'event:deleted': [],
            'guest:created': [],
            'guest:updated': [],
            'guest:deleted': [],
            'scan:created': [],
            'qr:generated': [],
            'data:synced': [],
            'stats:updated': []
        };

        this.init();
    }


   // ═══════════════════════════════════════════════════════════════
    // 🚀 INITIALISATION
    // ═══════════════════════════════════════════════════════════════
    async init() {
        console.log('🚀 SECURA Storage V5.0 - Initialisation...');

        this.loadFromLocalStorage();

        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncPull();
            this.startAutoSync();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.stopAutoSync();
        });

        const serverOnline = await this.checkServerStatus();
        if (serverOnline && this.SYNC_ENABLED) {
            
            await this.syncPull();
            this.startAutoSync();
        } else {
            console.warn('⚠️ Mode hors-ligne activé');
            this.SYNC_ENABLED = false;
        }

        this.emitStatsUpdate();
        console.log('✅ SECURA Storage V5.0 prêt !');
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
        const url = endpoint.startsWith('http')
            ? endpoint
            : `${this.API_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token && !endpoint.includes('/auth/')) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const res = await fetch(url, {
                ...options,
                headers,
                //signal: options.signal || AbortSignal.timeout(15000)
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || `HTTP ${res.status}`);
            }

            return await res.json();
        } catch (err) {
            const msg = err?.message || 'Unknown error';

            console.error(`API Error [${endpoint}]:`, msg);

            // Sécurisé : includes() + null safety
            if (msg.includes('Token invalide') || msg.includes('expired')) {
                this.forceLogout();
            }

            throw err;
        }
    }



    // ═══════════════════════════════════════════════════════════════
    // 💾 LOCAL STORAGE
    // ═══════════════════════════════════════════════════════════════

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('secura_data');
            if (stored) {
                this.data = JSON.parse(stored);
               
            }
        } catch (err) {
            console.error('❌ Erreur chargement local:', err);
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('secura_data', JSON.stringify(this.data));
        } catch (err) {
            console.error('❌ Erreur sauvegarde locale:', err);
        }
    }

    clearLocalStorage() {
        try {
            localStorage.removeItem('secura_data');
        } catch (err) {
            console.error('❌ Erreur effacement:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔄 SYNCHRONISATION INTELLIGENTE
    // ═══════════════════════════════════════════════════════════════

    async syncPull() {
        if (!this.SYNC_ENABLED || this.syncInProgress || !this.isOnline) return false;
        
        this.syncInProgress = true;
        console.log('🔄 Sync Pull...');
        
        try {
            const result = await this.apiRequest('/sync/pull');

            if (result.success) {
                const oldData = JSON.parse(JSON.stringify(this.data));

                const incoming = result.data || {};
                const sanitizeArray = (arr) => Array.isArray(arr) ? arr.filter(item => item && typeof item === 'object') : [];
                const sanitizedData = {
                    events: sanitizeArray(incoming.events),
                    guests: sanitizeArray(incoming.guests),
                    qrCodes: sanitizeArray(incoming.qrCodes),
                    scans: sanitizeArray(incoming.scans),
                    settings: incoming.settings && typeof incoming.settings === 'object' ? incoming.settings : this.data.settings
                };

                const ensureIds = (arr, prefix) => arr.map(item => {
                    if (!item.id) item.id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                    return item;
                });
                sanitizedData.events = ensureIds(sanitizedData.events, 'evt');
                sanitizedData.guests = ensureIds(sanitizedData.guests, 'gst');
                sanitizedData.qrCodes = ensureIds(sanitizedData.qrCodes, 'qr');
                sanitizedData.scans = ensureIds(sanitizedData.scans, 'scn');

                // Replace internal data with sanitized structure
                this.data = {
                    events: sanitizedData.events,
                    guests: sanitizedData.guests,
                    qrCodes: sanitizedData.qrCodes,
                    scans: sanitizedData.scans,
                    settings: sanitizedData.settings || this.data.settings
                };

                this.saveToLocalStorage();
                this.lastSyncTime = new Date().toISOString();
                
                // 🎯 ÉVÉNEMENTS GRANULAIRES
                this.detectChanges(oldData, this.data);
                this.emit('data:synced', { count: result.count });
                this.emitStatsUpdate();
                
                console.log('✅ Sync Pull réussie:', result.count);
                return true;
            }
        } catch (err) {
            console.warn('⚠️ Sync Pull impossible:', err.message);
            this.syncErrors.push({ type: 'pull', time: new Date(), error: err.message });
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    async syncPush() {
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
        // Defensive defaults
        oldData = oldData || { events: [], guests: [], qrCodes: [], scans: [] };
        newData = newData || { events: [], guests: [], qrCodes: [], scans: [] };

        const safeArr = (arr) => Array.isArray(arr) ? arr.filter(Boolean) : [];

        // Events
        const newEvents = safeArr(newData.events);
        const oldEvents = safeArr(oldData.events);
        const newEventIds = newEvents.map(e => e.id);
        const oldEventIds = oldEvents.map(e => e.id);
        
        newEvents.forEach(event => {
            if (!oldEventIds.includes(event.id)) {
                this.emit('event:created', event);
            } else {
                const oldEvent = oldEvents.find(e => e.id === event.id);
                // compare shallowly to avoid heavy JSON stringify when not necessary
                if (!oldEvent || JSON.stringify(oldEvent) !== JSON.stringify(event)) {
                    this.emit('event:updated', { old: oldEvent || null, new: event });
                }
            }
        });

        oldEvents.forEach(event => {
            if (!newEventIds.includes(event.id)) {
                this.emit('event:deleted', event);
            }
        });

        // Guests
        const newGuests = safeArr(newData.guests);
        const oldGuests = safeArr(oldData.guests);
        const newGuestIds = newGuests.map(g => g.id);
        const oldGuestIds = oldGuests.map(g => g.id);

        newGuests.forEach(guest => {
            if (!oldGuestIds.includes(guest.id)) {
                this.emit('guest:created', guest);
            } else {
                const oldGuest = oldGuests.find(g => g.id === guest.id);
                if (!oldGuest || JSON.stringify(oldGuest) !== JSON.stringify(guest)) {
                    this.emit('guest:updated', { old: oldGuest || null, new: guest });
                }
            }
        });

        oldGuests.forEach(guest => {
            if (!newGuestIds.includes(guest.id)) {
                this.emit('guest:deleted', guest);
            }
        });

        // Scans
        const oldScanIds = safeArr(oldData.scans).map(s => s.id);
        safeArr(newData.scans).forEach(scan => {
            if (!oldScanIds.includes(scan.id)) {
                this.emit('scan:created', scan);
            }
        });

        // qrCodes - emit generation for new ones
        const oldQrIds = safeArr(oldData.qrCodes).map(q => q.id);
        safeArr(newData.qrCodes).forEach(qr => {
            if (!oldQrIds.includes(qr.id)) {
                this.emit('qr:generated', qr);
            }
        });
    }




   startAutoSync() {
        if (this.syncTimer) clearInterval(this.syncTimer);
        
        this.syncTimer = setInterval(async () => {
            console.log('⏰ Auto-sync déclenché');
            await this.syncPull();
        }, this.SYNC_INTERVAL);
        
        console.log(`✅ Auto-sync activé (${this.SYNC_INTERVAL / 1000}s)`);
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

                localStorage.setItem('secura_token', this.token);

                this.emitStatsUpdate();

                console.log('Connexion réussie', this.user);

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

    async logout() {
        if (typeof Swal === 'undefined') {
            console.warn('SweetAlert2 non chargé. Déconnexion directe.');
            return this.forceLogout();
        }

        try {
            const result = await Swal.fire({
                title: 'Confirmer la déconnexion',
                text: 'Vous serez redirigé vers la page de connexion.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Oui, me déconnecter',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#D97706',
                cancelButtonColor: '#6c757d',
                reverseButtons: true,
                customClass: {
                    popup: 'animated fadeInDown faster',
                    title: 'swal-title',
                    confirmButton: 'btn-logout-confirm',
                    cancelButton: 'btn-logout-cancel'
                },
            });

            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Déconnexion...',
                    text: 'Nettoyage des données locales',
                    icon: 'info',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    timer: 1200,
                    timerProgressBar: true,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                setTimeout(() => {
                    this.forceLogout();
                }, 1300);
            }
        } catch (err) {
            console.error('Erreur modal logout:', err);
            this.forceLogout();
        }
    }

    forceLogout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('secura_token');
        localStorage.removeItem('secura_user');
        localStorage.removeItem('secura_data');
        window.location.href='/login.html';        

       
    }



     // ═══════════════════════════════════════════════════════════════
    // 🎫 CRUD ÉVÉNEMENTS (API + LOCAL)
    // ═══════════════════════════════════════════════════════════════
    getAllEvents(filters = {}) {
        if (this.USE_API_DIRECT && this.isOnline) {
            try {
                const params = new URLSearchParams(filters).toString();
                const result = this.apiRequest(`/events${params ? '?' + params : ''}`);
                if (result.success) {
                    const oldEvents = [...this.data.events];
                    this.data.events = result.data;
                    this.saveToLocalStorage();
                    this.detectChanges({ events: oldEvents, guests: this.data.guests, qrCodes: this.data.qrCodes, scans: this.data.scans }, this.data);
                    return result.data;
                }
            } catch (err) {
                console.warn('API getAllEvents échoué → mode local');
            }
        }
        return this.data.events;
    }

    getEventById(id) {
        if (this.USE_API_DIRECT && this.isOnline) {
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
                const result = await this.apiRequest('/events', {
                    method: 'POST',
                    body: JSON.stringify(event)
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
        
        return this.saveEvent(event);
    }

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
            Object.assign(event, updates, { updatedAt: new Date().toISOString() });
            this.saveToLocalStorage();
            if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
            this.emit('event:updated', { old: oldEvent, new: event });
            this.emitStatsUpdate();
            return event;
        }
        return null;
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
        this.data.events = this.data.events.filter(e => e.id !== id);
        const guestIds = this.data.guests.filter(g => g.eventId === id).map(g => g.id);
        this.data.guests = this.data.guests.filter(g => g.eventId !== id);
        this.data.qrCodes = this.data.qrCodes.filter(q => !guestIds.includes(q.guestId));
        this.data.scans = this.data.scans.filter(s => s.eventId !== id);
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emit('event:deleted', event);
        this.emitStatsUpdate();
        return true;
    }

    saveEvent(event) {
        const now = new Date().toISOString();
        const index = this.data.events.findIndex(e => e.id === event.id);
        
        if (index !== -1) {
            const oldEvent = { ...this.data.events[index] };
            this.data.events[index] = { ...this.data.events[index], ...event, updatedAt: now };
            this.emit('event:updated', { old: oldEvent, new: this.data.events[index] });
        } else {
            event.id = this.generateId('evt');
            event.createdAt = event.updatedAt = now;
            event.active = event.active !== false;
            this.data.events.unshift(event);
            this.emit('event:created', event);
        }
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emitStatsUpdate();
        return event;
    }



    async patchEvent(id, partialUpdates) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/events/${id}`, {
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
        return this.updateEvent(id, partialUpdates);
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

    

    // ═══════════════════════════════════════════════════════════════
    // 👥 CRUD INVITÉS
    // ═══════════════════════════════════════════════════════════════

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
                    this.detectChanges({ events: this.data.events, guests: oldGuests, qrCodes: this.data.qrCodes, scans: this.data.scans }, this.data);
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API getAllGuests échec');
            }
        }
        
        let guests = this.data.guests;
        if (filters.eventId) guests = guests.filter(g => g.eventId === filters.eventId);
        if (filters.scanned !== undefined) guests = guests.filter(g => g.scanned === (filters.scanned === 'true'));
        return guests;
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
                console.warn('⚠️ API updateGuest échec');
            }
        }
        
        const guest = this.data.guests.find(g => g.id === id);
        if (guest) {
            const oldGuest = { ...guest };
            Object.assign(guest, updates, { updatedAt: new Date().toISOString() });
            this.saveToLocalStorage();
            if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
            this.emit('guest:updated', { old: oldGuest, new: guest });
            this.emitStatsUpdate();
            return guest;
        }
        return null;
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
        
        if (index !== -1) {
            const oldGuest = { ...this.data.guests[index] };
            this.data.guests[index] = { ...this.data.guests[index], ...guest, updatedAt: now };
            this.emit('guest:updated', { old: oldGuest, new: this.data.guests[index] });
        } else {
            guest.id = this.generateId('gst');
            guest.createdAt = guest.updatedAt = now;
            guest.scanned = false;
            guest.status = guest.status || 'pending';
            this.data.guests.push(guest);
            this.emit('guest:created', guest);
        }
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.emitStatsUpdate();
        return guest;
    }



    async createMultipleGuests(guests) {
        if (this.USE_API_DIRECT) {
            try {
                const result = await this.apiRequest('/guests/bulk', {
                    method: 'POST',
                    body: JSON.stringify({ guests })
                });

                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Invités créés en masse via API:', result.count);
                    result.data.forEach(guest => this.emit('guest:created', guest));
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API createMultipleGuests échec');
            }
        }
        
        return this.saveMultipleGuests(guests);
    }

    saveMultipleGuests(guests) {
        const now = new Date().toISOString();
        const newGuests = [];

        guests.forEach(guest => {
            const existingGuest = this.data.guests.find(g => g.id === guest.id);

            if (existingGuest) {
                // Update existing guest
                Object.assign(existingGuest, guest, { updatedAt: now });
                this.emit('guest:updated', { old: existingGuest, new: guest });
            } else {
                // Add new guest
                guest.id = this.generateId('gst');
                guest.createdAt = guest.updatedAt = now;
                guest.scanned = false;
                guest.status = guest.status || 'pending';
                this.data.guests.push(guest);
                newGuests.push(guest);
                this.emit('guest:created', guest);
            }
        });

        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.triggerDataUpdate();

        return newGuests;
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

                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Scan enregistré via API:', result.data.scan.guestName);
                    this.emit('scan:created', result.data.scan);
                    this.emitStatsUpdate();
                    return result.data;
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

    saveScanLocal(guestId, eventId) {
        const guest = this.getGuestById(guestId);
        const event = this.getEventById(eventId);
        
        if (!guest || !event) return null;
        
        if (guest.scanned) {
            console.warn('⚠️ Invité déjà scanné');
            return { alreadyScanned: true, guest, event };
        }
        
        const scan = {
            id: this.generateId('scn'),
            eventId,
            guestId,
            guestName: `${guest.firstName} ${guest.lastName}`,
            eventName: event.name,
            scannedAt: new Date().toISOString()
        };
        
        this.data.scans.unshift(scan);
        guest.scanned = true;
        guest.scannedAt = scan.scannedAt;
        
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

    getStatistics() {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/statistics');
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getStatistics échec');
            }
        }
        
        // Calcul local
        const today = new Date().toDateString();
        return {
            totalEvents: this.data.events.length,
            activeEvents: this.data.events.filter(e => e.active !== false).length,
            totalGuests: this.data.guests.length,
            totalQRCodes: this.data.qrCodes.length,
            totalScans: this.data.scans.length,
            todayScans: this.data.scans.filter(s => new Date(s.scannedAt).toDateString() === today).length,
            scannedGuests: this.data.guests.filter(g => g.scanned).length,
            pendingGuests: this.data.guests.filter(g => !g.scanned).length,
            scanRate: this.data.guests.length > 0 
                ? Math.round((this.data.guests.filter(g => g.scanned).length / this.data.guests.length) * 100) 
                : 0,
            syncEnabled: this.SYNC_ENABLED,
            lastSync: this.lastSyncTime,
            syncErrors: this.syncErrors.length,
            lastUpdate: new Date().toISOString()
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

    toggleApiDirect() {
        this.USE_API_DIRECT = !this.USE_API_DIRECT;
        console.log(this.USE_API_DIRECT ? '✅ Mode API Direct activé' : '⏹️ Mode Local activé');
        return this.USE_API_DIRECT;
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

    // === CHARGER LES INFOS UTILISATEUR ===
    async updateProfileInfo() {

    if (!this.token) {
    
    this.forceLogout();
    return;

    }

    try{
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
            const dropdownEmail = document.getElementById('dropdownEmail');
            const profileRole = document.getElementById('profileRole');
            const dropdownRole = document.getElementById('dropdownRole');

            if (profileName) profileName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
            if (dropdownName) dropdownName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Utilisateur';
            if (dropdownEmail) dropdownEmail.textContent = user.email;
            if (profileRole) profileRole.textContent = user.role || 'Utilisateur';
            if (dropdownRole) {
                dropdownRole.textContent = (user.role || 'Utilisateur').toUpperCase();
                dropdownRole.style.background = user.role === 'admin' ? '#EF4444' : '#D97706';
            }
        }
        }else{
            console.log('Utilisateur introuvable , deconnexion forcee');
            this.forceLogout();
        }
    }catch(err){

        this.forceLogout();
        
    }
    }

}


// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION GLOBALE
// ═══════════════════════════════════════════════════════════════
const storage = new SecuraStorage();
window.storage = storage;
window.storageReady = Promise.resolve(storage);

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
        window.location.href = '/login.html';
    });

    storage.updateProfileInfo();


    storage.on('data:synced', (event) => {
        storage.updateProfileInfo();
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