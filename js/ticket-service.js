/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║      SECURA TICKET SERVICE - ULTRA PREMIUM MAJESTIC EDITION   ║
 * ║  Design royal avec Canvas doré, QR bordé, fond Unsplash, VIP  ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

class TicketService {
    constructor() {
        this.logoPath = 'assets/images/icon.png';
        this.gold = '#D4AF37';
        this.goldLight = '#F4E4C1';
        this.goldDark = '#B8860B';

        // Tes templates originaux (conservés intégralement)
        this.templates = {
            marriage: {
                label: 'MARIAGE',
                icon: 'bi-heart-fill',
                background: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=90',
                colors: { primary: '#FF6B9D', secondary: '#FEC163' }
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
            football: {
                label: 'ÉVÉNEMENT SPORTIF',
                icon: 'bi-trophy-fill',
                background: 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1600&q=90',
                colors: { primary: '#11998e', secondary: '#38ef7d' }
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
            exhibition: {
                label: 'EXPOSITION',
                icon: 'bi-palette-fill',
                background: 'https://images.unsplash.com/photo-1560472354-5c6c3c0c6e27?w=1600&q=90',
                colors: { primary: '#FA709A', secondary: '#FEE140' }
            },
            vip: {
                label: 'VIP PREMIUM',
                icon: 'bi-star-fill',
                background: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&q=90',
                colors: { primary: '#D4AF37', secondary: '#FFD700' }
            }
        };
    }

    // ====================== TON DESIGN MAJESTUEUX ======================
    generateTicketHTML(event, guest, template = 'anniversary', format = 'landscape') {
        const config = this.templates[template] || this.templates.anniversary;
        const dateStr = this.formatDateLong(event.date);
        const timeStr = event.time ? ` · ${event.time}` : '';

        return `
        <div class="ticket-premium" id="ticketRoot">
            <canvas id="borderCanvas" class="majestic-border"></canvas>
            <div class="ticket-background" style="background-image: url('${config.background}')"></div>
            
            <div class="ticket-content">
                <div class="ticket-header">
                    
                    <h1 class="event-title-ticket">${this.escapeHtml(event.name)}</h1>
                    <p class="event-welcome">
                        ${event.welcomeMessage ? event.welcomeMessage : ''}
                    </p>
                </div>

                <div class="ticket-footer">
                    <div class="info-corner">
                        <div class="info-item-ticket">
                            <div class="info-icon"><i class="bi bi-calendar-event"></i></div>
                            <div class="info-text">
                                <span class="info-label">Date & Heure</span>
                                <span class="info-value">${dateStr}${timeStr}</span>
                            </div>
                        </div>
                        <div class="info-item-ticket">
                            <div class="info-icon"><i class="bi bi-geo-alt-fill"></i></div>
                            <div class="info-text">
                                <span class="info-label">Lieu</span>
                                <span class="info-value">${this.escapeHtml(event.location || 'Non spécifié')}</span>
                            </div>
                        </div>
                        ${event.description ? `
                        <div class="info-item-ticket">
                            <div class="info-icon"><i class="bi bi-info-circle"></i></div>
                            <div class="info-text">
                                <span class="info-label">Description</span>
                                <span class="info-value">${this.escapeHtml(event.description)}</span>
                            </div>
                        </div>` : ''}
                    </div>

                    <div class="qr-zone-only">
                        <div class="qr-wrapper" style="position:relative;">
                            <div id="qrcode"></div>
                            <div class="qr-canvas-wrapper">
                                <canvas id="qrBorderCanvas"></canvas>
                            </div>
                        </div>
                        <p class="qr-instruction">Scannez ce QR à l'entrée pour valider votre accès</p>
                    </div>
                </div>
            </div>

            <div class="personal-warning">
                Ce billet est strictement personnel — Ne pas partager
            </div>
        </div>`;
    }

    // ====================== DESSIN BORDURES CANVAS ======================
   drawMajesticBorders(canvas) {
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

    // ====================== GENERATION QR CODE ======================
    generateQRCode(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        new QRCode(container, {
            text: typeof data === 'object' ? JSON.stringify(data) : data,
            width: 260,
            height: 260,
            colorDark: "#000000",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    // ====================== RENDU COMPLET (MAGIQUE) ======================
    async renderTicket(container, event, guest = {}, type = 'anniversary') {
        container.innerHTML = this.generateTicketHTML(event, guest, type);

        // Générer QR
        this.generateQRCode('qrcode', { t: 'INV', e: event.id, g: guest.id || 'guest' });

        // Dessiner les bordures Canvas
        const mainCanvas = document.getElementById('borderCanvas');
        const qrCanvas = document.getElementById('qrBorderCanvas');

        this.drawMajesticBorders(mainCanvas);
        this.drawMajesticBorders(qrCanvas);

        // Responsive parfait
        const redraw = () => {
            this.drawMajesticBorders(mainCanvas);
            this.drawMajesticBorders(qrCanvas);
        };
        window.addEventListener('resize', () => setTimeout(redraw, 100));
    }

    // ====================== TES MÉTHODES ORIGINALES (100% conservées) ======================
    async ticketToCanvas(ticketElement, scale = 3) {
        if (!ticketElement) return null;
        try {
            return await html2canvas(ticketElement, {
                scale: scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                logging: false
            });
        } catch (err) {
            console.error('Erreur conversion canvas:', err);
            return null;
        }
    }

    async downloadTicketPNG(ticketElement, filename = 'SECURA_Billet.png', scale = 3) {
        const canvas = await this.ticketToCanvas(ticketElement, scale);
        if (!canvas) return false;
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png', 1.0);
        return true;
    }

    async downloadTicketPDF(ticketElement, filename = 'SECURA_Billet.pdf', scale = 3) {
        const canvas = await this.ticketToCanvas(ticketElement, scale);
        if (!canvas) return false;
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const w = pdf.internal.pageSize.getWidth() - 20;
        const h = (canvas.height * w) / canvas.width;
        pdf.addImage(imgData, 'PNG', 10, (pdf.internal.pageSize.getHeight() - h) / 2, w, h);
        pdf.save(filename);
        return true;
    }

    async createTicketsZip(tickets, eventName) {
        if (typeof JSZip === 'undefined') return null;
        const zip = new JSZip();
        const folder = zip.folder(`SECURA_Billets_${this.cleanFileName(eventName)}`);
        tickets.forEach(t => folder.file(t.filename, t.blob));
        return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    }

    // ====================== UTILITAIRES ======================
    formatDateLong(dateStr) {
        try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
        catch { return dateStr; }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanFileName(str) {
        return str.replace(/[^a-zA-Z0-9\-_]/g, '_').replace(/_+/g, '_');
    }

formatFileName(...parts) {
    return parts
        .join('-')                  
        .trim()                    
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .replace(/-+/g, '-')    
        .replace(/^-|-$/g, '');      
}
}

// ====================== EXPOSITION GLOBALE ======================
window.ticketService = new TicketService();
console.log('SECURA ULTRA PREMIUM MAJESTIC TICKET SERVICE CHARGÉ – ROYAL MODE ACTIVÉ');