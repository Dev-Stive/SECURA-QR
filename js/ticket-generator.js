/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║ 🎫 SECURA TICKET GENERATOR - ULTRA ROYAL & MAJESTUEUX ║
 * ║ ║
 * ║ ✨ Interface utilisateur royale et intuitive ║
 * ║ 📦 Génération en masse avec aperçus dynamiques ║
 * ║ 🎨 Gestion complète des templates et formats royaux ║
 * ║ 💾 Export PNG/PDF qualité royale ║
 * ║ 🔄 Suivi en temps réel de la progression ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

let currentEvent = null;
let currentGuest = null;
let currentTemplate = 'football';
let currentFormat = 'landscape';
let currentQuality = 3;



let currentEvents = [];
let filteredEvents = [];
let isRendering = false;
const eventCardCache = new Map();
const eventStatsCache = new Map();

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION ROYALE
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;
   
initializeTicketListeners();
    injectBulkGenerationStyles();
    await loadEvents();
});

// ═══════════════════════════════════════════════════════════════
// 🎧 LISTENERS ROYAUX
// ═══════════════════════════════════════════════════════════════
function initializeTicketListeners() {
    // Templates
    document.querySelectorAll('.template-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.template-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            currentTemplate = option.dataset.template;
           
            if (currentEvent && currentGuest) {
                generateTicketPreview();
            }
        });
    });

    // Sélection invité
    const guestSelect = document.getElementById('ticketGuestSelect');
    if (guestSelect) {
        guestSelect.addEventListener('change', (e) => {
            const guestId = e.target.value;
            if (guestId) {
                currentGuest = storage.getGuestById(guestId);
                if (currentEvent && currentGuest) {
                    generateTicketPreview();
                }
            } else {
                const guests = storage.getGuestsByEventId(currentEvent.id);
                currentGuest = guests[0] || null;
            }
        });
    }

    // Format
    const formatSelect = document.getElementById('ticketFormat');
    if (formatSelect) {
        formatSelect.addEventListener('change', (e) => {
            currentFormat = e.target.value;
            if (currentEvent && currentGuest) {
                generateTicketPreview();
            }
        });
    }

    // Qualité
    const qualitySelect = document.getElementById('ticketQuality');
    if (qualitySelect) {
        qualitySelect.addEventListener('change', (e) => {
            currentQuality = parseInt(e.target.value);
        });
    }

    // Boutons
    document.getElementById('generateTicketBtn')?.addEventListener('click', generateTicketPreview);
    document.getElementById('downloadTicketBtn')?.addEventListener('click', downloadSingleTicket);
    document.getElementById('downloadTicketPdfBtn')?.addEventListener('click', downloadSingleTicketPDF);
    document.getElementById('generateAllTicketsBtn')?.addEventListener('click', generateAllTickets);
    document.getElementById('shareTicketBtn')?.addEventListener('click', shareTicket);
}

// ═══════════════════════════════════════════════════════════════
// 📋 CHARGEMENT DES ÉVÉNEMENTS EN GRID ROYALE
// ═══════════════════════════════════════════════════════════════



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
            <div class="col-12 text-center py-5">
                <div class="placeholder-icon mb-4">
                    <i class="bi bi-calendar-x-fill" style="font-size: 5rem; color: #D1D5DB;"></i>
                </div>
                <h3 class="placeholder-text mb-3">Aucun événement trouvé</h3>
                <p class="placeholder-hint">Créez votre premier événement pour générer des billets d'invitation</p>
                <a href="events.html" class="btn-royal btn-primary-royal mt-3">
                    <i class="bi bi-plus-circle"></i>
                    <span>Créer un Événement</span>
                </a>
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

    // Images par type d'événement
    const typeImages = {
        marriage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
        anniversaire: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=80',
        anniversary: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=80',
        conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
        football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
        corporate: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
        concert: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
        gala: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
        graduation: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
        exhibition: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&q=80',
        vip: 'https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?w=800&q=80',
        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e?w=800&q=80'
    };

    const backgroundImage = typeImages[event.type] || typeImages.autre;

    return `
        <div class="col-12 col-md-6 col-lg-6 d-flex justify-content-center">
            <div class="event-card-pro w-100" onclick="handleEventSelect('${event.id}')" style="background-image: url('${backgroundImage}');">
                ${isUpcoming ? '<div class="upcoming-ribbon">À VENIR</div>' : ''}
                
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
                    </div>

                    <div class="event-status">
                        <i class="fas ${event.active ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}"></i>
                        <span>${event.active ? 'Actif' : 'Inactif'}</span>
                    </div>
                </div>

               
            </div>
        </div>
    `;
}




// ═══════════════════════════════════════════════════════════════
// 🎯 SÉLECTION ÉVÉNEMENT ROYAL
// ═══════════════════════════════════════════════════════════════
function handleEventSelect(eventId) {
    if (!eventId) {
        currentEvent = null;
        currentGuest = null;
        document.getElementById('ticketInterface').style.display = 'none';
        document.getElementById('eventsGridContainer').style.display = 'block';
        return;
    }

    currentEvent = storage.getEventById(eventId);
    if (!currentEvent) return;

    // Charger les invités
    const guests = storage.getGuestsByEventId(eventId);
    const guestSelect = document.getElementById('ticketGuestSelect');
   
    guestSelect.innerHTML = '<option value="">-- Aperçu premier invité --</option>';
    guests.forEach(guest => {
        guestSelect.innerHTML += `<option value="${guest.id}">${guest.firstName} ${guest.lastName}</option>`;
    });

    // Sélectionner le premier invité par défaut
    currentGuest = guests[0] || null;

    // Auto-sélectionner le template selon le type d'événement
    const templateMap = {
        'marriage': 'marriage',
        'anniversaire': 'anniversary',
        'anniversary': 'anniversary',
        'conference': 'conference',
        'corporate': 'corporate',
        'concert': 'concert',
        'gala': 'gala',
        'graduation': 'graduation',
        'exhibition': 'exhibition',
        'vip': 'vip',
        'autre': 'football'
    };
   
    currentTemplate = templateMap[currentEvent.type] || 'football';
   
    document.querySelectorAll('.template-option').forEach(option => {
        option.classList.toggle('active', option.dataset.template === currentTemplate);
    });

    // Afficher l'interface
    document.getElementById('eventsGridContainer').style.display = 'none';
    document.getElementById('ticketInterface').style.display = 'block';

    // Générer automatiquement un aperçu si on a un invité
    if (currentGuest) {
        setTimeout(() => generateTicketPreview(), 400);
    }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 GÉNÉRATION APERÇU BILLET ROYAL
// ═══════════════════════════════════════════════════════════════
async function generateTicketPreview() {
    if (!currentEvent || !currentGuest) {
        await Swal.fire({
            icon: 'warning',
            title: 'Données manquantes',
            text: 'Veuillez sélectionner un événement et un invité',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)',
            customClass: { popup: 'royal-swal' }
        });
        return;
    }

    const container = document.getElementById('ticketPreviewContainer');
    container.innerHTML = `
        <div class="ticket-placeholder">
            <div class="placeholder-icon">
                <i class="bi bi-hourglass-split" style="animation: spin 2s linear infinite;"></i>
            </div>
            <p class="placeholder-text">Génération du billet royal en cours...</p>
            <small class="placeholder-hint">Préparation de votre invitation majestueuse</small>
        </div>
    `;

    await new Promise(r => setTimeout(r, 400));

    // LE POUVOIR : renderTicket() fait TOUT → Canvas doré, QR, responsive
    await window.ticketService.renderTicket(container, currentEvent, currentGuest, currentTemplate);

    document.getElementById('ticketActions').style.display = 'grid';
    document.getElementById('generateAllTicketsBtn').style.display = 'block';

    if (typeof SECURA_AUDIO !== 'undefined') SECURA_AUDIO.success?.();
    showNotification('success', 'Billet royal généré avec splendeur !');
}




// ═══════════════════════════════════════════════════════════════
// 💾 TÉLÉCHARGEMENT BILLET UNIQUE PNG ROYAL
// ═══════════════════════════════════════════════════════════════
async function downloadSingleTicket() {
    const root = document.getElementById('ticketRoot');
    if (!root || !currentEvent || !currentGuest) return;

    const loading = Swal.fire({
        title: 'Préparation du téléchargement royal...',
        icon: 'info',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: 'linear-gradient(135deg, #FFF9E6, #FFF)',
        didOpen: () => Swal.showLoading()
    });

    const filename = window.ticketService.formatFileName(currentGuest.firstName, currentGuest.lastName, currentEvent.name);
    const success = await window.ticketService.downloadTicketPNG(root, filename, currentQuality);

    await loading.close();

    if (success) {
        if (typeof SECURA_AUDIO !== 'undefined') SECURA_AUDIO.play?.('notify');
        showNotification('success', `Billet royal téléchargé : ${filename}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// 📄 TÉLÉCHARGEMENT BILLET UNIQUE PDF ROYAL
// ═══════════════════════════════════════════════════════════════
async function downloadSingleTicketPDF() {
    const root = document.getElementById('ticketRoot');
    if (!root || !currentEvent || !currentGuest) return;

    const loading = Swal.fire({
        title: 'Génération du PDF royal...',
        icon: 'info',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: 'linear-gradient(135deg, #FFF9E6, #FFF)',
        didOpen: () => Swal.showLoading()
    });

    const filename = window.ticketService.formatFileName(currentGuest.firstName, currentGuest.lastName, currentEvent.name).replace('.png', '.pdf');
    const success = await window.ticketService.downloadTicketPDF(root, filename, currentQuality);

    await loading.close();

    if (success) {
        if (typeof SECURA_AUDIO !== 'undefined') SECURA_AUDIO.play?.('notify');
        showNotification('success', `PDF royal téléchargé : ${filename}`);
    }
}
// ═══════════════════════════════════════════════════════════════
// 📦 GÉNÉRATION EN MASSE AVEC BILLETS ROYAUX
// ═══════════════════════════════════════════════════════════════
async function generateAllTickets() {
    if (!currentEvent) return;

    const allGuests = storage.getGuestsByEventId(currentEvent.id);
    
    if (allGuests.length === 0) {
        await Swal.fire({
            icon: 'warning',
            title: 'Aucun invité',
            text: 'Cet événement n\'a pas d\'invités',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
        return;
    }

    // Vérifier les billets existants
    const guestsWithTicket = allGuests.filter(g => storage.getQRCodeByGuestId(g.id));
    const guestsWithoutTicket = allGuests.filter(g => !storage.getQRCodeByGuestId(g.id));
    const hasMissingTickets = guestsWithoutTicket.length > 0;

    let targetGuests = allGuests;

    // === CHOIX INTELLIGENT ROYAL ===
    if (hasMissingTickets) {
        const result = await Swal.fire({
            title: '📦 Génération ZIP avec Billets Royaux',
            html: `
                <div style="text-align: left; padding: 2rem; background: linear-gradient(135deg, #FFF9E6, #FFF); border-radius: 16px; margin: 1.5rem 0; border: 3px solid #D4AF37;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; padding: 1.5rem; background: white; border-radius: 12px; border-left: 6px solid #D4AF37;">
                        <span style="font-weight: 800; color: #1F2937;">Total invités</span>
                        <span style="font-weight: 900; color: #D4AF37; font-size: 1.3rem;">${allGuests.length}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; padding: 1.5rem; background: white; border-radius: 12px; border-left: 6px solid #10B981;">
                        <span style="font-weight: 800; color: #1F2937;">Sans billet</span>
                        <span style="font-weight: 900; color: #10B981; font-size: 1.3rem;">${guestsWithoutTicket.length}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 1.5rem; background: white; border-radius: 12px; border-left: 6px solid #6B7280;">
                        <span style="font-weight: 800; color: #1F2937;">Avec billet</span>
                        <span style="font-weight: 900; color: #6B7280; font-size: 1.3rem;">${guestsWithTicket.length}</span>
                    </div>
                </div>
                <p style="font-size: 1.1rem; margin-top: 1.5rem; color: #1F2937; font-weight: 600;">Générer tous les billets royaux en ZIP ?</p>
                <p style="font-size: 0.9rem; color: #6B7280; margin-top: 1rem; font-style: italic;">✨ Design majestueux avec bordures Canvas dorées</p>
            `,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: `📥 Tous (${allGuests.length})`,
            denyButtonText: `✨ Manquants (${guestsWithoutTicket.length})`,
            cancelButtonText: 'Annuler',
            reverseButtons: true,
            confirmButtonColor: '#D4AF37',
            denyButtonColor: '#10B981',
            cancelButtonColor: '#6B7280',
            width: '650px',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });

        if (result.isConfirmed) {
            targetGuests = allGuests;
        } else if (result.isDenied) {
            targetGuests = guestsWithoutTicket;
        } else {
            return;
        }
    } else {
        const confirmed = await Swal.fire({
            title: '📦 Génération ZIP Complète',
            html: `
                <p style="font-size: 1.2rem; margin: 1.5rem 0;">Générer <strong style="color: #D4AF37; font-size: 1.4rem;">${allGuests.length}</strong> billets royaux ?</p>
                <p style="font-size: 1rem; color: #6B7280; margin-top: 1.5rem; padding: 1.5rem; background: #FEF3C7; border-radius: 12px; border-left: 6px solid #F59E0B;">
                    ℹ️ Tous les invités ont déjà un billet.<br>
                    Les billets seront régénérés avec le design royal actuel.
                </p>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '✅ Générer ZIP',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
        
        if (!confirmed.isConfirmed) return;
    }

    // === MODAL DE PROGRESSION ROYALE ===
    const progressHtml = `
        <div class="bulk-progress-container">
            <div class="progress-header">
                <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1.5rem;">
                    <i class="bi bi-file-earmark-zip-fill" style="font-size: 2.5rem; color: #D4AF37;"></i>
                    <h4 style="margin: 0; font-size: 1.8rem; font-weight: 900; color: #1F2937; font-family: 'Playfair Display';">Génération ZIP Royale</h4>
                </div>
                <p id="progress-text" style="font-size: 1.5rem; font-weight: 900; color: #D4AF37; margin: 0; font-family: 'Playfair Display';">0 sur ${targetGuests.length}</p>
                <p class="progress-subtitle" id="progress-subtitle" style="color: #6B7280; font-size: 1rem; margin: 0.75rem 0 0 0;">Initialisation...</p>
            </div>
            
            <div class="progress-bar-container">
                <div class="progress-bar" id="progressBar" style="width:0%">
                    <span id="progressPercent" style="font-weight: 900;">0%</span>
                </div>
            </div>

            <div class="stats-container">
                <div class="stat-item">
                    <div class="stat-value" id="stat-success" style="color: #10B981;">0</div>
                    <div class="stat-label">✅ Succès</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" id="stat-errors" style="color: #EF4444;">0</div>
                    <div class="stat-label">❌ Erreurs</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" id="stat-remaining" style="color: #6B7280;">${targetGuests.length}</div>
                    <div class="stat-label">⏳ Restants</div>
                </div>
            </div>

            <div class="ticket-preview-scroll" id="ticketPreviewScroll">
                <p class="text-muted">⏳ Les billets royaux s'afficheront ici...</p>
            </div>
        </div>
    `;

    Swal.fire({
        html: progressHtml,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        showCloseButton: false,
        width: '800px',
        customClass: { popup: 'swal-bulk-generation-royal' },
        background: 'linear-gradient(135deg, #FFF9E6, #FFF)',
        didOpen: () => Swal.hideLoading()
    });

    // === ÉLÉMENTS UI ===
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progress-text');
    const progressPercent = document.getElementById('progressPercent');
    const progressSubtitle = document.getElementById('progress-subtitle');
    const previewScroll = document.getElementById('ticketPreviewScroll');
    const statSuccess = document.getElementById('stat-success');
    const statErrors = document.getElementById('stat-errors');
    const statRemaining = document.getElementById('stat-remaining');

    previewScroll.innerHTML = '';

    let successCount = 0;
    let errorCount = 0;
    const total = targetGuests.length;
    const tickets = [];

    // === CONTENEUR INVISIBLE POUR GÉNÉRATION ===
const hiddenContainer = document.createElement('div');
hiddenContainer.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px;height:800px;opacity:0;pointer-events:none;overflow:hidden;background:white;';
hiddenContainer.id = 'hiddenTicketContainer';
document.body.appendChild(hiddenContainer);

// === BOUCLE DE GÉNÉRATION ROYALE OPTIMISÉE ===
for (let i = 0; i < total; i++) {
    const guest = targetGuests[i];

    try {
        progressSubtitle.textContent = `🎫 Génération pour ${guest.firstName} ${guest.lastName}...`;

        // 1. Nettoyer le conteneur caché
        hiddenContainer.innerHTML = '';

        // 2. Choisir le template selon le type d'événement
        const templateMap = {
            marriage: 'marriage',
            anniversaire: 'anniversary',
            anniversary: 'anniversary',
            conference: 'conference',
            corporate: 'corporate',
            concert: 'concert',
            gala: 'gala',
            graduation: 'graduation',
            exhibition: 'exhibition',
            vip: 'vip',
            football: 'football',
            autre: 'anniversary'
        };
        const template = templateMap[currentEvent.type] || 'anniversary';

        // 3. INJECTER LE HTML DU TICKET
        hiddenContainer.innerHTML = window.ticketService.generateTicketHTML(currentEvent, guest, template);

        // 4. ATTENDRE LE RENDU DOM
        await new Promise(r => setTimeout(r, 100));

        // 5. INITIALISER LES COMPOSANTS ROYAUX
        const ticketElement = hiddenContainer.querySelector('.ticket-premium');
        if (!ticketElement) {
            throw new Error('Élément ticket non trouvé dans le DOM');
        }

        // Générer le QR Code
        const qrData = { 
            t: 'INV', 
            e: currentEvent.id, 
            g: guest.id,
            
        };


        
        // Vider et regénérer le QR Code
        const qrContainer = hiddenContainer.querySelector('#qrcode');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: JSON.stringify(qrData),
                width: 260,
                height: 260,
                colorDark: "#000000",
                colorLight: "#FFFFFF",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        // ════════════════════════════════════════════════════════════════════
// 🎨 Injection directe du style Canvas + Dessin des bordures majestueuses
// ════════════════════════════════════════════════════════════════════

// Fonction qui applique le style directement via JS
function applyCanvasStyle(canvas) {
    if (!canvas) return;

    Object.assign(canvas.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "10"
    });
}

// Sélection des canvas
const mainCanvas = hiddenContainer.querySelector('#borderCanvas');
const qrCanvas = hiddenContainer.querySelector('#qrBorderCanvas');

// Application des styles puis redimensionnement
if (mainCanvas) {
    applyCanvasStyle(mainCanvas);
    mainCanvas.width = mainCanvas.offsetWidth;
    mainCanvas.height = mainCanvas.offsetHeight;
    window.ticketService.drawMajesticBorders(mainCanvas);
}

if (qrCanvas) {
    applyCanvasStyle(qrCanvas);
    qrCanvas.width = qrCanvas.offsetWidth;
    qrCanvas.height = qrCanvas.offsetHeight;
    window.ticketService.drawMajesticBorders(qrCanvas);
}


        // 6. ATTENDRE LE RENDU COMPLET
        await new Promise(r => setTimeout(r, 150));

        // 7. CONVERTIR EN CANVAS AVEC HAUTE QUALITÉ
        const canvas = await window.ticketService.ticketToCanvas(ticketElement, currentQuality);
        if (!canvas) {
            throw new Error('Erreur lors de la création du canvas');
        }

        // 8. CONVERTIR LE CANVAS EN BLOB
        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png', 1.0);
        });

        if (!blob) {
            throw new Error('Erreur création blob');
        }

        // 9. CRÉER LE NOM DE FICHIER
        const filename = window.ticketService.formatFileName(
            guest.firstName,
            guest.lastName, 
            currentEvent.name
        ) + '.png';

        // 10. AJOUTER AU TABLEAU DES TICKETS
        tickets.push({ guest, blob, filename });

        // 11. SAUVEGARDER LE QR CODE EN BASE
        if (!storage.getQRCodeByGuestId(guest.id)) {
            storage.saveQRCode({
                guestId: guest.id,
                eventId: currentEvent.id,
                data: JSON.stringify(qrData),
                config: { 
                    template: template, 
                    format: currentFormat, 
                    quality: currentQuality,
                    generatedAt: new Date().toISOString()
                }
            });
        }

        // === LOGS DE SUCCÈS ===
        console.log(`✅ Ticket généré pour: ${guest.firstName} ${guest.lastName}`);
        console.log(`📏 Dimensions: ${canvas.width}x${canvas.height}`);
        console.log(`📱 QR Code généré: ${!!qrContainer && qrContainer.children.length > 0}`);
        console.log(`🎨 Canvas trouvés: ${hiddenContainer.querySelectorAll('canvas').length}`);

        successCount++;

        // === MISE À JOUR UI EN TEMPS RÉEL ===
        const processed = successCount + errorCount;
        const percentage = Math.round((processed / total) * 100);
        
        progressBar.style.width = `${percentage}%`;
        progressPercent.textContent = `${percentage}%`;
        progressText.textContent = `${processed} sur ${total}`;
        statSuccess.textContent = successCount;
        statErrors.textContent = errorCount;
        statRemaining.textContent = total - processed;

        // === APERÇU MINIATURE DYNAMIQUE ===
        const itemDiv = document.createElement('div');
        itemDiv.className = 'ticket-preview-item';
        itemDiv.style.animationDelay = `${i * 0.1}s`;
        itemDiv.innerHTML = `
            <img src="${URL.createObjectURL(blob)}" alt="${guest.firstName} ${guest.lastName}">
            <span class="guest-name">${guest.firstName} ${guest.lastName}</span>
            <span class="guest-status success">✅</span>
        `;
        previewScroll.appendChild(itemDiv);
        previewScroll.scrollTop = previewScroll.scrollHeight;

        // === PETITE PAUSE POUR ÉVITER LA SURCHARGE ===
        if (i % 5 === 0) {
            await new Promise(r => setTimeout(r, 50));
        }

    } catch (err) {
        console.error(`❌ Erreur génération pour ${guest.firstName} ${guest.lastName}:`, err);
        errorCount++;

        // === APERÇU D'ERREUR ===
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ticket-preview-item error';
        errorDiv.style.animationDelay = `${i * 0.1}s`;
        errorDiv.innerHTML = `
            <div class="error-icon">⚠️</div>
            <span class="guest-name">${guest.firstName} ${guest.lastName}</span>
            <span class="guest-status error">❌</span>
            <div class="error-tooltip">${err.message}</div>
        `;
        previewScroll.appendChild(errorDiv);
        
        // Mise à jour des stats d'erreur
        statErrors.textContent = errorCount;
        statRemaining.textContent = total - (successCount + errorCount);
    }
}

// === NETTOYAGE FINAL ===
if (document.body.contains(hiddenContainer)) {
    document.body.removeChild(hiddenContainer);
}

    // === CRÉATION DU ZIP ===
    if (successCount > 0) {
        progressSubtitle.textContent = '📦 Création du fichier ZIP royal...';
        
        try {
            const zipBlob = await window.ticketService.createTicketsZip(tickets, currentEvent.name);

            if (zipBlob) {
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SECURA_Billets_Royaux_${window.ticketService.cleanFileName(currentEvent.name)}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (zipError) {
            console.error('❌ Erreur création ZIP:', zipError);
        }
    }

    Swal.close();
    
    if (typeof SECURA_AUDIO !== 'undefined') {
        SECURA_AUDIO.success?.();
    }
    
    // === NOTIFICATION FINALE ===
    if (successCount === total) {
        await Swal.fire({
            icon: 'success',
            title: '🎉 Génération ZIP Royale Terminée !',
            html: `
                <div style="padding: 2rem; background: linear-gradient(135deg, #D4F1F4, #E8F5E9); border-radius: 16px; margin: 1.5rem 0; border: 3px solid #10B981;">
                    <p style="font-size: 1.5rem; font-weight: 900; color: #10B981; margin: 0; font-family: 'Playfair Display';">✅ ${successCount} billets royaux générés</p>
                    <p style="font-size: 1.1rem; color: #6B7280; margin: 1rem 0 0 0;">Le fichier ZIP a été téléchargé automatiquement</p>
                    <p style="font-size: 0.95rem; color: #1F2937; margin: 1rem 0 0 0; font-weight: 600;">✨ Avec bordures Canvas dorées majestueuses</p>
                </div>
            `,
            timer: 5000,
            showConfirmButton: true,
            confirmButtonText: 'Super !',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
    } else {
        await Swal.fire({
            icon: successCount > 0 ? 'warning' : 'error',
            title: successCount > 0 ? '⚠️ Terminé avec des erreurs' : '❌ Échec',
            html: `
                <div style="padding: 2rem; background: #FEF3C7; border-radius: 16px; margin: 1.5rem 0; border: 3px solid #F59E0B;">
                    <p style="margin: 0.75rem 0;"><strong style="color: #10B981; font-size: 1.4rem; font-weight: 900;">${successCount}</strong> billets générés</p>
                    <p style="margin: 0.75rem 0;"><strong style="color: #EF4444; font-size: 1.4rem; font-weight: 900;">${errorCount}</strong> erreurs</p>
                    ${successCount > 0 ? '<p style="margin: 0.75rem 0 0 0; font-size: 1rem; color: #6B7280; font-weight: 600;">Le fichier ZIP a été téléchargé</p>' : ''}
                </div>
            `,
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
    }
}


// ═══════════════════════════════════════════════════════════════
// 🎨 INJECTION DES STYLES CSS POUR LA MODAL ROYALE
// ═══════════════════════════════════════════════════════════════
function injectBulkGenerationStyles() {
    if (document.getElementById('ticket-bulk-styles-royal')) return;

    const style = document.createElement('style');
    style.id = 'ticket-bulk-styles-royal';
    style.textContent = `\
        .bulk-progress-container { padding: 2rem; min-height: 600px; }\
        .progress-header { text-align: center; margin-bottom: 2rem; }\
        .progress-subtitle { font-style: italic; }\
        .progress-bar-container { width: 100%; height: 36px; background: #E5E7EB; border-radius: 18px; overflow: hidden; margin: 2rem 0; box-shadow: inset 0 3px 6px rgba(0,0,0,0.1); border: 2px solid #D4AF37; }\
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D4AF37 0%, #FFD700 100%); transition: width 0.4s ease; display: flex; align-items: center; justify-content: center; color: #1F2937; font-size: 1.1rem; font-weight: 900; }\
        .stats-container { display: flex; justify-content: space-around; margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, #FFF9E6, #FFF); border-radius: 16px; border: 3px solid #D4AF37; }\
        .stat-item { text-align: center; }\
        .stat-value { display: block; font-size: 2.5rem; font-weight: 900; margin-bottom: 0.5rem; font-family: 'Playfair Display'; }\
        .stat-label { font-size: 0.9rem; color: #6B7280; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; }\
        .ticket-preview-scroll { max-height: 320px; overflow-y: auto; overflow-x: hidden; background: linear-gradient(135deg, #FFF9E6, #FFF); border: 3px solid #D4AF37; border-radius: 16px; padding: 1.5rem; display: flex; flex-wrap: wrap; gap: 1.2rem; justify-content: center; scroll-behavior: smooth; }\
        .ticket-preview-scroll::-webkit-scrollbar { width: 10px; }\
        .ticket-preview-scroll::-webkit-scrollbar-track { background: #F1F1F1; border-radius: 10px; }\
        .ticket-preview-scroll::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 10px; }\
        .ticket-preview-scroll::-webkit-scrollbar-thumb:hover { background: #FFD700; }\
        .ticket-preview-item { position: relative; opacity: 0; transform: scale(0.8) translateY(20px); animation: ticketFadeIn 0.5s ease forwards; }\
        .ticket-preview-item img { width: 150px; height: 100px; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.2); border: 4px solid #10B981; transition: transform 0.3s ease; object-fit: cover; }\
        .ticket-preview-item.error { opacity: 0; animation: ticketErrorFade 0.5s ease forwards; }\
        .ticket-preview-item.error img { border-color: #EF4444; filter: grayscale(0.9); opacity: 0.6; }\
        .ticket-preview-item:hover img { transform: scale(1.1) rotate(3deg); }\
        .ticket-preview-item .guest-name { position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 6px 12px; border-radius: 10px; font-size: 0.8rem; font-weight: 800; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 3px 10px rgba(16,185,129,0.5); }\
        .ticket-preview-item.error .guest-name { background: linear-gradient(135deg, #EF4444, #DC2626); box-shadow: 0 3px 10px rgba(239,68,68,0.5); }\
        .guest-status { position: absolute; top: -12px; right: -12px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: bold; box-shadow: 0 3px 10px rgba(0,0,0,0.3); }\
        .guest-status.success { background: linear-gradient(135deg, #10B981, #059669); color: white; }\
        .guest-status.error { background: linear-gradient(135deg, #EF4444, #DC2626); color: white; }\
        .error-icon { font-size: 2.5rem; text-align: center; margin-bottom: 0.75rem; }\
        @keyframes ticketFadeIn { to { opacity: 1; transform: scale(1) translateY(0); } }\
        @keyframes ticketErrorFade { to { opacity: 0.7; transform: scale(0.95) translateY(0); } }\
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\
        .swal-bulk-generation-royal { width: 800px !important; }\
        .text-muted { color: #9CA3AF; text-align: center; font-style: italic; width: 100%; padding: 3rem; font-size: 1.1rem; }\
    `;
    document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
// 📤 PARTAGE BILLET ROYAL
// ═══════════════════════════════════════════════════════════════
async function shareTicket() {
    if (!currentGuest || !currentEvent) return;

    const shareOptions = `\
        <div style="padding: 2rem;">\
            <p style="margin-bottom: 2rem; color: #6B7280; font-size: 1rem; text-align: center;">\
                Partagez le billet royal de <strong style="color: #D4AF37; font-weight: 800;">${currentGuest.firstName} ${currentGuest.lastName}</strong>\
            </p>\
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.2rem;">\
                <button onclick="shareTicketViaEmail()" style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.5rem; background: linear-gradient(135deg, #3B82F6, #2563EB); color: white; border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s ease; font-weight: 800; font-family: 'Playfair Display';">\
                    <i class="bi bi-envelope-fill" style="font-size: 2.5rem;"></i>\
                    <span>Email Royal</span>\
                </button>\
                <button onclick="shareTicketViaWhatsApp()" style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.5rem; background: linear-gradient(135deg, #25D366, #128C7E); color: white; border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s ease; font-weight: 800; font-family: 'Playfair Display';">\
                    <i class="bi bi-whatsapp" style="font-size: 2.5rem;"></i>\
                    <span>WhatsApp</span>\
                </button>\
                <button onclick="shareTicketViaSMS()" style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.5rem; background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s ease; font-weight: 800; font-family: 'Playfair Display';">\
                    <i class="bi bi-chat-dots-fill" style="font-size: 2.5rem;"></i>\
                    <span>SMS Premium</span>\
                </button>\
                <button onclick="copyTicketLink()" style="display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.5rem; background: linear-gradient(135deg, #6B7280, #4B5563); color: white; border: none; border-radius: 16px; cursor: pointer; transition: all 0.3s ease; font-weight: 800; font-family: 'Playfair Display';">\
                    <i class="bi bi-link-45deg" style="font-size: 2.5rem;"></i>\
                    <span>Copier Lien</span>\
                </button>\
            </div>\
        </div>\
    `;

    await Swal.fire({
        title: '<i class="bi bi-share-fill"></i> Partager le Billet Royal',
        html: shareOptions,
        showConfirmButton: false,
        showCloseButton: true,
        width: '600px',
        background: 'linear-gradient(135deg, #FFF9E6, #FFF)',
        customClass: {
            title: 'swal-share-title-royal'
        }
    });
}

// Fonctions de partage royal
window.shareTicketViaEmail = () => {
    if (!currentGuest || !currentGuest.email) {
        Swal.fire({
            icon: 'warning',
            title: '⚠️ Email manquant',
            text: 'Cet invité n\'a pas d\'adresse email enregistrée',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
        return;
    }
   
    const subject = encodeURIComponent(`🎫 Votre billet royal pour ${currentEvent.name}`);
    const body = encodeURIComponent(`Bonjour ${currentGuest.firstName},\n\nVeuillez trouver ci-joint votre billet d'invitation royal pour l'événement :\n\n👑 ${currentEvent.name}\n📅 ${new Date(currentEvent.date).toLocaleDateString('fr-FR')}\n📍 ${currentEvent.location || 'Lieu prestigieux'}\n🕐 ${currentEvent.time || ''}\n\nPrésentez ce billet royal à l'entrée.\n\n⚠️ IMPORTANT : Ce billet est strictement personnel et non transférable.\n\nCordialement,\nL'équipe SECURA`);
   
    window.location.href = `mailto:${currentGuest.email}?subject=${subject}&body=${body}`;
    Swal.close();
   
    setTimeout(() => {
        Swal.fire({
            icon: 'success',
            title: '✉️ Email royal ouvert',
            text: 'Votre client email a été ouvert avec le message préparé',
            timer: 2500,
            showConfirmButton: false,
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
    }, 500);
};

window.shareTicketViaWhatsApp = () => {
    if (!currentGuest || !currentGuest.phone) {
        Swal.fire({
            icon: 'warning',
            title: '⚠️ Téléphone manquant',
            text: 'Cet invité n\'a pas de numéro de téléphone enregistré',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
        return;
    }
   
    const message = encodeURIComponent(`🎫 *Votre billet royal pour ${currentEvent.name}*\n\n📅 Date : ${new Date(currentEvent.date).toLocaleDateString('fr-FR')}\n📍 Lieu : ${currentEvent.location || 'Lieu prestigieux'}\n\nPrésentez votre billet royal à l'entrée.\n\n⚠️ *IMPORTANT* : Ce billet est strictement personnel et non transférable.\n\n_Sécurisé par SECURA_`);
    const phoneNumber = currentGuest.phone.replace(/\D/g, '');
   
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
    Swal.close();
   
    setTimeout(() => {
        Swal.fire({
            icon: 'success',
            title: '✅ WhatsApp ouvert',
            text: 'Le message royal a été préparé',
            timer: 2500,
            showConfirmButton: false,
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
    }, 500);
};

window.shareTicketViaSMS = () => {
    if (!currentGuest || !currentGuest.phone) {
        Swal.fire({
            icon: 'warning',
            title: '⚠️ Téléphone manquant',
            text: 'Cet invité n\'a pas de numéro de téléphone enregistré',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
        return;
    }
   
    const message = encodeURIComponent(`🎫 Votre billet royal pour ${currentEvent.name}. Date: ${new Date(currentEvent.date).toLocaleDateString('fr-FR')}. Lieu: ${currentEvent.location || 'Lieu prestigieux'}. Présentez ce billet à l'entrée. IMPORTANT: billet strictement personnel.`);
   
    window.location.href = `sms:${currentGuest.phone}?body=${message}`;
    Swal.close();
   
    setTimeout(() => {
        Swal.fire({
            icon: 'success',
            title: '💬 SMS royal ouvert',
            text: 'Votre application SMS a été ouverte',
            timer: 2500,
            showConfirmButton: false,
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
    }, 500);
};

window.copyTicketLink = async () => {
    const link = `${window.location.origin}/ticket.html?event=${currentEvent.id}&guest=${currentGuest.id}`;
   
    try {
        await navigator.clipboard.writeText(link);
        Swal.close();
       
        await Swal.fire({
            icon: 'success',
            title: '✅ Lien royal copié !',
            html: `<p style="word-break: break-all; padding: 1.5rem; background: #F3F4F6; border-radius: 12px; font-family: monospace; font-size: 0.9rem; border: 2px solid #D4AF37;">${link}</p>`,
            timer: 3500,
            showConfirmButton: false,
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: '❌ Erreur',
            text: 'Impossible de copier le lien royal',
            confirmButtonColor: '#D4AF37',
            background: 'linear-gradient(135deg, #FFF9E6, #FFF)'
        });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 UTILITAIRES ROYAUX
// ═══════════════════════════════════════════════════════════════
function getEventTypeIcon(type) {
    const icons = {
        'marriage': 'heart-fill',
        'anniversary': 'cake2-fill',
        'anniversaire': 'cake2-fill',
        'conference': 'person-workspace',
        'corporate': 'building',
        'concert': 'music-note-beamed',
        'gala': 'gem',
        'graduation': 'mortarboard-fill',
        'exhibition': 'palette-fill',
        'vip': 'star-fill',
        'football': 'trophy-fill',
        'autre': 'calendar-event'
    };
    return icons[type] || 'calendar-event';
}

function getEventTypeLabel(type) {
    const labels = {
        'marriage': 'MARIAGE ROYAL',
        'anniversary': 'ANNIVERSAIRE PRESTIGE',
        'anniversaire': 'ANNIVERSAIRE PRESTIGE',
        'conference': 'CONFÉRENCE ÉLITE',
        'corporate': 'ÉVÉNEMENT CORPORATE',
        'concert': 'CONCERT VIP',
        'gala': 'GALA D\'EXCEPTION',
        'graduation': 'REMISE DE DIPLÔMES',
        'exhibition': 'EXPOSITION ARTISTIQUE',
        'vip': 'VIP PREMIUM',
        'football': 'ÉVÉNEMENT SPORTIF',
        'autre': 'ÉVÉNEMENT'
    };
    return labels[type] || 'ÉVÉNEMENT ROYAL';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ═══════════════════════════════════════════════════════════════
// 🔔 NOTIFICATION HELPER ROYAL
// ═══════════════════════════════════════════════════════════════
function showNotification(type, message) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
        background: 'linear-gradient(135deg, #FFF9E6, #FFF)',
        customClass: {
            popup: 'royal-toast'
        },
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    const icons = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    Toast.fire({
        icon: icons[type] || 'info',
        title: message
    });
}

console.log('✅ Ticket Generator Royal Ultra Premium initialisé');