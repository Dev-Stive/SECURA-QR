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
const GALLERY_IMAGES = {
    'general': 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop',
    'vip': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop',
    'backstage': 'https://images.unsplash.com/photo-1492684223066-e9e4aab4d25e?w=400&h=300&fit=crop',
    'official': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=300&fit=crop',
    'guest': 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop',
    'behind_scenes': 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop'
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
    
    eventsList = await storage.getAllEvents();
    currentUser = await storage.getProfile();
    
    // Initialiser les écouteurs
    setupEventListeners();
    setupCustomEventListeners();
    
    if (eventId) {
        document.getElementById('eventsHomeView').style.display = 'none';
        document.getElementById('galleriesView').style.display = 'block';
        await selectEvent(eventId);
    } else {
        document.getElementById('eventsHomeView').style.display = 'block';
        document.getElementById('galleriesView').style.display = 'none';
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
            window.location.href = 'login.html';
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

async function selectEvent(eventId) {
    try {
        showLoading('galleriesLoader');
        
        // Récupérer l'événement via l'API
        const event = await storage.getEventById(eventId);
        if (!event) {
            throw new Error('Événement introuvable');
        }
        
        currentEvent = event;
        
        // Mettre à jour l'URL
        history.pushState({}, '', `?eventId=${eventId}`);
        
        // Mettre à jour l'interface
        document.getElementById('eventsHomeView').style.display = 'none';
        document.getElementById('galleriesView').style.display = 'block';
        
        document.getElementById('eventNameDisplay').innerHTML = `
            <i class="fas fa-calendar-alt"></i>
            <span>${escapeHtml(currentEvent.name)}</span>
        `;
        
        document.title = `SECURA | Galeries - ${currentEvent.name}`;
        
        await loadGalleries();
        
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
        
        // Récupérer toutes les galeries via l'API
        const galleries = await storage.getGalleries(currentEvent.id);
        allGalleries = galleries || [];
        
        // Enrichir chaque galerie avec les statistiques
        for (let gallery of allGalleries) {
            try {
                const stats = await storage.getGalleryStats(gallery.id);
                gallery.stats = stats;
                // Les stats proviennent du serveur avec ces champs exacts
                gallery.photoCount = gallery.photos?.length || 0;  // Compter les photos réellement
                gallery.likes = stats?.totalLikes || 0;
                gallery.comments = stats?.totalComments || 0;
                gallery.views = stats?.totalViews || 0;
                gallery.downloads = stats?.totalDownloads || 0;
                gallery.pendingPhotos = gallery.moderation?.pendingPhotos?.length || 0;
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

function renderGalleriesGrid() {
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
    
    grid.innerHTML = galleriesToShow.map(gallery => {
        const category = GALLERY_CATEGORIES[gallery.metadata?.category || 'general'];
        const stats = gallery.stats || {};
        const coverUrl = getGalleryImage(gallery);
        const photoCount = gallery.photos?.length || stats.totalPhotos || 0;
        const totalViews = stats.totalViews || 0;
        
        return `
            <div class="gallery-card" data-gallery-id="${gallery.id}" title="${escapeHtml(gallery.name)}">
                <div class="gallery-card-image" style="background: linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%), url('${coverUrl}'); background-size: cover; background-position: center;">
                    <div class="gallery-overlay"></div>
                    <div class="gallery-card-header">
                        <div class="gallery-badges-top">
                            <span class="badge-pill ${gallery.isPublic ? 'badge-public' : 'badge-private'}">
                                <i class="fas ${gallery.isPublic ? 'fa-globe' : 'fa-lock'}"></i> ${gallery.isPublic ? 'Public' : 'Private'}
                            </span>
                            <span class="badge-pill" style="background: ${category.color};">
                                <i class="fas ${category.icon}"></i>
                            </span>
                        </div>
                        <div class="gallery-title-overlay">
                            <h3 class="gallery-title-text">${escapeHtml(gallery.name)}</h3>
                            <p class="gallery-description">${escapeHtml(gallery.description || 'Aucune description')}</p>
                    
                        </div>
                    </div>
                    <div class="gallery-quick-stats">
                        <div class="quick-stat"><i class="fas fa-images"></i> ${photoCount}</div>
                        <div class="quick-stat"><i class="fas fa-heart"></i> ${stats.totalLikes || 0}</div>
                        <div class="quick-stat"><i class="fas fa-eye"></i> ${totalViews}</div>
                    </div>
                </div>
                
                <div class="gallery-card-content">
                    <p class="gallery-description">${escapeHtml(gallery.description || 'Aucune description')}</p>
                    <div class="gallery-stats">
                        <div class="stat"><i class="fas fa-comment" style="color: #10B981;"></i> <span>${stats.totalComments || 0} comm</span></div>
                        <div class="stat"><i class="fas fa-download" style="color: #F59E0B;"></i> <span>${stats.totalDownloads || 0} téléch</span></div>
                    
                    <div class="gallery-meta">
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(gallery.createdAt)}</span>
                        </div>
                        ${gallery.metadata?.location ? `
                        <div class="meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${escapeHtml(gallery.metadata.location)}</span>
                        </div>` : ''}
                    </div>
                </div>
                
                <div class="gallery-card-footer">
                    <button class="btn btn-primary" onclick="selectGallery('${gallery.id}')">
                        <i class="fas fa-eye"></i> Voir
                    </button>
                    <div class="gallery-actions">
                        ${canModifyGallery(gallery) ? `
                            <button class="action-btn edit" onclick="editGallery('${gallery.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteGallery('${gallery.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderGalleriesList() {
    const tbody = document.getElementById('galleriesListBody');
    const table = tbody?.closest('table'); 
    const emptyState = document.getElementById('emptyStateGalleriesList');
    
    if (!tbody) return;
    
    const startIndex = (currentPage - 1) * galleriesPerPage;
    const endIndex = startIndex + galleriesPerPage;
    const galleriesToShow = filteredGalleries.slice(startIndex, endIndex);
    
    if (galleriesToShow.length === 0) {
        // Masquer la table et afficher le message vide
        if (table) table.style.display = 'none';
        
        // Afficher le message "Aucune galerie" s'il existe
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
        return;
    }
    
    // Afficher la table et masquer le message vide
    if (table) table.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';
    
    tbody.innerHTML = galleriesToShow.map(gallery => {
        const stats = gallery.stats || {};
        const photoCount = gallery.photos?.length || stats.totalPhotos || 0;
        const totalViews = stats.totalViews || 0;
        const totalDownloads = stats.totalDownloads || 0;
        const coverUrl = getGalleryImage(gallery);
        const desc = (gallery.description || '').substring(0, 45);
        
        return `
            <tr onclick="selectGallery('${gallery.id}')" style="cursor: pointer;">
                <td><div class="gallery-cell"><div class="gallery-cell-icon" style="background-image: linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 100%), url('${coverUrl}'); background-size: cover; background-position: center;"></div><div class="gallery-cell-info"><div class="gallery-cell-name">${escapeHtml(gallery.name)}</div><div class="gallery-cell-desc">${escapeHtml(desc)}${desc.length < (gallery.description || '').length ? '...' : ''}</div></div></div></td>
                <td><i class="fas fa-images" style="color: #3B82F6; margin-right: 5px;"></i>${photoCount}</td>
                <td><i class="fas fa-heart" style="color: #EF4444; margin-right: 5px;"></i>${stats.totalLikes || 0}</td>
                <td><i class="fas fa-comment" style="color: #10B981; margin-right: 5px;"></i>${stats.totalComments || 0}</td>
                <td><i class="fas fa-eye" style="color: #8B5CF6; margin-right: 5px;"></i>${totalViews}</td>
                <td><i class="fas fa-download" style="color: #F59E0B; margin-right: 5px;"></i>${totalDownloads}</td>
                <td><span class="badge ${gallery.isPublic ? 'badge-primary' : 'badge-secondary'}">${gallery.isPublic ? 'Pub' : 'Priv'}</span></td>
                <td>${formatDate(gallery.createdAt)}</td>
                <td><div class="table-actions"><button class="action-btn view" onclick="event.stopPropagation(); selectGallery('${gallery.id}')"><i class="fas fa-eye"></i></button>${canModifyGallery(gallery) ? `<button class="action-btn edit" onclick="event.stopPropagation(); editGallery('${gallery.id}')"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="event.stopPropagation(); deleteGallery('${gallery.id}')"><i class="fas fa-trash"></i></button>` : ''}</div></td>
            </tr>
        `;
    }).join('');
}

function renderGalleryStats() {
    // Mettre à jour les statistiques globales
    updateStatistics();
    
    // Rendre les graphiques si Chart.js est disponible
    if (typeof Chart !== 'undefined') {
        renderGalleryCharts();
    }
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
    
    if (emptyState) emptyState.style.display = hasGalleries ? 'none' : 'flex';
    if (emptyStateList) emptyStateList.style.display = hasGalleries ? 'none' : 'flex';
}

// ============================================
// 📸 GESTION DES PHOTOS DANS UNE GALERIE
// ============================================
async function selectGallery(galleryId) {
    try {
        showLoading('photosLoader');
        
        // Récupérer la galerie via l'API
        currentGallery = await storage.getGallery(galleryId);
        if (!currentGallery) {
            throw new Error('Galerie non trouvée');
        }
        
        // Mettre à jour l'interface
        document.getElementById('galleriesView').style.display = 'none';
        document.getElementById('photosView').style.display = 'block';
        
        document.getElementById('currentGalleryName').textContent = currentGallery.name;
        document.getElementById('currentGalleryDescription').textContent = currentGallery.description || 'Aucune description';
        
        await loadPhotos();
        
    } catch (error) {
        console.error('❌ Erreur sélection galerie:', error);
        showToast('Erreur lors du chargement des photos', 'error');
    } finally {
        hideLoading('photosLoader');
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

function displayPhotos() {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;
    
    const startIndex = (currentPhotoPage - 1) * photosPerPage;
    const endIndex = startIndex + photosPerPage;
    const photosToShow = filteredPhotos.slice(startIndex, endIndex);
    
    if (photosToShow.length === 0) {
        grid.innerHTML = '';
        return;
    }
    
    grid.innerHTML = photosToShow.map((photo, index) => {
        const isPending = photo.status === 'pending';
        const isRejected = photo.status === 'rejected';
        const hasLiked = photo.likedBy?.includes(currentUser.id);
        const globalIndex = filteredPhotos.findIndex(p => p.id === photo.id);
        
        return `
            <div class="photo-card ${isPending ? 'pending' : isRejected ? 'rejected' : ''}" 
                 data-photo-id="${photo.id}" 
                 data-index="${globalIndex}"
                 onclick="viewPhoto('${photo.id}', ${globalIndex})">
                
                <div class="photo-card-image">
                    <img src="${photo.url || photo.thumbnails?.small || 'assets/images/placeholder.jpg'}" 
                         alt="${photo.filename}"
                         loading="lazy">
                    
                    ${isPending ? `
                        <div class="photo-status pending">
                            <i class="fas fa-clock"></i>
                            <span>En attente</span>
                        </div>
                    ` : ''}
                    
                    ${isRejected ? `
                        <div class="photo-status rejected">
                            <i class="fas fa-times"></i>
                            <span>Rejetée</span>
                        </div>
                    ` : ''}
                    
                    <div class="photo-overlay">
                        <div class="photo-actions">
                            ${currentGallery.settings.allowLikes !== false ? `
                                <button class="action-btn like ${hasLiked ? 'active' : ''}" 
                                        onclick="event.stopPropagation(); togglePhotoLike('${photo.id}')">
                                    <i class="fas fa-heart"></i>
                                    <span>${photo.likes?.length || 0}</span>
                                </button>
                            ` : ''}
                            
                            ${currentGallery.settings.allowComments !== false ? `
                                <button class="action-btn comment" onclick="event.stopPropagation(); showCommentsModal('${photo.id}')">
                                    <i class="fas fa-comment"></i>
                                    <span>${photo.comments?.length || 0}</span>
                                </button>
                            ` : ''}
                            
                            ${currentGallery.settings.allowDownloads !== false ? `
                                <button class="action-btn download" onclick="event.stopPropagation(); downloadPhoto('${photo.id}')">
                                    <i class="fas fa-download"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="photo-card-info">
                    <h4 class="photo-title">${escapeHtml(photo.metadata?.title || photo.filename)}</h4>
                    
                    <div class="photo-meta">
                        <div class="meta-item">
                            <i class="fas fa-user"></i>
                            <span>${escapeHtml(photo.uploadedByName || 'Utilisateur')}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(photo.uploadedAt)}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-eye"></i>
                            <span>${photo.views || 0} vues</span>
                        </div>
                    </div>
                    
                    ${photo.metadata?.description ? `
                        <p class="photo-description">${escapeHtml(photo.metadata.description)}</p>
                    ` : ''}
                    
                    ${photo.metadata?.tags?.length > 0 ? `
                        <div class="photo-tags">
                            ${photo.metadata.tags.slice(0, 3).map(tag => `
                                <span class="tag">${escapeHtml(tag)}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div class="photo-card-actions">
                    ${isPending && canModerateGallery(currentGallery) ? `
                        <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); approvePhoto('${photo.id}')">
                            <i class="fas fa-check"></i> Approuver
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); rejectPhoto('${photo.id}')">
                            <i class="fas fa-times"></i> Rejeter
                        </button>
                    ` : ''}
                    
                    ${canModifyPhoto(photo) ? `
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deletePhoto('${photo.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
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
            showToast('Le nom de la galerie est requis', 'error');
            return;
        }

        // Préparer FormData avec tous les champs requis
        const formData = new FormData();
        
        // Champs obligatoires
        formData.append('eventId', currentEvent.id);
        formData.append('name', name);
        formData.append('description', description);
        formData.append('isPublic', isPublic);
        
        // Settings comme JSON stringifié
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
        formData.append('settings', JSON.stringify(settings));
        
        // Metadata comme JSON stringifié
        const metadata = {
            category: category,
            tags: [],
            location: currentEvent?.location || null
        };
        formData.append('metadata', JSON.stringify(metadata));
        
        // Fichier de couverture si sélectionné
        if (galleryCoverFile) {
            formData.append('cover', galleryCoverFile);
        }

        // Appel via storage.createGallery qui gère FormData
        const newGallery = await storage.createGallery(
            currentEvent.id,
            name,
            {
                description: description,
                isPublic: isPublic,
                settings: settings,
                metadata: metadata,
                coverFile: galleryCoverFile || null
            }
        );

        showToast('Galerie créée avec succès!', 'success');

        // Effet visuel de succès
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        closeCreateGalleryModal();
        await loadGalleries();

    } catch (error) {
        console.error('❌ Erreur création galerie:', error);
        showToast('Erreur lors de la création de la galerie', 'error');
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
            showToast('Le nom de la galerie est requis', 'error');
            return;
        }
        
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
        if (galleryCoverFile) {
            try {
                const uploadedFile = await storage.uploadFile(galleryCoverFile, 'gallery');
                galleryData.metadata.coverPhoto = uploadedFile.id;
                galleryData.metadata.coverPhotoUrl = uploadedFile.url;
            } catch (error) {
                console.warn('Erreur upload image couverture:', error);
            }
        }
        
        await storage.updateGallery(galleryId, galleryData);
        
        showToast('Galerie modifiée avec succès!', 'success');
        closeCreateGalleryModal();
        await loadGalleries();
        
    } catch (error) {
        console.error('❌ Erreur modification galerie:', error);
        showToast('Erreur lors de la modification de la galerie', 'error');
    }
}

async function deleteGallery(galleryId) {
    try {
        const gallery = allGalleries.find(g => g.id === galleryId);
        if (!gallery) return;
        
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
        
        await storage.deleteGallery(galleryId);
        showToast('Galerie supprimée avec succès', 'success');
        await loadGalleries();
        
    } catch (error) {
        console.error('❌ Erreur suppression galerie:', error);
        showToast('Erreur lors de la suppression de la galerie', 'error');
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
    
    document.getElementById('browsePhotosBtn').addEventListener('click', () => {
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
    const grid = document.getElementById('uploadedPhotosGrid');
    const countSpan = document.getElementById('photosCountToAdd');
    const submitBtn = document.getElementById('submitPhotosBtn');
    
    countSpan.textContent = uploadedPhotos.length;
    submitBtn.disabled = uploadedPhotos.length === 0;
    
    if (uploadedPhotos.length === 0) {
        grid.innerHTML = '';
        return;
    }
    
    grid.innerHTML = uploadedPhotos.map((photo, index) => `
        <div class="uploaded-photo-item">
            <div class="uploaded-photo-preview">
                <img src="${photo.previewUrl}" alt="${photo.file.name}">
                <button class="remove-photo-btn" onclick="removeUploadedPhoto(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="uploaded-photo-info">
                <input type="text" 
                       class="form-control" 
                       placeholder="Titre (optionnel)" 
                       value="${escapeHtml(photo.title)}"
                       onchange="updateUploadedPhotoTitle(${index}, this.value)">
                <textarea class="form-control mt-1" 
                          placeholder="Description (optionnel)"
                          rows="2"
                          onchange="updateUploadedPhotoDescription(${index}, this.value)"></textarea>
                <input type="text" 
                       class="form-control mt-1" 
                       placeholder="Tags (séparés par des virgules)"
                       onchange="updateUploadedPhotoTags(${index}, this.value)">
            </div>
        </div>
    `).join('');
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
        
        const autoApprove = document.getElementById('autoApprovePhotos').checked;
        
        showLoading('photosLoader');
        
        let successCount = 0;
        let failedCount = 0;
        
        for (const uploadedPhoto of uploadedPhotos) {
            try {
                const metadata = {
                    title: uploadedPhoto.title,
                    description: uploadedPhoto.description,
                    tags: uploadedPhoto.tags
                };
                
                await storage.addPhoto(currentGallery.id, uploadedPhoto.file, metadata);
                successCount++;
                
                const progress = Math.round(((successCount + failedCount) / uploadedPhotos.length) * 100);
                updateUploadProgress(progress);
                
            } catch (error) {
                console.error('Erreur upload photo:', error);
                failedCount++;
            }
        }
        
        uploadedPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
        uploadedPhotos = [];
        
        closeAddPhotosModal();
        hideLoading('photosLoader');
        
        if (successCount > 0) {
            showToast(`${successCount} photo(s) ajoutée(s) avec succès!`, 'success');
            
            if (successCount > 3) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }
        
        if (failedCount > 0) {
            showToast(`${failedCount} photo(s) n'ont pas pu être ajoutées`, 'error');
        }
        
        await loadPhotos();
        
    } catch (error) {
        console.error('❌ Erreur ajout photos:', error);
        hideLoading('photosLoader');
        showToast('Erreur lors de l\'ajout des photos', 'error');
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
        
        // Incrémenter les vues
        photo.views = (photo.views || 0) + 1;
        await storage.updatePhoto(currentGallery.id, photoId, { 
            views: photo.views,
            viewedBy: photo.viewedBy || []
        });
        
        showPhotoModal(photo);
        
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
        
        showToast(hasLiked ? 'Like retiré' : 'Photo aimée!', 'success');
        
    } catch (error) {
        console.error('❌ Erreur like photo:', error);
        showToast('Erreur lors de l\'action sur la photo', 'error');
    }
}

async function downloadPhoto(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        if (!currentGallery.settings.allowDownloads) {
            showToast('Les téléchargements sont désactivés pour cette galerie', 'error');
            return;
        }
        
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
        
        showToast('Téléchargement démarré', 'success');
        
    } catch (error) {
        console.error('❌ Erreur téléchargement photo:', error);
        showToast('Erreur lors du téléchargement', 'error');
    }
}

async function approvePhoto(photoId) {
    try {
        if (!canModerateGallery(currentGallery)) {
            showToast('Vous n\'avez pas la permission de modérer', 'error');
            return;
        }
        
        await storage.approvePhoto(currentGallery.id, photoId);
        showToast('Photo approuvée avec succès', 'success');
        await loadPhotos();
        
    } catch (error) {
        console.error('❌ Erreur approbation photo:', error);
        showToast('Erreur lors de l\'approbation', 'error');
    }
}

async function rejectPhoto(photoId) {
    try {
        if (!canModerateGallery(currentGallery)) {
            showToast('Vous n\'avez pas la permission de modérer', 'error');
            return;
        }
        
        const reason = prompt('Veuillez saisir la raison du rejet (optionnel):');
        await storage.rejectPhoto(currentGallery.id, photoId, reason);
        
        showToast('Photo rejetée', 'success');
        await loadPhotos();
        
    } catch (error) {
        console.error('❌ Erreur rejet photo:', error);
        showToast('Erreur lors du rejet', 'error');
    }
}

async function deletePhoto(photoId) {
    try {
        const photo = galleryPhotos.find(p => p.id === photoId);
        if (!photo) return;
        
        if (!canModifyPhoto(photo)) {
            showToast('Vous n\'avez pas la permission de supprimer cette photo', 'error');
            return;
        }
        
        const result = await Swal.fire({
            title: 'Supprimer la photo ?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            confirmButtonColor: '#EF4444'
        });
        
        if (!result.isConfirmed) return;
        
        await storage.deletePhoto(currentGallery.id, photoId);
        showToast('Photo supprimée', 'success');
        await loadPhotos();
        
    } catch (error) {
        console.error('❌ Erreur suppression photo:', error);
        showToast('Erreur lors de la suppression', 'error');
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

function showCommentsList(photoId) {
    const container = document.getElementById('commentsList');
    const comments = allComments[photoId] || [];
    
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
    
    container.innerHTML = commentsToShow.map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-author">
                    <i class="fas fa-user-circle"></i>
                    <div>
                        <strong>${escapeHtml(comment.userName || 'Utilisateur')}</strong>
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
                ${currentGallery.settings.allowLikes !== false ? `
                    <button class="like-btn ${comment.likedBy?.includes(currentUser.id) ? 'liked' : ''}" 
                            onclick="toggleCommentLike('${photoId}', '${comment.id}')">
                        <i class="fas fa-heart"></i>
                        <span>${comment.likes?.length || 0}</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function submitComment() {
    try {
        const photoId = document.getElementById('commentPhotoId').value;
        const content = document.getElementById('commentInput').value.trim();
        
        if (!content) {
            showToast('Veuillez saisir un commentaire', 'error');
            return;
        }
        
        const comment = await storage.addComment(currentGallery.id, photoId, content);
        
        if (!allComments[photoId]) allComments[photoId] = [];
        allComments[photoId].push(comment);
        
        document.getElementById('commentInput').value = '';
        showCommentsList(photoId);
        
        showToast('Commentaire ajouté', 'success');
        
    } catch (error) {
        console.error('❌ Erreur ajout commentaire:', error);
        showToast('Erreur lors de l\'ajout du commentaire', 'error');
    }
}

async function editComment(photoId, commentId) {
    const comments = allComments[photoId] || [];
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const newContent = prompt('Modifier le commentaire:', comment.content);
    if (newContent === null || newContent.trim() === '') return;
    
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
        showToast('Commentaire modifié', 'success');
        
    } catch (error) {
        console.error('❌ Erreur modification commentaire:', error);
        showToast('Erreur lors de la modification', 'error');
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
            confirmButtonColor: '#EF4444'
        });
        
        if (!result.isConfirmed) return;
        
        await storage.deleteComment(currentGallery.id, photoId, commentId);
        
        if (allComments[photoId]) {
            allComments[photoId] = allComments[photoId].filter(c => c.id !== commentId);
        }
        
        showCommentsList(photoId);
        showToast('Commentaire supprimé', 'success');
        
    } catch (error) {
        console.error('❌ Erreur suppression commentaire:', error);
        showToast('Erreur lors de la suppression du commentaire', 'error');
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
    
    moderationPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = `moderation-list-item ${index === currentModerationIndex ? 'active' : ''}`;
        item.setAttribute('data-index', index);
        item.innerHTML = `
            <div class="moderation-list-thumb">
                <img src="${photo.thumbnails?.small || photo.url || 'assets/images/placeholder.jpg'}" 
                     alt="${photo.filename}">
            </div>
            <div class="moderation-list-info">
                <div class="moderation-list-name">${photo.filename}</div>
                <div class="moderation-list-meta">
                    <i class="fas fa-user"></i> ${photo.uploadedByName}
                </div>
            </div>
        `;
        
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
    
    document.getElementById('totalGalleries').textContent = totalGalleries;
    document.getElementById('totalPhotos').textContent = totalPhotos;
    document.getElementById('totalLikes').textContent = totalLikes;
    document.getElementById('totalComments').textContent = totalComments;
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
    
    document.getElementById('galleryPhotosCount').textContent = stats.totalPhotos;
    document.getElementById('galleryLikesCount').textContent = stats.totalLikes;
    document.getElementById('galleryCommentsCount').textContent = stats.totalComments;
    document.getElementById('galleryViewsCount').textContent = stats.totalViews;
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
function showPhotoModal(photo) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal-overlay';
    modal.innerHTML = `
        <div class="photo-modal">
            <button class="photo-modal-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            
            <div class="photo-modal-content">
                <img src="${photo.url}" alt="${photo.filename}" class="photo-modal-image">
                
                <div class="photo-modal-info">
                    <h4>${photo.metadata?.title || photo.filename}</h4>
                    
                    <div class="photo-modal-meta">
                        <div class="meta-item">
                            <i class="fas fa-user"></i>
                            <span>${photo.uploadedByName}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(photo.uploadedAt)}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-eye"></i>
                            <span>${photo.views || 0} vues</span>
                        </div>
                    </div>
                    
                    ${photo.metadata?.description ? `
                        <p class="photo-modal-description">${escapeHtml(photo.metadata.description)}</p>
                    ` : ''}
                    
                    <div class="photo-modal-actions">
                        ${currentGallery.settings.allowLikes !== false ? `
                            <button class="btn btn-primary" onclick="togglePhotoLike('${photo.id}')">
                                <i class="fas fa-heart ${photo.likedBy?.includes(currentUser.id) ? 'liked' : ''}"></i>
                                ${photo.likes?.length || 0}
                            </button>
                        ` : ''}
                        ${currentGallery.settings.allowComments !== false ? `
                            <button class="btn btn-secondary" onclick="showCommentsModal('${photo.id}')">
                                <i class="fas fa-comment"></i>
                                ${photo.comments?.length || 0}
                            </button>
                        ` : ''}
                        ${currentGallery.settings.allowDownloads !== false ? `
                            <button class="btn btn-success" onclick="downloadPhoto('${photo.id}')">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="photo-modal-navigation">
                ${currentPhotoIndex > 0 ? `
                    <button class="nav-btn prev" onclick="navigatePhoto(-1)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                ` : ''}
                
                ${currentPhotoIndex < filteredPhotos.length - 1 ? `
                    <button class="nav-btn next" onclick="navigatePhoto(1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') modal.remove();
        if (e.key === 'ArrowLeft') navigatePhoto(-1);
        if (e.key === 'ArrowRight') navigatePhoto(1);
    });
}

function navigatePhoto(direction) {
    const newIndex = currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < filteredPhotos.length) {
        const photo = filteredPhotos[newIndex];
        document.querySelector('.photo-modal-overlay')?.remove();
        viewPhoto(photo.id, newIndex);
    }
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
    if (gallery.metadata?.coverPhotoUrl) {
        return gallery.metadata.coverPhotoUrl;
    }
    const category = gallery.metadata?.category || 'general';
    return GALLERY_IMAGES[category] || GALLERY_IMAGES.general;
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
    // Navigation
    document.getElementById('backToEventsBtn')?.addEventListener('click', () => {
        currentEvent = null;
        currentGallery = null;
        document.getElementById('galleriesView').style.display = 'none';
        document.getElementById('photosView').style.display = 'none';
        document.getElementById('eventsHomeView').style.display = 'block';
        loadEventsList();
    });
    
    document.getElementById('backToGalleriesBtn')?.addEventListener('click', () => {
        currentGallery = null;
        document.getElementById('photosView').style.display = 'none';
        document.getElementById('galleriesView').style.display = 'block';
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
    document.getElementById('closeAddPhotosBtn')?.addEventListener('click', closeAddPhotosModal);
    document.getElementById('submitPhotosBtn')?.addEventListener('click', submitPhotos);
    
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

function handleGalleryC