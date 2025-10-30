// src/components/sequences/SequenceSidebar.js
import { useState } from 'react';
import { ArrowLeft, Save, Play, Pause, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import TriggerConfig from './sidebar/TriggerConfig';
import EmailConfig from './sidebar/EmailConfig';
import SequenceSettings from './sidebar/SequenceSettings';
import { Edit01 } from '@/lib/icons';

export default function SequenceSidebar({ sequence, onUpdate, selectedStep, setSelectedStep, onSave, onToggleActive, saving, hasUnsavedChanges }) {
    const [activationError, setActivationError] = useState('');

    const validateForActivation = () => {
        if (sequence.triggerType === 'contact_list') {
            if (!sequence.triggerConfig?.contactListIds?.length) {
                return 'Configure trigger lists first';
            }
        }

        if (!sequence.emails || sequence.emails.length === 0) {
            return 'Add at least one email';
        }

        const incompleteEmails = sequence.emails.filter((email) => !email.subject || !email.content);
        if (incompleteEmails.length > 0) {
            return `Complete Email ${incompleteEmails[0].order}`;
        }

        return null;
    };

    const handleToggleClick = async () => {
        setActivationError('');

        if (sequence.status !== 'active') {
            const error = validateForActivation();
            if (error) {
                setActivationError(error);
                return;
            }
        }

        await onToggleActive();
    };

    const handleSaveClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSave();
    };

    const canActivate = sequence.status !== 'active' && !validateForActivation();

    const renderContent = () => {
        if (selectedStep === 'trigger') {
            return (
                <TriggerConfig
                    sequence={sequence}
                    onUpdate={onUpdate}
                />
            );
        }

        if (selectedStep === 'settings') {
            return (
                <SequenceSettings
                    sequence={sequence}
                    onUpdate={onUpdate}
                />
            );
        }

        const email = sequence.emails?.find((e) => e.id === selectedStep);
        if (email) {
            return (
                <EmailConfig
                    sequence={sequence}
                    email={email}
                    onUpdate={onUpdate}
                />
            );
        }

        return (
            <div className="sidebar-empty">
                <p>Select a step to configure</p>
            </div>
        );
    };

    const getSaveButtonText = () => {
        if (saving) return 'Saving...';
        if (hasUnsavedChanges) return 'Save';
        return 'Saved';
    };

    return (
        <div className="sequence-sidebar">
            {/* Compact Header */}
            <div className="sidebar-header">
                <div className="sequence-info">
                    <Link
                        href={`/brands/${sequence.brandId}/sequences`}
                        className="back-link"
                    >
                        <ArrowLeft size={14} />
                        Back
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`status-badge status-${sequence.status}`}>{sequence.status === 'active' ? 'Active' : sequence.status === 'paused' ? 'Paused' : 'Draft'}</span>
                        <h1>{sequence.name}</h1>
                    </div>
                </div>
                <div className="sidebar-actions">
                    <div className="sequence-meta">
                        <span className="email-count">{sequence.emails?.length || 0} emails</span>
                    </div>
                    <div
                        onClick={() => setSelectedStep('settings')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Settings"
                    >
                        <Edit01 />
                    </div>
                    <button
                        type="button"
                        className="button button--secondary"
                        onClick={handleSaveClick}
                        disabled={saving || !hasUnsavedChanges}
                    >
                        <Save size={15} />
                        {getSaveButtonText()}
                    </button>
                    <button
                        type="button"
                        className={`button ${sequence.status === 'active' ? 'button--secondary' : 'button--primary'}`}
                        onClick={handleToggleClick}
                        disabled={sequence.status !== 'active' && !canActivate}
                        title={sequence.status !== 'active' && !canActivate ? validateForActivation() : ''}
                    >
                        {sequence.status === 'active' ? (
                            <>
                                <Pause size={15} />
                                Pause
                            </>
                        ) : (
                            <>
                                <Play size={15} />
                                Activate
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Activation Error */}
            {activationError && (
                <div className="activation-error">
                    <AlertCircle size={16} />
                    <span>{activationError}</span>
                </div>
            )}

            {/* Content */}
            <div className="sidebar-content">{renderContent()}</div>
        </div>
    );
}
