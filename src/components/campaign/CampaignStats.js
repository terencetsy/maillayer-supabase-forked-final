import { useState, useEffect } from 'react';
import { BarChart, Activity, Mail, MousePointer, AlertTriangle, X, Filter, ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatDistance } from 'date-fns';

export default function CampaignStats({ brandId, campaignId }) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState(null);

    // For detailed events list
    const [events, setEvents] = useState([]);
    const [showEvents, setShowEvents] = useState(false);
    const [eventsLoading, setEventsLoading] = useState(false);
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

    const [showFilters, setShowFilters] = useState(false);

    // Fetch summary stats
    useEffect(() => {
        fetchStats();
    }, [brandId, campaignId]);

    // Fetch detailed events when requested
    useEffect(() => {
        if (showEvents) {
            fetchEvents();
        }
    }, [showEvents, pagination.page, filters]);

    const fetchStats = async () => {
        try {
            setIsLoading(true);
            setError('');

            const response = await fetch(`/api/brands/${brandId}/campaigns/${campaignId}/stats`, {
                credentials: 'same-origin',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch campaign stats');
            }

            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching campaign stats:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEvents = async () => {
        try {
            setEventsLoading(true);

            const queryParams = new URLSearchParams({
                events: 'true',
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
            });

            const response = await fetch(`/api/brands/${brandId}/campaigns/${campaignId}/stats?${queryParams}`, {
                credentials: 'same-origin',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch events');
            }

            const data = await response.json();
            setEvents(data.events);
            setPagination((prev) => ({
                ...prev,
                total: data.pagination.total,
                totalPages: data.pagination.totalPages,
            }));
        } catch (error) {
            console.error('Error fetching events:', error);
            setError(error.message || 'An unexpected error occurred');
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
        try {
            // This would generate and download a CSV of events
            // For this example we'll provide a placeholder implementation
            alert('Export functionality would be implemented here');

            // Real implementation would:
            // 1. Make an API call to get all events (with proper pagination)
            // 2. Convert to CSV format
            // 3. Create a download link
            // 4. Trigger download
        } catch (error) {
            console.error('Error exporting events:', error);
            setError(error.message || 'An unexpected error occurred');
        }
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
                            className="event-icon open"
                        />
                    ),
                };
            case 'click':
                return {
                    label: 'Click',
                    icon: (
                        <MousePointer
                            size={14}
                            className="event-icon click"
                        />
                    ),
                };
            case 'bounce':
                return {
                    label: 'Bounce',
                    icon: (
                        <X
                            size={14}
                            className="event-icon bounce"
                        />
                    ),
                };
            case 'complaint':
                return {
                    label: 'Complaint',
                    icon: (
                        <AlertTriangle
                            size={14}
                            className="event-icon complaint"
                        />
                    ),
                };
            case 'delivery':
                return {
                    label: 'Delivery',
                    icon: (
                        <Mail
                            size={14}
                            className="event-icon delivery"
                        />
                    ),
                };
            default:
                return { label: type, icon: null };
        }
    };

    if (isLoading) {
        return (
            <div className="stats-loading">
                <div className="spinner"></div>
                <p>Loading campaign statistics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="stats-error">
                <p>Error loading statistics: {error}</p>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={fetchStats}
                >
                    Try Again
                </button>
            </div>
        );
    }

    // If no stats yet
    if (!stats) {
        return (
            <div className="stats-empty">
                <p>No statistics available for this campaign yet.</p>
            </div>
        );
    }

    return (
        <div className="campaign-stats-container">
            {/* Summary Stats */}
            <div className="stats-summary">
                <div className="stats-header">
                    <h2>Campaign Performance</h2>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon recipients">
                            <Mail size={18} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.recipients || 0}</div>
                            <div className="stat-label">Recipients</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon opens">
                            <Mail size={18} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.open?.unique || 0}</div>
                            <div className="stat-label">Unique Opens</div>
                            <div className="stat-secondary">{stats.openRate || 0}% open rate</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon clicks">
                            <MousePointer size={18} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.click?.unique || 0}</div>
                            <div className="stat-label">Unique Clicks</div>
                            <div className="stat-secondary">{stats.clickRate || 0}% click rate</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon bounces">
                            <X size={18} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.bounce?.total || 0}</div>
                            <div className="stat-label">Bounces</div>
                            <div className="stat-secondary">{stats.recipients ? (((stats.bounce?.total || 0) / stats.recipients) * 100).toFixed(1) : 0}% bounce rate</div>
                        </div>
                    </div>
                </div>

                <div className="view-details-section">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowEvents(!showEvents)}
                    >
                        {showEvents ? 'Hide Details' : 'View Detailed Events'}
                    </button>
                </div>
            </div>

            {/* Detailed Events */}
            {showEvents && (
                <div className="events-section">
                    <div className="events-header">
                        <h3>Detailed Event Log</h3>

                        <div className="events-actions">
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter size={14} />
                                Filter
                            </button>

                            <button
                                className="btn btn-outline btn-sm"
                                onClick={exportEvents}
                            >
                                <Download size={14} />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    {showFilters && (
                        <div className="events-filters">
                            <div className="filter-group">
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

                            <div className="filter-group">
                                <label>Email Address</label>
                                <input
                                    type="text"
                                    name="email"
                                    value={filters.email}
                                    onChange={handleFilterChange}
                                    placeholder="Filter by email"
                                />
                            </div>

                            <div className="filter-group">
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

                            <div className="filter-group">
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
                    <div className="events-table-container">
                        {eventsLoading ? (
                            <div className="events-loading">
                                <div className="spinner-small"></div>
                                <p>Loading events...</p>
                            </div>
                        ) : events.length === 0 ? (
                            <div className="events-empty">
                                <p>No events found matching the current filters.</p>
                            </div>
                        ) : (
                            <>
                                <table className="events-table">
                                    <thead>
                                        <tr>
                                            <th>Event</th>
                                            <th>Email</th>
                                            <th>Date/Time</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map((event) => {
                                            const eventInfo = formatEventType(event.eventType);
                                            return (
                                                <tr key={event._id}>
                                                    <td className="event-type-cell">
                                                        {eventInfo.icon}
                                                        <span>{eventInfo.label}</span>
                                                    </td>
                                                    <td>{event.email}</td>
                                                    <td>
                                                        <span
                                                            className="event-time"
                                                            title={new Date(event.timestamp).toLocaleString()}
                                                        >
                                                            {formatDistance(new Date(event.timestamp), new Date(), { addSuffix: true })}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {event.eventType === 'click' && event.metadata?.url && (
                                                            <span
                                                                className="event-url"
                                                                title={event.metadata.url}
                                                            >
                                                                {event.metadata.url.length > 40 ? `${event.metadata.url.substring(0, 40)}...` : event.metadata.url}
                                                            </span>
                                                        )}
                                                        {event.eventType === 'bounce' && (
                                                            <span className="event-bounce-type">
                                                                {event.metadata?.bounceType} - {event.metadata?.diagnosticCode || 'No diagnostic code'}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Pagination */}
                                {pagination.totalPages > 1 && (
                                    <div className="events-pagination">
                                        <button
                                            className="pagination-btn"
                                            onClick={() => handlePageChange(pagination.page - 1)}
                                            disabled={pagination.page === 1}
                                        >
                                            <ChevronLeft size={16} />
                                            <span>Previous</span>
                                        </button>

                                        <div className="pagination-info">
                                            Page {pagination.page} of {pagination.totalPages}
                                        </div>

                                        <button
                                            className="pagination-btn"
                                            onClick={() => handlePageChange(pagination.page + 1)}
                                            disabled={pagination.page === pagination.totalPages}
                                        >
                                            <span>Next</span>
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Add a section for graphical visualization */}
            {showEvents && stats && (
                <div className="stats-visualization">
                    <div className="visualization-header">
                        <h3>Activity Timeline</h3>
                    </div>

                    <div className="visualization-content">
                        <p className="visualization-placeholder">
                            <Activity size={18} />
                            <span>Visualization of event data would appear here.</span>
                        </p>

                        <div className="stats-legend">
                            <div className="legend-item">
                                <span className="legend-dot opens"></span>
                                <span>Opens</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-dot clicks"></span>
                                <span>Clicks</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-dot bounces"></span>
                                <span>Bounces</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
