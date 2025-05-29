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
        // Clear any previous save messages
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

            // Clear success message after 3 seconds
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
        // Navigate to the send page
        router.push(`/brands/${id}/campaigns/${campaignId}/send`);
    };

    if (isLoading || !brand || !campaign) {
        return (
            <BrandLayout brand={brand}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading campaign editor...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="campaign-editor-page">
                <div className="editor-top-bar">
                    <div className="editor-nav">
                        <Link
                            href={`/brands/${id}/campaigns`}
                            className="back-link"
                        >
                            <ArrowLeft size={16} />
                            <span>All the campaigns</span>
                        </Link>
                    </div>

                    <div className="editor-actions">
                        {saveMessage && <div className="status-message success">{saveMessage}</div>}
                        {error && <div className="status-message error">{error}</div>}

                        <button
                            className="btn-save"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <div className="button-spinner"></div>
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
                                className="btn-send"
                                onClick={handleSend}
                            >
                                <Send size={16} />
                                <span>Send</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="campaign-header">
                    <h1>{campaign.name}</h1>
                    <div className="subject-line">
                        <span>Subject:</span> {campaign.subject}
                    </div>
                </div>

                <div className="editor-container">
                    <div className="editor-info-bar">
                        <Info size={14} />
                        <span>Email preview - Your subscribers will see content as displayed below</span>
                    </div>

                    <UnifiedEditor
                        value={content}
                        onChange={handleContentChange}
                        placeholder="Write your email content or switch to HTML mode..."
                        editable={true}
                        defaultMode="visual" // Start with visual editor
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
