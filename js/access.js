    // ==========================================
    // VARIABLES GLOBALES
    // ==========================================

    let currentGuest = null;
    let currentTable = null;
    let currentEvent = null;
    let currentMode = 'guest';
    let isAnonymousAccess = false;
    let accessStep = 1;
        
    // ==========================================
    // INITIALISATION - AVEC VÉRIFICATION COMPLÈTE
    // ==========================================
    document.addEventListener('DOMContentLoaded', async function() {
         
   
    
    
    const existingSession = await checkExistingSession();
    if (existingSession) {
        window.location.href = 'welcome/';
        return;
    }

    initUI();
    initEventListeners();
    
    // 3. Vérifier les paramètres URL
    const hasDirectAccess = await checkUrlParams();
    
    // 4. Si pas d'accès direct, continuer normalement
    if (!hasDirectAccess) {
        
                // REMETTRE L'OPACITÉ À NORMAL EN CAS D'ERREUR
                const content = document.getElementById('accessContent');
                if (content && content.dataset.urlParamOpacity === 'true') {
                    content.style.opacity = '1';
                    delete content.dataset.urlParamOpacity;
                }
    }
    
    await testCameraAvailability();
    
    if (isQRScannerSupported()) {
   
        initQRScanner();
    } else {
        console.warn('Scanner QR non supporté sur ce navigateur');
    }
    
    console.log('✅ Système d\'accès prêt avec toutes les ressources chargées');
    });





    // Mettre à jour les informations du billet
    function updateTicketInfo() {
        const guestInfoDiv = document.getElementById('ticketGuestInfo');
        if (guestInfoDiv && currentGuest) {
            guestInfoDiv.innerHTML = `
                <p><strong>Nom:</strong> ${escapeHtml(currentGuest.firstName || '')} ${escapeHtml(currentGuest.lastName || '')}</p>
                ${currentGuest.email ? `<p><strong>Email:</strong> ${escapeHtml(currentGuest.email)}</p>` : ''}
                ${currentGuest.phone ? `<p><strong>Téléphone:</strong> ${escapeHtml(currentGuest.phone)}</p>` : ''}
                ${currentEvent ? `<p><strong>Événement:</strong> ${escapeHtml(currentEvent.name)}</p>` : ''}
                ${currentGuest.tableId ? `<p><strong>Table assignée:</strong> ${escapeHtml(currentGuest.tableId)}</p>` : ''}
            `;
        }
    }

    // Fonction d'impression du billet
    function printTicket() {
        const printContent = document.querySelector('.ticket-preview').cloneNode(true);
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Billet d'invitation - ${currentEvent ? currentEvent.name : 'SECURA'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .ticket-preview { max-width: 800px; margin: 0 auto; }
                    .ticket-header { background: linear-gradient(135deg, #B45309 0%, #D97706 50%, #F59E0B 100%); 
                                    padding: 20px; color: white; text-align: center; }
                    .ticket-body { padding: 20px; }
                    .code-display { font-size: 2rem; letter-spacing: 5px; font-weight: bold; 
                                  text-align: center; background: #f8f9fa; padding: 10px; 
                                  margin: 10px 0; border-radius: 5px; }
                    @media print {
                        body { margin: 0; }
                        .ticket-preview { border: 2px solid #000; }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
    
    // ==========================================
    // FONCTIONS UTILITAIRES
    // ==========================================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function showToast(message, type = 'success') {
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };

        
    }
    
    function updateProgressStep(step) {
        const steps = document.querySelectorAll('.progress-step');
        steps.forEach((s, i) => {
            s.classList.remove('active', 'completed');
            if (i < step) s.classList.add('completed');
            if (i === step) s.classList.add('active');
        });
    }
    
    // ==========================================
    // VÉRIFICATION DES PARAMÈTRES URL
    // ==========================================
    async function checkUrlParams() {
    try {
        const { guestId, tableId, eventId } = window.urlParams || {};
        
        console.log("🔍 Vérification URL:", { guestId, tableId, eventId });

        if (guestId) {
            console.log('🎫 Accès direct invité détecté');
            
            try {
                const guestData = await window.storage.getGuestById(guestId);
                if (!guestData) throw new Error('Invité non trouvé');
                
                currentGuest = guestData;
                
                if (guestData.eventId) {
                    currentEvent = await window.storage.getEventById(guestData.eventId);
                } else if (eventId) {
                    currentEvent = await window.storage.getEventById(eventId);
                }
                
                // Récupérer la table si assignée
                if (guestData.tableId) {
                    currentTable = await window.storage.getTableById(guestData.tableId);
                }

                const content = document.getElementById('accessContent');
                if (content && content.dataset.urlParamOpacity === 'true') {
                    content.style.opacity = '1';
                    delete content.dataset.urlParamOpacity;
                }
                
                showImmediateConfirmation('guest');
                return true;
                
            } catch (error) {
                console.error('❌ Erreur accès direct invité:', error);
                // REMETTRE L'OPACITÉ À NORMAL EN CAS D'ERREUR
                const content = document.getElementById('accessContent');
                if (content && content.dataset.urlParamOpacity === 'true') {
                    content.style.opacity = '1';
                    delete content.dataset.urlParamOpacity;
                }
                showToast('Invitation non valide', 'error');
                return false;
            }
        }
        
        if (tableId) {
            console.log('🏓 Accès direct table détecté');
            
            try {
                const tableData = await window.storage.getTableById(tableId);
                if (!tableData) throw new Error('Table non trouvée');
                
                currentTable = tableData;
                
                if (tableData.eventId) {
                    currentEvent = await window.storage.getEventById(tableData.eventId);
                } else if (eventId) {
                    currentEvent = await window.storage.getEventById(eventId);
                }
                
                // REMETTRE L'OPACITÉ À NORMAL EN CAS D'ERREUR
                const content = document.getElementById('accessContent');
                if (content && content.dataset.urlParamOpacity === 'true') {
                    content.style.opacity = '1';
                    delete content.dataset.urlParamOpacity;
                }

                isAnonymousAccess = true;
                //showImmediateConfirmation('table');
                showTicketCodeView();
                return true;
                
            } catch (error) {
                console.error('❌ Erreur accès direct table:', error);
                // REMETTRE L'OPACITÉ À NORMAL EN CAS D'ERREUR
                const content = document.getElementById('accessContent');
                if (content && content.dataset.urlParamOpacity === 'true') {
                    content.style.opacity = '1';
                    delete content.dataset.urlParamOpacity;
                }
                showToast('Table non valide', 'error');
                return false;
            }
        }
        
                // REMETTRE L'OPACITÉ À NORMAL EN CAS D'ERREUR
                const content = document.getElementById('accessContent');
                if (content && content.dataset.urlParamOpacity === 'true') {
                    content.style.opacity = '1';
                    delete content.dataset.urlParamOpacity;
                }

        return false;
        
    } catch (error) {
        console.error('Erreur checkUrlParams:', error);
        // REMETTRE L'OPACITÉ À NORMAL EN CAS D'ERREUR
                const content = document.getElementById('accessContent');
                if (content && content.dataset.urlParamOpacity === 'true') {
                    content.style.opacity = '1';
                    delete content.dataset.urlParamOpacity;
                }
        return false;
    }
}

async function showImmediateConfirmation(type) {
    try {
        // Cacher tout le contenu d'accès
        document.getElementById('accessMainView').classList.add('hidden');
        document.getElementById('ticketCodeView').classList.add('hidden');
        
        // Afficher juste la confirmation (SANS créer la session)
        showConfirmationViewOnly();
        
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        showToast('Accès confirmé - Cliquez sur "Continuer"', 'success');
        
    } catch (error) {
        console.error('Erreur confirmation immédiate:', error);
        showToast('Erreur lors de l\'accès', 'error');
        showMainAccessView();
    }
}

    // ==========================================
    // INITIALISATION DE L'INTERFACE
    // ==========================================
    
    function initUI() {
    try {
        initCodeInputs();
        updateModeUI();
        resetValidationStates();

        updateSkipButtonVisibility();
        
        // Focus sur premier champ
        setTimeout(() => {
            const firstInput = document.querySelector('.code-input[data-index="0"]');
            if (firstInput) firstInput.focus();
        }, 300);
        
    } catch (error) {
        console.error('Erreur initUI:', error);
    }
}



    // Ajoutez cette fonction utilitaire
function showErrorOnInputs(selector = null) {
    let inputs = [];
    
    if (selector) {
        inputs = document.querySelectorAll(selector);
    } else if (currentMode === 'guest') {
        inputs = document.querySelectorAll('#guestForm .code-input');
    } else if (currentMode === 'table') {
        inputs = document.querySelectorAll('#tableForm .code-input');
    }
    
    inputs.forEach(input => {
        // Ajouter la classe d'erreur
        input.classList.add('error');
        
        // Ajouter une animation de shake
        input.style.animation = 'shake 0.5s ease';
        
        // Retirer l'animation après son exécution
        setTimeout(() => {
            input.style.animation = '';
        }, 500);
    });
    
    // Vider les champs après un court délai pour l'effet visuel
    setTimeout(() => {
        clearCodeInputs(selector);
    }, 800);
}

// Version avec effet visuel sur le premier champ
function clearCodeInputsWithError(selector = null) {
    let inputs = [];
    let firstInput = null;
    
    if (selector) {
        inputs = Array.from(document.querySelectorAll(selector));
    } else if (currentMode === 'guest') {
        inputs = Array.from(document.querySelectorAll('#guestForm .code-input'));
    } else if (currentMode === 'table') {
        inputs = Array.from(document.querySelectorAll('#tableForm .code-input'));
    }
    
    if (inputs.length === 0) return;
    
    inputs.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
    firstInput = inputs[0];

    inputs.forEach((input, index) => {
        setTimeout(() => {
            input.classList.add('error');
            input.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                input.value = '';
                input.classList.remove('filled');
                input.style.transform = 'scale(1)';
                
                // Pour le dernier champ, préparer le focus
                if (index === inputs.length - 1) {
                    setTimeout(() => {
                        inputs.forEach(inp => inp.classList.remove('error'));
                        
                        // Effet de pulsation sur le premier champ
                        if (firstInput) {
                            firstInput.classList.add('pulse');
                            firstInput.focus();
                            
                            // Retirer l'effet pulse après 1 seconde
                            setTimeout(() => {
                                firstInput.classList.remove('pulse');
                            }, 1000);
                        }
                        
                        updateCodeInputState();
                    }, 200);
                }
            }, 200);
        }, index * 80);
    });
}


    // Mettre à jour la visibilité du bouton "Passer"
    function updateSkipButtonVisibility() {
        const skipBtn = document.getElementById('skipTicketCodeBtn');
        if (!skipBtn) return;
        
        const code = getCodeFromInputs('.ticket-code');
        const allEmpty = code.split('').every(c => c === '');
        
        if (allEmpty) {
            skipBtn.style.display = 'block';
            skipBtn.innerHTML = '<i class="fas fa-forward"></i><span>Passer cette étape</span>';
        } else {
            skipBtn.style.display = 'none';
        }
    }
    
    // Réinitialiser les états de validation
    function resetValidationStates() {
        hideFormMessage('guest');
        hideFormMessage('table');
        
        document.querySelectorAll('.code-input').forEach(input => {
            input.classList.remove('filled', 'highlight', 'error');
        });
        
       
        
        if (document.getElementById('ticketCodeView') && 
            !document.getElementById('ticketCodeView').classList.contains('hidden')) {
            updateSkipButtonVisibility();
        }
    }
    
    // ==========================================
    // GESTION DES CHAMPS DE CODE
    // ==========================================

function initCodeInputs() {
    const codeInputs = document.querySelectorAll('.code-input');
    
    codeInputs.forEach(input => {
        // Lien d'aide pour les codes billet
        if (input.classList.contains('ticket-code')) {
            const ticketView = document.getElementById('ticketCodeView');
            const helpLink = ticketView.querySelector('.ticket-help-link');
            if (helpLink) {
                helpLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    const helpModal = document.getElementById('helpModal');
                    helpModal.classList.add('active');
                    document.querySelectorAll('.help-toggle-btn').forEach(btn => btn.classList.remove('active'));
                    const codesBtn = document.querySelector('.help-toggle-btn[data-view="codes"]');
                    if (codesBtn) codesBtn.classList.add('active');
                    document.querySelectorAll('.help-view').forEach(v => v.classList.remove('active'));
                    const codesView = document.getElementById('helpViewCodes');
                    if (codesView) codesView.classList.add('active');
                });
            }
        }
        
        // Focus: vérifier les champs précédents - CORRIGÉ POUR TABLE CODE
        input.addEventListener('focus', function() {
            const currentIndex = parseInt(this.dataset.index);
            const isTableCode = this.classList.contains('table-code');
            const form = this.closest('.access-form') || document;
            const selector = form instanceof Document ? '.code-input' : '.code-input:not(.personal-code)';
            const inputs = Array.from(form.querySelectorAll(selector)).sort((a,b) => parseInt(a.dataset.index)-parseInt(b.dataset.index));

            // Pour le code table, ne pas forcer le focus si c'est le dernier champ rempli
            if (isTableCode && currentIndex >= 2) {
                // C'est un des derniers champs numériques du code table
                // Laisser le focus naturel, ne pas le forcer
                return;
            }

            // CORRECTION: Chercher le premier champ vide
            for (let i = 0; i < inputs.length; i++) {
                if (!inputs[i].value || inputs[i].value.length === 0) {
                    inputs[i].focus();
                    return;
                }
            }
            
            // Si tous sont remplis, focus sur le dernier
            if (inputs.length > 0) {
                inputs[inputs.length - 1].focus();
            }
        });
        
        // Saisie de caractères - VERSION CORRIGÉE
        input.addEventListener('input', function(e) {
            let value = (this.value || '').toUpperCase();
            const isTableCode = this.classList.contains('table-code');
            const isTicketCode = this.classList.contains('ticket-code');
            const index = parseInt(this.dataset.index);
            
            // Validation selon le type d'input
            if (isTableCode) {
                if (index < 2) {
                    value = value.replace(/[^A-Z]/g, '');
                } else {
                    value = value.replace(/[^0-9]/g, '');
                }
            } else {
                if (!/^[A-Z0-9]$/.test(value)) {
                    value = '';
                }
            }
            
            this.value = value;
            
            // Mettre à jour l'état visuel
            if (value.length === 1) {
                this.classList.add('filled');
            } else {
                this.classList.remove('filled');
            }
            
            // Pour les codes billet, mettre à jour le bouton "Passer"
            if (isTicketCode) {
                updateSkipButtonVisibility();
            }
            
            // Navigation automatique CORRIGÉE
            if (value.length === 1) {
                const currentIndex = parseInt(this.dataset.index);
                let nextInput = null;
                
                // Trouver le prochain champ
                if (isTicketCode) {
                    const ticketInputs = Array.from(document.querySelectorAll('.ticket-code'));
                    nextInput = ticketInputs.find(inp => parseInt(inp.dataset.index) === currentIndex + 1);
                } else {
                    const form = this.closest('.access-form');
                    if (form) {
                        const inputs = Array.from(form.querySelectorAll('.code-input:not(.ticket-code)'));
                        nextInput = inputs.find(inp => parseInt(inp.dataset.index) === currentIndex + 1);
                    }
                }
                
                if (nextInput) {
                    // Petite pause avant de focus le prochain champ
                    setTimeout(() => {
                        nextInput.focus();
                    }, 10);
                } else {
                    // Dernier champ rempli - validation immédiate
                    setTimeout(() => {
                        if (isTicketCode) {
                            const code = getCodeFromInputs('.ticket-code');
                            if (code.length === 4) {
                                validateTicketCode();
                            }
                        } else {
                            const code = getCodeFromInputs();
                            const isTableMode = currentMode === 'table';
                            const requiredLength = isTableMode ? 5 : 4;
                            
                            if (code.length === requiredLength && 
                                (!isTableMode || code.includes('-'))) {
                                
                                if (currentMode === 'guest') {
                                    validateGuestAccess();
                                } else if (currentMode === 'table') {
                                    validateTableAccess();
                                }
                            }
                        }
                    }, 50);
                }
            }
            
            updateCodeInputState();
        });
        
        // Gestion des touches - VERSION CORRIGÉE
        input.addEventListener('keydown', function(e) {
            const currentIndex = parseInt(this.dataset.index);
            const isTicketCode = this.classList.contains('ticket-code');
            
            switch(e.key) {
                case 'Backspace':
                    e.preventDefault();
                    
                    if (this.value.length > 0) {
                        this.value = '';
                        this.classList.remove('filled');
                    } else {
                        // Trouver le champ précédent
                        let prevInput = null;
                        
                        if (isTicketCode) {
                            const ticketInputs = Array.from(document.querySelectorAll('.ticket-code'));
                            prevInput = ticketInputs.find(inp => parseInt(inp.dataset.index) === currentIndex - 1);
                        } else {
                            const form = this.closest('.access-form');
                            if (form) {
                                const inputs = Array.from(form.querySelectorAll('.code-input:not(.ticket-code)'));
                                prevInput = inputs.find(inp => parseInt(inp.dataset.index) === currentIndex - 1);
                            }
                        }
                        
                        if (prevInput) {
                            prevInput.focus();
                            prevInput.value = '';
                            prevInput.classList.remove('filled');
                            
                            // IMPORTANT: Focus reste sur le champ précédent
                            setTimeout(() => {
                                prevInput.focus();
                            }, 10);
                        }
                    }
                    
                    if (isTicketCode) {
                        setTimeout(updateSkipButtonVisibility, 10);
                    }
                    
                    updateCodeInputState();
                    break;
                    
                case 'ArrowLeft':
                    e.preventDefault();
                    navigateToInput(this, -1);
                    break;
                    
                case 'ArrowRight':
                    e.preventDefault();
                    navigateToInput(this, 1);
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    handleEnterKey(this);
                    break;
                    
                case ' ':
                    e.preventDefault();
                    break;
                    
                case 'Tab':
                    // Laisser le comportement par défaut pour Tab
                    break;
                    
                default:
                    if (!/^[A-Za-z0-9]$/.test(e.key) && 
                        !['Backspace', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', ' '].includes(e.key)) {
                        e.preventDefault();
                    }
            }
        });
        
        // Collage de code
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
            const isTicketCode = this.classList.contains('ticket-code');
            
            if (pastedData) {
                let inputs = [];
                
                if (isTicketCode) {
                    inputs = Array.from(document.querySelectorAll('.ticket-code'));
                } else {
                    const form = this.closest('.access-form');
                    if (form) {
                        inputs = Array.from(form.querySelectorAll('.code-input:not(.ticket-code)'));
                    }
                }
                
                if (inputs.length === 0) return;
                
                // Trier par index
                inputs.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
                
                // Trouver le premier champ vide
                let startIndex = 0;
                for (let i = 0; i < inputs.length; i++) {
                    if (!inputs[i].value || inputs[i].value.length === 0) {
                        startIndex = i;
                        break;
                    }
                }

                // Remplir les champs
                for (let i = 0; i < pastedData.length && (startIndex + i) < inputs.length; i++) {
                    inputs[startIndex + i].value = pastedData[i];
                    inputs[startIndex + i].classList.add('filled');
                }

                // Focus sur le dernier champ rempli
                const lastFilledIndex = Math.min(startIndex + pastedData.length - 1, inputs.length - 1);
                setTimeout(() => {
                    if (lastFilledIndex < inputs.length - 1) {
                        inputs[lastFilledIndex + 1].focus();
                    } else {
                        inputs[lastFilledIndex].focus();
                    }
                }, 10);

                updateCodeInputState();
                
                if (isTicketCode) {
                    setTimeout(updateSkipButtonVisibility, 10);
                    setTimeout(() => {
                        const code = getCodeFromInputs('.ticket-code');
                        if (code.length === 4) {
                            validateTicketCode();
                        }
                    }, 100);
                }
            }
        });
    });
}
    // Navigation entre les champs
    function navigateToInput(currentInput, direction) {
        const currentIndex = parseInt(currentInput.dataset.index);
        const isTicketCode = currentInput.classList.contains('ticket-code');
        let targetInput = null;
        
        if (isTicketCode) {
            const ticketInputs = Array.from(document.querySelectorAll('.ticket-code'));
            targetInput = ticketInputs.find(inp => parseInt(inp.dataset.index) === currentIndex + direction);
        } else {
            const form = currentInput.closest('.access-form');
            if (form) {
                const inputs = Array.from(form.querySelectorAll('.code-input:not(.ticket-code)'));
                targetInput = inputs.find(inp => parseInt(inp.dataset.index) === currentIndex + direction);
            }
        }
        
        if (targetInput) targetInput.focus();
    }
    
    // Gestion de la touche Enter
    function handleEnterKey(input) {
        const isTicketCode = input.classList.contains('ticket-code');
        
        if (isTicketCode) {
            const code = getCodeFromInputs('.ticket-code');
            if (code.length === 4) {
                validateTicketCode();
            } else {
                showFormMessage('error', 'Code incomplet (4 caractères requis)', 'guest');
                showToast('Code incomplet', 'error');
                updateSkipButtonVisibility();
            }
        } else {
            const code = getCodeFromInputs();
            const isTableMode = currentMode === 'table';
            const requiredLength = isTableMode ? 5 : 4;
            
            if (code.length === requiredLength && (!isTableMode || code.includes('-'))) {
                if (currentMode === 'guest') {
                    validateGuestAccess();
                } else if (currentMode === 'table') {
                    validateTableAccess();
                }
            } else {
                showFormMessage('error', `Code incomplet (${isTableMode ? 'XX-YY requis' : '4 caractères requis'})`, currentMode);
                showToast(`Code incomplet (${isTableMode ? 'XX-YY requis' : '4 caractères requis'})`, 'error');
            }
        }
    }
    
    // Mettre à jour l'état visuel des champs
    function updateCodeInputState() {
        let inputs = [];
        
        if (accessStep === 2) {
            inputs = Array.from(document.querySelectorAll('.ticket-code'));
        } else if (currentMode === 'table') {
            const tableForm = document.getElementById('tableForm');
            inputs = tableForm ? Array.from(tableForm.querySelectorAll('.code-input')) : [];
        } else if (currentMode === 'guest') {
            const guestForm = document.getElementById('guestForm');
            inputs = guestForm ? Array.from(guestForm.querySelectorAll('.code-input')) : [];
        } else {
            inputs = Array.from(document.querySelectorAll('.code-input'));
        }

        inputs.forEach(input => {
            if (input.value.length === 1) {
                input.classList.add('filled');
            } else {
                input.classList.remove('filled');
            }
        });
    }
    
    function updateModeUI() {
    document.querySelectorAll('.access-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === currentMode) {
            btn.classList.add('active');
        }
    });
    
    document.getElementById('guestForm').style.display = currentMode === 'guest' ? 'block' : 'none';
    document.getElementById('tableForm').style.display = currentMode === 'table' ? 'block' : 'none';
    document.getElementById('scanView').style.display = currentMode === 'scan' ? 'block' : 'none';
    
    document.getElementById('guestFormMessage').style.display = 'none';
    document.getElementById('tableFormMessage').style.display = 'none';
    document.getElementById('ticketFormMessage').style.display = 'none';
    
    updateFormTitle();
    
    if (currentMode !== 'scan') {
        clearCodeInputs();
    }
}

    // Mettre à jour le titre du formulaire
    // Mettre à jour le titre du formulaire
    function updateFormTitle() {
        const titleEl = document.getElementById('accessFormTitle');
        const subtitleEl = document.getElementById('accessFormSubtitle');
        
        if (currentMode === 'guest') {
            titleEl.textContent = 'Accès en tant qu\'invité';
            subtitleEl.textContent = 'Entrez votre code d\'invité pour accéder à l\'événement';
        } else if (currentMode === 'table') {
            titleEl.textContent = 'Accès à votre table';
            subtitleEl.textContent = 'Entrez le code de votre table pour afficher les informations';
        } else if (currentMode === 'scan') {
            titleEl.textContent = 'Scanner QR Code';
            subtitleEl.textContent = 'Scannez le QR Code de votre invitation ou de la table';
        }
    }
    
    // Vider les champs de code
    function clearCodeInputs(selector = null) {
        let codeInputs = [];
        
        if (selector) {
            codeInputs = document.querySelectorAll(selector);
        } else {
            if (currentMode === 'guest') {
                const guestForm = document.getElementById('guestForm');
                if (guestForm) {
                    codeInputs = guestForm.querySelectorAll('.code-input');
                }
            } else if (currentMode === 'table') {
                const tableForm = document.getElementById('tableForm');
                if (tableForm) {
                    codeInputs = tableForm.querySelectorAll('.code-input');
                   
                }
            }
        }
        
        codeInputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled');
        });
        updateCodeInputState();
    }
    
    // Récupérer le code saisi
    function getCodeFromInputs(selector = null) {
        let codeInputs = [];
        let isTableCode = false;
        
        if (selector) {
            codeInputs = Array.from(document.querySelectorAll(selector));
        } else {
            if (currentMode === 'guest') {
                const guestForm = document.getElementById('guestForm');
                if (guestForm) {
                    codeInputs = Array.from(guestForm.querySelectorAll('.code-input'));
                }
            } else if (currentMode === 'table') {
                const tableForm = document.getElementById('tableForm');
                if (tableForm) {
                    codeInputs = Array.from(tableForm.querySelectorAll('.code-input'));
                    isTableCode = true;
                }
            }
        }
        
        codeInputs.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
        let code = '';
        codeInputs.forEach((input, idx) => {
            const value = input.value.toUpperCase();
            if (isTableCode && idx === 1) {
                code += value + '-';
            } else {
                code += value;
            }
        });
        return code;
    }

    // ==========================================
    // GESTION DES MESSAGES SUR LE FORMULAIRE
    // ==========================================
    function showFormMessage(type, message, mode = 'guest') {
        const messageId = `${mode}FormMessage`;
        const messageEl = document.getElementById(messageId);
        const iconEl = messageEl.querySelector('.message-icon');
        const textEl = messageEl.querySelector('.message-text');
        
        messageEl.className = `form-message ${type}`;
        
        let closeBtn = messageEl.querySelector('.message-close-btn');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.className = 'message-close-btn';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.type = 'button';
            closeBtn.onclick = (e) => {
                e.preventDefault();
                messageEl.style.display = 'none';
            };
            messageEl.appendChild(closeBtn);
        }
        
        closeBtn.style.display = type === 'loading' ? 'none' : 'block';
        
        if (type === 'loading') {
            iconEl.innerHTML = '<div class="inline-loader"></div>';
            textEl.textContent = message;
        } else if (type === 'success') {
            iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
            textEl.textContent = message;
        } else if (type === 'error') {
            iconEl.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            textEl.textContent = message;
        }
        
        messageEl.style.display = 'flex';
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideFormMessage(mode = 'guest') {
        const messageId = `${mode}FormMessage`;
        const messageEl = document.getElementById(messageId);
        messageEl.style.display = 'none';
    }

    // Afficher le badge d'événement
    function displayEventInfoBadge() {
        if (!currentEvent) return;
        
        const badgeEl = document.getElementById('eventInfoBadge');
        const eventNameEl = document.getElementById('eventName');
        const eventDateEl = document.getElementById('eventDate');
        const eventLocationEl = document.getElementById('eventLocation');
        
        if (!badgeEl) return;
        
        let formattedDate = 'Date non disponible';
        if (currentEvent.date) {
            const eventDate = new Date(currentEvent.date);
            formattedDate = eventDate.toLocaleDateString('fr-FR', {
                weekday: 'short',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        eventNameEl.textContent = currentEvent.name || 'Événement';
        eventDateEl.textContent = formattedDate;
        eventLocationEl.textContent = currentEvent.location || 'Lieu non spécifié';
        
        badgeEl.style.display = 'block';
        badgeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // ==========================================
    // GESTION DES ÉTAPES D'ACCÈS
    // ==========================================
    
    // Réinitialisation des variables globales
    function resetGlobalVariables() {
        currentGuest = null;
        currentTable = null;
        currentEvent = null;
        isAnonymousAccess = false;
        console.log('🔄 Variables globales réinitialisées');
    }
    
    function showMainAccessView() {
        accessStep = 1;
        
        // Réinitialiser les variables globales
        resetGlobalVariables();
        
        document.getElementById('accessMainView').classList.remove('hidden');
        document.getElementById('ticketCodeView').classList.add('hidden');
        document.getElementById('confirmationView').classList.add('hidden');
        
        // Réinitialiser le mode à 'guest' si aucun n'est défini
        if (!currentMode || currentMode === 'scan') {
            currentMode = 'guest';
        }
        
        clearCodeInputs();
        updateModeUI();
        resetValidationStates();
    }
    
    function showTicketCodeView() {
        accessStep = 2;
        updateProgressStep(2);
        document.getElementById('accessMainView').classList.add('hidden');
        document.getElementById('ticketCodeView').classList.remove('hidden');
        document.getElementById('confirmationView').classList.add('hidden');

        const title = document.getElementById('ticketCodeTitle');
        const subtitle = document.getElementById('ticketCodeSubtitle');
        
        if (title && currentTable) {
            title.textContent = `${escapeHtml(currentTable.tableName || 'Table')} `;
        }
        
        if (subtitle && currentTable) {
            subtitle.textContent = `${escapeHtml(currentTable.tableNumber || '')} 🟍 ${currentTable.capacity} places`;
        }

        // Update ticket code view logo
        const eventLogo = document.getElementById('ticketCodeEventLogo');
        if (eventLogo && currentEvent && currentEvent.logo) {
            eventLogo.src = currentEvent.logo;
            eventLogo.style.display = 'block';
        } else if (eventLogo) {
            // Fallback to table logo
            eventLogo.src = 'assets/images/image.png';
            eventLogo.style.display = 'block';
        }

        const ticketEventInfo = document.getElementById('ticketEventInfo');
        if (currentEvent && ticketEventInfo) {
            document.getElementById('ticketEventName').textContent = currentEvent.name || 'Événement';
            document.getElementById('ticketEventDate').textContent = currentEvent.date ? new Date(currentEvent.date).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date non disponible';
            document.getElementById('ticketEventLocation').textContent = currentEvent.location || 'Lieu non spécifié';
            ticketEventInfo.style.display = 'block';
        } else if (ticketEventInfo) {
            ticketEventInfo.style.display = 'none';
        }

        clearCodeInputs('.ticket-code');
        updateSkipButtonVisibility();
    }
    
    function showConfirmationView() {
        accessStep = 3;
        document.getElementById('accessMainView').classList.add('hidden');
        document.getElementById('ticketCodeView').classList.add('hidden');
        document.getElementById('confirmationView').classList.remove('hidden');
        updateConfirmationDetails();
        startCountdownTimer();
    }

    function showConfirmationViewOnly() {
        // Afficher juste la confirmation sans créer de session
        accessStep = 3;
        document.getElementById('accessMainView').classList.add('hidden');
        document.getElementById('ticketCodeView').classList.add('hidden');
        document.getElementById('confirmationView').classList.remove('hidden');
        updateConfirmationDetails();
        startCountdownTimer();
    }

    // ==========================================
    // GESTION DU COMPTE À REBOURS (COUNTDOWN)
    // ==========================================
    let countdownInterval = null;

    function startCountdownTimer() {
        // Arrêter le countdown précédent s'il existe
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        if (!currentEvent || !currentEvent.date) {
            return; // Pas d'événement ou pas de date
        }

        // Construire la date complète avec heure
        let eventDateString = currentEvent.date;
        if (currentEvent.time) {
            eventDateString = `${currentEvent.date}T${currentEvent.time}`;
        }

        const eventDate = new Date(eventDateString);
        const countdownSubtitle = document.getElementById('confirmationSubtitle');
        
        if (!countdownSubtitle) return;

        function updateCountdown() {
            const now = new Date();
            const diff = eventDate - now;

            if (diff <= 0) {
                // L'événement a commencé
                countdownSubtitle.innerHTML = `
                    <span style="font-size: 1rem; color: var(--success); font-weight: 600;">
                        <i class="fas fa-check-circle"></i> L'événement a commencé !
                    </span>
                `;
                clearInterval(countdownInterval);
                return;
            }

            // Calcul du countdown
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            countdownSubtitle.innerHTML = `
                <p style="font-size: 0.95rem; margin-bottom: 15px; opacity: 0.8;">
                    Temps avant l'événement
                </p>
                <div class="countdown-container">
                    <div class="countdown-box ${days > 0 ? '' : 'inactive'}">
                        <div class="countdown-value">${String(days).padStart(2, '0')}</div>
                        <div class="countdown-label">Jour${days > 1 ? 's' : ''}</div>
                    </div>
                    <div class="countdown-box ${hours > 0 || days > 0 ? '' : 'inactive'}">
                        <div class="countdown-value">${String(hours).padStart(2, '0')}</div>
                        <div class="countdown-label">Heure${hours > 1 ? 's' : ''}</div>
                    </div>
                    <div class="countdown-box">
                        <div class="countdown-value">${String(minutes).padStart(2, '0')}</div>
                        <div class="countdown-label">Minute${minutes > 1 ? 's' : ''}</div>
                    </div>
                    <div class="countdown-box">
                        <div class="countdown-value">${String(seconds).padStart(2, '0')}</div>
                        <div class="countdown-label">Seconde${seconds > 1 ? 's' : ''}</div>
                    </div>
                </div>
            `;
        }

        // Mise à jour immédiate
        updateCountdown();

        // Mise à jour tous les secondes
        countdownInterval = setInterval(updateCountdown, 1000);
    }
    

    // ==========================================
// GESTION DU MODE SCAN
// ==========================================

function initScanMode() {
    const scanToggleBtn = document.getElementById('scanToggleBtn');
    const startScanBtn = document.getElementById('startScanBtn');
    const switchToGuestBtn = document.getElementById('switchToGuestBtn');
    const switchToTableBtn = document.getElementById('switchToTableBtn');
    
    if (scanToggleBtn) {
        scanToggleBtn.addEventListener('click', function() {
            currentMode = 'scan';
            updateModeUI();
        });
    }
    
    if (startScanBtn) {
        startScanBtn.addEventListener('click', scan);
    }
    
    if (switchToGuestBtn) {
        switchToGuestBtn.addEventListener('click', function() {
            currentMode = 'guest';
            updateModeUI();
            
            // Focus sur le premier champ
            setTimeout(() => {
                const firstInput = document.querySelector('#guestForm .code-input[data-index="0"]');
                if (firstInput) firstInput.focus();
            }, 100);
        });
    }
}



    // ==========================================
    // ÉCOUTEURS D'ÉVÉNEMENTS
    // ==========================================
    function initEventListeners() {
        // Toggle d'accès - SEULEMENT les boutons dans accessMainView
        document.querySelectorAll('#accessMainView .access-toggle-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentMode = this.dataset.mode;
                updateModeUI();
                showMainAccessView();
            });
        });

         initScanMode();
    
         // Focus sur le premier champ
            setTimeout(() => {
                const firstInput = document.querySelector('#tableForm .code-input[data-index="0"]');
                if (firstInput) firstInput.focus();
            }, 100);
     
        // Sauter l'étape du code billet
        const skipTicketCodeBtn = document.getElementById('skipTicketCodeBtn');
        if (skipTicketCodeBtn) {
            skipTicketCodeBtn.addEventListener('click', function() {
                clearCodeInputs('.ticket-code');
                this.style.display = 'block';
                this.innerHTML = '<i class="fas fa-forward"></i><span>Passer cette étape</span>';
                hideFormMessage('ticket');
                skipTicketCodeAndConfirm();
            });
        }
        
        
        
        // Bouton continuer après confirmation
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', createSessionAndProceedToEvent);
        }
        
        // Bouton retour depuis la confirmation
        const backToAccessBtn = document.getElementById('backToAccessBtn');
        if (backToAccessBtn) {
            backToAccessBtn.addEventListener('click', function() {
                console.log('🔙 Retour vers la sélection d\'accès');
                showMainAccessView();
            });
        }
        
        // Modal d'aide
        const helpTrigger = document.querySelectorAll('.help-trigger.help');

        if (helpTrigger) {
            helpTrigger.forEach(trigger => {
                trigger.addEventListener('click', () => {
                    const helpModal = document.getElementById('helpModal');
                    const ticketView = document.getElementById('ticketCodeView');
                    
                    if (ticketView && !ticketView.classList.contains('hidden')) {
                    helpModal.classList.add('active');
                    document.querySelectorAll('.help-toggle-btn').forEach(btn => btn.classList.remove('active'));
                    const codesBtn = document.querySelector('.help-toggle-btn[data-view="codes"]');
                    if (codesBtn) codesBtn.classList.add('active');
                    document.querySelectorAll('.help-view').forEach(v => v.classList.remove('active'));
                    const codesView = document.getElementById('helpViewCodes');
                    if (codesView) codesView.classList.add('active');
                    const billetHelp = document.getElementById('billetHelpItem');
                    if (billetHelp) billetHelp.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }

                helpModal.classList.add('active');
            });
        });
    }
        
        const helpClose = document.getElementById('helpClose');
        if (helpClose) {
            helpClose.addEventListener('click', () => {
                document.getElementById('helpModal').classList.remove('active');
            });
        }
        
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    helpModal.classList.remove('active');
                }
            });
        }
        
        // Modal du lien d'accès
        const linkAccessTrigger = document.querySelectorAll('.help-trigger.link');
        const linkAccessModal = document.getElementById('linkAccessModal');
        const linkAccessClose = document.getElementById('linkAccessClose');
        const linkAccessInput = document.getElementById('linkAccessInput');
        const linkAccessPasteBtn = document.getElementById('linkAccessPasteBtn');
        const linkAccessValidateBtn = document.getElementById('linkAccessValidateBtn');
        const linkAccessCancelBtn = document.getElementById('linkAccessCancelBtn');
        
        if (linkAccessTrigger) {
            linkAccessTrigger.forEach(trigger => {
                trigger.addEventListener('click', () => {
                linkAccessModal.classList.add('active');
                linkAccessInput.value = '';
                document.getElementById('linkAccessMessage').style.display = 'none';
                checkClipboardForLink();
            });
            
        });
    }
        
        if (linkAccessClose) {
            linkAccessClose.addEventListener('click', () => {
                linkAccessModal.classList.remove('active');
            });
        }
        
        if (linkAccessModal) {
            linkAccessModal.addEventListener('click', (e) => {
                if (e.target === linkAccessModal) {
                    linkAccessModal.classList.remove('active');
                }
            });
        }
        
        if (linkAccessCancelBtn) {
            linkAccessCancelBtn.addEventListener('click', () => {
                linkAccessModal.classList.remove('active');
            });
        }
        
        if (linkAccessPasteBtn) {
            linkAccessPasteBtn.addEventListener('click', async () => {
                try {
                    const clipText = await navigator.clipboard.readText();
                    linkAccessInput.value = clipText;
                    linkAccessInput.focus();
                } catch (err) {
                    showToast('Impossible d\'accéder au presse-papiers', 'error');
                }
            });
        }
        
        if (linkAccessValidateBtn) {
            linkAccessValidateBtn.addEventListener('click', validateLinkAccess);
        }
        
        linkAccessInput.addEventListener('input', () => {
            // Vérifier si du contenu est copié dans le presse-papiers
            checkClipboardForLink();
        });
        
        // Contact protocole
        const contactProtocol = document.getElementById('contactProtocol');
        if (contactProtocol) {
            contactProtocol.addEventListener('click', contactProtocolHandler);
        }
        
        
    }
  
    
 
    
    // ==========================================
    // VALIDATION D'ACCÈS
    // ==========================================
   
// ==========================================
// LOGIQUE AMÉLIORÉE POUR LES CODES
// ==========================================

async function validateGuestAccess() {
    const code = getCodeFromInputs();
    
    if (code.length !== 4) {
        showFormMessage('error', 'Code 4 caractères requis', 'guest');
        showErrorOnInputs('#guestForm .code-input');
        return;
    }
    
    resetValidationStates();
    showFormMessage('loading', 'Vérification du code...', 'guest');
    
    try {
        // Vérifier d'abord en local
        const localGuest = window.storage.data.guests?.find(g => g.accessCode === code);
        
        if (localGuest) {
            // Trouvé en local
            currentGuest = localGuest;
            currentEvent = await window.storage.getEventById(localGuest.eventId);
            
            if (localGuest.tableId) {
                currentTable = await window.storage.getTableById(localGuest.tableId);
            } else {
                currentTable = null; // No table assigned yet
            }
            
            showFormMessage('success', 'Code accepté!', 'guest');
            
            // Afficher la confirmation AVANT de créer la session
            await new Promise(resolve => setTimeout(resolve, 800));
            showConfirmationViewOnly();
            return;
        }
        
        // Sinon, vérifier via API
        const result = await window.storage.verifyAccessCode(code);

        
        if (result?.success) {
            // Traitement réussi
            currentGuest = result.data;
            
            // Fetch complete guest data including table
            if (currentGuest && currentGuest.id) {
                const fullGuest = await window.storage.getGuestById(currentGuest.id);
                if (fullGuest) {
                    currentGuest = fullGuest;
                    if (fullGuest.tableId) {
                        currentTable = await window.storage.getTableById(fullGuest.tableId);
                    } else {
                        currentTable = null;
                    }
                }
            }
            
            if (currentGuest.eventId) {
                currentEvent = await window.storage.getEventById(currentGuest.eventId);
            }
            
            showFormMessage('success', 'Code accepté!', 'guest');
            
            // Afficher la confirmation AVANT de créer la session
            await new Promise(resolve => setTimeout(resolve, 800));
            showConfirmationViewOnly();
            
        } else {
            throw new Error(result?.error || 'Code invalide');
        }
        
    } catch (error) {
        console.error('Validation échouée:', error);
        showFormMessage('error', 'Code invalide', 'guest');
        showErrorOnInputs('#guestForm .code-input');
        clearCodeInputs();
    }
}

    
    async function validateTableAccess() {
        const code = getCodeFromInputs();
        
        if (code.length !== 5 || !code.includes('-')) {
            showFormMessage('error', 'Veuillez entrer un code au format XX-YY', 'table');
            showToast('Code incomplet ou format invalide', 'error');
            return;
        }
        
        resetValidationStates();
        showFormMessage('loading', 'Vérification de votre code table...', 'table');
       
        try {
            const result = await window.storage.verifyTableAccessCode(code);
            
            
            if (result && result.success) {
                currentTable = {
                    id: result.data.tableId,
                    tableNumber: result.data.tableNumber,
                    tableName: result.data.tableName,
                    capacity: result.data.capacity,
                    eventId: result.data.eventId
                };

                currentEvent = {
                    id: result.data.eventId,
                    name: result.data.event?.name || '',
                    date: result.data.event?.date || '',
                    location: result.data.event?.location || ''
                };
                
                
                showFormMessage('success', 'Code valide ! Accès à votre table autorisé.', 'table');
                showToast('Bienvenue !', 'success');
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                showTicketCodeView();
                
            } else {
                const errorMsg = result?.error || 'Code table invalide ou expiré';
                showFormMessage('error', errorMsg, 'table');
                showToast(errorMsg, 'error');

                // Corriger le focus pour le code table - ajouter le sélecteur
                clearCodeInputsWithError('#tableForm .code-input');
            }
            
        } catch (error) {
            console.error('❌ Erreur lors de la validation table:', error);
            const errorMsg = 'Erreur de validation. Vérifiez votre connexion.';
            showFormMessage('error', errorMsg, 'table');
            showToast(errorMsg, 'error');
            
            // Corriger le focus pour le code table lors d'erreur
            clearCodeInputsWithError('#tableForm .code-input');
        }
    }
    
    // ==========================================
// VALIDATION DU CODE BILLET (JWT uniquement)
// ==========================================
async function validateTicketCode() {
    const code = getCodeFromInputs('.ticket-code');
    const skipBtn = document.getElementById('skipTicketCodeBtn');
    
    // Si tous les champs sont vides
    const allEmpty = code.split('').every(c => c === '');
    
    if (allEmpty) {
        if (skipBtn) {
            skipBtn.style.display = 'block';
            skipBtn.innerHTML = '<i class="fas fa-forward"></i><span>Passer cette étape</span>';
        }
        hideFormMessage('ticket');
        return;
    } else {
        if (skipBtn) skipBtn.style.display = 'none';
    }

    if (code.length !== 4) {
        showFormMessage('error', 'Veuillez entrer un code de 4 caractères', 'ticket');
        showToast('Code incomplet', 'error');
        if (skipBtn) skipBtn.style.display = 'block';
        return;
    }

    resetValidationStates();
    showFormMessage('loading', 'Validation de votre billet...', 'ticket');
    
    try {
        const result = await window.storage.verifyAccessCode(code);

        if (result.success && result.data.guest) {
            // Guest trouvé avec ce code
            const scannedGuest = result.data.guest;
            
            // Load complete guest data including event and table
            let guestData = scannedGuest;
            if (scannedGuest && scannedGuest.id) {
                const fullGuest = await window.storage.getGuestById(scannedGuest.id);
                if (fullGuest) {
                    guestData = fullGuest;
                }
            }
            
            // Load event data if available
            if (!currentEvent && guestData.eventId) {
                const eventData = await window.storage.getEventById(guestData.eventId);
                if (eventData) {
                    currentEvent = eventData;
                }
            }
            
            let guestTable = null;
            
            if (currentTable && currentTable.id) {

                if (guestData.tableId === currentTable.id) {

                    console.log('✅ Invité reconnu de la table validée');
                    guestTable = currentTable;
                    
                    currentGuest = guestData;
                    currentTable = guestTable;
                    
                    showFormMessage('success', 'Billet reconnu ! Invité identifié', 'ticket');
                    showToast(`Bienvenue ${currentGuest.firstName || ''} ${currentGuest.lastName || ''}`, 'success');
                    
                    await new Promise(resolve => setTimeout(resolve, 800));
                    showConfirmationViewOnly();
                    
                } else if (!guestData.tableId) {
                    console.error('❌ Invité sans table assignée');
                    showFormMessage('error', 'Invité non assigné à une table', 'ticket');
                    showToast('Cet invité n\'a pas de table assignée', 'error');
                    clearCodeInputsWithError('.ticket-code');
                    if (skipBtn) skipBtn.style.display = 'block';
                    
                } else {
                    // ❌ Guest a une autre table
                    guestTable = await window.storage.getTableById(guestData.tableId);
                    console.error('❌ Invité d\'une autre table:', guestData.tableId, 'vs', currentTable.id);
                    showFormMessage('error', `Invité assigné à la table ${guestTable.tableName} seulement`, 'ticket');
                    showToast('Cet invité est assigné à une autre table', 'error');
                    clearCodeInputsWithError('.ticket-code');
                    if (skipBtn) skipBtn.style.display = 'block';
                }
            } else {
                // Pas de table validée précédemment
                // On récupère la table du guest s'il en a une
                if (guestData.tableId) {
                    console.log('📋 Aucune table validée avant, utilisation de la table du guest');
                    guestTable = await window.storage.getTableById(guestData.tableId);
                } else {
                    console.log('⚠️ Guest sans table assignée et aucune table validée');
                    guestTable = null;
                }
                
                currentGuest = guestData;
                currentTable = guestTable;
                
                // Afficher la confirmation
                showFormMessage('success', 'Billet reconnu ! Invité identifié', 'ticket');
                showToast(`Bienvenue ${currentGuest.firstName || ''} ${currentGuest.lastName || ''}`, 'success');
                
                await new Promise(resolve => setTimeout(resolve, 800));
                showConfirmationViewOnly();
            }
            
        } else {
            showFormMessage('error', result.error || 'Code de billet non valide', 'ticket');
            showToast(result.error || 'Code de billet non valide', 'error');
            
            clearCodeInputsWithError('.ticket-code');
            updateSkipButtonVisibility();
            
            if (skipBtn) skipBtn.style.display = 'block';
        }
    } catch (error) {
        console.error('Erreur validation code billet:', error);
        showFormMessage('error', 'Erreur lors de la vérification du billet', 'ticket');
        showToast('Erreur lors de la vérification du billet', 'error');
        if (skipBtn) skipBtn.style.display = 'block';
    }
}

    // ==========================================
    // MODIFICATION DE skipTicketCodeAndConfirm()
    // ==========================================
    async function skipTicketCodeAndConfirm() {
        // Vérifier qu'on a bien une table validée
        if (!currentTable || !currentTable.id) {
            showToast('Veuillez d\'abord valider un code de table', 'error');
            return;
        }
        
        const skipBtn = document.getElementById('skipTicketCodeBtn');
        const originalText = skipBtn.innerHTML;
        skipBtn.disabled = true;
        skipBtn.innerHTML = '<div class="loader"></div>';
        
        try {
            // Créer une session anonyme (sans guest)
            isAnonymousAccess = true;
            
            // Afficher juste la confirmation (sans créer la session tout de suite)
            await new Promise(resolve => setTimeout(resolve, 500));
            showConfirmationViewOnly();
            
            showToast('Accès anonyme', 'success');
            
        } catch (error) {
            console.error('Erreur lors du passage de l\'étape:', error);
            showToast('Erreur lors de l\'accès', 'error');
        } finally {
            skipBtn.disabled = false;
            skipBtn.innerHTML = originalText;
        }
    }

    // ==========================================
// CRÉATION DE SESSION ET REDIRECTION
// ==========================================
async function createSessionAndProceedToEvent() {
    try {
        const continueBtn = document.getElementById('continueBtn');
        
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.style.opacity = '0.6';
            continueBtn.innerHTML = '<div class="loader" style="width: 20px; height: 20px;"></div><span>Chargement...</span>';
        }

        // Créer la session
        const guestId = currentGuest ? currentGuest.id : null;
        const tableId = currentTable ? currentTable.id : null;
        
        if (!tableId && !guestId) {
            showToast('Table ou invité requis', 'error');
            throw new Error('Table ou invité requis');
        }
        
        console.log('📝 Création de session:', { guestId, tableId });
        
        const sessionResult = await window.storage.createEventSession({
            guestId: guestId,
            tableId: tableId
        });

        if (!sessionResult.success) {
            console.error('❌ Erreur création session:', sessionResult.error);
            throw new Error(sessionResult.error);
        }
        
        console.log('✅ Session créée avec succès');
        
        // Confetti celebration
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
        
        showToast('Accès autorisé! Bienvenue!', 'success');
        
        // Redirection après un court délai
        setTimeout(() => {
            console.log('🔄 Redirection vers welcome/');
            window.location.href = 'welcome/';
        }, 500);
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        showToast('Erreur lors de la création de session: ' + error.message, 'error');
        
        // Re-enable button on error
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';
            continueBtn.innerHTML = '<i class="fas fa-arrow-right"></i><span>Continuer</span>';
        }
    }
}

// ==========================================
// CRÉATION DE SESSION SIMPLIFIÉE (DEPRECATED)
// ==========================================
async function createSessionAndShowConfirmation() {
    try {
        const guestId = currentGuest ? currentGuest.id : null;
        const tableId = currentTable ? currentTable.id : null;
        
        if (!tableId && !guestId) {
            showToast('Table ou invité requis', 'error');
            return;
        }
        
        const sessionResult = await window.storage.createEventSession({
            guestId: guestId,
            tableId: tableId
        });

        if (!sessionResult.success) {
            throw new Error(sessionResult.error);
        }
        
        // Récupérer les données via l'API
        const sessionDetails = await window.storage.getCurrentSessionDetails();
        if (!sessionDetails || !sessionDetails.success) {
            throw new Error('Impossible de récupérer les détails de la session');
        }
        
        // Mettre à jour les variables avec les données de l'API
        currentGuest = sessionDetails.data.guest || null;
        currentTable = sessionDetails.data.table || null;
        currentEvent = sessionDetails.data.event || null;
        isAnonymousAccess = !sessionDetails.data.guest;
        
        // Afficher confirmation
        showConfirmationView();
        
        // Animation
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
        
        showToast('Accès autorisé! Bienvenue!', 'success');
        
    } catch (error) {
        console.error('❌ Erreur création session:', error);
        showToast('Erreur lors de la création de la session', 'error');
    }
}

// Obtenir l'avatar selon le sexe avec détection intelligente
function getGuestAvatarImage(guest) {
    const baseUrl = 'assets/images/';
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
    
    if (notes.includes('maman') || notes.includes('mother') || 
        firstName.includes('maman') || firstName.includes('mother') ||
        lastName.includes('maman') || lastName.includes('mother')) {
        return `${baseUrl}maman.png`;
    }
    
    if (guest.type === 'couple' || 
        notes.includes('couple') || 
        company.includes('couple')) {
        return `${baseUrl}couple.png`;
    }
    
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
    
    return null;
}

async function updateConfirmationDetails() {
    try {
        // Utiliser les variables globales remplies lors de la validation du code
        // Au lieu de appeler getCurrentSessionDetails() qui échouera avant la création de la session
        
        if (!currentEvent) {
            console.error('❌ Aucun événement disponible');
            showToast('Événement non disponible', 'error');
            return;
        }

        const guestDetails = document.getElementById('guestDetails');
        const title = document.getElementById('confirmationTitle');
        const subtitle = document.getElementById('confirmationSubtitle');
        const guestWelcome = document.getElementById('guestWelcome');
        const icon = document.getElementById("confirmationIcon");
        
        let detailsHTML = '';
        
        // Informations de l'événement
        if (currentEvent) {
            detailsHTML += `
                <div class="event-badge-header">
                    <i class="fas fa-calendar-star"></i>
                    <span class="event-name">${escapeHtml(currentEvent.name || 'Événement')}</span>
                </div>
                <div class="event-badge-details">
                    ${currentEvent.date ? `
                        <div class="event-detail-item">
                            <i class="fas fa-clock"></i>
                            <span class="event-date">
                                ${new Date(currentEvent.date).toLocaleDateString('fr-FR', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}
                                ${currentEvent.time ? ` - ${currentEvent.time}` : ''}
                            </span>
                        </div>
                    ` : ''}
                    ${currentEvent.location ? `
                        <div class="event-detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span class="event-location">${escapeHtml(currentEvent.location)}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Informations de l'invité
        if (currentGuest) {
            // Avatar
            if (icon) {
                const avatarUrl = getGuestAvatarImage(currentGuest);
                const initials = ((currentGuest.firstName || '').charAt(0) + (currentGuest.lastName || '').charAt(0)).toUpperCase();
                const color = '#D97706';
                
                icon.innerHTML = `
                    <div class="header-avatar" style="background: linear-gradient(135deg, ${color}, ${color}aa); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        ${avatarUrl 
                            ? `<img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">`
                            : `<span style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-weight: 700; font-size: 2.5rem; width: 100%;">${initials}</span>`
                        }
                    </div>
                `;
            }
            
            // Titres
            if (title) {
                const firstName = escapeHtml(currentGuest.firstName || '');
                const lastName = escapeHtml(currentGuest.lastName || '');
                title.textContent = `Bienvenue ${firstName} ${lastName}!`;
            }
            
            if (subtitle) subtitle.textContent = 'Accès autorisé !';
            
            // Détails invité
            detailsHTML += `
                <div class="event-badge-details" style="margin-top: 20px;">
                    <div class="event-detail-item">
                        <i class="fas fa-user"></i>
                        <span>${escapeHtml(currentGuest.firstName || '')} ${escapeHtml(currentGuest.lastName || '')}</span>
                    </div>
                    ${currentGuest.email ? `
                        <div class="event-detail-item">
                            <i class="fas fa-envelope"></i>
                            <span>${escapeHtml(currentGuest.email)}</span>
                        </div>
                    ` : ''}
                    ${currentGuest.phone ? `
                        <div class="event-detail-item">
                            <i class="fas fa-phone"></i>
                            <span>${escapeHtml(currentGuest.phone)}</span>
                        </div>
                    ` : ''}
                    ${currentGuest.company ? `
                        <div class="event-detail-item">
                            <i class="fas fa-building"></i>
                            <span>${escapeHtml(currentGuest.company)}</span>
                        </div>
                    ` : ''}
                </div>
            `;
            
            if (guestWelcome) {
                guestWelcome.textContent = `Bienvenue ${escapeHtml(currentGuest.firstName || 'Invité')}`;
            }
            
        } else {
            // Mode anonyme (accès table seulement)
            isAnonymousAccess = true;
            
            if (title) title.textContent = 'Accès autorisé !';
            if (subtitle) subtitle.textContent = 'Accès anonyme - Vous pouvez entrer votre code d\'invité plus tard';
            
            // Avatar anonyme avec icône incognito
            if (icon) {
                icon.innerHTML = `
                    <div class="header-avatar" style="background: linear-gradient(135deg, #6B7280, #4B5563); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-user-secret" style="font-size: 3rem; color: white;"></i>
                    </div>
                `;
            }
            
            detailsHTML += `
                <div class="event-badge-details" style="margin-top: 20px;">
                    <div class="event-detail-item">
                        <i class="fas fa-user-secret"></i>
                        <span>Accès anonyme</span>
                    </div>
                    <div class="event-detail-item">
                        <i class="fas fa-info-circle"></i>
                        <span style="font-size: 0.9rem; opacity: 0.8;">
                            Vous pouvez entrer votre code d'invitation plus tard pour être identifié
                        </span>
                    </div>
                </div>
            `;
            
            if (guestWelcome) {
                guestWelcome.textContent = `Accès anonyme - Table ${escapeHtml(currentTable?.tableNumber || '')}`;
            }
        }
       
        // Informations de la table
        if (currentTable) {
            detailsHTML += `
                <div class="event-badge-details" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <div class="event-detail-item">
                        <i class="fas fa-chair"></i>
                        <span>Table ${escapeHtml(currentTable.tableNumber || '')}</span>
                    </div>
                    ${currentTable.tableName ? `
                        <div class="event-detail-item">
                            <i class="fas fa-signature"></i>
                            <span>${escapeHtml(currentTable.tableName)}</span>
                        </div>
                    ` : ''}
                    ${currentTable.capacity ? `
                        <div class="event-detail-item">
                            <i class="fas fa-users"></i>
                            <span>${currentTable.capacity} places</span>
                        </div>
                    ` : ''}
                    ${currentTable.location ? `
                        <div class="event-detail-item">
                            <i class="fas fa-map-pin"></i>
                            <span>${escapeHtml(currentTable.location)}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (currentGuest) {
            // Invité sans table assignée - afficher avertissement
            detailsHTML += `
                <div class="event-badge-details" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 15px; background-color: rgba(249, 115, 22, 0.08); border-radius: 8px; padding: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; color: var(--warning-color, #F97316);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 1.2rem; flex-shrink: 0;"></i>
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">Pas de table assignée</div>
                            <div style="font-size: 0.85rem; opacity: 0.9; margin-top: 4px;">
                                Veuillez contacter l'organisateur pour connaître votre table d'accueil.
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Mettre à jour les détails dans le DOM
        if (guestDetails) {
            guestDetails.innerHTML = detailsHTML;
        }
        
        // Mettre à jour le bouton continuer selon le contexte
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            // ❌ CACHER le bouton SEULEMENT si:
            // - On a un guest (invité identifié) 
            // - MAIS il n'a pas de table assignée
            if (currentGuest && !currentTable) {
                continueBtn.disabled = true;
                continueBtn.style.display = 'none';
                continueBtn.style.opacity = '0.5';
                continueBtn.style.cursor = 'not-allowed';
                continueBtn.title = 'Pas de table assignée à cet invité';
                continueBtn.innerHTML = '<i class="fas fa-info-circle"></i><span>Pas de table assignée</span>';
            } else {
                continueBtn.disabled = false;
                continueBtn.style.display = 'flex';
                continueBtn.style.opacity = '1';
                continueBtn.style.cursor = 'pointer';
                continueBtn.title = '';
                continueBtn.innerHTML = '<i class="fas fa-arrow-right"></i><span>Continuer</span>';
            }
        }
        
        console.log('✅ Détails de confirmation mis à jour avec succès');
        
    } catch (error) {
        console.error('❌ Erreur mise à jour confirmation:', error);
        showToast('Erreur lors du chargement des informations', 'error');
        
        // En cas d'erreur, afficher un message d'erreur
        const guestDetails = document.getElementById('guestDetails');
        if (guestDetails) {
            guestDetails.innerHTML = `
                <div class="event-badge-details" style="text-align: center; padding: 30px 20px; color: var(--danger);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px;"></i>
                    <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 10px;">Erreur de chargement</div>
                    <div style="font-size: 0.9rem; opacity: 0.8;">
                        Impossible de charger les détails de votre session.
                        Veuillez réessayer.
                    </div>
                    <button onclick="window.location.reload()" style="margin-top: 20px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-redo"></i> Réessayer
                    </button>
                </div>
            `;
        }
    }
}




// ==========================================
// GESTION DU LIEN D'ACCÈS
// ==========================================
async function checkClipboardForLink() {
    try {
        const clipText = await navigator.clipboard.readText();
        const pasteBtn = document.getElementById('linkAccessPasteBtn');
        
        if (clipText && (clipText.includes('http://') || clipText.includes('https://'))) {
            try {
                new URL(clipText);
                if (pasteBtn) {
                    pasteBtn.style.display = 'inline-flex';
                }
            } catch (e) {
                if (pasteBtn) {
                    pasteBtn.style.display = 'none';
                }
            }
        } else {
            if (pasteBtn) {
                pasteBtn.style.display = 'none';
            }
        }
    } catch (err) {
        const pasteBtn = document.getElementById('linkAccessPasteBtn');
        if (pasteBtn) {
            pasteBtn.style.display = 'none';
        }
    }
}

function validateLinkAccess() {
    const input = document.getElementById('linkAccessInput');
    const message = document.getElementById('linkAccessMessage');
    const linkValue = input.value.trim();
    
    if (!linkValue) {
        showMessage('Veuillez entrer ou coller un lien', 'error', message);
        return;
    }
    
    try {
        let url = null;
        let accessData = null;
        
        if (linkValue.includes('http://') || linkValue.includes('https://')) {
            try {
                url = new URL(linkValue);
                
                // Chercher les paramètres d'accès (comme dans checkUrlParams)
                const params = url.searchParams;
                const guestId = params.get('guestId') || params.get('guest');
                const tableId = params.get('tableId') || params.get('table');
                const eventId = params.get('eventId') || params.get('event');
                
                if (guestId) {
                    accessData = { type: 'guest', guestId, tableId, eventId };
                } else if (tableId) {
                    accessData = { type: 'table', tableId, eventId };
                } else {
                    showMessage('Aucun accès valide trouvé dans le lien', 'error', message);
                    return;
                }
            } catch (e) {
                showMessage('Le lien fourni n\'est pas valide', 'error', message);
                return;
            }
        } else if (/^[A-Z0-9]{4}$/i.test(linkValue)) {
            // Code direct de 4 caractères
            showMessage('Format code direct non supporté pour le lien. Veuillez fournir une URL.', 'error', message);
            return;
        } else {
            showMessage('Veuillez entrer une URL valide', 'error', message);
            return;
        }
        
        // Injecter l'accès avec les IDs
        injectAccessFromLink(accessData);
        
        showMessage('Lien détecté avec succès ! Chargement...', 'success', message);
        
        
        
    } catch (error) {
        console.error('Erreur validation lien:', error);
        showMessage('Erreur lors du traitement du lien', 'error', message);
    }
}

async function injectAccessFromLink(accessData) {
    const { guestId, tableId, eventId } = accessData;
    
    try {
        showMessage('Chargement des données...', 'loading', document.getElementById('linkAccessMessage'));
        
        // Réutiliser exactement la même logique que checkUrlParams()
        if (guestId) {
            console.log('🎫 Accès direct invité via lien détecté');
            
            try {
                const guestData = await storage.getGuestById(guestId);
                if (!guestData) throw new Error('Invité non trouvé');
                
                currentGuest = guestData;
                
                if (guestData.eventId) {
                    currentEvent = await storage.getEventById(guestData.eventId);
                } else if (eventId) {
                    currentEvent = await storage.getEventById(eventId);
                }
                
                // Récupérer la table si assignée
                if (guestData.tableId) {
                    currentTable = await storage.getTableById(guestData.tableId);
                }

                // Fermer le modal après un court délai
                setTimeout(() => {
                    document.getElementById('linkAccessModal').classList.remove('active');
                }, 150);
                
                // ✅ AU LIEU d'aller à la confirmation directement,
                // AFFICHER la page du code ticket pour que l'utilisateur puisse entrer son code invite
                showTicketCodeView();
                showToast('Lien détecté - Entrez votre code de billet (optionnel)', 'info');
                return;
                
            } catch (error) {
                console.error('❌ Erreur accès direct invité via lien:', error);
                showMessage('Invitation non valide: ' + error.message, 'error', document.getElementById('linkAccessMessage'));
                showToast('Invitation non valide', 'error');
                return;
            }
        }
        
        if (tableId) {
            console.log('🏓 Accès direct table via lien détecté');
            
            try {
                const tableData = await storage.getTableById(tableId);
                if (!tableData) throw new Error('Table non trouvée');
                
                currentTable = tableData;
                
                if (tableData.eventId) {
                    currentEvent = await storage.getEventById(tableData.eventId);
                } else if (eventId) {
                    currentEvent = await storage.getEventById(eventId);
                }

                // Fermer le modal après un court délai
                setTimeout(() => {
                    document.getElementById('linkAccessModal').classList.remove('active');
                }, 150);
                
                // ✅ AU LIEU d'aller à la confirmation directement,
                // AFFICHER la page du code ticket pour que l'utilisateur puisse optionnellement entrer son code
                isAnonymousAccess = true;
                showTicketCodeView();
                showToast('Table validée - Entrez votre code de billet (optionnel)', 'info');
                return;
                
            } catch (error) {
                console.error('❌ Erreur accès direct table via lien:', error);
                showMessage('Table non valide: ' + error.message, 'error', document.getElementById('linkAccessMessage'));
                showToast('Table non valide', 'error');
                return;
            }
        }
        
        showMessage('Aucun accès valide dans le lien', 'error', document.getElementById('linkAccessMessage'));
        
    } catch (error) {
        console.error('Erreur injection lien:', error);
        showMessage('Erreur lors du traitement du lien: ' + error.message, 'error', document.getElementById('linkAccessMessage'));
    }
}

function showMessage(text, type, element) {
    if (!element) return;
    
    element.style.display = 'block';
    element.textContent = text;
    element.className = '';
    
    if (type === 'success') {
        element.style.background = 'rgba(16, 185, 129, 0.1)';
        element.style.color = 'var(--success)';
        element.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else if (type === 'error') {
        element.style.background = 'rgba(239, 68, 68, 0.1)';
        element.style.color = 'var(--danger)';
        element.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    }
}


// ==========================================
// VÉRIFICATION SESSION EXISTANTE
// ==========================================
async function checkExistingSession() {
    try {
        const token = localStorage.getItem('secura_event_session_token');
        if (!token) return null;

        const response = await fetch(`${window.storage.API_URL}/event-sessions/verify-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });


        if (!response.ok) {
            localStorage.removeItem('secura_event_session_token');
            return null;
        }
        
        const result = await response.json();
        if (result.success) {
            return result.data;
        }
        
        return null;
        
    } catch (error) {
        console.error('Erreur vérification session:', error);
        localStorage.removeItem('secura_event_session_token');
        return null;
    }
}


// ==========================================
// VALIDATION SESSION POUR NAVIGATION
// ==========================================
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
    
    // ==========================================
// NAVIGATION - PROCÉDER À L'ÉVÉNEMENT
// ==========================================
// PROCÉDER À L'ÉVÉNEMENT (DEPRECATED)
// ==========================================
async function proceedToEvent() {
    try {
        if (!await validateSession()) {
            showToast('Session invalide', 'error');
            return;
        }

        const continueBtn = document.getElementById('continueBtn');
        
        // Disable button to prevent double-click
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.style.opacity = '0.6';
            continueBtn.innerHTML = '<div class="loader" style="width: 20px; height: 20px;"></div><span>Redirection...</span>';
        }
        
        const token = localStorage.getItem('secura_event_session_token');
        if (!token) {
            throw new Error('Token de session non trouvé');
        }
        
        console.log('Redirection vers la page welcome avec token JWT');
        
        setTimeout(() => {
            window.location.href = 'welcome/';
        }, 500);
        
    } catch (error) {
        console.error('Redirection error:', error);
        showToast('Erreur lors de la redirection', 'error');
        
        // Re-enable button on error
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.style.opacity = '1';
            continueBtn.innerHTML = '<i class="fas fa-arrow-right"></i><span>Continuer</span>';
        }
    }
}
    
    // ==========================================
    // CONTACT PROTOCOLE
    // ==========================================
    async function contactProtocolHandler(e) {
        e.preventDefault();
        
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



    // ==========================================
// SCANNER QR RÉEL
// ==========================================

let qrScanner = null;
let scanningActive = false;

function initQRScanner() {
    const qrBtn = document.getElementById('qrScannerBtn');
    if (!qrBtn) return;
    
    // Afficher seulement sur mobile
    if (window.innerWidth <= 768) {
        qrBtn.style.display = 'flex';
        
        qrBtn.addEventListener('click', scan);
        }
}

async function scan() {
    if (scanningActive) return;
    scanningActive = true;
    
    try {
        // Énumérer les caméras disponibles
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
            throw new Error('NotFoundError');
        }
        
        let currentCameraIndex = 0;
        let stream = null;
        
        // Fonction pour obtenir la caméra
        const getCamera = async (index) => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            const camera = videoDevices[index];
            const constraints = {
                video: {
                    deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined,
                    facingMode: index === 0 ? 'environment' : 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    zoom: { ideal: 1 }
                }
            };
            
            return await navigator.mediaDevices.getUserMedia(constraints);
        };
        
        stream = await getCamera(0);
        
        // Créer le modal de scan amélioré
        const scannerModal = document.createElement('div');
        scannerModal.className = 'qr-scanner-modal';
        scannerModal.innerHTML = `
            <div class="scanner-container" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #000; z-index: 10001; display: flex; flex-direction: column;">
                <!-- Header -->
                <div class="scanner-header" style="padding: 12px 15px; background: rgba(0,0,0,0.8); display: flex; justify-content: space-between; align-items: center; backdrop-filter: blur(5px); border-bottom: 1px solid var(--primary);">
                    <h4 style="margin: 0; color: white; font-size: 1rem;"><i class="fas fa-qrcode"></i> Scannez votre code QR</h4>
                    <button class="close-scanner" style="background: none; border: none; color: white; font-size: 1.3rem; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- Caméra -->
                <div class="scanner-viewport" style="flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <video id="qrVideo" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
                    
                    <!-- Cadre de scan -->
                    <div class="scanner-frame" style="position: absolute; width: 280px; height: 280px; border: 3px solid var(--primary); border-radius: 15px; box-shadow: inset 0 0 20px var(--primary), 0 0 0 2000px rgba(0,0,0,0.6);"></div>
                    
                    <!-- Coins du cadre -->
                    <div style="position: absolute; width: 280px; height: 280px; pointer-events: none;">
                        <div style="position: absolute; width: 20px; height: 20px; border-top: 3px solid var(--primary); border-left: 3px solid var(--primary); top: 0; left: 0;"></div>
                        <div style="position: absolute; width: 20px; height: 20px; border-top: 3px solid var(--primary); border-right: 3px solid var(--primary); top: 0; right: 0;"></div>
                        <div style="position: absolute; width: 20px; height: 20px; border-bottom: 3px solid var(--primary); border-left: 3px solid var(--primary); bottom: 0; left: 0;"></div>
                        <div style="position: absolute; width: 20px; height: 20px; border-bottom: 3px solid var(--primary); border-right: 3px solid var(--primary); bottom: 0; right: 0;"></div>
                    </div>
                    
                    <!-- Laser de scan -->
                    <div class="scanner-laser" style="position: absolute; width: 280px; height: 2px; background: linear-gradient(90deg, transparent, var(--primary), transparent); animation: laserMove 2s infinite;"></div>
                    
                   
                </div>
                
                <!-- Instructions et contrôles -->
                <div class="scanner-footer" style="padding: 15px; background: rgba(0,0,0,0.8); border-top: 1px solid var(--primary);">
                    <!-- Texte d'instruction -->
                    <div style="text-align: center; margin-bottom: 12px;">
                        <p style="margin: 0; font-size: 0.9rem; color: white;">
                            <i class="fas fa-lightbulb"></i> Pointez vers le QR code
                        </p>
                        <p style="margin: 5px 0 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.6);">
                            Le scan est automatique - Le code se détectera seul
                        </p>
                    </div>
                    
                    <!-- Contrôles de caméra -->
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        ${videoDevices.length > 1 ? `
                            <button class="switch-camera-btn" style="padding: 10px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s ease;">
                                <i class="fas fa-camera"></i> Changer caméra
                            </button>
                        ` : ''}
                        
                        <button class="zoom-in-btn" style="padding: 10px 16px; background: rgba(217, 119, 6, 0.3); color: var(--primary); border: 1px solid var(--primary); border-radius: 8px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease;">
                            <i class="fas fa-search-plus"></i> Zoom +
                        </button>
                        
                        <button class="zoom-out-btn" style="padding: 10px 16px; background: rgba(217, 119, 6, 0.3); color: var(--primary); border: 1px solid var(--primary); border-radius: 8px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease;">
                            <i class="fas fa-search-minus"></i> Zoom -
                        </button>
                    </div>
                    
                    <!-- Info de caméra actuelle -->
                    <div style="margin-top: 10px; text-align: center; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                        <span id="cameraInfo">Caméra ${currentCameraIndex + 1} / ${videoDevices.length}</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(scannerModal);
        
        const video = document.getElementById('qrVideo');
        const closeBtn = scannerModal.querySelector('.close-scanner');
        const switchCameraBtn = scannerModal.querySelector('.switch-camera-btn');
        const zoomInBtn = scannerModal.querySelector('.zoom-in-btn');
        const zoomOutBtn = scannerModal.querySelector('.zoom-out-btn');
        const cameraInfo = document.getElementById('cameraInfo');
        
        let currentZoom = 1;
        
        // Initialiser la vidéo
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            video.play();
            startQRDetection(video, scannerModal, stream);
        };
        
        // Bouton pour changer de caméra
        if (switchCameraBtn) {
            switchCameraBtn.addEventListener('click', async () => {
                currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;
                
                try {
                    stream = await getCamera(currentCameraIndex);
                    video.srcObject = stream;
                    cameraInfo.textContent = `Caméra ${currentCameraIndex + 1} / ${videoDevices.length}`;
                    currentZoom = 1;
                    
                    switchCameraBtn.style.transform = 'scale(0.95)';
                    setTimeout(() => switchCameraBtn.style.transform = 'scale(1)', 200);
                    
                    showToast(`Caméra ${currentCameraIndex + 1}/${videoDevices.length}`, 'info');
                } catch (error) {
                    console.error('Erreur changement caméra:', error);
                    showToast('Erreur lors du changement de caméra', 'error');
                }
            });
        }
        
        // Zoom contrôles
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', async () => {
                currentZoom = Math.min(currentZoom + 0.2, 4);
                try {
                    //const settings = video.getSettings();
                    const track = stream.getVideoTracks()[0];
                    await track.applyConstraints({ video: { zoom: { ideal: currentZoom } } });
                    zoomInBtn.style.transform = 'scale(0.95)';
                    setTimeout(() => zoomInBtn.style.transform = 'scale(1)', 200);
                } catch (error) {
                    console.warn('Zoom non supporté:', error);
                }
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', async () => {
                currentZoom = Math.max(currentZoom - 0.2, 1);
                try {
                    const track = stream.getVideoTracks()[0];
                    await track.applyConstraints({ video: { zoom: { ideal: currentZoom } } });
                    zoomOutBtn.style.transform = 'scale(0.95)';
                    setTimeout(() => zoomOutBtn.style.transform = 'scale(1)', 200);
                } catch (error) {
                    console.warn('Zoom non supporté:', error);
                }
            });
        }
        
        // Fermer le scanner
        closeBtn.addEventListener('click', () => {
            stopQRScanner(stream, scannerModal);
        });
        
        // Fermer en cliquant en dehors du cadre
        scannerModal.addEventListener('click', (e) => {
            if (e.target === scannerModal || e.target.classList.contains('scanner-container')) {
                stopQRScanner(stream, scannerModal);
            }
        });
        
    } catch (error) {
        console.error('Erreur caméra:', error);
        scanningActive = false;
        
        if (error.name === 'NotAllowedError') {
            showToast('Permission caméra refusée', 'error');
            showCameraPermissionInstructions();
        } else if (error.name === 'NotFoundError') {
            showToast('Aucune caméra trouvée', 'error');
        } else {
            showToast('Erreur d\'accès à la caméra', 'error');
        }
    }
} 

// Obtenir la meilleure caméra (arrière)
async function getBestCamera() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Préférer la caméra arrière
        const backCamera = videoDevices.find(device => 
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('arrière') ||
            device.label.toLowerCase().includes('rear')
        );
        
        return backCamera || videoDevices[0];
    } catch (error) {
        console.error('Erreur sélection caméra:', error);
        return null;
    }
}

// Vérifier et optimiser les performances
function optimizeScannerPerformance() {
    // Réduire la fréquence de scan sur mobile ancien
    const isOldDevice = /android [1-5]|ios [1-9]|iphone [1-6]/i.test(navigator.userAgent);
    
    if (isOldDevice) {
        console.log('📱 Device ancien détecté, optimisation des performances');
        return {
            scanInterval: 300, // ms entre les scans
            resolution: { width: 640, height: 480 }
        };
    }
    
    return {
        scanInterval: 100, // ms entre les scans
        resolution: { width: 1280, height: 720 }
    };
}

function logScanError(error, context = '') {
    console.error(`❌ Erreur scan QR ${context}:`, error);
    
    // Envoyer à un service de logging si disponible
    if (window.errorLoggingService) {
        window.errorLoggingService.log({
            type: 'qr_scan_error',
            error: error.message,
            context,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
    }
}


// Feedback visuel lors du scan réussi
function showScanSuccessFeedback(modal) {
    const frame = modal.querySelector('.scanner-frame');
    const laser = modal.querySelector('.scanner-laser');
    const viewport = modal.querySelector('.scanner-viewport');
    
    if (frame) {
        frame.style.transition = 'all 0.4s ease';
        frame.style.borderColor = 'var(--success)';
        frame.style.boxShadow = `inset 0 0 30px var(--success), 0 0 0 2000px rgba(0,0,0,0.6), 0 0 40px var(--success)`;
    }
    
    if (laser) {
        laser.style.animation = 'none';
    }
    
    // Pulse d'animation de succès
    if (viewport) {
        const indicator = viewport.querySelector('.scan-indicator');
        if (indicator) {
            indicator.style.animation = 'scanSuccess 0.6s ease';
            setTimeout(() => {
                indicator.style.opacity = '1';
            }, 600);
        }
    }
    
    // Confetti
    setTimeout(() => {
        try {
            confetti({
                particleCount: 60,
                spread: 80,
                origin: { x: 0.5, y: 0.5 },
                colors: ['#D97706', '#10B981', '#3B82F6']
            });
        } catch (e) {
            console.warn('Confetti non disponible');
        }
    }, 200);
}

function processQRCodeData(data) {
    console.log('📊 Traitement du QR code:', data);
    
    try {
        // Vérifier si c'est une URL
        if (data.startsWith('http://') || data.startsWith('https://')) {
            // Redirection directe
            window.location.href = data;
            return;
        }
        
        // Vérifier si c'est un code simple
        if (data.length <= 10) {
            // Injecter le code dans le formulaire actif
            injectCodeToActiveForm(data);
        } else {
            // Traiter comme URL de contenu
            try {
                const url = new URL(data);
                window.location.href = data;
            } catch (e) {
                // Code non reconnu
                showToast('Code QR non reconnu', 'error');
                showMainAccessView();
            }
        }
    } catch (error) {
        console.error('❌ Erreur traitement QR:', error);
        showToast('Erreur lors du traitement du code', 'error');
    }
}

function injectCodeToActiveForm(code) {
    console.log('💉 Injection du code:', code);
    
    if (!currentMode) {
        showToast('Mode d\'accès non défini', 'error');
        return;
    }
    
    let inputs = [];
    
    if (currentMode === 'guest') {
        inputs = Array.from(document.querySelectorAll('#guestForm .code-input'));
    } else if (currentMode === 'table') {
        inputs = Array.from(document.querySelectorAll('#tableForm .code-input'));
    }
    
    if (inputs.length === 0) {
        showToast('Formulaire non trouvé', 'error');
        return;
    }
    
    // Nettoyer le code
    const cleanCode = code.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    if (cleanCode.length === 0) {
        showToast('Code invalide', 'error');
        return;
    }
    
    // Remplir les champs
    let codeIndex = 0;
    for (let i = 0; i < inputs.length && codeIndex < cleanCode.length; i++) {
        const input = inputs[i];
        
        // Sauter le tiret pour les codes table
        if (currentMode === 'table' && i === 2 && code.includes('-')) {
            continue;
        }
        
        const char = cleanCode[codeIndex];
        input.value = char;
        input.classList.add('filled');
        codeIndex++;
    }
    
    updateCodeInputState();
    
    // Focus sur dernier champ
    inputs[inputs.length - 1].focus();
    
    // Validation automatique après un délai
    setTimeout(() => {
        if (currentMode === 'guest') {
            validateGuestAccess();
        } else if (currentMode === 'table') {
            validateTableAccess();
        }
    }, 300);
    
    showToast('Code scanné avec succès !', 'success');
}

function startQRDetection(video, modal, stream) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let lastScanTime = 0;
    let isScanning = true;
    let scanAttempts = 0;
    let lastQRData = null;
    
    const scanQR = async (timestamp) => {
        if (!isScanning || !scanningActive) return;
        
        // Scan à 30 FPS pour performance
        if (timestamp - lastScanTime < 33) {
            requestAnimationFrame(scanQR);
            return;
        }
        
        lastScanTime = timestamp;
        scanAttempts++;
        
        try {
            // Vérifier si la vidéo est prête
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                requestAnimationFrame(scanQR);
                return;
            }
            
            // Ajuster la taille du canvas
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
            
            // Dessiner uniquement la zone centrale (optimisation performance)
            const scanAreaSize = Math.min(video.videoWidth, video.videoHeight) * 0.8;
            const x = (video.videoWidth - scanAreaSize) / 2;
            const y = (video.videoHeight - scanAreaSize) / 2;
            
            context.drawImage(video, x, y, scanAreaSize, scanAreaSize, 0, 0, scanAreaSize, scanAreaSize);
            
            // Récupérer les données d'image
            const imageData = context.getImageData(0, 0, scanAreaSize, scanAreaSize);
            
            // Améliorer le contraste pour les QR codes difficiles
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
                data[i] = data[i+1] = data[i+2] = gray > 128 ? 255 : 0;
            }
            
            // Détecter le QR code
            const code = jsQR(data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
            });
            
            // Si QR code détecté
            if (code && code.data) {
                // Vérifier que ce n'est pas un faux positif (même code que précédemment)
                if (code.data !== lastQRData) {
                    console.log('✅ QR Code détecté:', code.data);
                    lastQRData = code.data;
                    isScanning = false;
                    
                    // Feedback visuel et sonore
                    showScanSuccessFeedback(modal);
                    
                    if (SECURA_AUDIO) {
                        SECURA_AUDIO.play('success');
                    }
                    
                    // Animation du cadre
                    const frame = modal.querySelector('.scanner-frame');
                    if (frame) {
                        frame.style.animation = 'scanSuccess 0.5s ease';
                        frame.style.borderColor = 'var(--success)';
                        frame.style.boxShadow = `inset 0 0 20px var(--success), 0 0 0 2000px rgba(0,0,0,0.6), 0 0 30px var(--success)`;
                    }
                    
                    // Attendre un peu pour montrer le feedback
                    setTimeout(() => {
                        stopQRScanner(stream, modal);
                        processQRCodeData(code.data);
                    }, 800);
                    
                    return;
                }
            }
            
            // Continuer le scan
            requestAnimationFrame(scanQR);
            
        } catch (error) {
            console.error('❌ Erreur détection QR:', error);
            
            // Réessayer après un délai
            if (isScanning && scanningActive) {
                setTimeout(() => {
                    requestAnimationFrame(scanQR);
                }, 100);
            }
        }
    };
    
    // Démarrer le scan
    requestAnimationFrame(scanQR);
    
    // Timeout de sécurité
    setTimeout(() => {
        if (isScanning && scanningActive) {
            console.warn('⏱️ Timeout scan QR après tentatives');
            isScanning = false;
            
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            showToast('Scan trop long, réessayez', 'warning');
            
            if (modal && modal.parentNode) {
                modal.remove();
            }
            
            scanningActive = false;
        }
    }, 30000); // 30 secondes timeout
}



// Arrêter le scanner
function stopQRScanner(stream, modal) {
    console.log('🛑 Arrêt du scanner QR');
    scanningActive = false;
    
    // Arrêter tous les flux vidéo
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
            console.log('✓ Track arrêté:', track.kind);
        });
    }
    
    // Supprimer le modal avec animation
    if (modal && modal.parentNode) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

// Traiter les données du QR code
function processQRCodeData(qrData) {
    try {
        console.log('🔍 Traitement QR:', qrData);
        
        // Vérifier si c'est une URL
        let url = null;
        try {
            url = new URL(qrData);
        } catch (e) {
            // Si ce n'est pas une URL valide, essayer de l'analyser comme paramètres
            if (qrData.includes('eventId=') || qrData.includes('guestId=') || qrData.includes('tableId=')) {
                // C'est probablement une query string
                processQueryString(qrData);
                return;
            }
            
            // Essayer de parser comme JSON
            try {
                const data = JSON.parse(qrData);
                if (data.eventId || data.guestId || data.tableId) {
                    processQRData(data);
                    return;
                }
            } catch (jsonError) {
                // Pas un JSON valide
            }
            
            throw new Error('Format QR non reconnu');
        }
        
        // Si c'est une URL SECURA
        if (url.hostname.includes('secura') || url.pathname.includes('/access')) {
            // Extraire les paramètres
            const params = new URLSearchParams(url.search);
            processQueryParams(params);
            return;
        }
        
        // Autres formats d'URL
        processURLData(url);
        
    } catch (error) {
        console.error('Erreur traitement QR:', error);
        showToast('QR Code non valide', 'error');
    }
}

// Traiter les paramètres de query string
function processQueryString(queryString) {
    // Nettoyer la string
    let cleanString = queryString;
    
    // Si ça commence par "?", le retirer
    if (cleanString.startsWith('?')) {
        cleanString = cleanString.substring(1);
    }
    
    // Si ça commence par "http", extraire la query
    if (cleanString.includes('?')) {
        cleanString = cleanString.split('?')[1];
    }
    
    const params = new URLSearchParams(cleanString);
    processQueryParams(params);
}

// Traiter les paramètres d'URL
function processQueryParams(params) {
    const guestId = params.get('guestId');
    const tableId = params.get('tableId');
    const eventId = params.get('eventId');
    
    console.log('📋 Paramètres extraits:', { guestId, tableId, eventId });
    
    if (guestId || tableId || eventId) {
        // Rediriger avec les paramètres
        const newUrl = new URL(window.location.href);
        
        if (guestId) newUrl.searchParams.set('guestId', guestId);
        if (tableId) newUrl.searchParams.set('tableId', tableId);
        if (eventId) newUrl.searchParams.set('eventId', eventId);
        
        // Ajouter un timestamp pour éviter le cache
        newUrl.searchParams.set('qr_scanned', Date.now());
        
        // Rediriger
        window.location.href = newUrl.toString();
    } else {
        showToast('QR Code sans données valides', 'warning');
    }
}

// Traiter les données JSON
function processQRData(data) {
    if (data.eventId || data.guestId || data.tableId) {
        const newUrl = new URL(window.location.href);
        
        if (data.guestId) newUrl.searchParams.set('guestId', data.guestId);
        if (data.tableId) newUrl.searchParams.set('tableId', data.tableId);
        if (data.eventId) newUrl.searchParams.set('eventId', data.eventId);
        
        newUrl.searchParams.set('qr_scanned', Date.now());
        window.location.href = newUrl.toString();
    }
}

// Traiter les données d'URL
function processURLData(url) {
    // Pour les URLs externes, ouvrir dans un nouvel onglet
    if (url.protocol.startsWith('http')) {
        const confirmed = confirm(`Ouvrir le lien: ${url.href}\n\nVoulez-vous continuer ?`);
        if (confirmed) {
            window.open(url.href, '_blank');
        }
    } else {
        showToast('URL non supportée', 'warning');
    }
}

// Afficher les instructions de permission caméra
function showCameraPermissionInstructions() {
    Swal.fire({
        title: 'Permission caméra requise',
        html: `
            <div style="text-align: center; padding: 20px 0;">
                <i class="fas fa-camera" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                <p>Pour scanner un QR Code, SECURA a besoin d'accéder à votre caméra.</p>
                <div style="background: var(--hover-bg); border-radius: 10px; padding: 15px; margin: 20px 0; text-align: left;">
                    <h5 style="color: var(--primary); margin-bottom: 10px;">Instructions :</h5>
                    <ol style="margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 8px;">Cliquez sur l'icône "🔒" dans la barre d'adresse</li>
                        <li style="margin-bottom: 8px;">Sélectionnez "Autoriser" pour l'accès à la caméra</li>
                        <li>Actualisez la page et réessayez</li>
                    </ol>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-color); opacity: 0.7;">
                    Votre caméra n'est utilisée que pour scanner le QR Code, aucune image n'est enregistrée.
                </p>
            </div>
        `,
        confirmButtonText: 'Compris',
        confirmButtonColor: '#D97706',
        width: 500
    });
}

function isQRScannerSupported() {
    return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia &&
        window.jsQR
    );
}

async function testCameraAvailability() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('📷 Caméras disponibles:', videoDevices.length);
        
        if (videoDevices.length === 0) {
            console.warn('Aucune caméra détectée');
            return false;
        }
        
        return true;
    } catch (error) {
        console.warn('Erreur détection caméra:', error);
        return false;
    }
}