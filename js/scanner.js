



/**
 * SECURA - QR Code Scanner ULTRA INTELLIGENT
 * QR léger → récupère tout via storage
 */

let cameraStream = null;
let scanningActive = false;
let scanInterval = null;



document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;

    initializeScannerListeners();
    loadScanHistory();
    updateScanStatistics();


});


// ===== LOAD EVENTS =====
function loadEvents() {
    currentEvents = storage.data.events;
    filteredEvents = [...currentEvents];
}

function initializeScannerListeners() {
    document.getElementById('cameraModeBtn')?.addEventListener('click', () => switchScanMode('camera'));
    document.getElementById('fileModeBtn')?.addEventListener('click', () => switchScanMode('file'));
    document.getElementById('startScanBtn')?.addEventListener('click', startCameraScanning);
    document.getElementById('stopScanBtn')?.addEventListener('click', stopCameraScanning);
    document.getElementById('qrFileInput')?.addEventListener('change', handleFileSelect);
    document.getElementById('scanImageBtn')?.addEventListener('click', scanUploadedImage);
    document.getElementById('markPresentBtn')?.addEventListener('click', markGuestPresent);
    document.getElementById('newScanBtn')?.addEventListener('click', resetScanner);

    const dropZone = document.getElementById('qrFileDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('image/')) processImageFile(file);
        });
    }

    getCameras();
}

function switchScanMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(mode === 'camera' ? 'cameraModeBtn' : 'fileModeBtn').classList.add('active');
    document.getElementById('cameraScanner').style.display = mode === 'camera' ? 'block' : 'none';
    document.getElementById('fileScanner').style.display = mode === 'file' ? 'block' : 'none';
    stopCameraScanning();
}

async function getCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const select = document.getElementById('cameraSelect');
        if (select && videoDevices.length > 1) {
            select.innerHTML = videoDevices.map((d, i) => `<option value="${d.deviceId}">${d.label || `Caméra ${i+1}`}</option>`).join('');
            select.style.display = 'block';
        }
    } catch (err) { console.error(err); }
}

async function startCameraScanning() {
    try {
        const deviceId = document.getElementById('cameraSelect')?.value;
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
        });

        const video = document.getElementById('cameraPreview');
        video.srcObject = cameraStream;
        await video.play();

        scanningActive = true;
        document.getElementById('startScanBtn').style.display = 'none';
        document.getElementById('stopScanBtn').style.display = 'inline-flex';

        startContinuousScanning();
        showNotification('info', 'Scan en cours...');
    } catch (err) {
        showNotification('error', 'Caméra inaccessible');
    }
}

/**
 * RESET SCANNER UI – VERSION ULTRA PRO
 * Remet TOUT à zéro : visuel, audio, variables, canvas, caméra
 */
function resetScannerUI() {

    document.getElementById('scanPlaceholder').style.display = 'block';
    document.getElementById('scanResult').style.display = 'none';

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
    document.getElementById('markPresentBtn').style.display = 'none';

    document.getElementById('qrFileDropZone').style.display = 'block';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('uploadedImage').src = '';
    document.getElementById('qrFileInput').value = '';

    // 4. CANVAS PROPRE
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 5. BOUTONS CAMÉRA
    document.getElementById('startScanBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';

    lastDetectedCode = null;
    detectionCooldown = 0;
    scanFrameCount = 0;
    scanningActive = false;

    clearInterval(window.scanSoundInterval);
    window.scanSoundInterval = null;
    SECURA_AUDIO.stop?.() || SECURA_AUDIO.play('notify');

    showNotification('info', 'Scanner réinitialisé');

    updateScanStatistics();
    loadScanHistory();
}



function stopCameraScanning() {
    stopScanningImmediately();
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
}

/* ===== SCANNER QR ULTRA-INTELLIGENT V5 - ZÉRO LAG, 100% FIABLE ===== */
let scanFrameCount = 0;
let lastDetectedCode = null;
let detectionCooldown = 0;
const MIN_CONFIDENCE = 0.8;
const COOLDOWN_FRAMES = 15;
const MAX_SCAN_FPS = 30;

function startContinuousScanning() {
    if (typeof jsQR === 'undefined') {
        return showNotification('error', 'jsQR non chargé');
    }

    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // LANCEMENT SON SCANNER
    SECURA_AUDIO.scan();
    window.scanSoundInterval = setInterval(() => {
        if (scanningActive) SECURA_AUDIO.scan();
    }, 1600);

    let lastTime = 0;
    scanFrameCount = 0;

    const scanLoop = (timestamp) => {
        if (!scanningActive || !video.videoWidth) return;

        const delta = timestamp - lastTime;
        if (delta < 1000 / MAX_SCAN_FPS) {
            requestAnimationFrame(scanLoop);
            return;
        }
        lastTime = timestamp;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });

        if (code && isValidQR(code)) {
            if (detectionCooldown > 0) {
                detectionCooldown--;
                drawQRBox(code, 'yellow');
            } else {
                handleQRDetected(code);
                return;
            }
        } else {
            detectionCooldown = Math.max(0, detectionCooldown - 1);
            drawScanningGrid();
        }

        scanFrameCount++;
        if (scanningActive) requestAnimationFrame(scanLoop);
    };

    requestAnimationFrame(scanLoop);
}



// VÉRIFICATION ULTRA-SÛRE DU QR
function isValidQR(code) {
    if (!code?.data) return false;
    if (detectionCooldown > 0) return false;
    if (code.data === lastDetectedCode) return false;

    try {
        const qr = JSON.parse(code.data);
        return qr.t === 'INV' && qr.e && qr.g;
    } catch {
        return false;
    }
}

// GESTION DÉTECTION PARFAITE
function handleQRDetected(code) {
    lastDetectedCode = code.data;
    detectionCooldown = COOLDOWN_FRAMES;

    stopScanningImmediately();

    drawQRBox(code, '#22c55e', 2);
    SECURA_AUDIO.scan();
    SECURA_AUDIO.success();

    setTimeout(() => processQRCode(code.data), 300);
}


// ARRÊT NET & PROPRE
function stopScanningImmediately() {
    scanningActive = false;
    clearInterval(window.scanSoundInterval);
    clearInterval(scanInterval);
    window.scanSoundInterval = null;

    const video = document.getElementById('cameraPreview');
    if (video) video.pause();

    document.getElementById('startScanBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';

    SECURA_AUDIO.stop();
    // Nettoyage canvas
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// DESSIN BOÎTE QR LIVE
function drawQRBox(code, color = '#3b82f6', thickness = 3) {
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.strokeRect(
        code.location.topLeftCorner.x,
        code.location.topLeftCorner.y,
        code.location.bottomRightCorner.x - code.location.topLeftCorner.x,
        code.location.bottomRightCorner.y - code.location.topLeftCorner.y
    );

    // Coins stylés
    const cornerSize = 20;
    ctx.lineWidth = 5;
    [
        code.location.topLeftCorner,
        code.location.topRightCorner,
        code.location.bottomLeftCorner,
        code.location.bottomRightCorner
    ].forEach(corner => {
        ctx.beginPath();
        ctx.moveTo(corner.x - cornerSize, corner.y);
        ctx.lineTo(corner.x, corner.y);
        ctx.lineTo(corner.x, corner.y - cornerSize);
        ctx.stroke();
    });
}

// GRILLE DE SCAN ANIMÉE
function drawScanningGrid() {
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const time = Date.now() * 0.003;
    const gridSize = 40;
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 + 0.2 * Math.sin(time)})`;
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Ligne laser animée
    const laserY = (canvas.height / 2 + Math.sin(time * 3) * 100);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -time * 20;
    ctx.beginPath();
    ctx.moveTo(0, laserY);
    ctx.lineTo(canvas.width, laserY);
    ctx.stroke();
    ctx.setLineDash([]);
}



// ===== FILE SCANNING =====
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file);
    }
}
function processImageFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const img = document.getElementById('uploadedImage');
        img.src = e.target.result;
        
        document.getElementById('qrFileDropZone').style.display = 'none';
        document.getElementById('filePreview').style.display = 'block';
    };
    
    reader.readAsDataURL(file);
}
function scanUploadedImage() {
    if (typeof jsQR === 'undefined') {
        showNotification('error', 'Bibliothèque jsQR non chargée');
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
    if (code) {
        processQRCode(code.data);
    } else {
        showNotification('error', 'Aucun QR Code détecté dans l\'image');
    }
}

// ===== PROCESS QR CODE (INTELLIGENT) =====
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

        // SON DE VALIDATION
        SECURA_AUDIO.success();

        if (!guest.scanned) {
            SECURA_AUDIO.play('welcome');
        }

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

    playSuccessSound();
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

function resetScanner() {
    stopCameraScanning();
    resetScannerUI();
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