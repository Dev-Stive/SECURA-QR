/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🛡️  SECURA ROLE-BASED ACCESS CONTROL v4.0 - PRIORITÉ SESSIONS ÉVÉNEMENT  🛡️            ║
 * ║                                                                                           ║
 * ║  ✅ Priorité ABSOLUE aux sessions événement                                               ║
 * ║  ✅ Vérification complète des tokens JWT                                                  ║
 * ║  ✅ Système de rôles robuste                                                              ║
 * ║  ✅ Redirection vers page d'accueil (/index.html) en cas de refus                         ║
 * ║  ✅ Gestion d'erreurs améliorée                                                           ║
 * ║  ✅ Compatibilité avec storage.js                                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════╝
 */

(function initSecuraAccessControl() {
    // ═══════════════════════════════════════════════════════════════
    // ⚙️  CONFIGURATION CENTRALISÉE
    // ═══════════════════════════════════════════════════════════════
    const CONFIG = {

        apiUrl: window.location.hostname === 'localhost'
            ? 'http://localhost:3000/api'
            : 'https://breakable-leela-geekhub-team-240bba40.koyeb.app/api',
        

        pageTypes: {
            public: [
                '/', '/index.html',
                '/login', '/login.html',
                '/register', '/register.html',
                '/forgot-password', '/forgot-password.html',
                '/access', '/access.html',
                '/404', '/404.html'
            ],
            protected: [
                '/home', '/home.html',
                '/dashboard', '/dashboard.html'
            ],
            event: [
            '/welcome', '/welcome/',
            '/welcome/index.html',
            '/welcome/event-photos','/welcome/event-photos.html',
            '/welcome/event-info','/welcome/event-info.html',
            '/welcome/guests',
            '/welcome/my-qr','/welcome/my-qr.html',
            '/welcome/event-guests','/welcome/event-guests.html',
            '/welcome/event-chat', '/event-chat.html',
            '/event-schedule', '/welcome/event-schedule.html',
            '/event-map', '/event-map.html',
            '/event-guests', '/event-guests.html'
            ],
            admin: [] // Tous les chemins non couverts = admin
        },
        
        // Clés localStorage
        storageKeys: {
            userToken: 'secura_token',
            userData: 'secura_user',
        },
        
        // Timeouts
        apiTimeout: 5000,
        verifyTimeout: 5000,
        overlayDuration: 400,
        redirectDelay: 300,
        
        debug: window.location.hostname === 'localhost'
    };

    // ═══════════════════════════════════════════════════════════════
    // 🎨 INJECTION DES STYLES D'INITIALISATION
    // ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// 🎨 INJECTION DES STYLES D'INITIALISATION
// ═══════════════════════════════════════════════════════════════
function injectInitialStyles() {
    const style = document.createElement('style');
    style.id = 'secura-initial-styles';
    style.textContent = `
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
    document.head.insertAdjacentElement('afterbegin', style);
}

/*   <!-- Player simple -->
                <lottie-player 
                    src="assets/lottie/loading.json"
                    background="transparent" 
                    speed="1" 
                    style="width: 100px; height: 100px;" 
                    loop 
                    autoplay>
                </lottie-player>*/

// ═══════════════════════════════════════════════════════════════
// 🎪 INJECTION DU LOADING OVERLAY
// ═══════════════════════════════════════════════════════════════
 // 2️⃣ INJECTER OVERLAY
    function injectLoadingOverlay() {
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
        // Ajouter une animation aux étapes
        if (i < step) {
            s.style.transform = 'translateY(-2px)';
            setTimeout(() => {
                s.style.transform = 'translateY(0)';
            }, 300);
        }
    });
    
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${(step / 3) * 100}%`;
        
        // Animation de la barre de progression
        progressBar.animate([
            { width: progressBar.style.width },
            { width: `${(step / 3) * 100}%` }
        ], {
            duration: 500,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });
    }
}
    // ═══════════════════════════════════════════════════════════════
    // 🔐 UTILITAIRES DE SÉCURITÉ
    // ═══════════════════════════════════════════════════════════════

    /**
     * Vérifier rapidement si un JWT token est valide (structurellement)
     */
    function isTokenValidStructurally(token) {
        if (!token || typeof token !== 'string') return false;
        
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            // Décoder et valider le payload
            const payload = JSON.parse(
                atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
            );
            
            // Vérifier l'expiration
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                if (CONFIG.debug) console.warn('⚠️ Token expiré');
                return false;
            }
            
            // Vérifier les claims obligatoires
            if (!payload.id || !payload.email) {
                if (CONFIG.debug) console.warn('⚠️ Token claims invalides');
                return false;
            }
            
            return true;
        } catch (err) {
            if (CONFIG.debug) console.error('❌ Erreur validation token:', err);
            return false;
        }
    }

    /**
 * Vérifier si une session événement est active
 */
async function getActiveEventSession() {
    try {
        const sessionToken = localStorage.getItem('secura_event_session_token');
        if (!sessionToken) return null;

        const response = await fetch(`${CONFIG.apiUrl}/event-sessions/verify-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: sessionToken })
        });

        if (!response.ok) {
            console.warn('⚠️ Session événement invalide');
            clearEventSession();
            return null;
        }

        const result = await response.json();
        
        if (result.success) {
            return {
                token: sessionToken,
                sessionId: result.data.sessionId,
                eventId: result.data.eventId,
                guestId: result.data.guestId,
                tableId: result.data.tableId,
                accessMethod: result.data.accessMethod,
                isValid: true
            };
        } else {
            clearEventSession();
            return null;
        }

    } catch (err) {
        console.error('❌ Erreur vérification session:', err);
        return null;
    }
}

/**
 * Effacer la session événement
 */
function clearEventSession() {
    localStorage.removeItem('secura_event_session_token');
    console.log('✅ Session événement effacée');
}

    // ═══════════════════════════════════════════════════════════════
    // 📍 CLASSIFICATION DE PAGES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Déterminer le type de la page actuelle
     */
    function getPageType(path = window.location.pathname) {
        const normalizedPath = path.toLowerCase();
        
        if (CONFIG.pageTypes.public.some(p => {
            const pNorm = p.toLowerCase();
            // Correspondance exacte OU avec slash trailing
            return normalizedPath === pNorm || normalizedPath === pNorm + '/';
        })) {
            return 'public';
        }
        
        if (CONFIG.pageTypes.protected.some(p => {
            const pNorm = p.toLowerCase();
            return normalizedPath === pNorm || normalizedPath === pNorm + '/';
        })) {
            return 'protected';
        }
        
        if (CONFIG.pageTypes.event.some(p => {
            const pNorm = p.toLowerCase();
            return normalizedPath === pNorm || normalizedPath === pNorm + '/';
        })) {
            return 'event';
        }
        
        return 'admin';
    }

    /**
     * Vérifier si l'utilisateur a accès à une page basée sur son rôle
     */
    function isPageAllowedForRole(userRole, currentPath) {
        const normalizedPath = currentPath.toLowerCase();
        
        // Définir les pages autorisées par rôle
        const rolePages = {
            'admin': [
                '/dashboard', '/dashboard.html',
                '/home', '/home.html',
                '/events', '/events.html',
                '/event', '/event.html',
                '/event-info', '/event-info.html',
                '/guests', '/guests.html',
                '/galleries', '/galleries.html',
                '/tables', '/tables.html',
                '/table-info', '/table-info.html',
                '/access', '/access.html',
                '/qr-generator', '/qr-generator.html',
                '/ticket-generator', '/ticket-generator.html',
                '/scanner', '/scanner.html',
                '/profile', '/profile.html',
                '/checkin', '/checkin.html',
                '/settings', '/settings.html'
            ],
            'user': [
                '/home', '/home.html',
                '/events', '/events.html',
                '/event', '/event.html',
                '/event-info', '/event-info.html',
                '/guests', '/guests.html',
                '/tables', '/tables.html',
                '/table-info', '/table-info.html',
                '/access', '/access.html',
                '/qr-generator', '/qr-generator.html',
                '/ticket-generator', '/ticket-generator.html',
                
                '/profile', '/profile.html',
                '/settings', '/settings.html'
            ]
        };
        
        const allowedPages = rolePages[userRole] || [];
        return allowedPages.some(p => normalizedPath.endsWith(p.toLowerCase()));
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔄 VÉRIFICATION COMPLÈTE D'ACCÈS
    // ═══════════════════════════════════════════════════════════════

    /**
     * ⚡ VÉRIFICATION PRIORITAIRE D'ACCÈS
     * HIÉRARCHIE :
     * 1. Session événement active -> PRIORITÉ ABSOLUE
     * 2. Pages événement -> vérifier session obligatoire
     * 3. Pages publiques -> accès direct (sauf si déjà connecté)
     * 4. Pages protégées/admin -> vérifier token + rôle
     */
    async function performAccessVerification() {
        const userToken = localStorage.getItem(CONFIG.storageKeys.userToken);
        const eventSession = await getActiveEventSession();
        const currentPageType = getPageType();
        const currentPath = window.location.pathname.toLowerCase();
        
        if (CONFIG.debug) {
            console.log('🔍 Vérification d\'accès:', {
                pageType: currentPageType,
                hasUserToken: !!userToken,
                hasEventSession: !!eventSession,
                path: currentPath
            });
        }
        
        updateProgressStep(1);
        
        // ═══════════════════════════════════════════════════════════
        // 1️⃣  PRIORITÉ ABSOLUE: Session événement active
        // ═══════════════════════════════════════════════════════════
        if (eventSession && eventSession.isValid) {
            if (CONFIG.debug) console.log('✅ Session événement détectée et valide');
            
            // Si déjà sur une page événement, accorder l'accès
            if (currentPageType === 'event') {
                grantAccess('event-session');
                return;
            }
            
            // Si sur /access ou /index -> redirection vers welcome/ (session déjà active)
            if (currentPageType === 'public') {
                if (CONFIG.debug) console.log('🚀 Session déjà active -> redirection vers /welcome/');
                window.location.replace('/welcome/');
                return;
            }
            
            // Si sur page protégée/admin ET avec session événement -> redirection vers welcome/
            // Car une session événement prend TOUJOURS la priorité
            if (currentPageType === 'protected' || currentPageType === 'admin') {
                if (CONFIG.debug) console.log('🚀 Session événement prioritaire -> /welcome/');
                window.location.replace('/welcome/');
                return;
            }
        }
        
        // ═══════════════════════════════════════════════════════════
        // 2️⃣  Pages événement SANS session -> ACCÈS REFUSÉ
        // ═══════════════════════════════════════════════════════════
        if (currentPageType === 'event') {
            if (CONFIG.debug) console.log('❌ Page événement sans session active');
            denyAccess('No event session', '/index.html');
            return;
        }
        
        // ═══════════════════════════════════════════════════════════
        // 3️⃣  Pages publiques -> accès direct avec restrictions
        // ═══════════════════════════════════════════════════════════
        if (currentPageType === 'public') {
            // Si sur page d'accueil et déjà connecté -> redirection vers home
            if ((currentPath === '/' || currentPath === '/index.html') && 
                userToken && isTokenValidStructurally(userToken)) {
                if (CONFIG.debug) console.log('ℹ️ Utilisateur connecté -> /home.html');
                window.location.replace('/home.html');
                return;
            }
            
            // Si sur login/register et déjà connecté -> redirection vers home
            if ((currentPath.includes('/login') || currentPath.includes('/register')) && 
                userToken && isTokenValidStructurally(userToken)) {
                if (CONFIG.debug) console.log('ℹ️ Utilisateur déjà connecté -> /home.html');
                window.location.replace('/home.html');
                return;
            }
            
            if (CONFIG.debug) console.log('✅ Accès page publique accordé');
            grantAccess('public');
            return;
        }
        
        // ═══════════════════════════════════════════════════════════
        // 4️⃣  Pages protégées -> vérification token OBLIGATOIRE
        // ═══════════════════════════════════════════════════════════
        if (currentPageType === 'protected') {
            if (!userToken) {
                if (CONFIG.debug) console.log('❌ Page protégée sans token');
                denyAccess('No token', '/index.html');
                return;
            }
            
            if (!isTokenValidStructurally(userToken)) {
                if (CONFIG.debug) console.log('❌ Page protégée, token invalide');
                denyAccess('Invalid token', '/index.html');
                return;
            }
            
            // Vérifier le rôle pour les pages protégées
            updateProgressStep(2);
            await verifyRoleAndAuthorize(userToken, currentPath);
            return;
        }
        
        // ═══════════════════════════════════════════════════════════
        // 5️⃣  Pages admin -> vérification complète via API
        // ═══════════════════════════════════════════════════════════
        if (currentPageType === 'admin') {
            if (!userToken) {
                if (CONFIG.debug) console.log('❌ Page admin sans token');
                denyAccess('No token', '/index.html');
                return;
            }
            
            if (!isTokenValidStructurally(userToken)) {
                if (CONFIG.debug) console.log('❌ Page admin, token invalide');
                denyAccess('Invalid token', '/index.html');
                return;
            }
            
            updateProgressStep(2);
            await verifyRoleAndAuthorize(userToken, currentPath);
            return;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 👤 VÉRIFICATION DES RÔLES VIA API
    // ═══════════════════════════════════════════════════════════════

    /**
     * Vérifier le rôle de l'utilisateur et ses autorisations
     */
    async function verifyRoleAndAuthorize(token, currentPath) {
        try {
            // Attendre que storage.js soit disponible si nécessaire
            if (typeof window.storage === 'undefined') {
                await new Promise(resolve => {
                    const checkStorage = setInterval(() => {
                        if (typeof window.storage !== 'undefined') {
                            clearInterval(checkStorage);
                            resolve();
                        }
                    }, 50);
                    
                    setTimeout(() => {
                        clearInterval(checkStorage);
                        resolve();
                    }, 1000);
                });
            }
            
            const response = await fetch(`${CONFIG.apiUrl}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(CONFIG.apiTimeout)
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('❌ API 401 - Token expiré/invalide');
                    denyAccess('Token invalid', '/index.html');
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success || !result.user) {
                console.error('❌ Données utilisateur invalides');
                denyAccess('Invalid user data', '/index.html');
                return;
            }
            
            const user = result.user;
            
            // Mettre à jour les données utilisateur
            localStorage.setItem(CONFIG.storageKeys.userData, JSON.stringify(user));
            localStorage.setItem(CONFIG.storageKeys.userToken, token);
            
            // Notifier storage.js si disponible
            if (window.storage && typeof window.storage.syncAuthFromStorage === 'function') {
                window.storage.syncAuthFromStorage();
            }
            
            // Vérifier si la page est autorisée pour ce rôle
            const isAllowed = isPageAllowedForRole(user.role, currentPath);
            
            updateProgressStep(3);
            
            if (!isAllowed) {
                // Rediriger vers la page appropriée selon le rôle
                const targetPage = user.role === 'admin' ? '/dashboard.html' : '/home.html';
                if (!currentPath.endsWith(targetPage)) {
                    if (CONFIG.debug) console.log(`🎯 Redirection ${user.role} → ${targetPage}`);
                    window.location.href = targetPage;
                    return;
                }
            }
            
            // Mettre à jour l'UI
            updateUIWithUserInfo(user);
            
            if (CONFIG.debug) console.log('✅ Utilisateur autorisé:', user.email);
            grantAccess(user.role);
            
        } catch (err) {
            console.error('❌ Erreur vérification rôle:', err);
            
            // Mode hors ligne : vérifier les données en cache
            const cachedUser = localStorage.getItem(CONFIG.storageKeys.userData);
            if (cachedUser) {
                try {
                    const user = JSON.parse(cachedUser);
                    const isAllowed = isPageAllowedForRole(user.role, currentPath);
                    
                    if (isAllowed) {
                        console.warn('⚠️ Mode hors ligne - utilisant données en cache');
                        updateUIWithUserInfo(user);
                        grantAccess('offline');
                        return;
                    }
                } catch (cacheErr) {
                    // Continuer vers le refus d'accès
                }
            }
            
            denyAccess('Network error', '/index.html');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🎨 MISE À JOUR DE L'INTERFACE
    // ═══════════════════════════════════════════════════════════════

    function updateUIWithUserInfo(user) {
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
        const displayRole = user.role === 'admin' ? 'Administrateur' : 'Utilisateur';
        
        // Sidebar
        const sidebarName = document.getElementById('sidebarProfileName');
        const sidebarEmail = document.getElementById('sidebarProfileEmail');
        const sidebarRole = document.getElementById('sidebarProfileRole');
        
        if (sidebarName) sidebarName.textContent = displayName;
        if (sidebarEmail) sidebarEmail.textContent = user.email;
        if (sidebarRole) sidebarRole.textContent = displayRole;
        
        // Header
        const headerName = document.getElementById('headerUserName');
        const headerRole = document.getElementById('headerUserRole');
        
        if (headerName) headerName.textContent = displayName;
        if (headerRole) headerRole.textContent = user.role === 'admin' ? 'Admin' : 'User';
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ ACCÈS ACCORDÉ
    // ═══════════════════════════════════════════════════════════════

    function grantAccess(accessType = 'public') {
        document.body.classList.add('auth-verified');
        
        setTimeout(() => {
            const overlay = document.getElementById('secura-loading-overlay');
            if (overlay) overlay.classList.add('hidden');
        }, CONFIG.overlayDuration);
        
        setTimeout(() => {
            const hideStyle = document.getElementById('secura-initial-styles');
            if (hideStyle) hideStyle.remove();
            
            // Émettre l'événement
            window.dispatchEvent(new CustomEvent('secura:access-granted', { 
                detail: { 
                    type: accessType,
                    timestamp: new Date().toISOString()
                } 
            }));
            
            // Démarrer les animations
            document.querySelectorAll('.animate-fade-in').forEach(el => {
                el.style.animationPlayState = 'running';
            });
        }, CONFIG.overlayDuration * 1.5);
        
        if (CONFIG.debug) console.log(`✅ Accès accordé (${accessType})`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ❌ ACCÈS REFUSÉ
    // ═══════════════════════════════════════════════════════════════

    function denyAccess(reason, redirectTo = '/index.html') {
        document.body.classList.add('auth-denied');
        console.warn(`❌ Accès refusé: ${reason}`);
        
        // Nettoyer les données invalides
        if (reason.includes('token') || reason.includes('Invalid')) {
            localStorage.removeItem(CONFIG.storageKeys.userToken);
            localStorage.removeItem(CONFIG.storageKeys.userData);
            console.log('🧹 Données d\'authentification nettoyées');
        }
        
        // Redirection avec délai minimal
        setTimeout(() => {
            const currentPath = window.location.pathname.toLowerCase();
            const targetPath = redirectTo.toLowerCase();
            
            if (!currentPath.includes(targetPath)) {
                if (CONFIG.debug) console.log(`🚀 Redirection vers ${redirectTo}`);
                window.location.replace(redirectTo);
            }
        }, CONFIG.redirectDelay);
    }

    // ═══════════════════════════════════════════════════════════════
    // 🚀 INITIALISATION
    // ═══════════════════════════════════════════════════════════════

    function initialize() {
        injectInitialStyles();
        
        if (document.body) {
            injectLoadingOverlay();
        } else {
            document.addEventListener('DOMContentLoaded', injectLoadingOverlay, { once: true });
        }
        
        // Lancer la vérification
        let verificationComplete = false;
        
        setTimeout(async () => {
            try {
                await performAccessVerification();
                verificationComplete = true;
            } catch (err) {
                console.error('❌ Erreur critique vérification accès:', err);
                
                // SÉCURITÉ : En cas d'erreur, refuser l'accès aux pages sécurisées
                const currentPageType = getPageType();
                
                if (currentPageType === 'event' || currentPageType === 'protected' || currentPageType === 'admin') {
                    console.error('🔒 Erreur sur page sécurisée - accès REFUSÉ');
                    denyAccess('Verification error', '/index.html');
                } else {
                    // Pour les pages publiques, accorder l'accès en fallback
                    console.warn('⚠️ Fallback pour page publique');
                    grantAccess('error-fallback');
                }
                
                verificationComplete = true;
            }
        }, 100);
        
        // Timeout de sécurité
        setTimeout(() => {
            if (!verificationComplete) {
                const overlay = document.getElementById('secura-loading-overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    console.warn('⚠️ Timeout vérification');
                    
                    const currentPageType = getPageType();
                    
                    // Refuser les pages sécurisées en timeout
                    if (currentPageType === 'event' || currentPageType === 'protected' || currentPageType === 'admin') {
                        console.error('🔒 Timeout sur page sécurisée - accès REFUSÉ');
                        denyAccess('Verification timeout', '/index.html');
                    } else {
                        console.warn('⏱️ Timeout sur page publique - accès accordé');
                        grantAccess('timeout-fallback');
                    }
                }
            }
        }, CONFIG.verifyTimeout);
    }

    // Démarrer l'initialisation
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
    
    // Exposer les utilitaires pour le debugging
    window.securaAccessControl = {
        config: CONFIG,
        getActiveEventSession,
        clearEventSession,
        getPageType,
        isTokenValidStructurally
    };
    
    console.log('🛡️ SECURA Access Control v4.0 initialisé - Priorité sessions événement');
})();




