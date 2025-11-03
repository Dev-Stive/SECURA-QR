/**
 * SECURA - FileStorage Manager ULTRA-COMPLET
 * 
 * ✅ Détection automatique : /home/stive-junior/secura-qr/data/secura-data.json
 * ✅ Persistance infinie : jamais de re-demande
 * ✅ Création auto dossier/fichier
 * ✅ File System Access API (Chrome/Edge) + Fallback (Firefox/Safari)
 * ✅ SweetAlert2 notifications
 * ✅ Auto-reload + Watch modifications
 * ✅ Backup auto + Export CSV
 * ✅ Statistiques live
 * ✅ window.storage global
 */

class FileStorage {
    constructor() {
        this.filePath = '/data/secura-data.json';
        this.fileHandle = null;
        this.data = {
            events: [],
            guests: [],
            qrCodes: [],
            scans: [],
            settings: { 
                theme: 'light', 
                language: 'fr',
                lastBackup: null,
                version: '1.0.0'
            }
        };
        this.isWatching = false;
        this.init();
    }

    async init() {
        console.log('🔄 FileStorage initialisation...');
        
        // 1. Vérifier chemin fixe
        if (await this.checkFileExists()) {
            console.log('✅ Fichier détecté automatiquement');
            await this.loadFromFixedPath();
            await this.setupFileWatcher();
            return;
        }

        // 2. Vérifier localStorage persistance
        const persistedPath = localStorage.getItem('secura_file_path');
        if (persistedPath && await this.checkFileExists(persistedPath)) {
            console.log('✅ Fichier récupéré depuis localStorage');
            this.filePath = persistedPath;
            await this.loadFromFixedPath();
            await this.setupFileWatcher();
            return;
        }

        await this.saveToFile();
        localStorage.setItem('secura_file_path', this.filePath);
        
        showNotification('success', 'Stockage SECURA initialisé !');
    }

    /**
     * Vérifie si fichier existe
     */
    async checkFileExists(path = this.filePath) {
        try {
            return new Promise((resolve) => {
                fetch(path)
                    .then(response => resolve(response.ok))
                    .catch(() => resolve(false));
            });
        } catch {
            return false;
        }
    }

    /**
     * Charge depuis le chemin fixe
     */
    async loadFromFixedPath() {
        try {
            const response = await fetch(this.filePath);
            if (!response.ok) throw new Error('Fichier non trouvé');
            
            const text = await response.text();
            const parsed = JSON.parse(text || '{}');

            this.data = {
                events: Array.isArray(parsed.events) ? parsed.events : [],
                guests: Array.isArray(parsed.guests) ? parsed.guests : [],
                qrCodes: Array.isArray(parsed.qrCodes) ? parsed.qrCodes : [],
                scans: Array.isArray(parsed.scans) ? parsed.scans : [],
                settings: { 
                    ...{ theme: 'light', language: 'fr' },
                    ...parsed.settings 
                }
            };

            localStorage.setItem('secura_file_path', this.filePath);
            console.log('✅ Données chargées:', Object.keys(this.data).map(k => `${k}: ${this.data[k].length}`));
            
            
            this.triggerDataUpdate();
            return true;
        } catch (err) {
            console.error('❌ Erreur chargement:', err);
            return false;
        }
    }

    // === DEMANDER À L'UTILISATEUR DE CHOISIR UN FICHIER SECURA ===
async selectFile() {
    try {
        // --- 🧠 Cas moderne (Chrome, Edge...) : API File System Access ---
        if ('showOpenFilePicker' in window) {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: 'Fichier de données SECURA',
                        accept: { 'application/json': ['.json'] }
                    }
                ],
                suggestedName: 'secura-data.json'
            });

            this.fileHandle = fileHandle;
            localStorage.setItem('secura_file_selected', 'true');

            await this.loadFromFile();
            showNotification('success', 'Fichier SECURA chargé avec succès ✅');
            return true;
        }

        // --- 🦊 Cas Firefox / Safari : pas de showOpenFilePicker ---
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.style.display = 'none';
            document.body.appendChild(input);

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    showNotification('warning', 'Aucun fichier sélectionné.');
                    resolve(false);
                    return;
                }

                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    await this.loadFromData(data);

                    localStorage.setItem('secura_file_selected', 'true');
                    showNotification('success', 'Fichier SECURA importé avec succès ✅');
                    resolve(true);
                } catch (err) {
                    console.error('Erreur import JSON :', err);
                    showNotification('error', 'Fichier invalide ou corrompu ❌');
                    resolve(false);
                } finally {
                    document.body.removeChild(input);
                }
            });

            input.click();
        });

    } catch (err) {
        console.error("Erreur selectFile :", err);

        if (err.name === 'AbortError') return false;
        if (err.name === 'NotAllowedError') {
            showNotification('error', 'Permission refusée. Autorisez l\'accès au fichier.');
            return false;
        }
        if (err.name === 'SecurityError') {
            showNotification('error', 'Erreur de sécurité : ouvrez l\'application en HTTPS ou via localhost.');
            return false;
        }

        showNotification('error', `Erreur : ${err.message || 'Impossible d\'accéder au fichier'}`);
        return false;
    }
}


    /**
     * Sauvegarde dans // Attendre que le storage ait fini son initialisation
    window.addEventListener('secura:data-updated', (e) => {
        console.log("📂 Données prêtes :", e.detail);
        loadEvents(); // Charger ici quand les données sont prêtes
    }); le fichier fixe
     */
    async saveToFile() {
        try {
            const response = await fetch(this.filePath, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Secura-Version': '2.0'
                },
                body: JSON.stringify({
                    ...this.data,
                    meta: {
                        updatedAt: new Date().toISOString(),
                        version: '2.0'
                    }
                }, null, 2)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            console.log('💾 Sauvegardé:', this.filePath);
            this.triggerDataUpdate();
            return true;
        } catch (err) {
            console.error('❌ Erreur sauvegarde:', err);
            showNotification('error', 'Échec sauvegarde. Vérifiez les permissions.');
            return false;
        }
    }

    /**
     * Watch modifications fichier (File System Access API)
     */
    async setupFileWatcher() {
        if (this.isWatching || !('showOpenFilePicker' in window)) return;

        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Secura JSON', accept: { 'application/json': ['.json'] } }]
            });
            this.fileHandle = handle;
            this.isWatching = true;

            // Watch changes
            handle.createWritable().then(writable => {
                writable.close();
                this.watchFileChanges();
            });
        } catch (err) {
            console.warn('⚠️ File watcher non disponible:', err);
        }
    }

    async watchFileChanges() {
        if (!this.fileHandle) return;

        const watcher = new FileSystemFileHandleWatcher(this.fileHandle);
        watcher.onchange = async () => {
            console.log('🔄 Fichier modifié externement');
            await this.loadFromFixedPath();
        };
    }

    /**
     * Trigger update pour observers
     */
    triggerDataUpdate() {
        window.dispatchEvent(new CustomEvent('secura:data-updated', { 
            detail: this.getStatistics() 
        }));
    }

    // === GÉNÉRER ID UNIQUE ===
    generateId() {
        return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ========================================
    //              ÉVÉNEMENTS
    // ========================================
    getAllEvents() { return this.data.events; }
    getEventById(id) { return this.data.events.find(e => e.id === id) || null; }

    saveEvent(event) {
        const now = new Date().toISOString();
        const i = this.data.events.findIndex(e => e.id === event.id);

        if (i !== -1) {
            this.data.events[i] = { ...this.data.events[i], ...event, updatedAt: now };
        } else {
            event.id = this.generateId();
            event.createdAt = event.updatedAt = now;
            this.data.events.unshift(event);
        }
        this.saveToFile();
        return event;
    }

    deleteEvent(id) {
        this.data.events = this.data.events.filter(e => e.id !== id);
        this.data.guests = this.data.guests.filter(g => g.eventId !== id);
        this.data.qrCodes = this.data.qrCodes.filter(q => q.eventId !== id);
        this.data.scans = this.data.scans.filter(s => s.eventId !== id);
        this.saveToFile();
        return true;
    }

    // ========================================
    //                INVITÉS
    // ========================================
    getAllGuests() { return this.data.guests; }
    getGuestsByEventId(id) { return this.data.guests.filter(g => g.eventId === id); }
    getGuestById(id) { return this.data.guests.find(g => g.id === id) || null; }

    saveGuest(guest) {
        const now = new Date().toISOString();
        const i = this.data.guests.findIndex(g => g.id === guest.id);

        if (i !== -1) {
            this.data.guests[i] = { ...this.data.guests[i], ...guest, updatedAt: now };
        } else {
            guest.id = this.generateId();
            guest.createdAt = guest.updatedAt = now;
            guest.scanned = false;
            guest.status = guest.status || 'pending';
            this.data.guests.push(guest);
        }
        this.saveToFile();
        return guest;
    }

    saveMultipleGuests(arr) {
        const now = new Date().toISOString();
        arr.forEach(g => {
            g.id = this.generateId();
            g.createdAt = g.updatedAt = now;
            g.scanned = false;
            g.status = g.status || 'pending';
            this.data.guests.push(g);
        });
        this.saveToFile();
        return arr;
    }

    deleteGuest(id) {
        this.data.guests = this.data.guests.filter(g => g.id !== id);
        this.data.qrCodes = this.data.qrCodes.filter(q => q.guestId !== id);
        this.saveToFile();
        return true;
    }

    deleteMultipleGuests(ids) {
        this.data.guests = this.data.guests.filter(g => !ids.includes(g.id));
        this.data.qrCodes = this.data.qrCodes.filter(q => !ids.includes(q.guestId));
        this.saveToFile();
        return true;
    }

    // ========================================
    //                QR CODES
    // ========================================
    getAllQRCodes() { return this.data.qrCodes; }
    getQRCodeByGuestId(id) { return this.data.qrCodes.find(q => q.guestId === id) || null; }

    saveQRCode(qr) {
        const now = new Date().toISOString();
        const i = this.data.qrCodes.findIndex(q => q.guestId === qr.guestId);

        if (i !== -1) {
            this.data.qrCodes[i] = { ...this.data.qrCodes[i], ...qr, updatedAt: now };
        } else {
            qr.id = this.generateId();
            qr.createdAt = qr.updatedAt = now;
            this.data.qrCodes.push(qr);
        }
        this.saveToFile();
        return qr;
    }

    // ========================================
    //                 SCANS
    // ========================================
    getAllScans() { return this.data.scans; }

    saveScan(scan) {
        scan.id = this.generateId();
        scan.scannedAt = new Date().toISOString();
        this.data.scans.unshift(scan);

        const guest = this.getGuestById(scan.guestId);
        if (guest) {
            guest.scanned = true;
            guest.scannedAt = scan.scannedAt;
        }
        this.saveToFile();
        return scan;
    }

    getTodayScans() {
        const today = new Date().toDateString();
        return this.data.scans.filter(s => new Date(s.scannedAt).toDateString() === today);
    }

    // ========================================
    //               PARAMÈTRES
    // ========================================
    getSettings() { return this.data.settings; }
    saveSetting(key, value) {
        this.data.settings[key] = value;
        this.saveToFile();
        return this.data.settings;
    }

    // ========================================
    //              STATISTIQUES
    // ========================================
    getStatistics() {
        const today = new Date().toDateString();
        return {
            totalEvents: this.data.events.length,
            totalGuests: this.data.guests.length,
            totalQRCodes: this.data.qrCodes.length,
            totalScans: this.data.scans.length,
            todayScans: this.getTodayScans().length,
            scannedGuests: this.data.guests.filter(g => g.scanned).length,
            mode: this.fileHandle ? 'File System' : 'localStorage',
            filePath: this.filePath,
            lastUpdate: new Date().toISOString(),
            version: '2.1.0'
        };
    }

    // ========================================
    //              EXPORT CSV
    // ========================================
    exportToCSV(eventId) {
        const guests = this.getGuestsByEventId(eventId);
        const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Notes', 'Statut', 'Scanné'];
        const rows = [headers.join(',')];

        guests.forEach(g => {
            rows.push([
                g.firstName || '',
                g.lastName || '',
                g.email || '',
                g.phone || '',
                g.company || '',
                g.notes || '',
                g.status || 'pending',
                g.scanned ? 'Oui' : 'Non'
            ].map(this.escapeCSV).join(','));
        });

        return rows.join('\n');
    }

    escapeCSV(value) {
        const s = String(value || '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    }

    // ========================================
    //           EXPORT / IMPORT JSON
    // ========================================
    exportToJSON(type = 'all') {
        const exportData = {
            version: '2.1.0',
            exportedAt: new Date().toISOString(),
            data: {}
        };

        if (type === 'all' || type === 'events') exportData.data.events = this.data.events;
        if (type === 'all' || type === 'guests') exportData.data.guests = this.data.guests;
        if (type === 'all' || type === 'qrcodes') exportData.data.qrCodes = this.data.qrCodes;
        if (type === 'all' || type === 'scans') exportData.data.scans = this.data.scans;

        return JSON.stringify(exportData, null, 2);
    }

    importFromJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.data) return false;

            if (parsed.data.events) this.data.events = parsed.data.events;
            if (parsed.data.guests) this.data.guests = parsed.data.guests;
            if (parsed.data.qrCodes) this.data.qrCodes = parsed.data.qrCodes;
            if (parsed.data.scans) this.data.scans = parsed.data.scans;

            this.saveToFile();
            this.triggerUpdate();
            return true;
        } catch (err) {
            console.error('Import échoué:', err);
            return false;
        }
    }

    // ========================================
    //             BACKUP & RESTORE
    // ========================================
    createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            path: this.filePath,
            version: '2.1.0',
            ...this.data
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `secura-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('success', 'Backup automatique créé !');
    }

    restoreBackup(jsonString) {
        try {
            const backup = JSON.parse(jsonString);
            if (!backup.events) return false;

            this.data.events = backup.events;
            this.data.guests = backup.guests;
            this.data.qrCodes = backup.qrCodes;
            this.data.scans = backup.scans;
            this.data.settings = { ...this.getDefaultData().settings, ...backup.settings };

            this.saveToFile();
            this.triggerUpdate();
            showNotification('success', 'Restauration réussie !');
            return true;
        } catch (err) {
            console.error('Restauration échouée:', err);
            showNotification('error', 'Fichier de backup invalide');
            return false;
        }
    }

    // ========================================
    //             RÉINITIALISATION
    // ========================================
    clearAllData() {
        if (!confirm('Êtes-vous sûr de vouloir tout effacer ?')) return;

        this.data = this.getDefaultData();
        localStorage.removeItem(this.DATA_KEY);
        localStorage.removeItem(this.FILE_HANDLE_KEY);
        this.fileHandle = null;
        this.saveToFile();
        this.triggerUpdate();
        showNotification('success', 'Données réinitialisées');
    }

    // Backup
    async createBackup() {
        const backup = JSON.stringify({
            timestamp: new Date().toISOString(),
            path: this.filePath,
            ...this.data
        }, null, 2);
        
        const blob = new Blob([backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `secura-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('success', 'Backup créé !');
    }

    // Sélection manuelle (fallback)
    async selectFileManually() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        return new Promise(resolve => {
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return resolve(false);
                
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    this.data = { ...this.data, ...data };
                    localStorage.setItem('secura_file_path', file.name);
                    await this.saveToFile();
                    resolve(true);
                } catch {
                    showNotification('error', 'Fichier JSON invalide');
                    resolve(false);
                }
            };
            input.click();
        });
    }




}

// === INSTANCE GLOBALE ===
const storage = new FileStorage();
window.storage = storage;

// === AUTO-INIT AU DEMARRAGE ===
document.addEventListener('DOMContentLoaded', async () => {
    await storage.init(); 
    loadEvents();   



    // Écouter les mises à jour
    window.addEventListener('secura:data-updated', (e) => {
        console.log('📊 Stats live:', e.detail);
        // Trigger UI updates
        document.dispatchEvent(new CustomEvent('storage:updated', { detail: e.detail }));

         console.log("📂 Données prêtes :", e.detail);
       loadEvents(); 
    
    });

    // Auto-backup toutes les 30min
    setInterval(() => storage.createBackup(), 30 * 60 * 1000);
});


function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}