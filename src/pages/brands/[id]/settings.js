import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Settings, ArrowLeft, Save, Globe, Mail, User, Shield, Trash, AlertCircle, CheckCircle, Loader, Key, Palette, Sliders } from 'lucide-react';

export default function BrandSettings() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Active settings tab
    const [activeTab, setActiveTab] = useState('general');

    // General settings
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');

    // Sending settings
    const [fromName, setFromName] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [replyToEmail, setReplyToEmail] = useState('');

    // Advanced settings
    const [awsRegion, setAwsRegion] = useState('');
    const [awsAccessKey, setAwsAccessKey] = useState('');
    const [awsSecretKey, setAwsSecretKey] = useState('');

    // Brand appearance
    const [logoUrl, setLogoUrl] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#5d87ff');
    const [secondaryColor, setSecondaryColor] = useState('#333347');

    // Delete brand
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
        // Populate form fields when brand data is loaded
        if (brand) {
            // General
            setName(brand.name || '');
            setWebsite(brand.website || '');

            // Sending
            setFromName(brand.fromName || '');
            setFromEmail(brand.fromEmail || '');
            setReplyToEmail(brand.replyToEmail || '');

            // Advanced
            setAwsRegion(brand.awsRegion || '');
            setAwsAccessKey(brand.awsAccessKey || '');
            if (brand.awsSecretKey) {
                setAwsSecretKey('••••••••••••••••');
            } else {
                setAwsSecretKey('');
            }

            // Appearance (placeholder, you'll need to add these fields to your model)
            setLogoUrl(brand.logoUrl || '');
            setPrimaryColor(brand.primaryColor || '#5d87ff');
            setSecondaryColor(brand.secondaryColor || '#333347');
        }
    }, [brand]);

    const fetchBrandDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}?includeSecrets=true`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Brand not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch brand details');
                }
            }

            const data = await res.json();
            setBrand(data);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const activeForm = e.target;
        const formType = activeForm.getAttribute('data-form-type');

        setIsSaving(true);
        setError('');
        setSuccess('');

        try {
            // Prepare the update data based on which form is being submitted
            let updateData = {};

            switch (formType) {
                case 'general':
                    if (!name || !website) {
                        throw new Error('Brand name and website are required');
                    }
                    updateData = { name, website };
                    break;

                case 'sending':
                    updateData = { fromName, fromEmail, replyToEmail };
                    break;

                case 'appearance':
                    updateData = { logoUrl, primaryColor, secondaryColor };
                    break;

                case 'advanced':
                    updateData = {
                        awsRegion,
                        awsAccessKey,
                        // Only include secret key if it was changed
                        ...(awsSecretKey !== '••••••••••••••••' && { awsSecretKey }),
                    };
                    break;

                default:
                    throw new Error('Unknown form type');
            }

            // Send the update request
            const res = await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update brand settings');
            }

            setSuccess('Settings updated successfully');
            fetchBrandDetails(); // Refresh brand data
        } catch (error) {
            console.error('Error updating brand settings:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBrand = async () => {
        if (deleteConfirmText !== brand.name) {
            setError('Please enter the brand name correctly to confirm deletion');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const res = await fetch(`/api/brands/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete brand');
            }

            // Redirect to brands list
            router.push('/brands');
        } catch (error) {
            console.error('Error deleting brand:', error);
            setError(error.message || 'An unexpected error occurred');
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
                                placeholder="Your Company or Brand Name"
                                disabled={isSaving}
                                required
                            />
                            <p className="hint-text">This is how your brand will be identified in the platform.</p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="website">Website Domain</label>
                            <div className="input-with-icon">
                                <Globe
                                    size={16}
                                    className="input-icon"
                                />
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
                            <p className="hint-text">Enter your domain without http:// or https://</p>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save General Settings
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
                        <div className="verification-status-banner">
                            <Shield size={20} />
                            <div>
                                <p className="status-title">{brand?.status === 'active' ? 'Verified for Sending' : 'Sending Verification Required'}</p>
                                <p className="status-desc">{brand?.status === 'active' ? 'Your brand is verified and ready to send campaigns.' : 'Complete the verification process to send campaigns.'}</p>
                            </div>
                            {brand?.status !== 'active' && (
                                <Link
                                    href={`/brands/${id}/verification`}
                                    className="btn-outline"
                                >
                                    Complete Verification
                                </Link>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="fromName">Sender Name</label>
                            <div className="input-with-icon">
                                <User
                                    size={16}
                                    className="input-icon"
                                />
                                <input
                                    type="text"
                                    id="fromName"
                                    value={fromName}
                                    onChange={(e) => setFromName(e.target.value)}
                                    placeholder="Company Name or Your Name"
                                    disabled={isSaving}
                                />
                            </div>
                            <p className="hint-text">This name will appear as the sender name in recipients' inboxes.</p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="fromEmail">Sender Email</label>
                            <div className="input-with-icon">
                                <Mail
                                    size={16}
                                    className="input-icon"
                                />
                                <input
                                    type="email"
                                    id="fromEmail"
                                    value={fromEmail}
                                    onChange={(e) => setFromEmail(e.target.value)}
                                    placeholder="noreply@yourdomain.com"
                                    disabled={isSaving}
                                />
                            </div>
                            <p className="hint-text">This email must be verified through AWS SES before sending.</p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="replyToEmail">Reply-To Email</label>
                            <div className="input-with-icon">
                                <Mail
                                    size={16}
                                    className="input-icon"
                                />
                                <input
                                    type="email"
                                    id="replyToEmail"
                                    value={replyToEmail}
                                    onChange={(e) => setReplyToEmail(e.target.value)}
                                    placeholder="support@yourdomain.com"
                                    disabled={isSaving}
                                />
                            </div>
                            <p className="hint-text">If recipients reply to your campaigns, their emails will go to this address.</p>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Sending Settings
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
                            <label htmlFor="logoUrl">Brand Logo URL</label>
                            <input
                                type="text"
                                id="logoUrl"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                disabled={isSaving}
                            />
                            <p className="hint-text">URL to your brand logo image (optional).</p>
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
                                        placeholder="#5d87ff"
                                        className="color-text-input"
                                        disabled={isSaving}
                                    />
                                </div>
                                <p className="hint-text">Primary brand color for buttons and accents.</p>
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
                                        placeholder="#333347"
                                        className="color-text-input"
                                        disabled={isSaving}
                                    />
                                </div>
                                <p className="hint-text">Secondary brand color for backgrounds and accents.</p>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Appearance Settings
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                );

            case 'advanced':
                return (
                    <form
                        onSubmit={handleSubmit}
                        data-form-type="advanced"
                        className="settings-form"
                    >
                        <div className="info-card">
                            <AlertCircle size={20} />
                            <div>
                                <h4>Advanced Settings</h4>
                                <p>These settings affect how your brand connects to Amazon SES for sending emails. Changes here may affect your ability to send campaigns.</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="awsRegion">AWS Region</label>
                            <select
                                id="awsRegion"
                                value={awsRegion}
                                onChange={(e) => setAwsRegion(e.target.value)}
                                disabled={isSaving}
                            >
                                <option value="">Select a region</option>
                                <option value="us-east-1">US East (N. Virginia)</option>
                                <option value="us-east-2">US East (Ohio)</option>
                                <option value="us-west-1">US West (N. California)</option>
                                <option value="us-west-2">US West (Oregon)</option>
                                <option value="ca-central-1">Canada (Central)</option>
                                <option value="eu-west-1">EU (Ireland)</option>
                                <option value="eu-central-1">EU (Frankfurt)</option>
                                <option value="eu-west-2">EU (London)</option>
                                <option value="eu-west-3">EU (Paris)</option>
                                <option value="eu-north-1">EU (Stockholm)</option>
                                <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                                <option value="ap-northeast-2">Asia Pacific (Seoul)</option>
                                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                                <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                                <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                                <option value="sa-east-1">South America (São Paulo)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="awsAccessKey">AWS Access Key ID</label>
                            <div className="input-with-icon">
                                <Key
                                    size={16}
                                    className="input-icon"
                                />
                                <input
                                    type="text"
                                    id="awsAccessKey"
                                    value={awsAccessKey}
                                    onChange={(e) => setAwsAccessKey(e.target.value)}
                                    placeholder="AKIAIOSFODNN7EXAMPLE"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="awsSecretKey">AWS Secret Access Key</label>
                            <div className="input-with-icon">
                                <Key
                                    size={16}
                                    className="input-icon"
                                />
                                <input
                                    type="password"
                                    id="awsSecretKey"
                                    value={awsSecretKey}
                                    onChange={(e) => setAwsSecretKey(e.target.value)}
                                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                    disabled={isSaving}
                                />
                            </div>
                            <p className="hint-text">Leave unchanged to keep the current secret key. Your secret key is securely encrypted.</p>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Advanced Settings
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                );

            case 'danger':
                return (
                    <div className="danger-zone">
                        <div className="danger-header">
                            <AlertCircle size={20} />
                            <h3>Danger Zone</h3>
                        </div>

                        <div className="danger-content">
                            <p>Deleting a brand cannot be undone. This will permanently delete all campaigns, contact lists, and data associated with this brand.</p>

                            {!showDeleteConfirm ? (
                                <button
                                    className="btn-danger"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <Trash size={16} />
                                    Delete this brand
                                </button>
                            ) : (
                                <div className="delete-confirm">
                                    <p>
                                        <strong>Please type "{brand.name}" to confirm deletion:</strong>
                                    </p>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        disabled={isSaving}
                                        placeholder="Type brand name here..."
                                    />

                                    <div className="delete-actions">
                                        <button
                                            className="btn-secondary"
                                            onClick={() => setShowDeleteConfirm(false)}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn-danger"
                                            onClick={handleDeleteBrand}
                                            disabled={isSaving || deleteConfirmText !== brand.name}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader
                                                        size={16}
                                                        className="spinner"
                                                    />
                                                    Deleting...
                                                </>
                                            ) : (
                                                <>
                                                    <Trash size={16} />
                                                    Permanently Delete Brand
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
                return <div>Select a settings section</div>;
        }
    };

    if (isLoading || !brand) {
        return (
            <BrandLayout brand={null}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading brand settings...</p>
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
                        <span>Back to brand</span>
                    </Link>

                    <h1>
                        <Settings size={20} />
                        <span>Brand Settings</span>
                    </h1>
                </div>

                {error && (
                    <div className="alert error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="alert success">
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                <div className="settings-layout">
                    <div className="settings-sidebar">
                        <nav className="settings-nav">
                            <button
                                className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
                                onClick={() => setActiveTab('general')}
                            >
                                <Globe size={18} />
                                <span>General</span>
                            </button>

                            <button
                                className={`nav-item ${activeTab === 'sending' ? 'active' : ''}`}
                                onClick={() => setActiveTab('sending')}
                            >
                                <Mail size={18} />
                                <span>Sending</span>
                            </button>

                            <button
                                className={`nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                                onClick={() => setActiveTab('appearance')}
                            >
                                <Palette size={18} />
                                <span>Appearance</span>
                            </button>

                            <button
                                className={`nav-item ${activeTab === 'advanced' ? 'active' : ''}`}
                                onClick={() => setActiveTab('advanced')}
                            >
                                <Sliders size={18} />
                                <span>Advanced</span>
                            </button>

                            <button
                                className={`nav-item danger ${activeTab === 'danger' ? 'active' : ''}`}
                                onClick={() => setActiveTab('danger')}
                            >
                                <Trash size={18} />
                                <span>Delete Brand</span>
                            </button>
                        </nav>
                    </div>

                    <div className="settings-content">
                        <div className="settings-panel">{renderSettingsTab()}</div>
                    </div>
                </div>
            </div>
        </BrandLayout>
    );
}
