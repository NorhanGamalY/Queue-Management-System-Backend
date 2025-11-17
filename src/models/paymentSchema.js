const mongoose = require('mongoose');

const paymentSchema = mongoose.Schema({
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic'
    },
    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'credit-card', 'wallet'],
        required: true
    },
    transactionId: {
        type: String,
    },
    status: {
        type: String,
        enum: ['succeeded', 'failed', 'refunded'],
    }
},{timestamps: true})

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;