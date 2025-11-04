





/**
 * SECURA - Guests Management ULTRA PRO
 * Deux vues : Cartes événements OU Table invités
 */
let currentEventId = null;
let currentGuests = [];
let selectedGuests = [];


// Attente du stockage
document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;
    initializeGuestListeners();
    checkUrlParams();

    window.addEventListener('popstate', () => {
        checkUrlParams();
        updateGuestView();
    });


    const guestForm = document.getElementById('guestForm');
    if (guestForm) guestForm.addEventListener('submit', handleGuestSubmit);

    // Exemple d'initialisation d'événement courant
    const eventList = document.getElementById('eventsGrid');
    if (eventList) {
        eventList.addEventListener('click', e => {
            const eventId = e.target.closest('.event-card-pro')?.dataset.id;
            if (eventId) currentEventId = eventId;
        });
    }
});




// ===== VÉRIFICATION URL =====
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

function updateGuestView() {
    if (currentEventId) {
        currentGuests = storage.getGuestsByEventId(currentEventId);
        renderGuestsTable();
    } else {
        renderEventCards();
    }
}




// ===== LOAD EVENTS =====
function loadEvents() {
    renderEventCards();
}


function showInvalidEventError(eventId) {
    const container = document.getElementById('mainContent');
    container.innerHTML = `
        <div class="empty-state error-state animate-fade-in">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Événement introuvable</h3>
            <p>ID: <strong>${eventId}</strong></p>
            <a href="guests.html" class="btn btn-primary">
                <i class="fas fa-arrow-left"></i> Retour
            </a>
        </div>
    `;
}

// ===== AFFICHAGE CARTES ÉVÉNEMENTS =====
function renderEventCards() {
    const events = storage.getAllEvents();
    const container = document.getElementById('mainContent');

    if (events.length === 0) {
        container.innerHTML = `
            <div class="empty-state animate-fade-in">
                <i class="fas fa-calendar-plus"></i>
                <p>Aucun événement créé</p>
                <a href="events.html" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Créer un événement
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="events-grid-pro">
            ${events.map((event, i) => `
                <div class="animate-fade-in" style="animation-delay: ${i * 0.1}s">
                    ${createEventCardForGuests(event)}
                </div>
            `).join('')}
        </div>
    `;
}

// ===== CARTE ÉVÉNEMENT (ULTRA PRO) =====
function createEventCardForGuests(event) {
    const guests = storage.getGuestsByEventId(event.id);
    const scanned = guests.filter(g => g.scanned).length;
    const date = new Date(event.date);
    const isUpcoming = date >= new Date();
    const formattedDate = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const images = {
        marriage: 'https://images.unsplash.com/photo-1519741497674-611481863552',
        anniversaire: 'https://images.unsplash.com/photo-1464349095433-7956a61b8a07',
        conference: 'https://images.unsplash.com/photo-1540575467063-868f79e66c3f',
        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e'
    };

    const labels = {
        marriage: { label: 'MARIAGE', class: 'type-marriage' },
        anniversaire: { label: 'ANNIVERSAIRE', class: 'type-anniversaire' },
        conference: { label: 'CONFÉRENCE', class: 'type-conference' },
        autre: { label: 'AUTRE', class: 'type-autre' }
    };

    const type = labels[event.type] || { label: event.type.toUpperCase(), class: 'type-autre' };
    const bg = images[event.type] || images.autre;
    const fillRate = event.capacity ? Math.round((guests.length / event.capacity) * 100) : 0;
    const circumference = 2 * Math.PI * 36;
    const offset = circumference - (fillRate / 100) * circumference;

    return `
        <div class="event-card-pro" onclick="selectEvent('${event.id}')" style="background-image: url('${bg}');">
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
                    <div class="stat-circle progress">
                        <svg width="80" height="80" viewBox="0 0 80 80">
                            <circle class="track" cx="40" cy="40" r="36" stroke="#e0e0e0" stroke-width="8" fill="none"/>
                            <circle class="progress-ring" cx="40" cy="40" r="36" stroke="#4ade80" stroke-width="8" fill="none"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 40 40)"/>
                            <text x="40" y="45" text-anchor="middle" class="progress-text">${fillRate}%</text>
                        </svg>
                        <span class="label">Remplissage</span>
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
    `;
}

// ===== SÉLECTION D'ÉVÉNEMENT =====
function selectEvent(eventId) {
    currentEventId = eventId;
    history.pushState(null, '', `?event=${eventId}`);
    renderEventHeader(storage.getEventById(eventId));
    loadGuestsByEvent(eventId);
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
    const formattedDate = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Images & Labels
    const images = {
        marriage: 'https://images.unsplash.com/photo-1519741497674-611481863552',
        anniversaire: 'https://images.unsplash.com/photo-1464349095433-7956a61b8a07',
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
            
            <!-- Type Badge -->
            <div class="event-type-badge-pro" style="background: ${type.color};">
                ${type.label}
            </div>

            <!-- Contenu -->
            <div class="event-header-content">
                <div class="event-main-info">
                    <h1 class="event-title-pro">${event.name}</h1>
                    <div class="event-meta-pro">
                        <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
                        ${event.time ? `<span><i class="fas fa-clock"></i> ${event.time}</span>` : ''}
                        ${event.location ? `<span><i class="fas fa-map-marker-alt"></i> ${event.location}</span>` : ''}
                    </div>
                </div>

                <!-- Stats -->
                <div class="event-stats-pro">
                    <div class="stat-item">
                        <div class="stat-value">${guests.length}</div>
                        <div class="stat-label">Invités</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value success">${scanned}</div>
                        <div class="stat-label">Présents</div>
                    </div>
                    ${event.capacity ? `
                    <div class="stat-item progress">
                        <svg width="90" height="90" viewBox="0 0 90 90">
                            <circle cx="45" cy="45" r="40" stroke="#333" stroke-width="10" fill="none"/>
                            <circle cx="45" cy="45" r="40" stroke="#4ade80" stroke-width="10" fill="none"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                                transform="rotate(-90 45 45)"/>
                            <text x="45" y="50" text-anchor="middle" class="progress-text-pro">${fillRate}%</text>
                        </svg>
                        <div class="stat-label">Remplissage</div>
                    </div>` : ''}
                </div>
        </div>
    `;

    // Réattacher les boutons
    setTimeout(() => {
        document.getElementById('importCsvBtn').onclick = openCsvImportModal;
        document.getElementById('addGuestBtn').onclick = () => openGuestModal();
    }, 100);
}




// ===== CHARGEMENT INVITÉS =====
function loadGuestsByEvent(eventId) {
    currentEventId = eventId;
    currentGuests = storage.getGuestsByEventId(eventId);
    renderGuestsTable();
}





            
function renderGuestsTable() {
    const container = document.getElementById('mainContent');

    if (currentGuests.length === 0) {
        container.innerHTML = `
            <div class="empty-state-pro animate-fade-in">
                <i class="fas fa-user-friends"></i>
                <h3>Aucun invité</h3>
                <p>Cet événement est vide pour le moment</p>
                <button class="btn btn-primary" onclick="openGuestModal()">
                    <i class="fas fa-user-plus"></i> Ajouter le premier invité
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
    <div class="table-container" id="guestsTableContainer" >
              <table class="data-table" id="guestsTable">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAllGuests"></th>
                        <th>Invité</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Statut</th>
                        <th>QR</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="guestsTableBody"></tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById('guestsTableBody');
    tbody.innerHTML = currentGuests.map(guest => {
        const color = stringToColor(`${guest.firstName} ${guest.lastName}`);
        const initials = `${guest.firstName[0]}${guest.lastName[0]}`.toUpperCase();
        const scanned = guest.scanned;
        return `
            <tr class="guest-row-pro ${scanned ? 'scanned' : ''}">
                <td><input type="checkbox" class="guest-checkbox" value="${guest.id}"></td>
                <td>
                    <div class="guest-info">
                        <div class="guest-avatar-pro" style="background:${color}">${initials}</div>
                        <div>
                            <div class="guest-name">${guest.firstName} ${guest.lastName}</div>
                            ${guest.company && guest.company != '-' ? `<div class="guest-company">${guest.company}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td><a href="mailto:${guest.email}" class="email-link">${guest.email}</a></td>
                <td>${guest.phone || '-'}</td>
                <td>
                    <span class="status-badge-pro ${scanned ? 'present' : 'pending'}">
                        <i class="fas fa-${scanned ? 'check' : 'clock'}"></i>
                        ${scanned ? 'Présent' : 'En attente'}
                    </span>
                </td>
                <td>
                    ${storage.getQRCodeByGuestId(guest.id) 
                        ? '<i class="fas fa-qrcode qr-ready"></i>' 
                        : '<i class="fas fa-qrcode qr-missing"></i>'
                    }
                </td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn" onclick="editGuest('${guest.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
                        <button class="icon-btn" onclick="viewGuestQR('${guest.id}')" title="QR Code"><i class="fas fa-qrcode"></i></button>
                        <button class="icon-btn" onclick="shareGuest('${guest.id}')" title="Partager"><i class="fas fa-share-alt"></i></button>
                        <button class="icon-btn delete" onclick="deleteGuest('${guest.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Réattacher les listeners
    document.getElementById('selectAllGuests').onchange = handleSelectAll;
    document.getElementById('searchGuests').oninput = debounce(handleGuestSearch, 300);
    document.getElementById('exportCsvBtn').onclick = exportGuestsToCSV;
    document.getElementById('exportJsonBtn').onclick = exportGuestsToJSON;
    document.getElementById('deleteSelectedBtn').onclick = deleteSelectedGuests;
}

// ===== LISTENERS =====
function initializeGuestListeners() {
    setupSearch();
    setupSelectAll();
    setupDeleteSelected();
    setupExportButtons();
    setupCsvImport();
    reinitializeHeaderButtons();
}

function reinitializeHeaderButtons() {
    setTimeout(() => {
        const importBtn = document.getElementById('importCsvBtn');
        const addBtn = document.getElementById('addGuestBtn');
        if (importBtn) importBtn.addEventListener('click', openCsvImportModal);
        if (addBtn) addBtn.addEventListener('click', () => openGuestModal());
    }, 100);
}

function setupSearch() {
    const search = document.getElementById('searchGuests');
    if (search) {
        search.addEventListener('input', debounce(handleGuestSearch, 300));
    }
}

function setupSelectAll() {
    const selectAll = document.getElementById('selectAllGuests');
    if (selectAll) {
        selectAll.addEventListener('change', handleSelectAll);
    }
}

function setupDeleteSelected() {
    const btn = document.getElementById('deleteSelectedBtn');
    if (btn) {
        btn.addEventListener('click', deleteSelectedGuests);
    }
}

function setupExportButtons() {
    const csv = document.getElementById('exportCsvBtn');
    const json = document.getElementById('exportJsonBtn');
    if (csv) csv.addEventListener('click', exportGuestsToCSV);
    if (json) json.addEventListener('click', exportGuestsToJSON);
}

function setupAddGuestButton() {
    const btn = document.getElementById('addGuestBtn');
    if (btn) btn.addEventListener('click', () => openGuestModal());
}

function setupCsvImport() {
    const dropZone = document.getElementById('csvDropZone');
    const fileInput = document.getElementById('csvFileInput');
    const confirmBtn = document.getElementById('confirmCsvImport');
    const templateLink = document.getElementById('downloadTemplate');

    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) processCsvFile(file);
        });
    }
    if (fileInput) fileInput.addEventListener('change', e => e.target.files[0] && processCsvFile(e.target.files[0]));
    if (confirmBtn) confirmBtn.addEventListener('click', confirmCsvImportAction);
    if (templateLink) templateLink.addEventListener('click', e => { e.preventDefault(); downloadCsvTemplate(); });
}





function reinitializeHeaderButtons() {
    setTimeout(() => {
        const importBtn = document.getElementById('importCsvBtn');
        const addBtn = document.getElementById('addGuestBtn');
        if (importBtn) importBtn.onclick = openCsvImportModal;
        if (addBtn) addBtn.onclick = () => openGuestModal();
    }, 100);
}

// ===== RECHERCHE =====
function handleGuestSearch(e) {
    const query = e.target.value.toLowerCase();
    currentGuests = storage.getGuestsByEventId(currentEventId).filter(g =>
        g.firstName.toLowerCase().includes(query) ||
        g.lastName.toLowerCase().includes(query) ||
        g.email.toLowerCase().includes(query) ||
        (g.phone && g.phone.includes(query))
    );
    renderGuestsTable();
}

// ===== SÉLECTION =====
function handleSelectAll(e) {
    document.querySelectorAll('.guest-checkbox').forEach(cb => cb.checked = e.target.checked);
    updateSelectedGuests();
}

function handleGuestSelect() {
    updateSelectedGuests();
}

function updateSelectedGuests() {
    selectedGuests = Array.from(document.querySelectorAll('.guest-checkbox:checked')).map(cb => cb.value);
    const btn = document.getElementById('deleteSelectedBtn');
    const count = document.getElementById('selectedCount');
    if (btn && count) {
        btn.style.display = selectedGuests.length > 0 ? 'inline-flex' : 'none';
        count.textContent = selectedGuests.length;
    }
}

// ===== MODAL INVITÉ =====
function openGuestModal(guestId = null) {
    if (!currentEventId) return showNotification('warning', 'Aucun événement sélectionné');
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
}

function closeGuestModal() {
    document.getElementById('guestModal').classList.remove('active');
}

function handleGuestSubmit(e) {
    e.preventDefault();
    const guestId = document.getElementById('guestId').value;
    const data = {
        id: guestId || undefined,
        eventId: currentEventId,
        firstName: document.getElementById('guestFirstName').value.trim(),
        lastName: document.getElementById('guestLastName').value.trim(),
        email: document.getElementById('guestEmail').value.trim(),
        phone: document.getElementById('guestPhone').value.trim(),
        company: document.getElementById('guestCompany').value.trim(),
        notes: document.getElementById('guestNotes').value.trim()
    };

    if (!validateEmail(data.email)) return showNotification('error', 'Email invalide');
    if (data.phone && !validatePhone(data.phone)) return showNotification('error', 'Téléphone invalide');

    try {
        storage.saveGuest(data);
        closeGuestModal();
        loadGuestsByEvent(currentEventId);
        showNotification('success', guestId ? 'Modifié' : 'Ajouté');
    } catch (err) {
        showNotification('error', 'Erreur');
    }
}

// ===== ACTIONS INVITÉ =====
function editGuest(id) { openGuestModal(id); }
function viewGuestQR(id) { window.location.href = `qr-generator.html?guest=${id}`; }
function shareGuest(id) {
    const guest = storage.getGuestById(id);
    const event = storage.getEventById(guest.eventId);
    if (!guest || !event) return;
    const msg = `Invitation: ${event.name}\nInvité: ${guest.firstName} ${guest.lastName}\nDate: ${new Date(event.date).toLocaleDateString('fr-FR')}`;
    if (navigator.share) {
        navigator.share({ title: `Invitation - ${event.name}`, text: msg }).catch(() => {});
    } else {
        showNotification('info', 'Partage non disponible');
    }
}

async function deleteGuest(id) {
    const guest = storage.getGuestById(id);
    if (!guest) return;
    if (await confirmDialog('Supprimer', `Supprimer ${guest.firstName} ${guest.lastName} ?`, 'Supprimer', 'Annuler')) {
        storage.deleteGuest(id);
        loadGuestsByEvent(currentEventId);
        showNotification('success', 'Supprimé');
    }
}

async function deleteSelectedGuests() {
    if (selectedGuests.length === 0) return;
    if (await confirmDialog('Supprimer', `Supprimer ${selectedGuests.length} invité(s) ?`, 'Supprimer', 'Annuler')) {
        storage.deleteMultipleGuests(selectedGuests);
        selectedGuests = [];
        loadGuestsByEvent(currentEventId);
        showNotification('success', 'Supprimés');
    }
}

// ===== EXPORT =====
function exportGuestsToCSV() {
    const event = storage.getEventById(currentEventId);
    const csv = storage.exportToCSV(currentEventId);
    const file = `${event.name.replace(/\s+/g, '_')}_invites_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(csv, file, 'text/csv');
    showNotification('success', 'Export CSV OK');
}

function exportGuestsToJSON() {
    const event = storage.getEventById(currentEventId);
    const data = JSON.stringify({ event, guests: currentGuests, exportedAt: new Date().toISOString() }, null, 2);
    const file = `${event.name.replace(/\s+/g, '_')}_invites_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(data, file, 'application/json');
    showNotification('success', 'Export JSON OK');
}

// ===== CSV IMPORT =====
function openCsvImportModal() {
    const modal = document.getElementById('csvImportModal');
    modal.classList.add('active');
    document.getElementById('csvPreview').style.display = 'none';
    populateCsvEventSelector();
}

function populateCsvEventSelector() {
    const select = document.getElementById('csvEventSelector');
    select.innerHTML = '<option value="">-- Choisir --</option>' + storage.getAllEvents().map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}

function closeCsvImportModal() {
    document.getElementById('csvImportModal').classList.remove('active');
}

function processCsvFile(file) {
    if (!Papa) return showNotification('error', 'CSV non chargé');
    showLoading();
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: r => { hideLoading(); displayCsvPreview(r.data); },
        error: () => { hideLoading(); showNotification('error', 'Erreur CSV'); }
    });
}

function displayCsvPreview(data) {
    if (data.length === 0) return showNotification('error', 'CSV vide');
    const preview = data.slice(0, 5);
    const table = document.getElementById('csvPreviewTable');
    const headers = Object.keys(preview[0]);
    let html = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
    preview.forEach(row => {
        html += '<tr>' + headers.map(h => `<td>${row[h] || ''}</td>`).join('') + '</tr>';
    });
    html += '</tbody>';
    table.innerHTML = html;
    document.getElementById('csvRowCount').textContent = data.length;
    document.getElementById('csvPreview').style.display = 'block';
    window.pendingCsvData = data;
}

function confirmCsvImportAction() {
    const eventId = document.getElementById('csvEventSelector').value;
    if (!eventId || !window.pendingCsvData) return showNotification('error', 'Données manquantes');
    const guests = window.pendingCsvData.map(r => ({
        eventId,
        firstName: r['Prénom'] || r['Prenom'] || r['FirstName'] || '',
        lastName: r['Nom'] || r['LastName'] || '',
        email: r['Email'] || r['email'] || '',
        phone: r['Téléphone'] || r['Telephone'] || r['Phone'] || '',
        company: r['Entreprise'] || r['Company'] || '',
        notes: r['Notes'] || ''
    }));
    const valid = guests.filter(g => g.firstName && g.lastName && g.email);
    if (valid.length === 0) return showNotification('error', 'Aucun valide');
    storage.saveMultipleGuests(valid);
    closeCsvImportModal();
    if (eventId === currentEventId) loadGuestsByEvent(currentEventId);
    showNotification('success', `${valid.length} importé(s)`);
}

function downloadCsvTemplate() {
    const csv = `Prénom,Nom,Email,Téléphone,Entreprise,Notes\nJean,Dupont,jean@example.com,+237 6XX XXX XXX,Entreprise A,VIP`;
    downloadFile(csv, 'modele_invites.csv', 'text/csv');
}

// ===== UTILS =====
function getTypeColor(t) { return { marriage: '#dc2626', anniversaire: '#fb923c', conference: '#3b82f6', autre: '#6b7280' }[t] || '#6b7280'; }
function stringToColor(s) { let h=0; for(let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h); const c=(h&0x00FFFFFF).toString(16); return "#"+("000000"+c).slice(-6); }

// Exposer globalement
window.openGuestModal = openGuestModal;
window.closeGuestModal = closeGuestModal;
window.editGuest = editGuest;
window.viewGuestQR = viewGuestQR;
window.shareGuest = shareGuest;
window.deleteGuest = deleteGuest;
window.handleGuestSelect = handleGuestSelect;
window.closeCsvImportModal = closeCsvImportModal;