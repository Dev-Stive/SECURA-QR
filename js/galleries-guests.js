/**
 * SECURA Gallery Management System - GUEST VIEW v3.0.0
 * Ultra-Complete Production-Ready Implementation
 * Full event-driven architecture with read-only permissions for guests
 * @author SECURA Team
 * @version 3.0.0
 * @description Complete gallery management with event handling, real-time updates, comments, likes - Guest Edition
 */


// ============================================
// 1. GLOBAL STATE VARIABLES
// ============================================

let currentEvent = null;
let currentUser = null;
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
let currentPhotoIndex = 0;
let currentCommentPage = 1;

const galleriesPerPage = 12;
const photosPerPage = 20;
const commentsPerPage = 10;

let allComments = {};
let allLikes = [];
let currentViewMode = 'galleriesView';
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
    try {
        // Récupérer TOUTES les données de session de manière uniforme
        const sessionDetails = await storage.getCurrentSessionDetails();
        
        if (!sessionDetails?.success || !sessionDetails?.data) {
            showToast('Session expirée. Veuillez vous reconnecter.', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }
        
        // Récupérer l'événement et l'invité de la session
        const sessionData = sessionDetails.data;
        currentEvent = sessionData.event;
        currentUser = sessionData.guest || sessionData.table;
        
        if (!currentEvent) {
            showToast('Événement non trouvé', 'error');
            return;
        }
        
        // Initialiser les écouteurs
        setupEventListeners();
        
        // Charger les galeries de l'événement (vue par défaut)
        document.getElementById('galleriesView').style.display = 'block';
        document.getElementById('photosView').style.display = 'none';
        currentViewMode = 'galleriesView';
        
        document.getElementById('eventNameDisplay').innerHTML = `
            <i class="fas fa-calendar-alt"></i>
            <span>${escapeHtml(currentEvent.name)}</span>
        `;
        
        await loadGalleries();
        
        document.title = `SECURA | Galeries - ${currentEvent.name}`;
        
    } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        showToast('Erreur lors de l\'initialisation', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
});

// ============================================
// 🖼️ GESTION DES GALERIES
// ============================================
async function loadGalleries() {
    try {
        showLoading('galleriesLoader');
        
        // Réinitialiser l'état
        allGalleries = [];
        filteredGalleries = [];
        currentPage = 1;
        currentView = 'grid';
        currentFilter = 'all';
        currentSearch = '';
        
        // Vider les conteneurs DOM
        const galleriesGrid = document.getElementById('galleriesGrid');
        const galleriesListContent = document.getElementById('galleriesListContent');
        
        if (galleriesGrid) galleriesGrid.innerHTML = '';
        if (galleriesListContent) galleriesListContent.innerHTML = '';
        
        // Récupérer les galeries de l'événement
        const galleries = await storage.getGalleries(currentEvent.id, {}, true);
        allGalleries = galleries || [];
        
        // Enrichir chaque galerie avec les statistiques
        for (let gallery of allGalleries) {
            try {
                const stats = await storage.getGalleryStats(gallery.id);
                
                if (stats === null) {
                    gallery.deleted = true;
                    continue;
                }
                
                gallery.stats = stats;
                gallery.photoCount = gallery.photos?.length || 0;
                gallery.likes = stats?.totalLikes || 0;
                gallery.comments = stats?.totalComments || 0;
                gallery.views = stats?.totalViews || 0;
                gallery.downloads = stats?.totalDownloads || 0;
                
                // Enrichir avec le nom du créateur
                if (gallery.createdBy && !gallery.createdByName) {
                    const creatorInfo = await storage.getUserById(gallery.createdBy);
                    gallery.createdByName = `${creatorInfo.data.firstName} ${creatorInfo.data.lastName}`;
                    gallery.createdByAvatar = creatorInfo.avatar;
                }
            } catch (err) {
                console.warn('⚠️ Erreur stats galerie:', err);
                gallery.photoCount = gallery.photos?.length || 0;
                gallery.likes = 0;
                gallery.comments = 0;
                gallery.views = 0;
                gallery.downloads = 0;
            }
        }
        
        // Filtrer les galeries marquées pour suppression
        allGalleries = allGalleries.filter(g => !g.deleted);
        
        // Filtrer et afficher
        filterGalleries();
        
    } catch (error) {
        console.error('❌ Erreur chargement galeries:', error);
        allGalleries = [];
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
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
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
        
        const engagementScore = photoCount > 0 ? Math.round(((totalLikes + totalComments + totalDownloads) / (photoCount * 3)) * 100) : 0;
        const engagementColor = engagementScore > 70 ? '#10B981' : engagementScore > 40 ? '#F59E0B' : '#EF4444';
        
        let backgroundStyle = '';
        if (coverUrl) {
            backgroundStyle = `background: linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%), url('${coverUrl}'); background-size: cover; background-position: center;`;
        } else {
            backgroundStyle = `background: linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}80 50%, ${categoryColor}40 100%);`;
        }
        
        const tagsHTML = (gallery.metadata?.tags || []).slice(0, 3).map(tag => 
            `<span class="tag-badge">#${escapeHtml(tag)}</span>`
        ).join('');
        
        const creatorName = gallery.createdByName || 'Anonyme';
        const userResponse = await storage.getUserById(gallery.createdBy);
        const user = userResponse?.data || userResponse;
        const avatar =  getUserAvatar(user);

        
        return `
            <div class="gallery-card" data-gallery-id="${gallery.id}" title="${escapeHtml(gallery.name)}" onclick="selectGallery('${gallery.id}'); event.stopPropagation();" style="cursor: pointer;">
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
                    <div class="gallery-card-title">
                        <h3>${escapeHtml(gallery.name)}</h3>
                        <p class="gallery-description">${escapeHtml(gallery.description || 'Aucune description')}</p>
                    </div>
                    
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
                
                <div class="gallery-card-content">
                    ${tagsHTML ? `<div class="gallery-tags">${tagsHTML}</div>` : ''}
                    
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
                    
                    <div class="gallery-creator">
                        <div class="creator-avatar profile-avatar" style="background: url(${avatar});background-size: cover;">
                        </div>
                        <div class="creator-info">
                            <div class="creator-label">Créée par</div>
                            <div class="creator-name">${escapeHtml(creatorName)}</div>
                        </div>
                    </div>
                </div>
                
                
            </div>
        `;
    }));
    
    addGalleryCardListeners();
}

function addGalleryCardListeners() {
    const grid = document.getElementById('galleriesGrid');
    if (!grid) return;
    
    grid.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('.expand-btn');
        if (!expandBtn) return;
        
        e.stopPropagation();
        const card = expandBtn.closest('.gallery-card');
        
        document.querySelectorAll('.gallery-card.expanded').forEach(c => {
            if (c !== card) c.classList.remove('expanded');
        });
        
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
        const coverUrl = getGalleryImage(gallery);
        const category = GALLERY_CATEGORIES[gallery.metadata?.category || 'general'];
        
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
                    </div>
                </div>
            </div>
        `;
    });
    
    listHTML += `</div>`;
    
    listContainer.innerHTML = listHTML;
    addGalleryListItemListeners();
}

function addGalleryListItemListeners() {
    document.querySelectorAll('.gallery-list-item').forEach(item => {
        const header = item.querySelector('.gallery-list-header');
        const expandContent = item.querySelector('.gallery-list-expand');
        const expandToggle = item.querySelector('.expand-toggle i');
        
        header.addEventListener('click', () => {
            const isExpanded = expandContent.style.display !== 'none';
            
            document.querySelectorAll('.gallery-list-item').forEach(other => {
                if (other !== item) {
                    other.querySelector('.gallery-list-expand').style.display = 'none';
                    other.querySelector('.expand-toggle i').style.transform = 'rotate(0deg)';
                    other.classList.remove('expanded');
                }
            });
            
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
    
    if (emptyState) emptyState.style.display = hasGalleries ? 'none' : 'flex';
    if (emptyStateList) emptyStateList.style.display = hasGalleries ? 'none' : 'flex';
    
    if (!hasGalleries) {
        if (galleriesGrid) galleriesGrid.innerHTML = '';
        if (galleriesListContent) galleriesListContent.innerHTML = '';
    }
}

// ============================================
// 📸 GESTION DES PHOTOS DANS UNE GALERIE
// ============================================
async function selectGallery(galleryId) {
    try {
        if (!currentEvent?.id) {
            throw new Error('ID événement manquant');
        }
        
        await loadGalleryDetail(galleryId);
        
        // Basculer vers la vue photos
        document.getElementById('galleriesView').style.display = 'none';
        document.getElementById('photosView').style.display = 'block';
        currentViewMode = 'photosView';
        
        // Scroll vers le haut
        window.scrollTo(0, 0);
        
    } catch (error) {
        console.error('❌ Erreur sélection galerie:', error);
        showToast('Erreur lors du chargement de la galerie', 'error');
    }
}

async function loadGalleryDetail(galleryId) {
    try {
        Loading('photosLoader');
        
        currentGallery = await storage.getGallery(galleryId);
        if (!currentGallery) {
            throw new Error('Galerie non trouvée');
        }
        
        document.getElementById('currentGalleryName').textContent = currentGallery.name;
        document.getElementById('currentGalleryDescription').textContent = currentGallery.description || 'Aucune description';
        
        await loadPhotos();
        
    } catch (error) {
        console.error('❌ Erreur chargement galerie détail:', error);
        showToast('Erreur lors du chargement de la galerie', 'error');
    } finally {
        hideLoad('photosLoader');
    }
}

async function loadPhotos() {
    try {
        if (!currentGallery) return;
        
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
    
    filteredPhotos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
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
            const hasLiked = photo.likedBy?.includes(currentUser.id);
            const globalIndex = filteredPhotos.findIndex(p => p.id === photo.id);
            const photoUrl = photo.url || photo.thumbnails?.small || 'assets/images/placeholder.jpg';

            const userInfo = usersMap[photo.uploadedBy];
            const creatorName = userInfo?.firstName || 'Utilisateur';
            const avatar = getUserAvatar(userInfo);
            const uploadDate = getRelativeDate(photo.uploadedAt);

            return `
                <div class="photo-card" 
                     data-photo-id="${photo.id}" 
                     data-index="${globalIndex}"
                     onclick="viewPhoto('${photo.id}', ${globalIndex})">
                    <div class="photo-card-image" style="background-image: url('${photoUrl}');"></div>
                    <div class="photo-card-overlay"></div>
                    
                    <div class="photo-card-actions-overlay">
                        <button class="action-btn like ${hasLiked ? 'active' : ''}" 
                                data-photo-id="${photo.id}"
                                onclick="event.stopPropagation(); togglePhotoLike('${photo.id}')" title="J'aime">
                            <i class="fas fa-heart"></i>
                        </button>
                        ${currentGallery.settings.allowComments !== false ? `
                            <button class="action-btn comment" onclick="event.stopPropagation(); showCommentsModal('${photo.id}')" title="Commentaires">
                                <i class="fas fa-comment"></i>
                            </button>
                        ` : ''}
                        ${currentGallery.settings.allowDownloads !== false ? `
                            <button class="action-btn download" onclick="event.stopPropagation(); downloadPhoto('${photo.id}')" title="Télécharger">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn share" onclick="event.stopPropagation(); sharePhoto('${photo.id}')" title="Partager">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                    
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
                </div>
            `;
        }).join('');

    } else if (viewType === 'list') {
        photosList.innerHTML = photosToShow.map((photo, index) => {
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
                        </div>
                    </div>
                    <div class="photo-list-actions">
                        <button class="action-btn like ${hasLiked ? 'active' : ''}" 
                                data-photo-id="${photo.id}"
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
// 👁️ VUE ET GESTION DES PHOTOS
// ============================================
async function viewPhoto(photoId, index = 0) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        currentPhotoIndex = index;
        
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
        
        // Mettre à jour TOUS les boutons like pour cette photo (grille, liste, modal)
        const allLikeButtons = document.querySelectorAll(`[data-photo-id="${photoId}"] .like`);
        allLikeButtons.forEach(btn => {
            btn.classList.toggle('active', !hasLiked);
        });
        
        // Mettre à jour le compteur de likes sur TOUS les boutons
        const allLikeSpans = document.querySelectorAll(`[data-photo-id="${photoId}"] .like span`);
        allLikeSpans.forEach(span => {
            span.textContent = photo.likes.length;
        });
        
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

        await Swal.fire({
            icon: 'info',
            title: 'Téléchargement...',
            html: '<p>Veuillez patienter</p>',
            allowOutsideClick: false,
            didOpen: async () => {
                Swal.showLoading();

                try {
                    photo.downloads = (photo.downloads || 0) + 1;
                    await storage.updatePhoto(currentGallery.id, photoId, {
                        downloads: photo.downloads
                    });
                    
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

async function sharePhoto(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        const shareUrl = `${window.location.origin}?photoId=${photoId}`;
        
        if (navigator.share) {
            await navigator.share({
                title: photo.metadata?.title || photo.filename,
                text: photo.metadata?.description || 'Découvrez cette photo',
                url: shareUrl
            });
        } else {
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




 function getUserAvatar(user) {
        if (!user) return null;

        const gender = determineGender(user.firstName);
        
        const genderFolder = gender === 'female' ? 'femme' : 'homme';
        const defaultAvatarPath = `/assets/images/${genderFolder}.png`;
        
        if (user.avatar && user.avatar.url) {
            return user.avatar.url;
        }
        
        return defaultAvatarPath;
    }

    /**
     * Déterminer le genre d'une personne basé sur son prénom
     * Utilise une liste de prénoms masculins et féminins courants
     */
    function determineGender(firstName) {
        if (!firstName) return 'male';
        
        const name = firstName.toLowerCase().trim();
        
        const femaleNames = [
            'marie', 'sandra', 'anne', 'christine', 'monique', 'isabelle',
            'françoise', 'catherine', 'jennifer', 'jessica', 'sarah', 'laura',
            'emma', 'olivia', 'sophia', 'ava', 'isabella', 'mia', 'charlotte',
            'amelia', 'harper', 'evelyn', 'abigail', 'elizabeth', 'natalie',
            'grace', 'hannah', 'lily', 'rose', 'victoria', 'alice','stessy', 
            'caroline', 'sylvie', 'valérie', 'corinne', 'marion', 'audrey',    
            'sophie', 'pauline', 'sandrine', 'nadine', 'céline', 'valérie',
            'stéphanie', 'martine', 'sylvie', 'nathalie', 'veronique',
            'sabine', 'jacqueline', 'josée', 'josiane', 'josyane', 'joëlle',
            'josianne', 'josèphe', 'ghislaine', 'germaine', 'georgette',
            'fernande', 'ernestine', 'edmée', 'marcelle', 'michèle',
            'élise', 'margot', 'marguerite', 'martiale', 'marthe', 'martha'
        ];
        
        
        if (femaleNames.includes(name)) {
            return 'female';
        }
        
        return 'male';
    }

async function showCommentsList(photoId) {
    const container = document.getElementById('commentsList');
    const comments = allComments[photoId] || [];
    
    const allUsersResponse = await storage.getAllUsers();
    const usersArray = allUsersResponse.data || [];
    
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
        const avatar = getUserAvatar(userInfo);
                   
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
        const result = await Swal.fire({
            title: 'Supprimer le commentaire ?',
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
// 💬 RÉPONSES AUX COMMENTAIRES
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
    if (replyId) {
        document.querySelectorAll('.nested-reply-form').forEach(el => el.remove());

        const replyItem = document.querySelector(`.reply-item[data-reply-id="${replyId}"]`);
        if (replyItem) {
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
        const replyForm = document.getElementById(`reply-form-${commentId}`);
        if (replyForm) {
            replyForm.style.display = 'block';
            const input = document.getElementById(`reply-input-${commentId}`);
            if (input) input.focus();
        }
    }
}

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
// 📊 STATISTIQUES
// ============================================
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
    
    document.getElementById('galleryPhotosCount').textContent = stats.totalPhotos;
    document.getElementById('galleryLikesCount').textContent = stats.totalLikes;
    document.getElementById('galleryCommentsCount').textContent = stats.totalComments;
    document.getElementById('galleryViewsCount').textContent = stats.totalViews;
    document.getElementById('photosCount').textContent = stats.totalPhotos;
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
                    <button class="action-btn like" data-photo-id="" title="J'aime">
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
    
    setupPhotoModalListeners(modal);
    
    return modal;
}

function setupPhotoModalListeners(modal) {
    const closeBtn = modal.querySelector('.modal-close');
    
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePhotoModal();
    });
    
    const content = modal.querySelector('.modal-content');
    content.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    const keyHandler = (e) => {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'Escape') closePhotoModal();
    };
    document.addEventListener('keydown', keyHandler);
}

function closePhotoModal() {
    if (photoModalInstance) {
        photoModalInstance.classList.remove('active');
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
    
    const photoIndex = filteredPhotos.findIndex(p => p.id === photo.id);
    if (photoIndex !== -1) {
        currentPhotoIndex = photoIndex;
    }
    
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
    
    if (photoSwiper) {
        photoSwiper.destroy();
        photoSwiper = null;
    }
    
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
        
        updatePhotoInfoDisplay(photo).catch(err => {
            console.error('Error updating photo info:', err);
        });
    }, 50);
    
    modal.classList.add('active');
}

async function updatePhotoInfoDisplay(photo) {
    const modal = photoModalInstance;
    if (!modal) return;
    
    const allUsersResponse = await storage.getAllUsers();
    const usersArray = allUsersResponse.data || [];
    const usersMap = {};
    usersArray.forEach(user => {
        usersMap[user.id] = user;
    });
    
    const userInfo = usersMap[photo.uploadedBy];
    const creatorName = userInfo?.firstName || 'Utilisateur';
    const avatar = getUserAvatar(userInfo);
    const uploadDate = getRelativeDate(photo.uploadedAt);
    
    modal.querySelector('.photo-modal-title-event').textContent = currentEvent.name;
    modal.querySelector('.photo-modal-title-gallery').textContent = currentGallery.name;
    
    const likeBtn = modal.querySelector('.action-btn.like');
    likeBtn.setAttribute('data-photo-id', photo.id);
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
    
    modal.querySelector('.photo-modal-title').textContent = escapeHtml(photo.metadata?.title || photo.filename);
    modal.querySelector('.photo-modal-avatar').src = avatar;
    modal.querySelector('.photo-modal-name').textContent = escapeHtml(creatorName);
    modal.querySelector('.photo-modal-date').textContent = uploadDate;
    
    const statsEl = modal.querySelector('.photo-modal-stats');
    statsEl.innerHTML = `
        <span class="photo-stat"><i class="fas fa-eye"></i> ${photo.views || 0}</span>
        <span class="photo-stat"><i class="fas fa-heart"></i> ${photo.likes?.length || 0}</span>
        <span class="photo-stat"><i class="fas fa-comment"></i> ${photo.comments?.length || 0}</span>
    `;
    
    const descEl = modal.querySelector('.photo-modal-desc');
    descEl.textContent = photo.metadata?.description || '';
    descEl.style.display = photo.metadata?.description ? 'block' : 'none';
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

function getGalleryImage(gallery) {
    if (gallery.metadata?.coverPhotoUrl) {
        return gallery.metadata.coverPhotoUrl;
    }
    return null;
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

function Loading(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'block';
}

function hideLoad(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
}

function generatePaginationHTML(totalPages, currentPage, type) {
    let html = '';
    
    html += `
        <button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="change${type.charAt(0).toUpperCase() + type.slice(1)}sPage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
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
    
    html += `
        <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="change${type.charAt(0).toUpperCase() + type.slice(1)}sPage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    return html;
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
// 🎤 ÉVÉNEMENTS LISTENERS
// ============================================
function setupEventListeners() {
    // Navigation - Retour aux galeries
    document.getElementById('backToGalleriesBtn')?.addEventListener('click', () => {
        // Basculer vers la vue galeries
        document.getElementById('galleriesView').style.display = 'block';
        document.getElementById('photosView').style.display = 'none';
        currentViewMode = 'galleriesView';
        
        // Réinitialiser l'état de la galerie courante
        currentGallery = null;
        galleryPhotos = [];
        filteredPhotos = [];
        
        // Scroll vers le haut
        window.scrollTo(0, 0);
    });
    
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
    
    // Vue toggle
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            currentView = this.getAttribute('data-view');
            
            document.querySelectorAll('.view-btn[data-view]').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-view') === currentView) {
                    b.classList.add('active');
                }
            });
            
            displayGalleries();
        });
    });
    
    document.querySelectorAll('.view-btn[data-photo-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            const photoView = this.getAttribute('data-photo-view');
            
            document.querySelectorAll('.view-btn[data-photo-view]').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-photo-view') === photoView) {
                    b.classList.add('active');
                }
            });
            
            document.getElementById('photosGridView').style.display = 'none';
            
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
            }
        });
    });
    
    // Recherche
    document.getElementById('searchGalleries')?.addEventListener('input', debounce(function() {
        currentSearch = this.value.trim();
        currentPage = 1;
        filterGalleries();
    }, 300));
    
    document.getElementById('searchPhotos')?.addEventListener('input', debounce(function() {
        currentGallerySearch = this.value.trim();
        currentPhotoPage = 1;
        filterPhotos();
    }, 300));
    
    // Commentaires
    document.getElementById('closeCommentsBtn')?.addEventListener('click', () => {
        document.getElementById('commentsModal').classList.remove('active');
    });
    
    document.getElementById('submitCommentBtn')?.addEventListener('click', submitComment);
}

console.log('✅ SECURA Galleries Guest View v3.0.0 chargé et prêt !');
