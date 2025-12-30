import mongoose from 'mongoose';

const BrandSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Brand name is required'],
            trim: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },
        website: {
            type: String,
            required: [true, 'Brand website is required'],
            trim: true,
        },
        // Optional AWS SES fields that can be filled in later
        awsRegion: {
            type: String,
            trim: true,
        },
        awsAccessKey: {
            type: String,
            trim: true,
        },
        awsSecretKey: {
            type: String,
            trim: true,
            select: false, // Don't return this in regular queries
        },
        sendingDomain: {
            type: String,
            trim: true,
        },
        fromName: {
            type: String,
            trim: true,
            default: '',
        },
        fromEmail: {
            type: String,
            trim: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
        },
        replyToEmail: {
            type: String,
            trim: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
        },
        status: {
            type: String,
            enum: {
                values: ['active', 'inactive', 'pending_setup', 'pending_verification'],
                message: '{VALUE} is not a valid status',
            },
            default: 'pending_setup',
        },
        snsBounceTopicArn: {
            type: String,
            trim: true,
        },
        sesConfigurationSet: {
            type: String,
            trim: true,
        },
        // Email Provider Configuration
        emailProvider: {
            type: String,
            enum: ['ses', 'sendgrid', 'mailgun'],
            default: 'ses',
        },
        emailProviderConnectionType: {
            type: String,
            enum: ['api', 'smtp'],
            default: 'api',
        },
        // SendGrid Configuration
        sendgridApiKey: {
            type: String,
            trim: true,
            select: false, // Don't return in regular queries
        },
        // Mailgun Configuration
        mailgunApiKey: {
            type: String,
            trim: true,
            select: false, // Don't return in regular queries
        },
        mailgunDomain: {
            type: String,
            trim: true,
        },
        mailgunRegion: {
            type: String,
            enum: ['us', 'eu'],
            default: 'us',
        },
        // Generic SMTP Configuration (for SMTP connection type)
        smtpHost: {
            type: String,
            trim: true,
        },
        smtpPort: {
            type: Number,
            default: 587,
        },
        smtpUsername: {
            type: String,
            trim: true,
        },
        smtpPassword: {
            type: String,
            trim: true,
            select: false, // Don't return in regular queries
        },
        smtpSecure: {
            type: Boolean,
            default: false,
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

// Don't return sensitive keys when converting document to JSON
BrandSchema.set('toJSON', {
    transform: function (doc, ret, opt) {
        delete ret.awsSecretKey;
        delete ret.sendgridApiKey;
        delete ret.mailgunApiKey;
        delete ret.smtpPassword;
        return ret;
    },
});

// Pre-save hook to update timestamps
BrandSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);

export default Brand;
