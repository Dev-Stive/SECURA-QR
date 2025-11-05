
/**
 * SECURA - QR Code Scanner ULTRA INTELLIGENT
 * NOUVELLE VERSION : CAPTURE → ANALYSE → SCAN DIRECT BACKEND
 * Auteur : toi + Grok (2025)
 */

let cameraStream = null;
let scanningActive = false;
let capturedImageData = null;
let captureTimeout = null;
let lastDetectedCode = null;
let detectionCooldown = 0;
let scanFrameCount = 0;

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
    document.getElementById('captureBtn')?.addEventListener('click', capturePhoto);
    document.getElementById('analyzeCaptureBtn')?.addEventListener('click', analyzeCapturedPhoto);
    document.getElementById('qrFileInput')?.addEventListener('change', handleFileSelect);
    document.getElementById('scanImageBtn')?.addEventListener('click', scanUploadedImage);
    document.getElementById('markPresentBtn')?.addEventListener('click', markGuestPresent);
    document.getElementById('newScanBtn')?.addEventListener('click', resetScanner);
    document.getElementById('newScan')?.addEventListener('click', resetScanner);

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
/* ====================== MODE SWITCH ========================== */
/* ============================================================= */
function switchScanMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(mode === 'camera' ? 'cameraModeBtn' : 'fileModeBtn').classList.add('active');
    document.getElementById('cameraScanner').style.display = mode === 'camera' ? 'block' : 'none';
    document.getElementById('fileScanner').style.display = mode === 'file' ? 'block' : 'none';
    stopCameraScanning();
    resetCaptureUI();
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

        document.getElementById('startScanBtn').style.display = 'none';
        document.getElementById('stopScanBtn').style.display = 'inline-flex';
        document.getElementById('captureBtn').style.display = 'inline-flex';
        document.getElementById('analyzeCaptureBtn').style.display = 'none';

        showNotification('info', 'Appuyez sur CAPTURER');
        SECURA_AUDIO.scan();

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
    const video = document.getElementById('cameraPreview');
    if (!video || !cameraStream) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const TARGET_W = 1080;
    const ratio = video.videoHeight / video.videoWidth;
    canvas.width = TARGET_W;
    canvas.height = TARGET_W * ratio;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    capturedImageData = canvas.toDataURL('image/jpeg', 0.95);

    // Stop caméra
    video.pause();
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    video.srcObject = null;

    // UI
    document.querySelector('.camera-container').style.display = 'none';
    const img = document.getElementById('capturedPreview');
    img.src = capturedImageData;
    img.style.display = 'block';
    document.getElementById('capturePreview').style.display = 'block';

    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('analyzeCaptureBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';

    if (captureTimeout) clearTimeout(captureTimeout);

    showNotification('success', 'Photo capturée ! Appuyez sur ANALYSER');
    SECURA_AUDIO.play();
}

function analyzeCapturedPhoto() {
    if (!capturedImageData) return;

    showLoading(); // SPINNER

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
            scanQRCodeOnBackend(code.data); // SCAN DIRECT BACKEND
        } else {
            hideLoading();
            SECURA_AUDIO.error();
            showNotification('error', 'Aucun QR Code détecté');
        }
    };
    img.src = capturedImageData;
}

/* ============================================================= */
/* =================== SCAN DIRECT BACKEND ===================== */
/* ============================================================= */
async function scanQRCodeOnBackend(qrData) {
    try {
        const qr = JSON.parse(qrData);
        if (qr.t !== 'INV' || !qr.e || !qr.g) {
            throw new Error('QR invalide');
        }

        // ✅ APPEL UNIFIÉ
        const result = await storage.scanQRCode(qr);

        if (result && result.guest) {
            hideLoading();
            SECURA_AUDIO.success();
            if (!result.guest.scanned) SECURA_AUDIO.play('welcome');
            displayScanResultFromAPI(result);
            loadScanHistory();
            updateScanStatistics();
        } else {
            throw new Error('Scan échoué');
        }
    } catch (err) {
        hideLoading();
        SECURA_AUDIO.error();
        showNotification('error', 'Scan échoué ou QR invalide');
        console.error(err);
    }
}


function displayScanResultFromAPI(data) {
    const { scan, guest, event } = data;

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
    document.getElementById('resultNote').textContent = guest.notes || '';
    document.getElementById('resultLocation').textContent = event.location || '-';

    const btn = document.getElementById('markPresentBtn');
    btn.style.display = guest.scanned ? 'none' : 'inline-flex';
    btn.dataset.guestId = guest.id;
    btn.dataset.eventId = event.id;
}

/* ============================================================= */
/* ====================== FILE MODE ============================ */
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

    showLoading(); // SPINNER

    const img = document.getElementById('uploadedImage');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && isValidQR(code)) {
        scanQRCodeOnBackend(code.data);
    } else {
        hideLoading();
        showNotification('error', 'Aucun QR Code détecté');
    }
}

/* ============================================================= */
/* ====================== MARK PRESENT ========================= */
/* ============================================================= */
async function markGuestPresent() {
    const btn = document.getElementById('markPresentBtn');
    const guestId = btn.dataset.guestId;
    const eventId = btn.dataset.eventId;

    if (!guestId || !eventId) return;

    showLoading();

    try {
        const result = await storage.scanQRCode(guestId, eventId);
        if (result) {
            hideLoading();
            SECURA_AUDIO.success();
            btn.style.display = 'none';
            document.getElementById('resultStatus').innerHTML = `<i class="fas fa-check-circle"></i> <span>Présent</span>`;
            document.getElementById('resultStatus').className = 'status-badge success';
            showNotification('success', 'Marqué présent !');
            updateScanStatistics();
            loadScanHistory();
        }
    } catch (err) {
        hideLoading();
        showNotification('error', 'Échec marquage');
    }
}

/* ============================================================= */
/* ====================== RESET UI ============================= */
/* ============================================================= */
function resetCaptureUI() {
    capturedImageData = null;
    document.getElementById('capturePreview').style.display = 'none';
    document.getElementById('capturedPreview').src = '';
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('analyzeCaptureBtn').style.display = 'none';
    document.getElementById('startScanBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';

    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) cameraContainer.style.display = 'block';
    clearTimeout(captureTimeout);
}

function stopCameraScanning() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    const video = document.getElementById('cameraPreview');
    if (video) video.srcObject = null;
    resetCaptureUI();
}

function resetScanner() {
    stopCameraScanning();
    hideLoading();
    document.getElementById('scanPlaceholder').style.display = 'block';
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('qrFileDropZone').style.display = 'block';
    document.getElementById('uploadedImage').src = '';
    document.getElementById('qrFileInput').value = '';
    updateScanStatistics();
    loadScanHistory();
    showNotification('info', 'Scanner réinitialisé');
}

/* ============================================================= */
/* ====================== UTILS ================================ */
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
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                })} - ${new Date(s.scannedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit', minute: '2-digit'
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

// Exposer globalement
window.loadScanHistory = loadScanHistory;
window.getCameras = getCameras;



      



