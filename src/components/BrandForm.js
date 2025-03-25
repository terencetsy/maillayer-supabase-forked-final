import { useState } from 'react';
import { X, Loader, AlertCircle, Globe } from 'lucide-react';

export default function BrandForm({ onCancel, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        website: '',
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
        if (!formData.name || !formData.website) {
            setError('Please fill in all required fields');
            return;
        }

        // Simple website validation
        if (!formData.website.includes('.')) {
            setError('Please enter a valid website address');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/brands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to create brand');
            }

            const brand = await response.json();

            if (onSuccess) {
                onSuccess(brand);
            }
        } catch (error) {
            console.error('Error creating brand:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modern-form-container">
            <div className="form-header">
                <h2>Create a New Brand</h2>
                <button
                    className="close-btn"
                    onClick={onCancel}
                    aria-label="Close form"
                >
                    <X size={18} />
                </button>
            </div>

            <p className="form-description">Let's start by setting up your brand. You can configure email sending later.</p>

            {error && (
                <div className="form-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="modern-form"
            >
                <div className="form-group">
                    <label htmlFor="name">
                        Brand Name<span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                        <input
                            id="name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="My Company"
                            disabled={isLoading}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="website">
                        Brand Website<span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                        <Globe
                            size={16}
                            className="input-icon"
                        />
                        <input
                            id="website"
                            name="website"
                            type="text"
                            value={formData.website}
                            onChange={handleChange}
                            placeholder="example.com"
                            disabled={isLoading}
                        />
                    </div>
                    <p className="input-help">Enter your website domain without http:// or https://</p>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
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
                            'Create Brand'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
