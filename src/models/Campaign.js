import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a campaign name'],
        trim: true,
        maxlength: [100, 'Campaign name cannot be more than 100 characters'],
    },
    subject: {
        type: String,
        required: [true, 'Please provide an email subject'],
        trim: true,
        maxlength: [200, 'Subject cannot be more than 200 characters'],
    },
    content: {
        type: String,
        default: '',
    },
    brandId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: [true, 'Campaign must belong to a brand'],
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Campaign must belong to a user'],
    },
    fromName: {
        type: String,
        trim: true,
    },
    fromEmail: {
        type: String,
        trim: true,
    },
    replyTo: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['draft', 'queued', 'scheduled', 'sending', 'sent', 'failed'],
        default: 'draft',
    },
    contactListIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ContactList',
        },
    ],
    scheduleType: {
        type: String,
        enum: ['send_now', 'schedule'],
        default: 'send_now',
    },
    scheduledAt: {
        type: Date,
    },
    sentAt: {
        type: Date,
    },
    totalRecipients: {
        type: Number,
        default: 0,
    },
    stats: {
        recipients: {
            type: Number,
            default: 0,
        },
        opens: {
            type: Number,
            default: 0,
        },
        clicks: {
            type: Number,
            default: 0,
        },
        bounces: {
            type: Number,
            default: 0,
        },
        complaints: {
            type: Number,
            default: 0,
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update the 'updatedAt' field on save
CampaignSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Calculate derived statistics
CampaignSchema.virtual('openRate').get(function () {
    return this.stats.recipients > 0 ? ((this.stats.opens / this.stats.recipients) * 100).toFixed(1) : 0;
});

CampaignSchema.virtual('clickRate').get(function () {
    return this.stats.recipients > 0 ? ((this.stats.clicks / this.stats.recipients) * 100).toFixed(1) : 0;
});

// Set virtuals to true when converting to JSON
CampaignSchema.set('toJSON', { virtuals: true });
CampaignSchema.set('toObject', { virtuals: true });

const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
export default Campaign;
