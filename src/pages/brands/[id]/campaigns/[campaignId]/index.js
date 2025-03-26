import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Edit, ArrowLeft, Send } from 'lucide-react';

export default function CampaignDetail() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, campaignId } = router.query;

    const [brand, setBrand] = useState(null);
    const [campaign, setCampaign] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [emailContent, setEmailContent] = useState('');

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
            setEmailContent(data.content || '');
        } catch (error) {
            console.error('Error fetching campaign details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContentChange = (e) => {
        setEmailContent(e.target.value);
    };

    const handleSaveContent = async () => {
        try {
            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: emailContent,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to save email content');
            }

            alert('Email content saved successfully');
        } catch (error) {
            console.error('Error saving email content:', error);
            alert('Error saving email content: ' + error.message);
        }
    };

    // If loading or brand/campaign not loaded yet
    if (isLoading || !brand || !campaign) {
        return (
            <BrandLayout brand={brand}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading campaign details...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="campaign-detail-container">
                {/* Back button */}
                <Link
                    href={`/brands/${id}/campaigns`}
                    className="back-link"
                >
                    <ArrowLeft size={16} />
                    <span>Back to campaigns</span>
                </Link>

                {/* Campaign header */}
                <div className="campaign-detail-header">
                    <div className="campaign-detail-info">
                        <h1>{campaign.name}</h1>
                        <div className="campaign-subject">
                            <span className="subject-label">Subject:</span>
                            {campaign.subject}
                        </div>
                    </div>
                    <div className="campaign-detail-actions">
                        {campaign.status === 'draft' && (
                            <>
                                <Link
                                    href={`/brands/${id}/campaigns/${campaignId}/edit`}
                                    className="edit-campaign-btn"
                                >
                                    <Edit size={16} />
                                    Edit Campaign
                                </Link>
                                <Link
                                    href={`/brands/${id}/campaigns/${campaignId}/send`}
                                    className="send-campaign-btn"
                                >
                                    <Send size={16} />
                                    Send Campaign
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Email editor section */}
                <div className="email-editor-section">
                    <div className="email-editor-header">
                        <h2>Email Content</h2>
                        <Link
                            href={`/brands/${id}/campaigns/${campaignId}/editor`}
                            className="edit-content-button"
                        >
                            <Edit size={16} />
                            Edit Content
                        </Link>
                    </div>
                    <div className="email-editor-container">
                        <div
                            className="email-preview"
                            dangerouslySetInnerHTML={{ __html: emailContent || '<p>No content yet. Click "Edit Content" to start creating your email.</p>' }}
                        ></div>
                    </div>
                </div>
            </div>
        </BrandLayout>
    );
}
