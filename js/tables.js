/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        🏓 SECURA TABLES MANAGER - ULTRA COMPLET V2.0        ║
 * ║       Gestion intelligente des tables et numérotation       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

class TablesManager {
    constructor() {
        this.currentEvent = null;
        this.currentUser = null;
        this.allTables = [];
        this.filteredTables = [];
        this.availableGuests = [];
        this.tableNumberCache = new Map(); // Cache pour éviter les doublons
        
        this.init();
    }
    
    init() {
        console.log('🏓 Tables Manager initialisé');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Écoute les événements de mise à jour
        window.addEventListener('secura:data-updated', () => this.refreshTables());
        storage.on('table:created', () => this.refreshTables());
        storage.on('table:updated', () => this.refreshTables());
        storage.on('table:deleted', () => this.refreshTables());
        storage.on('guest:updated', () => this.refreshTables());
    }
    
    /**
     * Définir l'événement courant
     */
    setCurrentEvent(event) {
        this.currentEvent = event;
        this.tableNumberCache.clear(); // Vider le cache pour le nouvel événement
        console.log(`🏓 Événement défini: ${event.name} (${event.id})`);
    }
    
    /**
     * Définir l'utilisateur courant
     */
    setCurrentUser(user) {
        this.currentUser = user;
    }
    
    /**
     * Générer un numéro de table unique basé sur le type d'événement
     * Format: INITIALES-TYPE-XX (ex: MR-01 pour Mariage, CF-01 pour Conférence)
     */
    generateUniqueTableNumber() {
        if (!this.currentEvent) {
            console.error('❌ Aucun événement défini pour générer le numéro');
            return 'TBL-01';
        }
        
        const eventType = this.currentEvent.type || 'autre';
        const initials = this.getEventTypeInitials(eventType);
        
        // Chercher le prochain numéro disponible
        let number = 1;
        let tableNumber;
        
        do {
            tableNumber = `${initials}-${String(number).padStart(2, '0')}`;
            number++;
            
            // Limite de sécurité pour éviter une boucle infinie
            if (number > 99) {
                console.warn('⚠️ Limite de 99 tables atteinte pour cet événement');
                tableNumber = `${initials}-${Date.now().toString().slice(-2)}`;
                break;
            }
        } while (this.isTableNumberExists(tableNumber));
        
        // Ajouter au cache
        this.tableNumberCache.set(tableNumber, true);
        
        console.log(`🔢 Numéro généré: ${tableNumber} pour ${eventType}`);
        return tableNumber;
    }
    
    /**
     * Obtenir les initiales du type d'événement
     */
    getEventTypeInitials(type) {
        const typeMap = {
            'marriage': 'MR',
            'anniversaire': 'AN',
            'conference': 'CF',
            'corporate': 'CP',
            'concert': 'CN',
            'gala': 'GL',
            'football': 'FB',
            'sport': 'SP',
            'culturel': 'CL',
            'formation': 'FM',
            'seminaire': 'SM',
            'workshop': 'WS',
            'exposition': 'EX',
            'vernissage': 'VN',
            'lancement': 'LN',
            'inauguration': 'IG',
            'reception': 'RC',
            'cocktail': 'CK',
            'diner': 'DN',
            'dejeuner': 'DJ',
            'petit-dejeuner': 'PD',
            'brunch': 'BR',
            'afterwork': 'AW',
            'team-building': 'TB',
            'autre': 'TB' // Table par défaut
        };
        
        return typeMap[type] || type.substring(0, 2).toUpperCase() || 'TB';
    }
    
    /**
     * Vérifier si un numéro de table existe déjà
     */
    isTableNumberExists(tableNumber) {
        if (this.tableNumberCache.has(tableNumber)) {
            return true;
        }
        
        // Vérifier dans les tables existantes
        const exists = this.allTables.some(table => 
            table.tableNumber === tableNumber
        );
        
        if (exists) {
            this.tableNumberCache.set(tableNumber, true);
        }
        
        return exists;
    }
    
    /**
     * Charger toutes les tables de l'événement
     */
    async loadTables() {
        if (!this.currentEvent) {
            console.error('❌ Aucun événement défini');
            throw new Error('Aucun événement défini');
        }
        
        try {
            console.log(`🔄 Chargement des tables pour: ${this.currentEvent.name}`);
            
            // Réinitialiser le cache
            this.tableNumberCache.clear();
            
            // Charger depuis le stockage
            this.allTables = await storage.getAllTables(this.currentEvent.id);
            
            // Mettre à jour le cache
            this.allTables.forEach(table => {
                if (table.tableNumber) {
                    this.tableNumberCache.set(table.tableNumber, true);
                }
            });
            
            // Trier par numéro de table
            this.allTables.sort(this.sortTablesByNumber);
            
            console.log(`✅ ${this.allTables.length} tables chargées`);
            return this.allTables;
            
        } catch (error) {
            console.error('❌ Erreur chargement tables:', error);
            throw error;
        }
    }
    
    /**
     * Trier les tables par numéro
     */
    sortTablesByNumber(a, b) {
        // Extraire les parties numérique et alphabétique
        const extractParts = (tableNumber) => {
            if (!tableNumber) return { alpha: '', num: 0 };
            
            const match = tableNumber.match(/^([A-Z]+)-?(\d+)$/i);
            if (match) {
                return { alpha: match[1].toUpperCase(), num: parseInt(match[2]) };
            }
            
            // Fallback pour les formats non standard
            const numMatch = tableNumber.match(/\d+/);
            return {
                alpha: tableNumber.replace(/\d+/g, '').toUpperCase(),
                num: numMatch ? parseInt(numMatch[0]) : 0
            };
        };
        
        const partsA = extractParts(a.tableNumber);
        const partsB = extractParts(b.tableNumber);
        
        // Comparer les parties alphabétiques
        if (partsA.alpha < partsB.alpha) return -1;
        if (partsA.alpha > partsB.alpha) return 1;
        
        // Comparer les parties numériques
        return partsA.num - partsB.num;
    }
    
    /**
     * Créer une nouvelle table
     */
    async createTable(tableData) {
        if (!this.currentEvent) {
            throw new Error('Aucun événement défini');
        }
        
        try {
            // Générer un numéro unique si non fourni
            if (!tableData.tableNumber) {
                tableData.tableNumber = this.generateUniqueTableNumber();
            } else {
                // Vérifier l'unicité du numéro fourni
                if (this.isTableNumberExists(tableData.tableNumber)) {
                    throw new Error(`Le numéro de table ${tableData.tableNumber} existe déjà`);
                }
            }
            
            // Ajouter l'ID de l'événement
            tableData.eventId = this.currentEvent.id;
            
            // Ajouter des valeurs par défaut
            const completeTableData = {
                ...tableData,
                capacity: parseInt(tableData.capacity) || 8,
                category: tableData.category || 'standard',
                status: 'active',
                isActive: true,
                assignedGuests: [],
                guestCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log(`➕ Création table: ${completeTableData.tableNumber}`);
            
            // Sauvegarder via storage
            const savedTable = await storage.createTable(this.currentEvent.id, completeTableData);
            
            // Mettre à jour le cache
            if (savedTable && savedTable.tableNumber) {
                this.tableNumberCache.set(savedTable.tableNumber, true);
            }
            
            // Mettre à jour les données locales
            await this.loadTables();
            
            console.log(`✅ Table créée: ${savedTable.tableNumber}`);
            return savedTable;
            
        } catch (error) {
            console.error('❌ Erreur création table:', error);
            throw error;
        }
    }
    
    /**
     * Mettre à jour une table existante
     */
    async updateTable(tableId, updates) {
        try {
            // Vérifier l'unicité du nouveau numéro si fourni
            if (updates.tableNumber) {
                const existingTable = this.allTables.find(t => t.id === tableId);
                if (existingTable && existingTable.tableNumber !== updates.tableNumber) {
                    if (this.isTableNumberExists(updates.tableNumber)) {
                        throw new Error(`Le numéro de table ${updates.tableNumber} existe déjà`);
                    }
                }
            }
            
            console.log(`🔄 Mise à jour table: ${tableId}`);
            
            // Mettre à jour via storage
            const updatedTable = await storage.updateTable(tableId, updates);
            
            // Mettre à jour le cache si le numéro a changé
            if (updatedTable && updatedTable.tableNumber) {
                const oldTable = this.allTables.find(t => t.id === tableId);
                if (oldTable && oldTable.tableNumber !== updatedTable.tableNumber) {
                    this.tableNumberCache.delete(oldTable.tableNumber);
                    this.tableNumberCache.set(updatedTable.tableNumber, true);
                }
            }
            
            // Mettre à jour les données locales
            await this.loadTables();
            
            console.log(`✅ Table mise à jour: ${updatedTable?.tableNumber}`);
            return updatedTable;
            
        } catch (error) {
            console.error('❌ Erreur mise à jour table:', error);
            throw error;
        }
    }
    
    /**
     * Supprimer une table
     */
    async deleteTable(tableId) {
        try {
            const table = this.allTables.find(t => t.id === tableId);
            if (!table) {
                throw new Error('Table introuvable');
            }
            
            console.log(`🗑️ Suppression table: ${table.tableNumber}`);
            
            // Supprimer via storage
            await storage.deleteTable(tableId);
            
            // Retirer du cache
            if (table.tableNumber) {
                this.tableNumberCache.delete(table.tableNumber);
            }
            
            // Mettre à jour les données locales
            await this.loadTables();
            
            console.log(`✅ Table supprimée: ${table.tableNumber}`);
            return true;
            
        } catch (error) {
            console.error('❌ Erreur suppression table:', error);
            throw error;
        }
    }
    
    /**
     * Assigner un invité à une table
     */
    async assignGuestToTable(tableId, guestId, seats = 1) {
        try {
            const table = this.allTables.find(t => t.id === tableId);
            if (!table) {
                throw new Error('Table introuvable');
            }
            
            // Vérifier la capacité disponible
            const totalSeats = table.assignedGuests?.reduce((sum, g) => sum + (g.seats || 1), 0) || 0;
            const availableSeats = Math.max(0, table.capacity - totalSeats);
            
            if (seats > availableSeats) {
                throw new Error(`Places insuffisantes. Disponible: ${availableSeats}, Demandé: ${seats}`);
            }
            
            console.log(`👥 Assignation invité ${guestId} à table ${table.tableNumber}`);
            
            // Assigner via storage
            const result = await storage.assignGuestToTable(tableId, guestId, seats);
            
            // Mettre à jour les données locales
            await this.loadTables();
            
            console.log(`✅ Invité assigné à table ${table.tableNumber}`);
            return result;
            
        } catch (error) {
            console.error('❌ Erreur assignation invité:', error);
            throw error;
        }
    }
    
   
    
    /**
     * Assigner plusieurs invités à une table
     */
    async assignMultipleGuests(tableId, guestIds, options = {}) {
        try {
            const table = this.allTables.find(t => t.id === tableId);
            if (!table) {
                throw new Error('Table introuvable');
            }
            
            console.log(`👥👥 Assignation multiple à table ${table.tableNumber}`);
            
            // Assigner via storage
            const result = await storage.assignMultipleGuests(tableId, guestIds, options);
            
            // Mettre à jour les données locales
            await this.loadTables();
            
            console.log(`✅ ${result.assigned?.length || 0} invité(s) assigné(s)`);
            return result;
            
        } catch (error) {
            console.error('❌ Erreur assignation multiple:', error);
            throw error;
        }
    }
    
    /**
     * Réassigner un invité d'une table à une autre
     */
    async reassignGuest(guestId, fromTableId, toTableId) {
        try {
            console.log(`🔄 Réassignation invité ${guestId}`);
            
            // Récupérer les informations de l'invité
            const guest = storage.getGuestById(guestId);
            if (!guest) {
                throw new Error('Invité introuvable');
            }
            
            // Retirer de l'ancienne table
            if (fromTableId) {
                await this.removeGuestFromTable(fromTableId, guestId);
            }
            
            // Assigner à la nouvelle table
            if (toTableId) {
                await this.assignGuestToTable(toTableId, guestId, guest.seats || 1);
            }
            
            console.log(`✅ Invité réassigné`);
            return true;
            
        } catch (error) {
            console.error('❌ Erreur réassignation:', error);
            throw error;
        }
    }
    
    /**
     * Générer le QR Code d'une table
     */
    async generateTableQR(tableId) {
        try {
            console.log(`📱 Génération QR Code table ${tableId}`);
            
            // Générer via storage
            const qrCode = await storage.generateTableQR(tableId);
            
            console.log(`✅ QR Code généré`);
            return qrCode;
            
        } catch (error) {
            console.error('❌ Erreur génération QR:', error);
            throw error;
        }
    }
    
    /**
     * Scanner le QR Code d'une table
     */
    async scanTableQR(tableId) {
        try {
            console.log(`📱 Scan QR Code table ${tableId}`);
            
            // Scanner via storage
            const result = await storage.scanTableQR(tableId);
            
            console.log(`✅ Table scannée`);
            return result;
            
        } catch (error) {
            console.error('❌ Erreur scan table:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir les statistiques d'une table
     */
    async getTableStatistics(tableId) {
        try {
            // Obtenir via storage
            const stats = await storage.getTableStatistics(tableId);
            
            return stats;
            
        } catch (error) {
            console.error('❌ Erreur statistiques table:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir les statistiques de toutes les tables de l'événement
     */
    async getEventTablesStats() {
        if (!this.currentEvent) {
            throw new Error('Aucun événement défini');
        }
        
        try {
            // Obtenir via storage
            const stats = await storage.getEventTablesStats(this.currentEvent.id);
            
            return stats;
            
        } catch (error) {
            console.error('❌ Erreur statistiques événement:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir les tables disponibles pour un nombre de places
     */
    getAvailableTables(requiredSeats = 1) {
        return this.allTables
            .map(table => {
                const totalSeats = table.assignedGuests?.reduce((sum, g) => sum + (g.seats || 1), 0) || 0;
                const available = table.capacity - totalSeats;
                
                return {
                    ...table,
                    availableSeats: available,
                    canAccommodate: available >= requiredSeats,
                    occupancyRate: table.capacity > 0 ? Math.round((totalSeats / table.capacity) * 100) : 0
                };
            })
            .filter(t => t.canAccommodate)
            .sort((a, b) => b.availableSeats - a.availableSeats);
    }
    
    /**
     * Auto-assigner les invités non assignés
     */
    async autoAssignGuests(strategy = 'balanced') {
        if (!this.currentEvent) {
            throw new Error('Aucun événement défini');
        }
        
        try {
            console.log(`🤖 Auto-assignation (stratégie: ${strategy})`);
            
            // Auto-assigner via storage
            const result = await storage.autoAssignGuests(this.currentEvent.id, strategy);
            
            // Mettre à jour les données locales
            await this.loadTables();
            
            console.log(`✅ ${result.assigned?.length || 0} invité(s) auto-assigné(s)`);
            return result;
            
        } catch (error) {
            console.error('❌ Erreur auto-assignation:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir les invités d'une table
     */
    async getTableGuests(tableId) {
        try {
            // Obtenir via storage
            const guests = await storage.getTableGuests(tableId);
            
            return guests;
            
        } catch (error) {
            console.error('❌ Erreur récupération invités table:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir la table d'un invité
     */
    async getGuestTable(guestId) {
        try {
            // Obtenir via storage
            const table = await storage.getGuestTable(guestId);
            
            return table;
            
        } catch (error) {
            console.error('❌ Erreur récupération table invité:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir les invités disponibles (non assignés)
     */
    async getAvailableGuests(tableId = null) {
        if (!this.currentEvent) {
            throw new Error('Aucun événement défini');
        }
        
        try {
            // Récupérer tous les invités de l'événement
            const allGuests = await storage.getAllGuests({ eventId: this.currentEvent.id });
            
            // Filtrer les invités non assignés ou assignés à cette table (pour édition)
            this.availableGuests = allGuests.filter(guest => 
                !guest.tableId || (tableId && guest.tableId === tableId)
            );
            
            return this.availableGuests;
            
        } catch (error) {
            console.error('❌ Erreur récupération invités disponibles:', error);
            throw error;
        }
    }
    
    /**
     * Filtrer les invités disponibles par recherche
     */
    filterAvailableGuests(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            return this.availableGuests;
        }
        
        const term = searchTerm.toLowerCase();
        return this.availableGuests.filter(guest =>
            guest.firstName?.toLowerCase().includes(term) ||
            guest.lastName?.toLowerCase().includes(term) ||
            guest.email?.toLowerCase().includes(term) ||
            guest.company?.toLowerCase().includes(term)
        );
    }
    
    /**
     * Exporter les tables en CSV
     */
    exportTablesToCSV(tables = this.allTables) {
        try {
            const headers = [
                'Numéro', 'Nom', 'Capacité', 'Invités assignés', 
                'Places occupées', 'Places disponibles', 'Taux occupation', 
                'Emplacement', 'Catégorie', 'Description', 'Statut'
            ];
            
            const rows = [headers.join(',')];
            
            tables.forEach(table => {
                const totalSeats = table.assignedGuests?.reduce((sum, g) => sum + (g.seats || 1), 0) || 0;
                const availableSeats = Math.max(0, table.capacity - totalSeats);
                const occupancyRate = table.capacity > 0 ? 
                    Math.round((totalSeats / table.capacity) * 100) : 0;
                
                const status = totalSeats >= table.capacity ? 'Complète' : 
                              totalSeats === 0 ? 'Vide' : 'Partiellement occupée';
                
                const row = [
                    `"${table.tableNumber || ''}"`,
                    `"${table.tableName || ''}"`,
                    table.capacity,
                    table.assignedGuests?.length || 0,
                    totalSeats,
                    availableSeats,
                    `${occupancyRate}%`,
                    `"${table.location || ''}"`,
                    `"${table.category || 'standard'}"`,
                    `"${(table.description || '').replace(/"/g, '""')}"`,
                    `"${status}"`
                ].map(v => (typeof v === 'string' && v.startsWith('"') ? v : `"${v}"`)).join(',');
                
                rows.push(row);
            });
            
            const csv = rows.join('\n');
            const filename = `secura-tables-${this.currentEvent?.name || 'event'}-${new Date().toISOString().split('T')[0]}.csv`;
            
            // Créer et télécharger le fichier
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            
            console.log(`✅ ${tables.length} tables exportées`);
            return true;
            
        } catch (error) {
            console.error('❌ Erreur export CSV:', error);
            throw error;
        }
    }
    
    /**
     * Obtenir des suggestions de numéros de table
     */
    getTableNumberSuggestions(count = 5) {
        if (!this.currentEvent) {
            return [];
        }
        
        const eventType = this.currentEvent.type || 'autre';
        const initials = this.getEventTypeInitials(eventType);
        const suggestions = [];
        
        for (let i = 1; i <= count; i++) {
            const number = `${initials}-${String(i).padStart(2, '0')}`;
            if (!this.isTableNumberExists(number)) {
                suggestions.push(number);
            }
        }
        
        return suggestions;
    }
    
    /**
     * Valider un numéro de table
     */
    validateTableNumber(tableNumber) {
        if (!tableNumber || tableNumber.trim() === '') {
            return { valid: false, message: 'Le numéro de table est requis' };
        }
        
        // Format attendu: INITIALES-NUM (ex: MR-01, CF-12)
        const pattern = /^[A-Z]{2,3}-\d{2,3}$/;
        if (!pattern.test(tableNumber.toUpperCase())) {
            return { 
                valid: false, 
                message: 'Format invalide. Utilisez: INITIALES-NUM (ex: MR-01)' 
            };
        }
        
        // Vérifier l'unicité
        if (this.isTableNumberExists(tableNumber.toUpperCase())) {
            return { 
                valid: false, 
                message: 'Ce numéro de table existe déjà' 
            };
        }
        
        return { valid: true, message: 'Numéro valide' };
    }
    
    /**
     * Rafraîchir les tables (pour les événements)
     */
    async refreshTables() {
        if (this.currentEvent) {
            await this.loadTables();
        }
    }
    
    /**
     * Obtenir les couleurs pour les catégories de tables
     */
    getCategoryColor(category) {
        const colors = {
            'standard': '#D97706',
            'vip': '#8B5CF6',
            'family': '#3B82F6',
            'speaker': '#10B981',
            'organizer': '#EC4899',
            'staff': '#6B7280',
            'press': '#F59E0B',
            'sponsor': '#6366F1',
            'other': '#78716C'
        };
        
        return colors[category] || colors.standard;
    }
    
    /**
     * Obtenir l'icône pour les catégories de tables
     */
    getCategoryIcon(category) {
        const icons = {
            'standard': 'fa-chair',
            'vip': 'fa-crown',
            'family': 'fa-home',
            'speaker': 'fa-microphone',
            'organizer': 'fa-user-tie',
            'staff': 'fa-user-shield',
            'press': 'fa-camera',
            'sponsor': 'fa-handshake',
            'other': 'fa-star'
        };
        
        return icons[category] || icons.standard;
    }
    
    /**
     * Formater une table pour l'affichage
     */
    formatTableForDisplay(table) {
        if (!table) return null;
        
        const totalSeats = table.assignedGuests?.reduce((sum, g) => sum + (g.seats || 1), 0) || 0;
        const availableSeats = Math.max(0, table.capacity - totalSeats);
        const occupancyRate = table.capacity > 0 ? Math.round((totalSeats / table.capacity) * 100) : 0;
        
        return {
            ...table,
            totalSeats,
            availableSeats,
            occupancyRate,
            isFull: totalSeats >= table.capacity,
            isEmpty: totalSeats === 0,
            status: totalSeats >= table.capacity ? 'Complète' : 
                   totalSeats === 0 ? 'Vide' : 'Partiellement occupée',
            statusColor: totalSeats >= table.capacity ? '#EF4444' : 
                        totalSeats === 0 ? '#10B981' : '#F59E0B',
            categoryColor: this.getCategoryColor(table.category),
            categoryIcon: this.getCategoryIcon(table.category)
        };
    }
    
    /**
     * Nettoyer les ressources
     */
    destroy() {
        this.tableNumberCache.clear();
        this.allTables = [];
        this.filteredTables = [];
        this.availableGuests = [];
        this.currentEvent = null;
        this.currentUser = null;
        
        console.log('🏓 Tables Manager nettoyé');
    }
}

const tablesManager = new TablesManager();
window.tablesManager = tablesManager;

// Exporter pour les modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TablesManager, tablesManager };
}

console.log('✅ Tables Manager chargé et prêt !');