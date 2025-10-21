import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Settings, ArrowLeft, Save, Globe, Mail, Shield, Trash, AlertCircle, CheckCircle, Loader, Palette, Sliders } from 'lucide-react';

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

    // Advanced settings
    const [awsRegion, setAwsRegion] = useState('');
    const [awsAccessKey, setAwsAccessKey] = useState('');
    const [awsSecretKey, setAwsSecretKey] = useState('');

    // Appearance
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
        if (brand) {
            setName(brand.name || '');
            setWebsite(brand.website || '');
            setFromName(brand.fromName || '');
            setFromEmail(brand.fromEmail || '');
            setReplyToEmail(brand.replyToEmail || '');
            setAwsRegion(brand.awsRegion || '');
            setAwsAccessKey(brand.awsAccessKey || '');
            setAwsSecretKey(brand.awsSecretKey ? '••••••••••••••••' : '');
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
                case 'advanced':
                    updateData = {
                        awsRegion,
                        awsAccessKey,
                        ...(awsSecretKey !== '••••••••••••••••' && { awsSecretKey }),
                    };
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

            case 'aws':
                return (
                    <form
                        onSubmit={handleSubmit}
                        data-form-type="advanced"
                        className="settings-form"
                    >
                        <div className="form-group">
                            <label htmlFor="awsRegion">AWS Region</label>
                            <select
                                id="awsRegion"
                                value={awsRegion}
                                onChange={(e) => setAwsRegion(e.target.value)}
                                disabled={isSaving}
                            >
                                <option value="">Select region</option>
                                <option value="us-east-1">US East (N. Virginia)</option>
                                <option value="us-west-2">US West (Oregon)</option>
                                <option value="eu-west-1">EU (Ireland)</option>
                                <option value="eu-central-1">EU (Frankfurt)</option>
                                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                                <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
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
                                    <p className="confirm-label">Type "{brand.name}" to confirm deletion:</p>
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
                        className={`tab-item ${activeTab === 'aws' ? 'active' : ''}`}
                        onClick={() => setActiveTab('aws')}
                    >
                        <Sliders size={16} />
                        <span>AWS Keys</span>
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
