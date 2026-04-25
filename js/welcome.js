
        
       async function validateSession() {
    try {
        const token = localStorage.getItem('secura_event_session_token');
        if (!token) {
            showToast('Session expirée. Veuillez vous reconnecter.', 'error');
            return false;
        }

        // Vérifier via API
        const result = await window.storage.verifyEventSessionToken(token);
        return result.success;
        
    } catch (error) {
        console.error('Erreur validation session:', error);
        return false;
    }
}
   
      

function getGuestAvatarImage(guest) {
    const baseUrl = '../assets/images/';
    const validGenders = ['m', 'f', 'homme', 'femme', 'male', 'female', 'couple', 'maman', 'mother', 'autre'];
    
    // 1️⃣ Vérifier d'abord le champ gender/sexe
    const gender = (guest.gender?.toLowerCase() || guest.sexe?.toLowerCase() || '').trim();
    
    if (gender) {
        // Normaliser et checker les valeurs connues
        if (gender === 'f' || gender === 'femme' || gender === 'woman' || gender === 'female') {
            return `${baseUrl}femme.png`;
        } else if (gender === 'm' || gender === 'homme' || gender === 'man' || gender === 'male') {
            return `${baseUrl}homme.png`;
        } else if (gender === 'couple') {
            return `${baseUrl}couple.png`;
        } else if (gender === 'maman' || gender === 'mother') {
            return `${baseUrl}maman.png`;
        } else if (gender === 'autre') {
            return null; // Utiliser les initiales
        }
    }
    
    // 2️⃣ Détection intelligente basée sur les titres de civilité et notes
    const firstName = (guest.firstName || '').toLowerCase().trim();
    const lastName = (guest.lastName || '').toLowerCase().trim();
    const notes = (guest.notes || '').toLowerCase().trim();
    const company = (guest.company || '').toLowerCase().trim();
    
    // 🎖️ Détecter "Maman", "Mother" dans les notes ou le nom
    if (notes.includes('maman') || notes.includes('mother') || 
        firstName.includes('maman') || firstName.includes('mother') ||
        lastName.includes('maman') || lastName.includes('mother')) {
        return `${baseUrl}maman.png`;
    }
    
    // 👫 Détecter "Couple" dans les notes ou le type
    if (guest.type === 'couple' || 
        notes.includes('couple') || 
        company.includes('couple')) {
        return `${baseUrl}couple.png`;
    }
    
    // 👨 Détecter les titres masculins et préfixes
    const malePatterns = [
        /\bm\b\.?/i,           // M. ou M
        /\bmonsieur\b/i,       // Monsieur
        /\bmr\b\.?/i,          // Mr ou Mr.
        /\bmon\b\.?/i,         // Mon (de Monsieur)
        /père/i,               // Père
        /father/i,             // Father
        /dad\b/i,              // Dad
        /papa/i                // Papa
    ];
    
    // Chercher dans les notes
    if (malePatterns.some(pattern => pattern.test(notes))) {
        return `${baseUrl}homme.png`;
    }
    
    // Chercher dans le prénom ou nom
    if (malePatterns.some(pattern => pattern.test(firstName + ' ' + lastName))) {
        return `${baseUrl}homme.png`;
    }
    
    // 👩 Détecter les titres féminins et préfixes
    const femalePatterns = [
        /\bm[lle]{1,3}\.?/i,    // Mlle ou Mme ou Mme.
        /\bmme\b\.?/i,          // Mme
        /\bmlle\b\.?/i,         // Mlle
        /\bmademoiselle\b/i,    // Mademoiselle
        /\bmadame\b/i,          // Madame
        /\bmrs\b\.?/i,          // Mrs
        /\bms\b\.?/i,           // Ms
        /mère/i,                // Mère
        /mother/i,              // Mother
        /maman/i,               // Maman
        /mom\b/i,               // Mom
        /mama/i                 // Mama
    ];
    
    // Chercher dans les notes
    if (femalePatterns.some(pattern => pattern.test(notes))) {
        return `${baseUrl}femme.png`;
    }
    
    // Chercher dans le prénom ou nom
    if (femalePatterns.some(pattern => pattern.test(firstName + ' ' + lastName))) {
        return `${baseUrl}femme.png`;
    }
    
    // 3️⃣ Détection basée sur les noms courants (optionnel, peut être amélioré)
    // Liste de prénoms féminins courants en français
    const commonFemaleNames = [
        'marie', 'anne', 'sophie', 'christine', 'catherine', 'nathalie',
        'isabelle', 'francine', 'fabienne', 'nadine', 'monique', 'dominique',
        'michelle', 'carole', 'patricia', 'béatrice', 'denise', 'brigitte',
        'véronique', 'christine', 'joëlle', 'chantal', 'thérèse', 'simone',
        'valerie', 'annie', 'elise', 'alice', 'claire', 'nicole', 'sylvie',
        'martine', 'emilie', 'victoria', 'laura', 'sarah', 'jessica', 'jessica'
    ];
    
    // Liste de prénoms masculins courants en français
    const commonMaleNames = [
        'jean', 'pierre', 'michel', 'andré', 'bernard', 'françois',
        'jacques', 'patrick', 'christian', 'daniel', 'olivier', 'alain',
        'marc', 'thierry', 'charles', 'paul', 'jean-paul', 'jean-claude',
        'serge', 'gérard', 'dominique', 'richard', 'joseph', 'louis',
        'luc', 'eric', 'david', 'nicolas', 'thomas', 'alexandre', 'benoit'
    ];
    
    if (firstName) {
        if (commonFemaleNames.includes(firstName)) {
            return `${baseUrl}femme.png`;
        } else if (commonMaleNames.includes(firstName)) {
            return `${baseUrl}homme.png`;
        }
    }
    
    // 4️⃣ Aucune détection n'a fonctionné, retourner null (utiliser les initiales)
    return null;
}

        // Fonction pour obtenir les initiales
        function getInitials(name) {
            if (!name || typeof name !== 'string') return '?';
            return name
                .split(' ')
                .map(word => word[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }

        // Fonction pour échapper le HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // ========================================
        // FONCTIONS UTILITAIRES POUR LE CADENAS
        // ========================================

        // Variable pour stocker la fonctionnalité actuellement bloquée
        let lockModalCurrentFeature = null;

        // Fonction pour obtenir le code depuis les champs d'input
        function getLockCode() {
            const inputs = Array.from(document.querySelectorAll('.lock-code'));
            inputs.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
            return inputs.map(input => input.value.toUpperCase()).join('');
        }

        // Fonction pour obtenir le code (alias)
        function getCodeFromInputs(selector = '.lock-code') {
            return getLockCode();
        }

        // Fonction pour effacer les champs de code
        function clearCodeInputs(selector = '.lock-code') {
            const inputs = document.querySelectorAll(selector);
            inputs.forEach(input => {
                input.value = '';
                input.classList.remove('filled', 'error');
            });
        }

        // Fonction pour afficher une erreur sur les inputs
        function showErrorOnInputs(selector = '.lock-code') {
            const inputs = document.querySelectorAll(selector);
            inputs.forEach(input => {
                input.classList.add('error');
                setTimeout(() => {
                    input.classList.remove('error');
                }, 500);
            });
        }

        // Fonction pour masquer un message de formulaire
        function hideFormMessage(type = 'lock') {
            const messageId = `${type}FormMessage`;
            const messageEl = document.getElementById(messageId);
            if (messageEl) messageEl.style.display = 'none';
        }

        // Fonction pour afficher un message de formulaire
        function showFormMessage(type, message, formType = 'lock') {
            const messageId = `${formType}FormMessage`;
            const messageEl = document.getElementById(messageId);
            
            if (!messageEl) return;
            
            const iconEl = messageEl.querySelector('.message-icon');
            const textEl = messageEl.querySelector('.message-text');
            
            messageEl.className = `form-message ${type}`;
            
            if (type === 'loading') {
                iconEl.innerHTML = '<div class="inline-loader" style="display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(217, 119, 6, 0.3); border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>';
            } else if (type === 'success') {
                iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
            } else if (type === 'error') {
                iconEl.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            }
            
            textEl.textContent = message;
            messageEl.style.display = 'flex';
        }

        // Fonction pour afficher le modal de cadenas
        function showLockModal(featureElement) {
            lockModalCurrentFeature = featureElement?.dataset?.featureId || null;
            
            const lockModal = document.getElementById('lockModal');
            if (lockModal) {
                lockModal.classList.add('active');
                
                // Réinitialiser le formulaire
                clearCodeInputs('.lock-code');
                hideFormMessage('lock');
                
                // Focus sur le premier champ
                setTimeout(() => {
                    const firstInput = lockModal.querySelector('.lock-code[data-index="0"]');
                    if (firstInput) firstInput.focus();
                }, 300);
            }
        }

        // Fonction pour initialiser les champs de code du cadenas
        function initLockCodeInputs() {
            const lockInputs = document.querySelectorAll('.lock-code');
            
            lockInputs.forEach(input => {
                // Gestion de la saisie
                input.addEventListener('input', function(e) {
                    let value = (this.value || '').toUpperCase();
                    
                    // Validation caractères
                    if (!/^[A-Z0-9]$/.test(value)) {
                        value = '';
                    }
                    
                    this.value = value;
                    
                    // Navigation automatique
                    if (value.length === 1) {
                        const currentIndex = parseInt(this.dataset.index);
                        const nextInput = document.querySelector(`.lock-code[data-index="${currentIndex + 1}"]`);
                        
                        if (nextInput) {
                            setTimeout(() => nextInput.focus(), 10);
                        } else {
                            // Dernier champ rempli
                            setTimeout(() => {
                                const code = getLockCode();
                                if (code.length === 4) {
                                    document.getElementById('validateLockCodeBtn').focus();
                                }
                            }, 50);
                        }
                    }
                    
                    // Mise à jour visuelle
                    if (value.length === 1) {
                        this.classList.add('filled');
                    } else {
                        this.classList.remove('filled');
                    }
                });
                
                // Gestion des touches
                input.addEventListener('keydown', function(e) {
                    const currentIndex = parseInt(this.dataset.index);
                    
                    switch(e.key) {
                        case 'Backspace':
                            e.preventDefault();
                            
                            if (this.value.length > 0) {
                                this.value = '';
                                this.classList.remove('filled');
                            } else {
                                // Aller au champ précédent
                                const prevInput = document.querySelector(`.lock-code[data-index="${currentIndex - 1}"]`);
                                if (prevInput) {
                                    prevInput.focus();
                                    prevInput.value = '';
                                    prevInput.classList.remove('filled');
                                }
                            }
                            break;
                            
                        case 'ArrowLeft':
                            e.preventDefault();
                            const prevInput = document.querySelector(`.lock-code[data-index="${currentIndex - 1}"]`);
                            if (prevInput) prevInput.focus();
                            break;
                            
                        case 'ArrowRight':
                            e.preventDefault();
                            const nextInput = document.querySelector(`.lock-code[data-index="${currentIndex + 1}"]`);
                            if (nextInput) nextInput.focus();
                            break;
                            
                        case 'Enter':
                            e.preventDefault();
                            const code = getLockCode();
                            if (code.length === 4) {
                                validateLockCode();
                            } else {
                                showFormMessage('error', 'Code incomplet (4 caractères requis)', 'lock');
                            }
                            break;
                    }
                });
                
                // Collage
                input.addEventListener('paste', function(e) {
                    e.preventDefault();
                    const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    
                    if (pastedData) {
                        const inputs = Array.from(document.querySelectorAll('.lock-code'));
                        inputs.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
                        
                        // Remplir les champs
                        for (let i = 0; i < pastedData.length && i < inputs.length; i++) {
                            inputs[i].value = pastedData[i];
                            inputs[i].classList.add('filled');
                        }
                        
                        // Focus sur le dernier champ rempli
                        setTimeout(() => {
                            const lastFilledIndex = Math.min(pastedData.length - 1, inputs.length - 1);
                            if (lastFilledIndex < inputs.length - 1) {
                                inputs[lastFilledIndex + 1].focus();
                            } else {
                                inputs[lastFilledIndex].focus();
                            }
                        }, 10);
                    }
                });
            });
        }

        // Fonction pour valider le code du cadenas
        async function validateLockCode() {
            const code = getCodeFromInputs('.lock-code');
            
            if (code.length !== 4) {
                showFormMessage('error', 'Code 4 caractères requis', 'lock');
                return;
            }
            
            showFormMessage('loading', 'Vérification de votre code...', 'lock');
            
            try {
                // Vérifier le code via API
                const result = await window.storage.verifyAccessCode(code);
                
                if (result.success && result.data) {
                    const guestData = result.data;
                    
                    // Mettre à jour la session avec l'invité
                    const sessionResult = await updateSessionWithGuest(guestData);
                    
                    if (sessionResult) {
                        showFormMessage('success', 'Code validé ! Mise à jour de votre session...', 'lock');
                        
                        // Fermer le modal après succès
                        setTimeout(() => {
                            const lockModal = document.getElementById('lockModal');
                            if (lockModal) lockModal.classList.remove('active');
                            
                            // Recharger les données
                            checkAuthenticationState();
                            
                            // Si une fonctionnalité était demandée, y accéder
                            if (lockModalCurrentFeature) {
                                goToFeature(lockModalCurrentFeature);
                                lockModalCurrentFeature = null;
                            }
                            
                            // Afficher un message de bienvenue
                            Swal.fire({
                                title: 'Identification réussie !',
                                html: `
                                    <div style="text-align: center; padding: 20px 0;">
                                        <i class="fas fa-user-check" style="font-size: 3rem; color: var(--success); margin-bottom: 15px;"></i>
                                        <p>Bienvenue <strong>${escapeHtml(guestData.firstName || '')} ${escapeHtml(guestData.lastName || '')}</strong> !</p>
                                        <p style="font-size: 0.9rem; opacity: 0.8; margin-top: 10px;">
                                            Vous avez maintenant accès à toutes les fonctionnalités personnalisées.
                                        </p>
                                    </div>
                                `,
                                confirmButtonColor: '#D97706',
                                timer: 3000,
                                showConfirmButton: false
                            });
                        }, 1500);
                    } else {
                        throw new Error('Erreur mise à jour session');
                    }
                } else {
                    throw new Error(result.error || 'Code invalide');
                }
                
            } catch (error) {
                console.error('❌ Erreur validation code:', error);
                showFormMessage('error', 'Code invalide ou invité non trouvé', 'lock');
                
                // Effacer les champs après erreur
                setTimeout(() => {
                    clearCodeInputs('.lock-code');
                    showErrorOnInputs('.lock-code');
                }, 500);
            }
        }

        // Fonction pour initialiser le modal de cadenas
        function initLockModal() {
            const lockModal = document.getElementById('lockModal');
            const lockClose = document.getElementById('lockClose');
            const cancelLockBtn = document.getElementById('cancelLockBtn');
            const validateLockCodeBtn = document.getElementById('validateLockCodeBtn');
            
            if (!lockModal) return;
            
            // Fermer le modal
            if (lockClose) {
                lockClose.addEventListener('click', () => {
                    lockModal.classList.remove('active');
                    lockModalCurrentFeature = null;
                });
            }
            
            if (cancelLockBtn) {
                cancelLockBtn.addEventListener('click', () => {
                    lockModal.classList.remove('active');
                    lockModalCurrentFeature = null;
                });
            }
            
            // Validation du code
            if (validateLockCodeBtn) {
                validateLockCodeBtn.addEventListener('click', validateLockCode);
            }
            
            // Fermer en cliquant en dehors
            lockModal.addEventListener('click', (e) => {
                if (e.target === lockModal) {
                    lockModal.classList.remove('active');
                    lockModalCurrentFeature = null;
                }
            });
            
            // Initialiser les champs de code
            initLockCodeInputs();
        }

// ========================================
// INITIALISATION MODAL MODE ANONYME
// ========================================
function initAnonymousStatusModal() {
    const modal = document.getElementById('anonymousStatusModal');
    const closeBtn = document.getElementById('anonymousStatusCloseBtn');
    const closeIconBtn = document.getElementById('anonymousStatusClose');
    const identifyBtn = document.getElementById('guestIdentifyBtn');
    const guestAvatar = document.getElementById('guestAvatar');
    
    if (!modal) return;
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    if (closeIconBtn) {
        closeIconBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    if (identifyBtn) {
        identifyBtn.addEventListener('click', () => {
            showLockModal();
            modal.classList.remove('active');
        });
    }
    
    if (guestAvatar) {
        guestAvatar.addEventListener('click', () => {
            const sessionData = window.storage.currentSession;
            const isAnonymous = sessionData?.table && !sessionData?.guest;
            if (isAnonymous) {
                modal.classList.add('active');
            }
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}



// ========================================
// GESTION DU MODE ANONYME/IDENTIFIÉ
// ========================================
// ========================================
// GESTION DU MODE ANONYME/IDENTIFIÉ
// ========================================

/**
 * Vérifie et met à jour l'état d'authentification
 */
async function checkAuthenticationState() {
    try {
        // Logique d'authentification:
        // - Si on a une SESSION AVEC TABLE mais PAS DE GUEST = MODE ANONYME
        // - Si on a une SESSION AVEC GUEST = MODE IDENTIFIÉ
        // - Si on n'a pas de SESSION du tout = REDIRECTION VERS ACCESS
        
        const token = localStorage.getItem('secura_event_session_token');
        
        if (!token) {
            // Pas de token du tout - pas de session
            showAnonymousHeader();
            updateFeatureCards(false);
            return;
        }
        
        // On a un token, on doit récupérer les détails de la session via storage.js
        const sessionResult = await window.storage.getCurrentSessionDetails();
        
        if (!sessionResult?.success || !sessionResult?.data) {
            // Token existe mais pas de session trouvée
            showAnonymousHeader();
            updateFeatureCards(false);
            return;
        }
        
        const sessionData = sessionResult.data;
        
        // Vérifier: ANONYME = on a une TABLE mais PAS de GUEST identifié
        const isAnonymous = sessionData.table && !sessionData.guest;
  
        
        if (isAnonymous) {
            // Mode anonyme: on a accès à la table mais pas identifié
            showAnonymousHeader();
            updateSidebarSessionInfo(sessionData);
        } else if (sessionData.guest) {
            // Mode identifié: on a un guest identifié
            showIdentifiedHeader(sessionData);
            updateSidebarSessionInfo(sessionData);
        } else {
            // Situation incohérente
            showAnonymousHeader();
        }
        
        // Mettre à jour les cartes avec le bon état d'authentification
        updateFeatureCards(isAnonymous);
        
    } catch (error) {
        console.error('Erreur vérification auth:', error);
        showAnonymousHeader();
        updateFeatureCards(false);
    }
}

/**
 * Affiche l'header en mode anonyme
 */
function showAnonymousHeader() {
    const welcomeTitle = document.getElementById('welcomeTitle');
    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    const guestAvatar = document.getElementById('guestAvatar');
    const profileName = document.getElementById('profileName');
    
    if (welcomeTitle) welcomeTitle.textContent = 'Bienvenue à l\'événement !';
    if (welcomeSubtitle) welcomeSubtitle.textContent = 'Connectez-vous pour accéder à toutes les fonctionnalités';
    if (guestAvatar) guestAvatar.innerHTML = '<i class="fas fa-user-secret"></i>';
    if (profileName) profileName.textContent = 'Anonyme';
    
    // Mettre à jour la section Profile dans la sidebar
    const sidebarGuestWelcome = document.getElementById('guestWelcome');
    const sidebarProfileEmail = document.getElementById('welcomesidebarProfileEmail');
    const sidebarProfileRole = document.getElementById('welcomesidebarProfileRole');
    
    if (sidebarGuestWelcome) sidebarGuestWelcome.textContent = 'Anonyme';
    if (sidebarProfileEmail) sidebarProfileEmail.textContent = 'Connectez-vous';
    if (sidebarProfileRole) sidebarProfileRole.textContent = 'Mode invité';
}

/**
 * Affiche l'header en mode identifié
 */
function showIdentifiedHeader(sessionData) {
    const guest = sessionData.guest;
    const table = sessionData.table;
    const event = sessionData.event;
    
    if (!guest) return;
    
    const fullName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email;
    const initials = getInitials(fullName);
    const avatarImage = getGuestAvatarImage(guest);
    
    // Mettre à jour le header principal
    const welcomeTitle = document.getElementById('welcomeTitle');
    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    const guestAvatar = document.getElementById('guestAvatar');
    const profileName = document.getElementById('profileName');
    const tableBadge = document.getElementById('tableBadge');
    
    if (welcomeTitle) welcomeTitle.textContent = `Bienvenue, ${guest.firstName || ''} !`;
    if (welcomeSubtitle) welcomeSubtitle.textContent = `Ravi de vous accueillir${table ? ` à la "${table.tableName || 'Table ' + table.tableNumber}"` : ''}`;
    
    if (guestAvatar) {
        if (avatarImage) {
            guestAvatar.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}">`;
        } else {
            guestAvatar.innerHTML = initials;
            guestAvatar.style.background = 'var(--gradient)';
        }
    }
    
    if (profileName) profileName.textContent = fullName;
    
    if (tableBadge && table) {
        tableBadge.innerHTML = `
            <i class="fas fa-chair"></i>
            <span>Table ${table.tableNumber || 'Inconnue'}</span>
            ${table.tableName && table.tableName !== table.tableNumber ? ` - ${table.tableName}` : ''}
        `;
    }
    
    // Mettre à jour la sidebar
    const sidebarGuestWelcome = document.getElementById('guestWelcome');
    const sidebarProfileEmail = document.getElementById('welcomesidebarProfileEmail');
    const sidebarProfileRole = document.getElementById('welcomesidebarProfileRole');
    
    if (sidebarGuestWelcome) sidebarGuestWelcome.textContent = fullName;
    if (sidebarProfileEmail) sidebarProfileEmail.textContent = guest.email || 'Email non spécifié';
    if (sidebarProfileRole) sidebarProfileRole.textContent = guest.type === 'vip' ? 'Invité VIP' : 'Invité';
    
    // Mettre à jour le header session
    populateSessionHeader(sessionData);
}

/**
 * Met à jour les cartes de fonctionnalités selon le mode
 */
function updateFeatureCards(isAnonymous) {
    const features = [
        {
            id: 'chat',
            icon: 'fas fa-comments',
            title: 'Chat de Table',
            description: 'Échangez avec les autres invités de votre table en temps réel',
            requiresAuth: true,
            backgroundImage: '/assets/images/feature/chat.png'
        },
        
    {
            id: 'guests',
            icon: 'fas fa-users',
            title: 'Liste des invités',
            description: 'Découvrez qui participe à l\'événement et faites des rencontres',
            requiresAuth: true,
            backgroundImage: '/assets/images/feature/guests.png'
        },
        {
            id: 'photos',
            icon: 'fas fa-camera',
            title: 'Photos & Médias',
            description: 'Partagez et consultez les photos de l\'événement',
            requiresAuth: false,
            backgroundImage: '/assets/images/feature/photo.png'
        },
        {
            id: 'qr',
            icon: 'fas fa-qrcode',
            title: 'Mon QR Code',
            description: 'Accédez à votre QR Code personnel pour l\'événement',
            requiresAuth: true,
            backgroundImage: '/assets/images/feature/qr.png'
        }
    ];

    const featuresGrid = document.querySelector('.features-grid');
    if (!featuresGrid) return;

    featuresGrid.innerHTML = features.map(feature => {
        const isLocked = isAnonymous && feature.requiresAuth;
        const backgroundStyle = feature.backgroundImage ? `style="background-image: url('${feature.backgroundImage}')"` : '';
        
        return `
            <div class="feature-card ${isLocked ? 'feature-locked' : ''}" 
                 onclick="${isLocked ? 'showLockModal(this)' : `goToFeature('${feature.id}')`}"
                 data-feature-id="${feature.id}">
                ${feature.backgroundImage ? `<div class="feature-background" ${backgroundStyle}></div>` : ''}
                ${feature.backgroundImage ? '<div class="feature-overlay"></div>' : ''}
                <div class="feature-content">
                    ${isLocked ? '<div class="lock-indicator"><i class="fas fa-lock"></i></div>' : ''}
                    <div class="feature-icon">
                        <i class="${feature.icon}"></i>
                    </div>
                    <h3>${feature.title}</h3>
                    <p>${feature.description}</p>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Redirection vers les fonctionnalités avec vérification d'authentification
 */
function goToFeature(feature) {
    const features = {
        chat: '/welcome/event-chat.html',
        schedule: '/welcome/event-schedule.html',
        map: '/welcome/event-map.html',
        guests: '/welcome/event-guests.html',
        photos: '/welcome/event-photos.html',
        info: '/welcome/event-info.html',
        qr: '/welcome/my-qr.html',
        menu: '/welcome/event-menu.html'
    };
    
    // Vérifier si la fonctionnalité nécessite une authentification
    const authFeatures = ['chat', 'guests', 'photos', 'qr'];
    
    // Vérifier si on est en mode anonyme
    // On doit récupérer les données de session depuis updateFeatureCards
    // qui passe le bon paramètre isAnonymous
    // Pour maintenant, on peut aussi vérifier via une variable globale
    // ou on regarde si la carte est verrouillée
    
    const featureCard = document.querySelector(`[data-feature-id="${feature}"]`);
    const isLocked = featureCard?.classList?.contains('feature-locked');
    
    // Vérifier si on est en mode anonyme ET que la fonction nécessite auth
    if (isLocked && authFeatures.includes(feature)) {
        // Afficher le modal de cadenas
        showLockModal();
        return;
    }
    
    // Redirection normale
    if (features[feature]) {
        window.location.href = features[feature];
    } else {
        Swal.fire({
            icon: 'info',
            title: 'Bientôt disponible',
            text: 'Cette fonctionnalité sera disponible prochainement',
            confirmButtonColor: '#D97706'
        });
    }
}

/**
 * Fonction pour gérer la mise à jour de session avec un invité
 */
async function updateSessionWithGuest(guestData) {
    try {
        // Récupérer la session actuelle
        const session = await window.storage.getCurrentSessionDetails();
        if (!session?.success) {
            throw new Error('Session introuvable');
        }
        
        // Récupérer l'ID de table de la session actuelle
        const tableId = session.data.table?.id;
        if (!tableId) {
            throw new Error('Table non associée à la session');
        }
        
        // Mettre à jour la session avec l'invité
        const result = await window.storage.updateEventSessionWithGuest(tableId, guestData.guestId);
        
        if (result.success) {
            // Rafraîchir les données
            await checkAuthenticationState();
            await loadSessionData();
            
            showToast(`Bienvenue ${guestData.firstName || ''} ${guestData.lastName || ''} !`, 'success');
            
            return true;
        } else {
            throw new Error(result.error || 'Échec mise à jour session');
        }
        
    } catch (error) {
        console.error('Erreur mise à jour session:', error);
        showToast('Erreur lors de l\'identification', 'error');
        return false;
    }
}





       
       
        // Fonction pour gérer le code d'une autre table
        async function handleOtherTableCode(tableId, eventId) {
            const confirm = await Swal.fire({
                title: 'Table différente détectée',
                html: `
                    <div style="text-align: center; padding: 20px 0;">
                        <i class="fas fa-exchange-alt" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                        <p>Le code saisi correspond à une autre table.</p>
                        <p style="font-size: 0.9rem; opacity: 0.8; margin-top: 10px;">
                            Voulez-vous vous connecter à cette table ?
                        </p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Oui, changer de table',
                cancelButtonText: 'Non, rester ici',
                confirmButtonColor: '#D97706',
                cancelButtonColor: '#6B7280',
                reverseButtons: true
            });
            
            if (confirm.isConfirmed) {
                // Créer une nouvelle session pour la nouvelle table
                const sessionResult = await window.storage.createEventSession({
                    tableId: tableId,
                    eventId: eventId
                });
                
                if (sessionResult.success) {
                    // Recharger la page pour mettre à jour la session
                    window.location.reload();
                }
            }
        }

        
        

        // Fonction de déconnexion de l'événement
        async function logoutFromEvent() {
            const result = await Swal.fire({
                title: 'Quitter l\'événement ?',
                html: `
                    <div style="text-align: center; padding: 20px 0;">
                        <i class="fas fa-sign-out-alt" style="font-size: 4rem; color: var(--danger); margin-bottom: 15px;"></i>
                        <p>Vous serez déconnecté de l'événement</p>
                        <p style="font-size: 0.9rem; opacity: 0.7; margin-top: 10px;">
                            Vous pourrez vous reconnecter à tout moment
                        </p>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Oui, quitter',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#EF4444',
                cancelButtonColor: '#6B7280',
                reverseButtons: true
            });
            
            if (result.isConfirmed) {
                try {
                    // Afficher un loader pendant la déconnexion sécurisée
                    Swal.fire({
                        title: 'Déconnexion en cours...',
                        html: '<div class="inline-loader"></div>',
                        icon: 'info',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        showConfirmButton: false
                    });
                    
                    // Utiliser la méthode storage sécurisée de déconnexion (maintenant asynchrone)
                    if (window.storage && window.storage.clearEventSession) {
                        await window.storage.clearEventSession();
                    } else {
                        // Fallback si storage n'est pas disponible
                        localStorage.removeItem('secura_event_session_token');
                    }
                    
                    // Petite pause pour voir le message
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Rediriger vers la page d'accès
                    window.location.href = '../access.html';
                } catch (err) {
                    console.error('Erreur lors de la déconnexion:', err);
                    // Forcer la déconnexion même en cas d'erreur
                    localStorage.removeItem('secura_event_session_token');
                    window.location.href = '../access.html';
                }
            }
        }

        

    // ==========================================
// MODIFICATION DE LA NAVIGATION SIDEBAR
// ==========================================
function initSidebarNavigation() {
    const navItems = {
        navAccess: () => {
            if (isAnonymousAccess && sessionData) {
                Swal.fire({
                    title: 'Identification',
                    html: `
                        <div style="text-align: center; padding: 20px 0;">
                            <i class="fas fa-user-check" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                            <p>Vous êtes actuellement en mode anonyme.</p>
                            <p style="font-size: 0.9rem; color: var(--text-color); opacity: 0.8;">
                                Voulez-vous entrer votre code d'invitation pour être identifié ?
                            </p>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Entrer mon code',
                    cancelButtonText: 'Rester anonyme',
                    confirmButtonColor: '#D97706',
                    cancelButtonColor: '#6B7280',
                    width: 500
                }).then((result) => {
                    if (result.isConfirmed) {
                        showTicketCodeView();
                    }
                });
            } else {
                showMainAccessView();
            }
        },
        navInfo: () => {
            if (!validateSession()) return;
            window.location.href = './';
        },
        navProgram: () => {
            if (!validateSession()) return;
            window.location.href = './event-program.html';
        },
        navMap: () => {
            if (!validateSession()) return;
            window.location.href = './event-map.html';
        },
        navChat: () => {
            if (!validateSession()) return;
            window.location.href = './event-chat.html';
        },
        navGuests: () => {
            if (!validateSession()) return;
            window.location.href = './event-guests.html';
        },
        navPhotos: () => {
            if (!validateSession()) return;
            window.location.href = './event-photos.html';
        },
    };
    
    Object.keys(navItems).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                navItems[id]();
            });
        }
    });
}



    // ==========================================
    // CONTACT PROTOCOLE
    // ==========================================
    async function contactProtocolHandler(e) {
        e.preventDefault();

        const sessionResult = await window.storage.getCurrentSessionDetails();
        
        if (!sessionResult?.success || !sessionResult?.data) {
            // Token existe mais pas de session trouvée
            return;
        }

        console.log(sessionResult.data);

        const currentEvent = sessionResult.data.event;
        const currentGuest = sessionResult.data.guest;
        const currentTable = sessionResult.data.table;
        
        if (!currentEvent) {
            showToast('Aucun événement actif', 'warning');
            return;
        }
        
        try {
            let helpMessage = `[DEMANDE D'AIDE - SECURA]\n\n`;
            helpMessage += `Événement: ${currentEvent.name}\n`;
            helpMessage += `Date: ${new Date(currentEvent.date || Date.now()).toLocaleDateString('fr-FR')}\n`;
            
            if (currentGuest) {
                helpMessage += `Invité: ${currentGuest.firstName || ''} ${currentGuest.lastName || ''}\n`;
                if (currentGuest.phone) helpMessage += `Tél: ${currentGuest.phone}\n`;
            }
            
            if (currentTable) {
                helpMessage += `Table: ${currentTable.tableNumber}\n`;
                if (currentTable.location) helpMessage += `Emplacement: ${currentTable.location}\n`;
            }
            
            helpMessage += `\nProblème: Besoin d'assistance sur place\n`;
            helpMessage += `Localisation: Point d'accès principal\n`;
            helpMessage += `Heure: ${new Date().toLocaleTimeString('fr-FR')}`;
            
            Swal.fire({
                title: 'Contacter le protocole',
                html: `
                    <div style="text-align: center; padding: 20px 0;">
                        <i class="fas fa-headset" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                        <p>Un membre du protocole sera notifié de votre demande.</p>
                        <div style="background: var(--hover-bg); border-radius: 10px; padding: 15px; margin: 20px 0; text-align: left;">
                            <p style="margin-bottom: 10px;"><strong>Message envoyé:</strong></p>
                            <p style="font-size: 0.9rem; color: var(--text-color); opacity: 0.8;">${helpMessage.replace(/\n/g, '<br>')}</p>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-color); opacity: 0.7;">
                            Recherchez le personnel portant le logo Geekhub
                        </p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Envoyer la demande',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#D97706',
                cancelButtonColor: '#6B7280',
                width: 600
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await storage.requestProtocolHelp({
                            eventId: currentEvent.id,
                            guestId: currentGuest?.id,
                            tableId: currentTable?.id,
                            message: helpMessage,
                            timestamp: new Date().toISOString()
                        });
                        
                        if (response && response.success) {
                            showToast('Demande envoyée au protocole', 'success');
                            
                            Swal.fire({
                                title: 'Demande envoyée !',
                                html: `
                                    <div style="text-align: center; padding: 20px 0;">
                                        <i class="fas fa-check-circle" style="font-size: 4rem; color: var(--success); margin-bottom: 15px;"></i>
                                        <p>Le protocole a été notifié de votre demande.</p>
                                        <p style="font-size: 0.9rem; color: var(--text-color); opacity: 0.7; margin-top: 15px;">
                                            Un membre du personnel vous contactera sous peu.<br>
                                            Recherchez le logo Geekhub sur les tenues.
                                        </p>
                                    </div>
                                `,
                                confirmButtonColor: '#D97706',
                                timer: 3000,
                                showConfirmButton: false
                            });
                        } else {
                            showToast('Erreur lors de l\'envoi', 'error');
                        }
                    } catch (error) {
                        console.error('Erreur envoi demande:', error);
                        showToast('Message simulé envoyé (mode démo)', 'info');
                    }
                }
            });
            
        } catch (error) {
            console.error('Erreur contact protocole:', error);
            showToast('Erreur de contact', 'error');
        }
    }
    
 


// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
    try {

        const contactProtocol = document.getElementById('contactProtocol');
        if (contactProtocol) {
            contactProtocol.addEventListener('click', contactProtocolHandler);
        }
        
        // Navigation sidebar
        initSidebarNavigation();
        
    
        // Initialiser le modal de cadenas AVANT le chargement
        initLockModal();
        
        // Initialiser le modal mode anonyme
        initAnonymousStatusModal();
        
        // Vérifier l'état d'authentification
        await checkAuthenticationState();
        
        
        await loadSessionData();
     
        // Afficher le contenu principal
        setTimeout(() => {
            SECURA_AUDIO.play('notify');
            showToast('Bienvenue sur votre tableau de bord !', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        showToast('Erreur de chargement des données', 'error');
        
        // Basculer en mode anonyme
        await checkAuthenticationState();
    }
});


        // Fonction pour charger les données de session
        async function loadSessionData() {
            try {
                // Vérifier si une session existe
                const token = localStorage.getItem('secura_event_session_token');
                if (!token) {
                    window.location.href = '/';
                    throw new Error('Aucune session active');
                }

                // Récupérer les détails de la session via API
                const response = await fetch(`${window.storage.API_URL}/event-sessions/details`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        localStorage.removeItem('secura_event_session_token');
                        throw new Error('Session expirée');
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();


                
                if (result.success) {
                    // Stocker les données dans le storage
                    window.storage.currentSession = result.data;


                    await startCountdownTimer(result.data);
                    
                    // Mettre à jour l'interface
                    populateSessionHeader(result.data);  // Remplir le header session
                    populateDashboard(result.data);
                    checkDropdownPermissions(result.data);

                updateTimeRemaining(result.data.event);
                    
                
                     // Données basées sur les membres de table
                const present = result.data.stats?.present;
                const pending = result.data.stats?.pending;
                const total = present + pending;

                console.log('Statistiques de présence:', { present, pending, total });
                
                const progress = total > 0 ? Math.round((present / total) * 100) : 0;
                document.getElementById('eventProgress').textContent = `${progress}%`;
               
                
                
           
                    
                    // Charger les membres de la table
                    if (result.data.table && result.data.table.id) {
                        await loadTableMates(result.data.table.id);
                    }
                    
                    // Initialiser les graphiques
                 //   initializeCharts(result.data);
                    
                    return result.data;
                } else {
                    throw new Error(result.error || 'Erreur de session');
                }

            } catch (error) {
                console.error('Erreur chargement session:', error);
                throw error;
            }
        }

        // Fonction pour peupler le header session
        function populateSessionHeader(sessionData) {
            try {

                const guest = sessionData.guest;
                const table = sessionData.table;
                const event = sessionData.event;

                // Si pas d'invité, c'est le mode anonyme
                if (!guest) {
                    // Mettre à jour le header pour mode anonyme
                    const sessionAvatarSmall = document.getElementById('sessionAvatarSmall');
                    if (sessionAvatarSmall) {
                        sessionAvatarSmall.innerHTML = '<i class="fas fa-user-secret"></i>';
                        sessionAvatarSmall.style.background = 'var(--gradient)';
                    }

                    const sessionGuestName = document.getElementById('sessionGuestName');
                    if (sessionGuestName) {
                        sessionGuestName.textContent = 'Invité anonyme';
                    }

                    const sessionGuestTable = document.getElementById('sessionGuestTable');
                    if (sessionGuestTable) {
                        sessionGuestTable.textContent = 'Mode invité';
                    }

                      
                    const sessionEventName = document.getElementById('sessionEventName');
                    if (sessionEventName && event) {
                        sessionEventName.textContent = event.name || 'Événement';
                        sessionEventName.style.opacity = '0.8';
                        sessionEventName.style.fontSize = '0.65rem';
                        sessionEventName.title = event.name || 'Événement';
                    }

                    return;
                }

                const fullName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email;
                const initials = getInitials(fullName);
                const avatarImage = getGuestAvatarImage(guest);

                // === Mettre à jour le petit avatar du bouton dropdown ===
                const sessionAvatarSmall = document.getElementById('sessionAvatarSmall');
                if (sessionAvatarSmall) {
                    if (avatarImage) {
                        sessionAvatarSmall.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    } else {
                        sessionAvatarSmall.innerHTML = initials;
                        sessionAvatarSmall.style.background = 'var(--gradient)';
                    }
                }

                // === Mettre à jour le nom et table du bouton dropdown ===
                const sessionGuestName = document.getElementById('sessionGuestName');
                if (sessionGuestName) {
                    const firstName = guest.firstName || 'Invité';
                    sessionGuestName.textContent = fullName;
                }

                const sessionGuestTable = document.getElementById('sessionGuestTable');
                if (sessionGuestTable && table) {
                    sessionGuestTable.textContent = `Table ${table.tableNumber || table.tableName || 'N/A'}`;
                }

                // === Mettre à jour le grand avatar du menu dropdown ===
                const sessionAvatarLarge = document.getElementById('sessionAvatarLarge');
                if (sessionAvatarLarge) {
                    if (avatarImage) {
                        sessionAvatarLarge.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    } else {
                        sessionAvatarLarge.innerHTML = initials;
                        sessionAvatarLarge.style.background = 'var(--gradient)';
                    }
                }

                // === Mettre à jour les informations du menu dropdown ===
                const dropdownGuestName = document.getElementById('dropdownGuestName');
                if (dropdownGuestName) {
                    dropdownGuestName.textContent = fullName;
                }

                const dropdownGuestTable = document.getElementById('dropdownGuestTable');
                if (dropdownGuestTable && table) {
                    const tableInfo = table.tableName && table.tableName !== table.tableNumber 
                        ? `${table.tableName} ❖ Table ${table.tableNumber}`
                        : `Table ${table.tableNumber || table.tableName || 'N/A'}`;
                    dropdownGuestTable.textContent = tableInfo;
                }

                const dropdownEventName = document.getElementById('dropdownEventName');
                if (dropdownEventName) {
                    dropdownEventName.textContent = event.name || 'Événement';
                }

                // === Mettre à jour le nom d'événement dans le header ===
                
                const sessionEventName = document.getElementById('sessionEventName');
                
                if (sessionEventName && event) {
                    sessionEventName.textContent = event.name || 'Événement';
                    sessionEventName.style.opacity = '0.8';
                    sessionEventName.style.fontSize = '0.85rem';
                    sessionEventName.title = event.name || 'Événement';
                }

            } catch (error) {
                console.error('Erreur mise à jour header session:', error);
            }
        }

        // Fonction pour peupler le dashboard
        function populateDashboard(sessionData) {
            // Gérer l'affichage du modal mode anonyme
            const isAnonymous = sessionData?.table && !sessionData?.guest;
            const guestAvatar = document.getElementById('guestAvatar');
            const anonymousStatusModal = document.getElementById('anonymousStatusModal');
            
            // Ajouter la classe "anonymous-mode" à l'avatar si anonyme
            if (guestAvatar) {
                if (isAnonymous) {
                    guestAvatar.classList.add('anonymous-mode');
                } else {
                    guestAvatar.classList.remove('anonymous-mode');
                }
            }
           
            // Mettre à jour les informations de l'invité
            if (sessionData.guest) {
                const guest = sessionData.guest;
                const fullName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email;
                const initials = getInitials(fullName);
                
                // Avatar
                const avatarElement = document.getElementById('guestAvatar');
                const avatarImage = getGuestAvatarImage(guest);
                
                if (avatarElement) {
                    if (avatarImage) {
                        avatarElement.innerHTML = `<img src="${avatarImage}" alt="${escapeHtml(fullName)}">`;
                    } else {
                        avatarElement.textContent = initials;
                    }
                }
                
                // Titre de bienvenue - avec vérifications
                const welcomeTitle = document.getElementById('welcomeTitle');
                if (welcomeTitle) {
                    welcomeTitle.textContent = `Bienvenue, ${guest.firstName || ''} ${guest.lastName || ''}  !`;
                }
                
                const profileName = document.getElementById('profileName');
                if (profileName) {
                    profileName.textContent = fullName;
                }
                
                const dropdownName = document.getElementById('dropdownName');
                if (dropdownName) {
                    dropdownName.textContent = fullName;
                }
                
                const dropdownEmail = document.getElementById('dropdownEmail');
                if (dropdownEmail) {
                    dropdownEmail.textContent = guest.email || 'Non spécifié';
                }
                
                // Rôle
                const role = guest.type === 'vip' ? 'VIP' : 'Invité';
                
                const profileRole = document.getElementById('profileRole');
                if (profileRole) {
                    profileRole.textContent = role;
                }
                
                const dropdownRole = document.getElementById('dropdownRole');
                if (dropdownRole) {
                    dropdownRole.textContent = role;
                }
                
                // Sidebar - Profil identifié
                const sidebarAvatar = document.getElementById('sidebarAvatar');
                if (sidebarAvatar) {
                    sidebarAvatar.innerHTML = `<img src="${avatarImage || ''}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">`;
                }
                
                const guestWelcome = document.getElementById('guestWelcome');
                if (guestWelcome) {
                    guestWelcome.textContent = fullName;
                }
                
                const sidebarProfileEmail = document.getElementById('welcomesidebarProfileEmail');
                if (sidebarProfileEmail) {
                    sidebarProfileEmail.textContent = guest.email || guest.phone || 'Invité';
                }
                
                const sidebarProfileRole = document.getElementById('welcomesidebarProfileRole');
                if (sidebarProfileRole) {
                    sidebarProfileRole.textContent = role;
                }
                
                const profileStatusBadge = document.getElementById('profileStatusBadge');
                if (profileStatusBadge) {
                    profileStatusBadge.style.display = 'none';
                }
            }
            
            // Mettre à jour les informations de la table
            if (sessionData.table) {
                const table = sessionData.table;
                
                const tableName = document.getElementById('tableName');
                if (tableName) {
                    tableName.textContent = `Table ${table.tableNumber || 'Inconnue'}`;
                }
                
                if (table.tableName && table.tableName !== table.tableNumber) {
                    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
                    if (welcomeSubtitle) {
                        welcomeSubtitle.textContent = `Ravi de vous accueillir à "${table.tableName}"`;
                    }
                }
                
                // Sidebar - Infos table
                const sidebarTableNumber = document.getElementById('sidebarTableNumber');
                if (sidebarTableNumber) {
                    sidebarTableNumber.textContent = 
                        table.tableName ? `${table.tableName} (${table.tableNumber})` : `Table ${table.tableNumber || 'N/A'}`;
                }
            }
            
            // Mettre à jour les informations de l'événement
            if (sessionData.event) {
                const event = sessionData.event;
                
                // ===== NOUVEAU: Remplir la carte héroïque =====
                const eventName = document.getElementById('eventName');
                if (eventName) {
                    eventName.textContent = event.name || 'Événement';
                }
                
                const eventType = document.getElementById('eventType');
                if (eventType) {
                    eventType.textContent = getEventTypeLabel(event.type) || 'Événement';
                }
                
                // DateTime
                const eventDateTime = document.getElementById('eventDateTime');
                if (eventDateTime) {
                    eventDateTime.textContent = `${formatDate(event.date)} à ${event.time || 'Heure non spécifiée'}`;
                }
                
                // Location
                const eventLocation = document.getElementById('eventLocation');
                if (eventLocation) {
                    eventLocation.textContent = event.location || 'Non spécifié';
                }
                
                // Capacity
                const eventCapacity = document.getElementById('eventCapacity');
                if (eventCapacity) {
                    eventCapacity.textContent = `${event.capacity || 0} places`;
                }

                // Background image de l'événement
                const eventHeroBackground = document.getElementById('eventHeroBackground');
                if (eventHeroBackground && event.design?.backgroundImage) {
                    eventHeroBackground.style.backgroundImage = `url('${event.design.backgroundImage}')`;
                } else if (eventHeroBackground) {
                    // Background par défaut avec gradient
                    eventHeroBackground.style.background = 'var(--gradient)';
                }

                // Logo de l'événement
                const eventLogoContainer = document.getElementById('eventLogoContainer');
                if (eventLogoContainer) {
                    if (event.design?.logo) {
                        eventLogoContainer.innerHTML = `<img src="${event.design.logo}" alt="Logo événement" style="width: 100%; height: 100%; object-fit: cover;">`;
                    } else {
                        eventLogoContainer.innerHTML = `<div class="event-logo-placeholder"><i class="fas fa-calendar-check"></i></div>`;
                    }
                }
                
                // Métadonnées anciennes (si nécessaire)
                const eventMeta = document.getElementById('eventMeta');
                if (eventMeta) {
                    eventMeta.innerHTML = `
                        <div class="event-meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(event.date)} ${event.time || ''}</span>
                        </div>
                        <div class="event-meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${event.location || 'Non spécifié'}</span>
                        </div>
                        <div class="event-meta-item">
                            <i class="fas fa-users"></i>
                            <span>${event.capacity || 0} places</span>
                        </div>
                        <div class="event-meta-item">
                            <i class="fas fa-tag"></i>
                            <span>${getEventTypeLabel(event.type)}</span>
                        </div>
                    `;
                }
                
                // Date de l'événement
                const eventDate = document.getElementById('eventDate');
                if (eventDate) {
                    eventDate.textContent = 
                        `${formatDate(event.date)} • ${event.time || 'Heure non spécifiée'}`;
                }
            }
            
            // Mettre à jour le statut
            const eventStatus = document.getElementById('eventStatus');
            if (eventStatus) {
                eventStatus.textContent = 
                    sessionData.event?.status === 'active' ? 'Actif' : 'Inactif';
            }
        }

        // Fonction pour charger les membres de la table
        async function loadTableMates(tableId) {
            try {
                // Utiliser la méthode de storage.js pour récupérer les invités
                const guests = await window.storage.getTableGuests(tableId);
                
                if (guests && guests.length > 0) {
                    await renderTableMates(guests);
                } else {
                    await renderTableMates([]);
                }
            } catch (error) {
                console.error('Erreur chargement membres:', error);
                await renderTableMates([]);
            }
        }

        // Fonction pour afficher les membres de la table avec actions
        async function renderTableMates(guests) {
            const container = document.getElementById('tableMatesGrid');
            
            // Récupérer les données de session via la Promise
            let sessionData = null;
            let currentGuest = null;
            let isAnonymous = false;
            
            try {
                const sessionResult = await window.storage.getCurrentSessionDetails();
                // Vérifier si c'est une réponse avec { success, data } ou directement les données
                sessionData = sessionResult?.data || sessionResult;
                currentGuest = sessionData?.guest;
                isAnonymous = sessionData?.table && !currentGuest;
            } catch (error) {
                console.error('Erreur récupération session:', error);
                isAnonymous = false;
            }

            if (!guests || guests.length === 0) {
                // En mode anonyme, afficher des avatars d'équipe
                if (isAnonymous) {
                    // Créer des données fictives pour les avatars de l'équipe
                    const teamMembers = [
                        { id: 'team_1', firstName: 'Marc', lastName: 'Dupont', gender: 'male', type: 'standard' },
                        { id: 'team_2', firstName: 'Sophie', lastName: 'Martin', gender: 'female', type: 'standard' },
                        { id: 'team_3', firstName: 'Maman', lastName: 'Bernard', gender: 'maman', type: 'standard' },
                    ];
                    
                    const silhouettesHTML = teamMembers.map((member, index) => {
                        const avatarImage = getGuestAvatarImage(member);
                        const positionClasses = [
                            'male front',
                            'female back-left',
                            'male back-right',
                        ][index];
                        
                        return `
                            <div class="silhouette ${positionClasses}">
                                ${avatarImage ? 
                                    `<img src="${avatarImage}" alt="${member.firstName}">` : 
                                    `<div style="width: 100%; height: 100%; background: var(--gradient); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 2rem;">${member.firstName.charAt(0)}</div>`
                                }
                            </div>
                        `;
                    }).join('');
                    
                    container.innerHTML = `
                        <div class="empty-state team-silhouettes">
                            <div class="silhouettes-group">
                                ${silhouettesHTML}
                            </div>
                            <h3>Aucun invité assigné</h3>
                            <p>Aucun invité n'est assigné à cette table pour le moment</p>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-users-slash"></i>
                            <h3>Cette table est vide</h3>
                            <p>Aucun invité n'est assigné à cette table pour le moment</p>
                        </div>
                    `;
                }
                
                // Réinitialiser tous les compteurs
                const matesCountEl = document.getElementById('matesCount');
                if (matesCountEl) {
                    matesCountEl.style.display = 'none';
                    matesCountEl.textContent = '0';
                }
                document.getElementById('tableGuestsCount').textContent = '0';
                document.getElementById('presentGuestsCount').textContent = '0';
                document.getElementById('confirmedGuestsCount').textContent = '0';
                return;
            }
            
            let presentCount = 0;
            let confirmedCount = 0;
            
            const matesHTML = guests.map(item => {
                const guest = item.guest || item;

                if (!guest) return '';
                
                const isCurrentUser = currentGuest && guest.id === currentGuest.id;
                const fullName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || guest.email;
                const initials = getInitials(fullName);
                const avatarImage = getGuestAvatarImage(guest);
                const badgeType = guest.type === 'vip' ? 'warning' : 'secondary';
                
                // Compter les statuts
                if (guest.status === 'confirmed' || guest.status === 'checkedin') confirmedCount++;
                if (guest.scanned) presentCount++;
                
                // Actions
                let actionsHTML = '';
                if (!isCurrentUser) {
                    // Saluer
                    actionsHTML += `
                        <button class="mate-action-btn greet-btn" 
                                onclick="greetGuest('${escapeHtml(guest.id)}', '${escapeHtml(fullName)}')"
                                title="Saluer">
                            <i class="fas fa-hand-paper"></i>
                            <span class="action-label">Saluer</span>
                        </button>
                    `;
                    
                    // Chat (protégé en mode anonyme)
                    const chatDisabled = isAnonymous ? 'onclick="showLockModal()"' : `onclick="startChatWithGuest('${escapeHtml(guest.id)}', '${escapeHtml(fullName)}')"`;
                    const chatLock = isAnonymous ? '<span class="lock-indicator-mini"><i class="fas fa-lock"></i></span>' : '';
                    actionsHTML += `
                        <button class="mate-action-btn chat-btn ${isAnonymous ? 'disabled' : ''}" 
                                ${chatDisabled}
                                title="Chat ${isAnonymous ? '(Identifié requis)' : ''}">
                            <i class="fas fa-comment"></i>
                            <span class="action-label">Chat</span>
                            ${chatLock}
                        </button>
                    `;
                    
                    // Profil (public)
                    actionsHTML += `
                        <button class="mate-action-btn profile-btn" 
                                onclick="viewGuestProfile('${escapeHtml(guest.id)}', '${escapeHtml(fullName)}')"
                                title="Voir profil">
                            <i class="fas fa-user"></i>
                            <span class="action-label">Profil</span>
                        </button>
                    `;
                }
                
                return `
                    <div class="mate-card ${isCurrentUser ? 'current-user' : ''}">
                        <div class="mate-card-header">
                            <div class="mate-avatar ${isCurrentUser ? 'current-user' : ''}">
                                ${avatarImage ? 
                                    `<img src="${avatarImage}" alt="${escapeHtml(fullName)}">` : 
                                    initials}
                            </div>
                            <div class="mate-badges">
                                ${isCurrentUser ? '<span class="badge badge-primary">Vous</span>' : ''}
                                ${guest.type === 'vip' ? `<span class="badge badge-${badgeType}">VIP</span>` : ''}
                            </div>
                        </div>
                        
                        <div class="mate-info">
                            <div class="mate-name">${escapeHtml(fullName)}</div>
                            ${guest.notes ? 
                                `<div class="mate-company"><i class="fas fa-heart"></i> ${escapeHtml(guest.notes)}</div>` : ''}
                       
                            <div class="mate-status ${guest.scanned ? 'status-present' : 'status-pending'}">
                                <i class="fas fa-${guest.scanned ? 'check-circle' : 'clock'}"></i>
                                <span>${guest.scanned ? 'Présent' : 'En attente'}</span>
                            </div>
                        </div>
                        
                        <div class="mate-actions">
                            ${actionsHTML}
                        </div>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = matesHTML;
            
            // Mettre à jour les compteurs
            const totalGuests = guests.length;
            const matesCountEl = document.getElementById('matesCount');
            if (matesCountEl) {
                if (totalGuests > 0) {
                    matesCountEl.style.display = 'inline-block';
                    matesCountEl.textContent = `${totalGuests} membre(s)`;
                } else {
                    matesCountEl.style.display = 'none';
                }
            }
            document.getElementById('tableGuestsCount').textContent = totalGuests;
            document.getElementById('presentGuestsCount').textContent = presentCount;
            document.getElementById('confirmedGuestsCount').textContent = confirmedCount;
        }
        
        // Actions sur les invités
        function greetGuest(guestId, guestName) {
            Swal.fire({
                icon: 'success',
                title: `Salutations, ${guestName}!`,
                html: `
                    <div style="text-align: center; padding: 20px 0;">
                        <i class="fas fa-wave-hand" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                        <p style="margin-top: 10px;">Bienvenue à notre table ! 👋</p>
                    </div>
                `,
                confirmButtonText: 'Fermer',
                confirmButtonColor: '#D97706'
            });
        }
        
        function startChatWithGuest(guestId, guestName) {
            Swal.fire({
                icon: 'info',
                title: `Chat avec ${guestName}`,
                html: `
                    <div style="text-align: center; padding: 20px 0;">
                        <i class="fas fa-comments" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 15px;"></i>
                        <p>Fonctionnalité de chat : Bientôt disponible</p>
                        <small style="opacity: 0.7;">Vous pourrez discuter directement avec ${guestName}</small>
                    </div>
                `,
                confirmButtonText: 'OK',
                confirmButtonColor: '#D97706'
            });
        }
        
        function viewGuestProfile(guestId, guestName) {
            Swal.fire({
                icon: 'info',
                title: `Profil de ${guestName}`,
                html: `
                    <div style="text-align: center; padding: 20px 0;">
                        <i class="fas fa-user-circle" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 15px;"></i>
                        <p>Profil détaillé : Bientôt disponible</p>
                        <small style="opacity: 0.7;">Découvrez plus sur ${guestName}</small>
                    </div>
                `,
                confirmButtonText: 'OK',
                confirmButtonColor: '#D97706'
            });
        }



      /*  // Fonction pour initialiser les graphiques
        function initializeCharts(sessionData) {
                          // Graphique de présence
                const ctx = document.getElementById('attendanceChart');
                if (!ctx) return;
                
                // Créer un élément canvas si nécessaire
                if (typeof ctx.getContext !== 'function') {
                    ctx.innerHTML = '<canvas></canvas>';
                    chartCtx = ctx.querySelector('canvas').getContext('2d');
                } else {
                    chartCtx = ctx.getContext('2d');
                }
                
                // Données basées sur les membres de table
                const present = sessionData.stats?.present || 3;
                const pending = sessionData.stats?.pending || 2;
                const total = present + pending;
                
                // Calculer la progression
                const progress = total > 0 ? Math.round((present / total) * 100) : 0;
                document.getElementById('eventProgress').textContent = `${progress}%`;
                
                // Démarrer le compte à rebours animé (hero card)
                if (sessionData.event) {
                    startCountdownTimer(sessionData.event);
                }
                
                // Mettre à jour le temps restant (stat card ancienne)
                updateTimeRemaining(sessionData.event);
                
                new Chart(chartCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Présents', 'En attente'],
                        datasets: [{
                            data: [present, pending],
                            backgroundColor: [
                                'rgba(16, 185, 129, 0.8)',
                                'rgba(245, 158, 11, 0.8)'
                            ],
                            borderColor: [
                                'rgba(16, 185, 129, 1)',
                                'rgba(245, 158, 11, 1)'
                            ],
                            borderWidth: 2,
                            hoverOffset: 15
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#FFFFFF',
                                    font: {
                                        size: 12
                                    },
                                    padding: 20
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.raw || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = Math.round((value / total) * 100);
                                        return `${label}: ${value} personne${value > 1 ? 's' : ''} (${percentage}%)`;
                                    }
                                },
                                backgroundColor: '#FFFFFF',
                                titleColor: 'var(--text-color)',
                                bodyColor: 'var(--text-color)',
                                borderColor: 'var(--border-color)',
                                borderWidth: 1
                            }
                        },
                        cutout: '70%',
                        animation: {
                            animateScale: true,
                            animateRotate: true,
                            duration: 1000
                        }
                    }
                });
            }
            */

            // ==========================================
            // GESTION DU COMPTE À REBOURS (COUNTDOWN)
            // ==========================================
            let countdownInterval = null;
            let lastValues = {
                days: -1,
                hours: -1,
                minutes: -1,
                seconds: -1
            };

            async function startCountdownTimer(event) {
                // Arrêter le countdown précédent s'il existe
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                }

                if (!event || !event.date) {
                    return; // Pas d'événement ou pas de date
                }

                // Construire la date complète avec heure
                let eventDateString = event.date;
                if (event.time) {
                    eventDateString = `${event.date}T${event.time}`;
                }

                const eventDate = new Date(eventDateString);

                function updateCountdown() {
                    const now = new Date();
                    const diff = eventDate - now;

                    if (diff <= 0) {
                        // L'événement a commencé
                        document.querySelectorAll('.countdown-value').forEach(el => {
                            el.textContent = '00';
                        });
                        
                        const container = document.getElementById('countdownContainer');
                        if (container) {
                            container.innerHTML = `
                                <div style="text-align: center; width: 100%; padding: 5px;">
                                    <span style="font-size: 1rem; color: var(--success); font-weight: 700;">
                                        <i class="fas fa-check-circle"></i> L'événement a commencé !
                                    </span>
                                </div>
                            `;
                        }
                        clearInterval(countdownInterval);
                        return;
                    }

                    // Calcul du countdown
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                    // Mettre à jour avec animation si valeur change
                    updateCountdownValue('days', days, lastValues.days);
                    updateCountdownValue('hours', hours, lastValues.hours);
                    updateCountdownValue('minutes', minutes, lastValues.minutes);
                    updateCountdownValue('seconds', seconds, lastValues.seconds);

                    // Mettre à jour les valeurs de référence
                    lastValues = { days, hours, minutes, seconds };
                }

                // Mise à jour immédiate
                updateCountdown();

                // Mise à jour chaque seconde
                countdownInterval = setInterval(updateCountdown, 1000);
            }

            function updateCountdownValue(unit, newValue, oldValue) {
                // Utiliser les sélecteurs du countdown compact
                const element = document.querySelector(`.countdown-value-compact[data-unit="${unit}"]`);
                if (!element) return;

                const formattedValue = String(newValue).padStart(2, '0');

                // Vérifier si la valeur a changé
                if (newValue !== oldValue) {
                    // Ajouter l'animation de transition
                    element.classList.remove('flip-animate', 'slide-animate');
                    // Forcer le reflow pour redémarrer l'animation
                    void element.offsetWidth;
                    element.classList.add('flip-animate');

                    // Mettre à jour le texte après le début de l'animation
                    setTimeout(() => {
                        element.textContent = formattedValue;
                    }, 300);
                } else {
                    // Juste mettre à jour le texte sans animation
                    element.textContent = formattedValue;
                }
            }

            function updatePluralLabels(unit, value) {
                // Pas de pluriels à gérer avec le format compact (J, H, M, S)
            }

            // Fonction ancienne de mise à jour du temps (pour la stat-card eventTimeRemaining)
            function updateTimeRemaining(event) {
                if (!event || !event.date) {
                    document.getElementById('eventTimeRemaining').textContent = 'Durée inconnue';
                    return;
                }
                
                

                try {
                    const eventDate = new Date(event.date);
                    const now = new Date();
                    
                    if (eventDate > now) {
                        // Événement à venir
                        const diff = eventDate - now;
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));


                        
                        if (hours > 24) {

                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            
                            document.getElementById('eventTimeRemaining').textContent = 
                                `Commence dans ${days} jour${days > 1 ? 's' : ''}`;
                        } else if (hours > 0) {
                            document.getElementById('eventTimeRemaining').textContent = 
                                `Commence dans ${hours}h${minutes > 0 ? `${minutes}min` : ''}`;
                        } else {
                            document.getElementById('eventTimeRemaining').textContent = 
                                `Commence dans ${minutes} minutes`;
                        }
                    } else {
                        // Événement en cours ou terminé
                        const endTime = new Date(eventDate);
                        if (event.duration) {
                            endTime.setHours(endTime.getHours() + parseInt(event.duration) || 3);
                        } else {
                            endTime.setHours(endTime.getHours() + 3); // Durée par défaut
                        }
                        
                        if (endTime > now) {
                            // Événement en cours
                            const diff = endTime - now;
                            const hours = Math.floor(diff / (1000 * 60 * 60));
                            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                            
                            document.getElementById('eventTimeRemaining').textContent = 
                                `Termine dans ${hours}h${minutes > 0 ? `${minutes}min` : ''}`;
                        } else {
                            // Événement terminé
                            document.getElementById('eventTimeRemaining').textContent = 'Événement terminé';
                        }
                    }
                } catch (error) {
                    console.error('Erreur calcul temps:', error);
                    document.getElementById('eventTimeRemaining').textContent = 'Durée inconnue';
                }
            }

            // Fonction pour formater la date
            function formatDate(dateString) {
                if (!dateString) return 'Date non spécifiée';
                
                try {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } catch (error) {
                    return dateString;
                }
            }

            // Fonction pour obtenir le libellé du type d'événement
            function getEventTypeLabel(type) {
                const types = {
                    'conference': 'Conférence',
                    'seminar': 'Séminaire',
                    'workshop': 'Atelier',
                    'meeting': 'Réunion',
                    'networking': 'Networking',
                    'gala': 'Gala',
                    'wedding': 'Mariage',
                    'birthday': 'Anniversaire',
                    'corporate': 'Entreprise',
                    'other': 'Autre'
                };
                
                return types[type] || type || 'Événement';
            }

            // Rafraîchissement du compte à rebours lors de changement de session
            function handleSessionChange() {
                const sessionData = window.storage.currentSession;
                if (sessionData?.event) {
                    // Redémarrer le countdown avec les nouvelles données
                    startCountdownTimer(sessionData.event);
                }
            }

            // Démarrer le rafraîchissement du compte à rebours après initialisation
            setTimeout(() => {
                handleSessionChange();
            }, 1000);

            // Écouter les changements de session
            window.addEventListener('storage', function(event) {
                if (event.key === 'secura_event_session_token') {
                    if (!event.newValue) {
                        window.location.href = '../access.html';
                    } else {
                        loadSessionData();
                    }
                }
            });

            // Validation d'email
            function isValidEmail(email) {
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return re.test(email);
            }

            // Animation des cartes au défilement
            function animateCardsOnScroll() {
                const cards = document.querySelectorAll('.stat-card, .feature-card, .mate-card');
                
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                        }
                    });
                }, { threshold: 0.1 });
                
                cards.forEach(card => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    observer.observe(card);
                });
            }

            // Démarrer les animations au chargement
            setTimeout(animateCardsOnScroll, 1000);


            // Gestion du responsive
            function handleResponsive() {
                const header = document.querySelector('.dashboard-header');
                const statsGrid = document.querySelector('.stats-grid');
                //const featureGrid = document.que
                const matesGrid = document.getElementById('tableMatesGrid');
                
                if (window.innerWidth < 768) {
                    if (header) {
                        header.style.flexDirection = 'column';
                        header.style.gap = '15px';
                    }
                    
                    if (statsGrid) {
                        statsGrid.style.gridTemplateColumns = 'repeat(1, 1fr)';
                    }
                    
                    if (matesGrid) {
                        matesGrid.style.gridTemplateColumns = 'repeat(1, 1fr)';
                        matesGrid.style.gap = '12px';
                    }
                } else {
                    if (header) {
                        header.style.flexDirection = 'row';
                        header.style.gap = '0';
                    }
                    
                    if (statsGrid) {
                        statsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
                    }
                    
                    if (matesGrid) {
                        matesGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
                        matesGrid.style.gap = '20px';
                    }
                }
            }

            // Écouter le redimensionnement
            window.addEventListener('resize', handleResponsive);
            handleResponsive(); // Appel initial

            // Fonction pour partager l'événement
            function shareEvent() {
                if (navigator.share) {
                    const event = window.storage.currentSession?.event;
                    const guest = window.storage.currentSession?.guest;
                    
                    navigator.share({
                        title: event?.name || 'Événement SECURA',
                        text: `Je participe à ${event?.name || 'un événement'} avec SECURA !`,
                        url: window.location.href
                    }).then(() => {
                        showToast('Événement partagé avec succès !', 'success');
                    }).catch(error => {
                        console.log('Partage annulé:', error);
                    });
                } else {
                    // Fallback pour les navigateurs qui ne supportent pas l'API Web Share
                    Swal.fire({
                        title: 'Partager',
                        text: 'Copiez le lien pour partager',
                        input: 'text',
                        inputValue: window.location.href,
                        showCancelButton: true,
                        confirmButtonText: 'Copier',
                        cancelButtonText: 'Annuler'
                    }).then(result => {
                        if (result.isConfirmed) {
                            navigator.clipboard.writeText(window.location.href).then(() => {
                                showToast('Lien copié dans le presse-papier !', 'success');
                            });
                        }
                    });
                }
            }

            // Bouton de partage (à ajouter dans le header)
            const shareButton = document.createElement('button');
            shareButton.className = 'btn btn-secondary btn-sm';
            shareButton.innerHTML = '<i class="fas fa-share-alt"></i> Partager';
            shareButton.onclick = shareEvent;
            
            // Ajouter le bouton au header si l'API de partage est disponible
            if (navigator.share || navigator.clipboard) {
                const headerActions = document.querySelector('.header-actions');
                if (headerActions) {
                    headerActions.appendChild(shareButton);
                }
            }

            // Gestion de l'accessibilité
            document.addEventListener('keydown', function(event) {
                // Navigation au clavier dans les cartes de fonctionnalités
                if (event.key === 'Tab') {
                    const focusableCards = document.querySelectorAll('.feature-card');
                    const focused = document.activeElement;
                    
                    if (focused && focused.classList.contains('feature-card')) {
                        event.preventDefault();
                        
                        const currentIndex = Array.from(focusableCards).indexOf(focused);
                        let nextIndex;
                        
                        if (event.shiftKey) {
                            // Shift + Tab : aller à l'élément précédent
                            nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableCards.length - 1;
                        } else {
                            // Tab : aller à l'élément suivant
                            nextIndex = currentIndex < focusableCards.length - 1 ? currentIndex + 1 : 0;
                        }
                        
                        focusableCards[nextIndex].focus();
                        focusableCards[nextIndex].setAttribute('tabindex', '0');
                    }
                }
                
                // Espace ou Entrée pour activer les cartes
                if ((event.key === 'Enter' || event.key === ' ') && 
                    document.activeElement.classList.contains('feature-card')) {
                    event.preventDefault();
                    document.activeElement.click();
                }
            });

            // Amélioration de l'accessibilité des cartes
            const featureCards = document.querySelectorAll('.feature-card');
            featureCards.forEach((card, index) => {
                card.setAttribute('tabindex', index === 0 ? '0' : '-1');
                card.setAttribute('role', 'button');
                card.setAttribute('aria-label', card.querySelector('h3').textContent + '. ' + card.querySelector('p').textContent);
            });

            

            // Gestion de la connexion/réponse
            window.addEventListener('online', function() {
                showToast('Connecté à Internet', 'success');
                
                // Rafraîchir les données
                setTimeout(loadSessionData, 1000);
            });

            window.addEventListener('offline', function() {
                showToast('Mode hors ligne activé', 'warning');
            });

            // Initialiser les tooltips Bootstrap
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });

            // Animation de bienvenue
            setTimeout(() => {
                const welcomeTitle = document.querySelector('.welcome-title');
                if (welcomeTitle) {
                    welcomeTitle.style.animation = 'none';
                    setTimeout(() => {
                        welcomeTitle.style.animation = 'fadeIn 1s ease-out';
                    }, 10);
                }
            }, 2000);


            // Bouton Mes informations
            document.getElementById('viewInfoBtn')?.addEventListener('click', function() {
                const guest = window.storage.currentSession?.guest;
                const table = window.storage.currentSession?.table;
                
                if (!guest) {
                    showToast('Données indisponibles', 'error');
                    return;
                }

                const info = `
                    <div style="text-align: left; padding: 20px; border-radius: var(--border-radius-sm); background: var(--hover-bg);">
                        <div style="margin-bottom: 15px;">
                            <strong>Nom:</strong> ${escapeHtml(guest.firstName || '')} ${escapeHtml(guest.lastName || '')}<br>
                            <strong>Email:</strong> ${escapeHtml(guest.email || 'N/A')}<br>
                            <strong>Téléphone:</strong> ${escapeHtml(guest.phone || 'N/A')}<br>
                            <strong>Entreprise:</strong> ${escapeHtml(guest.company || 'N/A')}<br>
                            ${table ? `<strong>Table:</strong> ${escapeHtml(table.tableName || 'Table ' + table.tableNumber)}<br>` : ''}
                            <strong>Statut:</strong> <span style="color: var(--primary); font-weight: 600;">${guest.status === 'checked_in' || guest.scanned ? 'Présent' : 'En attente'}</span>
                        </div>
                    </div>
                `;

                Swal.fire({
                    title: 'Mes informations',
                    html: info,
                    icon: 'info',
                    confirmButtonColor: '#D97706',
                    confirmButtonText: 'Fermer'
                });
            });

            // Bouton Laisser un message
            document.getElementById('sendMessageBtn')?.addEventListener('click', function() {
                Swal.fire({
                    title: 'Laisser un message',
                    html: `
                        <div style="text-align: left;">
                            <p style="margin-bottom: 15px; opacity: 0.8;">
                                Vous avez une question ou un message pour l'équipe d'accueil ?
                            </p>
                            <textarea id="messageInput" class="form-control" placeholder="Votre message..." style="
                                background: var(--input-bg);
                                color: var(--input-text);
                                border: 1px solid var(--input-border);
                                padding: 10px;
                                border-radius: var(--border-radius-sm);
                                min-height: 120px;
                                resize: vertical;
                                font-family: 'Poppins', sans-serif;
                            " maxlength="500"></textarea>
                            <small style="display: block; margin-top: 8px; opacity: 0.6;">
                                <span id="charCount">0</span>/500 caractères
                            </small>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Envoyer',
                    cancelButtonText: 'Annuler',
                    confirmButtonColor: '#D97706',
                    cancelButtonColor: '#6B7280',
                    reverseButtons: true,
                    didOpen: () => {
                        const textarea = document.getElementById('messageInput');
                        const charCount = document.getElementById('charCount');
                        
                        textarea?.addEventListener('input', () => {
                            charCount.textContent = textarea.value.length;
                        });
                    },
                    preConfirm: () => {
                        const message = document.getElementById('messageInput')?.value;
                        if (!message?.trim()) {
                            Swal.showValidationMessage('Veuillez écrire un message');
                            return false;
                        }
                        return message;
                    }
                }).then(result => {
                    if (result.isConfirmed) {
                        showToast('Message envoyé avec succès !', 'success');
                    }
                });
            });

            // Bouton Actions rapides
            document.getElementById('quickActionsBtn')?.addEventListener('click', function() {
                const guest = window.storage.currentSession?.guest;
                const isIdentified = guest && guest.id;
                
                // Générer le HTML des actions en fonction du statut d'identification
                const actionsHtml = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align: left;">
                        <!-- Infos pratiques -->
                        <div class="quick-action-card" style="padding: 15px; background: var(--hover-bg); border-radius: var(--border-radius-sm); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'" onclick="
                            Swal.close();
                            window.location.href = '../event-info.html';
                        ">
                            <i class="fas fa-info-circle" style="color: var(--primary); margin-right: 8px; font-size: 1.2rem;"></i>
                            <strong>Infos pratiques</strong>
                            <p style="font-size: 0.8rem; margin-top: 5px; opacity: 0.7;">Horaires, lieu, accès</p>
                        </div>
                        
                        <!-- Liste invités -->
                        <div class="quick-action-card" style="padding: 15px; background: var(--hover-bg); border-radius: var(--border-radius-sm); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'" onclick="
                            Swal.close();
                            window.location.href = '../event-guests.html';
                        ">
                            <i class="fas fa-users" style="color: var(--primary); margin-right: 8px; font-size: 1.2rem;"></i>
                            <strong>Liste invités</strong>
                            <p style="font-size: 0.8rem; margin-top: 5px; opacity: 0.7;">Voir les participants</p>
                        </div>
                        
                        <!-- Mon QR Code -->
                        <div class="quick-action-card" style="padding: 15px; background: var(--hover-bg); border-radius: var(--border-radius-sm); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'" onclick="
                            Swal.close();
                            window.location.href = '../my-qr.html';
                        ">
                            <i class="fas fa-qrcode" style="color: var(--primary); margin-right: 8px; font-size: 1.2rem;"></i>
                            <strong>Mon QR Code</strong>
                            <p style="font-size: 0.8rem; margin-top: 5px; opacity: 0.7;">Afficher/Scanner</p>
                        </div>
                        
                        <!-- Support -->
                        <div class="quick-action-card" style="padding: 15px; background: var(--hover-bg); border-radius: var(--border-radius-sm); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'" onclick="
                            Swal.close();
                            contactProtocolHandler({preventDefault: () => {}});
                        ">
                            <i class="fas fa-headset" style="color: var(--primary); margin-right: 8px; font-size: 1.2rem;"></i>
                            <strong>Support</strong>
                            <p style="font-size: 0.8rem; margin-top: 5px; opacity: 0.7;">Contacter l'équipe</p>
                        </div>
                        
                        <!-- Retour à l'accueil -->
                        <div class="quick-action-card" style="padding: 15px; background: var(--hover-bg); border-radius: var(--border-radius-sm); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'" onclick="
                            Swal.close();
                            window.location.href = '../home.html';
                        ">
                            <i class="fas fa-home" style="color: var(--primary); margin-right: 8px; font-size: 1.2rem;"></i>
                            <strong>Accueil</strong>
                            <p style="font-size: 0.8rem; margin-top: 5px; opacity: 0.7;">Retour page d'accueil</p>
                        </div>
                        
                        <!-- Mon profil (si identifié) -->
                        ${isIdentified ? `
                        <div class="quick-action-card" style="padding: 15px; background: var(--hover-bg); border-radius: var(--border-radius-sm); cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'" onclick="
                            Swal.close();
                            document.getElementById('viewInfoBtn')?.click();
                        ">
                            <i class="fas fa-user-circle" style="color: var(--primary); margin-right: 8px; font-size: 1.2rem;"></i>
                            <strong>Mon profil</strong>
                            <p style="font-size: 0.8rem; margin-top: 5px; opacity: 0.7;">Mes informations</p>
                        </div>
                        ` : ''}
                    </div>
                `;
                
                Swal.fire({
                    title: 'Actions rapides',
                    html: actionsHtml,
                    icon: 'info',
                    showConfirmButton: false,
                    showCloseButton: true,
                    width: '600px',
                    didOpen: () => {
                        // Animation des éléments
                        document.querySelectorAll('.quick-action-card').forEach((el, idx) => {
                            el.style.animation = `fadeInUp 0.3s ease ${idx * 0.05}s forwards`;
                            el.style.opacity = '0';
                        });
                    }
                });
            });

            // ===== NOUVELLES: Fonction de mise à jour dynamique de la sidebar =====
            function updateSidebarSessionInfo(sessionData) {
                if (!sessionData) return;

                // Table info
                if (sessionData.table) {
                    const table = sessionData.table;
                    const tableText = table.tableName 
                        ? `${table.tableName} (${table.tableNumber || 'N/A'})`
                        : `Table ${table.tableNumber || 'N/A'}`;
                    const tableElement = document.getElementById('sidebarTableNumber');
                    if (tableElement) tableElement.textContent = tableText;

                    // Nombre d'invités
                    const guestsElement = document.getElementById('sidebarTableGuests');
                    if (guestsElement && table.guests) {
                        guestsElement.textContent = `${table.guests.length || 0} personne(s)`;
                    }
                }

                // Arrival time
                const arrivalElement = document.getElementById('sidebarArrivalTime');
                if (arrivalElement) {
                    if (sessionData.guest?.scanned) {
                        const scanTime = sessionData.guest.scanTime || new Date().toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                        arrivalElement.textContent = scanTime;
                        arrivalElement.style.color = 'var(--success)';
                    } else {
                        arrivalElement.textContent = 'Non scanné';
                        arrivalElement.style.color = 'var(--warning)';
                    }
                }

                // Access control indicators
                updateSidebarAccessControl(sessionData);
            }

            function updateSidebarAccessControl(sessionData) {
                const isAnonymous = sessionData?.table && !sessionData?.guest;
                const protectedLinks = document.querySelectorAll('[data-access="protected"]');
                const lockBadge = document.getElementById('lockIndicatorBadge');

                if (isAnonymous) {
                    // Afficher les indicateurs de cadenas
                    protectedLinks.forEach(link => {
                        const lockIcon = link.querySelector('.lock-indicator-small');
                        if (lockIcon) lockIcon.style.display = 'inline-flex';
                    });
                    if (lockBadge) lockBadge.style.display = 'inline-flex';
                } else {
                    // Masquer les indicateurs de cadenas
                    protectedLinks.forEach(link => {
                        const lockIcon = link.querySelector('.lock-indicator-small');
                        if (lockIcon) lockIcon.style.display = 'none';
                    });
                    if (lockBadge) lockBadge.style.display = 'none';
                }
            }
            
            // ===== Gestion des clics sur les liens sidebar avec restrictions =====
            function initSidebarLinks() {
                const protectedLinks = document.querySelectorAll('[data-access="protected"]');
                
                // Récupérer l'état de la session
                window.storage.getCurrentSessionDetails().then(session => {
                    if (!session?.success) return;
                    
                    const sessionData = session.data;
                    const isAnonymous = sessionData?.table && !sessionData?.guest;
                    
                    // Gestion des liens protégés
                    protectedLinks.forEach(link => {
                        link.addEventListener('click', (e) => {
                            if (isAnonymous) {
                                e.preventDefault();
                                showLockModal(link);
                                return false;
                            }
                        });
                    });
                }).catch(err => console.error('Erreur initialisation sidebar:', err));
            }
            
            // ===== Mise à jour du footer selon le mode =====
            function updateSidebarFooter(sessionData) {
                const footer = document.querySelector('.sidebar-footer');
                if (!footer) return;
                
                const isAnonymous = sessionData?.table && !sessionData?.guest;
                const hasMinimalSessionInfo = sessionData?.table?.tableNumber || sessionData?.table?.id;
                
                // Afficher/masquer le bouton de déconnexion selon la session active
                const logoutBtn = document.getElementById('sidebarLogout');
                if (logoutBtn) {
                    logoutBtn.style.display = hasMinimalSessionInfo ? 'flex' : 'none';
                }
            }
            
            // ===== GESTION DES PERMISSIONS DU DROPDOWN MENU =====
          async function checkDropdownPermissions(sessionData) {

                const isAnonymous = !sessionData?.guest || !sessionData.guest.id;
                
                // Configuration des permissions par type
                const permissions = {
                    view_info: {
                        allowed: !isAnonymous,
                        message: 'Identifiez-vous pour accéder à vos informations'
                    },
                    send_message: {
                        allowed: !isAnonymous,
                        message: 'Identifiez-vous pour laisser un message'
                    },
                    quick_actions: {
                        allowed: true, // Accessible même anonyme
                        message: 'Actions disponibles'
                    },
                    quit_session: {
                        allowed: true,
                        message: 'Quitter l\'événement'
                    }
                };
                
                // Appliquer les permissions à tous les boutons du dropdown
                document.querySelectorAll('[data-permission]').forEach(btn => {
                    const permission = btn.getAttribute('data-permission');
                    const perm = permissions[permission];
                    
                    if (!perm?.allowed) {
                        btn.setAttribute('data-disabled', 'true');
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            Swal.fire({
                                title: 'Accès restreint',
                                html: `
                                    <div style="text-align: center; padding: 20px 0;">
                                        <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 15px;"></i>
                                        <p>${perm.message}</p>
                                        <p style="font-size: 0.9rem; opacity: 0.7; margin-top: 10px;">
                                            Entrez votre code d'invitation pour bénéficier de toutes les fonctionnalités.
                                        </p>
                                    </div>
                                `,
                                icon: 'warning',
                                confirmButtonText: 'Fermer',
                                confirmButtonColor: '#D97706'
                            });
                        });
                    } else {
                        btn.removeAttribute('data-disabled');
                    }
                });
            }
            
            // Ajouter l'écouteur pour le bouton quitter
            document.getElementById('quitSessionBtn')?.addEventListener('click', function(e) {
                if (this.getAttribute('data-disabled') !== 'true') {
                    e.preventDefault();
                    logoutFromEvent();
                }
            });

            // Ajouter l'écouteur pour le bouton quitter
            document.querySelector('.quitSessionBtn')?.addEventListener('click', function(e) {
                if (this.getAttribute('data-disabled') !== 'true') {
                    e.preventDefault();
                    logoutFromEvent();
                }
            });


            
            // ===== Wrap de updateSidebarSessionInfo pour ajouter les nouvelles fonctionnalités =====
            const originalUpdateSidebarSessionInfo = updateSidebarSessionInfo;
            updateSidebarSessionInfo = function(sessionData) {
                originalUpdateSidebarSessionInfo(sessionData);
                updateSidebarFooter(sessionData);
                initSidebarLinks();
                checkDropdownPermissions(sessionData); // Vérifier les permissions après mise à jour
            };

            
          