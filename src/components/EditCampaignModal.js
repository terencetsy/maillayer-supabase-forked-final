import { useState, useEffect } from 'react';
import { X, Loader, AlertCircle } from 'lucide-react';

export default function EditCampaignModal({ campaign, brandId, onCancel, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        trackingConfig: {
            trackOpens: true,
            trackClicks: true,
        },
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (campaign) {
            setFormData({
                name: campaign.name || '',
                subject: campaign.subject || '',
                trackingConfig: campaign.trackingConfig || {
                    trackOpens: true,
                    trackClicks: true,
                },
            });
        }
    }, [campaign]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.subject) {
            setError('Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const response = await fetch(`/api/brands/${brandId}/campaigns/${campaign._id}`, {
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

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('Error updating campaign:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-form-container">
            <div className="modal-form-header">
                <h2>Edit Campaign</h2>
                <button
                    className="modal-form-close"
                    onClick={onCancel}
                    aria-label="Close form"
                    type="button"
                >
                    <X size={20} />
                </button>
            </div>

            {error && (
                <div className="alert alert--error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="form">
                <div className="form-group">
                    <label htmlFor="name" className="form-label">
                        Campaign Name<span className="form-required">*</span>
                    </label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Campaign Name"
                        disabled={isSaving}
                        className="form-input"
                    />
                    <p className="form-help">Internal name to identify your campaign</p>
                </div>

                <div className="form-group">
                    <label htmlFor="subject" className="form-label">
                        Email Subject<span className="form-required">*</span>
                    </label>
                    <input
                        id="subject"
                        name="subject"
                        type="text"
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="Email Subject"
                        disabled={isSaving}
                        className="form-input"
                    />
                    <p className="form-help">This will appear as the subject line of your email</p>
                </div>

                <div className="form-group">
                    <label className="form-label">Email Tracking</label>
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
                    <p className="form-help">Control whether to track opens and clicks for this campaign</p>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="button button--secondary"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="button button--primary"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <Loader size={16} className="spinner-icon" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
