



/**
 * SECURA - QR Code Scanner ULTRA INTELLIGENT
 * QR léger → récupère tout via storage
 */

let cameraStream = null;
let scanningActive = false;
let scanInterval = null;

document.addEventListener('DOMContentLoaded', () => {
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

function stopCameraScanning() {
    scanningActive = false;
    clearInterval(scanInterval);
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    const video = document.getElementById('cameraPreview');
    if (video) video.srcObject = null;
    document.getElementById('startScanBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';
}

function startContinuousScanning() {
    if (typeof jsQR === 'undefined') return showNotification('error', 'jsQR non chargé');

    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');

    scanInterval = setInterval(() => {
        if (!scanningActive || !video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
            stopCameraScanning();
            processQRCode(code.data);
        }
    }, 300);
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
            return showNotification('error', 'QR Code invalide');
        }

        const event = storage.getEventById(qr.e);
        const guest = storage.getGuestById(qr.g);

        if (!event || !guest) {
            return showNotification('error', 'Invité ou événement introuvable');
        }

        displayScanResult(event, guest);
        saveScanRecord(qr.e, qr.g, `${guest.firstName} ${guest.lastName}`, event.name);
    } catch (err) {
        showNotification('error', 'Erreur de lecture');
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

    document.getElementById('markPresentBtn').style.display = 'none';
    document.getElementById('resultStatus').innerHTML = `<i class="fas fa-check-circle"></i> <span>Présent</span>`;
    document.getElementById('resultStatus').className = 'status-badge success';

    showNotification('success', `${guest.firstName} marqué présent`);
    updateScanStatistics();
    loadScanHistory();
}

function saveScanRecord(eventId, guestId, guestName, eventName) {
    storage.saveScan({ eventId, guestId, guestName, eventName, scannedAt: new Date().toISOString() });
    loadScanHistory();
    updateScanStatistics();
}

function loadScanHistory() {
    const scans = storage.getAllScans().slice(-10).reverse();
    const list = document.getElementById('scanHistory');
    list.innerHTML = scans.length ? scans.map(s => `
        <div class="history-item">
            <div><strong>${s.guestName}</strong><div class="text-sm text-muted">${s.eventName}</div></div>
            <div class="text-sm text-muted">${new Date(s.scannedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('') : `<div class="empty-state-small"><p>Aucun scan</p></div>`;
    document.getElementById('scanCount').textContent = scans.length;
}

function updateScanStatistics() {
    const today = storage.getTodayScans().length;
    const present = storage.getAllGuests().filter(g => g.scanned).length;
    const last = storage.getAllScans().slice(-1)[0];
    document.getElementById('todayScans').textContent = today;
    document.getElementById('todayPresent').textContent = present;
    document.getElementById('lastScanTime').textContent = last ? new Date(last.scannedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
}

function resetScanner() {
    document.getElementById('scanPlaceholder').style.display = 'block';
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('qrFileDropZone').style.display = 'block';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('qrFileInput').value = '';
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