const Payment = require("../models/paymentSchema");
const Ticket = require("../models/ticketSchema");
const Business = require("../models/businessSchema");
const Queue = require("../models/queueSchema");
const stripe = require("stripe")(
  process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key"
);

// -------------------------
// POST /api/v1/payments
// Create payment
// -------------------------
exports.createPayment = async (req, res) => {
  try {
    const { ticketId, amount, paymentMethod, paymentMethodId } = req.body;

    if (!ticketId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Please provide ticketId, amount, and paymentMethod",
      });
    }

    // Verify ticket exists
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Verify user owns the ticket
    if (ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    let stripePaymentIntent = null;
    let transactionId = `TXN-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // If using Stripe (card payment)
    if (paymentMethod === "card" && paymentMethodId) {
      try {
        // Create Stripe Payment Intent
        stripePaymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Stripe uses cents
          currency: process.env.PAYMENT_CURRENCY || "usd",
          payment_method: paymentMethodId,
          confirm: true,
          metadata: {
            ticketId: ticketId,
            userId: req.user.id,
            businessId: ticket.businessId.toString(),
          },
        });

        transactionId = stripePaymentIntent.id;
      } catch (stripeError) {
        return res.status(400).json({
          success: false,
          message: "Payment failed: " + stripeError.message,
        });
      }
    }

    // Create payment record
    const payment = await Payment.create({
      userId: req.user.id,
      ticketId,
      businessId: ticket.businessId,
      amount,
      paymentMethod,
      status: stripePaymentIntent ? "completed" : "pending",
      transactionId,
      stripePaymentIntentId: stripePaymentIntent?.id,
    });

    // Update ticket payment status
    // Mark as paid only when immediate confirmation exists (card)
    // For cash, keep as unpaid until staff marks payment complete
    ticket.paymentStatus = stripePaymentIntent ? "paid" : "unpaid";
    await ticket.save();

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: {
        payment,
        clientSecret: stripePaymentIntent?.client_secret,
      },
    });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payment",
    });
  }
};

// -------------------------
// POST /api/v1/payments/checkout/card
// Card checkout without ticket; creates ticket after success
// -------------------------
exports.checkoutCardAndCreateTicket = async (req, res) => {
  try {
    const { businessId, queueId, amount, paymentMethodId, type, priority } =
      req.body;

    if (!businessId || !queueId || !amount || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "businessId, queueId, amount, paymentMethodId are required",
      });
    }

    // Validate business and queue
    const business = await Business.findById(businessId);
    if (!business)
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    if (business.status !== "active")
      return res
        .status(400)
        .json({ success: false, message: "Business is closed" });

    const queue = await Queue.findById(queueId);
    if (!queue)
      return res
        .status(404)
        .json({ success: false, message: "Queue not found" });
    if (queue.businessId.toString() !== businessId)
      return res.status(400).json({
        success: false,
        message: "Queue does not belong to this business",
      });
    if (queue.status !== "active")
      return res
        .status(400)
        .json({ success: false, message: "Queue not accepting tickets" });

    // Create and confirm Stripe Payment Intent
    let stripePaymentIntent;
    try {
      stripePaymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(amount) * 100),
        currency: process.env.PAYMENT_CURRENCY || "usd",
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        payment_method_types: ["card"],
        metadata: {
          userId: req.user.id,
          businessId,
          queueId,
          type: type || "examination",
          priority: priority || "normal",
        },
      });
    } catch (stripeError) {
      return res.status(400).json({
        success: false,
        message: "Payment failed: " + stripeError.message,
      });
    }

    const transactionId = stripePaymentIntent.id;

    // Attempt to allocate a ticket atomically
    const updatedQueue = await Queue.findOneAndUpdate(
      {
        _id: queueId,
        currentCount: { $lt: queue.maxCapacity },
        status: "active",
      },
      { $inc: { currentCount: 1, currentTicketNumber: 1 } },
      { new: true }
    );

    if (!updatedQueue) {
      // Refund since no capacity
      try {
        await stripe.refunds.create({
          payment_intent: stripePaymentIntent.id,
          amount: Math.round(Number(amount) * 100),
        });
      } catch (refundErr) {
        // log but continue
        console.error("Stripe refund failed:", refundErr.message);
      }
      return res
        .status(400)
        .json({ success: false, message: "Queue is full. Refunded payment." });
    }

    // Create ticket
    const ticket = await Ticket.create({
      businessId,
      userId: req.user.id,
      queueId,
      ticketNumber: updatedQueue.currentTicketNumber,
      type: type || "examination",
      status: "waiting",
      priority: priority || "normal",
      paymentStatus: "paid",
    });

    // Link user to business clients list
    await Business.findByIdAndUpdate(businessId, {
      $addToSet: { ourClients: req.user.id },
    });

    // Create payment record linked to ticket
    const payment = await Payment.create({
      userId: req.user.id,
      ticketId: ticket._id,
      businessId,
      amount,
      paymentMethod: "card",
      status: "completed",
      transactionId,
      stripePaymentIntentId: stripePaymentIntent.id,
      paidAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Payment succeeded and ticket created",
      data: { ticket, payment },
    });
  } catch (error) {
    console.error("checkoutCardAndCreateTicket error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error processing card checkout",
    });
  }
};

// -------------------------
// GET /api/v1/payments/:id
// Get payment by ID
// -------------------------
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("userId", "name email")
      .populate("businessId", "name")
      .populate("ticketId");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check authorization
    if (
      payment.userId._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payment",
    });
  }
};

// -------------------------
// GET /api/v1/payments
// Get all payments (admin only)
// -------------------------
exports.getAllPayments = async (req, res) => {
  try {
    const {
      userId,
      businessId,
      status,
      from,
      to,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (businessId) query.businessId = businessId;
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("userId", "name email")
        .populate("businessId", "name")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payments",
    });
  }
};

// -------------------------
// GET /api/v1/users/me/payments
// Get user's payment history
// -------------------------
exports.getUserPayments = async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 10 } = req.query;

    const query = { userId: req.user.id };
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("businessId", "name")
        .populate("ticketId")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get user payments error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payments",
    });
  }
};

// -------------------------
// GET /api/v1/businesses/:businessId/payments
// Get business payments (owner only)
// -------------------------
exports.getBusinessPayments = async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 10 } = req.query;
    const { businessId } = req.params;

    const query = { businessId };
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("userId", "name email")
        .populate("ticketId")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get business payments error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving business payments",
    });
  }
};

// -------------------------
// POST /api/v1/payments/:id/refund
// Refund payment
// -------------------------
exports.refundPayment = async (req, res) => {
  try {
    const { reason, amount } = req.body;
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Payment already refunded",
      });
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      return res.status(400).json({
        success: false,
        message: "Refund amount cannot exceed payment amount",
      });
    }

    // Process Stripe refund if payment was made via Stripe
    if (payment.stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: Math.round(refundAmount * 100), // Stripe uses cents
          reason: reason || "requested_by_customer",
        });

        payment.stripeRefundId = refund.id;
      } catch (stripeError) {
        return res.status(400).json({
          success: false,
          message: "Stripe refund failed: " + stripeError.message,
        });
      }
    }

    payment.status = "refunded";
    payment.refundAmount = refundAmount;
    payment.refundReason = reason;
    payment.refundDate = new Date();
    await payment.save();

    // Update ticket payment status
    if (payment.ticketId) {
      await Ticket.findByIdAndUpdate(payment.ticketId, {
        paymentStatus: "refunded",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Refund payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing refund",
    });
  }
};

// -------------------------
// GET /api/v1/payments/:id/receipt
// Get payment receipt
// -------------------------
exports.getReceipt = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("userId", "name email phone")
      .populate("businessId", "name address phone")
      .populate("ticketId");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check authorization
    if (
      payment.userId._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    // TODO: Generate PDF receipt
    // For now, return receipt data
    res.status(200).json({
      success: true,
      data: {
        receiptNumber: payment.transactionId,
        date: payment.createdAt,
        customer: payment.userId,
        business: payment.businessId,
        ticket: payment.ticketId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("Get receipt error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving receipt",
    });
  }
};

// -------------------------
// POST /api/v1/payments/webhook/stripe
// Stripe webhook handler
// -------------------------
exports.stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;

        // Update payment status in database
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          {
            status: "completed",
            paidAt: new Date(),
          }
        );

        console.log("Payment succeeded:", paymentIntent.id);
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;

        // Update payment status to failed
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: failedPayment.id },
          { status: "failed" }
        );

        console.log("Payment failed:", failedPayment.id);
        break;

      case "charge.refunded":
        const refund = event.data.object;

        // Update payment status to refunded
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: refund.payment_intent },
          {
            status: "refunded",
            refundDate: new Date(),
          }
        );

        console.log("Charge refunded:", refund.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(400).json({
      success: false,
      message: "Webhook error",
    });
  }
};

// -------------------------
// POST /api/v1/payments/verify
// Verify payment status
// -------------------------
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, transactionId } = req.body;

    if (!paymentId || !transactionId) {
      return res.status(400).json({
        success: false,
        message: "Please provide paymentId and transactionId",
      });
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      transactionId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // TODO: Verify with payment gateway
    // For now, just return payment status
    res.status(200).json({
      success: true,
      data: {
        verified: true,
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId,
      },
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
    });
  }
};
