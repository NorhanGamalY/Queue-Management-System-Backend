const mongoose = require("mongoose");
const Queue = require("../models/queueSchema");
const Business = require("../models/businessSchema");
const Ticket = require("../models/ticketSchema");

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
exports.closeQueue = async (req, res) => {
  try {
    const queue = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: "closed" },
      { new: true, runValidators: true },
    );

    if (!queue) return res.status(404).json({ message: "Queue not found" });

    res.status(200).json({
      status: "success",
      message: "Queue closed for the day",
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

// =========================== GET QUEUE BY BUSINESS ID ===========================
exports.getQueueByBusinessId = async (req, res) => {
  try {
    const { businessId } = req.params;
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's queue for the business
    let queue = await Queue.findOne({
      businessId,
      createdAt: { $gte: today, $lt: tomorrow },
    }).sort({ createdAt: -1 });

    // If no queue exists for today, create one
    if (!queue) {
      queue = await Queue.create({
        businessId,
        maxCapacity: 50,
        status: "active",
        currentCount: 0,
        currentTicketNumber: 0,
        date: today,
      });
    }

    res.status(200).json({
      status: "success",
      data: queue,
    });
  } catch (err) {
    console.error("Get queue by business ID error:", err);
    res.status(500).json({
      message: "Server error fetching queue",
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
