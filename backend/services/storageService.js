/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║         🎥🔐🗓️ MODULE GALERIE COMPLET + CHAT + MENUS + PLANS V3.0 🔐🗓️🎥       ║
 * ║                                                                                    ║
 * ║  À COLLER DANS server.js AVANT le app.listen()                                   ║
 * ║  (Après les imports et avant la ligne ~7088)                                      ║
 * ║                                                                                    ║
 * ║  📸 Galeries photos complet (CRUD + Likes + Commentaires)                         ║
 * ║  💬 Chat ultra sécurisé (Socket.io préparé)                                       ║
 * ║  🍽️  Menus et plats complets                                                      ║
 * ║  🗺️  Plans interactifs avec descriptions                                          ║
 * ║  💾 Storage service intégré (local + cloud ready)                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

// ═════════════════════════════════════════════════════════════════════════════════════
// 🔧 1. IMPORTS ET CONFIGURATION DU STORAGE
// ═════════════════════════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const moment = require('moment');
const crypto = require('crypto');

const log = {
    banner: (text) => console.log(chalk.bold.cyan.bgBlack(`\n${'='.repeat(70)}\n${text}\n${'='.repeat(70)}\n`)),
    
    ultra: (msg, details = '') => console.log(chalk.bold.magenta(`[ULTRA]`), chalk.white(msg), chalk.gray(details)),
    info: (msg, details = '') => console.log(chalk.bold.blue(`[INFO]`), chalk.white(msg), chalk.gray(details)),
    success: (msg, details = '') => console.log(chalk.bold.green(`[✓ OK]`), chalk.white(msg), chalk.green(details)),
    warning: (msg, details = '') => console.log(chalk.bold.yellow(`[⚠ WARN]`), chalk.white(msg), chalk.yellow(details)),
    error: (msg, details = '') => console.log(chalk.bold.red(`[✗ ERR]`), chalk.white(msg), chalk.red(details)),
    
    api: (method, endpoint, status, duration = null) => {
        const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;
        const methodColor = method === 'GET' ? chalk.blue : method === 'POST' ? chalk.green : 
                           method === 'PUT' ? chalk.yellow : method === 'PATCH' ? chalk.magenta : 
                           method === 'DELETE' ? chalk.red : chalk.white;
        console.log(
            chalk.gray(`[${moment().format('HH:mm:ss.SSS')}]`),
            methodColor.bold(method.padEnd(7)),
            chalk.cyan(endpoint.padEnd(40)),
            statusColor(`→ ${status}`),
            duration ? chalk.gray(`(${duration}ms)`) : ''
        );
    },
    
    crud: (action, resource, data) => console.log(
        chalk.bold.cyan(`[💾 CRUD]`), 
        chalk.yellow(action.toUpperCase().padEnd(8)),
        chalk.white(resource.padEnd(15)),
        chalk.magenta(JSON.stringify(data).substring(0, 60) + '...')
    ),
    
    sync: (type, count) => console.log(chalk.bold.cyan(`[🔄 SYNC]`), chalk.white(`${type}:`), chalk.magenta(`${count} items`)),
    scan: (guestName) => console.log(chalk.bold.green(`[📷 SCAN]`), chalk.white(`Invité scanné:`), chalk.cyan(guestName)),
    backup: (filename) => console.log(chalk.bold.yellow(`[💾 BACKUP]`), chalk.white(`Sauvegarde:`), chalk.green(filename)),
    upload: (filename, size) => console.log(chalk.bold.green(`[📤 UPLOAD]`), chalk.white(filename), chalk.gray(`(${(size / 1024 / 1024).toFixed(2)}MB)`)),
    db: (action, count) => console.log(chalk.bold.blue(`[💾 DB]`), chalk.white(`${action}:`), chalk.magenta(`${count} records`)),
    
    validation: (field, status, message = '') => {
        const icon = status ? '✓' : '✗';
        const color = status ? chalk.green : chalk.red;
        console.log(color(`    ${icon} ${field.padEnd(20)}`), chalk.gray(message));
    },
    
    stats: (data) => {
        console.log(chalk.bold.cyan('\n📊 STATISTIQUES EN TEMPS RÉEL'));
        console.log(chalk.gray('─'.repeat(50)));
        Object.entries(data).forEach(([key, value]) => {
            console.log(chalk.white('  ' + key.padEnd(25)), chalk.bold.magenta(String(value).padStart(10)));
        });
        console.log(chalk.gray('─'.repeat(50)) + '\n');
    },
    
    separator: () => console.log(chalk.gray('─'.repeat(70))),
    
    box: (lines) => {
        const maxLen = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length));
        console.log(chalk.cyan('╔' + '═'.repeat(maxLen + 2) + '╗'));
        lines.forEach(line => {
            const cleanLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
            const padding = ' '.repeat(maxLen - cleanLen);
            console.log(chalk.cyan('║'), line + padding, chalk.cyan('║'));
        });
        console.log(chalk.cyan('╚' + '═'.repeat(maxLen + 2) + '╝'));
    }
};


// ═════════════════════════════════════════════════════════════════════════════════════
// 🎨 2. SERVICE STORAGE INTÉGRÉ
// ═════════════════════════════════════════════════════════════════════════════════════
const CONFIG = {
    PORT: process.env.PORT || 3000,
    BASE_URL: process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://localhost:${process.env.PORT || 3000}`,
};
class StorageManager {
    constructor() {
        this.uploadsDir = path.join(__dirname, '..', 'uploads');
        this.galleriesDir = path.join(this.uploadsDir, 'galleries');
        this.menusDir = path.join(this.uploadsDir, 'menus');
        this.thumbsDir = path.join(this.uploadsDir, 'thumbnails');
        this.tempDir = path.join(this.uploadsDir, 'temp');
        this.fileIndex = new Map();
        
        this.initializeFolders();
    }

    initializeFolders() {
        [this.uploadsDir, this.galleriesDir, this.menusDir, this.thumbsDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                log.success(`Dossier créé`, dir);
            }
        });
    }

    generateFileHash(data) {
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }

    generateFileName(originalName, folder = 'gallery') {
        const ext = path.extname(originalName).toLowerCase();
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const random = crypto.randomBytes(4).toString('hex');
        return `${folder}_${timestamp}_${random}${ext}`;
    }

    /**
     * Construit une URL complète basée sur le baseURL de la requête
     * @param {string} relativePath - Chemin relatif (ex: /uploads/galleries/file.jpg)
     * @param {string} requestBaseUrl - BaseURL de la requête (ex: http://localhost:3000)
     * @returns {string} URL complète
     */
    buildFileUrl(relativePath, requestBaseUrl = CONFIG.BASE_URL) {
        return `${requestBaseUrl}${relativePath}`;
    }

    /**
     * Construit le chemin relatif d'un fichier
     * @param {string} filename - Nom du fichier
     * @param {string} folder - Type de dossier (gallery, menu, etc.)
     * @returns {string} Chemin relatif
     */
    buildRelativePath(filename, folder = 'gallery') {
        const folderPath = folder === 'menu' ? 'menus' : 'galleries';
        return `/uploads/${folderPath}/${filename}`;
    }

    /**
     * Reconstruit les URLs d'un objet fichier avec le baseURL approprié
     * @param {object} fileInfo - Objet fichier avec path et thumbnails
     * @param {string} requestBaseUrl - BaseURL de la requête (ex: http://localhost:3000)
     * @returns {object} Objet fichier avec URLs complètes
     */
    buildFileUrls(fileInfo, requestBaseUrl = CONFIG.BASE_URL) {
        if (!fileInfo) return fileInfo;

        return {
            ...fileInfo,
            url: this.buildFileUrl(fileInfo.path, requestBaseUrl),
            thumbnails: fileInfo.thumbnails ? {
                small: this.buildFileUrl(fileInfo.thumbnails.small?.split('?')[0], requestBaseUrl) + '?size=small',
                medium: this.buildFileUrl(fileInfo.thumbnails.medium?.split('?')[0], requestBaseUrl) + '?size=medium',
                large: this.buildFileUrl(fileInfo.thumbnails.large?.split('?')[0], requestBaseUrl) + '?size=large'
            } : {}
        };
    }

    /**
     * Reconstruit les URLs pour une galerie entière
     * @param {object} gallery - Objet galerie
     * @param {string} requestBaseUrl - BaseURL de la requête
     * @returns {object} Galerie avec URLs reconstruites
     */
    buildGalleryUrls(gallery, requestBaseUrl = CONFIG.BASE_URL) {
        if (!gallery) return gallery;

        const rebuilt = {
            ...gallery,
            metadata: {
                ...gallery.metadata,
                coverPhotoUrl: gallery.metadata?.coverPhotoUrl 
                    ? this.buildFileUrl(gallery.metadata.coverPhotoUrl, requestBaseUrl)
                    : undefined
            },
            photos: gallery.photos ? gallery.photos.map(photo => ({
                ...photo,
                url: photo.url ? this.buildFileUrl(photo.url, requestBaseUrl) : undefined,
                downloadUrl: photo.downloadUrl ? this.buildFileUrl(photo.downloadUrl, requestBaseUrl) : undefined,
                thumbnails: photo.thumbnails ? {
                    small: this.buildFileUrl(photo.thumbnails.small?.split('?')[0], requestBaseUrl) + '?size=small',
                    medium: this.buildFileUrl(photo.thumbnails.medium?.split('?')[0], requestBaseUrl) + '?size=medium',
                    large: this.buildFileUrl(photo.thumbnails.large?.split('?')[0], requestBaseUrl) + '?size=large'
                } : {}
            })) : []
        };

        return rebuilt;
    }

    async uploadFile(fileData, folder = 'gallery', metadata = {}) {
        try {
            if (!fileData.buffer || !fileData.filename) {
                throw new Error('Données fichier invalides');
            }

            if (fileData.size > 20 * 1024 * 1024) {
                throw new Error('Fichier trop volumineux (max 20MB)');
            }

            const ext = path.extname(fileData.filename).substring(1).toLowerCase();
            const uniqueName = this.generateFileName(fileData.filename, folder);
            const fileHash = this.generateFileHash(fileData.buffer);

            const targetDir = folder === 'menu' ? this.menusDir : this.galleriesDir;
            const filePath = path.join(targetDir, uniqueName);

            // Sauvegarder le fichier
            fs.writeFileSync(filePath, fileData.buffer);

            // Construire le chemin relatif (sans baseURL)
            const relativePath = this.buildRelativePath(uniqueName, folder);

            // Créer les miniatures si image (sans baseURL)
            const thumbnails = {};
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
                thumbnails.small = `/uploads/thumbnails/${uniqueName}?size=small`;
                thumbnails.medium = `/uploads/thumbnails/${uniqueName}?size=medium`;
                thumbnails.large = `/uploads/thumbnails/${uniqueName}?size=large`;
            }

            const fileInfo = {
                id: `file_${fileHash}_${moment().unix()}`,
                originalName: fileData.filename,
                filename: uniqueName,
                size: fileData.size,
                mimetype: fileData.mimetype,
                extension: ext,
                hash: fileHash,
                path: relativePath,  // Chemin relatif SANS baseURL
                url: this.buildFileUrl(relativePath),  // URL complète avec CONFIG.BASE_URL
                folder: folder,
                thumbnails: thumbnails,
                uploadedAt: new Date().toISOString(),
                metadata: {
                    userId: metadata.userId,
                    tags: metadata.tags || [],
                    ...metadata
                }
            };

            this.fileIndex.set(fileInfo.id, fileInfo);
            log.upload(uniqueName, fileData.size);
            
            return fileInfo;

        } catch (err) {
            log.error('Upload fichier', err.message);
            throw err;
        }
    }

    deleteFile(fileIdOrPath) {
        try {
            let filePath = null;
            let fileName = null;

            // Essayer d'abord via le fileIndex (si le serveur n'a pas redémarré)
            const file = this.fileIndex.get(fileIdOrPath);
            if (file) {
                const baseDir = file.folder === 'menu' ? this.menusDir : this.galleriesDir;
                filePath = path.join(baseDir, file.filename);
                fileName = file.filename;
                this.fileIndex.delete(fileIdOrPath);
            } else {
                // Si pas trouvé dans l'index, essayer comme chemin direct
                // Le fileIdOrPath peut être un chemin relatif comme /uploads/galleries/... ou avec query params
                if (fileIdOrPath.includes('/')) {
                    // Nettoyer les paramètres query (?size=small, etc.)
                    const pathWithoutQuery = fileIdOrPath.split('?')[0];
                    const cleanPath = pathWithoutQuery.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
                    
                    if (cleanPath.startsWith('galleries/')) {
                        filePath = path.join(this.galleriesDir, cleanPath.replace('galleries/', ''));
                    } else if (cleanPath.startsWith('thumbnails/')) {
                        filePath = path.join(this.thumbsDir, cleanPath.replace('thumbnails/', ''));
                    } else if (cleanPath.startsWith('menus/')) {
                        filePath = path.join(this.menusDir, cleanPath.replace('menus/', ''));
                    } else if (cleanPath.includes('galleries')) {
                        // Extraire le nom de fichier si chemin complet
                        const filename = path.basename(cleanPath);
                        filePath = path.join(this.galleriesDir, filename);
                    } else {
                        filePath = path.join(this.uploadsDir, cleanPath);
                    }
                    fileName = path.basename(filePath);
                } else {
                    // Si c'est juste un ID et qu'on l'a pas trouvé, échouer silencieusement
                    log.warning('Suppression fichier', `FileId non trouvé dans l'index: ${fileIdOrPath}`);
                    return true; // Continuer quand même (le fichier n'existe probablement pas)
                }
            }

            // Supprimer le fichier s'il existe
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                log.crud('DELETE', 'file', { file: fileName });
                return true;
            } else {
                // Le fichier n'existe pas, mais ce n'est pas une erreur critique
                log.warning('Suppression fichier', `Fichier non trouvé sur disque: ${filePath}`);
                return true; // Retourner true car l'objectif (ne pas avoir le fichier) est atteint
            }

        } catch (err) {
            log.error('Suppression fichier', err.message);
            return false;
        }
    }
    

    getStorageStats() {
        let totalSize = 0;
        const calculateDirSize = (dir) => {
            if (!fs.existsSync(dir)) return 0;
            return fs.readdirSync(dir).reduce((size, file) => {
                const stat = fs.statSync(path.join(dir, file));
                return size + (stat.isFile() ? stat.size : 0);
            }, 0);
        };

        totalSize = calculateDirSize(this.galleriesDir) + calculateDirSize(this.menusDir);

        return {
            totalSize: totalSize,
            totalSizeFormatted: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            fileCount: this.fileIndex.size,
            quotaUsed: `${((totalSize / (1024 * 1024 * 1024)) * 100).toFixed(2)}%`
        };
    }

    cleanupTempFiles() {
        let deleted = 0;
        try {
            const now = moment();
            if (fs.existsSync(this.tempDir)) {
                fs.readdirSync(this.tempDir).forEach(file => {
                    const filePath = path.join(this.tempDir, file);
                    const stat = fs.statSync(filePath);
                    const fileAge = now.diff(moment(stat.mtimeMs), 'hours');
                    
                    if (fileAge > 24) {
                        fs.unlinkSync(filePath);
                        deleted++;
                    }
                });
            }
            if (deleted > 0) log.success(`Nettoyage ${deleted} fichiers temp`);
            return deleted;
        } catch (err) {
            log.error('Nettoyage temp', err.message);
            return 0;
        }
    }
}

const storageManager = new StorageManager();

module.exports = storageManager;