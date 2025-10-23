// src/pages/brands/[id]/campaigns/index.js

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import BrandLayout from '@/components/BrandLayout';
import CampaignForm from '@/components/CampaignForm';
import CampaignList from '@/components/CampaignList';
import { Mail02, PlusSign, PlusSignCircle, Search01 } from '@/lib/icons';

export default function BrandCampaigns() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [campaignStats, setCampaignStats] = useState({}); // Store stats separately
    const [loadingStats, setLoadingStats] = useState({}); // Track which stats are loading
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasMore: false,
    });
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
        }
    }, [status, id, router]);

    useEffect(() => {
        if (brand && id) {
            fetchCampaigns();
        }
    }, [brand, pagination.page, pagination.limit, id]);

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
            setError(''); // Clear any previous errors

            const res = await fetch(`/api/brands/${id}/campaigns?page=${pagination.page}&limit=${pagination.limit}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to fetch campaigns');
            }

            const data = await res.json();

            // Validate the response structure
            if (!data || !Array.isArray(data.campaigns)) {
                throw new Error('Invalid response format from server');
            }

            setCampaigns(data.campaigns);
            setPagination((prev) => ({
                ...prev,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 0,
                hasMore: data.pagination?.hasMore || false,
            }));

            // After campaigns are loaded, fetch stats for non-draft campaigns
            if (data.campaigns.length > 0) {
                fetchCampaignsStats(data.campaigns);
            }
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            setError(error.message || 'Failed to load campaigns');
            // Set empty campaigns array on error
            setCampaigns([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCampaignsStats = async (campaignsList) => {
        if (!Array.isArray(campaignsList)) {
            console.error('Invalid campaigns list provided to fetchCampaignsStats');
            return;
        }

        // Filter campaigns that need stats (not draft or scheduled)
        const campaignsNeedingStats = campaignsList.filter((campaign) => campaign && campaign.status !== 'draft' && campaign.status !== 'scheduled');

        // Fetch stats for each campaign progressively with a small delay to avoid overwhelming the server
        for (let i = 0; i < campaignsNeedingStats.length; i++) {
            const campaign = campaignsNeedingStats[i];
            if (campaign && campaign._id) {
                // Add a small delay between requests (50ms)
                if (i > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                fetchCampaignStats(campaign._id);
            }
        }
    };

    const fetchCampaignStats = async (campaignId) => {
        // Validate campaignId
        if (!campaignId) {
            console.error('Invalid campaignId provided to fetchCampaignStats');
            return;
        }

        // Skip if already loading or loaded
        if (loadingStats[campaignId] || campaignStats[campaignId]) {
            return;
        }

        try {
            setLoadingStats((prev) => ({ ...prev, [campaignId]: true }));

            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}/quick-stats`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                // Don't throw error, just log it
                console.warn(`Failed to fetch stats for campaign ${campaignId}`);
                return;
            }

            const data = await res.json();

            if (data && data.statistics) {
                setCampaignStats((prev) => ({
                    ...prev,
                    [campaignId]: data.statistics,
                }));
            }
        } catch (error) {
            console.error(`Error fetching stats for campaign ${campaignId}:`, error);
            // Don't break the UI, just log the error
        } finally {
            setLoadingStats((prev) => ({ ...prev, [campaignId]: false }));
        }
    };

    const handleCreateClick = () => {
        setShowCreateForm(true);
    };

    const handleCancelCreate = () => {
        setShowCreateForm(false);
    };

    const handleCreateSuccess = (newCampaign) => {
        // Refresh the campaign list
        fetchCampaigns();
        setShowCreateForm(false);
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) {
            return;
        }

        setPagination((prev) => ({
            ...prev,
            page: newPage,
        }));

        // Clear existing stats when changing pages
        setCampaignStats({});
        setLoadingStats({});

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleLimitChange = (e) => {
        const newLimit = parseInt(e.target.value) || 10;
        setPagination((prev) => ({
            ...prev,
            limit: newLimit,
            page: 1, // Reset to first page when changing limit
        }));

        // Clear existing stats when changing limit
        setCampaignStats({});
        setLoadingStats({});
    };

    // Merge campaigns with their stats for display
    const campaignsWithStats = campaigns
        .map((campaign) => {
            if (!campaign || !campaign._id) {
                return null;
            }

            return {
                ...campaign,
                statistics: campaignStats[campaign._id] || null,
                statsLoading: loadingStats[campaign._id] || false,
            };
        })
        .filter(Boolean); // Remove any null entries

    // Filter campaigns based on search query
    const filteredCampaigns = campaignsWithStats.filter((campaign) => {
        if (!campaign) return false;

        const name = campaign.name || '';
        const subject = campaign.subject || '';
        const query = searchQuery.toLowerCase();

        return name.toLowerCase().includes(query) || subject.toLowerCase().includes(query);
    });

    if (status === 'loading' || (isLoading && !brand)) {
        return (
            <BrandLayout brand={null}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Error Display */}
                {error && (
                    <div
                        className="alert alert--error"
                        style={{ marginBottom: '1rem' }}
                    >
                        <span>{error}</span>
                    </div>
                )}

                {/* Search and Create Bar */}
                <div className="campaigns-header">
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <Search01
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
                        className="button button--primary"
                        onClick={handleCreateClick}
                    >
                        <PlusSign size={18} />
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
                            {campaigns.length === 0 && pagination.page === 1 ? (
                                <div className="empty-state">
                                    <div className="icon-wrapper">
                                        <Mail02 size={36} />
                                    </div>
                                    <h2>No campaigns yet</h2>
                                    <p>Create your first email campaign to start engaging with your audience</p>
                                    <button
                                        className="button button--secondary"
                                        onClick={handleCreateClick}
                                    >
                                        <PlusSignCircle size={18} />
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
                                                className="button button--secondary"
                                                onClick={() => setSearchQuery('')}
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <CampaignList
                                                campaigns={filteredCampaigns}
                                                brandId={id}
                                            />

                                            {/* Pagination Controls */}
                                            {pagination.totalPages > 1 && (
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        gap: '1rem',
                                                        marginTop: '2rem',
                                                        padding: '1rem',
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    {/* Items per page selector */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontSize: '0.875rem', color: '#666' }}>Show:</span>
                                                        <select
                                                            value={pagination.limit}
                                                            onChange={handleLimitChange}
                                                            className="form-select"
                                                            style={{
                                                                padding: '0.375rem 0.75rem',
                                                                fontSize: '0.875rem',
                                                                width: 'auto',
                                                            }}
                                                        >
                                                            <option value="10">10</option>
                                                            <option value="20">20</option>
                                                            <option value="50">50</option>
                                                        </select>
                                                        <span style={{ fontSize: '0.875rem', color: '#666' }}>per page</span>
                                                    </div>

                                                    {/* Page navigation */}
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '1rem',
                                                        }}
                                                    >
                                                        <button
                                                            className="button button--secondary button--small"
                                                            onClick={() => handlePageChange(pagination.page - 1)}
                                                            disabled={pagination.page <= 1}
                                                            style={{
                                                                opacity: pagination.page <= 1 ? 0.5 : 1,
                                                                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                                                            }}
                                                        >
                                                            {/* <ChevronLeft size={16} /> */}
                                                            <span>Previous</span>
                                                        </button>

                                                        <span style={{ fontSize: '0.875rem', color: '#666' }}>
                                                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                                                        </span>

                                                        <button
                                                            className="button button--secondary button--small"
                                                            onClick={() => handlePageChange(pagination.page + 1)}
                                                            disabled={!pagination.hasMore}
                                                            style={{
                                                                opacity: !pagination.hasMore ? 0.5 : 1,
                                                                cursor: !pagination.hasMore ? 'not-allowed' : 'pointer',
                                                            }}
                                                        >
                                                            <span>Next</span>
                                                            {/* <ChevronRight size={16} /> */}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
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
