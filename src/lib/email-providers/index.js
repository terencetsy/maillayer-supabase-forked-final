/**
 * Email Providers Module
 *
 * Exports all email provider classes and the factory for creating provider instances.
 */

const BaseEmailProvider = require('./BaseEmailProvider');
const SESProvider = require('./SESProvider');
const SendGridApiProvider = require('./SendGridApiProvider');
const SendGridSmtpProvider = require('./SendGridSmtpProvider');
const MailgunApiProvider = require('./MailgunApiProvider');
const MailgunSmtpProvider = require('./MailgunSmtpProvider');
const ProviderFactory = require('./ProviderFactory');

module.exports = {
    // Base class
    BaseEmailProvider,

    // Provider implementations
    SESProvider,
    SendGridApiProvider,
    SendGridSmtpProvider,
    MailgunApiProvider,
    MailgunSmtpProvider,

    // Factory
    ProviderFactory,

    // Convenience function
    createProvider: ProviderFactory.createProvider,
    getSupportedProviders: ProviderFactory.getSupportedProviders,
    getProviderDisplayName: ProviderFactory.getProviderDisplayName,
    validateConfig: ProviderFactory.validateConfig,
};
