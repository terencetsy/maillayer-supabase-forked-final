import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Copy, Code, Eye, Edit, Play, Shield, Send, Mail, AlertCircle, Calendar, MousePointer, X, Filter, Download, ChevronLeft, ChevronRight, Clock, CheckCircle, BarChart2, Users, MailX } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { formatDistance } from 'date-fns';
import APIDocsSection from '@/components/APIDocsSection';
import TemplatePreview from '@/components/TemplatePreview';

export default function TransactionalTemplateDetail() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, templateId } = router.query;

    // States for data
    const [brand, setBrand] = useState(null);
    const [template, setTemplate] = useState(null);
    const [stats, setStats] = useState(null);
    const [dailyStats, setDailyStats] = useState([]);
    const [logs, setLogs] = useState([]);
    const [events, setEvents] = useState([]);
    const [eventDistribution, setEventDistribution] = useState([]);

    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        eventType: '',
        email: '',
        sort: 'timestamp',
        order: 'desc',
    });

    // Pagination
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    // Chart colors
    const COLORS = ['#5d87ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    // Fetch brand details
    const fetchBrandDetails = useCallback(async () => {
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
    }, [id]);

    // Fetch template details
    const fetchTemplateDetails = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Template not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch template details');
                }
            }

            const data = await res.json();
            setTemplate(data);
        } catch (error) {
            console.error('Error fetching template details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [id, templateId]);

    // Fetch template statistics
    const fetchTemplateStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}/stats`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                console.warn('Could not fetch template stats');
                return;
            }

            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching template stats:', error);
        } finally {
            setStatsLoading(false);
        }
    }, [id, templateId]);

    // Fetch daily stats
    const fetchDailyStats = useCallback(async () => {
        try {
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}/stats/daily`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                console.warn('Could not fetch daily stats');
                return;
            }

            const data = await res.json();
            setDailyStats(data.stats || []);
        } catch (error) {
            console.error('Error fetching daily stats:', error);
        }
    }, [id, templateId]);

    // Fetch event logs
    const fetchEventLogs = useCallback(async () => {
        try {
            setEventsLoading(true);

            const queryParams = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...filters,
            });

            const res = await fetch(`/api/brands/${id}/transactional/${templateId}/events?${queryParams}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                console.warn('Could not fetch event logs');
                return;
            }

            const data = await res.json();
            setEvents(data.events || []);
            setPagination((prev) => ({
                ...prev,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 1,
            }));

            // Process event distribution data
            if (data.eventCounts) {
                const distribution = [
                    { name: 'Opens', value: data.eventCounts.open || 0 },
                    { name: 'Clicks', value: data.eventCounts.click || 0 },
                    { name: 'Bounces', value: data.eventCounts.bounce || 0 },
                    { name: 'Complaints', value: data.eventCounts.complaint || 0 },
                ];
                setEventDistribution(distribution);
            }
        } catch (error) {
            console.error('Error fetching event logs:', error);
        } finally {
            setEventsLoading(false);
        }
    }, [id, templateId, pagination.page, pagination.limit, filters]);

    // Fetch transaction logs
    const fetchTransactionLogs = useCallback(async () => {
        try {
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}/logs`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                console.warn('Could not fetch transaction logs');
                return;
            }

            const data = await res.json();
            setLogs(data.logs || []);
        } catch (error) {
            console.error('Error fetching transaction logs:', error);
        }
    }, [id, templateId]);

    // Handle template publishing
    const handlePublish = async () => {
        if (!template) return;

        try {
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}/publish`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to publish template');
            }

            fetchTemplateDetails();
        } catch (error) {
            console.error('Error publishing template:', error);
            setError(error.message);
        }
    };

    // Copy API key to clipboard
    const copyAPIKey = () => {
        if (!template || !template.apiKey) return;

        navigator.clipboard.writeText(template.apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Format date
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

    // Format date for chart
    const formatChartDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Handle filter change
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

    // Handle page change
    const handlePageChange = (newPage) => {
        setPagination((prev) => ({
            ...prev,
            page: newPage,
        }));
    };

    // Format event type for display
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
                        <AlertCircle
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

    // Initialize data fetching
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id && templateId) {
            fetchBrandDetails();
            fetchTemplateDetails();
        }
    }, [status, id, templateId, router, fetchBrandDetails, fetchTemplateDetails]);

    // Fetch additional data when template is loaded
    useEffect(() => {
        if (template && template.status === 'active') {
            fetchTemplateStats();
            fetchDailyStats();
        }
    }, [template, fetchTemplateStats, fetchDailyStats]);

    // Fetch events when tab changes or filters updated
    useEffect(() => {
        if (template && activeTab === 'events') {
            fetchEventLogs();
        }
    }, [template, activeTab, pagination.page, filters, fetchEventLogs]);

    // Fetch logs when tab changes
    useEffect(() => {
        if (template && activeTab === 'logs') {
            fetchTransactionLogs();
        }
    }, [template, activeTab, fetchTransactionLogs]);

    // Show loading state
    if (isLoading || !brand || !template) {
        return (
            <BrandLayout brand={brand}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading template details...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="template-detail-container">
                {/* Header */}
                <div className="cd-header">
                    <Link
                        href={`/brands/${id}/transactional`}
                        className="cd-back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Transactional Templates</span>
                    </Link>

                    <div className="cd-campaign-header">
                        <h1>{template.name}</h1>
                        <div className="cd-campaign-meta">
                            <span className={`cd-status-badge cd-status-${template.status}`}>{template.status === 'draft' ? 'Draft' : template.status === 'active' ? 'Published' : 'Inactive'}</span>
                            {template.status === 'active' && (
                                <div className="template-api-key">
                                    <span>API Key: </span>
                                    <code>{template.apiKey}</code>
                                    <button
                                        onClick={copyAPIKey}
                                        className="copy-btn"
                                        title="Copy API Key"
                                    >
                                        <Copy size={14} />
                                        {copied && <span className="copy-tooltip">Copied!</span>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="template-actions">
                    <Link
                        href={`/brands/${id}/transactional/${templateId}/edit`}
                        className="btn btn-secondary"
                    >
                        <Edit size={16} />
                        <span>Edit Template</span>
                    </Link>

                    {template.status === 'draft' && (
                        <button
                            onClick={handlePublish}
                            className="btn btn-primary"
                        >
                            <Play size={16} />
                            <span>Publish Template</span>
                        </button>
                    )}

                    <button
                        onClick={() => setShowPreviewModal(true)}
                        className="btn btn-outline"
                    >
                        <Eye size={16} />
                        <span>Preview</span>
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="cd-section">
                    <div className="template-tabs">
                        <div className="tabs-navigation">
                            <button
                                className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                <Mail size={16} />
                                <span>Overview</span>
                            </button>
                            <button
                                className={`tab-item ${activeTab === 'analytics' ? 'active' : ''}`}
                                onClick={() => setActiveTab('analytics')}
                            >
                                <BarChart2 size={16} />
                                <span>Analytics</span>
                            </button>
                            <button
                                className={`tab-item ${activeTab === 'events' ? 'active' : ''}`}
                                onClick={() => setActiveTab('events')}
                            >
                                <Clock size={16} />
                                <span>Events</span>
                            </button>
                            <button
                                className={`tab-item ${activeTab === 'api' ? 'active' : ''}`}
                                onClick={() => setActiveTab('api')}
                            >
                                <Code size={16} />
                                <span>API Documentation</span>
                            </button>
                            <button
                                className={`tab-item ${activeTab === 'logs' ? 'active' : ''}`}
                                onClick={() => setActiveTab('logs')}
                            >
                                <Shield size={16} />
                                <span>Logs</span>
                            </button>
                        </div>

                        {/* Tab Contents */}
                        <div className="tab-content">
                            {activeTab === 'overview' && (
                                <div className="overview-tab">
                                    <div className="cd-summary-card">
                                        <div className="cd-card-header">
                                            <Mail size={18} />
                                            <h3>Template Details</h3>
                                        </div>
                                        <div className="cd-card-content">
                                            <div className="cd-summary-grid">
                                                <div className="cd-summary-item">
                                                    <span className="cd-summary-label">Subject</span>
                                                    <span className="cd-summary-value">{template.subject}</span>
                                                </div>

                                                <div className="cd-summary-item">
                                                    <span className="cd-summary-label">
                                                        <Calendar size={14} />
                                                        Created
                                                    </span>
                                                    <span className="cd-summary-value">{formatDate(template.createdAt)}</span>
                                                </div>

                                                <div className="cd-summary-item">
                                                    <span className="cd-summary-label">From</span>
                                                    <span className="cd-summary-value">
                                                        {template.fromName || brand.fromName} &lt;{template.fromEmail || brand.fromEmail}&gt;
                                                    </span>
                                                </div>

                                                <div className="cd-summary-item">
                                                    <span className="cd-summary-label">Description</span>
                                                    <span className="cd-summary-value">{template.description || 'No description provided'}</span>
                                                </div>

                                                <div className="cd-summary-item">
                                                    <span className="cd-summary-label">Variables</span>
                                                    <div className="variables-list">
                                                        {template.variables && template.variables.length > 0 ? (
                                                            template.variables.map((variable, index) => (
                                                                <span
                                                                    key={index}
                                                                    className={`variable-tag ${variable.required ? 'required' : ''}`}
                                                                >
                                                                    {variable.name} {variable.required && <span className="required-badge">Required</span>}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted">No variables defined</span>
                                                        )}
                                                    </div>
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

                                    {template.status === 'active' && (
                                        <div className="cd-section">
                                            <h2 className="cd-section-title">
                                                <BarChart2 size={20} />
                                                <span>Template Performance</span>
                                            </h2>

                                            {statsLoading ? (
                                                <div className="cd-loading-inline">
                                                    <div className="cd-spinner-small"></div>
                                                    <p>Loading statistics...</p>
                                                </div>
                                            ) : (
                                                <div className="cd-stats-cards">
                                                    <div className="cd-stat-card">
                                                        <div className="cd-stat-icon cd-stat-icon-delivered">
                                                            <Send size={18} />
                                                        </div>
                                                        <div className="cd-stat-content">
                                                            <div className="cd-stat-value">{stats?.sent?.toLocaleString() || 0}</div>
                                                            <div className="cd-stat-label">Total Sent</div>
                                                        </div>
                                                    </div>

                                                    <div className="cd-stat-card">
                                                        <div className="cd-stat-icon cd-stat-icon-opened">
                                                            <Mail size={18} />
                                                        </div>
                                                        <div className="cd-stat-content">
                                                            <div className="cd-stat-value">{stats?.opens?.toLocaleString() || 0}</div>
                                                            <div className="cd-stat-label">Opens</div>
                                                            <div className="cd-stat-percent">{stats?.openRate || 0}% open rate</div>
                                                        </div>
                                                    </div>

                                                    <div className="cd-stat-card">
                                                        <div className="cd-stat-icon cd-stat-icon-clicked">
                                                            <MousePointer size={18} />
                                                        </div>
                                                        <div className="cd-stat-content">
                                                            <div className="cd-stat-value">{stats?.clicks?.toLocaleString() || 0}</div>
                                                            <div className="cd-stat-label">Clicks</div>
                                                            <div className="cd-stat-percent">{stats?.clickRate || 0}% click rate</div>
                                                        </div>
                                                    </div>

                                                    <div className="cd-stat-card">
                                                        <div className="cd-stat-icon cd-stat-icon-bounced">
                                                            <AlertCircle size={18} />
                                                        </div>
                                                        <div className="cd-stat-content">
                                                            <div className="cd-stat-value">{stats?.bounces || 0}</div>
                                                            <div className="cd-stat-label">Bounces</div>
                                                            <div className="cd-stat-percent">{stats?.sent ? ((stats.bounces / stats.sent) * 100).toFixed(1) : 0}% bounce rate</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'analytics' && (
                                <div className="analytics-tab">
                                    <div className="cd-section">
                                        <h2 className="cd-section-title">
                                            <BarChart2 size={20} />
                                            <span>Email Performance Analytics</span>
                                        </h2>

                                        {statsLoading ? (
                                            <div className="cd-loading-inline">
                                                <div className="cd-spinner-small"></div>
                                                <p>Loading analytics data...</p>
                                            </div>
                                        ) : dailyStats.length === 0 ? (
                                            <div className="cd-empty-events">
                                                <p>No data available for analytics. Try sending emails with this template first.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="cd-section">
                                                    <div className="cd-card">
                                                        <div className="cd-card-header">
                                                            <h3>Daily Email Activity</h3>
                                                        </div>
                                                        <div className="cd-card-content">
                                                            <div style={{ width: '100%', height: 350 }}>
                                                                <ResponsiveContainer>
                                                                    <BarChart
                                                                        data={dailyStats.map((item) => ({
                                                                            ...item,
                                                                            formattedDate: formatChartDate(item.date),
                                                                        }))}
                                                                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                                                    >
                                                                        <CartesianGrid strokeDasharray="3 3" />
                                                                        <XAxis
                                                                            dataKey="formattedDate"
                                                                            angle={-45}
                                                                            textAnchor="end"
                                                                            height={70}
                                                                        />
                                                                        <YAxis />
                                                                        <Tooltip />
                                                                        <Legend />
                                                                        <Bar
                                                                            dataKey="sent"
                                                                            name="Sent"
                                                                            fill="#5d87ff"
                                                                        />
                                                                        <Bar
                                                                            dataKey="opens"
                                                                            name="Opened"
                                                                            fill="#10b981"
                                                                        />
                                                                        <Bar
                                                                            dataKey="clicks"
                                                                            name="Clicked"
                                                                            fill="#f59e0b"
                                                                        />
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="cd-section">
                                                    <div className="cd-card">
                                                        <div className="cd-card-header">
                                                            <h3>Event Distribution</h3>
                                                        </div>
                                                        <div
                                                            className="cd-card-content"
                                                            style={{ display: 'flex', justifyContent: 'center' }}
                                                        >
                                                            {eventDistribution.length > 0 ? (
                                                                <div style={{ width: '100%', height: 350, maxWidth: 500 }}>
                                                                    <ResponsiveContainer>
                                                                        <PieChart>
                                                                            <Pie
                                                                                data={eventDistribution}
                                                                                cx="50%"
                                                                                cy="50%"
                                                                                labelLine={true}
                                                                                outerRadius={120}
                                                                                fill="#8884d8"
                                                                                dataKey="value"
                                                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                                                                            >
                                                                                {eventDistribution.map((entry, index) => (
                                                                                    <Cell
                                                                                        key={`cell-${index}`}
                                                                                        fill={COLORS[index % COLORS.length]}
                                                                                    />
                                                                                ))}
                                                                            </Pie>
                                                                            <Tooltip formatter={(value) => [value, 'Events']} />
                                                                        </PieChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            ) : (
                                                                <div className="cd-empty-events">
                                                                    <p>No event distribution data available.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'events' && (
                                <div className="events-tab">
                                    <div className="cd-events-header">
                                        <h2 className="cd-section-title">
                                            <Clock size={20} />
                                            <span>Email Events</span>
                                        </h2>

                                        <div className="cd-events-actions">
                                            <button
                                                className="cd-btn cd-btn-outline"
                                                onClick={() => setShowFilters(!showFilters)}
                                            >
                                                <Filter size={14} />
                                                <span>Filter</span>
                                            </button>

                                            <button className="cd-btn cd-btn-outline">
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
                                                    <option value="type">Event Type</option>
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
                                                            const eventInfo = formatEventType(event.type);
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
                                                                            title={formatDate(event.timestamp)}
                                                                        >
                                                                            {formatDistance(new Date(event.timestamp), new Date(), { addSuffix: true })}
                                                                        </span>
                                                                    </td>
                                                                    <td>
                                                                        {event.type === 'click' && event.metadata?.url && (
                                                                            <span
                                                                                className="cd-event-url"
                                                                                title={event.metadata.url}
                                                                            >
                                                                                {event.metadata.url}
                                                                            </span>
                                                                        )}
                                                                        {event.type === 'bounce' && (
                                                                            <span className="cd-event-reason">
                                                                                {event.metadata?.bounceType || 'Bounce'}
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
                                            <p>No events have been recorded for this template yet.</p>
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
                                </div>
                            )}

                            {activeTab === 'api' && (
                                <div className="api-tab">
                                    <APIDocsSection
                                        template={template}
                                        brand={brand}
                                    />
                                </div>
                            )}

                            {activeTab === 'logs' && (
                                <div className="logs-tab">
                                    <div className="cd-events-header">
                                        <h2 className="cd-section-title">
                                            <Shield size={20} />
                                            <span>Transaction Logs</span>
                                        </h2>
                                    </div>

                                    {logs.length > 0 ? (
                                        <div className="cd-card">
                                            <div className="cd-events-table-container">
                                                <table className="cd-events-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Status</th>
                                                            <th>Recipient</th>
                                                            <th>Sent At</th>
                                                            <th>Events</th>
                                                            <th>IP Address</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {logs.map((log) => (
                                                            <tr key={log._id}>
                                                                <td>
                                                                    <span className={`cd-status-badge cd-status-${log.status}`}>{log.status}</span>
                                                                </td>
                                                                <td>{log.to}</td>
                                                                <td>{formatDate(log.sentAt)}</td>
                                                                <td>
                                                                    {log.events && log.events.length > 0 ? (
                                                                        <div className="event-indicators">
                                                                            {log.events.map((event, i) => {
                                                                                const eventInfo = formatEventType(event.type);
                                                                                return (
                                                                                    <span
                                                                                        key={i}
                                                                                        title={`${eventInfo.label} - ${formatDate(event.timestamp)}`}
                                                                                        style={{ marginRight: '5px' }}
                                                                                    >
                                                                                        {eventInfo.icon}
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted">No events</span>
                                                                    )}
                                                                </td>
                                                                <td>{log.ipAddress || <span className="text-muted">N/A</span>}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="cd-empty-events">
                                            <p>No transaction logs available for this template.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Modal */}
                {showPreviewModal && (
                    <div
                        className="modal-overlay"
                        onClick={() => setShowPreviewModal(false)}
                    >
                        <div
                            className="modal-container"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>Email Preview</h2>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowPreviewModal(false)}
                                >
                                    <span>&times;</span>
                                </button>
                            </div>
                            <TemplatePreview template={template} />
                        </div>
                    </div>
                )}
            </div>
        </BrandLayout>
    );
}
