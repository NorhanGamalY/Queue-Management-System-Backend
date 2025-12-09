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

    // Business must be open/active
    if (business.status !== "active") {
      return res.status(400).json({ message: "Business is closed" });
    }

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

    // Link user to business clients list
    if (userId) {
      await Business.findByIdAndUpdate(businessId, {
        $addToSet: { ourClients: userId },
      });
    }

    // Emit socket events - populate ticket before emitting
    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      // Populate ticket with user and queue data before emitting
      const populatedTicket = await Ticket.findById(ticket._id)
        .populate("userId")
        .populate("queueId");
      
      // Ensure businessId is a string
      const businessIdStr = businessId.toString();
      
      socketIO.emitTicketCreated(businessIdStr, populatedTicket);
      socketIO.emitQueueUpdate(businessIdStr, {
        queueId: queueId.toString(),
        status: updatedQueue.status,
        currentCount: updatedQueue.currentCount,
        currentTicketNumber: updatedQueue.currentTicketNumber,
      });
      
      console.log(`📤 Emitted ticketCreated and queueUpdated for business ${businessIdStr}`);
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

    // Calculate position and people before for each ticket
    const ticketsWithPosition = await Promise.all(
      tickets.map(async (ticket) => {
        if (ticket.status === "waiting" && ticket.queueId) {
          // Count how many waiting tickets have a lower ticket number
          const waitingTicketsBefore = await Ticket.countDocuments({
            queueId: ticket.queueId,
            status: "waiting",
            ticketNumber: { $lt: ticket.ticketNumber },
          });
          
          const ticketObj = ticket.toObject();
          ticketObj.position = waitingTicketsBefore + 1;
          ticketObj.peopleBefore = waitingTicketsBefore;
          ticketObj.estimatedWaitTime = ticket.estimatedTime || 15;
          return ticketObj;
        }
        
        const ticketObj = ticket.toObject();
        ticketObj.position = null;
        ticketObj.peopleBefore = null;
        ticketObj.estimatedWaitTime = ticket.estimatedTime || 15;
        return ticketObj;
      })
    );

    return res.json({
      status: "success",
      page,
      limit,
      total,
      results: ticketsWithPosition.length,
      data: ticketsWithPosition,
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

    // Authorization check
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        message: "Business not found",
      });
    }

    // Business entity (logged in as business) - can only access their own tickets
    if (req.user.role === "business") {
      if (req.user._id.toString() !== businessId.toString()) {
        return res.status(403).json({
          message: "You can only access tickets for your own business",
        });
      }
    }
    // Owner role (user with owner role) - must own the business
    else if (req.user.role === "owner") {
      // Check if user's businessIds includes this business
      const userBusinessIds = req.user.businessIds?.map(id => id.toString()) || [];
      if (!userBusinessIds.includes(businessId.toString())) {
        return res.status(403).json({
          message: "You do not own this business",
        });
      }
    }
    // Staff role - must be associated with the business
    else if (req.user.role === "staff") {
      // Check if staff member's businessIds includes this business
      const userBusinessIds = req.user.businessIds?.map(id => id.toString()) || [];
      if (!userBusinessIds.includes(businessId.toString())) {
        return res.status(403).json({
          message: "You are not authorized to access tickets for this business",
        });
      }
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
// GET MY BUSINESS TICKETS (for logged-in business)
// ===============================
exports.getMyBusinessTickets = async (req, res) => {
  try {
    // Use the logged-in business's ID
    const businessId = req.user._id.toString();
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
    console.error("getMyBusinessTickets error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
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
      const updatedQueue = await Queue.findByIdAndUpdate(ticket.queueId, {
        $inc: { currentCount: -1 },
      }, { new: true });

      // Emit socket events
      const socketIO = req.app.get("socketIO");
      if (socketIO) {
        // Populate ticket before emitting
        const populatedTicket = await Ticket.findById(ticket._id)
          .populate("userId")
          .populate("queueId");
        socketIO.emitTicketUpdated(ticket.businessId.toString(), populatedTicket);
        socketIO.emitTicketCancelled(ticket.businessId.toString(), populatedTicket);
        if (updatedQueue) {
          socketIO.emitQueueUpdate(ticket.businessId.toString(), {
            queueId: updatedQueue._id.toString(),
            status: updatedQueue.status,
            currentCount: updatedQueue.currentCount,
            currentTicketNumber: updatedQueue.currentTicketNumber,
          });
        }
      }
    } else {
      // Emit socket event even if not waiting
      const socketIO = req.app.get("socketIO");
      if (socketIO) {
        // Populate ticket before emitting
        const populatedTicket = await Ticket.findById(ticket._id)
          .populate("userId")
          .populate("queueId");
        socketIO.emitTicketUpdated(ticket.businessId.toString(), populatedTicket);
        socketIO.emitTicketCancelled(ticket.businessId.toString(), populatedTicket);
      }
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
// CALL NEXT TICKET
// ===============================
exports.callNextTicket = async (req, res) => {
  try {
    const queueId = req.params.id;
    // req.user has been populated by protect middleware
    
    // Check queue exists and is active
    const queue = await Queue.findById(queueId);
    if (!queue) return res.status(404).json({ message: "Queue not found" });
    
    if (queue.status !== "active") {
      return res.status(400).json({ message: "Queue is not active" });
    }

    // Authorization: Member of business
    // Logic similar to callTicket but we check business ownership of the queue
    if (req.user.role === "business") {
      if (queue.businessId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Unauthorized" });
      }
    } else if (["staff", "owner"].includes(req.user.role)) {
       // Ideally check if user belongs to business, simplified here or rely on middleware if refined
       // restrictToOwnerOrAdmin middleware in route usually handles this
    }

    // Find next waiting ticket
    // Sort by priority (vip > priority > normal) and then ticketNumber
    // We can map priority string to number for sort if needed, but for now let's assume FIFO by ticketNumber
    // If you want priority implementation: .sort({ priority: -1, ticketNumber: 1 }) if priority was comparable
    // adjusting sort to ticketNumber ascending
    const nextTicket = await Ticket.findOne({
      queueId: queueId,
      status: "waiting"
    }).sort({ ticketNumber: 1 });

    if (!nextTicket) {
      return res.status(404).json({ message: "No waiting tickets in the queue" });
    }

    // Update ticket
    nextTicket.status = "called";
    nextTicket.calledAt = new Date();
    await nextTicket.save();

    // Socket events
    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      // Populate ticket before emitting
      const populatedTicket = await Ticket.findById(nextTicket._id)
        .populate("userId")
        .populate("queueId")
        .populate("businessId"); // Ensure businessId is populated if needed for client structure
        
      socketIO.emitTicketCalled(
        nextTicket.businessId.toString(),
        populatedTicket,
        nextTicket.userId?._id?.toString(),
      );
      socketIO.emitTicketUpdated(nextTicket.businessId.toString(), populatedTicket);
      
      // Also emit callNext event specifically if frontend listens to it
      socketIO.emit("callNext", {
         ticketId: nextTicket._id,
         businessId: nextTicket.businessId,
         ticket: populatedTicket
      });
    }

    return res.json({
      status: "success",
      message: "Ticket called",
      data: nextTicket,
    });
  } catch (err) {
    console.error("callNextTicket error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===============================
// CALL TICKET
// ===============================
exports.callTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate("userId");
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // Check authorization: business can call tickets for their own business, staff/owner can call for associated businesses
    if (req.user.role === "business") {
      // Business can only call tickets for their own business
      if (ticket.businessId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "You can only call tickets for your own business",
        });
      }
    } else if (!["staff", "owner"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient permissions to call tickets",
      });
    }

    if (ticket.status !== "waiting")
      return res.status(400).json({
        message: "Only waiting tickets can be called",
      });

    ticket.status = "called";
    ticket.calledAt = new Date();
    await ticket.save();

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      // Populate ticket before emitting
      const populatedTicket = await Ticket.findById(ticket._id)
        .populate("userId")
        .populate("queueId");
      socketIO.emitTicketCalled(
        ticket.businessId.toString(),
        populatedTicket,
        ticket.userId?._id?.toString(),
      );
      socketIO.emitTicketUpdated(ticket.businessId.toString(), populatedTicket);
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

    // Check authorization: business can serve tickets for their own business, staff/owner can serve for associated businesses
    if (req.user.role === "business") {
      // Business can only serve tickets for their own business
      if (ticket.businessId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "You can only serve tickets for your own business",
        });
      }
    } else if (!["staff", "owner"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient permissions to serve tickets",
      });
    }

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

    // Check authorization: business can complete tickets for their own business
    if (req.user.role === "business") {
      if (ticket.businessId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "You can only complete tickets for your own business",
        });
      }
    }

    if (ticket.status === "done")
      return res.status(400).json({
        message: "Ticket already completed",
      });

    ticket.status = "done";
    ticket.completedAt = new Date();
    await ticket.save();

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      // Populate ticket before emitting
      const populatedTicket = await Ticket.findById(ticket._id)
        .populate("userId")
        .populate("queueId");
      socketIO.emitTicketUpdated(ticket.businessId.toString(), populatedTicket);
      socketIO.emitTicketCompleted(ticket.businessId.toString(), populatedTicket);
      // Notify user if they're connected
      if (ticket.userId) {
        socketIO.emitToUser(ticket.userId.toString(), "ticketUpdated", { ticket: populatedTicket });
      }
    }

    if (ticket.queueId) {
      const updatedQueue = await Queue.findById(ticket.queueId);
      if (updatedQueue && socketIO) {
        socketIO.emitQueueUpdate(ticket.businessId.toString(), {
          queueId: updatedQueue._id.toString(),
          status: updatedQueue.status,
          currentCount: updatedQueue.currentCount,
          currentTicketNumber: updatedQueue.currentTicketNumber,
        });
      }
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

    // Check authorization: business can mark no-show for tickets in their own business
    if (req.user.role === "business") {
      if (ticket.businessId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "You can only mark no-show for tickets in your own business",
        });
      }
    }

    if (ticket.status !== "waiting")
      return res.status(400).json({
        message: "Only waiting tickets can be marked as no-show",
      });

    ticket.status = "missed";
    await ticket.save();

    if (ticket.queueId) {
      const updatedQueue = await Queue.findByIdAndUpdate(ticket.queueId, {
        $inc: { currentCount: -1 },
      }, { new: true });

      // Emit socket events
      const socketIO = req.app.get("socketIO");
      if (socketIO) {
        // Populate ticket before emitting
        const populatedTicket = await Ticket.findById(ticket._id)
          .populate("userId")
          .populate("queueId");
        socketIO.emitTicketUpdated(ticket.businessId.toString(), populatedTicket);
        socketIO.emitTicketSkipped(ticket.businessId.toString(), populatedTicket);
        if (updatedQueue) {
          socketIO.emitQueueUpdate(ticket.businessId.toString(), {
            queueId: updatedQueue._id.toString(),
            status: updatedQueue.status,
            currentCount: updatedQueue.currentCount,
            currentTicketNumber: updatedQueue.currentTicketNumber,
          });
        }
      }
    } else {
      const socketIO = req.app.get("socketIO");
      if (socketIO) {
        // Populate ticket before emitting
        const populatedTicket = await Ticket.findById(ticket._id)
          .populate("userId")
          .populate("queueId");
        socketIO.emitTicketUpdated(ticket.businessId.toString(), populatedTicket);
        socketIO.emitTicketSkipped(ticket.businessId.toString(), populatedTicket);
      }
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
