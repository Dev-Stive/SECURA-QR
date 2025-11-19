/**
 * ════════════════════════════════════════════════════════════════
 *  🎫 SECURA ULTRA PREMIUM TICKET GENERATOR
 *  Design professionnel avec Canvas, QR Code et Export haute qualité
 * ════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// 📊 DONNÉES DE L'ÉVÉNEMENT
// ═══════════════════════════════════════════════════════════════

const EVENT_DATA = {
    name: "ANNIVERSAIRE DE STELLA ELSA",
    type: "anniversaire",
    date: "2026-07-11",
    time: "21:30",
    location: "Club France",
    description: "Soirée de boivement et collation",
    welcomeMessage: "Bienvenue au Club France\nEn ce jour spécial, je vous souhaite la bienvenue à mon 21e anniversaire",
    active: true,
    id: "evt_1762787514697_wolaildj0",
    createdAt: "2025-11-10T15:11:54.697Z",
    updatedAt: "2025-11-10T15:11:54.697Z"
};

// ═══════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION DES TYPES D'ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════

const EVENT_TYPES = {
    marriage: {
        label: 'MARIAGE',
        icon: 'bi-heart-fill',
        background: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=90',
        colors: { primary: '#FF6B9D', secondary: '#FEC163' }
    },
    anniversaire: {
        label: 'ANNIVERSAIRE',
        icon: 'bi-cake2-fill',
        background: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1600&q=90',
        colors: { primary: '#A8EDEA', secondary: '#FED6E3' }
    },
    anniversary: {
        label: 'ANNIVERSAIRE',
        icon: 'bi-cake2-fill',
        background: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1600&q=90',
        colors: { primary: '#A8EDEA', secondary: '#FED6E3' }
    },
    conference: {
        label: 'CONFÉRENCE',
        icon: 'bi-person-workspace',
        background: 'https://images.unsplash.com/photo-1540575467063-868f79e66c3f?w=1600&q=90',
        colors: { primary: '#667eea', secondary: '#764ba2' }
    },
    corporate: {
        label: 'ÉVÉNEMENT ENTREPRISE',
        icon: 'bi-building',
        background: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1600&q=90',
        colors: { primary: '#2C3E50', secondary: '#4CA1AF' }
    },
    concert: {
        label: 'CONCERT',
        icon: 'bi-music-note-beamed',
        background: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&q=90',
        colors: { primary: '#F093FB', secondary: '#F5576C' }
    },
    gala: {
        label: 'GALA',
        icon: 'bi-gem',
        background: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1600&q=90',
        colors: { primary: '#C79081', secondary: '#DFA579' }
    },
    graduation: {
        label: 'REMISE DE DIPLÔMES',
        icon: 'bi-mortarboard-fill',
        background: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&q=90',
        colors: { primary: '#4ECDC4', secondary: '#44A08D' }
    },
    football: {
        label: 'ÉVÉNEMENT SPORTIF',
        icon: 'bi-trophy-fill',
        background: 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1600&q=90',
        colors: { primary: '#11998e', secondary: '#38ef7d' }
    }
};

// ═══════════════════════════════════════════════════════════════
// 🎨 DESSIN DES BORDURES MAJESTUEUSES SUR CANVAS
// ═══════════════════════════════════════════════════════════════

function drawMajesticBorders(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Ajuster la taille du canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const w = rect.width;
    const h = rect.height;
    
    // Couleurs
    const gold = '#D4AF37';
    const goldDark = '#B8860B';
    const goldLight = '#F4E4C1';
    
    // Effacer le canvas
    ctx.clearRect(0, 0, w, h);
    
    // === BORDURE PRINCIPALE DOUBLE ===
    // Bordure extérieure dorée
    ctx.strokeStyle = gold;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const margin = 15;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    
    // Bordure intérieure plus fine
    ctx.strokeStyle = goldLight;
    ctx.lineWidth = 2;
    const marginInner = 22;
    ctx.strokeRect(marginInner, marginInner, w - marginInner * 2, h - marginInner * 2);
    
    // === ORNEMENTS DANS LES COINS ===
    const cornerSize = 80;
    const offset = 30;
    
    // Fonction pour dessiner un ornement d'angle
    function drawCornerOrnament(x, y, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        
        // Motif floral/royal
        ctx.strokeStyle = gold;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.7;
        
        // Lignes décoratives
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 40);
        ctx.stroke();
        
        // Cercles décoratifs
        ctx.fillStyle = goldDark;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(15, 15, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(30, 8, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(8, 30, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Lignes fines diagonales
        ctx.strokeStyle = goldLight;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(5, 5);
        ctx.lineTo(35, 35);
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Dessiner les 4 ornements de coin
    drawCornerOrnament(offset, offset, 0);                          // Top-left
    drawCornerOrnament(w - offset, offset, Math.PI / 2);           // Top-right
    drawCornerOrnament(w - offset, h - offset, Math.PI);           // Bottom-right
    drawCornerOrnament(offset, h - offset, -Math.PI / 2);          // Bottom-left
    
    // === MOTIFS DÉCORATIFS CENTRAUX ===
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.15;
    
    // Motifs sur les côtés
    const numPatterns = 5;
    for (let i = 0; i < numPatterns; i++) {
        const yPos = (h / (numPatterns + 1)) * (i + 1);
        
        // Côté gauche
        ctx.beginPath();
        ctx.moveTo(margin + 5, yPos - 10);
        ctx.lineTo(margin + 15, yPos);
        ctx.lineTo(margin + 5, yPos + 10);
        ctx.stroke();
        
        // Côté droit
        ctx.beginPath();
        ctx.moveTo(w - margin - 5, yPos - 10);
        ctx.lineTo(w - margin - 15, yPos);
        ctx.lineTo(w - margin - 5, yPos + 10);
        ctx.stroke();
    }
    
    // Motifs en haut et en bas
    for (let i = 0; i < numPatterns; i++) {
        const xPos = (w / (numPatterns + 1)) * (i + 1);
        
        // Haut
        ctx.beginPath();
        ctx.moveTo(xPos - 10, margin + 5);
        ctx.lineTo(xPos, margin + 15);
        ctx.lineTo(xPos + 10, margin + 5);
        ctx.stroke();
        
        // Bas
        ctx.beginPath();
        ctx.moveTo(xPos - 10, h - margin - 5);
        ctx.lineTo(xPos, h - margin - 15);
        ctx.lineTo(xPos + 10, h - margin - 5);
        ctx.stroke();
    }
    
    // === EFFET DE BRILLANCE (optionnel) ===
    ctx.globalAlpha = 0.08;
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(margin, margin, w - margin * 2, h - margin * 2);
}

// ═══════════════════════════════════════════════════════════════
// 📝 FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function formatDateLong(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    return `${parts[0].padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════
// 🎫 GÉNÉRATION DU BILLET
// ═══════════════════════════════════════════════════════════════

function generateTicket(event) {
    // Récupérer la config du type
    const typeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.anniversaire;
    
    // Mettre à jour le type
    const typeEl = document.getElementById('eventType');
    typeEl.innerHTML = `<i class="${typeConfig.icon}"></i> ${typeConfig.label}`;
    
    // Mettre à jour le titre
    document.getElementById('eventTitle').textContent = event.name;
    
    // Mettre à jour le message de bienvenue
    const welcomeLines = event.welcomeMessage.split('\n');
    document.getElementById('eventWelcome').innerHTML = welcomeLines
        .map(line => escapeHtml(line))
        .join('<br>');
    
    // Mettre à jour la date
    const dateFormatted = formatDateLong(event.date);
    const timeFormatted = formatTime(event.time);
    document.getElementById('eventDate').textContent = `${dateFormatted} · ${timeFormatted}`;
    
    // Mettre à jour le lieu
    document.getElementById('eventLocation').textContent = event.location;
    
    // Mettre à jour la description (si présente)
    if (event.description) {
        document.getElementById('descItem').style.display = 'flex';
        document.getElementById('eventDesc').textContent = event.description;
    }
    
    // Mettre à jour l'image de fond
    const bgEl = document.getElementById('ticketBg');
    bgEl.style.backgroundImage = `url('${typeConfig.background}')`;
    
    // Dessiner les bordures majestueuses
   const ticketCanvas = document.getElementById('borderCanvas'); // Canvas du ticket principal
        const qrCanvas = document.getElementById('qrBorderCanvas');   // Nouveau canvas pour le QR
        
        drawMajesticBorders(ticketCanvas);
        drawMajesticBorders(qrCanvas);
        
        // Redessiner lors du redimensionnement
        window.addEventListener('resize', () => {
         drawMajesticBorders(ticketCanvas);
         drawMajesticBorders(qrCanvas);
        });
    
    // Générer le QR Code
    generateQRCode(event.id);
}

// ═══════════════════════════════════════════════════════════════
// 📱 GÉNÉRATION DU QR CODE
// ═══════════════════════════════════════════════════════════════

function generateQRCode(eventId) {
    const container = document.getElementById('qrcode');
    container.innerHTML = '';
    
    const url = `https://secura.app/ticket/${encodeURIComponent(eventId)}`;
    
    if (typeof QRCode !== 'undefined') {
        try {
            new QRCode(container, {
                text: url,
                width: 176,
                height: 176,
                colorDark: '#000000',
                colorLight: '#FFFFFF',
                correctLevel: QRCode.CorrectLevel.H
            });
            console.log('✅ QR Code généré');
        } catch (error) {
            console.error('❌ Erreur QR Code:', error);
            showQRFallback(container, eventId);
        }
    } else {
        console.warn('⚠️ QRCode.js non disponible');
        showQRFallback(container, eventId);
    }
}

function showQRFallback(container, eventId) {
    container.innerHTML = `
        <div style="width: 176px; height: 176px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; border: 2px dashed #ccc; border-radius: 10px;">
            <div style="text-align: center; padding: 15px;">
                <div style="font-size: 2.5rem; color: #999; margin-bottom: 10px;">📱</div>
                <div style="font-size: 11px; color: #666;">QR Code<br>indisponible</div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// 🖨️ IMPRESSION
// ═══════════════════════════════════════════════════════════════

function handlePrint() {
    console.log('🖨️ Impression...');
    window.print();
}

// ═══════════════════════════════════════════════════════════════
// 💾 EXPORT PNG HAUTE QUALITÉ
// ═══════════════════════════════════════════════════════════════

async function handleExportPNG() {
    const btn = document.getElementById('exportBtn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Export...';
        
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas non disponible');
        }
        
        const element = document.getElementById('ticketRoot');
        
        // Masquer temporairement les boutons
        document.querySelector('.actions').style.display = 'none';
        
        // Capturer en haute résolution
        const canvas = await html2canvas(element, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: element.offsetWidth,
            height: element.offsetHeight
        });
        
        // Réafficher les boutons
        document.querySelector('.actions').style.display = 'flex';
        
        // Télécharger
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `SECURA_Billet_${EVENT_DATA.name.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log('✅ Export PNG réussi');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }, 'image/png', 1.0);
        
    } catch (error) {
        console.error('❌ Erreur export PNG:', error);
        alert('Impossible d\'exporter en PNG. Utilisez l\'impression à la place.');
        
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        document.querySelector('.actions').style.display = 'flex';
    }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎫 Initialisation SECURA Ultra Premium Ticket');
    
    // Générer le billet
    generateTicket(EVENT_DATA);
    
    // Initialiser les boutons
    document.getElementById('printBtn').addEventListener('click', handlePrint);
    document.getElementById('exportBtn').addEventListener('click', handleExportPNG);
    
    console.log('✅ Billet généré avec succès');
});

// Export global (optionnel)
window.SECURA_Ticket = {
    regenerate: () => generateTicket(EVENT_DATA),
    exportPNG: handleExportPNG,
    print: handlePrint
};