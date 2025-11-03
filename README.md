# 🛡️ SECURA - Plateforme de Gestion d'Événements avec QR Code

## 📋 Description

SECURA est une application web complète et moderne pour la gestion d'événements (mariages, anniversaires, conférences) avec génération de QR Codes stylisés pour les invités. L'application permet de créer des événements, gérer les invités, générer des QR Codes personnalisés et scanner ces codes pour valider les présences.

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

### 🎨 Interface Utilisateur
- Design moderne et responsive
- Thème clair/sombre
- Animations fluides
- Effets particles.js
- Mode plein écran
- Navigation intuitive
- Notifications toast (SweetAlert2)

### 💾 Stockage & Données
- LocalStorage (JSON)
- Sauvegarde automatique
- Export/Import complet
- Structure événements → invités → QR codes
- Backup et restauration

## 🗂️ Structure du Projet

```
secura/
├── index.html              # Page d'accueil
├── events.html             # Gestion événements
├── guests.html             # Gestion invités
├── qr-generator.html       # Générateur QR
├── scanner.html            # Scanner QR
├── css/
│   └── styles.css          # Styles complets
├── js/
│   ├── storage.js          # Gestion stockage
│   ├── theme.js            # Thème clair/sombre
│   ├── main.js             # Scripts communs
│   ├── particles-config.js # Configuration particles
│   ├── events.js           # Logique événements
│   ├── guests.js           # Logique invités
│   ├── qr-generator.js     # Générateur QR
│   └── scanner.js          # Scanner QR
└── README.md              # Documentation
```

## 🚀 Installation

### Prérequis
- Navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Serveur web local (optionnel pour tester)

### Installation Simple
1. Télécharger tous les fichiers
2. Créer les dossiers `css/` et `js/`
3. Placer les fichiers dans leurs dossiers respectifs
4. Ouvrir `index.html` dans un navigateur

### Installation avec Serveur Local (Recommandé)
```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (npx)
npx serve

# Avec PHP
php -S localhost:8000
```

Puis ouvrir : `http://localhost:8000`

## 📚 Bibliothèques Utilisées

### CSS/Design
- **Font Awesome 6.5.1** - Icônes
- **Google Fonts** - Roboto, Figtree

### JavaScript
- **Particles.js 2.0.0** - Animation de fond
- **SweetAlert2 11** - Notifications
- **QRCode.js 1.0.0** - Génération QR
- **jsQR 1.4.0** - Scan QR
- **PapaParse 5.4.1** - Parse CSV
- **JSZip 3.10.1** - Compression ZIP

Toutes les bibliothèques sont chargées depuis des CDN.

## 💡 Utilisation

### 1. Créer un Événement
1. Aller sur "Événements"
2. Cliquer "Créer un événement"
3. Remplir le formulaire
4. Sauvegarder

### 2. Ajouter des Invités

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

### 3. Générer des QR Codes

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

### 4. Scanner des QR Codes

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

### 5. Partager une Invitation

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

- ✅ Toutes les données sont stockées localement (LocalStorage)
- ✅ Aucune donnée envoyée à un serveur externe
- ✅ Les QR Codes contiennent uniquement les infos nécessaires
- ✅ Pas de tracking ni analytics
- ⚠️ Backup recommandé (Export JSON)

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

### Données perdues
- Vérifier LocalStorage du navigateur
- Ne pas effacer les données du site
- Faire des exports réguliers
- Utiliser mode navigation privée avec précaution

## 📱 PWA (Progressive Web App)

L'application peut être installée comme app :
1. Ouvrir dans Chrome/Edge
2. Menu → Installer SECURA
3. Icône ajoutée à l'accueil

## 🚀 Améliorations Futures

- [ ] Backend avec base de données
- [ ] Authentification utilisateurs
- [ ] Envoi email automatique
- [ ] Notifications push
- [ ] Templates d'invitation
- [ ] Statistiques avancées
- [ ] Export PDF
- [ ] Multi-langue
- [ ] API REST
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