/**
 * @file index.js
 * @description Point d'entrée pour toutes les validations Joi Secura.
 * @module utils/validation
 */

// Auth validations
const {
  validateUser,
  validateCreateUser,
  validateUpdateUser,
  validateLogin,
  validateRegister,
  validateChangePassword,
  validateResetPassword,
  validateForgotPassword
} = require('./authValidation');

// Event validations
const {
  validateEvent,
  validateCreateEvent,
  validateUpdateEvent,
  validateEventSettings,
  validateEventDesign
} = require('./eventValidation');

// Guest validations
const {
  validateGuest,
  validateCreateGuest,
  validateUpdateGuest,
  validateBulkGuests,
  validateGuestScan,
  validateGuestConfirmation
} = require('./guestValidation');

// QR Code validations
const {
  validateQRCode,
  validateCreateQRCode,
  validateUpdateQRCode,
  validateGenerateQRCode,
  validateQRCodeData,
  validateQRScan,
  validateRawQRData,
  validateVerifyQRCode
} = require('./qrValidation');

// Scan validations
const {
  validateScan,
  validateCreateScan,
  validateUpdateScan,
  validateRealTimeScan,
  validateOfflineScan,
  validateOfflineSync,
  validateScanStatsQuery
} = require('./scanValidation');

// Session validations
const {
  validateSession,
  validateCreateSession,
  validateUpdateSession,
  validateJoinSession,
  validateSessionHeartbeat,
  validateLeaveSession,
  validateAgentPresence,
  validateSessionStats
} = require('./sessionValidation');

// Gallery validations
const {
  validateGallery,
  validateCreateGallery,
  validateUpdateGallery,
  validatePhotoUpload,
  validatePhotoModeration,
  validatePhotoComment
} = require('./galleryValidation');

// Message validations
const {
  validateMessage,
  validateCreateMessage,
  validateUpdateMessage,
  validateModerateMessage,
  validateLikeMessage,
  validateReportMessage,
  validateReplyMessage,
  validateBulkMessages
} = require('./messageValidation');

// Invitation validations
const {
  validateInvitation,
  validateCreateInvitation,
  validateUpdateInvitation,
  validateSendInvitation,
  validateTrackInvitation,
  validateRespondInvitation,
  validateBulkSend
} = require('./invitationValidation');

// Table QR validations
const {
  validateTableQR,
  validateCreateTableQR,
  validateUpdateTableQR,
  validateAssignGuestToTable,
  validateScanTableQR,
  validateGenerateTableQRData,
  validateBulkCreateTables
} = require('./tableQRValidation');

// Permission validations
const {
  validatePermission,
  validateRole,
  validateCreatePermission,
  validateCreateRole,
  validateUpdatePermission,
  validateUpdateRole,
  validateAssignRole,
  validateAssignPermission,
  validateCheckPermission,
  validateRoleHierarchy
} = require('./permissionValidation');

// Export de tous les schémas et validateurs
module.exports = {
  // Auth
  validateUser,
  validateCreateUser,
  validateUpdateUser,
  validateLogin,
  validateRegister,
  validateChangePassword,
  validateResetPassword,
  validateForgotPassword,

  // Event
  validateEvent,
  validateCreateEvent,
  validateUpdateEvent,
  validateEventSettings,
  validateEventDesign,

  // Guest
  validateGuest,
  validateCreateGuest,
  validateUpdateGuest,
  validateBulkGuests,
  validateGuestScan,
  validateGuestConfirmation,

  // QR Code
  validateQRCode,
  validateCreateQRCode,
  validateUpdateQRCode,
  validateGenerateQRCode,
  validateQRCodeData,
  validateQRScan,
  validateRawQRData,
  validateVerifyQRCode,

  // Scan
  validateScan,
  validateCreateScan,
  validateUpdateScan,
  validateRealTimeScan,
  validateOfflineScan,
  validateOfflineSync,
  validateScanStatsQuery,

  // Session
  validateSession,
  validateCreateSession,
  validateUpdateSession,
  validateJoinSession,
  validateSessionHeartbeat,
  validateLeaveSession,
  validateAgentPresence,
  validateSessionStats,

  // Gallery
  validateGallery,
  validateCreateGallery,
  validateUpdateGallery,
  validatePhotoUpload,
  validatePhotoModeration,
  validatePhotoComment,

  // Message
  validateMessage,
  validateCreateMessage,
  validateUpdateMessage,
  validateModerateMessage,
  validateLikeMessage,
  validateReportMessage,
  validateReplyMessage,
  validateBulkMessages,

  // Invitation
  validateInvitation,
  validateCreateInvitation,
  validateUpdateInvitation,
  validateSendInvitation,
  validateTrackInvitation,
  validateRespondInvitation,
  validateBulkSend,

  // Table QR
  validateTableQR,
  validateCreateTableQR,
  validateUpdateTableQR,
  validateAssignGuestToTable,
  validateScanTableQR,
  validateGenerateTableQRData,
  validateBulkCreateTables,

  // Permission
  validatePermission,
  validateRole,
  validateCreatePermission,
  validateCreateRole,
  validateUpdatePermission,
  validateUpdateRole,
  validateAssignRole,
  validateAssignPermission,
  validateCheckPermission,
  validateRoleHierarchy
};

// Export des schémas pour une utilisation avancée
module.exports.Schemas = {
  // Auth
  ...require('./authValidation'),
  // Event
  ...require('./eventValidation'),
  // Guest
  ...require('./guestValidation'),
  // QR Code
  ...require('./qrValidation'),
  // Scan
  ...require('./scanValidation'),
  // Session
  ...require('./sessionValidation'),
  // Gallery
  ...require('./galleryValidation'),
  // Message
  ...require('./messageValidation'),
  // Invitation
  ...require('./invitationValidation'),
  // Table QR
  ...require('./tableQRValidation'),
  // Permission
  ...require('./permissionValidation')
};