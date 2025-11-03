# 🚀 Guide d'Installation SECURA

## 📦 Structure des Fichiers

Créez la structure suivante :

```
secura/
├── index.html
├── events.html
├── guests.html
├── qr-generator.html
├── scanner.html
├── css/
│   └── styles.css
├── js/
│   ├── storage.js
│   ├── theme.js
│   ├── main.js
│   ├── particles-config.js
│   ├── events.js
│   ├── guests.js
│   ├── qr-generator.js
│   └── scanner.js
└── README.md
```

## 🛠️ Installation Étape par Étape

### Étape 1 : Créer les Dossiers

```bash
mkdir secura
cd secura
mkdir css js
```

### Étape 2 : Créer les Fichiers HTML

Créez ces 5 fichiers à la racine :
1. `index.html` - Page d'accueil
2. `events.html` - Gestion des événements
3. `guests.html` - Gestion des invités
4. `qr-generator.html` - Générateur QR
5. `scanner.html` - Scanner QR

### Étape 3 : Créer le CSS

Dans le dossier `css/` :
- `styles.css` - Tous les styles de l'application

### Étape 4 : Créer les JavaScript

Dans le dossier `js/` :
1. `storage.js` - Gestion du stockage
2. `theme.js` - Gestion des thèmes
3. `main.js` - Scripts communs
4. `particles-config.js` - Configuration des particules
5. `events.js` - Logique des événements
6. `guests.js` - Logique des invités
7. `qr-generator.js` - Génération QR
8. `scanner.js` - Scanner QR

## ✅ Vérification

### Test Local (Sans Serveur)

1. Double-cliquer sur `index.html`
2. L'application devrait s'ouvrir dans votre navigateur

⚠️ **Note** : Certaines fonctionnalités (caméra) nécessitent un serveur local.

### Test avec Serveur Local

#### Option 1 : Python
```bash
# Python 3
cd secura
python -m http.server 8000
```
Ouvrir : `http://localhost:8000`

#### Option 2 : Node.js
```bash
# Installer serve globalement
npm install -g serve

# Lancer le serveur
cd secura
serve
```

#### Option 3 : PHP
```bash
cd secura
php -S localhost:8000
```

#### Option 4 : VS Code Live Server
1. Installer l'extension "Live Server"
2. Clic droit sur `index.html`
3. "Open with Live Server"

## 🔧 Configuration Initiale

### 1. Vérifier les CDN

Toutes les bibliothèques sont chargées depuis des CDN. Vérifiez que vous avez une connexion internet la première fois.

Les CDN utilisés :
- Font Awesome : `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/`
- SweetAlert2 : `https://cdn.jsdelivr.net/npm/sweetalert2@11`
- Particles.js : `https://cdn.jsdelivr.net/npm/particles.js@2.0.0`
- QRCode.js : `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/`
- jsQR : `https://cdn.jsdelivr.net/npm/jsqr@1.4.0`
- PapaParse : `https://cdnjs.cloudflare.com/ajax/libs/PapaParse/`
- JSZip : `https://cdnjs.cloudflare.com/ajax/libs/jszip/`

### 2. Tester les Fonctionnalités

#### Test 1 : Créer un Événement
1. Aller sur "Événements"
2. Cliquer "Créer un événement"
3. Remplir et sauvegarder
4. Vérifier qu'il apparaît dans la liste

#### Test 2 : Ajouter un Invité
1. Aller sur "Invités"
2. Sélectionner l'événement
3. Ajouter un invité
4. Vérifier qu'il apparaît dans le tableau

#### Test 3 : Générer un QR Code
1. Aller sur "Générateur QR"
2. Sélectionner événement et invité
3. Cliquer "Générer"
4. Vérifier que le QR apparaît

#### Test 4 : Scanner (Nécessite HTTPS)
1. Aller sur "Scanner"
2. Uploader une image de QR Code
3. Vérifier que les infos s'affichent

## 🌐 Déploiement en Production

### Option 1 : GitHub Pages

1. Créer un repo GitHub
2. Push les fichiers
3. Settings → Pages → Deploy from branch (main)
4. L'app sera accessible à : `https://username.github.io/secura/`

### Option 2 : Netlify

1. Aller sur netlify.com
2. Drag & Drop le dossier `secura/`
3. L'app est en ligne !

### Option 3 : Vercel

```bash
npm i -g vercel
cd secura
vercel
```

### Option 4 : Serveur Web Classique

1. Uploader via FTP tous les fichiers
2. Configurer le domaine
3. S'assurer que HTTPS est activé (pour la caméra)

## 🔒 Configuration HTTPS (Pour Caméra)

La fonctionnalité caméra nécessite HTTPS en production.

### Obtenir un Certificat SSL Gratuit

#### Let's Encrypt (Recommandé)
```bash
sudo certbot --nginx -d votre-domaine.com
```

#### Cloudflare
1. Ajouter votre site à Cloudflare
2. Activer SSL/TLS automatique

## 📱 Installation PWA

Pour permettre l'installation comme app :

1. Créer `manifest.json` :
```json
{
  "name": "SECURA",
  "short_name": "SECURA",
  "description": "Gestion d'événements avec QR Code",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1b1b18",
  "theme_color": "#D97706",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

2. Ajouter dans `<head>` de tous les HTML :
```html
<link rel="manifest" href="manifest.json">
```

3. Créer un Service Worker `sw.js` :
```javascript
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('secura-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/css/styles.css',
        '/js/main.js'
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
```

## 🐛 Résolution de Problèmes

### Problème : Pages blanches
**Solution** : 
- Vérifier la console du navigateur (F12)
- S'assurer que tous les fichiers JS sont présents
- Vérifier les chemins relatifs

### Problème : CSS ne se charge pas
**Solution** :
- Vérifier le chemin : `css/styles.css`
- Nettoyer le cache du navigateur (Ctrl+Shift+R)

### Problème : "storage is not defined"
**Solution** :
- S'assurer que `storage.js` se charge avant les autres
- Vérifier l'ordre des `<script>` dans le HTML

### Problème : Caméra ne marche pas
**Solution** :
- Utiliser HTTPS (ou localhost)
- Autoriser la caméra dans les paramètres du navigateur
- Tester sur un autre navigateur

### Problème : QR Code ne se génère pas
**Solution** :
- Vérifier que qrcode.js est chargé (console)
- Recharger la page
- Vider le cache

## 📊 Monitoring

### Vérifier le LocalStorage

Console du navigateur (F12) :
```javascript
// Voir tous les événements
console.log(storage.getAllEvents());

// Voir tous les invités
console.log(storage.getAllGuests());

// Statistiques
console.log(storage.getStatistics());
```

### Backup des Données

```javascript
// Créer un backup
const backup = storage.createBackup();
console.log(backup);

// Télécharger le backup
const blob = new Blob([backup], {type: 'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'secura_backup.json';
a.click();
```

## ✅ Checklist Post-Installation

- [ ] Tous les fichiers créés
- [ ] Structure des dossiers correcte
- [ ] Application accessible dans le navigateur
- [ ] Page d'accueil se charge
- [ ] Navigation fonctionne
- [ ] Peut créer un événement
- [ ] Peut ajouter un invité
- [ ] QR Code se génère
- [ ] Thème sombre/clair fonctionne
- [ ] Export CSV fonctionne
- [ ] Responsive sur mobile

## 🎉 Félicitations !

Votre application SECURA est maintenant installée et fonctionnelle !

Pour toute aide supplémentaire, consultez le README.md complet.

---

**Bon événements ! 🎊**