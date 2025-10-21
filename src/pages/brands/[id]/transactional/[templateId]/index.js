import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Play, MousePointer, BarChart2, MailX } from 'lucide-react';
import { formatDistance } from 'date-fns';
import TemplatePreview from '@/components/TemplatePreview';
import { AlertCircle, CheckmarkCircle02, Clock01, Code, Copy01, Edit01, Eye, Mail02, Message01, MouseLeftClick04, Sent02, Shield02 } from '@/lib/icons';

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

    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [copied, setCopied] = useState(false);

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
                        <Mail02
                            size={14}
                            className="event-icon event-icon-open"
                        />
                    ),
                };
            case 'click':
                return {
                    label: 'Click',
                    icon: (
                        <MousePointer
                            size={14}
                            className="event-icon event-icon-click"
                        />
                    ),
                };
            case 'bounce':
                return {
                    label: 'Bounce',
                    icon: (
                        <MailX
                            size={14}
                            className="event-icon event-icon-bounce"
                        />
                    ),
                };
            case 'complaint':
                return {
                    label: 'Complaint',
                    icon: (
                        <AlertCircle
                            size={14}
                            className="event-icon event-icon-complaint"
                        />
                    ),
                };
            case 'delivery':
                return {
                    label: 'Delivery',
                    icon: (
                        <Mail02
                            size={14}
                            className="event-icon event-icon-delivery"
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
        if (template) {
            fetchTemplateStats();
            fetchDailyStats();
            fetchTransactionLogs();
        }
    }, [template, fetchTemplateStats, fetchDailyStats, fetchTransactionLogs]);

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
                <div className="detail-header">
                    <Link
                        href={`/brands/${id}/transactional`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Transactional Templates</span>
                    </Link>

                    <div className="template-header">
                        <div className="template-header-content">
                            <h1>{template.name}</h1>
                            <div className="template-meta">
                                <div className="subject-line">
                                    <span className="subject-label">Subject:</span>
                                    <span className="subject-value">{template.subject}</span>
                                </div>

                                <div className={`status-badge ${template.status}`}>
                                    {template.status === 'active' && <CheckmarkCircle02 size={14} />}
                                    {template.status === 'draft' && <Clock01 size={14} />}
                                    {template.status === 'inactive' && <AlertCircle size={14} />}
                                    {template.status === 'active' ? 'Active' : template.status === 'draft' ? 'Draft' : 'Inactive'}
                                </div>

                                {template.status === 'active' && (
                                    <div className="template-api-key">
                                        <span className="key-label">API Key:</span>
                                        <code>{template.apiKey}</code>
                                        <button
                                            onClick={copyAPIKey}
                                            className="copy-btn"
                                            title="Copy API Key"
                                        >
                                            {copied ? <CheckmarkCircle02 size={14} /> : <Copy01 size={14} />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="template-actions">
                    <Link
                        href={`/brands/${id}/transactional/${templateId}/edit`}
                        className="button button--secondary"
                    >
                        <Edit01 size={16} />
                        <span>Edit Template</span>
                    </Link>

                    <Link
                        href={`/brands/${id}/transactional/${templateId}/editor`}
                        className="button button--secondary"
                    >
                        <Edit01 size={16} />
                        <span>Edit Content</span>
                    </Link>

                    {template.status === 'draft' && (
                        <button
                            onClick={handlePublish}
                            className="button button--primary"
                        >
                            <Play size={16} />
                            <span>Publish Template</span>
                        </button>
                    )}

                    <Link
                        href={`/brands/${id}/transactional/${templateId}/api`}
                        className="button button--secondary"
                    >
                        <Code size={16} />
                        <span>API Docs</span>
                    </Link>

                    <button
                        onClick={() => setShowPreviewModal(true)}
                        className="button button--secondary"
                    >
                        <Eye size={16} />
                        <span>Preview</span>
                    </button>
                </div>

                {/* Template Details Section */}
                <div className="detail-section template-details-section">
                    <div className="section-header">
                        <h2>
                            <Message01 size={18} />
                            <span>Template Details</span>
                        </h2>
                    </div>

                    <div className="detail-card">
                        <div className="detail-grid">
                            <div className="detail-item">
                                <div className="detail-label">Created</div>
                                <div className="detail-value">{formatDate(template.createdAt)}</div>
                            </div>

                            <div className="detail-item">
                                <div className="detail-label">Last Updated</div>
                                <div className="detail-value">{formatDate(template.updatedAt)}</div>
                            </div>

                            <div className="detail-item">
                                <div className="detail-label">From</div>
                                <div className="detail-value">
                                    {template.fromName || brand.fromName} &lt;{template.fromEmail || brand.fromEmail}&gt;
                                </div>
                            </div>

                            {template.replyTo && (
                                <div className="detail-item">
                                    <div className="detail-label">Reply To</div>
                                    <div className="detail-value">{template.replyTo}</div>
                                </div>
                            )}
                        </div>

                        {template.variables && template.variables.length > 0 && (
                            <div className="template-variables">
                                <div className="variables-header">
                                    <h3>Variables</h3>
                                </div>
                                <div className="variables-list">
                                    {template.variables.map((variable, index) => (
                                        <div
                                            key={index}
                                            className={`variable-tag ${variable.required ? 'required' : ''}`}
                                        >
                                            <span className="variable-name">[{variable.name}]</span>
                                            {variable.required && <span className="required-badge">Required</span>}
                                            {variable.description && (
                                                <span
                                                    className="variable-description"
                                                    title={variable.description}
                                                >
                                                    {variable.description}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="detail-section stats-summary-section">
                    <div className="section-header">
                        <h2>
                            <BarChart2 size={18} />
                            <span>Email Performance</span>
                        </h2>
                    </div>

                    {statsLoading ? (
                        <div className="loading-inline">
                            <div className="spinner-small"></div>
                            <p>Loading statistics...</p>
                        </div>
                    ) : (
                        <div className="stats-cards">
                            <div className="stat-card">
                                <div className="stat-icon stat-icon-sent">
                                    <Sent02 size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{stats?.sent?.toLocaleString() || 0}</div>
                                    <div className="stat-label">Total Sent</div>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon stat-icon-opened">
                                    <Mail02 size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{stats?.opens?.toLocaleString() || 0}</div>
                                    <div className="stat-label">Opens</div>
                                    <div className="stat-percent">{stats?.openRate || 0}% open rate</div>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon stat-icon-clicked">
                                    <MouseLeftClick04 size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{stats?.clicks?.toLocaleString() || 0}</div>
                                    <div className="stat-label">Clicks</div>
                                    <div className="stat-percent">{stats?.clickRate || 0}% click rate</div>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon stat-icon-bounced">
                                    <AlertCircle size={18} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{stats?.bounces || 0}</div>
                                    <div className="stat-label">Bounces</div>
                                    <div className="stat-percent">{stats?.sent ? ((stats.bounces / stats.sent) * 100).toFixed(1) : 0}% bounce rate</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Daily Activity Chart */}
                {/* <div className="detail-section daily-activity-section">
                    <div className="section-header">
                        <h2>
                            <BarChart2 size={18} />
                            <span>Daily Email Activity</span>
                        </h2>
                    </div>

                    <div className="chart-container">
                        {statsLoading ? (
                            <div className="loading-inline">
                                <div className="spinner-small"></div>
                                <p>Loading chart data...</p>
                            </div>
                        ) : dailyStats.length === 0 ? (
                            <div className="empty-state">
                                <p>No data available for analytics. Try sending emails with this template first.</p>
                            </div>
                        ) : (
                            <div className="chart-wrapper">
                                <ResponsiveContainer
                                    width="100%"
                                    height={350}
                                >
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
                        )}
                    </div>
                </div> */}

                {/* Latest Transactional Logs */}
                <div className="detail-section transaction-logs-section">
                    <div className="section-header logs-header">
                        <h2>
                            <Shield02 size={18} />
                            <span>Recent Email Logs</span>
                        </h2>
                        <Link
                            href={`/brands/${id}/transactional/${templateId}/logs`}
                            className="view-all-link"
                        >
                            View All Logs
                        </Link>
                    </div>

                    {logs.length > 0 ? (
                        <div className="logs-table-container">
                            <table className="logs-table">
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
                                    {logs.slice(0, 5).map((log) => (
                                        <tr key={log._id}>
                                            <td>
                                                <span className={`status-badge status-${log.status}`}>{log.status}</span>
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
                                                                    className="event-indicator"
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
                                            <td>{log.metadata?.ipAddress || <span className="text-muted">N/A</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No transaction logs available for this template.</p>
                        </div>
                    )}
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
