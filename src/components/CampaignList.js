import React from 'react';
import Link from 'next/link';
import { formatDistance } from 'date-fns';
import { Mail, Eye, Edit, Copy, Trash, PieChart, Users, AlertOctagon } from 'lucide-react';

const CampaignList = ({ campaigns, brandId }) => {
    // Function to render the status badge
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
            default:
                return <span className="status-badge">{status}</span>;
        }
    };

    // Format the date nicely
    const formatDate = (dateString) => {
        if (!dateString) return 'Not sent';
        const date = new Date(dateString);
        return formatDistance(date, new Date(), { addSuffix: true });
    };

    return (
        <div className="campaigns-table-container">
            <table className="campaigns-table">
                <thead>
                    <tr>
                        <th className="campaign-col">Campaign</th>
                        <th className="status-col">Status</th>
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
                                    <div className="email-icon">
                                        <Mail size={18} />
                                    </div>
                                    <div className="campaign-details">
                                        <div className="campaign-name">{campaign.name}</div>
                                        <div className="campaign-subject">{campaign.subject}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="status-col">{renderStatusBadge(campaign.status)}</td>
                            <td className="recipients-col">{campaign.stats?.recipients || campaign.statistics?.recipients || 0}</td>
                            <td className="openrate-col">
                                <div className="stats-value">
                                    <PieChart
                                        size={14}
                                        className="stats-icon"
                                    />
                                    {campaign.statistics?.openRate || campaign.openRate || '0'}%
                                </div>
                            </td>
                            <td className="unsub-col">
                                <div className="stats-value">
                                    <Users
                                        size={14}
                                        className="stats-icon"
                                    />
                                    {campaign.statistics?.unsubscribedCount || 0}
                                </div>
                            </td>
                            <td className="bounce-col">
                                <div className="stats-value">
                                    <AlertOctagon
                                        size={14}
                                        className="stats-icon"
                                    />
                                    {campaign.statistics?.bouncedCount || 0}
                                </div>
                            </td>
                            <td className="created-col">{formatDate(campaign.createdAt)}</td>
                            <td className="actions-col">
                                <div className="action-buttons">
                                    <Link
                                        href={`/brands/${brandId}/campaigns/${campaign._id}`}
                                        className="view-btn"
                                        title="View Campaign"
                                    >
                                        <Eye size={16} />
                                    </Link>
                                    {campaign.status === 'draft' && (
                                        <Link
                                            href={`/brands/${brandId}/campaigns/${campaign._id}/editor`}
                                            className="edit-btn"
                                            title="Edit Campaign"
                                        >
                                            <Edit size={16} />
                                        </Link>
                                    )}
                                    <Link
                                        href={`/brands/${brandId}/campaigns/${campaign._id}/duplicate`}
                                        className="duplicate-btn"
                                        title="Duplicate Campaign"
                                    >
                                        <Copy size={16} />
                                    </Link>
                                    {campaign.status === 'draft' && (
                                        <button
                                            className="delete-btn"
                                            title="Delete Campaign"
                                            onClick={() => {
                                                // Delete functionality would be implemented here
                                                alert('Delete functionality would be implemented here');
                                            }}
                                        >
                                            <Trash size={16} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CampaignList;
