/**
 * @file galleryRepo.js
 * @description Repository ultra-complet pour la gestion des galeries photos Secura.
 * Gère l'upload, modération, albums et statistiques des galeries d'événements.
 * @module repositories/galleryRepo
 * @requires ./baseRepo
 * @requires ../models/galleryModel
 * @requires ../utils/validation/galleryValidation
 * @requires ../utils/errorHandler
 * @requires ../utils/constants
 * @requires ../utils/helpers/idGenerator
 * @requires ../utils/logger
 * @requires ../utils/helpers/dateHelper
 */

const BaseRepository = require('./baseRepo');
const Gallery = require('../models/galleryModel');
const {
  validateGallery,
  validateCreateGallery,
  validateUpdateGallery,
  validatePhotoUpload,
  validatePhotoModeration,
  validatePhotoComment
} = require('../utils/validation/galleryValidation');
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} = require('../utils/errorHandler');
const { STATUS } = require('../utils/constants');
const {  generateShortId } = require('../utils/helpers/idGenerator');
const log = require('../utils/logger');

/**
 * @class GalleryRepository
 * @description Repository spécialisé pour la gestion des galeries photos
 * @extends BaseRepository
 */
class GalleryRepository extends BaseRepository {
  /**
   * @constructor
   * @param {Object} [options] - Options de configuration
   */
  constructor(options = {}) {
    super('galleries', {
      enableCache: true,
      cacheTTL: 300, // 5 minutes
      enableAudit: true,
      softDelete: false,
      validationRequired: true,
      maxRetries: 3,
      ...options
    });
    
    // Configuration spécifique aux galeries
    this.galleryConfig = {
      maxPhotosPerGallery: 1000,
      maxAlbumsPerGallery: 50,
      maxPhotoSizeMB: 8,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      autoApproveThreshold: 3, 
      maxPendingPhotos: 100,
      retentionDays: 365,
      ...options.galleryConfig
    };
    
    this.logger = log.withContext({
      repository: 'GalleryRepository',
      collection: 'galleries'
    });
    
    this.initialized = false;
    this.initialize();
  }

  // ============================================================================
  // MÉTHODES D'INITIALISATION
  // ============================================================================

  /**
   * @method initialize
   * @description Initialise le repository
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.waitForDatabase();
      this.initialized = true;
      
      await this.createIndexes();
      
      this.logger.info('GalleryRepository initialisé', {
        maxPhotosPerGallery: this.galleryConfig.maxPhotosPerGallery,
        maxPhotoSizeMB: this.galleryConfig.maxPhotoSizeMB
      });
    } catch (error) {
      this.logger.error('Erreur initialisation GalleryRepository', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * @method createIndexes
   * @description Crée les index spécifiques aux galeries
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      const indexes = [
        { field: 'eventId', type: 'hash' },
        { field: 'status', type: 'hash' },
        { field: 'isPublic', type: 'hash' },
        { field: 'metadata.category', type: 'hash' },
        { field: 'createdAt', type: 'range', descending: true },
        { field: 'photoCount', type: 'range' },
        { field: 'stats.totalLikes', type: 'range', descending: true }
      ];
      
      this.logger.debug('Index galeries créés', { indexes: indexes.length });
    } catch (error) {
      this.logger.warning('Erreur création index galeries', { error: error.message });
    }
  }

  // ============================================================================
  // MÉTHODES CRUD SPÉCIALISÉES
  // ============================================================================

  /**
   * @method create
   * @description Crée une nouvelle galerie
   * @param {Object} galleryData - Données de la galerie
   * @param {Object} options - Options
   * @returns {Promise<Gallery>} Galerie créée
   */
  async create(galleryData, options = {}) {
    const operation = log.trackOperation('GALLERY_CREATE', {
      data: this.sanitizeGalleryData(galleryData),
      options
    });
    
    try {
      // Validation
      const validation = validateCreateGallery(galleryData);
      if (validation.error) {
        throw new ValidationError(
          'Données galerie invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      // Vérifier qu'une galerie n'existe pas déjà pour l'événement
      const existing = await this.findOne({ 
        eventId: galleryData.eventId,
        status: STATUS.ACTIVE 
      });
      
      if (existing.found && !options.allowMultiple) {
        throw new ConflictError('Une galerie existe déjà pour cet événement');
      }
      
      // Créer l'instance
      const gallery = new Gallery(galleryData);
      
      // Appliquer les paramètres par défaut
      gallery.settings = {
        maxPhotos: this.galleryConfig.maxPhotosPerGallery,
        maxPhotoSize: this.galleryConfig.maxPhotoSizeMB * 1024 * 1024,
        allowedFormats: this.galleryConfig.allowedFormats,
        ...gallery.settings
      };
      
      // Sauvegarder via BaseRepo
      const result = await super.create(gallery.toJSON(), options);
      
      // Audit
      this.logger.crud('CREATE', 'galleries', {
        galleryId: gallery.id,
        eventId: gallery.eventId,
        name: gallery.name,
        isPublic: gallery.isPublic
      });
      
      // Invalider cache événement
      await this.invalidateEventCache(gallery.eventId);
      
      return operation.success({ gallery, saved: result.created });
    } catch (error) {
      return operation.error(error, {
        data: this.sanitizeGalleryData(galleryData)
      });
    }
  }

  /**
   * @method findById
   * @description Trouve une galerie par ID
   * @param {string} id - ID de la galerie
   * @param {Object} options - Options
   * @returns {Promise<Gallery|null>} Galerie trouvée
   */
  async findById(id, options = {}) {
    const result = await super.findById(id, options);
    
    if (!result.found) {
      return result;
    }
    
    const gallery = Gallery.fromJSON(result.found);
    
    return { 
      found: gallery, 
      fromCache: result.fromCache || false 
    };
  }

  /**
   * @method findAll
   * @description Trouve toutes les galeries
   * @param {Object} filters - Filtres
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultats
   */
  async findAll(filters = {}, options = {}) {
    const result = await super.findAll(filters, options);
    
    // Instancier les modèles
    result.data = result.data.map(galleryData => Gallery.fromJSON(galleryData));
    
    return result;
  }

  /**
   * @method update
   * @description Met à jour une galerie
   * @param {string} id - ID de la galerie
   * @param {Object} updates - Mises à jour
   * @param {Object} options - Options
   * @returns {Promise<Gallery>} Galerie mise à jour
   */
  async update(id, updates, options = {}) {
    const existing = await this.findById(id, { throwIfNotFound: true });
    const gallery = existing.found;
    
    // Validation
    const validation = validateUpdateGallery(updates);
    if (validation.error) {
      throw new ValidationError(
        'Mises à jour galerie invalides',
        validation.error.details.map(d => d.message)
      );
    }
    
    // Appliquer les mises à jour
    Object.assign(gallery, updates);
    gallery.updatedAt = new Date().toISOString();
    
    // Mettre à jour via BaseRepo
    const result = await super.update(id, gallery.toJSON(), options);
    
    // Invalider cache
    await this.invalidateCache(id);
    await this.invalidateEventCache(gallery.eventId);
    
    return { updated: gallery, ...result };
  }

  // ============================================================================
  // MÉTHODES DE RECHERCHE SPÉCIFIQUES
  // ============================================================================

  /**
   * @method findByEvent
   * @description Trouve les galeries d'un événement
   * @param {string} eventId - ID de l'événement
   * @param {Object} options - Options
   * @returns {Promise<Object>} Galeries trouvées
   */
  async findByEvent(eventId, options = {}) {
    const cacheKey = this.getCacheKey(`event:${eventId}:galleries`);
    
    if (this.options.enableCache && !options.forceRefresh) {
      const cached = await this.cacheManager?.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }
    
    const filters = { eventId };
    if (options.status) filters.status = options.status;
    if (options.isPublic !== undefined) filters.isPublic = options.isPublic;
    if (options.isActive !== undefined) filters.isActive = options.isActive;
    
    const result = await this.findAll(filters, options);
    
    if (this.options.enableCache) {
      await this.cacheManager?.set(cacheKey, result, { ttl: 300 });
    }
    
    return { ...result, fromCache: false };
  }

  /**
   * @method findPublicGalleries
   * @description Trouve les galeries publiques
   * @param {Object} filters - Filtres additionnels
   * @param {Object} options - Options
   * @returns {Promise<Object>} Galeries publiques
   */
  async findPublicGalleries(filters = {}, options = {}) {
    return this.findAll({ 
      ...filters, 
      isPublic: true,
      status: STATUS.ACTIVE,
      isActive: true 
    }, options);
  }

  /**
   * @method findFeaturedPhotos
   * @description Trouve les photos mises en avant
   * @param {string} galleryId - ID de la galerie
   * @param {number} limit - Limite
   * @returns {Promise<Array>} Photos mises en avant
   */
  async findFeaturedPhotos(galleryId, limit = 12) {
    const gallery = await this.findById(galleryId, { throwIfNotFound: true });
    
    return gallery.found.getFeaturedPhotos(limit);
  }

  /**
   * @method findApprovedPhotos
   * @description Trouve les photos approuvées d'une galerie
   * @param {string} galleryId - ID de la galerie
   * @param {Object} options - Options
   * @returns {Promise<Array>} Photos approuvées
   */
  async findApprovedPhotos(galleryId, options = {}) {
    const gallery = await this.findById(galleryId, { throwIfNotFound: true });
    
    let photos = gallery.found.getApprovedPhotos();
    
    // Appliquer des filtres
    if (options.sortBy === 'likes') {
      photos.sort((a, b) => b.likes - a.likes);
    } else if (options.sortBy === 'date') {
      photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    }
    
    // Pagination
    if (options.limit) {
      photos = photos.slice(0, options.limit);
    }
    
    return photos;
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES PHOTOS
  // ============================================================================

  /**
   * @method addPhoto
   * @description Ajoute une photo à une galerie
   * @param {string} galleryId - ID de la galerie
   * @param {Object} photoData - Données de la photo
   * @param {Object} options - Options
   * @returns {Promise<Object>} Photo ajoutée
   */
  async addPhoto(galleryId, photoData, options = {}) {
    const operation = log.trackOperation('GALLERY_ADD_PHOTO', {
      galleryId,
      photoData: this.sanitizePhotoData(photoData)
    });
    
    try {
      // Validation
      const validation = validatePhotoUpload(photoData);
      if (validation.error) {
        throw new ValidationError(
          'Données photo invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      // Vérifier la taille maximale
      const maxSize = gallery.found.settings.maxPhotoSize || this.galleryConfig.maxPhotoSizeMB * 1024 * 1024;
      if (photoData.size > maxSize) {
        throw new AppError(
          `Photo trop volumineuse (max: ${Math.round(maxSize / 1024 / 1024)}MB)`,
          400,
          'PHOTO_TOO_LARGE'
        );
      }
      
      // Vérifier le format
      const extension = this.getFileExtension(photoData.filename);
      const allowedFormats = gallery.found.settings.allowedFormats || this.galleryConfig.allowedFormats;
      if (!allowedFormats.includes(extension.toLowerCase())) {
        throw new AppError(
          `Format non supporté (formats acceptés: ${allowedFormats.join(', ')})`,
          400,
          'INVALID_FORMAT'
        );
      }
      
      // Vérifier limite de photos
      if (!gallery.found.canAddPhotos()) {
        throw new AppError(
          `Limite de photos atteinte (max: ${gallery.found.settings.maxPhotos})`,
          400,
          'GALLERY_FULL'
        );
      }
      
      // Ajouter la photo
      const photoId = `photo_${Date.now()}_${generateShortId()}`;
      const fullPhotoData = {
        id: photoId,
        ...photoData,
        metadata: {
          uploadedAt: new Date().toISOString(),
          ...photoData.metadata
        }
      };
      
      gallery.found.addPhoto(fullPhotoData);
      
      // Mettre à jour la galerie
      const result = await this.update(galleryId, gallery.found.toJSON(), {
        ...options,
        reason: 'photo_added'
      });
      
      this.logger.info('Photo ajoutée à galerie', {
        galleryId,
        photoId,
        uploadedBy: photoData.uploadedBy,
        size: photoData.size
      });
      
      return operation.success({
        photo: gallery.found.photos.find(p => p.id === photoId),
        gallery: result.updated
      });
    } catch (error) {
      return operation.error(error, { galleryId });
    }
  }

  /**
   * @method removePhoto
   * @description Retire une photo d'une galerie
   * @param {string} galleryId - ID de la galerie
   * @param {string} photoId - ID de la photo
   * @param {Object} options - Options
   * @returns {Promise<Object>} Photo retirée
   */
  async removePhoto(galleryId, photoId, options = {}) {
    const operation = log.trackOperation('GALLERY_REMOVE_PHOTO', {
      galleryId,
      photoId
    });
    
    try {
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      const removedPhoto = gallery.found.removePhoto(photoId);
      if (!removedPhoto) {
        throw new NotFoundError('Photo non trouvée dans la galerie');
      }
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        ...options,
        reason: 'photo_removed'
      });
      
      this.logger.info('Photo retirée de galerie', {
        galleryId,
        photoId,
        filename: removedPhoto.filename
      });
      
      return operation.success({ removedPhoto, gallery: gallery.found });
    } catch (error) {
      return operation.error(error, { galleryId, photoId });
    }
  }

  /**
   * @method approvePhoto
   * @description Approuve une photo en attente
   * @param {string} galleryId - ID de la galerie
   * @param {string} photoId - ID de la photo
   * @param {Object} moderationData - Données de modération
   * @returns {Promise<Object>} Photo approuvée
   */
  async approvePhoto(galleryId, photoId, moderationData = {}) {
    const operation = log.trackOperation('GALLERY_APPROVE_PHOTO', {
      galleryId,
      photoId,
      moderatorId: moderationData.moderatorId
    });
    
    try {
      // Validation
      const validation = validatePhotoModeration({
        photoId,
        action: 'approve',
        ...moderationData
      });
      if (validation.error) {
        throw new ValidationError(
          'Données modération invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      const approved = gallery.found.approvePhoto(photoId, moderationData.moderatorId);
      if (!approved) {
        throw new AppError('Photo non trouvée ou déjà approuvée', 400);
      }
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        reason: 'photo_approved',
        skipValidation: true
      });
      
      // Trouver la photo approuvée
      const photo = gallery.found.photos.find(p => p.id === photoId);
      
      this.logger.info('Photo approuvée', {
        galleryId,
        photoId,
        moderatorId: moderationData.moderatorId
      });
      
      return operation.success({ photo, gallery: gallery.found });
    } catch (error) {
      return operation.error(error, { galleryId, photoId });
    }
  }

  /**
   * @method rejectPhoto
   * @description Rejette une photo en attente
   * @param {string} galleryId - ID de la galerie
   * @param {string} photoId - ID de la photo
   * @param {Object} moderationData - Données de modération
   * @returns {Promise<Object>} Photo rejetée
   */
  async rejectPhoto(galleryId, photoId, moderationData = {}) {
    const operation = log.trackOperation('GALLERY_REJECT_PHOTO', {
      galleryId,
      photoId,
      moderatorId: moderationData.moderatorId,
      reason: moderationData.reason?.substring(0, 50)
    });
    
    try {
      // Validation
      const validation = validatePhotoModeration({
        photoId,
        action: 'reject',
        ...moderationData
      });
      if (validation.error) {
        throw new ValidationError(
          'Données modération invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      const rejected = gallery.found.rejectPhoto(
        photoId, 
        moderationData.moderatorId, 
        moderationData.reason
      );
      if (!rejected) {
        throw new AppError('Photo non trouvée ou déjà rejetée', 400);
      }
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        reason: 'photo_rejected',
        skipValidation: true
      });
      
      this.logger.info('Photo rejetée', {
        galleryId,
        photoId,
        moderatorId: moderationData.moderatorId,
        reason: moderationData.reason
      });
      
      return operation.success({ gallery: gallery.found });
    } catch (error) {
      return operation.error(error, { galleryId, photoId });
    }
  }

  // ============================================================================
  // MÉTHODES D'INTERACTION AVEC LES PHOTOS
  // ============================================================================

  /**
   * @method recordPhotoView
   * @description Enregistre une vue sur une photo
   * @param {string} galleryId - ID de la galerie
   * @param {string} photoId - ID de la photo
   * @returns {Promise<Object>} Photo mise à jour
   */
  async recordPhotoView(galleryId, photoId) {
    const operation = log.trackOperation('GALLERY_PHOTO_VIEW', {
      galleryId,
      photoId
    });
    
    try {
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      gallery.found.recordPhotoView(photoId);
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        reason: 'photo_view_recorded',
        skipValidation: true
      });
      
      return operation.success({ gallery: gallery.found });
    } catch (error) {
      return operation.error(error, { galleryId, photoId });
    }
  }

  /**
   * @method recordPhotoLike
   * @description Enregistre un like sur une photo
   * @param {string} galleryId - ID de la galerie
   * @param {string} photoId - ID de la photo
   * @returns {Promise<Object>} Photo mise à jour
   */
  async recordPhotoLike(galleryId, photoId) {
    const operation = log.trackOperation('GALLERY_PHOTO_LIKE', {
      galleryId,
      photoId
    });
    
    try {
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      const photo = gallery.found.photos.find(p => p.id === photoId);
      if (!photo || photo.status !== 'approved') {
        throw new AppError('Photo non trouvée ou non approuvée', 404);
      }
      
      photo.likes++;
      gallery.found.stats.totalLikes++;
      gallery.found.updatedAt = new Date().toISOString();
      
      // Approuver automatiquement si suffisamment de likes
      if (photo.status === 'pending' && photo.likes >= this.galleryConfig.autoApproveThreshold) {
        gallery.found.approvePhoto(photoId, 'system');
      }
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        reason: 'photo_like_recorded',
        skipValidation: true
      });
      
      return operation.success({ gallery: gallery.found, photo });
    } catch (error) {
      return operation.error(error, { galleryId, photoId });
    }
  }

  /**
   * @method addPhotoComment
   * @description Ajoute un commentaire à une photo
   * @param {string} galleryId - ID de la galerie
   * @param {string} photoId - ID de la photo
   * @param {Object} commentData - Données du commentaire
   * @returns {Promise<Object>} Commentaire ajouté
   */
  async addPhotoComment(galleryId, photoId, commentData) {
    const operation = log.trackOperation('GALLERY_ADD_COMMENT', {
      galleryId,
      photoId,
      author: commentData.author
    });
    
    try {
      // Validation
      const validation = validatePhotoComment({
        ...commentData,
        photoId
      });
      if (validation.error) {
        throw new ValidationError(
          'Données commentaire invalides',
          validation.error.details.map(d => d.message)
        );
      }
      
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      const added = gallery.found.addComment(photoId, commentData);
      if (!added) {
        throw new AppError('Impossible d\'ajouter le commentaire', 400);
      }
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        reason: 'comment_added',
        skipValidation: true
      });
      
      // Récupérer le nouveau commentaire
      const photo = gallery.found.photos.find(p => p.id === photoId);
      const comment = photo?.comments[photo.comments.length - 1];
      
      this.logger.info('Commentaire ajouté à photo', {
        galleryId,
        photoId,
        commentId: comment?.id
      });
      
      return operation.success({ gallery: gallery.found, comment });
    } catch (error) {
      return operation.error(error, { galleryId, photoId });
    }
  }

  // ============================================================================
  // MÉTHODES DE GESTION DES ALBUMS
  // ============================================================================

  /**
   * @method createAlbum
   * @description Crée un album dans une galerie
   * @param {string} galleryId - ID de la galerie
   * @param {Object} albumData - Données de l'album
   * @returns {Promise<Object>} Album créé
   */
  async createAlbum(galleryId, albumData) {
    const operation = log.trackOperation('GALLERY_CREATE_ALBUM', {
      galleryId,
      albumName: albumData.name
    });
    
    try {
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      // Vérifier limite d'albums
      if (gallery.found.albums.length >= this.galleryConfig.maxAlbumsPerGallery) {
        throw new AppError(
          `Limite d'albums atteinte (max: ${this.galleryConfig.maxAlbumsPerGallery})`,
          400,
          'ALBUM_LIMIT'
        );
      }
      
      const album = gallery.found.createAlbum(albumData);
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        reason: 'album_created',
        skipValidation: true
      });
      
      this.logger.info('Album créé', {
        galleryId,
        albumId: album.id,
        name: album.name
      });
      
      return operation.success({ album, gallery: gallery.found });
    } catch (error) {
      return operation.error(error, { galleryId });
    }
  }

  /**
   * @method addPhotoToAlbum
   * @description Ajoute une photo à un album
   * @param {string} galleryId - ID de la galerie
   * @param {string} albumId - ID de l'album
   * @param {string} photoId - ID de la photo
   * @returns {Promise<Object>} Album mis à jour
   */
  async addPhotoToAlbum(galleryId, albumId, photoId) {
    const operation = log.trackOperation('GALLERY_ADD_PHOTO_TO_ALBUM', {
      galleryId,
      albumId,
      photoId
    });
    
    try {
      const gallery = await this.findById(galleryId, { throwIfNotFound: true });
      
      const album = gallery.found.albums.find(a => a.id === albumId);
      if (!album) {
        throw new NotFoundError('Album non trouvé');
      }
      
      const photo = gallery.found.photos.find(p => p.id === photoId);
      if (!photo || photo.status !== 'approved') {
        throw new NotFoundError('Photo non trouvée ou non approuvée');
      }
      
      // Vérifier si la photo n'est pas déjà dans l'album
      if (album.photos.includes(photoId)) {
        throw new ConflictError('Photo déjà dans l\'album');
      }
      
      album.photos.push(photoId);
      album.updatedAt = new Date().toISOString();
      
      // Mettre à jour la galerie
      await this.update(galleryId, gallery.found.toJSON(), {
        reason: 'photo_added_to_album',
        skipValidation: true
      });
      
      return operation.success({ album, gallery: gallery.found });
    } catch (error) {
      return operation.error(error, { galleryId, albumId, photoId });
    }
  }

  // ============================================================================
  // MÉTHODES DE STATISTIQUES
  // ============================================================================

  /**
   * @method getGalleryStats
   * @description Récupère les statistiques d'une galerie
   * @param {string} galleryId - ID de la galerie
   * @returns {Promise<Object>} Statistiques
   */
  async getGalleryStats(galleryId) {
    const gallery = await this.findById(galleryId, { throwIfNotFound: true });
    
    const stats = {
      ...gallery.found.stats,
      photoCount: gallery.found.photoCount,
      albumCount: gallery.found.albums.length,
      pendingPhotos: gallery.found.moderation.pendingPhotos.length,
      approvedPhotos: gallery.found.moderation.approvedPhotos.length,
      rejectedPhotos: gallery.found.moderation.rejectedPhotos.length,
      mostLikedPhoto: this.getMostLikedPhoto(gallery.found),
      mostCommentedPhoto: this.getMostCommentedPhoto(gallery.found),
      recentPhotos: this.getRecentPhotos(gallery.found, 10)
    };
    
    return stats;
  }

  /**
   * @method getEventGalleryStats
   * @description Statistiques globales des galeries d'un événement
   * @param {string} eventId - ID de l'événement
   * @returns {Promise<Object>} Statistiques
   */
  async getEventGalleryStats(eventId) {
    const galleries = await this.findByEvent(eventId, { paginate: false });
    
    const stats = {
      totalGalleries: galleries.data.length,
      publicGalleries: galleries.data.filter(g => g.isPublic).length,
      totalPhotos: galleries.data.reduce((sum, g) => sum + g.photoCount, 0),
      totalViews: galleries.data.reduce((sum, g) => sum + g.stats.totalViews, 0),
      totalLikes: galleries.data.reduce((sum, g) => sum + g.stats.totalLikes, 0),
      totalComments: galleries.data.reduce((sum, g) => sum + g.stats.totalComments, 0),
      totalAlbums: galleries.data.reduce((sum, g) => sum + g.albums.length, 0),
      mostPopularGallery: this.getMostPopularGallery(galleries.data),
      recentGalleries: galleries.data
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5)
        .map(g => ({ id: g.id, name: g.name, photoCount: g.photoCount }))
    };
    
    return stats;
  }

  // ============================================================================
  // MÉTHODES UTILITAIRES
  // ============================================================================

  /**
   * @method getMostLikedPhoto
   * @description Récupère la photo la plus aimée
   * @param {Gallery} gallery - Galerie
   * @returns {Object|null} Photo la plus aimée
   */
  getMostLikedPhoto(gallery) {
    const approvedPhotos = gallery.getApprovedPhotos();
    if (approvedPhotos.length === 0) return null;
    
    return approvedPhotos.reduce((max, photo) => 
      photo.likes > max.likes ? photo : max
    );
  }

  /**
   * @method getMostCommentedPhoto
   * @description Récupère la photo la plus commentée
   * @param {Gallery} gallery - Galerie
   * @returns {Object|null} Photo la plus commentée
   */
  getMostCommentedPhoto(gallery) {
    const approvedPhotos = gallery.getApprovedPhotos();
    if (approvedPhotos.length === 0) return null;
    
    return approvedPhotos.reduce((max, photo) => 
      photo.comments.length > max.comments.length ? photo : max
    );
  }

  /**
   * @method getRecentPhotos
   * @description Récupère les photos récentes
   * @param {Gallery} gallery - Galerie
   * @param {number} limit - Limite
   * @returns {Array} Photos récentes
   */
  getRecentPhotos(gallery, limit = 10) {
    const approvedPhotos = gallery.getApprovedPhotos();
    return approvedPhotos
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, limit)
      .map(p => ({ id: p.id, filename: p.filename, uploadedAt: p.uploadedAt }));
  }

  /**
   * @method getMostPopularGallery
   * @description Récupère la galerie la plus populaire
   * @param {Array} galleries - Liste de galeries
   * @returns {Object|null} Galerie la plus populaire
   */
  getMostPopularGallery(galleries) {
    if (galleries.length === 0) return null;
    
    return galleries.reduce((max, gallery) => 
      gallery.stats.totalViews > max.stats.totalViews ? gallery : max
    );
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
   * @method invalidateEventCache
   * @description Invalide le cache pour un événement
   * @param {string} eventId - ID de l'événement
   */
  async invalidateEventCache(eventId) {
    if (!this.options.enableCache) return;
    
    const pattern = this.getCacheKey(`event:${eventId}:*`);
    await this.cacheManager?.deleteByPattern(pattern);
  }

  /**
   * @method sanitizeGalleryData
   * @description Nettoie les données de galerie pour les logs
   * @param {Object} data - Données
   * @returns {Object} Données nettoyées
   */
  sanitizeGalleryData(data) {
    const sanitized = { ...data };
    
    if (sanitized.photos) {
      sanitized.photos = `[${sanitized.photos.length} photos]`;
    }
    
    if (sanitized.description) {
      sanitized.description = sanitized.description.substring(0, 50) + '...';
    }
    
    return sanitized;
  }

  /**
   * @method sanitizePhotoData
   * @description Nettoie les données de photo pour les logs
   * @param {Object} data - Données
   * @returns {Object} Données nettoyées
   */
  sanitizePhotoData(data) {
    const sanitized = { ...data };
    
    if (sanitized.metadata) {
      sanitized.metadata = '***METADATA***';
    }
    
    if (sanitized.url) {
      sanitized.url = '***URL***';
    }
    
    return sanitized;
  }

  /**
   * @method healthCheck
   * @description Vérifie la santé du repository
   * @override
   * @returns {Promise<Object>} Statut
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    try {
      // Statistiques spécifiques
      const totalGalleries = await this.count();
      const publicGalleries = await this.count({ isPublic: true });
      
      return {
        ...baseHealth,
        gallerySpecific: {
          totalGalleries,
          publicGalleries,
          maxPhotosPerGallery: this.galleryConfig.maxPhotosPerGallery,
          maxPhotoSizeMB: this.galleryConfig.maxPhotoSizeMB,
          allowedFormats: this.galleryConfig.allowedFormats
        },
        status: baseHealth.status === 'healthy' ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        ...baseHealth,
        gallerySpecific: { error: error.message },
        status: 'degraded'
      };
    }
  }
}

module.exports = GalleryRepository;