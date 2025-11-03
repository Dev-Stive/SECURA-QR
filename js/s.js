/**
 * SECURA - Storage Manager
 * Gestion du stockage local des données en JSON
 */

class SecuraStorage {
    constructor() {
        this.EVENTS_KEY = 'secura_events';
        this.GUESTS_KEY = 'secura_guests';
        this.QR_CODES_KEY = 'secura_qr_codes';
        this.SCANS_KEY = 'secura_scans';
        this.SETTINGS_KEY = 'secura_settings';
        this.init();
    }

    init() {
        // Initialiser les clés si elles n'existent pas
        if (!localStorage.getItem(this.EVENTS_KEY)) {
            localStorage.setItem(this.EVENTS_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.GUESTS_KEY)) {
            localStorage.setItem(this.GUESTS_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.QR_CODES_KEY)) {
            localStorage.setItem(this.QR_CODES_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.SCANS_KEY)) {
            localStorage.setItem(this.SCANS_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.SETTINGS_KEY)) {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify({
                theme: 'light',
                language: 'fr'
            }));
        }
    }

    // ===== EVENTS =====
    getAllEvents() {
        try {
            return JSON.parse(localStorage.getItem(this.EVENTS_KEY)) || [];
        } catch (error) {
            console.error('Error loading events:', error);
            return [];
        }
    }

    getEventById(eventId) {
        const events = this.getAllEvents();
        return events.find(e => e.id === eventId);
    }

    saveEvent(event) {
        const events = this.getAllEvents();
        const existingIndex = events.findIndex(e => e.id === event.id);
        
        if (existingIndex !== -1) {
            events[existingIndex] = { ...events[existingIndex], ...event, updatedAt: new Date().toISOString() };
        } else {
            event.id = this.generateId();
            event.createdAt = new Date().toISOString();
            event.updatedAt = new Date().toISOString();
            events.push(event);
        }
        
        localStorage.setItem(this.EVENTS_KEY, JSON.stringify(events));
        return event;
    }

    deleteEvent(eventId) {
        const events = this.getAllEvents();
        const filteredEvents = events.filter(e => e.id !== eventId);
        localStorage.setItem(this.EVENTS_KEY, JSON.stringify(filteredEvents));
        
        // Supprimer aussi les invités associés
        const guests = this.getAllGuests();
        const filteredGuests = guests.filter(g => g.eventId !== eventId);
        localStorage.setItem(this.GUESTS_KEY, JSON.stringify(filteredGuests));
        
        // Supprimer les QR codes associés
        const qrCodes = this.getAllQRCodes();
        const filteredQR = qrCodes.filter(q => q.eventId !== eventId);
        localStorage.setItem(this.QR_CODES_KEY, JSON.stringify(filteredQR));
        
        return true;
    }

    // ===== GUESTS =====
    getAllGuests() {
        try {
            return JSON.parse(localStorage.getItem(this.GUESTS_KEY)) || [];
        } catch (error) {
            console.error('Error loading guests:', error);
            return [];
        }
    }

    getGuestsByEventId(eventId) {
        const guests = this.getAllGuests();
        return guests.filter(g => g.eventId === eventId);
    }

    getGuestById(guestId) {
        const guests = this.getAllGuests();
        return guests.find(g => g.id === guestId);
    }

    saveGuest(guest) {
        const guests = this.getAllGuests();
        const existingIndex = guests.findIndex(g => g.id === guest.id);
        
        if (existingIndex !== -1) {
            guests[existingIndex] = { ...guests[existingIndex], ...guest, updatedAt: new Date().toISOString() };
        } else {
            guest.id = this.generateId();
            guest.createdAt = new Date().toISOString();
            guest.updatedAt = new Date().toISOString();
            guest.status = guest.status || 'pending';
            guest.scanned = false;
            guests.push(guest);
        }
        
        localStorage.setItem(this.GUESTS_KEY, JSON.stringify(guests));
        return guest;
    }

    saveMultipleGuests(guestsArray) {
        const guests = this.getAllGuests();
        guestsArray.forEach(guest => {
            guest.id = this.generateId();
            guest.createdAt = new Date().toISOString();
            guest.updatedAt = new Date().toISOString();
            guest.status = guest.status || 'pending';
            guest.scanned = false;
            guests.push(guest);
        });
        localStorage.setItem(this.GUESTS_KEY, JSON.stringify(guests));
        return guestsArray;
    }

    deleteGuest(guestId) {
        const guests = this.getAllGuests();
        const filteredGuests = guests.filter(g => g.id !== guestId);
        localStorage.setItem(this.GUESTS_KEY, JSON.stringify(filteredGuests));
        
        // Supprimer le QR code associé
        const qrCodes = this.getAllQRCodes();
        const filteredQR = qrCodes.filter(q => q.guestId !== guestId);
        localStorage.setItem(this.QR_CODES_KEY, JSON.stringify(filteredQR));
        
        return true;
    }

    deleteMultipleGuests(guestIds) {
        const guests = this.getAllGuests();
        const filteredGuests = guests.filter(g => !guestIds.includes(g.id));
        localStorage.setItem(this.GUESTS_KEY, JSON.stringify(filteredGuests));
        
        // Supprimer les QR codes associés
        const qrCodes = this.getAllQRCodes();
        const filteredQR = qrCodes.filter(q => !guestIds.includes(q.guestId));
        localStorage.setItem(this.QR_CODES_KEY, JSON.stringify(filteredQR));
        
        return true;
    }

    // ===== QR CODES =====
    getAllQRCodes() {
        try {
            return JSON.parse(localStorage.getItem(this.QR_CODES_KEY)) || [];
        } catch (error) {
            console.error('Error loading QR codes:', error);
            return [];
        }
    }

    getQRCodeByGuestId(guestId) {
        const qrCodes = this.getAllQRCodes();
        return qrCodes.find(q => q.guestId === guestId);
    }

    saveQRCode(qrCode) {
        const qrCodes = this.getAllQRCodes();
        const existingIndex = qrCodes.findIndex(q => q.guestId === qrCode.guestId);
        
        if (existingIndex !== -1) {
            qrCodes[existingIndex] = { ...qrCodes[existingIndex], ...qrCode, updatedAt: new Date().toISOString() };
        } else {
            qrCode.id = this.generateId();
            qrCode.createdAt = new Date().toISOString();
            qrCode.updatedAt = new Date().toISOString();
            qrCodes.push(qrCode);
        }
        
        localStorage.setItem(this.QR_CODES_KEY, JSON.stringify(qrCodes));
        return qrCode;
    }

    // ===== SCANS =====
    getAllScans() {
        try {
            return JSON.parse(localStorage.getItem(this.SCANS_KEY)) || [];
        } catch (error) {
            console.error('Error loading scans:', error);
            return [];
        }
    }

    saveScan(scan) {
        const scans = this.getAllScans();
        scan.id = this.generateId();
        scan.scannedAt = new Date().toISOString();
        scans.push(scan);
        localStorage.setItem(this.SCANS_KEY, JSON.stringify(scans));
        
        // Mettre à jour le statut de l'invité
        const guest = this.getGuestById(scan.guestId);
        if (guest) {
            guest.scanned = true;
            guest.scannedAt = scan.scannedAt;
            this.saveGuest(guest);
        }
        
        return scan;
    }

    getTodayScans() {
        const scans = this.getAllScans();
        const today = new Date().toDateString();
        return scans.filter(s => new Date(s.scannedAt).toDateString() === today);
    }

    // ===== SETTINGS =====
    getSettings() {
        try {
            return JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {};
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    }

    saveSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
        return settings;
    }

    // ===== STATISTICS =====
    getStatistics() {
        const events = this.getAllEvents();
        const guests = this.getAllGuests();
        const qrCodes = this.getAllQRCodes();
        const scans = this.getAllScans();
        const todayScans = this.getTodayScans();
        
        return {
            totalEvents: events.length,
            totalGuests: guests.length,
            totalQRCodes: qrCodes.length,
            totalScans: scans.length,
            todayScans: todayScans.length,
            scannedGuests: guests.filter(g => g.scanned).length
        };
    }

    // ===== EXPORT/IMPORT =====
    exportToJSON(type = 'all') {
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: {}
        };
        
        if (type === 'all' || type === 'events') {
            data.data.events = this.getAllEvents();
        }
        if (type === 'all' || type === 'guests') {
            data.data.guests = this.getAllGuests();
        }
        if (type === 'all' || type === 'qrcodes') {
            data.data.qrCodes = this.getAllQRCodes();
        }
        if (type === 'all' || type === 'scans') {
            data.data.scans = this.getAllScans();
        }
        
        return JSON.stringify(data, null, 2);
    }

    exportToCSV(eventId) {
        const guests = this.getGuestsByEventId(eventId);
        const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Notes', 'Statut', 'Scanné'];
        
        const csvRows = [headers.join(',')];
        guests.forEach(guest => {
            const row = [
                this.escapeCSV(guest.firstName),
                this.escapeCSV(guest.lastName),
                this.escapeCSV(guest.email),
                this.escapeCSV(guest.phone || ''),
                this.escapeCSV(guest.company || ''),
                this.escapeCSV(guest.notes || ''),
                guest.status || 'pending',
                guest.scanned ? 'Oui' : 'Non'
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    escapeCSV(str) {
        if (str === null || str === undefined) return '';
        str = String(str);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    importFromJSON(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.data) {
                if (data.data.events) {
                    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(data.data.events));
                }
                if (data.data.guests) {
                    localStorage.setItem(this.GUESTS_KEY, JSON.stringify(data.data.guests));
                }
                if (data.data.qrCodes) {
                    localStorage.setItem(this.QR_CODES_KEY, JSON.stringify(data.data.qrCodes));
                }
                if (data.data.scans) {
                    localStorage.setItem(this.SCANS_KEY, JSON.stringify(data.data.scans));
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error importing JSON:', error);
            return false;
        }
    }

    // ===== UTILITIES =====
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    clearAllData() {
        localStorage.removeItem(this.EVENTS_KEY);
        localStorage.removeItem(this.GUESTS_KEY);
        localStorage.removeItem(this.QR_CODES_KEY);
        localStorage.removeItem(this.SCANS_KEY);
        this.init();
    }

    // Créer une sauvegarde complète
    createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            events: this.getAllEvents(),
            guests: this.getAllGuests(),
            qrCodes: this.getAllQRCodes(),
            scans: this.getAllScans(),
            settings: this.getSettings()
        };
        return JSON.stringify(backup);
    }

    // Restaurer depuis une sauvegarde
    restoreBackup(backupJson) {
        try {
            const backup = JSON.parse(backupJson);
            if (backup.events) {
                localStorage.setItem(this.EVENTS_KEY, JSON.stringify(backup.events));
            }
            if (backup.guests) {
                localStorage.setItem(this.GUESTS_KEY, JSON.stringify(backup.guests));
            }
            if (backup.qrCodes) {
                localStorage.setItem(this.QR_CODES_KEY, JSON.stringify(backup.qrCodes));
            }
            if (backup.scans) {
                localStorage.setItem(this.SCANS_KEY, JSON.stringify(backup.scans));
            }
            if (backup.settings) {
                localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(backup.settings));
            }
            return true;
        } catch (error) {
            console.error('Error restoring backup:', error);
            return false;
        }
    }
}

// Instance globale
const storage = new SecuraStorage();

// Export pour utilisation dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecuraStorage;
}