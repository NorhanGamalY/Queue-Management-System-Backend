const Ticket = require("../models/ticketSchema");
const Queue = require("../models/queueSchema");
const Business = require("../models/businessSchema");
const etaCalculator = require("../utils/etaCalculator");
const TicketDto = require("../dtos/ticket.dto");
const formatResponse = require("../utils/response");

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
      return res
        .status(400)
        .json(formatResponse(null, "businessId is required", "fail"));
    if (!queueId)
      return res
        .status(400)
        .json(formatResponse(null, "queueId is required", "fail"));

    const business = await Business.findById(businessId);
    if (!business)
      return res
        .status(404)
        .json(formatResponse(null, "Business not found", "fail"));

    const queue = await Queue.findById(queueId);
    if (!queue)
      return res
        .status(404)
        .json(formatResponse(null, "Queue not found", "fail"));

    if (queue.businessId.toString() !== businessId)
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "Queue does not belong to this business",
            "fail",
          ),
        );

    if (queue.status !== "active")
      return res
        .status(400)
        .json(formatResponse(null, "Queue not accepting tickets", "fail"));

    if (queue.currentCount >= queue.maxCapacity)
      return res
        .status(400)
        .json(formatResponse(null, "Queue is full", "fail"));

    const updatedQueue = await Queue.findOneAndUpdate(
      {
        _id: queueId,
        currentCount: { $lt: queue.maxCapacity },
        status: "active",
      },
      { $inc: { currentCount: 1, currentTicketNumber: 1 } },
      { new: true },
    );

    if (!updatedQueue)
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "Queue is no longer available for new tickets",
            "fail",
          ),
        );

    const etaPrediction = await etaCalculator.calculateETA(
      businessId,
      queueId,
      type,
    );

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

    const dto = new TicketDto(ticket);

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitTicketCreated(businessId, ticket);
      socketIO.emitQueueUpdate(businessId, {
        queueId,
        currentCount: updatedQueue.currentCount,
        currentTicketNumber: updatedQueue.currentTicketNumber,
      });
    }

    return res
      .status(201)
      .json(
        formatResponse(
          { ticket: dto, eta: etaPrediction },
          "Ticket created successfully",
        ),
      );
  } catch (err) {
    console.error("createTicket error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
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

    if (!ticket)
      return res
        .status(404)
        .json(formatResponse(null, "Ticket not found", "fail"));

    if (req.user.role === "user" && ticket.userId.toString() !== req.user.id)
      return res
        .status(403)
        .json(formatResponse(null, "Access denied", "fail"));

    const dto = new TicketDto(ticket);
    return res.json(formatResponse(dto, "Ticket retrieved successfully"));
  } catch (err) {
    console.error("getTicketById error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
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

    const dtoList = tickets.map((t) => new TicketDto(t));

    return res.json(
      formatResponse(
        {
          page,
          limit,
          total,
          results: tickets.length,
          tickets: dtoList,
        },
        "Tickets retrieved successfully",
      ),
    );
  } catch (err) {
    console.error("getAllTickets error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
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

    const dtoList = tickets.map((t) => new TicketDto(t));

    return res.json(
      formatResponse(
        {
          page,
          limit,
          total,
          results: tickets.length,
          tickets: dtoList,
        },
        "My tickets retrieved successfully",
      ),
    );
  } catch (err) {
    console.error("getMyTickets error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
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

    if (req.user.role === "owner") {
      const business = await Business.findById(businessId);
      if (!business || business.owner.toString() !== req.user.id)
        return res
          .status(403)
          .json(formatResponse(null, "You do not own this business", "fail"));
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

    const dtoList = tickets.map((t) => new TicketDto(t));

    return res.json(
      formatResponse(
        {
          page,
          limit,
          total,
          results: tickets.length,
          tickets: dtoList,
        },
        "Business tickets retrieved successfully",
      ),
    );
  } catch (err) {
    console.error("getBusinessTickets error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
  }
};

// ===============================
// CANCEL TICKET
// ===============================
exports.cancelTicket = async (req, res) => {
  try {
    const { reason } = req.body;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket)
      return res
        .status(404)
        .json(formatResponse(null, "Ticket not found", "fail"));

    if (req.user.role === "user" && ticket.userId.toString() !== req.user.id)
      return res
        .status(403)
        .json(
          formatResponse(null, "You can only cancel your own tickets", "fail"),
        );

    if (["done", "cancelled", "missed"].includes(ticket.status))
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            `Cannot cancel a ${ticket.status} ticket`,
            "fail",
          ),
        );

    const wasWaiting = ticket.status === "waiting";

    ticket.status = "cancelled";
    ticket.cancelReason = reason || null;
    await ticket.save();

    if (wasWaiting) {
      await Queue.findByIdAndUpdate(ticket.queueId, {
        $inc: { currentCount: -1 },
      });
    }

    return res.json(
      formatResponse(new TicketDto(ticket), "Ticket cancelled successfully"),
    );
  } catch (err) {
    console.error("cancelTicket error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
  }
};

// ===============================
// CALL TICKET
// ===============================
exports.callTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate("userId");
    if (!ticket)
      return res
        .status(404)
        .json(formatResponse(null, "Ticket not found", "fail"));

    if (!["admin", "business"].includes(req.user.role))
      return res
        .status(403)
        .json(
          formatResponse(
            null,
            "Insufficient permissions to call tickets",
            "fail",
          ),
        );

    if (ticket.status !== "waiting")
      return res
        .status(400)
        .json(
          formatResponse(null, "Only waiting tickets can be called", "fail"),
        );

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

    return res.json(
      formatResponse(new TicketDto(ticket), "Ticket called successfully"),
    );
  } catch (err) {
    console.error("callTicket error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
  }
};

// ===============================
// SERVE TICKET
// ===============================
exports.serveTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket)
      return res
        .status(404)
        .json(formatResponse(null, "Ticket not found", "fail"));

    if (!["admin", "business"].includes(req.user.role))
      return res
        .status(403)
        .json(
          formatResponse(
            null,
            "Insufficient permissions to serve tickets",
            "fail",
          ),
        );

    if (!["called", "waiting"].includes(ticket.status))
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "Only called or waiting tickets can be served",
            "fail",
          ),
        );

    ticket.status = "in-progress";
    ticket.startedAt = new Date();
    await ticket.save();

    const socketIO = req.app.get("socketIO");
    if (socketIO)
      socketIO.emitTicketUpdated(ticket.businessId.toString(), ticket);

    return res.json(
      formatResponse(new TicketDto(ticket), "Now serving ticket"),
    );
  } catch (err) {
    console.error("serveTicket error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
  }
};

// ===============================
// START TICKET
// ===============================
exports.startTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket)
      return res
        .status(404)
        .json(formatResponse(null, "Ticket not found", "fail"));

    if (!["called", "waiting"].includes(ticket.status))
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "Only called or waiting tickets can be started",
            "fail",
          ),
        );

    ticket.status = "in-progress";
    await ticket.save();

    return res.json(formatResponse(new TicketDto(ticket), "Service started"));
  } catch (err) {
    console.error("startTicket error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
  }
};

// ===============================
// COMPLETE TICKET
// ===============================
exports.completeTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket)
      return res
        .status(404)
        .json(formatResponse(null, "Ticket not found", "fail"));

    if (ticket.status === "done")
      return res
        .status(400)
        .json(formatResponse(null, "Ticket already completed", "fail"));

    ticket.status = "done";
    ticket.completedAt = new Date();
    await ticket.save();

    const socketIO = req.app.get("socketIO");
    if (socketIO)
      socketIO.emitTicketUpdated(ticket.businessId.toString(), ticket);

    if (ticket.queueId) etaCalculator.updateQueueETAs(ticket.queueId);

    return res.json(
      formatResponse(new TicketDto(ticket), "Ticket completed successfully"),
    );
  } catch (err) {
    console.error("completeTicket error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
  }
};

// ===============================
// NO SHOW TICKET
// ===============================
exports.noShowTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket)
      return res
        .status(404)
        .json(formatResponse(null, "Ticket not found", "fail"));

    if (ticket.status !== "waiting")
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "Only waiting tickets can be marked as no-show",
            "fail",
          ),
        );

    ticket.status = "missed";
    await ticket.save();

    if (ticket.queueId) {
      await Queue.findByIdAndUpdate(ticket.queueId, {
        $inc: { currentCount: -1 },
      });
    }

    return res.json(
      formatResponse(new TicketDto(ticket), "Ticket marked as no-show"),
    );
  } catch (err) {
    console.error("noShowTicket error:", err);
    return res.status(500).json(formatResponse(null, err.message, "error"));
  }
};
