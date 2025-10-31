// src/components/sequences/canvas/NodeConfigDrawer.js
import { useState, useEffect, useRef } from 'react';
import { X, List, Zap, Check, Clock, Mail, AlertCircle } from 'lucide-react';
import UnifiedEditor from '@/components/editor/UnifiedEditor';

export default function NodeConfigDrawer({ isOpen, nodeId, sequence, onUpdate, onClose, brandId }) {
    if (!isOpen || !nodeId) return null;

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

        const email = sequence.emails?.find((e) => e.id === nodeId);
        if (email) return `Email ${email.order}`;

        return 'Configure';
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`drawer-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`drawer-container ${isOpen ? 'open' : ''}`}>
                <div className="drawer-header">
                    <h2>{getTitle()}</h2>
                    <button
                        className="drawer-close"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="drawer-content">{renderContent()}</div>
            </div>

            <style jsx>{`
                .drawer-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    z-index: 999;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease;
                }

                .drawer-overlay.open {
                    opacity: 1;
                    pointer-events: all;
                }

                .drawer-container {
                    position: fixed;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    width: 700px;
                    max-width: 90vw;
                    background: #fff;
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                }

                .drawer-container.open {
                    transform: translateX(0);
                }

                .drawer-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.5rem;
                    border-bottom: 1px solid #e0e0e0;
                    flex-shrink: 0;
                }

                .drawer-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 500;
                }

                .drawer-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #666;
                    display: flex;
                    padding: 0.25rem;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .drawer-close:hover {
                    background: #f5f5f5;
                    color: #1a1a1a;
                }

                .drawer-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                }
            `}</style>
        </>
    );
}

// Keep the TriggerConfig, EmailConfig, and SequenceSettings components exactly the same as before
// Just copy them from the NodeConfigModal.js file

// Add these to NodeConfigDrawer.js after the main component

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
                    max-height: 400px;
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
