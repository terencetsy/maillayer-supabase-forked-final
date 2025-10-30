// src/components/sequences/SequenceCanvas.js
import { useRef, useEffect } from 'react';
import { Plus, Zap } from 'lucide-react';
import TriggerBlock from './blocks/TriggerBlock';
import EmailBlock from './blocks/EmailBlock';
import AddEmailButton from './blocks/AddEmailButton';

export default function SequenceCanvas({ sequence, onUpdate, selectedStep, setSelectedStep }) {
    const canvasRef = useRef(null);

    const handleAddEmail = () => {
        const newEmailId = `email-${Date.now()}`;
        const currentEmails = sequence.emails || [];

        const newEmail = {
            id: newEmailId,
            order: currentEmails.length + 1,
            subject: '',
            content: '',
            delayAmount: 1,
            delayUnit: 'days',
        };

        onUpdate({
            emails: [...currentEmails, newEmail],
        });

        // Select the new email after a short delay to ensure it's rendered
        setTimeout(() => {
            setSelectedStep(newEmailId);
        }, 100);
    };

    // Ensure emails array exists and is valid
    const emails = Array.isArray(sequence.emails) ? sequence.emails : [];

    return (
        <div
            className="sequence-canvas"
            ref={canvasRef}
        >
            <div className="canvas-content">
                <div className="canvas-flow">
                    {/* Trigger Block */}
                    <TriggerBlock
                        sequence={sequence}
                        isSelected={selectedStep === 'trigger'}
                        onClick={() => setSelectedStep('trigger')}
                    />

                    {/* Email Blocks with Connectors */}
                    {emails.map((email, index) => {
                        // Skip if email doesn't have an ID
                        if (!email.id) {
                            console.warn('Email missing ID:', email);
                            return null;
                        }

                        return (
                            <div key={email.id}>
                                {/* Connector */}
                                <div className="flow-connector">
                                    <div className="connector-line" />
                                    <div className="connector-time">
                                        {email.delayAmount} {email.delayUnit}
                                        {index > 0 ? ' after previous' : ' after trigger'}
                                    </div>
                                </div>

                                {/* Email Block */}
                                <EmailBlock
                                    email={email}
                                    index={index}
                                    isSelected={selectedStep === email.id}
                                    onClick={() => setSelectedStep(email.id)}
                                    totalEmails={emails.length}
                                />
                            </div>
                        );
                    })}

                    {/* Connector before Add Button */}
                    {emails.length > 0 && (
                        <div className="flow-connector">
                            <div className="connector-line" />
                        </div>
                    )}

                    {/* Add Email Button */}
                    <AddEmailButton onClick={handleAddEmail} />
                </div>
            </div>
        </div>
    );
}
