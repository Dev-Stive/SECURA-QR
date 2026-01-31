# Schéma d'Import de Tables - Format CSV

## Description
Ce schéma définit le format CSV pour importer des tables en masse via l'endpoint `/api/events/:eventId/tables/bulk`.

---

## Champs à remplir

### Champs OBLIGATOIRES:
1. **tableName** (Obligatoire)
   - Nom de la table
   - Min. 2 caractères
   - Exemple: `Salon Premium`, `Table VIP`, `Zone Cocktail`

2. **capacity** (Obligatoire)
   - Capacité en nombre de places
   - Minimum: 1
   - Type: Nombre entier
   - Exemple: `8`, `10`, `12`, `6`

### Champs OPTIONNELS:

3. **tableNumber** (Optionnel)
   - Numéro/Identifiant de la table
   - Sera utilisé pour affichage
   - Exemple: `1`, `A1`, `VIP-01`, `Salon-001`
   - NOTE: Si non fourni, un code d'accès auto-généré sera utilisé (format XX-YY)

4. **location** (Optionnel)
   - Localisation/Zone de la table
   - Exemple: `Étage 1`, `Salle principale`, `Terrasse`, `Hall d'entrée`

5. **category** (Optionnel)
   - Catégorie de la table
   - Valeur par défaut: `general`
   - Autres valeurs possibles: `vip`, `premium`, `standard`, `enfants`, `Familiale` ,`organisateur`,`Conferencier`;
   - Exemple: `vip`, `premium`, `standard`

6. **description** (Optionnel)
   - Description/Notes sur la table
   - Exemple: `Table proche de la scène`, `Vue panoramique`, `Accessibilité handicapés`

---

## Format CSV

```csv
tableName,capacity,tableNumber,location,category,description
Salon Premium,8,1,Étage 1,vip,Table VIP avec vue directe sur la scène
Table Standard,6,2,Étage 1,standard,Table standard
Zone Cocktail,12,3,Hall d'entrée,general,Table haute pour réception
Terrasse,10,4,Jardin,premium,Tables en extérieur - Vue panoramique
Table enfants,4,5,Étage 2,special,Espace enfants avec animations
```

---

## Exemple complet avec tous les champs

### CSV Minimal (champs obligatoires uniquement):
```csv
tableName,capacity
Table 1,8
Table 2,6
Table 3,10
```

### CSV Complet (tous les champs):
```csv
tableName,capacity,tableNumber,location,category,description
"Salon Premium",8,1,"Étage 1 - Côté fenêtres",vip,"Table VIP avec vue directe sur la scène"
"Table Standard",6,2,"Étage 1 - Centre",standard,"Table standard"
"Zone Cocktail",12,3,"Hall d'entrée",general,"Table haute pour réception"
"Terrasse",10,4,"Jardin - Côté ouest",premium,"Tables en extérieur - Vue panoramique"
"Table enfants",4,5,"Étage 2 - Coin sud",special,"Espace enfants avec animations"
"Table PMR",6,6,"Étage 1 - Entrée",standard,"Accessibilité handicapés"
```

---

## Règles d'Import

### Validations:
- ✅ **tableName** minimum 2 caractères
- ✅ **capacity** minimum 1
- ✅ Les doublons dans la même table sont rejetés
- ❌ Les valeurs invalides génèrent des erreurs par ligne

### Réponse API:
```json
{
  "success": true,
  "data": [
    {
      "id": "tbl_1768636723399_oo9xkshed",
      "tableName": "Salon Premium",
      "tableNumber": "1",
      "capacity": 8,
      "location": "Étage 1 - Côté fenêtres",
      "category": "vip",
      "description": "Table VIP avec vue directe sur la scène",
      "eventId": "sec_1762209757419_exl3pjlf0",
      "qrCode": {...},
      "assignedGuests": [],
      "guestCount": 0,
      "status": "active",
      "createdAt": "2026-01-27T10:30:00.000Z",
      "updatedAt": "2026-01-27T10:30:00.000Z"
    }
  ],
  "count": 1,
  "message": "1 table(s) créée(s)"
}
```

---

## Champs AUTO-GÉNÉRÉS (ne pas fournir):

Ces champs sont créés automatiquement par le système:

1. **id** - Identifiant unique (format: `tbl_[timestamp]_[random]`)
2. **eventId** - Récupéré de l'URL (`:eventId`)
3. **qrCode** - Généré automatiquement:
   - `qrCode.id` - ID unique du QR Code
   - `qrCode.qrData` - Données du QR Code
   - `qrCode.qrUrl` - URL du QR Code
   - `qrCode.scanCount` - Compteur de scans (0)
   - `qrCode.lastScan` - Null
   - `qrCode.createdAt` - Date/heure actuelle

4. **assignedGuests** - Liste vide au départ (invités assignés plus tard)
5. **guestCount** - 0 à la création
6. **status** - Toujours `active`
7. **isActive** - Toujours `true`
8. **createdAt** - Date/heure actuelle
9. **updatedAt** - Date/heure actuelle
