
// Fonction helper améliorée pour utiliser les nouveaux styles
function showToast(message, type = 'success', options = {}) {
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle',
        primary: 'fas fa-star'
    };
    
    const defaultOptions = {
        duration: 3000,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
        className: type,
        escapeMarkup: false,
        onClick: options.onClick || null
    };
    
    const toastOptions = { ...defaultOptions, ...options };
    
    // Créer le contenu HTML avec icône
    const icon = icons[type] || icons.info;
    const html = `
        <div class="toast-content">
            <i class="${icon}"></i>
            <div>
                <div class="toast-message">${message}</div>
            </div>
        </div>
    `;
    
    // Afficher le toast
    const toast = Toastify({
        text: html,
        ...toastOptions
    });
    
    toast.showToast();
    
    // Ajouter un bouton de fermeture si demandé
    if (options.closeButton) {
        setTimeout(() => {
            const toastElement = document.querySelector('.toastify:last-child');
            if (toastElement) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'toast-close';
                closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                closeBtn.onclick = () => toast.hideToast();
                toastElement.appendChild(closeBtn);
            }
        }, 100);
    }
    
    return toast;
}

// Fonctions spécifiques par type
function showSuccess(message, options = {}) {
    return showToast(message, 'success', options);
}

function showError(message, options = {}) {
    return showToast(message, 'error', options);
}

function showWarning(message, options = {}) {
    return showToast(message, 'warning', options);
}

function showInfo(message, options = {}) {
    return showToast(message, 'info', options);
}

function showPrimary(message, options = {}) {
    return showToast(message, 'primary', options);
}

function showToastWithAvatar(message, avatarText, type = 'info', options = {}) {
    const icon = type === 'success' ? 'fas fa-check-circle' :
                 type === 'error' ? 'fas fa-exclamation-circle' :
                 type === 'warning' ? 'fas fa-exclamation-triangle' :
                 'fas fa-info-circle';
    
    const html = `
        <div class="toast-content">
            <div class="toast-avatar">${avatarText}</div>
            <div>
                <div class="toast-message">${message}</div>
            </div>
        </div>
    `;
    
    return Toastify({
        text: html,
        duration: options.duration || 4000,
        gravity: options.gravity || "top",
        position: options.position || "right",
        className: type,
        stopOnFocus: true,
        escapeMarkup: false
    }).showToast();
}

function showToastWithProgress(message, type = 'info', duration = 5000) {
    const icon = type === 'success' ? 'fas fa-check-circle' :
                 type === 'error' ? 'fas fa-exclamation-circle' :
                 type === 'warning' ? 'fas fa-exclamation-triangle' :
                 'fas fa-info-circle';
    
    const html = `
        <div class="toast-content">
            <i class="${icon}"></i>
            <div>
                <div class="toast-message">${message}</div>
            </div>
        </div>
    `;
    
    const toast = Toastify({
        text: html,
        duration: duration,
        gravity: "top",
        position: "right",
        className: `${type} progress`,
        stopOnFocus: true,
        escapeMarkup: false
    }).showToast();
    
    return toast;
}

function showImportantToast(message, type = 'error') {
    return showToast(message, type, {
        duration: 5000,
        className: `${type} important`,
        closeButton: true
    });
}

// Exporter les fonctions globalement
window.showToast = showToast;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.showPrimary = showPrimary;
window.showToastWithAvatar = showToastWithAvatar;
window.showToastWithProgress = showToastWithProgress;
window.showImportantToast = showImportantToast;