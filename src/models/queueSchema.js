    const mongoose = require('mongoose');

    const queueSchema = mongoose.Schema({
        clinicId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Clinic'
        },
        ticketId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ticket'
        },
        maxCapacity: {
            type: Number,
            default: 20
        },
        currentCount: {
            type: Number,
        },
        status: {
            type: String,
            enum: ['active', 'paused', 'closed'],
        },
        currentTicketNumber: {
            type: Number,
        }
    },{timestamps: true})

    const Queue = mongoose.model('Queue', queueSchema);

    module.exports = Queue;