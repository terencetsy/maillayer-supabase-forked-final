// src/pages/brands/[id]/sequences/[sequenceId]/design.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import SequenceCanvas from '@/components/sequences/SequenceCanvas';
import SequenceSidebar from '@/components/sequences/SequenceSidebar';
import { getEmailSequence, updateEmailSequence } from '@/services/clientEmailSequenceService';

export default function SequenceDesign() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, sequenceId } = router.query;

    const [sequence, setSequence] = useState(null);
    const [originalSequence, setOriginalSequence] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [selectedStep, setSelectedStep] = useState('trigger');

    const saveTimeoutRef = useRef(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id && sequenceId) {
            fetchSequence();
        }
    }, [status, id, sequenceId]);

    const fetchSequence = async () => {
        try {
            const data = await getEmailSequence(id, sequenceId);

            // Ensure all emails have IDs
            if (data.emails) {
                data.emails = data.emails.map((email, index) => ({
                    ...email,
                    id: email.id || `email-${Date.now()}-${index}`,
                    order: email.order || index + 1,
                }));
            }

            if (isMountedRef.current) {
                setSequence(data);
                setOriginalSequence(JSON.parse(JSON.stringify(data)));
            }
        } catch (error) {
            console.error('Error fetching sequence:', error);
            if (isMountedRef.current) {
                setError(error.message);
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    };

    const handleUpdate = useCallback((updates) => {
        setSequence((prev) => {
            if (!prev) return prev;

            const updated = { ...prev };

            // If updating emails, ensure they have IDs and orders
            if (updates.emails) {
                updated.emails = updates.emails.map((email, index) => ({
                    ...email,
                    id: email.id || `email-${Date.now()}-${index}`,
                    order: email.order || index + 1,
                }));
            } else {
                // Merge other updates
                Object.assign(updated, updates);
            }

            return updated;
        });
    }, []);

    const hasUnsavedChanges = useCallback(() => {
        if (!sequence || !originalSequence) return false;

        // Compare relevant fields only
        const compareFields = (a, b) => {
            if (!a || !b) return false;

            // Compare basic fields
            if (a.name !== b.name || a.description !== b.description || a.triggerType !== b.triggerType || a.status !== b.status) {
                return true;
            }

            // Compare emails
            if (a.emails?.length !== b.emails?.length) return true;

            for (let i = 0; i < (a.emails?.length || 0); i++) {
                const aEmail = a.emails[i];
                const bEmail = b.emails[i];

                if (aEmail.subject !== bEmail.subject || aEmail.content !== bEmail.content || aEmail.delayAmount !== bEmail.delayAmount || aEmail.delayUnit !== bEmail.delayUnit) {
                    return true;
                }
            }

            // Compare trigger config
            if (JSON.stringify(a.triggerConfig) !== JSON.stringify(b.triggerConfig)) {
                return true;
            }

            // Compare email config
            if (JSON.stringify(a.emailConfig) !== JSON.stringify(b.emailConfig)) {
                return true;
            }

            return false;
        };

        return compareFields(sequence, originalSequence);
    }, [sequence, originalSequence]);

    // In the handleSave function, update the dataToSave section:

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges() || isSaving) {
            return;
        }

        try {
            setIsSaving(true);
            setError('');

            // Prepare data for save - ensure all fields are included
            const dataToSave = {
                name: sequence.name,
                description: sequence.description,
                triggerType: sequence.triggerType,
                triggerConfig: {
                    contactListIds: sequence.triggerConfig?.contactListIds || [],
                    integrationType: sequence.triggerConfig?.integrationType,
                    integrationEvent: sequence.triggerConfig?.integrationEvent,
                    integrationAccountId: sequence.triggerConfig?.integrationAccountId,
                },
                emailConfig: {
                    fromName: sequence.emailConfig?.fromName || '',
                    fromEmail: sequence.emailConfig?.fromEmail || '',
                    replyToEmail: sequence.emailConfig?.replyToEmail || '',
                },
                emails: sequence.emails || [],
                status: sequence.status,
            };

            console.log('Saving sequence with data:', dataToSave); // Debug log

            // Save without updating state immediately
            await updateEmailSequence(id, sequenceId, dataToSave);

            // Only update the originalSequence to mark as saved
            if (isMountedRef.current) {
                setOriginalSequence(JSON.parse(JSON.stringify(sequence)));
                setIsSaving(false);
            }
        } catch (error) {
            console.error('Error saving sequence:', error);
            if (isMountedRef.current) {
                setError(error.message || 'Failed to save sequence');
                setIsSaving(false);
            }
        }
    }, [sequence, hasUnsavedChanges, isSaving, id, sequenceId]);

    const handleToggleActive = async () => {
        // Save changes first if there are any
        if (hasUnsavedChanges() && !isSaving) {
            await handleSave();
        }

        const newStatus = sequence.status === 'active' ? 'paused' : 'active';

        try {
            await updateEmailSequence(id, sequenceId, { status: newStatus });

            // Only update the status in state, don't refetch everything
            if (isMountedRef.current) {
                setSequence((prev) => ({ ...prev, status: newStatus }));
                setOriginalSequence((prev) => ({ ...prev, status: newStatus }));
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            if (isMountedRef.current) {
                setError(error.message);
            }
        }
    };

    // Auto-save with debounce
    useEffect(() => {
        if (hasUnsavedChanges() && !isSaving) {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(() => {
                handleSave();
            }, 3000); // Auto-save after 3 seconds of no changes
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [sequence, hasUnsavedChanges, isSaving, handleSave]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: '40px',
                            height: '40px',
                            border: '4px solid #f0f0f0',
                            borderTopColor: '#1a1a1a',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 1rem',
                        }}
                    ></div>
                    <p>Loading sequence...</p>
                </div>
            </div>
        );
    }

    if (!sequence) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <h2>Sequence not found</h2>
                    <button
                        className="button button--primary"
                        onClick={() => router.push(`/brands/${id}/sequences`)}
                        style={{ marginTop: '1rem' }}
                    >
                        Back to Sequences
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <style
                jsx
                global
            >{`
                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
            <div style={{ display: 'grid', height: '100vh', gridTemplateColumns: '50% 50%', backgroundColor: '#f6f6f6' }}>
                {error && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 20,
                            right: 20,
                            background: '#fee',
                            border: '1px solid #fcc',
                            padding: '12px 16px',
                            borderRadius: '6px',
                            zIndex: 1000,
                            maxWidth: '400px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{error}</span>
                            <button
                                onClick={() => setError('')}
                                style={{
                                    marginLeft: 10,
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    color: '#c00',
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                {isSaving && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 20,
                            right: 20,
                            background: '#fff',
                            border: '1px solid #e0e0e0',
                            padding: '12px 16px',
                            borderRadius: '6px',
                            zIndex: 1000,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <div
                            style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #f0f0f0',
                                borderTopColor: '#1a1a1a',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }}
                        ></div>
                        <span>Saving...</span>
                    </div>
                )}

                <SequenceCanvas
                    sequence={sequence}
                    onUpdate={handleUpdate}
                    selectedStep={selectedStep}
                    setSelectedStep={setSelectedStep}
                />
                <SequenceSidebar
                    sequence={sequence}
                    onUpdate={handleUpdate}
                    selectedStep={selectedStep}
                    setSelectedStep={setSelectedStep}
                    onSave={handleSave}
                    onToggleActive={handleToggleActive}
                    saving={isSaving}
                    hasUnsavedChanges={hasUnsavedChanges()}
                />
            </div>
        </>
    );
}
