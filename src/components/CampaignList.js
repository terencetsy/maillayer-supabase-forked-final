// components/CampaignList.js
import React from 'react';
import Link from 'next/link';
import { Copy, Edit, Trash, BarChart2, Mail } from 'lucide-react';

const CampaignList = ({ campaigns, brandId }) => {
    // Function to handle campaign duplication
    const handleDuplicate = async (campaignId, campaignName) => {
        // Implementation for duplicating campaign
        // You'll need to create an API endpoint for this
        try {
            const response = await fetch(`/api/brands/${brandId}/campaigns/${campaignId}/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: `${campaignName} (Copy)` }),
            });

            if (response.ok) {
                // Refresh the page or update the list
                window.location.reload();
            } else {
                alert('Failed to duplicate campaign');
            }
        } catch (error) {
            console.error('Error duplicating campaign:', error);
            alert('An error occurred while duplicating the campaign');
        }
    };

    // Function to handle campaign deletion
    const handleDelete = async (campaignId) => {
        if (confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/brands/${brandId}/campaigns/${campaignId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    // Refresh the page or update the list
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

    return (
        <div className="campaigns-table-container">
            <table className="campaigns-table">
                <thead>
                    <tr>
                        <th className="campaign-col">Campaign</th>
                        <th className="status-col">Status</th>
                        <th className="recipients-col">Recipients</th>
                        <th className="openrate-col">Open Rate</th>
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
                                        <Mail size={16} />
                                    </div>
                                    <div className="campaign-details">
                                        <div className="campaign-name">{campaign.name}</div>
                                        <div className="campaign-subject">{campaign.subject}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="status-col">
                                <span className={`status-badge ${campaign.status}`}>{campaign.status === 'draft' ? 'Draft' : campaign.status === 'sending' ? 'Sending' : campaign.status === 'sent' ? 'Sent' : campaign.status === 'scheduled' ? 'Scheduled' : campaign.status}</span>
                            </td>
                            <td className="recipients-col">{campaign.recipientCount || '-'}</td>
                            <td className="openrate-col">{campaign.status === 'sent' ? `${campaign.openRate || 0}%` : '-'}</td>
                            <td className="created-col">{new Date(campaign.createdAt).toLocaleDateString()}</td>
                            <td className="actions-col">
                                <div className="action-buttons">
                                    {campaign.status === 'draft' ? (
                                        <>
                                            {/* Actions for draft campaigns */}
                                            <Link
                                                href={`/brands/${brandId}/campaigns/${campaign._id}/editor`}
                                                className="edit-btn"
                                                title="Edit campaign"
                                            >
                                                <Edit size={16} />
                                            </Link>
                                            <button
                                                className="duplicate-btn"
                                                onClick={() => handleDuplicate(campaign._id, campaign.name)}
                                                title="Duplicate campaign"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                className="delete-btn"
                                                onClick={() => handleDelete(campaign._id)}
                                                title="Delete campaign"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Actions for non-draft campaigns */}
                                            <Link
                                                href={`/brands/${brandId}/campaigns/${campaign._id}`}
                                                className="view-btn"
                                                title="View report"
                                            >
                                                <BarChart2 size={16} />
                                            </Link>
                                            <button
                                                className="duplicate-btn"
                                                onClick={() => handleDuplicate(campaign._id, campaign.name)}
                                                title="Duplicate campaign"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </>
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
