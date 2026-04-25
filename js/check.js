/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        🛡️  SECURA ROLE-BASED ACCESS CONTROL V2.0  🛡️         ║
 * ║                    Avec sessions événement                    ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

(function initSecuraRoleCheck() {
    const CONFIG = {
        publicPages: [
            '/', '/index.html',  
            '/login', '/login.html',
            '/register', '/register.html',
            '/forgot-password', '/forgot-password.html',
            '/access', '/access.html',
            '/404', '/404.html'
        ],
        protectedPages: [
            '/home', '/home.html'
        ],
        eventPages: [
            '/welcome', '/welcome/',
            '/welcome/index.html',
            '/event-chat', '/event-chat.html',
            '/event-schedule', '/event-schedule.html',
            '/event-map', '/event-map.html',
            '/event-guests', '/event-guests.html'
        ],
        verifyTimeout: 5000,
        overlayDuration: 400,
        apiUrl: window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api',
        checkMode: 'role_or_event',
        sessionKeys: {
            event: 'secura_event_session',
            guest: 'secura_guest_info',
            user: 'secura_token'
        }
    };

    // Injecter le style de masquage initial
    const hideStyle = document.createElement('style');
    hideStyle.id = 'secura-initial-hide';
    hideStyle.textContent = `
        body *:not(#secura-loading-overlay):not(#secura-loading-overlay *) {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: opacity 0.4s ease !important;
        }
        body {
            overflow: hidden !important;
            position: relative !important;
            min-height: 100vh !important;
        }
        #secura-loading-overlay {
            position: fixed !important;
            z-index: 99999 !important;
        }
    `;
    document.head.insertAdjacentElement('afterbegin', hideStyle);

    // 2️⃣ INJECTER OVERLAY
    function injectOverlay() {
        if (document.getElementById('secura-loading-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'secura-loading-overlay';
        overlay.innerHTML = `
            <div class="secura-overlay-content">
                <div class="lottie-container">
                    <div class="pulse-ring"></div>
                    <div class="spinner-core"></div>
                    <div class="spinner-orbits">
                        <div class="orbit orbit-1"></div>
                        <div class="orbit orbit-2"></div>
                        <div class="orbit orbit-3"></div>
                    </div>
                </div>
                <div class="loading-details">
                    <p class="loading-text">Chargement...</p>
                    <div class="loading-progress">
                        <div class="progress-bar"></div>
                        <div class="progress-steps">
                            <span class="step active">1. Vérification</span>
                            <span class="step">2. Chargement</span>
                            <span class="step">3. welcome</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentElement('afterbegin', overlay);
        
        setTimeout(() => updateProgressStep(2), 1000);
        setTimeout(() => updateProgressStep(3), 1400);
    }

    function updateProgressStep(step) {
        const steps = document.querySelectorAll('.progress-steps .step');
        steps.forEach((s, i) => {
            s.classList.toggle('active', i < step);
        });
        
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${(step / 3) * 100}%`;
        }
    }

    // Vérification rapide du token
    function isTokenValidQuick(token) {
        if (!token || typeof token !== 'string') return false;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.exp && payload.exp * 1000 < Date.now()) return false;
            if (!payload.id || !payload.email) return false;
            return true;
        } catch (err) {
            return false;
        }
    }

    // Vérifier si une session événement est active et valide
    function isEventSessionValid() {
        try {
            const sessionData = localStorage.getItem(CONFIG.sessionKeys.event);
            if (!sessionData) return false;
            
            const session = JSON.parse(sessionData);
            
            // Vérifier l'expiration
            if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
                localStorage.removeItem(CONFIG.sessionKeys.event);
                localStorage.removeItem(CONFIG.sessionKeys.guest);
                return false;
            }
            
            return true;
        } catch (err) {
            return false;
        }
    }

    // Obtenir le type de page actuelle
    function getPageType(path) {
        path = path.toLowerCase();
        
        if (CONFIG.publicPages.some(p => path.endsWith(p.toLowerCase()))) {
            return 'public';
        }
        
        if (CONFIG.protectedPages.some(p => path.endsWith(p.toLowerCase()))) {
            return 'protected';
        }
        
        if (CONFIG.eventPages.some(p => path.includes(p.toLowerCase()))) {
            return 'event';
        }
        
        return 'admin';
    }

    // Vérifier l'accès principal
    async function verifyAccess() {
        const token = localStorage.getItem(CONFIG.sessionKeys.user);
        const eventSession = isEventSessionValid();
        const path = window.location.pathname.toLowerCase();
        const pageType = getPageType(path);
        
        // ⚠️ ATTENTION: Vérifier que storage.js est chargé avant de faire les requêtes
        const waitForStorage = () => {
            return new Promise((resolve) => {
                if (window.storage) {
                    resolve();
                } else {
                    const check = setInterval(() => {
                        if (window.storage) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 50);
                    // Timeout après 3 secondes
                    setTimeout(() => {
                        clearInterval(check);
                        console.warn('⚠️ storage.js n\'a pas été chargé à temps');
                        resolve();
                    }, 3000);
                }
            });
        };
        
        await waitForStorage();
        
        setTimeout(() => updateProgressStep(1), 500);
        
        // PAGES ÉVÉNEMENT : Vérifier session événement
        if (pageType === 'event') {
            if (!eventSession) {
                denyAccess('No event session', '/access.html');
                return;
            }
            grantAccess('event');
            return;
        }
        
        // PAGES PUBLIQUES (index, login, register, access, etc.) : Accès direct sans redirection
        if (pageType === 'public') {
            if ((path === '/' || path === '/index.html') && token) {
                denyAccess('User already logged in', '/home.html');
                return;
            }
            
            // Redirection RAPIDE si session événement active et pas sur /access
            if (eventSession && !path.includes('/access')) {
                console.log('🚀 Session événement détectée → Redirection rapide vers /welcome/');
                // Redirection immédiate sans overlay
                window.location.replace('/welcome/');
                return;
            }
            grantAccess('public');
            return;
        }
        
        // PAGES PROTÉGÉES (home, dashboard, etc.) : Vérification utilisateur OBLIGATOIRE
        if (pageType === 'protected') {
            if (!token) {
                denyAccess('No token', '/index.html');
                return;
            }
            
            if (!isTokenValidQuick(token)) {
                denyAccess('Invalid token', '/index.html');
                return;
            }
            
            // Token valide : accorder l'accès
            grantAccess('protected');
            return;
        }
        
        // PAGES ADMIN : Vérification utilisateur obligatoire
        if (!token) {
            denyAccess('No token', '/index.html');
            return;
        }
        
        if (!isTokenValidQuick(token)) {
            denyAccess('Invalid token', '/index.html');
            return;
        }
        
        setTimeout(() => updateProgressStep(2), 1000);
        await redirectBasedOnRole(token);
    }

    // Redirection basée sur le rôle
    async function redirectBasedOnRole(token) {
        try {
            // Construire l'URL API sans dépendre de storage.js
            const apiUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api'
                : 'https://secura-qr.onrender.com/api';
            
            const response = await fetch(`${apiUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                // 401 = Token expiré/invalide
                if (response.status === 401) {
                    console.error('❌ API 401 - Token expiré/invalide');
                    denyAccess('Token invalid', '/index.html');
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const user = result.user;
                const path = window.location.pathname.toLowerCase();
                
                // Mettre à jour le localStorage (utilisé par storage.js et auth.js)
                localStorage.setItem('secura_user', JSON.stringify(user));
                localStorage.setItem('secura_token', token);
                
                // Mettre à jour l'objet storage si disponible
                if (window.storage) {
                    window.storage.user = user;
                    window.storage.token = token;
                }
                
                // Définir les pages autorisées par rôle
                const rolePages = {
                    'admin': [
                        '/dashboard', '/dashboard.html',
                        '/home', '/home.html',
                        '/events', '/events.html',
                        '/profile', '/profile.html',
                        '/tables', '/tables.html',
                        '/table-info', '/table-info.html',

                        '/event', '/event.html',
                        '/event-info', '/event-info.html',
                        '/guests', '/guests.html',
                        '/access', '/access.html',
                        '/qr-generator', '/qr-generator.html',
                        '/ticket-generator', '/ticket-generator.html',
                        '/scanner', '/scanner.html',
                        '/profile', '/profile.html',
                        '/settings', '/settings.html'
                    ],
                    'user': [
                        '/home', '/home.html',
                        '/events', '/events.html',
                        '/profile', '/profile.html',
                        '/tables', '/tables.html',
                        '/table-info', '/table-info.html',
                        '/event', '/event.html',
                        '/event-info', '/event-info.html',
                        '/guests', '/guests.html',
                        '/access', '/access.html',
                        '/qr-generator', '/qr-generator.html',
                        '/ticket-generator', '/ticket-generator.html',
                        '/scanner', '/scanner.html',
                        '/profile', '/profile.html',
                        '/settings', '/settings.html'
                    ]
                };

                 const allowedPages = rolePages[user.role] || [];
                const isAllowed = allowedPages.some(p => path.endsWith(p.toLowerCase()));
                
                setTimeout(() => updateProgressStep(3), 1500);
                
                if (!isAllowed) {
                    // Rediriger vers la page appropriée
                    const targetPage = user.role === 'admin' ? '/dashboard.html' : '/home.html';
                    if (!path.endsWith(targetPage)) {
                        console.log(`🎯 Redirection ${user.role} → ${targetPage}`);
                        window.location.href = targetPage;
                        return;
                    }
                }
                
                updateUIWithUserInfo(user);
                grantAccess('admin');
            } else {
                denyAccess('Invalid user data', '/');
            }
        } catch (err) {
            console.error('❌ Erreur vérification rôle:', err);
            denyAccess('Network error', '/');
        }
    }

    // Mettre à jour l'interface avec les infos utilisateur
    function updateUIWithUserInfo(user) {
        // Mettre à jour la sidebar si présente
        const sidebarName = document.getElementById('sidebarProfileName');
        const sidebarEmail = document.getElementById('sidebarProfileEmail');
        const sidebarRole = document.getElementById('sidebarProfileRole');
        
        if (sidebarName) sidebarName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
        if (sidebarEmail) sidebarEmail.textContent = user.email;
        if (sidebarRole) sidebarRole.textContent = user.role === 'admin' ? 'Administrateur' : 'Utilisateur';
        
        // Mettre à jour le header si présent
        const headerName = document.getElementById('headerUserName');
        const headerRole = document.getElementById('headerUserRole');
        
        if (headerName) headerName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
        if (headerRole) headerRole.textContent = user.role === 'admin' ? 'Admin' : 'User';
    }

    // Accès accordé
    function grantAccess(type = 'public') {
        // Signal to storage.js that auth verification is complete
        document.body.classList.add('auth-verified');
        
        setTimeout(() => {
            const overlay = document.getElementById('secura-loading-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        }, 400); // Réduit pour éviter les blocages
        
        setTimeout(() => {
            const hideStyle = document.getElementById('secura-initial-hide');
            if (hideStyle) hideStyle.remove();
            
            // Émettre l'événement
            window.dispatchEvent(new CustomEvent('secura:access-granted', { detail: { type } }));
            
            // Démarrer les animations
            document.querySelectorAll('.animate-fade-in').forEach(el => {
                el.style.animationPlayState = 'running';
            });
        }, 600); // Réduit aussi ici
    }

    // Accès refusé
    function denyAccess(reason, redirectTo = '/index.html') {
        // Signal to storage.js that auth verification is complete (denied)
        document.body.classList.add('auth-denied');
        
        console.warn(`❌ Accès refusé: ${reason}`);
        
      
        
        setTimeout(() => {
            if (!window.location.pathname.includes(redirectTo)) {
                console.log(`🚀 Redirection rapide vers ${redirectTo}`);
                window.location.replace(redirectTo);
            }
        }, 300); // Réduit de 500 à 300ms
    }

    // Initialisation
    if (document.body) {
        injectOverlay();
    } else {
        document.addEventListener('DOMContentLoaded', injectOverlay, { once: true });
    }
    
    verifyAccess();
    
    // Timeout de sécurité - force l'accès après 3s si pas de réponse
    setTimeout(() => {
        const overlay = document.getElementById('secura-loading-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            console.warn('⚠️ Timeout - Forcing access');
            grantAccess('timeout');
        }
    }, CONFIG.verifyTimeout);
    
    window.securaRoleConfig = CONFIG;
})();