const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const {
  protect,
  restrictTo,
  restrictToOwnerOrAdmin,
} = require("../middlewares/authMiddleware");

// -------------------------------------------------------
// ROUTES FOR LOGGED-IN USER (SELF NOTIFICATIONS)
// -------------------------------------------------------

// Get my notifications
router.get("/me", protect, notificationController.getNotifications);

// Delete all my notifications
router.delete("/me", protect, notificationController.deleteAllNotifications);

// Delete single notification from my notifications
router.delete("/me/:id", protect, notificationController.deleteNotification);

// -------------------------------------------------------
// GENERIC ROUTES (NORMAL NOTIFICATION ACCESS)
// -------------------------------------------------------

// Send a notification to a specific user (admin only)
router.post(
  "/send",
  protect,
  restrictTo("admin", "business"),
  notificationController.sendToUser,
);

module.exports = router;
