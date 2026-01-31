USE `omeda`;

-- 1. Configuration des IDs de base
SET @pharmacie_id = 'fa1542e2-eefa-11f0-a667-380025f3fdf9'; 
SET @p_adulte = 'f9e08559-eefa-11f0-a667-380025f3fdf9'; -- Jean Dupont
SET @p_senior = 'f9e08586-eefa-11f0-a667-380025f3fdf9'; -- Marie Durand
SET @p_enfant = 'f9e08598-eefa-11f0-a667-380025f3fdf9'; -- Pierre Martin

-- ============================================================================
-- ORDONNANCE 1 : BRONCHITE (JEAN DUPONT)
-- ============================================================================
SET @ord1 = UUID();
INSERT INTO ordonnances (id, patient_id, pharmacie_id, numero_ordonnance, date_prescription, medecin_nom, medecin_specialite, diagnostic, statut, date_debut, date_fin_prevue, ocr_valide)
VALUES (@ord1, @p_adulte, @pharmacie_id, 'ORD-2026-001', CURDATE(), 'Dr. MBARGA', 'Généraliste', 'Bronchite aiguë', 'en_cours', NOW(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 1);

-- Ligne 1 : Amoxicilline
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin)
VALUES (UUID(), @ord1, (SELECT id FROM medicaments WHERE nom_commercial LIKE 'CLAMOXYL 500%' LIMIT 1), NULL, 1.0, 'gél', 3, 7, '1 gélule 3 fois par jour à la fin des repas.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY));

-- Ligne 2 : Corticoïde (Prednisolone)
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin)
VALUES (UUID(), @ord1, (SELECT id FROM medicaments WHERE nom_commercial LIKE 'SOLUPRED%' OR id IS NOT NULL LIMIT 1), NULL, 3.0, 'cp', 1, 5, '3 comprimés le matin à dissoudre dans l''eau.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY));

-- ============================================================================
-- ORDONNANCE 2 : ANGINA PÉDIATRIQUE (PIERRE MARTIN)
-- ============================================================================
SET @ord2 = UUID();
INSERT INTO ordonnances (id, patient_id, pharmacie_id, numero_ordonnance, date_prescription, medecin_nom, diagnostic, statut, date_debut, date_fin_prevue, ocr_valide)
VALUES (@ord2, @p_enfant, @pharmacie_id, 'ORD-2026-002', CURDATE(), 'Dr. NGONO', 'Angine Érythémateuse', 'en_cours', NOW(), DATE_ADD(CURDATE(), INTERVAL 6 DAY), 1);

-- Ligne 1 : Doliprane Sirop (15kg)
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin)
VALUES (UUID(), @ord2, (SELECT id FROM medicaments WHERE nom_commercial LIKE 'DOLIPRANE ENFANTS%' LIMIT 1), NULL, 15.0, 'ml', 4, 3, 'Utiliser la pipette graduée à 15kg.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY));

-- Ligne 2 : Maxilase Sirop
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, posologie_reference_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin)
VALUES (UUID(), @ord2, (SELECT id FROM medicaments WHERE nom_commercial LIKE 'MAXILASE%' OR id IS NOT NULL LIMIT 1), NULL, 1.0, 'cuillère', 3, 5, '1 cuillère à café 3 fois par jour.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY));


SET @ord3 = UUID();
INSERT INTO ordonnances (
    id, patient_id, pharmacie_id, numero_ordonnance, date_prescription, 
    medecin_nom, medecin_specialite, etablissement, diagnostic, 
    statut, date_debut, date_fin_prevue, ocr_valide
) VALUES (
    @ord3, @p_senior, @pharmacie_id, 'ORD-2026-003', CURDATE(), 
    'Dr. TCHOUA', 'Cardiologue', 'Clinique du Cœur', 'Suivi Hypertension Artérielle', 
    'en_cours', NOW(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1
);

-- Ligne 1 : Aspirine Protect 100mg
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin, statut)
VALUES (UUID(), @ord3, 'ededf33a-eeee-11f0-a667-380025f3fdf9', 1.0, 'cp', 1, 30, 'Prendre le matin sans croquer avec un grand verre d''eau.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'actif');

-- Ligne 2 : Doliprane 1000mg
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin, statut)
VALUES (UUID(), @ord3, 'ecf2e8f4-eeee-11f0-a667-380025f3fdf9', 1.0, 'cp', 3, 10, 'En cas de douleur, espacer de 8h entre chaque prise.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'actif');


-- ============================================================================
-- ORDONNANCE 4 : ASTHME & ALLERGIE (JEAN DUPONT)
-- ============================================================================
SET @ord4 = UUID();
INSERT INTO ordonnances (
    id, patient_id, pharmacie_id, numero_ordonnance, date_prescription, 
    medecin_nom, medecin_specialite, etablissement, diagnostic, 
    statut, date_debut, date_fin_prevue, ocr_valide
) VALUES (
    @ord4, @p_adulte, @pharmacie_id, 'ORD-2026-004', CURDATE(), 
    'Dr. NGONO', 'Pneumologue', 'Hôpital Général', 'Asthme saisonnier', 
    'en_cours', NOW(), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 1
);

-- Ligne 1 : Ventoline 100µg
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin, statut)
VALUES (UUID(), @ord4, 'ee882226-eeee-11f0-a667-380025f3fdf9', 2.0, 'µg', 4, 15, '2 bouffées en cas de crise ou de sifflement.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'actif');

-- Ligne 2 : Advil 400mg
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin, statut)
VALUES (UUID(), @ord4, 'ee1c9ef7-eeee-11f0-a667-380025f3fdf9', 1.0, 'cp', 3, 5, 'Prendre impérativement au cours d''un repas.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'actif');


-- ============================================================================
-- ORDONNANCE 5 : GASTRO & DOULEURS (JEAN DUPONT)
-- ============================================================================
SET @ord5 = UUID();
INSERT INTO ordonnances (
    id, patient_id, pharmacie_id, numero_ordonnance, date_prescription, 
    medecin_nom, medecin_specialite, etablissement, diagnostic, 
    statut, date_debut, date_fin_prevue, ocr_valide
) VALUES (
    @ord5, @p_adulte, @pharmacie_id, 'ORD-2026-005', CURDATE(), 
    'Dr. MBARGA', 'Généraliste', 'Centre de Santé', 'Spasmes abdominaux', 
    'en_cours', NOW(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 1
);

-- Ligne 1 : Spasfon 80mg
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin, statut)
VALUES (UUID(), @ord5, 'ee540195-eeee-11f0-a667-380025f3fdf9', 2.0, 'cp', 3, 5, 'Prendre 2 comprimés dès l''apparition des spasmes.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'actif');

-- Ligne 2 : Inexium 20mg
INSERT INTO lignes_ordonnance (id, ordonnance_id, medicament_id, quantite_prescrite, unite_quantite, frequence_par_jour, duree_jours, instructions_patient, date_debut, date_fin, statut)
VALUES (UUID(), @ord5, 'eeaed42b-eeee-11f0-a667-380025f3fdf9', 1.0, 'cp', 1, 14, 'Avaler entier avec de l''eau, sans croquer.', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'actif');

COMMIT;





























DELIMITER $$

DROP PROCEDURE IF EXISTS sp_generer_rappels_ligne$$

CREATE PROCEDURE sp_generer_rappels_ligne(
  IN p_ligne_ordonnance_id CHAR(36)
)BEGIN
  DECLARE v_patient_id CHAR(36);
  DECLARE v_medicament_id CHAR(36);
  DECLARE v_posologie_ref_id CHAR(36);
  DECLARE v_med_nom VARCHAR(255);
  DECLARE v_date_debut, v_date_fin, v_curr_date DATE;
  DECLARE v_heure TIME;
  DECLARE v_quantite DECIMAL(10,3);
  DECLARE v_unite VARCHAR(20);
  DECLARE v_instructions TEXT;
  
  -- Variables pour messages compilés
  DECLARE v_consignes TEXT DEFAULT '';
  DECLARE v_alertes TEXT DEFAULT '';
  DECLARE v_delai_max_anticipation INT DEFAULT 0;
  DECLARE v_heure_anticipation TIME;
  DECLARE v_titre VARCHAR(255);
  DECLARE v_message_complet TEXT;
  DECLARE v_groupe_id CHAR(36);
  DECLARE v_rappel_precedent_id CHAR(36) DEFAULT NULL;
  
  DECLARE done INT DEFAULT FALSE;
  
  -- Curseur pour les heures de prise
  DECLARE cur_heures CURSOR FOR 
    SELECT ph.heure_prise, ph.quantite 
    FROM posologies_heures ph 
    WHERE ph.posologie_reference_id = v_posologie_ref_id
    ORDER BY ph.ordre_prise;
    
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  -- ===== 1. RÉCUPÉRER LES INFOS DE BASE =====
  SELECT 
    lo.posologie_reference_id,
    o.patient_id,
    lo.medicament_id,
    m.nom_commercial,
    lo.date_debut,
    lo.date_fin,
    lo.unite_quantite,
    lo.instructions_patient
  INTO 
    v_posologie_ref_id,
    v_patient_id,
    v_medicament_id,
    v_med_nom,
    v_date_debut,
    v_date_fin,
    v_unite,
    v_instructions
  FROM lignes_ordonnance lo
  INNER JOIN ordonnances o ON lo.ordonnance_id = o.id
  INNER JOIN medicaments m ON lo.medicament_id = m.id
  WHERE lo.id = p_ligne_ordonnance_id;

  -- ===== 2. COMPILER LES CONSIGNES DIÉTÉTIQUES =====
  SELECT 
    GROUP_CONCAT(
      DISTINCT CONCAT(cp.libelle, 
        CASE 
          WHEN cp.delai_minutes > 0 THEN CONCAT(' (', cp.delai_minutes, ' min avant)')
          WHEN cp.delai_minutes < 0 THEN CONCAT(' (', ABS(cp.delai_minutes), ' min après)')
          ELSE ''
        END
      ) 
      SEPARATOR ' | '
    )
  INTO v_consignes
  FROM posologies_conditions pc 
  INNER JOIN conditions_prise cp ON pc.condition_prise_id = cp.id 
  WHERE pc.posologie_reference_id = v_posologie_ref_id;

  -- ===== 3. COMPILER LES ALERTES DE SÉCURITÉ =====
  SELECT 
    GROUP_CONCAT(
      DISTINCT CONCAT('⚠️ ', rm.libelle) 
      SEPARATOR ' | '
    )
  INTO v_alertes
  FROM posologies_restrictions pr 
  INNER JOIN restrictions_medicament rm ON pr.restriction_id = rm.id 
  WHERE pr.posologie_reference_id = v_posologie_ref_id;

  -- ===== 4. CALCULER LE DÉLAI MAX D'ANTICIPATION =====
  SELECT IFNULL(MAX(cp.delai_minutes), 0)
  INTO v_delai_max_anticipation
  FROM posologies_conditions pc 
  INNER JOIN conditions_prise cp ON pc.condition_prise_id = cp.id 
  WHERE pc.posologie_reference_id = v_posologie_ref_id
    AND cp.delai_minutes > 0;

  -- Générer un groupe_id unique pour cette ligne (tous les rappels de cette ligne auront le même groupe)
  SET v_groupe_id = UUID();

  -- ===== 5. BOUCLER SUR CHAQUE JOUR DU TRAITEMENT =====
  SET v_curr_date = v_date_debut;
  
  WHILE v_curr_date <= v_date_fin DO
    -- Ouvrir le curseur pour les heures de prise
    OPEN cur_heures;
    
    read_loop: LOOP
      FETCH cur_heures INTO v_heure, v_quantite;
      IF done THEN
        LEAVE read_loop;
      END IF;
      
      -- ===== 6. CALCULER L'HEURE D'ANTICIPATION =====
      IF v_delai_max_anticipation > 0 THEN
        SET v_heure_anticipation = SUBTIME(v_heure, SEC_TO_TIME(v_delai_max_anticipation * 60));
      ELSE
        SET v_heure_anticipation = NULL;
      END IF;
      
      -- ===== 7. CONSTRUIRE LES MESSAGES =====
      SET v_message_complet = CONCAT(v_med_nom, ' - ', v_quantite, ' ', v_unite);
      SET v_titre = CONCAT('Prise de ', TIME_FORMAT(v_heure, '%H:%i'));
      
      -- ===== 8. CRÉER LE RAPPEL =====
      -- On génère l'ID du rappel actuel dans une variable
      SET @current_rappel_id = UUID(); 

      INSERT INTO rappels (
        id,
        ligne_ordonnance_id,
        patient_id,
        groupe_id,
        date_rappel,
        heure_rappel,
        heure_anticipation,
        titre_rappel,
        message_complet,
        consignes_dietetiques,
        alertes_securite,
        rappel_precedent_id,
        quantite_prescrite,
        unite,
        statut,
        type_notification
      )
      VALUES (
        @current_rappel_id, -- Utilisation de l'ID généré juste au-dessus
        p_ligne_ordonnance_id,
        v_patient_id,
        v_groupe_id,
        v_curr_date,
        v_heure,
        v_heure_anticipation,
        v_titre,
        v_message_complet,
        v_consignes,
        v_alertes,
        v_rappel_precedent_id, -- Sera NULL au premier tour, puis l'ID précédent
        v_quantite,
        v_unite,
        'planifie',
        'push'
      );
      
      -- Mémoriser cet ID pour le prochain tour de boucle
      SET v_rappel_precedent_id = @current_rappel_id;
      
    END LOOP;
    
    SET done = FALSE;
    CLOSE cur_heures;
    
    -- Passer au jour suivant
    SET v_curr_date = DATE_ADD(v_curr_date, INTERVAL 1 DAY);
  END WHILE;
  
END$$

DELIMITER ;