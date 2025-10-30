// src/components/sequences/sidebar/EmailConfig.js
import { useState, useEffect, useRef } from 'react';
import { Clock, Trash, Save } from 'lucide-react';
import UnifiedEditor from '@/components/editor/UnifiedEditor';

export default function EmailConfig({ sequence, email, onUpdate }) {
    const [subject, setSubject] = useState(email.subject || '');
    const [content, setContent] = useState(email.content || '');
    const [delayAmount, setDelayAmount] = useState(email.delayAmount || 1);
    const [delayUnit, setDelayUnit] = useState(email.delayUnit || 'days');

    const updateTimeoutRef = useRef(null);
    const isInitialMount = useRef(true);

    // Update local state when email prop changes (but not on initial mount)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Only update if the email ID changed (switching between emails)
        setSubject(email.subject || '');
        setContent(email.content || '');
        setDelayAmount(email.delayAmount || 1);
        setDelayUnit(email.delayUnit || 'days');
    }, [email.id]); // Only trigger when email ID changes

    // Debounced update function
    const debouncedUpdate = (updates) => {
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            handleSave(updates);
        }, 500); // Update after 500ms of no changes
    };

    // Handle subject change
    const handleSubjectChange = (newSubject) => {
        setSubject(newSubject);
        debouncedUpdate({ subject: newSubject, content, delayAmount, delayUnit });
    };

    // Handle content change
    const handleContentChange = (newContent) => {
        setContent(newContent);
        debouncedUpdate({ subject, content: newContent, delayAmount, delayUnit });
    };

    // Handle delay change
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

        // Find and update the specific email
        const updatedEmails = sequence.emails.map((e) => {
            if (e.id === email.id) {
                return {
                    ...e,
                    ...updatesToUse,
                };
            }
            return e;
        });

        // Only update if emails array actually changed
        if (JSON.stringify(updatedEmails) !== JSON.stringify(sequence.emails)) {
            onUpdate({ emails: updatedEmails });
        }
    };

    const handleDelete = () => {
        if (sequence.emails.length === 1) {
            alert('Cannot delete the last email. Sequence must have at least one email.');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this email?')) {
            return;
        }

        const updatedEmails = sequence.emails.filter((e) => e.id !== email.id).map((e, index) => ({ ...e, order: index + 1 }));

        onUpdate({ emails: updatedEmails });
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    const hasChanges = subject !== (email.subject || '') || content !== (email.content || '') || Number(delayAmount) !== Number(email.delayAmount || 1) || delayUnit !== (email.delayUnit || 'days');

    return (
        <div className="email-config">
            <div className="email-config-header">
                <h2>Email {email.order}</h2>
                {sequence.emails.length > 1 && (
                    <button
                        className="delete-button"
                        onClick={handleDelete}
                    >
                        <Trash size={14} />
                        Delete
                    </button>
                )}
            </div>

            {/* Compact Delay Configuration */}
            <div className="delay-config">
                <div className="delay-label">
                    <Clock size={15} />
                    <span>Delay</span>
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

            {/* Subject */}
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

            {/* Email Content */}
            <div className="form-group">
                <label className="form-label">
                    Content<span className="form-required">*</span>
                </label>
                <UnifiedEditor
                    value={content}
                    onChange={handleContentChange}
                />
            </div>

            {/* Save indicator - only shows briefly */}
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
