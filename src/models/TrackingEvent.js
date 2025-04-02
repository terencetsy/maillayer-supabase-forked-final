import mongoose from 'mongoose';

// Base schema for tracking events
const TrackingEventSchema = new mongoose.Schema(
    {
        contactId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contact',
            required: true,
        },
        campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Campaign',
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        userAgent: String,
        ipAddress: String,
        timestamp: {
            type: Date,
            default: Date.now,
        },
        eventType: {
            type: String,
            required: true,
            enum: ['open', 'click', 'bounce', 'complaint', 'delivery', 'unsubscribe'],
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Dynamic model creation function for campaign-specific stats collections
export const createTrackingModel = (campaignId) => {
    const collectionName = `stats_${campaignId}`;

    // Check if model already exists to prevent model overwrite warnings
    return mongoose.models[collectionName] || mongoose.model(collectionName, TrackingEventSchema, collectionName);
};

// Create a generic model for when the specific campaignId is not known yet
const TrackingEvent = mongoose.models.TrackingEvent || mongoose.model('TrackingEvent', TrackingEventSchema);

export default TrackingEvent;
