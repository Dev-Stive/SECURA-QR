/**
 * Contact Form Manager
 * Gère l'envoi des messages de contact
 */

class ContactManager {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.apiEndpoint = '/api/contact/send';
        this.init();
    }

    init() {
        if (!this.form) return;

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.setupValidation();
    }

    /**
     * Configuration de la validation en temps réel
     */
    setupValidation() {
        const inputs = this.form.querySelectorAll('.form-control, input[type="checkbox"]');

        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });

            input.addEventListener('input', () => {
                // Nettoyer l'erreur en tapant
                const errorSpan = input.closest('.form-group')?.querySelector('.form-error');
                if (errorSpan) {
                    errorSpan.textContent = '';
                }
            });
        });
    }

    /**
     * Valider un champ
     */
    validateField(field) {
        const formGroup = field.closest('.form-group');
        const errorSpan = formGroup?.querySelector('.form-error');
        let isValid = true;
        let errorMessage = '';

        if (field.name === 'name') {
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Le nom est requis';
            } else if (field.value.trim().length < 2) {
                isValid = false;
                errorMessage = 'Le nom doit contenir au moins 2 caractères';
            }
        }

        if (field.name === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'L\'email est requis';
            } else if (!emailRegex.test(field.value.trim())) {
                isValid = false;
                errorMessage = 'Veuillez entrer une adresse email valide';
            }
        }

        if (field.name === 'phone') {
            if (field.value.trim() && field.value.trim().length < 10) {
                isValid = false;
                errorMessage = 'Le numéro de téléphone doit contenir au moins 10 chiffres';
            }
        }

        if (field.name === 'subject') {
            if (!field.value) {
                isValid = false;
                errorMessage = 'Veuillez sélectionner un sujet';
            }
        }

        if (field.name === 'message') {
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Le message est requis';
            } else if (field.value.trim().length < 10) {
                isValid = false;
                errorMessage = 'Le message doit contenir au moins 10 caractères';
            }
        }

        if (field.name === 'acceptTerms') {
            if (!field.checked) {
                isValid = false;
                errorMessage = 'Vous devez accepter les conditions';
            }
        }

        if (errorSpan) {
            errorSpan.textContent = errorMessage;
            field.closest('.form-group').classList.toggle('has-error', !isValid);
        }

        return isValid;
    }

    /**
     * Valider tous les champs
     */
    validateForm() {
        const inputs = this.form.querySelectorAll('.form-control, input[type="checkbox"]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    /**
     * Gérer la soumission du formulaire
     */
    async handleSubmit(e) {
        e.preventDefault();

        // Valider le formulaire
        if (!this.validateForm()) {
            this.showNotification('Veuillez corriger les erreurs du formulaire', 'error');
            return;
        }

        // Récupérer les données
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData);

        // Ajouter un timestamp
        data.timestamp = new Date().toISOString();
        data.userAgent = navigator.userAgent;

        // Afficher le loader
        const submitBtn = this.form.querySelector('.contact-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.classList.add('loading');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Message envoyé avec succès ! Nous vous recontacterons bientôt.', 'success');
                this.form.reset();
                
                // Scroll vers le bas du formulaire
                this.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                throw new Error(result.message || 'Erreur lors de l\'envoi');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showNotification(
                error.message || 'Une erreur est survenue. Veuillez réessayer.',
                'error'
            );
        } finally {
            // Restaurer le bouton
            submitBtn.classList.remove('loading');
            submitBtn.innerHTML = originalText;
        }
    }

    /**
     * Afficher une notification
     */
    showNotification(message, type = 'info') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: type,
                title: type === 'success' ? 'Succès' : type === 'error' ? 'Erreur' : 'Information',
                text: message,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000,
                timerProgressBar: true,
                background: document.body.classList.contains('dark-theme') ? '#1a1a1a' : '#fff',
                color: document.body.classList.contains('dark-theme') ? '#fff' : '#333'
            });
        } else {
            alert(message);
        }
    }
}

// Initialiser au chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.contactManager = new ContactManager();
    });
} else {
    window.contactManager = new ContactManager();
}
