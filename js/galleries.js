/**
 * SECURA Gallery Management System v3.0.0
 * Ultra-Complete Production-Ready Implementation
 * Full event-driven architecture with complete permission system
 * @author SECURA Team
 * @version 3.0.0
 * @description Complete gallery management with event handling, real-time updates, moderation, comments, likes
 */

// ============================================
// 1. GLOBAL STATE VARIABLES
// ============================================

let currentEvent = null;
let currentUser = null;
let eventsList = [];
let currentGallery = null;
let allGalleries = [];
let galleryPhotos = [];
let filteredGalleries = [];
let filteredPhotos = [];
let currentView = 'grid';
let currentFilter = 'all';
let currentPhotoFilter = 'all';
let currentSearch = '';
let currentGallerySearch = '';
let currentPage = 1;
let currentPhotoPage = 1;
let currentModerationIndex = 0;
let currentPhotoIndex = 0;
let currentCommentPage = 1;

const galleriesPerPage = 12;
const photosPerPage = 20;
const commentsPerPage = 10;

let eventsViewMode = 'grid';
let moderationPhotos = [];
let uploadedPhotos = [];
let galleryCoverFile = null;
let currentCreationStep = 1;
let allComments = {};
let allLikes = [];
let selectedPhotos = new Set();
let currentViewMode = 'events';
let galleryStatsChart = null;
let galleryDistributionChart = null;
let currentsession = null;

// Catégories de galeries avec métadonnées
const GALLERY_CATEGORIES = {
    'general': { label: 'Général', color: '#D97706', icon: 'fa-images' },
    'vip': { label: 'VIP', color: '#F59E0B', icon: 'fa-star' },
    'backstage': { label: 'Backstage', color: '#8B5CF6', icon: 'fa-door-open' },
    'official': { label: 'Officiel', color: '#3B82F6', icon: 'fa-camera' },
    'guest': { label: 'Invités', color: '#10B981', icon: 'fa-users' },
    'behind_scenes': { label: 'Coulisses', color: '#EC4899', icon: 'fa-film' }
};

// Images par défaut pour chaque catégorie
// Images par défaut basées sur la catégorie - Utilisé uniquement si pas de photo de couverture
const DEFAULT_CATEGORY_COLORS = {
    'general': '#6B7280',
    'vip': '#8B5CF6',
    'backstage': '#EC4899',
    'official': '#3B82F6',
    'guest': '#10B981',
    'behind_scenes': '#F59E0B'
};

// ============================================
// 🔐 INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    const authCheck = await checkAuth();
    if (!authCheck) return;
    
    // Vérifier l'URL pour les paramètres
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const galerieId = urlParams.get('galerieId');
    
    eventsList = await storage.getAllEvents();
    currentUser = await storage.getProfile();
    
    // Initialiser les écouteurs
    setupEventListeners();
    setupCustomEventListeners();
    
    if (eventId && galerieId) {
        // Charger la galerie spécifique avec ses photos
        document.getElementById('eventsHomeView').style.display = 'none';
        document.getElementById('galleriesView').style.display = 'none';
        document.getElementById('photosView').style.display = 'block';
        await selectEvent(eventId, galerieId);
    } else if (eventId) {
        // Charger les galeries de l'événement
        document.getElementById('eventsHomeView').style.display = 'none';
        document.getElementById('galleriesView').style.display = 'block';
        document.getElementById('photosView').style.display = 'none';
        await selectEvent(eventId);
    } else {
        // Afficher la sélection d'événement
        document.getElementById('eventsHomeView').style.display = 'block';
        document.getElementById('galleriesView').style.display = 'none';
        document.getElementById('photosView').style.display = 'none';
        await showEventsHome();
        document.getElementById('searchEvents')?.focus();
    }
});

// ============================================
// 🔐 AUTHENTIFICATION
// ============================================
async function checkAuth() {
    try {
        currentUser = await storage.getProfile();
        
        if (!currentUser) {
            window.location.href = '/';
            return false;
        }
        return true;
    } catch (error) {
        console.error('❌ Erreur vérification auth:', error);
        window.location.href = 'login.html';
        return false;
    }
}

// ============================================
// 🎪 GESTION DES ÉVÉNEMENTS
// ============================================
async function showEventsHome() {
    currentEvent = null;
    
    // Nettoyer les galeries et photos précédentes
    allGalleries = [];
    filteredGalleries = [];
    currentGallery = null;
    galleryPhotos = [];
    filteredPhotos = [];
    selectedPhotos.clear();
    moderationPhotos = [];
    uploadedPhotos = [];
    allComments = {};
    allLikes = [];
    currentPage = 1;
    currentPhotoPage = 1;
    currentModerationIndex = 0;
    currentPhotoIndex = 0;
    currentCommentPage = 1;
    currentView = 'grid';
    currentFilter = 'all';
    currentPhotoFilter = 'all';
    currentSearch = '';
    currentGallerySearch = '';
    galleryCoverFile = null;
    currentCreationStep = 1;
    
    // Nettoyer l'URL et revenir à la racine
    history.pushState({}, '', window.location.pathname);
    
    document.getElementById('eventsHomeView').style.display = 'block';
    document.getElementById('galleriesView').style.display = 'none';
    document.title = 'SECURA | Sélectionnez un événement';
    await loadEventsList();
}

async function loadEventsList() {
    try {
        eventsList = await storage.getAllEvents();
        currentUser = await storage.getProfile();
        
        if (currentUser.role !== 'admin') {
            eventsList = eventsList.filter(event => 
                event.organizerId === currentUser.id
            );
        }
    
        if (eventsList.length === 0) {
            document.getElementById('emptyEventsState').style.display = 'flex';
            document.getElementById('eventsGridView').style.display = 'none';
            document.getElementById('eventsTableView').style.display = 'none';
            return;
        }
        
        document.getElementById('emptyEventsState').style.display = 'none';
        renderEventsList();
        
    } catch (error) {
        console.error('Erreur chargement événements:', error);
        showToast('Impossible de charger la liste des événements', 'error');
    }
}

function renderEventsList() {
    if (eventsViewMode === 'grid') {
        renderEventsGrid();
    } else {
        renderEventsTable();
    }
}

function renderEventsGrid() {
    const grid = document.getElementById('eventsGridView');
    if (!grid) return;
    
    grid.innerHTML = '';
    grid.style.display = 'grid';
    document.getElementById('eventsTableView').style.display = 'none';
    
    eventsList.forEach(event => {
        const guests = storage.getGuestsByEventId(event.id);
        const galleries = storage.getGalleries(event.id);
        const eventDate = new Date(event.date);
        const isUpcoming = eventDate >= new Date();
        
        const card = document.createElement('div');
        card.className = 'event-card-pro';
        card.style.backgroundImage = `url('${getEventImage(event.type)}')`;
        card.style.borderLeft = `4px solid ${event.design?.primaryColor || '#D97706'}`;
        card.onclick = () => selectEvent(event.id);
        
        card.innerHTML = `
            ${isUpcoming ? '<div class="upcoming-ribbon">À VENIR</div>' : ''}
            
            <div class="event-type-badge" style="background: ${getTypeColor(event.type)}">
                ${getTypeLabel(event.type)}
            </div>

            <div class="event-content">
                <h3 class="event-title">${escapeHtml(event.name)}</h3>
                
                <div class="event-meta">
                    <div class="meta-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${eventDate.toLocaleDateString('fr-FR')}</span>
                    </div>
                    ${event.time ? `
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${event.time}</span>
                    </div>` : ''}
                    ${event.location ? `
                    <div class="meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(event.location)}</span>
                    </div>` : ''}
                </div>

                <div class="event-stats-circle">
                    <div class="stat-circle">
                        <div class="circle" style="border-color: ${event.design?.primaryColor || '#D97706'}20;">
                            <span class="value">${galleries?.length || 0}</span>
                            <span class="label">Gallerie</span>
                        </div>
                    </div>
                    <div class="stat-circle">
                        <div class="circle" style="border-color: #10B98120;">
                            <span class="value">${event.photosCount || 0}</span>
                            <span class="label">Photos</span>
                        </div>
                    </div>
                    <div class="stat-circle">
                        <div class="circle" style="border-color: #3B82F620;">
                            <span class="value">${event.likesCount || 0}</span>
                            <span class="label">Like</span>
                        </div>
                    </div>
                </div>

                <div class="event-footer">
                    <div class="event-status" style="background: ${event.active ? '#10B981' : '#EF4444'} !important; color: white">
                        <i class="fas ${event.active ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        <span>${event.active ? 'Actif' : 'Inactif'}</span>
                    </div>
                </div>
            </div>

            <div class="event-actions" onclick="event.stopPropagation()">
                <button class="action-btn view" onclick="viewEvent('${event.id}')" title="Voir invités">
                    <i class="fas fa-users"></i>
                </button>
                <button class="action-btn edit" onclick="editEvent('${event.id}')" title="Modifier">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="action-btn duplicate" onclick="duplicateEvent('${event.id}')" title="Dupliquer">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn stats" onclick="viewEventStats('${event.id}')" title="Statistiques">
                    <i class="fas fa-chart-bar"></i>
                </button>
                <button class="action-btn delete" onclick="deleteEvent('${event.id}')" title="Supprimer">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function renderEventsTable() {
    const table = document.getElementById('eventsTableBody');
    const grid = document.getElementById('eventsGridView');
    
    if (!table) return;
    
    grid.style.display = 'none';
    document.getElementById('eventsTableView').style.display = 'block';
    table.innerHTML = '';
    
    eventsList.forEach(event => {
        const galleries = storage.getGalleries(event.id);
        const eventDate = new Date(event.date);
        
        const row = document.createElement('tr');
        row.onclick = () => selectEvent(event.id);
        row.style.cursor = 'pointer';
        
        row.innerHTML = `
            <td>
                <div class="event-cell">
                    <div class="event-cell-icon">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div class="event-cell-info">
                        <div class="event-cell-name" title="${escapeHtml(event.name)}">
                            ${escapeHtml(event.name)}
                        </div>
                        <div class="event-cell-location" title="${event.location || 'Non spécifié'}">
                            ${escapeHtml(event.location || 'Non spécifié')}
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <div class="event-cell-date">
                    ${eventDate.toLocaleDateString('fr-FR')}
                </div>
            </td>
            <td>
                <div class="event-cell-type" style="background: ${getTypeColor(event.type)}">
                    ${getTypeLabel(event.type)}
                </div>
            </td>
            <td>
                <div class="event-cell-stats">
                    <div class="event-cell-stat">
                        <span class="event-cell-stat-number">${galleries?.length || 0}</span>
                        <span class="event-cell-stat-label">Galeries</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="event-cell-stats">
                    <div class="event-cell-stat">
                        <span class="event-cell-stat-number">${event.photosCount || 0}</span>
                        <span class="event-cell-stat-label">Photos</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="event-cell-stats">
                    <div class="event-cell-stat">
                        <span class="event-cell-stat-number">${event.likesCount || 0}</span>
                        <span class="event-cell-stat-label">Likes</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="event-cell-stats">
                    <div class="event-cell-stat">
                        <span class="event-cell-stat-number">${event.commentsCount || 0}</span>
                        <span class="event-cell-stat-label">Commentaires</span>
                    </div>
                </div>
            </td>
        `;
        
        table.appendChild(row);
    });
}

async function selectEvent(eventId, galerieId = null) {
    try {
        showLoading('galleriesLoader');
        
        // Vider complètement l'état précédent AVANT de charger les nouvelles données
        allGalleries = [];
        filteredGalleries = [];
        currentGallery = null;
        galleryPhotos = [];
        filteredPhotos = [];
        selectedPhotos.clear();
        moderationPhotos = [];
        uploadedPhotos = [];
        allComments = {};
        allLikes = [];
        currentPage = 1;
        currentPhotoPage = 1;
        currentModerationIndex = 0;
        currentPhotoIndex = 0;
        currentCommentPage = 1;
        currentView = 'grid';
        currentFilter = 'all';
        currentPhotoFilter = 'all';
        currentSearch = '';
        currentGallerySearch = '';
        galleryCoverFile = null;
        currentCreationStep = 1;
        
        // Vider les conteneurs DOM immédiatement
        const galleriesGrid = document.getElementById('galleriesGrid');
        const galleriesListContent = document.getElementById('galleriesListContent');
        const statsView = document.getElementById('statsView');
        const emptyState = document.getElementById('emptyStateGalleries');
        const emptyStateList = document.getElementById('emptyStateGalleriesList');
        
        if (galleriesGrid) galleriesGrid.innerHTML = '';
        if (galleriesListContent) galleriesListContent.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';
        if (emptyStateList) emptyStateList.style.display = 'none';
        
        // Récupérer l'événement via l'API
        const event = await storage.getEventById(eventId);
        if (!event) {
            throw new Error('Événement introuvable');
        }
        
        currentEvent = event;
        
        // Mettre à jour l'URL
        let newUrl;
        if (galerieId) {
            // Charger la galerie spécifique
            newUrl = `${window.location.pathname}?eventId=${eventId}&galerieId=${galerieId}`;
            history.pushState({eventId, galerieId}, '', newUrl);
            
            document.getElementById('eventsHomeView').style.display = 'none';
            document.getElementById('galleriesView').style.display = 'none';
            document.getElementById('photosView').style.display = 'block';
            
            await loadGalleryDetail(galerieId);
        } else {
            // Charger toutes les galeries de l'événement
            newUrl = `${window.location.pathname}?eventId=${eventId}`;
            history.pushState({eventId}, '', newUrl);
            
            document.getElementById('eventsHomeView').style.display = 'none';
            document.getElementById('galleriesView').style.display = 'block';
            document.getElementById('photosView').style.display = 'none';
            
            document.getElementById('eventNameDisplay').innerHTML = `
                <i class="fas fa-calendar-alt"></i>
                <span>${escapeHtml(currentEvent.name)}</span>
            `;
            
            await loadGalleries();
        }
        
        document.title = `SECURA | Galeries - ${currentEvent.name}`;
        
    } catch (error) {
        console.error('❌ Erreur sélection événement:', error);
        showToast('Erreur lors du chargement de l\'événement', 'error');
    } finally {
        hideLoading('galleriesLoader');
    }
}

// ============================================
// 🖼️ GESTION DES GALERIES
// ============================================
async function loadGalleries() {
    try {
        showLoading('galleriesLoader');
        
        // Sauvegarder la vue actuelle pour la restaurer après
        const previousView = currentView;
        
        // S'assurer que les anciennes galeries sont complètement vidées
        allGalleries = [];
        filteredGalleries = [];
        currentPage = 1;
        currentView = 'grid';
        currentFilter = 'all';
        currentSearch = '';
        
        // Vider les conteneurs DOM
        const galleriesGrid = document.getElementById('galleriesGrid');
        const galleriesListContent = document.getElementById('galleriesListContent');
        const statsView = document.getElementById('statsView');
        
        if (galleriesGrid) galleriesGrid.innerHTML = '';
        if (galleriesListContent) galleriesListContent.innerHTML = '';
        
        // Récupérer toutes les galeries via l'API (forceRefresh = true pour éviter le cache)
        const galleries = await storage.getGalleries(currentEvent.id, {}, true);
        allGalleries = galleries || [];
        
        // Enrichir chaque galerie avec les statistiques
        for (let gallery of allGalleries) {
            try {
                const stats = await storage.getGalleryStats(gallery.id);
                
                // Si les stats sont null et que c'était un 404, la galerie a été supprimée localement
                if (stats === null) {
                    console.log(`⚠️ Galerie ${gallery.id} non disponible - sera supprimée de la liste`);
                    gallery.deleted = true; // Marquer pour suppression
                    continue;
                }
                
                gallery.stats = stats;
                // Les stats proviennent du serveur avec ces champs exacts
                gallery.photoCount = gallery.photos?.length || 0;  // Compter les photos réellement
                gallery.likes = stats?.totalLikes || 0;
                gallery.comments = stats?.totalComments || 0;
                gallery.views = stats?.totalViews || 0;
                gallery.downloads = stats?.totalDownloads || 0;
                gallery.pendingPhotos = gallery.moderation?.pendingPhotos?.length || 0;
                
                // 🔑 Enrichir avec le nom du créateur
                if (gallery.createdBy && !gallery.createdByName) {
                    const creatorInfo = await storage.getUserById(gallery.createdBy);
                   
                    gallery.createdByName = `${creatorInfo.data.firstName + creatorInfo.data.lastName}`;
                    gallery.createdByAvatar = creatorInfo.avatar;
                }
            } catch (err) {
                console.warn('⚠️ Erreur stats galerie:', err);
                // Utiliser les valeurs par défaut si les stats échouent
                gallery.photoCount = gallery.photos?.length || 0;
                gallery.likes = 0;
                gallery.comments = 0;
                gallery.views = 0;
                gallery.downloads = 0;
            }
        }
        
        // Filtrer les galeries marquées pour suppression
        allGalleries = allGalleries.filter(g => !g.deleted);
        
        // Restaurer la vue précédente si elle est toujours valide
        currentView = previousView;
        
        updateStatistics();
        filterGalleries();
        
    } catch (error) {
        console.error('❌ Erreur chargement galeries:', error);
        allGalleries = [];
        updateStatistics();
        filterGalleries();
        showToast('Erreur lors du chargement des galeries', 'error');
    } finally {
        hideLoading('galleriesLoader');
    }
}

function filterGalleries() {
    filteredGalleries = [...allGalleries];
    
    // Appliquer le filtre
    if (currentFilter !== 'all') {
        filteredGalleries = filteredGalleries.filter(gallery => {
            switch (currentFilter) {
                case 'public':
                    return gallery.isPublic === true;
                case 'private':
                    return gallery.isPublic === false;
                case 'moderation':
                    return gallery.pendingPhotos > 0;
                default:
                    return true;
            }
        });
    }
    
    // Appliquer la recherche
    if (currentSearch) {
        const searchLower = currentSearch.toLowerCase();
        filteredGalleries = filteredGalleries.filter(gallery => 
            gallery.name.toLowerCase().includes(searchLower) ||
            (gallery.description && gallery.description.toLowerCase().includes(searchLower)) ||
            (gallery.metadata?.tags && gallery.metadata.tags.some(tag => 
                tag.toLowerCase().includes(searchLower)
            ))
        );
    }
    
    // Réinitialiser à la page 1 si on filtre
    currentPage = 1;
    
    // Mettre à jour le compteur
    const totalPages = Math.ceil(filteredGalleries.length / galleriesPerPage);
    document.getElementById('galleriesCount').textContent = filteredGalleries.length;
    document.getElementById('galleriesListCount').textContent = filteredGalleries.length;
    
    // Afficher les galeries selon la vue
    displayGalleries();
    updateGalleriesPagination();
    checkGalleriesEmptyState();
}

function displayGalleries() {
    switch(currentView) {
        case 'grid':
            renderGalleriesGrid();
            break;
        case 'list':
            renderGalleriesList();
            break;
        case 'stats':
            renderGalleryStats();
            break;
    }
}

async function renderGalleriesGrid() {
    const grid = document.getElementById('galleriesGrid');
    const emptyState = document.getElementById('emptyStateGalleries');
    
    if (!grid) return;
    
    const startIndex = (currentPage - 1) * galleriesPerPage;
    const endIndex = startIndex + galleriesPerPage;
    const galleriesToShow = filteredGalleries.slice(startIndex, endIndex);
    
    if (galleriesToShow.length === 0) {
        grid.innerHTML = '';
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
        return;
    }
    
    // Masquer le message vide
    if (emptyState) emptyState.style.display = 'none';
    
    grid.innerHTML = await Promise.all(galleriesToShow.map(async gallery => {
        const category = GALLERY_CATEGORIES[gallery.metadata?.category || 'general'];
        const stats = gallery.stats || {};
        const coverUrl = getGalleryImage(gallery);
        const photoCount = gallery.photos?.length || stats.totalPhotos || 0;
        const totalViews = stats.totalViews || 0;
        const totalLikes = stats.totalLikes || 0;
        const totalComments = stats.totalComments || 0;
        const totalDownloads = stats.totalDownloads || 0;
        const categoryColor = DEFAULT_CATEGORY_COLORS[gallery.metadata?.category || 'general'];
        
        // Calculer le score d'engagement
        const engagementScore = photoCount > 0 ? Math.round(((totalLikes + totalComments + totalDownloads) / (photoCount * 3)) * 100) : 0;
        const engagementColor = engagementScore > 70 ? '#10B981' : engagementScore > 40 ? '#F59E0B' : '#EF4444';
        
        // Construire le style de fond
        let backgroundStyle = '';
        if (coverUrl) {
            backgroundStyle = `background: linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%), url('${coverUrl}'); background-size: cover; background-position: center;`;
        } else {
            backgroundStyle = `background: linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}80 50%, ${categoryColor}40 100%);`;
        }
        
        // Tags HTML
        const tagsHTML = (gallery.metadata?.tags || []).slice(0, 3).map(tag => 
            `<span class="tag-badge">#${escapeHtml(tag)}</span>`
        ).join('');
        
        // Créateur
        const creatorName = gallery.createdByName || 'Anonyme';
        const creatorInitials = creatorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const userResponse = await storage.getUserById(gallery.createdBy);
        const user = userResponse?.data || userResponse;
        const avatar = getGuestAvatarImage(user);
        
        return `
            <div class="gallery-card" data-gallery-id="${gallery.id}" title="${escapeHtml(gallery.name)}" onclick="selectGallery('${gallery.id}'); event.stopPropagation();" style="cursor: pointer;">
                <!-- IMAGE DE COUVERTURE -->
                <div class="gallery-card-image" style="${backgroundStyle}">
                    <div class="gallery-overlay">
                        <div class="gallery-overlay-info">
                        <div class="gallery-title-overlay">
                            <h3 class="gallery-title-text">${escapeHtml(gallery.name)}</h3>
                            <p class="gallery-description">${escapeHtml(gallery.description || 'Aucune description')}</p>
                    
                        </div>
                            ${gallery.metadata?.location ? `<div class="gallery-overlay-meta">
                                <div class="gallery-overlay-meta-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>${escapeHtml(gallery.metadata.location)}</span>
                                </div>
                                <div class="gallery-overlay-meta-item">
                                    <i class="fas fa-camera"></i>
                                    <span>${photoCount} photos</span>
                                </div>
                            </div>` : `<div class="gallery-overlay-meta">
                                <div class="gallery-overlay-meta-item">
                                    <i class="fas fa-camera"></i>
                                    <span>${photoCount} photos</span>
                                </div>
                            </div>`}
                            <div class="gallery-overlay-meta-item">
                            <i class="fas fa-fire"></i>
                            <span>${engagementScore}% d'engagement</span>
                            </div>


                       
                        
                        </div>

                        
                       
                    </div>
                </div>
                
                <!-- HEADER AVEC BADGES -->
                <div class="gallery-card-header">
                    <div class="gallery-badges-top">
                        <span class="badge-pill ${gallery.isPublic ? 'badge-public' : 'badge-private'}">
                            <i class="fas ${gallery.isPublic ? 'fa-globe' : 'fa-lock'}"></i> ${gallery.isPublic ? 'Public' : 'Privée'}
                        </span>
                      
                        ${photoCount > 0 ? `
                        <span class="badge-pill" style="background: #3B82F6; color: white;">
                            <i class="fas fa-images"></i> ${photoCount}
                        </span>` : ''}
                    </div>
                    <button class="expand-btn" onclick="event.stopPropagation(); this.closest('.gallery-card').classList.toggle('expanded')" title="Développer">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>

               <div>
                
                <!-- TITRE DE LA CARTE - Visible par défaut -->
                <div class="gallery-card-title">
                    <h3>${escapeHtml(gallery.name)}</h3>
                    <p class="gallery-description">${escapeHtml(gallery.description || 'Aucune description')}</p>
                </div>
                
                
                <!-- STATS RAPIDES -->
                <div class="gallery-quick-stats">
                    <div class="quick-stat" title="Vues">
                        <i class="fas fa-eye"></i>
                        <span>${totalViews}</span>
                    </div>
                    <div class="quick-stat" title="Likes">
                        <i class="fas fa-heart"></i>
                        <span>${totalLikes}</span>
                    </div>
                    <div class="quick-stat" title="Commentaires">
                        <i class="fas fa-comment"></i>
                        <span>${totalComments}</span>
                    </div>
                    <div class="quick-stat" title="Téléchargements">
                        <i class="fas fa-download"></i>
                        <span>${totalDownloads}</span>
                    </div>
                </div>

                </div>
                
                <!-- CONTENU DÉVELOPPÉ -->
                <div class="gallery-card-content">
                    
                    <!-- TAGS -->
                    ${tagsHTML ? `<div class="gallery-tags">${tagsHTML}</div>` : ''}
                    
                    <!-- STATS DÉTAILLÉES -->
                    <div class="gallery-stats-detailed">
                        
                    <div class="quick-stat" title="Vues">
                        <i class="fas fa-eye"></i>
                        <span>${totalViews} vue</span>
                    </div>
                    <div class="quick-stat" title="Likes">
                        <i class="fas fa-heart"></i>
                        <span>${totalLikes} like</span>
                    </div>
                    <div class="quick-stat" title="Commentaires">
                        <i class="fas fa-comment"></i>
                        <span>${totalComments} commentaires</span>
                    </div>
                    <div class="quick-stat" title="Téléchargements">
                        <i class="fas fa-download"></i>
                        <span>${totalDownloads} téléchargements</span>
                    </div>
                            
                 
                    </div>
                    
                    <!-- MÉTADONNÉES -->
                    <div class="gallery-meta">
                        ${gallery.metadata?.location ? `
                        <div class="meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${escapeHtml(gallery.metadata.location)}</span>
                        </div>` : ''}
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(gallery.createdAt)}</span>
                        </div>
                    </div>
                    
                    <!-- CRÉATEUR -->
                    <div class="gallery-creator">
                        <div class="creator-avatar profile-avatar" style="background: url(${avatar});background-size: cover;">
                        </div>
                        <div class="creator-info">
                            <div class="creator-label">Créée par</div>
                            <div class="creator-name">${escapeHtml(creatorName)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- FOOTER AVEC ACTIONS -->
                <div class="gallery-card-footer">
                    <button class="btn btn-primary" onclick="selectGallery('${gallery.id}'); event.stopPropagation();">
                        <i class="fas fa-eye"></i> Voir
                    </button>
                    <div class="gallery-actions">
                        ${canModifyGallery(gallery) ? `
                            <button class="action-btn edit" onclick="editGallery('${gallery.id}'); event.stopPropagation();" title="Modifier">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteGallery('${gallery.id}'); event.stopPropagation();" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }));
    
    // Ajouter les event listeners pour l'expansion des cartes
    addGalleryCardListeners();
}

function addGalleryCardListeners() {
    const grid = document.getElementById('galleriesGrid');
    if (!grid) return;
    
    // Event delegation pour le bouton expand seulement
    grid.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('.expand-btn');
        if (!expandBtn) return;
        
        e.stopPropagation();
        const card = expandBtn.closest('.gallery-card');
        
        // Fermer les autres cartes
        document.querySelectorAll('.gallery-card.expanded').forEach(c => {
            if (c !== card) c.classList.remove('expanded');
        });
        
        // Toggler la carte
        card.classList.toggle('expanded');
    });
}

function renderGalleriesList() {
    const listContainer = document.getElementById('galleriesListContent');
    
    if (!listContainer) return;
    
    const startIndex = (currentPage - 1) * galleriesPerPage;
    const endIndex = startIndex + galleriesPerPage;
    const galleriesToShow = filteredGalleries.slice(startIndex, endIndex);
    
    let listHTML = '';
    
    if (galleriesToShow.length === 0) {
        listContainer.innerHTML = '';
        return;
    }
    
    listHTML = `<div class="galleries-list-container">`;
    
    galleriesToShow.forEach((gallery, index) => {
        const stats = gallery.stats || {};
        const photoCount = gallery.photos?.length || stats.totalPhotos || 0;
        const totalViews = stats.totalViews || 0;
        const totalLikes = stats.totalLikes || 0;
        const totalComments = stats.totalComments || 0;
        const totalDownloads = stats.totalDownloads || 0;
        const pendingPhotos = gallery.moderation?.pendingPhotos?.length || 0;
        const coverUrl = getGalleryImage(gallery);
        const category = GALLERY_CATEGORIES[gallery.metadata?.category || 'general'];
        
        // Style de fond avec image
        let imageStyle = '';
        if (coverUrl) {
            imageStyle = `background: linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%), url('${coverUrl}'); background-size: cover; background-position: center;`;
        } else {
            imageStyle = `background: linear-gradient(135deg, ${DEFAULT_CATEGORY_COLORS[gallery.metadata?.category || 'general']} 0%, ${DEFAULT_CATEGORY_COLORS[gallery.metadata?.category || 'general']}80 50%, ${DEFAULT_CATEGORY_COLORS[gallery.metadata?.category || 'general']}40 100%);`;
        }
        
        listHTML += `
            <div class="gallery-list-item" data-gallery-id="${gallery.id}">
                <div class="gallery-list-header">
                    <div class="expand-toggle">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                    
                    <div class="gallery-list-cover">
                        <div class="cover-thumb" style="${imageStyle}">
                            ${!coverUrl ? `<i class="fas fa-image"></i>` : ''}
                        </div>
                    </div>
                    
                    <div class="gallery-list-main">
                        <div class="gallery-title">
                            <strong>${escapeHtml(gallery.name)}</strong>
                            <span class="category-badge" style="background: ${category.color}; color: white;">
                                <i class="fas ${category.icon}"></i> ${category.label}
                            </span>
                        </div>
                        <div class="gallery-subtitle">${escapeHtml((gallery.description || '').substring(0, 80))}${(gallery.description || '').length > 80 ? '...' : ''}</div>
                        ${gallery.metadata?.location ? `<div class="gallery-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(gallery.metadata.location)}</div>` : ''}
                    </div>
                    
                    <div class="gallery-quick-stats">
                        <div class="quick-stat">
                            <span class="quick-stat-value">${photoCount}</span>
                            <span class="quick-stat-label">
                                <i class="fas fa-images"></i>
                            </span>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-value">${totalViews}</span>
                            <span class="quick-stat-label">
                                <i class="fas fa-eye"></i>
                            </span>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-value">${totalLikes}</span>
                            <span class="quick-stat-label">
                                <i class="fas fa-heart"></i>
                            </span>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-value">${totalComments}</span>
                            <span class="quick-stat-label">
                                <i class="fas fa-comment"></i>
                            </span>
                        </div>
                    </div>
                    
                    <div class="gallery-visibility">
                        <span class="badge ${gallery.isPublic ? 'badge-success' : 'badge-secondary'}">
                            <i class="fas ${gallery.isPublic ? 'fa-globe' : 'fa-lock'}"></i>
                             <span>${gallery.isPublic ? ' public' : 'private'}</span>
                        </span>
                    </div>
                    
                    <div class="gallery-inline-actions">
                        <button class="action-btn edit" onclick="event.stopPropagation(); editGallery('${gallery.id}')" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${canModifyGallery(gallery) ? `
                            <button class="action-btn delete" onclick="event.stopPropagation(); deleteGallery('${gallery.id}')" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="gallery-list-expand" style="display: none;">
                    <div class="expand-content">
                        <div class="stats-grid">
                            <div class="stat-item">
                                <i class="fas fa-images"></i>
                                <span>${photoCount}</span>
                                <small>Photos</small>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-eye"></i>
                                <span>${totalViews}</span>
                                <small>Vues</small>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-heart"></i>
                                <span>${totalLikes}</span>
                                <small>Likes</small>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-comment"></i>
                                <span>${totalComments}</span>
                                <small>Commentaires</small>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-download"></i>
                                <span>${totalDownloads}</span>
                                <small>Téléchargements</small>
                            </div>
                            ${pendingPhotos > 0 ? `
                                <div class="stat-item alert">
                                    <i class="fas fa-hourglass-half"></i>
                                    <span>${pendingPhotos}</span>
                                    <small>En attente</small>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="info-grid">
                            <div class="info-item">
                                <i class="fas fa-calendar"></i>
                                <div>
                                    <span class="info-label">Créée le</span>
                                    <span class="info-value">${formatDate(gallery.createdAt)}</span>
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-sync"></i>
                                <div>
                                    <span class="info-label">Modifiée le</span>
                                    <span class="info-value">${formatDate(gallery.updatedAt)}</span>
                                </div>
                            </div>
                            <div class="info-item">
                                <i class="fas ${gallery.isPublic ? 'fa-globe' : 'fa-lock'}"></i>
                                <div>
                                    <span class="info-label">Visibilité</span>
                                    <span class="info-value">${gallery.isPublic ? 'Public' : 'Privé'}</span>
                                </div>
                            </div>
                            ${gallery.metadata?.location ? `
                                <div class="info-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <div>
                                        <span class="info-label">Localisation</span>
                                        <span class="info-value">${escapeHtml(gallery.metadata.location)}</span>
                                    </div>
                                </div>
                            ` : ''}
                            <div class="info-item">
                                <i class="fas fa-user"></i>
                                <div>
                                    <span class="info-label">Créée par</span>
                                    <span class="info-value">${gallery.createdByName || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="expand-actions">
                        <button class="action-btn view" onclick="event.stopPropagation(); selectGallery('${gallery.id}')" title="Voir la galerie">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="event.stopPropagation(); editGallery('${gallery.id}')" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${canModifyGallery(gallery) ? `
                            <button class="action-btn delete" onclick="event.stopPropagation(); deleteGallery('${gallery.id}')" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    listHTML += `</div>`;
    
    listContainer.innerHTML = listHTML;
    
    // Ajouter les event listeners pour les expands
    addGalleryListItemListeners();
}

function addGalleryListItemListeners() {
    document.querySelectorAll('.gallery-list-item').forEach(item => {
        const header = item.querySelector('.gallery-list-header');
        const expandContent = item.querySelector('.gallery-list-expand');
        const expandToggle = item.querySelector('.expand-toggle i');
        
        header.addEventListener('click', () => {
            const isExpanded = expandContent.style.display !== 'none';
            
            // Fermer tous les autres items
            document.querySelectorAll('.gallery-list-item').forEach(other => {
                if (other !== item) {
                    other.querySelector('.gallery-list-expand').style.display = 'none';
                    other.querySelector('.expand-toggle i').style.transform = 'rotate(0deg)';
                    other.classList.remove('expanded');
                }
            });
            
            // Toggler celui-ci
            if (isExpanded) {
                expandContent.style.display = 'none';
                expandToggle.style.transform = 'rotate(0deg)';
                item.classList.remove('expanded');
            } else {
                expandContent.style.display = 'flex';
                expandToggle.style.transform = 'rotate(90deg)';
                item.classList.add('expanded');
            }
        });
    });
}

function renderGalleryStats() {
    // Mettre à jour les statistiques globales
    updateStatistics();
    
    // Rendre les graphiques si Chart.js est disponible
    if (typeof Chart !== 'undefined') {
        renderGalleryCharts();
    }
}

/**
 * Affiche les statistiques complètes des photos de la galerie actuelle
 */
function renderPhotosStats() {
    try {
        updatePhotosStatistics();
        
        // Rendre les graphiques si Chart.js est disponible
        if (typeof Chart !== 'undefined') {
            renderPhotosCharts();
        }
    } catch (error) {
        console.error('❌ Erreur affichage stats photos:', error);
    }
}

function renderPhotosCharts() {
    const noDataHtml = '<div style="display:flex;align-items:center;justify-content:center;height:300px;flex-direction:column;color:var(--text-muted);"><i class="fas fa-inbox" style="font-size:2.5rem;opacity:0.5;margin-bottom:10px;"></i><p>Pas de données à évaluer pour l\'instant</p></div>';
    
    if (!galleryPhotos || galleryPhotos.length === 0) {
        ['photosEngagementChart', 'photosLikesTrendChart', 'photosStatusChart', 'photosPerformanceChart'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = noDataHtml;
        });
        return;
    }
    
    // 1. Distribution des Engagements (Likes/Commentaires/Vues)
    const engagements = galleryPhotos.map(p => ({
        name: `Photo ${p.id.substring(0, 8)}`,
        likes: p.stats?.likes || 0,
        comments: p.stats?.comments || 0,
        views: p.stats?.views || 0
    })).slice(0, 10);
    
    const ctx1 = document.getElementById('photosEngagementChart');
    if (ctx1) {
        const canvas = ctx1.querySelector('canvas');
        if (canvas) canvas.remove();
        new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: engagements.map(e => e.name),
                datasets: [
                    { label: 'Likes', data: engagements.map(e => e.likes), backgroundColor: '#EC4899' },
                    { label: 'Commentaires', data: engagements.map(e => e.comments), backgroundColor: '#3B82F6' },
                    { label: 'Vues', data: engagements.map(e => e.views), backgroundColor: '#10B981' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: true, scales: { x: { beginAtZero: true } } }
        });
    }
    
    // 2. Trend des Likes
    const likeTrend = galleryPhotos.map(p => p.stats?.likes || 0);
    const ctx2 = document.getElementById('photosLikesTrendChart');
    if (ctx2) {
        const canvas = ctx2.querySelector('canvas');
        if (canvas) canvas.remove();
        new Chart(ctx2, {
            type: 'line',
            data: {
                labels: galleryPhotos.map((_, i) => `Photo ${i + 1}`).slice(0, 10),
                datasets: [{
                    label: 'Likes',
                    data: likeTrend.slice(0, 10),
                    borderColor: '#EC4899',
                    backgroundColor: 'rgba(236,72,153,0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#EC4899',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } }
        });
    }
    
    // 3. État des Photos (approved/pending/rejected)
    const photoStatus = {
        approved: galleryPhotos.filter(p => p.status === 'approved').length,
        pending: galleryPhotos.filter(p => p.status === 'pending').length,
        rejected: galleryPhotos.filter(p => p.status === 'rejected').length
    };
    const ctx3 = document.getElementById('photosStatusChart');
    if (ctx3) {
        const canvas = ctx3.querySelector('canvas');
        if (canvas) canvas.remove();
        new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: ['Approuvées', 'En attente', 'Rejetées'],
                datasets: [{
                    data: [photoStatus.approved, photoStatus.pending, photoStatus.rejected],
                    backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    // 4. Performance des Photos (Likes vs Commentaires vs Vues)
    const totalLikes = galleryPhotos.reduce((sum, p) => sum + (p.stats?.likes || 0), 0);
    const totalComments = galleryPhotos.reduce((sum, p) => sum + (p.stats?.comments || 0), 0);
    const totalViews = galleryPhotos.reduce((sum, p) => sum + (p.stats?.views || 0), 0);
    
    const ctx4 = document.getElementById('photosPerformanceChart');
    if (ctx4) {
        const canvas = ctx4.querySelector('canvas');
        if (canvas) canvas.remove();
        new Chart(ctx4, {
            type: 'bar',
            data: {
                labels: ['Likes', 'Commentaires', 'Vues'],
                datasets: [{
                    label: 'Total',
                    data: [totalLikes, totalComments, totalViews],
                    backgroundColor: ['#EC4899', '#3B82F6', '#10B981']
                }]
            },
            options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } }
        });
    }
}

function updatePhotosStatistics() {
    if (!galleryPhotos || galleryPhotos.length === 0) {
        ['photoMostLiked', 'photoMostCommented', 'photoAvgEngagement', 'photosPendingReview', 'photoKpiLikesPerDay', 'photoKpiCommentsPerDay', 'photoKpiAvgViews'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
        return;
    }
    
    // Trouver les photos avec le plus de likes et commentaires
    let maxLikes = 0;
    let maxComments = 0;
    galleryPhotos.forEach(p => {
        const likes = p.stats?.likes || 0;
        const comments = p.stats?.comments || 0;
        if (likes > maxLikes) maxLikes = likes;
        if (comments > maxComments) maxComments = comments;
    });
    
    // Calculer l'engagement moyen
    const totalLikes = galleryPhotos.reduce((sum, p) => sum + (p.stats?.likes || 0), 0);
    const totalComments = galleryPhotos.reduce((sum, p) => sum + (p.stats?.comments || 0), 0);
    const totalViews = galleryPhotos.reduce((sum, p) => sum + (p.stats?.views || 0), 0);
    const avgEngagement = galleryPhotos.length > 0 ? Math.round((totalLikes + totalComments) / galleryPhotos.length) : 0;
    
    // Photos en modération
    const pendingCount = galleryPhotos.filter(p => p.status === 'pending').length;
    
    // Mises à jour des éléments
    document.getElementById('photoMostLiked').textContent = maxLikes;
    document.getElementById('photoMostCommented').textContent = maxComments;
    document.getElementById('photoAvgEngagement').textContent = avgEngagement > 0 ? Math.round((totalLikes / Math.max(totalViews, 1)) * 100) + '%' : '0%';
    document.getElementById('photosPendingReview').textContent = pendingCount;
    document.getElementById('photoKpiLikesPerDay').textContent = Math.round(totalLikes / 30);
    document.getElementById('photoKpiCommentsPerDay').textContent = Math.round(totalComments / 30);
    document.getElementById('photoKpiAvgViews').textContent = Math.round(totalViews / galleryPhotos.length);
}

function renderGalleryCharts() {
    const noDataHtml = '<div style="display:flex;align-items:center;justify-content:center;height:300px;flex-direction:column;color:var(--text-muted);"><i class="fas fa-inbox" style="font-size:2.5rem;opacity:0.5;margin-bottom:10px;"></i><p>Pas de données à évaluer pour l\'instant</p></div>';
    
    if (allGalleries.length === 0) {
        ['galleriesDistributionChart', 'engagementTrendChart', 'photoStatusChart', 'visibilityChart'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = noDataHtml;
        });
        return;
    }
    
    // 1. Distribution par catégorie
    const categoryCounts = {};
    allGalleries.forEach(gallery => {
        const category = gallery.metadata?.category || 'general';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    const categories = Object.keys(categoryCounts);
    const counts = categories.map(cat => categoryCounts[cat]);
    const colors = categories.map(cat => GALLERY_CATEGORIES[cat]?.color || '#D97706');
    
    if (galleryDistributionChart) galleryDistributionChart.destroy();
    const ctx1 = document.getElementById('galleriesDistributionChart');
    if (ctx1) {
        galleryDistributionChart = new Chart(ctx1, {
            type: 'pie',
            data: { labels: categories.map(cat => GALLERY_CATEGORIES[cat]?.label || cat), datasets: [{ data: counts, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'right' } } }
        });
    }
    
    // 2. État des photos (approved/pending/rejected)
    const photoStatus = { approved: 0, pending: 0, rejected: 0 };
    allGalleries.forEach(gallery => {
        photoStatus.approved += (gallery.moderation?.approvedPhotos?.length || 0);
        photoStatus.pending += (gallery.moderation?.pendingPhotos?.length || 0);
        photoStatus.rejected += (gallery.moderation?.rejectedPhotos?.length || 0);
    });
    if (galleryStatsChart) galleryStatsChart.destroy();
    const ctx2 = document.getElementById('photoStatusChart');
    if (ctx2) {
        galleryStatsChart = new Chart(ctx2, {
            type: 'doughnut',
            data: { labels: ['Approuvées', 'En attente', 'Rejetées'], datasets: [{ data: [photoStatus.approved, photoStatus.pending, photoStatus.rejected], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderColor: '#fff', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    // 3. Visibilité (public/private)
    const visibilityCounts = { public: allGalleries.filter(g => g.isPublic).length, private: allGalleries.filter(g => !g.isPublic).length };
    const ctx3 = document.getElementById('visibilityChart');
    if (ctx3) {
        const canvas = ctx3.querySelector('canvas');
        if (canvas) canvas.remove();
        new Chart(ctx3, {
            type: 'bar',
            data: { labels: ['Publiques', 'Privées'], datasets: [{ label: 'Galeries', data: [visibilityCounts.public, visibilityCounts.private], backgroundColor: ['#3B82F6', '#8B5CF6'] }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, scales: { x: { beginAtZero: true } } }
        });
    }
    
    // 4. Engagement (photos/likes/comments/views/downloads)
    const engagement = { photos: 0, likes: 0, comments: 0, views: 0, downloads: 0 };
    allGalleries.forEach(g => {
        engagement.photos += g.photos?.length || 0;
        engagement.likes += g.stats?.totalLikes || 0;
        engagement.comments += g.stats?.totalComments || 0;
        engagement.views += g.stats?.totalViews || 0;
        engagement.downloads += g.stats?.totalDownloads || 0;
    });
    const ctx4 = document.getElementById('engagementTrendChart');
    if (ctx4) {
        const canvas = ctx4.querySelector('canvas');
        if (canvas) canvas.remove();
        new Chart(ctx4, {
            type: 'radar',
            data: {
                labels: ['Photos', 'Likes', 'Commentaires', 'Vues', 'Téléchargements'],
                datasets: [{ label: 'Engagement', data: [Math.min(engagement.photos, 100), Math.min(engagement.likes, 100), Math.min(engagement.comments, 100), Math.min(engagement.views, 100), Math.min(engagement.downloads, 100)], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 2, pointBackgroundColor: '#3B82F6', pointBorderColor: '#fff', pointBorderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: true, scales: { r: { beginAtZero: true, max: 100 } } }
        });
    }
}

function updateGalleriesPagination() {
    const pagination = document.getElementById('galleriesPagination');
    const listPagination = document.getElementById('galleriesListPagination');
    
    if (!pagination && !listPagination) return;
    
    const totalPages = Math.ceil(filteredGalleries.length / galleriesPerPage);
    
    if (totalPages <= 1) {
        if (pagination) pagination.style.display = 'none';
        if (listPagination) listPagination.style.display = 'none';
        return;
    }
    
    const paginationHTML = generatePaginationHTML(totalPages, currentPage, 'galleries');
    
    if (pagination) {
        pagination.innerHTML = paginationHTML;
        pagination.style.display = 'flex';
    }
    
    if (listPagination) {
        listPagination.innerHTML = paginationHTML;
        listPagination.style.display = 'flex';
    }
}

function changeGalleriesPage(page) {
    const totalPages = Math.ceil(filteredGalleries.length / galleriesPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayGalleries();
    updateGalleriesPagination();
}

function checkGalleriesEmptyState() {
    const hasGalleries = filteredGalleries.length > 0;
    
    const emptyState = document.getElementById('emptyStateGalleries');
    const emptyStateList = document.getElementById('emptyStateGalleriesList');
    const galleriesGrid = document.getElementById('galleriesGrid');
    const galleriesListContent = document.getElementById('galleriesListContent');
    
    // Afficher/masquer les états vides
    if (emptyState) emptyState.style.display = hasGalleries ? 'none' : 'flex';
    if (emptyStateList) emptyStateList.style.display = hasGalleries ? 'none' : 'flex';
    
    // Vider le contenu si pas de galeries
    if (!hasGalleries) {
        if (galleriesGrid) galleriesGrid.innerHTML = '';
        if (galleriesListContent) galleriesListContent.innerHTML = '';
    }
}

// ============================================
// �️ CHARGEMENT DE LA GALERIE COMPLÈTE (VUE DÉTAIL)
// ============================================
async function loadGalleryDetail(galleryId) {
    try {
        showLoading('photosLoader');
        
        // Récupérer la galerie via l'API
        currentGallery = await storage.getGallery(galleryId);
        if (!currentGallery) {
            throw new Error('Galerie non trouvée');
        }
        
        // Mettre à jour l'affichage du nom et description
        document.getElementById('currentGalleryName').textContent = currentGallery.name;
        document.getElementById('currentGalleryDescription').textContent = currentGallery.description || 'Aucune description';
        
        // Charger les photos de la galerie
        await loadPhotos();
        
    } catch (error) {
        console.error('❌ Erreur chargement galerie détail:', error);
        showToast('Erreur lors du chargement de la galerie', 'error');
    } finally {
        hideLoading('photosLoader');
    }
}

// ============================================
// �📸 GESTION DES PHOTOS DANS UNE GALERIE
// ============================================
async function selectGallery(galleryId) {
    try {
        // Naviguer vers la galerie avec le paramètre galerieId
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('eventId') || currentEvent?.id;
        
        if (!eventId) {
            throw new Error('ID événement manquant');
        }
        
        // Naviguer vers la galerie avec les deux paramètres URL
        const newUrl = `${window.location.pathname}?eventId=${eventId}&galerieId=${galleryId}`;
        window.location.href = newUrl;
        
    } catch (error) {
        console.error('❌ Erreur sélection galerie:', error);
        showToast('Erreur lors du chargement de la galerie', 'error');
    }
}

async function loadPhotos() {
    try {
        if (!currentGallery) return;
        
        // Récupérer les photos via l'API
        const photos = await storage.getPhotos(currentGallery.id);
        galleryPhotos = photos || [];
        
        updateGalleryStatistics();
        filterPhotos();
        
    } catch (error) {
        console.error('❌ Erreur chargement photos:', error);
        galleryPhotos = [];
        filterPhotos();
        showToast('Erreur lors du chargement des photos', 'error');
    }
}

function filterPhotos() {
    filteredPhotos = [...galleryPhotos];
    
    // Appliquer le filtre
    if (currentPhotoFilter !== 'all') {
        filteredPhotos = filteredPhotos.filter(p => p.status === currentPhotoFilter);
    }
    
    // Appliquer la recherche
    if (currentGallerySearch) {
        const search = currentGallerySearch.toLowerCase();
        filteredPhotos = filteredPhotos.filter(p =>
            (p.filename && p.filename.toLowerCase().includes(search)) ||
            (p.metadata?.title && p.metadata.title.toLowerCase().includes(search)) ||
            (p.metadata?.description && p.metadata.description.toLowerCase().includes(search)) ||
            (p.metadata?.tags && p.metadata.tags.some(tag => 
                tag.toLowerCase().includes(search)
            ))
        );
    }
    
    // Trier par date récente
    filteredPhotos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    // Pagination
    const totalPages = Math.ceil(filteredPhotos.length / photosPerPage);
    currentPhotoPage = Math.min(currentPhotoPage, totalPages || 1);
    
    displayPhotos();
    updatePhotosPagination();
    checkPhotosEmptyState();
}

async function displayPhotos(viewType = 'grid') {
    const grid = document.getElementById('photosGrid');
    const listView = document.getElementById('photosListView');
    const photosList = document.getElementById('photosList');

     const allUsersResponse = await storage.getAllUsers();
    const usersArray = allUsersResponse.data || [];

    const usersMap = {};
    usersArray.forEach(user => {
        usersMap[user.id] = user;
    });
        
    
    
    if (!grid && !listView) return;
    
    const startIndex = (currentPhotoPage - 1) * photosPerPage;
    const endIndex = startIndex + photosPerPage;
    const photosToShow = filteredPhotos.slice(startIndex, endIndex);
    
    if (photosToShow.length === 0) {
        if (grid) grid.innerHTML = '';
        if (photosList) photosList.innerHTML = '';
        return;
    }
    
    if (viewType === 'grid' || !viewType) {
        grid.innerHTML = photosToShow.map((photo, index) => {
            const isPending = photo.status === 'pending';
            const isRejected = photo.status === 'rejected';
             const isApproved = photo.status === 'approved';
            const hasLiked = photo.likedBy?.includes(currentUser.id);
            const globalIndex = filteredPhotos.findIndex(p => p.id === photo.id);
            const photoUrl = photo.url || photo.thumbnails?.small || 'assets/images/placeholder.jpg';

            const userInfo = usersMap[photo.uploadedBy];
            const creatorName = userInfo?.firstName || 'Utilisateur';
            const avatar = getGuestAvatarImage(userInfo);
            // Date relative personnalisée
            const uploadDate = getRelativeDate(photo.uploadedAt);

            return `
                <div class="photo-card" 
                     data-photo-id="${photo.id}" 
                     data-index="${globalIndex}"
                     onclick="viewPhoto('${photo.id}', ${globalIndex})">
                    <!-- Image de fond -->
                    <div class="photo-card-image" style="background-image: url('${photoUrl}');"></div>
                    <!-- Overlay dégradé -->
                    <div class="photo-card-overlay"></div>
                    <!-- Status badge -->
                    ${isPending ? `<div class="photo-status-badge pending"><i class="fas fa-clock"></i> En attente</div>` : ''}
                    ${isRejected ? `<div class="photo-status-badge rejected"><i class="fas fa-times"></i> Rejetée</div>` : ''}
                    ${isApproved ? `<div class="photo-status-badge approved"><i class="fas fa-check"></i> Approuvée</div>` : ''}
                    <!-- Actions overlay -->
                    <div class="photo-card-actions-overlay">
                        <button class="action-btn like  ${hasLiked ? 'active' : ''}" 
                                onclick="event.stopPropagation(); togglePhotoLike('${photo.id}')" title="J'aime">
                            <i class="fas fa-heart"></i>
                        </button>
                        ${currentGallery.settings.allowComments !== false ? `
                            <button class="action-btn commen" onclick="event.stopPropagation(); showCommentsModal('${photo.id}')" title="Commentaires">
                                <i class="fas fa-comment"></i>
                            </button>
                        ` : ''}
                        ${currentGallery.settings.allowDownloads !== false ? `
                            <button class="action-btn downloa" onclick="event.stopPropagation(); downloadPhoto('${photo.id}')" title="Télécharger">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn shar" onclick="event.stopPropagation(); sharePhoto('${photo.id}')" title="Partager">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                    <!-- Titre et infos -->
                    <div class="photo-card-title-overlay">
                        <h3 class="photo-title">${escapeHtml(photo.metadata?.title || photo.filename)}</h3>
                        <div class="photo-creator-info" style="display:flex;align-items:center;gap:8px;flex-direction:row;">
                            <img src="${avatar}" alt="Avatar" class="comment-avatar" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
                            <div style="display:flex;flex-direction:column;gap:2px;">
                                <span class="photo-creator" style="font-weight:600;display:flex;align-items:center;gap:4px;"><i class="fas fa-user"></i> ${escapeHtml(creatorName)}</span>
                                <span class="photo-date" style="font-size:0.85em;color:#888;display:flex;align-items:center;gap:4px;"><i class="fas fa-clock"></i> ${uploadDate}</span>
                            </div>
                        </div>
                        <div class="photo-quick-stats">
                            <span class="photo-stat"><i class="fas fa-eye"></i> ${photo.views || 0}</span>
                            <span class="photo-stat"><i class="fas fa-heart"></i> ${photo.likes?.length || 0}</span>
                            <span class="photo-stat"><i class="fas fa-comment"></i> ${photo.comments?.length || 0}</span>
                        </div>
                    </div>
                    <!-- Boutons modération -->
                    <div class="photo-card-moderation">
                        ${isPending || isRejected  && canModerateGallery(currentGallery) ? `
                            <button class="action-btn check" onclick="event.stopPropagation(); approvePhoto('${photo.id}')" title="Approuver">
                                <i class="fas fa-check"></i>
                            </button>` : ''}
                        ${!isRejected && !isApproved ? `
                            <button class="action-btn delete" onclick="event.stopPropagation(); rejectPhoto('${photo.id}')" title="Rejeter">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                        
                        ${canModifyPhoto(photo) ? `
                            <button class="action-btn delete" onclick="event.stopPropagation(); deletePhoto('${photo.id}')" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } else if (viewType === 'list') {
        photosList.innerHTML = photosToShow.map((photo, index) => {
            const isPending = photo.status === 'pending';
            const isRejected = photo.status === 'rejected';
            const globalIndex = filteredPhotos.findIndex(p => p.id === photo.id);
            const creatorName = escapeHtml(photo.uploadedByName || 'Utilisateur');

            const hasLiked = photo.likedBy?.includes(currentUser.id);
            const uploadDate = getRelativeDate(photo.uploadedAt);
            return `
                <div class="photo-list-item" data-photo-id="${photo.id}" data-index="${globalIndex}">
                    <div class="photo-list-thumbnail" onclick="viewPhoto('${photo.id}', ${globalIndex})">
                        <img src="${photo.url || photo.thumbnails?.small || 'assets/images/placeholder.jpg'}" 
                             alt="${photo.filename}">
                    </div>
                    <div class="photo-list-info">
                        <div class="photo-list-name">${escapeHtml(photo.metadata?.title || photo.filename)}</div>
                        <div class="photo-creator-info">
                            <span class="photo-creator"><i class="fas fa-user"></i> ${creatorName}</span>
                            <span class="photo-date"><i class="fas fa-clock"></i> ${uploadDate}</span>
                        </div>
                        <div class="photo-list-meta">
                            <span><i class="fas fa-eye"></i> ${photo.views || 0} vues</span>
                            <span><i class="fas fa-heart"></i> ${photo.likes?.length || 0} likes</span>
                            <span><i class="fas fa-comment"></i> ${photo.comments?.length || 0} commentaires</span>
                            ${isPending ? `<span class="status-badge pending"><i class="fas fa-clock"></i> En attente</span>` : ''}
                            ${isRejected ? `<span class="status-badge rejected"><i class="fas fa-times"></i> Rejetée</span>` : ''}
                        </div>
                    </div>
                    <div class="photo-list-actions">
                     <button class="action-btn like ${hasLiked ? 'active' : ''}" 
                                onclick="event.stopPropagation(); togglePhotoLike('${photo.id}')" title="J'aime">
                            <i class="fas fa-heart"></i>
                        </button>
                        ${currentGallery.settings.allowComments !== false ? `
                            <button class="action-btn comment" onclick="event.stopPropagation(); showCommentsModal('${photo.id}')" title="Commentaires">
                                <i class="fas fa-comment"></i>
                            </button>
                        ` : ''}
                        ${currentGallery.settings.allowDownloads !== false ? `
                            <button class="action-btn download" onclick="downloadPhoto('${photo.id}')" title="Télécharger">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn share" onclick="sharePhoto('${photo.id}')" title="Partager">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        ${isPending && canModerateGallery(currentGallery) ? `
                            <button class="action-btn check" onclick="approvePhoto('${photo.id}')" title="Approuver">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="action-btn delete" onclick="rejectPhoto('${photo.id}')" title="Rejeter">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                        ${canModifyPhoto(photo) ? `
                            <button class="action-btn delete" onclick="deletePhoto('${photo.id}')" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
}



    function getRelativeDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffDay === 0) {
            // Aujourd'hui
            return `Aujourd'hui à ${date.getHours().toString().padStart(2, '0')}h${date.getMinutes().toString().padStart(2, '0')}`;
        } else if (diffDay === 1) {
            return `Hier à ${date.getHours().toString().padStart(2, '0')}h${date.getMinutes().toString().padStart(2, '0')}`;
        } else if (diffDay < 7) {
            const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            return `${days[date.getDay()]} à ${date.getHours().toString().padStart(2, '0')}h${date.getMinutes().toString().padStart(2, '0')}`;
        } else {
            return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()} à ${date.getHours().toString().padStart(2, '0')}h${date.getMinutes().toString().padStart(2, '0')}`;
        }
    }

function updatePhotosPagination() {
    const pagination = document.getElementById('photosPagination');
    if (!pagination) return;
    
    const totalPages = Math.ceil(filteredPhotos.length / photosPerPage);
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.innerHTML = generatePaginationHTML(totalPages, currentPhotoPage, 'photos');
    pagination.style.display = 'flex';
}

function changePhotosPage(page) {
    const totalPages = Math.ceil(filteredPhotos.length / photosPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPhotoPage = page;
    displayPhotos();
    updatePhotosPagination();
}

function checkPhotosEmptyState() {
    const hasPhotos = filteredPhotos.length > 0;
    const emptyState = document.getElementById('emptyStatePhotos');
    
    if (emptyState) emptyState.style.display = hasPhotos ? 'none' : 'flex';
}

// ============================================
// 🎨 CRÉATION ET MODIFICATION DE GALERIES
// ============================================
function showCreateGalleryModal() {
    currentCreationStep = 1;
    updateCreationModal();
    document.getElementById('galleryCreationModal').classList.add('active');
}

function closeCreateGalleryModal() {
    document.getElementById('galleryCreationModal').classList.remove('active');
    resetGalleryForm();
}

function navigateToStep(step) {
    if (validateCurrentStep(currentCreationStep)) {
        currentCreationStep = step;
        updateCreationModal();
        updatePreview();
    }
}

function updateCreationModal() {
    const progressBar = document.getElementById('creationProgressBar');
    const progressPct = document.getElementById('creationProgressPercentage');
    
    if (progressBar && progressPct) {
        const pct = currentCreationStep * 25;
        progressBar.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;
    }
    
    document.querySelectorAll('.vertical-step').forEach(step => {
        const stepNum = parseInt(step.getAttribute('data-step'));
        step.classList.toggle('active', stepNum === currentCreationStep);
        step.classList.toggle('completed', stepNum < currentCreationStep);
    });
    
    document.querySelectorAll('.creation-step-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const activeContent = document.getElementById(`step${currentCreationStep}Content`);
    if (activeContent) {
        activeContent.classList.add('active');
    }
}

function validateCurrentStep(step) {
    switch(step) {
        case 1:
            const name = document.getElementById('galleryName');
            if (!name || !name.value.trim()) {
                showToast('Veuillez saisir un nom pour la galerie', 'error');
                return false;
            }
            return true;
        default:
            return true;
    }
}

function updatePreview() {
    const name = document.getElementById('galleryName').value.trim();
    const description = document.getElementById('galleryDescription').value.trim();
    const category = document.getElementById('galleryCategory').value;
    const isPublic = document.getElementById('galleryIsPublic').checked;
    const moderation = document.getElementById('moderationRequired').checked;
    const allowComments = document.getElementById('allowComments')?.checked || false;
    const allowLikes = document.getElementById('allowLikes')?.checked || false;
    const allowDownloads = document.getElementById('allowDownloads')?.checked || false;
    const maxPhotos = document.getElementById('maxPhotos')?.value || '1000';
    const maxPhotoSize = document.getElementById('maxPhotoSize')?.value || '8';
    const autoApprove = !moderation;
    
    const categoryObj = GALLERY_CATEGORIES[category] || GALLERY_CATEGORIES['general'];
    const categoryLabel = categoryObj.label;
    const visibilityText = isPublic ? 'Publique' : 'Privée';
    
    // Mettre à jour le nom et la description
    const previewNameEl = document.getElementById('previewGalleryName');
    const previewDescEl = document.getElementById('previewDescription');
    
    if (previewNameEl) previewNameEl.textContent = name || 'Nom de la galerie';
    if (previewDescEl) previewDescEl.textContent = description || 'Aucune description fournie';
    
    // Mettre à jour les badges
    const visibilityBadge = document.getElementById('previewVisibilityBadge');
    if (visibilityBadge) {
        visibilityBadge.innerHTML = isPublic 
            ? '<i class="fas fa-globe"></i> Publique' 
            : '<i class="fas fa-lock"></i> Privée';
    }
    
    const categoryBadge = document.getElementById('previewCategoryBadge');
    if (categoryBadge) {
        categoryBadge.innerHTML = `<i class="fas fa-${categoryObj.icon}"></i> ${categoryLabel}`;
    }
    
    const moderationBadge = document.getElementById('previewModerationBadge');
    if (moderationBadge) {
        moderationBadge.innerHTML = moderation 
            ? '<i class="fas fa-shield-alt"></i> Modération' 
            : '<i class="fas fa-check-circle"></i> Pas de modération';
    }
    
    // Mettre à jour les détails de configuration
    const configItems = {
        'previewAutoApprove': autoApprove ? 'Oui' : 'Non',
        'previewDownloads': allowDownloads ? 'Autorisés' : 'Interdits',
        'previewComments': allowComments ? 'Autorisés' : 'Interdits',
        'previewLikes': allowLikes ? 'Autorisés' : 'Interdits',
        'previewMaxSize': `${maxPhotoSize} MB`,
        'previewMaxPhotos': maxPhotos
    };
    
    Object.entries(configItems).forEach(([elementId, value]) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
            // Ajouter une couleur selon la valeur
            if (value.includes('Oui') || value.includes('Autorisés')) {
                el.style.color = 'var(--success)';
            } else if (value.includes('Non') || value.includes('Interdits')) {
                el.style.color = 'var(--text-color)';
                el.style.opacity = '0.6';
            }
        }
    });
    
    // Mettre à jour l'image de couverture si disponible
    const previewCover = document.getElementById('previewCoverImage');
    if (previewCover && galleryCoverFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewCover.style.backgroundImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(galleryCoverFile);
    }
}

async function createGallery() {
    try {
        const name = document.getElementById('galleryName').value.trim();
        const description = document.getElementById('galleryDescription').value.trim();
        const category = document.getElementById('galleryCategory').value;
        const isPublic = document.getElementById('galleryIsPublic').checked;
        const moderation = document.getElementById('moderationRequired').checked;
        const allowComments = document.getElementById('allowComments').checked;
        const allowLikes = document.getElementById('allowLikes').checked;
        const allowDownloads = document.getElementById('allowDownloads').checked;
        const maxPhotos = document.getElementById('maxPhotos')?.value || '1000';
        const maxPhotoSize = document.getElementById('maxPhotoSize')?.value || '8';

        if (!name) {
            await Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Le nom de la galerie est requis'
            });
            return;
        }

        // 1️⃣ Demander confirmation avant de créer
        const confirmResult = await Swal.fire({
            icon: 'question',
            title: 'Créer une galerie ?',
            html: `
                <div style="text-align: left; padding: 20px;">
                    <p><strong>Nom:</strong> ${escapeHtml(name)}</p>
                    <p><strong>Visibilité:</strong> ${isPublic ? '🌍 Publique' : '🔒 Privée'}</p>
                    <p><strong>Modération:</strong> ${moderation ? '✓ Activée' : '✗ Désactivée'}</p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Créer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#10B981'
        });

        if (!confirmResult.isConfirmed) return;

        // 2️⃣ Afficher le loading
        await Swal.fire({
            icon: 'info',
            title: 'Création en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    // Préparer les données
                    const settings = {
                        moderationRequired: moderation,
                        autoApprove: !moderation,
                        allowComments: allowComments,
                        allowLikes: allowLikes,
                        allowDownloads: allowDownloads,
                        maxPhotos: parseInt(maxPhotos),
                        maxPhotoSize: parseInt(maxPhotoSize) * 1024 * 1024,
                        category: category,
                        allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
                        watermark: false,
                        moderationRequired: moderation,
                        viewers: ['all'],
                        contributors: [currentUser.id],
                        moderators: [currentUser.id],
                        tags: [],
                        location: currentEvent?.location || null
                    };

                    const metadata = {
                        category: category,
                        tags: [],
                        location: currentEvent?.location || null
                    };

                    const opts = {
                        description: description,
                        isPublic: isPublic,
                        settings: settings,
                        metadata: metadata
                    };

                    // Récupérer le fichier de couverture directement du DOM
                    const coverFileInput = document.getElementById('galleryCoverFile');
                    if (coverFileInput && coverFileInput.files.length > 0) {
                        const file = coverFileInput.files[0];
                        if (file instanceof File) {
                            opts.coverFile = file;
                        }
                    }

                    // Créer la galerie
                    const newGallery = await storage.createGallery(
                        currentEvent.id,
                        name,
                        opts
                    );

                    // 3️⃣ Succès
                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Galerie créée !',
                        html: `<p>La galerie <strong>"${escapeHtml(name)}"</strong> a été créée avec succès!</p>`,
                        confirmButtonText: 'OK'
                    });

                    // Confetti et fermeture
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });

                    closeCreateGalleryModal();
                    await loadGalleries();

                } catch (error) {
                    // 3️⃣ Erreur
                    Swal.hideLoading();
                    console.error('❌ Erreur création galerie:', error);
                    
                    // Extraire le message d'erreur avec détails
                    let errorTitle = 'Erreur de création';
                    let errorText = error.message || 'Erreur lors de la création de la galerie';
                    let errorDetails = '';
                    
                    // Si c'est une erreur parsée (avec error et details)
                    if (error.error) {
                        errorTitle = error.error;
                        errorText = error.details || error.message || 'Vérifiez les paramètres';
                        if (error.code) {
                            errorDetails = `Code: ${error.code}`;
                        }
                    }
                    
                    const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
                    
                    await Swal.fire({
                        icon: 'error',
                        title: errorTitle,
                        html: html
                    });
                }
            }
        });

    } catch (error) {
        console.error('❌ Erreur création galerie:', error);
        
        // Extraire le message d'erreur avec détails
        let errorTitle = 'Erreur de création';
        let errorText = error.message || 'Une erreur s\'est produite';
        let errorDetails = '';
        
        // Si c'est une erreur parsée (avec error et details)
        if (error.error) {
            errorTitle = error.error;
            errorText = error.details || error.message || 'Vérifiez les paramètres';
            if (error.code) {
                errorDetails = `Code: ${error.code}`;
            }
        }
        
        const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: html
        });
    }
}

async function editGallery(galleryId) {
    try {
        const gallery = allGalleries.find(g => g.id === galleryId);
        if (!gallery) {
            showToast('Galerie non trouvée', 'error');
            return;
        }
        
        // Remplir le formulaire
        document.getElementById('galleryName').value = gallery.name;
        document.getElementById('galleryDescription').value = gallery.description || '';
        document.getElementById('galleryCategory').value = gallery.metadata?.category || 'general';
        document.getElementById('galleryIsPublic').checked = gallery.isPublic || false;
        document.getElementById('moderationRequired').checked = gallery.settings?.moderationRequired !== false;
        document.getElementById('allowComments').checked = gallery.settings?.allowComments !== false;
        document.getElementById('allowLikes').checked = gallery.settings?.allowLikes !== false;
        document.getElementById('allowDownloads').checked = gallery.settings?.allowDownloads || false;
        document.getElementById('allowContributions').checked = gallery.permissions?.contributors?.includes('all') || false;
        
        updatePreview();
        
        showCreateGalleryModal();
        
        const submitBtn = document.getElementById('submitGalleryBtn');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
        submitBtn.onclick = async () => {
            await updateGallery(galleryId);
        };
        
    } catch (error) {
        console.error('❌ Erreur édition galerie:', error);
        showToast('Erreur lors du chargement de la galerie', 'error');
    }
}

async function updateGallery(galleryId) {
    try {
        const name = document.getElementById('galleryName').value.trim();
        const description = document.getElementById('galleryDescription').value.trim();
        const category = document.getElementById('galleryCategory').value;
        const isPublic = document.getElementById('galleryIsPublic').checked;
        const moderation = document.getElementById('moderationRequired').checked;
        const allowComments = document.getElementById('allowComments').checked;
        const allowLikes = document.getElementById('allowLikes').checked;
        const allowDownloads = document.getElementById('allowDownloads').checked;
        const allowContributions = document.getElementById('allowContributions').checked;
        
        if (!name) {
            await Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Le nom de la galerie est requis'
            });
            return;
        }

        // 1️⃣ Demander confirmation
        const confirmResult = await Swal.fire({
            icon: 'question',
            title: 'Modifier la galerie ?',
            html: `<p>Les paramètres de <strong>"${escapeHtml(name)}"</strong> seront mise à jour.</p>`,
            showCancelButton: true,
            confirmButtonText: 'Modifier',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#F59E0B'
        });

        if (!confirmResult.isConfirmed) return;

        // 2️⃣ Afficher le loading
        await Swal.fire({
            icon: 'info',
            title: 'Mise à jour en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    const galleryData = {
                        name: name,
                        description: description,
                        isPublic: isPublic,
                        metadata: {
                            category: category
                        },
                        settings: {
                            moderationRequired: moderation,
                            allowComments: allowComments,
                            allowLikes: allowLikes,
                            allowDownloads: allowDownloads
                        },
                        permissions: {
                            contributors: allowContributions ? ['all'] : [currentUser.id]
                        }
                    };

                    // Upload de l'image de couverture si sélectionnée
                    const coverFileInput = document.getElementById('galleryCoverFile');
                    if (coverFileInput && coverFileInput.files.length > 0) {
                        try {
                            const file = coverFileInput.files[0];
                            const uploadedFile = await storage.uploadFile(file, 'gallery');
                            galleryData.metadata.coverPhoto = uploadedFile.id;
                            galleryData.metadata.coverPhotoUrl = uploadedFile.url;
                        } catch (error) {
                            console.warn('Erreur upload image couverture:', error);
                        }
                    }

                    await storage.updateGallery(galleryId, galleryData);

                    // 3️⃣ Succès
                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Modifiée !',
                        html: `<p>La galerie a été modifiée avec succès!</p>`,
                        confirmButtonText: 'OK'
                    });

                    closeCreateGalleryModal();
                    await loadGalleries();

                } catch (error) {
                    // 3️⃣ Erreur
                    Swal.hideLoading();
                    console.error('❌ Erreur modification galerie:', error);
                    
                    // Extraire le message d'erreur avec détails
                    let errorTitle = 'Erreur de modification';
                    let errorText = error.message || 'Erreur lors de la modification';
                    let errorDetails = '';
                    
                    // Si c'est une erreur parsée (avec error et details)
                    if (error.error) {
                        errorTitle = error.error;
                        errorText = error.details || error.message || 'Vérifiez les paramètres';
                        if (error.code) {
                            errorDetails = `Code: ${error.code}`;
                        }
                    }
                    
                    const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
                    
                    await Swal.fire({
                        icon: 'error',
                        title: errorTitle,
                        html: html
                    });
                }
            }
        });

    } catch (error) {
        console.error('❌ Erreur modification galerie:', error);
        
        // Extraire le message d'erreur avec détails
        let errorTitle = 'Erreur de modification';
        let errorText = error.message || 'Une erreur s\'est produite';
        let errorDetails = '';
        
        // Si c'est une erreur parsée (avec error et details)
        if (error.error) {
            errorTitle = error.error;
            errorText = error.details || error.message || 'Vérifiez les paramètres';
            if (error.code) {
                errorDetails = `Code: ${error.code}`;
            }
        }
        
        const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: html
        });
    }
}

async function deleteGallery(galleryId) {
    try {
        const gallery = allGalleries.find(g => g.id === galleryId);
        if (!gallery) return;
        
        // 1️⃣ Demander confirmation
        const result = await Swal.fire({
            title: 'Supprimer la galerie ?',
            html: `
                <div style="text-align: center; padding: 20px 0;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #EF4444; margin-bottom: 15px;"></i>
                    <p>La galerie <strong>"${escapeHtml(gallery.name)}"</strong> sera définitivement supprimée.</p>
                    ${gallery.photoCount > 0 ? `
                        <p style="color: var(--warning); font-size: 0.9rem; margin-top: 10px;">
                            <i class="fas fa-images"></i>
                            ${gallery.photoCount} photo(s) seront également supprimée(s)
                        </p>
                    ` : ''}
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#EF4444'
        });
        
        if (!result.isConfirmed) return;

        // 2️⃣ Afficher le loading
        await Swal.fire({
            icon: 'info',
            title: 'Suppression en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    await storage.deleteGallery(galleryId);

                    // 3️⃣ Succès
                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Supprimée !',
                        html: `<p>La galerie a été supprimée avec succès!</p>`,
                        confirmButtonText: 'OK'
                    });

                    await loadGalleries();

                } catch (error) {
                    // 3️⃣ Erreur
                    Swal.hideLoading();
                    console.error('❌ Erreur suppression galerie:', error);
                    
                    // Extraire le message d'erreur avec détails
                    let errorTitle = 'Erreur de suppression';
                    let errorText = error.message || 'Erreur lors de la suppression';
                    let errorDetails = '';
                    
                    // Si c'est une erreur parsée (avec error et details)
                    if (error.error) {
                        errorTitle = error.error;
                        errorText = error.details || error.message || 'Vérifiez les paramètres';
                        if (error.code) {
                            errorDetails = `Code: ${error.code}`;
                        }
                    }
                    
                    const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
                    
                    await Swal.fire({
                        icon: 'error',
                        title: errorTitle,
                        html: html
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur suppression galerie:', error);
        
        // Extraire le message d'erreur avec détails
        let errorTitle = 'Erreur de suppression';
        let errorText = error.message || 'Une erreur s\'est produite';
        let errorDetails = '';
        
        // Si c'est une erreur parsée (avec error et details)
        if (error.error) {
            errorTitle = error.error;
            errorText = error.details || error.message || 'Vérifiez les paramètres';
            if (error.code) {
                errorDetails = `Code: ${error.code}`;
            }
        }
        
        const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: html
        });
    }
}

// ============================================
// 📤 UPLOAD DE PHOTOS
// ============================================
function showAddPhotosModal() {
    uploadedPhotos = [];
    updatePhotosUploadList();
    document.getElementById('addPhotosModal').classList.add('active');
    setupPhotosDragAndDrop();
}

function closeAddPhotosModal() {
    document.getElementById('addPhotosModal').classList.remove('active');
    uploadedPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    uploadedPhotos = [];
    document.getElementById('photosFilesInput').value = '';
}

function setupPhotosDragAndDrop() {
    const uploadArea = document.getElementById('photosUploadArea');
    if (!uploadArea) return;
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    uploadArea.addEventListener('click', () => {
        document.getElementById('photosFilesInput').click();
    });
    
    document.getElementById('photosFilesInput').addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    if (!files) return;
    
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            showToast(`${file.name} n'est pas une image`, 'error');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showToast(`${file.name} est trop volumineux (max 10MB)`, 'error');
            return;
        }
        
        uploadedPhotos.push({
            id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file: file,
            previewUrl: URL.createObjectURL(file),
            title: file.name.replace(/\.[^/.]+$/, ""),
            description: '',
            tags: []
        });
    });
    
    updatePhotosUploadList();
    showToast(`${uploadedPhotos.length} photo(s) ajoutée(s)`, 'success');
}

function updatePhotosUploadList() {
    const container = document.getElementById('photosGridContainer');
    const countSpan = document.getElementById('photosCountToAdd');
    const submitBtn = document.getElementById('submitPhotosBtn');
    const uploadArea = document.getElementById('photosUploadArea');
    const maxPhotos = currentGallery?.settings?.maxPhotos || 1000;
    
    countSpan.textContent = uploadedPhotos.length;
    submitBtn.disabled = uploadedPhotos.length === 0;
    
    // Construire le HTML de la grille
    let html = uploadedPhotos.map((photo, index) => `
        <div class="photo-card" onclick="previewUploadedPhoto(${index})">
            <img src="${photo.previewUrl}" alt="${photo.file.name}">
            <div class="photo-card-overlay">
                <button class="action-btn delete" style="" title="Supprimer" onclick="event.stopPropagation(); removeUploadedPhoto(${index})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Ajouter la zone d'upload a cote si pas atteint le max
    if (uploadedPhotos.length < maxPhotos) {
        html += `
            <div class="photo-upload-placeholder" onclick="document.getElementById('photosFilesInput').click()" title="Ajouter plus de photos">
                <div>
                    <div class="photo-upload-placeholder-icon">
                        <i class="fas fa-cloud-upload-alt upload-icon"></i>
                        
                    </div>
                </div>
                <p style="margin-top: 10px;color: #6b7280;">Ajouter plus de photos</p>
            </div>
        `;
    }
   
    container.innerHTML = html;
    
    // Afficher/masquer l'upload area initial
    uploadArea.style.display = uploadedPhotos.length === 0 ? 'block' : 'none';
    container.style.display = uploadedPhotos.length > 0 ? 'grid' : 'none';
}

function previewUploadedPhoto(index) {
    if (!uploadedPhotos[index]) return;
    const photo = uploadedPhotos[index];
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer;';
    
    const img = document.createElement('img');
    img.src = photo.previewUrl;
    img.style.cssText = 'max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);';
    
    modal.appendChild(img);
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
}

function updateUploadedPhotoTitle(index, title) {
    if (uploadedPhotos[index]) {
        uploadedPhotos[index].title = title;
    }
}

function updateUploadedPhotoDescription(index, description) {
    if (uploadedPhotos[index]) {
        uploadedPhotos[index].description = description;
    }
}

function updateUploadedPhotoTags(index, tags) {
    if (uploadedPhotos[index]) {
        uploadedPhotos[index].tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
}

function removeUploadedPhoto(index) {
    if (uploadedPhotos[index]) {
        URL.revokeObjectURL(uploadedPhotos[index].previewUrl);
        uploadedPhotos.splice(index, 1);
        updatePhotosUploadList();
    }
}

async function submitPhotos() {
    try {
        if (!currentGallery || uploadedPhotos.length === 0) return;
        
        // 1️⃣ Demander confirmation
        const confirmResult = await Swal.fire({
            icon: 'question',
            title: `Ajouter ${uploadedPhotos.length} photo(s) ?`,
            html: `<p>Les <strong>${uploadedPhotos.length} photo(s)</strong> seront ajoutées à la galerie.</p>`,
            showCancelButton: true,
            confirmButtonText: 'Ajouter',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#10B981'
        });

        if (!confirmResult.isConfirmed) return;

        // 2️⃣ Afficher le loading avec progression
        let successCount = 0;
        let failedCount = 0;

        await Swal.fire({
            icon: 'info',
            title: 'Ajout des photos...',
            html: `
                <div style="text-align: center;">
                    <p>Veuillez patienter</p>
                    <div style="margin-top: 20px;">
                        <div id="swalProgressBar" style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div id="swalProgressFill" style="height: 100%; background: #10B981; width: 0%; transition: width 0.3s;"></div>
                        </div>
                        <p id="swalProgressText" style="margin-top: 10px; font-size: 0.9rem;">0/${uploadedPhotos.length}</p>
                    </div>
                </div>
            `,
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    for (const uploadedPhoto of uploadedPhotos) {
                        try {
                            const metadata = {
                                title: uploadedPhoto.title,
                                description: uploadedPhoto.description,
                                tags: uploadedPhoto.tags
                            };
                            
                            await storage.addPhoto(currentGallery.id, uploadedPhoto.file, metadata);
                            successCount++;
                            
                            // Mettre à jour la barre de progression
                            const totalProcessed = successCount + failedCount;
                            const progress = (totalProcessed / uploadedPhotos.length) * 100;
                            document.getElementById('swalProgressFill').style.width = `${progress}%`;
                            document.getElementById('swalProgressText').textContent = `${totalProcessed}/${uploadedPhotos.length}`;
                            
                        } catch (error) {
                            console.error('Erreur upload photo:', error);
                            failedCount++;
                        }
                    }

                    uploadedPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
                    uploadedPhotos = [];

                    // 3️⃣ Succès
                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Photos ajoutées !',
                        html: `
                            <p>${successCount} photo(s) ajoutée(s) avec succès!</p>
                            ${failedCount > 0 ? `<p style="color: #EF4444; font-size: 0.9rem; margin-top: 10px;"><strong>${failedCount}</strong> n'ont pas pu être ajoutées</p>` : ''}
                        `,
                        confirmButtonText: 'OK'
                    });

                    if (successCount > 3) {
                        confetti({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 }
                        });
                    }

                    closeAddPhotosModal();
                    await loadPhotos();

                } catch (error) {
                    // 3️⃣ Erreur
                    Swal.hideLoading();
                    console.error('❌ Erreur ajout photos:', error);
                    
                    // Extraire le message d'erreur avec détails
                    let errorTitle = 'Erreur d\'ajout';
                    let errorText = error.message || 'Erreur lors de l\'ajout des photos';
                    let errorDetails = '';
                    
                    // Si c'est une erreur parsée (avec error et details)
                    if (error.error) {
                        errorTitle = error.error;
                        errorText = error.details || error.message || 'Vérifiez les fichiers';
                        if (error.code) {
                            errorDetails = `Code: ${error.code}`;
                        }
                        // Cas spécial: format fichier non supporté
                        if (error.supportedFormats) {
                            errorText = error.details || 'Format non supporté';
                            errorDetails = `Formats images: ${error.supportedFormats.images?.join(', ')}, Vidéos: ${error.supportedFormats.videos?.join(', ')}`;
                        }
                    }
                    
                    const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
                    
                    await Swal.fire({
                        icon: 'error',
                        title: errorTitle,
                        html: html
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur ajout photos:', error);
        
        // Extraire le message d'erreur avec détails
        let errorTitle = 'Erreur d\'ajout';
        let errorText = error.message || 'Une erreur s\'est produite';
        let errorDetails = '';
        
        // Si c'est une erreur parsée (avec error et details)
        if (error.error) {
            errorTitle = error.error;
            errorText = error.details || error.message || 'Vérifiez les fichiers';
            if (error.code) {
                errorDetails = `Code: ${error.code}`;
            }
            // Cas spécial: format fichier non supporté
            if (error.supportedFormats) {
                errorText = error.details || 'Format non supporté';
                errorDetails = `Formats images: ${error.supportedFormats.images?.join(', ')}, Vidéos: ${error.supportedFormats.videos?.join(', ')}`;
            }
        }
        
        const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: html
        });
    }
}

function updateUploadProgress(progress) {
    const progressBar = document.getElementById('uploadProgressBar');
    if (!progressBar) {
        const bar = document.createElement('div');
        bar.id = 'uploadProgressBar';
        bar.className = 'upload-progress-bar';
        bar.innerHTML = `
            <div class="progress-bar-fill" style="width: ${progress}%"></div>
            <div class="progress-text">${progress}%</div>
        `;
        document.querySelector('.creation-navigation').prepend(bar);
    } else {
        progressBar.querySelector('.progress-bar-fill').style.width = `${progress}%`;
        progressBar.querySelector('.progress-text').textContent = `${progress}%`;
    }
}

// ============================================
// 👁️ VUE ET GESTION DES PHOTOS
// ============================================
async function viewPhoto(photoId, index = 0) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        currentPhotoIndex = index;
        
        // Vérifier si l'utilisateur a déjà vu la photo
        if (!photo.viewedBy) photo.viewedBy = [];
        const hasAlreadyViewed = photo.viewedBy.includes(currentUser.id);
        
        if (!hasAlreadyViewed) {
            photo.views = (photo.views || 0) + 1;
            photo.viewedBy.push(currentUser.id);
        }
        
        await storage.updatePhoto(currentGallery.id, photoId, { 
            views: photo.views,
            viewedBy: photo.viewedBy
        });
        
        await updatePhotoModal(photo);
        
    } catch (error) {
        console.error('❌ Erreur vue photo:', error);
        showToast('Erreur lors de l\'affichage de la photo', 'error');
    }
}

async function togglePhotoLike(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        await storage.likePhoto(currentGallery.id, photoId);
        
        const hasLiked = photo.likedBy?.includes(currentUser.id);
        
        // Mettre à jour l'interface localement
        if (hasLiked) {
            photo.likes = photo.likes.filter(like => like.userId !== currentUser.id);
            photo.likedBy = photo.likedBy.filter(id => id !== currentUser.id);
        } else {
            if (!photo.likes) photo.likes = [];
            if (!photo.likedBy) photo.likedBy = [];
            
            photo.likes.push({
                id: `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: currentUser.id,
                likedAt: new Date().toISOString()
            });
            
            photo.likedBy.push(currentUser.id);
        }
        
        const likeBtn = document.querySelector(`[data-photo-id="${photoId}"] .like`);
        const likeCount = document.querySelector(`[data-photo-id="${photoId}"] .like span`);
        
        if (likeBtn) {
            likeBtn.classList.toggle('active', !hasLiked);
        }
        if (likeCount) {
            likeCount.textContent = photo.likes.length;
        }
        
        // Notification simple avec Swal
        await Swal.fire({
            icon: 'success',
            title: hasLiked ? 'Like retiré' : 'Photo aimée!',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
        
    } catch (error) {
        console.error('❌ Erreur like photo:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Erreur lors de l\'action sur la photo',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    }
}

async function downloadPhoto(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        if (!currentGallery.settings.allowDownloads) {
            await Swal.fire({
                icon: 'error',
                title: 'Téléchargement désactivé',
                text: 'Les téléchargements sont désactivés pour cette galerie'
            });
            return;
        }

        // Afficher le loading
        await Swal.fire({
            icon: 'info',
            title: 'Téléchargement...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    // Incrémenter le compteur de téléchargements
                    photo.downloads = (photo.downloads || 0) + 1;
                    await storage.updatePhoto(currentGallery.id, photoId, {
                        downloads: photo.downloads
                    });
                    
                    // Créer un lien de téléchargement
                    const link = document.createElement('a');
                    link.href = photo.url;
                    link.download = photo.filename || `photo_${photoId}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Téléchargé !',
                        html: '<p>La photo a été téléchargée avec succès!</p>',
                        confirmButtonText: 'OK'
                    });

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur téléchargement photo:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: error.message || 'Erreur lors du téléchargement'
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur téléchargement photo:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message || 'Une erreur s\'est produite'
        });
    }
}

async function approvePhoto(photoId) {
    try {
        if (!canModerateGallery(currentGallery)) {
            await Swal.fire({
                icon: 'error',
                title: 'Permission refusée',
                text: 'Vous n\'avez pas la permission de modérer'
            });
            return;
        }
        
        await Swal.fire({
            icon: 'info',
            title: 'Approbation en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    await storage.approvePhoto(currentGallery.id, photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Approuvée !',
                        html: '<p>La photo a été approuvée avec succès!</p>',
                        confirmButtonText: 'OK'
                    });

                    await loadPhotos();

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur approbation photo:', error);
                    
                    // Extraire le message d'erreur avec détails
                    let errorTitle = 'Erreur d\'approbation';
                    let errorText = error.message || 'Erreur lors de l\'approbation';
                    let errorDetails = '';
                    
                    if (error.error) {
                        errorTitle = error.error;
                        errorText = error.details || error.message || 'Vérifiez les paramètres';
                        if (error.code) {
                            errorDetails = `Code: ${error.code}`;
                        }
                    }
                    
                    const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
                    
                    await Swal.fire({
                        icon: 'error',
                        title: errorTitle,
                        html: html
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur approbation photo:', error);
        
        let errorTitle = 'Erreur d\'approbation';
        let errorText = error.message || 'Une erreur s\'est produite';
        let errorDetails = '';
        
        if (error.error) {
            errorTitle = error.error;
            errorText = error.details || error.message || 'Vérifiez les paramètres';
            if (error.code) {
                errorDetails = `Code: ${error.code}`;
            }
        }
        
        const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: html
        });
    }
}

async function rejectPhoto(photoId) {
    try {
        if (!canModerateGallery(currentGallery)) {
            await Swal.fire({
                icon: 'error',
                title: 'Permission refusée',
                text: 'Vous n\'avez pas la permission de modérer'
            });
            return;
        }

        // 1️⃣ Demander confirmation et raison
        const { value: reason, isConfirmed } = await Swal.fire({
            title: 'Rejeter la photo ?',
            input: 'textarea',
            inputLabel: 'Raison du rejet (optionnel)',
            inputPlaceholder: 'Décrivez pourquoi vous rejetez cette photo...',
            showCancelButton: true,
            confirmButtonText: 'Rejeter',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#EF4444'
        });

        if (!isConfirmed) return;

        // 2️⃣ Afficher le loading
        await Swal.fire({
            icon: 'info',
            title: 'Rejet en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    await storage.rejectPhoto(currentGallery.id, photoId, reason);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Rejetée !',
                        html: '<p>La photo a été rejetée avec succès!</p>',
                        confirmButtonText: 'OK'
                    });

                    await loadPhotos();

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur rejet photo:', error);
                    
                    let errorTitle = 'Erreur de rejet';
                    let errorText = error.message || 'Erreur lors du rejet';
                    let errorDetails = '';
                    
                    if (error.error) {
                        errorTitle = error.error;
                        errorText = error.details || error.message || 'Vérifiez les paramètres';
                        if (error.code) {
                            errorDetails = `Code: ${error.code}`;
                        }
                    }
                    
                    const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
                    
                    await Swal.fire({
                        icon: 'error',
                        title: errorTitle,
                        html: html
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur rejet photo:', error);
        
        let errorTitle = 'Erreur de rejet';
        let errorText = error.message || 'Une erreur s\'est produite';
        let errorDetails = '';
        
        if (error.error) {
            errorTitle = error.error;
            errorText = error.details || error.message || 'Vérifiez les paramètres';
            if (error.code) {
                errorDetails = `Code: ${error.code}`;
            }
        }
        
        const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: html
        });
    }
}

async function deletePhoto(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        if (!canModifyPhoto(photo)) {
            await Swal.fire({
                icon: 'error',
                title: 'Permission refusée',
                text: 'Vous n\'avez pas la permission de supprimer cette photo'
            });
            return;
        }

        // 1️⃣ Demander confirmation
        const result = await Swal.fire({
            title: 'Supprimer la photo ?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#EF4444'
        });
        
        if (!result.isConfirmed) return;

        // 2️⃣ Afficher le loading
        await Swal.fire({
            icon: 'info',
            title: 'Suppression en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    await storage.deletePhoto(currentGallery.id, photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Supprimée !',
                        html: '<p>La photo a été supprimée avec succès!</p>',
                        confirmButtonText: 'OK'
                    });

                    await loadPhotos();

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur suppression photo:', error);
                    
                    let errorTitle = 'Erreur de suppression';
                    let errorText = error.message || 'Erreur lors de la suppression';
                    let errorDetails = '';
                    
                    if (error.error) {
                        errorTitle = error.error;
                        errorText = error.details || error.message || 'Vérifiez les paramètres';
                        if (error.code) {
                            errorDetails = `Code: ${error.code}`;
                        }
                    }
                    
                    const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
                    
                    await Swal.fire({
                        icon: 'error',
                        title: errorTitle,
                        html: html
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur suppression photo:', error);
        
        let errorTitle = 'Erreur de suppression';
        let errorText = error.message || 'Une erreur s\'est produite';
        let errorDetails = '';
        
        if (error.error) {
            errorTitle = error.error;
            errorText = error.details || error.message || 'Vérifiez les paramètres';
            if (error.code) {
                errorDetails = `Code: ${error.code}`;
            }
        }
        
        const html = errorDetails ? `<p>${escapeHtml(errorText)}</p><p style="font-size: 0.85em; color: #999;">${errorDetails}</p>` : `<p>${escapeHtml(errorText)}</p>`;
        
        await Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: html
        });
    }
}

// Fonction pour partager une photo
async function sharePhoto(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        const shareUrl = `${window.location.origin}/?eventId=${currentEvent.id}&galerieId=${currentGallery.id}&photoId=${photoId}`;
        
        if (navigator.share) {
            // Partage natif sur mobile
            await navigator.share({
                title: photo.metadata?.title || photo.filename,
                text: photo.metadata?.description || 'Découvrez cette photo',
                url: shareUrl
            });
        } else {
            // Fallback: Copier dans le presse-papiers
            await navigator.clipboard.writeText(shareUrl);
            showToast('Lien copié dans le presse-papiers', 'success');
        }
    } catch (error) {
        console.error('Erreur partage photo:', error);
        if (error.name !== 'AbortError') {
            showToast('Erreur lors du partage', 'error');
        }
    }
}

// ============================================
// 💬 COMMENTAIRES
// ============================================
async function showCommentsModal(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        currentCommentPage = 1;
        
        await loadComments(photoId);
        showCommentsList(photoId);
        
        document.getElementById('commentsModal').classList.add('active');
        document.getElementById('commentPhotoId').value = photoId;
        
    } catch (error) {
        console.error('❌ Erreur ouverture commentaires:', error);
        showToast('Erreur lors du chargement des commentaires', 'error');
    }
}

async function loadComments(photoId) {
    try {
        const comments = await storage.getComments(currentGallery.id, photoId);
        allComments[photoId] = comments;
        return comments;
    } catch (error) {
        console.error('❌ Erreur chargement commentaires:', error);
        return [];
    }
}

function getGuestAvatarImage(guest) {
    const baseUrl = 'assets/images/';
    
    if (!guest) return null;
    
    // 1️⃣ Vérifier d'abord le champ gender/sexe (pour les invités)
    const gender = (guest.gender?.toLowerCase() || guest.sexe?.toLowerCase() || '').trim();
    
    if (gender) {
        // Normaliser et checker les valeurs connues
        if (gender === 'f' || gender === 'femme' || gender === 'woman' || gender === 'female') {
            return `${baseUrl}femme.png`;
        } else if (gender === 'm' || gender === 'homme' || gender === 'man' || gender === 'male') {
            return `${baseUrl}homme.png`;
        } else if (gender === 'couple') {
            return `${baseUrl}couple.png`;
        } else if (gender === 'maman' || gender === 'mother') {
            return `${baseUrl}maman.png`;
        } else if (gender === 'autre') {
            return null; // Utiliser les initiales
        }
    }
    
    // 2️⃣ Récupérer les infos de base
    const firstName = (guest.firstName || '').toLowerCase().trim();
    const lastName = (guest.lastName || '').toLowerCase().trim();
    const notes = (guest.notes || guest.bio || '').toLowerCase().trim();
    const company = (guest.company || '').toLowerCase().trim();
    const type = guest.type?.toLowerCase() || '';
    
    // 3️⃣ Détection intelligente basée sur les titres de civilité et notes
    if (notes.includes('maman') || notes.includes('mother') || 
        firstName.includes('maman') || firstName.includes('mother') ||
        lastName.includes('maman') || lastName.includes('mother')) {
        return `${baseUrl}maman.png`;
    }
    
    if (type === 'couple' || 
        notes.includes('couple') || 
        company.includes('couple')) {
        return `${baseUrl}couple.png`;
    }
    
    // 4️⃣ Patterns de détection pour les titres de civilité
    const malePatterns = [
        /\bm\b\.?/i,           // M. ou M
        /\bmonsieur\b/i,       // Monsieur
        /\bmr\b\.?/i,          // Mr ou Mr.
        /\bmon\b\.?/i,         // Mon (de Monsieur)
        /père/i,               // Père
        /father/i,             // Father
        /dad\b/i,              // Dad
        /papa/i                // Papa
    ];
    
    // Chercher dans les notes
    if (malePatterns.some(pattern => pattern.test(notes))) {
        return `${baseUrl}homme.png`;
    }
    
    // Chercher dans le prénom ou nom
    if (malePatterns.some(pattern => pattern.test(firstName + ' ' + lastName))) {
        return `${baseUrl}homme.png`;
    }
    
    const femalePatterns = [
        /\bm[lle]{1,3}\.?/i,    // Mlle ou Mme ou Mme.
        /\bmme\b\.?/i,          // Mme
        /\bmlle\b\.?/i,         // Mlle
        /\bmademoiselle\b/i,    // Mademoiselle
        /\bmadame\b/i,          // Madame
        /\bmrs\b\.?/i,          // Mrs
        /\bms\b\.?/i,           // Ms
        /mère/i,                // Mère
        /mother/i,              // Mother
        /maman/i,               // Maman
        /mom\b/i,               // Mom
        /mama/i                 // Mama
    ];
    
    // Chercher dans les notes
    if (femalePatterns.some(pattern => pattern.test(notes))) {
        return `${baseUrl}femme.png`;
    }
    
    // Chercher dans le prénom ou nom
    if (femalePatterns.some(pattern => pattern.test(firstName + ' ' + lastName))) {
        return `${baseUrl}femme.png`;
    }
    
    // 5️⃣ Listes complètes de prénoms communs en français
    const commonFemaleNames = [
        'marie', 'anne', 'sophie', 'christine', 'catherine', 'nathalie',
        'isabelle', 'francine', 'fabienne', 'nadine', 'monique', 'dominique',
        'michelle', 'carole', 'patricia', 'béatrice', 'denise', 'brigitte',
        'véronique', 'joëlle', 'chantal', 'thérèse', 'simone', 'valerie',
        'annie', 'elise', 'alice', 'claire', 'nicole', 'sylvie', 'martine',
        'emilie', 'victoria', 'laura', 'sarah', 'jessica', 'lauraine', 'okay',
        'ange', 'nana', 'demanou', 'kuete'
    ];
    
    // Liste de prénoms masculins courants en français
    const commonMaleNames = [
        'jean', 'pierre', 'michel', 'andré', 'bernard', 'françois', 'jacques',
        'patrick', 'christian', 'daniel', 'olivier', 'alain', 'marc', 'thierry',
        'charles', 'paul', 'jean-paul', 'jean-claude', 'serge', 'gérard',
        'dominique', 'richard', 'joseph', 'louis', 'luc', 'eric', 'david',
        'nicolas', 'thomas', 'alexandre', 'benoit', 'admin', 'dave', 'junior',
        'steve', 'nana', 'tagne'
    ];
    
    // 6️⃣ Vérifier le prénom
    if (firstName) {
        if (commonFemaleNames.includes(firstName)) {
            return `${baseUrl}femme.png`;
        } else if (commonMaleNames.includes(firstName)) {
            return `${baseUrl}homme.png`;
        }
    }
    
    // 7️⃣ Fallback: retourner null pour utiliser les initiales
    return null;
}

async function showCommentsList(photoId) {
    const container = document.getElementById('commentsList');
    const comments = allComments[photoId] || [];
    
    const allUsersResponse = await storage.getAllUsers();
    const usersArray = allUsersResponse.data || [];
    
    // Créer une map pour accéder rapidement aux utilisateurs par ID
    const usersMap = {};
    usersArray.forEach(user => {
        usersMap[user.id] = user;
    });

    const startIndex = (currentCommentPage - 1) * commentsPerPage;
    const endIndex = startIndex + commentsPerPage;
    const commentsToShow = comments.slice(startIndex, endIndex);
    
    if (commentsToShow.length === 0) {
        container.innerHTML = `
            <div class="no-comments">
                <i class="fas fa-comment-slash"></i>
                <p>Aucun commentaire pour l'instant</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = commentsToShow.map(comment => {

        
        const userInfo = usersMap[comment.userId];
        const firstName = userInfo?.firstName || 'Utilisateur';
        const avatar = getGuestAvatarImage(userInfo);
                   
        const hasReplies = comment.replies && comment.replies.length > 0;
        
        return `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-author">
                    <img src="${avatar}" alt="Avatar" class="comment-avatar">
                    <div>
                        <strong>${escapeHtml(firstName)}</strong>
                        <span class="comment-date">${formatDate(comment.createdAt)}</span>
                    </div>
                </div>
   
                ${comment.userId === currentUser.id ? `
                    <div class="comment-actions">
                        <button class="action-btn" onclick="editComment('${photoId}', '${comment.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="deleteComment('${photoId}', '${comment.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
            <div class="comment-footer">
                <div class="comment-footer-left">
                    ${currentGallery.settings.allowLikes !== false ? `
                        <button class="like-btn ${comment.likedBy?.includes(currentUser.id) ? 'liked' : ''}" 
                                onclick="toggleCommentLike('${photoId}', '${comment.id}')">
                            <i class="fas fa-heart"></i>
                            <span>${comment.likes?.length || 0}</span>
                        </button>
                    ` : ''}
                    ${currentGallery.settings.allowComments !== false ? `
                        <button class="reply-btn" onclick="showReplyForm('${photoId}', '${comment.id}')">
                            <i class="fas fa-reply"></i>
                            <span>Répondre</span>
                        </button>
                    ` : ''}
                </div>
                
                ${hasReplies ? `
                    <button class="toggle-replies-btn" onclick="toggleReplies('${comment.id}')">
                        <i class="fas fa-chevron-down"></i>
                        <span>${comment.replies.length} réponse(s)</span>
                    </button>
                ` : ''}
            </div>
            
            ${hasReplies ? `
                <div class="replies-container" id="replies-${comment.id}" style="display: none;">
                    <div class="replies-list">
                        ${comment.replies.map(reply => {
                            const replyUserInfo = usersMap[reply.userId];
                            const replyFirstName = replyUserInfo?.firstName || 'Utilisateur';
                            const replyAvatar = getGuestAvatarImage(replyUserInfo);
                            
                            return `
                            <div class="reply-item">
                                <div class="reply-header">
                                    <div class="reply-author">
                                        <img src="${replyAvatar}" alt="Avatar" class="reply-avatar">
                                        <div>
                                            <strong>${escapeHtml(replyFirstName)}</strong>
                                            <span class="reply-date">${formatDate(reply.createdAt)}</span>
                                        </div>
                                    </div>
                                    
                                    ${reply.userId === currentUser.id ? `
                                        <div class="reply-actions">
                                            <button class="action-btn" onclick="editReply('${photoId}', '${comment.id}', '${reply.id}')">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="action-btn" onclick="deleteReply('${photoId}', '${comment.id}', '${reply.id}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="reply-content">${escapeHtml(reply.content)}</div>
                                <div class="reply-footer">
                                    ${currentGallery.settings.allowLikes !== false ? `
                                        <button class="like-btn ${reply.likedBy?.includes(currentUser.id) ? 'liked' : ''}" 
                                                onclick="toggleReplyLike('${photoId}', '${comment.id}', '${reply.id}')">
                                            <i class="fas fa-heart"></i>
                                            <span>${reply.likes?.length || 0}</span>
                                        </button>
                                    ` : ''}
                                     ${currentGallery.settings.allowComments !== false ? `
                                        <button class="reply-btn" onclick="showReplyForm('${photoId}', '${comment.id}' ,'${reply.id}')">
                                            <i class="fas fa-reply"></i>
                                            <span>Répondre</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="reply-form-container" id="reply-form-${comment.id}" style="display: none;">
                <div class="reply-input-wrapper">
                    <input type="text" placeholder="Votre réponse..." class="reply-input" id="reply-input-${comment.id}">
                    <button class="btn-submit-reply" onclick="submitReply('${photoId}', '${comment.id}')">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="btn-cancel-reply" onclick="hideReplyForm('${comment.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

async function submitComment() {
    try {
        const photoId = document.getElementById('commentPhotoId').value;
        const content = document.getElementById('commentInput').value.trim();
        
        if (!content) {
            await Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez saisir un commentaire',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
            return;
        }

        await Swal.fire({
            icon: 'info',
            title: 'Ajout en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    const comment = await storage.addComment(currentGallery.id, photoId, content);
                    
                    if (!allComments[photoId]) allComments[photoId] = [];
                    allComments[photoId].push(comment);
                    
                    document.getElementById('commentInput').value = '';
                    showCommentsList(photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Ajouté !',
                        text: 'Votre commentaire a été ajouté',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur ajout commentaire:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: error.message || 'Erreur lors de l\'ajout du commentaire',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur ajout commentaire:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message || 'Une erreur s\'est produite'
        });
    }
}

async function editComment(photoId, commentId) {
    const comments = allComments[photoId] || [];
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const { value: newContent, isConfirmed } = await Swal.fire({
        title: 'Modifier le commentaire',
        input: 'textarea',
        inputValue: comment.content,
        inputPlaceholder: 'Votre commentaire...',
        showCancelButton: true,
        confirmButtonText: 'Modifier',
        cancelButtonText: 'Annuler'
    });
    
    if (!isConfirmed || !newContent?.trim()) return;
    
    try {
        await Swal.fire({
            icon: 'info',
            title: 'Modification en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    const updatedComment = await storage.updateComment(
                        currentGallery.id, 
                        photoId, 
                        commentId, 
                        newContent.trim()
                    );
                    
                    comment.content = newContent.trim();
                    comment.updatedAt = updatedComment.updatedAt;
                    
                    showCommentsList(photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Modifié !',
                        text: 'Le commentaire a été modifié',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur modification commentaire:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: error.message || 'Erreur lors de la modification',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur modification commentaire:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message || 'Une erreur s\'est produite'
        });
    }
}

async function toggleCommentLike(photoId, commentId) {
    try {
        await storage.likeComment(currentGallery.id, photoId, commentId);
        
        const comments = allComments[photoId] || [];
        const comment = comments.find(c => c.id === commentId);
        
        if (comment) {
            const hasLiked = comment.likedBy?.includes(currentUser.id);
            
            if (hasLiked) {
                comment.likedBy = comment.likedBy.filter(id => id !== currentUser.id);
                comment.likes = comment.likes.filter(like => like.userId !== currentUser.id);
            } else {
                if (!comment.likedBy) comment.likedBy = [];
                if (!comment.likes) comment.likes = [];
                
                comment.likedBy.push(currentUser.id);
                comment.likes.push({
                    userId: currentUser.id,
                    likedAt: new Date().toISOString()
                });
            }
        }
        
        showCommentsList(photoId);
        
    } catch (error) {
        console.error('❌ Erreur like commentaire:', error);
        showToast('Erreur lors du like', 'error');
    }
}

async function deleteComment(photoId, commentId) {
    try {
        // 1️⃣ Demander confirmation
        const result = await Swal.fire({
            title: 'Supprimer le commentaire ?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#EF4444'
        });
        
        if (!result.isConfirmed) return;

        // 2️⃣ Afficher le loading
        await Swal.fire({
            icon: 'info',
            title: 'Suppression en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    await storage.deleteComment(currentGallery.id, photoId, commentId);
                    
                    if (allComments[photoId]) {
                        allComments[photoId] = allComments[photoId].filter(c => c.id !== commentId);
                    }
                    
                    showCommentsList(photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Supprimé !',
                        text: 'Le commentaire a été supprimé',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur suppression commentaire:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: error.message || 'Erreur lors de la suppression',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur suppression commentaire:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message || 'Une erreur s\'est produite'
        });
    }
}

// ============================================
// 💬 RÉPONSES AUX COMMENTAIRES (REPLIES)
// ============================================
function toggleReplies(commentId) {
    const repliesContainer = document.getElementById(`replies-${commentId}`);
    const btn = event.target.closest('.toggle-replies-btn');
    
    if (repliesContainer) {
        const isHidden = repliesContainer.style.display === 'none';
        repliesContainer.style.display = isHidden ? 'block' : 'none';
        
        if (btn) {
            btn.classList.toggle('expanded', isHidden);
        }
    }
}

function showReplyForm(photoId, commentId, replyId = null) {
    // If replying to a reply, show a dynamic reply form under the reply
    if (replyId) {
        // Remove any existing nested reply forms
        document.querySelectorAll('.nested-reply-form').forEach(el => el.remove());

        const replyItem = document.querySelector(`.reply-item[data-reply-id="${replyId}"]`);
        if (replyItem) {
            // Create a nested reply form
            const nestedForm = document.createElement('div');
            nestedForm.className = 'nested-reply-form';
            nestedForm.innerHTML = `
                <div class="reply-input-wrapper">
                    <input type="text" placeholder="Votre réponse..." class="reply-input" id="nested-reply-input-${replyId}">
                    <button class="btn-submit-reply" onclick="submitReply('${photoId}', '${commentId}', '${replyId}')">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="btn-cancel-reply" onclick="hideNestedReplyForm('${replyId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            replyItem.appendChild(nestedForm);
            const input = document.getElementById(`nested-reply-input-${replyId}`);
            if (input) input.focus();
        }
    } else {
        // Default: show the main reply form under the comment
        const replyForm = document.getElementById(`reply-form-${commentId}`);
        if (replyForm) {
            replyForm.style.display = 'block';
            const input = document.getElementById(`reply-input-${commentId}`);
            if (input) input.focus();
        }
    }
}

// Helper to hide the nested reply form
function hideNestedReplyForm(replyId) {
    const nestedForm = document.querySelector(`.reply-item[data-reply-id="${replyId}"] .nested-reply-form`);
    if (nestedForm) nestedForm.remove();
}

function hideReplyForm(commentId) {
    const replyForm = document.getElementById(`reply-form-${commentId}`);
    if (replyForm) {
        replyForm.style.display = 'none';
        const input = document.getElementById(`reply-input-${commentId}`);
        if (input) input.value = '';
    }
}

async function submitReply(photoId, commentId) {
    try {
        const input = document.getElementById(`reply-input-${commentId}`);
        const content = input?.value.trim();
        
        if (!content) {
            showToast('Veuillez saisir une réponse', 'error');
            return;
        }

        await Swal.fire({
            icon: 'info',
            title: 'Ajout en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    const reply = await storage.addReply(
                        currentGallery.id, 
                        photoId, 
                        commentId, 
                        content
                    );
                    
                    if (!allComments[photoId]) allComments[photoId] = [];
                    
                    const comment = allComments[photoId].find(c => c.id === commentId);
                    if (comment) {
                        if (!comment.replies) comment.replies = [];
                        comment.replies.push(reply);
                    }
                    
                    hideReplyForm(commentId);
                    showCommentsList(photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Ajoutée !',
                        text: 'Votre réponse a été ajoutée',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur ajout réponse:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: error.message || 'Erreur lors de l\'ajout',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur submission réponse:', error);
        showToast('Erreur lors de l\'ajout', 'error');
    }
}

async function editReply(photoId, commentId, replyId) {
    try {
        const comments = allComments[photoId] || [];
        const comment = comments.find(c => c.id === commentId);
        if (!comment) return;
        
        const reply = comment.replies?.find(r => r.id === replyId);
        if (!reply) return;
        
        const { value: newContent, isConfirmed } = await Swal.fire({
            title: 'Modifier la réponse',
            input: 'textarea',
            inputValue: reply.content,
            inputPlaceholder: 'Votre réponse...',
            showCancelButton: true,
            confirmButtonText: 'Modifier',
            cancelButtonText: 'Annuler'
        });
        
        if (!isConfirmed || !newContent?.trim()) return;
        
        await Swal.fire({
            icon: 'info',
            title: 'Modification en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    const updatedReply = await storage.updateReply(
                        currentGallery.id, 
                        photoId, 
                        commentId,
                        replyId, 
                        newContent.trim()
                    );
                    
                    reply.content = updatedReply.content;
                    reply.updatedAt = updatedReply.updatedAt;
                    showCommentsList(photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Modifiée !',
                        text: 'Votre réponse a été modifiée',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur modification réponse:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: error.message || 'Erreur lors de la modification',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur édition réponse:', error);
        showToast('Erreur lors de l\'édition', 'error');
    }
}

async function deleteReply(photoId, commentId, replyId) {
    try {
        const result = await Swal.fire({
            title: 'Supprimer la réponse ?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#EF4444'
        });
        
        if (!result.isConfirmed) return;

        await Swal.fire({
            icon: 'info',
            title: 'Suppression en cours...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    await storage.deleteReply(
                        currentGallery.id, 
                        photoId, 
                        commentId, 
                        replyId
                    );
                    
                    const comments = allComments[photoId] || [];
                    const comment = comments.find(c => c.id === commentId);
                    
                    if (comment && comment.replies) {
                        comment.replies = comment.replies.filter(r => r.id !== replyId);
                    }
                    
                    showCommentsList(photoId);

                    Swal.hideLoading();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Supprimée !',
                        text: 'La réponse a été supprimée',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });

                } catch (error) {
                    Swal.hideLoading();
                    console.error('❌ Erreur suppression réponse:', error);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur',
                        text: error.message || 'Erreur lors de la suppression',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur suppression réponse:', error);
        showToast('Erreur lors de la suppression', 'error');
    }
}

async function toggleReplyLike(photoId, commentId, replyId) {
    try {
        await storage.likeReply(currentGallery.id, photoId, commentId, replyId);
        
        const comments = allComments[photoId] || [];
        const comment = comments.find(c => c.id === commentId);
        
        if (comment && comment.replies) {
            const reply = comment.replies.find(r => r.id === replyId);
            
            if (reply) {
                const hasLiked = reply.likedBy?.includes(currentUser.id);
                
                if (hasLiked) {
                    reply.likes = reply.likes.filter(like => like.userId !== currentUser.id);
                    reply.likedBy = reply.likedBy.filter(id => id !== currentUser.id);
                } else {
                    if (!reply.likes) reply.likes = [];
                    if (!reply.likedBy) reply.likedBy = [];
                    
                    reply.likes.push({
                        id: `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        userId: currentUser.id,
                        likedAt: new Date().toISOString()
                    });
                    
                    reply.likedBy.push(currentUser.id);
                }
            }
        }
        
        showCommentsList(photoId);
        
    } catch (error) {
        console.error('❌ Erreur like réponse:', error);
        showToast('Erreur lors du like', 'error');
    }
}

// ============================================
// ⚙️ MODÉRATION
// ============================================
async function showModerationModal() {
    try {
        moderationPhotos = galleryPhotos.filter(p => p.status === 'pending');
        currentModerationIndex = 0;
        
        if (moderationPhotos.length === 0) {
            showToast('Aucune photo en attente de modération', 'info');
            return;
        }
        
        document.getElementById('moderationPending').textContent = moderationPhotos.length;
        document.getElementById('moderationApproved').textContent = galleryPhotos.filter(p => p.status === 'approved').length;
        document.getElementById('moderationRejected').textContent = galleryPhotos.filter(p => p.status === 'rejected').length;
        
        updateModerationList();
        showCurrentModerationPhoto();
        
        document.getElementById('moderationModal').classList.add('active');
        
    } catch (error) {
        console.error('❌ Erreur ouverture modération:', error);
        showToast('Erreur lors de l\'ouverture de la modération', 'error');
    }
}

function updateModerationList() {
    const list = document.getElementById('moderationList');
    list.innerHTML = '';
    
    if (moderationPhotos.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-color); padding: 20px;">Aucune photo à modérer</p>';
        return;
    }
    
    moderationPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = `moderation-list-item ${index === currentModerationIndex ? 'active' : ''}`;
        item.setAttribute('data-index', index);
        item.setAttribute('title', photo.filename);
        item.style.cursor = 'pointer';
        
        // Set placeholder immediately while loading
        item.innerHTML = `
            <div class="moderation-list-thumb">
                <img src="assets/images/placeholder.jpg" 
                     alt="${photo.filename}"
                     style="opacity: 0.5;">
            </div>
            <div class="moderation-list-info">
                <div class="moderation-list-name">${photo.filename.substring(0, 20)}</div>
                <div class="moderation-list-meta">
                    <i class="fas fa-user"></i> ${photo.uploadedByName.substring(0, 15)}
                </div>
            </div>
        `;
        
        // Load image once URL is available
        if (photo.url) {
            const img = item.querySelector('img');
            const fullImg = new Image();
            fullImg.onload = () => {
                img.src = photo.url;
                img.style.opacity = '1';
            };
            fullImg.onerror = () => {
                img.src = 'assets/images/placeholder.jpg';
                img.style.opacity = '0.5';
            };
            fullImg.src = photo.url;
        }
        
        item.addEventListener('click', () => {
            selectModerationPhoto(index);
        });
        
        list.appendChild(item);
    });
}

function showCurrentModerationPhoto() {
    if (moderationPhotos.length === 0 || currentModerationIndex >= moderationPhotos.length) {
        document.getElementById('currentPhotoContainer').innerHTML = `
            <div class="moderation-complete">
                <i class="fas fa-check-circle"></i>
                <h3>Modération terminée</h3>
                <p>Toutes les photos ont été modérées.</p>
            </div>
        `;
        
        document.getElementById('currentPhotoInfo').innerHTML = '';
        document.getElementById('moderationActions').style.display = 'none';
        return;
    }
    
    const photo = moderationPhotos[currentModerationIndex];
    
    document.getElementById('currentPhotoContainer').innerHTML = `
        <img src="${photo.url}" 
             alt="${photo.filename}" 
             class="moderation-photo">
    `;
    
    document.getElementById('currentPhotoInfo').innerHTML = `
        <div class="moderation-photo-details">
            <h4>${photo.filename}</h4>
            <div class="moderation-photo-meta">
                <div class="moderation-photo-meta-item">
                    <i class="fas fa-user"></i>
                    <span>${photo.uploadedByName}</span>
                </div>
                <div class="moderation-photo-meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(photo.uploadedAt)}</span>
                </div>
                <div class="moderation-photo-meta-item">
                    <i class="fas fa-file"></i>
                    <span>${formatFileSize(photo.size || 0)}</span>
                </div>
            </div>
            
            ${photo.metadata?.description ? `
                <div class="moderation-photo-description">
                    <h5>Description</h5>
                    <p>${escapeHtml(photo.metadata.description)}</p>
                </div>
            ` : ''}
            
            ${photo.metadata?.tags?.length > 0 ? `
                <div class="moderation-photo-tags">
                    <h5>Tags</h5>
                    <div class="tag-list">
                        ${photo.metadata.tags.map(tag => `
                            <span class="tag">${escapeHtml(tag)}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    updateModerationList();
}

function selectModerationPhoto(index) {
    currentModerationIndex = index;
    
    // Update active state in list
    document.querySelectorAll('.moderation-list-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    showCurrentModerationPhoto();
}

async function approveCurrentPhoto() {
    try {
        const photo = moderationPhotos[currentModerationIndex];
        if (!photo) return;
        
        await storage.approvePhoto(currentGallery.id, photo.id);
        
        moderationPhotos.splice(currentModerationIndex, 1);
        
        const approvedCount = parseInt(document.getElementById('moderationApproved').textContent) + 1;
        const pendingCount = parseInt(document.getElementById('moderationPending').textContent) - 1;
        
        document.getElementById('moderationApproved').textContent = approvedCount;
        document.getElementById('moderationPending').textContent = pendingCount;
        
        if (currentModerationIndex >= moderationPhotos.length) {
            currentModerationIndex = Math.max(0, moderationPhotos.length - 1);
        }
        
        updateModerationList();
        showCurrentModerationPhoto();
        showToast('Photo approuvée', 'success');
        
    } catch (error) {
        console.error('❌ Erreur approbation:', error);
        showToast('Erreur lors de l\'approbation', 'error');
    }
}

async function rejectCurrentPhoto() {
    try {
        const photo = moderationPhotos[currentModerationIndex];
        if (!photo) return;
        
        const reason = prompt('Raison du rejet (optionnel):');
        await storage.rejectPhoto(currentGallery.id, photo.id, reason);
        
        moderationPhotos.splice(currentModerationIndex, 1);
        
        const rejectedCount = parseInt(document.getElementById('moderationRejected').textContent) + 1;
        const pendingCount = parseInt(document.getElementById('moderationPending').textContent) - 1;
        
        document.getElementById('moderationRejected').textContent = rejectedCount;
        document.getElementById('moderationPending').textContent = pendingCount;
        
        if (currentModerationIndex >= moderationPhotos.length) {
            currentModerationIndex = Math.max(0, moderationPhotos.length - 1);
        }
        
        updateModerationList();
        showCurrentModerationPhoto();
        showToast('Photo rejetée', 'success');
        
    } catch (error) {
        console.error('❌ Erreur rejet:', error);
        showToast('Erreur lors du rejet', 'error');
    }
}

function closeModerationModal() {
    document.getElementById('moderationModal').classList.remove('active');
    moderationPhotos = [];
}

// ============================================
// 📊 STATISTIQUES
// ============================================
function updateStatistics() {
    const totalGalleries = allGalleries.length;
    const totalPhotos = allGalleries.reduce((sum, g) => sum + (g.photoCount || 0), 0);
    const totalLikes = allGalleries.reduce((sum, g) => sum + (g.likes || 0), 0);
    const totalComments = allGalleries.reduce((sum, g) => sum + (g.comments || 0), 0);
    
    const totalGalleriesEl = document.getElementById('totalGalleries');
    if (totalGalleriesEl) totalGalleriesEl.textContent = totalGalleries;
    
    const totalPhotosEl = document.getElementById('totalPhotos');
    if (totalPhotosEl) totalPhotosEl.textContent = totalPhotos;
    
    const totalLikesEl = document.getElementById('totalLikes');
    if (totalLikesEl) totalLikesEl.textContent = totalLikes;
    
    const totalCommentsEl = document.getElementById('totalComments');
    if (totalCommentsEl) totalCommentsEl.textContent = totalComments;
}

function updateGalleryStatistics() {
    const stats = galleryPhotos.reduce((acc, photo) => {
        acc.totalPhotos++;
        acc.totalLikes += photo.likes?.length || 0;
        acc.totalComments += photo.comments?.length || 0;
        acc.totalViews += photo.views || 0;
        acc.totalDownloads += photo.downloads || 0;
        return acc;
    }, { 
        totalPhotos: 0, 
        totalLikes: 0, 
        totalComments: 0, 
        totalViews: 0,
        totalDownloads: 0 
    });
    
    // Mettre à jour tous les compteurs
    document.getElementById('galleryPhotosCount').textContent = stats.totalPhotos;
    document.getElementById('galleryLikesCount').textContent = stats.totalLikes;
    document.getElementById('galleryCommentsCount').textContent = stats.totalComments;
    document.getElementById('galleryViewsCount').textContent = stats.totalViews;
    document.getElementById('photosCount').textContent = stats.totalPhotos;
}

// ============================================
// 🎯 EXPORT / IMPORT
// ============================================
async function exportGallery() {
    try {
        if (!currentGallery) {
            showToast('Veuillez sélectionner une galerie', 'error');
            return;
        }
        
        showToast('Export en cours...', 'info');
        await storage.downloadGalleryZip(currentGallery.id);
        showToast('Export terminé avec succès', 'success');
        
    } catch (error) {
        console.error('❌ Erreur export:', error);
        showToast('Erreur lors de l\'export', 'error');
    }
}

// ============================================
// 🖼️ MODALES PHOTO ET COMMENTAIRES
// ============================================
function navigatePhoto(direction) {
    const newIndex = currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < filteredPhotos.length) {
        currentPhotoIndex = newIndex;
        const photo = filteredPhotos[newIndex];
        updatePhotoModal(photo);
    }
}

// ============================================
// SYSTÈME MODAL GALERIE - SWIPER CAROUSEL
// ============================================
let photoModalInstance = null;
let photoSwiper = null;

function getOrCreatePhotoModal() {
    if (photoModalInstance) return photoModalInstance;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'photo-modal-instance';
    modal.innerHTML = `
        <div class="modal-content modal-lg photo-modal-content">
            <div class="photo-modal-card">
                <div class="swiper photo-carousel" id="photoCarousel">
                    <div class="swiper-wrapper" id="swiperWrapper"></div>
                    <div class="swiper-pagination"></div>
                </div>
                
                <div class="photo-modal-title-section">
                    <div class="photo-modal-title-event"></div>
                    <div class="photo-modal-title-gallery"></div>
                </div>
                
                <div class="photo-modal-actions">
                    <button class="action-btn like" title="J'aime">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="action-btn comment" title="Commentaires">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="action-btn download" title="Télécharger">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn share" title="Partager">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
                
                <div class="photo-modal-info">
                    <h3 class="photo-modal-title"></h3>
                    <div class="photo-modal-creator">
                        <img class="photo-modal-avatar" alt="Avatar">
                        <div>
                            <div class="photo-modal-name"></div>
                            <div class="photo-modal-date"></div>
                        </div>
                    </div>
                    <div class="photo-modal-stats"></div>
                    <p class="photo-modal-desc"></p>
                </div>
            </div>
            
            <button class="modal-close" title="Fermer">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    photoModalInstance = modal;
    
    // Event listeners
    setupPhotoModalListeners(modal);
    
    return modal;
}

function setupPhotoModalListeners(modal) {
    const closeBtn = modal.querySelector('.modal-close');
    
    // Close button only
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePhotoModal();
    });
    
    // Prevent modal closing on overlay/swiper click - only close button closes it
    const content = modal.querySelector('.modal-content');
    content.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Keyboard navigation - only Escape closes
    const keyHandler = (e) => {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'Escape') closePhotoModal();
    };
    document.addEventListener('keydown', keyHandler);
}

function closePhotoModal() {
    if (photoModalInstance) {
        photoModalInstance.classList.remove('active');
        // Preserve currentPhotoIndex for next time modal opens
        if (photoSwiper) {
            currentPhotoIndex = photoSwiper.activeIndex;
            photoSwiper.destroy();
            photoSwiper = null;
        }
    }
}

function syncSwiperWithPhotos() {
    if (!photoSwiper || filteredPhotos.length === 0) return;
    
    const index = photoSwiper.activeIndex;
    currentPhotoIndex = Math.max(0, Math.min(index, filteredPhotos.length - 1));
    
    const photo = filteredPhotos[currentPhotoIndex];
    if (photo) {
        updatePhotoInfoDisplay(photo).catch(err => {
            console.error('Error updating photo info:', err);
        });
    }
}

async function updatePhotoModal(photo) {
    const modal = getOrCreatePhotoModal();
    const wrapper = modal.querySelector('.swiper-wrapper');
    
    // Find the index of the clicked photo
    const photoIndex = filteredPhotos.findIndex(p => p.id === photo.id);
    if (photoIndex !== -1) {
        currentPhotoIndex = photoIndex;
    }
    
    // Build carousel slides with Swiper
    wrapper.innerHTML = '';
    filteredPhotos.forEach((p) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        const img = document.createElement('img');
        img.src = p.url;
        img.alt = p.filename;
        img.loading = 'lazy';
        img.draggable = false;
        slide.appendChild(img);
        wrapper.appendChild(slide);
    });
    
    // Destroy old swiper if exists
    if (photoSwiper) {
        photoSwiper.destroy();
        photoSwiper = null;
    }
    
    // Initialize Swiper after DOM is ready
    setTimeout(() => {
        const swiperEl = modal.querySelector('.photo-carousel');
        
        photoSwiper = new Swiper(swiperEl, {
            initialSlide: currentPhotoIndex,
            effect: 'slide',
            speed: 300,
            centeredSlides: true,
            preventClicks: false,
            preventClicksPropagation: false,
            pagination: {
                el: '.swiper-pagination',
                type: 'bullets',
                clickable: true,
                dynamicBullets: true,
                dynamicMainBullets: 5,
            },
            on: {
                slideChange: syncSwiperWithPhotos
            }
        });
        
        // Update initial photo info
        updatePhotoInfoDisplay(photo).catch(err => {
            console.error('Error updating photo info:', err);
        });
    }, 50);
    
    // Show modal
    modal.classList.add('active');
}

async function updatePhotoInfoDisplay(photo) {
    const modal = photoModalInstance;
    if (!modal) return;
    
    // Get user info
    const allUsersResponse = await storage.getAllUsers();
    const usersArray = allUsersResponse.data || [];
    const usersMap = {};
    usersArray.forEach(user => {
        usersMap[user.id] = user;
    });
    
    const userInfo = usersMap[photo.uploadedBy];
    const creatorName = userInfo?.firstName || 'Utilisateur';
    const avatar = getGuestAvatarImage(userInfo);
    const uploadDate = getRelativeDate(photo.uploadedAt);
    
    // Update title section
    modal.querySelector('.photo-modal-title-event').textContent = currentEvent.name;
    modal.querySelector('.photo-modal-title-gallery').textContent = currentGallery.name;
    
    // Update actions
    const likeBtn = modal.querySelector('.action-btn.like');
    likeBtn.classList.toggle('active', photo.likedBy?.includes(currentUser.id));
    likeBtn.onclick = () => togglePhotoLike(photo.id);
    
    const commentBtn = modal.querySelector('.action-btn.comment');
    if (currentGallery.settings.allowComments === false) {
        commentBtn.style.display = 'none';
    } else {
        commentBtn.style.display = 'flex';
        commentBtn.onclick = () => showCommentsModal(photo.id);
    }
    
    const downloadBtn = modal.querySelector('.action-btn.download');
    if (currentGallery.settings.allowDownloads === false) {
        downloadBtn.style.display = 'none';
    } else {
        downloadBtn.style.display = 'flex';
        downloadBtn.onclick = () => downloadPhoto(photo.id);
    }
    
    const shareBtn = modal.querySelector('.action-btn.share');
    shareBtn.onclick = () => sharePhoto(photo.id);
    
    // Update info section
    modal.querySelector('.photo-modal-title').textContent = escapeHtml(photo.metadata?.title || photo.filename);
    modal.querySelector('.photo-modal-avatar').src = avatar;
    modal.querySelector('.photo-modal-name').textContent = escapeHtml(creatorName);
    modal.querySelector('.photo-modal-date').textContent = uploadDate;
    
    // Update stats
    const statsEl = modal.querySelector('.photo-modal-stats');
    statsEl.innerHTML = `
        <span class="photo-stat"><i class="fas fa-eye"></i> ${photo.views || 0}</span>
        <span class="photo-stat"><i class="fas fa-heart"></i> ${photo.likes?.length || 0}</span>
        <span class="photo-stat"><i class="fas fa-comment"></i> ${photo.comments?.length || 0}</span>
    `;
    
    // Update description
    const descEl = modal.querySelector('.photo-modal-desc');
    descEl.textContent = photo.metadata?.description || '';
    descEl.style.display = photo.metadata?.description ? 'block' : 'none';
}

function updatePhotoDots(carousel) {
    const modal = photoModalInstance;
    if (!modal || !photoSwiper) return;
    
    // Swiper handles dots automatically via pagination
    // Just ensure activeIndex is synced
    currentPhotoIndex = photoSwiper.activeIndex;
}

// ============================================
// 🛠️ UTILITAIRES
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getEventImage(type) {
    const defaultImages = {
        marriage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
        anniversaire: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=80',
        conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
        corporate: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
        concert: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
        gala: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
        football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
        autre: 'https://images.unsplash.com/photo-1501281668745-f7f579dff10e?w=800&q=80'
    };
    
    return defaultImages[type] || defaultImages.autre;
}

function getTypeLabel(type) {
    const labels = {
        'marriage': 'Mariage',
        'anniversaire': 'Anniversaire',
        'conference': 'Conférence',
        'corporate': 'Corporate',
        'concert': 'Concert',
        'gala': 'Gala',
        'football': 'Football',
        'autre': 'Autre'
    };
    return labels[type] || 'Autre';
}

function getTypeColor(type) {
    const colors = {
        marriage: '#EC4899',
        anniversaire: '#F59E0B',
        conference: '#3B82F6',
        corporate: '#6366F1',
        concert: '#8B5CF6',
        gala: '#D97706',
        football: '#10B981',
        autre: '#6B7280'
    };
    return colors[type] || colors.autre;
}

function getGalleryImage(gallery) {
    // Priorité: utiliser la photo de couverture du serveur
    if (gallery.metadata?.coverPhotoUrl) {
        return gallery.metadata.coverPhotoUrl;
    }
    
    // Si pas de photo de couverture, retourner undefined
    // La couleur de fond sera utilisée via le CSS
    return null;
}

function canModerateGallery(gallery) {
    if (!gallery || !currentUser) return false;
    return gallery.createdBy === currentUser.id || 
           gallery.permissions?.moderators?.includes(currentUser.id) ||
           currentUser.role === 'admin';
}

function canModifyGallery(gallery) {
    if (!gallery || !currentUser) return false;
    return gallery.createdBy === currentUser.id || 
           gallery.permissions?.moderators?.includes(currentUser.id) ||
           currentUser.role === 'admin';
}

function canModifyPhoto(photo) {
    if (!photo || !currentUser) return false;
    return photo.uploadedBy === currentUser.id || 
           canModerateGallery(currentGallery) ||
           currentUser.role === 'admin';
}

function showToast(message, type = 'info') {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: {
                background: type === 'success' ? '#10B981' : 
                          type === 'error' ? '#EF4444' : 
                          type === 'warning' ? '#F59E0B' : 
                          '#3B82F6'
            }
        }).showToast();
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

function showLoading(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'block';
}

function hideLoading(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
}

function resetGalleryForm() {
    const form = document.getElementById('createGalleryForm');
    if (form) form.reset();
    
    galleryCoverFile = null;
    document.getElementById('coverPreview').style.display = 'none';
    document.getElementById('galleryCoverFile').value = '';
}

function generatePaginationHTML(totalPages, currentPage, type) {
    let html = '';
    
    // Bouton précédent
    html += `
        <button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="change${type.charAt(0).toUpperCase() + type.slice(1)}sPage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Pages
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `
                <button class="page-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="change${type.charAt(0).toUpperCase() + type.slice(1)}sPage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="page-btn" style="cursor: default;">...</span>`;
        }
    }
    
    // Bouton suivant
    html += `
        <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="change${type.charAt(0).toUpperCase() + type.slice(1)}sPage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    return html;
}

// ============================================
// 🎤 ÉVÉNEMENTS LISTENERS
// ============================================
function setupEventListeners() {
    // Navigation - Retour aux événements
    document.getElementById('backToEventsBtn')?.addEventListener('click', () => {
        showEventsHome();
    });
    
    document.getElementById('backToGalleriesBtn')?.addEventListener('click', () => {
        // Naviguer vers la liste des galeries de l'événement
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('eventId') || currentEvent?.id;
        
        if (!eventId) {
            showEventsHome();
            return;
        }
        
        // Retourner à la liste des galeries
        const newUrl = `${window.location.pathname}?eventId=${eventId}`;
        window.location.href = newUrl;
    });
    
    // Création galerie
    document.getElementById('createGalleryBtn')?.addEventListener('click', showCreateGalleryModal);
    document.getElementById('createGalleryListBtn')?.addEventListener('click', showCreateGalleryModal);

    document.getElementById('createGalleryStatsBtn')?.addEventListener('click', showCreateGalleryModal);
    document.getElementById('createGalleryActionBtn')?.addEventListener('click', showCreateGalleryModal);

    document.getElementById('createFirstGallery')?.addEventListener('click', showCreateGalleryModal);
    document.getElementById('createFirstGalleryList')?.addEventListener('click', showCreateGalleryModal);
    document.getElementById('closeGalleryModalBtn')?.addEventListener('click', closeCreateGalleryModal);
    document.getElementById('cancelGalleryBtn')?.addEventListener('click', closeCreateGalleryModal);
    document.getElementById('submitGalleryBtn')?.addEventListener('click', createGallery);
            
    document.getElementById('submitGalleryBtn')?.addEventListener('click', createGallery);
    
    document.getElementById('galleryCoverUpload')?.addEventListener('click', () => {
        document.getElementById('galleryCoverFile').click();
    });
    
    document.getElementById('galleryCoverFile')?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleGalleryCoverSelect(e.target.files[0]);
        }
    });
    
    // Navigation création
    document.getElementById('nextToStep2Btn')?.addEventListener('click', () => navigateToStep(2));
    document.getElementById('nextToStep3Btn')?.addEventListener('click', () => navigateToStep(3));
    document.getElementById('nextToStep4Btn')?.addEventListener('click', () => navigateToStep(4));
    document.getElementById('backToStep1Btn')?.addEventListener('click', () => navigateToStep(1));
    document.getElementById('backToStep2Btn')?.addEventListener('click', () => navigateToStep(2));
    document.getElementById('backToStep3Btn')?.addEventListener('click', () => navigateToStep(3));
    
    // Filtres
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            if (filter) {
                currentFilter = filter;
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                filterGalleries();
            }
           
            const photoFilter = this.getAttribute('data-photo-filter');
            if (photoFilter) {
                currentPhotoFilter = photoFilter;
                document.querySelectorAll('[data-photo-filter]').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                filterPhotos();
            }
        });
    });
    
    // Toggle des statistiques dans photosView
    document.getElementById('statsExpandToggle')?.addEventListener('click', function() {
        const container = document.getElementById('statsGridContainer');
        const icon = document.getElementById('statsExpandIcon');
        
        if (container.style.display === 'none') {
            container.style.display = 'grid';
            icon.style.transform = 'rotate(180deg)';
        } else {
            container.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    });
    
    // Vue toggle - Met à jour TOUS les boutons de vue (dans toutes les sections)
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            currentView = this.getAttribute('data-view');
            
            // Mettre à jour TOUS les boutons view-btn dans le document
            document.querySelectorAll('.view-btn[data-view]').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-view') === currentView) {
                    b.classList.add('active');
                }
            });
            
            // Afficher la vue correspondante
            document.querySelectorAll('.galleries-view-container, .stats-view-container').forEach(view => {
                view.style.display = 'none';
            });
            
            switch(currentView) {
                case 'grid':
                    document.getElementById('galleriesGridView').style.display = 'block';
                    break;
                case 'list':
                    document.getElementById('galleriesListView').style.display = 'block';
                    break;
                case 'stats':
                    document.getElementById('statsView').style.display = 'block';
                    renderGalleryStats();
                    break;
            }
            
            displayGalleries();
        });
    });
    
    // Vue toggle photos - Gère les vues photo (grille, liste, statistiques)
    document.querySelectorAll('.view-btn[data-photo-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            const photoView = this.getAttribute('data-photo-view');
            
            // Mettre à jour les boutons actifs
            document.querySelectorAll('.view-btn[data-photo-view]').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-photo-view') === photoView) {
                    b.classList.add('active');
                }
            });
            
            // Afficher la vue correspondante
            document.getElementById('photosGridView').style.display = 'none';
            document.getElementById('photosStatsView').style.display = 'none';
            
            if (photoView === 'grid') {
                document.getElementById('photosGridView').style.display = 'block';
                document.getElementById('photosGrid').style.display = 'grid';
                document.getElementById('photosListView').style.display = 'none';
                displayPhotos('grid');
            } else if (photoView === 'list') {
                document.getElementById('photosGridView').style.display = 'block';
                document.getElementById('photosGrid').style.display = 'none';
                document.getElementById('photosListView').style.display = 'block';
                displayPhotos('list');
            } else if (photoView === 'stats') {
                document.getElementById('photosStatsView').style.display = 'block';
                renderPhotosStats();
            }
        });
    });
    
    
    
    // Recherche
    document.getElementById('searchGalleries')?.addEventListener('input', debounce(function() {
        currentSearch = this.value.trim();
        currentPage = 1;
        filterGalleries();
    }, 300));
    
    // Mise à jour du preview en temps réel
    const previewFormInputs = [
        'galleryName',
        'galleryDescription',
        'galleryCategory',
        'galleryIsPublic',
        'moderationRequired',
        'allowComments',
        'allowLikes',
        'allowDownloads',
        'maxPhotos',
        'maxPhotoSize'
    ];
    
    previewFormInputs.forEach(inputId => {
        const el = document.getElementById(inputId);
        if (el) {
            el.addEventListener('change', updatePreview);
            el.addEventListener('input', updatePreview);
        }
    });
    
    document.getElementById('searchPhotos')?.addEventListener('input', debounce(function() {
        currentGallerySearch = this.value.trim();
        currentPhotoPage = 1;
        filterPhotos();
    }, 300));
    
    // Photos
    document.getElementById('addPhotosBtn')?.addEventListener('click', showAddPhotosModal);
    document.getElementById('addFirstPhotoBtn')?.addEventListener('click', showAddPhotosModal);
    document.getElementById('createFirstPhoto')?.addEventListener('click', showAddPhotosModal);
    document.getElementById('closeAddPhotosBtn')?.addEventListener('click', closeAddPhotosModal);
    document.getElementById('submitPhotosBtn')?.addEventListener('click', submitPhotos);
    
    // Actions galerie détail
    document.getElementById('editGalleryCurrentBtn')?.addEventListener('click', () => {
        if (currentGallery) {
            editGallery(currentGallery.id);
        }
    });
    
    document.getElementById('exportCurrentGalleryBtn')?.addEventListener('click', () => {
        if (currentGallery) {
            exportGallery(currentGallery.id);
        }
    });
    
    document.getElementById('viewAllPhotosBtn')?.addEventListener('click', showAddPhotosModal);
    
    // Commentaires
    document.getElementById('closeCommentsBtn')?.addEventListener('click', () => {
        document.getElementById('commentsModal').classList.remove('active');
    });
    
    document.getElementById('submitCommentBtn')?.addEventListener('click', submitComment);
    document.getElementById('commentInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitComment();
        }
    });
    
    // Modération
    document.getElementById('moderationBtn')?.addEventListener('click', showModerationModal);
    document.getElementById('moderationPhotoBtn')?.addEventListener('click', showModerationModal);
    document.getElementById('moderationPhotoStatsBtn')?.addEventListener('click', showModerationModal);
    document.getElementById('closeModerationBtn')?.addEventListener('click', closeModerationModal);
    document.getElementById('approvePhotoBtn')?.addEventListener('click', approveCurrentPhoto);
    document.getElementById('rejectPhotoBtn')?.addEventListener('click', rejectCurrentPhoto);
    document.getElementById('skipPhotoBtn')?.addEventListener('click', () => {
        currentModerationIndex = (currentModerationIndex + 1) % moderationPhotos.length;
        showCurrentModerationPhoto();
    });
    
    // Export
    document.getElementById('exportGalleryBtn')?.addEventListener('click', exportGallery);
    
    // Mode de vue événements
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            eventsViewMode = this.getAttribute('data-mode');
            document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderEventsList();
        });
    });
    
    // Déconnexion
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        storage.logout();
        window.location.href = 'index.html';
    });
}


function setupCustomEventListeners() {
    if (typeof storage === 'undefined') return;
    if(currentEvent === null) return;
    
    
   

    storage.on('gallery:created', (gallery) => {
        if (currentEvent?.id === gallery.eventId) {
            loadGalleries();
        }
    });
    
    storage.on('gallery:updated', (gallery) => {
        if (currentEvent?.id === gallery.eventId) {
            loadGalleries();
        }
    });
    
    storage.on('gallery:deleted', (data) => {
        if (currentEvent?.id === data.eventId) {
            loadGalleries();
        }
    });
    
    storage.on('photo:added', (photo) => {
        if (currentGallery?.id === photo.galleryId) {
            loadPhotos();
        }
    });
    
    storage.on('photo:deleted', (data) => {
        if (currentGallery?.id === data.galleryId) {
            loadPhotos();
        }
    });
    
    storage.on('photo:approved', (data) => {
        if (currentGallery?.id === data.galleryId) {
            loadPhotos();
        }
    });
    
    storage.on('photo:rejected', (data) => {
        if (currentGallery?.id === data.galleryId) {
            loadPhotos();
        }
    });
    
    storage.on('like:added', (data) => {
        console.log('❤️ Like ajouté:', data);
    });
    
    storage.on('comment:added', (comment) => {
        console.log('💬 Commentaire ajouté:', comment);
    });
}

function handleGalleryCoverSelect(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Veuillez sélectionner une image', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('L\'image ne doit pas dépasser 5MB', 'error');
        return;
    }
    
    galleryCoverFile = file;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('coverPreviewImage').src = e.target.result;
        document.getElementById('coverPreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    showToast('Image sélectionnée avec succès', 'success');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// 🌐 EXPOSITION DES FONCTIONS GLOBALES
// ============================================
window.selectEvent = selectEvent;
window.selectGallery = selectGallery;
window.viewPhoto = viewPhoto;
window.togglePhotoLike = togglePhotoLike;
window.downloadPhoto = downloadPhoto;
window.approvePhoto = approvePhoto;
window.rejectPhoto = rejectPhoto;
window.deletePhoto = deletePhoto;
window.editGallery = editGallery;
window.deleteGallery = deleteGallery;
window.showCreateGalleryModal = showCreateGalleryModal;
window.closeCreateGalleryModal = closeCreateGalleryModal;
window.createGallery = createGallery;
window.showAddPhotosModal = showAddPhotosModal;
window.closeAddPhotosModal = closeAddPhotosModal;
window.submitPhotos = submitPhotos;
window.updateUploadedPhotoTitle = updateUploadedPhotoTitle;
window.updateUploadedPhotoDescription = updateUploadedPhotoDescription;
window.updateUploadedPhotoTags = updateUploadedPhotoTags;
window.removeUploadedPhoto = removeUploadedPhoto;
window.navigateToStep = navigateToStep;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.showToast = showToast;
window.submitComment = submitComment;
window.toggleCommentLike = toggleCommentLike;
window.deleteComment = deleteComment;
window.editComment = editComment;
window.showModerationModal = showModerationModal;
window.closeModerationModal = closeModerationModal;
window.approveCurrentPhoto = approveCurrentPhoto;
window.rejectCurrentPhoto = rejectCurrentPhoto;
window.selectModerationPhoto = selectModerationPhoto;
window.exportGallery = exportGallery;
window.navigatePhoto = navigatePhoto;
window.changeGalleriesPage = changeGalleriesPage;
window.changePhotosPage = changePhotosPage;
window.sharePhoto = sharePhoto;
window.togglePhotoLike = togglePhotoLike;
window.showCommentsModal = showCommentsModal;
window.displayPhotos = displayPhotos;
window.debounce = debounce;
window.handleGalleryCoverSelect = handleGalleryCoverSelect;
