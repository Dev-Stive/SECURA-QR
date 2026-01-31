/**
 * @file oauth.js
 * @description Configuration et gestion OAuth 2.0 pour Secura QR.
 * Supporte Google OAuth avec gestion des tokens, refresh tokens et sécurisation avancée.
 * @module config/oauth
 * @requires passport
 * @requires passport-google-oauth20
 * @requires ../utils/errorHandler
 * @requires ../utils/logger
 * @requires ./config
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/dateHelper
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('./config');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { generateUUID, generateSecureToken } = require('../utils/helpers/idGenerator');
const { formatDate, addDays } = require('../utils/helpers/dateHelper');
const { encrypt, decrypt } = require('../utils/security');

/**
 * @class OAuthManager
 * @description Gestionnaire OAuth pour l'authentification tierce
 */
class OAuthManager {
  constructor() {
    /** @type {boolean} */
    this.initialized = false;
    /** @type {Object} */
    this.strategies = new Map();
    /** @type {Object} */
    this.tokenStore = new Map(); // Stockage en mémoire pour les refresh tokens

    this.initializeOAuth();
  }

  /**
   * @function initializeOAuth
   * @description Initialise le système OAuth avec les providers configurés
   * @returns {void}
   */
  initializeOAuth() {
    try {
      logger.info('OAuth: Début initialisation...');

      // Vérification de la configuration OAuth
      if (!this.isOAuthConfigured()) {
        logger.warn('OAuth: Aucun provider configuré - OAuth désactivé');
        return;
      }

      // Initialisation de Passport
      this.initializePassport();

      // Configuration des stratégies
      this.configureStrategies();

      // Configuration de la sérialisation
      this.configureSerialization();

      this.initialized = true;
      
      logger.success('OAuth: Initialisation terminée', {
        providers: Array.from(this.strategies.keys()),
        environment: config.nodeEnv
      });

    } catch (error) {
      logger.error('OAuth: Erreur initialisation', {
        error: error.message,
        stack: error.stack
      });
      throw new AppError(
        'Erreur initialisation OAuth',
        500,
        'OAUTH_INIT_ERROR'
      );
    }
  }

  /**
   * @function isOAuthConfigured
   * @description Vérifie si au moins un provider OAuth est configuré
   * @returns {boolean} True si configuré
   */
  isOAuthConfigured() {
    return !!(config.oauth.google.clientId && config.oauth.google.clientSecret);
  }

  /**
   * @function initializePassport
   * @description Initialise la configuration de base de Passport
   * @returns {void}
   */
  initializePassport() {
    // Configuration de la sérialisation utilisateur
    passport.serializeUser((user, done) => {
      try {
        const serializedUser = this.serializeUser(user);
        done(null, serializedUser);
      } catch (error) {
        logger.error('OAuth: Erreur sérialisation utilisateur', {
          error: error.message,
          userId: user.id
        });
        done(error);
      }
    });

    passport.deserializeUser(async (serializedUser, done) => {
      try {
        const user = await this.deserializeUser(serializedUser);
        done(null, user);
      } catch (error) {
        logger.error('OAuth: Erreur désérialisation utilisateur', {
          error: error.message,
          serializedUser
        });
        done(error);
      }
    });

    logger.debug('OAuth: Passport initialisé');
  }

  /**
   * @function configureStrategies
   * @description Configure les stratégies OAuth disponibles
   * @returns {void}
   */
  configureStrategies() {
    // Stratégie Google OAuth 2.0
    if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
      this.configureGoogleStrategy();
    }

    // Ajouter d'autres stratégies ici (Facebook, GitHub, etc.)
    // this.configureFacebookStrategy();
    // this.configureGitHubStrategy();

    logger.info('OAuth: Stratégies configurées', {
      count: this.strategies.size,
      strategies: Array.from(this.strategies.keys())
    });
  }

  /**
   * @function configureGoogleStrategy
   * @description Configure la stratégie Google OAuth 2.0
   * @returns {void}
   */
  configureGoogleStrategy() {
    const strategyName = 'google';
    
    const googleStrategy = new GoogleStrategy({
      clientID: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      callbackURL: config.oauth.google.callbackUrl,
      scope: [
        'profile',
        'email',
        'openid'
      ],
      state: true, // Protection CSRF
      passReqToCallback: false
    }, this.googleVerifyCallback.bind(this));

    passport.use(strategyName, googleStrategy);
    this.strategies.set(strategyName, googleStrategy);

    logger.info('OAuth: Stratégie Google configurée', {
      clientId: config.oauth.google.clientId ? 'configured' : 'missing',
      callbackUrl: config.oauth.google.callbackUrl
    });
  }

  /**
   * @function googleVerifyCallback
   * @description Callback de vérification pour Google OAuth
   * @param {string} accessToken - Access token Google
   * @param {string} refreshToken - Refresh token Google
   * @param {Object} profile - Profile utilisateur Google
   * @param {Function} done - Callback Passport
   * @returns {Promise<void>}
   */
  async googleVerifyCallback(accessToken, refreshToken, profile, done) {
    try {
      logger.debug('OAuth: Callback Google déclenché', {
        profileId: profile.id,
        email: profile.emails?.[0]?.value,
        provider: profile.provider
      });

      // Validation du profil
      this.validateOAuthProfile(profile);

      // Traitement de l'utilisateur
      const user = await this.processOAuthUser({
        provider: 'google',
        profile,
        accessToken,
        refreshToken
      });

      // Stockage du refresh token
      if (refreshToken) {
        await this.storeRefreshToken(user.id, 'google', refreshToken);
      }

      logger.info('OAuth: Authentification Google réussie', {
        userId: user.id,
        email: user.email,
        provider: 'google'
      });

      done(null, user);

    } catch (error) {
      logger.error('OAuth: Erreur callback Google', {
        error: error.message,
        profileId: profile.id,
        stack: error.stack
      });
      done(error);
    }
  }

  /**
   * @function validateOAuthProfile
   * @description Valide le profil OAuth reçu
   * @param {Object} profile - Profil OAuth
   * @throws {AppError} Si le profil est invalide
   * @returns {void}
   */
  validateOAuthProfile(profile) {
    if (!profile || !profile.id) {
      throw new AppError(
        'Profil OAuth invalide: ID manquant',
        400,
        'INVALID_OAUTH_PROFILE'
      );
    }

    if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
      throw new AppError(
        'Profil OAuth invalide: Email manquant',
        400,
        'OAUTH_EMAIL_REQUIRED'
      );
    }

    logger.debug('OAuth: Profil validé avec succès', {
      profileId: profile.id,
      email: profile.emails[0].value,
      provider: profile.provider
    });
  }

  /**
   * @function processOAuthUser
   * @description Traite un utilisateur OAuth (création ou mise à jour)
   * @param {Object} oauthData - Données OAuth
   * @returns {Promise<Object>} Utilisateur traité
   */
  async processOAuthUser(oauthData) {
    const { provider, profile, accessToken, refreshToken } = oauthData;
    const email = profile.emails[0].value;

    // Ici, vous intégreriez avec votre base de données
    // Pour l'instant, on simule la création/mise à jour

    const user = {
      id: generateUUID(),
      email: email,
      firstName: profile.name?.givenName || '',
      lastName: profile.name?.familyName || '',
      avatar: profile.photos?.[0]?.value,
      provider: provider,
      providerId: profile.id,
      emailVerified: true,
      oauthData: {
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        lastLogin: formatDate(),
        profile: this.sanitizeProfile(profile)
      },
      createdAt: formatDate(),
      updatedAt: formatDate()
    };

    logger.debug('OAuth: Utilisateur traité', {
      userId: user.id,
      email: user.email,
      provider: user.provider
    });

    return user;
  }

  /**
   * @function sanitizeProfile
   * @description Nettoie et sécurise le profil OAuth
   * @param {Object} profile - Profil brut
   * @returns {Object} Profil nettoyé
   */
  sanitizeProfile(profile) {
    return {
      id: profile.id,
      displayName: profile.displayName,
      name: profile.name,
      emails: profile.emails,
      photos: profile.photos,
      provider: profile.provider,
      _raw: undefined, // Supprimer les données brutes sensibles
      _json: undefined
    };
  }

  



  /**
   * @function storeRefreshToken
   * @description Stocke un refresh token de manière sécurisée
   * @param {string} userId - ID utilisateur
   * @param {string} provider - Provider OAuth
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<void>}
   */
  async storeRefreshToken(userId, provider, refreshToken) {
    const tokenKey = `${provider}:${userId}`;
    const tokenData = {
      token: this.encryptToken(refreshToken),
      provider,
      userId,
      storedAt: formatDate(),
      expiresAt: addDays(new Date(), 30).toISOString() // 30 jours
    };

    this.tokenStore.set(tokenKey, tokenData);

    logger.debug('OAuth: Refresh token stocké', {
      userId,
      provider,
      storedAt: tokenData.storedAt
    });
  }

  /**
   * @function getRefreshToken
   * @description Récupère un refresh token
   * @param {string} userId - ID utilisateur
   * @param {string} provider - Provider OAuth
   * @returns {Promise<string|null>} Refresh token ou null
   */
  async getRefreshToken(userId, provider) {
    const tokenKey = `${provider}:${userId}`;
    const tokenData = this.tokenStore.get(tokenKey);

    if (!tokenData) {
      logger.warn('OAuth: Refresh token non trouvé', { userId, provider });
      return null;
    }

    // Vérifier l'expiration
    if (new Date(tokenData.expiresAt) < new Date()) {
      this.tokenStore.delete(tokenKey);
      logger.warn('OAuth: Refresh token expiré', { userId, provider });
      return null;
    }

    return decrypt(tokenData.token);
  }

  /**
   * @function serializeUser
   * @description Sérialise un utilisateur pour la session
   * @param {Object} user - Utilisateur à sérialiser
   * @returns {Object} Utilisateur sérialisé
   */
  serializeUser(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      provider: user.provider,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };
  }

  /**
   * @function deserializeUser
   * @description Désérialise un utilisateur depuis la session
   * @param {Object} serializedUser - Utilisateur sérialisé
   * @returns {Promise<Object>} Utilisateur désérialisé
   */
  async deserializeUser(serializedUser) {
    // Ici, vous récupéreriez l'utilisateur depuis votre base de données
    // Pour l'instant, on retourne l'objet sérialisé
    return serializedUser;
  }

  /**
   * @function configureSerialization
   * @description Configure la sérialisation/désérialisation Passport
   * @returns {void}
   */
  configureSerialization() {
    // Déjà configuré dans initializePassport()
    logger.debug('OAuth: Sérialisation configurée');
  }

  /**
   * @function getAuthUrl
   * @description Génère l'URL d'authentification pour un provider
   * @param {string} provider - Provider OAuth
   * @param {Object} options - Options supplémentaires
   * @returns {string} URL d'authentification
   */
  getAuthUrl(provider, options = {}) {
    if (!this.strategies.has(provider)) {
      throw new AppError(
        `Provider OAuth non supporté: ${provider}`,
        400,
        'OAUTH_PROVIDER_NOT_SUPPORTED'
      );
    }

    const baseUrl = `${config.baseUrl}/api/auth/${provider}`;
    const params = new URLSearchParams({
      ...options,
      state: options.state || generateSecureToken(16)
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * @function refreshAccessToken
   * @description Rafraîchit un access token expiré
   * @param {string} userId - ID utilisateur
   * @param {string} provider - Provider OAuth
   * @returns {Promise<Object>} Nouveaux tokens
   */
  async refreshAccessToken(userId, provider) {
    try {
      const refreshToken = await this.getRefreshToken(userId, provider);
      
      if (!refreshToken) {
        throw new AppError(
          'Refresh token non disponible',
          401,
          'REFRESH_TOKEN_UNAVAILABLE'
        );
      }

      // Implémentation du refresh token selon le provider
      const newTokens = await this.executeTokenRefresh(provider, refreshToken);
      
      // Stockage du nouveau refresh token s'il est fourni
      if (newTokens.refresh_token) {
        await this.storeRefreshToken(userId, provider, newTokens.refresh_token);
      }

      logger.info('OAuth: Token rafraîchi avec succès', {
        userId,
        provider,
        tokenType: newTokens.token_type
      });

      return newTokens;

    } catch (error) {
      logger.error('OAuth: Erreur rafraîchissement token', {
        error: error.message,
        userId,
        provider
      });

      throw new AppError(
        `Erreur rafraîchissement token: ${error.message}`,
        401,
        'TOKEN_REFRESH_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * @function executeTokenRefresh
   * @description Exécute le rafraîchissement du token selon le provider
   * @param {string} provider - Provider OAuth
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} Nouveaux tokens
   */
  async executeTokenRefresh(provider, refreshToken) {
    // Implémentation spécifique au provider
    switch (provider) {
      case 'google':
        return await this.refreshGoogleToken(refreshToken);
      // Ajouter d'autres providers ici
      default:
        throw new AppError(
          `Rafraîchissement non supporté pour: ${provider}`,
          400,
          'REFRESH_NOT_SUPPORTED'
        );
    }
  }

  /**
   * @function refreshGoogleToken
   * @description Rafraîchit un token Google
   * @param {string} refreshToken - Refresh token Google
   * @returns {Promise<Object>} Nouveaux tokens Google
   */
  async refreshGoogleToken(refreshToken) {
    // Implémentation du refresh token Google
    // Cette partie nécessite une requête HTTP vers Google's token endpoint
    // Pour l'instant, on simule le comportement
    
    const response = {
      access_token: generateSecureToken(32),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'profile email'
      // refresh_token peut être omis s'il n'a pas changé
    };

    return response;
  }

  /**
   * @function revokeToken
   * @description Révoque un token OAuth
   * @param {string} userId - ID utilisateur
   * @param {string} provider - Provider OAuth
   * @returns {Promise<boolean>} True si révoqué
   */
  async revokeToken(userId, provider) {
    try {
      // Supprimer le refresh token local
      const tokenKey = `${provider}:${userId}`;
      const wasDeleted = this.tokenStore.delete(tokenKey);

      // Révoquer le token côté provider (implémentation optionnelle)
      await this.executeTokenRevocation(provider, userId);

      logger.info('OAuth: Token révoqué', {
        userId,
        provider,
        localRevocation: wasDeleted
      });

      return wasDeleted;

    } catch (error) {
      logger.error('OAuth: Erreur révocation token', {
        error: error.message,
        userId,
        provider
      });

      throw new AppError(
        `Erreur révocation token: ${error.message}`,
        500,
        'TOKEN_REVOCATION_ERROR'
      );
    }
  }

  /**
   * @function executeTokenRevocation
   * @description Exécute la révocation du token côté provider
   * @param {string} provider - Provider OAuth
   * @param {string} userId - ID utilisateur
   * @returns {Promise<void>}
   */
  async executeTokenRevocation(provider, userId) {
    // Implémentation spécifique au provider
    // Google: https://accounts.google.com/o/oauth2/revoke?token={token}
    logger.debug('OAuth: Révocation côté provider', { provider, userId });
    // Pour l'instant, c'est une opération no-op
  }

  /**
   * @function getSupportedProviders
   * @description Retourne la liste des providers OAuth supportés
   * @returns {string[]} Liste des providers
   */
  getSupportedProviders() {
    return Array.from(this.strategies.keys());
  }

  /**
   * @function isProviderSupported
   * @description Vérifie si un provider est supporté
   * @param {string} provider - Provider à vérifier
   * @returns {boolean} True si supporté
   */
  isProviderSupported(provider) {
    return this.strategies.has(provider);
  }

  /**
   * @function getStatus
   * @description Retourne le statut du système OAuth
   * @returns {Object} Statut OAuth
   */
  getStatus() {
    return {
      initialized: this.initialized,
      providers: this.getSupportedProviders(),
      configured: this.isOAuthConfigured(),
      environment: config.nodeEnv,
      timestamp: formatDate()
    };
  }
}

// Instance singleton
let oauthManager;

try {
  oauthManager = new OAuthManager();
} catch (error) {
  logger.error('OAuth: Échec création instance', {
    error: error.message
  });
  oauthManager = {
    initialized: false,
    getSupportedProviders: () => [],
    isProviderSupported: () => false,
    getStatus: () => ({ initialized: false, providers: [] })
  };
}

module.exports = {
  passport,
  initializeOAuth: () => oauthManager,
  getAuthUrl: oauthManager.getAuthUrl?.bind(oauthManager),
  refreshAccessToken: oauthManager.refreshAccessToken?.bind(oauthManager),
  revokeToken: oauthManager.revokeToken?.bind(oauthManager),
  getSupportedProviders: oauthManager.getSupportedProviders?.bind(oauthManager),
  isProviderSupported: oauthManager.isProviderSupported?.bind(oauthManager),
  getStatus: oauthManager.getStatus?.bind(oauthManager),
  isInitialized: () => oauthManager.initialized
};;