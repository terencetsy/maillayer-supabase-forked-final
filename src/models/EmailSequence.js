// src/models/EmailSequence.js
import mongoose from 'mongoose';

const EmailSequenceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Sequence name is required'],
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
        // Trigger Configuration
        triggerType: {
            type: String,
            enum: ['contact_list', 'integration', 'webhook', 'manual'],
            default: 'contact_list',
        },
        triggerConfig: {
            // For contact_list trigger
            contactListIds: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'ContactList',
                },
            ],
            // For integration trigger
            integrationType: String, // 'stripe', 'firebase', etc.
            integrationEvent: String, // 'checkout.completed', 'user.created', etc.
            integrationAccountId: String,
        },
        // Email Configuration (from brand or custom)
        emailConfig: {
            fromName: String,
            fromEmail: String,
            replyToEmail: String,
        },
        status: {
            type: String,
            enum: ['active', 'paused', 'archived', 'draft'], // Added 'draft'
            default: 'draft',
        },
        emails: [
            {
                id: {
                    type: String,
                    required: true,
                },
                order: {
                    type: Number,
                    required: true,
                },
                subject: {
                    type: String,
                    trim: true,
                },
                content: {
                    type: String,
                },
                delayAmount: {
                    type: Number,
                    default: 0,
                },
                delayUnit: {
                    type: String,
                    enum: ['minutes', 'hours', 'days'],
                    default: 'days',
                },
                // Visual position for canvas
                position: {
                    x: { type: Number, default: 0 },
                    y: { type: Number, default: 0 },
                },
            },
        ],
        // Canvas layout
        canvasData: {
            zoom: {
                type: Number,
                default: 1,
            },
            pan: {
                x: { type: Number, default: 0 },
                y: { type: Number, default: 0 },
            },
        },
        canvasPositions: {
            type: Map,
            of: {
                x: Number,
                y: Number,
            },
            default: {},
        },
        stats: {
            totalEnrolled: {
                type: Number,
                default: 0,
            },
            totalCompleted: {
                type: Number,
                default: 0,
            },
            totalActive: {
                type: Number,
                default: 0,
            },
        },
    },
    {
        timestamps: true,
    }
);

// Add index for faster queries
EmailSequenceSchema.index({ brandId: 1, userId: 1 });
EmailSequenceSchema.index({ status: 1 });
EmailSequenceSchema.index({ 'triggerConfig.contactListIds': 1 });

const EmailSequence = mongoose.models.EmailSequence || mongoose.model('EmailSequence', EmailSequenceSchema);

export default EmailSequence;
