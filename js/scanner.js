/** 
 * SECURA - QR Code Scanner ULTRA INTELLIGENT 
 * NOUVELLE VERSION : CAPTURE → ANALYSE (zéro scan vidéo)
 * Auteur : toi + Grok (2025)
 */

let cameraStream = null;
let scanningActive = false;
let capturedImageData = null;       // ← image capturée
let captureTimeout = null;          // ← auto-stop 15s

document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;
    initializeScannerListeners();
    loadScanHistory();
    updateScanStatistics();
});

/* ============================================================= */
/* =================== INITIALISATION UI ======================= */
/* ============================================================= */
function initializeScannerListeners() {
    document.getElementById('cameraModeBtn')?.addEventListener('click', () => switchScanMode('camera'));
    document.getElementById('fileModeBtn')?.addEventListener('click', () => switchScanMode('file'));
    document.getElementById('startScanBtn')?.addEventListener('click', startCameraForCapture);
    document.getElementById('stopScanBtn')?.addEventListener('click', stopCameraScanning);
    document.getElementById('captureBtn')?.addEventListener('click', capturePhoto);               // NOUVEAU
    document.getElementById('analyzeCaptureBtn')?.addEventListener('click', analyzeCapturedPhoto); // NOUVEAU
    document.getElementById('qrFileInput')?.addEventListener('change', handleFileSelect);
    document.getElementById('scanImageBtn')?.addEventListener('click', scanUploadedImage);
    document.getElementById('markPresentBtn')?.addEventListener('click', markGuestPresent);
    document.getElementById('newScanBtn')?.addEventListener('click', resetScanner);

    const dropZone = document.getElementById('qrFileDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault(); dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('image/')) processImageFile(file);
        });
    }
    getCameras();
}


/* ============================================================= */
/* ============ FONCTIONS OUBLIÉES (à coller à la FIN) ========== */
/* ============================================================= */

// 1. CHARGEMENT DES ÉVÉNEMENTS (pour storage.js)
function loadEvents() {
    if (typeof storage === 'undefined' || !storage.data) return;
    currentEvents = storage.data.events || [];
    filteredEvents = [...currentEvents];
}

// 2. LISTE DES CAMÉRAS
async function getCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const select = document.getElementById('cameraSelect');
        if (select && videoDevices.length > 1) {
            select.innerHTML = videoDevices.map((d, i) => 
                `<option value="${d.deviceId}">${d.label || `Caméra ${i+1}`}</option>`
            ).join('');
            select.style.display = 'block';
        }
    } catch (err) {
        console.error('Erreur caméras:', err);
    }
}

let currentEvents = [];
let filteredEvents = [];

window.loadEvents = loadEvents;
window.getCameras = getCameras;

/* ============================================================= */
/* ====================== MODE SWITCH ========================== */
/* ============================================================= */
function switchScanMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(mode === 'camera' ? 'cameraModeBtn' : 'fileModeBtn').classList.add('active');
    document.getElementById('cameraScanner').style.display = mode === 'camera' ? 'block' : 'none';
    document.getElementById('fileScanner').style.display = mode === 'file' ? 'block' : 'none';
    stopCameraScanning();
    resetCaptureUI();                       // ← reset capture
}

/* ============================================================= */
/* =================== CAMÉRA POUR CAPTURE ===================== */
/* ============================================================= */
async function startCameraForCapture() {
    try {
        const deviceId = document.getElementById('cameraSelect')?.value;
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
        });

        const video = document.getElementById('cameraPreview');
        video.srcObject = cameraStream;
        await video.play();

        // UI : on cache Démarrer, on montre Capturer
        document.getElementById('startScanBtn').style.display = 'none';
        document.getElementById('stopScanBtn').style.display = 'inline-flex';
        document.getElementById('captureBtn').style.display = 'inline-flex';
        document.getElementById('analyzeCaptureBtn').style.display = 'none';

        showNotification('info', 'Appuyez sur CAPTURER');
        SECURA_AUDIO.scan();

        // Auto-stop 15s
        captureTimeout = setTimeout(() => {
            showNotification('info', 'Temps écoulé → arrêt');
            stopCameraScanning();
        }, 15000);

    } catch (err) {
        showNotification('error', 'Caméra inaccessible');
        console.error(err);
    }
}

function capturePhoto() {
    const cameraContainer = document.querySelector('.camera-container');
    const video = document.getElementById('cameraPreview');

    if (!video || !cameraStream) return;

    // 1. Capture sur canvas temporaire
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const TARGET_W = 1080;
    const ratio = video.videoHeight / video.videoWidth;
    canvas.width = TARGET_W;
    canvas.height = TARGET_W * ratio;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    capturedImageData = canvas.toDataURL('image/jpeg', 0.95);

    // 2. Stoppe la caméra
    video.pause();
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    video.srcObject = null;

    // 3. Masque tout dans camera-container
    if (cameraContainer) cameraContainer.style.display = 'none';


    // 4. Affiche la capture
    const img = document.getElementById('capturedPreview');
    img.src = capturedImageData;
    img.style.display = 'block';
    document.getElementById('capturePreview').style.display = 'block';

    // 5. Mise à jour des boutons
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('analyzeCaptureBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';

    // 6. Nettoyage timeout
    if (captureTimeout) clearTimeout(captureTimeout);

    // 7. Notification et son
    showNotification('success', 'Photo capturée ! Appuyez sur ANALYSER');
    SECURA_AUDIO.play();
}


function analyzeCapturedPhoto() {
    if (!capturedImageData) return;

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });

        if (code && isValidQR(code)) {
            handleQRDetected(code);
        } else {
            SECURA_AUDIO.error();
            showNotification('error', 'Aucun QR Code détecté dans la capture');
        }
    };
    img.src = capturedImageData;
}

/* ============================================================= */
/* =================== RESET CAPTURE UI ======================= */
/* ============================================================= */
function resetCaptureUI() {
    capturedImageData = null;

    // Masques capture preview
    document.getElementById('capturePreview').style.display = 'none';
    document.getElementById('capturedPreview').src = '';

    // Boutons
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('analyzeCaptureBtn').style.display = 'none';
    document.getElementById('startScanBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';

    // Réaffiche le container caméra, le canvas et l'overlay
    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) cameraContainer.style.display = 'block';

    const canvasEl = document.getElementById('scannerCanvas');
    if (canvasEl) canvasEl.style.display = 'block';

    const overlay = document.querySelector('.scanner-overlay');
    if (overlay) overlay.style.display = 'flex';

    clearTimeout(captureTimeout);
}


/* ============================================================= */
/* ====================== STOP CAMÉRA ========================= */
/* ============================================================= */
function stopCameraScanning() {
    stopScanningImmediately();
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    resetCaptureUI();
    const video = document.getElementById('cameraPreview');
    if (video) video.srcObject = null;
}

function stopScanningImmediately() {
    scanningActive = false;
    clearInterval(window.scanSoundInterval);
    window.scanSoundInterval = null;
    SECURA_AUDIO.stop();
}

/* ============================================================= */
/* =================== QR VALIDATION ========================== */
/* ============================================================= */
function isValidQR(code) {
    if (!code?.data) return false;
    try {
        const qr = JSON.parse(code.data);
        return qr.t === 'INV' && qr.e && qr.g;
    } catch {
        return false;
    }
}

function handleQRDetected(code) {
    stopCameraScanning();
    SECURA_AUDIO.success();
    setTimeout(() => processQRCode(code.data), 300);
}

/* ============================================================= */
/* ====================== PROCESS QR =========================== */
/* ============================================================= */
function processQRCode(data) {
    try {
        const qr = JSON.parse(data);
        if (qr.t !== 'INV' || !qr.e || !qr.g) {
            SECURA_AUDIO.error();
            return showNotification('error', 'QR invalide');
        }
        const event = storage.getEventById(qr.e);
        const guest = storage.getGuestById(qr.g);
        if (!event || !guest) {
            SECURA_AUDIO.error();
            return showNotification('error', 'Introuvable');
        }
        SECURA_AUDIO.success();
        if (!guest.scanned) SECURA_AUDIO.play('welcome');
        displayScanResult(event, guest);
        saveScanRecord(qr.e, qr.g, `${guest.firstName} ${guest.lastName}`, event.name);
    } catch (err) {
        SECURA_AUDIO.error();
        showNotification('error', 'Lecture échouée');
    }
}

function displayScanResult(event, guest) {
    document.getElementById('scanPlaceholder').style.display = 'none';
    document.getElementById('scanResult').style.display = 'block';
    const status = guest.scanned ? 'Déjà présent' : 'Valide';
    const icon = guest.scanned ? 'fa-info-circle' : 'fa-check-circle';
    document.getElementById('resultStatus').innerHTML = `<i class="fas ${icon}"></i> <span>${status}</span>`;
    document.getElementById('resultStatus').className = `status-badge ${guest.scanned ? 'pending' : 'success'}`;
    document.getElementById('scanTime').textContent = new Date().toLocaleTimeString('fr-FR');
    document.getElementById('welcomeMessage').textContent = event.welcomeMessage || `Bienvenue ${guest.firstName} !`;
    document.getElementById('resultName').textContent = `${guest.firstName} ${guest.lastName}`;
    document.getElementById('resultEmail').textContent = guest.email || '-';
    document.getElementById('resultPhone').textContent = guest.phone || '-';
    document.getElementById('resultEvent').textContent = event.name;
    const date = new Date(event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('resultDateTime').textContent = `${date} ${event.time || ''}`;
    document.getElementById('resultLocation').textContent = event.location || '-';
    const btn = document.getElementById('markPresentBtn');
    btn.style.display = guest.scanned ? 'none' : 'inline-flex';
    btn.dataset.guestId = guest.id;
    //playSuccessSound();
}

/* ============================================================= */
/* ====================== FILE MODE (inchangé) ================ */
/* ============================================================= */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processImageFile(file);
}

function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById('uploadedImage');
        img.src = e.target.result;
        document.getElementById('qrFileDropZone').style.display = 'none';
        document.getElementById('filePreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function scanUploadedImage() {
    if (typeof jsQR === 'undefined') {
        showNotification('error', 'jsQR non chargé');
        return;
    }
    const img = document.getElementById('uploadedImage');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) processQRCode(code.data);
    else showNotification('error', 'Aucun QR Code détecté dans l\'image');
}




function markGuestPresent() {
    const guestId = document.getElementById('markPresentBtn').dataset.guestId;
    const guest = storage.getGuestById(guestId);
    if (!guest) return;

    guest.scanned = true;
    guest.scannedAt = new Date().toISOString();
    storage.saveGuest(guest);

    SECURA_AUDIO.success();

    document.getElementById('markPresentBtn').style.display = 'none';
    document.getElementById('resultStatus').innerHTML = `<i class="fas fa-check-circle"></i> <span>Présent</span>`;
    document.getElementById('resultStatus').className = 'status-badge success';
    showNotification('success', `${guest.firstName} marqué présent !`);
    updateScanStatistics();
    loadScanHistory();
}



function saveScanRecord(eventId, guestId, guestName, eventName) {
    storage.saveScan({ eventId, guestId, guestName, eventName, scannedAt: new Date().toISOString() });
    loadScanHistory();
    updateScanStatistics();
}

function loadScanHistory() {
    const scans = storage.getAllScansDesc();
    const list = document.getElementById('scanHistory');

    list.innerHTML = scans.length ? scans.map(s => `
        <div class="history-item">
            <div>
                <strong>${s.guestName}</strong>
                <div class="text-sm text-muted">${s.eventName}</div>
            </div>
            <div class="text-sm text-muted">
                ${new Date(s.scannedAt).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                })} - ${new Date(s.scannedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}
                </div>

        </div>
    `).join('') : `<div class="empty-state-small"><p>Aucun scan</p></div>`;

    document.getElementById('scanCount').textContent = storage.getAllScans().length;
}


function updateScanStatistics() {
    const today = storage.getTodayScans().length;
    const present = storage.getAllGuests().filter(g => g.scanned).length;

    const lastScan = storage.getAllScansDesc()[0];
    document.getElementById('todayScans').textContent = today;
    document.getElementById('todayPresent').textContent = present;
    document.getElementById('lastScanTime').textContent = lastScan
        ? new Date(lastScan.scannedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '-';
}



/** 
 * RESET SCANNER UI – VERSION ULTRA PRO
 * Remet tout à zéro : visuel, audio, variables, canvas, caméra
 */
function resetScannerUI() {
    // Affichage et masquage des éléments
    document.getElementById('scanPlaceholder').style.display = 'block';
    document.getElementById('cameraPreview').style.display = 'block';
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('qrFileDropZone').style.display = 'block';
    document.getElementById('filePreview').style.display = 'none';

    // Réinitialisation des valeurs
    document.getElementById('resultStatus').innerHTML = '';
    document.getElementById('resultStatus').className = 'status-badge';
    document.getElementById('scanTime').textContent = '-';
    document.getElementById('welcomeMessage').textContent = 'Scannez un QR Code';
    document.getElementById('resultName').textContent = '-';
    document.getElementById('resultEmail').textContent = '-';
    document.getElementById('resultPhone').textContent = '-';
    document.getElementById('resultEvent').textContent = '-';
    document.getElementById('resultDateTime').textContent = '-';
    document.getElementById('resultLocation').textContent = '-';

    // Boutons et inputs
    document.getElementById('markPresentBtn').style.display = 'none';
    document.getElementById('uploadedImage').src = '';
    document.getElementById('qrFileInput').value = '';
    document.getElementById('startScanBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';

    // Nettoyage du canvas
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Réinitialisation des variables internes
    lastDetectedCode = null;
    detectionCooldown = 0;
    scanFrameCount = 0;
    scanningActive = false;

    // Arrêt des sons et notifications
    clearInterval(window.scanSoundInterval);
    window.scanSoundInterval = null;
    SECURA_AUDIO.stop?.() || SECURA_AUDIO.play('notify');

    // Mise à jour des statistiques et historique
    updateScanStatistics();
    loadScanHistory();

    showNotification('info', 'Scanner réinitialisé');
}



/**
 * RESET COMPLET DU SCANNER
 */
function resetScanner() {
    stopCameraScanning();
    resetScannerUI();
    resetCaptureUI();
    lastDetectedCode = null;
    detectionCooldown = 0;
}


function playSuccessSound() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
}

window.addEventListener('beforeunload', stopCameraScanning);