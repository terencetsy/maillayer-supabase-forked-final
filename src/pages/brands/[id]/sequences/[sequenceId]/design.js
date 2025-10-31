// src/pages/brands/[id]/sequences/[sequenceId]/design.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import SequenceBuilder from '@/components/sequences/SequenceBuilder';
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

            if (updates.emails) {
                updated.emails = updates.emails.map((email, index) => ({
                    ...email,
                    id: email.id || `email-${Date.now()}-${index}`,
                    order: email.order || index + 1,
                }));
            } else {
                Object.assign(updated, updates);
            }

            return updated;
        });
    }, []);

    const hasUnsavedChanges = useCallback(() => {
        if (!sequence || !originalSequence) return false;

        const compareFields = (a, b) => {
            if (!a || !b) return false;

            if (a.name !== b.name || a.description !== b.description || a.triggerType !== b.triggerType || a.status !== b.status) {
                return true;
            }

            if (a.emails?.length !== b.emails?.length) return true;

            for (let i = 0; i < (a.emails?.length || 0); i++) {
                const aEmail = a.emails[i];
                const bEmail = b.emails[i];

                if (aEmail.subject !== bEmail.subject || aEmail.content !== bEmail.content || aEmail.delayAmount !== bEmail.delayAmount || aEmail.delayUnit !== bEmail.delayUnit) {
                    return true;
                }
            }

            if (JSON.stringify(a.triggerConfig) !== JSON.stringify(b.triggerConfig)) {
                return true;
            }

            if (JSON.stringify(a.emailConfig) !== JSON.stringify(b.emailConfig)) {
                return true;
            }

            return false;
        };

        return compareFields(sequence, originalSequence);
    }, [sequence, originalSequence]);

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges() || isSaving) {
            return;
        }

        try {
            setIsSaving(true);
            setError('');

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

            await updateEmailSequence(id, sequenceId, dataToSave);

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
        if (hasUnsavedChanges() && !isSaving) {
            await handleSave();
        }

        const newStatus = sequence.status === 'active' ? 'paused' : 'active';

        try {
            await updateEmailSequence(id, sequenceId, { status: newStatus });

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

    useEffect(() => {
        if (hasUnsavedChanges() && !isSaving) {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(() => {
                handleSave();
            }, 3000);
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [sequence, hasUnsavedChanges, isSaving, handleSave]);

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fafafa' }}>
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
            <SequenceBuilder
                sequence={sequence}
                onUpdate={handleUpdate}
                onSave={handleSave}
                onToggleActive={handleToggleActive}
                isSaving={isSaving}
                hasUnsavedChanges={hasUnsavedChanges()}
                error={error}
                onClearError={() => setError('')}
                brandId={id}
            />
        </>
    );
}
