/**
 * @file galleryModel.js
 * @description Modèle Galerie pour Secura avec validation complète.
 * Gère les galeries photos d'événements avec upload et partage.
 * @module models/galleryModel
 * @requires helpers/idGenerator
 * @requires utils/constants
 */

const { generateGalleryId } = require('../utils/helpers/idGenerator');
const { STATUS } = require('../utils/constants');

/**
 * @class Gallery
 * @description Classe représentant une galerie photo dans Secura.
 * Gère l'upload, l'organisation et le partage des photos d'événements.
 */
class Gallery {
  /**
   * @constructor
   * @param {Object} data - Données de la galerie
   * @param {string} data.eventId - ID de l'événement (requis)
   * @param {string} data.name - Nom de la galerie (requis)
   * @param {string} [data.description] - Description de la galerie
   * @param {Array} [data.photos=[]] - Liste des photos
   * @param {string} [data.status=STATUS.ACTIVE] - Statut de la galerie
   * @param {boolean} [data.isPublic=false] - Galerie publique
   * @param {Object} [data.settings] - Paramètres de la galerie
   * @param {string} [data.id] - ID unique
   * @param {Date} [data.createdAt] - Date de création
   * @param {Date} [data.updatedAt] - Date de modification
   */
  constructor(data = {}) {
    // Identifiants
    this.id = data.id || generateGalleryId();
    this.eventId = data.eventId || '';
    this.name = data.name ? data.name.trim() : '';
    this.description = data.description ? data.description.trim() : '';

    // Photos et contenu
    this.photos = data.photos || [];
    this.photoCount = this.photos.length;
    this.albums = data.albums || [];

    // Statut et visibilité
    this.status = data.status || STATUS.ACTIVE;
    this.isPublic = Boolean(data.isPublic);
    this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;

    // Paramètres
    this.settings = {
      maxPhotos: data.settings?.maxPhotos || 1000,
      maxPhotoSize: data.settings?.maxPhotoSize || 8 * 1024 * 1024, // 8MB
      allowedFormats: data.settings?.allowedFormats || ['jpg', 'jpeg', 'png', 'webp'],
      autoApprove: Boolean(data.settings?.autoApprove) || false,
      allowDownloads: data.settings?.allowDownloads !== false,
      allowComments: Boolean(data.settings?.allowComments) || true,
      moderationRequired: data.settings?.moderationRequired !== false,
      watermark: Boolean(data.settings?.watermark) || false,
      ...data.settings
    };

    // Statistiques
    this.stats = {
      totalViews: parseInt(data.stats?.totalViews) || 0,
      totalLikes: parseInt(data.stats?.totalLikes) || 0,
      totalDownloads: parseInt(data.stats?.totalDownloads) || 0,
      totalComments: parseInt(data.stats?.totalComments) || 0,
      ...data.stats
    };

    // Métadonnées
    this.metadata = {
      createdBy: data.metadata?.createdBy,
      coverPhoto: data.metadata?.coverPhoto,
      tags: data.metadata?.tags || [],
      category: data.metadata?.category || 'general',
      location: data.metadata?.location,
      ...data.metadata
    };

    // Modération
    this.moderation = {
      enabled: data.moderation?.enabled !== false,
      approvedPhotos: data.moderation?.approvedPhotos || [],
      pendingPhotos: data.moderation?.pendingPhotos || [],
      rejectedPhotos: data.moderation?.rejectedPhotos || [],
      ...data.moderation
    };

    // Timestamps
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * @method toJSON
   * @description Retourne une version JSON de la galerie
   * @returns {Object} Galerie formatée pour JSON
   */
  toJSON() {
    return {
      ...this,
      isActive: this.isActive,
      canAddPhotos: this.canAddPhotos(),
      publicUrl: this.getPublicUrl(),
      featuredPhotos: this.getFeaturedPhotos()
    };
  }

  /**
   * @method addPhoto
   * @description Ajoute une photo à la galerie
   * @param {Object} photoData - Données de la photo
   * @param {string} photoData.id - ID de la photo
   * @param {string} photoData.filename - Nom du fichier
   * @param {string} photoData.url - URL de la photo
   * @param {string} photoData.uploadedBy - Uploadé par
   * @param {number} photoData.size - Taille en octets
   * @param {Object} [photoData.metadata] - Métadonnées de la photo
   * @returns {boolean} True si ajouté avec succès
   * @throws {Error} Si galerie pleine ou photo invalide
   */
  addPhoto(photoData) {
    if (!this.canAddPhotos()) {
      throw new Error('Galerie pleine - impossible d\'ajouter plus de photos');
    }

    if (!this.isValidPhoto(photoData)) {
      throw new Error('Photo invalide - format ou taille non supporté');
    }

    const now = new Date().toISOString();
    const photo = {
      id: photoData.id,
      filename: photoData.filename,
      originalName: photoData.originalName || photoData.filename,
      url: photoData.url,
      thumbnailUrl: photoData.thumbnailUrl || photoData.url,
      previewUrl: photoData.previewUrl || photoData.url,
      uploadedBy: photoData.uploadedBy,
      uploadedAt: now,
      size: parseInt(photoData.size) || 0,
      dimensions: photoData.dimensions || null,
      format: photoData.format || this.getFileExtension(photoData.filename),
      
      // Métadonnées
      metadata: {
        title: photoData.metadata?.title || '',
        description: photoData.metadata?.description || '',
        tags: photoData.metadata?.tags || [],
        location: photoData.metadata?.location,
        takenAt: photoData.metadata?.takenAt,
        camera: photoData.metadata?.camera,
        ...photoData.metadata
      },

      // Statut
      status: this.settings.autoApprove ? 'approved' : 'pending',
      isPublic: this.isPublic,
      featured: Boolean(photoData.featured),

      // Engagement
      likes: 0,
      views: 0,
      downloads: 0,
      comments: [],

      // Modération
      moderated: this.settings.autoApprove,
      moderatedBy: this.settings.autoApprove ? 'system' : null,
      moderatedAt: this.settings.autoApprove ? now : null
    };

    this.photos.unshift(photo);
    this.photoCount = this.photos.length;

    // Gérer la modération
    if (photo.status === 'pending') {
      this.moderation.pendingPhotos.push(photo.id);
    } else if (photo.status === 'approved') {
      this.moderation.approvedPhotos.push(photo.id);
    }

    this.updateStats();
    return true;
  }

  /**
   * @method removePhoto
   * @description Retire une photo de la galerie
   * @param {string} photoId - ID de la photo
   * @returns {Object|null} Photo retirée ou null
   */
  removePhoto(photoId) {
    const photoIndex = this.photos.findIndex(photo => photo.id === photoId);
    
    if (photoIndex === -1) {
      return null;
    }

    const removedPhoto = this.photos.splice(photoIndex, 1)[0];
    this.photoCount = this.photos.length;

    // Retirer des listes de modération
    this.moderation.pendingPhotos = this.moderation.pendingPhotos.filter(id => id !== photoId);
    this.moderation.approvedPhotos = this.moderation.approvedPhotos.filter(id => id !== photoId);
    this.moderation.rejectedPhotos = this.moderation.rejectedPhotos.filter(id => id !== photoId);

    this.updateStats();
    return removedPhoto;
  }

  /**
   * @method approvePhoto
   * @description Approuve une photo en attente de modération
   * @param {string} photoId - ID de la photo
   * @param {string} moderatorId - ID du modérateur
   * @returns {boolean} True si approuvé
   */
  approvePhoto(photoId, moderatorId) {
    const photo = this.photos.find(p => p.id === photoId);
    if (!photo || photo.status !== 'pending') {
      return false;
    }

    photo.status = 'approved';
    photo.moderated = true;
    photo.moderatedBy = moderatorId;
    photo.moderatedAt = new Date().toISOString();

    // Mettre à jour les listes de modération
    this.moderation.pendingPhotos = this.moderation.pendingPhotos.filter(id => id !== photoId);
    this.moderation.approvedPhotos.push(photoId);

    this.updateStats();
    return true;
  }

  /**
   * @method rejectPhoto
   * @description Rejette une photo en attente de modération
   * @param {string} photoId - ID de la photo
   * @param {string} moderatorId - ID du modérateur
   * @param {string} reason - Raison du rejet
   * @returns {boolean} True si rejeté
   */
  rejectPhoto(photoId, moderatorId, reason = '') {
    const photo = this.photos.find(p => p.id === photoId);
    if (!photo || photo.status !== 'pending') {
      return false;
    }

    photo.status = 'rejected';
    photo.moderated = true;
    photo.moderatedBy = moderatorId;
    photo.moderatedAt = new Date().toISOString();
    photo.rejectionReason = reason;

    // Mettre à jour les listes de modération
    this.moderation.pendingPhotos = this.moderation.pendingPhotos.filter(id => id !== photoId);
    this.moderation.rejectedPhotos.push(photoId);

    this.updateStats();
    return true;
  }

  /**
   * @method canAddPhotos
   * @description Vérifie si on peut ajouter des photos
   * @returns {boolean} True si possible
   */
  canAddPhotos() {
    return this.photoCount < this.settings.maxPhotos;
  }

  /**
   * @method isValidPhoto
   * @description Vérifie si une photo est valide
   * @param {Object} photoData - Données de la photo
   * @returns {boolean} True si valide
   */
  isValidPhoto(photoData) {
    const extension = this.getFileExtension(photoData.filename).toLowerCase();
    const isValidFormat = this.settings.allowedFormats.includes(extension);
    const isValidSize = photoData.size <= this.settings.maxPhotoSize;

    return isValidFormat && isValidSize;
  }

  /**
   * @method getFileExtension
   * @description Extrait l'extension d'un fichier
   * @param {string} filename - Nom du fichier
   * @returns {string} Extension
   */
  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  /**
   * @method getPublicUrl
   * @description Retourne l'URL publique de la galerie
   * @returns {string} URL publique
   */
  getPublicUrl() {
    return this.isPublic ? `/gallery/${this.id}` : null;
  }

  /**
   * @method getFeaturedPhotos
   * @description Retourne les photos mises en avant
   * @param {number} limit - Nombre maximum de photos
   * @returns {Array} Photos mises en avant
   */
  getFeaturedPhotos(limit = 10) {
    return this.photos
      .filter(photo => photo.featured && photo.status === 'approved')
      .slice(0, limit);
  }

  /**
   * @method getApprovedPhotos
   * @description Retourne les photos approuvées
   * @returns {Array} Photos approuvées
   */
  getApprovedPhotos() {
    return this.photos.filter(photo => photo.status === 'approved');
  }

  /**
   * @method updateStats
   * @description Met à jour les statistiques de la galerie
   */
  updateStats() {
    const approvedPhotos = this.getApprovedPhotos();
    
    this.stats.totalLikes = approvedPhotos.reduce((sum, photo) => sum + photo.likes, 0);
    this.stats.totalViews = approvedPhotos.reduce((sum, photo) => sum + photo.views, 0);
    this.stats.totalDownloads = approvedPhotos.reduce((sum, photo) => sum + photo.downloads, 0);
    this.stats.totalComments = approvedPhotos.reduce((sum, photo) => sum + photo.comments.length, 0);

    this.updatedAt = new Date().toISOString();
  }

  /**
   * @method recordPhotoView
   * @description Enregistre une vue sur une photo
   * @param {string} photoId - ID de la photo
   */
  recordPhotoView(photoId) {
    const photo = this.photos.find(p => p.id === photoId);
    if (photo && photo.status === 'approved') {
      photo.views++;
      this.stats.totalViews++;
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * @method recordPhotoLike
   * @description Enregistre un like sur une photo
   * @param {string} photoId - ID de la photo
   */
  recordPhotoLike(photoId) {
    const photo = this.photos.find(p => p.id === photoId);
    if (photo && photo.status === 'approved') {
      photo.likes++;
      this.stats.totalLikes++;
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * @method addComment
   * @description Ajoute un commentaire à une photo
   * @param {string} photoId - ID de la photo
   * @param {Object} commentData - Données du commentaire
   * @returns {boolean} True si ajouté
   */
  addComment(photoId, commentData) {
    if (!this.settings.allowComments) {
      return false;
    }

    const photo = this.photos.find(p => p.id === photoId);
    if (!photo || photo.status !== 'approved') {
      return false;
    }

    const comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      author: commentData.author,
      authorId: commentData.authorId,
      content: commentData.content,
      postedAt: new Date().toISOString(),
      moderated: this.moderation.enabled ? false : true,
      likes: 0
    };

    photo.comments.push(comment);
    this.stats.totalComments++;
    this.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * @method createAlbum
   * @description Crée un album dans la galerie
   * @param {Object} albumData - Données de l'album
   * @returns {Object} Album créé
   */
  createAlbum(albumData) {
    const album = {
      id: `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: albumData.name,
      description: albumData.description || '',
      coverPhoto: albumData.coverPhoto || null,
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.albums.push(album);
    this.updatedAt = new Date().toISOString();
    return album;
  }

  /**
   * @method validate
   * @description Valide les données de la galerie
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.eventId) {
      errors.push('ID événement requis');
    }

    if (!this.name || this.name.length < 2) {
      errors.push('Nom de galerie requis (min 2 caractères)');
    }

    if (this.photoCount > this.settings.maxPhotos) {
      errors.push('Trop de photos dans la galerie');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * @static fromJSON
   * @description Crée une instance Gallery depuis JSON
   * @param {Object} json - Données JSON
   * @returns {Gallery} Instance Gallery
   */
  static fromJSON(json) {
    return new Gallery(json);
  }

  /**
   * @static createForEvent
   * @description Crée une galerie pour un événement
   * @param {string} eventId - ID de l'événement
   * @param {string} eventName - Nom de l'événement
   * @param {Object} settings - Paramètres de galerie
   * @returns {Gallery} Instance Gallery
   */
  static createForEvent(eventId, eventName, settings = {}) {
    return new Gallery({
      eventId,
      name: `Galerie - ${eventName}`,
      description: `Galerie photos de l'événement ${eventName}`,
      settings,
      metadata: {
        createdBy: 'system',
        category: 'event'
      }
    });
  }
}

module.exports = Gallery;