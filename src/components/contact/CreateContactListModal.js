import { useState } from 'react';
import { X, Loader, AlertCircle } from 'lucide-react';

export default function CreateContactListModal({ brandId, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
        if (!formData.name) {
            setError('Please provide a name for your contact list');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/brands/${brandId}/contact-lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to create contact list');
            }

            const newList = await response.json();
            onSuccess(newList);
        } catch (error) {
            console.error('Error creating contact list:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="form-modal-overlay">
            <div className="form-modal">
                <div className="modal-form-container">
                    <div className="modal-form-header">
                        <h2>Create Contact List</h2>
                        <button
                            className="modal-form-close"
                            onClick={onClose}
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

                    <form
                        onSubmit={handleSubmit}
                        className="form"
                    >
                        <div className="form-group">
                            <label
                                htmlFor="name"
                                className="form-label"
                            >
                                List Name<span className="form-required">*</span>
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Newsletter Subscribers"
                                disabled={isLoading}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label
                                htmlFor="description"
                                className="form-label"
                            >
                                Description <span className="form-optional">(optional)</span>
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Describe the purpose of this contact list"
                                disabled={isLoading}
                                rows={3}
                                className="form-textarea"
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="button button--secondary"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="button button--primary"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spinner-icon"
                                        />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Contact List'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
