const mongoose = require('mongoose');

const clinicSchema = mongoose.Schema({
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
    mobilePhone: {
        type: String,
        required: true,
        minlength: 11,
        maxlength: 11,
    },
    landlinePhone: {
        type: String,
        required: true,
        minlength: 8,
        maxlength: 8,
    },
    profileImage: {
        type: String,
    },
    businessImages: {
        type: [String],
    },
    address: {
        type: String,
        required: true
    },
    ourClients: [
        {type: mongoose.Schema.Types.ObjectId, ref: User}
    ],
    specialization: {
        type: String
    },
    workingHours: [
        {
            days: {
                type: String,
                enum: ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                required: true
            },
            openTime: {
                type: String,
                required: true
            },
            closeTime: {
                type: String,
                required: true
            },
            isClosed: {
                type: Boolean,
                default: false
            }
        }
    ],
    service: [
        {
            name: {
                type: String,
                required: true
            },
            description: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            duration: {
                type: Number,
                required: true
            }
        }
    ],
    queueSettings: [
        {
            maxPatientsPerDay: {
                type: Number,
                required: true
            },
            LastTimeToAppoint: {
                type: String,
                required: true
            }
        }
    ],
    paymentMethod: {
        type: String,
        enum: ['cash', 'credit-card', 'wallet'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    }
},{timestamps: true})

const Clinic = mongoose.model('Clinic', clinicSchema);

module.exports = Clinic;