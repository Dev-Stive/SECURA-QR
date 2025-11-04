/**
 * SECURA - Main Scripts
 * Scripts communs à toutes les pages
 */

document.addEventListener('DOMContentLoaded', async () => {
    await window.storageReady;

    initializeNavigation();
    initializeScrollTop();
    initializeFullscreen();
    updateStats();
    loadRecentEvents();
});


// ===== NAVIGATION =====
function initializeNavigation() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.getElementById('navMenu');

    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });

        // Fermer le menu lors du clic sur un lien
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
    }
}

// ===== SCROLL TO TOP =====
function initializeScrollTop() {
    const scrollTopBtn = document.getElementById('scrollTop');
    
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        });

        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// ===== FULLSCREEN =====
function initializeFullscreen() {
    const fullscreenToggle = document.getElementById('fullscreenToggle');
    
    if (fullscreenToggle) {
        fullscreenToggle.addEventListener('click', toggleFullscreen);

        // Raccourci clavier F11
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
            }
        });

        // Mettre à jour l'icône lors du changement
        document.addEventListener('fullscreenchange', updateFullscreenIcon);
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Erreur plein écran:', err);
            showNotification('error', 'Impossible d\'activer le mode plein écran');
        });
    } else {
        document.exitFullscreen();
    }
}

function updateFullscreenIcon() {
    const fullscreenToggle = document.getElementById('fullscreenToggle');
    if (fullscreenToggle) {
        const icon = fullscreenToggle.querySelector('i');
        if (icon) {
            icon.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
        }
    }
}

// ===== STATISTICS =====
function updateStats() {
    const stats = storage.getStatistics();
    
    const elements = {
        totalEvents: document.getElementById('totalEvents'),
        totalGuests: document.getElementById('totalGuests'),
        totalQrCodes: document.getElementById('totalQrCodes'),
        scannedQrCodes: document.getElementById('scannedQrCodes')
    };

    if (elements.totalEvents) {
        animateNumber(elements.totalEvents, stats.totalEvents);
    }
    if (elements.totalGuests) {
        animateNumber(elements.totalGuests, stats.totalGuests);
    }
    if (elements.totalQrCodes) {
        animateNumber(elements.totalQrCodes, stats.totalQRCodes);
    }
    if (elements.scannedQrCodes) {
        animateNumber(elements.scannedQrCodes, stats.scannedGuests);
    }
}

function animateNumber(element, target) {
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(progress * target);
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ===== RECENT EVENTS =====
function loadRecentEvents() {
    const recentEventsGrid = document.getElementById('recentEventsGrid');
    if (!recentEventsGrid) return;

    const events = storage.getAllEvents();
    const recentEvents = events.slice(-3).reverse();

    if (recentEvents.length === 0) {
        recentEventsGrid.innerHTML = `
            <!-- <div class="empty-state">
                <i class="fas fa-calendar-plus"></i>
                <p>Aucun événement créé</p>
                <a href="events-list.html" class="btn btn-primary">Créer votre premier événement</a>
            </div> -->

            <div id="emptyState" class="text-center py-16 text-gray-500" style="display: none;">
                <i class="fas fa-calendar-times text-6xl mb-4"></i>
                <p class="text-lg">Aucun événement créé</p>
                <button class="btn btn-primary mt-4" onclick="openEventModal()">
                    Créer votre premier événement
                </button>
            </div>
        `;
        return;
    }

    recentEventsGrid.innerHTML = recentEvents.map(event => createEventCard(event)).join('');
}

function createEventCard(event) {
    const guests = storage.getGuestsByEventId(event.id);
    const scannedGuests = guests.filter(g => g.scanned).length;
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const typeLabels = {
        marriage: 'Mariage',
        anniversaire: 'Anniversaire',
        conference: 'Conférence',
        autre: 'Autre'
    };

    return `
        <div class="event-card" onclick="window.location.href='guests.html?event=${event.id}'">
            <div class="event-card-header">
                <span class="event-type-badge">${typeLabels[event.type] || event.type}</span>
                <h3>${event.name}</h3>
                <div class="event-date">
                    <i class="fas fa-calendar"></i>
                    <span>${formattedDate}</span>
                </div>
            </div>
            <div class="event-card-body">
                <div class="event-info">
                    ${event.time ? `
                        <div class="event-info-item">
                            <i class="fas fa-clock"></i>
                            <span>${event.time}</span>
                        </div>
                    ` : ''}
                    ${event.location ? `
                        <div class="event-info-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${event.location}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="event-stats">
                    <div class="event-stat">
                        <div class="event-stat-value">${guests.length}</div>
                        <div class="event-stat-label">Invités</div>
                    </div>
                    <div class="event-stat">
                        <div class="event-stat-value">${scannedGuests}</div>
                        <div class="event-stat-label">Présents</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== NOTIFICATIONS =====
function showNotification(type, message) {
    const icons = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const titles = {
        success: 'Succès',
        error: 'Erreur',
        warning: 'Attention',
        info: 'Information'
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: icons[type] || 'info',
            title: titles[type] || 'Notification',
            text: message,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            customClass: {
                popup: 'animate-slide-in-right'
            }
        });
    } else {
        alert(message);
    }
}

// ===== CONFIRMATION DIALOG =====
function confirmDialog(title, text, confirmText = 'Confirmer', cancelText = 'Annuler') {
    return new Promise((resolve) => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                html: text,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D97706',
                cancelButtonColor: '#706f6c',
                confirmButtonText: confirmText,
                cancelButtonText: cancelText,
                customClass: {
                    popup: 'animate-zoom-in'
                }
            }).then((result) => {
                resolve(result.isConfirmed);
            });
        } else {
            resolve(confirm(text));
        }
    });
}

// ===== LOADING OVERLAY =====
function showLoading() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// ===== DOWNLOAD FILE =====
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ===== FORMAT DATE =====
function formatDate(dateString, includeTime = false) {
    const date = new Date(dateString);
    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };

    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }

    return date.toLocaleDateString('fr-FR', options);
}

// ===== DEBOUNCE =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== VALIDATE EMAIL =====
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// ===== VALIDATE PHONE =====
function validatePhone(phone) {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 9;
}





window.showNotification = showNotification;
window.confirmDialog = confirmDialog;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.downloadFile = downloadFile;
window.formatDate = formatDate;
window.debounce = debounce;
window.validateEmail = validateEmail;
window.validatePhone = validatePhone;