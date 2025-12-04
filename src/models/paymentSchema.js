const mongoose = require('mongoose');

const paymentSchema = mongoose.Schema({
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'credit-card', 'wallet', 'mobile'],
        required: true
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'succeeded', 'failed', 'refunded'],
        default: 'pending'
    },
    // Stripe integration fields
    stripePaymentIntentId: {
        type: String,
        sparse: true
    },
    stripeRefundId: {
        type: String
    },
    // Refund details
    refundAmount: {
        type: Number
    },
    refundReason: {
        type: String
    },
    refundDate: {
        type: Date
    },
    paidAt: {
        type: Date
    },
    // Additional metadata
    metadata: {
        type: Map,
        of: String
    }
},{timestamps: true})

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;