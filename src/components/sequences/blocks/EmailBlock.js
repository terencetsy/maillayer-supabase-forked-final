// src/components/sequences/blocks/EmailBlock.js
import { Mail, Clock, CheckCircle } from 'lucide-react';

export default function EmailBlock({ email, index, isSelected, onClick, totalEmails }) {
    const isConfigured = email.subject && email.content;

    return (
        <div
            className={`email-block ${isSelected ? 'selected' : ''} ${isConfigured ? 'configured' : 'unconfigured'}`}
            onClick={onClick}
        >
            <div className="email-block-header">
                <div className="email-block-icon">
                    <Mail size={20} />
                </div>
                <div className="email-block-content">
                    <div className="email-block-title">{email.subject || `Email ${index + 1}`}</div>
                    {isConfigured && (
                        <div className="email-block-badge">
                            <CheckCircle size={13} />
                            <span>Configured</span>
                        </div>
                    )}
                </div>
                <div className="email-block-status">
                    <div className="status-indicator">{index + 1}</div>
                </div>
            </div>

            <div className="email-block-delay">
                <Clock size={15} />
                <span>
                    {email.delayAmount} {email.delayUnit}
                    {index > 0 ? ' after previous' : ' after trigger'}
                </span>
            </div>
        </div>
    );
}
