const mongoose = require("mongoose");
const Queue = require("../models/queueSchema");
const Business = require("../models/businessSchema");
const Ticket = require("../models/ticketSchema");

// =========================== GET TODAY'S QUEUE ===========================
exports.getTodayQueue = async (req, res) => {
  try {
    const { businessId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const queue = await Queue.findOne({
      businessId,
      createdAt: { $gte: today, $lt: tomorrow },
    });

    if (!queue) {
      return res.status(200).json({ // Return 200 with null data if no queue
        status: "success",
        data: null, 
        message: "No queue found for today"
      });
    }

    res.status(200).json({
      status: "success",
      data: queue,
    });
  } catch (err) {
    console.error("Get today queue error:", err);
    res.status(500).json({
      message: "Server error getting queue",
      error: err.message,
    });
  }
};

// =========================== CREATE QUEUE ===========================
exports.createQueue = async (req, res) => {
  try {
    const { maxCapacity, date } = req.body;
    const businessId = req.params.businessId;

    // Validate business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Check if queue already exists
    const existingQueue = await Queue.findOne({
      businessId,
      date: new Date(date),
    });

    if (existingQueue) {
      return res.status(400).json({
        message: "Queue already exists for this date",
      });
    }

    // Create queue
    const queue = await Queue.create({
      businessId,
      maxCapacity: maxCapacity || 20,
      status: "active",
      currentCount: 0,
      currentTicketNumber: 0,
      date: new Date(date),
    });

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitQueueUpdate(businessId, {
        queueId: queue._id.toString(),
        status: queue.status,
        currentCount: queue.currentCount,
        currentTicketNumber: queue.currentTicketNumber,
      });
    }

    res.status(201).json({
      status: "success",
      data: queue,
    });
  } catch (err) {
    console.error("Create queue error:", err);
    res.status(500).json({
      message: "Server error creating queue",
      error: err.message,
    });
  }
};

// =========================== PAUSE QUEUE ===========================
exports.pauseQueue = async (req, res) => {
  try {
    const queue = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: "paused" },
      { new: true, runValidators: true },
    );

    if (!queue) return res.status(404).json({ message: "Queue not found" });

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitQueueUpdate(queue.businessId.toString(), {
        queueId: queue._id.toString(),
        status: queue.status,
        currentCount: queue.currentCount,
        currentTicketNumber: queue.currentTicketNumber,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Queue paused successfully",
      data: queue,
    });
  } catch (err) {
    console.error("Pause queue error:", err);
    res.status(500).json({
      message: "Server error pausing queue",
      error: err.message,
    });
  }
};

// =========================== RESUME QUEUE ===========================
exports.resumeQueue = async (req, res) => {
  try {
    const queue = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: "active" },
      { new: true, runValidators: true },
    );

    if (!queue) return res.status(404).json({ message: "Queue not found" });

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitQueueUpdate(queue.businessId.toString(), {
        queueId: queue._id.toString(),
        status: queue.status,
        currentCount: queue.currentCount,
        currentTicketNumber: queue.currentTicketNumber,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Queue resumed successfully",
      data: queue,
    });
  } catch (err) {
    console.error("Resume queue error:", err);
    res.status(500).json({
      message: "Server error resuming queue",
      error: err.message,
    });
  }
};

// =========================== CLOSE QUEUE ===========================
// =========================== CLOSE QUEUE ===========================
exports.closeQueue = async (req, res) => {
  try {
    const queueId = req.params.id;
    
    // Find all waiting tickets for this queue
    const waitingTickets = await Ticket.find({
      queueId,
      status: "waiting"
    });

    // Update all waiting tickets to cancelled
    await Ticket.updateMany(
      { queueId, status: "waiting" },
      { 
        status: "cancelled", 
        cancelReason: "Queue Closed",
        cancelledBy: req.user._id // Assuming admin/owner is closing
      }
    );

    // Reset queue data when closing
    const queue = await Queue.findByIdAndUpdate(
      queueId,
      { 
        status: "closed",
        currentCount: 0,
        currentTicketNumber: 0
      },
      { new: true, runValidators: true },
    );

    if (!queue) return res.status(404).json({ message: "Queue not found" });

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      // Emit queue update
      socketIO.emitQueueUpdate(queue.businessId.toString(), {
        queueId: queue._id.toString(),
        status: queue.status,
        currentCount: 0,
        currentTicketNumber: 0,
      });

      // Emit cancellation events for all waiting tickets
      waitingTickets.forEach(ticket => {
        // We can't efficiently populate all in a loop, but we can emit basic info
        // Ideally we'd do a bulk populate or just emit the ID status change
        // For now, let's emit the critical status update
        const ticketUpdate = {
          _id: ticket._id,
          businessId: ticket.businessId,
          queueId: ticket.queueId,
          userId: ticket.userId,
          status: "cancelled",
          cancelReason: "Queue Closed"
        };
        
        socketIO.emitTicketUpdated(ticket.businessId.toString(), ticketUpdate);
        socketIO.emitTicketCancelled(ticket.businessId.toString(), ticketUpdate);
        
        if (ticket.userId) {
          socketIO.emitToUser(ticket.userId.toString(), "ticketUpdated", { ticket: ticketUpdate });
        }
      });
    }

    res.status(200).json({
      status: "success",
      message: `Queue closed. ${waitingTickets.length} waiting tickets cancelled.`,
      data: queue,
    });
  } catch (err) {
    console.error("Close queue error:", err);
    res.status(500).json({
      message: "Server error closing queue",
      error: err.message,
    });
  }
};

// =========================== UPDATE QUEUE ===========================
exports.updateQueue = async (req, res) => {
  try {
    const { maxCapacity } = req.body;
    
    const queue = await Queue.findByIdAndUpdate(
      req.params.id,
      { maxCapacity },
      { new: true, runValidators: true }
    );

    if (!queue) return res.status(404).json({ message: "Queue not found" });

    const socketIO = req.app.get("socketIO");
    if (socketIO) {
      socketIO.emitQueueUpdate(queue.businessId.toString(), {
        queueId: queue._id.toString(),
        status: queue.status,
        currentCount: queue.currentCount,
        currentTicketNumber: queue.currentTicketNumber,
        maxCapacity: queue.maxCapacity
      });
    }

    res.status(200).json({
      status: "success",
      message: "Queue updated successfully",
      data: queue,
    });
  } catch (err) {
    console.error("Update queue error:", err);
    res.status(500).json({
      message: "Server error updating queue",
      error: err.message,
    });
  }
};

// =========================== DELETE QUEUE ===========================
exports.deleteQueue = async (req, res) => {
  try {
    const queue = await Queue.findById(req.params.id);
    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    // Check active tickets before deleting
    const activeTickets = await Ticket.countDocuments({
      queueId: queue._id,
      status: { $in: ["waiting", "called", "in-progress"] },
    });

    if (activeTickets > 0) {
      return res.status(400).json({
        message: "Cannot delete queue with active tickets",
      });
    }

    await Queue.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: "success",
      message: "Queue deleted successfully",
    });
  } catch (err) {
    console.error("Delete queue error:", err);
    res.status(500).json({
      message: "Server error deleting queue",
      error: err.message,
    });
  }
};
