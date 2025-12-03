const mongoose = require("mongoose");
const Ticket = require("../models/ticketSchema");
const Queue = require("../models/queueSchema");
const Business = require("../models/businessSchema");
const etaCalculator = require("../utils/etaCalculator");

// small helper for pagination
const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page || 1, 10), 1);
  const limit = Math.max(parseInt(query.limit || 20, 10), 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ===============================
// CREATE TICKET
// ===============================
exports.createTicket = async (req, res) => {
  try {
    const { businessId, queueId, type, priority } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!businessId)
      return res.status(400).json({ message: "businessId is required" });
    if (!queueId)
      return res.status(400).json({ message: "queueId is required" });

    // 1. Check business exists
    const business = await Business.findById(businessId);
    if (!business)
      return res.status(404).json({ message: "Business not found" });

    // 2. Check queue exists
    const queue = await Queue.findById(queueId);
    if (!queue) return res.status(404).json({ message: "Queue not found" });

    // Check queue belongs to business
    if (queue.businessId.toString() !== businessId)
      return res
        .status(400)
        .json({ message: "Queue does not belong to this business" });

    // Check queue state
    if (queue.status !== "active")
      return res.status(400).json({ message: "Queue not accepting tickets" });

    if (queue.currentCount >= queue.maxCapacity)
      return res.status(400).json({ message: "Queue is full" });

    // 3. Atomically increment queue counters
    const updatedQueue = await Queue.findOneAndUpdate(
      {
        _id: queueId,
        currentCount: { $lt: queue.maxCapacity },
        status: "active",
      },
      {
        $inc: { currentCount: 1, currentTicketNumber: 1 },
      },
      { new: true },
    );

    if (!updatedQueue)
      return res.status(400).json({
        message: "Queue is no longer available for new tickets",
      });

    // Calculate ETA
    const etaPrediction = await etaCalculator.calculateETA(
      businessId,
      queueId,
      type,
    );

    // Create ticket
    const ticket = await Ticket.create({
      businessId,
      userId,
      queueId,
      ticketNumber: updatedQueue.currentTicketNumber,
      type: type || "examination",
      status: "waiting",
      priority: priority || "normal",
      estimatedTime: etaPrediction.estimatedMinutes,
      expectedServiceTime: etaPrediction.expectedTime,
    });

    // Emit socket events
    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitTicketCreated(businessId, ticket);
      socketIO.emitQueueUpdate(businessId, {
        queueId,
        currentCount: updatedQueue.currentCount,
        currentTicketNumber: updatedQueue.currentTicketNumber,
      });
    }

    return res.status(201).json({
      status: "success",
      data: ticket,
      eta: etaPrediction,
    });
  } catch (err) {
    console.error("createTicket error:", err);
    return res.status(500).json({
      message: "Server error creating ticket",
      error: err.message,
    });
  }
};

// ===============================
// GET TICKET BY ID
// ===============================
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("businessId")
      .populate("userId")
      .populate("queueId");

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // User cannot access others' tickets
    if (req.user.role === "user" && ticket.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    return res.json({ status: "success", data: ticket });
  } catch (err) {
    console.error("getTicketById error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// GET ALL TICKETS
// ===============================
exports.getAllTickets = async (req, res) => {
  try {
    const filter = {};
    const { businessId, userId, status, date } = req.query;

    if (businessId) filter.businessId = businessId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const { limit, skip, page } = parsePagination(req.query);

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("businessId")
        .populate("userId")
        .skip(skip)
        .limit(limit)
        .sort("-createdAt"),
      Ticket.countDocuments(filter),
    ]);

    return res.json({
      status: "success",
      page,
      limit,
      total,
      results: tickets.length,
      data: tickets,
    });
  } catch (err) {
    console.error("getAllTickets error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// GET MY TICKETS
// ===============================
exports.getMyTickets = async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    const { status, businessId, from, to } = req.query;

    if (status) filter.status = status;
    if (businessId) filter.businessId = businessId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const { page, limit, skip } = parsePagination(req.query);

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("businessId")
        .populate("queueId")
        .skip(skip)
        .limit(limit)
        .sort("-createdAt"),
      Ticket.countDocuments(filter),
    ]);

    return res.json({
      status: "success",
      page,
      limit,
      total,
      results: tickets.length,
      data: tickets,
    });
  } catch (err) {
    console.error("getMyTickets error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// GET BUSINESS TICKETS
// ===============================
exports.getBusinessTickets = async (req, res) => {
  try {
    const { businessId } = req.params;
    const filter = { businessId };
    const { date, status, userId } = req.query;

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    // owner check
    if (req.user.role === "owner") {
      const business = await Business.findById(businessId);
      if (!business || business.owner.toString() !== req.user.id)
        return res.status(403).json({
          message: "You do not own this business",
        });
    }

    const { page, limit, skip } = parsePagination(req.query);

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("userId")
        .populate("queueId")
        .skip(skip)
        .limit(limit)
        .sort("-createdAt"),
      Ticket.countDocuments(filter),
    ]);

    return res.json({
      status: "success",
      page,
      limit,
      total,
      results: tickets.length,
      data: tickets,
    });
  } catch (err) {
    console.error("getBusinessTickets error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// Compatibility alias
exports.getClinicTickets = async (req, res) => {
  req.params.businessId = req.params.clinicId || req.params.businessId;
  return exports.getBusinessTickets(req, res);
};

// ===============================
// CANCEL TICKET
// ===============================
exports.cancelTicket = async (req, res) => {
  try {
    const { reason } = req.body;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (req.user.role === "user" && ticket.userId.toString() !== req.user.id)
      return res.status(403).json({
        message: "You can only cancel your own tickets",
      });

    if (["done", "cancelled", "missed"].includes(ticket.status))
      return res.status(400).json({
        message: `Cannot cancel a ${ticket.status} ticket`,
      });

    const wasWaiting = ticket.status === "waiting";

    ticket.status = "cancelled";
    ticket.cancelReason = reason || null;
    await ticket.save();

    if (wasWaiting) {
      await Queue.findByIdAndUpdate(ticket.queueId, {
        $inc: { currentCount: -1 },
      });
    }

    return res.json({
      status: "success",
      message: "Ticket cancelled",
      data: ticket,
    });
  } catch (err) {
    console.error("cancelTicket error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// CALL TICKET
// ===============================
exports.callTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate("userId");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!["staff", "owner"].includes(req.user.role))
      return res.status(403).json({
        message: "Insufficient permissions to call tickets",
      });

    if (ticket.status !== "waiting")
      return res.status(400).json({
        message: "Only waiting tickets can be called",
      });

    ticket.status = "called";
    ticket.calledAt = new Date();
    await ticket.save();

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitTicketCalled(
        ticket.businessId.toString(),
        ticket,
        ticket.userId?._id?.toString(),
      );
      socketIO.emitTicketUpdated(ticket.businessId.toString(), ticket);
    }

    return res.json({
      status: "success",
      message: "Ticket called",
      data: ticket,
    });
  } catch (err) {
    console.error("callTicket error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// SERVE TICKET
// ===============================
exports.serveTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!["staff", "owner"].includes(req.user.role))
      return res.status(403).json({
        message: "Insufficient permissions to serve tickets",
      });

    if (!["called", "waiting"].includes(ticket.status))
      return res.status(400).json({
        message: "Only called or waiting tickets can be served",
      });

    ticket.status = "in-progress";
    ticket.startedAt = new Date();
    await ticket.save();

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitTicketUpdated(ticket.businessId.toString(), ticket);
    }

    return res.json({
      status: "success",
      message: "Now serving ticket",
      data: ticket,
    });
  } catch (err) {
    console.error("serveTicket error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// START TICKET
// ===============================
exports.startTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!["called", "waiting"].includes(ticket.status))
      return res.status(400).json({
        message: "Only called or waiting tickets can be started",
      });

    ticket.status = "in-progress";
    await ticket.save();

    return res.json({
      status: "success",
      message: "Service started",
      data: ticket,
    });
  } catch (err) {
    console.error("startTicket error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// COMPLETE TICKET
// ===============================
exports.completeTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.status === "done")
      return res.status(400).json({
        message: "Ticket already completed",
      });

    ticket.status = "done";
    ticket.completedAt = new Date();
    await ticket.save();

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitTicketUpdated(ticket.businessId.toString(), ticket);
    }

    if (ticket.queueId) {
      etaCalculator.updateQueueETAs(ticket.queueId);
    }

    return res.json({
      status: "success",
      message: "Ticket completed",
      data: ticket,
    });
  } catch (err) {
    console.error("completeTicket error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// ===============================
// NO SHOW TICKET
// ===============================
exports.noShowTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.status !== "waiting")
      return res.status(400).json({
        message: "Only waiting tickets can be marked as no-show",
      });

    ticket.status = "missed";
    await ticket.save();

    if (ticket.queueId) {
      await Queue.findByIdAndUpdate(ticket.queueId, {
        $inc: { currentCount: -1 },
      });
    }

    return res.json({
      status: "success",
      message: "Ticket marked as no-show",
      data: ticket,
    });
  } catch (err) {
    console.error("noShowTicket error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
