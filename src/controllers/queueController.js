const Queue = require("../models/queueSchema");
const Business = require("../models/businessSchema");
const Ticket = require("../models/ticketSchema");
const QueueDto = require("../dtos/queue.dto");
const formatResponse = require("../utils/response");

// =========================== CREATE QUEUE ===========================
exports.createQueue = async (req, res) => {
  try {
    const { maxCapacity, date } = req.body;
    const businessId = req.params.businessId;

    const business = await Business.findById(businessId);
    if (!business)
      return res
        .status(404)
        .json(formatResponse(null, "Business not found", "fail"));

    const existingQueue = await Queue.findOne({
      businessId,
      date: new Date(date),
    });
    if (existingQueue)
      return res
        .status(400)
        .json(
          formatResponse(null, "Queue already exists for this date", "fail"),
        );

    const queue = await Queue.create({
      businessId,
      maxCapacity: maxCapacity || 20,
      status: "active",
      currentCount: 0,
      currentTicketNumber: 0,
      date: new Date(date),
    });

    const dto = new QueueDto(queue);
    res.status(201).json(formatResponse(dto, "Queue created successfully"));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "error", message: "Server error creating queue" });
  }
};

// =========================== UPDATE QUEUE STATUS ===========================
const updateQueueStatus = async (req, res, status, message) => {
  try {
    const queue = await Queue.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    );
    if (!queue)
      return res
        .status(404)
        .json(formatResponse(null, "Queue not found", "fail"));

    const dto = new QueueDto(queue);
    res.status(200).json(formatResponse(dto, message));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({
        status: "error",
        message: `Server error ${message.toLowerCase()}`,
      });
  }
};

exports.pauseQueue = (req, res) =>
  updateQueueStatus(req, res, "paused", "Queue paused successfully");
exports.resumeQueue = (req, res) =>
  updateQueueStatus(req, res, "active", "Queue resumed successfully");
exports.closeQueue = (req, res) =>
  updateQueueStatus(req, res, "closed", "Queue closed for the day");

// =========================== DELETE QUEUE ===========================
exports.deleteQueue = async (req, res) => {
  try {
    const queue = await Queue.findById(req.params.id);
    if (!queue)
      return res
        .status(404)
        .json(formatResponse(null, "Queue not found", "fail"));

    const activeTickets = await Ticket.countDocuments({
      queueId: queue._id,
      status: { $in: ["waiting", "called", "in-progress"] },
    });
    if (activeTickets > 0)
      return res
        .status(400)
        .json(
          formatResponse(
            null,
            "Cannot delete queue with active tickets",
            "fail",
          ),
        );

    await Queue.findByIdAndDelete(req.params.id);
    res.status(200).json(formatResponse(null, "Queue deleted successfully"));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "error", message: "Server error deleting queue" });
  }
};
