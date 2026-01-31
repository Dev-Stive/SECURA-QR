/**
 * @file sessionModel.js
 * @description Modèle Session pour Secura avec validation complète.
 * Gère les sessions d'agents en temps réel avec heartbeat et gestion de présence.
 * @module models/sessionModel
 * @requires helpers/idGenerator
 * @requires utils/constants
 */

const { generateSessionId } = require('../utils/helpers/idGenerator');
const { STATUS } = require('../utils/constants');

/**
 * @class Session
 * @description Classe représentant une session d'agent dans Secura.
 * Gère la présence des agents en temps réel avec système de heartbeat.
 */
class Session {
  /**
   * @constructor
   * @param {Object} data - Données de la session
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {string} data.eventName - Nom de l'événement
   * @param {Array} [data.agents=[]] - Liste des agents connectés
   * @param {string} [data.status=STATUS.ACTIVE] - Statut de la session
   * @param {number} [data.maxAgents=10] - Nombre max d'agents
   * @param {Object} [data.settings] - Paramètres de la session
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.createdAt] - Date de création
   * @param {Date} [data.updatedAt] - Date de modification
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateSessionId();
    this.eventId = data.eventId || '';
    this.eventName = data.eventName || '';

    // Agents et présence
    this.agents = data.agents || [];
    this.agentCount = this.agents.length;
    this.maxAgents = parseInt(data.maxAgents) || 10;

    // Statut et activité
    this.status = data.status || STATUS.ACTIVE;
    this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    this.lastActivity = data.lastActivity || new Date().toISOString();

    // Paramètres
    this.settings = {
      heartbeatInterval: data.settings?.heartbeatInterval || 30000,
      inactivityTimeout: data.settings?.inactivityTimeout || 45000,
      maxSessionDuration: data.settings?.maxSessionDuration || 3600000,
      allowMultipleDevices: Boolean(data.settings?.allowMultipleDevices) || false,
      autoCleanup: data.settings?.autoCleanup !== false,
      ...data.settings
    };

    // Statistiques
    this.stats = {
      totalConnections: parseInt(data.stats?.totalConnections) || 0,
      peakAgents: parseInt(data.stats?.peakAgents) || 0,
      totalScans: parseInt(data.stats?.totalScans) || 0,
      averageResponseTime: parseFloat(data.stats?.averageResponseTime) || 0,
      ...data.stats
    };

    this.metadata = {
      createdBy: data.metadata?.createdBy,
      location: data.metadata?.location,
      timezone: data.metadata?.timezone || 'Africa/Douala',
      version: data.metadata?.version || '1.0',
      ...data.metadata
    };

    // Historique
    this.connectionHistory = data.connectionHistory || [];
    this.activityLog = data.activityLog || [];

    // Timestamps
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.startedAt = data.startedAt || new Date().toISOString();
    this.endedAt = data.endedAt || null;
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON de la session
   * @returns {Object} Session formatée pour JSON
   */
  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
      hasActiveAgents: this.hasActiveAgents(),
      duration: this.getDuration(),
      needsCleanup: this.needsCleanup()
    };
  }

  /**
   * @method addAgent
   * @description Ajoute un agent à la session
   * @param {Object} agentData - Données de l'agent
   * @param {string} agentData.id - ID de l'agent
   * @param {string} agentData.name - Nom de l'agent
   * @param {string} agentData.email - Email de l'agent
   * @param {string} [agentData.avatar] - Avatar de l'agent
   * @returns {boolean} True si ajouté avec succès
   * @throws {Error} Si session pleine ou agent déjà présent
   */
  addAgent(agentData) {
    if (this.agents.length >= this.maxAgents) {
      throw new Error(`Session pleine - maximum ${this.maxAgents} agents autorisés`);
    }

    // Vérifier si l'agent est déjà présent
    if (!this.settings.allowMultipleDevices) {
      const existingAgent = this.agents.find(agent => agent.id === agentData.id);
      if (existingAgent) {
        throw new Error('Agent déjà connecté à cette session');
      }
    }

    const now = new Date().toISOString();
    const agent = {
      id: agentData.id,
      name: agentData.name || agentData.email.split('@')[0],
      email: agentData.email,
      firstName: agentData.firstName || null,
      lastName: agentData.lastName || null,
      avatar: agentData.avatar || null,
      status: 'active',
      joinedAt: now,
      lastPing: now,
      deviceInfo: agentData.deviceInfo || null,
      connectionId: agentData.connectionId || `${agentData.id}_${Date.now()}`
    };

    this.agents.push(agent);
    this.agentCount = this.agents.length;
    
    // Mettre à jour les statistiques
    this.stats.totalConnections++;
    this.stats.peakAgents = Math.max(this.stats.peakAgents, this.agentCount);

    // Ajouter à l'historique
    this.connectionHistory.unshift({
      agentId: agentData.id,
      action: 'joined',
      timestamp: now,
      connectionId: agent.connectionId
    });

    this.updateActivity();
    return true;
  }

  /**
   * @method removeAgent
   * @description Retire un agent de la session
   * @param {string} agentId - ID de l'agent
   * @param {string} [reason='left'] - Raison du départ
   * @returns {Object|null} Agent retiré ou null
   */
  removeAgent(agentId, reason = 'left') {
    const agentIndex = this.agents.findIndex(agent => agent.id === agentId);
    
    if (agentIndex === -1) {
      return null;
    }

    const removedAgent = this.agents.splice(agentIndex, 1)[0];
    this.agentCount = this.agents.length;

    // Ajouter à l'historique
    this.connectionHistory.unshift({
      agentId: agentId,
      action: reason,
      timestamp: new Date().toISOString(),
      connectionId: removedAgent.connectionId,
      duration: this.getAgentDuration(removedAgent)
    });

    this.updateActivity();

    // Si plus d'agents, terminer la session
    if (this.agents.length === 0) {
      this.end();
    }

    return removedAgent;
  }

  /**
   * @method updateAgentPing
   * @description Met à jour le heartbeat d'un agent
   * @param {string} agentId - ID de l'agent
   * @returns {boolean} True si mis à jour
   */
  updateAgentPing(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) {
      return false;
    }

    agent.lastPing = new Date().toISOString();
    agent.status = 'active';
    this.updateActivity();
    return true;
  }

  /**
   * @method cleanupInactiveAgents
   * @description Nettoie les agents inactifs
   * @returns {number} Nombre d'agents nettoyés
   */
  cleanupInactiveAgents() {
    const now = new Date();
    const timeoutMs = this.settings.inactivityTimeout;
    let cleanedCount = 0;

    this.agents = this.agents.filter(agent => {
      const lastPing = new Date(agent.lastPing);
      const isActive = (now - lastPing) <= timeoutMs;

      if (!isActive) {
        cleanedCount++;
        // Ajouter à l'historique
        this.connectionHistory.unshift({
          agentId: agent.id,
          action: 'timeout',
          timestamp: now.toISOString(),
          connectionId: agent.connectionId,
          duration: this.getAgentDuration(agent)
        });
      }

      return isActive;
    });

    this.agentCount = this.agents.length;
    
    if (cleanedCount > 0) {
      this.updateActivity();
    }

    return cleanedCount;
  }

  /**
   * @method getActiveAgents
   * @description Retourne la liste des agents actifs
   * @returns {Array} Agents actifs
   */
  getActiveAgents() {
    this.cleanupInactiveAgents();
    return this.agents.filter(agent => agent.status === 'active');
  }

  /**
   * @method hasActiveAgents
   * @description Vérifie s'il y a des agents actifs
   * @returns {boolean} True si agents actifs
   */
  hasActiveAgents() {
    return this.getActiveAgents().length > 0;
  }

  /**
   * @method getAgentDuration
   * @description Calcule la durée de présence d'un agent
   * @param {Object} agent - Agent
   * @returns {number} Durée en secondes
   */
  getAgentDuration(agent) {
    const joined = new Date(agent.joinedAt);
    const now = new Date();
    return Math.floor((now - joined) / 1000);
  }

  /**
   * @method getDuration
   * @description Calcule la durée totale de la session
   * @returns {number} Durée en secondes
   */
  getDuration() {
    const started = new Date(this.startedAt);
    const ended = this.endedAt ? new Date(this.endedAt) : new Date();
    return Math.floor((ended - started) / 1000);
  }

  /**
   * @method updateActivity
   * @description Met à jour l'activité de la session
   */
  updateActivity() {
    this.lastActivity = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method recordScan
   * @description Enregistre un scan dans les statistiques
   * @param {number} responseTime - Temps de réponse en ms
   */
  recordScan(responseTime = 0) {
    this.stats.totalScans++;
    
    // Mettre à jour le temps de réponse moyen
    const currentAvg = this.stats.averageResponseTime;
    const totalScans = this.stats.totalScans;
    this.stats.averageResponseTime = 
      ((currentAvg * (totalScans - 1)) + responseTime) / totalScans;

    this.updateActivity();
  }

  /**
   * @method needsCleanup
   * @description Vérifie si la session a besoin d'être nettoyée
   * @returns {boolean} True si besoin de nettoyage
   */
  needsCleanup() {
    if (!this.settings.autoCleanup) return false;
    
    const lastActivity = new Date(this.lastActivity);
    const now = new Date();
    return (now - lastActivity) > this.settings.inactivityTimeout;
  }

  /**
   * @method end
   * @description Termine la session
   */
  end() {
    this.status = STATUS.COMPLETED;
    this.isActive = false;
    this.endedAt = new Date().toISOString();
    this.updateActivity();
  }

  /**
   * @method restart
   * @description Redémarre la session
   */
  restart() {
    this.status = STATUS.ACTIVE;
    this.isActive = true;
    this.endedAt = null;
    this.updateActivity();
  }

  /**
   * @method getSessionInfo
   * @description Retourne les informations de la session
   * @returns {Object} Informations de session
   */
  getSessionInfo() {
    return {
      sessionId: this.id,
      eventId: this.eventId,
      eventName: this.eventName,
      agentCount: this.agentCount,
      activeAgents: this.getActiveAgents().length,
      status: this.status,
      isActive: this.isActive,
      duration: this.getDuration(),
      stats: this.stats
    };
  }

  /**
   * @method validate
   * @description Valide les données de la session
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.eventId) {
      errors.push('ID événement requis');
    }

    if (this.maxAgents < 1) {
      errors.push('Nombre maximum d\'agents invalide');
    }

    if (this.agents.length > this.maxAgents) {
      errors.push('Trop d\'agents dans la session');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * @static fromJSON
   * @description Crée une instance Session depuis JSON
   * @param {Object} json - Données JSON
   * @returns {Session} Instance Session
   */
  static fromJSON(json) {
    return new Session(json);
  }

  /**
   * @static createForEvent
   * @description Crée une session pour un événement
   * @param {string} eventId - ID de l'événement
   * @param {string} eventName - Nom de l'événement
   * @param {Object} settings - Paramètres de session
   * @returns {Session} Instance Session
   */
  static createForEvent(eventId, eventName, settings = {}) {
    return new Session({
      eventId,
      eventName,
      settings,
      metadata: {
        createdBy: 'system',
        version: '1.0'
      }
    });
  }
}

module.exports = Session;