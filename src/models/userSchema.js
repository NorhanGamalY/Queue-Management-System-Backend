const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        trim: true,
        minlength: 8
    },
    phone: {
        type: Number,
        required: true,
        minlength: 11,
        maxlength: 11,
    },
    profileImage: {
        type: String,
    },
    type: {
        type: String,
        enum: ["examination", "consultation"],
        default: "examination"
    },
    clinicIds: [
        {type: mongoose.Schema.Types.ObjectId, ref: 'Clinic'}
    ]
},{timestamps: true})

const User = mongoose.model('User', userSchema);

module.exports = User;