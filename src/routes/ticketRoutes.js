// src/routes/ticket.routes.js
const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

// NOTE: This router is intended to be mounted at app.use('/api/v1', ticketRoutes);

// Create new ticket (book appointment) - any logged-in user
// POST /api/clinics/:id/tickets (Documentation compatible)
router.post("/tickets", protect, ticketController.createTicket);
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
  "/tickets",
  protect,
  restrictTo("admin", "staff"),
  ticketController.getAllTickets,
);

// Get current user's tickets
router.get("/users/me/tickets", protect, ticketController.getMyTickets);

// Get tickets for business/clinic (owner/staff/business only)
// GET /api/clinics/:id/tickets (Documentation compatible)
router.get(
  "/businesses/:businessId/tickets",
  protect,
  restrictTo("owner", "staff", "business"),
  ticketController.getBusinessTickets,
);
router.get(
  "/clinics/:clinicId/tickets",
  protect,
  ticketController.getClinicTickets,
);

// Get ticket by ID (dynamic route must be last among GETs)
router.get("/tickets/:id", protect, ticketController.getTicketById);

// Cancel ticket
router.patch("/tickets/:id/cancel", protect, ticketController.cancelTicket);

// Call ticket (staff only) - Documentation: PUT /api/tickets/:id/call
router.patch(
  "/tickets/:id/cancel",
  protect,
  restrictTo("staff", "owner", "business"),
  ticketController.cancelTicket,
);
router.put(
  "/tickets/:id/call",
  protect,
  restrictTo("staff", "owner", "business"),
  ticketController.callTicket,
);

// Serve ticket (staff only) - Documentation: PUT /api/tickets/:id/serve
router.patch(
  "/tickets/:id/serve",
  protect,
  restrictTo("staff", "owner", "business"),
  ticketController.serveTicket,
);
router.put(
  "/tickets/:id/serve",
  protect,
  restrictTo("staff", "owner", "business"),
  ticketController.serveTicket,
);

// Start serving ticket (staff only)
router.patch(
  "/tickets/:id/start",
  protect,
  restrictTo("staff", "owner", "business"),
  ticketController.startTicket,
);

// Complete ticket (staff only)
router.patch(
  "/tickets/:id/complete",
  protect,
  restrictTo("staff", "owner", "business"),
  ticketController.completeTicket,
);

// Mark ticket as no-show (staff only)
router.patch(
  "/tickets/:id/no-show",
  protect,
  restrictTo("staff", "owner", "business"),
  ticketController.noShowTicket,
);

module.exports = router;
