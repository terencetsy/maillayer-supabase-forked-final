import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Settings, ArrowLeft, Save, Globe, Mail, Shield, Trash, AlertCircle, CheckCircle, Loader, Palette, Sliders, Webhook, Copy, ExternalLink } from 'lucide-react';
import { AWS_SES_REGIONS } from '@/constants/awsRegions';

export default function BrandSettings() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [activeTab, setActiveTab] = useState('general');

    // General settings
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');

    // Sending settings
    const [fromName, setFromName] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [replyToEmail, setReplyToEmail] = useState('');

    // Email Provider settings
    const [emailProvider, setEmailProvider] = useState('ses');
    const [emailProviderConnectionType, setEmailProviderConnectionType] = useState('api');

    // AWS SES settings
    const [awsRegion, setAwsRegion] = useState('');
    const [awsAccessKey, setAwsAccessKey] = useState('');
    const [awsSecretKey, setAwsSecretKey] = useState('');

    // SendGrid settings
    const [sendgridApiKey, setSendgridApiKey] = useState('');

    // Mailgun settings
    const [mailgunApiKey, setMailgunApiKey] = useState('');
    const [mailgunDomain, setMailgunDomain] = useState('');
    const [mailgunRegion, setMailgunRegion] = useState('us');

    // Appearance
    const [logoUrl, setLogoUrl] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#5d87ff');
    const [secondaryColor, setSecondaryColor] = useState('#333347');

    // Delete brand
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Webhook copy state
    const [copiedWebhook, setCopiedWebhook] = useState(false);

    // Get the base URL for webhooks
    const getWebhookBaseUrl = () => {
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }
        return '';
    };

    const copyWebhookUrl = (url) => {
        navigator.clipboard.writeText(url);
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
        }
    }, [status, id, router]);

    useEffect(() => {
        if (brand) {
            setName(brand.name || '');
            setWebsite(brand.website || '');
            setFromName(brand.fromName || '');
            setFromEmail(brand.fromEmail || '');
            setReplyToEmail(brand.replyToEmail || '');
            // Email Provider settings
            setEmailProvider(brand.emailProvider || 'ses');
            setEmailProviderConnectionType(brand.emailProviderConnectionType || 'api');
            // AWS SES
            setAwsRegion(brand.awsRegion || '');
            setAwsAccessKey(brand.awsAccessKey || '');
            setAwsSecretKey(brand.awsSecretKey ? '••••••••••••••••' : '');
            // SendGrid
            setSendgridApiKey(brand.sendgridApiKey ? '••••••••••••••••' : '');
            // Mailgun
            setMailgunApiKey(brand.mailgunApiKey ? '••••••••••••••••' : '');
            setMailgunDomain(brand.mailgunDomain || '');
            setMailgunRegion(brand.mailgunRegion || 'us');
            // Appearance
            setLogoUrl(brand.logoUrl || '');
            setPrimaryColor(brand.primaryColor || '#5d87ff');
            setSecondaryColor(brand.secondaryColor || '#333347');
        }
    }, [brand]);

    const fetchBrandDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}?includeSecrets=true`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to fetch brand details');
            const data = await res.json();
            setBrand(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formType = e.target.getAttribute('data-form-type');

        setIsSaving(true);
        setError('');
        setSuccess('');

        try {
            let updateData = {};

            switch (formType) {
                case 'general':
                    if (!name || !website) throw new Error('Name and website are required');
                    updateData = { name, website };
                    break;
                case 'sending':
                    updateData = { fromName, fromEmail, replyToEmail };
                    break;
                case 'appearance':
                    updateData = { logoUrl, primaryColor, secondaryColor };
                    break;
                case 'provider':
                    updateData = {
                        emailProvider,
                        emailProviderConnectionType,
                    };
                    // Add provider-specific credentials
                    if (emailProvider === 'ses') {
                        updateData.awsRegion = awsRegion;
                        updateData.awsAccessKey = awsAccessKey;
                        if (awsSecretKey !== '••••••••••••••••') {
                            updateData.awsSecretKey = awsSecretKey;
                        }
                    } else if (emailProvider === 'sendgrid') {
                        if (sendgridApiKey !== '••••••••••••••••') {
                            updateData.sendgridApiKey = sendgridApiKey;
                        }
                    } else if (emailProvider === 'mailgun') {
                        updateData.mailgunDomain = mailgunDomain;
                        updateData.mailgunRegion = mailgunRegion;
                        if (mailgunApiKey !== '••••••••••••••••') {
                            updateData.mailgunApiKey = mailgunApiKey;
                        }
                    }
                    break;
                default:
                    throw new Error('Unknown form type');
            }

            const res = await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Failed to update settings');

            setSuccess('Settings saved successfully');
            fetchBrandDetails();
        } catch (error) {
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBrand = async () => {
        if (deleteConfirmText !== brand.name) {
            setError('Enter brand name to confirm');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const res = await fetch(`/api/brands/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Failed to delete brand');
            router.push('/brands');
        } catch (error) {
            setError(error.message);
            setIsSaving(false);
        }
    };

    const renderSettingsTab = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <form
                        onSubmit={handleSubmit}
                        data-form-type="general"
                        className="settings-form"
                    >
                        <div className="form-group">
                            <label htmlFor="name">Brand Name</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your Brand"
                                disabled={isSaving}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="website">Website</label>
                            <input
                                type="text"
                                id="website"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                placeholder="example.com"
                                disabled={isSaving}
                                required
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="button button--primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        <span>Save</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                );

            case 'sending':
                return (
                    <form
                        onSubmit={handleSubmit}
                        data-form-type="sending"
                        className="settings-form"
                    >
                        {brand?.status !== 'active' && (
                            <div className="verification-banner">
                                <Shield size={16} />
                                <span>Verification required to send campaigns</span>
                                <Link
                                    href={`/brands/${id}/verification`}
                                    className="button button--secondary button--small"
                                >
                                    Verify
                                </Link>
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="fromName">Sender Name</label>
                            <input
                                type="text"
                                id="fromName"
                                value={fromName}
                                onChange={(e) => setFromName(e.target.value)}
                                placeholder="Your Company"
                                disabled={isSaving}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="fromEmail">Sender Email</label>
                            <input
                                type="email"
                                id="fromEmail"
                                value={fromEmail}
                                onChange={(e) => setFromEmail(e.target.value)}
                                placeholder="noreply@example.com"
                                disabled={isSaving}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="replyToEmail">Reply-To Email</label>
                            <input
                                type="email"
                                id="replyToEmail"
                                value={replyToEmail}
                                onChange={(e) => setReplyToEmail(e.target.value)}
                                placeholder="support@example.com"
                                disabled={isSaving}
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="button button--primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        <span>Save</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                );

            case 'appearance':
                return (
                    <form
                        onSubmit={handleSubmit}
                        data-form-type="appearance"
                        className="settings-form"
                    >
                        <div className="form-group">
                            <label htmlFor="logoUrl">Logo URL</label>
                            <input
                                type="text"
                                id="logoUrl"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                disabled={isSaving}
                            />
                        </div>

                        <div className="color-settings">
                            <div className="form-group">
                                <label htmlFor="primaryColor">Primary Color</label>
                                <div className="color-picker-wrapper">
                                    <input
                                        type="color"
                                        id="primaryColor"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        disabled={isSaving}
                                    />
                                    <input
                                        type="text"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="color-text-input"
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="secondaryColor">Secondary Color</label>
                                <div className="color-picker-wrapper">
                                    <input
                                        type="color"
                                        id="secondaryColor"
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        disabled={isSaving}
                                    />
                                    <input
                                        type="text"
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        className="color-text-input"
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="button button--primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        <span>Save</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                );

            case 'provider':
                return (
                    <form
                        onSubmit={handleSubmit}
                        data-form-type="provider"
                        className="settings-form"
                    >
                        <div className="form-group">
                            <label htmlFor="emailProvider">Email Provider</label>
                            <select
                                id="emailProvider"
                                value={emailProvider}
                                onChange={(e) => setEmailProvider(e.target.value)}
                                disabled={isSaving}
                            >
                                <option value="ses">Amazon SES</option>
                                <option value="sendgrid">SendGrid</option>
                                <option value="mailgun">Mailgun</option>
                            </select>
                        </div>

                        {(emailProvider === 'sendgrid' || emailProvider === 'mailgun') && (
                            <div className="form-group">
                                <label htmlFor="connectionType">Connection Type</label>
                                <select
                                    id="connectionType"
                                    value={emailProviderConnectionType}
                                    onChange={(e) => setEmailProviderConnectionType(e.target.value)}
                                    disabled={isSaving}
                                >
                                    <option value="api">API (Recommended)</option>
                                    <option value="smtp">SMTP</option>
                                </select>
                            </div>
                        )}

                        {/* AWS SES Settings */}
                        {emailProvider === 'ses' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="awsRegion">AWS Region</label>
                                    <select
                                        id="awsRegion"
                                        value={awsRegion}
                                        onChange={(e) => setAwsRegion(e.target.value)}
                                        disabled={isSaving}
                                    >
                                        <option value="">Select region</option>
                                        {AWS_SES_REGIONS.map((region) => (
                                            <option
                                                key={region.value}
                                                value={region.value}
                                            >
                                                {region.label} ({region.value})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="awsAccessKey">Access Key ID</label>
                                    <input
                                        type="text"
                                        id="awsAccessKey"
                                        value={awsAccessKey}
                                        onChange={(e) => setAwsAccessKey(e.target.value)}
                                        placeholder="AKIAIOSFODNN7EXAMPLE"
                                        disabled={isSaving}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="awsSecretKey">Secret Access Key</label>
                                    <input
                                        type="password"
                                        id="awsSecretKey"
                                        value={awsSecretKey}
                                        onChange={(e) => setAwsSecretKey(e.target.value)}
                                        placeholder="Enter new key or leave unchanged"
                                        disabled={isSaving}
                                    />
                                </div>
                            </>
                        )}

                        {/* SendGrid Settings */}
                        {emailProvider === 'sendgrid' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="sendgridApiKey">SendGrid API Key</label>
                                    <input
                                        type="password"
                                        id="sendgridApiKey"
                                        value={sendgridApiKey}
                                        onChange={(e) => setSendgridApiKey(e.target.value)}
                                        placeholder="Enter API key or leave unchanged"
                                        disabled={isSaving}
                                    />
                                    <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                                        Get your API key from{' '}
                                        <a
                                            href="https://app.sendgrid.com/settings/api_keys"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            SendGrid Dashboard
                                        </a>
                                    </small>
                                </div>

                                {/* SendGrid Webhook Setup Instructions */}
                                <div className="webhook-setup-section">
                                    <div className="webhook-header">
                                        <Webhook size={16} />
                                        <h4>Webhook Configuration</h4>
                                    </div>
                                    <p className="webhook-description">
                                        Configure webhooks in SendGrid to track email events (bounces, opens, clicks, etc.)
                                    </p>

                                    <div className="webhook-url-box">
                                        <label>Webhook URL</label>
                                        <div className="webhook-url-input">
                                            <code>{getWebhookBaseUrl()}/api/webhooks/sendgrid</code>
                                            <button
                                                type="button"
                                                className="copy-btn"
                                                onClick={() => copyWebhookUrl(`${getWebhookBaseUrl()}/api/webhooks/sendgrid`)}
                                                title="Copy webhook URL"
                                            >
                                                {copiedWebhook ? <CheckCircle size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="webhook-instructions">
                                        <h5>Setup Steps:</h5>
                                        <ol>
                                            <li>Go to <a href="https://app.sendgrid.com/settings/mail_settings" target="_blank" rel="noopener noreferrer">SendGrid Mail Settings <ExternalLink size={12} /></a></li>
                                            <li>Click on <strong>Event Webhook</strong></li>
                                            <li>Enter the webhook URL above in the <strong>HTTP Post URL</strong> field</li>
                                            <li>Select the following events to track:
                                                <ul>
                                                    <li><strong>Delivered</strong> - Email delivered to recipient</li>
                                                    <li><strong>Bounced</strong> - Email bounced</li>
                                                    <li><strong>Dropped</strong> - Email dropped by SendGrid</li>
                                                    <li><strong>Opened</strong> - Email opened</li>
                                                    <li><strong>Clicked</strong> - Link clicked</li>
                                                    <li><strong>Spam Report</strong> - Marked as spam</li>
                                                    <li><strong>Unsubscribe</strong> - Unsubscribed</li>
                                                </ul>
                                            </li>
                                            <li>Enable the webhook and save</li>
                                        </ol>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Mailgun Settings */}
                        {emailProvider === 'mailgun' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="mailgunApiKey">Mailgun API Key</label>
                                    <input
                                        type="password"
                                        id="mailgunApiKey"
                                        value={mailgunApiKey}
                                        onChange={(e) => setMailgunApiKey(e.target.value)}
                                        placeholder="Enter API key or leave unchanged"
                                        disabled={isSaving}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="mailgunDomain">Mailgun Domain</label>
                                    <input
                                        type="text"
                                        id="mailgunDomain"
                                        value={mailgunDomain}
                                        onChange={(e) => setMailgunDomain(e.target.value)}
                                        placeholder="mg.yourdomain.com"
                                        disabled={isSaving}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="mailgunRegion">Mailgun Region</label>
                                    <select
                                        id="mailgunRegion"
                                        value={mailgunRegion}
                                        onChange={(e) => setMailgunRegion(e.target.value)}
                                        disabled={isSaving}
                                    >
                                        <option value="us">US</option>
                                        <option value="eu">EU</option>
                                    </select>
                                </div>

                                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                                    Get your API key from{' '}
                                    <a
                                        href="https://app.mailgun.com/settings/api_security"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Mailgun Dashboard
                                    </a>
                                </small>

                                {/* Mailgun Webhook Setup Instructions */}
                                <div className="webhook-setup-section">
                                    <div className="webhook-header">
                                        <Webhook size={16} />
                                        <h4>Webhook Configuration</h4>
                                    </div>
                                    <p className="webhook-description">
                                        Configure webhooks in Mailgun to track email events (bounces, opens, clicks, etc.)
                                    </p>

                                    <div className="webhook-url-box">
                                        <label>Webhook URL</label>
                                        <div className="webhook-url-input">
                                            <code>{getWebhookBaseUrl()}/api/webhooks/mailgun</code>
                                            <button
                                                type="button"
                                                className="copy-btn"
                                                onClick={() => copyWebhookUrl(`${getWebhookBaseUrl()}/api/webhooks/mailgun`)}
                                                title="Copy webhook URL"
                                            >
                                                {copiedWebhook ? <CheckCircle size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="webhook-instructions">
                                        <h5>Setup Steps:</h5>
                                        <ol>
                                            <li>Go to <a href="https://app.mailgun.com/mg/sending/domains" target="_blank" rel="noopener noreferrer">Mailgun Sending Domains <ExternalLink size={12} /></a></li>
                                            <li>Select your domain (<strong>{mailgunDomain || 'your domain'}</strong>)</li>
                                            <li>Click on <strong>Webhooks</strong> in the sidebar</li>
                                            <li>Add webhooks for each event type using the URL above:
                                                <ul>
                                                    <li><strong>Delivered</strong> - Email delivered</li>
                                                    <li><strong>Permanent Failure</strong> - Hard bounces</li>
                                                    <li><strong>Temporary Failure</strong> - Soft bounces</li>
                                                    <li><strong>Opened</strong> - Email opened</li>
                                                    <li><strong>Clicked</strong> - Link clicked</li>
                                                    <li><strong>Complained</strong> - Spam reports</li>
                                                    <li><strong>Unsubscribed</strong> - Unsubscribes</li>
                                                </ul>
                                            </li>
                                        </ol>
                                    </div>

                                    <div className="webhook-note">
                                        <AlertCircle size={14} />
                                        <span>
                                            <strong>Optional:</strong> For enhanced security, set <code>MAILGUN_WEBHOOK_SIGNING_KEY</code> in your environment variables using the signing key from{' '}
                                            <a href="https://app.mailgun.com/settings/api_security" target="_blank" rel="noopener noreferrer">Mailgun API Security</a>.
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="button button--primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        <span>Save</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                );

            case 'advanced':
                return (
                    <div className="danger-zone">
                        <div className="danger-header">
                            <AlertCircle size={16} />
                            <h3>Delete Brand</h3>
                        </div>

                        <div className="danger-content">
                            <p>Permanently delete this brand and all associated data. This action cannot be undone.</p>

                            {!showDeleteConfirm ? (
                                <button
                                    type="button"
                                    className="button button--primary"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                >
                                    <Trash size={16} />
                                    <span>Delete Brand</span>
                                </button>
                            ) : (
                                <div className="delete-confirm">
                                    <p className="confirm-label">Type &ldquo;{brand.name}&ldquo; to confirm deletion:</p>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        disabled={isSaving}
                                        placeholder="Brand name"
                                    />

                                    <div className="delete-actions">
                                        <button
                                            type="button"
                                            className="button button--secondary"
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                setDeleteConfirmText('');
                                            }}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="button button--primary"
                                            onClick={handleDeleteBrand}
                                            disabled={isSaving || deleteConfirmText !== brand.name}
                                            style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader
                                                        size={16}
                                                        className="spinner"
                                                    />
                                                    <span>Deleting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Trash size={16} />
                                                    <span>Delete Permanently</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (isLoading || !brand) {
        return (
            <BrandLayout brand={null}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading settings...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="settings-container">
                <div className="settings-header">
                    <Link
                        href={`/brands/${id}`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </Link>
                    <h1>Settings</h1>
                </div>

                {error && (
                    <div className="alert alert-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                        <button
                            onClick={() => setError('')}
                            className="close-alert"
                        >
                            <span>×</span>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success">
                        <CheckCircle size={16} />
                        <span>{success}</span>
                        <button
                            onClick={() => setSuccess('')}
                            className="close-alert"
                        >
                            <span>×</span>
                        </button>
                    </div>
                )}

                {/* Tabs on top */}
                <div className="settings-tabs">
                    <button
                        className={`tab-item ${activeTab === 'general' ? 'active' : ''}`}
                        onClick={() => setActiveTab('general')}
                    >
                        <Globe size={16} />
                        <span>General</span>
                    </button>

                    <button
                        className={`tab-item ${activeTab === 'sending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sending')}
                    >
                        <Mail size={16} />
                        <span>Sending</span>
                    </button>

                    <button
                        className={`tab-item ${activeTab === 'provider' ? 'active' : ''}`}
                        onClick={() => setActiveTab('provider')}
                    >
                        <Sliders size={16} />
                        <span>Email Provider</span>
                    </button>

                    <button
                        className={`tab-item ${activeTab === 'advanced' ? 'active' : ''}`}
                        onClick={() => setActiveTab('advanced')}
                    >
                        <Trash size={16} />
                        <span>Advanced</span>
                    </button>
                </div>

                {/* Content */}
                <div className="settings-content">
                    <div className="settings-panel">{renderSettingsTab()}</div>
                </div>
            </div>
        </BrandLayout>
    );
}
