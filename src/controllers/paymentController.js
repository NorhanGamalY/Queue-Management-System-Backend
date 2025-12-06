const Payment = require("../models/paymentSchema");
const Ticket = require("../models/ticketSchema");
const Stripe = require("stripe");

// Helper function to get Stripe instance with proper error handling
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. Set it in .env."
    );
  }
  return Stripe(key);
}

// -------------------------
// POST /api/v1/payments/create-checkout-session
// Create Stripe Checkout Session
// -------------------------
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({
        status: "fail",
        message: "ticketId is required",
      });
    }

    // Verify ticket exists
    const ticket = await Ticket.findById(ticketId)
      .populate('businessId', 'name')
      .populate('queueId', 'name');
    
    if (!ticket) {
      return res.status(404).json({
        status: "fail",
        message: "Ticket not found",
      });
    }

    // Verify user owns the ticket
    if (ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({
        status: "fail",
        message: "Not authorized",
      });
    }

    const stripe = getStripe();

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: req.user.email,
      client_reference_id: ticketId,
      line_items: [
        {
          price_data: {
            currency: process.env.PAYMENT_CURRENCY || "usd",
            product_data: {
              name: `Queue Ticket - ${ticket.businessId?.name || 'Business'}`,
              description: `Ticket #${ticket.ticketNumber} for ${ticket.queueId?.name || 'Queue'}`,
            },
            unit_amount: Math.round((ticket.estimatedPrice || 10) * 100), // amount in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        ticketId: ticketId.toString(),
        userId: req.user.id.toString(),
        businessId: ticket.businessId?._id.toString() || "",
        queueId: ticket.queueId?._id.toString() || "",
      },
    });

    res.status(200).json({
      status: "success",
      sessionUrl: session.url,
    });
  } catch (err) {
    next(err);
  }
};

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
    let transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    ticket.paymentStatus = "paid";
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
// Get webhook from stripe when payment is successful
// Create payment records in DB
// -------------------------
exports.stripeWebhook = async (req, res) => {
  let event;
  try {
    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("Webhook verified:", event.type);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const userId = metadata.userId;
      const ticketId = session.client_reference_id || metadata.ticketId;
      const businessId = metadata.businessId;
      const queueId = metadata.queueId;
      const amountPaid = session.amount_total / 100; // Convert from cents

      // Find the ticket
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        console.error("Ticket not found for webhook session:", ticketId);
        return res.status(400).send("Ticket not found");
      }

      // Check for duplicate payment to prevent double-processing
      const existingPayment = await Payment.findOne({
        ticketId: ticket._id,
        status: "completed",
        amount: amountPaid,
      });

      if (existingPayment) {
        console.log("Duplicate payment ignored for ticket:", ticketId);
        return res.status(200).json({ received: true });
      }

      // Create payment record
      await Payment.create({
        userId: userId,
        ticketId: ticketId,
        businessId: businessId,
        amount: amountPaid,
        paymentMethod: "card",
        status: "completed",
        transactionId: session.payment_intent,
        stripePaymentIntentId: session.payment_intent,
        paidAt: new Date(),
      });

      // Update ticket payment status
      ticket.paymentStatus = "paid";
      await ticket.save();

      console.log("Checkout session completed:", session.id);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Error processing webhook event:", err);
    res.status(400).send(`Webhook Internal Error: ${err.message}`);
  }
};

// -------------------------
// Legacy webhook handlers for other payment methods
// -------------------------
exports.stripeWebhookLegacy = async (req, res) => {
  try {
    const stripe = getStripe();
    const sig = req.headers["stripe-signature"];
    let event;

    try {
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
