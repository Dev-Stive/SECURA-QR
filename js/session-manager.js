/**
 * 🔐 Session Manager v2.0 - Production Ready
 * Gère les sessions utilisateur et événement
 * Nettoyage automatique des tokens expirés
 */

class SessionManager {
    constructor() {
        this.keys = {
            token: 'secura_token',
            user: 'secura_user',
            event: 'secura_event_session',
            guest: 'secura_guest_info'
        };
        this.init();
    }

    init() {
        // Nettoyer les sessions expirées au démarrage
        this.cleanupExpiredSessions();
        
        // Vérifier tous les 5 minutes
        setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
    }

    /**
     * Sauvegarder un token utilisateur
     */
    saveToken(token) {
        if (!token) {
            this.clearToken();
            return;
        }
        
        try {
            localStorage.setItem(this.keys.token, token);
            console.log('✅ Token sauvegardé');
            
            // Extraire et sauvegarder l'expiration
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                if (payload.exp) {
                    localStorage.setItem('secura_token_exp', payload.exp * 1000);
                }
            }
        } catch (err) {
            console.error('❌ Erreur sauvegarde token:', err);
            this.clearToken();
        }
    }

    /**
     * Récupérer le token
     */
    getToken() {
        const token = localStorage.getItem(this.keys.token);
        
        // Vérifier l'expiration
        if (token && this.isTokenExpired(token)) {
            console.warn('⚠️ Token expiré - Nettoyage');
            this.clearToken();
            return null;
        }
        
        return token;
    }

    /**
     * Vérifier si le token est expiré
     */
    isTokenExpired(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return true;
            
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            
            if (!payload.exp) return false;
            
            const expirationTime = payload.exp * 1000;
            const currentTime = Date.now();
            const timeUntilExpiry = expirationTime - currentTime;
            
            // Expirer 5 minutes avant pour sécurité
            return timeUntilExpiry < 5 * 60 * 1000;
        } catch (err) {
            return true;
        }
    }

    /**
     * Nettoyer le token
     */
    clearToken() {
       
        console.log('🧹 Token nettoyé');
    }

    /**
     * Sauvegarder les infos utilisateur
     */
    saveUser(user) {
        if (!user) {
            localStorage.removeItem(this.keys.user);
            return;
        }
        
        try {
            localStorage.setItem(this.keys.user, JSON.stringify(user));
        } catch (err) {
            console.error('❌ Erreur sauvegarde user:', err);
        }
    }

    /**
     * Récupérer les infos utilisateur
     */
    getUser() {
        try {
            const data = localStorage.getItem(this.keys.user);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('❌ Erreur lecture user:', err);
            return null;
        }
    }

    /**
     * Sauvegarder une session événement
     */
    saveEventSession(session) {
        if (!session) {
            this.clearEventSession();
            return;
        }
        
        try {
            localStorage.setItem(this.keys.event, JSON.stringify(session));
            console.log('✅ Session événement sauvegardée');
        } catch (err) {
            console.error('❌ Erreur sauvegarde session:', err);
        }
    }

    /**
     * Récupérer la session événement
     */
    getEventSession() {
        try {
            const data = localStorage.getItem(this.keys.event);
            if (!data) return null;
            
            const session = JSON.parse(data);
            
            // Vérifier l'expiration
            if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
                console.warn('⚠️ Session événement expirée');
                this.clearEventSession();
                return null;
            }
            
            return session;
        } catch (err) {
            console.error('❌ Erreur lecture session:', err);
            return null;
        }
    }

    /**
     * Nettoyer la session événement
     */
    clearEventSession() {
        localStorage.removeItem(this.keys.event);
        localStorage.removeItem(this.keys.guest);
        console.log('🧹 Session événement nettoyée');
    }

    /**
     * Nettoyer toutes les sessions expirées
     */
    cleanupExpiredSessions() {
        // Vérifier token utilisateur
        const token = localStorage.getItem(this.keys.token);
        if (token && this.isTokenExpired(token)) {
            console.log('🧹 Cleanup: Token utilisateur expiré');
            this.clearToken();
        }
        
        // Vérifier session événement
        const eventSession = localStorage.getItem(this.keys.event);
        if (eventSession) {
            try {
                const session = JSON.parse(eventSession);
                if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
                    console.log('🧹 Cleanup: Session événement expirée');
                    this.clearEventSession();
                }
            } catch (err) {
                console.warn('⚠️ Cleanup: Erreur parsing session');
                this.clearEventSession();
            }
        }
    }

    /**
     * Logout complet
     */
    logout() {
        console.log('🔓 Logout complet');
        this.clearToken();
        this.clearEventSession();
    }

    /**
     * Vérifier si utilisateur connecté
     */
    isAuthenticated() {
        return !!this.getToken();
    }

    /**
     * Vérifier si session événement active
     */
    hasEventSession() {
        return !!this.getEventSession();
    }

    /**
     * Obtenir les infos de session
     */
    getSessionInfo() {
        return {
            token: this.getToken() ? 'present' : 'absent',
            user: this.getUser() ? 'present' : 'absent',
            eventSession: this.getEventSession() ? 'active' : 'inactive',
            isAuthenticated: this.isAuthenticated(),
            hasEventSession: this.hasEventSession()
        };
    }
}

// Initialiser globalement
window.sessionManager = window.sessionManager || new SessionManager();

console.log('✅ Session Manager V2.0 chargé');
