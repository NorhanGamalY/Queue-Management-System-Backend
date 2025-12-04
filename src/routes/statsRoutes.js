/**
 * Stats Routes
 * Documentation: GET /api/stats/clinic/:id
 */

const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

// Get business/clinic statistics
router.get("/business/:id", protect, statsController.getBusinessStats);

// Admin overview statistics
router.get(
  "/admin/overview",
  protect,
  restrictTo("admin"),
  statsController.getAdminStats,
);

// Live queue statistics
router.get("/queue/:queueId/live", protect, statsController.getLiveQueueStats);

module.exports = router;
