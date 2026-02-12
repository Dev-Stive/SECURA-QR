# 📚 Documentation API - Galeries, Photos, Likes et Commentaires

## Table des matières
1. [Galeries](#galeries)
2. [Photos](#photos)
3. [Likes](#likes)
4. [Commentaires](#commentaires)
5. [Modèles de Données](#modèles-de-données)

---

## GALERIES

### Déclarations des Fonctions

#### 1. `getGalleries()`
```javascript
async getGalleries() → Promise<Array<Gallery>>
```
- **Méthode HTTP**: `GET`
- **Endpoint**: `/api/galleries`
- **Description**: Récupère toutes les galeries disponibles
- **Retour**: Array de galeries enrichies avec stats

---

#### 2. `getGallery(galleryId)`
```javascript
async getGallery(galleryId: String) → Promise<Gallery>
```
- **Méthode HTTP**: `GET`
- **Endpoint**: `/api/galleries/{galleryId}`
- **Paramètres**: 
  - `galleryId` (String): Identifiant unique de la galerie
- **Description**: Récupère une galerie spécifique avec détails complets
- **Retour**: Objet Gallery enrichi avec stats et utilisateur créateur

---

#### 3. `createGallery(eventId, name, opts)`
```javascript
async createGallery(
  eventId: String, 
  name: String, 
  opts: Object = {}
) → Promise<Gallery>
```
- **Méthode HTTP**: `POST`
- **Endpoint**: `/api/galleries`
- **Paramètres**:
  - `eventId` (String, requis): Identifiant de l'événement
  - `name` (String, requis): Nom de la galerie
  - `opts` (Object, optionnel):
    - `description` (String): Description de la galerie
    - `isPublic` (Boolean): Galerie publique ou privée
    - `moderationRequired` (Boolean): Modération des photos requise
    - `autoApprove` (Boolean): Approbation automatique des photos
    - `allowDownloads` (Boolean): Autoriser les téléchargements
    - `allowComments` (Boolean): Autoriser les commentaires
    - `allowLikes` (Boolean): Autoriser les likes
    - `maxPhotos` (Number): Nombre max de photos
    - `maxPhotoSize` (Number): Taille max d'une photo en bytes
    - `tags` (Array): Tags de la galerie
    - `category` (String): Catégorie
- **Retour**: Nouvel objet Gallery créé
- **Authentification**: Oui (Bearer token)

---

#### 4. `updateGallery(galleryId, updates)`
```javascript
async updateGallery(
  galleryId: String, 
  updates: Object
) → Promise<Gallery>
```
- **Méthode HTTP**: `PUT`
- **Endpoint**: `/api/galleries/{galleryId}`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `updates` (Object): Champs à mettre à jour
    - `name` (String): Nouveau nom
    - `description` (String): Nouvelle description
    - `isPublic` (Boolean): Visibilité
    - `settings` (Object): Paramètres de la galerie
    - `metadata` (Object): Métadonnées
- **Retour**: Galerie mise à jour
- **Authentification**: Oui (Permission requise)

---

#### 5. `deleteGallery(galleryId)`
```javascript
async deleteGallery(galleryId: String) → Promise<{success: Boolean}>
```
- **Méthode HTTP**: `DELETE`
- **Endpoint**: `/api/galleries/{galleryId}`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie à supprimer
- **Description**: Supprime complètement une galerie et toutes ses photos
- **Retour**: `{success: true, message: "Galerie supprimée"}`
- **Authentification**: Oui (Créateur uniquement)

---

#### 6. `getGalleryStats(galleryId)`
```javascript
async getGalleryStats(galleryId: String) → Promise<Object>
```
- **Méthode HTTP**: `GET`
- **Endpoint**: `/api/galleries/{galleryId}/stats`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
- **Description**: Récupère les statistiques complètes de la galerie
- **Retour**: Objet stats contenant:
  - `totalPhotos` (Number)
  - `totalViews` (Number)
  - `totalLikes` (Number)
  - `totalComments` (Number)
  - `totalDownloads` (Number)
  - `engagementScore` (Number)
  - `approvedPhotoCount` (Number)

---

## PHOTOS

### Déclarations des Fonctions

#### 1. `getPhotos(galleryId, opts)`
```javascript
async getPhotos(
  galleryId: String, 
  opts: Object = {}
) → Promise<Array<Photo>>
```
- **Méthode HTTP**: `GET`
- **Endpoint**: `/api/galleries/{galleryId}/photos?{params}`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `opts` (Object):
    - `status` (String): 'approved', 'pending', 'rejected'
    - `sort` (String): 'recent', 'likes', 'views'
- **Description**: Récupère les photos d'une galerie
- **Retour**: Array de Photo avec métadonnées

---

#### 2. `addPhoto(galleryId, file, metadata)`
```javascript
async addPhoto(
  galleryId: String, 
  file: File, 
  metadata: Object = {}
) → Promise<Photo>
```
- **Méthode HTTP**: `POST`
- **Endpoint**: `/api/galleries/{galleryId}/photos`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `file` (File): Fichier image à uploader
  - `metadata` (Object):
    - `title` (String): Titre de la photo
    - `description` (String): Description
    - `tags` (Array): Tags associés
    - `location` (String): Localisation
    - `camera` (String): Infos de la caméra
    - `featured` (Boolean): Photo en avant
- **Description**: Upload une photo avec ses métadonnées (FormData)
- **Retour**: Objet Photo créé
- **Authentification**: Oui (Contributeur de la galerie)
- **Format**: FormData avec champs: file, title, description, tags, location

---

#### 3. `deletePhoto(galleryId, photoId)`
```javascript
async deletePhoto(
  galleryId: String, 
  photoId: String
) → Promise<{success: Boolean}>
```
- **Méthode HTTP**: `DELETE`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
- **Description**: Supprime une photo et ses fichiers
- **Retour**: `{success: true, message: "Photo supprimée"}`
- **Authentification**: Oui (Uploadeur ou modérateur)

---

#### 4. `approvePhoto(galleryId, photoId)`
```javascript
async approvePhoto(
  galleryId: String, 
  photoId: String
) → Promise<Photo>
```
- **Méthode HTTP**: `POST`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/approve`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
- **Description**: Approuve une photo en attente de modération
- **Retour**: Photo mise à jour avec status 'approved'
- **Authentification**: Oui (Modérateur)

---

#### 5. `rejectPhoto(galleryId, photoId, reason)`
```javascript
async rejectPhoto(
  galleryId: String, 
  photoId: String, 
  reason: String = ''
) → Promise<Photo>
```
- **Méthode HTTP**: `POST`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/reject`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
  - `reason` (String): Raison du rejet
- **Description**: Rejette une photo en attente
- **Retour**: Photo mise à jour avec status 'rejected'
- **Authentification**: Oui (Modérateur)

---

#### 6. `downloadGalleryZip(galleryId)`
```javascript
async downloadGalleryZip(galleryId: String) → Promise<Blob>
```
- **Méthode HTTP**: `GET`
- **Endpoint**: `/api/galleries/{galleryId}/download/zip`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
- **Description**: Télécharge toutes les photos approuvées en ZIP
- **Retour**: Blob ZIP avec toutes les photos
- **Authentification**: Non (Mais respect des permissions)

---

## LIKES

### Déclarations des Fonctions

#### 1. `likePhoto(galleryId, photoId)`
```javascript
async likePhoto(
  galleryId: String, 
  photoId: String
) → Promise<Object>
```
- **Méthode HTTP**: `POST`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/like`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
- **Description**: Like ou unlike une photo (toggle)
- **Retour**: `{success: true, action: 'like'|'unlike', likes: Number, like: Object}`
- **Authentification**: Oui (Bearer token requis)
- **Comportement**: 
  - Si l'utilisateur a déjà liké → unlike
  - Sinon → like

---

#### 2. `getLikes(galleryId, photoId)`
```javascript
async getLikes(
  galleryId: String, 
  photoId: String
) → Promise<Object>
```
- **Méthode HTTP**: `GET`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/likes`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
- **Description**: Récupère tous les likes d'une photo
- **Retour**: 
  ```javascript
  {
    success: true,
    likes: Array<Like>,
    totalLikes: Number,
    userLiked: Boolean
  }
  ```
- **Authentification**: Non

---

## COMMENTAIRES

### Déclarations des Fonctions

#### 1. `addComment(galleryId, photoId, content)`
```javascript
async addComment(
  galleryId: String, 
  photoId: String, 
  content: String
) → Promise<Comment>
```
- **Méthode HTTP**: `POST`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/comments`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
  - `content` (String): Texte du commentaire
- **Description**: Ajoute un nouveau commentaire sur une photo
- **Retour**: Objet Comment créé
- **Authentification**: Oui (Bearer token requis)

---

#### 2. `getComments(galleryId, photoId, opts)`
```javascript
async getComments(
  galleryId: String, 
  photoId: String, 
  opts: Object = {}
) → Promise<Array<Comment>>
```
- **Méthode HTTP**: `GET`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/comments?{params}`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
  - `opts` (Object):
    - `status` (String): 'approved', 'pending'
- **Description**: Récupère tous les commentaires d'une photo
- **Retour**: Array de Comment triés par date (récent d'abord)

---

#### 3. `updateComment(galleryId, photoId, commentId, content)`
```javascript
async updateComment(
  galleryId: String, 
  photoId: String, 
  commentId: String, 
  content: String
) → Promise<Comment>
```
- **Méthode HTTP**: `PUT`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/comments/{commentId}`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
  - `commentId` (String): Identifiant du commentaire
  - `content` (String): Nouveau contenu
- **Description**: Modifie le contenu d'un commentaire
- **Retour**: Comment mis à jour avec updatedAt
- **Authentification**: Oui (Auteur du commentaire)

---

#### 4. `deleteComment(galleryId, photoId, commentId)`
```javascript
async deleteComment(
  galleryId: String, 
  photoId: String, 
  commentId: String
) → Promise<{success: Boolean}>
```
- **Méthode HTTP**: `DELETE`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/comments/{commentId}`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
  - `commentId` (String): Identifiant du commentaire
- **Description**: Supprime un commentaire
- **Retour**: `{success: true, message: "Commentaire supprimé"}`
- **Authentification**: Oui (Auteur ou modérateur)

---

#### 5. `likeComment(galleryId, photoId, commentId)`
```javascript
async likeComment(
  galleryId: String, 
  photoId: String, 
  commentId: String
) → Promise<Object>
```
- **Méthode HTTP**: `POST`
- **Endpoint**: `/api/galleries/{galleryId}/photos/{photoId}/comments/{commentId}/like`
- **Paramètres**:
  - `galleryId` (String): Identifiant de la galerie
  - `photoId` (String): Identifiant de la photo
  - `commentId` (String): Identifiant du commentaire
- **Description**: Like ou unlike un commentaire (toggle)
- **Retour**: `{success: true, comment: Comment, action: 'like'|'unlike', likes: Number}`
- **Authentification**: Oui (Bearer token requis)

---

---

## MODÈLES DE DONNÉES

### 🏗️ Gallery (Galerie)

```javascript
{
  id: String,                    // Généré: gal_{timestamp}_{random}
  eventId: String,               // Lié à un événement
  name: String,                  // Nom de la galerie (requis)
  description: String,           // Description optionnelle
  createdBy: String,             // ID de l'utilisateur créateur
  createdByName: String,         // Nom du créateur
  isPublic: Boolean,             // Visibilité publique/privée
  status: 'active',              // État de la galerie
  
  // Contenu
  photos: Array<Photo>,          // Tableau des photos
  
  // Modération
  moderation: {
    enabled: Boolean,            // Modération activée
    approvedPhotos: Array<String>,    // IDs photos approuvées
    pendingPhotos: Array<String>,     // IDs en attente
    rejectedPhotos: Array<String>     // IDs rejetées
  },
  
  // Configuration
  settings: {
    maxPhotos: Number,           // Nombre max de photos (défaut: 1000)
    maxPhotoSize: Number,        // Taille max en bytes (défaut: 8MB)
    allowedFormats: Array,       // Formats acceptés ['jpg','jpeg','png','webp']
    autoApprove: Boolean,        // Approbation automatique
    allowDownloads: Boolean,     // Autoriser les téléchargements (défaut: true)
    allowComments: Boolean,      // Autoriser les commentaires (défaut: true)
    allowLikes: Boolean,         // Autoriser les likes (défaut: true)
    watermark: Boolean,          // Ajouter un watermark
    ...otherSettings
  },
  
  // Permissions
  permissions: {
    viewers: Array<String>,      // Qui peut voir
    contributors: Array<String>, // Qui peut ajouter des photos
    moderators: Array<String>    // Qui peut modérer
  },
  
  // Statistiques
  stats: {
    totalPhotos: Number,         // Total de photos
    totalViews: Number,          // Vues totales
    totalLikes: Number,          // Likes totaux
    totalComments: Number,       // Commentaires totaux
    totalDownloads: Number       // Téléchargements totaux
  },
  
  // Métadonnées
  metadata: {
    coverPhoto: String,          // ID de la photo de couverture
    tags: Array<String>,         // Tags de la galerie
    category: String,            // Catégorie (défaut: 'general')
    location: String             // Localisation optionnelle
  },
  
  // Timestamps
  createdAt: ISO8601String,      // Date de création
  updatedAt: ISO8601String       // Date de dernière modification
}
```

---

### 📷 Photo

```javascript
{
  id: String,                    // Généré: photo_{timestamp}_{random}
  galleryId: String,             // Référence à la galerie
  fileId: String,                // ID du fichier stocké
  filename: String,              // Nom du fichier original
  url: String,                   // URL d'accès à la photo
  thumbnails: Object,            // URLs des thumbnails (small, medium, large)
  
  // Auteur et dates
  uploadedBy: String,            // ID de l'utilisateur qui a uploadé
  uploadedByName: String,        // Nom de l'uploadeur
  uploadedAt: ISO8601String,     // Date d'upload
  
  // Fichier
  size: Number,                  // Taille en bytes
  format: String,                // Extension (jpg, png, webp, etc)
  
  // Métadonnées
  metadata: {
    title: String,               // Titre de la photo
    description: String,         // Description
    tags: Array<String>,         // Tags associés
    location: String,            // Localisation
    camera: String               // Infos caméra (EXIF)
  },
  
  // Modération
  status: 'pending'|'approved'|'rejected',
  moderated: Boolean,            // Si modéré
  moderatedBy: String,           // ID du modérateur
  moderatedAt: ISO8601String,    // Date de modération
  
  // Engagement
  views: Number,                 // Nombre de vues
  viewedBy: Array<String>,       // IDs des utilisateurs ayant vu
  likes: Array<Like>,            // Tableau des likes
  likedBy: Array<String>,        // IDs des utilisateurs ayant liké
  comments: Array<Comment>,      // Tableau des commentaires
  downloads: Number,             // Nombre de téléchargements
  downloadedBy: Array<String>,   // IDs des utilisateurs ayant téléchargé
  
  // Affichage
  featured: Boolean,             // Affichage en avant
  isPublic: Boolean              // Hérité de la galerie
}
```

---

### ❤️ Like

```javascript
{
  id: String,                    // Généré: like_{timestamp}_{random}
  userId: String,                // ID de l'utilisateur
  userName: String,              // Nom de l'utilisateur
  likedAt: ISO8601String         // Timestamp du like
}
```

---

### 💬 Comment

```javascript
{
  id: String,                    // Généré: comment_{timestamp}_{random}
  userId: String,                // ID de l'auteur
  userName: String,              // Nom de l'auteur
  userAvatar: String|null,       // Avatar de l'auteur
  content: String,               // Contenu du commentaire (requis)
  parentCommentId: String|null,  // Pour les réponses (optionnel)
  
  // Modération
  status: 'pending'|'approved',  // État du commentaire
  moderated: Boolean,            // Si modéré
  
  // Engagement
  likes: Array<Like>,            // Likes du commentaire
  likedBy: Array<String>,        // IDs des utilisateurs ayant liké
  replies: Array<Comment>,       // Réponses au commentaire
  
  // Timestamps
  createdAt: ISO8601String,      // Date de création
  updatedAt: ISO8601String       // Dernière modification
}
```

---

## NOTES IMPORTANTES

### Authentification
- Toutes les opérations d'écriture (POST, PUT, DELETE) nécessitent un Bearer token
- Format: `Authorization: Bearer {token}`
- Les lectures (GET) ne nécessitent généralement pas d'authentification (sauf restrictions)

### Permissions
- **Créateur de galerie**: Peut modifier, supprimer et modérer sa galerie
- **Contributeur**: Peut ajouter des photos
- **Modérateur**: Peut approuver/rejeter les photos
- **Utilisateur anonyme**: Peut voir les galeries publiques et liker

### Événements Émis
Via le système d'événements customisé de `storage.js`:
- `gallery:created` - Nouvelle galerie créée
- `photo:added` - Photo ajoutée
- `photo:approved` - Photo approuvée
- `like:added` - Like ajouté
- `comment:added` - Commentaire ajouté

### Gestion des Erreurs
Tous les endpoints retournent:
```javascript
{
  success: Boolean,
  data: Object|null,
  error: String|null,
  message: String|null
}
```

---

**Documentation générée pour SECURA v3.0.0**
**API Base**: `https://breakable-leela-geekhub-team-240bba40.koyeb.app/api` ou `http://localhost:3000/api`
