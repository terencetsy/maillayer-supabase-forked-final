// src/components/sequences/canvas/NodeConfigModal.js
import { useState, useEffect, useRef } from 'react';
import { X, List, Zap, Check, Clock, Mail, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import UnifiedEditor from '@/components/editor/UnifiedEditor';

export default function NodeConfigModal({ nodeId, sequence, onUpdate, onClose, brandId }) {
    const [activeTab, setActiveTab] = useState('config');
    const modalRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const renderContent = () => {
        if (nodeId === 'trigger') {
            return (
                <TriggerConfig
                    sequence={sequence}
                    onUpdate={onUpdate}
                    brandId={brandId}
                />
            );
        }

        if (nodeId === 'settings') {
            return (
                <SequenceSettings
                    sequence={sequence}
                    onUpdate={onUpdate}
                    brandId={brandId}
                />
            );
        }

        const email = sequence.emails?.find((e) => e.id === nodeId);
        if (email) {
            return (
                <EmailConfig
                    sequence={sequence}
                    email={email}
                    onUpdate={onUpdate}
                />
            );
        }

        return null;
    };

    const getTitle = () => {
        if (nodeId === 'trigger') return 'Configure Trigger';
        if (nodeId === 'settings') return 'Sequence Settings';

        const email = sequence.emails?.find((e) => e.id === nodeId);
        if (email) return `Email ${email.order}`;

        return 'Configure';
    };

    return (
        <div className="modal-overlay">
            <div
                className="modal-container"
                ref={modalRef}
            >
                <div className="modal-header">
                    <h2>{getTitle()}</h2>
                    <button
                        className="modal-close"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-content">{renderContent()}</div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.2s ease-out;
                }

                .modal-container {
                    background: #fff;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 700px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: slideUp 0.3s ease-out;
                }

                .modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.5rem;
                    border-bottom: 1px solid #e0e0e0;
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 500;
                }

                .modal-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #666;
                    display: flex;
                    padding: 0.25rem;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .modal-close:hover {
                    background: #f5f5f5;
                    color: #1a1a1a;
                }

                .modal-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes slideUp {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}

// Trigger Configuration Component
function TriggerConfig({ sequence, onUpdate, brandId }) {
    const [contactLists, setContactLists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchContactLists();
    }, []);

    const fetchContactLists = async () => {
        try {
            const response = await fetch(`/api/brands/${brandId}/contact-lists`, {
                credentials: 'same-origin',
            });
            if (response.ok) {
                const data = await response.json();
                setContactLists(data);
            }
        } catch (error) {
            console.error('Error fetching contact lists:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerTypeChange = (type) => {
        const updates = {
            triggerType: type,
            triggerConfig: {
                ...sequence.triggerConfig,
                contactListIds: type === 'contact_list' ? sequence.triggerConfig?.contactListIds || [] : undefined,
                integrationType: type === 'integration' ? sequence.triggerConfig?.integrationType || '' : undefined,
                integrationEvent: type === 'integration' ? sequence.triggerConfig?.integrationEvent || '' : undefined,
            },
        };

        onUpdate(updates);
    };

    const handleListToggle = (listId) => {
        const currentLists = sequence.triggerConfig?.contactListIds || [];
        const newLists = currentLists.includes(listId) ? currentLists.filter((id) => id !== listId) : [...currentLists, listId];

        onUpdate({
            triggerConfig: {
                ...sequence.triggerConfig,
                contactListIds: newLists,
            },
        });
    };

    return (
        <div className="config-section">
            <p className="section-description">Choose how contacts enter this sequence</p>

            <div className="form-group">
                <label className="form-label">Trigger Type</label>
                <div className="trigger-options">
                    <button
                        type="button"
                        className={`trigger-option ${sequence.triggerType === 'contact_list' ? 'selected' : ''}`}
                        onClick={() => handleTriggerTypeChange('contact_list')}
                    >
                        <List size={18} />
                        <span>Contact Lists</span>
                        {sequence.triggerType === 'contact_list' && (
                            <Check
                                size={16}
                                className="check-icon"
                            />
                        )}
                    </button>

                    <button
                        type="button"
                        className={`trigger-option ${sequence.triggerType === 'integration' ? 'selected' : ''}`}
                        onClick={() => handleTriggerTypeChange('integration')}
                    >
                        <Zap size={18} />
                        <span>Integration</span>
                        {sequence.triggerType === 'integration' && (
                            <Check
                                size={16}
                                className="check-icon"
                            />
                        )}
                    </button>
                </div>
            </div>

            {sequence.triggerType === 'contact_list' && (
                <div className="form-group">
                    <label className="form-label">Select Lists</label>
                    <p className="helper-text">Contacts added to these lists will enter the sequence</p>

                    {loading ? (
                        <div className="loading-state">Loading...</div>
                    ) : contactLists.length === 0 ? (
                        <div className="empty-state">No contact lists found</div>
                    ) : (
                        <div className="list-options">
                            {contactLists.map((list) => {
                                const isSelected = sequence.triggerConfig?.contactListIds?.includes(list._id);
                                return (
                                    <label
                                        key={list._id}
                                        className={`list-option ${isSelected ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleListToggle(list._id)}
                                        />
                                        <div className="list-option-content">
                                            <div className="list-option-name">{list.name}</div>
                                            <div className="list-option-count">{list.contactCount || 0} contacts</div>
                                        </div>
                                        {isSelected && (
                                            <Check
                                                size={16}
                                                className="check-icon"
                                            />
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {sequence.triggerType === 'integration' && (
                <div className="form-group">
                    <label className="form-label">Integration Settings</label>
                    <div className="empty-state">Integration configuration coming soon</div>
                </div>
            )}

            <style jsx>{`
                .config-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .section-description {
                    margin: 0;
                    color: #666;
                    font-size: 0.875rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .form-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #1a1a1a;
                }

                .helper-text {
                    margin: 0;
                    font-size: 0.8125rem;
                    color: #999;
                }

                .trigger-options {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.75rem;
                }

                .trigger-option {
                    padding: 1rem;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    background: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    transition: all 0.2s;
                    position: relative;
                }

                .trigger-option:hover {
                    border-color: #ccc;
                    background: #fafafa;
                }

                .trigger-option.selected {
                    border-color: #1a1a1a;
                    background: #f9f9f9;
                }

                .trigger-option span {
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .check-icon {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    color: #2e7d32;
                }

                .list-options {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .list-option {
                    padding: 0.75rem;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }

                .list-option:hover {
                    background: #fafafa;
                    border-color: #ccc;
                }

                .list-option.selected {
                    background: #f0f7ff;
                    border-color: #1976d2;
                }

                .list-option input[type='checkbox'] {
                    cursor: pointer;
                }

                .list-option-content {
                    flex: 1;
                }

                .list-option-name {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #1a1a1a;
                }

                .list-option-count {
                    font-size: 0.75rem;
                    color: #999;
                    margin-top: 2px;
                }

                .loading-state,
                .empty-state {
                    padding: 2rem;
                    text-align: center;
                    color: #999;
                    font-size: 0.875rem;
                }
            `}</style>
        </div>
    );
}

// Email Configuration Component
function EmailConfig({ sequence, email, onUpdate }) {
    const [subject, setSubject] = useState(email.subject || '');
    const [content, setContent] = useState(email.content || '');
    const [delayAmount, setDelayAmount] = useState(email.delayAmount || 1);
    const [delayUnit, setDelayUnit] = useState(email.delayUnit || 'days');

    const updateTimeoutRef = useRef(null);

    const debouncedUpdate = (updates) => {
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            handleSave(updates);
        }, 500);
    };

    const handleSubjectChange = (newSubject) => {
        setSubject(newSubject);
        debouncedUpdate({ subject: newSubject, content, delayAmount, delayUnit });
    };

    const handleContentChange = (newContent) => {
        setContent(newContent);
        debouncedUpdate({ subject, content: newContent, delayAmount, delayUnit });
    };

    const handleDelayChange = (newDelayAmount, newDelayUnit) => {
        const amount = newDelayAmount !== undefined ? newDelayAmount : delayAmount;
        const unit = newDelayUnit !== undefined ? newDelayUnit : delayUnit;

        setDelayAmount(amount);
        if (newDelayUnit !== undefined) {
            setDelayUnit(unit);
        }

        debouncedUpdate({ subject, content, delayAmount: amount, delayUnit: unit });
    };

    const handleSave = (updates = {}) => {
        const updatesToUse = {
            subject: updates.subject !== undefined ? updates.subject : subject,
            content: updates.content !== undefined ? updates.content : content,
            delayAmount: updates.delayAmount !== undefined ? Number(updates.delayAmount) : Number(delayAmount),
            delayUnit: updates.delayUnit !== undefined ? updates.delayUnit : delayUnit,
        };

        const updatedEmails = sequence.emails.map((e) => {
            if (e.id === email.id) {
                return { ...e, ...updatesToUse };
            }
            return e;
        });

        onUpdate({ emails: updatedEmails });
    };

    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="config-section">
            <div className="delay-config">
                <div className="delay-header">
                    <Clock size={16} />
                    <span>Send Delay</span>
                </div>
                <div className="delay-inputs">
                    <input
                        type="number"
                        min="0"
                        value={delayAmount}
                        onChange={(e) => handleDelayChange(parseInt(e.target.value) || 0)}
                        className="form-input"
                    />
                    <select
                        value={delayUnit}
                        onChange={(e) => handleDelayChange(undefined, e.target.value)}
                        className="form-select"
                    >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                    </select>
                </div>
                {email.order > 1 && <p className="delay-note">Sent after the previous email</p>}
            </div>

            <div className="form-group">
                <label className="form-label">
                    Subject<span className="form-required">*</span>
                </label>
                <input
                    type="text"
                    value={subject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    placeholder="Welcome! Here's what's next..."
                    className="form-input"
                />
            </div>

            <div className="form-group">
                <label className="form-label">
                    Content<span className="form-required">*</span>
                </label>
                <UnifiedEditor
                    value={content}
                    onChange={handleContentChange}
                />
            </div>

            <style jsx>{`
                .config-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .delay-config {
                    background: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 1rem;
                }

                .delay-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #666;
                }

                .delay-inputs {
                    display: grid;
                    grid-template-columns: 1fr 1.5fr;
                    gap: 0.5rem;
                }

                .delay-note {
                    margin: 0.75rem 0 0 0;
                    font-size: 0.75rem;
                    color: #999;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #1a1a1a;
                }

                .form-required {
                    color: #dc2626;
                    margin-left: 4px;
                }

                .form-input,
                .form-select {
                    padding: 0.625rem 0.75rem;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                }

                .form-input:focus,
                .form-select:focus {
                    outline: none;
                    border-color: #1a1a1a;
                }
            `}</style>
        </div>
    );
}

// Sequence Settings Component
function SequenceSettings({ sequence, onUpdate, brandId }) {
    const [fromName, setFromName] = useState(sequence.emailConfig?.fromName || '');
    const [fromEmail, setFromEmail] = useState(sequence.emailConfig?.fromEmail || '');
    const [replyToEmail, setReplyToEmail] = useState(sequence.emailConfig?.replyToEmail || '');
    const [description, setDescription] = useState(sequence.description || '');
    const [brand, setBrand] = useState(null);

    const updateTimeoutRef = useRef(null);

    useEffect(() => {
        fetchBrandDetails();
    }, []);

    const fetchBrandDetails = async () => {
        try {
            const response = await fetch(`/api/brands/${brandId}`, {
                credentials: 'same-origin',
            });
            if (response.ok) {
                const data = await response.json();
                setBrand(data);
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

    const isValidEmail = (email) => {
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="config-section">
            <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                    value={description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="Describe the purpose of this sequence..."
                    className="form-textarea"
                    rows={3}
                />
            </div>

            <div className="section-divider">
                <Mail size={16} />
                <span>Email Settings</span>
            </div>

            {brand && (
                <div className="brand-defaults">
                    <div className="brand-defaults-header">
                        <span>Brand Defaults</span>
                        <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                                setFromName(brand.fromName || '');
                                setFromEmail(brand.fromEmail || '');
                                setReplyToEmail(brand.replyToEmail || '');
                                onUpdate({
                                    emailConfig: {
                                        fromName: brand.fromName || '',
                                        fromEmail: brand.fromEmail || '',
                                        replyToEmail: brand.replyToEmail || '',
                                    },
                                });
                            }}
                        >
                            Use Defaults
                        </button>
                    </div>
                    <div className="brand-defaults-info">
                        <div>
                            <strong>From:</strong> {brand.fromEmail || 'Not set'}
                        </div>
                        <div>
                            <strong>Reply:</strong> {brand.replyToEmail || 'Not set'}
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

            <style jsx>{`
                .config-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #1a1a1a;
                }

                .form-required {
                    color: #dc2626;
                    margin-left: 4px;
                }

                .form-input,
                .form-textarea {
                    padding: 0.625rem 0.75rem;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-family: inherit;
                    transition: all 0.2s;
                }

                .form-input:focus,
                .form-textarea:focus {
                    outline: none;
                    border-color: #1a1a1a;
                }

                .form-textarea {
                    resize: vertical;
                }

                .section-divider {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding-top: 0.5rem;
                    margin-top: 0.5rem;
                    border-top: 1px solid #e0e0e0;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #666;
                }

                .brand-defaults {
                    background: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 1rem;
                }

                .brand-defaults-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.75rem;
                }

                .brand-defaults-header span {
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: #666;
                }

                .text-button {
                    background: none;
                    border: none;
                    color: #1a1a1a;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    text-decoration: underline;
                    padding: 0;
                }

                .text-button:hover {
                    color: #666;
                }

                .brand-defaults-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    font-size: 0.8125rem;
                }

                .brand-defaults-info strong {
                    font-weight: 500;
                    margin-right: 0.5rem;
                }

                .field-error {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: #dc2626;
                    font-size: 0.75rem;
                }
            `}</style>
        </div>
    );
}
