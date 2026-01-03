// src/components/CampaignList.js

import React from 'react';
import Link from 'next/link';
import { formatDistance } from 'date-fns';
import { CornerLeftUp, Copy, Trash2, Pencil, Eye, Mail, PieChart, UserMinus } from 'lucide-react';

const CampaignList = ({ campaigns, brandId, onEditCampaign }) => {
    const handleDuplicate = async (campaignId, campaignName) => {
        try {
            const response = await fetch(`/api/brands/${brandId}/campaigns/${campaignId}/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: `${campaignName} (Copy)` }),
            });

            if (response.ok) {
                window.location.reload();
            } else {
                alert('Failed to duplicate campaign');
            }
        } catch (error) {
            console.error('Error duplicating campaign:', error);
            alert('An error occurred while duplicating the campaign');
        }
    };

    const handleDelete = async (campaignId) => {
        if (confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/brands/${brandId}/campaigns/${campaignId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    window.location.reload();
                } else {
                    alert('Failed to delete campaign');
                }
            } catch (error) {
                console.error('Error deleting campaign:', error);
                alert('An error occurred while deleting the campaign');
            }
        }
    };

    const renderStatusBadge = (status) => {
        switch (status) {
            case 'draft':
                return <span className="status-badge draft">Draft</span>;
            case 'scheduled':
                return <span className="status-badge scheduled">Scheduled</span>;
            case 'sending':
                return <span className="status-badge sending">Sending</span>;
            case 'sent':
                return <span className="status-badge sent">Sent</span>;
            case 'queued':
                return <span className="status-badge queued">Queued</span>;
            case 'failed':
                return <span className="status-badge failed">Failed</span>;
            case 'warmup':
                return <span className="status-badge warmup">Warmup</span>;
            default:
                return <span className="status-badge">{status}</span>;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not sent';
        const date = new Date(dateString);
        return formatDistance(date, new Date(), { addSuffix: true });
    };

    // Render loading skeleton for stats
    const renderStatsSkeleton = () => (
        <div className="stats-skeleton">
            <div
                className="skeleton-bar"
                style={{ width: '30px', height: '12px', backgroundColor: '#e5e5e5', borderRadius: '4px' }}
            ></div>
        </div>
    );

    // Check if campaign needs stats (not draft or scheduled)
    const needsStats = (campaign) => {
        return campaign.status !== 'draft' && campaign.status !== 'scheduled';
    };

    return (
        <div className="campaigns-table-container campaigns-table-wrapper">
            <table className="campaigns-table">
                <thead>
                    <tr>
                        <th className="campaign-col">Campaign</th>
                        {/* <th className="status-col">Status</th> */}
                        <th className="recipients-col">Recipients</th>
                        <th className="openrate-col">Open Rate</th>
                        <th className="unsub-col">Unsubscribed</th>
                        <th className="bounce-col">Bounced</th>
                        <th className="created-col">Created</th>
                        <th className="actions-col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {campaigns.map((campaign) => (
                        <tr key={campaign._id}>
                            <td className="campaign-col">
                                <div className="campaign-info">
                                    <div className="email-icon">{renderStatusBadge(campaign.status)}</div>
                                    <div className="campaign-details">
                                        <div className="campaign-name-row">
                                            <span className="campaign-subject">{campaign.subject}</span>
                                            {onEditCampaign && campaign.status === 'draft' && (
                                                <button
                                                    className="inline-edit-btn"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onEditCampaign(campaign);
                                                    }}
                                                    title="Edit campaign details"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            {/* <td className="status-col">{renderStatusBadge(campaign.status)}</td> */}

                            {/* Recipients */}
                            <td className="recipients-col">{needsStats(campaign) ? (campaign.statsLoading ? renderStatsSkeleton() : campaign.statistics?.recipients || campaign.stats?.recipients || 0) : campaign.stats?.recipients || 0}</td>

                            {/* Open Rate */}
                            <td className="openrate-col">
                                {needsStats(campaign) ? (
                                    campaign.statsLoading ? (
                                        renderStatsSkeleton()
                                    ) : (
                                        <div className="stats-value">
                                            <PieChart
                                                size={14}
                                                className="stats-icon"
                                            />
                                            {campaign.statistics?.openRate || '0'}%
                                        </div>
                                    )
                                ) : (
                                    <div
                                        className="stats-value"
                                        style={{ color: '#999' }}
                                    >
                                        —
                                    </div>
                                )}
                            </td>

                            {/* Unsubscribed */}
                            <td className="unsub-col">
                                {needsStats(campaign) ? (
                                    campaign.statsLoading ? (
                                        renderStatsSkeleton()
                                    ) : (
                                        <div className="stats-value">
                                            <UserMinus
                                                size={14}
                                                className="stats-icon"
                                            />
                                            {campaign.statistics?.unsubscribedCount || campaign.statistics?.unsubscribed?.total || campaign.stats?.unsubscribes || 0}
                                        </div>
                                    )
                                ) : (
                                    <div
                                        className="stats-value"
                                        style={{ color: '#999' }}
                                    >
                                        —
                                    </div>
                                )}
                            </td>

                            {/* Bounced */}
                            <td className="bounce-col">
                                {needsStats(campaign) ? (
                                    campaign.statsLoading ? (
                                        renderStatsSkeleton()
                                    ) : (
                                        <div className="stats-value">
                                            <CornerLeftUp
                                                size={14}
                                                className="stats-icon"
                                            />
                                            {campaign.statistics?.bouncedCount || campaign.statistics?.bounce?.total || 0}
                                        </div>
                                    )
                                ) : (
                                    <div
                                        className="stats-value"
                                        style={{ color: '#999' }}
                                    >
                                        —
                                    </div>
                                )}
                            </td>

                            <td className="created-col">{formatDate(campaign.createdAt)}</td>
                            <td className="actions-col">
                                <div className="action-buttons">
                                    <Link
                                        href={`/brands/${brandId}/campaigns/${campaign._id}`}
                                        className="action-btn view-btn"
                                        title="View Campaign"
                                    >
                                        <Eye size={16} />
                                    </Link>
                                    {campaign.status === 'draft' && (
                                        <Link
                                            href={`/brands/${brandId}/campaigns/${campaign._id}/editor`}
                                            className="action-btn edit-btn"
                                            title="Edit Campaign"
                                        >
                                            <Pencil size={16} />
                                        </Link>
                                    )}
                                    <div
                                        className="action-btn duplicate-btn"
                                        onClick={() => handleDuplicate(campaign._id, campaign.name)}
                                        title="Duplicate Campaign"
                                    >
                                        <Copy size={16} />
                                    </div>
                                    {campaign.status === 'draft' && (
                                        <button
                                            className="action-btn delete-btn"
                                            title="Delete Campaign"
                                            onClick={() => handleDelete(campaign._id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <style jsx>{`
                .stats-skeleton {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .skeleton-bar {
                    animation: pulse 1.5s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%,
                    100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.5;
                    }
                }

                .status-badge.warmup {
                    background-color: #dbeafe;
                    color: #1e40af;
                }

                .campaign-name-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .campaign-name-row :global(.inline-edit-btn) {
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.15s ease, visibility 0.15s ease;
                    background: none;
                    border: none;
                    padding: 4px;
                    cursor: pointer;
                    color: #666;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }

                .campaign-name-row :global(.inline-edit-btn):hover {
                    color: #333;
                    background-color: #f0f0f0;
                }

                tr:hover .campaign-name-row :global(.inline-edit-btn) {
                    opacity: 1;
                    visibility: visible;
                }
            `}</style>
        </div>
    );
};

export default CampaignList;
