// src/components/sequences/sidebar/SequenceSettings.js
import { useState, useEffect, useRef } from 'react';
import { Mail, Save, AlertCircle } from 'lucide-react';

export default function SequenceSettings({ sequence, onUpdate }) {
    const [fromName, setFromName] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [replyToEmail, setReplyToEmail] = useState('');
    const [description, setDescription] = useState('');
    const [brand, setBrand] = useState(null);

    const updateTimeoutRef = useRef(null);
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            setFromName(sequence.emailConfig?.fromName || '');
            setFromEmail(sequence.emailConfig?.fromEmail || '');
            setReplyToEmail(sequence.emailConfig?.replyToEmail || '');
            setDescription(sequence.description || '');
            fetchBrandDetails();
        }
    }, []);

    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    const fetchBrandDetails = async () => {
        try {
            const response = await fetch(`/api/brands/${sequence.brandId}`, {
                credentials: 'same-origin',
            });
            if (response.ok) {
                const data = await response.json();
                setBrand(data);

                // Only set defaults if current values are empty
                if (!sequence.emailConfig?.fromName && data.fromName) {
                    setFromName(data.fromName);
                }
                if (!sequence.emailConfig?.fromEmail && data.fromEmail) {
                    setFromEmail(data.fromEmail);
                }
                if (!sequence.emailConfig?.replyToEmail && data.replyToEmail) {
                    setReplyToEmail(data.replyToEmail);
                }
            }
        } catch (error) {
            console.error('Error fetching brand:', error);
        }
    };

    const debouncedUpdate = (updates) => {
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            onUpdate(updates);
        }, 500);
    };

    const handleFromNameChange = (value) => {
        setFromName(value);
        debouncedUpdate({
            emailConfig: {
                ...sequence.emailConfig,
                fromName: value,
                fromEmail,
                replyToEmail,
            },
        });
    };

    const handleFromEmailChange = (value) => {
        setFromEmail(value);
        debouncedUpdate({
            emailConfig: {
                ...sequence.emailConfig,
                fromName,
                fromEmail: value,
                replyToEmail,
            },
        });
    };

    const handleReplyToEmailChange = (value) => {
        setReplyToEmail(value);
        debouncedUpdate({
            emailConfig: {
                ...sequence.emailConfig,
                fromName,
                fromEmail,
                replyToEmail: value,
            },
        });
    };

    const handleDescriptionChange = (value) => {
        setDescription(value);
        debouncedUpdate({
            description: value,
        });
    };

    const handleUseBrandDefaults = () => {
        if (!brand) return;

        const newFromName = brand.fromName || '';
        const newFromEmail = brand.fromEmail || '';
        const newReplyToEmail = brand.replyToEmail || '';

        setFromName(newFromName);
        setFromEmail(newFromEmail);
        setReplyToEmail(newReplyToEmail);

        onUpdate({
            emailConfig: {
                fromName: newFromName,
                fromEmail: newFromEmail,
                replyToEmail: newReplyToEmail,
            },
        });
    };

    const isValidEmail = (email) => {
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const hasValidConfig = isValidEmail(fromEmail) && isValidEmail(replyToEmail);

    const hasChanges = fromName !== (sequence.emailConfig?.fromName || '') || fromEmail !== (sequence.emailConfig?.fromEmail || '') || replyToEmail !== (sequence.emailConfig?.replyToEmail || '') || description !== (sequence.description || '');

    return (
        <div className="sequence-settings">
            <h2>Settings</h2>
            <p className="subtitle">Configure sequence details and email sender information</p>

            {/* Description */}
            <div className="form-section">
                <label className="form-label">Description</label>
                <textarea
                    value={description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="Describe the purpose of this sequence..."
                    className="form-textarea"
                    rows={3}
                />
            </div>

            {/* Email Configuration */}
            <div className="form-section">
                <div className="section-title">
                    <Mail size={18} />
                    <h3>Email Settings</h3>
                </div>

                {brand && (
                    <div className="brand-defaults-card">
                        <div className="brand-defaults-header">
                            <span className="brand-defaults-label">Brand Defaults</span>
                            <button
                                type="button"
                                className="text-button"
                                onClick={handleUseBrandDefaults}
                            >
                                Use
                            </button>
                        </div>
                        <div className="brand-defaults-content">
                            <div className="default-item">
                                <span className="default-label">From</span>
                                <span className="default-value">{brand.fromEmail || 'Not set'}</span>
                            </div>
                            <div className="default-item">
                                <span className="default-label">Reply</span>
                                <span className="default-value">{brand.replyToEmail || 'Not set'}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">
                        Sender Name<span className="form-required">*</span>
                    </label>
                    <input
                        type="text"
                        value={fromName}
                        onChange={(e) => handleFromNameChange(e.target.value)}
                        placeholder="Your Company"
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">
                        From Email<span className="form-required">*</span>
                    </label>
                    <input
                        type="email"
                        value={fromEmail}
                        onChange={(e) => handleFromEmailChange(e.target.value)}
                        placeholder="noreply@example.com"
                        className="form-input"
                    />
                    {fromEmail && !isValidEmail(fromEmail) && (
                        <div className="field-error">
                            <AlertCircle size={13} />
                            <span>Invalid email</span>
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">
                        Reply-To Email<span className="form-required">*</span>
                    </label>
                    <input
                        type="email"
                        value={replyToEmail}
                        onChange={(e) => handleReplyToEmailChange(e.target.value)}
                        placeholder="support@example.com"
                        className="form-input"
                    />
                    {replyToEmail && !isValidEmail(replyToEmail) && (
                        <div className="field-error">
                            <AlertCircle size={13} />
                            <span>Invalid email</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Change indicator */}
            {hasChanges && (
                <div
                    className="save-bar"
                    style={{ opacity: 0.7 }}
                >
                    <p>Changes pending...</p>
                </div>
            )}
        </div>
    );
}
