const mongoose = require("mongoose");

const ticketSchema = mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    queueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Queue",
      required: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    ticketNumber: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["examination", "consultation", "procedure", "followup"],
      default: "examination",
    },
    status: {
      type: String,
      enum: ["waiting", "called", "in-progress", "missed", "done", "cancelled"],
      default: "waiting",
    },
    // Priority for fast-track queueing (payment feature)
    priority: {
      type: String,
      enum: ["normal", "priority", "vip"],
      default: "normal",
    },
    // ETA in minutes (AI-calculated)
    estimatedTime: {
      type: Number,
      default: 15,
    },
    // Expected service time
    expectedServiceTime: {
      type: Date,
    },
    // Actual service timestamps
    calledAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    // Cancellation details
    cancelReason: {
      type: String,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Payment status
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    // Notes from staff
    notes: {
      type: String,
    },
  },
  { timestamps: true },
);

// Index for faster queries
ticketSchema.index({ businessId: 1, status: 1 });
ticketSchema.index({ queueId: 1, ticketNumber: 1 });
ticketSchema.index({ userId: 1, createdAt: -1 });

const Ticket = mongoose.model("Ticket", ticketSchema);

module.exports = Ticket;
