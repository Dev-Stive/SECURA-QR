/**
 * @file sessionRepo.js
 * @description Repository ultra-complet pour la gestion des sessions agents Secura.
 * Hérite de BaseRepository avec des fonctionnalités spécifiques aux sessions en temps réel.
 * @module repositories/sessionRepo
 * @requires ./baseRepo
 * @requires ../models/sessionModel
 * @requires ../utils/validation/sessionValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/helpers/dateHelper
 * @requires ../utils/helpers/stringHelper
 * @requires ../config/database
 * @requires ../utils/logger
 */

const BaseRepository = require('./baseRepo');
const Session = require('../models/sessionModel');
const {
  validateSession,
  validateCreateSession,
  validateJoinSession,
  validateSessionHeartbeat,
  validateLeaveSession,
  validateAgentPresence,
} = require('../utils/validation/sessionValidation');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errorHandler');
const { STATUS, ROLES } = require('../utils/constants');
const { generateShortId } = require('../utils/helpers/idGenerator');
const {
  now,
  addHours,
} = require('../utils/helpers/dateHelper');
const {
  maskEmail
} = require('../utils/helpers/stringHelper');
const log = require('../utils/logger');

/**
 * @class SessionRepository
 * @description Repository spécialisé pour la gestion des sessions agents
 * @extends BaseRepository
 */
class SessionRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('sessions', {
      enableCache: true,
      cacheTTL: 30, // 30 secondes pour les sessions (très volatile)
      enableAudit: true,
      softDelete: false, // Les sessions ne sont pas soft deleted
      validationRequired: true,
      maxRetries: 3,
      ...options
    });

    // Configuration spécifique aux sessions
    this.sessionConfig = {
      heartbeatInterval: 30000,
      inactivityTimeout: 45000,
      maxSessionDuration: 3600000,
      cleanupInterval: 60000, // Nettoyage toutes les minutes
      maxAgentsPerSession: 10,
      ...options.sessionConfig
    };

    this.logger = log.withContext({
      repository: 'SessionRepository',
      collection: 'sessions'
    });

    // Démarrer le nettoyage automatique
    this.startAutoCleanup();
  }

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée une nouvelle session avec validation complète
   * @param {Object} sessionData - Données de la session
   * @param {Object} options - Options de création
   * @returns {Promise<Session>} Session créée
   */
  async create(sessionData, options = {}) {
    const operation = log.trackOperation('SESSION_CREATE', {
      data: this.sanitizeSessionData(sessionData),
      options
    });

    try {
      // Validation des données
      const validation = validateCreateSession(sessionData);
      if (validation.error) {
        throw new ValidationError('Données session invalides', validation.error.details);
      }

      // Vérifier qu'il n'y a pas déjà une session active pour cet événement
      const existingSession = await this.findActiveSessionByEvent(sessionData.eventId);
      if (existingSession && options.force !== true) {
        throw new AppError(
          'Une session active existe déjà pour cet événement',
          409,
          'ACTIVE_SESSION_EXISTS'
        );
      }

      // Créer l'instance Session
      const session = new Session(sessionData);

      // Validation du modèle
      const modelValidation = session.validate();
      if (!modelValidation.valid) {
        throw new ValidationError('Modèle session invalide', modelValidation.errors);
      }

      // Sauvegarder via BaseRepository
      const result = await super.create(session, options);

      this.logger.crud('CREATE', 'sessions', {
        sessionId: session.id,
        eventId: session.eventId,
        eventName: session.eventName
      });

      return operation.success({ session: result });

    } catch (error) {
      return operation.error(error, {
        data: this.sanitizeSessionData(sessionData)
      });
    }
  }

  /**
   * @method findByEventId
   * @description Trouve une session par ID d'événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options de recherche
   * @returns {Promise<Session|null>} Session trouvée ou null
   */
  async findByEventId(eventId, options = {}) {
    const operation = log.trackOperation('SESSION_FIND_BY_EVENT', {
      eventId,
      options
    });

    try {
      const result = await this.findOne({ eventId }, options);

      return operation.success(result ? { session: result } : { session: null });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method findActiveSessionByEvent
   * @description Trouve la session active d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Session|null>} Session active ou null
   */
  async findActiveSessionByEvent(eventId) {
    const operation = log.trackOperation('SESSION_FIND_ACTIVE_BY_EVENT', {
      eventId
    });

    try {
      const result = await this.findOne({
        eventId,
        isActive: true,
        status: STATUS.ACTIVE
      });

      return operation.success(result ? { session: result } : { session: null });

    } catch (error) {
      return operation.error(error, { eventId });
    }
  }

  /**
   * @method findSessionsByAgent
   * @description Trouve les sessions d'un agent
   * @param {string} agentId - ID de l'agent
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Sessions trouvées
   */
  async findSessionsByAgent(agentId, options = {}) {
    const operation = log.trackOperation('SESSION_FIND_BY_AGENT', {
      agentId,
      options
    });

    try {
      // Recherche dans le tableau agents
      const result = await this.findAll({
        'agents.id': agentId
      }, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error, { agentId });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES AGENTS
  // ============================================================================

  /**
   * @method joinSession
   * @description Ajoute un agent à une session
   * @param {string} sessionId - ID de la session
   * @param {Object} agentData - Données de l'agent
   * @param {Object} options - Options de jointure
   * @returns {Promise<Object>} Résultat de la jointure
   */
  async joinSession(sessionId, agentData, options = {}) {
    const operation = log.trackOperation('SESSION_JOIN', {
      sessionId,
      agentData: this.sanitizeAgentData(agentData),
      options
    });

    try {
      // Validation des données de jointure
      const validation = validateJoinSession(agentData);
      if (validation.error) {
        throw new ValidationError('Données agent invalides', validation.error.details);
      }

      // Récupérer la session
      const session = await this.findById(sessionId, {
        throwIfNotFound: true,
        includeSensitive: true
      });

      // Vérifier que la session est active
      if (!session.isActive || session.status !== STATUS.ACTIVE) {
        throw new ForbiddenError('Session non active');
      }

      session.addAgent(agentData);

      // Sauvegarder les modifications
      const updatedSession = await super.update(sessionId, session, {
        ...options,
        reason: 'agent_join'
      });

      this.logger.info(`Agent ${agentData.id} a rejoint la session ${sessionId}`, {
        sessionId,
        agentId: agentData.id,
        eventId: session.eventId
      });

      return operation.success({
        session: updatedSession,
        agent: session.agents.find(a => a.id === agentData.id)
      });

    } catch (error) {
      return operation.error(error, {
        sessionId,
        agentData: this.sanitizeAgentData(agentData)
      });
    }
  }

  /**
   * @method leaveSession
   * @description Retire un agent d'une session
   * @param {string} sessionId - ID de la session
   * @param {string} agentId - ID de l'agent
   * @param {string} reason - Raison du départ
   * @param {Object} options - Options de sortie
   * @returns {Promise<Object>} Résultat de la sortie
   */
  async leaveSession(sessionId, agentId, reason = 'left', options = {}) {
    const operation = log.trackOperation('SESSION_LEAVE', {
      sessionId,
      agentId,
      reason,
      options
    });

    try {
      // Validation des données de sortie
      const validation = validateLeaveSession({ sessionId, agentId, reason });
      if (validation.error) {
        throw new ValidationError('Données de sortie invalides', validation.error.details);
      }

      // Récupérer la session
      const session = await this.findById(sessionId, {
        throwIfNotFound: true,
        includeSensitive: true
      });

      // Retirer l'agent de la session via le modèle
      const removedAgent = session.removeAgent(agentId, reason);

      if (!removedAgent) {
        throw new NotFoundError(`Agent ${agentId} non trouvé dans la session`);
      }

      // Sauvegarder les modifications
      const updatedSession = await super.update(sessionId, session, {
        ...options,
        reason: `agent_leave_${reason}`
      });

      this.logger.info(`Agent ${agentId} a quitté la session ${sessionId} (${reason})`, {
        sessionId,
        agentId,
        reason,
        eventId: session.eventId
      });

      return operation.success({
        session: updatedSession,
        removedAgent
      });

    } catch (error) {
      return operation.error(error, { sessionId, agentId, reason });
    }
  }

  /**
   * @method updateHeartbeat
   * @description Met à jour le heartbeat d'un agent
   * @param {string} sessionId - ID de la session
   * @param {string} agentId - ID de l'agent
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Object>} Résultat du heartbeat
   */
  async updateHeartbeat(sessionId, agentId, options = {}) {
    const operation = log.trackOperation('SESSION_HEARTBEAT', {
      sessionId,
      agentId,
      options
    });

    try {
      // Validation des données de heartbeat
      const validation = validateSessionHeartbeat({ sessionId, agentId });
      if (validation.error) {
        throw new ValidationError('Données heartbeat invalides', validation.error.details);
      }

      // Récupérer la session
      const session = await this.findById(sessionId, {
        throwIfNotFound: true,
        includeSensitive: true
      });

      // Mettre à jour le ping de l'agent via le modèle
      const updated = session.updateAgentPing(agentId);

      if (!updated) {
        throw new NotFoundError(`Agent ${agentId} non trouvé dans la session`);
      }

      // Sauvegarder les modifications
      const updatedSession = await super.update(sessionId, session, {
        ...options,
        reason: 'heartbeat'
      });

      return operation.success({
        session: updatedSession,
        lastPing: session.agents.find(a => a.id === agentId).lastPing
      });

    } catch (error) {
      return operation.error(error, { sessionId, agentId });
    }
  }

  /**
   * @method updateAgentPresence
   * @description Met à jour le statut de présence d'un agent
   * @param {string} sessionId - ID de la session
   * @param {string} agentId - ID de l'agent
   * @param {string} status - Nouveau statut
   * @param {Object} options - Options de mise à jour
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  async updateAgentPresence(sessionId, agentId, status, options = {}) {
    const operation = log.trackOperation('SESSION_AGENT_PRESENCE', {
      sessionId,
      agentId,
      status,
      options
    });

    try {
      // Validation des données de présence
      const validation = validateAgentPresence({ sessionId, agentId, status });
      if (validation.error) {
        throw new ValidationError('Données présence invalides', validation.error.details);
      }

      // Récupérer la session
      const session = await this.findById(sessionId, {
        throwIfNotFound: true,
        includeSensitive: true
      });

      // Trouver l'agent
      const agent = session.agents.find(a => a.id === agentId);
      if (!agent) {
        throw new NotFoundError(`Agent ${agentId} non trouvé dans la session`);
      }

      // Mettre à jour le statut
      agent.status = status;
      agent.lastPing = now().toISOString();
      session.updateActivity();

      // Sauvegarder les modifications
      const updatedSession = await super.update(sessionId, session, {
        ...options,
        reason: `presence_${status}`
      });

      this.logger.debug(`Statut présence mis à jour pour l'agent ${agentId}: ${status}`, {
        sessionId,
        agentId,
        status
      });

      return operation.success({
        session: updatedSession,
        agent
      });

    } catch (error) {
      return operation.error(error, { sessionId, agentId, status });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES SESSIONS
  // ============================================================================

  /**
   * @method startSession
   * @description Démarre une session
   * @param {string} sessionId - ID de la session
   * @param {Object} options - Options de démarrage
   * @returns {Promise<Session>} Session démarrée
   */
  async startSession(sessionId, options = {}) {
    const operation = log.trackOperation('SESSION_START', {
      sessionId,
      options
    });

    try {
      const session = await this.findById(sessionId, { throwIfNotFound: true });

      // Vérifier que la session n'est pas déjà active
      if (session.isActive) {
        throw new AppError('Session déjà active', 400, 'SESSION_ALREADY_ACTIVE');
      }

      // Redémarrer la session via le modèle
      session.restart();

      const result = await super.update(sessionId, session, {
        ...options,
        reason: 'session_start'
      });

      this.logger.crud('START', 'sessions', {
        sessionId,
        eventId: session.eventId
      });

      return operation.success({ session: result });

    } catch (error) {
      return operation.error(error, { sessionId });
    }
  }

  /**
   * @method endSession
   * @description Termine une session
   * @param {string} sessionId - ID de la session
   * @param {Object} options - Options de fin
   * @returns {Promise<Session>} Session terminée
   */
  async endSession(sessionId, options = {}) {
    const operation = log.trackOperation('SESSION_END', {
      sessionId,
      options
    });

    try {
      const session = await this.findById(sessionId, { throwIfNotFound: true });

      // Vérifier que la session est active
      if (!session.isActive) {
        throw new AppError('Session déjà terminée', 400, 'SESSION_ALREADY_ENDED');
      }

      // Terminer la session via le modèle
      session.end();

      const result = await super.update(sessionId, session, {
        ...options,
        reason: 'session_end'
      });

      this.logger.crud('END', 'sessions', {
        sessionId,
        eventId: session.eventId,
        duration: session.getDuration(),
        totalAgents: session.agentCount
      });

      return operation.success({ session: result });

    } catch (error) {
      return operation.error(error, { sessionId });
    }
  }

  /**
   * @method recordScan
   * @description Enregistre un scan dans les statistiques de session
   * @param {string} sessionId - ID de la session
   * @param {number} responseTime - Temps de réponse en ms
   * @param {Object} options - Options d'enregistrement
   * @returns {Promise<Object>} Statistiques mises à jour
   */
  async recordScan(sessionId, responseTime = 0, options = {}) {
    const operation = log.trackOperation('SESSION_RECORD_SCAN', {
      sessionId,
      responseTime,
      options
    });

    try {
      const session = await this.findById(sessionId, { throwIfNotFound: true });

      // Enregistrer le scan via le modèle
      session.recordScan(responseTime);

      const result = await super.update(sessionId, session, {
        ...options,
        reason: 'scan_recorded'
      });

      return operation.success({
        session: result,
        stats: result.stats
      });

    } catch (error) {
      return operation.error(error, { sessionId, responseTime });
    }
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE AVANCÉES
  // ============================================================================

  /**
   * @method searchSessions
   * @description Recherche avancée de sessions
   * @param {Object} criteria - Critères de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Résultats de recherche paginés
   */
  async searchSessions(criteria = {}, options = {}) {
    const operation = log.trackOperation('SESSION_SEARCH', {
      criteria: this.sanitizeSearchCriteria(criteria),
      options
    });

    try {
      const {
        eventId,
        status,
        isActive,
        dateFrom,
        dateTo,
        hasAgents,
        minAgents,
        maxAgents,
        ...otherFilters
      } = criteria;

      // Construire les filtres
      const filters = { ...otherFilters };

      // Filtre par événement
      if (eventId) {
        filters.eventId = eventId;
      }

      // Filtre par statut
      if (status) {
        filters.status = status;
      }

      // Filtre par activité
      if (isActive !== undefined) {
        filters.isActive = Boolean(isActive);
      }

      // Filtre par présence d'agents
      if (hasAgents !== undefined) {
        if (hasAgents) {
          filters.agentCount = { $gt: 0 };
        } else {
          filters.agentCount = 0;
        }
      }

      // Filtre par nombre d'agents
      if (minAgents !== undefined) {
        filters.agentCount = { ...filters.agentCount, $gte: minAgents };
      }
      if (maxAgents !== undefined) {
        filters.agentCount = { ...filters.agentCount, $lte: maxAgents };
      }

      // Filtre par date
      if (dateFrom || dateTo) {
        filters.createdAt = {};
        if (dateFrom) filters.createdAt.$gte = dateFrom;
        if (dateTo) filters.createdAt.$lte = dateTo;
      }

      const result = await this.findAll(filters, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error, {
        criteria: this.sanitizeSearchCriteria(criteria)
      });
    }
  }

  /**
   * @method getActiveSessions
   * @description Récupère toutes les sessions actives
   * @param {Object} options - Options de recherche
   * @returns {Promise<Object>} Sessions actives
   */
  async getActiveSessions(options = {}) {
    const operation = log.trackOperation('SESSION_GET_ACTIVE', {
      options
    });

    try {
      const result = await this.findAll({
        isActive: true,
        status: STATUS.ACTIVE
      }, options);

      return operation.success(result);

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method getSessionStats
   * @description Récupère les statistiques des sessions
   * @returns {Promise<Object>} Statistiques détaillées
   */
  async getSessionStats() {
    const operation = log.trackOperation('SESSION_STATS');

    try {
      const allSessions = await this.findAll({}, { paginate: false });

      const stats = {
        total: allSessions.data.length,
        byStatus: {},
        byActivity: {
          active: 0,
          inactive: 0
        },
        agents: {
          total: 0,
          averagePerSession: 0,
          peak: 0
        },
        scans: {
          total: 0,
          averagePerSession: 0
        },
        duration: {
          average: 0,
          total: 0
        }
      };

      let totalAgents = 0;
      let totalScans = 0;
      let totalDuration = 0;

      allSessions.data.forEach(session => {
        // Par statut
        stats.byStatus[session.status] = (stats.byStatus[session.status] || 0) + 1;

        // Par activité
        if (session.isActive) {
          stats.byActivity.active++;
        } else {
          stats.byActivity.inactive++;
        }

        // Agents
        totalAgents += session.agentCount;
        stats.agents.peak = Math.max(stats.agents.peak, session.stats?.peakAgents || 0);

        // Scans
        totalScans += session.stats?.totalScans || 0;

        // Durée
        const duration = session.getDuration ? session.getDuration() : 0;
        totalDuration += duration;
      });

      // Calculer les moyennes
      stats.agents.total = totalAgents;
      stats.agents.averagePerSession = stats.total > 0 ? totalAgents / stats.total : 0;
      
      stats.scans.total = totalScans;
      stats.scans.averagePerSession = stats.total > 0 ? totalScans / stats.total : 0;
      
      stats.duration.total = totalDuration;
      stats.duration.average = stats.total > 0 ? totalDuration / stats.total : 0;

      return operation.success({ stats });

    } catch (error) {
      return operation.error(error);
    }
  }

  // ============================================================================
  // MÉTHODES DE MAINTENANCE ET NETTOYAGE
  // ============================================================================

  /**
   * @method cleanupInactiveSessions
   * @description Nettoie les sessions inactives
   * @returns {Promise<Object>} Résultat du nettoyage
   */
  async cleanupInactiveSessions() {
    const operation = log.trackOperation('SESSION_CLEANUP');

    try {
      const nowISO = now().toISOString();
      const inactiveSessions = await this.findAll({
        isActive: true,
        lastActivity: { $lt: addHours(now(), -1).toISOString() } // 1 heure d'inactivité
      }, { paginate: false });

      let cleanedCount = 0;
      const results = [];

      for (const session of inactiveSessions.data) {
        try {
          // Terminer la session
          session.end();
          await super.update(session.id, session, {
            reason: 'auto_cleanup'
          });

          cleanedCount++;
          results.push({
            sessionId: session.id,
            eventId: session.eventId,
            duration: session.getDuration(),
            agents: session.agentCount
          });

        } catch (error) {
          this.logger.warning(`Échec nettoyage session ${session.id}`, {
            sessionId: session.id,
            error: error.message
          });
          results.push({
            sessionId: session.id,
            error: error.message
          });
        }
      }

      if (cleanedCount > 0) {
        this.logger.info(`${cleanedCount} sessions inactives nettoyées`, {
          cleanedCount,
          results
        });
      }

      return operation.success({
        cleaned: cleanedCount,
        total: inactiveSessions.data.length,
        results
      });

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method cleanupInactiveAgents
   * @description Nettoie les agents inactifs de toutes les sessions
   * @returns {Promise<Object>} Résultat du nettoyage
   */
  async cleanupInactiveAgents() {
    const operation = log.trackOperation('SESSION_CLEANUP_AGENTS');

    try {
      const activeSessions = await this.getActiveSessions({ paginate: false });
      let totalCleaned = 0;
      const results = [];

      for (const session of activeSessions.data) {
        try {
          // Nettoyer les agents inactifs via le modèle
          const cleanedCount = session.cleanupInactiveAgents();

          if (cleanedCount > 0) {
            await super.update(session.id, session, {
              reason: 'agent_cleanup'
            });

            totalCleaned += cleanedCount;
            results.push({
              sessionId: session.id,
              eventId: session.eventId,
              cleaned: cleanedCount
            });
          }

        } catch (error) {
          this.logger.warning(`Échec nettoyage agents session ${session.id}`, {
            sessionId: session.id,
            error: error.message
          });
        }
      }

      if (totalCleaned > 0) {
        this.logger.info(`${totalCleaned} agents inactifs nettoyés`, {
          totalCleaned,
          sessions: activeSessions.data.length
        });
      }

      return operation.success({
        totalCleaned,
        sessionsProcessed: activeSessions.data.length,
        results
      });

    } catch (error) {
      return operation.error(error);
    }
  }

  /**
   * @method startAutoCleanup
   * @description Démarre le nettoyage automatique
   */
  startAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupInactiveAgents();
        await this.cleanupInactiveSessions();
      } catch (error) {
        this.logger.error('Erreur nettoyage automatique sessions', {
          error: error.message
        });
      }
    }, this.sessionConfig.cleanupInterval);

    this.logger.info('Nettoyage automatique sessions démarré', {
      interval: this.sessionConfig.cleanupInterval
    });
  }

  // ============================================================================
  // MÉTHODES DE SANTÉ ET UTILITAIRES
  // ============================================================================

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository sessions
   * @returns {Promise<Object>} Statut de santé
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();

    try {
      const stats = await this.getSessionStats();
      const activeSessions = await this.getActiveSessions({ paginate: false });

      return {
        ...baseHealth,
        sessionSpecific: {
          totalSessions: stats.stats.total,
          activeSessions: activeSessions.data.length,
          totalAgents: stats.stats.agents.total,
          totalScans: stats.stats.scans.total
        },
        status: 'healthy'
      };

    } catch (error) {
      return {
        ...baseHealth,
        sessionSpecific: {
          error: error.message
        },
        status: 'degraded'
      };
    }
  }

  /**
   * @method getSessionInfo
   * @description Récupère les informations détaillées d'une session
   * @param {string} sessionId - ID de la session
   * @returns {Promise<Object>} Informations de session
   */
  async getSessionInfo(sessionId) {
    const operation = log.trackOperation('SESSION_GET_INFO', {
      sessionId
    });

    try {
      const session = await this.findById(sessionId, { throwIfNotFound: true });

      const info = session.getSessionInfo();
      info.activeAgents = session.getActiveAgents();
      info.needsCleanup = session.needsCleanup();
      info.duration = session.getDuration();

      return operation.success({ info });

    } catch (error) {
      return operation.error(error, { sessionId });
    }
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES ET HELPERS
  // ============================================================================

  /**
   * @method sanitizeSessionData
   * @description Nettoie les données de session pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeSessionData(data) {
    const sanitized = { ...data };

    if (sanitized.agents) {
      sanitized.agents = sanitized.agents.map(agent => this.sanitizeAgentData(agent));
    }

    return sanitized;
  }

  /**
   * @method sanitizeAgentData
   * @description Nettoie les données d'agent pour les logs
   * @param {Object} data - Données à nettoyer
   * @returns {Object} Données nettoyées
   */
  sanitizeAgentData(data) {
    const sanitized = { ...data };

    if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
    if (sanitized.connectionId) sanitized.connectionId = '***';

    return sanitized;
  }

  /**
   * @method sanitizeSearchCriteria
   * @description Nettoie les critères de recherche pour les logs
   * @param {Object} criteria - Critères à nettoyer
   * @returns {Object} Critères nettoyés
   */
  sanitizeSearchCriteria(criteria) {
    const sanitized = { ...criteria };
    return sanitized;
  }

  /**
   * @method validate
   * @description Valide les données d'une session
   * @param {Object} sessionData - Données à valider
   * @returns {Object} Résultat de validation
   */
  validate(sessionData) {
    return validateSession(sessionData);
  }

  /**
   * @method getUniqueFields
   * @description Retourne les champs avec contrainte d'unicité
   * @returns {string[]} Liste des champs uniques
   */
  getUniqueFields() {
    return []; 
  }

  /**
   * @method checkDependencies
   * @description Vérifie les dépendances avant suppression
   * @param {Object} session - Session à supprimer
   * @param {Object} dbData - Données complètes de la base
   * @returns {Promise<void>}
   */
  async checkDependencies(session, dbData) {
    // Vérifier s'il y a encore des agents actifs
    if (session.hasActiveAgents && session.hasActiveAgents()) {
      throw new AppError(
        'Impossible de supprimer une session avec des agents actifs',
        400,
        'SESSION_HAS_ACTIVE_AGENTS'
      );
    }
  }

  /**
   * @method shutdown
   * @description Arrête proprement le repository
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.logger.info('SessionRepository arrêté proprement');
  }
}

module.exports = SessionRepository;