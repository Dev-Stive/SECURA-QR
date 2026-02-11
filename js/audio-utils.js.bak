/* ===== SECURA AUDIO PRO - ULTRA FIABLE (corrigé + stop) ===== */
const SECURA_AUDIO = {
    sounds: {
        success: '/assets/sounds/success.wav',
        error: '/assets/sounds/error.wav',
        scan: '/assets/sounds/scan.wav',
        notify: '/assets/sounds/notify.wav',
        welcome: '/assets/sounds/notify.wav',
        beep: '/assets/sounds/beep.wav'
    },
    volume: 0.7,
    context: null,
    loaded: false,
    currentAudio: null, // 🔊 Référence à l'audio en cours

    preload() {
        if (this.loaded) return;
        Object.values(this.sounds).forEach(src => {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.load();
        });
        this.loaded = true;
    },

    initContext() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    },

    play(type = 'notify') {
        if (!this.sounds[type]) return;
        this.initContext();

        // Arrêter tout son précédent avant d’en jouer un nouveau
        this.stop();

        const audio = new Audio(this.sounds[type]);
        audio.volume = this.volume;
        audio.play().catch(() => this.beep());

        this.currentAudio = audio; // 🔊 Garde la référence pour stop()
    },

    // Arrêter le son en cours
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    },

    beep(frequency = 800, duration = 200) {
        this.initContext();
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration / 1000);
        oscillator.start();
        oscillator.stop(this.context.currentTime + duration / 1000);
    },

    success() {
        this.play('success');
        this.vibrate([100, 50, 100]);
        this.flash('#22c55e');
    },

    error() {
        this.play('error');
        this.vibrate([200, 100, 200]);
        this.flash('#ef4444');
    },

    scan() {
        this.play('scan');
        this.vibrate([50, 50, 50]);
        this.flash('#d39349ff');
    },

    vibrate(pattern = [100]) {
        if ('vibrate' in navigator) navigator.vibrate(pattern);
    },

    flash(color = '#3b82f6', duration = 300) {
        const flash = Object.assign(document.createElement('div'), {
            style: `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: ${color}; opacity: 0; pointer-events: none;
                transition: opacity ${duration}ms; z-index: 9999;
            `
        });
        document.body.appendChild(flash);
        requestAnimationFrame(() => (flash.style.opacity = '0.3'));
        setTimeout(() => flash.remove(), duration);
    }
};

['click', 'touchstart'].forEach(event =>
    document.addEventListener(event, () => {
        SECURA_AUDIO.initContext();
        SECURA_AUDIO.preload();
    }, { once: true })
);
