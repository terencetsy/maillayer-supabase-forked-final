import { useState } from 'react';
import { X, Loader, AlertCircle } from 'lucide-react';

export default function TransactionalTemplateForm({ brand, onCancel, onSuccess }) {
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
            const response = await fetch(`/api/brands/${brand._id}/transactional`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to create template');
            }

            const newTemplate = await response.json();
            onSuccess(newTemplate);
        } catch (error) {
            console.error('Error creating template:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={onCancel}
        >
            <div
                className="modal-container"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3>Create Template</h3>
                    <button
                        className="close-btn"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-content">
                    {error && (
                        <div className="alert alert-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="modal-form"
                    >
                        <div className="form-group">
                            <label htmlFor="name">Template Name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Welcome Email"
                                disabled={isSaving}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="subject">Email Subject</label>
                            <input
                                id="subject"
                                name="subject"
                                type="text"
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder="Welcome to {{company}}"
                                disabled={isSaving}
                                required
                            />
                            <p className="hint-text">Use variables like {`{{firstName}}`} in your subject</p>
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
                            <p className="hint-text">Control whether to track opens and clicks for this template</p>
                        </div>

                        <div className="modal-actions">
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
                                        <Loader
                                            size={16}
                                            className="spinner"
                                        />
                                        <span>Creating...</span>
                                    </>
                                ) : (
                                    <span>Create Template</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
