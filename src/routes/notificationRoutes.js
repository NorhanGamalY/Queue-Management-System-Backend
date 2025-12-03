const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

router.get("/notifications", protect, notificationController.getNotifications);
router.delete("/:id", protect, notificationController.deleteNotification);
router.delete("/", protect, notificationController.deleteAllNotifications);
module.exports = router;
