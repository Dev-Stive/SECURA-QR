/**
 * SECURA - Events Management
 * Gestion complète des événements
 */

let currentEvents = [];
let filteredEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    initializeEventListeners();
});

// ===== LOAD EVENTS =====
function loadEvents() {
    currentEvents = storage.data.events;
    filteredEvents = [...currentEvents];
    renderEvents();
}

function createEventCard(event) {
    const guests = storage.getGuestsByEventId(event.id);
    const scannedGuests = guests.filter(g => g.scanned).length;
    const eventDate = new Date(event.date);
    const isUpcoming = eventDate >= new Date();
    const formattedDate = eventDate.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    // === IMAGES DE FOND PAR TYPE ===
    const typeImages = {
        marriage: 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80',
        anniversaire: 'https://images.unsplash.com/photo-1464349095433-7956a61b8a07?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80',
        conference: 'https://images.unsplash.com/photo-1540575467063-868f79e66c3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80',
        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80'
    };

    const typeLabels = {
        marriage: { label: 'MARIAGE', class: 'type-marriage' },
        anniversaire: { label: 'ANNIVERSAIRE', class: 'type-anniversaire' },
        conference: { label: 'CONFÉRENCE', class: 'type-conference' },
        autre: { label: 'AUTRE', class: 'type-autre' }
    };

    const type = typeLabels[event.type] || { label: event.type.toUpperCase(), class: 'type-autre' };
    const backgroundImage = typeImages[event.type] || typeImages.autre;
    const fillRate = event.capacity ? Math.round((guests.length / event.capacity) * 100) : 0;

    // === Progression circulaire (SVG) ===
    const circumference = 2 * Math.PI * 36; // rayon = 36
    const progressOffset = circumference - (fillRate / 100) * circumference;

    return `
        <div class="event-card-pro" onclick="viewEvent('${event.id}')" style="background-image: url('${backgroundImage}');">
            ${isUpcoming ? '<div class="upcoming-ribbon">À VENIR</div>' : ''}
            
         

            <!-- Contenu principal -->
            <div class="event-content">
                <h3 class="event-title">${event.name}</h3>
                
                <div class="event-meta">
                    <div class="meta-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${formattedDate}</span>
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

                <!-- Stats en cercles -->
                <div class="event-stats-circle">
                    <div class="stat-circle">
                        <div class="circle">
                            <span class="value">${guests.length}</span>
                            <span class="label">Invités</span>
                        </div>
                    </div>
                    <div class="stat-circle">
                        <div class="circle">
                            <span class="value">${scannedGuests}</span>
                            <span class="label">Présents</span>
                        </div>
                    </div>
                    ${event.capacity ? `
                    <div class="stat-circle progress">
                        <svg width="80" height="80" viewBox="0 0 80 80">
                            <circle class="track" cx="40" cy="40" r="36" stroke="#e0e0e0" stroke-width="8" fill="none"/>
                            <circle class="progress-ring" cx="40" cy="40" r="36" stroke="#4ade80" stroke-width="8" fill="none"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${progressOffset}"
                                transform="rotate(-90 40 40)"/>
                            <text x="40" y="45" text-anchor="middle" class="progress-text">${fillRate}%</text>
                        </svg>
                        <span class="label">Remplissage</span>
                    </div>
                    ` : ''}
                </div>

                <!-- Statut actif -->
                <div class="event-status">
                    <i class="fas ${event.active ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}"></i>
                    <span>${event.active ? 'Actif' : 'Inactif'}</span>
                </div>
            </div>

            <!-- Actions (flottantes) -->
            <div class="event-actions" onclick="event.stopPropagation()">
                <button class="action-btn" onclick="viewEvent('${event.id}')" title="Voir">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn" onclick="editEvent('${event.id}')" title="Modifier">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn" onclick="duplicateEvent('${event.id}')" title="Dupliquer">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn" onclick="exportEvent('${event.id}')" title="Exporter">
                    <i class="fas fa-download"></i>
                </button>
                <button class="action-btn delete" onclick="deleteEvent('${event.id}')" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}


async function renderEvents() {
    const eventsGrid = document.getElementById('eventsGrid');
    const loader = document.getElementById('eventsLoader');
    if (!eventsGrid || !loader) return;

    loader.style.display = 'flex';
    eventsGrid.style.display = 'none';
    eventsGrid.style.opacity = 0;

    
    await new Promise(r => setTimeout(r, 100));

    if (filteredEvents.length === 0) {
        eventsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-plus"></i>
                <p>Aucun événement trouvé</p>
                <button class="btn btn-primary" onclick="openEventModal()">
                    <i class="fas fa-plus"></i> Créer votre premier événement
                </button>
            </div>
        `;
    } else {
        eventsGrid.innerHTML = filteredEvents
            .map((event, index) => {
                const card = createEventCard(event);
                return `<div style="animation-delay: ${index * 0.1}s">${card}</div>`;
            })
            .join('');
    }

    loader.style.display = 'none';
    eventsGrid.style.display = 'grid';
    eventsGrid.style.opacity = 1;
    
}


// ===== EVENT LISTENERS =====
function initializeEventListeners() {
    // Bouton créer événement
    const createEventBtn = document.getElementById('createEventBtn');
    if (createEventBtn) {
        createEventBtn.addEventListener('click', () => openEventModal());
    }

    // Recherche
    const searchEvents = document.getElementById('searchEvents');
    if (searchEvents) {
        searchEvents.addEventListener('input', debounce(handleSearch, 300));
    }

    // Filtres
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', applyFilters);
    }

    const sortEvents = document.getElementById('sortEvents');
    if (sortEvents) {
        sortEvents.addEventListener('change', applyFilters);
    }

    // Formulaire événement
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
}

// ===== SEARCH & FILTER =====
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    filteredEvents = currentEvents.filter(event => 
        event.name.toLowerCase().includes(query) ||
        (event.location && event.location.toLowerCase().includes(query)) ||
        (event.description && event.description.toLowerCase().includes(query))
    );
    applyFilters();
}

async function applyFilters() {
    const filterType = document.getElementById('filterType');
    const sortEvents = document.getElementById('sortEvents');
    
    let filtered = [...filteredEvents];

    if (filterType && filterType.value !== 'all') {
        filtered = filtered.filter(e => e.type === filterType.value);
    }

    // Tri
    if (sortEvents) {
        const sortValue = sortEvents.value;
        filtered.sort((a, b) => {
            switch (sortValue) {
                case 'date-desc':
                    return new Date(b.date) - new Date(a.date);
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                default:
                    return 0;
            }
        });
    }

    filteredEvents = filtered;
    await renderEvents();
}

// ===== MODAL =====
function openEventModal(eventId = null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const title = document.getElementById('eventModalTitle');
    
    if (!modal || !form) return;

    form.reset();
    
    if (eventId) {
        const event = storage.getEventById(eventId);
        if (event) {
            document.getElementById('eventId').value = event.id;
            document.getElementById('eventName').value = event.name;
            document.getElementById('eventType').value = event.type;
            document.getElementById('eventDate').value = event.date;
            document.getElementById('eventTime').value = event.time || '';
            document.getElementById('eventCapacity').value = event.capacity || '';
            document.getElementById('eventLocation').value = event.location || '';
            document.getElementById('eventDescription').value = event.description || '';
            document.getElementById('welcomeMessage').value = event.welcomeMessage || '';
            document.getElementById('eventActive').checked = event.active !== false;
            
            title.innerHTML = '<i class="fas fa-edit"></i> Modifier l\'événement';
        }
    } else {
        title.innerHTML = '<i class="fas fa-calendar-plus"></i> Créer un événement';
        document.getElementById('eventActive').checked = true;
    }

    modal.classList.add('active');
}

function closeEventModal() {
    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===== FORM SUBMIT =====
function handleEventSubmit(e) {
    e.preventDefault();
    
    const eventId = document.getElementById('eventId').value;
    const eventData = {
        id: eventId || undefined,
        name: document.getElementById('eventName').value.trim(),
        type: document.getElementById('eventType').value,
        date: document.getElementById('eventDate').value,
        time: document.getElementById('eventTime').value,
        capacity: document.getElementById('eventCapacity').value ? parseInt(document.getElementById('eventCapacity').value) : null,
        location: document.getElementById('eventLocation').value.trim(),
        description: document.getElementById('eventDescription').value.trim(),
        welcomeMessage: document.getElementById('welcomeMessage').value.trim(),
        active: document.getElementById('eventActive').checked
    };

    try {
        const savedEvent = storage.saveEvent(eventData);
        closeEventModal();
        loadEvents();
        showNotification('success', eventId ? 'Événement modifié avec succès' : 'Événement créé avec succès');
    } catch (error) {
        console.error('Error saving event:', error);
        showNotification('error', 'Une erreur est survenue lors de l\'enregistrement');
    }
}

// ===== ACTIONS =====
function viewEvent(eventId) {
    window.location.href = `guests.html?event=${eventId}`;
}

function editEvent(eventId) {
    openEventModal(eventId);
}

async function duplicateEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) return;

    const confirmed = await confirmDialog(
        'Dupliquer l\'événement',
        'Voulez-vous dupliquer cet événement avec tous ses invités ?',
        'Dupliquer',
        'Annuler'
    );

    if (confirmed) {
        const newEvent = { ...event };
        delete newEvent.id;
        newEvent.name = `${event.name} (Copie)`;
        
        const savedEvent = storage.saveEvent(newEvent);
        
        // Dupliquer les invités
        const guests = storage.getGuestsByEventId(eventId);
        guests.forEach(guest => {
            const newGuest = { ...guest };
            delete newGuest.id;
            newGuest.eventId = savedEvent.id;
            newGuest.scanned = false;
            storage.saveGuest(newGuest);
        });
        
        loadEvents();
        showNotification('success', 'Événement dupliqué avec succès');
    }
}

function exportEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) return;

    const csvContent = storage.exportToCSV(eventId);
    const filename = `${event.name.replace(/\s+/g, '_')}_invites_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadFile(csvContent, filename, 'text/csv');
    showNotification('success', 'Export CSV réussi');
}

async function deleteEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) return;

    const guests = storage.getGuestsByEventId(eventId);
    const guestCount = guests.length;

    const confirmed = await confirmDialog(
        'Supprimer l\'événement',
        `Êtes-vous sûr de vouloir supprimer "${event.name}" ? ${guestCount > 0 ? `Cela supprimera également ${guestCount} invité(s) et leurs QR codes.` : ''}`,
        'Supprimer',
        'Annuler'
    );

    if (confirmed) {
        storage.deleteEvent(eventId);
        loadEvents();
        showNotification('success', 'Événement supprimé avec succès');
    }
}

// Fermer le modal en cliquant sur l'overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeEventModal();
    }
});

// Fermer avec la touche Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEventModal();
    }
});

// Export des fonctions globales
window.openEventModal = openEventModal;
window.closeEventModal = closeEventModal;
window.viewEvent = viewEvent;
window.editEvent = editEvent;
window.duplicateEvent = duplicateEvent;
window.exportEvent = exportEvent;
window.deleteEvent = deleteEvent;