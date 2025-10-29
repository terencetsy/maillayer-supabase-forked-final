// src/components/sequences/sidebar/SequenceSettings.js
import { useState, useEffect } from 'react';
import { Mail, Save, AlertCircle } from 'lucide-react';

export default function SequenceSettings({ sequence, onUpdate }) {
    const [fromName, setFromName] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [replyToEmail, setReplyToEmail] = useState('');
    const [description, setDescription] = useState('');
    const [brand, setBrand] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setFromName(sequence.emailConfig?.fromName || '');
        setFromEmail(sequence.emailConfig?.fromEmail || '');
        setReplyToEmail(sequence.emailConfig?.replyToEmail || '');
        setDescription(sequence.description || '');

        fetchBrandDetails();
    }, [sequence]);

    useEffect(() => {
        const changed = fromName !== (sequence.emailConfig?.fromName || '') || fromEmail !== (sequence.emailConfig?.fromEmail || '') || replyToEmail !== (sequence.emailConfig?.replyToEmail || '') || description !== (sequence.description || '');

        setHasChanges(changed);
    }, [fromName, fromEmail, replyToEmail, description, sequence]);

    const fetchBrandDetails = async () => {
        try {
            const response = await fetch(`/api/brands/${sequence.brandId}`, {
                credentials: 'same-origin',
            });
            if (response.ok) {
                const data = await response.json();
                setBrand(data);

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

    const handleSave = () => {
        onUpdate({
            description,
            emailConfig: { fromName, fromEmail, replyToEmail },
        });
        setHasChanges(false);
    };

    const handleUseBrandDefaults = () => {
        if (!brand) return;
        setFromName(brand.fromName || '');
        setFromEmail(brand.fromEmail || '');
        setReplyToEmail(brand.replyToEmail || '');
    };

    const isValidEmail = (email) => {
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const hasValidConfig = isValidEmail(fromEmail) && isValidEmail(replyToEmail);

    return (
        <div className="sequence-settings">
            <h2>Settings</h2>
            <p className="subtitle">Configure sequence details and email sender information</p>

            {/* Description */}
            <div className="form-section">
                <label className="form-label">Description</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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
                        onChange={(e) => setFromName(e.target.value)}
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
                        onChange={(e) => setFromEmail(e.target.value)}
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
                        onChange={(e) => setReplyToEmail(e.target.value)}
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

            {/* Save Bar */}
            {hasChanges && (
                <div className="save-bar">
                    <p>Unsaved</p>
                    <button
                        className="button button--primary"
                        onClick={handleSave}
                        disabled={!hasValidConfig}
                    >
                        <Save size={14} />
                        Save
                    </button>
                </div>
            )}
        </div>
    );
}
