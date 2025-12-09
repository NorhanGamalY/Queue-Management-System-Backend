// src/routes/ticket.routes.js
const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

// NOTE: This router is intended to be mounted at app.use('/api/v1', ticketRoutes);

// Create new ticket (book appointment) - any logged-in user
// POST /api/clinics/:id/tickets (Documentation compatible)
router.post("/", protect, ticketController.createTicket);
router.post(
  "/clinics/:clinicId/tickets",
  protect,
  ticketController.createTicket,
);
router.post(
  "/businesses/:businessId/tickets",
  protect,
  ticketController.createTicket,
);

// Get all tickets (admin/staff only)
router.get(
  "/",
  protect,
  restrictTo("admin", "staff"),
  ticketController.getAllTickets,
);

// Get current user's tickets
router.get("/users/me/tickets", protect, ticketController.getMyTickets);

// Get my business tickets (for logged-in business - uses their own ID)
// MUST come before /businesses/:businessId/tickets to match correctly
router.get(
  "/businesses/me/tickets",
  protect,
  restrictTo("business"),
  ticketController.getMyBusinessTickets,
);

// Get tickets for business/clinic (business/owner/staff only)
// GET /api/clinics/:id/tickets (Documentation compatible)
router.get(
  "/businesses/:businessId/tickets",
  protect,
  restrictTo("business", "owner", "staff"),
  ticketController.getBusinessTickets,
);
router.get(
  "/clinics/:clinicId/tickets",
  protect,
  ticketController.getClinicTickets,
);

// IMPORTANT: Specific routes must come before generic /tickets/:id route
// Cancel ticket
router.patch("/:id/cancel", protect, ticketController.cancelTicket);

// Call ticket (business/staff/owner only) - Documentation: PUT /api/tickets/:id/call
router.patch(
  "/:id/call",
  protect,
  restrictTo("business", "staff", "owner"),
  ticketController.callTicket,
);
router.put(
  "/:id/call",
  protect,
  restrictTo("business", "staff", "owner"),
  ticketController.callTicket,
);

// Serve ticket (business/staff/owner only) - Documentation: PUT /api/tickets/:id/serve
router.patch(
  "/:id/serve",
  protect,
  restrictTo("business", "staff", "owner"),
  ticketController.serveTicket,
);
router.put(
  "/:id/serve",
  protect,
  restrictTo("business", "staff", "owner"),
  ticketController.serveTicket,
);

// Start serving ticket (business/staff/owner only)
router.patch(
  "/:id/start",
  protect,
  restrictTo("business", "staff", "owner"),
  ticketController.startTicket,
);

// Complete ticket (business/staff/owner only)
router.patch(
  "/:id/complete",
  protect,
  restrictTo("business", "staff", "owner"),
  ticketController.completeTicket,
);

// Mark ticket as no-show (business/staff/owner only)
router.patch(
  "/:id/no-show",
  protect,
  restrictTo("business", "staff", "owner"),
  ticketController.noShowTicket,
);

// Get ticket by ID (dynamic route must be last among GETs)
router.get("/:id", protect, ticketController.getTicketById);

module.exports = router;
