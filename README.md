# 🛡️ SECURA - Plateforme de Gestion d'Événements avec QR Code

## 📋 Description

SECURA est une application web complète pour la gestion d'événements (mariages, anniversaires, conférences) avec génération de QR Codes stylisés pour les invités. L'application permet de créer des événements, gérer les invités, générer des QR Codes personnalisés, scanner ces codes pour valider les présences, et propose en plus la gestion des tables, une galerie photo, un chat en temps réel et la génération de tickets.

Le projet est composé de deux parties :
- **Frontend** : pages HTML/CSS/JS statiques (racine du repo + `welcome/`), déployées sur Vercel.
- **Backend** : serveur Node.js/Express avec Socket.IO, déployé sur Render (dossier `backend/`).

## ✨ Fonctionnalités Principales

### 🎉 Gestion des Événements
- Création et modification d'événements (mariage, anniversaire, conférence, autre)
- Configuration complète (nom, date, heure, lieu, capacité, description)
- Message de bienvenue personnalisé
- Duplication d'événements
- Export CSV des invités
- Statistiques en temps réel

### 👥 Gestion des Invités
- Ajout manuel via formulaire
- Import CSV avec prévisualisation
- Export CSV et JSON
- Recherche et filtrage
- Sélection multiple pour suppression
- Gestion des informations (nom, email, téléphone, entreprise, notes)
- Statut de présence

### 🎨 Générateur QR Code
- QR Codes stylisés et personnalisables
- Configuration avancée :
  - Taille (200px - 500px)
  - Couleurs (principal et fond)
  - Style des modules (carré, arrondi, points)
  - Niveau de correction d'erreur (L, M, Q, H)
  - Option logo SECURA
- Nom de fichier avec initiaux de l'invité
- Téléchargement PNG et SVG
- Génération en masse (ZIP)
- Partage par email, SMS, WhatsApp

### 📷 Scanner QR Code
- Scan par caméra en temps réel
- Upload et scan d'image
- Validation automatique
- Message de bienvenue personnalisé
- Marquage présence
- Historique des scans
- Statistiques du jour
- Support multi-caméras

### 🪑 Gestion des Tables
- Placement des invités par table
- Import CSV des tables
- Vue occupée/libre par table

### 📷 Galerie Photo
- Upload de photos par les invités et les organisateurs
- Stockage serveur (`backend/uploads/galleries/`)

### 💬 Chat en Temps Réel
- Discussion en direct entre invités/organisateurs via Socket.IO

### 🎫 Génération de Tickets
- Tickets imprimables (portrait et paysage) par invité

### 🌐 Espace Invité ("Welcome")
- Pages dédiées à chaque invité une fois son QR scanné : son QR personnel, sa table, le menu, le programme, la galerie, le chat

### 🎨 Interface Utilisateur
- Design moderne et responsive
- Thème clair/sombre
- Animations fluides
- Effets particles.js
- Mode plein écran
- Navigation intuitive
- Notifications toast (SweetAlert2)

### 💾 Stockage & Données
- Backend Node.js avec authentification par compte (JWT + bcrypt)
- Données persistées côté serveur dans un fichier JSON (`backend/data/secura-data.json`)
- Sauvegardes automatiques (`backend/backups/`)
- Export/Import CSV et JSON

## 🗂️ Structure du Projet

```
SECURA-QR/
├── index.html, events.html, guests.html, ...   # Pages frontend (racine)
├── welcome/                  # Pages dédiées aux invités
├── css/                      # Styles
├── js/                       # Logique frontend (storage, auth, events, guests,
│                              #   qr-generator, scanner, chat, galleries, tables, tickets...)
├── vercel.json                # Config déploiement frontend (Vercel)
└── backend/
    ├── server.js               # Serveur Express + Socket.IO (point d'entrée)
    ├── config/                 # Config (base de données, auth, storage, email...)
    ├── repositories/           # Couche d'accès aux données (event, guest, user...)
    ├── services/                # Services (logs, stockage)
    ├── utils/                   # Helpers, validation, sécurité
    ├── data/                    # Fichier JSON de données (secura-data.json)
    ├── uploads/                 # Fichiers uploadés (galeries)
    ├── backups/                 # Sauvegardes automatiques
    └── render.yaml               # Config déploiement backend (Render)
```

## 🚀 Installation

### Frontend
Le frontend est un site statique. Pour le tester en local :
```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (npx)
npx serve

# Avec PHP
php -S localhost:8000
```
Puis ouvrir : `http://localhost:8000`

### Backend
```bash
cd backend
npm install
cp .env.example .env   # renseigner les variables (JWT_SECRET, API_KEY, PORT, ...)
npm run dev             # démarrage avec nodemon
```

Le frontend communique avec le backend via une URL d'API configurée dans `js/storage.js` / `js/auth.js`.

## 📚 Bibliothèques Utilisées

### Frontend (CDN)
- **Font Awesome 6.5.1** - Icônes
- **Google Fonts** - Roboto, Figtree
- **Particles.js 2.0.0** - Animation de fond
- **SweetAlert2 11** - Notifications
- **QRCode.js 1.0.0** - Génération QR
- **jsQR 1.4.0** - Scan QR
- **PapaParse 5.4.1** - Parse CSV
- **JSZip 3.10.1** - Compression ZIP

### Backend (Node.js)
- **Express 4** - Serveur HTTP / routage
- **Socket.IO 4** - Communication temps réel (chat, scans live)
- **jsonwebtoken** - Authentification par token
- **bcryptjs** - Hachage des mots de passe
- **multer** - Upload de fichiers
- **archiver** - Génération d'archives ZIP
- **node-cron** - Tâches planifiées (ex. sauvegardes)
- **moment** - Manipulation de dates

## 💡 Utilisation

### 1. Créer un compte / se connecter
L'accès au dashboard nécessite un compte (inscription/connexion via JWT).

### 2. Créer un Événement
1. Aller sur "Événements"
2. Cliquer "Créer un événement"
3. Remplir le formulaire
4. Sauvegarder

### 3. Ajouter des Invités

#### Méthode Manuelle
1. Sélectionner un événement
2. Cliquer "Ajouter un invité"
3. Remplir les informations
4. Sauvegarder

#### Import CSV
1. Cliquer "Importer CSV"
2. Sélectionner l'événement
3. Glisser-déposer ou choisir le fichier
4. Vérifier l'aperçu
5. Confirmer l'import

Format CSV attendu :
```csv
Prénom,Nom,Email,Téléphone,Entreprise,Notes
Jean,Dupont,jean@example.com,+237 6XX XXX XXX,Entreprise A,VIP
```

### 4. Générer des QR Codes

#### QR Code Individuel
1. Aller sur "Générateur QR"
2. Sélectionner événement et invité
3. Personnaliser l'apparence
4. Cliquer "Générer"
5. Télécharger ou partager

#### Génération en Masse
1. Sélectionner un événement
2. Cliquer "Générer tous les QR Codes"
3. Attendre la génération
4. Télécharger l'archive ZIP

### 5. Scanner des QR Codes

#### Scan par Caméra
1. Aller sur "Scanner"
2. Cliquer "Démarrer le scan"
3. Autoriser l'accès caméra
4. Positionner le QR Code
5. Voir les informations
6. Marquer présent si nécessaire

#### Scan par Image
1. Sélectionner mode "Image"
2. Glisser-déposer ou choisir une image
3. Cliquer "Analyser"
4. Voir les résultats

### 6. Partager une Invitation

Après génération du QR Code :
1. Cliquer "Partager"
2. Choisir le mode :
   - **Email** : Ouvre client email
   - **SMS** : Ouvre app SMS
   - **WhatsApp** : Ouvre WhatsApp Web
   - **Copier** : Copie l'image QR

## 🔧 Personnalisation

### Couleurs
Modifier dans `css/styles.css` :
```css
:root {
    --secura-red: #D97706;      /* Couleur principale */
    --secura-accent: #F4A261;   /* Accent */
    --secura-success: #10B981;  /* Succès */
    --secura-error: #EF4444;    /* Erreur */
}
```

### Configuration QR
Modifier dans `js/qr-generator.js` :
```javascript
let qrConfig = {
    size: 300,
    foreground: '#D97706',
    background: '#FFFFFF',
    style: 'square',
    errorLevel: 'M',
    includeLogo: true
};
```

## 📊 Structure des Données

### Événement
```json
{
  "id": "unique-id",
  "name": "Mariage de Marie et Jean",
  "type": "marriage",
  "date": "2025-12-31",
  "time": "18:00",
  "location": "Salle des Fêtes",
  "capacity": 150,
  "description": "Description...",
  "welcomeMessage": "Bienvenue !",
  "active": true,
  "createdAt": "2025-11-03T10:00:00Z",
  "updatedAt": "2025-11-03T10:00:00Z"
}
```

### Invité
```json
{
  "id": "unique-id",
  "eventId": "event-id",
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@example.com",
  "phone": "+237 6XX XXX XXX",
  "company": "Entreprise",
  "notes": "VIP",
  "status": "pending",
  "scanned": false,
  "scannedAt": null,
  "createdAt": "2025-11-03T10:00:00Z",
  "updatedAt": "2025-11-03T10:00:00Z"
}
```

### QR Code Data
```json
{
  "type": "SECURA_INVITATION",
  "version": "1.0",
  "eventId": "event-id",
  "eventName": "Mariage...",
  "eventDate": "2025-12-31",
  "eventTime": "18:00",
  "eventLocation": "Lieu",
  "guestId": "guest-id",
  "guestFirstName": "Jean",
  "guestLastName": "Dupont",
  "guestEmail": "jean@example.com",
  "guestPhone": "+237...",
  "welcomeMessage": "Bienvenue Jean !",
  "generatedAt": "2025-11-03T10:00:00Z"
}
```

## 🔒 Sécurité & Confidentialité

- Authentification par compte (JWT + mots de passe hachés bcrypt)
- Les données des invités (nom, email, téléphone, statut) sont stockées côté serveur, pas uniquement dans le navigateur
- Les QR Codes contiennent uniquement les infos nécessaires à la validation
- ⚠️ Le fichier `.env` du backend (secrets, clés API, JWT secret) ne doit jamais être commité ni partagé
- ⚠️ Les fichiers de données et de sauvegarde du backend contiennent des informations personnelles sur de vrais invités : à traiter comme sensibles (ne pas committer dans un dépôt public, sauvegarder de façon sécurisée)

## 🌐 Compatibilité

### Navigateurs Supportés
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

### Fonctionnalités Caméra
- ✅ Desktop : Chrome, Edge, Firefox
- ✅ Mobile : Chrome, Safari (iOS 14.3+)
- ⚠️ HTTPS requis pour caméra en production

### Responsive
- ✅ Desktop (1920x1080+)
- ✅ Laptop (1366x768+)
- ✅ Tablet (768x1024)
- ✅ Mobile (375x667+)

## 🐛 Dépannage

### QR Code ne se génère pas
- Vérifier que qrcode.js est chargé
- Vérifier la console pour erreurs
- Essayer de recharger la page

### Caméra ne fonctionne pas
- Autoriser l'accès caméra dans les paramètres
- Utiliser HTTPS (localhost accepté)
- Vérifier que jsQR.js est chargé
- Tester sur un autre navigateur

### Import CSV échoue
- Vérifier le format CSV
- S'assurer que les en-têtes correspondent
- Utiliser UTF-8 sans BOM
- Télécharger le modèle fourni

### Le frontend n'arrive pas à contacter le backend
- Vérifier l'URL de l'API configurée dans `js/storage.js` / `js/auth.js`
- Vérifier que le serveur backend est démarré et accessible
- Vérifier la configuration CORS côté serveur

## 📱 PWA (Progressive Web App)

L'application peut être installée comme app :
1. Ouvrir dans Chrome/Edge
2. Menu → Installer SECURA
3. Icône ajoutée à l'accueil

## 🚀 Améliorations Futures

- [ ] Base de données relationnelle (au lieu du fichier JSON)
- [ ] Envoi email automatique
- [ ] Notifications push
- [ ] Templates d'invitation
- [ ] Statistiques avancées
- [ ] Export PDF
- [ ] Multi-langue
- [ ] Synchronisation cloud

## 📄 Licence

Ce projet est libre d'utilisation pour des projets personnels et commerciaux.

## 👨‍💻 Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Contact : support@secura.app

## 🎯 Crédits

- Design & Développement : Équipe SECURA
- Icônes : Font Awesome
- Animations : Particles.js
- QR Code : QRCode.js & jsQR

---

**SECURA** - Sécurisez vos événements avec style 🛡️✨
