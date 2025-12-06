const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

// Stripe webhook (public endpoint - must be before other routes)
router.post("/webhook/stripe", paymentController.stripeWebhook);

// Create Stripe Checkout Session
router.post("/create-checkout-session", protect, paymentController.createCheckoutSession);

// Verify payment
router.post("/verify", protect, paymentController.verifyPayment);

// Get user's payment history
router.get("/users/me/payments", protect, paymentController.getUserPayments);

// Get business payments (owner/business/admin)
router.get(
  "/businesses/:businessId/payments",
  protect,
  restrictTo("owner", "business", "admin"),
  paymentController.getBusinessPayments,
);

// Get all payments (admin only) - must be before /:id
router.get(
  "/all",
  protect,
  restrictTo("admin"),
  paymentController.getAllPayments,
);

// Create payment
router.post("/", protect, paymentController.createPayment);

// Get payment receipt
router.get("/:id/receipt", protect, paymentController.getReceipt);

// Refund payment
router.post(
  "/:id/refund",
  protect,
  restrictTo("admin", "owner"),
  paymentController.refundPayment,
);

// Get payment by ID
router.get("/:id", protect, paymentController.getPaymentById);

module.exports = router;
