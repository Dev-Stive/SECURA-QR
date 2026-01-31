-- ============================================================================
-- BASE DE DONNÉES: OMEDA (Observance Médicale Et Données Analytiques)
-- SYSTÈME DE GESTION DE TRAITEMENT MÉDICAL
-- Version: 2.0 - Architecture Complète et Décentralisée
-- ============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `omeda` 
DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `omeda`;

-- ============================================================================
-- SECTION 1: GESTION DES UTILISATEURS ET AUTHENTIFICATION
-- ============================================================================

-- ============================================================================
-- 1. TABLE: ROLES (Rôles système)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Identifiant unique du rôle',
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code unique du rôle (ADMIN, PHARMACIEN, USER)',
  libelle VARCHAR(100) NOT NULL COMMENT 'Libellé du rôle',
  description TEXT COMMENT 'Description détaillée du rôle',
  niveau_acces TINYINT NOT NULL DEFAULT 1 COMMENT 'Niveau d''accès hiérarchique (1-10)',
  est_actif TINYINT(1) DEFAULT 1 COMMENT '1 = actif, 0 = désactivé',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_niveau (niveau_acces)
) ENGINE=InnoDB COMMENT='Définition des rôles du système';

-- ============================================================================
-- 2. TABLE: UTILISATEURS (Comptes système)
-- ============================================================================
CREATE TABLE IF NOT EXISTS utilisateurs (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID unique de l''utilisateur',
  email VARCHAR(255) UNIQUE NOT NULL COMMENT 'Email unique de connexion',
  telephone VARCHAR(20) UNIQUE COMMENT 'Numéro de téléphone unique',
  password VARCHAR(255) NOT NULL COMMENT 'Mot de passe hashé (bcrypt)',
  role_id INT NOT NULL COMMENT 'Rôle de l''utilisateur',
  est_actif TINYINT(1) DEFAULT 1 COMMENT '1 = compte actif, 0 = désactivé',
  est_verifie TINYINT(1) DEFAULT 0 COMMENT '1 = email vérifié',
  code_verification VARCHAR(100) COMMENT 'Code de vérification email',
  code_parrainage VARCHAR(20) UNIQUE COMMENT 'Code personnel pour identifier facilement le patient',
  derniere_connexion TIMESTAMP NULL COMMENT 'Date de dernière connexion',
  tentatives_connexion TINYINT DEFAULT 0 COMMENT 'Nombre de tentatives échouées',
  date_blocage TIMESTAMP NULL COMMENT 'Date de blocage du compte',
  remember_token VARCHAR(100) COMMENT 'Token de session persistante',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  INDEX idx_email (email),
  INDEX idx_telephone (telephone),
  INDEX idx_role (role_id),
  INDEX idx_code_parrainage (code_parrainage)
) ENGINE=InnoDB COMMENT='Comptes utilisateurs du système';

-- ============================================================================
-- 3. TABLE: PATIENTS (Profils patients - utilisateurs ou invités)
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID unique du patient',
  utilisateur_id CHAR(36) UNIQUE COMMENT 'Lien facultatif vers compte utilisateur',
  nom VARCHAR(255) NOT NULL COMMENT 'Nom du patient',
  prenom VARCHAR(255) NOT NULL COMMENT 'Prénom du patient',
  genre ENUM('Masculin', 'Feminin', 'Autre') NOT NULL COMMENT 'Genre du patient',
  date_naissance DATE NOT NULL COMMENT 'Date de naissance',
  age INT COMMENT 'Âge du patient (valeur fixe à mettre à jour)',
  groupe_sanguin VARCHAR(5) COMMENT 'Groupe sanguin',
  poids_kg DECIMAL(5, 2) COMMENT 'Poids en kg',
  taille_cm INT COMMENT 'Taille en cm',
  telephone VARCHAR(20) COMMENT 'Téléphone du patient',
  email VARCHAR(255) COMMENT 'Email du patient',
  adresse_rue VARCHAR(255) COMMENT 'Adresse',
  ville VARCHAR(100) COMMENT 'Ville',
  pays VARCHAR(100) COMMENT 'Pays',
  est_utilisateur TINYINT(1) DEFAULT 0 COMMENT '1 = utilisateur enregistré, 0 = invité',
  statut_dossier ENUM('actif', 'inactif', 'archive') DEFAULT 'actif',
  allergies TEXT COMMENT 'Liste des allergies',
  antecedents_medicaux TEXT COMMENT 'Antécédents médicaux',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_utilisateur (utilisateur_id),
  INDEX idx_genre (genre),
  INDEX idx_age (age_calcule),
  INDEX idx_statut (statut_dossier)
) ENGINE=InnoDB COMMENT='Profils patients (enregistrés ou invités)';

-- ============================================================================
-- 4. TABLE: PHARMACIES (Établissements pharmaceutiques)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacies (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID unique de la pharmacie',
  utilisateur_id CHAR(36) UNIQUE NOT NULL COMMENT 'Compte utilisateur associé',
  nom VARCHAR(255) NOT NULL COMMENT 'Nom de la pharmacie',
  numero_agrement VARCHAR(100) UNIQUE COMMENT 'Numéro d''agrément officiel',
  pays VARCHAR(100) NOT NULL COMMENT 'Pays',
  ville VARCHAR(100) NOT NULL COMMENT 'Ville',
  quartier VARCHAR(100) COMMENT 'Quartier',
  adresse_complete TEXT COMMENT 'Adresse complète',
  telephone VARCHAR(20) NOT NULL COMMENT 'Téléphone principal',
  email VARCHAR(255) COMMENT 'Email de contact',
  latitude DECIMAL(10, 8) COMMENT 'Latitude GPS',
  longitude DECIMAL(11, 8) COMMENT 'Longitude GPS',
  horaires_ouverture JSON COMMENT 'Horaires d''ouverture par jour',
  est_garde TINYINT(1) DEFAULT 0 COMMENT '1 = pharmacie de garde',
  statut ENUM('actif', 'suspendu', 'ferme') DEFAULT 'actif',
  nombre_rappels_crees INT DEFAULT 0 COMMENT 'Compteur de rappels créés',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  INDEX idx_ville (ville),
  INDEX idx_statut (statut),
  INDEX idx_coords (latitude, longitude)
) ENGINE=InnoDB COMMENT='Pharmacies partenaires du système';

-- ============================================================================
-- 5. TABLE: ADMINISTRATEURS (Gestionnaires système)
-- ============================================================================
CREATE TABLE IF NOT EXISTS administrateurs (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID unique de l''administrateur',
  utilisateur_id CHAR(36) UNIQUE NOT NULL COMMENT 'Compte utilisateur associé',
  nom VARCHAR(255) NOT NULL COMMENT 'Nom de l''administrateur',
  prenom VARCHAR(255) NOT NULL COMMENT 'Prénom',
  fonction VARCHAR(100) COMMENT 'Fonction dans l''organisation',
  telephone VARCHAR(20) COMMENT 'Téléphone professionnel',
  permissions JSON COMMENT 'Permissions spécifiques',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Administrateurs système';

-- ============================================================================
-- SECTION 2: GESTION DES MÉDICAMENTS ET POSOLOGIES
-- ============================================================================

-- ============================================================================
-- 6. TABLE: CATEGORIES_THERAPEUTIQUES (Classifications médicales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories_therapeutiques (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code ATC ou classification locale',
  libelle VARCHAR(255) NOT NULL COMMENT 'Nom de la catégorie',
  description TEXT COMMENT 'Description de la catégorie',
  categorie_parent_id INT COMMENT 'Hiérarchie des catégories',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categorie_parent_id) REFERENCES categories_therapeutiques(id),
  INDEX idx_code (code)
) ENGINE=InnoDB COMMENT='Catégories thérapeutiques des médicaments';

-- ============================================================================
-- 7. TABLE: FORMES_GALENIQUES (Formes pharmaceutiques)
-- ============================================================================
CREATE TABLE IF NOT EXISTS formes_galeniques (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code forme (CPR, SIR, INJ...)',
  libelle VARCHAR(100) NOT NULL COMMENT 'Libellé de la forme',
  description TEXT COMMENT 'Description',
  voie_administration VARCHAR(100) COMMENT 'Voie d''administration',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code)
) ENGINE=InnoDB COMMENT='Formes galéniques disponibles';

-- ============================================================================
-- 8. TABLE: MEDICAMENTS (Base médicaments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS medicaments (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID unique du médicament',
  code_cip VARCHAR(50) UNIQUE COMMENT 'Code CIP ou équivalent',
  denomination_commune VARCHAR(255) NOT NULL COMMENT 'DCI (Dénomination Commune Internationale)',
  nom_commercial VARCHAR(255) NOT NULL COMMENT 'Nom de marque',
  categorie_id INT NOT NULL COMMENT 'Catégorie thérapeutique',
  forme_galenique_id INT NOT NULL COMMENT 'Forme pharmaceutique',
  dosage VARCHAR(100) NOT NULL COMMENT 'Dosage (ex: 500mg, 5mg/ml)',
  unite_dosage_id INT COMMENT 'Unité normalisée',
  fabricant VARCHAR(255) COMMENT 'Laboratoire fabricant',
  principes_actifs TEXT COMMENT 'Liste des principes actifs',
  excipients TEXT COMMENT 'Liste des excipients',
  indications TEXT COMMENT 'Indications thérapeutiques',
  contre_indications TEXT COMMENT 'Contre-indications',
  effets_indesirables TEXT COMMENT 'Effets indésirables',
  precautions TEXT COMMENT 'Précautions d''emploi',
  conservation TEXT COMMENT 'Conditions de conservation',
  prix_reference DECIMAL(10, 2) COMMENT 'Prix de référence',
  est_generique TINYINT(1) DEFAULT 0 COMMENT '1 = médicament générique',
  necessite_ordonnance TINYINT(1) DEFAULT 1 COMMENT '1 = sur ordonnance',
  est_actif TINYINT(1) DEFAULT 1 COMMENT '1 = disponible',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categorie_id) REFERENCES categories_therapeutiques(id),
  unite_dosage_id INT COMMENT 'Unité normalisée',
  FOREIGN KEY (unite_dosage_id) REFERENCES unites_mesure(id) ON DELETE SET NULL;
  FOREIGN KEY (forme_galenique_id) REFERENCES formes_galeniques(id),
  INDEX idx_dci (denomination_commune),
  INDEX idx_commercial (nom_commercial),
  INDEX idx_categorie (categorie_id),
  FULLTEXT idx_recherche (denomination_commune, nom_commercial, principes_actifs)
) ENGINE=InnoDB COMMENT='Base de données des médicaments';

-- ============================================================================
-- 9. TABLE: TRANCHES_AGE (Tranches d''âge pour posologies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tranches_age (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code tranche (NOUR, ENFT, ADO, ADU, SEN)',
  libelle VARCHAR(100) NOT NULL COMMENT 'Libellé de la tranche',
  age_min INT NOT NULL COMMENT 'Âge minimum (en années)',
  age_max INT COMMENT 'Âge maximum (NULL = illimité)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ages (age_min, age_max)
) ENGINE=InnoDB COMMENT='Tranches d''âge pour adaptation posologique';

-- ============================================================================
-- 10. TABLE: TYPES_PRISE (Types de moments de prise)
-- ============================================================================
CREATE TABLE IF NOT EXISTS types_prise (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code (MATIN, MIDI, SOIR, COUCHER...)',
  libelle VARCHAR(100) NOT NULL COMMENT 'Libellé du moment',
  heure_reference TIME COMMENT 'Heure de référence',
  ordre_journee TINYINT COMMENT 'Ordre dans la journée (1, 2, 3...)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Moments de prise dans la journée';

-- ============================================================================
-- 11. TABLE: CONDITIONS_PRISE (Conditions d''administration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conditions_prise (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code (AVANT_REPAS, PENDANT, APRES...)',
  libelle VARCHAR(100) NOT NULL COMMENT 'Libellé de la condition',
  description TEXT COMMENT 'Description détaillée',
  delai_minutes INT COMMENT 'Délai en minutes (ex: 30 min avant repas)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Conditions de prise des médicaments';

-- ============================================================================
-- 12. TABLE: RESTRICTIONS_MEDICAMENT (Restrictions générales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restrictions_medicament (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code restriction',
  libelle VARCHAR(255) NOT NULL COMMENT 'Libellé',
  description TEXT COMMENT 'Description détaillée',
  type_restriction ENUM('grossesse', 'allaitement', 'alcool', 'conduite', 'soleil', 'autre') NOT NULL,
  niveau_gravite ENUM('information', 'prudence', 'danger', 'contre-indication') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Restrictions et précautions générales';

-- ============================================================================
-- 13. TABLE: POSOLOGIES_REFERENCE (Posologies configurées par admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS posologies_reference (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID de la posologie',
  medicament_id CHAR(36) NOT NULL COMMENT 'Médicament concerné',
  tranche_age_id INT NOT NULL COMMENT 'Tranche d''âge applicable',
  sexe ENUM('Masculin', 'Feminin', 'Tous') DEFAULT 'Tous' COMMENT 'Sexe concerné',
  dose_unitaire DECIMAL(10, 3) NOT NULL COMMENT 'Dose par prise',
  unite_dose VARCHAR(20) NOT NULL COMMENT 'Unité (mg, ml, cp...)',
  frequence_par_jour INT NOT NULL COMMENT 'Nombre de prises par jour',
  duree_traitement_jours INT COMMENT 'Durée standard en jours',
  dose_max_jour DECIMAL(10, 3) COMMENT 'Dose maximale par jour',
  intervalle_heures DECIMAL(4, 2) COMMENT 'Intervalle entre prises',
  instructions_specifiques TEXT COMMENT 'Instructions particulières',
  est_standard TINYINT(1) DEFAULT 1 COMMENT '1 = posologie standard, 0 = spéciale',
  validee_par CHAR(36) COMMENT 'Admin ayant validé',
  date_validation TIMESTAMP NULL COMMENT 'Date de validation',
  est_active TINYINT(1) DEFAULT 1 COMMENT '1 = active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (medicament_id) REFERENCES medicaments(id) ON DELETE CASCADE,
  FOREIGN KEY (tranche_age_id) REFERENCES tranches_age(id),
  FOREIGN KEY (validee_par) REFERENCES administrateurs(id) ON DELETE SET NULL,
  INDEX idx_medicament_age (medicament_id, tranche_age_id),
  INDEX idx_sexe (sexe)
) ENGINE=InnoDB COMMENT='Posologies de référence configurées par les admins';

-- ============================================================================
-- 14. TABLE: POSOLOGIES_HEURES (Heures de prise pour chaque posologie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS posologies_heures (
  id CHAR(36) PRIMARY KEY,
  posologie_reference_id CHAR(36) NOT NULL COMMENT 'Posologie de référence',
  type_prise_id INT NOT NULL COMMENT 'Moment de la journée',
  heure_prise TIME NOT NULL COMMENT 'Heure précise',
  quantite DECIMAL(10, 3) NOT NULL COMMENT 'Quantité à prendre',
  ordre_prise TINYINT COMMENT 'Ordre dans la journée',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posologie_reference_id) REFERENCES posologies_reference(id) ON DELETE CASCADE,
  FOREIGN KEY (type_prise_id) REFERENCES types_prise(id),
  INDEX idx_posologie (posologie_reference_id),
  INDEX idx_heure (heure_prise)
) ENGINE=InnoDB COMMENT='Horaires de prise pour chaque posologie';

-- ============================================================================
-- 15. TABLE: POSOLOGIES_CONDITIONS (Conditions de prise associées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS posologies_conditions (
  id CHAR(36) PRIMARY KEY,
  posologie_reference_id CHAR(36) NOT NULL,
  condition_prise_id INT NOT NULL,
  est_obligatoire TINYINT(1) DEFAULT 1 COMMENT '1 = obligatoire, 0 = recommandé',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posologie_reference_id) REFERENCES posologies_reference(id) ON DELETE CASCADE,
  FOREIGN KEY (condition_prise_id) REFERENCES conditions_prise(id),
  UNIQUE KEY unique_posologie_condition (posologie_reference_id, condition_prise_id)
) ENGINE=InnoDB COMMENT='Conditions de prise pour chaque posologie';

-- ============================================================================
-- 16. TABLE: POSOLOGIES_RESTRICTIONS (Restrictions associées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS posologies_restrictions (
  id CHAR(36) PRIMARY KEY,
  posologie_reference_id CHAR(36) NOT NULL,
  restriction_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posologie_reference_id) REFERENCES posologies_reference(id) ON DELETE CASCADE,
  FOREIGN KEY (restriction_id) REFERENCES restrictions_medicament(id),
  UNIQUE KEY unique_posologie_restriction (posologie_reference_id, restriction_id)
) ENGINE=InnoDB COMMENT='Restrictions applicables aux posologies';

-- ============================================================================
-- SECTION 3: GESTION DES ORDONNANCES ET TRAITEMENTS
-- ============================================================================

-- ============================================================================
-- 17. TABLE: ORDONNANCES (Ordonnances patients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ordonnances (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID de l''ordonnance',
  patient_id CHAR(36) NOT NULL COMMENT 'Patient concerné',
  pharmacie_id CHAR(36) COMMENT 'Pharmacie ayant créé le rappel',
  numero_ordonnance VARCHAR(100) UNIQUE COMMENT 'Numéro unique',
  date_prescription DATE NOT NULL COMMENT 'Date de prescription',
  medecin_nom VARCHAR(255) COMMENT 'Nom du médecin',
  medecin_specialite VARCHAR(100) COMMENT 'Spécialité',
  medecin_telephone VARCHAR(20) COMMENT 'Contact médecin',
  etablissement VARCHAR(255) COMMENT 'Établissement de santé',
  diagnostic TEXT COMMENT 'Diagnostic ou indication',
  statut ENUM('en_cours', 'termine', 'interrompu', 'archive') DEFAULT 'en_cours',
  date_debut TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Début du traitement',
  date_fin_prevue DATE COMMENT 'Fin prévue du traitement',
  date_fin_effective DATE COMMENT 'Fin effective',
  notes TEXT COMMENT 'Notes générales',
  image_ordonnance VARCHAR(500) COMMENT 'Chemin de l''image scannée',
  ocr_brut TEXT COMMENT 'Texte OCR brut',
  ocr_valide TINYINT(1) DEFAULT 0 COMMENT '1 = OCR validé',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (pharmacie_id) REFERENCES pharmacies(id) ON DELETE SET NULL,
  INDEX idx_patient (patient_id),
  INDEX idx_statut (statut),
  INDEX idx_dates (date_prescription, date_debut)
) ENGINE=InnoDB COMMENT='Ordonnances médicales des patients';

-- ============================================================================
-- 18. TABLE: LIGNES_ORDONNANCE (Détail médicaments par ordonnance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lignes_ordonnance (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID de la ligne',
  ordonnance_id CHAR(36) NOT NULL COMMENT 'Ordonnance parente',
  medicament_id CHAR(36) NOT NULL COMMENT 'Médicament prescrit',
  posologie_reference_id CHAR(36) COMMENT 'Posologie de référence utilisée',
  quantite_prescrite DECIMAL(10, 3) NOT NULL COMMENT 'Quantité par prise',
  unite_quantite VARCHAR(20) NOT NULL COMMENT 'Unité',
  frequence_par_jour INT NOT NULL COMMENT 'Nombre de prises/jour',
  duree_jours INT NOT NULL COMMENT 'Durée du traitement',
  instructions_patient TEXT COMMENT 'Instructions spécifiques au patient',
  statut ENUM('actif', 'termine', 'suspendu') DEFAULT 'actif',
  date_debut DATE NOT NULL COMMENT 'Début de cette ligne',
  date_fin DATE NOT NULL COMMENT 'Fin de cette ligne',
  ordre_affichage TINYINT COMMENT 'Ordre d''affichage',
  quantite_totale_prescrite DECIMAL(10, 3) COMMENT 'Quantité totale (ex: 30 comprimés)',
  stock_actuel DECIMAL(10, 3) COMMENT 'Quantité restante dans le pilulier',
  unite_totale VARCHAR(20) COMMENT 'Unité pour la quantité totale',
  date_renouvellement DATE COMMENT 'Date de renouvellement prévue',
  seuil_alerte_stock INT DEFAULT 3 COMMENT 'Seuil d''alerte pour réapprovisionnement',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ordonnance_id) REFERENCES ordonnances(id) ON DELETE CASCADE,
  FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
  FOREIGN KEY (posologie_reference_id) REFERENCES posologies_reference(id) ON DELETE SET NULL,
  FOREIGN KEY (unite_quantite) REFERENCES unites_mesure(code) ON DELETE RESTRICT,
  INDEX idx_ordonnance (ordonnance_id),
  INDEX idx_statut (statut)
) ENGINE=InnoDB COMMENT='Lignes de médicaments par ordonnance';

-- ============================================================================
-- 19. TABLE: CODES_RAPPEL (Codes de parrainage pour accès anonyme)
-- ============================================================================


CREATE TABLE IF NOT EXISTS codes_acces_dossier (
  id CHAR(36) PRIMARY KEY,
  code_acces VARCHAR(20) UNIQUE NOT NULL COMMENT 'Code unique de suivi (ex: PAT-8821)',
  pin_code VARCHAR(4) COMMENT 'Code PIN optionnel pour renforcer la sécurité',
  patient_id CHAR(36) NOT NULL COMMENT 'Lien vers le dossier complet du patient',
  
  -- Paramètres de validité
  est_actif TINYINT(1) DEFAULT 1,
  date_expiration DATE COMMENT 'Le code peut être temporaire (ex: durée du traitement)',
  nb_utilisations_max INT DEFAULT NULL COMMENT 'NULL = illimité',
  nb_utilisations_actuel INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_code (code_acces),
  INDEX idx_patient_code (patient_id, est_actif)
) ENGINE=InnoDB COMMENT='Clés d''accès temporaires au dossier patient actif';

-- ============================================================================
-- SECTION 4: GESTION DES RAPPELS ET PRISES
-- ============================================================================

-- ============================================================================
-- 20. TABLE: RAPPELS (Notifications programmées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rappels (
  id CHAR(36) PRIMARY KEY COMMENT 'UUID du rappel',
  ligne_ordonnance_id CHAR(36) NOT NULL COMMENT 'Ligne de traitement',
  patient_id CHAR(36) NOT NULL COMMENT 'Patient concerné',
  date_rappel DATE NOT NULL COMMENT 'Date du rappel',
  heure_rappel TIME NOT NULL COMMENT 'Heure du rappel',
  quantite_prescrite DECIMAL(10, 3) NOT NULL COMMENT 'Quantité à prendre',
  unite VARCHAR(20) NOT NULL COMMENT 'Unité',
  instructions TEXT COMMENT 'Instructions de prise',
  statut ENUM('planifie', 'notifie', 'effectue', 'reporte', 'ignore', 'manque', 'annule') DEFAULT 'planifie',
  date_notification TIMESTAMP NULL COMMENT 'Date d''envoi de la notification',
  date_prise_effective TIMESTAMP NULL COMMENT 'Date de prise réelle',
  delai_prise_minutes INT COMMENT 'Délai entre rappel et prise (en minutes)',
  notes_patient TEXT COMMENT 'Notes du patient',
  type_notification ENUM('push', 'sms', 'email', 'voip') DEFAULT 'push',
  notification_envoyee TINYINT(1) DEFAULT 0 COMMENT '1 = notification envoyée',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ligne_ordonnance_id) REFERENCES lignes_ordonnance(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_date (patient_id, date_rappel),
  INDEX idx_statut (statut),
  INDEX idx_heure (heure_rappel)
) ENGINE=InnoDB COMMENT='Rappels de prise de médicaments';

-- ============================================================================
-- 21. TABLE: RAPPELS_HISTORIQUE (Historique des changements de statut)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rappels_historique (
  id CHAR(36) PRIMARY KEY,
  rappel_id CHAR(36) NOT NULL COMMENT 'Rappel concerné',
  ancien_statut ENUM('planifie', 'notifie', 'effectue', 'reporte', 'ignore', 'manque', 'annule'),
  nouveau_statut ENUM('planifie', 'notifie', 'effectue', 'reporte', 'ignore', 'manque', 'annule'),
  raison TEXT COMMENT 'Raison du changement',
  date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rappel_id) REFERENCES rappels(id) ON DELETE CASCADE,
  INDEX idx_rappel (rappel_id),
  INDEX idx_date (date_changement)
) ENGINE=InnoDB COMMENT='Historique des changements de statut des rappels';

-- ============================================================================
-- 22. TABLE: RAPPELS_REPORTES (Gestion des reports)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rappels_reportes (
  id CHAR(36) PRIMARY KEY,
  rappel_id CHAR(36) NOT NULL COMMENT 'Rappel original',
  date_initiale DATE NOT NULL COMMENT 'Date initiale',
  heure_initiale TIME NOT NULL COMMENT 'Heure initiale',
  nouvelle_date DATE NOT NULL COMMENT 'Nouvelle date',
  nouvelle_heure TIME NOT NULL COMMENT 'Nouvelle heure',
  raison TEXT COMMENT 'Raison du report',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rappel_id) REFERENCES rappels(id) ON DELETE CASCADE,
  INDEX idx_rappel (rappel_id)
) ENGINE=InnoDB COMMENT='Historique des reports de rappels';


CREATE TABLE IF NOT EXISTS notifications_envoyees (
  id CHAR(36) PRIMARY KEY,
  rappel_id CHAR(36) NOT NULL COMMENT 'Rappel concerné',
  type_notification ENUM('push', 'sms', 'email', 'voip') NOT NULL,
  destinataire VARCHAR(255) NOT NULL COMMENT 'Numéro ou email',
  priorite ENUM('haute', 'normale', 'basse') DEFAULT 'normale' COMMENT 'Priorité d''envoi (haute = prise de médicament)',
  message TEXT NOT NULL COMMENT 'Contenu de la notification',
  statut ENUM('en_attente', 'envoye', 'delivre', 'echec') DEFAULT 'en_attente',
  code_erreur VARCHAR(100) COMMENT 'Code d''erreur si échec',
  cout DECIMAL(10, 4) COMMENT 'Coût de l''envoi',
  fournisseur VARCHAR(100) COMMENT 'Fournisseur SMS/email',
  id_externe VARCHAR(255) COMMENT 'ID chez le fournisseur',
  date_envoi TIMESTAMP NULL COMMENT 'Date d''envoi',
  date_delivrance TIMESTAMP NULL COMMENT 'Date de délivrance',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rappel_id) REFERENCES rappels(id) ON DELETE CASCADE,
  INDEX idx_rappel (rappel_id),
  INDEX idx_type (type_notification),
  INDEX idx_statut (statut),
  INDEX idx_date_envoi (date_envoi)
) ENGINE=InnoDB COMMENT='Historique des notifications envoyées';


-- ============================================================================
-- SECTION 5: GESTION DES PARAMÈTRES MÉDICAUX
-- ============================================================================

-- ============================================================================
-- 23. TABLE: TYPES_PARAMETRE_MEDICAL (Types de paramètres)
-- ============================================================================
CREATE TABLE IF NOT EXISTS types_parametre_medical (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code (POIDS, GLYCEMIE, TENSION...)',
  libelle VARCHAR(100) NOT NULL COMMENT 'Libellé',
  description TEXT COMMENT 'Description',
  unite_mesure_id INT COMMENT 'Unité normalisée',
  type_donnee ENUM('decimal', 'entier', 'texte', 'composite') NOT NULL,
  valeur_min DECIMAL(10, 3) COMMENT 'Valeur minimale normale',
  valeur_max DECIMAL(10, 3) COMMENT 'Valeur maximale normale',
  frequence_recommandee INT COMMENT 'Fréquence de mesure recommandée (en jours)',
  est_actif TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unite_mesure_id) REFERENCES unites_mesure(id) ON DELETE SET NULL,
  INDEX idx_code (code)
) ENGINE=InnoDB COMMENT='Types de paramètres médicaux mesurables';

-- ============================================================================
-- 24. TABLE: PARAMETRES_MEDICAUX (Mesures des patients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS parametres_medicaux (
  id CHAR(36) PRIMARY KEY,
  patient_id CHAR(36) NOT NULL COMMENT 'Patient concerné',
  type_parametre_id INT NOT NULL COMMENT 'Type de paramètre',
  valeur DECIMAL(10, 3) NULL COMMENT 'Valeur mesurée',
  valeur_texte TEXT COMMENT 'Valeur textuelle si applicable',
  unite_id INT NOT NULL COMMENT 'Unité de mesure',
  date_mesure TIMESTAMP NOT NULL COMMENT 'Date et heure de la mesure',
  notes TEXT COMMENT 'Notes sur la mesure',
  est_valide TINYINT(1) DEFAULT 1 COMMENT '1 = mesure valide',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (type_parametre_id) REFERENCES types_parametre_medical(id),
  FOREIGN KEY (unite_id) REFERENCES unites_mesure(id),
  INDEX idx_patient_type (patient_id, type_parametre_id),
  INDEX idx_date (date_mesure)
) ENGINE=InnoDB COMMENT='Paramètres médicaux mesurés';

-- ============================================================================
-- 25. TABLE: PARAMETRES_TENSION (Spécifique tension artérielle)
-- ============================================================================
CREATE TABLE IF NOT EXISTS parametres_tension (
  id CHAR(36) PRIMARY KEY,
  parametre_medical_id CHAR(36) UNIQUE NOT NULL,
  systolique INT NOT NULL COMMENT 'Pression systolique (mmHg)',
  diastolique INT NOT NULL COMMENT 'Pression diastolique (mmHg)',
  frequence_cardiaque INT COMMENT 'Pouls (bpm)',
  bras ENUM('gauche', 'droit') COMMENT 'Bras de mesure',
  position ENUM('assis', 'debout', 'couche') COMMENT 'Position du patient',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parametre_medical_id) REFERENCES parametres_medicaux(id) ON DELETE CASCADE,
  INDEX idx_systolique (systolique),
  INDEX idx_diastolique (diastolique)
) ENGINE=InnoDB COMMENT='Détails des mesures de tension';


-- ============================================================================
-- SECTION 7: RAPPORTS ET ANALYSES
-- ============================================================================

-- ============================================================================
-- 29. TABLE: RAPPORTS_SUIVI (Rapports générés)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rapports_suivi (
  id CHAR(36) PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  ordonnance_id CHAR(36) COMMENT 'Ordonnance concernée',
  type_rapport ENUM('hebdomadaire', 'mensuel', 'fin_traitement', 'personnalise') NOT NULL,
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  taux_observance DECIMAL(5, 2) COMMENT 'Taux d''observance en %',
  nombre_prises_effectuees INT COMMENT 'Nombre de prises réalisées',
  nombre_prises_prevues INT COMMENT 'Nombre de prises prévues',
  nombre_prises_manquees INT COMMENT 'Nombre de prises manquées',
  parametres_mesures JSON COMMENT 'Résumé des paramètres médicaux',
  recommandations TEXT COMMENT 'Recommandations générées',
  fichier_pdf VARCHAR(500) COMMENT 'Chemin du PDF généré',
  genere_par ENUM('systeme', 'patient', 'pharmacie') DEFAULT 'systeme',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (ordonnance_id) REFERENCES ordonnances(id) ON DELETE SET NULL,
  INDEX idx_patient (patient_id),
  INDEX idx_type (type_rapport),
  INDEX idx_periode (periode_debut, periode_fin)
) ENGINE=InnoDB COMMENT='Rapports de suivi générés';



-- ============================================================================
-- SECTION 9: PARAMÉTRAGE ET CONFIGURATION
-- ============================================================================

-- ============================================================================
-- 34. TABLE: PREFERENCES_UTILISATEUR (Préférences personnelles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS preferences_utilisateur (
  id CHAR(36) PRIMARY KEY,
  utilisateur_id CHAR(36) UNIQUE NOT NULL,
  langue VARCHAR(10) DEFAULT 'fr' COMMENT 'Langue interface (fr/en)',
  fuseau_horaire VARCHAR(50) DEFAULT 'Africa/Douala',
  format_date VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  format_heure VARCHAR(20) DEFAULT '24h',
  notifications_push TINYINT(1) DEFAULT 1,
  notifications_sms TINYINT(1) DEFAULT 0,
  notifications_email TINYINT(1) DEFAULT 1,
  son_rappel VARCHAR(100) DEFAULT 'default',
  vibration TINYINT(1) DEFAULT 1,
  mode_sombre TINYINT(1) DEFAULT 0,
  affichage_compact TINYINT(1) DEFAULT 0,
  parametres_supplementaires JSON COMMENT 'Autres préférences',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Préférences des utilisateurs';


-- ============================================================================
-- 37. TABLE: ALERTES_SYSTEME (Alertes générées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alertes_systeme (
  id CHAR(36) PRIMARY KEY,
  type_alerte ENUM('observance_faible', 'interaction', 'parametre_anormal', 'fin_traitement', 'renouvellement') NOT NULL,
  niveau ENUM('info', 'attention', 'urgent', 'critique') NOT NULL,
  patient_id CHAR(36) COMMENT 'Patient concerné',
  ordonnance_id CHAR(36) COMMENT 'Ordonnance concernée',
  medicament_id CHAR(36) COMMENT 'Médicament concerné',
  titre VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  donnees_contexte JSON COMMENT 'Données contextuelles',
  statut ENUM('nouvelle', 'lue', 'traitee', 'ignoree') DEFAULT 'nouvelle',
  date_lecture TIMESTAMP NULL,
  date_traitement TIMESTAMP NULL,
  traite_par CHAR(36) COMMENT 'Utilisateur ayant traité',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (ordonnance_id) REFERENCES ordonnances(id) ON DELETE CASCADE,
  FOREIGN KEY (medicament_id) REFERENCES medicaments(id) ON DELETE SET NULL,
  FOREIGN KEY (traite_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_patient (patient_id),
  INDEX idx_type (type_alerte),
  INDEX idx_niveau (niveau),
  INDEX idx_statut (statut)
) ENGINE=InnoDB COMMENT='Alertes système générées';



-- ============================================================================
-- 40. TABLE: STOCKS_MEDICAMENTS (Disponibilité en pharmacie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stocks_medicaments (
  id CHAR(36) PRIMARY KEY,
  pharmacie_id CHAR(36) NOT NULL,
  medicament_id CHAR(36) NOT NULL,
  quantite_disponible INT NOT NULL,
  unite_stock VARCHAR(20) COMMENT 'Unité de stock (boites, flacons...)',
  prix_vente DECIMAL(10, 2),
  date_derniere_reception DATE,
  date_derniere_vente DATE,
  seuil_alerte INT COMMENT 'Seuil de réapprovisionnement',
  statut ENUM('disponible', 'rupture', 'commande') DEFAULT 'disponible',
  derniere_mise_a_jour TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pharmacie_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (medicament_id) REFERENCES medicaments(id) ON DELETE CASCADE,
  INDEX idx_pharmacie_medicament (pharmacie_id, medicament_id),
  INDEX idx_statut (statut)
) ENGINE=InnoDB COMMENT='Stocks de médicaments par pharmacie';

-- ============================================================================
-- SECTION 12: FEEDBACK ET SUPPORT
-- ============================================================================

-- ============================================================================
-- 41. TABLE: EVALUATIONS_PHARMACIES (Avis clients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS evaluations_pharmacies (
  id CHAR(36) PRIMARY KEY,
  pharmacie_id CHAR(36) NOT NULL,
  patient_id CHAR(36) COMMENT 'Patient ayant évalué',
  note TINYINT NOT NULL COMMENT 'Note de 1 à 5',
  commentaire TEXT,
  criteres_evaluation JSON COMMENT 'Détail des critères',
  est_verifie TINYINT(1) DEFAULT 0 COMMENT '1 = avis vérifié',
  est_publie TINYINT(1) DEFAULT 1 COMMENT '1 = visible publiquement',
  reponse_pharmacie TEXT COMMENT 'Réponse de la pharmacie',
  date_reponse TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pharmacie_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  INDEX idx_pharmacie (pharmacie_id),
  INDEX idx_note (note)
) ENGINE=InnoDB COMMENT='Évaluations des pharmacies par les patients';


-- ============================================================================
-- SECTION 14: DONNÉES DE RÉFÉRENCE
-- ============================================================================

-- ============================================================================
-- 45. TABLE: PAYS (Référentiel des pays)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code_iso2 CHAR(2) UNIQUE NOT NULL,
  code_iso3 CHAR(3) UNIQUE NOT NULL,
  nom_fr VARCHAR(255) NOT NULL,
  nom_en VARCHAR(255) NOT NULL,
  indicatif_telephonique VARCHAR(10),
  devise VARCHAR(3),
  fuseau_principal VARCHAR(50),
  est_actif TINYINT(1) DEFAULT 1,
  INDEX idx_code2 (code_iso2),
  INDEX idx_code3 (code_iso3)
) ENGINE=InnoDB COMMENT='Référentiel des pays';

-- ============================================================================
-- 46. TABLE: VILLES (Référentiel des villes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS villes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pays_id INT NOT NULL,
  nom VARCHAR(255) NOT NULL,
  code_postal VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  population INT,
  est_capitale TINYINT(1) DEFAULT 0,
  FOREIGN KEY (pays_id) REFERENCES pays(id),
  INDEX idx_pays (pays_id),
  INDEX idx_nom (nom)
) ENGINE=InnoDB COMMENT='Référentiel des villes';



-- Insertion des types de paramètres médicaux
INSERT INTO types_parametre_medical (code, libelle, unite_mesure, type_donnee, valeur_min, valeur_max) VALUES
('POIDS', 'Poids', 'kg', 'decimal', 2.0, 300.0),
('TAILLE', 'Taille', 'cm', 'entier', 40, 250),
('GLYCEMIE', 'Glycémie', 'g/L', 'decimal', 0.5, 3.0),
('TENSION_SYS', 'Tension systolique', 'mmHg', 'entier', 70, 200),
('TENSION_DIA', 'Tension diastolique', 'mmHg', 'entier', 40, 130),
('FREQUENCE_CARD', 'Fréquence cardiaque', 'bpm', 'entier', 40, 200),
('TEMPERATURE', 'Température', '°C', 'decimal', 35.0, 42.0),
('SATURATION_O2', 'Saturation en oxygène', '%', 'entier', 70, 100);


INSERT INTO pays (code_iso2, code_iso3, nom_fr, nom_en, indicatif_telephonique, devise, fuseau_principal) VALUES
('CM', 'CMR', 'Cameroun', 'Cameroon', '+237', 'XAF', 'Africa/Douala'),
('FR', 'FRA', 'France', 'France', '+33', 'EUR', 'Europe/Paris'),
('CI', 'CIV', 'Côte d''Ivoire', 'Ivory Coast', '+225', 'XOF', 'Africa/Abidjan'),
('SN', 'SEN', 'Sénégal', 'Senegal', '+221', 'XOF', 'Africa/Dakar'),
('GA', 'GAB', 'Gabon', 'Gabon', '+241', 'XAF', 'Africa/Libreville');


-- VUE 2: Rappels du jour par patient
CREATE OR REPLACE VIEW v_rappels_jour AS
SELECT 
  r.id,
  r.patient_id,
  p.nom AS patient_nom,
  p.prenom AS patient_prenom,
  r.date_rappel,
  r.heure_rappel,
  m.nom_commercial AS medicament,
  r.quantite_prescrite,
  r.unite,
  r.statut,
  r.instructions,
  ph.nom AS pharmacie_nom,
  ph.telephone AS pharmacie_tel
FROM rappels r
INNER JOIN patients p ON r.patient_id = p.id
INNER JOIN lignes_ordonnance lo ON r.ligne_ordonnance_id = lo.id
INNER JOIN medicaments m ON lo.medicament_id = m.id
INNER JOIN ordonnances o ON lo.ordonnance_id = o.id
LEFT JOIN pharmacies ph ON o.pharmacie_id = ph.id
WHERE r.date_rappel = CURDATE()
  AND r.statut IN ('planifie', 'notifie')
ORDER BY r.heure_rappel;

-- VUE 3: Statistiques d'observance par patient
CREATE OR REPLACE VIEW v_stats_observance_patients AS
SELECT 
  p.id AS patient_id,
  p.nom,
  p.prenom,
  COUNT(r.id) AS total_rappels,
  SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END) AS prises_effectuees,
  SUM(CASE WHEN r.statut = 'manque' THEN 1 ELSE 0 END) AS prises_manquees,
  SUM(CASE WHEN r.statut = 'reporte' THEN 1 ELSE 0 END) AS prises_reportees,
  ROUND(SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END) * 100.0 / 
    NULLIF(COUNT(r.id), 0), 2) AS taux_observance,
  MAX(r.date_rappel) AS derniere_prise_date
FROM patients p
LEFT JOIN rappels r ON p.id = r.patient_id
WHERE r.date_rappel >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY p.id;

-- VUE 4: Médicaments avec posologies disponibles
CREATE OR REPLACE VIEW v_medicaments_posologies AS
SELECT 
  m.id AS medicament_id,
  m.denomination_commune,
  m.nom_commercial,
  m.dosage,
  fg.libelle AS forme,
  ct.libelle AS categorie,
  COUNT(pr.id) AS nombre_posologies,
  m.est_actif,
  m.necessite_ordonnance
FROM medicaments m
INNER JOIN formes_galeniques fg ON m.forme_galenique_id = fg.id
INNER JOIN categories_therapeutiques ct ON m.categorie_id = ct.id
LEFT JOIN posologies_reference pr ON m.id = pr.medicament_id AND pr.est_active = 1
GROUP BY m.id;

-- VUE 5: Pharmacies avec leurs performances
CREATE OR REPLACE VIEW v_pharmacies_performances AS
SELECT 
  ph.id,
  ph.nom,
  ph.ville,
  ph.quartier,
  ph.telephone,
  ph.statut,
  ph.nombre_rappels_crees,
  COUNT(DISTINCT o.id) AS nombre_ordonnances,
  COUNT(DISTINCT o.patient_id) AS nombre_patients,
  AVG(ep.note) AS note_moyenne,
  COUNT(ep.id) AS nombre_avis,
  ph.latitude,
  ph.longitude
FROM pharmacies ph
LEFT JOIN ordonnances o ON ph.id = o.pharmacie_id
LEFT JOIN evaluations_pharmacies ep ON ph.id = ep.pharmacie_id AND ep.est_publie = 1
GROUP BY ph.id;

-- VUE 6: Ordonnances actives avec détails
CREATE OR REPLACE VIEW v_ordonnances_actives AS
SELECT 
  o.id,
  o.numero_ordonnance,
  p.nom AS patient_nom,
  p.prenom AS patient_prenom,
  p.telephone AS patient_tel,
  o.date_prescription,
  o.date_debut,
  o.date_fin_prevue,
  o.medecin_nom,
  o.diagnostic,
  COUNT(DISTINCT lo.id) AS nombre_medicaments,
  ph.nom AS pharmacie_nom,
  o.statut
FROM ordonnances o
INNER JOIN patients p ON o.patient_id = p.id
LEFT JOIN pharmacies ph ON o.pharmacie_id = ph.id
LEFT JOIN lignes_ordonnance lo ON o.id = lo.ordonnance_id
WHERE o.statut = 'en_cours'
GROUP BY o.id;

-- VUE 7: Alertes actives par niveau
CREATE OR REPLACE VIEW v_alertes_actives AS
SELECT 
  a.id,
  a.type_alerte,
  a.niveau,
  a.titre,
  a.message,
  p.nom AS patient_nom,
  p.prenom AS patient_prenom,
  m.nom_commercial AS medicament,
  a.statut,
  a.created_at,
  TIMESTAMPDIFF(HOUR, a.created_at, NOW()) AS heures_depuis_creation
FROM alertes_systeme a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN medicaments m ON a.medicament_id = m.id
WHERE a.statut IN ('nouvelle', 'lue')
ORDER BY 
  FIELD(a.niveau, 'critique', 'urgent', 'attention', 'info'),
  a.created_at DESC;

-- VUE 8: Stocks faibles en pharmacie
CREATE OR REPLACE VIEW v_stocks_faibles AS
SELECT 
  s.id,
  ph.nom AS pharmacie,
  ph.ville,
  m.nom_commercial AS medicament,
  m.dosage,
  s.quantite_disponible,
  s.seuil_alerte,
  s.statut,
  s.date_derniere_vente,
  DATEDIFF(CURDATE(), s.date_derniere_vente) AS jours_depuis_vente
FROM stocks_medicaments s
INNER JOIN pharmacies ph ON s.pharmacie_id = ph.id
INNER JOIN medicaments m ON s.medicament_id = m.id
WHERE s.quantite_disponible <= s.seuil_alerte
  OR s.statut = 'rupture'
ORDER BY ph.nom, s.quantite_disponible;

-- ============================================================================
-- CRÉATION DES PROCÉDURES STOCKÉES
-- ============================================================================

DELIMITER $

-- PROCÉDURE 1: Créer un patient avec compte utilisateur
CREATE PROCEDURE sp_creer_patient_utilisateur(
  IN p_email VARCHAR(255),
  IN p_password VARCHAR(255),
  IN p_nom VARCHAR(255),
  IN p_prenom VARCHAR(255),
  IN p_genre ENUM('Masculin', 'Feminin', 'Autre'),
  IN p_date_naissance DATE,
  IN p_telephone VARCHAR(20),
  OUT p_patient_id CHAR(36),
  OUT p_utilisateur_id CHAR(36)
)
BEGIN
  DECLARE v_role_id INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Erreur création patient';
  END;
  
  START TRANSACTION;
  
  -- Récupérer l'ID du rôle USER
  SELECT id INTO v_role_id FROM roles WHERE code = 'USER' LIMIT 1;
  
  -- Créer l'utilisateur
  SET p_utilisateur_id = UUID();
  INSERT INTO utilisateurs (id, email, telephone, password, role_id, code_parrainage)
  VALUES (
    p_utilisateur_id,
    p_email,
    p_telephone,
    p_password,
    v_role_id,
    CONCAT(UPPER(SUBSTRING(p_nom, 1, 3)), LPAD(FLOOR(RAND() * 10000), 4, '0'))
  );
  
  -- Créer le patient
  SET p_patient_id = UUID();
  INSERT INTO patients (
    id, utilisateur_id, nom, prenom, genre, date_naissance, 
    telephone, email, est_utilisateur, statut_dossier
  )
  VALUES (
    p_patient_id,
    p_utilisateur_id,
    p_nom,
    p_prenom,
    p_genre,
    p_date_naissance,
    p_telephone,
    p_email,
    1,
    'actif'
  );
  
  -- Créer les préférences par défaut
  INSERT INTO preferences_utilisateur (id, utilisateur_id)
  VALUES (UUID(), p_utilisateur_id);
  
  COMMIT;
END$


-- PROCÉDURE 3: Calculer le taux d'observance d'un patient
CREATE PROCEDURE sp_calculer_observance_patient(
  IN p_patient_id CHAR(36),
  IN p_date_debut DATE,
  IN p_date_fin DATE,
  OUT p_taux_observance DECIMAL(5,2),
  OUT p_prises_effectuees INT,
  OUT p_prises_prevues INT
)
BEGIN
  SELECT 
    COUNT(*) INTO p_prises_prevues
  FROM rappels
  WHERE patient_id = p_patient_id
    AND date_rappel BETWEEN p_date_debut AND p_date_fin
    AND statut != 'annule';
    
  SELECT 
    COUNT(*) INTO p_prises_effectuees
  FROM rappels
  WHERE patient_id = p_patient_id
    AND date_rappel BETWEEN p_date_debut AND p_date_fin
    AND statut = 'effectue';
    
  IF p_prises_prevues > 0 THEN
    SET p_taux_observance = (p_prises_effectuees * 100.0) / p_prises_prevues;
  ELSE
    SET p_taux_observance = 0;
  END IF;
  
  -- Enregistrer les statistiques
  INSERT INTO statistiques_observance (
    id, patient_id, periode_debut, periode_fin,
    nombre_prises_prevues, nombre_prises_effectuees,
    nombre_prises_manquees, nombre_prises_reportees,
    taux_observance
  )
  SELECT 
    UUID(),
    p_patient_id,
    p_date_debut,
    p_date_fin,
    p_prises_prevues,
    p_prises_effectuees,
    COUNT(CASE WHEN statut = 'manque' THEN 1 END),
    COUNT(CASE WHEN statut = 'reporte' THEN 1 END),
    p_taux_observance
  FROM rappels
  WHERE patient_id = p_patient_id
    AND date_rappel BETWEEN p_date_debut AND p_date_fin;
    
END$

-- ============================================================================
-- SUITE ET COMPLÉTION DE LA BASE DE DONNÉES OMÉDA
-- ============================================================================

DELIMITER $



-- FONCTION 1: Calculer l'âge à partir de la date de naissance
CREATE FUNCTION fn_calculer_age(date_naissance DATE) 
RETURNS INT
DETERMINISTIC
BEGIN
  RETURN YEAR(CURDATE()) - YEAR(date_naissance) - 
    (DATE_FORMAT(CURDATE(), '%m%d') < DATE_FORMAT(date_naissance, '%m%d'));
END$


DELIMITER ;

-- ============================================================================
-- CRÉATION DES DÉCLENCHEURS (TRIGGERS)
-- ============================================================================

DELIMITER $

-- TRIGGER 1: Avant insertion d'un patient - Générer code parrainage si absent
CREATE TRIGGER trg_patient_before_insert
BEFORE INSERT ON patients
FOR EACH ROW
BEGIN
  -- Si le patient est un utilisateur enregistré et n'a pas de code parrainage
  IF NEW.est_utilisateur = 1 AND NEW.utilisateur_id IS NOT NULL THEN
    -- Générer un code parrainage pour l'utilisateur associé
    UPDATE utilisateurs 
    SET code_parrainage = fn_generer_code_parrainage()
    WHERE id = NEW.utilisateur_id
      AND code_parrainage IS NULL;
  END IF;
END$





-- TRIGGER 6: Après insertion d'un paramètre médical - Vérifier les valeurs anormales
CREATE TRIGGER trg_parametre_medical_after_insert
AFTER INSERT ON parametres_medicaux
FOR EACH ROW
BEGIN
  DECLARE v_min DECIMAL(10,3);
  DECLARE v_max DECIMAL(10,3);
  DECLARE v_libelle VARCHAR(100);
  
  -- Récupérer les valeurs limites pour ce type de paramètre
  SELECT valeur_min, valeur_max, libelle 
  INTO v_min, v_max, v_libelle
  FROM types_parametre_medical
  WHERE id = NEW.type_parametre_id;
  
  -- Vérifier si la valeur est en dehors des limites normales
  IF v_min IS NOT NULL AND v_max IS NOT NULL THEN
    IF NEW.valeur < v_min OR NEW.valeur > v_max THEN
      -- Créer une alerte pour paramètre anormal
      INSERT INTO alertes_systeme (
        id, type_alerte, niveau, patient_id, titre, message, donnees_contexte
      )
      SELECT 
        UUID(),
        'parametre_anormal',
        CASE 
          WHEN NEW.valeur < v_min * 0.7 OR NEW.valeur > v_max * 1.3 THEN 'critique'
          WHEN NEW.valeur < v_min * 0.8 OR NEW.valeur > v_max * 1.2 THEN 'urgent'
          ELSE 'attention'
        END,
        NEW.patient_id,
        CONCAT('Paramètre médical anormal: ', v_libelle),
        CONCAT(v_libelle, ': ', NEW.valeur, ' ', NEW.unite, 
               ' (Plage normale: ', v_min, ' - ', v_max, ' ', NEW.unite, ')'),
        JSON_OBJECT(
          'parametre_id', NEW.id,
          'type_parametre', v_libelle,
          'valeur', NEW.valeur,
          'unite', NEW.unite,
          'min_normal', v_min,
          'max_normal', v_max,
          'date_mesure', NEW.date_mesure
        )
      FROM patients p
      WHERE p.id = NEW.patient_id;
    END IF;
  END IF;
END$

DELIMITER ;

-- ============================================================================
-- 55. TABLE: PRESCRIPTIONS_RAPIDES (Prescriptions pré-enregistrées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prescriptions_rapides (
  id CHAR(36) PRIMARY KEY,
  pharmacie_id CHAR(36) NOT NULL COMMENT 'Pharmacie propriétaire',
  code_prescription VARCHAR(50) NOT NULL COMMENT 'Code interne',
  libelle VARCHAR(255) NOT NULL COMMENT 'Libellé de la prescription',
  diagnostic_associe VARCHAR(255) COMMENT 'Diagnostic type associé',
  medicaments JSON NOT NULL COMMENT '[{"medicament_id": "...", "posologie": "...", "duree": 7}]',
  instructions_patient TEXT COMMENT 'Instructions standard',
  utilise_count INT DEFAULT 0 COMMENT 'Nombre d''utilisations',
  est_partage TINYINT(1) DEFAULT 0 COMMENT '1 = partagé avec toutes les pharmacies',
  created_by CHAR(36) COMMENT 'Pharmacien créateur',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pharmacie_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES utilisateurs(id),
  UNIQUE KEY uk_pharmacie_code (pharmacie_id, code_prescription),
  INDEX idx_pharmacie (pharmacie_id),
  FULLTEXT idx_libelle (libelle, diagnostic_associe)
) ENGINE=InnoDB COMMENT='Prescriptions rapides pré-enregistrées';




-- ============================================================================
-- VUES SUPPLÉMENTAIRES
-- ============================================================================

-- VUE 9: Posologies non dédiées détectées
CREATE OR REPLACE VIEW v_posologies_non_dediees AS
SELECT 
  lo.id AS ligne_ordonnance_id,
  lo.ordonnance_id,
  m.nom_commercial AS medicament,
  p.nom AS patient_nom,
  p.prenom AS patient_prenom,
  ta.libelle AS tranche_age_patient,
  pr.tranche_age_id AS tranche_age_posologie,
  CASE 
    WHEN pr.tranche_age_id IS NULL THEN 'Aucune posologie configurée'
    WHEN pr.tranche_age_id != (
      SELECT id FROM tranches_age 
      WHERE p.age_calcule BETWEEN age_min AND COALESCE(age_max, 150)
    ) THEN 'Tranche d''âge inadaptée'
    ELSE 'Autre incohérence'
  END AS raison,
  lo.created_at
FROM lignes_ordonnance lo
INNER JOIN medicaments m ON lo.medicament_id = m.id
INNER JOIN ordonnances o ON lo.ordonnance_id = o.id
INNER JOIN patients p ON o.patient_id = p.id
LEFT JOIN posologies_reference pr ON lo.posologie_reference_id = pr.id
LEFT JOIN tranches_age ta ON p.age_calcule BETWEEN ta.age_min AND COALESCE(ta.age_max, 150)
WHERE pr.id IS NULL 
   OR pr.tranche_age_id != (
     SELECT id FROM tranches_age 
     WHERE p.age_calcule BETWEEN age_min AND COALESCE(age_max, 150)
   );

-- VUE 10: Détections d'anomalies non traitées
CREATE OR REPLACE VIEW v_anomalies_non_traitees AS
SELECT 
  da.id,
  da.type_anomalie,
  da.gravite,
  da.description,
  p.nom AS patient_nom,
  p.prenom AS patient_prenom,
  p.telephone AS patient_tel,
  da.created_at,
  TIMESTAMPDIFF(HOUR, da.created_at, NOW()) AS heures_depuis_detection,
  da.donnees_contexte
FROM detections_anomalies da
INNER JOIN patients p ON da.patient_id = p.id
WHERE da.statut = 'nouveau'
ORDER BY 
  FIELD(da.gravite, 'critique', 'elevee', 'moyenne', 'faible'),
  da.created_at;


-- VUE 12: Analyse d'observance détaillée par médicament
CREATE OR REPLACE VIEW v_observance_par_medicament AS
SELECT 
  m.id AS medicament_id,
  m.nom_commercial,
  m.denomination_commune,
  COUNT(DISTINCT r.id) AS nombre_rappels,
  SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END) AS prises_effectuees,
  SUM(CASE WHEN r.statut = 'manque' THEN 1 ELSE 0 END) AS prises_manquees,
  ROUND(SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END) * 100.0 / 
    NULLIF(COUNT(r.id), 0), 2) AS taux_observance,
  AVG(r.delai_prise_minutes) AS delai_moyen_minutes,
  MIN(r.date_rappel) AS premiere_prise,
  MAX(r.date_rappel) AS derniere_prise
FROM medicaments m
INNER JOIN lignes_ordonnance lo ON m.id = lo.medicament_id
INNER JOIN rappels r ON lo.id = r.ligne_ordonnance_id
WHERE r.date_rappel >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
GROUP BY m.id
HAVING COUNT(r.id) >= 10
ORDER BY taux_observance ASC;


-- ============================================================================
-- FONCTIONS SUPPLÉMENTAIRES
-- ============================================================================

DELIMITER $

-- FONCTION 6: Détecter si une posologie est adaptée à un patient
CREATE FUNCTION fn_posologie_adaptee_patient(
  p_posologie_id CHAR(36),
  p_patient_id CHAR(36)
)
RETURNS JSON
DETERMINISTIC
BEGIN
  DECLARE v_result JSON;
  DECLARE v_age_patient INT;
  DECLARE v_genre_patient VARCHAR(20);
  DECLARE v_age_min_posologie INT;
  DECLARE v_age_max_posologie INT;
  DECLARE v_genre_posologie VARCHAR(20);
  DECLARE v_poids_patient DECIMAL(5,2);
  
  -- Récupérer les infos du patient
  SELECT age_calcule, genre, poids_kg 
  INTO v_age_patient, v_genre_patient, v_poids_patient
  FROM patients
  WHERE id = p_patient_id;
  
  -- Récupérer les critères de la posologie
  SELECT ta.age_min, ta.age_max, pr.sexe
  INTO v_age_min_posologie, v_age_max_posologie, v_genre_posologie
  FROM posologies_reference pr
  INNER JOIN tranches_age ta ON pr.tranche_age_id = ta.id
  WHERE pr.id = p_posologie_id;
  
  -- Évaluer l'adaptation
  SET v_result = JSON_OBJECT(
    'age_adapte', 
    CASE 
      WHEN v_age_patient BETWEEN v_age_min_posologie AND COALESCE(v_age_max_posologie, 150) THEN TRUE
      ELSE FALSE
    END,
    'genre_adapte',
    CASE 
      WHEN v_genre_posologie = 'Tous' THEN TRUE
      WHEN v_genre_posologie = v_genre_patient THEN TRUE
      ELSE FALSE
    END,
    'age_patient', v_age_patient,
    'age_min_posologie', v_age_min_posologie,
    'age_max_posologie', v_age_max_posologie,
    'genre_patient', v_genre_patient,
    'genre_posologie', v_genre_posologie
  );
  
  RETURN v_result;
END$


-- FONCTION 8: Vérifier la disponibilité d'un médicament en pharmacie
CREATE FUNCTION fn_verifier_disponibilite(
  p_pharmacie_id CHAR(36),
  p_medicament_id CHAR(36),
  p_quantite_demandee INT
)
RETURNS JSON
DETERMINISTIC
BEGIN
  DECLARE v_disponible INT;
  DECLARE v_seuil INT;
  DECLARE v_statut VARCHAR(20);
  DECLARE v_result JSON;
  
  -- Récupérer le stock
  SELECT quantite_disponible, seuil_alerte, statut
  INTO v_disponible, v_seuil, v_statut
  FROM stocks_medicaments
  WHERE pharmacie_id = p_pharmacie_id
    AND medicament_id = p_medicament_id;
    
  -- Si non trouvé
  IF v_disponible IS NULL THEN
    RETURN JSON_OBJECT(
      'disponible', FALSE,
      'message', 'Médicament non référencé dans cette pharmacie',
      'stock', 0,
      'suffisant', FALSE
    );
  END IF;
  
  -- Vérifier la disponibilité
  SET v_result = JSON_OBJECT(
    'disponible', v_disponible > 0,
    'stock', v_disponible,
    'seuil_alerte', v_seuil,
    'statut', v_statut,
    'suffisant', v_disponible >= p_quantite_demandee,
    'message', 
    CASE 
      WHEN v_disponible >= p_quantite_demandee THEN 'Stock suffisant'
      WHEN v_disponible > 0 AND v_disponible < p_quantite_demandee THEN 'Stock insuffisant'
      WHEN v_disponible = 0 THEN 'Rupture de stock'
      ELSE 'Statut inconnu'
    END
  );
  
  RETURN v_result;
END$

DELIMITER ;

-- ============================================================================
-- PROCÉDURES STOCKÉES SUPPLÉMENTAIRES
-- ============================================================================

DELIMITER $

-- PROCÉDURE 6: Détecter automatiquement les posologies non dédiées
CREATE PROCEDURE sp_detecter_posologies_non_dediees()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_ligne_id CHAR(36);
  DECLARE v_patient_id CHAR(36);
  DECLARE v_medicament_id CHAR(36);
  DECLARE v_tranche_age_id INT;
  DECLARE v_posologie_id CHAR(36);
  DECLARE v_adaptation JSON;
  
  DECLARE cur_lignes CURSOR FOR
    SELECT 
      lo.id,
      o.patient_id,
      lo.medicament_id,
      lo.posologie_reference_id,
      (SELECT id FROM tranches_age 
       WHERE p.age_calcule BETWEEN age_min AND COALESCE(age_max, 150)) AS tranche_age_patient
    FROM lignes_ordonnance lo
    INNER JOIN ordonnances o ON lo.ordonnance_id = o.id
    INNER JOIN patients p ON o.patient_id = p.id
    WHERE lo.statut = 'actif'
      AND lo.posologie_reference_id IS NOT NULL;
      
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  OPEN cur_lignes;
  
  read_loop: LOOP
    FETCH cur_lignes INTO v_ligne_id, v_patient_id, v_medicament_id, v_posologie_id, v_tranche_age_id;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- Vérifier l'adaptation de la posologie
    SET v_adaptation = fn_posologie_adaptee_patient(v_posologie_id, v_patient_id);
    
    -- Si non adaptée, créer une détection d'anomalie
    IF JSON_EXTRACT(v_adaptation, '$.age_adapte') = FALSE 
       OR JSON_EXTRACT(v_adaptation, '$.genre_adapte') = FALSE THEN
      
      INSERT INTO detections_anomalies (
        id, patient_id, type_anomalie, gravite, description, donnees_contexte
      )
      VALUES (
        UUID(),
        v_patient_id,
        'posologie_inadequate',
        CASE 
          WHEN JSON_EXTRACT(v_adaptation, '$.age_adapte') = FALSE THEN 'elevee'
          ELSE 'moyenne'
        END,
        CONCAT(
          'Posologie potentiellement inadaptée au patient. ',
          'Âge patient: ', JSON_EXTRACT(v_adaptation, '$.age_patient'),
          ', Tranche posologie: ', JSON_EXTRACT(v_adaptation, '$.age_min_posologie'), '-', 
          COALESCE(JSON_EXTRACT(v_adaptation, '$.age_max_posologie'), '∞')
        ),
        JSON_OBJECT(
          'ligne_ordonnance_id', v_ligne_id,
          'posologie_reference_id', v_posologie_id,
          'adaptation_evaluation', v_adaptation,
          'medicament_id', v_medicament_id
        )
      );
    END IF;
  END LOOP;
  
  CLOSE cur_lignes;
END$

-- PROCÉDURE 7: Synchroniser les rappels avec les changements d'ordonnance
CREATE PROCEDURE sp_synchroniser_rappels_ordonnance(
  IN p_ordonnance_id CHAR(36),
  IN p_action ENUM('suspension', 'reprise', 'modification')
)
BEGIN
  DECLARE v_date_action DATE DEFAULT CURDATE();
  
  IF p_action = 'suspension' THEN
    -- Mettre en pause les rappels futurs
    UPDATE rappels r
    INNER JOIN lignes_ordonnance lo ON r.ligne_ordonnance_id = lo.id
    SET r.statut = 'annule',
        r.notes_patient = CONCAT('Traitement suspendu le ', CURDATE())
    WHERE lo.ordonnance_id = p_ordonnance_id
      AND r.date_rappel >= v_date_action
      AND r.statut IN ('planifie', 'notifie');
      
  ELSEIF p_action = 'reprise' THEN
    -- Réactiver les rappels futurs
    UPDATE rappels r
    INNER JOIN lignes_ordonnance lo ON r.ligne_ordonnance_id = lo.id
    SET r.statut = 'planifie',
        r.notes_patient = CONCAT('Traitement repris le ', CURDATE())
    WHERE lo.ordonnance_id = p_ordonnance_id
      AND r.date_rappel >= v_date_action
      AND r.statut = 'annule';
      
  ELSEIF p_action = 'modification' THEN
    -- Recalculer tous les rappels futurs
    -- D'abord annuler les anciens
    UPDATE rappels r
    INNER JOIN lignes_ordonnance lo ON r.ligne_ordonnance_id = lo.id
    SET r.statut = 'annule',
        r.notes_patient = CONCAT('Traitement modifié le ', CURDATE())
    WHERE lo.ordonnance_id = p_ordonnance_id
      AND r.date_rappel >= v_date_action;
    
    -- Puis régénérer les rappels pour chaque ligne active
    INSERT INTO rappels (id, ligne_ordonnance_id, patient_id, date_rappel, heure_rappel, 
                         quantite_prescrite, unite, instructions, statut, type_notification)
    SELECT 
      UUID(),
      lo.id,
      o.patient_id,
      dates.date_rappel,
      ph.heure_prise,
      ph.quantite,
      lo.unite_quantite,
      lo.instructions_patient,
      'planifie',
      'push'
    FROM lignes_ordonnance lo
    INNER JOIN ordonnances o ON lo.ordonnance_id = o.id
    INNER JOIN posologies_reference pr ON lo.posologie_reference_id = pr.id
    INNER JOIN posologies_heures ph ON pr.id = ph.posologie_reference_id
    CROSS JOIN (
      SELECT DATE_ADD(v_date_action, INTERVAL n DAY) AS date_rappel
      FROM (
        SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
        UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
        UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18
        UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
        UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
      ) jours
      WHERE DATE_ADD(v_date_action, INTERVAL n DAY) <= lo.date_fin
    ) dates
    WHERE lo.ordonnance_id = p_ordonnance_id
      AND lo.statut = 'actif'
    ORDER BY dates.date_rappel, ph.ordre_prise;
  END IF;
END$

-- PROCÉDURE 8: Générer un rapport de suivi complet
CREATE PROCEDURE sp_generer_rapport_suivi(
  IN p_patient_id CHAR(36),
  IN p_periode_debut DATE,
  IN p_periode_fin DATE,
  IN p_include_ordonnances BOOLEAN,
  IN p_include_parametres BOOLEAN,
  IN p_include_alertes BOOLEAN
)
BEGIN
  DECLARE v_rapport_id CHAR(36);
  
  -- Créer l'entrée dans rapports_suivi
  SET v_rapport_id = UUID();
  
  INSERT INTO rapports_suivi (
    id, patient_id, type_rapport, periode_debut, periode_fin,
    taux_observance, nombre_prises_effectuees, nombre_prises_prevues,
    nombre_prises_manquees, parametres_mesures, recommandations
  )
  SELECT 
    v_rapport_id,
    p_patient_id,
    'personnalise',
    p_periode_debut,
    p_periode_fin,
    ROUND(SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END) * 100.0 / 
      NULLIF(COUNT(r.id), 0), 2),
    SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END),
    COUNT(r.id),
    SUM(CASE WHEN r.statut = 'manque' THEN 1 ELSE 0 END),
    NULL, -- À compléter
    NULL  -- À compléter
  FROM rappels r
  WHERE r.patient_id = p_patient_id
    AND r.date_rappel BETWEEN p_periode_debut AND p_periode_fin;
    
  -- Inclure les ordonnances si demandé
  IF p_include_ordonnances THEN
    UPDATE rapports_suivi
    SET recommandations = CONCAT(
      COALESCE(recommandations, ''),
      '\n\nOrdonnances actives:',
      (SELECT GROUP_CONCAT(
        CONCAT('\n- ', o.numero_ordonnance, ' (', o.diagnostic, ') - ', 
               COUNT(DISTINCT lo.id), ' médicaments')
        SEPARATOR '')
      FROM ordonnances o
      LEFT JOIN lignes_ordonnance lo ON o.id = lo.ordonnance_id
      WHERE o.patient_id = p_patient_id
        AND o.statut = 'en_cours'
      GROUP BY o.id)
    )
    WHERE id = v_rapport_id;
  END IF;
  
  -- Inclure les paramètres si demandés
  IF p_include_parametres THEN
    UPDATE rapports_suivi
    SET parametres_mesures = (
      SELECT JSON_OBJECT(
        'tension', JSON_OBJECT(
          'moyenne_systolique', ROUND(AVG(pt.systolique), 1),
          'moyenne_diastolique', ROUND(AVG(pt.diastolique), 1),
          'derniere_mesure', MAX(pm.date_mesure)
        ),
        'glycemie', JSON_OBJECT(
          'moyenne', ROUND(AVG(pm.valeur), 1),
          'derniere_mesure', MAX(pm.date_mesure)
        )
      )
      FROM parametres_medicaux pm
      LEFT JOIN parametres_tension pt ON pm.id = pt.parametre_medical_id
      WHERE pm.patient_id = p_patient_id
        AND pm.date_mesure BETWEEN p_periode_debut AND p_periode_fin
    )
    WHERE id = v_rapport_id;
  END IF;
  
  -- Inclure les alertes si demandées
  IF p_include_alertes THEN
    UPDATE rapports_suivi
    SET recommandations = CONCAT(
      COALESCE(recommandations, ''),
      '\n\nAlertes sur la période:',
      (SELECT GROUP_CONCAT(
        CONCAT('\n- [', a.niveau, '] ', a.titre, ' (', DATE(a.created_at), ')')
        SEPARATOR '')
      FROM alertes_systeme a
      WHERE a.patient_id = p_patient_id
        AND a.created_at BETWEEN p_periode_debut AND p_periode_fin
        AND a.statut != 'ignoree')
    )
    WHERE id = v_rapport_id;
  END IF;
  
  -- Retourner l'ID du rapport généré
  SELECT v_rapport_id AS rapport_id;
END$

DELIMITER ;

-- ============================================================================
-- INSERTION DE DONNÉES D'EXEMPLE COMPLÈTES
-- ============================================================================



-- Insertion d'une ordonnance
INSERT INTO ordonnances (id, patient_id, pharmacie_id, numero_ordonnance, date_prescription, medecin_nom, diagnostic, statut, date_debut)
SELECT 
  UUID(),
  p.id,
  ph.id,
  'ORD-2024-001',
  CURDATE(),
  'Dr. Mbarga',
  'Infection respiratoire haute',
  'en_cours',
  CURDATE()
FROM patients p, pharmacies ph 
WHERE p.email = 'jean.dupont@email.com'
LIMIT 1;

-- Insertion de lignes d'ordonnance
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin)
SELECT 
  UUID(),
  o.id,
  m.id,
  1,
  'cp',
  3,
  7,
  'Prendre après les repas',
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 7 DAY)
FROM ordonnances o, medicaments m 
WHERE o.numero_ordonnance = 'ORD-2024-001' 
  AND m.nom_commercial = 'Clamoxyl'
UNION ALL
SELECT 
  UUID(),
  o.id,
  m.id,
  1,
  'cp',
  2,
  5,
  'Prendre en cas de douleur, maximum 3g par jour',
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 5 DAY)
FROM ordonnances o, medicaments m 
WHERE o.numero_ordonnance = 'ORD-2024-001' 
  AND m.nom_commercial = 'Doliprane';

-- Insertion de codes rappel
INSERT INTO codes_rappel (id, code, patient_id, ligne_ordonnance_id, type_code, date_expiration)
SELECT 
  UUID(),
  'ABC123',
  p.id,
  lo.id,
  'unique',
  DATE_ADD(CURDATE(), INTERVAL 30 DAY)
FROM patients p, lignes_ordonnance lo, ordonnances o
WHERE p.email = 'jean.dupont@email.com'
  AND lo.ordonnance_id = o.id
  AND o.numero_ordonnance = 'ORD-2024-001'
LIMIT 1;

-- Insertion de paramètres médicaux
INSERT INTO parametres_medicaux (id, patient_id, type_parametre_id, valeur, unite, date_mesure, lieu_mesure)
SELECT 
  UUID(),
  p.id,
  tpm.id,
  37.2,
  '°C',
  NOW(),
  'Domicile'
FROM patients p, types_parametre_medical tpm
WHERE p.email = 'jean.dupont@email.com'
  AND tpm.code = 'TEMPERATURE';

-- Insertion d'une souscription à une offre
INSERT INTO pharmacies_offres (id, pharmacie_id, offre_id, date_expiration, sms_restants, montant_paye)
SELECT 
  UUID(),
  ph.id,
  o.id,
  DATE_ADD(CURDATE(), INTERVAL 30 DAY),
  100,
  5000.00
FROM pharmacies ph, offres_notification o
WHERE ph.nom = 'Pharmacie Centrale'
  AND o.code = 'BASIC';



-- Insertion d'une règle de suivi automatique
INSERT INTO suivi_automatique (id, patient_id, type_suivi, regle, seuil_alerte, frequence_verification, prochaine_verification)
SELECT 
  UUID(),
  p.id,
  'observance',
  JSON_OBJECT(
    'type', 'taux_observance',
    'periode_jours', 7,
    'medicament_ids', JSON_ARRAY((SELECT id FROM medicaments WHERE nom_commercial = 'Clamoxyl'))
  ),
  70.0,
  24,
  DATE_ADD(NOW(), INTERVAL 24 HOUR)
FROM patients p 
WHERE p.email = 'jean.dupont@email.com';

-- Insertion d'interactions médicamenteuses
INSERT INTO interactions_medicamenteuses (id, medicament_1_id, medicament_2_id, type_interaction, description, effet_clinique)
SELECT 
  UUID(),
  m1.id,
  m2.id,
  'moderee',
  'Risque d''augmentation des effets indésirables gastro-intestinaux',
  'Augmentation du risque d''ulcère gastroduodénal'
FROM medicaments m1, medicaments m2
WHERE m1.nom_commercial = 'Advil' 
  AND m2.nom_commercial = 'Clamoxyl';

-- ============================================================================
-- CRÉATION DES TRIGGERS FINAUX POUR LA DÉTECTION AUTOMATIQUE
-- ============================================================================

DELIMITER $

-- TRIGGER 7: Détection automatique de suivi avec posologie non dédiée
CREATE TRIGGER trg_detection_posologie_non_dediee
AFTER INSERT ON lignes_ordonnance
FOR EACH ROW
BEGIN
  DECLARE v_patient_age INT;
  DECLARE v_posologie_age_min INT;
  DECLARE v_posologie_age_max INT;
  DECLARE v_medicament_nom VARCHAR(255);
  DECLARE v_patient_nom VARCHAR(255);
  
  -- Récupérer les informations nécessaires
  SELECT 
    p.age_calcule,
    m.nom_commercial,
    CONCAT(p.nom, ' ', p.prenom),
    ta.age_min,
    ta.age_max
  INTO 
    v_patient_age,
    v_medicament_nom,
    v_patient_nom,
    v_posologie_age_min,
    v_posologie_age_max
  FROM patients p
  INNER JOIN ordonnances o ON p.id = o.patient_id
  INNER JOIN medicaments m ON NEW.medicament_id = m.id
  LEFT JOIN posologies_reference pr ON NEW.posologie_reference_id = pr.id
  LEFT JOIN tranches_age ta ON pr.tranche_age_id = ta.id
  WHERE o.id = NEW.ordonnance_id;
  
  -- Vérifier si la posologie est absente
  IF NEW.posologie_reference_id IS NULL THEN
    INSERT INTO detections_anomalies (
      id, patient_id, type_anomalie, gravite, description, donnees_contexte
    )
    VALUES (
      UUID(),
      (SELECT patient_id FROM ordonnances WHERE id = NEW.ordonnance_id),
      'posologie_inadequate',
      'elevee',
      CONCAT('Pas de posologie de référence configurée pour ', v_medicament_nom),
      JSON_OBJECT(
        'ligne_ordonnance_id', NEW.id,
        'medicament', v_medicament_nom,
        'patient', v_patient_nom,
        'age_patient', v_patient_age
      )
    );
    
  -- Vérifier si la tranche d'âge ne correspond pas
  ELSEIF v_posologie_age_min IS NOT NULL AND v_posologie_age_max IS NOT NULL THEN
    IF v_patient_age < v_posologie_age_min OR v_patient_age > v_posologie_age_max THEN
      INSERT INTO detections_anomalies (
        id, patient_id, type_anomalie, gravite, description, donnees_contexte
      )
      VALUES (
        UUID(),
        (SELECT patient_id FROM ordonnances WHERE id = NEW.ordonnance_id),
        'posologie_inadequate',
        'moyenne',
        CONCAT('Posologie pour tranche d''âge ', v_posologie_age_min, '-', 
               v_posologie_age_max, ' ans alors que patient a ', v_patient_age, ' ans'),
        JSON_OBJECT(
          'ligne_ordonnance_id', NEW.id,
          'medicament', v_medicament_nom,
          'patient', v_patient_nom,
          'age_patient', v_patient_age,
          'age_min_posologie', v_posologie_age_min,
          'age_max_posologie', v_posologie_age_max
        )
      );
    END IF;
  END IF;
END$

-- TRIGGER 8: Détection automatique d'observance faible
CREATE EVENT IF NOT EXISTS event_detection_observance_faible
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Détecter les patients avec observance faible sur les 7 derniers jours
  INSERT INTO detections_anomalies (id, patient_id, type_anomalie, gravite, description, donnees_contexte)
  SELECT 
    UUID(),
    r.patient_id,
    'observance_faible',
    CASE 
      WHEN taux_observance < 50 THEN 'critique'
      WHEN taux_observance < 70 THEN 'elevee'
      WHEN taux_observance < 80 THEN 'moyenne'
      ELSE 'faible'
    END,
    CONCAT('Taux d''observance faible: ', ROUND(taux_observance, 1), '% sur les 7 derniers jours'),
    JSON_OBJECT(
      'taux_observance', ROUND(taux_observance, 1),
      'periode_debut', DATE_SUB(CURDATE(), INTERVAL 7 DAY),
      'periode_fin', CURDATE(),
      'prises_effectuees', prises_effectuees,
      'prises_prevues', prises_prevues
    )
  FROM (
    SELECT 
      r.patient_id,
      COUNT(*) AS prises_prevues,
      SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END) AS prises_effectuees,
      SUM(CASE WHEN r.statut = 'effectue' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS taux_observance
    FROM rappels r
    WHERE r.date_rappel >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      AND r.statut IN ('effectue', 'manque', 'ignore')
    GROUP BY r.patient_id
    HAVING COUNT(*) >= 5  -- Au moins 5 prises prévues pour analyse significative
  ) stats
  WHERE taux_observance < 80;  -- Seuil d'alerte
  
  -- Mettre à jour les règles de suivi automatique
  UPDATE suivi_automatique sa
  SET derniere_verification = NOW(),
      prochaine_verification = DATE_ADD(NOW(), INTERVAL sa.frequence_verification HOUR)
  WHERE sa.prochaine_verification <= NOW()
    AND sa.est_actif = 1;
END$

-- TRIGGER 9: Notification automatique pour renouvellement de traitement
CREATE EVENT IF NOT EXISTS event_notification_renouvellement
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Détecter les traitements qui se terminent dans 3 jours
  INSERT INTO alertes_systeme (
    id, type_alerte, niveau, patient_id, ordonnance_id, titre, message, donnees_contexte
  )
  SELECT 
    UUID(),
    'renouvellement',
    'attention',
    o.patient_id,
    o.id,
    'Fin de traitement proche',
    CONCAT('Votre traitement se termine le ', 
           DATE_FORMAT(lo.date_fin, '%d/%m/%Y'), 
           '. Pensez à prendre rendez-vous pour renouvellement.'),
    JSON_OBJECT(
      'date_fin', lo.date_fin,
      'jours_restants', DATEDIFF(lo.date_fin, CURDATE()),
      'medicament', m.nom_commercial
    )
  FROM lignes_ordonnance lo
  INNER JOIN ordonnances o ON lo.ordonnance_id = o.id
  INNER JOIN medicaments m ON lo.medicament_id = m.id
  WHERE lo.statut = 'actif'
    AND lo.date_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
    AND o.statut = 'en_cours';
END$

DELIMITER ;


COMMIT;

