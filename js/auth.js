/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        🔐 SECURA AUTH MANAGER - ULTRA COMPLET V2.0           ║
 * ║           Gestion unifiée de l'authentification              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

class SecuraAuthManager {
    constructor() {

        //this.API_URL = 'http://localhost:3000/api';
         this.API_URL = 'https://secura-qr.onrender.com/api';
        
        this.token = localStorage.getItem('secura_token') || null;
        this.user = null;
        this.isAuthenticated = !!this.token;
        
        this._authListeners = [];
        
        // Initialisation
        this.init();
    }
    
    init() {
        console.log('🔐 Secura Auth Manager initialisé');
        
        // Vérifier le token au démarrage
        if (this.token) {
            this.verifyToken().then(valid => {
                if (!valid) {
                    this.clearAuth();
                } else {
                    this.emit('auth:verified');
                }
            });
        }
    }
    
    // ============================================================
    // 🔄 GESTION DES ÉVÉNEMENTS
    // ============================================================
    on(event, callback) {
        if (!this._authListeners[event]) this._authListeners[event] = [];
        this._authListeners[event].push(callback);
        
        return () => {
            this._authListeners[event] = this._authListeners[event].filter(cb => cb !== callback);
        };
    }
    
    emit(event, data) {
        if (this._authListeners[event]) {
            this._authListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`Erreur dans le listener ${event}:`, err);
                }
            });
        }
    }
    
    // ============================================================
    // 🌐 REQUÊTES API
    // ============================================================
    async apiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.API_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (this.token && !endpoint.includes('/auth/')) {
        headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    try {
        const res = await fetch(url, {
            ...options,
            headers,
            signal: AbortSignal.timeout(15000)
        });
        
        // D'ABORD parser le JSON
        const data = await res.json();
        
        // ENSUITE vérifier le status
        if (!res.ok) {
            // Retourner directement l'objet JSON de l'API
            return data; // contient {success: false, message: "..."}
        }
        
        return data;
        
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err.message);
        
        if (err.message.includes('401') || err.message.includes('403')) {
            this.clearAuth();
            window.location.href = '/login.html';
        }
        
        return { 
            success: false, 
            message: err.message || 'Erreur de connexion'
        };
    }
}
    
    // ============================================================
    // 🔐 MÉTHODES D'AUTHENTIFICATION
    // ============================================================
    
    /**
     * Connexion utilisateur
     */
    async login(email, password) {
        try {
            const result = await this.apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            if (result.success) {
                this.setAuth(result.token, result.user);
                this.emit('auth:login', result.user);
                return { success: true, user: result.user };
            } else {
                return { 
                    success: false, 
                    message: result.message || 'Identifiants incorrects' 
                };
            }
        } catch (err) {
            console.error('Login error:', err);
            return { 
                success: false, 
                message: 'Erreur de connexion au serveur' 
            };
        }
    }
    
    /**
     * Inscription avec étapes
     */
    async registerStep1(email, password) {
        // Validation de base
        if (!this.isValidEmail(email)) {
            return { success: false, message: 'Email invalide' };
        }
        
        if (password.length < 6) {
            return { success: false, message: 'Mot de passe trop court (6 caractères minimum)' };
        }
        
        try {
            const result = await this.apiRequest('/auth/register-step1', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            return result;
        } catch (err) {
            console.error('Register step 1 error:', err);
            return { success: false, message: err.message || 'Erreur lors de l\'inscription' };
        }
    }
    
    async registerStep2(verificationCode, step1Token) {
        try {
            const result = await this.apiRequest('/auth/register-step2', {
                method: 'POST',
                body: JSON.stringify({ 
                    verificationCode,
                    token: step1Token 
                })
            });
            
            return result;
        } catch (err) {
            console.error('Register step 2 error:', err);
            return { success: false, message: err.message || 'Erreur de vérification' };
        }
    }
    
    async registerStep3(userData, token) {
        try {
            const result = await this.apiRequest('/auth/register-step3', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
            
            if (result.success && result.user) {
                this.user = result.user;
                this.setAuth(result.token, result.user);
                this.emit('auth:register', result.user);
                this.emit('auth:profile_updated', result.user);
            }
            
            return result;
        } catch (err) {
            console.error('Register step 3 error:', err);
            return { success: false, message: err.message || 'Erreur de mise à jour du profil' };
        }
    }
    
    /**
     * Mot de passe oublié
     */
    async forgotPassword(email) {
        try {
            const result = await this.apiRequest('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            
            return result;
        } catch (err) {
            console.error('Forgot password error:', err);
            return { success: false, message: err.message || 'Erreur lors de l\'envoi du code' };
        }
    }
    
    async verifyResetCode(email, code) {
        try {
            const result = await this.apiRequest('/auth/verify-reset-code', {
                method: 'POST',
                body: JSON.stringify({ email, code })
            });
            
            return result;
        } catch (err) {
            console.error('Verify reset code error:', err);
            return { success: false, message: err.message || 'Code invalide' };
        }
    }
    
    async resetPassword(email, code, newPassword) {
        try {
            const result = await this.apiRequest('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ email, code, newPassword })
            });
            
            return result;
        } catch (err) {
            console.error('Reset password error:', err);
            return { success: false, message: err.message || 'Erreur lors de la réinitialisation' };
        }
    }
    
    /**
     * Déconnexion
     */
    async logout() {
        try {
            if (this.token) {
                await this.apiRequest('/auth/logout', {
                    method: 'POST'
                });
            }
        } catch (err) {
            console.warn('Logout API error:', err.message);
        } finally {
            this.clearAuth();
            this.emit('auth:logout');
            window.location.href = '/login.html';
        }
    }
    
    /**
     * Vérifier le token
     */
    async verifyToken() {
        if (!this.token) return false;
        
        try {
            const result = await this.apiRequest('/auth/verify-token', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            return result.success && result.valid;
        } catch (err) {
            console.warn('Token verification failed:', err.message);
            return false;
        }
    }

    async verifyTempToken(token) {

    try {
        const response = await this.apiRequest('/auth/verify-temp-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        return response;
    } catch (err) {
        return { valid: false, message: err.message || 'Erreur de connexion' };
    }
};
    
    /**
     * Récupérer le profil utilisateur
     */
    async getProfile() {
        if (!this.token) return null;
        
        try {
             const result = await this.apiRequest('/auth/me', {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${this.token}`,
                    }
                });

            if (result.success) {
                this.user = result.user;
                localStorage.setItem('secura_user', JSON.stringify(result.user));
                this.emit('auth:profile_loaded', result.user);
                return result.user;
            }
        } catch (err) {
            console.error('Get profile error:', err);
        }
        
        return null;
    }
    
    // ============================================================
    // 💾 GESTION DU STOCKAGE LOCAL
    // ============================================================
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        this.isAuthenticated = true;
        
        localStorage.setItem('secura_token', token);
        localStorage.setItem('secura_user', JSON.stringify(user));
        
        // Mettre à jour les éléments UI si nécessaires
        this.updateUI();
    }
    
    clearAuth() {
        this.token = null;
        this.user = null;
        this.isAuthenticated = false;
        
        localStorage.removeItem('secura_token');
        localStorage.removeItem('secura_user');
        
        this.emit('auth:cleared');
    }
    
    // ============================================================
    // 🎨 MISE À JOUR UI
    // ============================================================
    updateUI() {
        // Mettre à jour les éléments de profil dans l'interface
        const profileElements = [
            { id: 'profileName', value: this.user?.firstName ? `${this.user.firstName} ${this.user.lastName}`.trim() : this.user?.email?.split('@')[0] || 'Utilisateur' },
            { id: 'dropdownName', value: this.user?.firstName ? `${this.user.firstName} ${this.user.lastName}`.trim() : this.user?.email?.split('@')[0] || 'Utilisateur' },
            { id: 'sidebarProfileName', value: this.user?.firstName ? `${this.user.firstName} ${this.user.lastName}`.trim() : this.user?.email?.split('@')[0] || 'Utilisateur' },
            { id: 'dropdownEmail', value: this.user?.email || '' },
            { id: 'sidebarProfileEmail', value: this.user?.email || '' },
            { id: 'profileRole', value: this.user?.role || 'Utilisateur' },
            { id: 'dropdownRole', value: this.user?.role || 'Utilisateur' },
            { id: 'sidebarProfileRole', value: this.user?.role || 'Utilisateur' }
        ];
        
        profileElements.forEach(element => {
            const el = document.getElementById(element.id);
            if (el) {
                el.textContent = element.value;
                
                // Style spécial pour le rôle
                if (element.id === 'dropdownRole' && this.user?.role) {
                    el.style.background = this.user.role === 'admin' ? '#EF4444' : '#D97706';
                }
            }
        });
    }
    
    // ============================================================
    // 🔧 UTILITAIRES
    // ============================================================
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    requireAuth(redirectTo = '/login.html') {
        if (!this.isAuthenticated && !window.location.pathname.includes('login.html')) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }
    
    requireRole(role, redirectTo = '/') {
        if (!this.isAuthenticated || this.user?.role !== role) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }
    
    // ============================================================
    // 📱 GESTION DE LA SESSION
    // ============================================================
    startSessionCheck() {
        // Vérifier la session toutes les 5 minutes
        this.sessionInterval = setInterval(() => {
            if (this.token) {
                this.verifyToken().then(valid => {
                    if (!valid) {
                        this.clearAuth();
                        if (!window.location.pathname.includes('login.html')) {
                            window.location.href = '/login.html';
                        }
                    }
                });
            }
        }, 5 * 60 * 1000);
    }
    
    stopSessionCheck() {
        if (this.sessionInterval) {
            clearInterval(this.sessionInterval);
        }
    }
}

// Instance globale
const authManager = new SecuraAuthManager();
window.authManager = authManager;

// Exporter pour les modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecuraAuthManager, authManager };
}

console.log('✅ Secura Auth Manager chargé');