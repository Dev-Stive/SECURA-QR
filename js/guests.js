/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           👥 SECURA GUESTS MANAGEMENT ULTIMATE 👥             ║
 * ║                                                               ║
 * ║  🎯 Système complet de gestion d'invités                     ║
 * ║  📊 Vues multiples (grid, table, stats)                      ║
 * ║  🎨 Modal de création en 5 étapes                            ║
 * ║  📥 Import/Export CSV/JSON                                   ║
 * ║  ⚡ Mises à jour granulaire en temps réel                    ║
 * ║  🔄 Synchronisation complète avec tables.html                ║
 * ║  🪑 Gestion avancée des tables et assignation                ║
 * ║  📱 Interface responsive avec animations                     ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

// ============================================================
// 🎮 VARIABLES GLOBALES
// ============================================================
let currentEventId = null;
let currentEvent = null;
let currentGuests = [];
let filteredGuests = [];
let selectedGuests = [];
let guestRowCache = new Map();
let guestCardCache = new Map();
let isRenderingGuests = false;

// Variables de configuration
let currentView = 'grid'; // 'grid', 'table', 'stats'
let currentFilter = 'all'; // 'all', 'confirmed', 'pending', 'checkedin', 'cancelled', 'vip'
let currentSearch = '';
let currentPage = 1;
const guestsPerPage = 12;
let eventsViewMode = 'grid'; // Pour la vue événements
let eventsList = [];
let currentUser = null;

// Variables pour la création d'invités
let creationStep = 1;
let guestCreationData = {};
let availableTablesList = [];
let selectedTableId = null;
let isEditingGuest = false;
let editingGuestId = null;

// Variables pour les graphiques
let statusChart = null;
let tableDistributionChart = null;
let guestsStatsChart = null;
let tablesDistributionChart = null;

// Variables pour les modals
let currentModal = null;

const genderLabels = {
    '': '-- Sélectionner --',
    'm': 'Homme',
    'f': 'Femme',
    'homme': 'Homme',
    'femme': 'Femme',
    'couple': 'Couple',
    'maman': 'Maman',
    'autre': 'Autre'
};

// 🔧 FONCTION UTILITAIRE POUR FORMATER LE GENRE
function formatGender(genderValue) {
    if (!genderValue) return '—';
    const normalized = genderValue.toLowerCase();
    return genderLabels[normalized] || genderValue;
}

// ============================================================
// 🚀 INITIALISATION PRINCIPALE - UNIFIED SYSTEM
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {


    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event');

    initListeners();
    initializeGuestSystem();
    //setupGranularGuestListeners();
    
    
    eventsList = await storage.getAllEvents();
    currentUser = await storage.getProfile();

    if (eventId) {
        
        document.getElementById('eventsHomeView').style.display = 'none';
        document.getElementById('guestsView').style.display = 'block';
        currentEventId = eventId;
        
        // Réinitialiser le cache des tables
        cachedEventTables = null;
        cachedEventTablesId = null;

        await loadGuestsForEvent(eventId);
        await selectEvent(eventId);
        
    } else {
        
        document.getElementById('eventsHomeView').style.display = 'block';
        document.getElementById('guestsView').style.display = 'none';
        initListeners();
        await showEventsHome();
        document.getElementById('searchEvents')?.focus();
    }
    
});

// ============================================================
// 📋 INITIALISATION DES ÉCOUTEURS
// ============================================================
function initListeners() {


     document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mode = this.dataset.mode;
            
            document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            eventsViewMode = mode;
            
            renderEventsList();
        });
    });
    
     const searchInput = document.getElementById('searchEvents');
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', function() {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        const searchTerm = this.value.trim().toLowerCase();
                        if (searchTerm) {
                            const filteredEvents = eventsList.filter(event =>
                                event.name.toLowerCase().includes(searchTerm) ||
                                event.location?.toLowerCase().includes(searchTerm) ||
                                event.type?.toLowerCase().includes(searchTerm)
                            );
                            eventsList = filteredEvents;
                        } else {
                            loadEventsList();
                        }
                    }, 300);
                });
            }
        
    
    
    const backBtn = document.getElementById('backToEventsBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'guests.html';
        });
    }
    
    const createButtons = [
        'createGuestBtn', 'createGuestBtnTable', 'createGuestBtnStats',
        'createFirstGuest', 'createFirstGuestTable', 'createFirstGuestStats'
    ];
    
    createButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                openGuestModal();
            });
        }
    });
    
    const importCsvBtn = document.getElementById('importCsvBtn');
    if (importCsvBtn) {
        importCsvBtn.addEventListener('click', () => {
            openCSVImportModal();
        });
    }
    
    const bulkActionsBtn = document.getElementById('bulkActionsBtn');
    if (bulkActionsBtn) {
        bulkActionsBtn.addEventListener('click', () => {
            showBulkActionsModal();
        });
    }


      
    const searchInputs = [
        'searchGuests',
        'searchGuestsTable',
        'searchGuestsStats'
    ];
    
    searchInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            let searchTimeout;
            input.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    currentSearch = this.value.trim();
                    currentPage = 1;
                    console.log(`🔎 Recherche: "${currentSearch}"`);
                    applyFilters();
                    renderCurrentView();
                }, 300);
            });
        }
    });

     document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const filter = this.dataset.filter;
            
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            currentFilter = filter;
            currentPage = 1;
            applyFilters();
            renderCurrentView();
        });
    });

      document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.classList.contains('create')) return;
            
            const view = this.dataset.view;
            
            document.querySelectorAll('.view-btn[data-view]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentView = view;
            currentPage = 1;

            ['grid', 'table', 'stats'].forEach(v => {
                const container = document.getElementById(`${v}View`);
                if (container) {
                    container.style.display = v === currentView ? 'block' : 'none';
                }
            });
            
            updateViewHeader(currentView);
            renderCurrentView();
            
            // Restaurer les sélections après changement de vue
            restoreSelectionsForPage();
            updateSelectionInfo();
        });
    });

     const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            exportGuestsToCSV();
        });
    }
    
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
            exportGuestsToJSON();
        });
    }
    
    const exportInvitationsBtn = document.getElementById('exportInvitationsBtn');
    if (exportInvitationsBtn) {
        exportInvitationsBtn.addEventListener('click', () => {
            exportInvitationsCSV();
        });
    }
    
}



// ============================================================
// 👥 INITIALISATION DU SYSTÈME COMPLET DE GESTION DES INVITÉS
// ============================================================
function initializeGuestSystem() {
    
    initializeCreationModalListeners();
    initializeCSVImportListeners();
    initializeBulkActions();
    
}




// ============================================================
// 🎨 MISE À JOUR DE L'EN-TÊTE DE VUE
// ============================================================
function updateViewHeader(view) {
    
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    ['grid', 'table', 'stats'].forEach(v => {
        const container = document.getElementById(`${v}View`);
        if (container) {
            container.style.display = v === view ? 'block' : 'none';
        }
    });
}

/*

window.selectEvent = selectEvent;
window.openGuestModal = openGuestModal;
window.closeGuestModal = closeGuestModal;
window.viewGuestQR = viewGuestQR;
window.shareGuestQR = shareGuestQR;
window.deleteGuest = deleteGuest;
window.handleGuestSelect = handleGuestSelect;
window.changePage = changePage;
window.openCSVImportModal = openCSVImportModal;
window.closeCSVImportModal = closeCSVImportModal;
window.openQRPreviewModal = openQRPreviewModal;
window.closeQRPreviewModal = closeQRPreviewModal;
window.exportGuestsToCSV = exportGuestsToCSV;
window.exportGuestsToJSON = exportGuestsToJSON;
window.clearSelection = clearSelection;
window.bulkConfirmGuests = bulkConfirmGuests;
window.bulkDeleteGuests = bulkDeleteGuests;
window.manageGuestTable = manageGuestTable;
window.bulkAssignToTable = bulkAssignToTable;
window.selectTableForGuest = selectTableForGuest;
window.deselectTable = deselectTable;
window.generateTicketForGuest = generateTicketForGuest;
window.openGuestDetails = openGuestDetails;
window.toggleGuestRowDetails = toggleGuestRowDetails;
window.moveGuestToAnotherTable = moveGuestToAnotherTable;
window.addGuestToTable = addGuestToTable;


*/

        async function showEventsHome() {
     
            currentEvent = null;
            document.getElementById('eventsHomeView').style.display = 'block';
            document.getElementById('guestsView').style.display = 'none';
            document.title = 'SECURA | Sélectionnez un événement';
            await loadEventsList();
        }


async function showInvalidEventError(eventId) {
    const container = document.getElementById('mainContent');
    const loader = document.getElementById('eventsLoader');
    
    if (loader) loader.style.display = 'none';
    
    container.innerHTML = `
        <div class="empty-state animate-fade-in">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Événement introuvable</h3>
            <p>ID: <strong>${eventId}</strong></p>
            <button class="btn btn-primary" onclick="window.location.href='guests.html'">
                <i class="fas fa-arrow-left"></i> Retour à la liste
            </button>
        </div>
    `;
    
    console.error(`❌ Événement introuvable: ${eventId}`);
}

// ============================================================
// 🎴 VUE ÉVÉNEMENTS - LISTE DES ÉVÉNEMENTS
// ============================================================


        


        // Charger la liste des événements
        async function loadEventsList() {
            try {
                eventsList = await storage.getAllEvents();
                currentUser = await storage.getProfile();
                
                if (currentUser.role !== 'admin') {
                    eventsList = eventsList.filter(event => 
                        event.organizerId == currentUser.id
                    );
                }
            
                if (eventsList.length === 0) {
                    document.getElementById('emptyEventsState').style.display = 'flex';
                    document.getElementById('eventsGridView').style.display = 'none';
                    document.getElementById('eventsTableView').style.display = 'none';
                    return;
                }
                
                document.getElementById('emptyEventsState').style.display = 'none';
                renderEventsList();
                
            } catch (error) {
                console.error('Erreur chargement événements:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur',
                    text: 'Impossible de charger la liste des événements',
                    confirmButtonColor: '#D97706'
                });
            }
        }



function renderEventsList() {
    if (eventsViewMode === 'grid') {
        renderEventsGrid();
    } else {
        renderEventsTable();
    }
}

        // Rendre la vue grille
        async function renderEventsGrid() {
            
            const grid = document.getElementById('eventsGridView');
            grid.innerHTML = '';
            grid.style.display = 'grid';
            document.getElementById('eventsTableView').style.display = 'none';

            console.log(eventsList.length);

             for (const event of eventsList) {
                const tables = await storage.getAllTables(event.id);
                 
                    const guests = storage.getGuestsByEventId(event.id);
                    const scannedGuests = guests.filter(g => g.scanned).length;
                    const eventDate = new Date(event.date);
                    const isUpcoming = eventDate >= new Date();
                    
                    const eventCard = document.createElement('div');
                    eventCard.className = 'event-card-pro';
                    eventCard.style.backgroundImage = `url('${getEventImage(event.type)}')`;
                    eventCard.style.borderLeft = `4px solid ${event.design?.primaryColor || '#D97706'}`;
                    eventCard.onclick = () => selectEvent(event.id);
                    
                    eventCard.innerHTML = `
                        ${isUpcoming ? '<div class="upcoming-ribbon" style="background: linear-gradient(45deg, #3B82F6, #8B5CF6);">À VENIR</div>' : ''}
                        
                        <div class="event-type-badge" style="background: ${getTypeColor(event.type)}">
                            ${getTypeLabel(event.type)}
                        </div>
                        
                        <div class="event-content">
                            <h3 class="event-title">${escapeHtml(event.name)}</h3>
                            
                            <div class="event-meta">
                                <div class="meta-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>${eventDate.toLocaleDateString('fr-FR')}</span>
                                </div>
                                ${event.time ? `
                                <div class="meta-item">
                                    <i class="fas fa-clock"></i>
                                    <span>${event.time}</span>
                                </div>` : ''}
                                ${event.location ? `
                                <div class="meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>${event.location}</span>
                                </div>` : ''}
                            </div>

                            <div class="event-stats-circle">
                                <div class="stat-circle">
                                    <div class="circle" style="border-color: ${event.design?.primaryColor || '#D97706'}20;">
                                        <span class="value">${guests.length}</span>
                                        <span class="label">Invités</span>
                                    </div>
                                </div>
                                <div class="stat-circle">
                                    <div class="circle" style="border-color: #10B98120;">
                                        <span class="value">${tables.count}</span>
                                        <span class="label">Tables</span>
                                    </div>
                                </div>
                                 
                                <div class="stat-circle">
                                    <div class="circle" style="border-color: #3B82F620;">
                                        <span class="value">${event.capacity || '∞'}</span>
                                        <span class="label">Capacité</span>
                                    </div>
                                </div>
                            </div>

                            <div class="event-footer">
                                <div class="event-status" style="background: ${event.active ? '#10B981' : '#EF4444'} !important; color: white">
                                    <i class="fas ${event.active ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                    <span>${event.active ? 'Actif' : 'Inactif'}</span>
                                </div>
                            </div>
                        </div>

                        <div class="event-actions" onclick="event.stopPropagation()">
                            <button class="action-btn view" onclick="viewEvent('${event.id}')" title="Voir invités">
                                <i class="fas fa-users"></i>
                            </button>
                            <button class="action-btn edit" onclick="editEvent('${event.id}')" title="Modifier">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="action-btn duplicate" onclick="duplicateEvent('${event.id}')" title="Dupliquer">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="action-btn stats" onclick="viewEventStats('${event.id}')" title="Statistiques">
                                <i class="fas fa-chart-bar"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteEvent('${event.id}')" title="Supprimer">
                                <i class="bi bi-trash3"></i>
                            </button>
                        </div>
                    `;
                    
                    grid.appendChild(eventCard);
                };
        }

        



        // Rendre la vue tableau
        async function renderEventsTable() {
            const table = document.getElementById('eventsTableBody');
            const grid = document.getElementById('eventsGridView');
            
            grid.style.display = 'none';
            document.getElementById('eventsTableView').style.display = 'block';
            table.innerHTML = '';
            
            eventsList.forEach((event, index) => {
                const tables = storage.getAllTables(event.id);
                const guests = storage.getGuestsByEventId(event.id);
                const scannedGuests = guests.filter(g => g.scanned).length;
                const eventDate = new Date(event.date);
                
                const row = document.createElement('tr');
                row.onclick = () => selectEvent(event.id);
                row.style.cursor = 'pointer';
                
                row.innerHTML = `
                    <td>
                        <div class="event-cell">
                            <div class="event-cell-icon">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                            <div class="event-cell-info">
                                <div class="event-cell-name" title="${escapeHtml(event.name)}">
                                    ${escapeHtml(event.name)}
                                </div>
                                <div class="event-cell-location" title="${event.location || 'Non spécifié'}">
                                    ${escapeHtml(event.location || 'Non spécifié')}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="event-cell-date">
                            ${eventDate.toLocaleDateString('fr-FR')}
                        </div>
                    </td>
                    <td>
                        <div class="event-cell-type" style="background: ${getTypeColor(event.type)}">
                            ${getTypeLabel(event.type)}
                        </div>
                    </td>
                    <td>
                        <div class="event-cell-stats">
                            <div class="event-cell-stat">
                                <span class="event-cell-stat-number">${guests.length}</span>
                                <span class="event-cell-stat-label">Total</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="event-cell-stats">
                            <div class="event-cell-stat">
                                <span class="event-cell-stat-number">${tables.count || 0}</span>
                                <span class="event-cell-stat-label">Tables</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="event-cell-stats">
                            <div class="event-cell-stat">
                                <span class="event-cell-stat-number">${scannedGuests}</span>
                                <span class="event-cell-stat-label">Présents</span>
                            </div>
                            <div class="event-cell-stat">
                                <span class="event-cell-stat-number">${guests.length > 0 ? Math.round((scannedGuests / guests.length) * 100) : 0}%</span>
                                <span class="event-cell-stat-label">Taux</span>
                            </div>
                        </div>
                    </td>
                `;
                
                table.appendChild(row);
            });
        }


async function selectEvent(eventId) {
    console.log(`🎯 Sélection de l'événement: ${eventId}`);
    
    const event = storage.getEventById(eventId);
    if (!event) {
        console.error(`❌ Événement introuvable: ${eventId}`);
        await showInvalidEventError(eventId);
        return;
    }
    
    currentEventId = eventId;
    currentEvent = event;
    
    // Mettre à jour l'URL
    history.pushState({}, '', `?event=${eventId}`);
    
    document.getElementById('eventsHomeView').style.display = 'none';
    document.getElementById('guestsView').style.display = 'block';
    
    document.getElementById('eventNameDisplay').innerHTML = `
        <i class="fas fa-calendar-alt"></i>
        <span>${escapeHtml(event.name)}</span>
    `;
    
    // Afficher le bouton d'import CSV
    const importCsvBtn = document.getElementById('importCsvBtn');
    if (importCsvBtn) {
        importCsvBtn.style.display = 'inline-flex';
    }
    
    document.title = `SECURA | Invités - ${event.name}`;
    
    await loadGuests();
    
}


      async function loadGuestsForEvent(eventId) {
            try {
                currentEvent = storage.getEventById(eventId);
                
                if (!currentEvent) {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Événement introuvable',
                        text: 'L\'événement spécifié n\'existe pas',
                        confirmButtonColor: '#D97706'
                    });
                    showEventsHome();
                    return;
                }
                
                // Vérifier les permissions
                if (currentUser.role !== 'admin' && currentEvent.organizerId !== currentUser.id) {
                    await Swal.fire({
                        icon: 'warning',
                        title: 'Accès refusé',
                        text: 'Vous n\'êtes pas autorisé à gérer cet événement',
                        confirmButtonColor: '#D97706'
                    });
                    showEventsHome();
                    return;
                }
                
                await loadGuests();
                initListeners();
                updateUI();
                
                // Mettre à jour l'affichage
                document.getElementById('eventNameDisplay').innerHTML = `
                    <i class="fas fa-calendar-alt"></i>
                    <span>${escapeHtml(currentEvent.name)}</span>
                `;
                updateEventStatusIndicator();
                
                // Mettre à jour le titre
                document.title = `SECURA | Tables - ${currentEvent.name}`;
                
            } catch (error) {
                console.error('Erreur chargement tables:', error);
                await Swal.fire({
                    icon: 'error',
                    title: 'Erreur',
                    text: 'Impossible de charger les tables',
                    confirmButtonColor: '#D97706'
                });
            }
        }

        // Mettre à jour l'interface
        function updateUI() {
            document.title = `SECURA | Tables - ${currentEvent?.name || 'Événement'}`;
        }

        // Mettre à jour l'indicateur de statut de l'événement
        function updateEventStatusIndicator() {
            const indicator = document.getElementById('eventStatusIndicator');
            if (!currentEvent) return;
            
            let statusText = '';
            let statusClass = '';
            
            switch(currentEvent.status) {
                case 'active':
                    statusText = 'Actif';
                    statusClass = 'status-active';
                    break;
                case 'draft':
                    statusText = 'Brouillon';
                    statusClass = 'status-inactive';
                    break;
                case 'archived':
                    statusText = 'Archivé';
                    statusClass = 'status-inactive';
                    break;
                default:
                    statusText = currentEvent.status;
                    statusClass = 'status-inactive';
            }
            
            indicator.innerHTML = `
                <i class="fas fa-circle"></i>
                <span>${statusText}</span>
            `;
            indicator.className = `status-indicator ${statusClass}`;
            indicator.style.display = 'flex';
        }


// ============================================================
// 📥 CHARGEMENT ET FILTRAGE DES INVITÉS
// ============================================================
async function loadGuests() {
    
    try {
        showLoader('grid');
        
        currentGuests = storage.getGuestsByEventId(currentEventId) || [];
        console.log(`📊 ${currentGuests.length} invité(s) trouvé(s)`);
        
        // Appliquer les filtres initiaux
        applyFilters();
        
        // Mettre à jour les statistiques
        updateStats();
        
        // Rendre la vue actuelle
        renderCurrentView();
        
        hideLoader('grid');
        
        console.log(`✅ ${filteredGuests.length} invité(s) affiché(s) après filtrage`);
        
    } catch (error) {
        console.error('❌ Erreur chargement invités:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Impossible de charger les invités',
            confirmButtonColor: '#D97706'
        });
        hideLoader('grid');
    }
}

function applyFilters() {
    console.log(`🔍 Application des filtres: ${currentFilter}, recherche: "${currentSearch}"`);
    
    // Réinitialiser la page à 1 quand les filtres changent
    currentPage = 1;
    
    // Copier tous les invités
    filteredGuests = [...currentGuests];
    
    // Appliquer le filtre de statut
    if (currentFilter !== 'all') {
        switch(currentFilter) {
            case 'confirmed':
                filteredGuests = filteredGuests.filter(g => 
                    g.status === 'confirmed' || 
                    g.status === 'checked_in' || 
                    g.confirmed === true || 
                    g.scanned === true
                );
                break;
            case 'pending':
                filteredGuests = filteredGuests.filter(g => 
                    (g.status === 'pending' || g.status === null || g.status === undefined) && 
                    !g.confirmed && 
                    !g.scanned
                );
                break;
            case 'checkedin':
                filteredGuests = filteredGuests.filter(g => g.scanned === true || g.status === 'checked_in');
                break;
            case 'cancelled':
                filteredGuests = filteredGuests.filter(g => g.status === 'cancelled');
                break;
            case 'vip':
                filteredGuests = filteredGuests.filter(g => g.type === 'vip' || g.isVIP === true);
                break;
        }
        console.log(`📊 Filtre "${currentFilter}": ${filteredGuests.length} invité(s)`);
    }
    
    // Appliquer la recherche
    if (currentSearch) {
        const searchTerm = currentSearch.toLowerCase();
        filteredGuests = filteredGuests.filter(g =>
            (g.firstName || '').toLowerCase().includes(searchTerm) ||
            (g.lastName || '').toLowerCase().includes(searchTerm) ||
            (g.email || '').toLowerCase().includes(searchTerm) ||
            (g.phone || '').toLowerCase().includes(searchTerm) ||
            (g.company || '').toLowerCase().includes(searchTerm) ||
            (g.notes || '').toLowerCase().includes(searchTerm)
        );
        console.log(`🔎 Recherche "${currentSearch}": ${filteredGuests.length} résultat(s)`);
    }
    
    // Mettre à jour la pagination
    updatePagination();
    
    // Mettre à jour les compteurs
    updateGuestCounters();
}

function updatePagination() {
    const totalPages = Math.ceil(filteredGuests.length / guestsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        // Masquer aussi la mini-pagination
        const miniPaginationBar = document.getElementById('miniPaginationBar');
        if (miniPaginationBar) miniPaginationBar.style.display = 'none';
        return;
    }
    
    let paginationHTML = '';
    
    // Bouton précédent
    paginationHTML += `
        <button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}
                data-bs-toggle="tooltip" data-bs-title="Page précédente">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Pages
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            paginationHTML += `
                <button class="page-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="changePage(${i})"
                        data-bs-toggle="tooltip" data-bs-title="Page ${i}">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            paginationHTML += `<span class="page-btn" style="cursor: default;">...</span>`;
        }
    }
    
    // Bouton suivant
    paginationHTML += `
        <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}
                data-bs-toggle="tooltip" data-bs-title="Page suivante">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
    pagination.style.display = 'flex';
    
    // ========== MISE À JOUR MINI-PAGINATION EN HAUT ==========
    const miniPaginationBar = document.getElementById('miniPaginationBar');
    const miniPaginationInfo = document.getElementById('miniPaginationInfo');
    const miniPaginationControls = document.getElementById('miniPaginationControls');
    
    if (miniPaginationBar && miniPaginationInfo && miniPaginationControls) {
        // Afficher la mini-pagination
        miniPaginationBar.style.display = 'flex';
        
        // Mettre à jour l'info
        const startGuest = (currentPage - 1) * guestsPerPage + 1;
        const endGuest = Math.min(currentPage * guestsPerPage, filteredGuests.length);
        miniPaginationInfo.textContent = `Affichage ${startGuest}-${endGuest} sur ${filteredGuests.length} • Page ${currentPage}/${totalPages}`;
        
        // Générer les contrôles mini
        let miniHTML = `
            <button class="mini-page-btn ${currentPage === 1 ? 'disabled' : ''}" 
                    onclick="changePage(${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''}
                    title="Page précédente">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Afficher jusqu'à 5 pages
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            miniHTML += `
                <button class="mini-page-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="changePage(${i})"
                        title="Page ${i}">
                    ${i}
                </button>
            `;
        }
        
        miniHTML += `
            <button class="mini-page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                    onclick="changePage(${currentPage + 1})" 
                    ${currentPage === totalPages ? 'disabled' : ''}
                    title="Page suivante">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        miniPaginationControls.innerHTML = miniHTML;
    }
    
    // Réinitialiser les tooltips
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

function changePage(page) {
    const totalPages = Math.ceil(filteredGuests.length / guestsPerPage);
    if (page < 1 || page > totalPages) return;
    
    if (page === currentPage) return; // Éviter le changement inutile
    
    console.log(`📄 Changement de page: ${currentPage} → ${page}`);
    
    currentPage = page;
    
    // Régénérer la pagination (cela met à jour le HTML avec les bonnes classes 'active')
    updatePagination();
    
    // Réappliquer les sélections globales après rendu
    renderCurrentView();
    
    // Restaurer les sélections pour la nouvelle page
    restoreSelectionsForPage();
    
    // Mettre à jour l'affichage de la sélection après restauration
    updateSelectionInfo();
    
    // Scroll vers le haut de la vue des invités
    const gridView = document.getElementById('gridView');
    if (gridView) {
        gridView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateGuestCounters() {
    // Mettre à jour les compteurs dans les différentes vues
    const counters = ['guestsCount', 'guestsTableCount', 'statsGuestsCount'];
    counters.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = filteredGuests.length;
        }
    });
    
    // Mettre à jour le compteur total
    const totalGuestsElement = document.getElementById('totalGuestsCount');
    if (totalGuestsElement) {
        const totalGuests = storage.getGuestsByEventId(currentEventId).length;
        totalGuestsElement.textContent = totalGuests;
    }
}

// ============================================================
// 🎨 RENDU DES DIFFÉRENTES VUES
// ============================================================
function renderCurrentView() {
    console.log(`🎨 Rendu de la vue: ${currentView}`);
    
    switch(currentView) {
        case 'grid':
            renderGridView();
            break;
        case 'table':
            renderTableView();
            break;
        case 'stats':
            renderStatsView();
            break;
    }
    
    updateEmptyStates();
    updateSelectionInfo();
}

// Obtenir l'avatar selon le sexe avec détection intelligente
function getGuestAvatarImage(guest) {
    const baseUrl = 'assets/images/';
    const validGenders = ['m', 'f', 'homme', 'femme', 'male', 'female', 'couple', 'maman', 'mother', 'autre'];
    
    // 1️⃣ Vérifier d'abord le champ gender/sexe
    const gender = (guest.gender?.toLowerCase() || guest.sexe?.toLowerCase() || '').trim();
    
    if (gender) {
        // Normaliser et checker les valeurs connues
        if (gender === 'f' || gender === 'femme' || gender === 'woman' || gender === 'female') {
            return `${baseUrl}femme.png`;
        } else if (gender === 'm' || gender === 'homme' || gender === 'man' || gender === 'male') {
            return `${baseUrl}homme.png`;
        } else if (gender === 'couple') {
            return `${baseUrl}couple.png`;
        } else if (gender === 'maman' || gender === 'mother') {
            return `${baseUrl}maman.png`;
        } else if (gender === 'autre') {
            return null; // Utiliser les initiales
        }
    }
    
    // 2️⃣ Détection intelligente basée sur les titres de civilité et notes
    const firstName = (guest.firstName || '').toLowerCase().trim();
    const lastName = (guest.lastName || '').toLowerCase().trim();
    const notes = (guest.notes || '').toLowerCase().trim();
    const company = (guest.company || '').toLowerCase().trim();
    
    // 🎖️ Détecter "Maman", "Mother" dans les notes ou le nom
    if (notes.includes('maman') || notes.includes('mother') || 
        firstName.includes('maman') || firstName.includes('mother') ||
        lastName.includes('maman') || lastName.includes('mother')) {
        return `${baseUrl}maman.png`;
    }
    
    // 👫 Détecter "Couple" dans les notes ou le type
    if (guest.type === 'couple' || 
        notes.includes('couple') || 
        company.includes('couple')) {
        return `${baseUrl}couple.png`;
    }
    
    // 👨 Détecter les titres masculins et préfixes
    const malePatterns = [
        /\bm\b\.?/i,           // M. ou M
        /\bmonsieur\b/i,       // Monsieur
        /\bmr\b\.?/i,          // Mr ou Mr.
        /\bmon\b\.?/i,         // Mon (de Monsieur)
        /père/i,               // Père
        /father/i,             // Father
        /dad\b/i,              // Dad
        /papa/i                // Papa
    ];
    
    // Chercher dans les notes
    if (malePatterns.some(pattern => pattern.test(notes))) {
        return `${baseUrl}homme.png`;
    }
    
    // Chercher dans le prénom ou nom
    if (malePatterns.some(pattern => pattern.test(firstName + ' ' + lastName))) {
        return `${baseUrl}homme.png`;
    }
    
    // 👩 Détecter les titres féminins et préfixes
    const femalePatterns = [
        /\bm[lle]{1,3}\.?/i,    // Mlle ou Mme ou Mme.
        /\bmme\b\.?/i,          // Mme
        /\bmlle\b\.?/i,         // Mlle
        /\bmademoiselle\b/i,    // Mademoiselle
        /\bmadame\b/i,          // Madame
        /\bmrs\b\.?/i,          // Mrs
        /\bms\b\.?/i,           // Ms
        /mère/i,                // Mère
        /mother/i,              // Mother
        /maman/i,               // Maman
        /mom\b/i,               // Mom
        /mama/i                 // Mama
    ];
    
    // Chercher dans les notes
    if (femalePatterns.some(pattern => pattern.test(notes))) {
        return `${baseUrl}femme.png`;
    }
    
    // Chercher dans le prénom ou nom
    if (femalePatterns.some(pattern => pattern.test(firstName + ' ' + lastName))) {
        return `${baseUrl}femme.png`;
    }
    
    // 3️⃣ Détection basée sur les noms courants (optionnel, peut être amélioré)
    // Liste de prénoms féminins courants en français
    const commonFemaleNames = [
        'marie', 'anne', 'sophie', 'christine', 'catherine', 'nathalie',
        'isabelle', 'francine', 'fabienne', 'nadine', 'monique', 'dominique',
        'michelle', 'carole', 'patricia', 'béatrice', 'denise', 'brigitte',
        'véronique', 'christine', 'joëlle', 'chantal', 'thérèse', 'simone',
        'valerie', 'annie', 'elise', 'alice', 'claire', 'nicole', 'sylvie',
        'martine', 'emilie', 'victoria', 'laura', 'sarah', 'jessica', 'jessica'
    ];
    
    // Liste de prénoms masculins courants en français
    const commonMaleNames = [
        'jean', 'pierre', 'michel', 'andré', 'bernard', 'françois',
        'jacques', 'patrick', 'christian', 'daniel', 'olivier', 'alain',
        'marc', 'thierry', 'charles', 'paul', 'jean-paul', 'jean-claude',
        'serge', 'gérard', 'dominique', 'richard', 'joseph', 'louis',
        'luc', 'eric', 'david', 'nicolas', 'thomas', 'alexandre', 'benoit'
    ];
    
    if (firstName) {
        if (commonFemaleNames.includes(firstName)) {
            return `${baseUrl}femme.png`;
        } else if (commonMaleNames.includes(firstName)) {
            return `${baseUrl}homme.png`;
        }
    }
    
    // 4️⃣ Aucune détection n'a fonctionné, retourner null (utiliser les initiales)
    return null;
}


function renderGridView() {
    const grid = document.getElementById('guestsGrid');
    const emptyState = document.getElementById('emptyStateGrid');
    
    if (!grid) return;
    
    const startIndex = (currentPage - 1) * guestsPerPage;
    const endIndex = startIndex + guestsPerPage;
    const guestsToShow = filteredGuests.slice(startIndex, endIndex);
    
    if (guestsToShow.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    grid.innerHTML = '';
    
    console.log(`🖼️ Rendu grille: ${guestsToShow.length} invité(s)`);
    
    guestsToShow.forEach((guest, index) => {
        const card = createGuestCard(guest);
        card.style.animationDelay = `${index * 0.05}s`;
        grid.appendChild(card);
    });
}

function createGuestCard(guest) {
    const card = document.createElement('div');
    card.className = 'guest-card';
    card.dataset.guestId = guest.id;
    
    // Nettoyer les données
    const clean = value => {
        if (!value || value.trim() === '' || value.trim() === '-' || value.trim().toLowerCase() === 'null') {
            return '';
        }
        return value.trim();
    };
    
    const firstName = clean(guest.firstName);
    const lastName = clean(guest.lastName);
    const company = clean(guest.company);
    const email = clean(guest.email);
    const phone = clean(guest.phone);
    const notes = clean(guest.notes);
    
    // Avatar et couleurs
    const color = stringToColor(`${firstName} ${lastName}`);
    const initials = `${firstName[0] || '?'}${lastName[0] || ''}`.toUpperCase();
    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || email;
    
    // Statut
    let statusClass = 'pending';
    let statusText = 'En attente';
    let statusIcon = 'fas fa-clock';
    let statusColor = '#F59E0B';
    
    if (guest.scanned) {
        statusClass = 'checkedin';
        statusText = 'Présent';
        statusIcon = 'fas fa-check';
        statusColor = '#10B981';
    } else if (guest.confirmed || guest.status === 'confirmed') {
        statusClass = 'confirmed';
        statusText = 'Confirmé';
        statusIcon = 'fas fa-check-circle';
        statusColor = '#3B82F6';
    } else if (guest.status === 'cancelled') {
        statusClass = 'cancelled';
        statusText = 'Annulé';
        statusIcon = 'fas fa-ban';
        statusColor = '#EF4444';
    }
    
    // Table assignée
    let tableInfo = 'Non assigné';
    let tableColor = 'var(--text-color)';
    if (guest.tableId) {
        const table = storage.getTableById(guest.tableId);
        if (table) {
            tableInfo = `Table #${table.tableNumber}`;
            if (table.tableName) {
                tableInfo += ` (${table.tableName})`;
            }
            tableColor = 'var(--primary)';
        }
    }
    
    // VIP badge
    const isVIP = guest.type === 'vip' || guest.isVIP === true;
    
    // Image de fond de l'événement
    const eventBgImage = currentEvent ? getEventImage(currentEvent.type) : '';

    card.innerHTML = `
        <div class="guest-card-bg" style="background-image: url(${currentEvent.design.backgroundImage || 
    'assets/images/table.png'});"></div>
        
        <div class="guest-card-overlay"></div>
        
        <div class="guest-status-badge " style="background-color: ${statusColor};">
            <i class="${statusIcon}"></i> ${statusText}
        </div>
        
        <div class="guest-card-checkbox-wrapper">
            <input type="checkbox" class="guest-card-checkbox" value="${guest.id}" 
                   onchange="handleGuestSelect()" />
        </div>
        
        <div class="guest-card-header">
            <div class="header-avatar" style="background: linear-gradient(135deg, ${color}, ${color}aa);">
                ${getGuestAvatarImage(guest) 
                    ? `<img src="${getGuestAvatarImage(guest)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">`
                    : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700; font-size: 1.4rem;">${initials}</span>`
                }
            </div>
            <div class="guest-main-info">
                <div class="guest-name">${escapeHtml(fullName)}</div>
                <div class="guest-email" title="${email}">${escapeHtml(email || 'Pas d\'email')}</div>
                ${isVIP ? `<small class="vip-tag"><i class="fas fa-crown"></i> VIP</small>` : ''}
            </div>
        </div>
        
        <div class="guest-card-content">
            <div class="guest-meta-info">
                
                ${phone ? `<div class="guest-meta-item"><i class="fas fa-phone"></i><span title="${phone}">${escapeHtml(phone.substring(0, 15))}</span></div>` : ''}
                ${company ? `<div class="guest-meta-item"><i class="fas fa-building"></i><span title="${company}">${escapeHtml(company.substring(0, 15))}</span></div>` : ''}
                <div class="guest-meta-item"><i class="fas fa-map-marker-alt" style="color: ${tableColor};"></i><span>${tableInfo}</span></div>
                ${guest.seats ? `<div class="guest-meta-item"><span style="display: flex; gap: 2px; font-weight: 600; font-size: 0.9rem;">${generateSeatsHTML(guest.seats)}</span></div>` : ''}
                ${guest.seats ? `<div class="guest-meta-item"><i class="fas fa-people-arrows"></i><span>${guest.seats - 1}</span></div>` : ''}
            </div>
        </div>
        
        <div class="guest-card-footer">
            <div class="guest-date">
                <i class="fas fa-calendar"></i>
                ${new Date(guest.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
            </div>
            
            <div class="guest-actions">
                <button class="action-btn eye" onclick="event.stopPropagation(); openGuestDetails('${guest.id}')" title="Détails"><i class="fas fa-eye"></i></button>
                <button class="action-btn edit" onclick="event.stopPropagation(); openGuestModal('${guest.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
                <button class="action-btn qr" onclick="event.stopPropagation(); viewGuestQR('${guest.id}')" title="QR Code"><i class="fas fa-qrcode"></i></button>
                <button class="action-btn share" onclick="event.stopPropagation(); shareGuestQRModal('${guest.id}')" title="Partager"><i class="fas fa-share-alt"></i></button>
                <button class="action-btn check" onclick="event.stopPropagation(); markGuestPresent('${guest.id}')" title="${guest.scanned ? 'Marquer absent' : 'Marquer présent'}"><i class="fas fa-check-circle"></i></button>
                <button class="action-btn delete" onclick="event.stopPropagation(); deleteGuest('${guest.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
    
    
    // Support du long press pour sélection sur mobile
    let longPressTimer;
    let isLongPress = false;
    
    card.addEventListener('touchstart', (e) => {
        isLongPress = false;
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            const checkbox = card.querySelector('.guest-card-checkbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        }, 500);
    });
    
    card.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });
    
    card.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
        isLongPress = false;
    });
    
    // Ajouter un écouteur pour le clic sur la carte
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.guest-actions') && !e.target.closest('.guest-card-checkbox')) {
            openGuestDetails(guest.id);
        }
    });
    
    // Ajouter la carte au cache
    guestCardCache.set(guest.id, card);
    
    // Ajouter l'écouteur de changement directement
    const checkbox = card.querySelector('.guest-card-checkbox');
    if (checkbox) {
        checkbox.addEventListener('change', handleGuestSelect);
    }
    
    // Mettre à jour la sélection si l'invité est dans selectedGuests
    if (selectedGuests.includes(guest.id)) {
        if (checkbox) {
            checkbox.checked = true;
        }
        card.classList.add('selected');
    }
    
    return card;
}

// Variables de cache pour éviter les appels API répétés
let cachedEventTables = null;
let cachedEventTablesId = null;

function renderTableView() {
    const tbody = document.getElementById('guestsTableBody');
    const emptyState = document.getElementById('emptyStateTable');
    
    if (!tbody) return;
    
    // Charger les tables une fois au début si nécessaire
    if (!cachedEventTables || cachedEventTablesId !== currentEventId) {
        let allTables = storage.getAllTables(currentEventId) || [];
        if (allTables && allTables.data && Array.isArray(allTables.data)) {
            cachedEventTables = allTables.data;
        } else if (Array.isArray(allTables)) {
            cachedEventTables = allTables;
        } else {
            cachedEventTables = [];
        }
        cachedEventTablesId = currentEventId;
    }
    
    const startIndex = (currentPage - 1) * guestsPerPage;
    const endIndex = startIndex + guestsPerPage;
    const guestsToShow = filteredGuests.slice(startIndex, endIndex);
    
    if (guestsToShow.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = '';
    
    console.log(`📋 Rendu tableau: ${guestsToShow.length} ligne(s)`);
    
    guestsToShow.forEach((guest, index) => {
        const { mainRow, detailsRow } = createTableRow(guest, index, cachedEventTables);
        tbody.appendChild(mainRow);
        tbody.appendChild(detailsRow);
        
        // Ajouter l'écouteur de changement au checkbox du tableau
        const checkbox = mainRow.querySelector('.guest-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', handleGuestSelect);
        }
    });
    
    // Initialiser les tooltips
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

function createTableRow(guest, index, cachedTables = null) {
    // Nettoyer les données
    const clean = value => {
        if (!value || value.trim() === '' || value.trim() === '-' || value.trim().toLowerCase() === 'null') {
            return '';
        }
        return value.trim();
    };
    
    const firstName = clean(guest.firstName);
    const lastName = clean(guest.lastName);
    const company = clean(guest.company);
    const email = clean(guest.email);
    const phone = clean(guest.phone);
    const notes = clean(guest.notes);
    
    // Avatar et couleurs
    const color = stringToColor(`${firstName} ${lastName}`);
    const initials = `${firstName[0] || '?'}${lastName[0] || ''}`.toUpperCase();
    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || email;
    
    // Statut
    let statusClass = 'pending';
    let statusText = 'En attente';
    let statusIcon = 'fas fa-clock';
    
    if (guest.scanned) {
        statusClass = 'checkedin';
        statusText = 'Présent';
        statusIcon = 'fas fa-check';
    } else if (guest.confirmed || guest.status === 'confirmed') {
        statusClass = 'confirmed';
        statusText = 'Confirmé';
        statusIcon = 'fas fa-check-circle';
    } else if (guest.status === 'cancelled') {
        statusClass = 'cancelled';
        statusText = 'Annulé';
        statusIcon = 'fas fa-ban';
    }
    
    // VIP indicator
    const isVIP = guest.type === 'vip' || guest.isVIP === true;
    const vipIcon = isVIP ? '<i class="fas fa-crown text-warning ms-1" data-bs-toggle="tooltip" data-bs-title="VIP"></i>' : '';
    
    // Table assignée - Récupérée via storage
    let tableInfo = '—';
    let tableNumber = '—';

    if (guest.tableId) {
        const table = storage.getTableById(guest.tableId);
        
        if (table && table.tableNumber) {
            tableInfo = `${table.tableName || `Table #${table.tableNumber}`}`;
            tableNumber = `#${table.tableNumber}`;
        }
    } else {
        const tables = cachedTables || [];
        
        for (const table of tables) {
            if (table.assignedGuests && table.assignedGuests.some(ag => ag.guestId === guest.id)) {
                tableInfo = `${table.tableName || `Table #${table.tableNumber}`}`;
                tableNumber = `#${table.tableNumber}`;
                break;
            }
        }
    }
    
    // Ligne principale
    const row = document.createElement('tr');
    row.className = 'guest-row-pro';
    row.dataset.guestId = guest.id;
    row.innerHTML = `
        <td>
            <div class="form-check">
                <input class="form-check-input guest-checkbox" type="checkbox" value="${guest.id}" 
                       onchange="handleGuestSelect()">
            </div>
        </td>
        <td>
            <div class="d-flex align-items-center gap-3">
                <div class="guest-avatar-table" style="background: ${color}; position: relative; overflow: hidden;">
                    ${getGuestAvatarImage(guest) 
                        ? `<img src="${getGuestAvatarImage(guest)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none';">`
                        : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700;">${initials}</span>`
                    }
                </div>
                <div style="flex: 1;">
                    <div class="guest-name-table">
                        ${escapeHtml(fullName)} ${vipIcon}
                    </div>
                    <div style="font-size: 0.8rem;">
                        ${company ? `<div class="text-muted" style="color: #9b9a9a !important;">${escapeHtml(company)}</div>` : ''}
                        ${guest.gender || guest.sexe ? `<div style="opacity: 0.8; display: flex; align-items: center; gap: 4px;"><i class="fas fa-venus-mars" style="font-size: 0.7rem;"></i> ${escapeHtml(genderLabels[guest.gender?.toLowerCase() || guest.sexe?.toLowerCase()] || escapeHtml(guest.gender || guest.sexe))}</div>` : ''}
                    </div>
                </div>
            </div>
        </td>
        <td>
            <div>${escapeHtml(email || '—')}</div>
            ${phone ? `<div class="table-name">${escapeHtml(phone)}</div>` : ''}
        </td>
        <td>
            <span class="badge status-${statusClass}">
                <i class="${statusIcon} me-1"></i>
                ${statusText}
            </span>
        </td>
        <td>
            <div class="guest-table-badge">
                <span class="table-number" data-bs-toggle="tooltip" data-bs-title="Numéro de table">${tableNumber}</span>
                ${tableInfo !== '—' ? `<small class="table-name">${escapeHtml(tableInfo)}</small>` : ''}
            </div>
        </td>
        <td>${new Date(guest.createdAt || Date.now()).toLocaleDateString('fr-FR')}</td>
        <td>
            <div class="d-flex gap-2" style="flex-wrap: wrap;">
                <button type="button" class="action-btn" onclick="event.stopPropagation(); openGuestDetails('${guest.id}')"
                        data-bs-toggle="tooltip" data-bs-title="Voir détails">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="action-btn edit" onclick="event.stopPropagation(); openGuestModal('${guest.id}')"
                        data-bs-toggle="tooltip" data-bs-title="Modifier">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button type="button" class="action-btn qr" onclick="event.stopPropagation(); viewGuestQR('${guest.id}')"
                        data-bs-toggle="tooltip" data-bs-title="QR Code">
                    <i class="bi bi-qr-code"></i>
                </button>
                <button type="button" class="action-btn" onclick="event.stopPropagation(); manageGuestTable('${guest.id}')"
                        data-bs-toggle="tooltip" data-bs-title="Gérer table">
                    <i class="fas fa-chair"></i>
                </button>
                <button type="button" class="action-btn delete" onclick="event.stopPropagation(); deleteGuest('${guest.id}')"
                        data-bs-toggle="tooltip" data-bs-title="Supprimer">
                    <i class="bi bi-trash3"></i>
                </button>
                <button class="guest-expand-btn" onclick="toggleGuestRowDetails('${guest.id}', event)" 
                        data-bs-toggle="tooltip" data-bs-title="Voir détails">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        </td>
    `;
    
    // Gestionnaire de clic sur la ligne pour le déploiement
    row.addEventListener('click', (e) => {
        // Ne pas déplier si clic sur un bouton action ou checkbox
        if (!e.target.closest('.action-btn') && !e.target.closest('.guest-expand-btn') && 
            !e.target.closest('.form-check') && !e.target.closest('input')) {
            toggleGuestRowDetails(guest.id, e);
        }
    });
    
    
    // Ligne de détails (initialement masquée)
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'guest-details-row';
    detailsRow.dataset.guestId = guest.id;
    detailsRow.style.display = 'none';
    detailsRow.innerHTML = `
        <td colspan="8">
            <div class="guest-details-container">
                <div class="details-grid">
                    <div class="detail-item">
                        <label class="detail-label">Email</label>
                        <div class="detail-value">${escapeHtml(email || '—')}</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Téléphone</label>
                        <div class="detail-value">${escapeHtml(phone || '—')}</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Genre</label>
                        <div class="detail-value">${guest.gender || guest.sexe ? escapeHtml(genderLabels[guest.gender?.toLowerCase() || guest.sexe?.toLowerCase()] || escapeHtml(guest.gender || guest.sexe)) : '—'}</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Entreprise</label>
                        <div class="detail-value">${escapeHtml(company || '—')}</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Sièges/Places</label>
                        <div class="detail-value">${guest.seats ? `<span style="display: flex; gap: 3px;">${generateSeatsHTML(guest.seats)}</span>` : `${generateSeatsHTML(guest.seats)}`}</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Type</label>
                        <div class="detail-value">${guest.type ? guest.type.toUpperCase() : 'STANDARD'}</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Table Assignée</label>
                        <div class="detail-value" style="color: ${tableInfo !== '—' ? 'var(--success)' : 'var(--text-color)'};">
                            <i class="fas fa-chair me-1"></i>
                            ${escapeHtml(tableInfo)}
                        </div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Accompagnants</label>
                        <div class="detail-value">${guest.seats - 1 || 0} personne(s)</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Date d'inscription</label>
                        <div class="detail-value">${new Date(guest.createdAt || Date.now()).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    <div class="detail-item">
                        <label class="detail-label">Statut de présence</label>
                        <div class="detail-value">
                            <span class="badge bg-${statusClass} status-${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    ${notes ? `
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <label class="detail-label">Notes</label>
                        <div class="detail-value guest-notes-display">${escapeHtml(notes)}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="guest-details-actions">
                    <button class="action-btn-sm move" onclick="event.stopPropagation(); manageGuestTable('${guest.id}')">
                        <i class="fas fa-chair"></i>
                        Changer de table
                    </button>
                    <button class="action-btn-sm qr" onclick="event.stopPropagation(); viewGuestQR('${guest.id}')">
                        <i class="bi bi-qr-code"></i>
                        QR Code
                    </button>
                    <button class="action-btn-sm share" onclick="event.stopPropagation(); shareGuestQRModal('${guest.id}')">
                        <i class="fas fa-share-alt"></i>
                        Partager
                    </button>
                    <button class="action-btn-sm ${guest.scanned ? 'success' : 'warning'}" onclick="event.stopPropagation(); markGuestPresent('${guest.id}')">
                        <i class="fas fa-check-circle"></i>
                        ${guest.scanned ? 'Présent' : 'Valider présence'}
                    </button>
                    <button class="action-btn-sm remove" onclick="event.stopPropagation(); deleteGuest('${guest.id}')">
                        <i class="bi bi-trash3"></i>
                        Supprimer
                    </button>
                </div>
            </div>
        </td>
    `;
    
    
    // Animation pour la ligne principale
    row.style.opacity = '0';
    row.style.transform = 'translateX(-10px)';
    setTimeout(() => {
        row.style.transition = 'all 0.3s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateX(0)';
    }, index * 30);
    
    // Ajouter la ligne au cache
    guestRowCache.set(guest.id, row);
    
    // Vérifier que les données sont correctes
    console.log(`✅ Ligne créée pour ${guest.id}, détails row dataset:`, detailsRow.dataset);
    
    // Retourner les deux lignes séparées
    return {
        mainRow: row,
        detailsRow: detailsRow
    };
}

function renderStatsView() {
    console.log('📊 Rendu vue statistiques');
    
    const emptyState = document.getElementById('emptyStateStats');
    const statsView = document.getElementById('statsView');
    
    if (!statsView) return;
    
    if (currentGuests.length === 0) {
        emptyState.style.display = 'flex';
        document.getElementById('statusChart').innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-chart-pie fa-3x mb-3"></i>
                <p>Aucune donnée disponible</p>
            </div>
        `;
        document.getElementById('tableDistributionChart').innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-chart-bar fa-3x mb-3"></i>
                <p>Aucune donnée disponible</p>
            </div>
        `;
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Mettre à jour les statistiques
    updateAdvancedStats();
    
    // Rendre les graphiques
    renderStatusChart();
    renderTableDistributionChart();
    
    console.log('✅ Vue statistiques rendue');
}

function updateEmptyStates() {
    const emptyStates = {
        grid: 'emptyStateGrid',
        table: 'emptyStateTable',
        stats: 'emptyStateStats'
    };
    
    Object.keys(emptyStates).forEach(view => {
        const emptyState = document.getElementById(emptyStates[view]);
        if (emptyState) {
            emptyState.style.display = (currentView === view && filteredGuests.length === 0) ? 'flex' : 'none';
        }
    });
}

// ============================================================
// 📊 STATISTIQUES ET GRAPHIQUES
// ============================================================
function updateStats() {
    if (!currentEventId) return;
    
    const totalGuests = storage.getGuestsByEventId(currentEventId).length;
    const confirmedGuests = storage.getGuestsByEventId(currentEventId)
        .filter(g => g.confirmed || g.status === 'confirmed').length;
    const checkedinGuests = storage.getGuestsByEventId(currentEventId)
        .filter(g => g.scanned).length;
    const vipGuests = storage.getGuestsByEventId(currentEventId)
        .filter(g => g.type === 'vip' || g.isVIP).length;
    
    // Calcul des taux
    const confirmationRate = totalGuests > 0 ? Math.round((confirmedGuests / totalGuests) * 100) : 0;
    const attendanceRate = confirmedGuests > 0 ? Math.round((checkedinGuests / confirmedGuests) * 100) : 0;
    const vipPercentage = totalGuests > 0 ? Math.round((vipGuests / totalGuests) * 100) : 0;
    
    // Mise à jour des compteurs de base
    updateGuestCounters();
    
    // Mise à jour des statistiques avancées
    const statsElements = {
        'confirmationRate': `${confirmationRate}%`,
        'confirmedGuests': confirmedGuests,
        'totalGuests': totalGuests,
        'attendanceRate': `${attendanceRate}%`,
        'checkedinGuests': checkedinGuests,
        'totalConfirmed': confirmedGuests,
        'vipGuestsCount': vipGuests,
        'vipPercentage': `${vipPercentage}%`,
        'vipConfirmed': storage.getGuestsByEventId(currentEventId)
            .filter(g => (g.type === 'vip' || g.isVIP) && (g.confirmed || g.status === 'confirmed')).length
    };
    
    Object.keys(statsElements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = statsElements[id];
        }
    });
    
    // Statistiques QR
    const totalQRScans = checkedinGuests;
    const lastScannedGuest = storage.getGuestsByEventId(currentEventId)
        .filter(g => g.scanned && g.scannedAt)
        .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))[0];
    
    const scanElements = {
        'totalQRScans': totalQRScans,
        'lastQRScan': lastScannedGuest ? 
            new Date(lastScannedGuest.scannedAt).toLocaleDateString('fr-FR') : 'Jamais',
        'scanSuccessRate': totalGuests > 0 ? `${Math.round((totalQRScans / totalGuests) * 100)}%` : '0%'
    };
    
    Object.keys(scanElements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = scanElements[id];
        }
    });
}

function updateAdvancedStats() {
    if (!currentEventId || currentView !== 'stats') return;
    
    const guests = storage.getGuestsByEventId(currentEventId);
    const statusStats = {
        confirmed: guests.filter(g => 
            g.confirmed || 
            g.status === 'confirmed' || 
            g.status === 'checked_in' || 
            g.scanned
        ).length,
        pending: guests.filter(g => 
            !g.scanned && 
            (!g.status || g.status === 'pending') && 
            !g.confirmed
        ).length,
        checkedin: guests.filter(g => g.scanned || g.status === 'checked_in').length,
        cancelled: guests.filter(g => g.status === 'cancelled').length
    };
    
    // Distribution par table
    let tables = storage.getAllTables(currentEventId) || [];
    
    // Gérer les deux formats de réponse (API ou local)
    if (tables && tables.data && Array.isArray(tables.data)) {
        tables = tables.data;
    } else if (!Array.isArray(tables)) {
        tables = [];
    }
    
    const tableDistribution = {};
    
    if(tables.length > 0) {
    tables.forEach(table => {
        const guestsInTable = guests.filter(g => g.tableId === table.id);
        if (guestsInTable.length > 0) {
            const tableName = table.tableName || `Table ${table.tableNumber}`;
            tableDistribution[tableName] = guestsInTable.length;
        }
    });
    }
    
    // Invités non assignés
    const unassignedGuests = guests.filter(g => !g.tableId).length;
    if (unassignedGuests > 0) {
        tableDistribution['Non assignés'] = unassignedGuests;
    }
    
    // Rendre les graphiques
    renderStatusChart(statusStats);
    renderTableDistributionChart(tableDistribution);
}


function renderStatusChart(statusStats = { confirmed: 0, pending: 0, checkedin: 0, cancelled: 0 }) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // Détruire le graphique existant
    if (statusChart) {
        statusChart.destroy();
    }

    const labels = ['Confirmés', 'En attente', 'Présents', 'Annulés'];
    const data = [
        statusStats.confirmed || 0,
        statusStats.pending || 0,
        statusStats.checkedin || 0,
        statusStats.cancelled || 0
    ];

    const backgroundColors = [
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(239, 68, 68, 0.8)'
    ];

    ctx.innerHTML = '<canvas></canvas>';
    const canvas = ctx.querySelector('canvas');

    statusChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: 'var(--text-color)',
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? 
                                Math.round((context.raw / total) * 100) : 0;
                            return `${context.label}: ${context.raw} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true
            }
        }
    });
}


function renderTableDistributionChart(tableDistribution = {}) {
    const ctx = document.getElementById('tableDistributionChart');
    if (!ctx) return;

    // Détruire le graphique existant
    if (tableDistributionChart) {
        tableDistributionChart.destroy();
    }

    const labels = Object.keys(tableDistribution);
    const data = Object.values(tableDistribution);

    if (labels.length === 0 || data.length === 0) {
        ctx.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-chart-bar fa-3x mb-3"></i>
                <p>Aucune donnée disponible</p>
            </div>
        `;
        return;
    }

    ctx.innerHTML = '<canvas></canvas>';
    const canvas = ctx.querySelector('canvas');

    tableDistributionChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.raw} invités`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'var(--text-color)'
                    }
                },
                y: {
                    ticks: {
                        color: 'var(--text-color)'
                    }
                }
            }
        }
    });
}



function initializeBulkActions() {
    console.log('👥 Initialisation des actions groupées...');
    
    // Checkbox "Tout sélectionner"
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.guest-checkbox');
            const isChecked = this.checked;
            
            console.log(`${isChecked ? '✓' : '✗'} Tout sélectionner`);
            
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
                cb.dispatchEvent(new Event('change'));
            });
        });
    }
    
    // Boutons d'annulation de sélection (tous les IDs possibles)
    ['clearSelectionBtn', 'clearSelectionBtnGrid'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', clearSelection);
        }
    });
    
    // Boutons de confirmation groupée (tous les IDs possibles)
    ['bulkConfirmBtn', 'bulkConfirmBtnGrid'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', bulkConfirmGuests);
        }
    });
    
    // Boutons de suppression groupée (tous les IDs possibles)
    ['bulkDeleteBtn', 'bulkDeleteBtnGrid'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', bulkDeleteGuests);
        }
    });
    
    console.log('✅ Actions groupées initialisées');
}

// ============================================================
// ✅ GESTION DE LA SÉLECTION MULTIPLE
// ============================================================
function handleGuestSelect() {
    updateSelectedGuests();
    
    // Mettre à jour les styles des cartes sélectionnées
    document.querySelectorAll('.guest-card').forEach(card => {
        const checkbox = card.querySelector('.guest-card-checkbox');
        if (checkbox && checkbox.checked) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

function updateSelectedGuests() {
    // Récupérer les checkboxes de la table ET les cartes
    const tableCheckboxes = Array.from(document.querySelectorAll('.guest-checkbox:checked')).map(cb => cb.value);
    const cardCheckboxes = Array.from(document.querySelectorAll('.guest-card-checkbox:checked')).map(cb => cb.value);
    
    // Fusionner et dédupliquer - ceci est la source de vérité globale
    selectedGuests = [...new Set([...tableCheckboxes, ...cardCheckboxes])];
    
    // Afficher la sélection dans TOUTES les vues (sauf stats)
    updateSelectionInfo();
    
    // Mettre à jour le checkbox "Tout sélectionner" pour la table
    updateSelectAllCheckbox(tableCheckboxes);
}

function updateSelectionInfo() {
    // Mettre à jour TOUS les éléments de sélection dans TOUTES les vues (sauf stats)
    document.querySelectorAll('.selection-info').forEach(el => {
        if (selectedGuests.length > 0) {
            el.style.display = 'block';
            // Mettre à jour le compteur dans cet élément
            const counter = el.querySelector('span');
            if (counter) {
                counter.textContent = selectedGuests.length;
            }
        } else {
            el.style.display = 'none';
        }
    });
    
    // Mettre à jour les conteneurs .actions-bottom pour montrer/cacher toute la section
    document.querySelectorAll('.actions-bottom').forEach(el => {
        el.style.display = selectedGuests.length > 0 ? 'flex' : 'none';
    });
    
    // Mettre à jour les boutons d'actions groupées individuellement aussi
    const bulkActionsTable = document.getElementById('bulkActions');
    const bulkActionsGrid = document.getElementById('bulkActionsGrid');
    
    [bulkActionsTable, bulkActionsGrid].forEach(el => {
        if (el) {
            el.style.display = selectedGuests.length > 0 ? 'flex' : 'none';
        }
    });
}

function updateSelectAllCheckbox(checkedCount) {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    const totalCheckboxes = document.querySelectorAll('.guest-checkbox').length;
    const numChecked = checkedCount.length;
    
    selectAllCheckbox.checked = numChecked > 0 && numChecked === totalCheckboxes;
    selectAllCheckbox.indeterminate = numChecked > 0 && numChecked < totalCheckboxes;
}

function restoreSelectionsForPage() {
    // Restaurer les sélections pour les invités de la page actuelle
    const startIndex = (currentPage - 1) * guestsPerPage;
    const endIndex = startIndex + guestsPerPage;
    const guestsOnPage = filteredGuests.slice(startIndex, endIndex);
    
    guestsOnPage.forEach(guest => {
        // Mettre à jour la checkbox en grille
        const cardCheckbox = document.querySelector(`.guest-card-checkbox[value="${guest.id}"]`);
        if (cardCheckbox) {
            cardCheckbox.checked = selectedGuests.includes(guest.id);
            const card = cardCheckbox.closest('.guest-card');
            if (card) {
                card.classList.toggle('selected', cardCheckbox.checked);
            }
        }
        
        // Mettre à jour la checkbox en tableau
        const tableCheckbox = document.querySelector(`.guest-checkbox[value="${guest.id}"]`);
        if (tableCheckbox) {
            tableCheckbox.checked = selectedGuests.includes(guest.id);
        }
    });
    
    // Mettre à jour l'état du checkbox "Tout sélectionner"
    const checkedCount = Array.from(document.querySelectorAll('.guest-checkbox:checked')).length;
    const totalOnPage = document.querySelectorAll('.guest-checkbox').length;
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkedCount > 0 && checkedCount === totalOnPage;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalOnPage;
    }
}

function updateMiniPaginationActiveState() {
    const miniPageBtns = document.querySelectorAll('.mini-page-btn');
    miniPageBtns.forEach(btn => {
        const pageNumText = btn.textContent.trim();
        // Ignorer les chevrons (qui contiennent des icônes)
        if (pageNumText && pageNumText !== '') {
            if (pageNumText === currentPage.toString()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

function clearSelection() {
    console.log('✗ Annulation de la sélection');
    
    selectedGuests = [];
    
    // Décocher toutes les checkboxes (table et cartes)
    document.querySelectorAll('.guest-checkbox, .guest-card-checkbox').forEach(cb => {
        cb.checked = false;
    });
    
    // Retirer la classe 'selected' de toutes les cartes
    document.querySelectorAll('.guest-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Réinitialiser "Tout sélectionner"
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
    
    updateSelectedGuests();
}

async function bulkConfirmGuests() {
    if (selectedGuests.length === 0) return;
    
    
    const result = await Swal.fire({
        icon: 'question',
        title: `Confirmer ${selectedGuests.length} invité(s) ?`,
        text: 'Les invités sélectionnés seront marqués comme confirmés.',
        showCancelButton: true,
        confirmButtonText: 'Confirmer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#6B7280',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                for (const guestId of selectedGuests) {
                    await storage.updateGuest(guestId, { 
                        confirmed: true, 
                        status: 'confirmed',
                        updatedAt: new Date().toISOString()
                    });
                    await markGuestPresent(guestId);
                }
                return true;
            } catch (error) {
                Swal.showValidationMessage(`Erreur: ${error.message}`);
                return false;
            }
        }
    });
    
    if (result.isConfirmed) {
        clearSelection();
        await loadGuests();
        
        SECURA_AUDIO.play('success');
        await Swal.fire({
            icon: 'success',
            title: 'Invités confirmés !',
            text: `${selectedGuests.length} invité(s) ont été confirmés.`,
            timer: 2000,
            showConfirmButton: false
        });
    }
}

async function bulkDeleteGuests() {
    if (selectedGuests.length === 0) return;
    
    console.log(`🗑️ Suppression groupée de ${selectedGuests.length} invité(s)`);
    
    const result = await Swal.fire({
        icon: 'warning',
        title: `Supprimer ${selectedGuests.length} invité(s) ?`,
        html: `
            <div class="text-center">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <p>Cette action est irréversible.</p>
                <p class="text-muted small">Les invités seront définitivement supprimés.</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        reverseButtons: true,
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            try {
                await storage.deleteMultipleGuests(selectedGuests);
                return true;
            } catch (error) {
                Swal.showValidationMessage(`Erreur: ${error.message}`);
                return false;
            }
        }
    });
    
    if (result.isConfirmed) {
        clearSelection();
        await loadGuests();
        
        SECURA_AUDIO.play('delete');
        await Swal.fire({
            icon: 'success',
            title: 'Invités supprimés !',
            text: `${selectedGuests.length} invité(s) ont été supprimés.`,
            timer: 2000,
            showConfirmButton: false
        });
    }
}

function showBulkActionsModal() {
    console.log('👥 Affichage du modal d\'actions groupées');
    
    Swal.fire({
        title: 'Actions Groupées',
        html: `
            <div class="text-center">
                <div class="mb-4">
                    <i class="fas fa-users fa-3x text-primary"></i>
                </div>
                <p class="mb-3">Sélectionnez une action à effectuer sur <strong>${selectedGuests.length}</strong> invité(s)</p>
                
                <div class="d-grid gap-2">
                    <button class="btn btn-success" onclick="bulkConfirmGuests()">
                        <i class="fas fa-check-circle me-2"></i>
                        Confirmer les invités
                    </button>
                    <button class="btn btn-warning" onclick="bulkSendEmail()">
                        <i class="fas fa-envelope me-2"></i>
                        Envoyer un email
                    </button>
                    <button class="btn btn-info" onclick="bulkGenerateQR()">
                        <i class="fas fa-qrcode me-2"></i>
                        Générer QR Codes
                    </button>
                    <button class="btn btn-secondary" onclick="bulkAssignToTable()">
                        <i class="fas fa-chair me-2"></i>
                        Assigner à une table
                    </button>
                    <button class="btn btn-danger" onclick="bulkDeleteGuests()">
                        <i class="fas fa-trash me-2"></i>
                        Supprimer les invités
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '500px'
    });
}

// ============================================================
// 🎫 MODAL DE CRÉATION EN 5 ÉTAPES
// ============================================================
function initializeCreationModalListeners() {
    
    // Boutons de fermeture
    const closeButtons = ['closeGuestModalBtn', 'cancelGuestCreationBtn'];
    closeButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', closeGuestModal);
        }
    });
    
    // Navigation des étapes
    const navigationSteps = {
        'nextToGuestStep2': 2,
        'nextToGuestStep3': 3,
        'nextToGuestStep4': 4,
        'nextToGuestStep5': 5,
        'backToGuestStep1': 1,
        'backToGuestStep2': 2,
        'backToGuestStep3': 3,
        'backToGuestStep4': 4
    };
    
    Object.keys(navigationSteps).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => goToGuestStep(navigationSteps[id]));
        }
    });
    
    // Contrôles de nombre d'accompagnants
    const increaseCompanionsBtn = document.getElementById('increaseCompanions');
    const decreaseCompanionsBtn = document.getElementById('decreaseCompanions');
    
    if (increaseCompanionsBtn) {
        increaseCompanionsBtn.addEventListener('click', () => {
            const input = document.getElementById('guestCompanions');
            input.value = parseInt(input.value) + 1;
            updateGuestPreview();
        });
    }
    
    if (decreaseCompanionsBtn) {
        decreaseCompanionsBtn.addEventListener('click', () => {
            const input = document.getElementById('guestCompanions');
            if (input.value > 0) {
                input.value = parseInt(input.value) - 1;
                updateGuestPreview();
            }
        });
    }
    
    // Recherche de table
    const searchTableInput = document.getElementById('searchTableAssignment');
    if (searchTableInput) {
        let searchTableTimeout;
        searchTableInput.addEventListener('input', function() {
            clearTimeout(searchTableTimeout);
            searchTableTimeout = setTimeout(() => {
                filterAvailableTables(this.value);
            }, 300);
        });
    }
    
    // Bouton actualiser l'aperçu
    const refreshPreviewBtn = document.getElementById('refreshGuestPreviewBtn');
    if (refreshPreviewBtn) {
        refreshPreviewBtn.addEventListener('click', updateGuestPreview);
    }
    
    // Soumission finale
    const submitBtn = document.getElementById('submitGuestCreation');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitGuestCreation);
    }
    
    console.log('✅ Écouteurs du modal de création initialisés');
}

function openGuestModal(guestId = null) {
    if (!currentEventId) {
        Swal.fire({
            icon: 'warning',
            title: 'Aucun événement sélectionné',
            text: 'Veuillez d\'abord sélectionner un événement.',
            confirmButtonColor: '#D97706'
        });
        return;
    }
    

    // Réinitialiser les variables
    creationStep = 1;
    selectedTableId = null;
    isEditingGuest = !!guestId;
    editingGuestId = guestId;
    guestCreationData = {};
    
    // Mettre à jour le titre
    const progressTitle = document.getElementById('guestProgressTitle');
    if (progressTitle) {
        progressTitle.textContent = isEditingGuest ? 'MODIFICATION D\'INVITÉ' : 'CRÉATION D\'INVITÉ';
    }
    
    // Mettre à jour le texte du bouton de soumission
    const submitBtn = document.getElementById('submitGuestCreation');
    if (submitBtn) {
        submitBtn.innerHTML = isEditingGuest 
            ? '<i class="fas fa-save me-2"></i>Modifier l\'invité'
            : '<i class="fas fa-check-circle me-2"></i>Créer l\'invité';
    }
    
    // Réinitialiser les indicateurs de progression
    document.querySelectorAll('.vertical-step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
    document.querySelector('.vertical-step[data-step="1"]').classList.add('active');
    
    // Masquer toutes les étapes sauf la première (scoped au modal création d'invité)
    const guestModal = document.getElementById('guestCreationModal');
    if (guestModal) {
        guestModal.querySelectorAll('.creation-step-content').forEach(content => {
            content.classList.remove('active');
        });
        const step1 = guestModal.querySelector('#guestCreationStep1');
        if (step1) step1.classList.add('active');
    }
    
    // Réinitialiser les formulaires
    resetGuestForms();
    
    // Masquer l'aperçu
    const previewCard = document.getElementById('guestPreviewCard');
    if (previewCard) {
        previewCard.style.display = 'none';
    }
    
    // Mettre à jour la progression
    updateGuestCreationProgress();
    
    // Si c'est une édition, charger les données de l'invité
    if (isEditingGuest && editingGuestId) {
        const guest = storage.getGuestById(editingGuestId);
        if (guest) {
            loadGuestForEdit(guest);
        }
    } else {
        // Mode création
        const step5Subtitle = document.getElementById('guestStep5Subtitle');
        if (step5Subtitle) {
            step5Subtitle.textContent = 'Vérifiez les informations avant de créer';
        }
        
        // Remplir le formulaire avec des valeurs par défaut
        setDefaultFormValues();
    }
    
    // Charger les tables disponibles
    loadAvailableTables();
    
    // Afficher le modal avec animation
    const modal = document.getElementById('guestCreationModal');
    if (modal) {
        // Assurer que tous les éléments enfants sont visibles
        const wrapper = modal.querySelector('.guest-creation-wrapper');
        const progressPanel = modal.querySelector('.creation-progress-panel');
        const formPanel = modal.querySelector('.creation-form-panel');
        
        if (wrapper) wrapper.style.removeProperty('display');
        if (progressPanel) progressPanel.style.removeProperty('display');
        if (formPanel) formPanel.style.removeProperty('display');
        
        modal.style.removeProperty('display');
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        modal.classList.add('active');
        
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
}

function resetGuestForms() {
    // Réinitialiser tous les formulaires
    const forms = [
        'guestStep1Form',
        'guestStep2Form',
        'guestStep4Form'
    ];
    
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
        }
    });
    
    // Réinitialiser l'ID de l'invité
    const step1 = document.getElementById('guestCreationStep1');
    if (step1) {
        step1.dataset.guestId = '';
    }
}

function setDefaultFormValues() {
    // Valeurs par défaut pour la création
    const defaultValues = {
        'guestStatus': 'pending',
        'guestType': 'standard',
        'guestCompanions': '0',
        'autoGenerateQR': true,
        'sendQRByEmail': true,
        'sendWelcomeEmail': true,
        'isVIP': false
    };
    
    Object.keys(defaultValues).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = defaultValues[id];
            } else {
                element.value = defaultValues[id];
            }
        }
    });
}

function loadGuestForEdit(guest) {
    
    const step5Subtitle = document.getElementById('guestStep5Subtitle');
    if (step5Subtitle) {
        step5Subtitle.textContent = 'Vérifiez les informations avant de modifier';
    }
    
    document.getElementById('guestFirstName').value = guest.firstName || '';
    document.getElementById('guestLastName').value = guest.lastName || '';
    document.getElementById('guestEmail').value = guest.email || 'no@gmail.com';
    document.getElementById('guestPhone').value = guest.phone || '';
    document.getElementById('guestCompany').value = guest.company || '';
    document.getElementById('guestGender').value = guest.gender || '';
    
    // Remplir l'étape 2
    document.getElementById('guestType').value = guest.type || 'standard';
    document.getElementById('guestStatus').value = guest.status || 'pending';
    document.getElementById('guestCompanions').value = guest.companions || 0;
    document.getElementById('guestNotes').value = guest.notes || '';
    
    // Remplir l'étape 4 (options avancées)
    document.getElementById('isVIP').checked = guest.isVIP || guest.type === 'vip';
    document.getElementById('guestTags').value = guest.tags ? guest.tags.join(', ') : '';
    
    // Options de notification (par défaut)
    document.getElementById('autoGenerateQR').checked = guest.hasQR !== false;
    document.getElementById('sendQRByEmail').checked = guest.sendQR === true;
    document.getElementById('sendWelcomeEmail').checked = guest.sendWelcome !== false;
    
    // Stocker l'ID de l'invité pour l'édition
    const step1 = document.getElementById('guestCreationStep1');
    if (step1) {
        step1.dataset.guestId = guest.id;
    }
    
    // Si l'invité a une table, la sélectionner (après le chargement des tables)
    if (guest.tableId) {
        // Ajouter un délai pour s'assurer que loadAvailableTables() est terminé
        setTimeout(() => {
            selectedTableId = guest.tableId;
            updateSelectedTableInfo();
            updateGuestPreview();
        }, 300);
    } else {
        // Mettre à jour l'aperçu
        updateGuestPreview();
    }
}

async function loadAvailableTables() {
    try {
        const tables = storage.getAllTables(currentEventId);
        availableTablesList = Array.isArray(tables) ? tables : [];
        
        console.log(`📊 ${availableTablesList.length} table(s) disponible(s)`);
        
        const container = document.getElementById('availableTablesList');
        if (!container) return;
        
        if (availableTablesList.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-chair fa-2x mb-2"></i>
                    <p>Aucune table disponible</p>
                    <small class="text-muted">Créez d'abord des tables dans l'onglet "Tables"</small>
                </div>
            `;
            return;
        }
        
        // Rendre la liste des tables
        renderAvailableTables('');
    } catch (error) {
        console.error('❌ Erreur chargement tables:', error);
        availableTablesList = [];
    }
}

function renderAvailableTables(searchTerm = '') {
    const container = document.getElementById('availableTablesList');
    if (!container) return;
    
    // Vérification de sécurité: s'assurer que availableTablesList est un tableau
    if (!Array.isArray(availableTablesList)) {
        console.warn('⚠️ availableTablesList n\'est pas un tableau, initialisation à []');
        availableTablesList = [];
    }
    
    let filteredTables = [...availableTablesList];
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredTables = filteredTables.filter(table =>
            (table.tableNumber || '').toString().toLowerCase().includes(term) ||
            (table.tableName || '').toLowerCase().includes(term)
        );
    }
    
    if (filteredTables.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fas fa-search fa-2x mb-2"></i>
                <p>Aucune table ne correspond à votre recherche</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTables.map(table => {
        // Calculer les places disponibles
        const assignedGuests = storage.getGuestsByEventId(currentEventId)
            .filter(g => g.tableId === table.id);
        
        const totalSeats = assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = Math.max(0, table.capacity - totalSeats);
        const isSelected = selectedTableId === table.id;
        
        // Calculer les places nécessaires pour l'invité actuel
        const companions = parseInt(document.getElementById('guestCompanions')?.value || 0);
        const neededSeats = 1 + companions;
        const hasEnoughSeats = availableSeats >= neededSeats;
        
        return `
            <div class="table-select-item ${isSelected ? 'selected' : ''} ${!hasEnoughSeats ? 'disabled' : ''}" 
                 data-table-id="${table.id}"
                 onclick="${hasEnoughSeats ? `selectTableForGuest('${table.id}')` : ''}">
                <div class="table-select-header">
                    <div class="table-select-title">
                        <i class="fas fa-chair me-2"></i>
                        Table #${escapeHtml(table.tableNumber || '?')}
                    </div>
                    <div class="table-select-badge ${hasEnoughSeats ? 'bg-success' : 'bg-danger'}">
                        ${availableSeats} / ${table.capacity} places
                    </div>
                </div>
                ${table.tableName ? `
                    <div class="table-select-name">
                        ${escapeHtml(table.tableName)}
                    </div>
                ` : ''}
                <div class="table-select-info">
                    <div class="table-select-stat">
                        <i class="fas fa-users me-1"></i>
                        ${assignedGuests.length} invité(s)
                    </div>
                    <div class="table-select-stat">
                        <i class="fas fa-chair me-1"></i>
                        ${totalSeats} place(s) occupée(s)
                    </div>
                </div>
                ${!hasEnoughSeats ? `
                    <div class="table-select-warning">
                        <i class="fas fa-exclamation-triangle me-1"></i>
                        Capacité insuffisante (${neededSeats} place(s) requise(s))
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function filterAvailableTables(searchTerm) {
    renderAvailableTables(searchTerm);
}

function selectTableForGuest(tableId) {

    
    selectedTableId = tableId;
    
    const searchTerm = document.getElementById('searchTableAssignment')?.value || '';
    renderAvailableTables(searchTerm);
    updateSelectedTableInfo();
    
    updateGuestPreview();
}

function updateSelectedTableInfo() {
    const selectedInfo = document.getElementById('selectedTableInfo');
    const noTableSelected = document.getElementById('noTableSelected');
    
    if (!selectedInfo || !noTableSelected) return;
    
    if (selectedTableId) {
        const table = availableTablesList.find(t => t.id === selectedTableId);
        if (table) {
            // Calculer les places disponibles
            const assignedGuests = storage.getGuestsByEventId(currentEventId)
                .filter(g => g.tableId === table.id && g.id !== editingGuestId); // Exclure l'invité en cours de modification
            
            const totalSeats = assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
            const availableSeats = Math.max(0, table.capacity - totalSeats);
            const canRemove = isEditingGuest; // Permettre de retirer la table en modification
            
            document.getElementById('selectedTableDetails').innerHTML = `
                <div class="selected-table-info">
                    <div class="selected-table-header">
                        <div class="selected-table-title">
                            <i class="fas fa-chair me-2"></i>
                            <strong>Table #${escapeHtml(table.tableNumber || '?')}</strong>
                            ${table.tableName ? `<span class="selected-table-name">${escapeHtml(table.tableName)}</span>` : ''}
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="deselectTable()">
                            <i class="fas fa-times"></i> Retirer
                        </button>
                    </div>
                    <div class="selected-table-stats">
                        <div class="selected-table-stat">
                            <i class="fas fa-users"></i>
                            <span>${assignedGuests.length} invité(s)</span>
                        </div>
                        <div class="selected-table-stat">
                            <i class="fas fa-chair"></i>
                            <span>${availableSeats} place(s) disponible(s)</span>
                        </div>
                        <div class="selected-table-stat">
                            <i class="fas fa-hashtag"></i>
                            <span>Capacité: ${table.capacity} places</span>
                        </div>
                    </div>
                </div>
            `;
            
            selectedInfo.style.display = 'block';
            noTableSelected.style.display = 'none';
            return;
        }
    }
    
    selectedInfo.style.display = 'none';
    // Ne pas afficher "noTableSelected" en mode modification si l'invité avait une table
    if (isEditingGuest && editingGuestId) {
        const guest = storage.getGuestById(editingGuestId);
        if (guest && guest.tableId) {
            noTableSelected.style.display = 'none';
            return;
        }
    }
    noTableSelected.style.display = 'block';
}

function deselectTable() {
    console.log('✗ Désélection de la table');
    
    selectedTableId = null;
    updateSelectedTableInfo();
    
    const searchTerm = document.getElementById('searchTableAssignment')?.value || '';
    renderAvailableTables(searchTerm);
    
    updateGuestPreview();
}

function goToGuestStep(step) {
    console.log(`📋 Navigation étape: ${creationStep} → ${step}`);
    
    // Valider l'étape actuelle avant de continuer
    if (step > creationStep) {
        const isValid = validateCurrentGuestStep();
        if (!isValid) {
            console.log(`❌ Validation échouée pour l'étape ${creationStep}`);
            return;
        }
    }
    
    creationStep = step;
    
    // Mettre à jour les indicateurs de progression
    document.querySelectorAll('.vertical-step').forEach(stepEl => {
        const stepNum = parseInt(stepEl.dataset.step);
        stepEl.classList.remove('active', 'completed');
        
        if (stepNum < step) {
            stepEl.classList.add('completed');
        } else if (stepNum === step) {
            stepEl.classList.add('active');
        }
    });
    
    // Masquer toutes les étapes sauf celle actuelle (scoped à modal création d'invité)
    const guestModal = document.getElementById('guestCreationModal');
    if (guestModal) {
        guestModal.querySelectorAll('.creation-step-content').forEach(content => {
            content.classList.remove('active');
        });
    }
    
    const currentStepElement = document.getElementById(`guestCreationStep${step}`);
    if (currentStepElement) {
        currentStepElement.classList.add('active');
    }
    
    // Actions spécifiques à chaque étape
    switch(step) {
        case 3:
            console.log('🪑 Étape 3: Assignation à une table');
            loadAvailableTables();
            break;
        case 4:
            console.log('🎨 Étape 4: Paramètres avancés');
            updateGuestPreview();
            break;
        case 5:
            console.log('✅ Étape 5: Confirmation');
            updateGuestConfirmation();
            break;
    }
    
    updateGuestCreationProgress();
}

function validateCurrentGuestStep() {
    let isValid = true;
    let errorMessage = '';
    
    switch(creationStep) {
        case 1:
            // Valider les informations personnelles
            const firstName = document.getElementById('guestFirstName').value.trim();
            const lastName = document.getElementById('guestLastName').value.trim();
            const email = document.getElementById('guestEmail').value.trim();
            
            if (!firstName || firstName.length < 2) {
                errorMessage = 'Le prénom doit contenir au moins 2 caractères';
                showValidationError('guestFirstName', errorMessage);
                isValid = false;
            } else if (!lastName || lastName.length < 2) {
                errorMessage = 'Le nom doit contenir au moins 2 caractères';
                showValidationError('guestLastName', errorMessage);
                isValid = false;
            } else if (!email || !validateEmail(email)) {
                errorMessage = 'Veuillez saisir une adresse email valide';
                showValidationError('guestEmail', errorMessage);
                isValid = false;
            } else {
                // Vérifier si l'email est déjà utilisé (sauf en mode édition)
                if (!isEditingGuest) {
                    const existingGuest = storage.getGuestsByEventId(currentEventId)
                        .find(g => g.email && g.email.toLowerCase() === email.toLowerCase());
                    
                    if (existingGuest) {
                        errorMessage = 'Cet email est déjà utilisé par un autre invité';
                        showValidationError('guestEmail', errorMessage);
                        isValid = false;
                    }
                }
            }
            
            if (isValid) {
                // Sauvegarder les données
                guestCreationData.step1 = {
                    firstName,
                    lastName,
                    email,
                    phone: document.getElementById('guestPhone').value.trim(),
                    company: document.getElementById('guestCompany').value.trim(),
                    gender: document.getElementById('guestGender').value.trim() || undefined
                };
                console.log('✅ Étape 1 validée');
            }
            break;
            
        case 2:
            // Valider les détails
            const type = document.getElementById('guestType').value;
            const status = document.getElementById('guestStatus').value;
            const companions = parseInt(document.getElementById('guestCompanions').value) || 0;
            
            if (isNaN(companions) || companions < 0) {
                errorMessage = 'Le nombre d\'accompagnants doit être un nombre positif';
                showValidationError('guestCompanions', errorMessage);
                isValid = false;
            } else if (companions > 20) {
                errorMessage = 'Le nombre d\'accompagnants ne peut pas dépasser 20';
                showValidationError('guestCompanions', errorMessage);
                isValid = false;
            }
            
            if (isValid) {
                guestCreationData.step2 = {
                    type,
                    status,
                    companions,
                    notes: document.getElementById('guestNotes').value.trim()
                };
                console.log('✅ Étape 2 validée');
            }
            break;
            
        case 3:
            // Validation de l'assignation à une table
            if (selectedTableId) {
                const table = availableTablesList.find(t => t.id === selectedTableId);
                const companions = parseInt(document.getElementById('guestCompanions').value) || 0;
                const neededSeats = 1 + companions;
                
                if (table) {
                    // Calculer les places déjà occupées
                    const assignedGuests = storage.getGuestsByEventId(currentEventId)
                        .filter(g => g.tableId === table.id && (!isEditingGuest || g.id !== editingGuestId));
                    
                    const occupiedSeats = assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
                    const availableSeats = table.capacity - occupiedSeats;
                    
                    if (neededSeats > availableSeats) {
                        errorMessage = `Capacité insuffisante. Nécessaire: ${neededSeats} places, Disponible: ${availableSeats} places`;
                        Swal.fire({
                            icon: 'warning',
                            title: 'Capacité insuffisante',
                            text: errorMessage,
                            confirmButtonColor: '#D97706'
                        });
                        isValid = false;
                    }
                }
            }
            
            if (isValid) {
                guestCreationData.step3 = {
                    tableId: selectedTableId
                };
                console.log('✅ Étape 3 validée');
            }
            break;
            
        case 4:
            // Validation des paramètres avancés
            const tags = document.getElementById('guestTags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag);
            
            guestCreationData.step4 = {
                isVIP: document.getElementById('isVIP').checked,
                autoGenerateQR: document.getElementById('autoGenerateQR').checked,
                sendQRByEmail: document.getElementById('sendQRByEmail').checked,
                sendWelcomeEmail: document.getElementById('sendWelcomeEmail').checked,
                tags
            };
            console.log('✅ Étape 4 validée');
            break;
    }
    
    return isValid;
}

function showValidationError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Ajouter une classe d'erreur
    field.classList.add('is-invalid');
    
    // Afficher le message d'erreur
    let errorElement = field.parentElement.querySelector('.invalid-feedback');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'invalid-feedback';
        field.parentElement.appendChild(errorElement);
    }
    errorElement.textContent = message;
    
    // Supprimer l'erreur lors de la modification
    field.addEventListener('input', function() {
        this.classList.remove('is-invalid');
        if (errorElement) {
            errorElement.remove();
        }
    }, { once: true });
}

function updateGuestCreationProgress() {
    const progress = Math.round(((creationStep - 1) / 4) * 100);
    
    const progressBar = document.getElementById('guestProgressBarFill');
    const progressPercentage = document.getElementById('guestCreationProgressPercentage');
    
    if (progressBar) {
        progressBar.style.width = `${Math.max(20, progress)}%`;
    }
    
    if (progressPercentage) {
        progressPercentage.textContent = `${progress}%`;
    }
}

function updateGuestPreview() {
    const previewContent = document.getElementById('previewGuestContent');
    if (!previewContent) return;
    
    // Récupérer les valeurs du formulaire
    const firstName = document.getElementById('guestFirstName')?.value.trim() || '';
    const lastName = document.getElementById('guestLastName')?.value.trim() || '';
    const email = document.getElementById('guestEmail')?.value.trim() || '';
    const phone = document.getElementById('guestPhone')?.value.trim() || '';
    const company = document.getElementById('guestCompany')?.value.trim() || '';
    const gender = document.getElementById('guestGender')?.value.trim() || '';
    const type = document.getElementById('guestType')?.value || 'standard';
    const status = document.getElementById('guestStatus')?.value || 'pending';
    const companions = parseInt(document.getElementById('guestCompanions')?.value || 0);
    const notes = document.getElementById('guestNotes')?.value.trim() || '';
    const isVIP = document.getElementById('isVIP')?.checked || false;
    
    // Informations de la table
    let tableInfo = 'Non assigné';
    if (selectedTableId) {
        const table = availableTablesList.find(t => t.id === selectedTableId);
        if (table) {
            tableInfo = `Table #${table.tableNumber}`;
            if (table.tableName) {
                tableInfo += ` (${table.tableName})`;
            }
        }
    }
    
    const previewGuest = {
        firstName,
        lastName,
        email,
        phone,
        company,
        gender
    };
    
    previewContent.innerHTML = `
        <div class="preview-guest-card">
            <div class="preview-guest-header">
                <div class="preview-guest-avatar" style="background: ${stringToColor(`${firstName} ${lastName}`)}">
                      ${getGuestAvatarImage(previewGuest) 
                        ? `<img src="${getGuestAvatarImage(previewGuest)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none';">`
                        : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700;"> ${getInitials(`${firstName} ${lastName}`)}</span>`
                    }
                </div>




                <div class="preview-guest-info">
                    <div class="preview-guest-name">
                        ${escapeHtml(firstName || '')} ${escapeHtml(lastName || '')}
                        ${isVIP ? '<span class="vip-badge-preview"><i class="fas fa-crown"></i> VIP</span>' : ''}
                    </div>
                    <div class="preview-guest-email">${escapeHtml(email || '')}</div>
                </div>
            </div>
            
            <div class="preview-guest-details">
                <div class="preview-detail-row">
                    <span class="preview-detail-label">Type:</span>
                    <span class="preview-detail-value">${getGuestTypeLabel(type)}</span>
                </div>
                <div class="preview-detail-row">
                    <span class="preview-detail-label">Statut:</span>
                    <span class="preview-detail-value status-${status}">${getGuestStatusLabel(status)}</span>
                </div>
                <div class="preview-detail-row">
                    <span class="preview-detail-label">Téléphone:</span>
                    <span class="preview-detail-value">${escapeHtml(phone || 'Non renseigné')}</span>
                </div>
                <div class="preview-detail-row">
                    <span class="preview-detail-label">Entreprise:</span>
                    <span class="preview-detail-value">${escapeHtml(company || 'Non renseigné')}</span>
                </div>
                <div class="preview-detail-row">
                    <span class="preview-detail-label">Accompagnants:</span>
                    <span class="preview-detail-value">${companions} personne(s)</span>
                </div>
                <div class="preview-detail-row">
                    <span class="preview-detail-label">Table:</span>
                    <span class="preview-detail-value">${tableInfo}</span>
                </div>
                ${notes ? `
                <div class="preview-detail-row full-width">
                    <span class="preview-detail-label">Notes:</span>
                    <span class="preview-detail-value">${escapeHtml(notes)}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    const previewCard = document.getElementById('guestPreviewCard');
    if (previewCard) {
        previewCard.style.display = 'block';
    }
}

function updateGuestConfirmation() {
    const confirmationContent = document.getElementById('guestConfirmationContent');
    if (!confirmationContent) return;
    
    // Récupérer toutes les données
    const firstName = document.getElementById('guestFirstName')?.value.trim() || '';
    const lastName = document.getElementById('guestLastName')?.value.trim() || '';
    const email = document.getElementById('guestEmail')?.value.trim() || '';
    const phone = document.getElementById('guestPhone')?.value.trim() || '';
    const company = document.getElementById('guestCompany')?.value.trim() || '';
    const gender = document.getElementById('guestGender')?.value.trim() || '';
    const type = document.getElementById('guestType')?.value || 'standard';
    const status = document.getElementById('guestStatus')?.value || 'pending';
    const companions = parseInt(document.getElementById('guestCompanions')?.value || 0);
    const notes = document.getElementById('guestNotes')?.value.trim() || '';
    const isVIP = document.getElementById('isVIP')?.checked || false;
    const autoGenerateQR = document.getElementById('autoGenerateQR')?.checked || false;
    const sendQRByEmail = document.getElementById('sendQRByEmail')?.checked || false;
    const sendWelcomeEmail = document.getElementById('sendWelcomeEmail')?.checked || false;
    const tags = document.getElementById('guestTags')?.value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag) || [];
    
    // Informations de la table
    let tableInfo = 'Non assigné';
    if (selectedTableId) {
        const table = availableTablesList.find(t => t.id === selectedTableId);
        if (table) {
            tableInfo = `Table #${table.tableNumber}`;
            if (table.tableName) {
                tableInfo += ` (${table.tableName})`;
            }
        }
    }
    
    confirmationContent.innerHTML = `
        <div class="confirmation-card">
            <div class="confirmation-header">
                <h4><i class="fas fa-user-check me-2"></i>Résumé de l'invité</h4>
            </div>
            
            <div class="confirmation-body">
                <div class="row">
                    <div class="col-md-6">
                        <h5 class="confirmation-section-title">
                            <i class="fas fa-id-card me-2"></i>Informations personnelles
                        </h5>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Nom complet:</span>
                            <span class="confirmation-value">${escapeHtml(firstName)} ${escapeHtml(lastName)}</span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Email:</span>
                            <span class="confirmation-value">${escapeHtml(email)}</span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Téléphone:</span>
                            <span class="confirmation-value">${escapeHtml(phone || 'Non renseigné')}</span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Entreprise:</span>
                            <span class="confirmation-value">${escapeHtml(company || 'Non renseigné')}</span>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <h5 class="confirmation-section-title">
                            <i class="fas fa-cog me-2"></i>Configuration
                        </h5>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Type:</span>
                            <span class="confirmation-value">
                                ${getGuestTypeLabel(type)}
                                ${isVIP ? '<span class="badge bg-warning ms-2">VIP</span>' : ''}
                            </span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Statut:</span>
                            <span class="confirmation-value">
                                <span class="badge bg-${status}">${getGuestStatusLabel(status)}</span>
                            </span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Accompagnants:</span>
                            <span class="confirmation-value">${companions} personne(s)</span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Table assignée:</span>
                            <span class="confirmation-value">${tableInfo}</span>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-3">
                    <div class="col-md-6">
                        <h5 class="confirmation-section-title">
                            <i class="fas fa-bell me-2"></i>Notifications
                        </h5>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Générer QR Code:</span>
                            <span class="confirmation-value">
                                <i class="fas fa-${autoGenerateQR ? 'check text-success' : 'times text-danger'}"></i>
                            </span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Envoyer QR par email:</span>
                            <span class="confirmation-value">
                                <i class="fas fa-${sendQRByEmail ? 'check text-success' : 'times text-danger'}"></i>
                            </span>
                        </div>
                        <div class="confirmation-detail">
                            <span class="confirmation-label">Email de bienvenue:</span>
                            <span class="confirmation-value">
                                <i class="fas fa-${sendWelcomeEmail ? 'check text-success' : 'times text-danger'}"></i>
                            </span>
                        </div>
                    </div>
                    
                    ${tags.length > 0 ? `
                    <div class="col-md-6">
                        <h5 class="confirmation-section-title">
                            <i class="fas fa-tags me-2"></i>Tags
                        </h5>
                        <div class="confirmation-tags">
                            ${tags.map(tag => `
                                <span class="badge bg-secondary me-1 mb-1">${escapeHtml(tag)}</span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                ${notes ? `
                <div class="row mt-3">
                    <div class="col-12">
                        <h5 class="confirmation-section-title">
                            <i class="fas fa-sticky-note me-2"></i>Notes
                        </h5>
                        <div class="confirmation-notes">
                            ${escapeHtml(notes)}
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function submitGuestCreation() {
    console.log(`${isEditingGuest ? '✏️' : '➕'} Soumission de ${isEditingGuest ? 'l\'édition' : 'la création'} d'invité`);
    
    const submitBtn = document.getElementById('submitGuestCreation');
    const originalText = submitBtn.innerHTML;
    
    // Désactiver le bouton et afficher un loader
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div> Traitement...';
    
    try {
        // Récupérer toutes les données
        const guestId = document.getElementById('guestCreationStep1').dataset.guestId;
        const firstName = document.getElementById('guestFirstName').value.trim();
        const lastName = document.getElementById('guestLastName').value.trim();
        const email = document.getElementById('guestEmail').value.trim();
        const phone = document.getElementById('guestPhone').value.trim();
        const company = document.getElementById('guestCompany').value.trim();
        const gender = document.getElementById('guestGender').value.trim() || undefined;
        const type = document.getElementById('guestType').value;
        const status = document.getElementById('guestStatus').value;
        const companions = parseInt(document.getElementById('guestCompanions').value) || 0;
        const notes = document.getElementById('guestNotes').value.trim();
        const isVIP = document.getElementById('isVIP').checked;
        const autoGenerateQR = document.getElementById('autoGenerateQR').checked;
        const sendQRByEmail = document.getElementById('sendQRByEmail').checked;
        const sendWelcomeEmail = document.getElementById('sendWelcomeEmail').checked;
        const tags = document.getElementById('guestTags').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag);
        
        // Préparer les données de l'invité
        const guestData = {
            eventId: currentEventId,
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone: phone || undefined,
            company: company || undefined,
            gender: gender || undefined,
            type: isVIP ? 'vip' : type,
            status,
            companions,
            notes: notes || undefined,
            tags: tags.length > 0 ? tags : undefined,
            isVIP,
            confirmed: status === 'confirmed',
            seats: 1 + companions, // Total des sièges nécessaires
            updatedAt: new Date().toISOString()
        };
        
        // Si c'est une édition, ajouter l'ID
        if (isEditingGuest && guestId) {
            guestData.id = guestId;
            
            // Récupérer les données existantes pour les champs non modifiés
            const existingGuest = storage.getGuestById(guestId);
            if (existingGuest) {
                guestData.createdAt = existingGuest.createdAt;
                guestData.scanned = existingGuest.scanned;
                guestData.scannedAt = existingGuest.scannedAt;
            }
        }
        
        let savedGuest;
        
        // Créer ou mettre à jour l'invité
        if (isEditingGuest) {
            console.log(`✏️ Mise à jour de l'invité: ${guestId}`);
            savedGuest = await storage.updateGuest(guestId, guestData);
        } else {
            console.log(`➕ Création d'un nouvel invité`);
            savedGuest = await storage.createGuest(guestData);
        }
        
        if (!savedGuest) {
            throw new Error('Échec de la sauvegarde de l\'invité');
        }
        
        console.log(`✅ Invité ${isEditingGuest ? 'mis à jour' : 'créé'}: ${savedGuest.id}`);
        
        // Assigner à une table si sélectionnée
        if (selectedTableId) {
            try {
                console.log(`🪑 Assignation à la table: ${selectedTableId}`);
                
                // Si l'invité était déjà assigné à une table, le retirer d'abord
                if (isEditingGuest && guestData.tableId && guestData.tableId !== selectedTableId) {
                    await storage.removeGuestFromTable(guestData.tableId, savedGuest.id);
                }
                
                // Assigner à la nouvelle table
                await storage.assignGuestToTable(selectedTableId, savedGuest.id, savedGuest.seats || 1);
                console.log(`✅ Assignation à la table réussie`);
            } catch (tableError) {
                console.warn('⚠️ Erreur assignation table:', tableError);
                // On continue même si l'assignation échoue
            }
        } else if (isEditingGuest && guestData.tableId) {
            // Si une table était précédemment assignée mais plus maintenant, la retirer
            try {
                await storage.removeGuestFromTable(guestData.tableId, savedGuest.id);
                console.log(`🗑️ Retrait de la table précédente`);
            } catch (tableError) {
                console.warn('⚠️ Erreur retrait table:', tableError);
            }
        }
        
        // Générer le QR code si demandé
        if (autoGenerateQR && !isEditingGuest) {
            try {
                console.log(`🎫 Génération du QR Code`);
                const qrData = {
                    guestId: savedGuest.id,
                    eventId: currentEventId,
                    firstName: savedGuest.firstName,
                    lastName: savedGuest.lastName,
                    email: savedGuest.email
                };
                
                await storage.saveQRCode({
                                    guestId: savedGuest.id,
                                    eventId: currentEventId,
                                    data: JSON.stringify(qrData),
                                    config: { size: 300, foreground: '#000000', background: '#FFFFFF' }
                                });


            } catch (qrError) {
                console.warn('⚠️ Erreur génération QR:', qrError);
            }
        }
        
        // Envoyer les emails si demandés (simulation pour l'instant)
        if ((sendQRByEmail || sendWelcomeEmail) && !isEditingGuest) {
            console.log(`📧 Envoi des emails: QR=${sendQRByEmail}, Bienvenue=${sendWelcomeEmail}`);
            // Cette fonctionnalité serait implémentée côté serveur
        }
        
        // Fermer le modal
        closeGuestModal();
        
        // Recharger les invités
        await loadGuests();
        
        // Effets de succès
        SECURA_AUDIO.play('success');
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
        
        // Message de succès
        await Swal.fire({
            icon: 'success',
            title: isEditingGuest ? 'Modification réussie !' : 'Invité créé !',
            html: `
                <div class="text-center py-3">
                    <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                    <h4 class="mb-2">${escapeHtml(firstName)} ${escapeHtml(lastName)}</h4>
                    <p class="text-muted">${isEditingGuest ? 'a été modifié avec succès.' : 'a été ajouté à l\'événement.'}</p>
                    
                    <div class="mt-4">
                        ${selectedTableId ? `
                            <div class="alert alert-success d-inline-flex align-items-center">
                                <i class="fas fa-chair me-2"></i>
                                Assigné à une table
                            </div>
                        ` : ''}
                        
                        ${autoGenerateQR ? `
                            <div class="alert alert-info d-inline-flex align-items-center ms-2">
                                <i class="fas fa-qrcode me-2"></i>
                                QR Code généré
                            </div>
                        ` : ''}
                    </div>
                </div>
            `,
            confirmButtonColor: '#D97706',
            timer: 3000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error(`❌ Erreur ${isEditingGuest ? 'modification' : 'création'} invité:`, error);
        
        // Effet sonore d'erreur
        SECURA_AUDIO.play('error');
        
        // Message d'erreur
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            html: `
                <div class="text-center py-3">
                    <i class="fas fa-exclamation-triangle fa-4x text-danger mb-3"></i>
                    <p class="mb-2">Impossible de ${isEditingGuest ? 'modifier' : 'créer'} l'invité.</p>
                    <p class="text-muted small">${error.message || 'Une erreur est survenue.'}</p>
                </div>
            `,
            confirmButtonColor: '#D97706'
        });
        
    } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function closeGuestModal() {
    console.log('✗ Fermeture du modal de création d\'invité');
    
    const modal = document.getElementById('guestCreationModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.display = 'none';
            
            // Réinitialiser les variables
            creationStep = 1;
            selectedTableId = null;
            isEditingGuest = false;
            editingGuestId = null;
            guestCreationData = {};
            
            // Réinitialiser les formulaires
            resetGuestForms();
        }, 300);
    }
}

// ============================================================
// 🪑 GESTION DES TABLES POUR LES INVITÉS
// ============================================================
async function manageGuestTable(guestId) {
    console.log(`🪑 Gestion de la table pour l'invité: ${guestId}`);
    
    const guest = storage.getGuestById(guestId);
    if (!guest) {
        showNotification('error', 'Invité introuvable');
        return;
    }
    
    // Récupérer toutes les tables de l'événement
    const tablesResult = await storage.getAllTables(currentEventId);
    
    // Gérer les deux formats de réponse (API ou local)
    let allTables = [];
    if (Array.isArray(tablesResult)) {
        allTables = tablesResult;
    } else if (tablesResult && tablesResult.data && Array.isArray(tablesResult.data)) {
        allTables = tablesResult.data;
    } else if (tablesResult && Array.isArray(tablesResult)) {
        allTables = tablesResult;
    }
    
    if (!Array.isArray(allTables)) {
        allTables = [];
    }
    
    console.log(`📊 ${allTables.length} table(s) disponible(s)`);
    
    // Chercher si l'invité est assigné à une table
    let currentTableId = guest.tableId;
    if (!currentTableId) {
        // Chercher dans toutes les tables si l'invité y est assigné
        const tableContainingGuest = allTables.find(table => 
            table.assignedGuests && table.assignedGuests.some(ag => ag.guestId === guestId)
        );
        if (tableContainingGuest) {
            currentTableId = tableContainingGuest.id;
        }
    }
    
    // Récupérer la table actuelle de l'invité
    const currentTable = currentTableId ? allTables.find(t => t.id === currentTableId) : null;
    
    // Calculer les places disponibles pour chaque table
    const tablesWithAvailability = allTables.map(table => {
        const assignedGuests = storage.getGuestsByEventId(currentEventId)
            .filter(g => g.tableId === table.id && g.id !== guestId); // Exclure l'invité courant
        
        const occupiedSeats = assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = table.capacity - occupiedSeats;
        const guestSeats = guest.seats || 1;
        const canAssign = availableSeats >= guestSeats;
        
        return {
            ...table,
            availableSeats,
            canAssign,
            isCurrent: table.id === currentTableId
        };
    });
    
    // Options pour le modal
    const options = tablesWithAvailability.map(table => {
        const status = table.isCurrent ? ' (actuelle)' : '';
        const availability = table.canAssign ? 
            `${table.availableSeats} place(s) disponible(s)` : 
            `Capacité insuffisante (${table.availableSeats} disponible(s), ${guest.seats || 1} requise(s))`;
        
        return {
            value: table.id,
            text: `Table #${table.tableNumber}${table.tableName ? ` - ${table.tableName}` : ''}${status}`,
            disabled: !table.canAssign && !table.isCurrent,
            availability
        };
    });
    
    // Ajouter l'option "Non assigné"
    options.unshift({
        value: 'none',
        text: 'Non assigné',
        disabled: false,
        availability: 'Retirer de la table actuelle'
    });
    
    const { value: selectedTableId } = await Swal.fire({
        title: 'Gérer la table',
        html: `
            <div class="text-start">
                <div class="mb-4">
                    <div class="d-flex align-items-center mb-2">
                        <div class="guest-avatar-small me-3" style="background: ${stringToColor(`${guest.firstName} ${guest.lastName}`)}">
                          
                            ${getGuestAvatarImage(guest) 
                        ? `<img src="${getGuestAvatarImage(guest)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none';">`
                        : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700;">${getInitials(`${guest.firstName} ${guest.lastName}`)}</span>`
                    }
                        </div>


                    
                
                
                        <div>
                            <h5 class="mb-0">${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</h5>
                            <small>${guest.seats || 1} place(s) requise(s)</small>
                        </div>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Sélectionner une table:</label>
                    <select id="tableSelect" class="form-select">
                        ${options.map(option => `
                            <option value="${option.value}" ${option.disabled ? 'disabled' : ''} ${option.value === (guest.tableId || 'none') ? 'selected' : ''}>
                                ${option.text} - ${option.availability}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                ${currentTable ? `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Actuellement à la table #${currentTable.tableNumber}
                        ${currentTable.tableName ? `(${currentTable.tableName})` : ''}
                    </div>
                ` : ''}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Assigner',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#D97706',
        preConfirm: () => {
            const select = document.getElementById('tableSelect');
            return select.value;
        }
    });
    
    if (selectedTableId) {
        try {
            // Vérifier si l'invité est déjà à la même table
            if (selectedTableId !== 'none' && guest.tableId === selectedTableId) {
                showNotification('warning', 'Cet invité est déjà à cette table');
                return;
            }
            
            // Demander une confirmation APRÈS le choix
            let confirmMessage = '';
            let confirmTitle = '';
            let confirmIcon = 'question';
            
            if (selectedTableId === 'none') {
                if (!guest.tableId) {
                    showNotification('info', 'Cet invité n\'est pas assigné à une table');
                    return;
                }
                confirmTitle = 'Retirer de la table ?';
                confirmMessage = `Voulez-vous retirer <strong>${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</strong> de sa table actuelle ?`;
                confirmIcon = 'warning';
            } else {
                const selectedTable = allTables.find(t => t.id === selectedTableId);
                if (selectedTable) {
                    confirmTitle = guest.tableId ? 'Changer de table ?' : 'Assigner à une table ?';
                    const action = guest.tableId ? 'Changer vers' : 'Assigner à';
                    confirmMessage = `
                        ${action} <strong>Table #${selectedTable.tableNumber}${selectedTable.tableName ? ` (${selectedTable.tableName})` : ''}</strong> ?<br>
                        <small class="text-muted">Invité: <strong>${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</strong></small>
                    `;
                    confirmIcon = guest.tableId ? 'info' : 'success';
                }
            }
            
            // Afficher la confirmation
            const confirmResult = await Swal.fire({
                title: confirmTitle,
                html: confirmMessage,
                icon: confirmIcon,
                showCancelButton: true,
                confirmButtonText: 'Confirmer',
                cancelButtonText: 'Annuler',
                confirmButtonColor: confirmIcon === 'warning' ? '#EF4444' : '#D97706',
                reverseButtons: confirmIcon === 'warning'
            });
            
            if (!confirmResult.isConfirmed) {
                console.log('❌ Confirmation annulée par l\'utilisateur');
                return;
            }
            
            // Exécuter l'action
            if (selectedTableId === 'none') {
                // Retirer de la table actuelle
                if (guest.tableId) {
                    await storage.removeGuestFromTable(guest.tableId, guestId);
                    console.log(`🗑️ Invité retiré de la table`);
                }
            } else {
                // Assigner à la nouvelle table
                await storage.assignGuestToTable(selectedTableId, guestId, guest.seats || 1);
                console.log(`✅ Invité assigné à la table: ${selectedTableId}`);
            }
            
            // Recharger les invités
            await loadGuests();
            
            showNotification('success', 'Table mise à jour avec succès');
            
        } catch (error) {
            console.error('❌ Erreur gestion table:', error);
            const errorMsg = error.message.includes('déjà assigné') 
                ? 'Cet invité est déjà assigné à cette table'
                : error.message || 'Erreur lors de la gestion de la table';
            showNotification('error', errorMsg);
        }
    }
}

async function bulkAssignToTable() {
    if (selectedGuests.length === 0) return;
    
    console.log(`🪑 Assignation groupée à une table pour ${selectedGuests.length} invité(s)`);
    
    // Récupérer toutes les tables
    const tablesResult = await storage.getAllTables(currentEventId);
    
    // Gérer les deux formats de réponse (API ou local)
    let allTables = [];
    if (Array.isArray(tablesResult)) {
        allTables = tablesResult;
    } else if (tablesResult && tablesResult.data && Array.isArray(tablesResult.data)) {
        allTables = tablesResult.data;
    } else if (tablesResult && Array.isArray(tablesResult)) {
        allTables = tablesResult;
    }
    
    if (!Array.isArray(allTables)) {
        allTables = [];
    }
    
    // Calculer le total des places requises
    const selectedGuestData = selectedGuests.map(id => storage.getGuestById(id)).filter(Boolean);
    const totalRequiredSeats = selectedGuestData.reduce((sum, guest) => sum + (guest.seats || 1), 0);
    
    // Filtrer les tables avec capacité suffisante
    const availableTables = allTables.map(table => {
        const assignedGuests = storage.getGuestsByEventId(currentEventId)
            .filter(g => g.tableId === table.id && !selectedGuests.includes(g.id));
        
        const occupiedSeats = assignedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = table.capacity - occupiedSeats;
        const canAssign = availableSeats >= totalRequiredSeats;
        
        return {
            ...table,
            availableSeats,
            canAssign
        };
    });
    
    const { value: selectedTableId } = await Swal.fire({
        title: 'Assigner à une table',
        html: `
            <div class="text-start">
                <div class="alert alert-info mb-3">
                    <i class="fas fa-users me-2"></i>
                    <strong>${selectedGuests.length} invité(s) sélectionné(s)</strong><br>
                    <small>${totalRequiredSeats} place(s) totale(s) requise(s)</small>
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Sélectionner une table:</label>
                    <select id="bulkTableSelect" class="form-select">
                        <option value="">-- Non assigné --</option>
                        ${availableTables.map(table => `
                            <option value="${table.id}" ${!table.canAssign ? 'disabled' : ''}>
                                Table #${table.tableNumber}${table.tableName ? ` - ${table.tableName}` : ''}
                                (${table.availableSeats} place(s) disponible(s))
                                ${!table.canAssign ? ' - Capacité insuffisante' : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="selected-guests-preview" style="max-height: 200px; overflow-y: auto;">
                    ${selectedGuestData.map(guest => `
                        <div class="d-flex align-items-center mb-2">
                            <div class="guest-avatar-xs me-2" style="background: ${stringToColor(`${guest.firstName} ${guest.lastName}`)}">
                                ${getInitials(`${guest.firstName} ${guest.lastName}`)}
                                ${getGuestAvatarImage(guest) 
                        ? `<img src="${getGuestAvatarImage(guest)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none';">`
                        : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700;">${getInitials(`${guest.firstName} ${guest.lastName}`)}</span>`
                    }
                            </div>

                            <div class="flex-grow-1">
                                <small>${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</small>
                            </div>
                            <div>
                                <small class="badge bg-secondary">${guest.seats || 1} place(s)</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Assigner',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#D97706',
        preConfirm: () => {
            const select = document.getElementById('bulkTableSelect');
            return select.value;
        }
    });
    
    if (selectedTableId !== undefined) {
        try {
            const loading = Swal.fire({
                title: 'Assignation en cours...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading()
            });
            
            // Si une table est sélectionnée, assigner tous les invités
            if (selectedTableId) {
                for (const guestId of selectedGuests) {
                    const guest = storage.getGuestById(guestId);
                    if (guest) {
                        await storage.assignGuestToTable(selectedTableId, guestId, guest.seats || 1);
                    }
                }
            } else {
                // Si "Non assigné" est sélectionné, retirer tous les invités de leurs tables
                for (const guestId of selectedGuests) {
                    const guest = storage.getGuestById(guestId);
                    if (guest && guest.tableId) {
                        await storage.removeGuestFromTable(guest.tableId, guestId);
                    }
                }
            }
            
            await loading.close();
            
            // Recharger les invités et effacer la sélection
            await loadGuests();
            clearSelection();
            
            showNotification('success', 'Invités assignés avec succès');
            
        } catch (error) {
            console.error('❌ Erreur assignation groupée:', error);
            showNotification('error', 'Erreur lors de l\'assignation');
        }
    }
}

// ============================================================
// 📥 IMPORT CSV
// ============================================================
// ============================================================
// 📥 VARIABLES GLOBALES CSV
// ============================================================
let csvCurrentStep = 1;
let csvRawData = [];
let csvValidatedData = [];
let csvEventSelected = null;
let csvImportInProgress = false;

function initializeCSVImportListeners() {
    console.log('📥 Initialisation des écouteurs d\'import CSV...');
    
    // Boutons du modal d'import
    const closeCsvBtn = document.getElementById('closeCsvModalBtn');
    const cancelCsvBtn = document.getElementById('cancelCsvImportBtn');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    const csvFileInput = document.getElementById('csvFileInput');
    const csvDropZone = document.getElementById('csvDropZone');
    
    // Boutons du modal QR
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const closeQrBtn = document.getElementById('closeQrBtn');
    
    // Boutons de navigation entre étapes CSV
    const continueToStep2Btn = document.getElementById('continueToStep2Btn');
    const backToStep1Btn = document.getElementById('backToStep1Btn');
    const continueToStep3Btn = document.getElementById('continueToStep3Btn');
    const backToStep2Btn = document.getElementById('backToStep2Btn');
    const finalImportBtn = document.getElementById('finalImportBtn');
    
    if (closeCsvBtn) closeCsvBtn.addEventListener('click', closeCSVImportModal);
    if (cancelCsvBtn) cancelCsvBtn.addEventListener('click', closeCSVImportModal);
    if (downloadTemplateBtn) downloadTemplateBtn.addEventListener('click', downloadCSVTemplate);
    if (closeQrModalBtn) closeQrModalBtn.addEventListener('click', closeQRPreviewModal);
    if (closeQrBtn) closeQrBtn.addEventListener('click', closeQRPreviewModal);
    
    // Clic sur la zone de dépôt ouvre l'explorateur de fichiers
    if (csvDropZone && csvFileInput) {
        csvDropZone.addEventListener('click', () => csvFileInput.click());
        csvDropZone.addEventListener('change', handleCSVFileSelect);
    }
    
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleCSVFileSelect);
    }
    
    // Gestion du drag & drop
    if (csvDropZone) {
        csvDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            csvDropZone.classList.add('dragover');
        });
        
        csvDropZone.addEventListener('dragleave', () => {
            csvDropZone.classList.remove('dragover');
        });
        
        csvDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            csvDropZone.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) {
                handleCSVFile(file);
            }
        });
    }
    
    // Navigation entre étapes CSV
    if (continueToStep2Btn) continueToStep2Btn.addEventListener('click', goToCSVStep.bind(null, 2));
    if (backToStep1Btn) backToStep1Btn.addEventListener('click', goToCSVStep.bind(null, 1));
    if (continueToStep3Btn) continueToStep3Btn.addEventListener('click', goToCSVStep.bind(null, 3));
    if (backToStep2Btn) backToStep2Btn.addEventListener('click', goToCSVStep.bind(null, 2));
    if (finalImportBtn) finalImportBtn.addEventListener('click', performFinalCSVImport);
}

function openCSVImportModal() {
    console.log('📥 Ouverture du modal d\'import CSV');
    
    // Vérifier qu'un événement est sélectionné
    if (!currentEventId) {
        showNotification('warning', 'Aucun événement sélectionné');
        return;
    }
    
    // Réinitialiser l'état
    csvCurrentStep = 1;
    csvRawData = [];
    csvValidatedData = [];
    csvEventSelected = storage.getEventById(currentEventId);
    
    // Mettre à jour le nom de l'événement dans le titre
    const eventNameEl = document.getElementById('csvEventName');
    if (eventNameEl && csvEventSelected) {
        eventNameEl.textContent = csvEventSelected.name;
    }
    
    // Réinitialiser l'interface
    const previewContainer = document.getElementById('csvPreviewContainer');
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }
    
    const previewBody = document.getElementById('csvPreviewBody');
    if (previewBody) {
        previewBody.innerHTML = '';
    }
    
    const rowCount = document.getElementById('csvRowCount');
    if (rowCount) {
        rowCount.textContent = '0';
    }
    
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Afficher étape 1
    showCSVStep(1);
    
    const modal = document.getElementById('csvImportModal');
    if (modal) {
        // Assurer que tous les éléments enfants sont visibles
        const wrapper = modal.querySelector('.guest-creation-wrapper');
        const progressPanel = modal.querySelector('.creation-progress-panel');
        const formPanel = modal.querySelector('.creation-form-panel');
        
        if (wrapper) wrapper.style.removeProperty('display');
        if (progressPanel) progressPanel.style.removeProperty('display');
        if (formPanel) formPanel.style.removeProperty('display');
        
        modal.style.removeProperty('display');
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        modal.classList.add('active');
        
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
}

function closeCSVImportModal() {
    console.log('✗ Fermeture du modal d\'import CSV');
    
    const modal = document.getElementById('csvImportModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.display = 'none';
            
            // Réinitialiser
            csvCurrentStep = 1;
            csvRawData = [];
            csvValidatedData = [];
            csvEventSelected = null;
        }, 300);
    }
}

function openQRPreviewModal() {
    console.log('🔓 Ouverture du modal QR');
    
    const modal = document.getElementById('qrPreviewModal');
    if (modal) {
        // Assurer que tous les éléments enfants sont visibles
        const wrapper = modal.querySelector('.guest-creation-wrapper');
        const formPanel = modal.querySelector('.creation-form-panel');
        
        if (wrapper) wrapper.style.removeProperty('display');
        if (formPanel) formPanel.style.removeProperty('display');
        
        modal.style.removeProperty('display');
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        modal.classList.add('active');
        
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
}

function closeQRPreviewModal() {
    console.log('✗ Fermeture du modal QR');
    
    const modal = document.getElementById('qrPreviewModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }, 300);
    }
}

function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleCSVFile(file);
    }
}

function handleCSVFile(file) {
    console.log(`📄 Fichier CSV sélectionné: ${file.name}`);
    
    if (!file.name.endsWith('.csv')) {
        showNotification('error', 'Seuls les fichiers CSV sont acceptés');
        return;
    }
    
    if (!csvEventSelected) {
        showNotification('warning', 'Aucun événement sélectionné');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            parseCSVData(csvContent);
        } catch (error) {
            console.error('❌ Erreur lecture fichier CSV:', error);
            showNotification('error', 'Erreur de lecture du fichier CSV');
        }
    };
    
    reader.onerror = function() {
        showNotification('error', 'Erreur de lecture du fichier');
    };
    
    reader.readAsText(file, 'UTF-8');
}

function parseCSVData(csvContent) {
    // Utiliser Papa Parse si disponible, sinon parser manuellement
    if (window.Papa) {
        Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                displayCSVPreview(results.data);
            },
            error: function(error) {
                console.error('❌ Erreur parsing CSV:', error);
                showNotification('error', 'Erreur de parsing du fichier CSV');
            }
        });
    } else {
        // Parser manuellement
        const lines = csvContent.split('\n');
        if (lines.length < 2) {
            showNotification('error', 'Fichier CSV vide ou invalide');
            return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            data.push(row);
        }
        
        displayCSVPreview(data);
    }
}

function displayCSVPreview(data) {
    console.log(`📊 Aperçu CSV: ${data.length} ligne(s) trouvée(s)`);
    
    if (data.length === 0) {
        showNotification('warning', 'Aucune donnée valide trouvée dans le fichier');
        return;
    }
    
    // Ajouter des identifiants uniques et statut de suppression à chaque ligne
    data.forEach((row, index) => {
        if (!row._id) {
            // Créer un ID unique robuste basé sur l'email ou un timestamp
            const email = row['Email'] ? row['Email'].substring(0, 10) : `row_${index}`;
            row._id = `csv_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        }
        if (row._toDelete === undefined) {
            row._toDelete = false;
        }
    });
    
    // Stocker les données brutes
    csvRawData = data;
    
    // Show loading indicator and redirect to step 2
    Swal.fire({
        title: '⏳ Chargement...',
        html: '<p>Préparation de la validation...</p>',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: async () => {
            // Give visual feedback
            await new Promise(resolve => setTimeout(resolve, 500));
            Swal.close();
            
            // Redirect to step 2 and update progress indicator
            csvCurrentStep = 1;
            updateCSVProgressIndicator(2);
            
            // Open the edit modal with SweetAlert
            openCSVEditModal(data);
        }
    });
}

/**
 * Ouvre un modal SweetAlert pour visualiser et éditer les données CSV avec améliorations UX
 * - Champs manquants remplis avec valeurs par défaut
 * - Styling amélioré avec titre, résumé et indicateurs visuels
 * - Support select pour Type et Statut
 * - Meilleure gestion des erreurs et validation
 */
function openCSVEditModal(data) {
    // Champs requis avec valeurs par défaut
    const requiredFields = {
        'Prénom': { required: true, default: '' },
        'Nom': { required: true, default: 'M.' },
        'Email': { required: true, default: 'no@gmail.com' },
        'Téléphone': { required: false, default: '' },
        'Entreprise': { required: false, default: '' },
        'Genre': { required: false, default: '' },
        'Places': { required: false, default: '1' },
        'Type': { required: false, default: 'standard' },
        'Statut': { required: false, default: 'pending' },
        'Notes': { required: false, default: '' }
    };

    // Enrichir les données avec champs manquants et appliquer les valeurs par défaut
    data.forEach(row => {
        Object.keys(requiredFields).forEach(field => {
            const fieldValue = row[field];
            
            // Vérifier si la valeur est vide, null, undefined ou "null" (string)
            const isEmpty = !fieldValue || 
                           fieldValue.toString().trim() === '' || 
                           fieldValue.toString().toLowerCase() === 'null' ||
                           fieldValue.toString().toLowerCase() === '-';
            
            if (isEmpty) {
                row[field] = requiredFields[field].default;
            } else {
                // Nettoyer et normaliser la valeur
                let cleanedValue = fieldValue.toString().trim();
                
                // Normaliser les valeurs pour Type et Statut
                if (field === 'Type') {
                    cleanedValue = cleanedValue.toLowerCase();
                    const validTypes = ['standard', 'vip', 'speaker', 'sponsor'];
                    if (!validTypes.includes(cleanedValue)) {
                        cleanedValue = 'standard';
                    }
                } else if (field === 'Statut') {
                    cleanedValue = cleanedValue.toLowerCase();
                    const validStatuses = ['pending', 'confirmed', 'cancelled'];
                    if (!validStatuses.includes(cleanedValue)) {
                        cleanedValue = 'pending';
                    }
                } else if (field === 'Genre') {
                    cleanedValue = cleanedValue.toLowerCase();
                    const validGenders = ['m', 'f', 'homme', 'femme', 'couple', 'maman', 'autre'];
                    if (!validGenders.includes(cleanedValue)) {
                        cleanedValue = '';
                    }
                    // Note: On garde 'homme'/'femme' tels quels, le select les affichera correctement avec les labels
                } else if (field === 'Places') {
                    const numValue = parseInt(cleanedValue);
                    cleanedValue = isNaN(numValue) || numValue < 1 ? '1' : numValue.toString();
                }
                
                row[field] = cleanedValue;
            }
        });
    });

    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Genre', 'Places', 'Type', 'Statut', 'Notes'];
    const typeOptions = ['standard', 'vip', 'speaker', 'sponsor'];
    const statusOptions = ['pending', 'confirmed', 'cancelled'];
    const genderOptions = ['', 'm', 'f', 'homme', 'femme', 'couple', 'maman', 'autre'];
    const genderLabels = { '': '-- Sélectionner --', 'm': 'Homme', 'f': 'Femme', 'homme': 'Homme', 'femme': 'Femme', 'couple': 'Couple', 'maman': 'Maman', 'autre': 'Autre' };

    // Construire le HTML du modal
    let html = `<div style="max-height:80vh;display:flex;flex-direction:column;gap:16px;">`;
    
    // Titre avec icône
    html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">`;
    html += `<i class="fas fa-file-csv" style="font-size:24px;color:var(--secura-primary)"></i>`;
    html += `<h3 style="margin:0;color:var(--text-color);font-size:18px;font-weight:700">Import CSV - Édition des données</h3>`;
    html += `</div>`;

    // ZONE DE CONFIRMATION DE SUPPRESSION
    html += `<div id="sw_csv_delete_confirmation" style="display:none;background:rgba(239,68,68,0.1);border:1.5px solid #ef4444;border-radius:6px;padding:12px;margin-bottom:12px;align-items:center;gap:12px;">`;
    html += `<div style="flex:1;">`;
    html += `<div style="font-weight:600;color:#ef4444;margin-bottom:4px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>Ligne marquée pour suppression</div>`;
    html += `<div style="font-size:12px;color:var(--text-color);"><span id="sw_csv_delete_info"></span></div>`;
    html += `</div>`;
    html += `<button type="button" class="btn btn-sm btn-danger" id="sw_csv_confirm_delete_final" style="min-width:140px;"><i class="fas fa-trash"></i> Supprimer définitivement</button>`;
    html += `<button type="button" class="btn btn-sm btn-warning" id="sw_csv_cancel_delete" style="min-width:120px;"><i class="fas fa-undo"></i> Restaurer</button>`;
    html += `</div>`;

    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:0 12px;gap:12px;">`;
    html += `<div style="font-weight:600;color:var(--text-color)"><strong id="sw_csv_total_count">${data.length}</strong> ligne(s)</div>`;
    html += `<div style="font-size:13px;color:var(--secura-text-gray)">Invalides: <span id="sw_csv_invalid_count" style="color:var(--secura-error);font-weight:600">0</span> - Valides: <span id="sw_csv_valid_count" style="color:var(--secura-success);font-weight:700;font-size:14px">${data.length}</span></div>`;
    html += `<button type="button" id="sw_csv_add_row_btn" class="btn btn-success btn-sm" style="margin-left:auto;"><i class="fas fa-plus"></i> Ajouter ligne</button>`;
    html += `</div>`;

    // Tableau scrollable horizontalement
    html += `<div style="overflow-x:auto;min-width:1200px;flex:1;border:1px solid var(--border-color);border-radius:6px;">`;
    html += `<table class="data-table-pro guests-table" style="width:100%;border-collapse:collapse;">`;
    
    // En-têtes
    html += `<thead><tr style="table-header">`;
    headers.forEach(h => {
        const isRequired = requiredFields[h]?.required;
        const label = isRequired ? `${h} <span style="color:#ff4444;font-weight:700">*</span>` : h;
        html += `<th style="padding:14px;text-align:left;font-weight:600;font-size:13px;border-right:1px solid rgba(255,255,255,0.15);white-space:nowrap">${label}</th>`;
    });
    html += `<th style="padding:14px;text-align:center;font-weight:600;font-size:13px;width:80px;white-space:nowrap">État</th>`;
    html += `<th style="padding:14px;text-align:center;font-weight:600;font-size:13px;width:60px;white-space:nowrap">Actions</th>`;
    html += `</tr></thead><tbody id="sw_csv_tbody">`;

    // Lignes de données
    data.forEach((row) => {
        const isMarked = row._toDelete || false;
        const rowId = row._id || `csv_row_${Date.now()}_${Math.random()}`;
        
        html += `<tr id="sw_csv_row_${rowId}" class="csv-data-row" style="transition:all 0.2s;border-bottom:1px solid var(--border-color);${isMarked ? 'background:rgba(100,100,100,0.1);opacity:0.6;' : ''}">`;
       
        headers.forEach(h => {
            const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : requiredFields[h].default;
            const safeKey = String(h).replace(/[^\w\-]/g, '_');
            const isRequired = requiredFields[h]?.required;
            
            let isInvalid = false;
            if (!isMarked && isRequired) {
                const isEmpty = !val || val.trim() === '' || val.toLowerCase() === 'null' || val === '-';
                if (isEmpty) {
                    isInvalid = true;
                } else {
                    // Validations spécifiques par champ
                    if (h === 'Email' && !validateEmail(val)) {
                        isInvalid = true;
                    } else if (h === 'Téléphone' && val && !validatePhone(val)) {
                        isInvalid = true;
                    } else if (h === 'Places' && (isNaN(parseInt(val)) || parseInt(val) < 1)) {
                        isInvalid = true;
                    }
                }
            }
            
            const invalidStyle = isInvalid ? 'border:1.5px solid #ef4444 !important;background-color:rgba(239, 68, 68, 0.05) !important;' : '';
            const disabledStyle = isMarked ? 'opacity:0.5;cursor:not-allowed;' : '';

            if (h === 'Type') {
                html += `<td style="padding:10px;"><select ${isMarked ? 'disabled' : ''} data-id="${rowId}" data-key="${h}" id="sw_csv_${rowId}_${safeKey}" class="sw-csv-input form-control" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;background:var(--secura-white);color:var(--secura-black);${invalidStyle}${disabledStyle}">`;
                typeOptions.forEach(opt => {
                    const selected = val.toLowerCase() === opt ? 'selected' : '';
                    html += `<option value="${opt}" ${selected}>${opt}</option>`;
                });
                html += `</select></td>`;
            } else if (h === 'Statut') {
                html += `<td style="padding:10px;"><select ${isMarked ? 'disabled' : ''} data-id="${rowId}" data-key="${h}" id="sw_csv_${rowId}_${safeKey}" class="sw-csv-input form-control" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;background:var(--secura-white);color:var(--secura-black);${invalidStyle}${disabledStyle}">`;
                statusOptions.forEach(opt => {
                    const selected = val.toLowerCase() === opt ? 'selected' : '';
                    html += `<option value="${opt}" ${selected}>${opt}</option>`;
                });
                html += `</select></td>`;
            } else if (h === 'Genre') {
                html += `<td style="padding:10px;"><select ${isMarked ? 'disabled' : ''} data-id="${rowId}" data-key="${h}" id="sw_csv_${rowId}_${safeKey}" class="sw-csv-input form-control" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;background:var(--secura-white);color:var(--secura-black);${invalidStyle}${disabledStyle}">`;
                genderOptions.forEach(opt => {
                    // Normaliser les valeurs pour comparaison
                    const normalizedVal = val ? val.toLowerCase().trim() : '';
                    const normalizedOpt = opt ? opt.toLowerCase().trim() : '';
                    
                    // Vérifier si c'est une correspondance
                    let isSelected = false;
                    if (opt === '') {
                        isSelected = !normalizedVal || normalizedVal === '';
                    } else if (normalizedVal === normalizedOpt) {
                        isSelected = true;
                    } else if (normalizedVal === 'f' && (normalizedOpt === 'femme' || normalizedOpt === 'f')) {
                        isSelected = true;
                    } else if (normalizedVal === 'm' && (normalizedOpt === 'homme' || normalizedOpt === 'm')) {
                        isSelected = true;
                    } else if (normalizedVal === 'femme' && normalizedOpt === 'f') {
                        isSelected = true;
                    } else if (normalizedVal === 'homme' && normalizedOpt === 'm') {
                        isSelected = true;
                    }
                    
                    const selected = isSelected ? 'selected' : '';
                    html += `<option value="${opt}" ${selected}>${genderLabels[opt] || opt}</option>`;
                });
                html += `</select></td>`;
            } else if (h === 'Places') {
                html += `<td style="padding:10px;"><input type="number" ${isMarked ? 'disabled' : ''} data-id="${rowId}" data-key="${h}" id="sw_csv_${rowId}_${safeKey}" class="sw-csv-input form-control" value="${escapeHtml(val)}" min="1" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;background:var(--secura-white);color:var(--secura-black);${invalidStyle}${disabledStyle}" /></td>`;
            } else {
                html += `<td style="padding:10px;"><input type="text" ${isMarked ? 'disabled' : ''} data-id="${rowId}" data-key="${h}" id="sw_csv_${rowId}_${safeKey}" class="sw-csv-input form-control" value="${escapeHtml(val)}" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;background:var(--secura-white);color:var(--secura-black);${invalidStyle}${disabledStyle}" /></td>`;
            }
        });
        
        html += `<td style="padding:10px;text-align:center;white-space:nowrap;"><span id="sw_csv_badge_${rowId}" class="badge ${isMarked ? 'bg-secondary' : 'bg-warning'}" style="font-size:14px;padding:6px 8px;">${isMarked ? '🗑️' : '?'}</span></td>`;
        html += `<td style="padding:10px;text-align:center;white-space:nowrap;display:flex;gap:5px;justify-content:space-around;align-items:center;">`;
        
        if (isMarked) {
            html += `<button type="button" class="action-btn btn-sm btn-success sw-csv-restore-row" data-id="${rowId}" style="padding:4px 8px;font-size:12px;" title="Restaurer"><i class="fas fa-undo"></i></button>`;
        } else {
            html += `<button type="button" class="action-btn btn-sm btn-danger delete sw-csv-mark-delete" data-id="${rowId}" style="padding:4px 8px;font-size:12px;" title="Marquer pour suppression"><i class="fas fa-trash"></i></button>`;
        }
        
        html += `</td>`;
        html += `</tr>`;
        
        // Ligne d'erreurs (seulement pour les lignes non marquées)
        if (!isMarked) {
            html += `<tr id="sw_csv_msg_row_${rowId}" style="display:none;border-bottom:1px solid var(--border-color);background:rgba(239, 68, 68, 0.08);border-left:3px solid #ef4444;">`;
            html += `<td colspan="${headers.length + 2}" style="padding:8px 12px;font-size:12px;color:var(--secura-error);">`;
            html += `<i class="fas fa-circle-exclamation" style="margin-right:6px;"></i><span id="sw_csv_msg_${rowId}"></span>`;
            html += `</td></tr>`;
        }
    });

    html += `</tbody></table></div>`;

    // Note informative
    html += `<div style="background:rgba(59, 130, 246, 0.05);padding:10px 12px;border-radius:4px;font-size:12px;color:var(--secura-text-gray);border-left:3px solid var(--secura-primary);">`;
    html += `<i class="fas fa-circle-info"></i> <strong>Conseils:</strong> Les champs marqués d'un * sont obligatoires. Vous pouvez ajouter ou supprimer des lignes.`;
    html += `</div>`;

    html += `</div>`;

    Swal.fire({
        title: '',
        html,
        width: '95%',
        showCancelButton: true,
        confirmButtonText: 'Continuer vers validation',
        cancelButtonText: 'Annuler',
        confirmButtonColor: 'var(--secura-primary)',
        cancelButtonColor: '#888',
        didOpen: () => {
            const popup = Swal.getPopup();
            const inputs = popup.querySelectorAll('.sw-csv-input:not([disabled])');
            const invalidCountEl = popup.querySelector('#sw_csv_invalid_count');
            const validCountEl = popup.querySelector('#sw_csv_valid_count');
            const tbody = popup.querySelector('#sw_csv_tbody');
            const addRowBtn = popup.querySelector('#sw_csv_add_row_btn');
            const totalCountEl = popup.querySelector('#sw_csv_total_count');

            // ========== FONCTION DE VALIDATION ==========
            const refreshValidationMarks = () => {
                let invalid = 0;
                let valid = 0;

                data.forEach((row) => {
                    if (row._toDelete) return; // Ignorer les lignes marquées pour suppression
                    
                    const rowId = row._id;
                    const tr = document.getElementById(`sw_csv_row_${rowId}`);
                    const msgRow = document.getElementById(`sw_csv_msg_row_${rowId}`);
                    const msgEl = document.getElementById(`sw_csv_msg_${rowId}`);
                    const badgeEl = document.getElementById(`sw_csv_badge_${rowId}`);
                    
                    const errors = [];
                    
                    // Validation des champs obligatoires
                    const firstName = (row['Prénom'] || '').trim();
                    const lastName = (row['Nom'] || '').trim();
                    const email = (row['Email'] || '').trim();
                    const phone = (row['Téléphone'] || '').trim();
                    const places = (row['Places'] || '').trim();
                    
                    if (!firstName) errors.push('Prénom requis');
                    if (!lastName) errors.push('Nom requis');
                    if (!email || !validateEmail(email)) errors.push('Email invalide');
                    if (phone && !validatePhone(phone)) errors.push('Téléphone invalide');
                    if (places && isNaN(parseInt(places))) errors.push('Places: nombre requis');
                    if (places && parseInt(places) < 1) errors.push('Places minimum: 1');

                    const isValid = errors.length === 0;
                    
                    if (tr) {
                        if (!isValid) {
                            tr.style.background = 'rgba(239, 68, 68, 0.08)';
                            tr.style.borderLeft = '3px solid #ef4444';
                            if (badgeEl) {
                                badgeEl.className = 'badge bg-danger';
                                badgeEl.innerHTML = '<i class="fas fa-xmark" style="font-size:16px;"></i>';
                            }
                            invalid++;
                        } else {
                            tr.style.background = 'rgba(16, 185, 129, 0.08)';
                            tr.style.borderLeft = '3px solid #10b981';
                            if (badgeEl) {
                                badgeEl.className = 'badge bg-success';
                                badgeEl.innerHTML = '<i class="fas fa-check" style="font-size:16px;"></i>';
                            }
                            valid++;
                        }
                    }

                    // Afficher/masquer les erreurs
                    if (msgRow && msgEl) {
                        if (!isValid) {
                            msgRow.style.display = 'table-row';
                            msgEl.innerHTML = errors.map(e => `<span style="background:rgba(239, 68, 68, 0.2);padding:4px 8px;border-radius:4px;border-left:2px solid #ef4444;margin-right:6px;">${e}</span>`).join('');
                        } else {
                            msgRow.style.display = 'none';
                        }
                    }
                });

                if (invalidCountEl) invalidCountEl.textContent = String(invalid);
                if (validCountEl) validCountEl.textContent = String(valid);
            };

            // ========== EVENT LISTENERS POUR LES INPUTS ==========
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    const rowId = inp.dataset.id;
                    const key = inp.dataset.key;
                    const row = data.find(r => r._id === rowId);
                    if (row) {
                        row[key] = inp.value;
                        refreshValidationMarks();
                    }
                });
                inp.addEventListener('input', () => {
                    const rowId = inp.dataset.id;
                    const key = inp.dataset.key;
                    const row = data.find(r => r._id === rowId);
                    if (row) {
                        row[key] = inp.value;
                        refreshValidationMarks();
                    }
                });
            });

            // ========== EVENT LISTENERS POUR AJOUTER/SUPPRIMER ==========
            const markDeleteButtons = popup.querySelectorAll('.sw-csv-mark-delete');
            const restoreButtons = popup.querySelectorAll('.sw-csv-restore-row');
            const deleteConfirmationBox = popup.querySelector('#sw_csv_delete_confirmation');
            const confirmDeleteFinalBtn = popup.querySelector('#sw_csv_confirm_delete_final');
            const cancelDeleteBtn = popup.querySelector('#sw_csv_cancel_delete');
            const deleteInfoSpan = popup.querySelector('#sw_csv_delete_info');

            // Fonction pour afficher/masquer la zone de confirmation
            const updateDeleteConfirmation = () => {
                const markedRow = data.find(r => r._toDelete);
                if (markedRow && deleteConfirmationBox) {
                    deleteConfirmationBox.style.display = 'flex';
                    const firstName = (markedRow['Prénom'] || '?').trim();
                    const lastName = (markedRow['Nom'] || '?').trim();
                    if (deleteInfoSpan) {
                        deleteInfoSpan.textContent = `${firstName} ${lastName}`;
                    }
                } else if (deleteConfirmationBox) {
                    deleteConfirmationBox.style.display = 'none';
                }
            };

            // Marquer pour suppression
            markDeleteButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const row = data.find(r => r._id === btn.dataset.id);
                    if (row) {
                        row._toDelete = true;
                        updateDeleteConfirmation();
                    }
                });
            });

            // Restaurer une ligne depuis le bouton de la ligne
            restoreButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const row = data.find(r => r._id === btn.dataset.id);
                    if (row) {
                        row._toDelete = false;
                        updateDeleteConfirmation();
                        refreshValidationMarks();
                    }
                });
            });

            // Confirmer la suppression définitive
            if (confirmDeleteFinalBtn) {
                confirmDeleteFinalBtn.addEventListener('click', () => {
                    // Supprimer la ligne marquée
                    const markedIdx = data.findIndex(r => r._toDelete);
                    if (markedIdx > -1) {
                        data.splice(markedIdx, 1);
                        
                        // Si plus de données, recharger le modal
                        if (data.length === 0) {
                            Swal.close();
                            Swal.fire({
                                icon: 'info',
                                title: 'Import annulé',
                                text: 'Toutes les lignes ont été supprimées. Vous pouvez relancer un import.',
                                confirmButtonColor: 'var(--secura-primary)'
                            });
                        } else {
                            Swal.close();
                            setTimeout(() => {
                                openCSVEditModal(data);
                            }, 50);
                        }
                    }
                });
            }

            // Annuler la suppression (restaurer)
            if (cancelDeleteBtn) {
                cancelDeleteBtn.addEventListener('click', () => {
                    const row = data.find(r => r._toDelete);
                    if (row) {
                        row._toDelete = false;
                        updateDeleteConfirmation();
                        refreshValidationMarks();
                    }
                });
            }

            // Ajouter une nouvelle ligne
            if (addRowBtn) {
                addRowBtn.addEventListener('click', () => {
                    const newRow = {
                        _id: `csv_row_${Date.now()}_${Math.random()}`,
                        _toDelete: false,
                        'Prénom': '',
                        'Nom': 'M.',
                        'Email': 'no@gmail.com',
                        'Téléphone': '',
                        'Entreprise': '',
                        'Genre': '',
                        'Places': '1',
                        'Type': 'standard',
                        'Statut': 'pending',
                        'Notes': ''
                    };
                    data.push(newRow);
                    Swal.close();
                    setTimeout(() => {
                        openCSVEditModal(data);
                    }, 50);
                });
            }

            // Initialiser la validation et la zone de confirmation
            refreshValidationMarks();
            updateDeleteConfirmation();
        },
        preConfirm: () => {
            // Filtrer les lignes marquées pour suppression
            const filteredData = data.filter(row => !row._toDelete);
            
            // Vérifier qu'il n'y a pas d'erreurs
            let hasErrors = false;
            filteredData.forEach(row => {
                if (!row['Prénom'] || !row['Prénom'].trim()) hasErrors = true;
                if (!row['Nom'] || !row['Nom'].trim()) hasErrors = true;
                if (!row['Email'] || !validateEmail(row['Email'])) hasErrors = true;
                if (row['Places'] && isNaN(parseInt(row['Places']))) hasErrors = true;
                if (row['Places'] && parseInt(row['Places']) < 1) hasErrors = true;
            });
            
            if (hasErrors) {
                Swal.showValidationMessage('Veuillez corriger toutes les erreurs avant de continuer');
                return false;
            }
            
            // Mettre à jour les données globales avec les lignes filtrées (sans _id et _toDelete)
            csvRawData = filteredData.map(row => {
                const { _id, _toDelete, ...cleanRow } = row;
                return cleanRow;
            });
            
            return true;
        }
    }).then((res) => {
        if (res.isConfirmed) {
            goToCSVStep(2);
        }
    });
}

function downloadCSVTemplate() {
    console.log('📥 Téléchargement du template CSV');
    
    // Template complet avec commentaires d'aide et exemples variés
    const csvContent = `Prénom,Nom,Email,Téléphone,Entreprise,Genre,Places,Type,Statut,Notes
Jean,Dupont,jean.dupont@exemple.com,+33 6 12 34 56 78,Company SA,m,1,standard,pending,Invitation standard - À confirmer
Marie,Martin,marie.martin@exemple.com,+33 6 98 76 54 32,Startup Inc.,f,1,vip,confirmed,VIP confirmée
Pierre,Durand,pierre.durand@exemple.com,+33 6 11 22 33 44,Tech Corp,homme,2,standard,pending,Accompagné de son conjoint
Sophie,Bernard,sophie.bernard@exemple.com,+33 6 55 66 77 88,Events Pro,couple,3,speaker,confirmed,Présentatrice avec accompagnants
Marc,Lefebvre,marc.lefebvre@exemple.com,+33 6 99 88 77 66,Digital Solutions,maman,1,sponsor,confirmed,Sponsor - Parent accompagnateur
Isabelle,Thomas,isabelle.thomas@exemple.com,+33 6 44 33 22 11,Fashion House,femme,1,vip,confirmed,Invitée VIP
Charles,Robert,charles.robert@exemple.com,+33 6 77 88 99 00,Construction Ltd,m,1,standard,cancelled,Annulé
Véronique,Petit,veronique.petit@exemple.com,+33 6 31 42 53 64,Consulting,f,1,standard,pending,À contacter
Laurent,Dubois,laurent.dubois@exemple.com,+33 6 64 75 86 97,Finance Group,homme,2,standard,pending,
Francine,Moreau,francine.moreau@exemple.com,+33 6 50 61 72 83,Travel Agency,autre,1,speaker,confirmed,Conférencière keynote`;
    
    // Ajouter BOM UTF-8 pour compatibilité Excel et encodage correct
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-invites-secura.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('success', '✅ Modèle téléchargé: modele-invites-secura.csv');
}

function normalizeValue(row, ...keys) {
    for (const key of keys) {
        if (row[key]) return row[key];
        if (row[key.toLowerCase()]) return row[key.toLowerCase()];
        if (row[key.toUpperCase()]) return row[key.toUpperCase()];
    }
    return '';
}

function normalizeEmail(email) {
    if (!email || !email.trim()) return 'no@gmail.com';
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) return normalized + '@gmail.com';
    return normalized;
}

function normalizePhone(phone) {
    if (!phone || !phone.trim()) return '';
    return phone.trim();
}

function validateEmail(email) {
    if (!email || !email.trim()) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim().toLowerCase());
}

function validatePhone(phone) {
    if (!phone || !phone.trim()) return true; // optionnel
    const regex = /^[+]?[\d\s\-()]+$/;
    return regex.test(phone.trim());
}

function goToCSVStep(step) {
    console.log(`📋 Navigation étape CSV: ${csvCurrentStep} → ${step}`);
    
    if (step === 2 && csvCurrentStep === 1) {
        // Valider avant d'aller à l'étape 2
        if (csvRawData.length === 0) {
            showNotification('error', 'Aucune donnée chargée');
            return;
        }
        if (!csvEventSelected) {
            showNotification('error', 'Événement non sélectionné');
            return;
        }
        // L'étape 2 est affichée par SweetAlert dans prepareValidationStep()
        prepareValidationStep();
        return; 
    }
    
    if (step === 3 && csvCurrentStep === 2) {
        // Valider avant d'aller à l'étape 3
        const validRows = csvValidatedData.filter(r => r.isValid);
        if (validRows.length === 0) {
            showNotification('warning', 'Aucune ligne valide à importer');
            return;
        }
        prepareConfirmationStep();
        return;
    }
    
    showCSVStep(step);
}

function updateCSVProgressIndicator(step) {
    console.log(`📊 Mise à jour progression CSV: étape ${step}/3`);
    
    // Mettre à jour les indicateurs d'étape (scoped to CSV modal only)
    const csvModal = document.getElementById('csvImportModal');
    if (csvModal) {
        csvModal.querySelectorAll('.vertical-step').forEach((el, idx) => {
            el.classList.remove('active');
            if (idx + 1 <= step) el.classList.add('active');
        });
    }
    
    // Mettre à jour la barre de progression
    const progress = (step / 3) * 100;
    const progressBar = document.getElementById('csvProgressBar');
    if (progressBar) {
        progressBar.style.width = progress + '%';
        progressBar.style.transition = 'width 0.3s ease';
    }
    
    const progressText = document.getElementById('csvProgressText');
    if (progressText) {
        progressText.textContent = `Étape ${step}/3`;
    }
}

function showCSVStep(step) {
    console.log(`📊 Affichage étape CSV: ${step}`);
    
    csvCurrentStep = step;
    
    // Mettre à jour l'indicateur de progression
    updateCSVProgressIndicator(step);
    
    // Masquer toutes les étapes dans le modal CSV uniquement
    const csvModal = document.getElementById('csvImportModal');
    if (csvModal) {
        csvModal.querySelectorAll('.creation-step-content').forEach((el) => {
            el.classList.remove('active');
        });
    }
    
    // Afficher l'étape actuelle
    const stepContent = document.getElementById(`csvStep${step}Content`);
    if (stepContent) {
        stepContent.classList.add('active');
    }
}

function prepareValidationStep() {
    console.log('🔄 Préparation de l\'étape 2: validation');
    
    // Mettre à jour l'indicateur d'étape
    csvCurrentStep = 2;
    updateCSVProgressIndicator(2);
    
    // Valider et normaliser chaque ligne
    csvValidatedData = csvRawData.map((row, idx) => {
        const lastName = normalizeValue(row, 'Prénom', 'Prenom', 'FirstName').trim();
        const firstName = normalizeValue(row, 'Nom', 'LastName').trim();
        const email = normalizeValue(row, 'Email', 'email').trim();
        const phone = normalizeValue(row, 'Téléphone', 'Telephone', 'Phone', 'phone').trim();
        const company = normalizeValue(row, 'Entreprise', 'Company').trim();

        const gender = normalizeValue(row, 'Genre', 'Gender', 'Sexe', 'Sex').trim();

        const seats = parseInt(normalizeValue(row, 'Places', 'Seats', 'seats') || '1') || 1;
        const type = (normalizeValue(row, 'Type', 'type') || 'standard').toLowerCase().trim();
        const status = (normalizeValue(row, 'Statut', 'Status', 'status') || 'pending').toLowerCase().trim();
        const companions = parseInt(normalizeValue(row, 'Accompagnants', 'Companions', 'Companions') || '0') || 0;
        const notes = normalizeValue(row, 'Notes', 'notes').trim();
        
        // Valider les données
        const errors = [];
        if (!firstName && !lastName) {
            errors.push('Prénom ou nom requis');
        }
        if (!firstName) errors.push('Prénom requis');
        if (!lastName) errors.push('Nom requis');
        if (!email) {
            errors.push('Email requis');
        } else if (!validateEmail(email)) {
            errors.push('Email invalide');
        }
        if (phone && !validatePhone(phone)) errors.push('Téléphone invalide');
        if (!seats || seats < 1) errors.push('Places invalides');
        
        // Valider type et status
        const validTypes = ['standard', 'vip', 'speaker'];
        if (!validTypes.includes(type)) errors.push(`Type "${type}" invalide`);
        
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'checked_in', 'no_show'];
        if (!validStatuses.includes(status)) errors.push(`Statut "${status}" invalide`);
        
        const isValid = errors.length === 0;
        
        return {
            index: idx,
            raw: row,
            firstName,
            lastName,
            email: email || 'no@gmail.com',
            phone,
            company,
            gender,
            seats: Math.max(1, seats),
            type: validTypes.includes(type) ? type : 'standard',
            status: validStatuses.includes(status) ? status : 'pending',
            companions: Math.max(0, companions),
            notes,
            isValid,
            errors
        };
    });
    
    renderValidationStepWithSwal();
}

/**
 * Affiche l'étape 2 avec SweetAlert pour éditer les données - TOUS LES CHAMPS
 */
function renderValidationStepWithSwal() {
    const validCount = csvValidatedData.filter(r => r.isValid).length;
    const invalidCount = csvValidatedData.filter(r => !r.isValid).length;
    
    let html = `<div style="max-height:75vh; overflow:auto;">`;
    
    // Résumé avec icônes
    html += `<div style="display:flex;gap:20px;margin-bottom:15px;padding:12px;background:var(--secura-primary);border-radius:8px;color:white">`;
    html += `<div style="flex:1;text-align:center"><div style="font-size:12px;opacity:0.8"><i class="fas fa-check-circle"></i> Valides</div><div style="font-weight:600;font-size:18px">${validCount}</div></div>`;
    html += `<div style="flex:1;text-align:center"><div style="font-size:12px;opacity:0.8"><i class="fas fa-times-circle"></i> Invalides</div><div style="font-weight:600;font-size:18px">${invalidCount}</div></div>`;
    html += `<div style="flex:1;text-align:center"><div style="font-size:12px;opacity:0.8"><i class="fas fa-file-csv"></i> Total</div><div style="font-weight:600;font-size:18px">${csvValidatedData.length}</div></div>`;
    html += `</div>`;
    
    // Tableau éditable avec CSS classes - TOUS LES CHAMPS
    html += `<div class="guests-table-pro" style="margin:0;overflow:hidden">`;
    html += `<table class="data-table-pro">`;
    html += `<thead><tr style="background:var(--secura-primary);color:white;position:sticky;top:0;z-index:10">`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:9%">Prénom</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:9%">Nom</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:11%">Email</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:9%">Téléphone</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:10%">Entreprise</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:7%">Genre</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:6%">Places</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:7%">Type</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:8%">Statut</th>`;
    html += `<th style="padding:12px;text-align:left;font-weight:600;font-size:12px;width:12%">Notes</th>`;
    html += `<th style="padding:12px;text-align:center;font-weight:600;font-size:12px;width:6%">✓</th>`;
    html += `</tr></thead><tbody>`;
    
    csvValidatedData.forEach((row, i) => {
        const rowBg = row.isValid ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
        html += `<tr id="csv-val-row-${i}" class="guest-row-pro" style="background:${rowBg}">`;
        
        // Prénom
        html += `<td style="padding:10px"><input data-idx="${i}" data-field="firstName" class="csv-val-input form-control" value="${escapeHtml(row.firstName || '')}" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)" /></td>`;
        
        // Nom
        html += `<td style="padding:10px"><input data-idx="${i}" data-field="lastName" class="csv-val-input form-control" value="${escapeHtml(row.lastName || '')}" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)" /></td>`;
        
        // Email
        html += `<td style="padding:10px"><input data-idx="${i}" data-field="email" class="csv-val-input form-control" value="${escapeHtml(row.email || '')}" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)" /></td>`;
        
        // Téléphone
        html += `<td style="padding:10px"><input data-idx="${i}" data-field="phone" class="csv-val-input form-control" value="${escapeHtml(row.phone || '')}" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)" /></td>`;
        
        // Entreprise
        html += `<td style="padding:10px"><input data-idx="${i}" data-field="company" class="csv-val-input form-control" value="${escapeHtml(row.company || '')}" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)" /></td>`;
        

        // Genre
        const genderOptions = ['', 'm', 'f', 'homme', 'femme', 'couple', 'maman', 'autre'];
        const genderLabels = { '': '-- Sélectionner --', 'm': 'Homme', 'f': 'Femme', 'homme': 'Homme', 'femme': 'Femme', 'couple': 'Couple', 'maman': 'Maman', 'autre': 'Autre' };
        html += `<td style="padding:10px"><select data-idx="${i}" data-field="gender" class="csv-val-input form-control" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)">`;
        genderOptions.forEach(opt => {
            const isSelected = row.gender && row.gender.toLowerCase() === opt.toLowerCase();
            const label = genderLabels[opt] || opt;
            html += `<option value="${opt}" ${isSelected ? 'selected' : ''}>${label}</option>`;
        });
        html += `</select></td>`;
        
       
        // Places (seats)
        html += `<td style="padding:10px"><input type="number" data-idx="${i}" data-field="seats" class="csv-val-input form-control" value="${row.seats || 1}" min="1" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)" /></td>`;
        
        // Type
        html += `<td style="padding:10px"><select data-idx="${i}" data-field="type" class="csv-val-input form-control" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)">`;
        html += `<option value="standard" ${(row.type || 'standard') === 'standard' ? 'selected' : ''}>Standard</option>`;
        html += `<option value="vip" ${row.type === 'vip' ? 'selected' : ''}>VIP</option>`;
        html += `<option value="speaker" ${row.type === 'speaker' ? 'selected' : ''}>Speaker</option>`;
        html += `</select></td>`;
        
        // Statut
        html += `<td style="padding:10px"><select data-idx="${i}" data-field="status" class="csv-val-input form-control" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)">`;
        html += `<option value="pending" ${(row.status || 'pending') === 'pending' ? 'selected' : ''}>En attente</option>`;
        html += `<option value="confirmed" ${row.status === 'confirmed' ? 'selected' : ''}>Confirmé</option>`;
        html += `<option value="cancelled" ${row.status === 'cancelled' ? 'selected' : ''}>Annulé</option>`;
        html += `<option value="checked_in" ${row.status === 'checked_in' ? 'selected' : ''}>Enregistré</option>`;
        html += `<option value="no_show" ${row.status === 'no_show' ? 'selected' : ''}>Absent</option>`;
        html += `</select></td>`;
        
        // Notes
        html += `<td style="padding:10px"><input data-idx="${i}" data-field="notes" class="csv-val-input form-control" value="${escapeHtml(row.notes || '')}" placeholder="Notes..." style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:11px;background:var(--secura-white);color:var(--secura-black)" /></td>`;
        
        // Badge validité
        html += `<td style="padding:10px;text-align:center"><span id="csv-val-badge-${i}" class="badge ${row.isValid ? 'bg-success' : 'bg-danger'}" style="font-size:10px;padding:4px 6px">${row.isValid ? '✓' : '✗'}</span></td>`;
        html += `</tr>`;
        
        // Message d'erreur sous chaque invité
        html += `<tr id="csv-val-msg-row-${i}" style="display:${row.isValid ? 'none' : 'table-row'};border-bottom:1px solid var(--border-color);background:rgba(239, 68, 68, 0.03)">`;
        html += `<td colspan="10" style="padding:6px 10px;font-size:11px;color:var(--secura-error);font-style:italic">`;
        html += `<i class="fas fa-exclamation-triangle"></i> ${row.errors && row.errors.length ? row.errors.join(' • ') : 'Erreur de validation'}`;
        html += `</td></tr>`;
    });
    
    html += `</tbody></table></div></div>`;
    
    Swal.fire({
        title: '<i class="fas fa-check-double"></i> Validation & Édition complète',
        html,
        width: '98%',
        showCancelButton: true,
        confirmButtonText: 'Continuer vers confirmation',
        cancelButtonText: 'Annuler',
        didOpen: () => {
            const inputs = Swal.getPopup().querySelectorAll('.csv-val-input');
            
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    const idx = parseInt(inp.dataset.idx);
                    const field = inp.dataset.field;
                    
                    // Mise à jour de la valeur
                    if (field === 'seats') {
                        csvValidatedData[idx][field] = parseInt(inp.value) || 1;
                    } else {
                        csvValidatedData[idx][field] = inp.value;
                    }
                    
                    // Re-valider la ligne
                    const row = csvValidatedData[idx];
                    const errors = [];
                    
                    // Validation des champs obligatoires
                    if (!row.firstName && !row.lastName) {
                        errors.push('Prénom ou nom requis');
                    }
                    if (!row.firstName) errors.push('Prénom requis');
                    if (!row.lastName) errors.push('Nom requis');
                    if (!row.email) errors.push('Email requis');
                    if (row.email && !validateEmail(row.email)) errors.push('Email invalide');
                    if (row.phone && !validatePhone(row.phone)) errors.push('Téléphone invalide');
                    if (!row.seats || parseInt(row.seats) < 1) errors.push('Places invalides');
                    
                    row.isValid = errors.length === 0;
                    row.errors = errors;
                    
                    // Mettre à jour le visuel de la ligne
                    const tr = document.getElementById(`csv-val-row-${idx}`);
                    const badge = document.getElementById(`csv-val-badge-${idx}`);
                    const msgRow = document.getElementById(`csv-val-msg-row-${idx}`);
                    const msgEl = msgRow ? msgRow.querySelector('td:last-child') : null;
                    
                    if (tr) {
                        tr.style.background = row.isValid ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)';
                    }
                    
                    if (badge) {
                        badge.className = `badge ${row.isValid ? 'bg-success' : 'bg-danger'}`;
                        badge.textContent = row.isValid ? '✓' : '✗';
                    }
                    
                    if (msgRow && msgEl) {
                        if (!row.isValid) {
                            msgRow.style.display = 'table-row';
                            msgEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errors.join(' • ')}`;
                        } else {
                            msgRow.style.display = 'none';
                        }
                    }
                });
            });
        },
        preConfirm: () => {
            // Récupérer les modifications finales
            const inputs = Swal.getPopup().querySelectorAll('.csv-val-input');
            inputs.forEach(inp => {
                const idx = parseInt(inp.dataset.idx);
                const field = inp.dataset.field;
                if (field === 'seats') {
                    csvValidatedData[idx][field] = parseInt(inp.value) || 1;
                } else {
                    csvValidatedData[idx][field] = inp.value;
                }
            });
            return true;
        }
    }).then((res) => {
        if (res.isConfirmed) {
            // Aller à l'étape 3 (confirmation)
            prepareConfirmationStep();
            goToCSVStep(3);
        }
    });
}




function prepareConfirmationStep() {
    console.log('🔄 Préparation de l\'étape 3: confirmation');
    
    csvCurrentStep = 3;
    updateCSVProgressIndicator(3);
    
    const validRows = csvValidatedData.filter(r => r.isValid);
    const invalidRows = csvValidatedData.filter(r => !r.isValid);
    
    if (validRows.length === 0) {
        showNotification('warning', 'Aucune ligne valide à importer');
        return;
    }
    
    // Afficher un Swal de confirmation
    let html = `<div style="text-align:left;max-height:70vh;overflow:auto;">`;
    
    // Résumé
    html += `<div style="display:flex;gap:20px;margin-bottom:15px;padding:12px;background:var(--hover-bg);border-radius:8px;">`;
    html += `<div><div style="font-size:12px;opacity:0.7">À importer</div><div style="font-weight:600;color:var(--success);font-size:18px">${validRows.length}</div></div>`;
    if (invalidRows.length > 0) {
        html += `<div><div style="font-size:12px;opacity:0.7">Invalides</div><div style="font-weight:600;color:var(--danger);font-size:18px">${invalidRows.length}</div></div>`;
    }
    html += `<div><div style="font-size:12px;opacity:0.7">Événement</div><div style="font-weight:600;font-size:14px">${escapeHtml(csvEventSelected.name)}</div></div>`;
    html += `</div>`;
    
    // Tableau de confirmation
    html += `<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">`;
    html += `<table style="width:100%;border-collapse:collapse">`;
    html += `<thead><tr style="background:var(--hover-bg);position:sticky;top:0;">`;
    html += `<th style="padding:10px;text-align:left;border-bottom:2px solid #e5e7eb;font-weight:600;font-size:13px;width:30%">Nom</th>`;
    html += `<th style="padding:10px;text-align:left;border-bottom:2px solid #e5e7eb;font-weight:600;font-size:13px;width:35%">Email</th>`;
    html += `<th style="padding:10px;text-align:left;border-bottom:2px solid #e5e7eb;font-weight:600;font-size:13px;width:15%">Type</th>`;
    html += `<th style="padding:10px;text-align:center;border-bottom:2px solid #e5e7eb;font-weight:600;font-size:13px;width:20%">Statut</th>`;
    html += `</tr></thead><tbody>`;
    
    validRows.forEach(row => {
        const statusColor = row.status === 'confirmed' ? 'success' : row.status === 'cancelled' ? 'danger' : 'warning';
        html += `<tr style="border-bottom:1px solid #f0f0f0">`;
        html += `<td style="padding:10px">${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</td>`;
        html += `<td style="padding:10px">${escapeHtml(row.email)}</td>`;
        html += `<td style="padding:10px"><span style="font-size:12px;text-transform:uppercase;font-weight:600;color:var(--text-color)">${escapeHtml(row.type)}</span></td>`;
        html += `<td style="padding:10px;text-align:center"><span class="badge bg-${statusColor}" style="font-size:11px">${escapeHtml(row.status)}</span></td>`;
        html += `</tr>`;
    });
    
    html += `</tbody></table></div>`;
    
    // Avertissement si y a des invalides
    if (invalidRows.length > 0) {
        html += `<div style="margin-top:12px;padding:10px;background:#fef08a;border:1px solid #fcd34d;border-radius:6px;font-size:12px">`;
        html += `<strong>⚠️ ${invalidRows.length} ligne(s) invalide(s)</strong> ne seront pas importées (données manquantes ou invalides).`;
        html += `</div>`;
    }
    
    html += `</div>`;

    
    Swal.fire({
        title: 'Confirmation de l\'import',
        html,
        width: '90%',
        showCancelButton: true,
        confirmButtonText: 'Confirmer & Importer',
        cancelButtonText: 'Retour à l\'édition',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        didOpen: () => {
            // Aucun calcul, juste affichage
        }
    }).then((res) => {
        if (res.isConfirmed) {
            // Lancer l'import
            performFinalCSVImport();
        } else {
            // Retour à l'édition (Swal précédent)
            renderValidationStepWithSwal();
        }
    });
}

async function performFinalCSVImport() {
    console.log('📥 Exécution de l\'import final');
    
    // Mettre à jour l'indicateur d'étape
    csvCurrentStep = 4;
    updateCSVProgressIndicator(4);
    
    const validRows = csvValidatedData.filter(r => r.isValid);
    
    if (validRows.length === 0) {
        showNotification('error', 'Aucun invité valide à importer');
        return;
    }

    
    
    // Afficher la progression avec SweetAlert
    const progressSwal = Swal.fire({
        title: '⏳ Importation en cours',
        html: `
            <div style="text-align: center; padding: 20px 0;">
                <!-- Conteneur principal avec padding pour éviter l'espace blanc -->
                <div style="width: 100%; margin-bottom: 30px;">
                    <!-- Barre de progression premium avec effet -->
                    <div style="position: relative; width: 100%; height: 48px; background: linear-gradient(135deg, rgba(217, 119, 6, 0.1), rgba(217, 119, 6, 0.05)); border-radius: 24px; overflow: hidden; border: 2px solid rgba(217, 119, 6, 0.2); box-shadow: inset 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Arrière-plan animé -->
                        <div style="position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); animation: shimmer 2s infinite;"></div>
                        
                        <!-- Barre de remplissage -->
                        <div id="csvImportProgressBar" style="position: absolute; left: 0; top: 0; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 50%, #047857 100%); width: 0%; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 24px; box-shadow: 0 0 20px rgba(16, 185, 129, 0.5), inset 0 1px 0 rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center;">
                            <span id="csvProgressText" style="color: white; font-weight: 700; font-size: 16px; text-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; z-index: 2;">0%</span>
                        </div>
                        
                        <!-- Bordure brillante supérieure -->
                        <div style="position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);"></div>
                    </div>
                    
                    <!-- Pourcentage en grand en bas à droite -->
                    <div style="text-align: right; margin-top: 10px;">
                        <span id="csvPercentageDisplay" style="font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">0%</span>
                    </div>
                </div>
                
                <!-- Zone d'informations avec beaucoup moins d'espace -->
                <div style="margin-top: 20px;">
                    <!-- Nom du guest en cours -->
                    <div id="csvImportStatus" style="font-size: 16px; font-weight: 600; color: var(--text-color); margin-bottom: 12px; min-height: 24px; display: flex; align-items: center; justify-content: center;">
                        <span style="display: inline-flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 1.5s infinite;"></span>
                            Préparation...
                        </span>
                    </div>
                    
                    <!-- Compteur invités importés -->
                    <div style="display: flex; justify-content: center; gap: 30px; align-items: center; padding: 15px; background: rgba(16, 185, 129, 0.05); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.1);">
                        <div style="text-align: center;">
                            <div id="csvImportCount" style="font-size: 24px; font-weight: 800; color: #10b981;">0</div>
                            <div style="font-size: 12px; color: var(--text-color); opacity: 0.7; margin-top: 4px;">Importés</div>
                        </div>
                        <div style="width: 1px; height: 40px; background: rgba(16, 185, 129, 0.2);"></div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #6b7280;">${validRows.length}</div>
                            <div style="font-size: 12px; color: var(--text-color); opacity: 0.7; margin-top: 4px;">Total</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            </style>
        `,
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: async () => {
            await performActualImport(validRows);
        }
    });
}

async function performActualImport(validRows) {
    let importedCount = 0;
    let failedCount = 0;
    
    try {
        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            const progress = Math.round(((i + 1) / validRows.length) * 100);
            
            // Mettre à jour la barre de progression
            const progressBar = document.getElementById('csvImportProgressBar');
            if (progressBar) {
                progressBar.style.width = progress + '%';
                progressBar.innerHTML = `<span style="color:white;font-weight:600;font-size:14px">${progress}%</span>`;
            }
            
            // Mettre à jour le statut
            const statusEl = document.getElementById('csvImportStatus');
            if (statusEl) {
                statusEl.innerHTML = `${row.firstName} ${row.lastName}...`;
            }
            
            // Mettre à jour le compteur
            const countEl = document.getElementById('csvImportCount');
            if (countEl) {
                countEl.innerHTML = `${i + 1}/<strong>${validRows.length}</strong>`;
            }
            
            try {
                const guestData = {
                    eventId: csvEventSelected.id,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    email: row.email,
                    phone: row.phone || undefined,
                    company: row.company || undefined,
                    gender: row.gender || undefined,
                    seats: Math.max(1, row.seats || 1),
                    type: row.type,
                    status: row.status,
                    companions: row.companions || 0,
                    notes: row.notes || undefined,
                    confirmed: row.status === 'confirmed',
                    hasQR: false,
                    createdAt: new Date().toISOString()
                };
                
                const guest = await storage.createGuest(guestData);
                if (guest) {
                    importedCount++;
                    
                    // Générer le QR code si ce n'est pas annulé
                    if (row.status !== 'cancelled') {
                        try {

                            const qrData = { t: 'INV', e: csvEventSelected.id, g: guest.id };
                         
                            storage.saveQRCode({
                                    guestId: guest.id,
                                    eventId: csvEventSelected.id,
                                    data: JSON.stringify(qrData),
                                    config: { size: 300, foreground: '#000000', background: '#FFFFFF' }
                                });

                        } catch (qrError) {
                            console.warn(`⚠️ Erreur QR pour ${guest.id}:`, qrError);
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Erreur création invité ligne ${i}:`, err);
                failedCount++;
            }
            
            // Petit délai pour ne pas surcharger
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Fermer le Swal de progression
        await Swal.close();
        
        // Afficher le résumé final
        await Swal.fire({
            icon: importedCount > 0 ? 'success' : 'error',
            title: importedCount > 0 ? 'Import terminé !' : 'Erreur lors de l\'import',
            html: `
                <div style="text-align:center;padding:20px">
                    <div style="font-size:48px;margin-bottom:15px">
                        ${importedCount > 0 ? '✅' : '❌'}
                    </div>
                    <h3 style="margin-bottom:5px;color:var(--text-color)">Résumé de l'import</h3>
                    <div style="margin:15px 0;font-size:14px">
                        <div style="padding:8px;border-radius:6px;margin-bottom:8px">
                            <strong style="color:var(--success);font-size:16px">${importedCount}</strong> invité(s) importé(s) avec succès
                        </div>
                        ${failedCount > 0 ? `
                        <div style="padding:8px;background:#ffefda;border-radius:6px">
                            <strong style="color:#b45309;font-size:16px">${failedCount}</strong> invité(s) en erreur
                        </div>
                        ` : ''}
                    </div>
                    <div style="margin-top:15px;font-size:12px;color:#6b7280">
                        <i class="fas fa-info-circle"></i> Les invités ont été ajoutés à l'événement <strong>${escapeHtml(csvEventSelected.name)}</strong>
                    </div>
                </div>
            `,
            confirmButtonText: 'Fermer',
            confirmButtonColor: '#D97706'
        });
        
            await loadGuests();

        
        // Fermer le modal d'import
        closeCSVImportModal();
        
    } catch (error) {
        console.error('❌ Erreur globale import:', error);
        await Swal.close();
        await Swal.fire({
            icon: 'error',
            title: 'Erreur fatale',
            text: 'L\'import a été interrompu. Veuillez réessayer.',
            confirmButtonColor: '#D97706'
        });
    }
}

// ============================================================
// 🔄 MISE À JOUR GRANULAIRE EN TEMPS RÉEL
// ============================================================
function setupGranularGuestListeners() {
    console.log('🔄 Configuration des écouteurs granulaires...');
    
    // Écouteur pour la synchronisation des données
    storage.on('data:synced', (event) => {
        console.log('🔄 Synchronisation des données détectée');
        
        if (!currentEventId) {
           // updateEventCards();
            return;
        }
        
        updateCurrentGuests();
    });
    
    // Écouteurs spécifiques
    storage.on('guest:created', (event) => {
        console.log('🆕 Invité créé:', event.detail.id);
        if (event.detail.eventId === currentEventId) {
            handleGuestCreated(event.detail);
        }
    });
    
    storage.on('guest:updated', (event) => {
        console.log('🔄 Invité mis à jour:', event.detail.new.id);
        if (event.detail.new.eventId === currentEventId) {
            handleGuestUpdated(event.detail.new);
        }
    });
    
    storage.on('guest:deleted', (event) => {
        console.log('🗑️ Invité supprimé:', event.detail.id);
        if (event.detail.eventId === currentEventId) {
            handleGuestDeleted(event.detail.id);
        }
    });
    
    storage.on('scan:created', (event) => {
        console.log('📷 Scan créé pour invité:', event.detail.guestId);
        if (event.detail.eventId === currentEventId) {
            handleGuestScanned(event.detail.guestId);
        }
    });
    
    console.log('✅ Écouteurs granulaires configurés');
}


function updateCurrentGuests() {
    // Mettre à jour la liste des invités
    const latestGuests = storage.getGuestsByEventId(currentEventId) || [];
    
    // Vérifier s'il y a des changements
    if (JSON.stringify(currentGuests) !== JSON.stringify(latestGuests)) {
        console.log(`🔄 Mise à jour des invités: ${currentGuests.length} → ${latestGuests.length}`);
        
        currentGuests = latestGuests;
        applyFilters();
        renderCurrentView();
        updateStats();
    }
}

function handleGuestCreated(guest) {
    // Ajouter l'invité à la liste actuelle
    if (!currentGuests.some(g => g.id === guest.id)) {
        currentGuests.unshift(guest);
        
        // Vérifier si l'invité correspond aux filtres actuels
        const passesFilter = passesCurrentFilters(guest);
        const passesSearch = passesCurrentSearch(guest);
        
        if (passesFilter && passesSearch) {
            // Ajouter à la vue actuelle
            if (currentView === 'table') {
                insertGuestRow(guest);
            } else {
                applyFilters();
                renderCurrentView();
            }
            
            // Mettre à jour les statistiques
            updateStats();
            
            // Animation de notification
            showGuestNotification(guest, 'created');
        }
    }
}

function handleGuestUpdated(guest) {
    // Mettre à jour l'invité dans la liste
    const index = currentGuests.findIndex(g => g.id === guest.id);
    if (index !== -1) {
        currentGuests[index] = guest;
        
        // Vérifier si l'invité correspond aux filtres actuels
        const passesFilter = passesCurrentFilters(guest);
        const passesSearch = passesCurrentSearch(guest);
        const wasInFiltered = filteredGuests.some(g => g.id === guest.id);
        
        if (passesFilter && passesSearch) {
            if (wasInFiltered) {
                // Mettre à jour dans la vue actuelle
                if (currentView === 'table') {
                    updateGuestRow(guest);
                } else {
                    applyFilters();
                    renderCurrentView();
                }
            } else {
                // Ajouter à la vue filtrée
                applyFilters();
                renderCurrentView();
            }
        } else if (wasInFiltered) {
            // Retirer de la vue filtrée
            applyFilters();
            renderCurrentView();
        }
        
        // Mettre à jour les statistiques
        updateStats();
        
        // Animation de notification
        showGuestNotification(guest, 'updated');
    }
}

function handleGuestDeleted(guestId) {
    // Retirer l'invité de la liste
    currentGuests = currentGuests.filter(g => g.id !== guestId);
    
    // Retirer de la vue actuelle
    if (currentView === 'table') {
        removeGuestRow(guestId);
    } else {
        applyFilters();
        renderCurrentView();
    }
    
    // Mettre à jour les statistiques
    updateStats();
    
    // Animation de notification
    showGuestNotification({ id: guestId }, 'deleted');
}

function handleGuestScanned(guestId) {
    const guest = storage.getGuestById(guestId);
    if (guest && guest.eventId === currentEventId) {
        handleGuestUpdated(guest);
    }
}

function passesCurrentFilters(guest) {
    if (currentFilter === 'all') return true;
    
    switch(currentFilter) {
        case 'confirmed':
            return guest.status === 'confirmed' || guest.confirmed === true;
        case 'pending':
            return guest.status === 'pending' || (!guest.confirmed && !guest.scanned);
        case 'checkedin':
            return guest.scanned === true;
        case 'cancelled':
            return guest.status === 'cancelled';
        case 'vip':
            return guest.type === 'vip' || guest.isVIP === true;
        default:
            return true;
    }
}

function passesCurrentSearch(guest) {
    if (!currentSearch) return true;
    
    const searchTerm = currentSearch.toLowerCase();
    return (
        (guest.firstName || '').toLowerCase().includes(searchTerm) ||
        (guest.lastName || '').toLowerCase().includes(searchTerm) ||
        (guest.email || '').toLowerCase().includes(searchTerm) ||
        (guest.phone || '').toLowerCase().includes(searchTerm) ||
        (guest.company || '').toLowerCase().includes(searchTerm) ||
        (guest.notes || '').toLowerCase().includes(searchTerm)
    );
}

function insertGuestRow(guest) {
    const tbody = document.getElementById('guestsTableBody');
    if (!tbody) return;
    
    // Vérifier si la ligne existe déjà
    const existingRow = guestRowCache.get(guest.id);
    if (existingRow && document.body.contains(existingRow)) {
        updateGuestRow(guest);
        return;
    }
    
    // Créer la nouvelle ligne
    const row = createTableRow(guest, 0);
    guestRowCache.set(guest.id, row);
    
    // Ajouter au début du tableau
    tbody.insertBefore(row, tbody.firstChild);
    
    // Animation d'entrée
    row.style.opacity = '0';
    row.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        row.style.transition = 'all 0.4s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
    }, 10);
    
    // Mettre à jour le compteur
    updateGuestCounters();
}

function updateGuestRow(guest) {
    const row = guestRowCache.get(guest.id);
    if (!row || !document.body.contains(row)) return;
    
    // Sauvegarder l'ancien HTML
    const oldHTML = row.innerHTML;
    
    // Re-créer la ligne
    const tempRow = createTableRow(guest, 0);
    const newHTML = tempRow.innerHTML;
    
    if (oldHTML !== newHTML) {
        // Animation de mise à jour
        row.style.transition = 'all 0.3s ease';
        row.style.boxShadow = '0 0 0 2px var(--primary)';
        row.style.backgroundColor = 'rgba(217, 119, 6, 0.1)';
        
        setTimeout(() => {
            row.innerHTML = newHTML;
            row.style.boxShadow = 'none';
            row.style.backgroundColor = '';
            
            // Réinitialiser les écouteurs
            const checkbox = row.querySelector('.guest-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', handleGuestSelect);
            }
        }, 300);
    }
}

function removeGuestRow(guestId) {
    const row = guestRowCache.get(guestId);
    if (!row || !document.body.contains(row)) return;
    
    // Animation de suppression
    row.style.transition = 'all 0.3s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(20px)';
    row.style.height = row.offsetHeight + 'px';
    
    setTimeout(() => {
        row.style.height = '0';
        row.style.margin = '0';
        row.style.padding = '0';
        row.style.border = 'none';
        
        setTimeout(() => {
            row.remove();
            guestRowCache.delete(guestId);
            
            // Mettre à jour le compteur
            updateGuestCounters();
        }, 300);
    }, 300);
}

function showGuestNotification(guest, action) {
    let message = '';
    let icon = '';
    let color = '';
    
    switch(action) {
        case 'created':
            message = `Nouvel invité: ${guest.firstName} ${guest.lastName}`;
            icon = 'fas fa-user-plus';
            color = 'var(--success)';
            break;
        case 'updated':
            message = `Invité mis à jour: ${guest.firstName} ${guest.lastName}`;
            icon = 'fas fa-user-edit';
            color = 'var(--primary)';
            break;
        case 'deleted':
            message = 'Invité supprimé';
            icon = 'fas fa-user-minus';
            color = 'var(--danger)';
            break;
    }
    
    // Créer une notification toast
    const toast = document.createElement('div');
    toast.className = 'guest-toast';
    toast.innerHTML = `
        <div class="toast-icon" style="background: ${color}">
            <i class="${icon}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
            <div class="toast-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;
    
    // Ajouter au document
    document.body.appendChild(toast);
    
    // Animation d'entrée
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 10);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// ============================================================
// 🎫 FONCTIONS POUR LES QR CODES
// ============================================================
async function viewGuestQR(id) {
    try {
        // Récupérer l'invité
        const guest = storage.getGuestById(id);
        if (!guest) {
            showNotification('error', 'Invité introuvable');
            return;
        }
        
        // Récupérer l'événement
        const event = currentEvent || storage.getEventById(guest.eventId);
        if (!event) {
            showNotification('error', 'Événement introuvable');
            return;
        }
        


    // Table assignée - Récupérée via storage
    let table = null;

    if (guest.tableId) {
        table = storage.getTableById(guest.tableId);
        
        
    } else {
        const tables = availableTablesList || [];
        
        for (const tab of tables) {
            if (tab.assignedGuests && tab.assignedGuests.some(ag => ag.guestId === guest.id)) {
                table = tab;
                break;
            }
        }
    }

        
        
        // Récupérer le QR Code
        const qrRecord = storage.getQRCodeByGuestId(id);
        if (!qrRecord) {
            showNotification('warning', 'QR Code non généré pour cet invité');
            return;
        }

        const qrData = typeof qrRecord.data === 'string' ? JSON.parse(qrRecord.data) : qrRecord.data;

        // Génération du QR Code en haute qualité
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute; left:-9999px; top:-9999px;';
        document.body.appendChild(tempDiv);

        new QRCode(tempDiv, {
            text: JSON.stringify(qrData),
            width: 512,
            height: 512,
            colorDark: '#000000',
            colorLight: '#FFFFFF',
            correctLevel: QRCode.CorrectLevel.H
        });

        await new Promise(r => setTimeout(r, 150));
        const canvas = tempDiv.querySelector('canvas');
        const qrImageUrl = canvas.toDataURL('image/png');
        document.body.removeChild(tempDiv);

        // Informations de l'invité
        const accentColor = '#D97706';
        const initials = getInitials(`${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email);
        const name = `${guest.firstName && guest.firstName !== '-' ? guest.firstName : ''} ${guest.lastName && guest.lastName !== '-' ? guest.lastName : ''}`.trim() || guest.email;
        
        const eventDate = new Date(event.date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const scannedStatus = guest.scanned 
            ? `<span style="background: rgba(16, 185, 129, 0.2); color: var(--success); padding: 6px 14px; border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;"><i class="fas fa-check-circle"></i> Présent </span>
                <small style="display: block; margin-top: 5px; opacity: 0.8;">
                    Le ${new Date(guest.scannedAt).toLocaleString('fr-FR')}
                </small>`
            : `<span style="background: rgba(245, 158, 11, 0.2); color: var(--warning); padding: 6px 14px; border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fas fa-hourglass-half"></i> En attente
                </span>`;

        await Swal.fire({
            title: 'QR Code Invité',
            html: `
                <div style="text-align: center; padding: 20px 0; max-width: 600px; margin: 0 auto;">
                    <!-- En-tête avec avatar et informations -->
                    <div style="background: linear-gradient(135deg, rgba(217, 119, 6, 0.1), rgba(217, 119, 6, 0.05)); padding: 25px; border-radius: 16px; margin-bottom: 25px; border: 1px solid rgba(217, 119, 6, 0.2);">
                        <div style="display: flex; align-items: center; gap: 20px; text-align: left;">
                            <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.8rem; flex-shrink: 0; box-shadow: 0 8px 20px rgba(217, 119, 6, 0.3);">
                                ${initials}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-color); margin-bottom: 5px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                    ${escapeHtml(name)}
                                </div>
                                <div style="font-size: 0.95rem; color: var(--text-color); opacity: 0.8; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-envelope" style="color: var(--primary);"></i> ${escapeHtml(guest.email || 'Non renseigné')}
                                </div>
                                ${table ? `
                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                        <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">
                                            <i class="fas fa-chair"></i> Table #${escapeHtml(String(table.tableNumber))}
                                        </div>
                                        ${table.tableName ? `
                                            <div style="color: var(--text-color); opacity: 0.7; font-style: italic;">
                                                "${escapeHtml(table.tableName)}"
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : `
                                    <div style="background: rgba(239, 68, 68, 0.2); color: var(--danger); padding: 6px 16px; border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-exclamation-circle"></i> Non assigné
                                    </div>
                                `}
                            </div>
                        </div>
                        <div style="margin-top: 15px; text-align: right;">
                            ${scannedStatus}
                        </div>
                    </div>
                    
                    <!-- QR Code -->
                    <div style="margin: 30px auto; position: relative;">
                        <div style="width: 280px; height: 280px; margin: 0 auto; background: linear-gradient(135deg, var(--hover-bg), var(--card-bg)); border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 3px solid var(--border-color); position: relative; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
                            <div style="position: absolute; inset: 0; background: conic-gradient(from 0deg, transparent 0%, rgba(217, 119, 6, 0.1) 50%, transparent 100%); animation: rotate 10s linear infinite;"></div>
                            <img src="${qrImageUrl}" alt="QR Code" style="width: 240px; height: 240px; z-index: 2; position: relative; border-radius: 10px; border: 2px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">
                            <div style="position: absolute; bottom: 10px; right: 10px; background: var(--primary); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; z-index: 3; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                        </div>
                        <div style="position: absolute; bottom: -30px; left: 0; right: 0; text-align: center; font-size: 0.8rem; color: var(--text-color); opacity: 0.6; font-weight: 500;">
                            <i class="fas fa-lock"></i> SECURA • Invité • ${new Date().getFullYear()}
                        </div>
                    </div>
                    
                    <!-- Statistiques -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 40px 0 30px;">
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, rgba(217, 119, 6, 0.1), transparent); border-radius: 12px; border: 1px solid rgba(217, 119, 6, 0.2);">
                            <div style="font-size: 1.8rem; font-weight: 800; color: var(--primary); margin-bottom: 5px;">${qrRecord.scanCount || 0}</div>
                            <div style="font-size: 0.85rem; color: var(--text-color); opacity: 0.7; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <i class="bi bi-qr-code"></i> Scans
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), transparent); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="font-size: 1.8rem; font-weight: 800; color: var(--info); margin-bottom: 5px;">${guest.seats || 1}</div>
                            <div style="font-size: 0.85rem; color: var(--text-color); opacity: 0.7; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <i class="fas fa-chair"></i> Places
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, ${guest.scanned  ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}, transparent); border-radius: 12px; border: 1px solid ${guest.scanned ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'};">
                            <div style="font-size: 1.8rem; font-weight: 800; color: ${guest.scanned ? 'var(--success)' : 'var(--warning)'}; margin-bottom: 5px;">
                                ${guest.scanned ? '✓' : '?'}
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-color); opacity: 0.7; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <i class="fas ${guest.scanned ? 'fa-check-circle' : 'fa-question-circle'}"></i> Statut
                            </div>
                        </div>
                    </div>
                    
                    <!-- Informations de l'événement -->
                    <div style="background: var(--hover-bg); padding: 20px; border-radius: 2px; margin-top: 10px; border-left: 4px solid var(--primary);">
                        <div style="font-weight: 600; color: var(--text-color); margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-calendar-alt" style="color: var(--primary);"></i>
                            Informations de l'événement
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; text-align:start;">
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-color); opacity: 0.7;">Événement</div>
                                <div style="font-weight: 600; color: var(--text-color); font-size: 1.1rem;">${escapeHtml(event.name)}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-color); opacity: 0.7;">Date</div>
                                <div style="font-weight: 600; color: var(--text-color); font-size: 1.1rem;">${eventDate}</div>
                            </div>
                            ${event.location ? `
                                <div>
                                    <div style="font-size: 0.85rem; color: var(--text-color); opacity: 0.7;">Lieu</div>
                                    <div style="font-weight: 600; color: var(--text-color); font-size: 1.1rem;">${escapeHtml(event.location)}</div>
                                </div>
                            ` : ''}
                            ${event.time ? `
                                <div>
                                    <div style="font-size: 0.85rem; color: var(--text-color); opacity: 0.7;">Heure</div>
                                    <div style="font-weight: 600; color: var(--text-color); font-size: 1.1rem;">${escapeHtml(event.time)}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Boutons d'action -->
                    <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="downloadQRImage('${qrImageUrl}', 'SECURA_${name.replace(/\s+/g, '_')}_QR')" 
                                style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">
                            <i class="fas fa-download"></i>
                            Télécharger
                        </button>
                        <button onclick="copyQRToClipboard('${qrImageUrl}', '${name}')" 
                                style="background: var(--hover-bg); color: var(--text-color); border: 1px solid var(--border-color); padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease;">
                            <i class="fas fa-copy"></i>
                            Copier
                        </button>
                        <button onclick="shareGuestQRModal('${id}')" 
                                style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), transparent); color: var(--info); border: 1px solid rgba(59, 130, 246, 0.3); padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease;">
                            <i class="fas fa-share"></i>
                            Partager
                        </button>
                    </div>
                </div>
                <style>
                    @keyframes rotate {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                </style>
            `,
            width: '700px',
            showConfirmButton: false,
            showCloseButton: true,
            background: 'var(--card-bg)',
            didOpen: () => {
                const modal = document.querySelector('.swal2-popup');
                if (modal) {
                    modal.style.opacity = '0';
                    modal.style.transform = 'scale(0.9) translateY(20px)';
                    setTimeout(() => {
                        modal.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                        modal.style.opacity = '1';
                        modal.style.transform = 'scale(1) translateY(0)';
                    }, 10);
                }
            }
        });
        
    } catch (error) {
        console.error('Erreur affichage QR:', error);
        showNotification('error', 'Erreur affichage QR Code');
    }
}

function downloadQRImage(imageUrl, filename) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('success', 'QR Code téléchargé');
}

async function copyQRToClipboard(imageUrl, guestName) {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        const item = new ClipboardItem({
            [blob.type]: blob
        });
        
        await navigator.clipboard.write([item]);
        showNotification('success', `QR Code de ${guestName} copié`);
    } catch (error) {
        console.error('Erreur copie:', error);
        showNotification('error', 'Erreur lors de la copie');
    }
}

async function shareGuestQRModal(guestId) {
    console.log(`📤 Partage QR Code pour l'invité: ${guestId}`);
    
    const guest = storage.getGuestById(guestId);
    if (!guest) {
        showNotification('error', 'Invité introuvable');
        return;
    }
    
    const qrRecord = storage.getQRCodeByGuestId(guestId);
    if (!qrRecord) {
        showNotification('warning', 'QR Code non généré');
        return;
    }

    const qrData = typeof qrRecord.data === 'string' ? JSON.parse(qrRecord.data) : qrRecord.data;
    
    // Génération du QR Code en haute qualité
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute; left:-9999px; top:-9999px;';
    document.body.appendChild(tempDiv);

    new QRCode(tempDiv, {
        text: JSON.stringify(qrData),
        width: 400,
        height: 400,
        colorDark: '#000000',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H
    });

    await new Promise(r => setTimeout(r, 150));
    const canvas = tempDiv.querySelector('canvas');
    const qrImageUrl = canvas.toDataURL('image/png');
    document.body.removeChild(tempDiv);
    
    const firstName = guest.firstName && guest.firstName !== '-' ? guest.firstName : '';
    const lastName = guest.lastName && guest.lastName !== '-' ? guest.lastName : '';
    const fullName = `${firstName} ${lastName}`.trim() || guest.email;
    const shareUrl = `${window.location.origin}/verify.html?guest=${guestId}`;
    
    await Swal.fire({
        title: '📤 Partager l\'invitation',
        html: `
            <div style="padding: 20px 0; max-width: 600px; margin: 0 auto;">
                <!-- Aperçu QR Code -->
                <div style="background: linear-gradient(135deg, var(--hover-bg), var(--card-bg)); padding: 25px; border-radius: 16px; margin-bottom: 25px; border: 2px solid var(--border-color);">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <div style="font-weight: 600; color: var(--text-color); margin-bottom: 10px;">Aperçu du QR Code</div>
                        <img src="${qrImageUrl}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 12px; border: 2px solid var(--border-color); box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
                    </div>
                    <div style="text-align: center; font-size: 0.9rem; color: var(--text-color); opacity: 0.7;">
                        QR Code pour <strong>${escapeHtml(fullName)}</strong>
                    </div>
                </div>

                <!-- Sélection du type de partage -->
                <div style="margin-bottom: 20px;">
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 15px; text-align: left;">
                        Sélectionnez le type de partage :
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px;">
                        <button onclick="showSharePreview('${guestId}', 'email')" 
                                style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), transparent); border: 2px solid rgba(59, 130, 246, 0.3); color: var(--info); padding: 16px 12px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s ease; font-size: 0.9rem;">
                            <i class="fas fa-envelope fa-lg"></i>
                            <span>Email</span>
                        </button>
                        <button onclick="showSharePreview('${guestId}', 'sms')" 
                                style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), transparent); border: 2px solid rgba(16, 185, 129, 0.3); color: var(--success); padding: 16px 12px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s ease; font-size: 0.9rem;">
                            <i class="fas fa-sms fa-lg"></i>
                            <span>SMS</span>
                        </button>
                        <button onclick="showSharePreview('${guestId}', 'whatsapp')" 
                                style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), transparent); border: 2px solid rgba(34, 197, 94, 0.3); color: #22c55e; padding: 16px 12px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s ease; font-size: 0.9rem;">
                            <i class="fab fa-whatsapp fa-lg"></i>
                            <span>WhatsApp</span>
                        </button>
                        <button onclick="showSharePreview('${guestId}', 'link')" 
                                style="background: linear-gradient(135deg, rgba(217, 119, 6, 0.1), transparent); border: 2px solid rgba(217, 119, 6, 0.3); color: var(--primary); padding: 16px 12px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s ease; font-size: 0.9rem;">
                            <i class="fas fa-link fa-lg"></i>
                            <span>Lien</span>
                        </button>
                    </div>
                </div>

                <!-- Zone de prévisualisation (sera remplie dynamiquement) -->
                <div id="sharePreview" style="display: none; background: var(--hover-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); margin-top: 20px;">
                    <!-- Contenu dynamique -->
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '600px',
        background: 'var(--card-bg)',
        didOpen: () => {
            const modal = document.querySelector('.swal2-popup');
            if (modal) {
                modal.style.opacity = '0';
                modal.style.transform = 'scale(0.9) translateY(20px)';
                setTimeout(() => {
                    modal.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    modal.style.opacity = '1';
                    modal.style.transform = 'scale(1) translateY(0)';
                }, 10);
            }
        }
    });
}

function shareByEmail(guestId) {
    const guest = storage.getGuestById(guestId);
    if (!guest || !guest.email) {
        showNotification('warning', 'Email non disponible');
        return;
    }
    
    const event = currentEvent || storage.getEventById(guest.eventId);
    const subject = `Invitation - ${event.name}`;
    const eventDate = new Date(event.date).toLocaleDateString('fr-FR');
    
    const body = `
    Bonjour ${guest.firstName},

    Vous êtes invité(e) à :

    ${event.name}

    📅 Date : ${eventDate}
    ${event.time ? `🕐 Heure : ${event.time}` : ''}
    ${event.location ? `📍 Lieu : ${event.location}` : ''}

    Votre lien d'invitation : ${window.location.origin}/verify.html?guest=${guestId}

    À très bientôt !
    L'équipe SECURA
        `.trim();
        
        window.location.href = `mailto:${guest.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        showNotification('info', 'Ouverture du client email...');
    }

    function shareBySMS(guestId) {
        const guest = storage.getGuestById(guestId);
        if (!guest || !guest.phone) {
            showNotification('warning', 'Numéro de téléphone non disponible');
            return;
        }
        
        const event = currentEvent || storage.getEventById(guest.eventId);
        const eventDate = new Date(event.date).toLocaleDateString('fr-FR');
        
        const message = `
    Bonjour ${guest.firstName},

    Vous êtes invité(e) à ${event.name}.

    📅 ${eventDate}
    ${event.time ? `🕐 ${event.time}` : ''}
    ${event.location ? `📍 ${event.location}` : ''}

    Lien : ${window.location.origin}/verify.html?guest=${guestId}

    SECURA
        `.trim();
    
    window.location.href = `sms:${guest.phone}?body=${encodeURIComponent(message)}`;
    showNotification('info', 'Ouverture du client SMS...');
}

function copyShareLink(url, guestName) {
    navigator.clipboard.writeText(url).then(() => {
        showNotification('success', `Lien de ${guestName} copié dans le presse-papier`);
    }).catch(() => {
        showNotification('error', 'Impossible de copier le lien');
    });
}

function shareGuestQR(guestId) {
    return shareGuestQRModal(guestId);
}

// ============================================================
// 📤 FONCTIONS DE PRÉVISUALISATION DE PARTAGE
// ============================================================
async function showSharePreview(guestId, type) {
    const guest = storage.getGuestById(guestId);
    const event = currentEvent || storage.getEventById(guest.eventId);
    
    const firstName = guest.firstName && guest.firstName !== '-' ? guest.firstName : '';
    const lastName = guest.lastName && guest.lastName !== '-' ? guest.lastName : '';
    const fullName = `${firstName} ${lastName}`.trim() || guest.email;
    const eventDate = new Date(event.date).toLocaleDateString('fr-FR');
    const shareUrl = `${window.location.origin}/verify.html?guest=${guestId}`;
    
    const previewDiv = document.getElementById('sharePreview');
    let previewContent = '';
    
    switch(type) {
        case 'email':
            previewContent = `
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 8px; font-size: 0.9rem;">Objet :</div>
                    <div style="background: var(--card-bg); padding: 12px; border-radius: 8px; color: var(--text-color); font-size: 0.9rem; border-left: 3px solid var(--info);">
                        Invitation - ${escapeHtml(event.name)}
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 8px; font-size: 0.9rem;">Message :</div>
                    <div style="background: var(--card-bg); padding: 12px; border-radius: 8px; color: var(--text-color); font-size: 0.85rem; border-left: 3px solid var(--info); min-height: 120px; white-space: pre-wrap; word-wrap: break-word;" id="emailPreview">
                    Bonjour ${escapeHtml(firstName || 'invité')},

                    Vous êtes invité(e) à :

                    ${escapeHtml(event.name)}

                    📅 Date : ${eventDate}
                    ${event.time ? `🕐 Heure : ${escapeHtml(event.time)}` : ''}
                    ${event.location ? `📍 Lieu : ${escapeHtml(event.location)}` : ''}

                    Votre lien d'invitation : ${shareUrl}

                    À très bientôt !
                    L'équipe SECURA
                    </div>
                </div>
                <button onclick="editShareMessage('${guestId}', 'email')" style="background: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 10px;">
                    <i class="fas fa-edit"></i> Éditer le message
                </button>
                <button onclick="sendShareByEmail('${guestId}')" style="background: var(--success); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 10px; margin-left: 10px;">
                    <i class="fas fa-paper-plane"></i> Envoyer
                </button>
            `;
            break;
            
        case 'sms':
            previewContent = `
                <div>
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 8px; font-size: 0.9rem;">Message SMS :</div>
                    <div style="background: var(--card-bg); padding: 12px; border-radius: 8px; color: var(--text-color); font-size: 0.85rem; border-left: 3px solid var(--success); min-height: 80px; white-space: pre-wrap; word-wrap: break-word;" id="smsPreview">
                        Bonjour ${escapeHtml(firstName || 'invité')},

                        Vous êtes invité(e) à ${escapeHtml(event.name)}.

                        📅 ${eventDate}
                        ${event.time ? `🕐 ${escapeHtml(event.time)}` : ''}
                        ${event.location ? `📍 ${escapeHtml(event.location)}` : ''}

                        Lien : ${shareUrl}

                        SECURA
                    </div>
                </div>
                <button onclick="editShareMessage('${guestId}', 'sms')" style="background: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 10px;">
                    <i class="fas fa-edit"></i> Éditer le message
                </button>
                <button onclick="sendShareBySMS('${guestId}')" style="background: var(--success); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 10px; margin-left: 10px;">
                    <i class="fas fa-paper-plane"></i> Envoyer
                </button>
            `;
            break;
            
        case 'whatsapp':
            previewContent = `
                <div>
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 8px; font-size: 0.9rem;">Message WhatsApp :</div>
                    <div style="background: var(--card-bg); padding: 12px; border-radius: 8px; color: var(--text-color); font-size: 0.85rem; border-left: 3px solid #22c55e; min-height: 80px; white-space: pre-wrap; word-wrap: break-word;" id="whatsappPreview">
                        Bonjour ${escapeHtml(firstName || 'invité')} 👋

                        Vous êtes invité(e) à :

                        📍 ${escapeHtml(event.name)}

                        📅 Date : ${eventDate}
                        ${event.time ? `🕐 Heure : ${escapeHtml(event.time)}` : ''}
                        ${event.location ? `📌 Lieu : ${escapeHtml(event.location)}` : ''}

                        🔗 Lien : ${shareUrl}

                        À très bientôt ! 🎉
                        L'équipe SECURA
                    </div>
                </div>
                <button onclick="editShareMessage('${guestId}', 'whatsapp')" style="background: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 10px;">
                    <i class="fas fa-edit"></i> Éditer le message
                </button>
                <button onclick="sendShareByWhatsApp('${guestId}')" style="background: #22c55e; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 10px; margin-left: 10px;">
                    <i class="fab fa-whatsapp"></i> Envoyer
                </button>
            `;
            break;
            
        case 'link':
            previewContent = `
                <div>
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 8px; font-size: 0.9rem;">Lien d'invitation :</div>
                    <div style="background: var(--card-bg); padding: 12px; border-radius: 8px; color: var(--text-color); font-size: 0.9rem; border-left: 3px solid var(--primary); word-break: break-all;">
                        ${shareUrl}
                    </div>
                </div>
                <button onclick="copyShareLink('${shareUrl}', '${fullName}')" style="background: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 10px;">
                    <i class="fas fa-copy"></i> Copier le lien
                </button>
            `;
            break;
    }
    
    previewDiv.innerHTML = previewContent;
    previewDiv.style.display = 'block';
    
    // Animation
    previewDiv.style.opacity = '0';
    previewDiv.style.transform = 'translateY(-10px)';
    setTimeout(() => {
        previewDiv.style.transition = 'all 0.3s ease';
        previewDiv.style.opacity = '1';
        previewDiv.style.transform = 'translateY(0)';
    }, 10);
}

async function editShareMessage(guestId, type) {
    const guest = storage.getGuestById(guestId);
    const event = currentEvent || storage.getEventById(guest.eventId);
    
    const firstName = guest.firstName && guest.firstName !== '-' ? guest.firstName : '';
    const eventDate = new Date(event.date).toLocaleDateString('fr-FR');
    const shareUrl = `${window.location.origin}/verify.html?guest=${guestId}`;
    
    let currentMessage = '';
    let messageId = '';
    
    if (type === 'email') {
        currentMessage = `Bonjour ${firstName || 'invité'},\n\nVous êtes invité(e) à :\n\n${event.name}\n\n📅 Date : ${eventDate}\n${event.time ? `🕐 Heure : ${event.time}\n` : ''}${event.location ? `📍 Lieu : ${event.location}\n` : ''}\nVotre lien d'invitation : ${shareUrl}\n\nÀ très bientôt !\nL'équipe SECURA`;
        messageId = 'emailPreview';
    } else if (type === 'sms') {
        currentMessage = `Bonjour ${firstName || 'invité'},\n\nVous êtes invité(e) à ${event.name}.\n\n📅 ${eventDate}\n${event.time ? `🕐 ${event.time}\n` : ''}${event.location ? `📍 ${event.location}\n` : ''}\nLien : ${shareUrl}\n\nSECURA`;
        messageId = 'smsPreview';
    } else if (type === 'whatsapp') {
        currentMessage = `Bonjour ${firstName || 'invité'} 👋\n\nVous êtes invité(e) à :\n\n📍 ${event.name}\n\n📅 Date : ${eventDate}\n${event.time ? `🕐 Heure : ${event.time}\n` : ''}${event.location ? `📌 Lieu : ${event.location}\n` : ''}\n🔗 Lien : ${shareUrl}\n\nÀ très bientôt ! 🎉\nL'équipe SECURA`;
        messageId = 'whatsappPreview';
    }
    
    const result = await Swal.fire({
        title: `Éditer le message ${type.toUpperCase()}`,
        input: 'textarea',
        inputValue: currentMessage,
        inputAttributes: {
            style: 'width: 100%; height: 250px; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg); color: var(--text-color); font-size: 0.9rem; font-family: monospace;'
        },
        confirmButtonText: 'Mettre à jour',
        cancelButtonText: 'Annuler',
        background: 'var(--card-bg)',
        preConfirm: (value) => {
            return value;
        }
    });
    
    if (result.isConfirmed && result.value) {
        // Mettre à jour le message dans la prévisualisation
        const previewElement = document.getElementById(messageId);
        if (previewElement) {
            previewElement.textContent = result.value;
        }
        
        // Stocker le message modifié pour l'envoi
        window.customShareMessages = window.customShareMessages || {};
        window.customShareMessages[`${guestId}_${type}`] = result.value;
        
        showNotification('success', 'Message mis à jour');
    }
}

async function sendShareByEmail(guestId) {
    const guest = storage.getGuestById(guestId);
    if (!guest || !guest.email) {
        showNotification('warning', 'Email non disponible');
        return;
    }
    
    const event = currentEvent || storage.getEventById(guest.eventId);
    const customMessages = window.customShareMessages || {};
    const messageKey = `${guestId}_email`;
    
    let body = customMessages[messageKey] || 
        `Bonjour ${guest.firstName || 'invité'},\n\nVous êtes invité(e) à :\n\n${event.name}\n\nÀ très bientôt !\nL'équipe SECURA`;
    
    const subject = `Invitation - ${event.name}`;
    
    window.location.href = `mailto:${guest.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showNotification('info', 'Ouverture du client email...');
}

async function sendShareBySMS(guestId) {
    const guest = storage.getGuestById(guestId);
    if (!guest || !guest.phone) {
        showNotification('warning', 'Numéro de téléphone non disponible');
        return;
    }
    
    const customMessages = window.customShareMessages || {};
    const messageKey = `${guestId}_sms`;
    
    let message = customMessages[messageKey] || 
        `Bonjour ${guest.firstName || 'invité'},\n\nVous êtes invité(e).\n\nSECURA`;
    
    window.location.href = `sms:${guest.phone}?body=${encodeURIComponent(message)}`;
    showNotification('info', 'Ouverture du client SMS...');
}

async function sendShareByWhatsApp(guestId) {
    const guest = storage.getGuestById(guestId);
    if (!guest || !guest.phone) {
        showNotification('warning', 'Numéro de téléphone non disponible');
        return;
    }
    
    const customMessages = window.customShareMessages || {};
    const messageKey = `${guestId}_whatsapp`;
    const event = currentEvent || storage.getEventById(guest.eventId);
    const eventDate = new Date(event.date).toLocaleDateString('fr-FR');
    const shareUrl = `${window.location.origin}/verify.html?guest=${guestId}`;
    
    let message = customMessages[messageKey] || 
        `Bonjour ${guest.firstName || 'invité'} 👋\n\nVous êtes invité(e) à ${event.name}.\n\n📅 ${eventDate}\n🔗 ${shareUrl}\n\nÀ très bientôt ! 🎉`;
    
    // Format du lien WhatsApp
    const phoneFormatted = guest.phone.replace(/\D/g, '');
    window.location.href = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(message)}`;
    showNotification('info', 'Ouverture de WhatsApp...');
}

// ============================================================
// ✅ FONCTION POUR VALIDER LA PRÉSENCE
// ============================================================

async function markGuestPresent(guestId) {
    const guest = storage.getGuestById(guestId);
    if (!guest) {
        showNotification('error', 'Invité introuvable');
        return;
    }
    
    const firstName = guest.firstName && guest.firstName !== '-' ? guest.firstName : '';
    const lastName = guest.lastName && guest.lastName !== '-' ? guest.lastName : '';
    const fullName = `${firstName} ${lastName}`.trim() || guest.email;
    
    // Confirmation
    const confirmed = await Swal.fire({
        title: 'Valider la présence',
        html: `Voulez-vous marquer <strong>${escapeHtml(fullName)}</strong> comme présent(e) à l'événement ?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui, confirmer',
        cancelButtonText: 'Annuler',
        background: 'var(--card-bg)',
        confirmButtonColor: 'var(--success)'
    });
    
    if (confirmed.isConfirmed) {
        try {
            const result = storage.checkInGuest(guestId, {
                source: 'manual',
                notes: `Présence validée manuellement le ${new Date().toLocaleString('fr-FR')}`,
                changedBy: currentUser?.email || 'system'
            });
            
            if (result && result.guest) {
                if (storage.isOnline) {
                    try {
                        const qrData = {
                            t: 'INV',
                            e: currentEventId,
                            g: guestId,
                            source: 'manual_validation'
                        };
                        
                        await storage.scanQRCode(qrData);
                        await storage.updateGuest(guest.id, guest);
                    } catch (apiError) {
                        console.warn('⚠️ Erreur sync API:', apiError);
                    }
                }
            
                await loadGuests();
                
                const message = result.alreadyScanned 
                    ? `${fullName} confirmé(e) à nouveau (Check-in #${result.guest.scanCount})`
                    : `${fullName} marqué(e) comme présent(e)`;
                
                showNotification('success', message);
            } else {
                showNotification('error', 'Impossible de mettre à jour le statut');
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            showNotification('error', 'Erreur lors de la mise à jour');
        }
    }
}

// ============================================================
// 🎫 GÉNÉRATION DE BILLETS
// ============================================================
async function generateTicketForGuest(guestId) {
    console.log(`🎫 Génération de billet pour l'invité: ${guestId}`);
    
    window.location.href = `ticket-generator.html?event=${currentEventId}&guest=${guestId}`;
}

// ============================================================
// 👁️ VUE DÉTAILLÉE DES INVITÉS
// ============================================================
// ============================================================
// 👁️ VUE DÉTAILLÉE DES INVITÉS (DESIGN PREMIUM)
// ============================================================
function openGuestDetails(guestId) {
    console.log(`👁️ Affichage des détails de l'invité: ${guestId}`);
    
    const guest = storage.getGuestById(guestId);
    if (!guest) {
        showNotification('error', 'Invité introuvable');
        return;
    }
    
    // Table assignée
    let tableInfo = 'Non assigné';
    let tableNumber = '—';
    let tableColor = '#9b9a9a';
    
    if (guest.tableId) {
        const table = storage.getTableById(guest.tableId);
        if (table) {
            tableNumber = `#${table.tableNumber}`;
            tableInfo = table.tableName || `Table ${tableNumber}`;
            tableColor = '#10B981';
        }
    }
    
    // QR Code
    const qrRecord = storage.getQRCodeByGuestId(guestId);
    const hasQR = !!qrRecord;
    
    // Dates formatées
    const createdDate = guest.createdAt ? new Date(guest.createdAt).toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    }) : '—';
    
    const scannedDate = guest.scannedAt ? new Date(guest.scannedAt).toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    }) : '—';
    
    // Statut
    let statusText = 'En attente';
    let statusBgColor = 'rgba(245, 158, 11, 0.2)';
    let statusBorderColor = '#F59E0B';
    let statusIcon = 'fa-hourglass-half';
    let statusColor = '#F59E0B';
    
    if (guest.scanned) {
        statusText = 'Présent';
        statusBgColor = 'rgba(16, 185, 129, 0.2)';
        statusBorderColor = '#10B981';
        statusIcon = 'fa-check-circle';
        statusColor = '#10B981';
    } else if (guest.confirmed || guest.status === 'confirmed') {
        statusText = 'Confirmé';
        statusBgColor = 'rgba(59, 130, 246, 0.2)';
        statusBorderColor = '#3B82F6';
        statusIcon = 'fa-check-circle';
        statusColor = '#3B82F6';
    } else if (guest.status === 'cancelled') {
        statusText = 'Annulé';
        statusBgColor = 'rgba(239, 68, 68, 0.2)';
        statusBorderColor = '#EF4444';
        statusIcon = 'fa-ban';
        statusColor = '#EF4444';
    }
    
    // Couleur avatar
    const avatarBg = stringToColor(`${guest.firstName} ${guest.lastName}`);
    const initials = getInitials(`${guest.firstName} ${guest.lastName}`);
    const fullName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email;
    
    Swal.fire({
        title: '',
        html: `
            <style>
                .guest-details-premium {
                    max-width: 900px;
                    margin: 0 auto;
                    text-align: left;
                    padding: 0;
                }
                
                /* En-tête avec avatar et infos principales */
                .details-header-premium {
                    background: linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(217, 119, 6, 0.05));
                    border: 1px solid rgba(217, 119, 6, 0.2);
                    border-radius: 16px;
                    padding: 30px;
                    margin-bottom: 25px;
                    position: relative;
                    overflow: hidden;
                }
                
                .details-header-premium::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(217, 119, 6, 0.1), transparent);
                    border-radius: 50%;
                    transform: translate(50%, -50%);
                }
                
                .header-content {
                    display: flex;
                    gap: 25px;
                    align-items: flex-start;
                    position: relative;
                    z-index: 1;
                }
                
                .header-avatar {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, ${avatarBg}, ${avatarBg}aa);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.2rem;
                    font-weight: 800;
                    color: white;
                    flex-shrink: 0;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                }
                
                .header-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .header-info {
                    flex: 1;
                }
                
                .header-name {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: var(--text-color);
                    margin-bottom: 8px;
                    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                .header-email {
                    font-size: 0.95rem;
                    color: var(--text-color);
                    opacity: 0.8;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .header-badges {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                
                .badge-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border-radius: 24px;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border: 2px solid;
                    background: ${statusBgColor};
                    color: ${statusColor};
                    border-color: ${statusBorderColor};
                }
                
                .badge-vip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border-radius: 24px;
                    font-weight: 600;
                    font-size: 0.85rem;
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1));
                    color: #F59E0B;
                    border: 2px solid rgba(245, 158, 11, 0.3);
                }
                
                .badge-code {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border-radius: 24px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1));
                    color: #3B82F6;
                    border: 2px solid rgba(59, 130, 246, 0.3);
                    font-family: 'Courier New', monospace;
                    letter-spacing: 1px;
                }
                
                /* Section 2 colonnes pour les informations */
                .details-sections {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 25px;
                }
                
                @media (max-width: 768px) {
                    .details-sections {
                        grid-template-columns: 1fr;
                    }
                }
                
                .details-card {
                    background: var(--hover-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.3s ease;
                }
                
                .details-card:hover {
                    border-color: rgba(217, 119, 6, 0.3);
                    box-shadow: 0 8px 20px rgba(217, 119, 6, 0.1);
                }
                
                .card-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    opacity: 0.6;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--primary);
                }
                
                .card-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                
                .info-row:last-child {
                    border-bottom: none;
                }
                
                .info-label {
                    font-size: 0.8rem;
                    opacity: 0.6;
                    text-transform: uppercase;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .info-value {
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: var(--text-color);
                }
                
                /* Carte spéciale pour la table */
                .table-card-special {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
                    border: 2px solid rgba(16, 185, 129, 0.3);
                }
                
                .table-number-display {
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: #10B981;
                    text-align: center;
                    margin-bottom: 10px;
                    font-family: 'Courier New', monospace;
                }
                
                .table-name-display {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-color);
                    text-align: center;
                }
                
                /* Carte pour le code d'accès */
                .access-code-card {
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05));
                    border: 2px solid rgba(59, 130, 246, 0.3);
                    text-align: center;
                    grid-column: 1 / -1;
                    padding: 30px;
                }
                
                .access-code-label {
                    font-size: 0.8rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    opacity: 0.6;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: #3B82F6;
                }
                
                .access-code-display {
                    font-size: 2.5rem;
                    font-weight: 800;
                    font-family: 'Courier New', monospace;
                    color: #3B82F6;
                    letter-spacing: 8px;
                    word-break: break-all;
                }
                
                /* Notes */
                .notes-section {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
                    border: 1px solid rgba(245, 158, 11, 0.2);
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 25px;
                }
                
                .notes-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #F59E0B;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .notes-content {
                    font-weight: 500;
                    line-height: 1.6;
                    color: var(--text-color);
                }
                
                /* Stats footer */
                .stats-footer {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    padding-top: 25px;
                    border-top: 1px solid var(--border-color);
                }
                
                .stat-item {
                    text-align: center;
                    padding: 15px;
                    background: var(--hover-bg);
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                }
                
                .stat-number {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--primary);
                    margin-bottom: 5px;
                }
                
                .stat-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    opacity: 0.6;
                }
            </style>
            
            <div class="guest-details-premium">
                <!-- En-tête principal -->
                <div class="details-header-premium">
                    <div class="header-content">
                        <div class="header-avatar" style="background: linear-gradient(135deg, ${avatarBg}, ${avatarBg}aa);">
                            ${getGuestAvatarImage(guest) 
                                ? `<img src="${getGuestAvatarImage(guest)}" alt="Avatar" onerror="this.style.display='none'">`
                                : initials
                            }
                        </div>
                        <div class="header-info">
                            <div class="header-name">${escapeHtml(fullName)}</div>
                            <div class="header-email">
                                <i class="fas fa-envelope"></i>
                                ${escapeHtml(guest.email || 'Pas d\'email')}
                            </div>
                            <div class="header-badges">
                                <span class="badge-status">
                                    <i class="fas ${statusIcon}"></i> ${statusText}
                                </span>
                                ${guest.type === 'vip' || guest.isVIP ? `<span class="badge-vip"><i class="fas fa-crown"></i> VIP</span>` : ''}
                                <span class="badge-code">
                                    <i class="fas fa-key"></i> ${guest.accessCode || '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Informations détaillées -->
                <div class="details-sections">
                    <!-- Colonne 1: Infos personnelles -->
                    <div class="details-card">
                        <div class="card-title">
                            <i class="fas fa-user"></i> Informations Personnelles
                        </div>
                        <div class="card-content">
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-phone"></i> Téléphone</span>
                                <span class="info-value">${escapeHtml(guest.phone || '—')}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-building"></i> Entreprise</span>
                                <span class="info-value">${escapeHtml(guest.company || '—')}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-venus-mars"></i> Genre</span>
                                <span class="info-value">${formatGender(guest.gender || guest.sexe)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Colonne 2: Infos événement -->
                    <div class="details-card">
                        <div class="card-title">
                            <i class="fas fa-calendar-alt"></i> Événement
                        </div>
                        <div class="card-content">
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-user-check"></i> Inscription</span>
                                <span class="info-value">${createdDate}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-qrcode"></i> Scans</span>
                                <span class="info-value">${guest.scanCount || 0}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-check"></i> Dernier scan</span>
                                <span class="info-value">${guest.scanned ? scannedDate : '—'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Table assignée (grande) -->
                    <div class="details-card table-card-special">
                        <div class="card-title">
                            <i class="fas fa-chair"></i> Table Assignée
                        </div>
                        <div style="text-align: center;">
                            <div class="table-number-display" style="color: ${tableColor};">${tableNumber}</div>
                            <div class="table-name-display">${escapeHtml(tableInfo)}</div>
                        </div>
                    </div>
                    
                    <!-- Accompagnants et places -->
                    <div class="details-card">
                        <div class="card-title">
                            <i class="fas fa-people"></i> Réservation
                        </div>
                        <div class="card-content">
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-chair"></i> Places</span>
                                <span class="info-value">${guest.seats || 1} place(s)</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-people-arrows"></i> Accompagnants</span>
                                <span class="info-value">${guest.companions || 0} personne(s)</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label"><i class="fas fa-qrcode"></i> QR Code</span>
                                <span class="info-value" style="color: ${hasQR ? '#10B981' : '#F59E0B'};">
                                    ${hasQR ? '<i class="fas fa-check"></i> Disponible' : 'À générer'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Code d'accès (grand) -->
                    <div class="details-card access-code-card">
                        <div class="access-code-label">
                            <i class="fas fa-lock"></i> Code d'Accès Mobile
                        </div>
                        <div class="access-code-display">${guest.accessCode || '—'}</div>
                    </div>
                </div>
                
                <!-- Notes si disponibles -->
                ${guest.notes ? `
                <div class="notes-section">
                    <div class="notes-title">
                        <i class="fas fa-sticky-note"></i> Notes
                    </div>
                    <div class="notes-content">${escapeHtml(guest.notes)}</div>
                </div>
                ` : ''}
                
                <!-- Statistiques footer -->
                <div class="stats-footer">
                    <div class="stat-item">
                        <div class="stat-number">${guest.scanCount || 0}</div>
                        <div class="stat-label">Scans</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${guest.seats || 1}</div>
                        <div class="stat-label">Places</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${guest.companions || 0}</div>
                        <div class="stat-label">Accompagnants</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${guest.scanned ? '✓' : '—'}</div>
                        <div class="stat-label">Présent</div>
                    </div>
                </div>
            </div>
        `,
        width: '1000px',
        showConfirmButton: true,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-qrcode"></i> QR Code',
        denyButtonText: '<i class="fas fa-edit"></i> Modifier',
        cancelButtonText: 'Fermer',
        confirmButtonColor: '#10B981',
        denyButtonColor: '#3B82F6',
        cancelButtonColor: '#6B7280',
        allowOutsideClick: true,
        willOpen: () => {
            const popup = Swal.getPopup();
            if (popup) {
                popup.style.borderRadius = '20px';
                popup.style.boxShadow = '0 25px 70px rgba(0, 0, 0, 0.3)';
                popup.style.overflow = 'auto';
            }
        },
        didOpen: () => {
            const popup = Swal.getPopup();
            popup.style.backgroundColor = 'var(--card-bg)';
            popup.style.color = 'var(--text-color)';
        },
        preConfirm: () => {
            viewGuestQR(guestId);
            return false;
        },
        preDeny: () => {
            openGuestModal(guestId);
            return false;
        }
    });
}



// Fonction helper pour générer les sièges
function generateSeatsHTML(totalSeats) {
    return Array.from({length: totalSeats}, (_, i) => 
        `<span class="seat-badge" style="
            display: inline-block;
            width: 24px;
            height: 24px;
            background: rgba(217, 119, 6, 0.2);
            color: var(--text-color)};
            border-radius: 6px;
            text-align: center;
            line-height: 24px;
            font-size: 11px;
            margin-right: 6px;
            font-weight: 600;
            border: 1px solid var(--primary-dark)';
        "><i class="fas fa-chair" style="
            font-size: 0.8rem;
            margin: 0 2px;
            opacity: 0.8;
            color: var(--text-color)'};
        "></i></span>`
    ).join('');
}

// ============================================================
// 🗑️ SUPPRESSION D'INVITÉ
// ============================================================
async function deleteGuest(guestId) {
    
    const guest = storage.getGuestById(guestId);
    if (!guest) return;
    
    const firstName = guest.firstName || '';
    const lastName = guest.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Supprimer cet invité ?',
        html: `
            <div class="text-center">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <h5 class="mb-2">${escapeHtml(fullName)}</h5>
                <p class="text-muted">${escapeHtml(guest.email || '')}</p>
                <p class="mt-3">Cette action est irréversible.</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        reverseButtons: true
    });
    
    if (!result.isConfirmed) return;
    
    try {
        await storage.deleteGuest(guestId);
        
        // Recharger les invités
        await loadGuests();
        
        // Effet sonore
        SECURA_AUDIO.play('delete');
        
        showNotification('success', 'Invité supprimé avec succès');
        
    } catch (error) {
        console.error('❌ Erreur suppression invité:', error);
        showNotification('error', 'Impossible de supprimer l\'invité');
    }
}

// ============================================================
// 📤 EXPORT DES DONNÉES
// ============================================================
async function exportGuestsToCSV() {
    if (!currentEventId) {
        showNotification('warning', 'Aucun événement sélectionné');
        return;
    }
    
    console.log(`📤 Export CSV pour l'événement: ${currentEventId}`);
    
    try {
        const csvContent = storage.exportToCSV(currentEventId);
        const filename = `${currentEvent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invites_${new Date().toISOString().split('T')[0]}.csv`;
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showNotification('success', 'Export CSV réussi');
        
    } catch (error) {
        console.error('❌ Erreur export CSV:', error);
        showNotification('error', 'Erreur lors de l\'export CSV');
    }
}

async function exportGuestsToJSON() {
    if (!currentEventId) {
        showNotification('warning', 'Aucun événement sélectionné');
        return;
    }
    
    console.log(`📤 Export JSON pour l'événement: ${currentEventId}`);
    
    try {
        const guests = storage.getGuestsByEventId(currentEventId);
        const event = storage.getEventById(currentEventId);
        
        const data = {
            event: {
                id: event.id,
                name: event.name,
                date: event.date,
                location: event.location
            },
            guests: guests,
            exportedAt: new Date().toISOString(),
            count: guests.length
        };
        
        const jsonContent = JSON.stringify(data, null, 2);
        const filename = `${currentEvent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invites_${new Date().toISOString().split('T')[0]}.json`;
        
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showNotification('success', 'Export JSON réussi');
        
    } catch (error) {
        console.error('❌ Erreur export JSON:', error);
        showNotification('error', 'Erreur lors de l\'export JSON');
    }
}

// ============================================================
// � EXPORT INVITATIONS AVEC LIENS D'ACCÈS
// ============================================================
async function exportInvitationsCSV() {
    if (!currentEventId || !currentEvent) {
        showNotification('warning', 'Aucun événement sélectionné');
        return;
    }
    
    console.log(`📧 Export Invitations pour l'événement: ${currentEventId}`);
    
    try {
        const guests = storage.getGuestsByEventId(currentEventId);
        
        if (guests.length === 0) {
            showNotification('warning', 'Aucun invité à exporter');
            return;
        }
        
        // Construction du CSV - Commencer par le BOM UTF-8 pour l'encodage correct
        let csvLines = [];
        
        // En-tête du CSV
        const headers = [
            'Prénom',
            'Nom',
            'Email',
            'Téléphone',
            'Entreprise',
            'Genre',
            'Code d\'accès',
            'Nombre de places',
            'Table assignée',
            'Numéro de table',
            'Statut',
            'Événement',
            'Lien d\'invitation',
            'Date inscription'
        ];
        
        csvLines.push(headers.join(','));
        
        // Traitement de chaque invité
        guests.forEach(guest => {
            // Récupérer les infos de la table si assignée
            let tableName = '';
            let tableNumber = '';
            if (guest.tableId) {
                const table = storage.getTableById(guest.tableId);
                if (table) {
                    tableName = table.tableName || table.name || '';
                    tableNumber = table.tableNumber || table.number || '';
                }
            }
            
            // Récupérer le genre formaté
            const genderDisplay = formatGender(guest.gender || guest.sexe);
            
            // Construire le lien d'invitation (utilise la base URL de production)
            const invitationLink = `https://secura-qr.vercel.app/access?eventId=${encodeURIComponent(currentEventId)}&guestId=${encodeURIComponent(guest.id)}`;
            
            // Formater le statut
            let statusText = 'En attente';
            if (guest.scanned) {
                statusText = 'Présent';
            } else if (guest.status === 'confirmed' || guest.confirmed) {
                statusText = 'Confirmé';
            } else if (guest.status === 'cancelled') {
                statusText = 'Annulé';
            } else if (guest.status === 'checkedin') {
                statusText = 'Enregistré';
            }
            
            // Construire la ligne CSV - Utiliser une simple virgule comme séparateur
            // Mettre entre guillemets les cellules qui contiennent des virgules
            // Pour le code d'accès, utiliser l'apostrophe pour forcer le format texte dans Excel
            const row = [
                `"${(guest.firstName || '').replace(/"/g, '""')}"`,
                `"${(guest.lastName || '').replace(/"/g, '""')}"`,
                `"${(guest.email || '').replace(/"/g, '""')}"`,
                `"${(guest.phone || '').replace(/"/g, '""')}"`,
                `"${(guest.company || '').replace(/"/g, '""')}"`,
                `"${genderDisplay}"`,
                `"${guest.accessCode || '—'}"`,
                `"${guest.seats || '1'}"`,
                `"${tableName.replace(/"/g, '""')}"`,
                `"${tableNumber.replace(/"/g, '""')}"`,
                `"${statusText}"`,
                `"${currentEvent.name.replace(/"/g, '""')}"`,
                `"${invitationLink}"`,
                `"${new Date(guest.createdAt).toLocaleDateString('fr-FR')}"`
            ];
            
            csvLines.push(row.join(','));
        });
        
        // Joindre toutes les lignes avec \r\n
        let csvContent = csvLines.join('\r\n');
        
        // Créer un Blob avec le BOM UTF-8 pour l'encodage correct
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Créer et télécharger le fichier
        const filename = `${currentEvent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invitations_${new Date().toISOString().split('T')[0]}.csv`;
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('success', `Invitations exportées (${guests.length} invité${guests.length > 1 ? 's' : ''})`);
        
        console.log(`✅ Export ${guests.length} invitation(s) réussi`);
        
    } catch (error) {
        console.error('❌ Erreur export invitations:', error);
        showNotification('error', 'Erreur lors de l\'export des invitations');
    }
}

// ============================================================
// �🔧 FONCTIONS UTILITAIRES
// ============================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stringToColor(str) {
    if (!str) return '#6B7280';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function getTypeLabel(type) {
    const labels = {
        'marriage': 'Mariage',
        'anniversaire': 'Anniversaire',
        'conference': 'Conférence',
        'corporate': 'Corporate',
        'concert': 'Concert',
        'gala': 'Gala',
        'football': 'Football',
        'autre': 'Autre'
    };
    return labels[type] || 'Autre';
}

        function getTypeColor(type) {
            const colors = {
                marriage: '#EC4899',
                anniversaire: '#F59E0B',
                conference: '#3B82F6',
                corporate: '#6366F1',
                concert: '#8B5CF6',
                gala: '#D97706',
                football: '#10B981',
                autre: '#6B7280'
            };
            return colors[type] || colors.autre;
        }

  
function getGuestTypeLabel(type) {
    const labels = {
        'vip': 'VIP',
        'standard': 'Standard',
        'speaker': 'Conférencier',
        'organizer': 'Organisateur',
        'press': 'Presse',
        'staff': 'Staff'
    };
    return labels[type] || 'Standard';
}

function getGuestStatusLabel(status) {
    const labels = {
        'pending': 'En attente',
        'confirmed': 'Confirmé',
        'checkedin': 'Présent',
        'cancelled': 'Annulé',
        'waiting': 'Liste d\'attente'
    };
    return labels[status] || 'Inconnu';
}

function getEventImage(type) {
            const defaultImages = {
                marriage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
                anniversaire: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=80',
                conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
                corporate: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
                concert: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
                gala: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
                football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
                autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e?w=800&q=80'
            };
            
            return defaultImages[type] || defaultImages.autre;
        }



function showLoader(view = 'all') {
    const loaders = {
        grid: 'gridLoader',
        table: 'tableLoader',
        stats: 'statsLoader'
    };
    
    if (view === 'all') {
        Object.values(loaders).forEach(loaderId => {
            const loader = document.getElementById(loaderId);
            if (loader) loader.style.display = 'block';
        });
    } else if (loaders[view]) {
        const loader = document.getElementById(loaders[view]);
        if (loader) loader.style.display = 'block';
    }
}

function hideLoader(view = 'all') {
    const loaders = {
        grid: 'gridLoader',
        table: 'tableLoader',
        stats: 'statsLoader'
    };
    
    if (view === 'all') {
        Object.values(loaders).forEach(loaderId => {
            const loader = document.getElementById(loaderId);
            if (loader) loader.style.display = 'none';
        });
    } else if (loaders[view]) {
        const loader = document.getElementById(loaders[view]);
        if (loader) loader.style.display = 'none';
    }
}

function showNotification(type, message) {
    const toastConfig = {
        'success': { bg: '#10B981', icon: 'fas fa-check-circle' },
        'error': { bg: '#EF4444', icon: 'fas fa-exclamation-triangle' },
        'warning': { bg: '#F59E0B', icon: 'fas fa-exclamation-circle' },
        'info': { bg: '#3B82F6', icon: 'fas fa-info-circle' }
    };
    
    const config = toastConfig[type] || toastConfig.info;
    
    // Utiliser Toastify si disponible
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: config.bg,
            stopOnFocus: true
        }).showToast();
    } else {
        // Fallback avec SweetAlert
        Swal.fire({
            icon: type,
            title: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    }
}

function updateSelectionInfo() {
    const selectionInfo = document.getElementById('selectionInfo');
    const selectedCount = document.getElementById('selectedCount');
    const bulkActions = document.getElementById('bulkActions');
    
    if (selectionInfo && selectedCount) {
        if (selectedGuests.length > 0) {
            selectionInfo.style.display = 'block';
            selectedCount.textContent = selectedGuests.length;
            
            if (bulkActions) {
                bulkActions.style.display = 'flex';
            }
        } else {
            selectionInfo.style.display = 'none';
            if (bulkActions) {
                bulkActions.style.display = 'none';
            }
        }
    }
}

// ============================================================
// 🌐 EXPOSITION GLOBALE DES FONCTIONS
// ============================================================
window.selectEvent = selectEvent;
window.openGuestModal = openGuestModal;
window.closeGuestModal = closeGuestModal;
window.viewGuestQR = viewGuestQR;
window.shareGuestQR = shareGuestQR;
window.deleteGuest = deleteGuest;
window.handleGuestSelect = handleGuestSelect;
window.changePage = changePage;
window.openCSVImportModal = openCSVImportModal;
window.closeCSVImportModal = closeCSVImportModal;
window.exportGuestsToCSV = exportGuestsToCSV;
window.exportGuestsToJSON = exportGuestsToJSON;
window.exportInvitationsCSV = exportInvitationsCSV;
window.clearSelection = clearSelection;
window.bulkConfirmGuests = bulkConfirmGuests;
window.bulkDeleteGuests = bulkDeleteGuests;
window.manageGuestTable = manageGuestTable;
window.bulkAssignToTable = bulkAssignToTable;
window.selectTableForGuest = selectTableForGuest;
window.deselectTable = deselectTable;
window.generateTicketForGuest = generateTicketForGuest;
window.openGuestDetails = openGuestDetails;

// ============================================================
// 🎨 STYLES INLINE POUR LES COMPOSANTS
// ============================================================
/*
(function addInlineStyles() {
    const styles = `
        /* Styles pour les notifications toast 
        .guest-toast {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 15px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 9999;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 350px;
        }
        
        .toast-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
        }
        
        .toast-content {
            flex: 1;
        }
        
        .toast-message {
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 5px;
        }
        
        .toast-time {
            font-size: 0.85rem;
            color: var(--text-color);
            opacity: 0.7;
        }
        
        /* Styles pour les avatars 
        .guest-avatar-small {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .guest-avatar-large {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 1.8rem;
        }
        
        .guest-avatar-xs {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 0.8rem;
        }
        
        .guest-avatar-table {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 0.85rem;
        }
        
        /* Styles pour les sélections de table 
        .table-select-item {
            padding: 15px;
            margin-bottom: 10px;
            background: var(--hover-bg);
            border: 2px solid var(--border-color);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .table-select-item:hover {
            border-color: var(--primary);
            background: rgba(217, 119, 6, 0.1);
        }
        
        .table-select-item.selected {
            border-color: var(--primary);
            background: rgba(217, 119, 6, 0.2);
        }
        
        .table-select-item.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            border-color: var(--danger);
        }
        
        .table-select-item.disabled:hover {
            border-color: var(--danger);
            background: var(--hover-bg);
        }
        
        .table-select-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .table-select-title {
            font-weight: 600;
            color: var(--text-color);
        }
        
        .table-select-badge {
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.85rem;
            color: white;
        }
        
        .table-select-name {
            font-size: 0.9rem;
            color: var(--text-color);
            opacity: 0.8;
            margin-bottom: 10px;
        }
        
        .table-select-info {
            display: flex;
            gap: 15px;
            font-size: 0.85rem;
            color: var(--text-color);
            opacity: 0.7;
        }
        
        .table-select-warning {
            margin-top: 10px;
            padding: 8px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 5px;
            font-size: 0.85rem;
            color: var(--danger);
        }
        
        /* Styles pour les aperçus 
        .preview-guest-card {
            background: var(--card-bg);
            border-radius: 10px;
            padding: 20px;
            border: 1px solid var(--border-color);
        }
        
        .preview-guest-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .preview-guest-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 1.5rem;
        }
        
        .preview-guest-info {
            flex: 1;
        }
        
        .preview-guest-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-color);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .preview-guest-email {
            color: var(--text-color);
            opacity: 0.7;
            font-size: 0.9rem;
        }
        
        .preview-guest-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .preview-detail-row {
            display: flex;
            justify-content: space-between;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .preview-detail-row.full-width {
            flex-direction: column;
            gap: 8px;
        }
        
        .preview-detail-label {
            font-weight: 600;
            color: var(--text-color);
            opacity: 0.8;
        }
        
        .preview-detail-value {
            color: var(--text-color);
        }
        
        .vip-badge-preview {
            background: var(--warning);
            color: white;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 0.8rem;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        
        /* Styles pour les confirmations
        .confirmation-card {
            background: var(--card-bg);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            overflow: hidden;
        }
        
        .confirmation-header {
            background: var(--primary-light);
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .confirmation-header h4 {
            margin: 0;
            color: var(--text-color);
        }
        
        .confirmation-body {
            padding: 20px;
        }
        
        .confirmation-section-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .confirmation-detail {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
        }
        
        .confirmation-label {
            font-weight: 600;
            color: var(--text-color);
            opacity: 0.7;
        }
        
        .confirmation-value {
            color: var(--text-color);
        }
        
        .confirmation-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .confirmation-notes {
            background: var(--hover-bg);
            padding: 15px;
            border-radius: 8px;
            color: var(--text-color);
            line-height: 1.5;
        }
        
        /* Badges de statut 
        .status-badge-pro {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        
        .status-badge-pro.present {
            background: rgba(16, 185, 129, 0.2);
            color: var(--success);
        }
        
        .status-badge-pro.pending {
            background: rgba(245, 158, 11, 0.2);
            color: var(--warning);
        }
        
        /* Avatar pour QR 
        .qr-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 1.5rem;
        }
        
       
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
})();
*/

// ============================================================
// 🔄 GESTION DE L'EXPANSION DES DÉTAILS DES INVITÉS
// ============================================================
function toggleGuestRowDetails(guestId, event) {
    event.stopPropagation();
    
    // Fermer tous les autres détails ouverts d'abord
    const allExpandedRows = document.querySelectorAll('.guest-details-row[style*="display: table-row"]');
    allExpandedRows.forEach(row => {
        if (row.dataset.guestId !== guestId && row.dataset.guestid !== guestId) {
            row.style.display = 'none';
            // Trouver et mettre à jour le bouton expand correspondant
            const guestRowId = row.dataset.guestId || row.dataset.guestid;
            const expandBtn = document.querySelector(`button[onclick*="toggleGuestRowDetails('${guestRowId}"]`);
            if (expandBtn) {
                expandBtn.classList.remove('expanded');
                expandBtn.querySelector('i')?.classList.remove('rotated');
            }
        }
    });
    
    // Chercher la ligne de détails - plusieurs tentatives de sélecteur
    let detailsRow = document.querySelector(`.guest-details-row[data-guestid="${guestId}"]`);
    
    // Fallback - chercher par classe et vérifier le dataset
    if (!detailsRow) {
        const detailsRows = document.querySelectorAll('.guest-details-row');
        for (const row of detailsRows) {
            if (row.dataset.guestId === guestId || row.dataset.guestid === guestId) {
                detailsRow = row;
                break;
            }
        }
    }
    
    const expandBtn = event.currentTarget;
    
    if (!detailsRow) {
        console.warn(`⚠️ Ligne de détails introuvable pour invité: ${guestId}`);
        console.log('🔍 IDs disponibles:', Array.from(document.querySelectorAll('.guest-details-row')).map(r => r.dataset.guestId || r.dataset.guestid));
        return;
    }
    
    const isExpanded = detailsRow.style.display !== 'none';
    
    if (isExpanded) {
        // Fermer
        detailsRow.style.display = 'none';
        expandBtn.classList.remove('expanded');
        expandBtn.querySelector('i').classList.remove('rotated');
    } else {
        // Ouvrir
        detailsRow.style.display = 'table-row';
        expandBtn.classList.add('expanded');
        expandBtn.querySelector('i').classList.add('rotated');
        
        // Animation d'entrée
        detailsRow.style.animation = 'slideDown 0.3s ease';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🪑 GESTION AVANCÉE DES TABLES - Mouvements d'invités
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Déplacer un invité d'une table à une autre avec vérification de capacité
 */
async function moveGuestToAnotherTable(guestId, fromTableId) {
    console.log(`🚀 Déplacement invité ${guestId} depuis table ${fromTableId}`);
    
    const guest = storage.getGuestById(guestId);
    if (!guest) {
        showNotification('error', 'Invité introuvable');
        return;
    }
    
    let allTables = storage.getAllTables(currentEventId) || [];
    
    // Gérer les deux formats de réponse (API ou local)
    if (allTables && allTables.data && Array.isArray(allTables.data)) {
        allTables = allTables.data;
    } else if (!Array.isArray(allTables)) {
        allTables = [];
    }
    
    if (allTables.length === 0) {
        showNotification('warning', 'Aucune table disponible');
        return;
    }
    
    // Préparer les options des tables avec vérification de capacité
    const tableOptions = allTables.map(table => {
        if (table.id === fromTableId) return null;
        
        const guests = storage.getGuestsByEventId(currentEventId)
            .filter(g => g.tableId === table.id && g.id !== guestId);
        
        const occupiedSeats = guests.reduce((sum, g) => sum + (g.seats || 1), 0);
        const availableSeats = (table.capacity || 0) - occupiedSeats;
        const guestSeats = guest.seats || 1;
        const canAssign = availableSeats >= guestSeats;
        
        return {
            id: table.id,
            number: table.tableNumber,
            name: table.tableName || `Table #${table.tableNumber}`,
            available: availableSeats,
            required: guestSeats,
            canAssign
        };
    }).filter(Boolean);
    
    // Trier par capacité disponible
    tableOptions.sort((a, b) => b.available - a.available);
    
    // Créer le HTML du modal
    const modalHTML = `
        <div class="text-start">
            <div class="mb-4 p-3 bg-light rounded">
                <div class="d-flex align-items-center">
                    <div class="guest-avatar-small me-3" style="background: ${stringToColor(`${guest.firstName} ${guest.lastName}`)}">
                        ${getGuestAvatarImage(guest) 
                        ? `<img src="${getGuestAvatarImage(guest)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none';">`
                        : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700;">${initials}</span>`
                    }
                    </div>

                    <div>
                        <h6 class="mb-0">${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</h6>
                        <small class="text-muted">${guest.seats || 1} place(s) requise(s)</small>
                    </div>
                </div>
            </div>
            
            <label class="form-label fw-bold mb-2">Sélectionner une table destination:</label>
            <div class="list-group" id="tableList" style="max-height: 400px; overflow-y: auto;">
                ${tableOptions.map(table => `
                    <button type="button" class="list-group-item list-group-item-action table-option ${!table.canAssign ? 'disabled opacity-50' : ''}" 
                            data-table-id="${table.id}" ${!table.canAssign ? 'disabled' : ''}>
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold">Table #${table.number} ${table.name ? `- ${escapeHtml(table.name)}` : ''}</div>
                                <small class="text-muted">${table.available} place(s) disponible(s)</small>
                            </div>
                            <span class="badge ${table.canAssign ? 'bg-success' : 'bg-danger'}">
                                ${table.canAssign ? '✓ Possible' : '✗ Plein'}
                            </span>
                        </div>
                    </button>
                `).join('')}
            </div>
            
            ${tableOptions.filter(t => !t.canAssign).length > 0 ? `
                <div class="alert alert-warning mt-3 mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Les tables en rouge n'ont pas assez de places
                </div>
            ` : ''}
        </div>
    `;
    
    const result = await Swal.fire({
        title: '📍 Déplacer vers une autre table',
        html: modalHTML,
        showCancelButton: true,
        confirmButtonText: 'Confirmer le déplacement',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#10B981',
        didOpen: () => {
            const tableOptions = document.querySelectorAll('.table-option:not([disabled])');
            tableOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    document.querySelectorAll('.table-option').forEach(opt => opt.classList.remove('active', 'border', 'border-primary'));
                    option.classList.add('active', 'border', 'border-primary');
                    option.dataset.selected = 'true';
                });
            });
        },
        preConfirm: () => {
            const selected = document.querySelector('.table-option[data-selected="true"]');
            if (!selected) {
                Swal.showValidationMessage('Veuillez sélectionner une table');
                return false;
            }
            return selected.dataset.tableId;
        }
    });
    
    if (result.isConfirmed) {
        try {
            const toTableId = result.value;
            const toTable = allTables.find(t => t.id === toTableId);
            const fromTable = allTables.find(t => t.id === fromTableId);
            
            // Demander une confirmation finale APRÈS la sélection
            const confirmMsg = `
                <strong>${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</strong> sera déplacé(e) de:<br>
                <div class="mt-2 mb-2">
                    <span class="badge bg-danger">Table #${fromTable?.tableNumber || '?'}</span>
                    <i class="fas fa-arrow-right mx-2"></i>
                    <span class="badge bg-success">Table #${toTable?.tableNumber || '?'}</span>
                </div>
            `;
            
            const confirmResult = await Swal.fire({
                title: 'Confirmer le déplacement ?',
                html: confirmMsg,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Déplacer',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#10B981',
                reverseButtons: false
            });
            
            if (!confirmResult.isConfirmed) {
                console.log('❌ Déplacement annulé par l\'utilisateur');
                return;
            }
            
            // Retirer de l'ancienne table
            if (fromTableId) {
                await storage.removeGuestFromTable(fromTableId, guestId);
            }
            
            // Assigner à la nouvelle table
            await storage.assignGuestToTable(toTableId, guestId, guest.seats || 1);
            
            console.log(`✅ Invité déplacé vers table ${toTableId}`);
            showNotification('success', `Invité déplacé avec succès`);
            
            await loadGuests();
            
        } catch (error) {
            console.error('❌ Erreur déplacement:', error);
            const errorMsg = error.message.includes('déjà assigné') 
                ? 'Cet invité est déjà à cette table'
                : error.message || 'Erreur lors du déplacement';
            showNotification('error', errorMsg);
        }
    }
}

/**
 * Ajouter des invités à une table avec gestion de la capacité
 */
async function addGuestToTable(targetTableId) {
    console.log(`➕ Ajout d'invités à la table ${targetTableId}`);
    
    const targetTable = storage.getTableById(targetTableId);
    if (!targetTable) {
        showNotification('error', 'Table non trouvée');
        return;
    }
    
    // Obtenir les invités non assignés ou assignés ailleurs
    const currentGuests = storage.getGuestsByEventId(currentEventId) || [];
    const unassignedGuests = currentGuests.filter(g => !g.tableId).sort((a, b) => 
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
    
    if (unassignedGuests.length === 0) {
        showNotification('info', 'Aucun invité non assigné disponible');
        return;
    }
    
    // Calculer la capacité disponible
    const assignedToThisTable = currentGuests.filter(g => g.tableId === targetTableId);
    const occupiedSeats = assignedToThisTable.reduce((sum, g) => sum + (g.seats || 1), 0);
    const availableSeats = (targetTable.capacity || 0) - occupiedSeats;
    
    if (availableSeats <= 0) {
        showNotification('warning', 'La table est pleine');
        return;
    }
    
    // Créer le HTML du modal de sélection
    const guestListHTML = `
        <div class="text-start">
            <div class="mb-3 p-3 bg-light rounded">
                <div class="fw-bold">Table destination: Table #${targetTable.tableNumber}</div>
                <small class="text-muted">Places disponibles: ${availableSeats}</small>
            </div>
            
            <label class="form-label fw-bold">Sélectionner des invités:</label>
            <div class="list-group guest-selection-list" style="max-height: 450px; overflow-y: auto;">
                ${unassignedGuests.map(guest => `
                    <label class="list-group-item list-group-item-action">
                        <input type="checkbox" class="form-check-input me-2 guest-select-checkbox" 
                               value="${guest.id}" data-seats="${guest.seats || 1}">
                        <div class="d-flex align-items-center">
                        
                            <div class="guest-avatar-small me-2" style="background: ${stringToColor(`${guest.firstName} ${guest.lastName}`)}; width: 32px; height: 32px;">
                                
                                  ${getGuestAvatarImage(guest) 
                        ? `<img src="${getGuestAvatarImage(guest)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none';">`
                        : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700;">${getInitials(`${guest.firstName} ${guest.lastName}`)}</span>`}
                            </div>


                            <div>
                                <div class="fw-5">${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</div>
                                <small >${guest.seats || 1} place(s) - ${guest.email || '—'}</small>
                            </div>
                        </div>
                    </label>
                `).join('')}
            </div>
            
            <div class="mt-3">
                <small class="text-muted">Total places sélectionnées: <span id="selectedSeats">0</span> / ${availableSeats}</small>
            </div>
        </div>
    `;
    
    const result = await Swal.fire({
        title: '👥 Ajouter des invités à la table',
        html: guestListHTML,
        showCancelButton: true,
        confirmButtonText: 'Assigner les invités',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#3B82F6',
        didOpen: () => {
            const checkboxes = document.querySelectorAll('.guest-select-checkbox');
            const selectedSeatsSpan = document.getElementById('selectedSeats');
            
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    let totalSeats = 0;
                    document.querySelectorAll('.guest-select-checkbox:checked').forEach(cb => {
                        totalSeats += parseInt(cb.dataset.seats) || 1;
                    });
                    
                    selectedSeatsSpan.textContent = totalSeats;
                    
                    // Désactiver les cases qui dépasseraient la capacité
                    checkboxes.forEach(cb => {
                        if (!cb.checked) {
                            const seatsCb = parseInt(cb.dataset.seats) || 1;
                            let otherSeats = 0;
                            document.querySelectorAll('.guest-select-checkbox:checked').forEach(checked => {
                                otherSeats += parseInt(checked.dataset.seats) || 1;
                            });
                            cb.disabled = (otherSeats + seatsCb) > availableSeats;
                        }
                    });
                });
            });
        },
        preConfirm: () => {
            const selected = Array.from(document.querySelectorAll('.guest-select-checkbox:checked'))
                .map(cb => cb.value);
            
            if (selected.length === 0) {
                Swal.showValidationMessage('Veuillez sélectionner au moins un invité');
                return false;
            }
            
            return selected;
        }
    });
    
    if (result.isConfirmed) {
        try {
            const selectedGuestIds = result.value;
            const selectedGuests = selectedGuestIds.map(id => storage.getGuestById(id)).filter(Boolean);
            const totalSeats = selectedGuests.reduce((sum, g) => sum + (g.seats || 1), 0);
            
            // Demander une confirmation finale
            const confirmMsg = `
                <div class="text-start">
                    <p class="mb-2"><strong>${selectedGuests.length} invité(s)</strong> seront assigné(s) à:</p>
                    <div class="mb-3">
                        <span class="badge bg-primary">Table #${targetTable.tableNumber}${targetTable.tableName ? ` (${targetTable.tableName})` : ''}</span>
                    </div>
                    <ul class="list-unstyled">
                        ${selectedGuests.map(g => `
                            <li class="mb-1">
                                <i class="fas fa-user me-2"></i>
                                ${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}
                                <span class="badge bg-light text-dark ms-2">${g.seats || 1} place(s)</span>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="mt-3 pt-3 border-top">
                        <small class="text-muted">Total: <strong>${totalSeats}</strong> place(s) / <strong>${availableSeats}</strong> disponible(s)</small>
                    </div>
                </div>
            `;
            
            const confirmResult = await Swal.fire({
                title: 'Confirmer l\'assignation ?',
                html: confirmMsg,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Assigner',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#3B82F6',
                reverseButtons: false
            });
            
            if (!confirmResult.isConfirmed) {
                console.log('❌ Assignation annulée par l\'utilisateur');
                return;
            }
            
            let assignedCount = 0;
            
            for (const guestId of selectedGuestIds) {
                const guest = storage.getGuestById(guestId);
                if (guest) {
                    await storage.assignGuestToTable(targetTableId, guestId, guest.seats || 1);
                    assignedCount++;
                }
            }
            
            console.log(`✅ ${assignedCount} invité(s) assigné(s) à la table`);
            showNotification('success', `${assignedCount} invité(s) assigné(s) avec succès`);
            
            await loadGuests();
            
        } catch (error) {
            console.error('❌ Erreur assignation:', error);
            const errorMsg = error.message.includes('déjà assigné') 
                ? 'Un ou plusieurs invités sont déjà assignés à cette table'
                : error.message || 'Erreur lors de l\'assignation';
            showNotification('error', errorMsg);
        }
    }
}

console.log('🚀 SECURA Guests Management Ultimate chargé avec succès !');