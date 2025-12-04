const express = require("express");
const router = express.Router();
const queueController = require("../controllers/queueController");
const {
  protect,
  restrictToOwnerOrAdmin,
  allowQueueOwnerOrAdmin,
} = require("../middlewares/authMiddleware");

router.post(
  "/business/:businessId/queue",
  protect,
  restrictToOwnerOrAdmin,
  queueController.createQueue,
);

router.patch(
  "/queue/:id/pause",
  protect,
  allowQueueOwnerOrAdmin,
  queueController.pauseQueue,
);

router.patch(
  "/queue/:id/resume",
  protect,
  allowQueueOwnerOrAdmin,
  queueController.resumeQueue,
);

router.patch(
  "/queue/:id/close",
  protect,
  allowQueueOwnerOrAdmin,
  queueController.closeQueue,
);

router.delete(
  "/queues/:id",
  protect,
  allowQueueOwnerOrAdmin,
  queueController.deleteQueue,
);

module.exports = router;
