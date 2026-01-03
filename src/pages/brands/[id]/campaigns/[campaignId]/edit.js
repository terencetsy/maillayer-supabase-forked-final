import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { X, Loader, AlertCircle, ArrowLeft } from 'lucide-react';

export default function EditCampaign() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, campaignId } = router.query;

    const [brand, setBrand] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        trackingConfig: {
            trackOpens: true,
            trackClicks: true,
        },
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id && campaignId) {
            fetchBrandDetails();
            fetchCampaignDetails();
        }
    }, [status, id, campaignId, router]);

    const fetchBrandDetails = async () => {
        try {
            const res = await fetch(`/api/brands/${id}`, {
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
        }
    };

    const fetchCampaignDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Campaign not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch campaign details');
                }
            }

            const data = await res.json();
            setFormData({
                name: data.name || '',
                subject: data.subject || '',
                trackingConfig: data.trackingConfig || {
                    trackOpens: true,
                    trackClicks: true,
                },
            });
        } catch (error) {
            console.error('Error fetching campaign details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        if (!formData.name || !formData.subject) {
            setError('Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to update campaign');
            }

            setSuccess('Campaign updated successfully');

            // After a short delay, redirect to campaign detail
            setTimeout(() => {
                router.push(`/brands/${id}/campaigns/${campaignId}`);
            }, 1500);
        } catch (error) {
            console.error('Error updating campaign:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !brand) {
        return (
            <BrandLayout brand={brand}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading campaign...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="campaign-edit-container">
                {/* Back button */}
                <Link
                    href={`/brands/${id}/campaigns/${campaignId}`}
                    className="back-link"
                >
                    <ArrowLeft size={16} />
                    <span>Back to campaign</span>
                </Link>

                <div className="edit-form-container">
                    <div className="form-header">
                        <h1>Edit Campaign</h1>
                    </div>

                    {error && (
                        <div className="form-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="form-success">
                            <span>{success}</span>
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="modern-form"
                    >
                        <div className="form-group">
                            <label htmlFor="name">
                                Campaign Name<span className="required">*</span>
                            </label>
                            <div className="input-wrapper">
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Campaign Name"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="subject">
                                Email Subject<span className="required">*</span>
                            </label>
                            <div className="input-wrapper">
                                <input
                                    id="subject"
                                    name="subject"
                                    type="text"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    placeholder="Email Subject"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Email Tracking</label>
                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.trackingConfig?.trackOpens ?? true}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                trackingConfig: {
                                                    ...prev.trackingConfig,
                                                    trackOpens: e.target.checked,
                                                },
                                            }))
                                        }
                                        disabled={isSaving}
                                    />
                                    <span>Track email opens</span>
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.trackingConfig?.trackClicks ?? true}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                trackingConfig: {
                                                    ...prev.trackingConfig,
                                                    trackClicks: e.target.checked,
                                                },
                                            }))
                                        }
                                        disabled={isSaving}
                                    />
                                    <span>Track link clicks</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-actions">
                            <Link
                                href={`/brands/${id}/campaigns/${campaignId}`}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                className="btn btn-primary"
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
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </BrandLayout>
    );
}
