# 📥 Guide d'Import CSV des Invités - SECURA QR

## 🎯 Vue d'ensemble

Ce guide explique comment importer des invités en masse dans SECURA QR à partir d'un fichier CSV. Le système offre une validation complète, un aperçu éditable et une confirmation avant l'importation.

---

## 📋 Champs Requis et Optionnels

### Champs **Obligatoires** (marqués avec *)

| Champ | Type | Description | Format / Valeurs acceptées |
|-------|------|-------------|---------------------------|
| **Prénom** | Texte | Prénom de l'invité | Chaîne de caractères (max 50) |
| **Nom** | Texte | Nom de famille | Chaîne de caractères (max 50) |
| **Email** | Email | Adresse électronique | Format: user@domaine.com |

### Champs **Optionnels**

| Champ | Type | Description | Format / Valeurs acceptées | Défaut |
|-------|------|-------------|---------------------------|--------|
| Téléphone | Texte | Numéro de contact | Format: +33 6 XX XX XX XX ou variations | - |
| Entreprise | Texte | Nom de l'organisation | Chaîne de caractères | - |
| Genre | Liste | Catégorie de genre | `m`, `f`, `homme`, `femme`, `couple`, `maman`, `autre` | - |
| Places | Nombre | Nombre de places reservées | Entier ≥ 1 | 1 |
| Type | Liste | Catégorie d'invité | `standard`, `vip`, `speaker`, `sponsor` | standard |
| Statut | Liste | État de l'invité | `pending`, `confirmed`, `cancelled` | pending |
| Notes | Texte | Commentaires additionnels | Chaîne de caractères | - |

---

## 📁 Télécharger le Modèle

Un modèle CSV pré-formaté est disponible dans l'interface d'import:

1. Cliquez sur le bouton **📥 Importer CSV** dans la section invités
2. Cliquez sur **⬇️ Télécharger modèle**
3. Ouvrez le fichier dans votre tableur préféré (Excel, Sheets, LibreOffice)

**Fichier modèle**: `modele-invites-secura.csv`

---

## 📝 Format du Fichier CSV

### En-tête (1ère ligne - obligatoire)

```csv
Prénom,Nom,Email,Téléphone,Entreprise,Genre,Places,Type,Statut,Notes
```

### Exemple de données complètes

```csv
Prénom,Nom,Email,Téléphone,Entreprise,Genre,Places,Type,Statut,Notes
Jean,Dupont,jean@exemple.com,+33 6 12 34 56 78,Company SA,m,1,standard,pending,Invitation standard
Marie,Martin,marie@exemple.com,+33 6 98 76 54 32,Startup Inc.,f,1,vip,confirmed,Invitation VIP
Pierre,Durand,pierre@exemple.com,+33 6 11 22 33 44,Tech Corp,m,2,standard,pending,Avec accompagnant
Sophie,Bernard,sophie@exemple.com,+33 6 55 66 77 88,Events Pro,couple,3,speaker,confirmed,Couple avec enfants
```

### Exemple de données minimales (champs obligatoires seulement)

```csv
Prénom,Nom,Email
Jean,Dupont,jean@exemple.com
Marie,Martin,marie@exemple.com
```

> **Note**: Les champs optionnels vides seront complétés avec des valeurs par défaut

---

## ✅ Règles de Validation

### Validation Automatique

Le système valide automatiquement:

1. **Email**: Format valide requise (format: user@domain.com)
   - ❌ Invalide: `jean@`, `@exemple.com`, `jean exemple`
   - ✅ Valide: `jean@exemple.com`, `marie.martin@company.fr`

2. **Téléphone** (optionnel): Format flexible accepté
   - ✅ Valide: `+33 6 12 34 56 78`, `06.12.34.56.78`, `0612345678`

3. **Places**: Doit être un nombre ≥ 1
   - ❌ Invalide: `0`, `-1`, `abc`
   - ✅ Valide: `1`, `2`, `10`

4. **Genre**: Normalisé automatiquement
   - Accepte: `m`, `f`, `homme`, `femme`, `couple`, `maman`, `autre`
   - Case insensitive

5. **Type**: Normalisé automatiquement
   - Doit être parmi: `standard`, `vip`, `speaker`, `sponsor`
   - Par défaut: `standard`

6. **Statut**: Normalisé automatiquement
   - Doit être parmi: `pending`, `confirmed`, `cancelled`
   - Par défaut: `pending`

### Indicateurs d'État

Après la sélection du fichier, chaque ligne affiche un badge:

- 🟢 **Valide**: Tous les champs obligatoires sont corrects
- 🔴 **Invalide**: Au moins un champ obligatoire est manquant ou mal formaté
- ⚠️ **Avertissement**: Champs optionnels mal formatés

### Messages d'Erreur

Les erreurs sont affichées sous chaque ligne:

```
❌ "Prénom" est obligatoire
❌ "Email" n'est pas valide
⚠️ "Téléphone" n'est pas au bon format
```

---

## 🔄 Processus d'Import en 3 Étapes

### Étape 1: Sélection du Fichier

```
📥 Import CSV
├─ Sélectionnez l'événement
├─ Glissez-déposez un fichier CSV ou cliquez pour parcourir
└─ Cliquez sur "Continuer"
```

**Actions disponibles:**
- Télécharger le modèle
- Glisser-déposer un fichier
- Cliquer pour ouvrir l'explorateur

### Étape 2: Édition et Validation

```
🔍 Aperçu & Édition
├─ Tableau interactif avec tous les champs
├─ Validation en temps réel
├─ Ajouter/supprimer des lignes
└─ Éditer les valeurs directement
```

**Actions disponibles:**
- Éditer chaque cellule
- Ajouter une nouvelle ligne (🟢 +)
- Supprimer une ligne (🗑️)
- Voir les erreurs de validation
- Navigation avec les flèches

### Étape 3: Confirmation et Import

```
✅ Résumé d'Import
├─ Nombre total d'invités
├─ Nombre de lignes valides
├─ Nombre de lignes en erreur
├─ Statut de chaque ligne
└─ Cliquer sur "Importer" pour confirmer
```

**Actions disponibles:**
- Revenir à l'édition (Étape 2)
- Annuler l'import
- Confirmer et importer

---

## 🛠️ Cas d'Usage et Exemples

### Cas 1: Créer des Invités depuis Zéro

**Fichier CSV minimal:**
```csv
Prénom,Nom,Email
Alice,Durand,alice@exemple.com
Bob,Martin,bob@exemple.com
Carole,Petit,carole@exemple.com
```

**Résultat après import:**
- 3 invités créés
- Email: validé ✓
- Téléphone: vide (optionnel)
- Type: `standard` (défaut)
- Statut: `pending` (défaut)
- Places: `1` (défaut)

### Cas 2: Importer depuis LinkedIn/Contact Manager

**Export typique de LinkedIn (à adapter):**

1. Exporter les contacts de LinkedIn (CSV)
2. Garder les colonnes: First Name, Last Name, Email
3. Renommer les en-têtes:
   - `First Name` → `Prénom`
   - `Last Name` → `Nom`
   - `Email Address` → `Email`
4. Importer dans SECURA QR

### Cas 3: Importer avec Catégories VIP

```csv
Prénom,Nom,Email,Type,Statut
Jean,Dupont,jean@exemple.com,vip,confirmed
Marie,Martin,marie@exemple.com,speaker,confirmed
Pierre,Durand,pierre@exemple.com,standard,pending
```

### Cas 4: Importer avec Accompagnants

```csv
Prénom,Nom,Email,Places,Genre
Famille,Martin,martin@exemple.com,3,couple
Groupe,Association,asso@exemple.com,5,autre
```

### Cas 5: Import depuis Excel

**Procédure:**

1. Préparez votre fichier Excel
2. Assurez-vous d'avoir les colonnes: Prénom, Nom, Email, etc.
3. **Enregistrer sous** → Format **CSV UTF-8 (.csv)**
4. Donnez un nom au fichier
5. Importez dans SECURA QR

> ⚠️ **Important**: Enregistrez en UTF-8 pour supporter les caractères accentués

---

## ⚠️ Erreurs Courantes et Solutions

### Erreur 1: "Seuls les fichiers CSV sont acceptés"

**Cause**: Vous avez téléchargé un fichier qui n'est pas un CSV

**Solution**:
- Si c'est un Excel: Enregistrez sous format CSV
- Vérifiez l'extension du fichier (doit être `.csv`)

### Erreur 2: "Email" n'est pas valide

**Cause**: Format d'email incorrect

**Exemple invalide**: `jean@`, `@exemple`, `jean exemple.com`

**Solution**:
- Format requis: `prenom.nom@domaine.com`
- Vérifiez qu'il y a un `@` et un `.`

### Erreur 3: "Prénom" est obligatoire

**Cause**: Cellule vide pour le prénom

**Solution**:
- Supprimez la ligne ou remplissez le prénom
- Utiliser "?" ou un placeholder temporaire si nécessaire

### Erreur 4: Caractères accentués affichés en "????"

**Cause**: Le fichier n'a pas été enregistré en UTF-8

**Solution**:
- Ouvrez le fichier CSV dans un éditeur de texte
- Enregistrez avec l'encodage **UTF-8**
- Ré-importez

### Erreur 5: Les données ne s'importent pas

**Cause**: Les en-têtes ne correspondent pas exactement

**Vérifiez que la première ligne contient EXACTEMENT:**
```
Prénom,Nom,Email,Téléphone,Entreprise,Genre,Places,Type,Statut,Notes
```

Ne pas inclure d'espaces supplémentaires ou de majuscules incorrectes.

---

## 📊 Tableau Récapitulatif des Options

### Genre - Valeurs Acceptées

| Valeur | Signification |
|--------|--------------|
| `m` ou `homme` | Homme |
| `f` ou `femme` | Femme |
| `couple` | Couple |
| `maman` | Mère avec enfant(s) |
| `autre` | Autre catégorie |

### Type - Valeurs Acceptées

| Valeur | Signification |
|--------|--------------|
| `standard` | Invité standard (défaut) |
| `vip` | Invité VIP avec accès privilégié |
| `speaker` | Conférencier/Présentateur |
| `sponsor` | Partenaire/Sponsor |

### Statut - Valeurs Acceptées

| Valeur | Signification |
|--------|--------------|
| `pending` | En attente de confirmation (défaut) |
| `confirmed` | Confirmé |
| `cancelled` | Annulé |

---

## 💡 Conseils et Bonnes Pratiques

### ✅ À Faire

- ✓ Téléchargez d'abord le modèle fourni
- ✓ Enregistrez votre fichier en **UTF-8**
- ✓ Vérifiez les emails avant d'importer
- ✓ Utilisez des valeurs standards (standard, vip, etc.)
- ✓ Incluez des notes pour les invités spéciaux
- ✓ Validez les données dans l'aperçu avant confirmation
- ✓ Conservez une copie de sauvegarde de votre CSV original

### ❌ À Éviter

- ✗ Ne changez pas les noms des en-têtes
- ✗ N'incluez pas de lignes de commentaires (ils seront importés)
- ✗ N'utilisez pas de cellules fusionnées dans Excel
- ✗ Ne mélangez pas les formats (PDF dans une colonne Email, par exemple)
- ✗ N'utilisez pas d'apostrophes non-échappées: préférez "l'ami" → "l ami" ou "l_ami"
- ✗ Ne mettez pas d'accents bizarres: `résumé` ✓ mais pas d'autres encodages

### 🔐 Sécurité et Confidentialité

- Les données CSV sont **importées localement** dans votre instance
- Aucune donnée n'est envoyée à un serveur externe (selon la configuration)
- Les emails sont **hashés** pour les QR codes
- Conservez vos fichiers CSV dans un endroit sécurisé

---

## 🔗 Liens et Ressources

- **Template de base**: Cliquez sur "⬇️ Télécharger modèle" dans l'interface
- **Exemple complet**: Consulter `exemple_invites.csv` dans la racine du projet
- **Format CSV**: [RFC 4180 CSV Standard](https://tools.ietf.org/html/rfc4180)

---

## 📞 Support et Dépannage

### Vérifier les Prérequis

Avant d'importer:

1. ✓ Un événement est sélectionné
2. ✓ Votre fichier est au format `.csv`
3. ✓ Les en-têtes sont corrects
4. ✓ Tous les champs obligatoires sont remplis
5. ✓ Les emails sont au bon format

### Consulter les Logs

Si vous rencontrez des problèmes:

1. Ouvrez la Console du Navigateur (F12)
2. Allez à l'onglet **Console**
3. Cherchez les messages avec `📥` (import CSV)
4. Les erreurs sont marquées avec `❌`

---

**Version**: 1.0  
**Dernière mise à jour**: 28 Janvier 2026  
**Auteur**: SECURA QR Development Team
