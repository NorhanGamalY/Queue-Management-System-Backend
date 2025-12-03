const express = require("express");
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

// Generic routes that work with getOwnerId utility
// The controller automatically detects the owner type from req.user, req.business, etc.
router.get("/me", protect, notificationController.getNotifications);
router.delete("/me", protect, notificationController.deleteAllNotifications);
router.delete("/me/:id", protect, notificationController.deleteNotification);

module.exports = router;
