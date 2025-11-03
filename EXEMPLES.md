# 📖 SECURA - Exemples d'Utilisation

## 🎯 Cas d'Usage Pratiques

### 1. 💒 Organiser un Mariage

#### Étape 1 : Créer l'Événement
```
Nom: Mariage de Sophie et Marc
Type: Mariage
Date: 15 juin 2026
Heure: 14:30
Lieu: Château de Versailles, Salle des Glaces
Capacité: 200
Description: Célébration du mariage de Sophie Martin et Marc Dubois
Message de bienvenue: Bienvenue au mariage de Sophie et Marc ! Merci d'être présents pour ce jour spécial.
```

#### Étape 2 : Import CSV des Invités
Créer un fichier `invites_mariage.csv` :
```csv
Prénom,Nom,Email,Téléphone,Entreprise,Notes
Sophie,Dupont,sophie.d@email.com,+237 655 123 456,,Famille mariée
Jean,Martin,jean.m@email.com,+237 655 234 567,Entreprise Tech,Ami proche
Marie,Laurent,marie.l@email.com,+237 655 345 678,,Collègue
Pierre,Bernard,pierre.b@email.com,+237 655 456 789,Cabinet Avocat,VIP - Table d'honneur
```

#### Étape 3 : Générer les QR Codes
1. Utiliser "Génération en masse"
2. Personnaliser : couleur or (#FFD700) pour mariage chic
3. Télécharger le ZIP
4. Imprimer sur les faire-part

#### Étape 4 : Jour J - Scanner
- Installer un iPad/tablette à l'entrée
- Scanner les QR codes à l'arrivée
- Suivre les présences en temps réel

### 2. 🎂 Anniversaire d'Entreprise

#### Événement
```
Nom: 10 ans de TechCorp
Type: Anniversaire
Date: 20 novembre 2025
Heure: 18:00
Lieu: Hôtel Hilton - Grande Salle
Capacité: 500
Message: Merci de célébrer avec nous 10 années d'innovation !
```

#### Gestion VIP
Ajouter des notes pour identifier les VIP :
```
Notes: VIP - CEO
Notes: VIP - Investisseur principal
Notes: VIP - Partenaire stratégique
Notes: Presse - Journaliste TechMag
```

#### QR Codes Personnalisés
- **VIP** : Couleur rouge (#DC2626), taille 400px
- **Standard** : Couleur bleue (#3B82F6), taille 300px
- **Presse** : Couleur verte (#10B981), taille 300px

### 3. 📊 Conférence Professionnelle

#### Configuration Multi-Sessions
```
Nom: DevCon 2025 - Conférence Développeurs
Type: Conférence
Date: 5-7 mars 2025
Lieu: Centre des Congrès de Yaoundé
Capacité: 1000
```

#### Import Participants
```csv
Prénom,Nom,Email,Téléphone,Entreprise,Notes
Alice,Johnson,alice@dev.com,+237 655 111 222,Google,Keynote Speaker
Bob,Smith,bob@startup.io,+237 655 222 333,Startup.io,Workshop IoT - Jour 2
Carol,Williams,carol@tech.cm,+237 655 333 444,TechCM,Participant Standard
David,Brown,david@code.org,+237 655 444 555,Code.org,Sponsor Platinum
```

#### Partage Automatique
Après génération des QR :
1. Sélectionner l'invité
2. Clic sur "Partager"
3. Envoyer par email automatiquement
4. Le QR arrive en pièce jointe

### 4. 🎉 Événement Communautaire

#### Fête de Quartier
```
Nom: Fête du Quartier Bastos
Type: Autre
Date: 14 juillet 2025
Heure: 15:00
Lieu: Parc Municipal Bastos
Capacité: 300
Message: Bienvenue à notre fête annuelle ! Profitez des animations !
```

#### Ajout Famille
```csv
Prénom,Nom,Email,Téléphone,Entreprise,Notes
Martin,Famille,martin.fam@email.com,+237 655 555 666,,4 personnes - enfants 6 et 9 ans
Sophie,Famille,sophie.fam@email.com,+237 655 666 777,,2 personnes
```

#### Scan à l'Entrée
- Point de contrôle unique
- Scanner pour distribution de bracelets
- Suivi du nombre de participants

## 🔧 Scénarios Techniques

### Scénario 1 : Récupération après Perte de Données

#### Backup Préventif
```javascript
// Créer un backup avant événement important
const backup = storage.createBackup();
downloadFile(backup, 'secura_backup_avant_mariage.json', 'application/json');
```

#### Restauration
```javascript
// En cas de problème
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const success = storage.restoreBackup(event.target.result);
        if (success) {
            showNotification('success', 'Backup restauré !');
            location.reload();
        }
    };
    reader.readAsText(file);
};
fileInput.click();
```

### Scénario 2 : Export pour Impression Massive

#### Script d'Export Personnalisé
```javascript
// Exporter tous les QR codes avec infos
const event = storage.getEventById('event-id');
const guests = storage.getGuestsByEventId('event-id');

const exportData = guests.map(guest => ({
    nom_complet: `${guest.firstName} ${guest.lastName}`,
    email: guest.email,
    qr_filename: `QR_${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}_${guest.lastName}.png`,
    table: guest.notes // Si notes contient le numéro de table
}));

console.table(exportData);
downloadFile(JSON.stringify(exportData, null, 2), 'export_impression.json', 'application/json');
```

### Scénario 3 : Statistiques Personnalisées

#### Script de Reporting
```javascript
// Rapport complet d'événement
function generateEventReport(eventId) {
    const event = storage.getEventById(eventId);
    const guests = storage.getGuestsByEventId(eventId);
    const scanned = guests.filter(g => g.scanned);
    
    const report = {
        evenement: event.name,
        date: event.date,
        capacite: event.capacity,
        inscrits: guests.length,
        presents: scanned.length,
        taux_presence: `${Math.round((scanned.length / guests.length) * 100)}%`,
        absents: guests.length - scanned.length,
        par_entreprise: {}
    };
    
    // Grouper par entreprise
    guests.forEach(g => {
        const company = g.company || 'Sans entreprise';
        if (!report.par_entreprise[company]) {
            report.par_entreprise[company] = {
                total: 0,
                presents: 0
            };
        }
        report.par_entreprise[company].total++;
        if (g.scanned) report.par_entreprise[company].presents++;
    });
    
    console.log('📊 RAPPORT D\'ÉVÉNEMENT');
    console.table(report);
    return report;
}
```

## 📱 Workflows Mobiles

### Workflow 1 : Organisateur Mobile

**Avant l'Événement** :
1. Créer l'événement sur desktop
2. Importer CSV des invités
3. Générer tous les QR codes
4. Partager par WhatsApp

**Jour J** :
1. Ouvrir SECURA sur smartphone
2. Mode Scanner → Caméra
3. Scanner à l'entrée
4. Marquer présents en temps réel

### Workflow 2 : Invité avec QR

**Réception** :
1. Recevoir QR par email/SMS
2. Enregistrer image ou screenshot
3. Présenter à l'entrée

**Alternative** :
1. Imprimer le QR sur carte
2. Découper et plastifier
3. Badge réutilisable

### Workflow 3 : Équipe Multiple

**Setup** :
1. Créer événement central
2. Exporter backup JSON
3. Distribuer à l'équipe
4. Chaque personne importe

**Consolidation** :
1. Récupérer les scans de chaque poste
2. Fusionner les données
3. Rapport unique

## 🎨 Personnalisations Avancées

### QR Code Thématique Mariage
```javascript
// Dans qr-generator.js
const weddingConfig = {
    size: 350,
    foreground: '#FFD700',  // Or
    background: '#FFFFFF',
    style: 'rounded',       // Arrondi élégant
    errorLevel: 'H',        // Haute correction
    includeLogo: true
};
```

### QR Code Corporate
```javascript
const corporateConfig = {
    size: 300,
    foreground: '#1E40AF',  // Bleu corporate
    background: '#F3F4F6',  // Gris clair
    style: 'square',
    errorLevel: 'M',
    includeLogo: true
};
```

### QR Code Festif
```javascript
const partyConfig = {
    size: 400,
    foreground: '#EC4899',  // Rose vif
    background: '#FFFFFF',
    style: 'dots',          // Points ludiques
    errorLevel: 'L',
    includeLogo: true
};
```

## 📊 Templates CSV Prêts à l'Emploi

### Template Mariage
```csv
Prénom,Nom,Email,Téléphone,Entreprise,Notes
Sophie,Martin,sophie@email.com,+237 655 111 222,,Famille Mariée - Table 1
Jean,Dupont,jean@email.com,+237 655 222 333,,Amis - Table 5
Marie,Durand,marie@email.com,+237 655 333 444,,Collègues - Table 8
```

### Template Conférence
```csv
Prénom,Nom,Email,Téléphone,Entreprise,Notes
Alice,Johnson,alice@corp.com,+237 655 111 222,TechCorp,Speaker - Keynote 10h
Bob,Smith,bob@startup.io,+237 655 222 333,Startup.io,Participant - Track A
Carol,Williams,carol@agency.cm,+237 655 333 444,Agency CM,Sponsor - Stand 12
```

### Template Entreprise
```csv
Prénom,Nom,Email,Téléphone,Entreprise,Notes
Martin,Directeur,martin@company.cm,+237 655 111 222,Direction,VIP - Table d'honneur
Sophie,Manager,sophie@company.cm,+237 655 222 333,Marketing,Manager - Table 3
Pierre,Employee,pierre@company.cm,+237 655 333 444,IT,Employé - Table 7
```

## 🔥 Astuces Pro

### Astuce 1 : QR Codes Réutilisables
Créer des QR permanents pour événements récurrents :
- Générer une fois
- Plastifier
- Réutiliser chaque mois

### Astuce 2 : Double Vérification
Pour événements sensibles :
1. Scanner le QR
2. Vérifier photo d'identité
3. Cocher dans liste papier

### Astuce 3 : Backup Automatique
Programmer un export quotidien :
```javascript
// Dans la console navigateur
setInterval(() => {
    const backup = storage.createBackup();
    downloadFile(backup, `backup_${Date.now()}.json`, 'application/json');
}, 24 * 60 * 60 * 1000); // Tous les jours
```

### Astuce 4 : Statistiques Live
Afficher un écran de stats pendant l'événement :
```javascript
function displayLiveStats() {
    const stats = storage.getStatistics();
    console.clear();
    console.log('🎉 STATISTIQUES EN DIRECT');
    console.log(`✅ Présents: ${stats.scannedGuests}`);
    console.log(`⏳ En attente: ${stats.totalGuests - stats.scannedGuests}`);
    console.log(`📊 Taux: ${Math.round((stats.scannedGuests/stats.totalGuests)*100)}%`);
}

setInterval(displayLiveStats, 5000); // Toutes les 5 secondes
```

## ✅ Checklist Événement Parfait

### Une Semaine Avant
- [ ] Événement créé et vérifié
- [ ] Tous les invités importés
- [ ] QR codes générés
- [ ] QR codes envoyés aux invités
- [ ] Backup créé

### Un Jour Avant
- [ ] Vérifier matériel de scan (tablette/smartphone chargé)
- [ ] Tester le scanner
- [ ] Imprimer liste papier de secours
- [ ] Briefer l'équipe

### Jour J
- [ ] Ouvrir l'app 30 min avant
- [ ] Tester un scan test
- [ ] Position scan accessible
- [ ] Suivi stats en temps réel

### Après l'Événement
- [ ] Export des présences
- [ ] Rapport final
- [ ] Backup post-événement
- [ ] Archivage

---

**Prêt à organiser des événements exceptionnels ! 🎊**