/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║               🚀 SECURA SIDEBAR MANAGER V1.0                 ║
 * ║                                                               ║
 * ║  🔧 Gestion complète de la sidebar avec animations fluides   ║
 * ║  📱 Responsive & Touch friendly                              ║
 * ║  🎯 Mise à jour granulaire des infos utilisateur             ║
 * ║  🔄 Synchronisation avec le thème et plein écran             ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebarClose = document.getElementById('sidebarClose');
        this.sidebarOverlay = document.getElementById('sidebarOverlay');
        this.sidebarLogout = document.getElementById('sidebarLogout');
        this.isOpen = false;
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateActiveLink();
        this.setupResizeListener();
        this.setupTouchGestures();
        this.updateAuthVisibility();
        
        console.log('✅ Sidebar Manager initialisé');
    }

    bindEvents() {
        // Bouton flottant
        this.sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.open();
        });

        // Bouton fermer dans la sidebar
        this.sidebarClose.addEventListener('click', () => this.close());

        // Overlay pour fermer
        this.sidebarOverlay.addEventListener('click', () => this.close());

        // Logout
        if (this.sidebarLogout) {
            this.sidebarLogout.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleLogout();
            });
        }

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Prévenir la fermeture en cliquant dans la sidebar
        this.sidebar.addEventListener('click', (e) => e.stopPropagation());
    }

    open() {
        this.sidebar.classList.add('active');
        this.sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.isOpen = true;
        
        // Animation du bouton flottant
        this.sidebarToggle.style.transform = 'scale(0)';
        setTimeout(() => {
            this.sidebarToggle.style.display = 'none';
        }, 300);
        
        // Émettre un événement
        window.dispatchEvent(new CustomEvent('sidebar:opened'));
    }

    close() {
        this.sidebar.classList.remove('active');
        this.sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
        this.isOpen = false;
        
        // Réafficher le bouton flottant
        this.sidebarToggle.style.display = 'flex';
        setTimeout(() => {
            this.sidebarToggle.style.transform = 'scale(1)';
        }, 50);
        
        // Émettre un événement
        window.dispatchEvent(new CustomEvent('sidebar:closed'));
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    

    updateActiveLink() {
       
    }

  

    

 

    setupResizeListener() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.innerWidth > 768 && this.isOpen) {
                    this.close();
                }
            }, 250);
        });
    }

    setupTouchGestures() {
        document.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const swipeDistance = this.touchEndX - this.touchStartX;

        if (Math.abs(swipeDistance) > swipeThreshold) {
            if (swipeDistance > 0 && !this.isOpen && this.touchStartX < 50) {
                // Swipe de gauche à droite depuis le bord gauche
                this.open();
            } else if (swipeDistance < 0 && this.isOpen) {
                // Swipe de droite à gauche pour fermer
                this.close();
            }
        }
    }

    updateAuthVisibility() {
        const isLoggedIn = window.storage && window.storage.isLoggedIn();
        
        // Éléments à masquer si non connecté
        const authElements = [
            'navHome',
            'sidebarProfile',
            'sidebarLogout'
        ];
        
        // Sidebar profile et logout
        const sidebarProfile = document.querySelector('.sidebar-profile');
        const sidebarLogout = document.getElementById('sidebarLogout');
        
        if (sidebarProfile) {
            sidebarProfile.style.display = isLoggedIn ? 'block' : 'none';
        }
        
        if (sidebarLogout) {
            sidebarLogout.style.display = isLoggedIn ? 'block' : 'none';
        }
        
        const adminLinks = document.querySelectorAll(
            'a[href="events.html"], a[href="guests.html"], a[href="tables.html"], a[href="qr-generator.html"], a[href="ticket-generator.html"], a[href="scanner.html"], a[href="profile.html"], a[href="settings.html"]'
        );
        
        adminLinks.forEach(link => {
            link.style.display = isLoggedIn ? 'block' : 'none';
        });
        
        // Bouton sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.style.display = isLoggedIn ? 'flex' : 'none';
        }
    }

    async handleLogout() {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Confirmer la déconnexion',
                text: 'Vous serez redirigé vers la page de connexion.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Oui, me déconnecter',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#D97706',
                cancelButtonColor: '#6c757d',
                reverseButtons: true
            });

            if (result.isConfirmed) {
                // Afficher le chargement
                Swal.fire({
                    title: 'Déconnexion...',
                    text: 'Nettoyage des données',
                    icon: 'info',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                setTimeout(async () => {
                    const success = await storage.logout();
                    
                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 500);
                }, 500);
            }
        } else {
            const success = await storage.logout();
            window.location.href = '/login.html';
        }
    }

    // Méthodes utilitaires
    updateQuickStats(stats) {
        const quickEvents = document.getElementById('quickEvents');
        const quickGuests = document.getElementById('quickGuests');
        const quickScans = document.getElementById('quickScans');
        
        if (quickEvents) quickEvents.textContent = stats.totalEvents || 0;
        if (quickGuests) quickGuests.textContent = stats.totalGuests || 0;
        if (quickScans) quickScans.textContent = stats.scannedGuests || 0;
    }

    refresh() {
        this.updateActiveLink();
        this.updateThemeIcon();
        this.updateFullscreenIcon();
    }
}

// Initialisation globale
let sidebarManager = null;

document.addEventListener('DOMContentLoaded', () => {
    sidebarManager = new SidebarManager();
    
    window.sidebarManager = sidebarManager;
    
    storage.on('data:synced', (event) => {
        if (sidebarManager) {
            sidebarManager.updateQuickStats(storage.getStatistics());
        }
    });
    
    // Mettre à jour les stats initiales
    setTimeout(() => {
        if (sidebarManager && window.storage) {
            sidebarManager.updateQuickStats(storage.getStatistics());
        }
    }, 1000);
});

console.log('✅ Sidebar Manager prêt');