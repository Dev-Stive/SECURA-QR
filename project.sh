#!/bin/bash

# Nom du répertoire racine
ROOT_DIR="backend"

# Création du répertoire racine
mkdir -p "$ROOT_DIR"
cd "$ROOT_DIR"

# Création des dossiers principaux
mkdir -p config controllers middleware models repositories services routes utils/{validation,helpers} templates/{emails,pdf} jobs storage/{uploads,qrcodes,galleries,backups,cache} data/migrations logs tests/{unit,integration,e2e} docs scripts

# --- Dossiers et fichiers de CONFIG ---
touch config/config.js
touch config/database.js
touch config/firebase.js
touch config/oauth.js
touch config/email.js
touch config/storage.js
touch config/cache.js
touch config/constants.js

# --- Dossiers et fichiers CONTROLLERS ---
touch controllers/authController.js
touch controllers/eventController.js
touch controllers/guestController.js
touch controllers/qrCodeController.js
touch controllers/scanController.js
touch controllers/invitationController.js
touch controllers/sessionController.js
touch controllers/permissionController.js
touch controllers/galleryController.js
touch controllers/consultationController.js
touch controllers/statisticsController.js
touch controllers/backupController.js
touch controllers/syncController.js

# --- Dossiers et fichiers MIDDLEWARE ---
touch middleware/authMiddleware.js
touch middleware/roleMiddleware.js
touch middleware/permissionMiddleware.js
touch middleware/validationMiddleware.js
touch middleware/rateLimitMiddleware.js
touch middleware/corsMiddleware.js
touch middleware/errorMiddleware.js
touch middleware/loggingMiddleware.js
touch middleware/cacheMiddleware.js
touch middleware/offlineMiddleware.js
touch middleware/uploadMiddleware.js

# --- Dossiers et fichiers MODELS ---
touch models/userModel.js
touch models/eventModel.js
touch models/guestModel.js
touch models/qrCodeModel.js
touch models/scanModel.js
touch models/invitationModel.js
touch models/sessionModel.js
touch models/permissionModel.js
touch models/roleModel.js
touch models/galleryModel.js
touch models/tableQRModel.js
touch models/messageModel.js
touch models/settingModel.js

# --- Dossiers et fichiers REPOSITORIES ---
touch repositories/userRepo.js
touch repositories/eventRepo.js
touch repositories/guestRepo.js
touch repositories/qrCodeRepo.js
touch repositories/scanRepo.js
touch repositories/invitationRepo.js
touch repositories/sessionRepo.js
touch repositories/permissionRepo.js
touch repositories/galleryRepo.js
touch repositories/messageRepo.js
touch repositories/index.js

# --- Dossiers et fichiers SERVICES ---
touch services/authService.js
touch services/firebaseService.js
touch services/oauthService.js
touch services/tokenService.js
touch services/eventService.js
touch services/guestService.js
touch services/qrService.js
touch services/scanService.js
touch services/invitationService.js
touch services/emailService.js
touch services/smsService.js
touch services/sessionService.js
touch services/permissionService.js
touch services/galleryService.js
touch services/storageService.js
touch services/consultationService.js
touch services/messageService.js
touch services/statisticsService.js
touch services/backupService.js
touch services/syncService.js
touch services/cacheService.js
touch services/loggerService.js
touch services/notificationService.js
touch services/analyticsService.js

# --- Dossiers et fichiers ROUTES ---
touch routes/index.js
touch routes/authRoutes.js
touch routes/eventRoutes.js
touch routes/guestRoutes.js
touch routes/qrCodeRoutes.js
touch routes/scanRoutes.js
touch routes/invitationRoutes.js
touch routes/sessionRoutes.js
touch routes/permissionRoutes.js
touch routes/galleryRoutes.js
touch routes/consultationRoutes.js
touch routes/messageRoutes.js
touch routes/statisticsRoutes.js
touch routes/backupRoutes.js
touch routes/syncRoutes.js
touch routes/healthRoutes.js

# --- Dossiers et fichiers UTILS/VALIDATION ---
touch utils/validation/authValidation.js
touch utils/validation/eventValidation.js
touch utils/validation/guestValidation.js
touch utils/validation/qrValidation.js
touch utils/validation/invitationValidation.js
touch utils/validation/galleryValidation.js
touch utils/validation/messageValidation.js

# --- Dossiers et fichiers UTILS/HELPERS ---
touch utils/helpers/idGenerator.js
touch utils/helpers/dateHelper.js
touch utils/helpers/stringHelper.js
touch utils/helpers/fileHelper.js
touch utils/helpers/qrHelper.js
touch utils/helpers/emailHelper.js
touch utils/helpers/imageHelper.js
touch utils/helpers/csvHelper.js

# --- Dossiers et fichiers UTILS (racine) ---
touch utils/errorHandler.js
touch utils/logger.js
touch utils/responseFormatter.js
touch utils/security.js
touch utils/constants.js

# --- Dossiers et fichiers TEMPLATES/EMAILS ---
touch templates/emails/invitation.html
touch templates/emails/reminder.html
touch templates/emails/confirmation.html
touch templates/emails/qrCode.html
touch templates/emails/thankyou.html

# --- Dossiers et fichiers TEMPLATES/PDF ---
touch templates/pdf/ticket.html
touch templates/pdf/guestList.html

# --- Dossiers et fichiers JOBS ---
touch jobs/cleanupJob.js
touch jobs/backupJob.js
touch jobs/reminderJob.js
touch jobs/syncJob.js
touch jobs/analyticsJob.js

# --- Dossiers et fichiers DATA ---
touch data/secura-data.json

# --- Dossiers et fichiers LOGS ---
touch logs/error.log
touch logs/combined.log
touch logs/access.log
touch logs/security.log

# --- Dossiers et fichiers TESTS/UNIT ---
touch tests/unit/auth.test.js
touch tests/unit/event.test.js
touch tests/unit/guest.test.js
touch tests/unit/qrCode.test.js
touch tests/unit/scan.test.js

# --- Dossiers et fichiers TESTS/INTEGRATION ---
touch tests/integration/api.test.js
touch tests/integration/offline.test.js
touch tests/integration/sync.test.js

# --- Dossiers et fichiers TESTS/E2E ---
touch tests/e2e/workflow.test.js

# --- Dossiers et fichiers DOCS ---
touch docs/API.md
touch docs/ARCHITECTURE.md
touch docs/DEPLOYMENT.md
touch docs/OFFLINE_MODE.md
touch docs/PERMISSIONS.md

# --- Dossiers et fichiers SCRIPTS ---
touch scripts/setup.sh
touch scripts/migrate.js
touch scripts/seed.js
touch scripts/cleanup.js

# --- Fichiers à la racine ---
touch .env.example
touch .gitignore
touch package.json
touch app.js
touch server.js
touch README.md

echo "✅ Arborescence '$ROOT_DIR' créée avec succès."