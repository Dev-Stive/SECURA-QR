-- ============================================================================
-- INSERTIONS COMPLÈTES DES POSOLOGIES
-- ============================================================================

SET @admin_id = (SELECT id FROM administrateurs LIMIT 1);

-- ============================================================================
-- MÉDICAMENT 1 : PARACÉTAMOL 1000mg - ADULTES
-- ============================================================================

-- Posologie adulte (18-64 ans)
SET @poso_paracetamol_adulte = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  calcul_par_poids, dose_unitaire, frequence_par_jour,
  duree_traitement_jours, dose_max_jour, intervalle_heures,
  instructions_specifiques, est_standard, validee_par,
  date_validation, est_active, unite_dose_id
) VALUES (
  @poso_paracetamol_adulte,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'DOLIPRANE 1000%' LIMIT 1),
  16, -- ADULTE
  'Tous',
  0, -- Pas de calcul par poids
  1000.0, -- 1 comprimé de 1000mg
  4, -- Max 4 fois par jour
  3, -- Durée standard 3 jours
  4000.0, -- Max 4g/jour
  6.0, -- Minimum 6h entre prises
  'Ne pas dépasser 4g par jour. Espacer les prises de 6 heures minimum.',
  1,
  @admin_id,
  NOW(),
  1,
  (SELECT id FROM unites_mesure WHERE code = 'mg' LIMIT 1)
);

-- Heures de prise pour DOLIPRANE 1000 (adulte)
INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_paracetamol_adulte, 1, '08:00:00', 1.0, 1), -- Matin
(UUID(), @poso_paracetamol_adulte, 2, '14:00:00', 1.0, 2), -- Après-midi
(UUID(), @poso_paracetamol_adulte, 4, '20:00:00', 1.0, 3); -- Soir

-- Conditions de prise
INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_paracetamol_adulte, 23, 1); -- Avec un grand verre d'eau

-- Restrictions
INSERT INTO posologies_restrictions (id, posologie_reference_id, restriction_id) VALUES
(UUID(), @poso_paracetamol_adulte, 24); -- Alcool déconseillé

-- Posologie senior (65+ ans)
SET @poso_paracetamol_senior = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  dose_unitaire, frequence_par_jour, duree_traitement_jours,
  dose_max_jour, intervalle_heures, instructions_specifiques,
  est_standard, validee_par, date_validation, est_active, unite_dose_id
) VALUES (
  @poso_paracetamol_senior,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'DOLIPRANE 1000%' LIMIT 1),
  17, -- SENIOR
  'Tous',
  1000.0,
  3, -- 3 fois par jour max pour senior
  3,
  3000.0, -- Max 3g/jour pour senior
  8.0, -- 8h entre prises
  'Dose réduite pour personnes âgées. Ne pas dépasser 3g par jour.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'mg' LIMIT 1)
);

INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_paracetamol_senior, 1, '08:00:00', 1.0, 1),
(UUID(), @poso_paracetamol_senior, 3, '16:00:00', 1.0, 2),
(UUID(), @poso_paracetamol_senior, 5, '22:00:00', 0.5, 3); -- Demi-dose au coucher

INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_paracetamol_senior, 23, 1);

INSERT INTO posologies_restrictions (id, posologie_reference_id, restriction_id) VALUES
(UUID(), @poso_paracetamol_senior, 23), -- Insuffisance rénale
(UUID(), @poso_paracetamol_senior, 24); -- Alcool déconseillé

-- ============================================================================
-- MÉDICAMENT 2 : DOLIPRANE SIROP ENFANT 2,4% - POSOLOGIES PAR POIDS
-- ============================================================================

-- Posologie enfant 3-11 ans (calcul par poids)
SET @poso_doliprane_sirop_enfant = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  calcul_par_poids, dose_mg_par_kg, dose_min_mg_kg, dose_max_mg_kg,
  poids_min_kg, poids_max_kg,
  frequence_par_jour, duree_traitement_jours,
  note_calcul_dose, instructions_specifiques,
  est_standard, validee_par, date_validation, est_active, unite_dose_id
) VALUES (
  @poso_doliprane_sirop_enfant,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'DOLIPRANE ENFANTS 2,4%' LIMIT 1),
  14, -- ENFANT
  'Tous',
  1, -- Calcul par poids activé
  15.0, -- 15 mg/kg par prise
  10.0, -- Min 10 mg/kg
  20.0, -- Max 20 mg/kg
  3.0, -- Poids min 3 kg
  50.0, -- Poids max 50 kg
  4, -- 4 fois par jour max
  3,
  'Utiliser la pipette graduée en kg. 1 graduation = poids de l''enfant en kg',
  'Dose = 15 mg/kg. Utiliser pipette graduée. Ne pas dépasser 60 mg/kg/jour.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'mg/kg' LIMIT 1)
);

-- Heures de prise
INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_doliprane_sirop_enfant, 1, '08:00:00', 15.0, 1),
(UUID(), @poso_doliprane_sirop_enfant, 2, '14:00:00', 15.0, 2),
(UUID(), @poso_doliprane_sirop_enfant, 4, '20:00:00', 15.0, 3);

-- Conditions
INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_doliprane_sirop_enfant, 19, 0); -- Pendant repas (recommandé)

-- Paliers de poids détaillés
INSERT INTO posologies_poids (id, posologie_reference_id, poids_min_kg, poids_max_kg, dose_unitaire, unite_dose, note_palier) VALUES
(UUID(), @poso_doliprane_sirop_enfant, 3.0, 5.0, 45.0, 'mg', '3-5 kg : 45-75 mg (3-5 ml)'),
(UUID(), @poso_doliprane_sirop_enfant, 5.0, 8.0, 75.0, 'mg', '5-8 kg : 75-120 mg (5-8 ml)'),
(UUID(), @poso_doliprane_sirop_enfant, 8.0, 11.0, 120.0, 'mg', '8-11 kg : 120-165 mg (8-11 ml)'),
(UUID(), @poso_doliprane_sirop_enfant, 11.0, 16.0, 165.0, 'mg', '11-16 kg : 165-240 mg (11-16 ml)'),
(UUID(), @poso_doliprane_sirop_enfant, 16.0, 23.0, 240.0, 'mg', '16-23 kg : 240-345 mg (16-23 ml)'),
(UUID(), @poso_doliprane_sirop_enfant, 23.0, 30.0, 345.0, 'mg', '23-30 kg : 345-450 mg (23-30 ml)'),
(UUID(), @poso_doliprane_sirop_enfant, 30.0, 40.0, 450.0, 'mg', '30-40 kg : 450-600 mg (30-40 ml)'),
(UUID(), @poso_doliprane_sirop_enfant, 40.0, 50.0, 600.0, 'mg', '40-50 kg : 600-750 mg (40-50 ml)');

-- ============================================================================
-- MÉDICAMENT 3 : AMOXICILLINE 500mg - TOUTES TRANCHES D'ÂGE
-- ============================================================================

-- Posologie adulte
SET @poso_amox_adulte = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  dose_unitaire, frequence_par_jour, duree_traitement_jours,
  dose_max_jour, intervalle_heures, instructions_specifiques,
  est_standard, validee_par, date_validation, est_active, unite_dose_id
) VALUES (
  @poso_amox_adulte,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'CLAMOXYL 500%' LIMIT 1),
  16, -- ADULTE
  'Tous',
  500.0, -- 1 gélule
  3, -- 3 fois par jour
  7, -- 7 jours standard
  3000.0, -- Max 3g/jour
  8.0,
  'Traitement à poursuivre même si amélioration. Durée totale : 7 jours minimum.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'mg' LIMIT 1)
);

-- Heures de prise
INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_amox_adulte, 1, '08:00:00', 1.0, 1),
(UUID(), @poso_amox_adulte, 3, '16:00:00', 1.0, 2),
(UUID(), @poso_amox_adulte, 5, '00:00:00', 1.0, 3);

-- Conditions
INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_amox_adulte, 19, 0), -- Pendant repas recommandé
(UUID(), @poso_amox_adulte, 23, 1); -- Avec eau obligatoire

-- Restrictions
INSERT INTO posologies_restrictions (id, posologie_reference_id, restriction_id) VALUES
(UUID(), @poso_amox_adulte, 23); -- Ajustement dose si insuffisance rénale

-- Posologie enfant (calcul par poids)
SET @poso_amox_enfant = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  calcul_par_poids, dose_mg_par_kg, dose_min_mg_kg, dose_max_mg_kg,
  poids_min_kg, poids_max_kg,
  frequence_par_jour, duree_traitement_jours,
  instructions_specifiques, est_standard, validee_par,
  date_validation, est_active, unite_dose_id
) VALUES (
  @poso_amox_enfant,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'CLAMOXYL 500%' LIMIT 1),
  14, -- ENFANT
  'Tous',
  1,
  50.0, -- 50 mg/kg/jour
  40.0,
  80.0,
  6.0,
  40.0,
  3,
  7,
  'Dose calculée selon le poids. Utiliser suspension buvable pour enfants < 20 kg.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'mg/kg' LIMIT 1)
);

INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_amox_enfant, 1, '08:00:00', 50.0, 1),
(UUID(), @poso_amox_enfant, 3, '16:00:00', 50.0, 2),
(UUID(), @poso_amox_enfant, 5, '00:00:00', 50.0, 3);

INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_amox_enfant, 19, 1);

-- Paliers poids pour enfant
INSERT INTO posologies_poids (id, posologie_reference_id, poids_min_kg, poids_max_kg, dose_unitaire, unite_dose, note_palier) VALUES
(UUID(), @poso_amox_enfant, 6.0, 10.0, 125.0, 'mg', 'Suspension 125mg/5ml'),
(UUID(), @poso_amox_enfant, 10.0, 20.0, 250.0, 'mg', 'Suspension 250mg/5ml'),
(UUID(), @poso_amox_enfant, 20.0, 30.0, 500.0, 'mg', 'Gélule 500mg ou suspension'),
(UUID(), @poso_amox_enfant, 30.0, 40.0, 750.0, 'mg', 'Dose adulte réduite');

-- ============================================================================
-- MÉDICAMENT 4 : IBUPROFÈNE 400mg - ADULTES ET ENFANTS
-- ============================================================================

-- Posologie adulte
SET @poso_ibu_adulte = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  dose_unitaire, frequence_par_jour, duree_traitement_jours,
  dose_max_jour, intervalle_heures, instructions_specifiques,
  est_standard, validee_par, date_validation, est_active, unite_dose_id
) VALUES (
  @poso_ibu_adulte,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'ADVIL 400%' LIMIT 1),
  16, -- ADULTE
  'Tous',
  400.0,
  3, -- 3 fois par jour max
  5, -- Max 5 jours sans avis médical
  1200.0,
  6.0,
  'Prendre pendant les repas pour limiter les troubles digestifs. Ne pas dépasser 5 jours.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'mg' LIMIT 1)
);

INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_ibu_adulte, 1, '08:00:00', 1.0, 1),
(UUID(), @poso_ibu_adulte, 2, '14:00:00', 1.0, 2),
(UUID(), @poso_ibu_adulte, 4, '20:00:00', 1.0, 3);

-- Conditions OBLIGATOIRES
INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_ibu_adulte, 19, 1), -- PENDANT repas OBLIGATOIRE
(UUID(), @poso_ibu_adulte, 23, 1); -- Avec eau

-- Restrictions multiples
INSERT INTO posologies_restrictions (id, posologie_reference_id, restriction_id) VALUES
(UUID(), @poso_ibu_adulte, 21), -- GROSSESSE CI
(UUID(), @poso_ibu_adulte, 24), -- Alcool interdit
(UUID(), @poso_ibu_adulte, 23), -- Insuffisance rénale
(UUID(), @poso_ibu_adulte, 27); -- Conduite niveau 1

-- Posologie enfant/adolescent (12-17 ans)
SET @poso_ibu_ado = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  calcul_par_poids, dose_mg_par_kg, dose_min_mg_kg, dose_max_mg_kg,
  poids_min_kg, poids_max_kg,
  dose_unitaire, frequence_par_jour, duree_traitement_jours,
  dose_max_jour, instructions_specifiques,
  est_standard, validee_par, date_validation, est_active, unite_dose_id
) VALUES (
  @poso_ibu_ado,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'ADVIL 400%' LIMIT 1),
  15, -- ADOLESCENT
  'Tous',
  1,
  10.0, -- 10 mg/kg par prise
  7.0,
  15.0,
  20.0, -- Min 20 kg
  60.0,
  200.0, -- Dose de base
  3,
  3,
  800.0,
  'Dose réduite pour adolescents. Prendre pendant les repas.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'mg' LIMIT 1)
);

INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_ibu_ado, 1, '08:00:00', 10.0, 1),
(UUID(), @poso_ibu_ado, 2, '14:00:00', 10.0, 2),
(UUID(), @poso_ibu_ado, 4, '20:00:00', 10.0, 3);

INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_ibu_ado, 19, 1);

INSERT INTO posologies_restrictions (id, posologie_reference_id, restriction_id) VALUES
(UUID(), @poso_ibu_ado, 24);

-- Paliers poids adolescent
INSERT INTO posologies_poids (id, posologie_reference_id, poids_min_kg, poids_max_kg, dose_unitaire, unite_dose, note_palier) VALUES
(UUID(), @poso_ibu_ado, 20.0, 30.0, 200.0, 'mg', '20-30 kg : 200 mg par prise'),
(UUID(), @poso_ibu_ado, 30.0, 40.0, 300.0, 'mg', '30-40 kg : 300 mg par prise'),
(UUID(), @poso_ibu_ado, 40.0, 50.0, 400.0, 'mg', '40-50 kg : 400 mg (dose adulte)'),
(UUID(), @poso_ibu_ado, 50.0, 60.0, 400.0, 'mg', '> 50 kg : 400 mg (dose adulte)');

-- ============================================================================
-- MÉDICAMENT 5 : VENTOLINE (SALBUTAMOL) - INHALATION
-- ============================================================================

-- Posologie adulte - Crise d'asthme
SET @poso_ventoline_adulte_crise = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  dose_unitaire, frequence_par_jour, duree_traitement_jours,
  dose_max_jour, intervalle_heures, instructions_specifiques,
  est_standard, validee_par, date_validation, est_active, unite_dose_id
) VALUES (
  @poso_ventoline_adulte_crise,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'VENTOLINE%' LIMIT 1),
  16, -- ADULTE
  'Tous',
  100.0, -- 1 bouffée = 100 µg
  8, -- Jusqu'à 8 bouffées/jour
  NULL, -- Durée : selon besoin
  800.0, -- Max 8 bouffées
  0.25, -- 15 minutes entre bouffées si nécessaire
  'Crise d''asthme : 1-2 bouffées. Renouveler après 15 min si besoin. Si > 3 bouffées inefficaces : URGENCE.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'µg' LIMIT 1)
);

-- Heures "à la demande" (exemples de moments critiques)
INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_ventoline_adulte_crise, 1, '08:00:00', 1.0, 1), -- Matin (si besoin)
(UUID(), @poso_ventoline_adulte_crise, 4, '19:00:00', 1.0, 2); -- Soir (si besoin)

-- Conditions
INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_ventoline_adulte_crise, 27, 1); -- Position assise obligatoire

-- Restrictions
INSERT INTO posologies_restrictions (id, posologie_reference_id, restriction_id) VALUES
(UUID(), @poso_ventoline_adulte_crise, 28); -- Conduite niveau 2

-- Posologie prévention asthme d'effort
SET @poso_ventoline_adulte_prevention = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  dose_unitaire, frequence_par_jour, duree_traitement_jours,
  instructions_specifiques, est_standard, validee_par,
  date_validation, est_active, unite_dose_id
) VALUES (
  @poso_ventoline_adulte_prevention,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'VENTOLINE%' LIMIT 1),
  16, -- ADULTE
  'Tous',
  100.0,
  NULL, -- À la demande
  NULL,
  'Prévention asthme d''effort : 1-2 bouffées 10-15 min avant l''effort physique.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'µg' LIMIT 1)
);

-- Posologie enfant (6-11 ans)
SET @poso_ventoline_enfant = UUID();
INSERT INTO posologies_reference (
  id, medicament_id, tranche_age_id, sexe,
  dose_unitaire, frequence_par_jour, duree_traitement_jours,
  dose_max_jour, instructions_specifiques,
  est_standard, validee_par, date_validation, est_active, unite_dose_id
) VALUES (
  @poso_ventoline_enfant,
  (SELECT id FROM medicaments WHERE nom_commercial LIKE 'VENTOLINE%' LIMIT 1),
  14, -- ENFANT
  'Tous',
  100.0,
  4, -- Max 4 bouffées/jour
  NULL,
  400.0,
  'Enfant : 1 bouffée. Utiliser une chambre d''inhalation pédiatrique. Surveiller attentivement.',
  1, @admin_id, NOW(), 1,
  (SELECT id FROM unites_mesure WHERE code = 'µg' LIMIT 1)
);

INSERT INTO posologies_heures (id, posologie_reference_id, type_prise_id, heure_prise, quantite, ordre_prise) VALUES
(UUID(), @poso_ventoline_enfant, 1, '08:00:00', 1.0, 1),
(UUID(), @poso_ventoline_enfant, 4, '19:00:00', 1.0, 2);

INSERT INTO posologies_conditions (id, posologie_reference_id, condition_prise_id, est_obligatoire) VALUES
(UUID(), @poso_ventoline_enfant, 27, 1);









USE `omeda`;

SET @pharmacie_id = 'fa1542e2-eefa-11f0-a667-380025f3fdf9'; 
SET @patient_adulte = 'f9e08559-eefa-11f0-a667-380025f3fdf9';
SET @patient_senior = 'f9e08586-eefa-11f0-a667-380025f3fdf9';
SET @patient_enfant = 'f9e08598-eefa-11f0-a667-380025f3fdf9'; 

-- ============================================================================
-- ORDONNANCE 1 : TRAITEMENT ANTIBIOTIQUE (JEAN DUPONT)
-- ============================================================================
SET @ord1_id = UUID();
INSERT INTO ordonnances (id, patient_id, pharmacie_id, code_ordonnance, date_emission, statut) 
VALUES (@ord1_id, @patient_adulte, @pharmacie_id, 'ORD-2026-001', NOW(), 'valide');

-- Ligne 1 : Amoxicilline 500mg
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, dose_unitaire, frequence_prise, duree_traitement, instructions)
VALUES (
    UUID(), @ord1_id, 
    (SELECT id FROM medicaments WHERE nom_commercial LIKE 'CLAMOXYL 500%' LIMIT 1),
    (SELECT id FROM posologies_reference WHERE medicament_id = (SELECT id FROM medicaments WHERE nom_commercial LIKE 'CLAMOXYL 500%' LIMIT 1) AND tranche_age_id = 16 LIMIT 1),
    1.0, 3, 7, 'Prendre à la fin des repas pour une meilleure tolérance.'
);

-- ============================================================================
-- ORDONNANCE 2 : PÉDIATRIQUE - CALCUL AU POIDS (PIERRE MARTIN - 15kg)
-- ============================================================================
-- Mise à jour du poids pour le calcul
UPDATE patients SET poids_kg = 15.00 WHERE id = @patient_enfant;

SET @ord2_id = UUID();
INSERT INTO ordonnances (id, patient_id, pharmacie_id, code_ordonnance, date_emission, statut) 
VALUES (@ord2_id, @patient_enfant, @pharmacie_id, 'ORD-2026-002', NOW(), 'valide');

-- Ligne 1 : Doliprane Sirop (Calcul automatique via pipette kg)
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, dose_unitaire, frequence_prise, duree_traitement, instructions)
VALUES (
    UUID(), @ord2_id, 
    (SELECT id FROM medicaments WHERE nom_commercial LIKE 'DOLIPRANE ENFANTS 2,4%' LIMIT 1),
    (SELECT id FROM posologies_reference WHERE calcul_par_poids = 1 LIMIT 1),
    15.0, 4, 3, 'Utiliser la pipette graduée à 15kg. Maximum 4 prises par jour.'
);

-- ============================================================================
-- ORDONNANCE 3 : SENIOR - DOULEURS CHRONIQUES (MARIE DURAND)
-- ============================================================================
SET @ord3_id = UUID();
INSERT INTO ordonnances (id, patient_id, pharmacie_id, code_ordonnance, date_emission, statut) 
VALUES (@ord3_id, @patient_senior, @pharmacie_id, 'ORD-2026-003', NOW(), 'valide');

-- Ligne 1 : Paracétamol 1000mg (Dose Senior adaptée)
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, dose_unitaire, frequence_prise, duree_traitement, instructions)
VALUES (
    UUID(), @ord3_id, 
    (SELECT id FROM medicaments WHERE nom_commercial LIKE 'DOLIPRANE 1000%' LIMIT 1),
    (SELECT id FROM posologies_reference WHERE tranche_age_id = 17 LIMIT 1),
    1.0, 3, 5, 'Respecter 8 heures entre chaque prise.'
);

-- Ligne 2 : Ibuprofène 400mg (Ponctuel)
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, dose_unitaire, frequence_prise, duree_traitement, instructions)
VALUES (
    UUID(), @ord3_id, 
    (SELECT id FROM medicaments WHERE nom_commercial LIKE 'ADVIL 400%' LIMIT 1),
    (SELECT id FROM posologies_reference WHERE medicament_id = (SELECT id FROM medicaments WHERE nom_commercial LIKE 'ADVIL 400%' LIMIT 1) LIMIT 1),
    1.0, 2, 3, 'Uniquement en cas de forte douleur. Pendant le repas.'
);

COMMIT;




-- ============================================================================
-- VÉRIFICATION DES INSERTIONS
-- ============================================================================

-- Compter les posologies créées
SELECT 
  'Posologies de référence' AS table_name,
  COUNT(*) AS nombre_insertions
FROM posologies_reference
UNION ALL
SELECT 
  'Heures de prise',
  COUNT(*)
FROM posologies_heures
UNION ALL
SELECT 
  'Conditions de prise',
  COUNT(*)
FROM posologies_conditions
UNION ALL
SELECT 
  'Restrictions',
  COUNT(*)
FROM posologies_restrictions
UNION ALL
SELECT 
  'Paliers de poids',
  COUNT(*)
FROM posologies_poids;