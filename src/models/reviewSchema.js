const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    comment: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true
    }
},{timestamps: true})

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;