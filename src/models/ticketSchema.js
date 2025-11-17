const mongoose = require('mongoose');

const ticketSchema = mongoose.Schema({
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    queueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Queue'
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    ticketNumber: {
        type: Number,
    },
    type: {
        type: String,
        enum: ["examination", "consultation"],
        default: "examination"
    },
    status: {
        type: String,
        enum: ["waiting", "called", "in-progress", "missed", "done", "cancelled"],
    },
    estimatedTime: {
        type: Number,
    }
},{timestamps: true})

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;