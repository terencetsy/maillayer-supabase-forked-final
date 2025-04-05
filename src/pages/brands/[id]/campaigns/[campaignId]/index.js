import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, BarChart2, Users, Eye, X, Clock, Calendar, Send, Mail, MousePointer, AlertTriangle, Filter, Download, ChevronLeft, ChevronRight, MailX } from 'lucide-react';
import { formatDistance } from 'date-fns';
import GeoStats from '@/components/GeoStats';

export default function CampaignDetail() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, campaignId } = router.query;

    const [brand, setBrand] = useState(null);
    const [campaign, setCampaign] = useState(null);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // For events
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    // Filters
    const [filters, setFilters] = useState({
        eventType: '',
        email: '',
        sort: 'timestamp',
        order: 'desc',
    });

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

    useEffect(() => {
        if (campaign && campaign.status !== 'draft') {
            fetchCampaignStats();
            fetchCampaignEvents();
        }
    }, [campaign]);

    // Fetch events when pagination or filters change
    useEffect(() => {
        if (campaign && campaign.status !== 'draft') {
            fetchCampaignEvents();
        }
    }, [pagination.page, filters]);

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
        } catch (error) {
            console.error('Error fetching campaign details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCampaignStats = async () => {
        try {
            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}/stats`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch campaign stats');
            }

            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching campaign stats:', error);
        }
    };

    const fetchCampaignEvents = async () => {
        try {
            setEventsLoading(true);

            const queryParams = new URLSearchParams({
                events: 'true',
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
            });

            const response = await fetch(`/api/brands/${id}/campaigns/${campaignId}/stats?${queryParams}`, {
                credentials: 'same-origin',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch events');
            }

            const data = await response.json();
            setEvents(data.events || []);
            setPagination((prev) => ({
                ...prev,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 1,
            }));
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setEventsLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }));

        // Reset to page 1 when changing filters
        setPagination((prev) => ({
            ...prev,
            page: 1,
        }));
    };

    const handlePageChange = (newPage) => {
        setPagination((prev) => ({
            ...prev,
            page: newPage,
        }));
    };

    const exportEvents = async () => {
        // Placeholder implementation
        alert('Export functionality would be implemented here');
    };

    // Format the date nicely
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Helper to format event type for display
    const formatEventType = (type) => {
        switch (type) {
            case 'open':
                return {
                    label: 'Open',
                    icon: (
                        <Mail
                            size={14}
                            className="cd-event-icon cd-event-icon-open"
                        />
                    ),
                };
            case 'click':
                return {
                    label: 'Click',
                    icon: (
                        <MousePointer
                            size={14}
                            className="cd-event-icon cd-event-icon-click"
                        />
                    ),
                };
            case 'bounce':
                return {
                    label: 'Bounce',
                    icon: (
                        <X
                            size={14}
                            className="cd-event-icon cd-event-icon-bounce"
                        />
                    ),
                };
            case 'complaint':
                return {
                    label: 'Complaint',
                    icon: (
                        <AlertTriangle
                            size={14}
                            className="cd-event-icon cd-event-icon-complaint"
                        />
                    ),
                };
            case 'delivery':
                return {
                    label: 'Delivery',
                    icon: (
                        <Mail
                            size={14}
                            className="cd-event-icon cd-event-icon-delivery"
                        />
                    ),
                };
            case 'unsubscribe':
                return {
                    label: 'Unsubscribe',
                    icon: (
                        <MailX
                            size={14}
                            className="cd-event-icon cd-event-icon-unsubscribe"
                        />
                    ),
                };
            default:
                return { label: type, icon: null };
        }
    };

    // If loading or brand/campaign not loaded yet
    if (isLoading || !brand || !campaign) {
        return (
            <BrandLayout brand={brand}>
                <div className="cd-loading">
                    <div className="cd-spinner"></div>
                    <p>Loading campaign details...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="cd-container">
                {/* Navigation */}
                <div className="cd-header">
                    <Link
                        href={`/brands/${id}/campaigns`}
                        className="cd-back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to campaigns</span>
                    </Link>

                    <div className="cd-campaign-header">
                        <h1>{campaign.name}</h1>
                        <div className="cd-campaign-meta">
                            <span className={`cd-status-badge cd-status-${campaign.status}`}>{campaign.status === 'draft' ? 'Draft' : campaign.status === 'sending' ? 'Sending' : campaign.status === 'sent' ? 'Sent' : campaign.status === 'scheduled' ? 'Scheduled' : campaign.status}</span>
                        </div>
                    </div>
                </div>

                {/* Campaign Summary */}
                <div className="cd-summary-card">
                    <div className="cd-card-header">
                        <Mail size={18} />
                        <h3>Campaign Overview</h3>
                    </div>
                    <div className="cd-card-content">
                        <div className="cd-summary-grid">
                            <div className="cd-summary-item">
                                <span className="cd-summary-label">Subject</span>
                                <span className="cd-summary-value">{campaign.subject}</span>
                            </div>

                            <div className="cd-summary-item">
                                <span className="cd-summary-label">
                                    <Calendar size={14} />
                                    Created
                                </span>
                                <span className="cd-summary-value">{formatDate(campaign.createdAt)}</span>
                            </div>

                            <div className="cd-summary-item">
                                <span className="cd-summary-label">
                                    <Send size={14} />
                                    Sent
                                </span>
                                <span className="cd-summary-value">{formatDate(campaign.sentAt) || 'Not sent yet'}</span>
                            </div>

                            <div className="cd-summary-item">
                                <span className="cd-summary-label">
                                    <Users size={14} />
                                    Recipients
                                </span>
                                <span className="cd-summary-value">{campaign.stats?.recipients || 0} contacts</span>
                            </div>

                            <div className="cd-summary-item">
                                <span className="cd-summary-label">From</span>
                                <span className="cd-summary-value">
                                    {campaign.fromName || brand.name} &lt;{campaign.fromEmail || brand.fromEmail || 'Not set'}&gt;
                                </span>
                            </div>

                            <div className="cd-summary-item">
                                <button
                                    className="cd-preview-btn"
                                    onClick={() => setShowPreviewModal(true)}
                                >
                                    <Eye size={14} />
                                    <span>View Email Preview</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Stats */}
                {campaign.status !== 'draft' && (
                    <div className="cd-section">
                        <h2 className="cd-section-title">
                            <BarChart2 size={20} />
                            <span>Campaign Performance</span>
                        </h2>

                        {!stats ? (
                            <div className="cd-loading-inline">
                                <div className="cd-spinner-small"></div>
                                <p>Loading statistics...</p>
                            </div>
                        ) : (
                            <div className="cd-stats-cards">
                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon cd-stat-icon-delivered">
                                        <Mail size={18} />
                                    </div>
                                    <div className="cd-stat-content">
                                        <div className="cd-stat-value">{stats.recipients || 0}</div>
                                        <div className="cd-stat-label">Recipients</div>
                                    </div>
                                </div>

                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon cd-stat-icon-opened">
                                        <Mail size={18} />
                                    </div>
                                    <div className="cd-stat-content">
                                        <div className="cd-stat-value">{stats.open?.unique || 0}</div>
                                        <div className="cd-stat-label">Unique Opens</div>
                                        <div className="cd-stat-percent">{stats.openRate || 0}% open rate</div>
                                    </div>
                                </div>

                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon cd-stat-icon-clicked">
                                        <MousePointer size={18} />
                                    </div>
                                    <div className="cd-stat-content">
                                        <div className="cd-stat-value">{stats.click?.unique || 0}</div>
                                        <div className="cd-stat-label">Unique Clicks</div>
                                        <div className="cd-stat-percent">{stats.clickRate || 0}% click rate</div>
                                    </div>
                                </div>

                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon cd-stat-icon-unsubscribed">
                                        <Users size={18} />
                                    </div>
                                    <div className="cd-stat-content">
                                        <div className="cd-stat-value">{stats.unsubscribed?.total || 0}</div>
                                        <div className="cd-stat-label">Unsubscribes</div>
                                    </div>
                                </div>

                                <div className="cd-stat-card">
                                    <div className="cd-stat-icon cd-stat-icon-bounced">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div className="cd-stat-content">
                                        <div className="cd-stat-value">{stats.bounce?.total || 0}</div>
                                        <div className="cd-stat-label">Bounces</div>
                                        <div className="cd-stat-percent">{stats.recipients ? (((stats.bounce?.total || 0) / stats.recipients) * 100).toFixed(1) : 0}% bounce rate</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Events Section */}
                {campaign.status !== 'draft' && (
                    <div className="cd-section">
                        <div className="cd-events-header">
                            <h2 className="cd-section-title">
                                <Clock size={20} />
                                <span>Email Activity</span>
                            </h2>

                            <div className="cd-events-actions">
                                <button
                                    className="cd-btn cd-btn-outline"
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <Filter size={14} />
                                    <span>Filter</span>
                                </button>

                                <button
                                    className="cd-btn cd-btn-outline"
                                    onClick={exportEvents}
                                >
                                    <Download size={14} />
                                    <span>Export</span>
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        {showFilters && (
                            <div className="cd-events-filters">
                                <div className="cd-filter-group">
                                    <label>Event Type</label>
                                    <select
                                        name="eventType"
                                        value={filters.eventType}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="">All Events</option>
                                        <option value="open">Opens</option>
                                        <option value="click">Clicks</option>
                                        <option value="bounce">Bounces</option>
                                        <option value="complaint">Complaints</option>
                                        <option value="delivery">Deliveries</option>
                                    </select>
                                </div>

                                <div className="cd-filter-group">
                                    <label>Email Address</label>
                                    <input
                                        type="text"
                                        name="email"
                                        value={filters.email}
                                        onChange={handleFilterChange}
                                        placeholder="Filter by email"
                                    />
                                </div>

                                <div className="cd-filter-group">
                                    <label>Sort By</label>
                                    <select
                                        name="sort"
                                        value={filters.sort}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="timestamp">Date/Time</option>
                                        <option value="email">Email</option>
                                        <option value="eventType">Event Type</option>
                                    </select>
                                </div>

                                <div className="cd-filter-group">
                                    <label>Order</label>
                                    <select
                                        name="order"
                                        value={filters.order}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="desc">Newest First</option>
                                        <option value="asc">Oldest First</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Events Table */}
                        {eventsLoading ? (
                            <div className="cd-loading-inline">
                                <div className="cd-spinner-small"></div>
                                <p>Loading events...</p>
                            </div>
                        ) : events.length > 0 ? (
                            <div className="cd-card cd-events-card">
                                <div className="cd-events-table-container">
                                    <table className="cd-events-table">
                                        <thead>
                                            <tr>
                                                <th>Event</th>
                                                <th>Email</th>
                                                <th>Date/Time</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {events.map((event, index) => {
                                                const eventInfo = formatEventType(event.eventType || event.type);
                                                return (
                                                    <tr key={event._id || index}>
                                                        <td className="cd-event-type">
                                                            {eventInfo.icon}
                                                            <span>{eventInfo.label}</span>
                                                        </td>
                                                        <td>{event.email}</td>
                                                        <td>
                                                            <span
                                                                className="cd-event-time"
                                                                title={new Date(event.timestamp).toLocaleString()}
                                                            >
                                                                {formatDistance(new Date(event.timestamp), new Date(), { addSuffix: true })}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {(event.eventType === 'click' || event.type === 'click') && (event.metadata?.url || event.url) && (
                                                                <span
                                                                    className="cd-event-url"
                                                                    title={event.metadata?.url || event.url}
                                                                >
                                                                    {event.metadata?.url || event.url}
                                                                </span>
                                                            )}
                                                            {(event.eventType === 'bounce' || event.type === 'bounce') && (
                                                                <span className="cd-event-reason">
                                                                    {event.metadata?.bounceType || event.reason || 'Bounce'}
                                                                    {event.metadata?.diagnosticCode ? ` - ${event.metadata.diagnosticCode}` : ''}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="cd-empty-events">
                                <p>No events have been recorded for this campaign yet.</p>
                            </div>
                        )}

                        {/* Pagination */}
                        {events.length > 0 && pagination.totalPages > 1 && (
                            <div className="cd-pagination">
                                <button
                                    className="cd-pagination-btn"
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                >
                                    <ChevronLeft size={16} />
                                    <span>Previous</span>
                                </button>

                                <div className="cd-pagination-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </div>

                                <button
                                    className="cd-pagination-btn"
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                >
                                    <span>Next</span>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}

                        <GeoStats
                            campaignId={campaignId}
                            brandId={id}
                        />
                    </div>
                )}

                {/* Email Preview Modal */}
                {showPreviewModal && (
                    <div className="cd-modal-overlay">
                        <div className="cd-modal">
                            <div className="cd-modal-header">
                                <h3>Email Preview</h3>
                                <button
                                    className="cd-close-btn"
                                    onClick={() => setShowPreviewModal(false)}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="cd-modal-content">
                                <div className="cd-email-subject">
                                    <span>Subject:</span> {campaign.subject}
                                </div>
                                <div
                                    className="cd-email-preview"
                                    dangerouslySetInnerHTML={{ __html: campaign.content || '<p>No content available.</p>' }}
                                ></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </BrandLayout>
    );
}
