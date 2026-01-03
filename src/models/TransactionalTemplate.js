import mongoose from 'mongoose';

const TransactionalTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Template name is required'],
        trim: true,
        maxlength: [100, 'Template name cannot be more than 100 characters'],
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
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
        required: [true, 'Template must belong to a brand'],
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Template must belong to a user'],
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
        enum: ['draft', 'active', 'inactive'],
        default: 'draft',
    },
    apiKey: {
        type: String,
        required: true,
        unique: true,
    },
    variables: [
        {
            name: String,
            description: String,
            required: {
                type: Boolean,
                default: false,
            },
        },
    ],
    stats: {
        sent: {
            type: Number,
            default: 0,
        },
        opens: {
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
    trackingConfig: {
        trackOpens: {
            type: Boolean,
            default: true,
        },
        trackClicks: {
            type: Boolean,
            default: true,
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
TransactionalTemplateSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Calculate derived statistics
TransactionalTemplateSchema.virtual('openRate').get(function () {
    return this.stats.sent > 0 ? ((this.stats.opens / this.stats.sent) * 100).toFixed(1) : 0;
});

TransactionalTemplateSchema.virtual('clickRate').get(function () {
    return this.stats.sent > 0 ? ((this.stats.clicks / this.stats.sent) * 100).toFixed(1) : 0;
});

// Set virtuals to true when converting to JSON
TransactionalTemplateSchema.set('toJSON', { virtuals: true });
TransactionalTemplateSchema.set('toObject', { virtuals: true });

const TransactionalTemplate = mongoose.models.TransactionalTemplate || mongoose.model('TransactionalTemplate', TransactionalTemplateSchema);
export default TransactionalTemplate;
