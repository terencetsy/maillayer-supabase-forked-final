import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        firstName: {
            type: String,
            trim: true,
        },
        lastName: {
            type: String,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        listId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ContactList',
            required: true,
        },
        brandId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Brand',
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Create a compound unique index on email and listId to prevent duplicates
ContactSchema.index({ email: 1, listId: 1 }, { unique: true });

// Update the 'updatedAt' field on save
ContactSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);

export default Contact;
