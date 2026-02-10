# 📚 SECURA Storage API - Mapping Endpoints ↔ Méthodes Storage

## 🎯 Galleries

### GET - Récupérer toutes les galeries
```javascript
// API
GET /api/galleries?eventId=xxx&userId=xxx&status=active&isPublic=true

// Méthode Storage
const galleries = await storage.getGalleries(eventId, { userId, status, isPublic });
```

### GET - Récupérer une galerie spécifique (avec stats)
```javascript
// API
GET /api/galleries/:id

// Retourne:
{
    success: true,
    gallery: {
        id, name, description, isPublic, createdBy, createdByName, status,
        photos: [],
        stats: {
            totalViews: number,
            totalLikes: number,
            totalComments: number,
            totalDownloads: number
        },
        engagementScore: number,
        photoCount: number,
        approvedPhotos: []
    }
}

// Méthode Storage
const gallery = await storage.getGallery(galleryId);

// Ou directement les stats:
const stats = await storage.getGalleryStats(galleryId);
// Retourne: { totalViews, totalLikes, totalComments, totalDownloads }
```

**⚠️ IMPORTANT:** L'endpoint `/galleries/:id/stats` n'existe PAS
- Utiliser `/galleries/:id` qui retourne déjà les stats enrichies

### POST - Créer une galerie ✅
```javascript
// API Endpoint
POST /api/galleries
Body: { eventId, name, description, isPublic, settings }

// Méthode Storage
await storage.createGallery(eventId, name, {
    description: 'Description',
    isPublic: true,
    settings: {
        moderationRequired: true,
        allowComments: true,
        allowLikes: true,
        allowDownloads: false,
        maxPhotos: 1000,
        maxPhotoSize: 8388608
    }
});
```

**PARAMÈTRES REQUIS:**
- `eventId` (string) - ID de l'événement
- `name` (string) - Nom de la galerie

**PARAMÈTRES OPTIONNELS dans settings:**
- `description` (string)
- `isPublic` (boolean) - Par défaut: false
- `moderationRequired` (boolean) - Par défaut: true
- `allowComments` (boolean) - Par défaut: true
- `allowLikes` (boolean) - Par défaut: true
- `allowDownloads` (boolean) - Par défaut: true
- `maxPhotos` (number) - Par défaut: 1000
- `maxPhotoSize` (number en bytes) - Par défaut: 8MB
- `autoApprove` (boolean) - Par défaut: false

### PUT - Mettre à jour une galerie
```javascript
// API
PUT /api/galleries/:id
Body: { updates }

// Méthode Storage
await storage.updateGallery(galleryId, {
    name: 'Nouveau nom',
    description: 'Nouvelle description',
    isPublic: true
});
```

### DELETE - Supprimer une galerie
```javascript
// API
DELETE /api/galleries/:id

// Méthode Storage
await storage.deleteGallery(galleryId);
```

---

## 📸 Photos

### POST - Ajouter une photo à une galerie
```javascript
// API
POST /api/galleries/:id/photos
Body: FormData avec le fichier image

// Méthode Storage
await storage.addPhoto(galleryId, file, {
    caption: 'Description',
    metadata: { photographer: 'Nom' }
});
```

**File doit être:**
- Type: image/jpg, image/png, image/webp
- Size: < maxPhotoSize défini dans la galerie

### GET - Récupérer les photos d'une galerie
```javascript
// API
GET /api/galleries/:id/photos

// Méthode Storage (N'EXISTE PAS)
const photos = await storage.apiRequest(`/galleries/${galleryId}/photos`);
```

---

## 💬 Commentaires

### POST - Ajouter un commentaire
```javascript
// API
POST /api/galleries/:galleryId/photos/:photoId/comments
Body: { content }

// Méthode Storage
await storage.addComment(galleryId, photoId, 'Mon commentaire');
```

### GET - Récupérer les commentaires
```javascript
// API
GET /api/galleries/:galleryId/photos/:photoId/comments

// Méthode Storage (N'EXISTE PAS)
const comments = await storage.apiRequest(`/galleries/${galleryId}/photos/${photoId}/comments`);
```

---

## ❤️ Likes

### POST - Ajouter un like
```javascript
// API
POST /api/galleries/:galleryId/photos/:photoId/likes

// Méthode Storage (À implémenter)
// Utilisez directement: await storage.apiRequest(`/galleries/${galleryId}/photos/${photoId}/likes`, { method: 'POST' })
```

### DELETE - Retirer un like
```javascript
// API
DELETE /api/galleries/:galleryId/photos/:photoId/likes

// Méthode Storage (À implémenter)
// Utilisez directement: await storage.apiRequest(`/galleries/${galleryId}/photos/${photoId}/likes`, { method: 'DELETE' })
```

---

## 🔄 Synchronisation

### Auto-Sync Configuration
```javascript
storage.SYNC_INTERVAL = 30000;      // 30 secondes
storage.CACHE_TTL = 30000;          // Cache 30 secondes
storage.SYNC_ENABLED = true;        // Activation/désactivation
```

### Méthodes Sync
```javascript
// Synchronisation manuelle - Pull (récupérer les données)
await storage.syncPull();

// Synchronisation manuelle - Push (envoyer les données)
await storage.syncPush();

// Démarrer l'auto-sync
storage.startAutoSync();

// Arrêter l'auto-sync
storage.stopAutoSync();
```

---

## 📊 Statistiques

### GET - Récupérer les stats globales
```javascript
// API
GET /api/statistics

// Méthode Storage
const stats = await storage.getStatistics();
```

---

## ❌ ERREURS COURANTES

### ❌ Erreur: "eventId et name requis"
**Cause:** Les paramètres ne sont pas passés correctement à `createGallery`
**Solution:**
```javascript
// ❌ MAUVAIS
await storage.createGallery({
    eventId: '123',
    name: 'Ma galerie'
});

// ✅ BON
await storage.createGallery(
    '123',  // eventId
    'Ma galerie',  // name
    { description: '...', isPublic: true, settings: {...} }
);
```

### ❌ Erreur: "storage.uploadFile is not a function"
**Cause:** La fonction n'existe pas dans le storage client
**Solution:** Utilisez `storage.addPhoto()` à la place pour les images
```javascript
// ❌ Ne pas faire
const file = await storage.uploadFile(file, 'gallery');

// ✅ Faire (Pour les photos)
await storage.addPhoto(galleryId, file, { caption: '...' });
```

### ❌ Erreur: "400 Bad Request"
**Cause:** Les données envoyées ne correspondent pas à la structure attendue
**Solution:** Vérifier le format des paramètres dans ce document

---

## 🔐 Authentification
Tous les endpoints POST/PUT/DELETE requièrent un JWT token:
```javascript
// Automatiquement géré par storage.apiRequest()
// Le token est envoyé dans le header Authorization: Bearer <token>
```

---

## 🚀 Performance

### Cache & Déduplication (Depuis v6.0)
- **Cache TTL:** 30 secondes pour les GET
- **Déduplication:** Les requêtes GET en cours sont réutilisées
- **Auto-sync:** Toutes les 30 secondes (au lieu de 10)

### Logs disponibles
```javascript
// Cache hit
💾 Cache hit: /galleries

// Requête en vol réutilisée
♻️ Réutilisation requête en vol: /galleries

// Auto-sync
⏰ Auto-sync déclenché (30s)
```

---

## 📋 Checklist Avant Appel API

- [ ] L'endpoint existe-t-il dans server.js?
- [ ] La méthode storage.js existe-t-elle?
- [ ] Les paramètres requis sont-ils fournis?
- [ ] Le format des données correspond-il à celui attendu?
- [ ] Le token JWT est-il présent (pour POST/PUT/DELETE)?
- [ ] Le try/catch est-il implémenté?
