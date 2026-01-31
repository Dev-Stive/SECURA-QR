/**
 * SECURA - Theme Manager
 * Gestion du thème clair/sombre
 */

class ThemeManager {
    constructor() {
        this.themeKey = 'secura_theme';
        this.init();
    }

    init() {
        // Charger le thème sauvegardé ou utiliser la préférence système
        const savedTheme = localStorage.getItem(this.themeKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        this.applyTheme(theme);
        this.setupListeners();
        this.setupFooterSwitch();
    }


      setupFooterSwitch() {
        const themeSwitchFooter = document.getElementById('themeSwitchFooter');
        if (themeSwitchFooter) {
            const currentTheme = this.getCurrentTheme();
            themeSwitchFooter.checked = currentTheme === 'dark';
            
            themeSwitchFooter.addEventListener('change', () => this.toggleTheme());
            
            document.addEventListener('themeChanged', () => {
                const theme = this.getCurrentTheme();
                themeSwitchFooter.checked = theme === 'dark';
            });
        }
    }

    setupListeners() {
        const themeToggles = document.querySelectorAll('.theme-toggle');
        themeToggles.forEach(btn => {
            btn.addEventListener('click', () => this.toggleTheme());
        });

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.themeKey)) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        localStorage.setItem(this.themeKey, newTheme);
    }

    applyTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(`${theme}-theme`);
        
        // Mettre à jour l'icône du bouton
        // Mettre à jour l'icône sur tous les boutons de toggle
        const themeToggles = document.querySelectorAll('.theme-toggle');
        themeToggles.forEach(btn => {
            const icon = btn.querySelector('i');
            if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        });

        // Mettre à jour la meta theme-color
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.name = 'theme-color';
            document.head.appendChild(metaTheme);
        }
        metaTheme.content = theme === 'light' ? '#FAFAFA' : '#1b1b18';
    }

    getCurrentTheme() {
        return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    }
}

const themeManager = new ThemeManager();