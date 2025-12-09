const express = require("express");
const router = express.Router();
const queueController = require("../controllers/queueController");
const ticketController = require("../controllers/ticketController");
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

router.get(
  "/business/:businessId/queue/today",
  protect,
  queueController.getTodayQueue,
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

router.patch(
  "/queue/:id",
  protect,
  allowQueueOwnerOrAdmin,
  queueController.updateQueue,
);

router.patch(
  "/queue/:id/call-next",
  protect,
  allowQueueOwnerOrAdmin,
  ticketController.callNextTicket,
);

router.delete(
  "/queues/:id",
  protect,
  allowQueueOwnerOrAdmin,
  queueController.deleteQueue,
);

module.exports = router;
