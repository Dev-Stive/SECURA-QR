/**
 * SECURA - Guests Management
 * Gestion complète des invités
 */

let currentEventId = null;
let currentGuests = [];
let selectedGuests = [];



document.addEventListener('DOMContentLoaded', () => {

    loadEvents();
    initializeGuestListeners();
    checkUrlParams();
});

// ===== CHECK URL PARAMS =====
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event');
    if (eventId) {
        const eventSelector = document.getElementById('eventSelector');
        if (eventSelector) {
            eventSelector.value = eventId;
            loadGuestsByEvent(eventId);
        }
    }

}

// ===== LOAD EVENTS =====
function loadEvents() {
    console.log("Chargement des événements...");
    const events = storage.getAllEvents();
    console.log("Événements trouvés :", events);

    const eventSelector = document.getElementById('eventSelector');
    const csvEventSelector = document.getElementById('csvEventSelector');
    
    if (!eventSelector) {
        console.error("Sélecteur d'événement non trouvé !");
        return;
    }

    eventSelector.innerHTML = '<option value="">-- Choisir un événement --</option>';
    events.forEach(event => {
        eventSelector.innerHTML += `<option value="${event.id}">${event.name} (${new Date(event.date).toLocaleDateString('fr-FR')})</option>`;
    });

    if (csvEventSelector) {
        csvEventSelector.innerHTML = '<option value="">-- Choisir un événement --</option>';
        events.forEach(event => {
            csvEventSelector.innerHTML += `<option value="${event.id}">${event.name}</option>`;
        });
    }
}


// ===== EVENT LISTENERS =====
function initializeGuestListeners() {
    // Event selector
    const eventSelector = document.getElementById('eventSelector');
    if (eventSelector) {
        eventSelector.addEventListener('change', (e) => {
            loadGuestsByEvent(e.target.value);
        });
    }

    // Add guest button
    const addGuestBtn = document.getElementById('addGuestBtn');
    if (addGuestBtn) {
        addGuestBtn.addEventListener('click', () => openGuestModal());
    }

    // Import CSV button
    const importCsvBtn = document.getElementById('importCsvBtn');
    if (importCsvBtn) {
        importCsvBtn.addEventListener('click', openCsvImportModal);
    }

    // Export buttons
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportGuestsToCSV);
    }

    const exportJsonBtn = document.getElementById('exportJsonBtn');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', exportGuestsToJSON);
    }

    // Search
    const searchGuests = document.getElementById('searchGuests');
    if (searchGuests) {
        searchGuests.addEventListener('input', debounce(handleGuestSearch, 300));
    }

    // Select all
    const selectAllGuests = document.getElementById('selectAllGuests');
    if (selectAllGuests) {
        selectAllGuests.addEventListener('change', handleSelectAll);
    }

    // Delete selected
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', deleteSelectedGuests);
    }

    // Guest form
    const guestForm = document.getElementById('guestForm');
    if (guestForm) {
        guestForm.addEventListener('submit', handleGuestSubmit);
    }

    // CSV file input
    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleCsvFileSelect);
    }

    // CSV drop zone
    const csvDropZone = document.getElementById('csvDropZone');
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
                processCsvFile(file);
            } else {
                showNotification('error', 'Veuillez déposer un fichier CSV');
            }
        });
    }

    // Download template
    const downloadTemplate = document.getElementById('downloadTemplate');
    if (downloadTemplate) {
        downloadTemplate.addEventListener('click', (e) => {
            e.preventDefault();
            downloadCsvTemplate();
        });
    }

    // Confirm CSV import
    const confirmCsvImport = document.getElementById('confirmCsvImport');
    if (confirmCsvImport) {
        confirmCsvImport.addEventListener('click', confirmCsvImportAction);
    }
}

// ===== LOAD GUESTS BY EVENT =====
function loadGuestsByEvent(eventId) {
    currentEventId = eventId;
    
    if (!eventId) {
        document.getElementById('guestsActionsBar').style.display = 'none';
        document.getElementById('guestsTableContainer').style.display = 'none';
        document.getElementById('guestsEmptyState').style.display = 'block';
        return;
    }

    currentGuests = storage.getGuestsByEventId(eventId);
    renderGuests();
    
    document.getElementById('guestsActionsBar').style.display = 'flex';
    document.getElementById('guestsEmptyState').style.display = 'none';
    
    if (currentGuests.length > 0) {
        document.getElementById('guestsTableContainer').style.display = 'block';
    } else {
        document.getElementById('guestsTableContainer').style.display = 'none';
        document.getElementById('guestsEmptyState').innerHTML = `
            <i class="fas fa-user-friends"></i>
            <p>Aucun invité pour cet événement</p>
            <button class="btn btn-primary" onclick="openGuestModal()">Ajouter votre premier invité</button>
        `;
        document.getElementById('guestsEmptyState').style.display = 'block';
    }
}

// ===== RENDER GUESTS =====
function renderGuests() {
    const tbody = document.getElementById('guestsTableBody');
    if (!tbody) return;

    tbody.innerHTML = currentGuests.map(guest => {
        const qrCode = storage.getQRCodeByGuestId(guest.id);
        const statusClass = guest.scanned ? 'success' : 'pending';
        const statusText = guest.scanned ? 'Présent' : 'En attente';
        
        return `
            <tr>
                <td>
                    <input type="checkbox" class="guest-checkbox" value="${guest.id}" 
                           onchange="handleGuestSelect(this)">
                </td>
                <td>${guest.firstName}</td>
                <td>${guest.lastName}</td>
                <td>${guest.email}</td>
                <td>${guest.phone || '-'}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas fa-${guest.scanned ? 'check' : 'clock'}"></i>
                        ${statusText}
                    </span>
                </td>
                <td>
                    ${qrCode ? '<i class="fas fa-qrcode" style="color: var(--secura-success)"></i>' : 
                              '<i class="fas fa-qrcode" style="color: var(--secura-text-gray)"></i>'}
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="icon-btn" onclick="editGuest('${guest.id}')" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn" onclick="viewGuestQR('${guest.id}')" title="Voir QR">
                            <i class="fas fa-qrcode"></i>
                        </button>
                        <button class="icon-btn" onclick="shareGuest('${guest.id}')" title="Partager">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        <button class="icon-btn" onclick="deleteGuest('${guest.id}')" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ===== GUEST SEARCH =====
function handleGuestSearch(e) {
    const query = e.target.value.toLowerCase();
    const allGuests = storage.getGuestsByEventId(currentEventId);
    
    currentGuests = allGuests.filter(guest => 
        guest.firstName.toLowerCase().includes(query) ||
        guest.lastName.toLowerCase().includes(query) ||
        guest.email.toLowerCase().includes(query) ||
        (guest.phone && guest.phone.includes(query))
    );
    
    renderGuests();
}

// ===== SELECT GUESTS =====
function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.guest-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
    });
    updateSelectedGuests();
}

function handleGuestSelect(checkbox) {
    updateSelectedGuests();
}

function updateSelectedGuests() {
    const checkboxes = document.querySelectorAll('.guest-checkbox:checked');
    selectedGuests = Array.from(checkboxes).map(cb => cb.value);
    
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const selectedCount = document.getElementById('selectedCount');
    
    if (deleteBtn && selectedCount) {
        if (selectedGuests.length > 0) {
            deleteBtn.style.display = 'inline-flex';
            selectedCount.textContent = selectedGuests.length;
        } else {
            deleteBtn.style.display = 'none';
        }
    }
}

// ===== GUEST MODAL =====
function openGuestModal(guestId = null) {
    if (!currentEventId) {
        showNotification('warning', 'Veuillez d\'abord sélectionner un événement');
        return;
    }

    const modal = document.getElementById('guestModal');
    const form = document.getElementById('guestForm');
    const title = document.getElementById('guestModalTitle');
    
    if (!modal || !form) return;

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
    const modal = document.getElementById('guestModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===== GUEST FORM SUBMIT =====
function handleGuestSubmit(e) {
    e.preventDefault();
    
    const guestId = document.getElementById('guestId').value;
    const guestData = {
        id: guestId || undefined,
        eventId: document.getElementById('guestEventId').value,
        firstName: document.getElementById('guestFirstName').value.trim(),
        lastName: document.getElementById('guestLastName').value.trim(),
        email: document.getElementById('guestEmail').value.trim(),
        phone: document.getElementById('guestPhone').value.trim(),
        company: document.getElementById('guestCompany').value.trim(),
        notes: document.getElementById('guestNotes').value.trim()
    };

    // Validation
    if (!validateEmail(guestData.email)) {
        showNotification('error', 'Adresse email invalide');
        return;
    }

    if (guestData.phone && !validatePhone(guestData.phone)) {
        showNotification('error', 'Numéro de téléphone invalide');
        return;
    }

    try {
        storage.saveGuest(guestData);
        closeGuestModal();
        loadGuestsByEvent(currentEventId);
        showNotification('success', guestId ? 'Invité modifié avec succès' : 'Invité ajouté avec succès');
    } catch (error) {
        console.error('Error saving guest:', error);
        showNotification('error', 'Une erreur est survenue lors de l\'enregistrement');
    }
}

// ===== GUEST ACTIONS =====
function editGuest(guestId) {
    openGuestModal(guestId);
}

function viewGuestQR(guestId) {
    window.location.href = `qr-generator.html?guest=${guestId}`;
}

function shareGuest(guestId) {
    const guest = storage.getGuestById(guestId);
    const event = storage.getEventById(guest.eventId);
    
    if (!guest || !event) return;

    const message = `Invitation: ${event.name}\nInvité: ${guest.firstName} ${guest.lastName}\nDate: ${new Date(event.date).toLocaleDateString('fr-FR')}`;
    
    if (navigator.share) {
        navigator.share({
            title: `Invitation - ${event.name}`,
            text: message
        }).catch(err => console.log('Share cancelled'));
    } else {
        showNotification('info', 'Fonctionnalité de partage non disponible sur ce navigateur');
    }
}

async function deleteGuest(guestId) {
    const guest = storage.getGuestById(guestId);
    if (!guest) return;

    const confirmed = await confirmDialog(
        'Supprimer l\'invité',
        `Êtes-vous sûr de vouloir supprimer ${guest.firstName} ${guest.lastName} ?`,
        'Supprimer',
        'Annuler'
    );

    if (confirmed) {
        storage.deleteGuest(guestId);
        loadGuestsByEvent(currentEventId);
        showNotification('success', 'Invité supprimé avec succès');
    }
}

async function deleteSelectedGuests() {
    if (selectedGuests.length === 0) return;

    const confirmed = await confirmDialog(
        'Supprimer les invités',
        `Êtes-vous sûr de vouloir supprimer ${selectedGuests.length} invité(s) ?`,
        'Supprimer',
        'Annuler'
    );

    if (confirmed) {
        storage.deleteMultipleGuests(selectedGuests);
        selectedGuests = [];
        loadGuestsByEvent(currentEventId);
        showNotification('success', 'Invités supprimés avec succès');
    }
}

// ===== EXPORT =====
function exportGuestsToCSV() {
    if (!currentEventId) return;

    const event = storage.getEventById(currentEventId);
    const csvContent = storage.exportToCSV(currentEventId);
    const filename = `${event.name.replace(/\s+/g, '_')}_invites_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadFile(csvContent, filename, 'text/csv');
    showNotification('success', 'Export CSV réussi');
}

function exportGuestsToJSON() {
    if (!currentEventId) return;

    const event = storage.getEventById(currentEventId);
    const guests = storage.getGuestsByEventId(currentEventId);
    const jsonContent = JSON.stringify({
        event: event,
        guests: guests,
        exportedAt: new Date().toISOString()
    }, null, 2);
    
    const filename = `${event.name.replace(/\s+/g, '_')}_invites_${new Date().toISOString().split('T')[0]}.json`;
    
    downloadFile(jsonContent, filename, 'application/json');
    showNotification('success', 'Export JSON réussi');
}

// ===== CSV IMPORT =====
function openCsvImportModal() {
    const modal = document.getElementById('csvImportModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('csvPreview').style.display = 'none';
    }
}

function closeCsvImportModal() {
    const modal = document.getElementById('csvImportModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function handleCsvFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processCsvFile(file);
    }
}

function processCsvFile(file) {
    if (typeof Papa === 'undefined') {
        showNotification('error', 'Bibliothèque CSV non chargée');
        return;
    }

    showLoading();

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            hideLoading();
            displayCsvPreview(results.data);
        },
        error: function(error) {
            hideLoading();
            showNotification('error', 'Erreur lors de la lecture du fichier CSV');
            console.error('CSV Parse Error:', error);
        }
    });
}

function displayCsvPreview(data) {
    if (data.length === 0) {
        showNotification('error', 'Le fichier CSV est vide');
        return;
    }

    const preview = data.slice(0, 5);
    const table = document.getElementById('csvPreviewTable');
    
    // Headers
    const headers = Object.keys(preview[0]);
    let tableHTML = '<thead><tr>';
    headers.forEach(header => {
        tableHTML += `<th>${header}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    // Rows
    preview.forEach(row => {
        tableHTML += '<tr>';
        headers.forEach(header => {
            tableHTML += `<td>${row[header] || ''}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody>';
    
    table.innerHTML = tableHTML;
    document.getElementById('csvRowCount').textContent = data.length;
    document.getElementById('csvPreview').style.display = 'block';
    
    // Stocker les données pour l'import
    window.pendingCsvData = data;
}

function confirmCsvImportAction() {
    const eventId = document.getElementById('csvEventSelector').value;
    
    if (!eventId) {
        showNotification('error', 'Veuillez sélectionner un événement');
        return;
    }

    if (!window.pendingCsvData) {
        showNotification('error', 'Aucune donnée à importer');
        return;
    }

    const guests = window.pendingCsvData.map(row => ({
        eventId: eventId,
        firstName: row['Prénom'] || row['Prenom'] || row['FirstName'] || '',
        lastName: row['Nom'] || row['LastName'] || '',
        email: row['Email'] || row['email'] || '',
        phone: row['Téléphone'] || row['Telephone'] || row['Phone'] || '',
        company: row['Entreprise'] || row['Company'] || '',
        notes: row['Notes'] || ''
    }));

    // Validation
    const invalidGuests = guests.filter(g => !g.firstName || !g.lastName || !g.email);
    
    if (invalidGuests.length > 0) {
        showNotification('warning', `${invalidGuests.length} ligne(s) invalide(s) ignorée(s)`);
    }

    const validGuests = guests.filter(g => g.firstName && g.lastName && g.email);
    
    if (validGuests.length === 0) {
        showNotification('error', 'Aucun invité valide à importer');
        return;
    }

    try {
        storage.saveMultipleGuests(validGuests);
        closeCsvImportModal();
        
        if (eventId === currentEventId) {
            loadGuestsByEvent(currentEventId);
        }
        
        showNotification('success', `${validGuests.length} invité(s) importé(s) avec succès`);
    } catch (error) {
        console.error('Error importing guests:', error);
        showNotification('error', 'Erreur lors de l\'importation');
    }
}

function downloadCsvTemplate() {
    const template = `Prénom,Nom,Email,Téléphone,Entreprise,Notes
Jean,Dupont,jean.dupont@example.com,+237 6XX XXX XXX,Entreprise A,VIP
Marie,Martin,marie.martin@example.com,+237 6XX XXX XXX,Entreprise B,`;

    downloadFile(template, 'modele_invites.csv', 'text/csv');
}

window.openGuestModal = openGuestModal;
window.closeGuestModal = closeGuestModal;
window.editGuest = editGuest;
window.viewGuestQR = viewGuestQR;
window.shareGuest = shareGuest;
window.deleteGuest = deleteGuest;
window.handleGuestSelect = handleGuestSelect;
window.closeCsvImportModal = closeCsvImportModal;