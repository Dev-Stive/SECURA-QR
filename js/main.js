/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║              🛡️  SECURA - MAIN SCRIPTS V5.0  🛡️              ║
 * ║                                                               ║
 * ║  🔐 Auth Guard automatique                                    ║
 * ║  🎯 Mise à jour granulaire (pas de rerender complet)         ║
 * ║  📊 Statistiques réactives                                    ║
 * ║  🎨 Animations fluides                                        ║
 * ║  🔔 SweetAlert2 partout                                       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */



window.addEventListener('secura:access-granted', () => {
    console.log('%c✅ SECURA Loading System: Access Granted', 'color: #10B981; font-weight: bold; font-size: 14px');
});
window.addEventListener('secura:access-denied', () => {
    console.log('%c❌ SECURA Loading System: Access Denied - Redirecting', 'color: #EF4444; font-weight: bold; font-size: 14px');
});

// ═══════════════════════════════════════════════════════════════
// 🔐 GESTION DE LA VISIBILITÉ EN MODE GUEST/AUTHENTIFIÉ
// ═══════════════════════════════════════════════════════════════
function updateAuthUIVisibility() {
    const isLoggedIn = window.storage && window.storage.isLoggedIn();
    
    console.log(`🔐 Auth Status: ${isLoggedIn ? 'Connecté' : 'Mode Invité'}`);
    
    // Afficher/masquer le dropdown d'authentification
    const headerGuestActions = document.getElementById('headerGuestActions');
    const profileToggle = document.getElementById('profileToggle');
    
    if (headerGuestActions) {
        headerGuestActions.style.display = isLoggedIn ? 'none' : 'flex';
    }
    
    if (profileToggle) {
        profileToggle.style.display = isLoggedIn ? 'flex' : 'none';
    }
    
    // Afficher/masquer les sections de contenu
    const statsSection = document.getElementById('stats-section');
    const chartsSection = document.getElementById('charts-section');
    const recentEventsSection = document.getElementById('recentEventsSection');
    
    if (statsSection) {
        statsSection.style.display = isLoggedIn ? 'block' : 'none';
    }
    
    if (chartsSection) {
        chartsSection.style.display = isLoggedIn ? 'block' : 'none';
    }
    
    if (recentEventsSection) {
        recentEventsSection.style.display = isLoggedIn ? 'block' : 'none';
    }
    
    // Masquer la sidebar et son toggle si non connecté
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    if (!isLoggedIn) {
        if (sidebar) {
            sidebar.style.display = 'none';
        }
        if (sidebarToggle) {
            sidebarToggle.style.display = 'none';
        }
    }
}

function applyGlowEffects() {
    setTimeout(() => {
        const sections = [
           '.header',
            '.stats-section',
            '.charts-section',
            '.recent-events'
        ];
        
        sections.forEach((selector, index) => {
            const element = document.querySelector(selector);
            if (element) {
                setTimeout(() => {
                    element.style.transition = 'all 0.8s ease';
                    element.style.boxShadow = '0 0 30px rgba(217, 119, 6, 0.3)';
                    
                    setTimeout(() => {
                        element.style.boxShadow = 'none';
                    }, 1000);
                }, index * 300);
            }
        });
        
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card, i) => {
            setTimeout(() => {
                card.classList.add('glow-animation');
                
                setTimeout(() => {
                    card.classList.remove('glow-animation');
                }, 800);
            }, i * 150);
        });
    }, 500);
}

// ═══════════════════════════════════════════════════════════════
// 📋 INITIALISATION PRINCIPALE (Unchanged, mais optimisée)
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

    // 🔐 Vérifier l'état d'authentification et afficher les éléments appropriés
    updateAuthUIVisibility();

    //applyGlowEffects();

    // 1️⃣ Attendre que storage soit prêt
    if (!window.storageReady) {
        console.warn('⚠️ Storage non prêt, attendre...');
        await new Promise(resolve => {
            const checkStorage = setInterval(() => {
                if (window.storage) {
                    clearInterval(checkStorage);
                    resolve();
                }
            }, 50);
        });
    }

    // 2️⃣ Initialiser composants
    try {
      //  initializeNavigation();
        initializeScrollTop();
        initializeFullscreen();
        initializeLogout();
        setupGranularListeners();
        
        updateStatsGranular();
        loadRecentEventsGranular();

        console.log('✅ Application initialisée avec succès');
    } catch (err) {
        console.error('❌ Erreur initialisation:', err);
    }


        await window.storageReady;

    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (typeof Swal !== 'undefined') {
                const result = await Swal.fire({
                    title: 'Confirmer la déconnexion',
                    text: 'Vous serez redirigé vers la page de connexion.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Oui, me déconnecter',
                    cancelButtonText: 'Annuler',
                    confirmButtonColor: '#D97706',
                    cancelButtonColor: '#6c757d',
                    reverseButtons: true
                });

                if (result.isConfirmed) {
                    // Afficher le chargement
                    Swal.fire({
                        title: 'Déconnexion...',
                        text: 'Nettoyage des données',
                        icon: 'info',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        showConfirmButton: false,
                        timer: 1500,
                        timerProgressBar: true,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });

                    setTimeout(async () => {
                        const success = await storage.logout();
                        
                        setTimeout(() => {
                            window.location.href = '/login.html';
                        }, 500);
                    }, 500);
                }
            } else {
                console.warn('⚠️ SweetAlert2 non disponible, déconnexion directe');
                const success = await storage.logout();
                window.location.href = '/login.html';
            }
        });
    }

    storage.on('auth:logout', (event) => {
        console.log('✅ Utilisateur déconnecté:', event.detail);
       
    });
});





// ═══════════════════════════════════════════════════════════════
// 🎯 LISTENERS GRANULAIRES (Pas de rerender complet)
// ═══════════════════════════════════════════════════════════════
function setupGranularListeners() {
    

    storage.on('data:synced', (event) => {
        updateStatsValues(storage.getStatistics());
    });
    // Écoute création d'événements
    storage.on('event:created', (event) => {
        prependEventCard(event.detail);
        updateStatsValues(storage.getStatistics());
    });

    // Écoute mise à jour d'événements
    storage.on('event:updated', (data) => {
        updateEventCardValues(data.detail.new);
        updateStatsValues(storage.getStatistics());
    });

    // Écoute suppression d'événements
    storage.on('event:deleted', (event) => {
        removeEventCardById(event.detail.id);
        updateStatsValues(storage.getStatistics());
    });

    // Écoute invités
    storage.on('guest:created', () => {
        updateStatsValues(storage.getStatistics());
    });

    storage.on('guest:updated', () => {
        updateStatsValues(storage.getStatistics());
    });

    storage.on('guest:deleted', () => {
        updateStatsValues(storage.getStatistics());
    });

    // Écoute scans
    storage.on('scan:created', () => {
        updateStatsValues(storage.getStatistics());
    });
}

// ═══════════════════════════════════════════════════════════════
// 📊 MISE À JOUR GRANULAIRE DES STATS (Valeurs uniquement)
// ═══════════════════════════════════════════════════════════════
function updateStatsGranular() {
    const stats = storage.getStatistics();
   
    updateStatsValues(stats);
}

function updateStatsValues(stats) {
    const elements = {
        totalEvents: document.getElementById('totalEvents'),
        totalGuests: document.getElementById('totalGuests'),
        totalQrCodes: document.getElementById('totalQrCodes'),
        scannedQrCodes: document.getElementById('scannedQrCodes')
    };

    if (elements.totalEvents) {
        animateNumber(elements.totalEvents, parseInt(elements.totalEvents.textContent) || 0, stats.totalEvents);
    }
    if (elements.totalGuests) {
        animateNumber(elements.totalGuests, parseInt(elements.totalGuests.textContent) || 0, stats.totalGuests);
    }
    if (elements.totalQrCodes) {
        animateNumber(elements.totalQrCodes, parseInt(elements.totalQrCodes.textContent) || 0, stats.totalQRCodes);
    }
    if (elements.scannedQrCodes) {
        animateNumber(elements.scannedQrCodes, parseInt(elements.scannedQrCodes.textContent) || 0, stats.scannedGuests);
    }
}

function animateNumber(element, start, target, duration = 800) {
    if (start === target) return;
    
    const startTime = performance.now();
    const diff = target - start;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuad = progress * (2 - progress);
        const current = Math.floor(start + diff * easeOutQuad);
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}

// ═══════════════════════════════════════════════════════════════
// 🎴 GESTION GRANULAIRE DES CARTES D'ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════
async function loadRecentEventsGranular() {
    const recentEventsGrid = document.getElementById('recentEventsGrid');
    if (!recentEventsGrid) return;

    const events = storage.data.events;
    const recentEvents = events.slice(-4).reverse();

    if (recentEvents.length === 0) {
        recentEventsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-plus text-6xl mb-4 text-gray-400"></i>
                <p class="text-lg text-gray-500">Aucun événement créé</p>
                <button class="btn btn-primary mt-4" onclick="window.location.href='events-list.html'">
                    <i class="fas fa-plus"></i> Créer votre premier événement
                </button>
            </div>
        `;
        return;
    }

    recentEventsGrid.innerHTML = '';
    recentEvents.forEach(event => {
        const card = createEventCardElement(event);
        recentEventsGrid.appendChild(card);
    });
}

function prependEventCard(event) {
    const recentEventsGrid = document.getElementById('recentEventsGrid');
    if (!recentEventsGrid) return;

    const emptyState = recentEventsGrid.querySelector('.empty-state');
    if (emptyState) {
        recentEventsGrid.innerHTML = '';
    }

    const card = createEventCardElement(event);
    card.style.opacity = '0';
    card.style.transform = 'translateY(-20px)';
    
    recentEventsGrid.insertBefore(card, recentEventsGrid.firstChild);

    requestAnimationFrame(() => {
        card.style.transition = 'all 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    });

    const allCards = recentEventsGrid.querySelectorAll('.event-card-pro');
    if (allCards.length > 3) {
        const lastCard = allCards[allCards.length - 1];
        lastCard.style.transition = 'all 0.3s ease';
        lastCard.style.opacity = '0';
        lastCard.style.transform = 'scale(0.95)';
        setTimeout(() => lastCard.remove(), 300);
    }
}

function updateEventCardValues(event) {
    const card = document.querySelector(`[data-event-id="${event.id}"]`);
    if (!card) return;

    const guests = storage.getGuestsByEventId(event.id);
    const scannedGuests = guests.filter(g => g.scanned).length;
    const fillRate = event.capacity ? Math.round((guests.length / event.capacity) * 100) : 0;

    const guestsValue = card.querySelector('.stat-circle:nth-child(1) .value');
    const scannedValue = card.querySelector('.stat-circle:nth-child(2) .value');
    const progressRing = card.querySelector('.progress-ring');
    const progressText = card.querySelector('.progress-text');

    if (guestsValue) {
        animateNumber(guestsValue, parseInt(guestsValue.textContent) || 0, guests.length, 300);
    }

    if (scannedValue) {
        animateNumber(scannedValue, parseInt(scannedValue.textContent) || 0, scannedGuests, 300);
    }

    if (progressRing && progressText && event.capacity) {
        const circumference = 2 * Math.PI * 36;
        const offset = circumference - (fillRate / 100) * circumference;
        progressRing.style.transition = 'stroke-dashoffset 0.5s ease';
        progressRing.style.strokeDashoffset = offset;
        animateNumber(progressText, parseInt(progressText.textContent) || 0, fillRate, 400);
    }

    const titleEl = card.querySelector('.event-title');
    if (titleEl && titleEl.textContent !== event.name) {
        titleEl.style.transition = 'opacity 0.2s';
        titleEl.style.opacity = '0';
        setTimeout(() => {
            titleEl.textContent = event.name;
            titleEl.style.opacity = '1';
        }, 200);
    }
}

function removeEventCardById(eventId) {
    const card = document.querySelector(`[data-event-id="${eventId}"]`);
    if (!card) return;

    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';

    setTimeout(() => {
        card.remove();
        
        const recentEventsGrid = document.getElementById('recentEventsGrid');
        if (recentEventsGrid && recentEventsGrid.children.length === 0) {
            recentEventsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus text-6xl mb-4 text-gray-400"></i>
                    <p class="text-lg text-gray-500">Aucun événement créé</p>
                    <button class="btn btn-primary mt-4" onclick="window.location.href='events-list.html'">
                        <i class="fas fa-plus"></i> Créer votre premier événement
                    </button>
                </div>
            `;
        }
    }, 300);
}

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
                    <div class="stat-value">${stats.totalGuests}</div>
                    <div class="stat-label">Invités total</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-value">${stats.scannedGuests}</div>
                    <div class="stat-label">Présents</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-value">${stats.pendingGuests}</div>
                    <div class="stat-label">En attente</div>
                </div>
                <div class="stat-card info">
                    <div class="stat-value">${stats.scanRate}%</div>
                    <div class="stat-label">Taux scan</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.totalScans}</div>
                    <div class="stat-label">Scans total</div>
                </div>
                ${event.capacity ? `
                <div class="stat-card">
                    <div class="stat-value">${Math.round((stats.totalGuests / event.capacity) * 100)}%</div>
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
// ⚡ ACTIONS AVEC SWEETALERT2
// ═══════════════════════════════════════════════════════════════
async function exportEventFromMain(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        await showError('Événement introuvable');
        return;
    }

    const result = await Swal.fire({
        title: 'Exporter en CSV',
        html: `Voulez-vous exporter les invités de <strong>"${event.name}"</strong> ?`,
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
        downloadFile(csv, filename, 'text/csv');
        
        await Swal.fire({
            icon: 'success',
            title: 'Export réussi !',
            text: `Le fichier "${filename}" a été téléchargé.`,
            timer: 3000,
            timerProgressBar: true,
            confirmButtonColor: '#D97706'
        });
    } catch (err) {
        await showError('Échec de l\'export : ' + err.message);
    }
}

async function deleteEventFromMain(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        await showError('Événement introuvable');
        return;
    }

    const guestCount = storage.getGuestsByEventId(eventId).length;
    
    const result = await Swal.fire({
        title: 'Supprimer l\'événement ?',
        html: `
            <p>Vous êtes sur le point de supprimer <strong>"${event.name}"</strong>.</p>
            ${guestCount > 0 ? `<p class="text-warning"><i class="fas fa-exclamation-triangle"></i> ${guestCount} invité(s) seront également supprimés.</p>` : ''}
            <p class="text-danger">Cette action est irréversible.</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-trash3"></i> Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6c757d',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Suppression...',
        text: 'Suppression de l\'événement et des données associées',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const success = await storage.deleteEvent(eventId);
        
        if (success) {
            await Swal.fire({
                icon: 'success',
                title: 'Événement supprimé !',
                text: 'L\'événement a été supprimé avec succès.',
                timer: 2000,
                timerProgressBar: true,
                confirmButtonColor: '#D97706'
            });
        } else {
            throw new Error('Échec de la suppression');
        }
    } catch (err) {
        await showError('Échec de la suppression : ' + err.message);
    }
}


function editEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        showError('Événement introuvable');
        return;
    }
    window.location.href = `event?id=${eventId}`;
            
}



async function duplicateEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        await showError('Événement introuvable');
        return;
    }

    const result = await Swal.fire({
        title: 'Dupliquer l\'événement',
        html: `Voulez-vous dupliquer <strong>"${event.name}"</strong> avec tous ses invités ?`,
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
        title: 'Duplication...',
        text: 'Création de la copie de l\'événement',
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
        newEvent.name += ' (Copie)';
        const saved = await storage.createEvent(newEvent);
        
        if (!saved?.id) throw new Error('Échec création événement');

        const guests = storage.getGuestsByEventId(eventId);
        for (const g of guests) {
            const ng = { ...g };
            delete ng.id;
            ng.eventId = saved.id;
            ng.scanned = false;
            await storage.createGuest(ng);
        }

        await Swal.fire({
            icon: 'success',
            title: 'Événement dupliqué !',
            html: `L'événement <strong>"${saved.name}"</strong> a été créé avec ${guests.length} invité(s).`,
            timer: 3000,
            timerProgressBar: true,
            confirmButtonColor: '#D97706'
        });
    } catch (err) {
        await showError('Échec de la duplication : ' + err.message);
    }
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
// 🧭 NAVIGATION
// ═══════════════════════════════════════════════════════════════
function initializeNavigation() {
    // The markup uses `sidebarToggle` in HTML across the app — support it and any alternate id
    const mobileMenuToggle = document.getElementById('mobileMenuToggle') || document.getElementById('sidebarToggle');
    const navMenu = document.getElementById('navMenu');

    if (navMenu) {
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        navMenu.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// ⬆️ SCROLL TO TOP
// ═══════════════════════════════════════════════════════════════
function initializeScrollTop() {
    const scrollTopBtn = document.getElementById('scrollTop');
    
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });

        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// 🖥️ FULLSCREEN
// ═══════════════════════════════════════════════════════════════
function initializeFullscreen() {
    // Support multiple fullscreen toggles (header + sidebar)
    const fullscreenToggles = document.querySelectorAll('.fullscreen-toggle');
    if (fullscreenToggles && fullscreenToggles.length) {
        fullscreenToggles.forEach(btn => btn.addEventListener('click', toggleFullscreen));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
            }
        });

        document.addEventListener('fullscreenchange', updateFullscreenIcon);
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Erreur plein écran:', err);
            showNotification('error', 'Impossible d\'activer le mode plein écran');
        });
    } else {
        document.exitFullscreen();
    }
}

function updateFullscreenIcon() {
    // Update icon on all toggles
    const fullscreenToggles = document.querySelectorAll('.fullscreen-toggle');
    fullscreenToggles.forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) icon.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
    });
}

// ═══════════════════════════════════════════════════════════════
// 🚪 LOGOUT
// ═══════════════════════════════════════════════════════════════
function initializeLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            storage.logout();
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// 🔔 NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function showNotification(type, message) {
    const icons = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const titles = {
        success: 'Succès',
        error: 'Erreur',
        warning: 'Attention',
        info: 'Information'
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: icons[type] || 'info',
            title: titles[type] || 'Notification',
            text: message,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            customClass: {
                popup: 'animate-slide-in-right'
            }
        });
    } else {
        alert(message);
    }
}

function confirmDialog(title, text, confirmText = 'Confirmer', cancelText = 'Annuler') {
    return new Promise((resolve) => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                html: text,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D97706',
                cancelButtonColor: '#706f6c',
                confirmButtonText: confirmText,
                cancelButtonText: cancelText,
                customClass: {
                    popup: 'animate-zoom-in'
                }
            }).then((result) => {
                resolve(result.isConfirmed);
            });
        } else {
            resolve(confirm(text));
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// 📥 UTILITAIRES
// ═══════════════════════════════════════════════════════════════
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatDate(dateString, includeTime = false) {
    const date = new Date(dateString);
    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };

    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }

    return date.toLocaleDateString('fr-FR', options);
}

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

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 9;
}

// ═══════════════════════════════════════════════════════════════
// 🛣️ GESTION DES ROUTES (404)
// ═══════════════════════════════════════════════════════════════
function isValidRoute() {
    const currentPath = window.location.pathname;

    const validRoutes = [
        '/',
        '/index',
        '/index.html',
        '/events',
        '/events.html',
        '/guests',
        '/guests.html',
        '/qr-generator',
        '/qr-generator.html',
        '/scanner',
        '/scanner.html',
        '/events-list',
        '/events-list.html',
        '/login',
        '/login.html',
        '/register',
        '/register.html',
        '/ticket-generator',
        '/ticket-generator.html'
    ];

    const cleanPath = currentPath.replace(/\/$/, '') || '/';

    if (validRoutes.includes(cleanPath)) {
        return true;
    }

    if (
        cleanPath.startsWith('/css/') ||
        cleanPath.startsWith('/js/') ||
        cleanPath.startsWith('/assets/') ||
        cleanPath.startsWith('/api/') ||
        cleanPath.startsWith('/db/') ||
        cleanPath.endsWith('.json') ||
        cleanPath.endsWith('.css') ||
        cleanPath.endsWith('.js') ||
        cleanPath.endsWith('.png') ||
        cleanPath.endsWith('.jpg') ||
        cleanPath.endsWith('.svg') ||
        cleanPath.includes('.')
    ) {
        return true;
    }

    return false;
}

function load404Page() {
    fetch('/404.html')
        .then(response => {
            if (!response.ok) throw new Error('404 page not found');
            return response.text();
        })
        .then(html => {
            document.open();
            document.write(html);
            document.close();
            initialize404Scripts();
        })
        .catch(err => {
            console.error('Erreur chargement 404:', err);
            document.body.innerHTML = `
                <div style="text-align:center; padding:50px; font-family:sans-serif;">
                    <h1>404 - Page non trouvée</h1>
                    <p><a href="/">Retour à l'accueil</a></p>
                </div>
            `;
        });
}

function initialize404Scripts() {
    const script = document.createElement('script');
    script.innerHTML = `
        const particlesContainer = document.getElementById('particles');
        if (particlesContainer) {
            const particleCount = 20;
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.classList.add('particle');
                const size = Math.random() * 60 + 20;
                particle.style.width = size + 'px';
                particle.style.height = size + 'px';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (Math.random() * 8 + 4) + 's';
                particlesContainer.appendChild(particle);
            }
        }
    `;
    document.body.appendChild(script);
}


    let _securaLoadingOpen = false;

    /**
     * Ouvre un modal de chargement SweetAlert2 non-bloquant.
     * options: { title, text, allowOutsideClick, allowEscapeKey }
     */
    function showLoading(options = {}) {
        if (_securaLoadingOpen) return;
        const {
            title = 'Chargement...',
            text = '',
            allowOutsideClick = false,
            allowEscapeKey = false
        } = options;

        Swal.fire({
            title,
            text,
            allowOutsideClick,
            allowEscapeKey,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        _securaLoadingOpen = true;
    }

    /**
     * Ferme le modal de chargement si ouvert.
     */
    function hideLoading() {
        if (!_securaLoadingOpen) return;
        Swal.close();
        _securaLoadingOpen = false;
    }

    /**
     * Affiche le loader pendant l'exécution d'une Promise.
     * await showLoadingFor(myPromise, { title, text })
     */
    async function showLoadingFor(promiseOrFn, options = {}) {
        showLoading(options);
        try {
            // accepter soit une Promise, soit une fonction retournant une Promise
            const result = typeof promiseOrFn === 'function' ? await promiseOrFn() : await promiseOrFn;
            return result;
        } finally {
            hideLoading();
        }


    }



    /**
 * Fonction debug - À taper dans console
 * window.debugSecuraLoading()
 */
window.debugSecuraLoading = function() {
    console.group('%c🔍 SECURA Loading Debug', 'color: #D97706; font-weight: bold;');
    
    console.log('📊 Configuration:', window.securaLoaderConfig);
    
    const token = localStorage.getItem('secura_token');
    console.log('🔐 Token exists:', !!token);
    
    if (token) {
        try {
            const parts = token.split('.');
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            console.log('📋 Token Payload:', payload);
            console.log('⏱️ Expires at:', new Date(payload.exp * 1000));
            console.log('✓ Token valid:', payload.exp * 1000 > Date.now());
        } catch (err) {
            console.error('❌ Token parse error:', err);
        }
    }

    const perfData = performance.getEntriesByType('navigation')[0];
    if (perfData) {
        console.log('⚡ Load Times:', {
            'DOM Content Loaded': `${(perfData.domContentLoadedEventEnd - perfData.navigationStart).toFixed(0)}ms`,
            'Full Load': `${(perfData.loadEventEnd - perfData.navigationStart).toFixed(0)}ms`
        });
    }

    console.groupEnd();
};


// ═══════════════════════════════════════════════════════════════
// 🌐 EXPORTS GLOBAUX
// ═══════════════════════════════════════════════════════════════
window.showNotification = showNotification;
window.confirmDialog = confirmDialog;
window.downloadFile = downloadFile;
window.formatDate = formatDate;
window.debounce = debounce;
window.validateEmail = validateEmail;
window.validatePhone = validatePhone;
window.editEvent = editEvent;
window.duplicateEvent = duplicateEvent;
window.exportEventFromMain = exportEventFromMain;
window.deleteEventFromMain = deleteEventFromMain;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showLoadingFor = showLoadingFor;



console.log('✅ SECURA Main Scripts V5.0 chargé - Mode Observable actif !');