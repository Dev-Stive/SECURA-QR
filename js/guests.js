/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           👥 SECURA GUESTS MANAGEMENT V5.0 👥                 ║
 * ║                                                               ║
 * ║  🎯 Mise à jour granulaire (pas de rerender complet)         ║
 * ║  🔔 SweetAlert2 avant chaque opération                        ║
 * ║  ✅ Validation ultra complète                                 ║
 * ║  📊 Observable DOM patching                                   ║
 * ║  ⚡ Performance optimisée                                     ║
 * ║  🎨 Animations fluides                                        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

let currentEventId = null;
let currentGuests = [];
let selectedGuests = [];
let guestRowCache = new Map();
let isRenderingGuests = false;

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;
    initializeGuestListeners();
    checkUrlParams();
   setupGranularGuestListeners();

   const hdrImportBtn = document.getElementById('importCsvBtn');
   if (hdrImportBtn) hdrImportBtn.style.display = 'none';
});


function clean(value) {
        if (!value || value.trim() === '' || value.trim() === '-' || value.trim().toLowerCase() === 'null') {
            return '';
        }
        return value.trim();
    };

// ═══════════════════════════════════════════════════════════════
// 🎧 LISTENERS GRANULAIRES OBSERVABLES
// ═══════════════════════════════════════════════════════════════
function setupGranularGuestListeners() {



       storage.on('data:synced', (event) => {

        if (!currentEventId) {
            (function patchEventCardsInPlace() {
                const events = storage.getAllEvents() || [];
                const latestMap = new Map(events.map(e => [e.id, e]));
                const container = document.getElementById('contain-card');
                if (!container) return;

                const cards = Array.from(container.querySelectorAll('.event-card-pro'));
                const seen = new Set();

                // Pour chaque carte existante -> patch si l'event existe, sinon retirer
                cards.forEach(card => {
                    const id = card.getAttribute('data-event-id');
                    const ev = latestMap.get(id);
                    if (!ev) {
                        // supprimée côté storage -> retirer avec animation
                        card.style.transition = 'all 0.3s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(-8px)';
                        setTimeout(() => {
                            const wrapper = card.closest('.col-12, .col-md-6, .col-lg-6') || card.parentElement;
                            wrapper?.remove();
                        }, 320);
                        return;
                    }

                    seen.add(id);

                    // Background image (garder l'effet visuel)
                    const images = {
                        marriage: 'https://images.unsplash.com/photo-1519741497674-611481863552',
                        anniversaire: 'https://images.unsplash.com/photo-1569415860599-5514567fde28?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8JUVDJTgzJTlEJUVDJTlEJUJDJTIwJUVDJUI0JTlCJUVCJUI2JTg4fGVufDB8fDB8fHww&fm=jpg&q=60&w=3000',
                        conference: 'https://images.unsplash.com/photo-1540575467063-868f79e66c3f',
                        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e'
                    };
                    const bg = images[ev.type] || images.autre;
                    if (card.style.backgroundImage.indexOf(bg) === -1) {
                        card.style.backgroundImage = `url('${bg}')`;
                    }

                    // Title
                    const titleEl = card.querySelector('.event-title');
                    if (titleEl && titleEl.textContent.trim() !== (ev.name || '').trim()) {
                        titleEl.textContent = ev.name || '';
                        // highlight change
                        titleEl.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 300 });
                    }

                    // Meta: date / time / location - simple replace of span text nodes
                    const date = new Date(ev.date);
                    const formattedDate = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    const metaItems = card.querySelectorAll('.event-meta .meta-item span');
                    if (metaItems && metaItems.length > 0) {
                        // premiere meta = date
                        if (metaItems[0].textContent.trim() !== formattedDate) metaItems[0].textContent = formattedDate;
                        // time (si present)
                        if (ev.time) {
                            if (metaItems[1]) {
                                if (metaItems[1].textContent.trim() !== ev.time) metaItems[1].textContent = ev.time;
                            } else {
                                const node = document.createElement('div');
                                node.className = 'meta-item';
                                node.innerHTML = `<i class="fas fa-clock"></i> <span>${ev.time}</span>`;
                                card.querySelector('.event-meta')?.appendChild(node);
                            }
                        } else {
                            if (metaItems[1] && metaItems[1].previousElementSibling && metaItems[1].previousElementSibling.classList.contains('fa-clock')) {
                                metaItems[1].parentElement?.remove();
                            }
                        }
                        // location - try to find last meta-item for location
                        const metaSpans = Array.from(card.querySelectorAll('.event-meta .meta-item')).map(n => n);
                        const locSpan = metaSpans.find(mi => mi.innerText.includes('map-marker') || mi.innerText.includes(ev.location || '')) ;
                        if (ev.location) {
                            if (!locSpan) {
                                const node = document.createElement('div');
                                node.className = 'meta-item';
                                node.innerHTML = `<i class="fas fa-map-marker-alt"></i> <span>${ev.location}</span>`;
                                card.querySelector('.event-meta')?.appendChild(node);
                            } else {
                                const span = locSpan.querySelector('span');
                                if (span && span.textContent.trim() !== ev.location) span.textContent = ev.location;
                            }
                        } else if (locSpan) {
                            locSpan.remove();
                        }
                    }

                    // Stats : nombre invités / présents / remplissage
                    const guests = storage.getGuestsByEventId(ev.id) || [];
                    const scanned = guests.filter(g => g.scanned).length;
                    const guestsValueEl = card.querySelector('.stat-circle .value');
                    // There are multiple .stat-circle; better target by index:
                    const statValues = card.querySelectorAll('.event-stats-circle .stat-circle .value');
                    if (statValues && statValues.length >= 2) {
                        if (statValues[0].textContent.trim() !== String(guests.length)) statValues[0].textContent = String(guests.length);
                        if (statValues[1].textContent.trim() !== String(scanned)) statValues[1].textContent = String(scanned);
                    }

                    // capacity fill ring
                    if (ev.capacity) {
                        const fillRate = Math.round((guests.length / ev.capacity) * 100);
                        const progCircle = card.querySelector('.progress-ring');
                        if (progCircle) {
                            const circumference = progCircle.getAttribute('stroke-dasharray') || (2 * Math.PI * 36);
                            const offset = (typeof circumference === 'string' ? parseFloat(circumference) : circumference) - (fillRate / 100) * (typeof circumference === 'string' ? parseFloat(circumference) : circumference);
                            if (!isNaN(offset)) progCircle.setAttribute('stroke-dashoffset', String(offset));
                            const textEl = card.querySelector('.progress-text');
                            if (textEl && textEl.textContent.trim() !== `${fillRate}%`) textEl.textContent = `${fillRate}%`;
                        }
                    }

                    // Active / Inactive
                    const statusElIcon = card.querySelector('.event-status i');
                    const statusElText = card.querySelector('.event-status span');
                    if (statusElIcon) {
                        const wantClass = ev.active ? 'fa-check-circle text-success' : 'fa-times-circle text-danger';
                        if (!statusElIcon.className.includes(wantClass)) statusElIcon.className = `fas ${ev.active ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}`;
                    }
                    if (statusElText && statusElText.textContent.trim() !== (ev.active ? 'Actif' : 'Inactif')) statusElText.textContent = ev.active ? 'Actif' : 'Inactif';
                });

                // Ajouter les events absents (nouveaux)
                events.forEach(ev => {
                 if (!seen.has(ev.id)) {
                       container.insertAdjacentHTML('afterbegin', createEventCardForGuests(ev));

                        const newWrapper = container.firstElementChild;
                        const cardEl = newWrapper?.querySelector('.event-card-pro');
                        if (cardEl) {
                            cardEl.style.opacity = '0';
                            cardEl.style.transform = 'translateY(-8px)';
                            requestAnimationFrame(() => {
                                cardEl.style.transition = 'all 0.36s ease';
                                cardEl.style.opacity = '1';
                                cardEl.style.transform = 'translateY(0)';
                            });
                        }
                    }
                });

            })();

            return;
        }

        const query = document.getElementById('searchGuests')?.value?.toLowerCase().trim() || '';
        const isSearchActive = query.length > 0;

        // Récupère tous les invités côté stockage pour l'event courant
        const allLatestGuests = storage.getGuestsByEventId(currentEventId) || [];
        const latestMap = new Map(allLatestGuests.map(g => [g.id, g]));

        // Appliquer le filtre de recherche si nécessaire (même logique que handleGuestSearch)
        const latestGuests = isSearchActive
            ? allLatestGuests.filter(g =>
                (g.firstName || '').toLowerCase().includes(query) ||
                (g.lastName || '').toLowerCase().includes(query) ||
                (g.email || '').toLowerCase().includes(query) ||
                ((g.phone || '').toLowerCase()).includes(query) ||
                ((g.company || '').toLowerCase()).includes(query)
            )
            : allLatestGuests;

        const latestFilteredMap = new Map(latestGuests.map(g => [g.id, g]));
        const existingIds = Array.from(guestRowCache.keys());

        // Patch ciblé d'une ligne existante (même logique que plus haut)
        const patchRow = (row, guest) => {
            if (!row || !guest) return;

            // classe scanned
            if (guest.scanned) row.classList.add('scanned'); else row.classList.remove('scanned');

            // checkbox (ne pas réinitialiser checked si user a sélectionné)
            const cb = row.querySelector('.guest-checkbox');
            if (cb && cb.value !== guest.id) cb.value = guest.id;

            // Nettoyage des données
            const firstName = clean(guest.firstName);
            const lastName = clean(guest.lastName);
            const company = clean(guest.company);
            const email = clean(guest.email);
            const phone = clean(guest.phone);
            const notes = clean(guest.notes);

            // avatar / nom / entreprise
            const avatar = row.querySelector('.guest-avatar-pro');
            const nameText = `${(firstName||'').trim()} ${(lastName||'').trim()}`.trim();
            const initials = ((firstName||'')[0] || '?') + ((lastName||'')[0] || '');
            const color = stringToColor(`${firstName || ''} ${lastName || ''}`);
            if (avatar) {
                avatar.textContent = initials.toUpperCase();
                avatar.style.background = color;
            }
            const nameEl = row.querySelector('.guest-name');
            if (nameEl && nameEl.textContent.trim() !== nameText) nameEl.textContent = nameText || '';
            const companyEl = row.querySelector('.guest-company');
            if (company && company.trim() !== '') {
                if (companyEl) {
                    if (companyEl.textContent.trim() !== company.trim()) companyEl.textContent = company.trim();
                } else {
                    const wrapper = row.querySelector('.guest-info > div');
                    if (wrapper) wrapper.insertAdjacentHTML('beforeend', `<div class="guest-company">${escapeHtml(company)}</div>`);
                }
            } else {
                if (companyEl) companyEl.remove();
            }

            // email
            const emailCell = row.children[2];
            if (emailCell) {
                if (email && email.trim() !== '') {
                    const currentA = emailCell.querySelector('a.email-link');
                    const mail = email.trim();
                    if (currentA) {
                        if (currentA.textContent !== mail) currentA.textContent = mail;
                        if (currentA.getAttribute('href') !== `mailto:${mail}`) currentA.setAttribute('href', `mailto:${mail}`);
                    } else {
                        emailCell.innerHTML = `<a href="mailto:${mail}" class="email-link">${mail}</a>`;
                    }
                } else {
                    emailCell.textContent = '-';
                }
            }

            // phone
            const phoneCell = row.children[3];
            if (phoneCell) {
                const phoneText = phone && phone.trim() !== '' ? phone.trim() : '-';
                if (phoneCell.textContent.trim() !== phoneText) phoneCell.textContent = phoneText;
            }

            // statut badge
            const statusCell = row.children[4];
            if (statusCell) {
                const oldBadge = statusCell.querySelector('.status-badge-pro');
                const newHtml = `<span class="status-badge-pro ${guest.scanned ? 'present' : 'pending'}">
                                    <i class="bi ${guest.scanned ? 'bi-check-circle-fill' : 'bi-clock'}"></i>
                                    ${guest.scanned ? 'Présent' : 'En attente'}
                                </span>`;
                if (!oldBadge) {
                    statusCell.innerHTML = newHtml;
                } else if (oldBadge.outerHTML !== newHtml) {
                    oldBadge.outerHTML = newHtml;
                }
            }

            // notes
            const notesCell = row.children[5];
            if (notesCell) {
                const notesText = notes && notes.trim() !== '' ? notes.trim() : '-';
                if (notesCell.textContent.trim() !== notesText) notesCell.textContent = notesText;
            }

            // QR icon
            const qrCell = row.children[6];
            if (qrCell) {
                const hasQr = !!storage.getQRCodeByGuestId(guest.id);
                const wantedClass = hasQr ? 'qr-ready' : 'qr-missing';
                const existingI = qrCell.querySelector('i');
                if (existingI) {
                    existingI.className = `bi bi-qr-code ${wantedClass}`;
                } else {
                    qrCell.innerHTML = `<i class="bi bi-qr-code ${wantedClass}"></i>`;
                }
            }

            // actions : s'assurer que les handlers ciblent le bon id
            const editBtn = row.querySelector('.action-btns .icon-btn[onclick^="editGuest"]');
            if (editBtn) editBtn.setAttribute('onclick', `editGuest('${guest.id}')`);
            const qrBtn = row.querySelector('.action-btns .icon-btn[onclick^="viewGuestQR"]');
            if (qrBtn) qrBtn.setAttribute('onclick', `viewGuestQR('${guest.id}')`);
            const shareBtn = row.querySelector('.action-btns .icon-btn[onclick^="shareGuest"]');
            if (shareBtn) shareBtn.setAttribute('onclick', `shareGuest('${guest.id}')`);
            const delBtn = row.querySelector('.action-btns .icon-btn.delete[onclick^="deleteGuest"]');
            if (delBtn) delBtn.setAttribute('onclick', `deleteGuest('${guest.id}')`);
        };

        // 1) Ajouter / patcher uniquement les invités filtrés (ou tous si pas de recherche)
        const tbody = document.getElementById('guestsTableBody');
        latestGuests.forEach(g => {
            const cached = guestRowCache.get(g.id);
            if (cached) {
                patchRow(cached, g);
            } else {
                // n'insère que si on n'est pas en recherche OR si en recherche (ici g passe déjà le filtre)
                const newRow = createGuestRowElement(g);
                guestRowCache.set(g.id, newRow);
                // insérer à la fin pour stabilité lors d'une recherche
                if (tbody) tbody.appendChild(newRow);
                newRow.querySelector('.guest-checkbox')?.addEventListener('change', handleGuestSelect);
            }
        });

        // 2) Supprimer les lignes qui n'appartiennent plus à la vue actuelle :
        //    - si recherche active : supprimer les rows qui ne sont pas dans latestGuests (filtrés)
        //    - sinon : supprimer rows qui n'existent plus côté storage
        existingIds.forEach(id => {
            if (isSearchActive) {
                if (!latestFilteredMap.has(id)) {
                    removeGuestRow(id);
                }
            } else {
                if (!latestMap.has(id)) {
                    removeGuestRow(id);
                }
            }
        });

        currentGuests = latestGuests.slice();

        const evt = storage.getEventById(currentEventId);
        if (evt) renderEventHeader(evt);

        updateSelectedGuests();

    });

   

     storage.on('guest:created', async (guest) => {
        console.log('🆕 Invité créé détecté:', guest.detail.firstName);

        // Check if the guest already exists in the cache
        if (guestRowCache.has(guest.detail.id)) {
            // Update the existing row
            updateGuestRow(guest.detail);
        } else {
            // Insert a new row if it doesn't exist
            if (guest.detail.eventId === currentEventId) {
                if (!currentGuests || currentGuests.length === 0) {
                    await loadGuestsByEvent(currentEventId);
                } else {
                    insertGuestRow(guest.detail);
                }
            }
        }
    });

    storage.on('guest:updated', (data) => {
        console.log('🔄 Invité mis à jour détecté:', data.detail.new.firstName);
        if (data.detail.new.eventId === currentEventId) {
            updateGuestRow(data.detail.new);
        }
    });

    storage.on('guest:deleted', (guest) => {
        console.log('🗑️ Invité supprimé détecté:', guest.detail.id);
        removeGuestRow(guest.detail.id);
    });

    storage.on('scan:created', (scan) => {
        console.log('📷 Scan créé, mise à jour invité');
        if (scan.detail.eventId === currentEventId) {
            const guest = storage.getGuestById(scan.detail.guestId);
            if (guest) {
                updateGuestRow(guest);
            }
        }
    });

    storage.on('event:updated', (data) => {
        if (data.detail.new.id === currentEventId) {
            renderEventHeader(data.detail.new);
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// 🔍 VÉRIFICATION URL
// ═══════════════════════════════════════════════════════════════
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event');

    if (eventId) {
        const event = storage.getEventById(eventId);
        if (event) {
            selectEvent(eventId);
        } else {
            showInvalidEventError(eventId);
        }
    } else {
        renderEventCards();
    }
}

async function showInvalidEventError(eventId) {
    const container = document.getElementById('mainContent');
    
    await Swal.fire({
        icon: 'error',
        title: 'Événement introuvable',
        html: `L'événement avec l'ID <strong>${eventId}</strong> n'existe pas.`,
        confirmButtonColor: '#D97706',
        confirmButtonText: 'Retour aux événements'
    });

    container.innerHTML = `
        <div class="empty-state error-state animate-fade-in">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Événement introuvable</h3>
            <p>ID: <strong>${eventId}</strong></p>
            <button class="btn btn-primary" onclick="window.location.href='guests.html'">
                <i class="fas fa-arrow-left"></i> Retour
            </button>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// 🎴 AFFICHAGE CARTES ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════
function renderEventCards() {
    const events = storage.getAllEvents();
    const container = document.getElementById('mainContent');

    if (events.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-plus text-6xl mb-4 text-gray-400"></i>
                <p class="text-lg text-gray-500">Aucun événement créé</p>
                <a href="events.html" class="btn btn-primary mt-4">
                    <i class="fas fa-plus"></i> Créer un événement
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div id="contain-card" class="row g-4 justify-content-center">
            ${events.map(event => createEventCardForGuests(event)).join('')}
        </div>
    `;
}

function createEventCardForGuests(event) {
    const guests = storage.getGuestsByEventId(event.id);
    const scanned = guests.filter(g => g.scanned).length;
    const date = new Date(event.date);
    const isUpcoming = date >= new Date();
    const formattedDate = date.toLocaleDateString('fr-FR', { 
        day: 'numeric', month: 'long', year: 'numeric' 
    });

    const images = {
        marriage: 'https://images.unsplash.com/photo-1519741497674-611481863552',
        anniversaire: 'https://images.unsplash.com/photo-1569415860599-5514567fde28?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8JUVDJTgzJTlEJUVDJTlEJUJDJTIwJUVDJUI0JTlCJUVCJUI2JTg4fGVufDB8fDB8fHww&fm=jpg&q=60&w=3000',
        conference: 'https://images.unsplash.com/photo-1540575467063-868f79e66c3f',
        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e'
    };

    const bg = images[event.type] || images.autre;
    const fillRate = event.capacity ? Math.round((guests.length / event.capacity) * 100) : 0;
    const circumference = 2 * Math.PI * 36;
    const offset = circumference - (fillRate / 100) * circumference;

    return `

      <div class="col-12 col-md-6 col-lg-6 d-flex justify-content-center">
        <div class="event-card-pro w-100" onclick="selectEvent('${event.id}')" data-event-id="${event.id}" style="background-image: url('${bg}');">
            ${isUpcoming ? '<div class="upcoming-ribbon">À VENIR</div>' : ''}
            
            <div class="event-content">
                <h3 class="event-title">${event.name}</h3>
                <div class="event-meta">
                    <div class="meta-item"><i class="fas fa-calendar-alt"></i> <span>${formattedDate}</span></div>
                    ${event.time ? `<div class="meta-item"><i class="fas fa-clock"></i> <span>${event.time}</span></div>` : ''}
                    ${event.location ? `<div class="meta-item"><i class="fas fa-map-marker-alt"></i> <span>${event.location}</span></div>` : ''}
                </div>
                <div class="event-stats-circle">
                    <div class="stat-circle"><div class="circle"><span class="value">${guests.length}</span><span class="label">Invités</span></div></div>
                    <div class="stat-circle"><div class="circle"><span class="value">${scanned}</span><span class="label">Présents</span></div></div>
                    ${event.capacity ? `
                    <div class="stat-circle progres flex ">
                        <svg width="80" height="80" viewBox="0 0 80 80">
                            <circle class="track" cx="40" cy="40" r="36" stroke="#e0e0e0" stroke-width="8" fill="none"/>
                            <circle class="progress-ring" cx="40" cy="40" r="36" stroke="#4ade80" stroke-width="8" fill="none"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 40 40)"/>
                            <text x="40" y="45" text-anchor="middle" class="progress-text">${fillRate}%</text>
                        </svg>
                        <span class="">Remplissage</span>
                    </div>` : ''}
                </div>
                <div class="event-status">
                    <i class="fas ${event.active ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}"></i>
                    <span>${event.active ? 'Actif' : 'Inactif'}</span>
                </div>
            </div>
            <div class="event-actions" onclick="event.stopPropagation()">
                <button class="action-btn" onclick="selectEvent('${event.id}')" title="Voir les invités">
                    <i class="fas fa-users"></i>
                </button>
            </div>
        </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SÉLECTION D'ÉVÉNEMENT
// ═══════════════════════════════════════════════════════════════
async function selectEvent(eventId) {
    const event = storage.getEventById(eventId);
    if (!event) {
        await showInvalidEventError(eventId);
        return;
    }

    currentEventId = eventId;
    history.pushState(null, '', `?event=${eventId}`);
    
    renderEventHeader(event);
    await loadGuestsByEvent(eventId);
    
    document.getElementById('guestsActionsBar').style.display = 'flex';
    document.getElementById('importCsvBtn').style.display = 'inline-flex';
    document.getElementById('addGuestBtn').style.display = 'inline-flex';
    
    reinitializeHeaderButtons();
}

function renderEventHeader(event) {
    const header = document.getElementById('dynamicHeaderEvent');
    const guests = storage.getGuestsByEventId(event.id);
    const scanned = guests.filter(g => g.scanned).length;
    const date = new Date(event.date);
    const isUpcoming = date >= new Date();
    const formattedDate = date.toLocaleDateString('fr-FR', { 
        day: 'numeric', month: 'long', year: 'numeric' 
    });

    const images = {
        marriage: 'https://images.unsplash.com/photo-1519741497674-611481863552',
        anniversaire: 'https://images.unsplash.com/photo-1569415860599-5514567fde28?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8JUVDJTgzJTlEJUVDJTlEJUJDJTIwJUVDJUI0JTlCJUVCJUI2JTg4fGVufDB8fDB8fHww&fm=jpg&q=60&w=3000',
        conference: 'https://images.unsplash.com/photo-1540575467063-868f79e66c3f',
        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e'
    };
    
    const labels = {
        marriage: { label: 'MARIAGE', color: '#fb923c' },
        anniversaire: { label: 'ANNIVERSAIRE', color: '#fb923c' },
        conference: { label: 'CONFÉRENCE', color: '#3b82f6' },
        autre: { label: 'AUTRE', color: '#6b7280' }
    };
    
    const type = labels[event.type] || { label: event.type.toUpperCase(), color: '#6b7280' };
    const bg = images[event.type] || images.autre;
    const fillRate = event.capacity ? Math.round((guests.length / event.capacity) * 100) : 0;
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (fillRate / 100) * circumference;

    header.innerHTML = `
        <div class="event-header-pro" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.8)), url('${bg}');">
            ${isUpcoming ? '<div class="upcoming-ribbon-pro">À VENIR</div>' : ''}
            
            <div class="event-type-badge-pro" style="background: ${type.color};">
                ${type.label}
            </div>

            <div class="event-header-content">
                <div class="event-main-info">
                    <h1 class="event-title-pro">${event.name}</h1>
                    <div class="event-meta-pro">
                        <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
                        ${event.time ? `<span><i class="fas fa-clock"></i> ${event.time}</span>` : ''}
                        ${event.location ? `<span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>` : ''}
                    </div>
                </div>

                <div class="event-stats-pro">
                    <div class="stat-item">
                        <div class="stat-value">${guests.length}</div>
                        <div class="stat-label">Invités</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value success">${scanned}</div>
                        <div class="stat-label">Présents</div>
                    </div>
                    
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        document.getElementById('importCsvBtn').onclick = openCsvImportModal;
        document.getElementById('addGuestBtn').onclick = () => openGuestModal();
    }, 100);
}

// ═══════════════════════════════════════════════════════════════
// 📥 CHARGEMENT & RENDU INVITÉS
// ═══════════════════════════════════════════════════════════════
async function loadGuestsByEvent(eventId) {
    currentEventId = eventId;
    currentGuests = storage.getGuestsByEventId(eventId);
    await renderGuestsTable();
}

async function renderGuestsTable(research = false) {
    if (isRenderingGuests) return;
    isRenderingGuests = true;

    const container = document.getElementById('mainContent');

    if(research){
        if(currentGuests.length === 0){
    container.innerHTML = `
        <div class="empty-state animate-fade-in">
            <i class="fas fa-search text-6xl mb-4 text-gray-400"></i>
            <h3>Aucun invité trouvé</h3>
            <p>Aucun résultat ne correspond à votre recherche.</p>
            <button class="btn btn-primary" onclick="resetGuestSearch()">
                Réinitialiser la recherche
            </button>
        </div>
    `;
    isRenderingGuests = false;
    return;
}

        }

    
    
    if (currentGuests.length === 0) {
        container.innerHTML = `
            <div class="empty-state animate-fade-in">
                <i class="fas fa-user-friends text-6xl mb-4 text-gray-400"></i>
                <h3>Aucun invité</h3>
                <p>Cet événement est vide pour le moment</p>
                <button class="btn btn-primary" onclick="openGuestModal()">
                     Ajouter le premier invité
                </button>
            </div>
        `;
        isRenderingGuests = false;
        return;
    }

    container.innerHTML = `
        <div class="table-container" id="guestsTableContainer">
            <table class="data-table" id="guestsTable">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAllGuests"></th>
                        <th>Invité</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Statut</th>
                        <th>Notes</th>
                        <th>QR</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="guestsTableBody"></tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById('guestsTableBody');
    guestRowCache.clear();

    currentGuests.forEach((guest, i) => {
        const row = createGuestRowElement(guest);
        row.style.animationDelay = `${i * 0.05}s`;
        guestRowCache.set(guest.id, row);
        tbody.appendChild(row);
    });

    document.getElementById('selectAllGuests').onchange = handleSelectAll;
    document.querySelectorAll('.guest-checkbox').forEach(cb => {
        cb.addEventListener('change', handleGuestSelect);
    });

    isRenderingGuests = false;
}

// ...existing code...
function createGuestRowElement(guest) {
    const tr = document.createElement('tr');
    tr.className = `guest-row-pro ${guest.scanned ? 'scanned' : ''}`;
    tr.setAttribute('data-guest-id', guest.id);
    tr.innerHTML = createGuestRowHTML(guest);

    tr.addEventListener('click', (e) => {
        const interactiveTags = ['input', 'button', 'a', 'svg', 'path', 'textarea', 'select', 'label'];
        const interactiveClasses = ['action-btns', 'icon-btn', 'share-btn', 'email-link', 'guest-avatar-pro'];

        let el = e.target;
        while (el && el !== tr) {
            // tag check
            if (el.tagName && interactiveTags.includes(el.tagName.toLowerCase())) return;
            // class check
            if (el.classList) {
                for (const cls of interactiveClasses) {
                    if (el.classList.contains(cls)) return;
                }
            }
            el = el.parentElement;
        }

        const checkbox = tr.querySelector('.guest-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    const cb = tr.querySelector('.guest-checkbox');
    cb?.addEventListener('change', handleGuestSelect);

    return tr;
}

function createGuestRowHTML(guest) {

    const clean = value => {
        if (!value || value.trim() === '' || value.trim() === '-' || value.trim().toLowerCase() === 'null') {
            return '';
        }
        return value.trim();
    };

    // Nettoyage des données
    const firstName = clean(guest.firstName);
    const lastName = clean(guest.lastName);
    const company = clean(guest.company);
    const email = clean(guest.email);
    const phone = clean(guest.phone);
    const notes = clean(guest.notes);
    const scanned = guest.scanned;

    // Avatar et couleurs
    const color = stringToColor(`${firstName} ${lastName}`);
    const initials = `${firstName[0] || '?'}${lastName[0] || ''}`.toUpperCase();

    return `
        <td><input type="checkbox" class="guest-checkbox" value="${guest.id}"></td>
        <td>
            <div class="guest-info">
                <div class="guest-avatar-pro" style="background:${color}">${initials}</div>
                <div>
                    <div class="guest-name">${firstName || ''} ${lastName || ''}</div>
                    ${company ? `<div class="guest-company">${company}</div>` : ''}
                </div>
            </div>
        </td>
        <td>${email ? `<a href="mailto:${email}" class="email-link">${email}</a>` : '-'}</td>
        <td>${phone || '-'}</td>
        <td>
            <span class="status-badge-pro ${scanned ? 'present' : 'pending'}">
                <i class="bi ${scanned ? 'bi-check-circle-fill' : 'bi-clock'}"></i>
                ${scanned ? 'Présent' : 'En attente'}
            </span>
        </td>
        <td>${notes || '-'}</td>
        <td>
            ${storage.getQRCodeByGuestId(guest.id) 
                ? '<i class="bi bi-qr-code qr-ready"></i>' 
                : '<i class="bi bi-qr-code qr-missing"></i>'
            }
        </td>
        <td>
            <div class="action-btns">
                <button class="icon-btn" onclick="editGuest('${guest.id}')" title="Modifier">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="icon-btn" onclick="viewGuestQR('${guest.id}')" title="QR Code">
                    <i class="bi bi-qr-code"></i>
                </button>
                <button class="icon-btn" onclick="shareGuest('${guest.id}')" title="Partager">
                    <i class="bi bi-share"></i>
                </button>
                <button class="icon-btn delete" onclick="deleteGuest('${guest.id}')" title="Supprimer">
                    <i class="bi bi-trash3"></i>
                </button>
                <button class="icon-btn" onclick="generateTicketForGuest('${guest.id}')" title="Générer Billet">
                    <i class="bi bi-ticket-perforated"></i>
                </button>
            </div>
        </td>
    `;
}



// ═══════════════════════════════════════════════════════════════
// 🔄 MISE À JOUR GRANULAIRE DES LIGNES
// ═══════════════════════════════════════════════════════════════
function insertGuestRow(guest) {
    const tbody = document.getElementById('guestsTableBody');
    if (!tbody) return;

    if (guestRowCache.has(guest.id)) {
        const existingRow = guestRowCache.get(guest.id);

        if (existingRow && document.body.contains(existingRow)) {
            updateGuestRow(guest);
            return;
        }

        const recreated = createGuestRowElement(guest);
        guestRowCache.set(guest.id, recreated);
        tbody.insertBefore(recreated, tbody.firstChild);
        requestAnimationFrame(() => {
            recreated.style.transition = 'all 0.4s ease';
            recreated.style.opacity = '1';
            recreated.style.transform = 'translateX(0)';
        });
        currentGuests.unshift(guest);
        recreated.querySelector('.guest-checkbox')?.addEventListener('change', handleGuestSelect);
        return;
    }

    const emptyState = document.querySelector('.empty-state-pro');
    if (emptyState) {
        renderGuestsTable();
        return;
    }

    const row = createGuestRowElement(guest);
    guestRowCache.set(guest.id, row);

    row.style.opacity = '0';
    row.style.transform = 'translateX(-20px)';
    
    tbody.insertBefore(row, tbody.firstChild);

    requestAnimationFrame(() => {
        row.style.transition = 'all 0.4s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateX(0)';
    });

    currentGuests.unshift(guest);
    
    const checkbox = row.querySelector('.guest-checkbox');
    checkbox?.addEventListener('change', handleGuestSelect);
}

function updateGuestRow(guest) {
    const row = guestRowCache.get(guest.id);
    if (!row) return;

    const oldHTML = row.innerHTML;
    const newHTML = createGuestRowHTML(guest);

    if (oldHTML !== newHTML) {
        row.style.transition = 'opacity 0.2s';
        row.style.opacity = '0.5';

        setTimeout(() => {
            row.innerHTML = newHTML;
            row.className = `guest-row-pro ${guest.scanned ? 'scanned' : ''}`;
            row.style.opacity = '1';
            
            const checkbox = row.querySelector('.guest-checkbox');
            checkbox?.addEventListener('change', handleGuestSelect);
        }, 200);
    }

    const index = currentGuests.findIndex(g => g.id === guest.id);
    if (index !== -1) {
        currentGuests[index] = guest;
    }
}

function removeGuestRow(guestId) {
    const row = guestRowCache.get(guestId);
    if (!row) return;

    row.style.transition = 'all 0.3s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(20px)';

    setTimeout(() => {
        row.remove();
        guestRowCache.delete(guestId);
        currentGuests = currentGuests.filter(g => g.id !== guestId);

        if (currentGuests.length === 0) {
            renderGuestsTable();
        }
    }, 300);
}

// ═══════════════════════════════════════════════════════════════
// 🎧 LISTENERS
// ═══════════════════════════════════════════════════════════════
function initializeGuestListeners() {
    setupSearch();
    setupExportButtons();
    setupCsvImport();
    
    const guestForm = document.getElementById('guestForm');
    if (guestForm) {
        guestForm.addEventListener('submit', handleGuestSubmit);
    }

    window.addEventListener('popstate', checkUrlParams);
}

function reinitializeHeaderButtons() {
    setTimeout(() => {
        const importBtn = document.getElementById('importCsvBtn');
        const addBtn = document.getElementById('addGuestBtn');
        if (importBtn) importBtn.onclick = openCsvImportModal;
        if (addBtn) addBtn.onclick = () => openGuestModal();
    }, 100);
}

function setupSearch() {
    const search = document.getElementById('searchGuests');
    if (search) {
        search.addEventListener('input', debounce(handleGuestSearch, 300));
    }
}

function setupExportButtons() {
    const csv = document.getElementById('exportCsvBtn');
    const json = document.getElementById('exportJsonBtn');
    const deleteSelected = document.getElementById('deleteSelectedBtn');
    
    if (csv) csv.addEventListener('click', exportGuestsToCSV);
    if (json) json.addEventListener('click', exportGuestsToJSON);
    if (deleteSelected) deleteSelected.addEventListener('click', deleteSelectedGuests);
}

function setupCsvImport() {
    const dropZone = document.getElementById('csvDropZone');
    const fileInput = document.getElementById('csvFileInput');
    const confirmBtn = document.getElementById('confirmCsvImport');
    const templateLink = document.getElementById('downloadTemplate');

    if (dropZone) {
        dropZone.addEventListener('dragover', e => { 
            e.preventDefault(); 
            dropZone.classList.add('dragover'); 
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) processCsvFile(file);
        });
    }
    
    if (fileInput) fileInput.addEventListener('change', e => {
        if (e.target.files[0]) processCsvFile(e.target.files[0]);
    });
    
    if (confirmBtn) confirmBtn.addEventListener('click', confirmCsvImportAction);
    if (templateLink) templateLink.addEventListener('click', e => { 
        e.preventDefault(); 
        downloadCsvTemplate(); 
    });
}

// ═══════════════════════════════════════════════════════════════
// 🔍 RECHERCHE
// ═══════════════════════════════════════════════════════════════
function handleGuestSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length === 0) {
        currentGuests = storage.getGuestsByEventId(currentEventId);
    } else {
        currentGuests = storage.getGuestsByEventId(currentEventId).filter(g =>
            g.firstName.toLowerCase().includes(query) ||
            g.lastName.toLowerCase().includes(query) ||
            g.email.toLowerCase().includes(query) ||
            (g.phone && g.phone.includes(query)) ||
            (g.company && g.company.toLowerCase().includes(query))
        );
    }
    
    renderGuestsTable(true);
}

function resetGuestSearch() {
    const searchInput = document.getElementById('searchGuests');
    if (searchInput) searchInput.value = '';
    currentGuests = storage.getGuestsByEventId(currentEventId);
    renderGuestsTable();
}


// ═══════════════════════════════════════════════════════════════
// ✅ SÉLECTION
// ═══════════════════════════════════════════════════════════════
function handleSelectAll(e) {
    document.querySelectorAll('.guest-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
    });
    updateSelectedGuests();
}

function handleGuestSelect() {
    updateSelectedGuests();
}

function updateSelectedGuests() {
    selectedGuests = Array.from(document.querySelectorAll('.guest-checkbox:checked'))
        .map(cb => cb.value);
    
    const btn = document.getElementById('deleteSelectedBtn');
    const count = document.getElementById('selectedCount');
    
    if (btn && count) {
        btn.style.display = selectedGuests.length > 0 ? 'inline-flex' : 'none';
        count.textContent = selectedGuests.length;
    }
}

// ═══════════════════════════════════════════════════════════════
// 📝 MODAL & FORMULAIRE
// ═══════════════════════════════════════════════════════════════
function openGuestModal(guestId = null) {
    if (!currentEventId) {
        showNotification('warning', 'Aucun événement sélectionné');
        return;
    }
    
    const modal = document.getElementById('guestModal');
    const form = document.getElementById('guestForm');
    const title = document.getElementById('guestModalTitle');
    
    form.reset();
    document.getElementById('guestEventId').value = currentEventId;

    if (guestId) {
        const guest = storage.getGuestById(guestId);
        if (guest) {
            document.getElementById('guestId').value = guest.id;
            document.getElementById('guestFirstName').value = guest.firstName;
            document.getElementById('guestLastName').value = guest.lastName;
            document.getElementById('guestEmail').value = guest.email;
            document.getElementById('guestPhone').value = guest.phone || '';
            document.getElementById('guestCompany').value = guest.company || '';
            document.getElementById('guestNotes').value = guest.notes || '';
            title.innerHTML = '<i class="fas fa-user-edit"></i> Modifier l\'invité';
        }
    } else {
        title.innerHTML = '<i class="fas fa-user-plus"></i> Ajouter un invité';
    }
    
    modal.classList.add('active');
    document.getElementById('guestFirstName')?.focus();
}

function closeGuestModal() {
    document.getElementById('guestModal')?.classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════
// ✅ VALIDATION
// ═══════════════════════════════════════════════════════════════
async function validateGuestForm(data) {
    const errors = [];

    if (!data.firstName || data.firstName.trim().length < 2) {
        errors.push('Le prénom doit contenir au moins 2 caractères.');
    }
    if (data.firstName && data.firstName.length > 50) {
        errors.push('Le prénom ne peut pas dépasser 50 caractères.');
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
        errors.push('Le nom doit contenir au moins 2 caractères.');
    }
    if (data.lastName && data.lastName.length > 50) {
        errors.push('Le nom ne peut pas dépasser 50 caractères.');
    }

    if (!data.email || !validateEmail(data.email)) {
        errors.push('Veuillez entrer une adresse e-mail valide.');
    }

    if (data.phone && !validatePhone(data.phone)) {
        errors.push('Le numéro de téléphone n\'est pas valide.');
    }

    if (data.company && data.company.length > 100) {
        errors.push('L’entreprise ne peut pas dépasser 100 caractères.');
    }
    if (data.notes && data.notes.length > 500) {
        errors.push('Les notes ne peuvent pas dépasser 500 caractères.');
    }

    if (errors.length > 0) {
        const errorHtml = errors.map(err => `• ${err}`).join('<br>');
        await Swal.fire({
            icon: 'error',
            title: 'Validation échouée',
            html: errorHtml,
            confirmButtonColor: '#D97706',
            customClass: { popup: 'animated shake faster' }
        });
        return false;
    }
    return true;
}

// ═══════════════════════════════════════════════════════════════
// 📝 SOUMISSION FORMULAIRE INVITÉ
// ═══════════════════════════════════════════════════════════════
async function handleGuestSubmit(e) {
    e.preventDefault();

    const guestId = document.getElementById('guestId').value;
    const formData = {
        id: guestId || undefined,
        eventId: currentEventId,
        firstName: document.getElementById('guestFirstName').value.trim(),
        lastName: document.getElementById('guestLastName').value.trim(),
        email: document.getElementById('guestEmail').value.trim().toLowerCase(),
        phone: document.getElementById('guestPhone').value.trim(),
        company: document.getElementById('guestCompany').value.trim(),
        notes: document.getElementById('guestNotes').value.trim()
    };

    // Validation complète
    if (!(await validateGuestForm(formData))) return;

    const isEdit = !!guestId;
    const action = isEdit ? 'mise à jour' : 'création';
    const loadingSwal =  Swal.fire({
        title: isEdit ? 'Mise à jour...' : 'Création...',
        text: `Veuillez patienter pendant ${action} de l'invité`,
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        let result;
        if (isEdit) {
            result = await storage.updateGuest(guestId, formData);
        } else {
            result = await storage.createGuest(formData);
        }

        if (!result || result.error) {
            throw new Error(result?.message || `Échec de ${action}`);
        }

        await loadingSwal.close();
        closeGuestModal();

        // Mise à jour granulaire sans rerender complet
        if (formData.eventId === currentEventId) {
            if (isEdit) {
                updateGuestRow(result);
            } else {
                insertGuestRow(result);
            }
        }

        await Swal.fire({
            icon: 'success',
            title: isEdit ? 'Mis à jour !' : 'Ajouté !',
            text: isEdit
                ? `${result.firstName} ${result.lastName} a été modifié avec succès.`
                : `${result.firstName} ${result.lastName} a été ajouté à l'événement.`,
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false,
            customClass: { popup: 'animated bounceIn faster' }
        });

    } catch (err) {
        console.error(`🚨 Erreur ${action} invité:`, err);
        await loadingSwal.close();

        await Swal.fire({
            icon: 'error',
            title: 'Échec',
            text: err.message.includes('connexion') || !navigator.onLine
                ? 'Connexion impossible. Mode hors-ligne activé.'
                : err.message || `Impossible de ${isEdit ? 'modifier' : 'créer'} l'invité.`,
            confirmButtonColor: '#D97706',
            customClass: { popup: 'animated shake faster' }
        });
    }
}


// ═══════════════════════════════════════════════════════════════
// ✏️ EDIT GUEST - OUVERTURE MODAL AVEC PRÉ-REMPLISSAGE SÉCURISÉ
// ═══════════════════════════════════════════════════════════════
function editGuest(id) {
    const guest = storage.getGuestById(id);
    if (!guest) {
        showNotification('error', 'Invité introuvable');
        return;
    }

    // Réinitialisation sécurisée du formulaire
    const form = document.getElementById('guestForm');
    const modal = document.getElementById('guestModal');
    const title = document.getElementById('guestModalTitle');

    form.reset();
    document.getElementById('guestId').value = guest.id;
    document.getElementById('guestEventId').value = guest.eventId;
    document.getElementById('guestFirstName').value = guest.firstName;
    document.getElementById('guestLastName').value = guest.lastName;
    document.getElementById('guestEmail').value = guest.email;
    document.getElementById('guestPhone').value = guest.phone || '';
    document.getElementById('guestCompany').value = guest.company || '';
    document.getElementById('guestNotes').value = guest.notes || '';

    title.innerHTML = `
        <i class="fas fa-user-edit text-amber-600"></i>
        <span class="ml-2">Modifier l'invité</span>
    `;

    modal.classList.add('active');
    document.getElementById('guestFirstName').focus();
}


function openModal(id, contentHTML) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');

    const body = modal.querySelector('.modal-body');
    body.innerHTML = contentHTML;
    modal.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');

}



// ═══════════════════════════════════════════════════════════════
// QR CODE GUEST VIEW – ÉDITION ULTRA PREMIUM 2025
// ═══════════════════════════════════════════════════════════════
async function viewGuestQR(id) {
    const guest = storage.getGuestById(id);
    const event = storage.getEventById(guest.eventId);
    if (!guest || !event) return showNotification('error', 'Invité ou événement introuvable');

    const qrRecord = storage.getQRCodeByGuestId(id);
    if (!qrRecord) {
        return showNotification('warning', 'QR Code non généré pour cet invité');
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

    // Couleur d'accent personnalisée pour l'avatar
    const accentColor = stringToColor(`${guest.firstName} ${guest.lastName}`);
    const initials = `${guest.firstName[0]}${guest.lastName[0]}`.toUpperCase();

    // Date formatée élégamment
    const eventDate = new Date(event.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const scannedStatus = guest.scanned 
        ? `<span class="status-badge success"><i class="bi bi-check-circle-fill"></i> Présent</span><small class="block mt-1 opacity-80">Le ${new Date(guest.scannedAt).toLocaleString('fr-FR')}</small>`
        : `<span class="status-badge pending"><i class="bi bi-hourglass-split"></i> En attente</span>`;

    openModal('qrPreviewModal', `
        <div class="qr-modal-content animate-fadeIn">
            <!-- En-tête élégante -->
            <div class="modal-header-premium">
                <div class="flex items-center gap-4" style="dispay:flex; align-items:center;">
                    <div class="avatar-glow" style="background: ${accentColor}">
                        <span class="avatar-initials">${initials}</span>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">${guest.firstName} ${guest.lastName}</h2>
                        <p class="text-lg opacity-90 flex items-center gap-2 mt-1">
                            <i class="bi bi-ticket-perforated text-var(--secura-red)"></i>
                            <span>${event.name}</span>
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    ${scannedStatus}
                </div>
            </div>

            <!-- QR Code avec effet glow premium -->
            <div class="qr-container-glow mt-8">
                <div class="qr-frame">
                    <img src="${qrImageUrl}" alt="QR Code de ${guest.firstName}" class="qr-image" />
                    <div class="qr-overlay">
                        <i class="bi bi-shield-check text-white text-6xl opacity-30"></i>
                    </div>
                </div>
                <p class="text-center mt-4 text-gray-600 dark:text-gray-400 font-medium">
                    <i class="bi bi-qr-code-scan"></i> Scannez pour valider l'entrée
                </p>
            </div>

            <!-- Informations détaillées -->
            <div class="info-grid mt-8">
                <div class="info-card">
                    <i class="bi bi-calendar-event"></i>
                    <div>
                        <small>Date de l'événement</small>
                        <strong>${eventDate}</strong>
                    </div>
                </div>
                ${event.time ? `
                <div class="info-card">
                    <i class="bi bi-clock"></i>
                    <div>
                        <small>Heure</small>
                        <strong>${event.time}</strong>
                    </div>
                </div>` : ''}
                ${event.location ? `
                <div class="info-card">
                    <i class="bi bi-geo-alt-fill"></i>
                    <div>
                        <small>Lieu</small>
                        <strong>${event.location}</strong>
                    </div>
                </div>` : ''}
                <div class="info-card">
                    <i class="bi bi-envelope"></i>
                    <div>
                        <small>Email</small>
                        <strong>${guest.email || '—'}</strong>
                    </div>
                </div>
                <div class="info-card">
                    <i class="bi bi-telephone"></i>
                    <div>
                        <small>Téléphone</small>
                        <strong>${guest.phone || '—'}</strong>
                    </div>
                </div>
                ${guest.company ? `
                <div class="info-card">
                    <i class="bi bi-building"></i>
                    <div>
                        <small>Entreprise</small>
                        <strong>${guest.company}</strong>
                    </div>
                </div>` : ''}
            </div>

            <!-- Actions premium -->
            <div class="modal-actions-premium mt-8">
                <button onclick="copyQRToClipboard('${qrImageUrl}')" class="btn-action secondary">
                    <i class="bi bi-clipboard-check"></i> Copier
                </button>
                <button onclick="downloadQRImage('${qrImageUrl}', 'QR_${guest.firstName}-${guest.lastName}')" class="btn-action primary">
                    <i class="bi bi-download"></i> Télécharger
                </button>
                <button onclick="shareGuest('${id}')" class="btn-action success">
                    <i class="bi bi-share-fill"></i> Partager
                </button>
            </div>
        </div>
    `, { width: '620px' });

    // Animation d'apparition fluide
    setTimeout(() => {
        document.querySelectorAll('.qr-modal-content > *').forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'all 0.5s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, i * 100);
        });
    }, 100);
}

function adjustBrightness(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+(Math.min(255, Math.max(0, parseInt(color, 16) + amount))).toString(16)).substr(-2));
}



// Fonctions utilitaires pour SweetAlert
window.copyQRToClipboard = async (dataUrl) => {
    try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showNotification('success', 'QR Code copié !');
    } catch {
        showNotification('error', 'Échec copie');
    }
};

window.downloadQRImage = (dataUrl, name) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${name.replace(/[^a-z0-9]/gi, '_')}.png`;
    a.click();
};

// ═══════════════════════════════════════════════════════════════
// 📤 SHARE GUEST - MODAL PARTAGE ULTRA-COMPLET
// ═══════════════════════════════════════════════════════════════
async function shareGuest(id) {
    const guest = storage.getGuestById(id);
    const event = storage.getEventById(guest.eventId);
    if (!guest || !event) return;

    const qr = storage.getQRCodeByGuestId(id);
    if (!qr) {
        showNotification('warning', 'QR Code manquant');
        return;
    }

    const qrData = typeof qr.data === 'string' ? JSON.parse(qr.data) : qr.data;
    const size = 200;
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
        // Génération du QR Code temporaire
        new QRCode(tempDiv, {
            text: JSON.stringify(qrData),
            width: size,
            height: size,
            colorDark: '#D97706',
            colorLight: '#FFFFFF',
            correctLevel: QRCode.CorrectLevel.H
        });

        await new Promise(r => setTimeout(r, 100));
        const canvas = tempDiv.querySelector('canvas');
        const qrUrl = canvas?.toDataURL('image/png') || '';

        const shareUrl = `${window.location.origin}/verify.html?qr=${encodeURIComponent(JSON.stringify(qrData))}`;
        const message = `Bonjour ${guest.firstName},\n\nVous êtes invité(e) à *${event.name}* !\n📅 ${new Date(event.date).toLocaleDateString('fr-FR')}${event.time ? `\n🕐 ${event.time}` : ''}${event.location ? `\n📍 ${event.location}` : ''}\n\nScannez ce QR Code à l'entrée.\n\nLien direct : ${shareUrl}`;

        // Contenu du modal
        const contentHTML = `
            <div class="share-container">
                <div class="share-header">
                    <div class="share-avatar">
                        <img src="${qrUrl}" alt="QR Code">
                    </div>
                    <h3>${guest.firstName} ${guest.lastName}</h3>
                    <p class="event-name">${event.name}</p>
                </div>

                <div class="share-grid">
                    <button class="share-btn email" data-action="email"><i class="bi bi-envelope-fill"></i><span>Email</span></button>
                    <button class="share-btn whatsapp" data-action="whatsapp"><i class="bi bi-whatsapp"></i><span>WhatsApp</span></button>
                    <button class="share-btn sms" data-action="sms"><i class="bi bi-chat-dots-fill"></i><span>SMS</span></button>
                    <button class="share-btn link" data-action="copy"><i class="bi bi-link-45deg"></i><span>Copier le lien</span></button>
                    <button class="share-btn qr" data-action="qr"><i class="bi bi-qr-code"></i><span>Copier QR Code</span></button>
                </div>

                <div class="share-url">${shareUrl}</div>
            </div>
        `;

        openModal('shareGuestModal', contentHTML);

        // Boutons de partage
        setTimeout(() => {
            document.querySelectorAll('#shareGuestModal .share-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const action = btn.dataset.action;
                   switch (action) {
                    case 'email':
                        if (!guest.email) { showNotification('warning', 'Email manquant'); break; }
                        showNotification('info', 'Redirection vers le client mail...');
                        window.location.href = `mailto:${guest.email}?subject=Invitation%20-%20${encodeURIComponent(event.name)}&body=${encodeURIComponent(message)}`;
                        break;

                    case 'whatsapp':
                        if (!guest.phone) { showNotification('warning', 'Téléphone manquant'); break; }
                        showNotification('info', 'Ouverture de WhatsApp...');
                        window.open(`https://wa.me/${guest.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                        break;

                    case 'sms':
                        if (!guest.phone) { showNotification('warning', 'Téléphone manquant'); break; }
                        showNotification('info', 'Ouverture de l’application SMS...');
                        window.location.href = `sms:${guest.phone}?body=${encodeURIComponent(message)}`;
                        break;

                    case 'copy':
                        await navigator.clipboard.writeText(shareUrl);
                        showNotification('success', 'Lien copié avec succès !');
                        break;

                    case 'qr':
                        canvas.toBlob(blob => {
                            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                                .then(() => showNotification('success', 'QR Code copié avec succès !'))
                                .catch(() => showNotification('error', 'Échec lors de la copie du QR Code'));
                        });
                        break;
                }

                });
            });
        }, 300);

    } catch (err) {
        console.error(err);
        showNotification('error', 'Erreur de partage');
    } finally {
        document.body.removeChild(tempDiv);
    }
}



// ═══════════════════════════════════════════════════════════════
// 🔗 FONCTIONS UTILITAIRES (déjà utilisées ailleurs)
// ═══════════════════════════════════════════════════════════════
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
}

async function generateTicketForGuest(guestId){
     const guest = storage.getGuestById(guestId);
    if (!guest) return;
    window.location.href = `ticket-generator.html?event=${guest.eventId}&guest=${guestId}`;
}
// ═══════════════════════════════════════════════════════════════
// 🗑️ SUPPRESSION INVITÉ
// ═══════════════════════════════════════════════════════════════
async function deleteGuest(id) {
    const guest = storage.getGuestById(id);
    if (!guest) return;

    const result = await Swal.fire({
        icon: 'warning',
        title: 'Supprimer cet invité ?',
        html: `
            <div class="text-left">
                <p><strong>${guest.firstName} ${guest.lastName}</strong></p>
            ${guest.email != '-' ? `<p class="text-sm text-gray-600">${guest.email}</p>` : ''}
            ${guest.company != '-' ? `<p class="text-sm">${guest.company}</p>` : ''}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        reverseButtons: true,
        customClass: {
            popup: 'animated fadeInDown faster',
            confirmButton: 'btn-danger-animate',
            cancelButton: 'btn-cancel-animate'
        }
    });

    if (!result.isConfirmed) return;

    const loading = Swal.fire({
        title: 'Suppression...',
        icon: 'info',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const success = await storage.deleteGuest(id);
        if (!success) throw new Error('Échec de l’API');

        await loading.close();
        removeGuestRow(id);

        await Swal.fire({
            icon: 'success',
            title: 'Supprimé',
            text: `${guest.firstName} ${guest.lastName} a été retiré.`,
            timer: 1800,
            showConfirmButton: false
        });

    } catch (err) {
        await loading.close();
        await Swal.fire({
            icon: 'error',
            title: 'Échec',
            text: 'Impossible de supprimer l’invité.',
            confirmButtonColor: '#D97706'
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// 🗑️ SUPPRESSION MULTIPLE
// ═══════════════════════════════════════════════════════════════
async function deleteSelectedGuests() {
    if (selectedGuests.length === 0) return;

    const count = selectedGuests.length;
    const result = await Swal.fire({
        icon: 'warning',
        title: `Supprimer ${count} invité(s) ?`,
        text: 'Cette action est irréversible.',
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        reverseButtons: true,
        customClass: { popup: 'animated fadeInDown faster' }
    });

    if (!result.isConfirmed) return;

    const loading = Swal.fire({
        title: 'Suppression en cours...',
        icon: 'info',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        await storage.deleteMultipleGuests(selectedGuests);
        await loading.close();

        selectedGuests.forEach(id => removeGuestRow(id));
        selectedGuests = [];

        document.getElementById('selectAllGuests').checked = false;
        document.getElementById('deleteSelectedBtn').style.display = 'none';

        await Swal.fire({
            icon: 'success',
            title: 'Supprimés',
            text: `${count} invité(s) ont été supprimés.`,
            timer: 2000,
            showConfirmButton: false
        });

    } catch (err) {
        await loading.close();
        await Swal.fire({
            icon: 'error',
            title: 'Échec',
            text: 'Certains invités n’ont pas pu être supprimés.',
            confirmButtonColor: '#D97706'
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORT CSV & JSON
// ═══════════════════════════════════════════════════════════════
async function exportGuestsToCSV() {
    const event = storage.getEventById(currentEventId);
    if (!event) return;

    const csvContent = storage.exportToCSV(currentEventId);
    const filename = `${event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invites_${new Date().toISOString().split('T')[0]}.csv`;

    if (await downloadFile(csvContent, filename, 'text/csv')) {
        await Swal.fire({
            icon: 'success',
            title: 'Exporté !',
            text: `Fichier CSV téléchargé : ${filename}`,
            timer: 2000,
            showConfirmButton: false
        });
    }
}

async function exportGuestsToJSON() {
    const event = storage.getEventById(currentEventId);
    if (!event) return;

    const data = {
        event: { id: event.id, name: event.name, date: event.date },
        guests: currentGuests,
        exportedAt: new Date().toISOString(),
        count: currentGuests.length
    };

    const jsonContent = JSON.stringify(data, null, 2);
    const filename = `${event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invites_${new Date().toISOString().split('T')[0]}.json`;

    if (await downloadFile(jsonContent, filename, 'application/json')) {
        Swal.fire({
            icon: 'success',
            title: 'Exporté !',
            text: `Fichier JSON téléchargé : ${filename}`,
            timer: 2000,
            showConfirmButton: false
        });
    }
}

function downloadFile(content, filename, type) {
    return new Promise(resolve => {
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            resolve(true);
        }, 100);
    });
}

// ═══════════════════════════════════════════════════════════════
// 📥 IMPORT CSV
// ═══════════════════════════════════════════════════════════════
function resetCsvImportState() {
    try {
        window.pendingCsvData = null;
        const fileInput = document.getElementById('csvFileInput');
        if (fileInput) {
            // permet de re-sélectionner le même fichier ensuite
            fileInput.value = '';
        }
        const rowCountEl = document.getElementById('csvRowCount');
        if (rowCountEl) rowCountEl.textContent = '0';
        const preview = document.getElementById('csvPreview');
        if (preview) preview.style.display = 'none';
        const table = document.getElementById('csvPreviewTable');
        if (table) table.innerHTML = '';
    } catch (e) {
        console.warn('resetCsvImportState failed', e);
    }
}

function openCsvImportModal() {
    const modal = document.getElementById('csvImportModal');
    if (!modal) return;

    modal.classList.add('active');

    // We no longer use the HTML confirm/import button as primary; hide it to avoid confusion.
    const htmlConfirm = document.getElementById('confirmCsvImport');
    if (htmlConfirm) htmlConfirm.style.display = 'none';

     resetCsvImportState();
    populateCsvEventSelector();

    // Hide drop zone until an event is selected
    const dropZone = document.getElementById('csvDropZone');
    if (dropZone) dropZone.style.display = 'none';

    // Create / reset selected event bar
    const selectedBarId = 'csvSelectedEventBar';
    let selectedBar = document.getElementById(selectedBarId);
    if (!selectedBar) {
        selectedBar = document.createElement('div');
        selectedBar.id = selectedBarId;
        selectedBar.className = 'csv-selected-bar';
        selectedBar.style.display = 'block';
        selectedBar.style.margin = '5px 10px 15px 0';
        selectedBar.style.padding = '10px';
        selectedBar.style.borderRadius = '8px';
        selectedBar.style.border = '1px solid #e6eef7';
        const previewPlaceholder = document.getElementById('csvPreviewPlaceholder');
        previewPlaceholder?.parentElement?.insertBefore(selectedBar, previewPlaceholder);
    }
    selectedBar.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div id="csvSelectedEventLabel" style="font-size:14px;">Aucun événement sélectionné</div>
            <div id="csvSelectedEventActions">
                <button class="btn btn-primary" id="csvSelectFocusBtn">Choisir un événement</button>
            </div>
        </div>
    `;
    document.getElementById('csvSelectFocusBtn')?.addEventListener('click', () => {
        const sel = document.getElementById('csvEventSelector');
        if (sel) sel.focus();
    });

    window.pendingCsvData = null;
    const table = document.getElementById('csvPreviewTable');
    if (table) table.innerHTML = '';
    const rowCount = document.getElementById('csvRowCount');
    if (rowCount) rowCount.textContent = '0';
}


function populateCsvEventSelector() {
    const select = document.getElementById('csvEventSelector');
    if (!select) return;

    const events = storage.getActiveEvents();
    select.innerHTML = '<option value="">-- Choisir un événement --</option>' +
        events.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${new Date(e.date).toLocaleDateString('fr-FR')})</option>`).join('');

    const dropZone = document.getElementById('csvDropZone');
    if (dropZone) dropZone.style.display = 'none';

    // update selected bar when user picks an event
    select.onchange = () => {
        const val = select.value;
        const selectedLabelEl = document.getElementById('csvSelectedEventLabel');
        const preview = document.getElementById('csvPreview');
        const table = document.getElementById('csvPreviewTable');

        const actionBtn = document.getElementById('csvSelectFocusBtn');

        if (!val) {
            // no event chosen
            if (selectedLabelEl) selectedLabelEl.textContent = 'Aucun événement sélectionné';
            if (dropZone) dropZone.style.display = 'none';
            if (preview) preview.style.display = 'none';
            window.pendingCsvData = null;
            if (table) table.innerHTML = '';
            document.getElementById('csvRowCount').textContent = '0';
            // restore action button to "Choisir un événement"
            if (actionBtn) {
                actionBtn.textContent = 'Choisir un événement';
                actionBtn.onclick = () => select.focus();
                actionBtn.classList.remove('csv-change-btn');
            }
            return;
        }

        const ev = storage.getEventById(val);
        const name = ev ? `${ev.name} — ${new Date(ev.date).toLocaleDateString('fr-FR')}` : 'Événement sélectionné';
        if (selectedLabelEl) selectedLabelEl.textContent = name;

        if (dropZone) dropZone.style.display = 'block';
        if (preview) preview.style.display = 'none';

        if (actionBtn) {
            actionBtn.textContent = 'Changer';
            actionBtn.classList.add('csv-change-btn');
            actionBtn.onclick = () => {
                select.value = '';
                select.dispatchEvent(new Event('change'));
                select.focus();
            };
        }
    };
}


function processCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
        showNotification('error', 'Fichier non CSV');
        return;
    }
    const eventId = document.getElementById('csvEventSelector')?.value;
    if (!eventId) {
        showNotification('warning', 'Choisissez un événement avant d\'importer');
        return;
    }

    if (!window.Papa) {
        showNotification('error', 'Parser CSV non chargé');
        return;
    }

    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) fileInput.value = '';

    Swal.fire({
        title: 'Analyse du fichier...',
        icon: 'info',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            await Swal.close();
            if (results.data.length === 0) {
                showNotification('error', 'Aucun donnée trouvée');
                return;
            }
            displayCsvPreview(results.data);
        },
        error: async () => {
            await Swal.close();
            showNotification('error', 'Erreur de lecture CSV');
        }
    });
}

/**
 * Remplace l'aperçu HTML par un modal SweetAlert2 éditable (plein écran si besoin).
 * Permet : éditer les champs, "Enregistrer" localement (ne ferme pas le modal),
 * ou "Valider et importer" (confirm -> appelle confirmCsvImportAction).
 */
function displayCsvPreview(data) {
    if (!Array.isArray(data) || data.length === 0) {
        showNotification('error', 'Aucune donnée à afficher');
        return;
    }

    // clone pour éviter mutation directe avant sauvegarde explicite
    window.pendingCsvData = data.map(d => ({ ...d }));

    const headers = Object.keys(data[0] || {});
    const rowCount = data.length;

    // build html table (scrollable)
    let html = `<div style="max-height:60vh; overflow:auto; padding-top:6px;">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
    html += `<div><strong>${rowCount}</strong> ligne(s) détectée(s)</div>`;
    html += `<div style="font-size:13px;color:#6b7280">Invalides: <span id="sw_csv_invalid_count">0</span></div>`;
    html += `</div>`;
    html += `<div style="overflow:auto;border:1px solid #eee;border-radius:8px;padding:6px;background:#fff">`;
    html += `<table style="width:100%;border-collapse:collapse" class="sw-csv-table">`;
    html += `<thead><tr>`;
    headers.forEach(h => {
        html += `<th style="text-align:left;padding:6px;border-bottom:1px solid #eee">${escapeHtml(h)}</th>`;
    });
    html += `</tr></thead><tbody>`;

    data.forEach((row, i) => {
        html += `<tr id="sw_csv_row_${i}" style="border-bottom:1px solid #f7f7f7">`;
        headers.forEach(h => {
            const val = row[h] == null ? '' : String(row[h]);
            const safeKey = String(h).replace(/[^\w\-]/g, '_');
            html += `<td style="padding:6px"><input data-idx="${i}" data-key="${h}" id="sw_csv_${i}_${safeKey}" class="sw-csv-input" value="${escapeHtml(val)}" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid #e5e7eb;border-radius:6px" /></td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    html += `<div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end">`;
    html += `<button type="button" id="sw_csv_save_btn" class="btn btn-outline">Enregistrer les modifications</button>`;
    html += `</div>`;
    html += `</div>`;

    Swal.fire({
        title: 'Aperçu & édition du CSV',
        html,
        width: '90%',
        showCancelButton: true,
        showDenyButton: false,
        confirmButtonText: 'Valider et importer',
        cancelButtonText: 'Fermer',
        didOpen: () => {
            const inputs = Swal.getPopup().querySelectorAll('.sw-csv-input');
            const invalidCountEl = Swal.getPopup().querySelector('#sw_csv_invalid_count');

            const normalizeRow = (idx) => {
                const obj = {};
                headers.forEach(h => {
                    const safeKey = String(h).replace(/[^\w\-]/g, '_');
                    const el = document.getElementById(`sw_csv_${idx}_${safeKey}`);
                    obj[h] = el ? el.value : '';
                });
                return obj;
            };

            const isRowValid = (rowObj) => {
                const firstName = (rowObj['Prénom'] || rowObj['Prenom'] || rowObj['FirstName'] || rowObj['firstName'] || '').trim();
                const lastName = (rowObj['Nom'] || rowObj['LastName'] || rowObj['lastName'] || '').trim();
                const email = (rowObj['Email'] || rowObj['email'] || '').trim();
                const phone = (rowObj['Téléphone'] || rowObj['Telephone'] || rowObj['Phone'] || rowObj['phone'] || '').trim();
                if (!firstName || !lastName) return false;
                //if (email && !validateEmail(email)) return false;
                if (phone && !validatePhone(phone)) return false;
                return true;
            };

            const refreshInvalidMarks = () => {
                let invalid = 0;

                for (let i = 0; i < rowCount; i++) {
                    const normalized = normalizeRow(i);
                    const tr = document.getElementById(`sw_csv_row_${i}`);

                    if (!isRowValid(normalized)) {
                        if (tr) {
                            tr.classList.add('csv-row-invalid');
                            tr.style.background = '#ffdfdbff';
                        }
                        invalid++;
                    } else if (tr) {
                        tr.classList.remove('csv-row-invalid');
                        tr.style.background = 'rgb(239 255 231)';
                    }
                }

                if (invalidCountEl) {
                    invalidCountEl.textContent = String(invalid);
                }
            };


            // live update pendingCsvData and marks
            inputs.forEach(inp => {
                inp.addEventListener('input', () => {
                    const idx = Number(inp.dataset.idx);
                    const key = inp.dataset.key;
                    window.pendingCsvData[idx] = window.pendingCsvData[idx] || {};
                    window.pendingCsvData[idx][key] = inp.value;
                    refreshInvalidMarks();
                });
            });

            // initial mark
            refreshInvalidMarks();

            // save button (doesn't close swal) -> persist edits to pendingCsvData
            const saveBtn = Swal.getPopup().querySelector('#sw_csv_save_btn');
            saveBtn?.addEventListener('click', () => {
                // collect all inputs into pendingCsvData
                for (let i = 0; i < rowCount; i++) {
                    const obj = {};
                    headers.forEach(h => {
                        const safeKey = String(h).replace(/[^\w\-]/g, '_');
                        const el = document.getElementById(`sw_csv_${i}_${safeKey}`);
                        obj[h] = el ? el.value : '';
                    });
                    window.pendingCsvData[i] = obj;
                }
                refreshInvalidMarks();
                showNotification('success', 'Modifications enregistrées localement.');
            });
        },
        preConfirm: () => {
            // collect edits into window.pendingCsvData before confirming import
            const edited = [];
            for (let i = 0; i < data.length; i++) {
                const obj = {};
                headers.forEach(h => {
                    const safeKey = String(h).replace(/[^\w\-]/g, '_');
                    const el = document.getElementById(`sw_csv_${i}_${safeKey}`);
                    obj[h] = el ? el.value.trim() : '';
                });
                edited.push(obj);
            }
            window.pendingCsvData = edited;
            return true;
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            await confirmCsvImportAction();
            return;
        }
        resetCsvImportState();
    });
}


/**
 * Ouvre un éditeur rapide (SweetAlert) pour corriger les lignes CSV invalides.
 * Retourne une Promise résolue par un tableau de lignes corrigées (mêmes clés que pendingCsvData)
 * ou null si l'utilisateur annule.
 */
async function editInvalidRowsWithSwal(invalidRows) {
    if (!Array.isArray(invalidRows) || invalidRows.length === 0) return null;

    // Construire le HTML du tableau éditable
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Notes'];
    let html = `<div style="max-height:60vh; overflow:auto;">`;
    html += `<table style="width:100%; border-collapse:collapse;">`;
    html += `<thead><tr>${headers.map(h => `<th style="text-align:left;padding:6px;border-bottom:1px solid #eee">${h}</th>`).join('')}</tr></thead>`;
    html += `<tbody>`;
    invalidRows.forEach((row, i) => {
        const r = row.raw || {};
        html += `<tr id="csv-invalid-row-${i}" style="border-bottom:1px solid #f1f1f1">`;
        html += `<td style="padding:6px"><input id="csv_i_${i}_firstName" class="swal-input" value="${escapeHtml(r['Prénom']||r['Prenom']||r['FirstName']||'')}" /></td>`;
        html += `<td style="padding:6px"><input id="csv_i_${i}_lastName" class="swal-input" value="${escapeHtml(r['Nom']||r['LastName']||'')}" /></td>`;
        html += `<td style="padding:6px"><input id="csv_i_${i}_email" class="swal-input" value="${escapeHtml(r['Email']||r['email']||'')}" /></td>`;
        html += `<td style="padding:6px"><input id="csv_i_${i}_phone" class="swal-input" value="${escapeHtml(r['Téléphone']||r['Telephone']||r['Phone']||'')}" /></td>`;
        html += `<td style="padding:6px"><input id="csv_i_${i}_company" class="swal-input" value="${escapeHtml(r['Entreprise']||r['Company']||'')}" /></td>`;
        html += `<td style="padding:6px"><input id="csv_i_${i}_notes" class="swal-input" value="${escapeHtml(r['Notes']||'')}" /></td>`;
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    html += `<p style="margin-top:8px;font-size:0.9rem;color:#6b7280">Corrigez les lignes invalides puis cliquez sur "Valider corrections et importer". Les lignes toujours invalides resteront listées.</p>`;

    const res = await Swal.fire({
        title: `Corriger ${invalidRows.length} ligne(s) invalide(s)`,
        html,
        width: '80%',
        showCancelButton: true,
        cancelButtonText: 'Annuler',
        confirmButtonText: 'Valider corrections et importer',
        focusConfirm: false,
        didOpen: () => {
            // appliquer styles basiques aux inputs
            document.querySelectorAll('.swal-input').forEach(inp => {
                inp.style.width = '100%';
                inp.style.padding = '6px 8px';
                inp.style.border = '1px solid #e5e7eb';
                inp.style.borderRadius = '6px';
                inp.style.boxSizing = 'border-box';
            });
        },
        preConfirm: () => {
            // collecter corrections
            const corrected = invalidRows.map((_, i) => {
                return {
                    'Prénom': document.getElementById(`csv_i_${i}_firstName`)?.value?.trim() || '',
                    'Nom': document.getElementById(`csv_i_${i}_lastName`)?.value?.trim() || '',
                    'Email': document.getElementById(`csv_i_${i}_email`)?.value?.trim() || '',
                    'Téléphone': document.getElementById(`csv_i_${i}_phone`)?.value?.trim() || '',
                    'Entreprise': document.getElementById(`csv_i_${i}_company`)?.value?.trim() || '',
                    'Notes': document.getElementById(`csv_i_${i}_notes`)?.value?.trim() || ''
                };
            });
            return corrected;
        }
    });

    if (!res.isConfirmed) return null;
    return res.value; // tableau des lignes corrigées
}

/**
 * Confirmation d'import CSV : détecte valides / invalides, propose correction avant import.
 */
async function confirmCsvImportAction() {
    const eventId = document.getElementById('csvEventSelector').value;
    if (!eventId || !window.pendingCsvData) {
        showNotification('error', 'Événement ou données manquantes');
        return;
    }

    // Normaliser les lignes brutes
    const rawGuests = window.pendingCsvData.map((r, idx) => ({
        index: idx,
        raw: r,
        eventId,
        firstName: (r['Prénom'] || r['Prenom'] || r['FirstName'] || '').trim(),
        lastName: (r['Nom'] || r['LastName'] || '').trim(),
        email: (r['Email'] || r['email'] || '').trim().toLowerCase(),
        phone: (r['Téléphone'] || r['Telephone'] || r['Phone'] || '').trim(),
        company: (r['Entreprise'] || r['Company'] || '').trim(),
        notes: (r['Notes'] || '').trim()
    }));

    // Validation basique (sans popups) : prénom + nom requis, email valide
    const isRowValid = (g) => {
        if (!g.firstName || !g.lastName) return false;
       // if (g.email && !validateEmail(g.email)) return false;
        if (g.phone && !validatePhone(g.phone)) return false;
        return true;
    };

    const valid = [];
    const invalid = [];
    rawGuests.forEach(g => {
        if (isRowValid(g)) valid.push(g);
        else invalid.push(g);
    });

    // Si aucun invalide -> confirmation simple
    if (invalid.length === 0) {
        const result = await Swal.fire({
            icon: 'question',
            title: 'Importer les invités ?',
            html: `<p><strong>${valid.length}</strong> ligne(s) valides seront importées.</p>`,
            showCancelButton: true,
            confirmButtonText: 'Importer',
            cancelButtonText: 'Annuler'
        });
        if (!result.isConfirmed) return;

        const loading = Swal.fire({
            title: 'Import en cours...',
            icon: 'info',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const payload = valid.map(g => ({
                eventId: g.eventId,
                firstName: g.firstName,
                lastName: g.lastName,
                email: g.email,
                phone: g.phone,
                company: g.company,
                notes: g.notes
            }));
            await storage.createMultipleGuests(payload);
            await Swal.close();
            closeCsvImportModal();
            if (eventId === currentEventId) await loadGuestsByEvent(currentEventId);
            await Swal.fire({ icon: 'success', title: 'Import réussi', text: `${payload.length} invités ajoutés.`, timer: 2000, showConfirmButton: false });
        } catch (err) {
            await Swal.close();
            await Swal.fire({ icon: 'error', title: 'Échec', text: 'Import interrompu.' });
        }
        return;
    }

    // Il y a des lignes invalides -> proposer options
    const summaryHtml = `
        <div style="text-align:left">
            <p><strong>${valid.length}</strong> valides — prêtes à importer</p>
            <p><strong>${invalid.length}</strong> invalides — besoin de correction</p>
            <hr>
            <p>Vous pouvez :</p>
            <ul style="text-align:left">
                <li><strong>Importer uniquement</strong> les lignes valides maintenant</li>
                <li><strong>Corriger</strong> les lignes invalides puis relancer l’import</li>
                <li><strong>Annuler</strong></li>
            </ul>
        </div>
    `;

    const action = await Swal.fire({
        title: 'Fichier CSV partiellement invalide',
        html: summaryHtml,
        icon: 'warning',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: `Importer ${valid.length} valides`,
        denyButtonText: 'Corriger les invalides',
        cancelButtonText: 'Annuler',
        width: '600px'
    });

    if (action.isDismissed) return;

    if (action.isConfirmed) {
        // importer uniquement les valides
        const loading = Swal.fire({
            title: 'Import en cours...',
            icon: 'info',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const payload = valid.map(g => ({
                eventId: g.eventId,
                firstName: g.firstName,
                lastName: g.lastName,
                email: g.email,
                phone: g.phone,
                company: g.company,
                notes: g.notes
            }));
            await storage.createMultipleGuests(payload);
            await Swal.close();
            closeCsvImportModal();
            if (eventId === currentEventId) await loadGuestsByEvent(currentEventId);
            await Swal.fire({ icon: 'success', title: 'Import partiel réussi', text: `${payload.length} invités ajoutés.`, timer: 2000, showConfirmButton: false });
        } catch (err) {
            await Swal.close();
            await Swal.fire({ icon: 'error', title: 'Échec', text: 'Import interrompu.' });
        }
        return;
    }

    if (action.isDenied) {
        const corrected = await editInvalidRowsWithSwal(invalid);
        if (!corrected) return; 

        corrected.forEach((corr, idx) => {
            const originalIndex = invalid[idx].index;
            window.pendingCsvData[originalIndex]['Prénom'] = corr['Prénom'];
            window.pendingCsvData[originalIndex]['Nom'] = corr['Nom'];
            window.pendingCsvData[originalIndex]['Email'] = corr['Email'];
            window.pendingCsvData[originalIndex]['Téléphone'] = corr['Téléphone'];
            window.pendingCsvData[originalIndex]['Entreprise'] = corr['Entreprise'];
            window.pendingCsvData[originalIndex]['Notes'] = corr['Notes'];
        });

        return confirmCsvImportAction();
    }
}

function downloadCsvTemplate() {
    const csv = `Prénom,Nom,Email,Téléphone,Entreprise,Notes\nMarie,Curie,marie@example.com,+33 6 12 34 56 78,Science Labs,Invité VIP\nJean,Dupont,jean@example.com,+33 6 98 76 54 32,Tech Corp,Table 5`;
    downloadFile(csv, 'modele_invites_secura.csv', 'text/csv');
    showNotification('success', 'Modèle téléchargé');
}

// ═══════════════════════════════════════════════════════════════
// 🔧 FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    return phone === '' || /^\+?[\d\s\-\(\)]{10,20}$/.test(phone);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// ═══════════════════════════════════════════════════════════════
// 🌐 EXPOSITION GLOBALE
// ═══════════════════════════════════════════════════════════════
window.openGuestModal = openGuestModal;
window.selectEvent = selectEvent;
window.closeGuestModal = closeGuestModal;
window.editGuest = editGuest;
window.viewGuestQR = viewGuestQR;
window.shareGuest = shareGuest;
window.deleteGuest = deleteGuest;
window.deleteSelectedGuests = deleteSelectedGuests;
window.handleGuestSelect = handleGuestSelect;
window.openCsvImportModal = openCsvImportModal;
window.closeCsvImportModal = () => {
    document.getElementById('csvImportModal')?.classList.remove('active');
    resetCsvImportState();
};