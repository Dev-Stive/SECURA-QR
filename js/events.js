/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           🎫 SECURA EVENTS MANAGEMENT V5.0 🎫                 ║
 * ║                                                               ║
 * ║  🎯 Mise à jour granulaire (pas de rerender complet)         ║
 * ║  🔔 SweetAlert2 avant chaque opération                        ║
 * ║  ✅ Validation ultra complète                                 ║
 * ║  📊 Observable DOM patching                                   ║
 * ║  ⚡ Performance optimisée                                     ║
 * ║  🎨 Animations fluides                                        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

let currentEvents = [];
let filteredEvents = [];
let isRendering = false;
const eventCardCache = new Map();
const eventStatsCache = new Map();

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;
    
    initializeEventListeners();
    setupGranularListener();

    await loadEvents();
});

// ═══════════════════════════════════════════════════════════════
// 🎧 LISTENERS GRANULAIRES OBSERVABLES
// ═══════════════════════════════════════════════════════════════
function setupGranularListener() {

    // debounce pour éviter rafales de MAJ
    const debouncedDataSynced = debounce((detail) => {
        const latest = [...storage.data.events];
        const latestMap = new Map(latest.map(e => [e.id, e]));
        const existingIds = new Set(currentEvents.map(e => e.id));

        // determine si un filtre/recherche est actif
        const searchQuery = document.getElementById('searchEvents')?.value?.toLowerCase().trim();
        const filterType = document.getElementById('filterType')?.value;
        const isFilteringActive = !!(searchQuery || (filterType && filterType !== 'all'));

        // Detect created & updated
        latest.forEach(ev => {

            if (ev.__justCreated) {
                delete ev.__justCreated;
                return;
            }
            const existing = currentEvents.find(x => x.id === ev.id);

            // conserver la mémoire à jour
            const idx = currentEvents.findIndex(c => c.id === ev.id);
            if (idx !== -1) currentEvents[idx] = ev;

            if (!existing) {
                // nouvelle entrée — insérer uniquement si elle passe les filtres courants
                console.log('🔔 Event detected (created) via data:synced:', ev.name);
                currentEvents.unshift(ev);
                if (passesCurrentFilters(ev)) {
                    insertEventCard(ev);
                } else {
                    // si filtre actif, on n'insère pas, mais on garde l'event en mémoire
                    if (!isFilteringActive) {
                        insertEventCard(ev);
                    }
                }
                eventStatsCache.set(ev.id, { guests: 0, scanned: 0, fillRate: 0 });
            } else {
                // event existant -> décider d'un update ciblé
                const old = existing;
                const needsFullUpdate = 
                    old.name !== ev.name ||
                    old.date !== ev.date ||
                    old.time !== ev.time ||
                    old.location !== ev.location ||
                    old.type !== ev.type ||
                    old.capacity !== ev.capacity ||
                    old.active !== ev.active;

                // si un filtre est actif, vérifier si l'event doit être visible ou retiré
                const wasVisible = eventCardCache.has(ev.id) && document.body.contains(eventCardCache.get(ev.id));
                const shouldBeVisible = passesCurrentFilters(ev);

                if (wasVisible && !shouldBeVisible) {
                    // retirer la carte si elle ne correspond plus aux filtres
                    removeEventCard(ev.id);
                    // ne pas continuer l'update DOM
                    return;
                }

                if (!wasVisible && shouldBeVisible) {
                    // l'event devient visible (passe maintenant les filtres) -> insérer proprement
                    insertEventCard(ev);
                    return;
                }

                // sinon appliquer update ciblé
                if (needsFullUpdate) {
                    updateEventCardIfNeeded(ev);
                } else {
                    // juste rafraîchir stats si besoin
                    updateEventStats(ev.id);
                }
            }
        });

        // Detect deleted : supprimer toute carte qui n'existe plus côté serveur
        currentEvents.slice().forEach(ev => {
            if (!latestMap.has(ev.id)) {
                console.log('🔔 Event detected (deleted) via data:synced:', ev.id);
                removeEventCard(ev.id);
                currentEvents = currentEvents.filter(c => c.id !== ev.id);
            }
        });

        // resynchroniser currentEvents avec latest (garder l'ordre serveur)
        currentEvents = latest.slice();
        // si aucun filtre actif, synchroniser filteredEvents automatiquement
        if (!isFilteringActive) filteredEvents = getFilteredAndSortedEvents();
        // sinon garder filteredEvents tel quel (l'utilisateur contrôle la vue)
    }, 200);

    storage.on('data:synced', (detail) => {
        try {
            debouncedDataSynced(detail);
        } catch (err) {
            console.error('Erreur handling data:synced:', err);
            // fallback : re-render complet si erreur
            renderEvents();
        }
    });

    storage.on('event:created', (event) => {
        const ev = event.detail;
        console.log('Événement créé détecté:', ev.name);

        // Nettoyer le marqueur s'il existe
        if (ev.__justCreated) delete ev.__justCreated;

        const duplicate = currentEvents.find(e => e.name === ev.name && e.date === ev.date);
        if (duplicate && duplicate.id !== ev.id) removeEventCard(duplicate.id);
        
        if (!currentEvents.find(e => e.id === ev.id)) {
            currentEvents.unshift(ev);
            if (passesCurrentFilters(ev)) insertEventCard(ev);
        }
        updateEventStats(ev.id);
    });

    storage.on('event:updated', (data) => {
        const ev = (data && data.new) ? data.new : data;
        console.log('🔄 Événement mis à jour détecté:', ev.name || ev.id);
        const idx = currentEvents.findIndex(e => e.id === ev.id);
        if (idx !== -1) currentEvents[idx] = ev; else currentEvents.push(ev);

        const visible = passesCurrentFilters(ev);
        const cardPresent = eventCardCache.has(ev.id) && document.body.contains(eventCardCache.get(ev.id));

        if (cardPresent && !visible) {
            removeEventCard(ev.id);
            return;
        }
        if (!cardPresent && visible) {
            insertEventCard(ev);
            return;
        }

        updateEventCardIfNeeded(ev);
        updateEventStats(ev.id);
    });

    storage.on('event:deleted', (data) => {
        const id = (data && data.id) ? data.id : (typeof data === 'string' ? data : data?.detail?.id);
        console.log('🗑️ Événement supprimé détecté:', id);
        removeEventCard(id);
        currentEvents = currentEvents.filter(e => e.id !== id);
    });

    // guests/scans/qrcodes impactent automatiquement les stats des events
    storage.on('guest:created', (guest) => {
        const gid = guest?.eventId || guest?.detail?.eventId;
        if (gid) updateEventStats(gid);
    });
    storage.on('guest:updated', (data) => {
        const evId = data?.new?.eventId || data?.eventId || data?.detail?.eventId;
        if (evId) updateEventStats(evId);
    });
    storage.on('guest:deleted', (guest) => {
        const evId = guest?.eventId || guest?.detail?.eventId;
        if (evId) updateEventStats(evId);
    });
    storage.on('scan:created', (scan) => {
        const evId = scan?.eventId || scan?.detail?.eventId;
        if (evId) updateEventStats(evId);
    });
    storage.on('qr:generated', (qr) => {
        const evId = qr?.eventId || qr?.detail?.eventId;
        if (evId) updateEventStats(evId);
    });

    window.addEventListener('data:', () => {
        loadEvents();
    });
}


// ═══════════════════════════════════════════════════════════════
// 📥 CHARGEMENT INITIAL
// ═══════════════════════════════════════════════════════════════
async function loadEvents() {
    currentEvents = [...storage.data.events];
    filteredEvents = [...currentEvents];
 renderEvents();
}

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDU INITIAL (Une seule fois)
// ═══════════════════════════════════════════════════════════════
async function renderEvents() {
    if (isRendering) return;
    isRendering = true;

    const grid = document.getElementById('eventsGrid');
    const loader = document.getElementById('eventsLoader');
    
    if (!grid || !loader) {
        isRendering = false;
        return;
    }

    loader.style.display = 'flex';
    grid.style.opacity = '0';

    await new Promise(r => setTimeout(r, 100));

    eventCardCache.clear();
    eventStatsCache.clear();

    if (filteredEvents.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-plus text-6xl mb-4 text-gray-400"></i>
                <p class="text-lg text-gray-500">Aucun événement trouvé</p>
                <button class="btn btn-primary " onclick="openEventModal()">
                    Créer votre premier événement
                </button>
            </div>

            
        `;
    } else {
        const fragment = document.createDocumentFragment();
        filteredEvents.forEach((event, i) => {
            const card = createEventCardElement(event);
            card.style.animationDelay = `${i * 0.1}s`;
            eventCardCache.set(event.id, card);
            
            const guests = storage.getGuestsByEventId(event.id);
            const scanned = guests.filter(g => g.scanned).length;
            const fillRate = event.capacity ? Math.round((guests.length / event.capacity) * 100) : 0;
            
            eventStatsCache.set(event.id, {
                guests: guests.length,
                scanned,
                fillRate
            });
            
            fragment.appendChild(card);
        });
        
        grid.innerHTML = '';
        grid.appendChild(fragment);
    }

    loader.style.display = 'none';
    
    requestAnimationFrame(() => {
        grid.style.opacity = '1';
    });
    
    isRendering = false;
}

// ═══════════════════════════════════════════════════════════════
// 🎴 CRÉATION ÉLÉMENT CARTE
// ═══════════════════════════════════════════════════════════════
function createEventCardElement(event) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createEventCardHTML(event);
    const card = wrapper.firstElementChild;
    card.setAttribute('data-event-id', event.id);
    return card;
}


// REMPLACER la fonction createEventCardHTML par celle-ci :
function createEventCardHTML(event) {
    const guests = storage.getGuestsByEventId(event.id);
    const scannedGuests = guests.filter(g => g.scanned).length;
    const eventDate = new Date(event.date);
    const isUpcoming = eventDate >= new Date();
    const formattedDate = eventDate.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    // Images par type d'événement (étendu)
    const typeImages = {
        marriage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
        anniversaire: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=80',
        anniversary: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=80',
        conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
        corporate: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
        concert: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
        gala: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
        football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
        graduation: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
        exhibition: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&q=80',
        vip: 'https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?w=800&q=80',
        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e?w=800&q=80'
    };

    const backgroundImage = typeImages[event.type] || typeImages.autre;
    
    // Couleur personnalisée de l'événement
    const primaryColor = event.design?.primaryColor || '#D97706';
    const statusColor = event.active ? '#10B981' : '#EF4444';
    const statusText = event.active ? 'Actif' : 'Inactif';
    
    // Badge de type avec couleur
    const typeColors = {
        marriage: '#EC4899',
        anniversaire: '#F59E0B',
        conference: '#3B82F6',
        corporate: '#6366F1',
        concert: '#8B5CF6',
        gala: '#D97706',
        football: '#10B981',
        autre: '#6B7280'
    };
    
    const typeColor = typeColors[event.type] || '#6B7280';
    const typeLabel = event.type.charAt(0).toUpperCase() + event.type.slice(1);

    return `
        <div class="col-12 col-md-6 col-lg-6 d-flex justify-content-center">
            <div class="event-card-pro w-100" onclick="handleEventSelect('${event.id}')" style="background-image: url('${backgroundImage}'); border-left: 4px solid ${primaryColor};">
                ${isUpcoming ? '<div class="upcoming-ribbon" style="background: linear-gradient(45deg, #3B82F6, #8B5CF6);">À VENIR</div>' : ''}
                
                <!-- Badge de type -->
                <div class="event-type-badge" style="background: ${typeColor};">
                    ${typeLabel}
                </div>
                
                <div class="event-content">
                    <h3 class="event-title">${event.name}</h3>
                    
                    <!-- Métadonnées -->
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
                        ${event.metadata?.category ? `
                        <div class="meta-item">
                            <i class="fas fa-tag"></i>
                            <span>${event.metadata.category}</span>
                        </div>` : ''}
                    </div>

                    <!-- Statistiques améliorées -->
                    <div class="event-stats-circle">
                        <div class="stat-circle">
                            <div class="circle" style="border-color: ${primaryColor}20;">
                                <span class="value">${guests.length}</span>
                                <span class="label">Invités</span>
                            </div>
                        </div>
                        <div class="stat-circle">
                            <div class="circle" style="border-color: #10B98120;">
                                <span class="value">${scannedGuests}</span>
                                <span class="label">Présents</span>
                            </div>
                        </div>
                        <div class="stat-circle">
                            <div class="circle" style="border-color: #3B82F620;">
                                <span class="value">${event.capacity || '∞'}</span>
                                <span class="label">Capacité</span>
                            </div>
                        </div>
                    </div>

                    <!-- État et actions -->
                    <div class="event-footer">
                        <div class="event-status" style="background: ${statusColor} !important;color: white">
                            <i class="fas ${event.active ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                            <span>${statusText}</span>
                        </div>
                        
                        <div class="event-features">
                            ${event.settings?.enablePhotoGallery ? '<i class="fas fa-camera text-blue-500" title="Galerie photos"></i>' : ''}
                            ${event.settings?.enableGuestMessages ? '<i class="fas fa-comment text-green-500" title="Messages invités"></i>' : ''}
                            ${event.settings?.enableTableQR ? '<i class="bi bi-qr-code text-purple-500" title="QR Tables"></i>' : ''}
                        </div>
                    </div>
                </div>

                <!-- Actions -->
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
            </div>
        </div>
    `;
}


async function viewEventStats(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        showError('Événement introuvable');
        return;
    }
    
    const stats = await storage.getEventStatistics(eventId);
    
    const html = `
        <div class="event-stats-modal">
            <h3>${event.name}</h3>
            <p><i class="fas fa-calendar-alt"></i> ${new Date(event.date).toLocaleDateString('fr-FR')}</p>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.guests.total}</div>
                    <div class="stat-label">Invités total</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-value">${stats.guests.scanned}</div>
                    <div class="stat-label">Présents</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-value">${stats.guests.pending}</div>
                    <div class="stat-label">En attente</div>
                </div>
                <div class="stat-card info">
                    <div class="stat-value">${stats.scanRate}%</div>
                    <div class="stat-label">Taux scan</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.scans.total}</div>
                    <div class="stat-label">Scans total</div>
                </div>
                ${event.capacity ? `
                <div class="stat-card">
                    <div class="stat-value">${Math.round((stats.guests.total / event.capacity) * 100)}%</div>
                    <div class="stat-label">Remplissage</div>
                </div>` : ''}
            </div>
            
            <div class="stats-chart">
                <canvas id="eventStatsChart" width="400" height="200"></canvas>
            </div>
        </div>
    `;
    
    await Swal.fire({
        title: '📊 Statistiques',
        html,
        width: '600px',
        confirmButtonText: 'Fermer',
        didOpen: () => {
            // Initialiser un graphique simple
            const ctx = document.getElementById('eventStatsChart')?.getContext('2d');
            if (ctx) {
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Présents', 'En attente'],
                        datasets: [{
                            data: [stats.scannedGuests, stats.pendingGuests],
                            backgroundColor: ['#10B981', '#F59E0B']
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
        }
    });
}


// ═══════════════════════════════════════════════════════════════
// 🔄 MISE À JOUR GRANULAIRE DES CARTES
// ═══════════════════════════════════════════════════════════════
async function insertEventCard(event) {
   
    if (currentEvents.some(e => e.name === event.name && e.date === event.date && e.id !== event.id)) {
        console.warn('Doublon détecté, ignoré:', event.name);
        return;
    }

    currentEvents.unshift(event);
    
    if (!passesCurrentFilters(event)) {
        return;
    }

    const grid = document.getElementById('eventsGrid');
    if (!grid) return;

    const emptyState = grid.querySelector('.empty-state');
    if (emptyState) {
        grid.innerHTML = '';
    }

    const card = createEventCardElement(event);
    eventCardCache.set(event.id, card);

    const guests = storage.getGuestsByEventId(event.id);
    eventStatsCache.set(event.id, {
        guests: guests.length,
        scanned: guests.filter(g => g.scanned).length,
        fillRate: event.capacity ? Math.round((guests.length / event.capacity) * 100) : 0
    });

    card.style.opacity = '0';
    card.style.transform = 'translateY(-20px)';

    const sortValue = document.getElementById('sortEvents')?.value || 'date-desc';
    const insertBefore = findInsertPosition(event, sortValue);

    if (insertBefore) {
        grid.insertBefore(card, insertBefore);
    } else {
        grid.appendChild(card);
    }

    requestAnimationFrame(() => {
        card.style.transition = 'all 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    });

    filteredEvents = getFilteredAndSortedEvents();
}

function findInsertPosition(newEvent, sortValue) {
    const grid = document.getElementById('eventsGrid');
    if (!grid) return null;

    const cards = Array.from(grid.children);
    
    for (const card of cards) {
        const cardId = card.getAttribute('data-event-id');
        if (!cardId) continue;
        
        const cardEvent = storage.getEventById(cardId);
        if (!cardEvent) continue;

        const shouldInsertBefore = compareEvents(newEvent, cardEvent, sortValue);
        if (shouldInsertBefore) {
            return card;
        }
    }

    return null;
}

function compareEvents(eventA, eventB, sortValue) {
    switch (sortValue) {
        case 'date-desc':
            return new Date(eventA.date) > new Date(eventB.date);
        case 'date-asc':
            return new Date(eventA.date) < new Date(eventB.date);
        case 'name-asc':
            return eventA.name.localeCompare(eventB.name) < 0;
        case 'name-desc':
            return eventA.name.localeCompare(eventB.name) > 0;
        default:
            return false;
    }
}

async function updateEventCardIfNeeded(event) {
    const oldEvent = currentEvents.find(e => e.id === event.id);
    if (!oldEvent) {
        currentEvents.push(event);
        if (passesCurrentFilters(event)) {
            await insertEventCard(event);
        }
        return;
    }

    const index = currentEvents.findIndex(e => e.id === event.id);
    if (index !== -1) {
        currentEvents[index] = event;
    }

    if (!passesCurrentFilters(event)) {
        removeEventCard(event.id);
        return;
    }

    const card = eventCardCache.get(event.id);
    if (!card) {
        await insertEventCard(event);
        return;
    }

    const needsFullUpdate = 
        oldEvent.name !== event.name ||
        oldEvent.date !== event.date ||
        oldEvent.time !== event.time ||
        oldEvent.location !== event.location ||
        oldEvent.type !== event.type ||
        oldEvent.capacity !== event.capacity ||
        oldEvent.active !== event.active ||
        oldEvent.status !== event.status ||
        JSON.stringify(oldEvent.design) !== JSON.stringify(event.design) ||
        JSON.stringify(oldEvent.metadata) !== JSON.stringify(event.metadata);

    if (needsFullUpdate) {
        replaceEventCard(event);
    } else {
        updateEventStats(event.id);
    }
}

window.viewEventStats = viewEventStats;

function replaceEventCard(event) {
    const card = eventCardCache.get(event.id);
    if (!card) return;

    const newCard = createEventCardElement(event);
    eventCardCache.set(event.id, newCard);

    card.style.transition = 'opacity 0.2s';
    card.style.opacity = '0';

    setTimeout(() => {
        card.replaceWith(newCard);
        newCard.style.opacity = '0';
        requestAnimationFrame(() => {
            newCard.style.transition = 'opacity 0.3s';
            newCard.style.opacity = '1';
        });
    }, 200);
}

async function updateEventStats(eventId) {
    const card = eventCardCache.get(eventId);
    if (!card) return;

    const guests = storage.getGuestsByEventId(eventId);
    const scanned = guests.filter(g => g.scanned).length;
    const event = storage.getEventById(eventId);
    const capacity = event?.capacity;
    const fillRate = capacity ? Math.round((guests.length / capacity) * 100) : 0;

    const oldStats = eventStatsCache.get(eventId) || { guests: 0, scanned: 0, fillRate: 0 };
    eventStatsCache.set(eventId, { guests: guests.length, scanned, fillRate });

    const guestsEl = card.querySelector('.stat-circle:nth-child(1) .value');
    if (guestsEl && oldStats.guests !== guests.length) {
        animateValue(guestsEl, oldStats.guests, guests.length, 300);
    }

    const scannedEl = card.querySelector('.stat-circle:nth-child(2) .value');
    if (scannedEl && oldStats.scanned !== scanned) {
        animateValue(scannedEl, oldStats.scanned, scanned, 300);
    }

    if (capacity) {
        const progressRing = card.querySelector('.progress-ring');
        const progressText = card.querySelector('.progress-text');
        
        if (progressRing && progressText && oldStats.fillRate !== fillRate) {
            const circumference = 2 * Math.PI * 36;
            const offset = circumference - (fillRate / 100) * circumference;
            progressRing.style.transition = 'stroke-dashoffset 0.5s ease';
            progressRing.style.strokeDashoffset = offset;
            
            const currentValue = parseInt(progressText.textContent) || 0;
            animateValue(progressText, currentValue, fillRate, 400, '%');
        }
    }

    const statusEl = card.querySelector('.event-status i');
    const statusText = card.querySelector('.event-status span');
    if (statusEl && statusText && event) {
        const isActive = event.active !== false;
        statusEl.className = isActive ? 'fas fa-check-circle text-success' : 'fas fa-times-circle text-danger';
        statusText.textContent = isActive ? 'Actif' : 'Inactif';
    }
}

function animateValue(el, start, end, duration, suffix = '') {
    if (start === end) return;
    
    const startTime = performance.now();
    const diff = end - start;

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuad = progress * (2 - progress);
        const current = Math.floor(start + diff * easeOutQuad);
        el.textContent = current + suffix;

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = end + suffix;
        }
    }

    requestAnimationFrame(step);
}

function removeEventCard(eventId) {
    currentEvents = currentEvents.filter(e => e.id !== eventId);
    filteredEvents = filteredEvents.filter(e => e.id !== eventId);
    
    const card = eventCardCache.get(eventId);
    if (!card) return;

    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';

    setTimeout(() => {
        card.remove();
        eventCardCache.delete(eventId);
        eventStatsCache.delete(eventId);

        const grid = document.getElementById('eventsGrid');
        if (grid && grid.children.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus text-6xl mb-4 text-gray-400"></i>
                    <p class="text-lg text-gray-500">Aucun événement trouvé</p>
                    <button class="btn btn-primary" onclick="openEventModal()">
                        <i class="fas fa-plus"></i> Créer votre premier événement
                    </button>
                </div>
            `;
        }
    }, 300);
}

// ═══════════════════════════════════════════════════════════════
// 🎧 EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
function initializeEventListeners() {
    document.getElementById('createEventBtn')?.addEventListener('click', () => openEventModal());
    document.getElementById('searchEvents')?.addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('filterType')?.addEventListener('change', applyFilters);
    document.getElementById('sortEvents')?.addEventListener('change', applyFilters);
    document.getElementById('eventForm')?.addEventListener('submit', handleEventSubmit);
    
    const closeButtons = document.querySelectorAll('.modal-close, .btn-cancel');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeEventModal);
    });
}

// ═══════════════════════════════════════════════════════════════
// 🔍 FILTRES & RECHERCHE
// ═══════════════════════════════════════════════════════════════
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length === 0) {
        filteredEvents = [...currentEvents];
    } else {
        filteredEvents = currentEvents.filter(event =>
            event.name.toLowerCase().includes(query) ||
            (event.location && event.location.toLowerCase().includes(query)) ||
            (event.description && event.description.toLowerCase().includes(query))
        );
    }
    
    applyFilters();
}

async function applyFilters() {
    filteredEvents = getFilteredAndSortedEvents();
    await renderEvents();
}

function getFilteredAndSortedEvents() {
    let filtered = [...currentEvents];
    
    const searchQuery = document.getElementById('searchEvents')?.value.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(event =>
            event.name.toLowerCase().includes(searchQuery) ||
            (event.location && event.location.toLowerCase().includes(searchQuery)) ||
            (event.description && event.description.toLowerCase().includes(searchQuery))
        );
    }

    const filterType = document.getElementById('filterType')?.value;
    if (filterType && filterType !== 'all') {
        filtered = filtered.filter(e => e.type === filterType);
    }

    const sortValue = document.getElementById('sortEvents')?.value || 'date-desc';
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

    return filtered;
}

function passesCurrentFilters(event) {
    const searchQuery = document.getElementById('searchEvents')?.value.toLowerCase().trim();
    if (searchQuery) {
        const matchesSearch = 
            event.name.toLowerCase().includes(searchQuery) ||
            (event.location && event.location.toLowerCase().includes(searchQuery)) ||
            (event.description && event.description.toLowerCase().includes(searchQuery));
        
        if (!matchesSearch) return false;
    }

    const filterType = document.getElementById('filterType')?.value;
    if (filterType && filterType !== 'all' && event.type !== filterType) {
        return false;
    }

    return true;
}

// ═══════════════════════════════════════════════════════════════
// 📝 MODAL & FORMULAIRE
// ═══════════════════════════════════════════════════════════════
function openEventModal(eventId = null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const title = document.getElementById('eventModalTitle');
    
    if (!modal || !form) return;

    form.reset();
    document.getElementById('eventId').value = '';
    document.getElementById('eventActive').checked = true;

  /*  if (eventId) {
        const event = storage.getEventById(eventId);
        if (event) {
            // Remplir les champs de base
            document.getElementById('eventId').value = event.id || '';
            document.getElementById('eventName').value = event.name || '';
            document.getElementById('eventDate').value = event.date || '';
            document.getElementById('eventTime').value = event.time || '';
            document.getElementById('eventLocation').value = event.location || '';
            document.getElementById('eventType').value = event.type || 'autre';
            document.getElementById('eventCapacity').value = event.capacity || '';
            document.getElementById('eventDescription').value = event.description || '';
            document.getElementById('eventWelcomeMessage').value = event.welcomeMessage || '';
            document.getElementById('eventActive').checked = event.active !== false;
            
            // Remplir les nouveaux champs (si disponibles)
            if (event.settings) {
               //document.getElementById('eventAllowRegistration')?.checked = event.settings.allowGuestRegistration !== false;
               // document.getElementById('eventRequireApproval')?.checked = event.settings.requireApproval === true;
               // document.getElementById('eventMaxGuestsPerUser')?.value = event.settings.maxGuestsPerUser || 5;
            }
            
            if (event.design) {
              //  document.getElementById('eventPrimaryColor')?.value = event.design.primaryColor || '#D97706';
              //  document.getElementById('eventTheme')?.value = event.design.theme || 'modern';
            }
            
            if (event.metadata) {
             //   document.getElementById('eventCategory')?.value = event.metadata.category || 'general';
               // document.getElementById('eventTags')?.value = event.metadata.tags?.join(', ') || '';
               // document.getElementById('eventTimezone')?.value = event.metadata.timezone || 'Africa/Douala';
            }
            
            title.innerHTML = '<i class="bi bi-pencil-square"></i> Modifier l\'événement';
        }
    } else {
        // Valeurs par défaut pour un nouvel événement
      //  document.getElementById('eventAllowRegistration')?.checked = true;
       // document.getElementById('eventRequireApproval')?.checked = false;
       // document.getElementById('eventMaxGuestsPerUser')?.value = 5;
       // document.getElementById('eventPrimaryColor')?.value = '#D97706';
       // document.getElementById('eventTheme')?.value = 'modern';
       // document.getElementById('eventCategory')?.value = 'general';
       // document.getElementById('eventTimezone')?.value = 'Africa/Douala';
        
        title.innerHTML = '<i class="fas fa-calendar-plus"></i> Créer un événement';
    }*/

    modal.classList.add('active');
    document.getElementById('eventName')?.focus();
}


function closeEventModal() {
    const modal = document.getElementById('eventModal');
    modal?.classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════
// ✅ VALIDATION ULTRA COMPLÈTE
// ═══════════════════════════════════════════════════════════════
function validateEventForm(formData) {
    const errors = [];

    // Validation du nom
    if (!formData.name || formData.name.trim().length < 3) {
        errors.push('Le nom de l\'événement doit contenir au moins 3 caractères.');
    }
    if (formData.name && formData.name.length > 100) {
        errors.push('Le nom de l\'événement ne peut pas dépasser 100 caractères.');
    }

    // Validation de la date
    if (!formData.date) {
        errors.push('La date de l\'événement est obligatoire.');
    } else {
        const eventDate = new Date(formData.date);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        if (eventDate < now) {
            if (!formData.id) { 
                errors.push('La date de l\'événement ne peut pas être dans le passé.');
            }
        }
    }

    // Validation de l'heure
    if (formData.time) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(formData.time)) {
            errors.push('L\'heure doit être au format HH:MM (ex: 14:30).');
        }
    }

    if (!formData.location || formData.location.trim().length < 3) {
        errors.push('Le lieu de l\'événement doit contenir au moins 3 caractères.');
    }
    if (formData.location && formData.location.length > 200) {
        errors.push('Le lieu ne peut pas dépasser 200 caractères.');
    }

    // Validation du type
    if (!formData.type || !['marriage', 'anniversaire', 'conference', 'corporate', 'concert', 'gala', 'football', 'autre'].includes(formData.type)) {
        errors.push('Veuillez sélectionner un type d\'événement valide.');
    }

    // Validation de la capacité
    if (formData.capacity) {
        const capacity = parseInt(formData.capacity);
        if (isNaN(capacity) || capacity < 1) {
            errors.push('La capacité doit être un nombre positif.');
        } else if (capacity > 100000) {
            errors.push('La capacité ne peut pas dépasser 100 000 personnes.');
        }
    }

    // Validation de la description
    if (formData.description && formData.description.length > 1000) {
        errors.push('La description ne peut pas dépasser 1000 caractères.');
    }

    // Validation du message de bienvenue
    if (formData.welcomeMessage && formData.welcomeMessage.length > 500) {
        errors.push('Le message de bienvenue ne peut pas dépasser 500 caractères.');
    }

    // Validation des paramètres (si fournis)
    if (formData.settings) {
        if (formData.settings.maxGuestsPerUser && (formData.settings.maxGuestsPerUser < 1 || formData.settings.maxGuestsPerUser > 50)) {
            errors.push('Le nombre maximum d\'invités par utilisateur doit être entre 1 et 50.');
        }
    }

    // Validation du design (si fourni)
    if (formData.design) {
        if (formData.design.primaryColor && !/^#[0-9A-F]{6}$/i.test(formData.design.primaryColor)) {
            errors.push('La couleur principale doit être au format hexadécimal (ex: #D97706).');
        }
    }

    return errors;
}


async function checkEventUniqueness(name, date, currentEventId = null) {
    const existing = storage.data.events.find(e => 
        e.id !== currentEventId &&
        e.name.toLowerCase() === name.toLowerCase() &&
        e.date === date
    );
    
    return !existing;
}

// ═══════════════════════════════════════════════════════════════
// 📝 SOUMISSION AVEC SWEETALERT2
// ═══════════════════════════════════════════════════════════════
async function handleEventSubmit(e) {
    e.preventDefault();

    const eventId = (document.getElementById('eventId')?.value || '').trim();
    const name = (document.getElementById('eventName')?.value || '').trim();
    const type = (document.getElementById('eventType')?.value || 'autre').trim();
    const date = (document.getElementById('eventDate')?.value || '').trim();
    const time = (document.getElementById('eventTime')?.value || '').trim();
    const capacityRaw = (document.getElementById('eventCapacity')?.value || '').trim();
    const capacity = capacityRaw === '' ? null : parseInt(capacityRaw, 10);
    const location = (document.getElementById('eventLocation')?.value || '').trim();
    const description = (document.getElementById('eventDescription')?.value || '').trim();
    const welcomeMessage = (document.getElementById('eventWelcomeMessage')?.value || '').trim();
    const active = !!document.getElementById('eventActive')?.checked;

    // Récupérer les nouveaux champs
    const allowRegistration = document.getElementById('eventAllowRegistration')?.checked !== false;
    const requireApproval = document.getElementById('eventRequireApproval')?.checked === true;
    const maxGuestsPerUser = parseInt(document.getElementById('eventMaxGuestsPerUser')?.value) || 5;
    const primaryColor = (document.getElementById('eventPrimaryColor')?.value || '#D97706').trim();
    const theme = (document.getElementById('eventTheme')?.value || 'modern').trim();
    const category = (document.getElementById('eventCategory')?.value || 'general').trim();
    const tags = (document.getElementById('eventTags')?.value || '').split(',').map(tag => tag.trim()).filter(tag => tag);
    const timezone = (document.getElementById('eventTimezone')?.value || 'Africa/Douala').trim();

    const eventData = {
        name,
        type,
        date,
        time: time || '',
        capacity,
        location,
        description,
        welcomeMessage,
        active,
        organizerId: storage.user?.id,
        settings: {
            allowGuestRegistration: allowRegistration,
            requireApproval,
            maxGuestsPerUser,
            allowQRSharing: true,
            autoGenerateQRCodes: false,
            enablePhotoGallery: false,
            enableGuestMessages: false,
            enableTableQR: false
        },
        
        design: {
            primaryColor,
            secondaryColor: '#3B82F6',
            backgroundImage: null,
            logo: null,
            theme
        },
        
        metadata: {
            tags,
            category,
            visibility: 'private',
            timezone,
            createdBy: storage.user?.id || null,
            createdBy: storage.user?.id
        }
    };

    // Validation
    const validationErrors = validateEventForm(eventData);
    if (validationErrors.length > 0) {
        await Swal.fire({
            icon: 'error',
            title: 'Erreurs de validation',
            html: '<ul style="text-align: left;">' + validationErrors.map(err => `<li>${err}</li>`).join('') + '</ul>',
            confirmButtonColor: '#D97706'
        });
        return;
    }

    // Vérifier l'unicité (seulement pour les nouveaux événements)
    if (!eventId) {
        const isUnique = await checkEventUniqueness(eventData.name, eventData.date);
        if (!isUnique) {
            await Swal.fire({
                icon: 'error',
                title: 'Événement existant',
                html: `Un événement avec le nom <strong>"${eventData.name}"</strong> existe déjà à cette date.<br>Veuillez choisir un autre nom ou une autre date.`,
                confirmButtonColor: '#D97706'
            });
            return;
        }
    }

    const action = eventId ? 'mise à jour' : 'création';
    const result = await Swal.fire({
        title: `Confirmer ${action}`,
        html: `
            <div style="text-align: left;">
                <p><strong>Nom :</strong> ${escapeHtml(eventData.name)}</p>
                <p><strong>Date :</strong> ${eventData.date ? new Date(eventData.date).toLocaleDateString('fr-FR') : '-'}</p>
                ${eventData.time ? `<p><strong>Heure :</strong> ${escapeHtml(eventData.time)}</p>` : ''}
                <p><strong>Lieu :</strong> ${escapeHtml(eventData.location || '-')}</p>
                ${eventData.capacity ? `<p><strong>Capacité :</strong> ${eventData.capacity} personnes</p>` : ''}
                ${eventData.type ? `<p><strong>Type :</strong> ${escapeHtml(eventData.type)}</p>` : ''}
                <p><strong>Catégorie :</strong> ${escapeHtml(eventData.metadata.category)}</p>
            </div>
            <hr>
            <p>Voulez-vous vraiment ${eventId ? 'modifier' : 'créer'} cet événement ?</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `<i class="fas ${eventId ? 'fa-save' : 'fa-plus'}"></i> ${eventId ? 'Enregistrer' : 'Créer'}`,
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#D97706',
        cancelButtonColor: '#6c757d',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: eventId ? 'Mise à jour...' : 'Création...',
        text: 'Enregistrement de l\'événement',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        let savedEvent;
        if (eventId) {
            savedEvent = await storage.updateEvent(eventId, eventData);
        } else {
            savedEvent = await storage.createEvent(eventData);
            savedEvent.__justCreated = true;
        }

        if (!savedEvent || savedEvent.error) {
            throw new Error(savedEvent?.message || 'Échec de l\'opération');
        }

        closeEventModal();
        Swal.close();

        await Swal.fire({
            icon: 'success',
            title: eventId ? 'Événement mis à jour !' : 'Événement créé !',
            html: `<strong>"${escapeHtml(savedEvent.name)}"</strong> a été ${eventId ? 'mis à jour' : 'créé'} avec succès.`,
            timer: 2500,
            timerProgressBar: true,
            showConfirmButton: false
        });

    } catch (err) {
        console.error('Erreur soumission événement:', err);
        Swal.close();
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: err.message || 'Une erreur est survenue lors de l\'enregistrement.',
            confirmButtonColor: '#D97706'
        });
    }
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}



// ═══════════════════════════════════════════════════════════════
// ⚡ ACTIONS AVEC SWEETALERT2
// ═══════════════════════════════════════════════════════════════
async function duplicateEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        await showError('Événement introuvable');
        return;
    }

    const guests = storage.getGuestsByEventId(eventId);

    const result = await Swal.fire({
        title: 'Dupliquer l\'événement',
        html: `
            <div style="text-align: left;">
                <p>Vous allez dupliquer :</p>
                <p><strong>"${event.name}"</strong></p>
                ${guests.length > 0 ? `<p class="text-info"><i class="fas fa-users"></i> ${guests.length} invité(s) seront également dupliqués</p>` : '<p class="text-muted">Aucun invité à dupliquer</p>'}
            </div>
            <hr>
            <p>Une copie sera créée avec tous les détails de l'événement.</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-copy"></i> Dupliquer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#D97706',
        cancelButtonColor: '#6c757d',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Duplication en cours...',
        html: `
            <div class="progress-container">
                <p>Création de l'événement...</p>
                <div class="spinner"></div>
            </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const newEvent = { ...event };
        delete newEvent.id;
        delete newEvent.createdAt;
        delete newEvent.updatedAt;
        newEvent.name += ' (Copie)';
        
        const saved = await storage.createEvent(newEvent);
        
        if (!saved?.id) {
            throw new Error('Échec création événement');
        }

        if (guests.length > 0) {
            Swal.update({
                html: `
                    <div class="progress-container">
                        <p>Duplication des invités...</p>
                        <p class="text-sm text-gray-500">0 / ${guests.length}</p>
                        <div class="spinner"></div>
                    </div>
                `
            });

            for (let i = 0; i < guests.length; i++) {
                const g = guests[i];
                const ng = { ...g };
                delete ng.id;
                delete ng.createdAt;
                delete ng.updatedAt;
                ng.eventId = saved.id;
                ng.scanned = false;
                ng.scannedAt = null;
                
                await storage.createGuest(ng);

                Swal.update({
                    html: `
                        <div class="progress-container">
                            <p>Duplication des invités...</p>
                            <p class="text-sm text-gray-500">${i + 1} / ${guests.length}</p>
                            <div class="spinner"></div>
                        </div>
                    `
                });
            }
        }

        await Swal.fire({
            icon: 'success',
            title: 'Duplication réussie !',
            html: `
                <p>L'événement <strong>"${saved.name}"</strong> a été créé.</p>
                ${guests.length > 0 ? `<p class="text-success"><i class="fas fa-check-circle"></i> ${guests.length} invité(s) dupliqués</p>` : ''}
            `,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
        });

    } catch (err) {
        console.error('Erreur duplication:', err);
        await showError('Échec de la duplication : ' + err.message);
    }
}

async function exportEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        await showError('Événement introuvable');
        return;
    }

    const guests = storage.getGuestsByEventId(eventId);

    if (guests.length === 0) {
        await Swal.fire({
            icon: 'warning',
            title: 'Aucun invité',
            html: `L'événement <strong>"${event.name}"</strong> ne contient aucun invité à exporter.`,
            confirmButtonColor: '#D97706'
        });
        return;
    }

    const result = await Swal.fire({
        title: 'Exporter en CSV',
        html: `
            <div style="text-align: left;">
                <p>Événement : <strong>"${event.name}"</strong></p>
                <p><i class="fas fa-users"></i> ${guests.length} invité(s) seront exportés</p>
            </div>
            <hr>
            <p>Le fichier CSV contiendra toutes les informations des invités.</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-download"></i> Exporter',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#D97706',
        cancelButtonColor: '#6c757d',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Export en cours...',
        text: 'Génération du fichier CSV',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        await new Promise(r => setTimeout(r, 500));

        const csv = storage.exportToCSV(eventId);
        const filename = `${event.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        await Swal.fire({
            icon: 'success',
            title: 'Export réussi !',
            html: `
                <p>Le fichier <strong>"${filename}"</strong> a été téléchargé.</p>
                <p class="text-success"><i class="fas fa-check-circle"></i> ${guests.length} invité(s) exportés</p>
            `,
            timer: 3000,
            timerProgressBar: true,
            confirmButtonColor: '#D97706'
        });

    } catch (err) {
        console.error('Erreur export:', err);
        await showError('Échec de l\'export : ' + err.message);
    }
}

async function deleteEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        await showError('Événement introuvable');
        return;
    }

    const guests = storage.getGuestsByEventId(eventId);
    const scans = storage.data.scans.filter(s => s.eventId === eventId);

    const result = await Swal.fire({
        title: 'Supprimer l\'événement ?',
        html: `
            <div style="text-align: left;">
                <p>Vous êtes sur le point de supprimer :</p>
                <p><strong>"${event.name}"</strong></p>
                <hr>
                ${guests.length > 0 ? `<p class="text-warning"><i class="fas fa-exclamation-triangle"></i> ${guests.length} invité(s) seront supprimés</p>` : ''}
                ${scans.length > 0 ? `<p class="text-warning"><i class="fas fa-exclamation-triangle"></i> ${scans.length} scan(s) seront supprimés</p>` : ''}
                <p class="text-danger"><strong>Cette action est irréversible.</strong></p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-trash3"></i> Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6c757d',
        reverseButtons: true,
        input: 'checkbox',
        inputPlaceholder: 'Je comprends que cette action est irréversible',
        inputBackground: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
        inputValidator: (result) => {
            return !result && 'Vous devez confirmer la suppression';
        }
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Suppression...',
        html: `
            <div class="progress-container">
                <p>Suppression de l'événement et des données associées...</p>
                <div class="spinner"></div>
            </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        await new Promise(r => setTimeout(r, 500));
        
        const success = await storage.deleteEvent(eventId);
        
        if (!success) {
            throw new Error('Échec de la suppression');
        }

        await Swal.fire({
            icon: 'success',
            title: 'Événement supprimé !',
            html: `
                <p><strong>"${event.name}"</strong> a été supprimé avec succès.</p>
                ${guests.length > 0 ? `<p class="text-muted">${guests.length} invité(s) supprimés</p>` : ''}
            `,
            timer: 2500,
            timerProgressBar: true,
            showConfirmButton: false
        });

    } catch (err) {
        console.error('Erreur suppression:', err);
        await showError('Échec de la suppression : ' + err.message);
    }
}

async function viewEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        showError('Événement introuvable');
        return;
    }
    
    
    window.location.href = `guests?event=${eventId}`;
}

function editEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        showError('Événement introuvable');
        return;
    }
    window.location.href = `event?id=${eventId}`;
            
}

async function showError(message) {
    await Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: message,
        confirmButtonColor: '#D97706'
    });
}

// ═══════════════════════════════════════════════════════════════
// 🌐 GESTION MODAL (Clic extérieur / Escape)
// ═══════════════════════════════════════════════════════════════
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeEventModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('eventModal');
        if (modal && modal.classList.contains('active')) {
            closeEventModal();
        }
    }
});

// ═══════════════════════════════════════════════════════════════
// 🔧 UTILITAIRES
// ═══════════════════════════════════════════════════════════════
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ═══════════════════════════════════════════════════════════════
// 🌐 EXPORTS GLOBAUX
// ═══════════════════════════════════════════════════════════════
window.openEventModal = openEventModal;
window.closeEventModal = closeEventModal;
window.viewEvent = viewEvent;
window.editEvent = editEvent;
window.duplicateEvent = duplicateEvent;
window.exportEvent = exportEvent;
window.deleteEvent = deleteEvent;

console.log('✅ SECURA Events Management V5.0 chargé - Mode Observable actif !');