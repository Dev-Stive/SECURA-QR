/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║          🔐 SECURA AUTH UI MANAGER V1.0 🔐                   ║
 * ║                                                               ║
 * ║  Gestion de la visibilité UI en fonction de l'état d'auth    ║
 * ║  Synchronisation entre guest et authenticated modes          ║
 * ║  Mise à jour des dropdowns et sidebar                        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

class AuthUIManager {
    constructor() {
        this.isLoggedIn = false;
        this.user = null;
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.bindProfileDropdown();
        this.listenToAuthChanges();
        
        console.log('✅ Auth UI Manager initialisé');
    }

    checkAuthStatus() {
        if (window.storage) {
            this.isLoggedIn = window.storage.isLoggedIn();
            this.user = window.storage.getCurrentUser();
            this.updateAllUI();
        }
    }

    updateAllUI() {
        this.updateHeaderUI();
        this.updateSidebarUI();
        this.updateContentSectionsUI();
    }

    updateHeaderUI() {
        const headerGuestActions = document.getElementById('headerGuestActions');
        const profileToggle = document.getElementById('profileToggle');
        
        if (headerGuestActions) {
            headerGuestActions.style.display = this.isLoggedIn ? 'none' : 'flex';
            headerGuestActions.style.opacity = this.isLoggedIn ? '0' : '1';
            headerGuestActions.style.pointerEvents = this.isLoggedIn ? 'none' : 'auto';
        }
        
        if (profileToggle) {
            profileToggle.style.display = this.isLoggedIn ? 'flex' : 'none';
            profileToggle.style.opacity = this.isLoggedIn ? '1' : '0';
            profileToggle.style.pointerEvents = this.isLoggedIn ? 'auto' : 'none';
            
            // Mettre à jour les infos du profil
            if (this.isLoggedIn && this.user) {
                const profileName = document.getElementById('profileName');
                const profileRole = document.getElementById('profileRole');
                
                if (profileName) {
                    profileName.textContent = this.user.firstName ? 
                        `${this.user.firstName} ${this.user.lastName || ''}`.trim() : 
                        'Mon Profil';
                }
                
                if (profileRole) {
                    profileRole.textContent = this.user.role || 'Utilisateur';
                }
            }
        }
    }

    updateSidebarUI() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        
        // Sidebar profile
        const sidebarProfile = document.querySelector('.sidebar-profile');
        if (sidebarProfile) {
            sidebarProfile.style.display = this.isLoggedIn ? 'block' : 'none';
            
            if (this.isLoggedIn && this.user) {
                const profileName = document.getElementById('sidebarProfileName');
                const profileEmail = document.getElementById('sidebarProfileEmail');
                const profileRole = document.getElementById('sidebarProfileRole');
                
                if (profileName) {
                    profileName.textContent = this.user.firstName ? 
                        `${this.user.firstName} ${this.user.lastName || ''}`.trim() : 
                        'Utilisateur';
                }
                
                if (profileEmail) {
                    profileEmail.textContent = this.user.email || 'email@example.com';
                }
                
                if (profileRole) {
                    profileRole.textContent = this.user.role || 'Utilisateur';
                }
            }
        }
        
        // Admin links visibility
        const adminLinks = document.querySelectorAll(
            '#navMenu a[href="events.html"], ' +
            '#navMenu a[href="guests.html"], ' +
            '#navMenu a[href="tables.html"], ' +
            '#navMenu a[href="qr-generator.html"], ' +
            '#navMenu a[href="ticket-generator.html"], ' +
            '#navMenu a[href="scanner.html"], ' +
            '#navMenu a[href="profile.html"], ' +
            '#navMenu a[href="settings.html"]'
        );
        
        adminLinks.forEach(link => {
            link.style.display = this.isLoggedIn ? 'flex' : 'none';
            link.style.opacity = this.isLoggedIn ? '1' : '0';
        });
        
        // Logout button
        const sidebarLogout = document.getElementById('sidebarLogout');
        if (sidebarLogout) {
            sidebarLogout.style.display = this.isLoggedIn ? 'block' : 'none';
        }
        
        // Sidebar toggle button
        if (sidebarToggle) {
            sidebarToggle.style.display = this.isLoggedIn ? 'flex' : 'none';
        }
    }

    updateContentSectionsUI() {
        const sections = [
            { id: 'stats-section', visible: this.isLoggedIn },
            { id: 'charts-section', visible: this.isLoggedIn },
            { id: 'recentEventsSection', visible: this.isLoggedIn }
        ];
        
        sections.forEach(section => {
            const element = document.getElementById(section.id);
            if (element) {
                element.style.display = section.visible ? 'block' : 'none';
                element.style.opacity = section.visible ? '1' : '0';
                element.style.pointerEvents = section.visible ? 'auto' : 'none';
            }
        });
    }

    bindProfileDropdown() {
        const profileToggle = document.getElementById('profileToggle');
        const profileDropdown = document.getElementById('profileDropdown');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (profileToggle && profileDropdown) {
            profileToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('active');
            });
            
            document.addEventListener('click', () => {
                if (profileDropdown.classList.contains('active')) {
                    profileDropdown.classList.remove('active');
                }
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleLogout();
            });
        }
    }

    async handleLogout() {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Confirmer la déconnexion',
                text: 'Vous serez redirigé vers la page d\'accueil.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Oui, me déconnecter',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#D97706',
                cancelButtonColor: '#6c757d',
                reverseButtons: true
            });

            if (result.isConfirmed) {
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
                    if (window.storage) {
                        await window.storage.logout();
                    }
                    
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 500);
                }, 500);
            }
        }
    }

    listenToAuthChanges() {
        // Écouter les changements d'authentification
        if (window.storage) {
            window.storage.on('user:created', () => {
                this.checkAuthStatus();
            });
            
            window.storage.on('data:synced', () => {
                const newLoginStatus = window.storage.isLoggedIn();
                if (newLoginStatus !== this.isLoggedIn) {
                    this.checkAuthStatus();
                }
            });
        }
    }

    // Méthode publique pour forcer la mise à jour
    forceUpdate() {
        this.checkAuthStatus();
    }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALISATION GLOBALE
// ═══════════════════════════════════════════════════════════════

let authUIManager = null;

document.addEventListener('DOMContentLoaded', () => {
    authUIManager = new AuthUIManager();
    window.authUIManager = authUIManager;
    
    console.log('✅ Auth UI Manager prêt');
});

// Exporter pour utilisation globale
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthUIManager;
}
