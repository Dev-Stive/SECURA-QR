/**
 * Language Manager
 * Gère la sélection et la persistance de la langue
 */

class LanguageManager {
    constructor() {
        this.currentLanguage = this.getStoredLanguage() || 'fr';
        this.languages = {
            fr: {
                name: 'Français',
                flag: '🇫🇷',
                code: 'fr'
            },
            en: {
                name: 'English',
                flag: '🇬🇧',
                code: 'en'
            },
            es: {
                name: 'Español',
                flag: '🇪🇸',
                code: 'es'
            },
            de: {
                name: 'Deutsch',
                flag: '🇩🇪',
                code: 'de'
            },
            it: {
                name: 'Italiano',
                flag: '🇮🇹',
                code: 'it'
            },
            pt: {
                name: 'Português',
                flag: '🇵🇹',
                code: 'pt'
            }
        };

        this.translations = {
            fr: {
                'home': 'Accueil',
                'features': 'Fonctionnalités',
                'how-it-works': 'Comment ça marche',
                'events': 'Événements',
                'access': 'Accès événement',
                'contact': 'Contact',
                'language': 'Langue',
                'select-language': 'Sélectionner une langue',
                'theme': 'Thème',
                'light': 'Clair',
                'dark': 'Sombre'
            },
            en: {
                'home': 'Home',
                'features': 'Features',
                'how-it-works': 'How it works',
                'events': 'Events',
                'access': 'Event access',
                'contact': 'Contact',
                'language': 'Language',
                'select-language': 'Select a language',
                'theme': 'Theme',
                'light': 'Light',
                'dark': 'Dark'
            },
            es: {
                'home': 'Inicio',
                'features': 'Características',
                'how-it-works': 'Cómo funciona',
                'events': 'Eventos',
                'access': 'Acceso a eventos',
                'contact': 'Contacto',
                'language': 'Idioma',
                'select-language': 'Seleccionar idioma',
                'theme': 'Tema',
                'light': 'Claro',
                'dark': 'Oscuro'
            },
            de: {
                'home': 'Startseite',
                'features': 'Funktionen',
                'how-it-works': 'Wie es funktioniert',
                'events': 'Veranstaltungen',
                'access': 'Veranstaltungszugang',
                'contact': 'Kontakt',
                'language': 'Sprache',
                'select-language': 'Sprache auswählen',
                'theme': 'Design',
                'light': 'Hell',
                'dark': 'Dunkel'
            },
            it: {
                'home': 'Home',
                'features': 'Caratteristiche',
                'how-it-works': 'Come funziona',
                'events': 'Eventi',
                'access': 'Accesso evento',
                'contact': 'Contatti',
                'language': 'Lingua',
                'select-language': 'Seleziona una lingua',
                'theme': 'Tema',
                'light': 'Chiaro',
                'dark': 'Scuro'
            },
            pt: {
                'home': 'Início',
                'features': 'Recursos',
                'how-it-works': 'Como funciona',
                'events': 'Eventos',
                'access': 'Acesso ao evento',
                'contact': 'Contato',
                'language': 'Idioma',
                'select-language': 'Selecionar idioma',
                'theme': 'Tema',
                'light': 'Claro',
                'dark': 'Escuro'
            }
        };

        this.init();
    }

    /**
     * Initialiser le gestionnaire de langue
     */
    init() {
        this.setupLanguageSelector();
        this.setupEventListeners();
        this.applyLanguage(this.currentLanguage);
    }

    /**
     * Configurer le sélecteur de langue
     */
    setupLanguageSelector() {
        const languageSelector = document.querySelector('.language-selector');
        if (!languageSelector) return;

        // Créer le contenu du sélecteur
        const currentLang = this.languages[this.currentLanguage];
        
        languageSelector.innerHTML = `
            <button class="language-trigger" aria-label="Sélectionner une langue">
                <span class="language-current">
                    <span class="flag">${currentLang.flag}</span>
                    <span class="lang-name">${currentLang.name}</span>
                </span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="language-dropdown">
                <div class="language-cards">
                    ${Object.entries(this.languages).map(([code, lang]) => `
                        <button class="language-card ${code === this.currentLanguage ? 'active' : ''}" 
                                data-lang="${code}"
                                aria-label="Sélectionner ${lang.name}">
                            <span class="flag">${lang.flag}</span>
                            <span class="lang-name">${lang.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Configurer les écouteurs d'événements
     */
    setupEventListeners() {
        const languageSelector = document.querySelector('.language-selector');
        if (!languageSelector) return;

        const trigger = languageSelector.querySelector('.language-trigger');
        const dropdown = languageSelector.querySelector('.language-dropdown');
        const cards = languageSelector.querySelectorAll('.language-card');

        // Ouvrir/fermer le dropdown
        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        // Fermer le dropdown quand on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!languageSelector.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        // Sélectionner une langue
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = card.dataset.lang;
                this.setLanguage(lang);
                dropdown.classList.remove('active');
            });
        });

        // Clavier
        trigger?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropdown.classList.toggle('active');
            }
            if (e.key === 'Escape') {
                dropdown.classList.remove('active');
            }
        });
    }

    /**
     * Définir la langue
     */
    setLanguage(lang) {
        if (!this.languages[lang]) {
            console.warn(`Langue non supportée: ${lang}`);
            return;
        }

        this.currentLanguage = lang;
        this.saveLanguage(lang);
        this.applyLanguage(lang);
        this.setupLanguageSelector();
        this.setupEventListeners();

        // Dispatcher un événement personnalisé
        window.dispatchEvent(new CustomEvent('languageChange', { 
            detail: { language: lang } 
        }));
    }

    /**
     * Appliquer les traductions
     */
    applyLanguage(lang) {
        const translations = this.translations[lang] || this.translations['fr'];
        const self = this;
        const newTranslations = this.translations[lang] || this.translations['fr'];

        // Mettre à jour tous les éléments avec data-i18n (conserve le comportement existant)
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (newTranslations[key]) {
            element.textContent = newTranslations[key];
            }
        });

        // Fonction utilitaire : remplacer toutes les occurrences des textes d'autres langues par la nouvelle traduction
        const replaceUsingTranslations = (str) => {
            if (!str) return str;
            // Parcourir toutes les langues et leurs clés pour remplacer les anciens textes par les nouveaux
            for (const [, transMap] of Object.entries(self.translations)) {
            for (const key of Object.keys(transMap)) {
                const from = transMap[key];
                const to = newTranslations[key] || from;
                if (from && from !== to && str.includes(from)) {
                str = str.split(from).join(to);
                }
            }
            }
            return str;
        };

        // Mettre à jour tous les nœuds de texte dans le body (sauf script/style/textarea/code/pre)
        if (document.body) {
            const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tag = parent.tagName.toLowerCase();
                if (['script', 'style', 'textarea', 'code', 'pre'].includes(tag)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
            );

            while (walker.nextNode()) {
            const tn = walker.currentNode;
            const replaced = replaceUsingTranslations(tn.nodeValue);
            if (replaced !== tn.nodeValue) tn.nodeValue = replaced;
            }
        }

        // Mettre à jour les attributs courants (placeholder, title, alt, aria-label)
        document.querySelectorAll('*').forEach(el => {
            ['placeholder', 'title', 'alt', 'aria-label'].forEach(attr => {
            if (el.hasAttribute(attr)) {
                const val = el.getAttribute(attr);
                const newVal = replaceUsingTranslations(val);
                if (newVal !== val) el.setAttribute(attr, newVal);
            }
            });
        });

        // Mettre à jour l'attribut lang du document
        document.documentElement.lang = lang;

        // Mettre à jour la direction (RTL pour certaines langues si nécessaire)
        // document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }

    /**
     * Obtenir la langue stockée
     */
    getStoredLanguage() {
        try {
            return localStorage.getItem('selectedLanguage') || null;
        } catch (e) {
            console.warn('localStorage non disponible');
            return null;
        }
    }

    /**
     * Sauvegarder la langue
     */
    saveLanguage(lang) {
        try {
            localStorage.setItem('selectedLanguage', lang);
        } catch (e) {
            console.warn('Impossible de sauvegarder la langue');
        }
    }

    /**
     * Obtenir une traduction
     */
    translate(key, lang = null) {
        const language = lang || this.currentLanguage;
        const translations = this.translations[language] || this.translations['fr'];
        return translations[key] || key;
    }

    /**
     * Obtenir la langue actuelle
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Obtenir tous les langues disponibles
     */
    getAvailableLanguages() {
        return this.languages;
    }
}

// Initialiser le gestionnaire de langue au chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.languageManager = new LanguageManager();
    });
} else {
    window.languageManager = new LanguageManager();
}
