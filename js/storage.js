/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        🛡️  SECURA STORAGE - ULTRA COMPLET V3.0  🛡️           ║
 * ║                                                               ║
 * ║  📡 Synchronisation bidirectionnelle avec API V3              ║
 * ║  💾 CRUD complet côté client                                  ║
 * ║  🔄 Auto-sync intelligent                                     ║
 * ║  📊 Statistiques temps réel                                   ║
 * ║  🚀 Performance optimisée                                     ║
 * ║  ⚡ Opérations directes via API                               ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

class SecuraStorage {
    constructor() {
        this.API_URL = 'http://localhost:3000/api';
        this.SYNC_ENABLED = true;
        this.SYNC_INTERVAL = 30000; // 30 secondes
        this.AUTO_SYNC_ON_CHANGE = true; // Sync automatique après modif
        this.USE_API_DIRECT = true; // Utiliser API directement (pas juste sync)
        
        this.syncTimer = null;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.syncErrors = [];
        
        this.data = {
            events: [],
            guests: [],
            qrCodes: [],
            scans: [],
            settings: {
                theme: 'light',
                language: 'fr',
                syncEnabled: true,
                apiUrl: this.API_URL,
                useApiDirect: true
            }
        };
        
        this.init();
    }

    // ═══════════════════════════════════════════════════════════════
    // 🚀 INITIALISATION
    // ═══════════════════════════════════════════════════════════════

    async init() {
        console.log('🔄 SECURA Storage V3.0 - Initialisation...');
        
        // Charger données locales
        this.loadFromLocalStorage();
        
        // Vérifier connexion serveur
        const serverOnline = await this.checkServerStatus();
        
        if (serverOnline && this.SYNC_ENABLED) {
            console.log('✅ Serveur accessible - Mode API Direct');
            await this.syncPull();
            this.startAutoSync();
        } else {
            console.warn('⚠️ Serveur inaccessible - Mode Local uniquement');
            this.SYNC_ENABLED = false;
        }
        
        this.triggerDataUpdate();
        console.log('✅ SECURA Storage prêt !');
    }

    // ═══════════════════════════════════════════════════════════════
    // 🌐 CONNEXION SERVEUR
    // ═══════════════════════════════════════════════════════════════

    async checkServerStatus() {
        try {
            const response = await fetch(`${this.API_URL.replace('/api', '')}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            return response.ok;
        } catch (err) {
            return false;
        }
    }

    async apiRequest(endpoint, options = {}) {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.API_URL}${endpoint}`;
            console.log(url);
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (err) {
            console.error(`❌ API Error [${endpoint}]:`, err.message);
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
                console.log('✅ Données locales chargées:', {
                    events: this.data.events?.length || 0,
                    guests: this.data.guests?.length || 0,
                    scans: this.data.scans?.length || 0
                });
            }
        } catch (err) {
            console.error('❌ Erreur chargement local:', err);
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('secura_data', JSON.stringify(this.data));
            console.log('💾 Sauvegarde locale OK');
        } catch (err) {
            console.error('❌ Erreur sauvegarde locale:', err);
        }
    }

    clearLocalStorage() {
        try {
            localStorage.removeItem('secura_data');
            console.log('🗑️ Données locales effacées');
        } catch (err) {
            console.error('❌ Erreur effacement:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔄 SYNCHRONISATION
    // ═══════════════════════════════════════════════════════════════

    async syncPull() {
        if (!this.SYNC_ENABLED || this.syncInProgress) return false;
        
        this.syncInProgress = true;
        console.log('🔄 Sync Pull...');
        
        try {
            const result = this.apiRequest('/sync/pull');
            
            if (result.success) {
                this.data = result.data;
                this.saveToLocalStorage();
                this.lastSyncTime = new Date().toISOString();
                this.triggerDataUpdate();
                
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
        if (!this.SYNC_ENABLED || this.syncInProgress) return false;
        
        this.syncInProgress = true;
        console.log('🔄 Sync Push...');
        
        try {
            const result = this.apiRequest('/sync/push', {
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

    async syncStatus() {
        try {
            const result = this.apiRequest('/sync/status');
            return result.data;
        } catch (err) {
            return null;
        }
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
    // 🎫 CRUD ÉVÉNEMENTS
    // ═══════════════════════════════════════════════════════════════

     getAllEvents(filters = {}) {
        if (this.USE_API_DIRECT) {
            try {
                const params = new URLSearchParams(filters).toString();
                const result = this.apiRequest(`/events${params ? '?' + params : ''}`);
                if (result.success) {
                    this.data.events = result.data;
                    this.saveToLocalStorage();


                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API getAllEvents échec, mode local');
            }
        }
        return this.data.events;
    }

    getEventById(id) {
        if (this.USE_API_DIRECT) {
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
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/events', {
                    method: 'POST',
                    body: JSON.stringify(event)
                });
                
                if (result.success) {
                    await this.syncPull(); // Refresh data
                    console.log('✅ Événement créé via API:', result.data.name);
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API createEvent échec, mode local');
            }
        }
        
        // Fallback local
        return this.saveEvent(event);
    }

    async updateEvent(id, updates) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/events/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updates)
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Événement mis à jour via API');
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API updateEvent échec, mode local');
            }
        }
        
        // Fallback local
        const event = this.data.events.find(e => e.id === id);
        if (event) {
            Object.assign(event, updates, { updatedAt: new Date().toISOString() });
            this.saveToLocalStorage();
            if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
            this.triggerDataUpdate();
            return event;
        }
        return null;
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

    async deleteEvent(id) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/events/${id}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Événement supprimé via API');
                    return true;
                }
            } catch (err) {
                console.warn('⚠️ API deleteEvent échec, mode local');
            }
        }
        
        // Fallback local
        this.data.events = this.data.events.filter(e => e.id !== id);
        const guestIds = this.data.guests.filter(g => g.eventId === id).map(g => g.id);
        this.data.guests = this.data.guests.filter(g => g.eventId !== id);
        this.data.qrCodes = this.data.qrCodes.filter(q => !guestIds.includes(q.guestId));
        this.data.scans = this.data.scans.filter(s => s.eventId !== id);
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.triggerDataUpdate();
        return true;
    }

    async getEventStatistics(id) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/events/${id}/statistics`);
                if (result.success) return result.data;
            } catch (err) {
                console.warn('⚠️ API getEventStatistics échec');
            }
        }
        
        // Calcul local
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

    // Local fallback (mode hors-ligne)
    saveEvent(event) {
        const now = new Date().toISOString();
        const index = this.data.events.findIndex(e => e.id === event.id);
        
        if (index !== -1) {
            this.data.events[index] = { ...this.data.events[index], ...event, updatedAt: now };
        } else {
            event.id = this.generateId('evt');
            event.createdAt = event.updatedAt = now;
            event.active = event.active !== false;
            this.data.events.unshift(event);
        }
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.triggerDataUpdate();
        return event;
    }

    // ═══════════════════════════════════════════════════════════════
    // 👥 CRUD INVITÉS
    // ═══════════════════════════════════════════════════════════════

    getAllGuests(filters = {}) {
        if (this.USE_API_DIRECT) {
            try {
                const params = new URLSearchParams(filters).toString();
                const result = this.apiRequest(`/guests${params ? '?' + params : ''}`);
                if (result.success) {
                    this.data.guests = result.data;
                    this.saveToLocalStorage();
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
        if (this.USE_API_DIRECT) {
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
        if (this.USE_API_DIRECT) {
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
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/guests', {
                    method: 'POST',
                    body: JSON.stringify(guest)
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Invité créé via API:', result.data.firstName);
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API createGuest échec');
            }
        }
        
        return this.saveGuest(guest);
    }

    async createMultipleGuests(guests) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/guests/bulk', {
                    method: 'POST',
                    body: JSON.stringify({ guests })
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Invités créés en masse via API:', result.count);
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API createMultipleGuests échec');
            }
        }
        
        return this.saveMultipleGuests(guests);
    }

    async updateGuest(id, updates) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/guests/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updates)
                });
                
                if (result.success) {
                    await this.syncPull();
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API updateGuest échec');
            }
        }
        
        const guest = this.data.guests.find(g => g.id === id);
        if (guest) {
            Object.assign(guest, updates, { updatedAt: new Date().toISOString() });
            this.saveToLocalStorage();
            if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
            this.triggerDataUpdate();
            return guest;
        }
        return null;
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

    async deleteGuest(id) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest(`/guests/${id}`, {
                    method: 'DELETE'
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Invité supprimé via API');
                    return true;
                }
            } catch (err) {
                console.warn('⚠️ API deleteGuest échec');
            }
        }
        
        this.data.guests = this.data.guests.filter(g => g.id !== id);
        this.data.qrCodes = this.data.qrCodes.filter(q => q.guestId !== id);
        this.data.scans = this.data.scans.filter(s => s.guestId !== id);
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.triggerDataUpdate();
        return true;
    }

    async deleteMultipleGuests(ids) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/guests/bulk', {
                    method: 'DELETE',
                    body: JSON.stringify({ ids })
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Invités supprimés en masse via API:', result.deleted);
                    return true;
                }
            } catch (err) {
                console.warn('⚠️ API deleteMultipleGuests échec');
            }
        }
        
        this.data.guests = this.data.guests.filter(g => !ids.includes(g.id));
        this.data.qrCodes = this.data.qrCodes.filter(q => !ids.includes(q.guestId));
        this.data.scans = this.data.scans.filter(s => !ids.includes(s.guestId));
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
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

    // Fallback local
    saveGuest(guest) {
        const now = new Date().toISOString();
        const index = this.data.guests.findIndex(g => g.id === guest.id);
        
        if (index !== -1) {
            this.data.guests[index] = { ...this.data.guests[index], ...guest, updatedAt: now };
        } else {
            guest.id = this.generateId('gst');
            guest.createdAt = guest.updatedAt = now;
            guest.scanned = false;
            guest.status = guest.status || 'pending';
            this.data.guests.push(guest);
        }
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.triggerDataUpdate();
        return guest;
    }

    saveMultipleGuests(arr) {
        const now = new Date().toISOString();
        arr.forEach(g => {
            g.id = this.generateId('gst');
            g.createdAt = g.updatedAt = now;
            g.scanned = false;
            g.status = g.status || 'pending';
            this.data.guests.push(g);
        });
        
        this.saveToLocalStorage();
        if (this.AUTO_SYNC_ON_CHANGE) this.syncPush();
        this.triggerDataUpdate();
        return arr;
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

    async generateQRCode(guestId, eventId) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/qrcodes/generate', {
                    method: 'POST',
                    body: JSON.stringify({ guestId, eventId })
                });
                
                if (result.success) {
                    await this.syncPull();
                    console.log('✅ QR Code généré via API');
                    return result.data;
                }
            } catch (err) {
                console.warn('⚠️ API generateQRCode échec');
            }
        }
        
        // Fallback local
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
        return qr;
    }

    // ═══════════════════════════════════════════════════════════════
    // 📷 SCANS
    // ═══════════════════════════════════════════════════════════════

    async scanQRCode(qrData) {
        if (this.USE_API_DIRECT) {
            try {
                const result = this.apiRequest('/qr/scan', {
                    method: 'POST',
                    body: JSON.stringify(qrData)
                });

                if (result.success) {
                    await this.syncPull();
                    console.log('✅ Scan enregistré via API:', result.data.scan.guestName);
                    return result.data;
                }
            } catch (err) {
                console.error('❌ Scan API échec:', err);
                // Fallback local
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
        this.triggerDataUpdate();
        
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

    getServerStatistics() {
        try {
            const result = this.apiRequest('/statistics');
            if (result.success) return result.data;
        } catch (err) {
            console.error('❌ getServerStatistics échec:', err);
        }
        return null;
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
                    this.triggerDataUpdate();
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

    escapeCSV(value) {
        const s = String(value || '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    }

    // ═══════════════════════════════════════════════════════════════
    // 📢 EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════

    on(event, callback) {
        window.addEventListener(`secura:${event}`, callback);
    }

    off(event, callback) {
        window.removeEventListener(`secura:${event}`, callback);
    }

    emit(event, data) {
        window.dispatchEvent(new CustomEvent(`secura:${event}`, { detail: data }));
    }

    // ═══════════════════════════════════════════════════════════════
    // 🧹 CLEANUP
    // ═══════════════════════════════════════════════════════════════

    destroy() {
        this.stopAutoSync();
        this.saveToLocalStorage();
        console.log('🧹 SECURA Storage destroyed');
    }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION GLOBALE
// ═══════════════════════════════════════════════════════════════

const storage = new SecuraStorage();
window.storage = storage;
window.storageReady = Promise.resolve(storage);

// Événements globaux
window.addEventListener('secura:data-updated', (e) => {
    console.log('📊 Données mises à jour:', e.detail);
});

// Cleanup au déchargement
window.addEventListener('beforeunload', () => {
    storage.destroy();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecuraStorage;
}

console.log('✅ SECURA Storage V3.0 chargé et prêt !');