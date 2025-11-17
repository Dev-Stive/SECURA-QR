/**
 * SECURA - QR Code Generator ULTRA MÉGA COMPLET
 * QR ultra-léger + génération en masse + ZIP ou DOSSIER
 */
let currentQRCode = null;
let currentGuestId = null;
let qrConfig = {
  size: 300,
  foreground: '#000000',     // ← NOIR PUR
  background: '#FFFFFF',
  style: 'square',
  errorLevel: 'H',
  includeLogo: true
};


let downloadDirHandle = null;

// ===== DOM LOADED =====

document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;

    loadEvents();
    initializeQRListeners();
    checkUrlParams();
    initDownloadDirectory();
});

// ===== UTILITAIRE POUR NETTOYER LES NOMS DE FICHIERS =====
function formatFileName(...parts) {
    return parts
        .join('-')                  
        .trim()                    
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .replace(/-+/g, '-')    
        .replace(/^-|-$/g, '');      
}

// ===== INITIALISER LE DOSSIER (CHROME/EDGE) =====
async function initDownloadDirectory() {
    if (!('showDirectoryPicker' in window)) return;
    try {
        const dirHandle = await window.showDirectoryPicker({
            suggestedName: 'SECURA_QR_Téléchargements',
            startIn: 'downloads'
        });
        downloadDirHandle = dirHandle;
        localStorage.setItem('secura_qr_dir', 'set');
        showNotification('success', 'Dossier configuré !');
    } catch (err) {
        if (err.name !== 'AbortError') console.warn(err);
    }
}

// ===== CHECK URL PARAMS =====
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const guestId = urlParams.get('guest');
    if (guestId) {
        const guest = storage.getGuestById(guestId);
        if (guest) {
            document.getElementById('qrEventSelector').value = guest.eventId;
            loadGuestsByQREvent(guest.eventId);
            setTimeout(() => {
                document.getElementById('qrGuestSelector').value = guestId;
                document.getElementById('generateQrBtn').disabled = false;
            }, 100);
        }
    }
}

// ===== LOAD EVENTS =====
async function loadEvents() {
    const events = await storage.getAllEvents();
    const selector = document.getElementById('qrEventSelector');
    if (!selector) return;
    selector.innerHTML = '<option value="">-- Sélectionner un événement --</option>';
    events.forEach(event => {
        selector.innerHTML += `<option value="${event.id}">${event.name} (${new Date(event.date).toLocaleDateString('fr-FR')})</option>`;
    });
}

// ===== EVENT LISTENERS =====
function initializeQRListeners() {
    const qrEventSelector = document.getElementById('qrEventSelector');
    if (qrEventSelector) {
        qrEventSelector.addEventListener('change', (e) => loadGuestsByQREvent(e.target.value));
    }
    const qrGuestSelector = document.getElementById('qrGuestSelector');
    if (qrGuestSelector) {
        qrGuestSelector.addEventListener('change', (e) => {
            document.getElementById('generateQrBtn').disabled = !e.target.value;
        });
    }
    const generateQrBtn = document.getElementById('generateQrBtn');
    if (generateQrBtn) {
        generateQrBtn.addEventListener('click', generateQRCodeWithConfirmation);
    }
    ['qrSize', 'qrForeground', 'qrBackground', 'qrErrorLevel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
                if (currentQRCode) regenerateQRCode();
            });
        }
    });
    document.getElementById('downloadQrBtn')?.addEventListener('click', downloadSingleQR);
    document.getElementById('bulkGenerateBtn')?.addEventListener('click', bulkGenerateAndDownload);
    document.getElementById('shareQrBtn')?.addEventListener('click', openShareModal);
    setupShareOptions();
}

// ===== GÉNÉRATION AVEC CONFIRMATION =====
async function generateQRCodeWithConfirmation() {
    const guestId = document.getElementById('qrGuestSelector').value;
    const eventId = document.getElementById('qrEventSelector').value;
    if (!guestId || !eventId) return;
    const guest = storage.getGuestById(guestId);
    const event = storage.getEventById(eventId);
    if (!guest || !event) return;
    const existingQR = storage.getQRCodeByGuestId(guestId);
    if (existingQR) {
        const confirmed = await confirmDialog(
            'QR Code existant',
            `Remplacer le QR Code de <strong>${guest.firstName} ${guest.lastName}</strong> ?`,
            'Remplacer',
            'Annuler'
        );
        if (!confirmed) return;
    }
    generateQRCode();
}

// ===== GÉNÉRER QR CODE (ULTRA-LÉGER) =====
function generateQRCode() {
    const guestId = document.getElementById('qrGuestSelector').value;
    const eventId = document.getElementById('qrEventSelector').value;
    if (!guestId || !eventId) return;
    const guest = storage.getGuestById(guestId);
    const event = storage.getEventById(eventId);
    if (!guest || !event) return;
    currentGuestId = guestId;

    const qrData = { t: 'INV', e: eventId, g: guestId };
    const container = document.getElementById('qrPreviewContainer');
    container.innerHTML = '<div id="qrcode"></div';

    try {
        currentQRCode = new QRCode(document.getElementById('qrcode'), {
            text: JSON.stringify(qrData),
            width: qrConfig.size,
            height: qrConfig.size,
            colorDark: qrConfig.foreground,
            colorLight: qrConfig.background,
            correctLevel: QRCode.CorrectLevel[qrConfig.errorLevel]
        });

        storage.saveQRCode({
        guestId: guest.id,
        eventId: event.id,
        data: JSON.stringify(qrData),
        config: qrConfig
    });

    displayGuestInfo(guest, event);
    showQRActions();

    SECURA_AUDIO.success();
    showNotification('success', 'QR Code généré !');
    } catch (err) {
        console.error(err);
        showNotification('error', 'Erreur de génération');
    }
}

function regenerateQRCode() {
    if (currentGuestId) {
        document.getElementById('qrGuestSelector').value = currentGuestId;
        generateQRCode();
    }
}

// ===== TÉLÉCHARGER UN SEUL =====
async function downloadSingleQR() {
    if (!currentQRCode || !currentGuestId) return;
    const guest = storage.getGuestById(currentGuestId);
    if (!guest) return;
    const canvas = document.querySelector('#qrcode canvas');
    if (!canvas) return;

    const cleanName = formatFileName(guest.firstName, guest.lastName);
    const filename = `QR_${cleanName}.png`;

    if (downloadDirHandle) {
        try {
            const fileHandle = await downloadDirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            await writable.write(blob);
            await writable.close();
            showNotification('success', 'Téléchargé dans le dossier !');
            return;
        } catch (err) {
            console.warn(err);
        }
    }

    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        SECURA_AUDIO.play('notify');
        showNotification('success', 'Téléchargé !');
    });
}

// ===== GÉNÉRATION EN MASSE ULTRA COMPLÈTE AVEC PROGRESSION + APERÇU DÉFILANT =====
async function bulkGenerateAndDownload() {
    const eventId = document.getElementById('qrEventSelector').value;
    if (!eventId) return showNotification('warning', 'Sélectionnez un événement');

    const allGuests = storage.getGuestsByEventId(eventId);
    const event = storage.getEventById(eventId);
    if (!allGuests.length) return showNotification('warning', 'Aucun invité');

    const guestsWithoutQR = allGuests.filter(g => !storage.getQRCodeByGuestId(g.id));
    const hasMissingQR = guestsWithoutQR.length > 0;

    // === CHOIX INTELLIGENT ===
    let targetGuests = allGuests;
    let mode = 'all';

    if (hasMissingQR) {
        const result = await Swal.fire({
            title: 'Génération en masse',
            html: `
                <p><strong>${allGuests.length}</strong> invités au total</p>
                <p><strong style="color:#10B981">${guestsWithoutQR.length}</strong> sans QR Code</p>
                <p>Que voulez-vous générer ?</p>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: `Tous les invités (${allGuests.length})`,
            cancelButtonText: `Seulement sans QR (${guestsWithoutQR.length})`,
            reverseButtons: true,
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-success',
                popup: 'animated fadeIn faster'
            },
            buttonsStyling: true
        });

        if (result.isConfirmed) {
            targetGuests = allGuests;
            mode = 'all';
        } else if (result.isDismissed) {
            targetGuests = guestsWithoutQR;
            mode = 'missing';
        } else {
            return; 
        }
    } else {
        const confirmed = await Swal.fire({
            title: 'Génération en masse',
            text: `Générer ${allGuests.length} QR Codes ? (tous ont déjà un QR)`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Générer',
            cancelButtonText: 'Annuler',
            customClass: { popup: 'animated fadeIn faster' }
        });
        if (!confirmed.value) return;
    }

    // === STYLES CSS POUR L'ANIMATION ===
    if (!document.getElementById('qr-bulk-styles')) {
        const style = document.createElement('style');
        style.id = 'qr-bulk-styles';
        style.textContent = `
            .bulk-progress-container {
                padding: 20px;
                min-height: 400px;
            }
            .progress-header h4 {
                margin: 0 0 10px 0;
                color: #1f2937;
                font-size: 1.5rem;
            }
            .progress-header p {
                margin: 0;
                color: #6b7280;
                font-size: 1.1rem;
                font-weight: 600;
            }
            .progress-bar-container {
                width: 100%;
                height: 30px;
                background: #e5e7eb;
                border-radius: 15px;
                overflow: hidden;
                margin: 20px 0;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            }
            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                transition: width 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 0.9rem;
            }
            .qr-preview-scroll {
                max-height: 280px;
                overflow-y: auto;
                overflow-x: hidden;
                background: #f9fafb;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                padding: 15px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: center;
                scroll-behavior: smooth;
            }
            .qr-preview-scroll::-webkit-scrollbar {
                width: 8px;
            }
            .qr-preview-scroll::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 10px;
            }
            .qr-preview-scroll::-webkit-scrollbar-thumb {
                background: #10b981;
                border-radius: 10px;
            }
            .qr-preview-item {
                position: relative;
                opacity: 0;
                transform: scale(0.8) translateY(20px);
                animation: qrFadeIn 0.4s ease forwards;
            }
            .qr-preview-item img {
                width: 90px;
                height: 90px;
                border-radius: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border: 3px solid #10b981;
                transition: transform 0.2s ease;
            }
            .qr-preview-item:hover img {
                transform: scale(1.1);
            }
            .qr-preview-item .guest-name {
                position: absolute;
                bottom: -22px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(16, 185, 129, 0.95);
                color: white;
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 0.7rem;
                font-weight: 600;
                white-space: nowrap;
                max-width: 100px;
                overflow: hidden;
                text-overflow: ellipsis;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            }
            @keyframes qrFadeIn {
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            .swal-bulk-generation {
                width: 650px !important;
            }
            .text-muted {
                color: #9ca3af;
                text-align: center;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    // === MODAL DE PROGRESSION AVEC APERÇU DÉFILANT ===
    const progressHtml = `
        <div class="bulk-progress-container">
            <div class="progress-header">
                <h4>🎯 Génération en cours...</h4>
                <p id="progress-text">0 sur ${targetGuests.length}</p>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" id="progressBar" style="width:0%">
                    <span id="progressPercent">0%</span>
                </div>
            </div>
            <div class="qr-preview-scroll" id="qrPreviewScroll">
                <p class="text-muted">⏳ Les QR apparaîtront ici au fur et à mesure...</p>
            </div>
        </div>
    `;

    // Ouvrir la modal SANS attendre de confirmation
    Swal.fire({
        html: progressHtml,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        showCloseButton: false,
        customClass: { popup: 'swal-bulk-generation' },
        didOpen: () => {
            // Ne pas afficher le loader par défaut
            Swal.hideLoading();
        }
    });

    // === ÉLÉMENTS DE LA MODALE (disponibles immédiatement) ===
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progress-text');
    const progressPercent = document.getElementById('progressPercent');
    const previewScroll = document.getElementById('qrPreviewScroll');

    // Vider le message initial
    previewScroll.innerHTML = '';

    // === PRÉPARATION ===
    const useDirectory = !!downloadDirHandle && 'showDirectoryPicker' in window;
    let zip = null;
    let folder = null;
    if (!useDirectory) {
        zip = new JSZip();
        folder = zip.folder(`SECURA_QR_${formatFileName(event.name)}`);
    }

    let successCount = 0;
    const total = targetGuests.length;

    // === BOUCLE DE GÉNÉRATION ===
    for (let i = 0; i < total; i++) {
        const guest = targetGuests[i];
        const qrData = { t: 'INV', e: eventId, g: guest.id };

        try {
            // Créer QR temporaire
            const tempDiv = document.createElement('div');
            tempDiv.style.cssText = 'position:absolute; left:-9999px; top:-9999px;';
            document.body.appendChild(tempDiv);

            new QRCode(tempDiv, {
                text: JSON.stringify(qrData),
                width: qrConfig.size,
                height: qrConfig.size,
                colorDark: qrConfig.foreground,
                colorLight: qrConfig.background,
                correctLevel: QRCode.CorrectLevel[qrConfig.errorLevel]
            });

            // Attendre rendu
            await new Promise(r => setTimeout(r, 120));
            const canvas = tempDiv.querySelector('canvas');
            if (!canvas) throw new Error('Canvas non trouvé');

            const blob = await new Promise(resolve => canvas.toBlob(resolve));

            // === SAUVEGARDE FICHIER ===
            const cleanName = formatFileName(guest.firstName, guest.lastName);
            const filename = `QR_${cleanName}.png`;

            if (useDirectory) {
                const fileHandle = await downloadDirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                folder.file(filename, blob);
            }

            // === SAUVEGARDE DANS STORAGE (seulement si pas déjà existant) ===
            if (!storage.getQRCodeByGuestId(guest.id)) {
                storage.saveQRCode({
                    guestId: guest.id,
                    eventId: event.id,
                    data: JSON.stringify(qrData),
                    config: { ...qrConfig }
                });
            }

            successCount++;

            // === MISE À JOUR UI ===
            const percentage = Math.round((successCount / total) * 100);
            progressBar.style.width = `${percentage}%`;
            progressPercent.textContent = `${percentage}%`;
            progressText.textContent = `${successCount} sur ${total}`;

            // === AJOUTER APERÇU ANIMÉ ===
            const itemDiv = document.createElement('div');
            itemDiv.className = 'qr-preview-item';
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.alt = `${guest.firstName} ${guest.lastName}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'guest-name';
            nameSpan.textContent = `${guest.firstName} ${guest.lastName}`;
            
            itemDiv.appendChild(img);
            itemDiv.appendChild(nameSpan);
            previewScroll.appendChild(itemDiv);

            // Scroll automatique vers le bas
            previewScroll.scrollTop = previewScroll.scrollHeight;

            // Nettoyer
            document.body.removeChild(tempDiv);

            // Petit délai pour fluidité de l'animation
            await new Promise(r => setTimeout(r, 80));

        } catch (err) {
            console.warn(`Échec pour ${guest.firstName} ${guest.lastName}:`, err);
        }
    }

    // === FINALISATION ===
    if (!useDirectory && successCount > 0) {
        progressText.textContent = `Création du fichier ZIP...`;
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SECURA_QR_${formatFileName(event.name)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // === FERMETURE MODALE + NOTIF ===
    Swal.close();
    
    if (typeof SECURA_AUDIO !== 'undefined' && SECURA_AUDIO.success) {
        SECURA_AUDIO.success();
    }
    
    showNotification('success', `✅ ${successCount} QR Codes générés avec succès !`);

    if (mode === 'missing' && hasMissingQR) {
        setTimeout(() => loadGuestsByQREvent(eventId), 500);
    }
}


// ===== AFFICHAGE INFO =====
function displayGuestInfo(guest, event) {
    document.getElementById('infoName').textContent = `${guest.firstName} ${guest.lastName}`;
    document.getElementById('infoEmail').textContent = guest.email || '-';
    document.getElementById('infoPhone').textContent = guest.phone || '-';
    document.getElementById('infoEvent').textContent = event.name;
    document.getElementById('qrInfo').style.display = 'block';
}

function showQRActions() {
    document.getElementById('qrActions').style.display = 'grid';
}

// ===== LOAD GUESTS =====
function loadGuestsByQREvent(eventId) {
    const selector = document.getElementById('qrGuestSelector');
    if (!eventId) {
        selector.innerHTML = '<option value="">-- Sélectionner un événement --</option>';
        selector.disabled = true;
        document.getElementById('generateQrBtn').disabled = true;
        return;
    }
    const guests = storage.getGuestsByEventId(eventId);
    selector.innerHTML = '<option value="">-- Sélectionner un invité --</option>';
    guests.forEach(guest => {
        const hasQR = storage.getQRCodeByGuestId(guest.id) ? ' (QR)' : '';
        selector.innerHTML += `<option value="${guest.id}">${guest.firstName} ${guest.lastName}${hasQR}</option>`;
    });
    selector.disabled = false;
}

// ===== PARTAGE =====
function openShareModal() {
    if (!currentQRCode || !currentGuestId) return;
    document.getElementById('shareModal')?.classList.add('active');
}

function closeShareModal() {
    document.getElementById('shareModal')?.classList.remove('active');
}

function setupShareOptions() {
    const actions = {
        shareEmailBtn: shareViaEmail,
        shareSmsBtn: shareViaSMS,
        shareWhatsappBtn: shareViaWhatsApp,
        shareCopyBtn: copyToClipboard
    };
    Object.entries(actions).forEach(([id, fn]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => { fn(); closeShareModal(); });
    });
}

function shareViaEmail() {
    const guest = storage.getGuestById(currentGuestId);
    const event = storage.getEventById(document.getElementById('qrEventSelector').value);
    if (!guest || !event) return;
    const subject = encodeURIComponent(`Invitation: ${event.name}`);
    const body = encodeURIComponent(`Bonjour ${guest.firstName},\n\nVous êtes invité(e) à ${event.name}\nDate: ${new Date(event.date).toLocaleDateString('fr-FR')}\n${event.time ? `Heure: ${event.time}` : ''}\n${event.location ? `Lieu: ${event.location}` : ''}\n\nVotre QR Code est joint.\n\nCordialement`);
    window.location.href = `mailto:${guest.email}?subject=${subject}&body=${body}`;
}

function shareViaSMS() {
    const guest = storage.getGuestById(currentGuestId);
    if (!guest?.phone) return showNotification('warning', 'Téléphone manquant');
    const msg = encodeURIComponent(`Bonjour ${guest.firstName}, invitation à l'événement.`);
    window.location.href = `sms:${guest.phone}?body=${msg}`;
}

function shareViaWhatsApp() {
    const guest = storage.getGuestById(currentGuestId);
    if (!guest?.phone) return showNotification('warning', 'Téléphone manquant');
    const msg = encodeURIComponent(`*Invitation SECURA*`);
    window.open(`https://wa.me/${guest.phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
}

function copyToClipboard() {
    const canvas = document.querySelector('#qrcode canvas');
    if (!canvas) return;
    canvas.toBlob(blob => {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
            () => showNotification('success', 'Copié !'),
            () => showNotification('error', 'Échec copie')
        );
    });
}

window.closeShareModal = closeShareModal;