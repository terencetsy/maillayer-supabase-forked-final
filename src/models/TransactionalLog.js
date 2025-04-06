// Update src/models/TransactionalLog.js to add events field

import mongoose from 'mongoose';

const TransactionalLogSchema = new mongoose.Schema({
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TransactionalTemplate',
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
    to: {
        type: String,
        required: true,
        trim: true,
    },
    subject: {
        type: String,
        required: true,
    },
    variables: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'failed'],
        default: 'sent',
    },
    error: {
        type: String,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    // Add this events array to track transactional email events
    events: [
        {
            type: {
                type: String,
                enum: ['open', 'click', 'bounce', 'complaint'],
                required: true,
            },
            timestamp: {
                type: Date,
                default: Date.now,
            },
            metadata: {
                type: mongoose.Schema.Types.Mixed,
                default: {},
            },
        },
    ],
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    sentAt: {
        type: Date,
        default: Date.now,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for faster queries
TransactionalLogSchema.index({ templateId: 1, createdAt: -1 });
TransactionalLogSchema.index({ brandId: 1, createdAt: -1 });
TransactionalLogSchema.index({ to: 1 }); // Add index for recipient email queries

const TransactionalLog = mongoose.models.TransactionalLog || mongoose.model('TransactionalLog', TransactionalLogSchema);
export default TransactionalLog;
