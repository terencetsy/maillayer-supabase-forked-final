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
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>Create Contact List</h2>
                    <button
                        className="close-btn"
                        onClick={onClose}
                        aria-label="Close form"
                    >
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="form-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="modal-form"
                >
                    <div className="form-group">
                        <label htmlFor="name">
                            List Name<span className="required">*</span>
                        </label>
                        <div className="input-wrapper">
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Newsletter Subscribers"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">
                            Description <span className="optional">(optional)</span>
                        </label>
                        <div className="input-wrapper">
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Describe the purpose of this contact list"
                                disabled={isLoading}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader
                                        size={16}
                                        className="spinner"
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
    );
}
