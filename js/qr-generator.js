/**
 * SECURA - QR Code Generator ULTRA MÉGA COMPLET
 * QR ultra-léger + génération en masse + ZIP ou DOSSIER
 */
let currentQRCode = null;
let currentGuestId = null;
let qrConfig = {
    size: 300,
    foreground: '#D97706',
    background: '#FFFFFF',
    style: 'square',
    errorLevel: 'H', // H = max robustesse
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
        .replace(/^-|-$/g, '');      // retire tiret au début/fin
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

// ===== GÉNÉRATION EN MASSE → ZIP OU DOSSIER =====
async function bulkGenerateAndDownload() {
    const eventId = document.getElementById('qrEventSelector').value;
    if (!eventId) return showNotification('warning', 'Sélectionnez un événement');

    const guests = storage.getGuestsByEventId(eventId);
    const event = storage.getEventById(eventId);
    if (guests.length === 0) return showNotification('warning', 'Aucun invité');

    const confirmed = await confirmDialog(
        'Génération en masse',
        `Générer <strong>${guests.length}</strong> QR Codes ?`,
        'Lancer',
        'Annuler'
    );
    if (!confirmed) return;

    showLoading();

    const useDirectory = !!downloadDirHandle && 'showDirectoryPicker' in window;
    let successCount = 0;

    if (useDirectory) {
        // CHROME/EDGE → DOSSIER
        for (const guest of guests) {
            try {
                const qrData = { t: 'INV', e: eventId, g: guest.id };
                const tempDiv = document.createElement('div');
                tempDiv.style.display = 'none';
                document.body.appendChild(tempDiv);

                new QRCode(tempDiv, {
                    text: JSON.stringify(qrData),
                    width: qrConfig.size,
                    height: qrConfig.size,
                    colorDark: qrConfig.foreground,
                    colorLight: qrConfig.background,
                    correctLevel: QRCode.CorrectLevel.H
                });

                await new Promise(r => setTimeout(r, 80));
                const canvas = tempDiv.querySelector('canvas');
                if (canvas) {
                    const blob = await new Promise(resolve => canvas.toBlob(resolve));
                    const cleanName = formatFileName(guest.firstName, guest.lastName);
                    const filename = `QR_${cleanName}.png`;
                    const fileHandle = await downloadDirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    successCount++;
                }

                storage.saveQRCode({ guestId: guest.id, eventId: event.id, data: JSON.stringify(qrData), config: qrConfig });
                document.body.removeChild(tempDiv);
            } catch (err) {
                console.warn('Échec pour', guest.firstName);
            }
        }
    } else {
        // TOUS NAVIGATEURS → ZIP
        const zip = new JSZip();
        const folder = zip.folder(`SECURA_QR_${event.name.replace(/\s+/g, '_')}`);

        for (const guest of guests) {
            try {
                const qrData = { t: 'INV', e: eventId, g: guest.id };
                const tempDiv = document.createElement('div');
                tempDiv.style.display = 'none';
                document.body.appendChild(tempDiv);

                new QRCode(tempDiv, {
                    text: JSON.stringify(qrData),
                    width: qrConfig.size,
                    height: qrConfig.size,
                    colorDark: qrConfig.foreground,
                    colorLight: qrConfig.background,
                    correctLevel: QRCode.CorrectLevel.H
                });

                await new Promise(r => setTimeout(r, 80));
                const canvas = tempDiv.querySelector('canvas');
                if (canvas) {
                    const blob = await new Promise(resolve => canvas.toBlob(resolve));
                    const cleanName = formatFileName(guest.firstName, guest.lastName);
const filename = `QR_${cleanName}.png`;
                    folder.file(filename, blob);
                    successCount++;
                }

                storage.saveQRCode({ guestId: guest.id, eventId: event.id, data: JSON.stringify(qrData), config: qrConfig });
                document.body.removeChild(tempDiv);
            } catch (err) {
                console.warn('Échec pour', guest.firstName);
            }
        }

        // GÉNÉRER ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SECURA_QR_${event.name.replace(/\s+/g, '_')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    }

    hideLoading();
    SECURA_AUDIO.success();
    showNotification('success', `${successCount} QR générés !`);
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