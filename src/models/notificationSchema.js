const mongoose = require('mongoose');

const notificationSchema = mongoose.Schema({
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
    queueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Queue'
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    message: {
        type: String,
        required: true
    }
},{timestamps: true})

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;