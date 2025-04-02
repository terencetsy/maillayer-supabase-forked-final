import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import BrandLayout from '@/components/BrandLayout';
import { PlusCircle, Search, Filter, Mail } from 'lucide-react';
import CampaignForm from '@/components/CampaignForm';
import CampaignList from '@/components/CampaignList';

export default function BrandCampaigns() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            fetchCampaigns();
        }
    }, [status, id, router]);

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

    const fetchCampaigns = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/campaigns`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch campaigns');
            }

            const data = await res.json();
            setCampaigns(data);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateClick = () => {
        setShowCreateForm(true);
    };

    const handleCancelCreate = () => {
        setShowCreateForm(false);
    };

    const handleCreateSuccess = (newCampaign) => {
        setCampaigns((prevCampaigns) => [newCampaign, ...prevCampaigns]);
        setShowCreateForm(false);
    };

    // Filter campaigns based on search query
    const filteredCampaigns = campaigns.filter((campaign) => {
        return campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) || campaign.subject.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // This is used just for the layout to identify the brand
    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Search and Create Bar */}
                <div className="campaigns-header">
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <Search
                                size={18}
                                className="search-icon"
                            />
                            <input
                                type="text"
                                placeholder="Search campaigns..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                    <button
                        className="create-button"
                        onClick={handleCreateClick}
                    >
                        <PlusCircle size={18} />
                        Create Campaign
                    </button>
                </div>

                {/* Campaign Form */}
                {showCreateForm && (
                    <div className="form-modal-overlay">
                        <div className="form-modal">
                            <CampaignForm
                                brand={brand}
                                onCancel={handleCancelCreate}
                                onSuccess={handleCreateSuccess}
                            />
                        </div>
                    </div>
                )}

                {/* Campaigns List or Empty State */}
                <>
                    {isLoading ? (
                        <div className="loading-section">
                            <div className="spinner"></div>
                            <p>Loading campaigns...</p>
                        </div>
                    ) : (
                        <>
                            {campaigns.length === 0 ? (
                                <div className="empty-state">
                                    <div className="icon-wrapper">
                                        <Mail size={36} />
                                    </div>
                                    <h2>No campaigns yet</h2>
                                    <p>Create your first email campaign to start engaging with your audience</p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleCreateClick}
                                    >
                                        <PlusCircle size={18} />
                                        Create Campaign
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {filteredCampaigns.length === 0 ? (
                                        <div className="empty-state search-empty">
                                            <h2>No matching campaigns</h2>
                                            <p>No campaigns match your search criteria</p>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => setSearchQuery('')}
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    ) : (
                                        <CampaignList
                                            campaigns={filteredCampaigns}
                                            brandId={id}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}
                </>
            </div>
        </BrandLayout>
    );
}
