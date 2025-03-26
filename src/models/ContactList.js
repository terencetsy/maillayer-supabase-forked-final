import mongoose from 'mongoose';

const ContactListSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'List name is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
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
        contactCount: {
            type: Number,
            default: 0,
        },
        webhookSecret: {
            type: String,
            trim: true,
        },
        webhookEndpoint: {
            type: String,
            trim: true,
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

// Update the 'updatedAt' field on save
ContactListSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const ContactList = mongoose.models.ContactList || mongoose.model('ContactList', ContactListSchema);

export default ContactList;
