// src/components/sequences/sidebar/EmailConfig.js
import { useState, useEffect } from 'react';
import { Clock, Trash, Save } from 'lucide-react';
import UnifiedEditor from '@/components/editor/UnifiedEditor';

export default function EmailConfig({ sequence, email, onUpdate }) {
    const [subject, setSubject] = useState(email.subject || '');
    const [content, setContent] = useState(email.content || '');
    const [delayAmount, setDelayAmount] = useState(email.delayAmount || 1);
    const [delayUnit, setDelayUnit] = useState(email.delayUnit || 'days');

    useEffect(() => {
        setSubject(email.subject || '');
        setContent(email.content || '');
        setDelayAmount(email.delayAmount || 1);
        setDelayUnit(email.delayUnit || 'days');
    }, [email]);

    const handleSave = () => {
        const updatedEmails = sequence.emails.map((e) => {
            if (e.id === email.id) {
                return { ...e, subject, content, delayAmount, delayUnit };
            }
            return e;
        });

        onUpdate({ emails: updatedEmails });
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

    const hasChanges = subject !== email.subject || content !== email.content || delayAmount !== email.delayAmount || delayUnit !== email.delayUnit;

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
                        onChange={(e) => setDelayAmount(parseInt(e.target.value) || 0)}
                        className="form-input"
                    />
                    <select
                        value={delayUnit}
                        onChange={(e) => setDelayUnit(e.target.value)}
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
                    onChange={(e) => setSubject(e.target.value)}
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
                    content={content}
                    onChange={setContent}
                />
            </div>

            {/* Compact Save Bar */}
            {hasChanges && (
                <div className="save-bar">
                    <p>Unsaved changes</p>
                    <button
                        className="button button--primary"
                        onClick={handleSave}
                    >
                        <Save size={14} />
                        Save
                    </button>
                </div>
            )}
        </div>
    );
}
