import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Save, Send, Info } from 'lucide-react';
import UnifiedEditor from '@/components/editor/UnifiedEditor';

export default function CampaignEditor() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, campaignId } = router.query;

    const [brand, setBrand] = useState(null);
    const [campaign, setCampaign] = useState(null);
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id && campaignId) {
            fetchBrandDetails();
            fetchCampaignDetails();
        }
    }, [status, id, campaignId, router]);

    const fetchBrandDetails = async () => {
        try {
            const res = await fetch(`/api/brands/${id}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Brand not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch brand details');
                }
            }

            const data = await res.json();
            setBrand(data);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            setError(error.message);
        }
    };

    const fetchCampaignDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Campaign not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch campaign details');
                }
            }

            const data = await res.json();
            setCampaign(data);
            setContent(data.content || getDefaultEmailTemplate());
        } catch (error) {
            console.error('Error fetching campaign details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContentChange = (newContent) => {
        setContent(newContent);
        setSaveMessage('');
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            setSaveMessage('');
            setError('');

            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: content,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to save campaign content');
            }

            setSaveMessage('Campaign saved successfully');

            setTimeout(() => {
                setSaveMessage('');
            }, 3000);
        } catch (error) {
            console.error('Error saving campaign:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSend = () => {
        router.push(`/brands/${id}/campaigns/${campaignId}/send`);
    };

    if (isLoading || !brand || !campaign) {
        return (
            <BrandLayout brand={brand}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
                    <div style={{ width: '2rem', height: '2rem', border: '3px solid #f0f0f0', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                    <p style={{ margin: 0, fontSize: '0.9375rem', color: '#666' }}>Loading campaign editor...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Top Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <Link
                        href={`/brands/${id}/campaigns`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#666',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                        }}
                    >
                        <ArrowLeft size={16} />
                        <span>All campaigns</span>
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {saveMessage && (
                            <div
                                className="alert alert--success"
                                style={{ marginBottom: 0, padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                            >
                                <span>{saveMessage}</span>
                            </div>
                        )}

                        {error && (
                            <div
                                className="alert alert--error"
                                style={{ marginBottom: 0, padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                            >
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            className="button button--secondary"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <span
                                        className="spinner-icon"
                                        style={{ animation: 'spin 0.8s linear infinite' }}
                                    >
                                        ⟳
                                    </span>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>Save</span>
                                </>
                            )}
                        </button>

                        {campaign.status === 'draft' && (
                            <button
                                className="button button--primary"
                                onClick={handleSend}
                            >
                                <Send size={16} />
                                <span>Send</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Campaign Header */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '500', color: '#1a1a1a' }}>{campaign.name}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                        <span style={{ fontWeight: '500' }}>Subject:</span>
                        <span>{campaign.subject}</span>
                    </div>
                </div>

                {/* Info Bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '0.5rem',
                        fontSize: '0.8125rem',
                        color: '#1e40af',
                        marginBottom: '1rem',
                    }}
                >
                    <Info size={14} />
                    <span>Email preview - Your subscribers will see content as displayed below</span>
                </div>

                {/* Editor Container */}
                <div
                    style={{
                        minHeight: '500px',
                    }}
                >
                    <UnifiedEditor
                        value={content}
                        onChange={handleContentChange}
                        placeholder="Write your email content or switch to HTML mode..."
                        editable={true}
                        defaultMode="visual"
                    />
                </div>
            </div>
        </BrandLayout>
    );
}

// Default email template with a standard email font
function getDefaultEmailTemplate() {
    return `
    <div style="font-family: Arial, sans-serif; color: #333333; max-width: 600px; margin: 0 auto;">
        <h2>Email Title</h2>
        <p>Hello,</p>
        <p>Edit this template to create your email content.</p>
        <p>Best regards,</p>
        <p>Your Name</p>
    </div>
    `;
}
