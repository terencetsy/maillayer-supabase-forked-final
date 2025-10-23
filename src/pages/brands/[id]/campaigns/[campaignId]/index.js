import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Mail, MousePointer, AlertTriangle, Filter, Download, MailX, Users, Eye, X, Clock, Calendar, Send, Globe, MapPin, Smartphone, Monitor, Tablet, Server, ChevronDown } from 'lucide-react';
import { formatDistance } from 'date-fns';
import GeoBarChart from '@/components/campaign/GeoBarChart';

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

    // Geographic & Device Insights
    const [geoData, setGeoData] = useState({
        countries: [],
        cities: [],
        devices: [],
        browsers: [],
        operatingSystems: [],
        totalEvents: 0,
        appliedFilter: null,
    });
    const [activeGeoTab, setActiveGeoTab] = useState('location');
    const [mapView, setMapView] = useState('countries');
    const [geoLoading, setGeoLoading] = useState(true);
    const [eventTypeFilter, setEventTypeFilter] = useState('open');
    const [showGeoFilters, setShowGeoFilters] = useState(false);

    // Event types for filtering
    const eventTypes = [
        { value: '', label: 'All Events' },
        { value: 'open', label: 'Opens' },
        { value: 'click', label: 'Clicks' },
        { value: 'delivery', label: 'Deliveries' },
        { value: 'bounce', label: 'Bounces' },
        { value: 'complaint', label: 'Complaints' },
        { value: 'unsubscribe', label: 'Unsubscribes' },
    ];

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
            fetchGeoStats();
        }
    }, [campaign]);

    useEffect(() => {
        if (campaign && campaign.status !== 'draft') {
            fetchCampaignEvents();
        }
    }, [pagination.page, filters]);

    useEffect(() => {
        if (campaign && campaign.status !== 'draft') {
            fetchGeoStats();
        }
    }, [eventTypeFilter]);

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

    const fetchGeoStats = async () => {
        try {
            setGeoLoading(true);

            // Using the correct API route from the original GeoStats component
            let url = `/api/brands/${id}/campaigns/${campaignId}/geostats`;
            if (eventTypeFilter) {
                url += `?eventType=${eventTypeFilter}`;
            }

            const response = await fetch(url, {
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch geo statistics');
            }

            const data = await response.json();
            setGeoData(data);
        } catch (error) {
            console.error('Error fetching geo statistics:', error);
        } finally {
            setGeoLoading(false);
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
        alert('Export functionality would be implemented here');
    };

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

    const formatEventType = (type) => {
        const iconProps = { size: 14 };

        switch (type) {
            case 'open':
                return {
                    label: 'Open',
                    icon: <Mail {...iconProps} />,
                    color: '#16a34a',
                };
            case 'click':
                return {
                    label: 'Click',
                    icon: <MousePointer {...iconProps} />,
                    color: '#2563eb',
                };
            case 'bounce':
                return {
                    label: 'Bounce',
                    icon: <X {...iconProps} />,
                    color: '#dc2626',
                };
            case 'complaint':
                return {
                    label: 'Complaint',
                    icon: <AlertTriangle {...iconProps} />,
                    color: '#d97706',
                };
            case 'delivery':
                return {
                    label: 'Delivery',
                    icon: <Mail {...iconProps} />,
                    color: '#059669',
                };
            case 'unsubscribe':
                return {
                    label: 'Unsubscribe',
                    icon: <MailX {...iconProps} />,
                    color: '#dc2626',
                };
            default:
                return { label: type, icon: null, color: '#666' };
        }
    };

    // Transform geo data for ContactsBarChart
    const getChartData = () => {
        if (activeGeoTab === 'location') {
            const data = mapView === 'countries' ? geoData.countries : geoData.cities;
            return data.slice(0, 15).map((item) => ({
                date: item.name,
                value: item.value,
            }));
        } else if (activeGeoTab === 'devices') {
            return geoData.devices.map((item) => ({
                date: item.name,
                value: item.value,
            }));
        } else if (activeGeoTab === 'browsers') {
            return geoData.browsers.slice(0, 15).map((item) => ({
                date: item.name,
                value: item.value,
            }));
        } else if (activeGeoTab === 'os') {
            return geoData.operatingSystems.slice(0, 15).map((item) => ({
                date: item.name,
                value: item.value,
            }));
        }
        return [];
    };

    const getChartTitle = () => {
        if (activeGeoTab === 'location') {
            return mapView === 'countries' ? 'Top Countries' : 'Top Cities';
        } else if (activeGeoTab === 'devices') {
            return 'Device Types';
        } else if (activeGeoTab === 'browsers') {
            return 'Browser Types';
        } else if (activeGeoTab === 'os') {
            return 'Operating Systems';
        }
        return 'Data';
    };

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

    if (error) {
        return (
            <BrandLayout brand={brand}>
                <div
                    className="alert alert--error"
                    style={{ margin: '2rem' }}
                >
                    <span>{error}</span>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Navigation */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <Link
                        href={`/brands/${id}/campaigns`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#666', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem' }}
                    >
                        <ArrowLeft size={16} />
                        <span>Back to campaigns</span>
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '500', color: '#1a1a1a' }}>{campaign.name}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span className={`status-badge status-${campaign.status}`}>{campaign.status === 'draft' ? 'Draft' : campaign.status === 'sending' ? 'Sending' : campaign.status === 'sent' ? 'Sent' : campaign.status === 'scheduled' ? 'Scheduled' : campaign.status}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Campaign Overview Card */}
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f5f5f5' }}>
                        <Mail size={18} />
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '500', color: '#1a1a1a' }}>Campaign Overview</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject</span>
                            <span style={{ fontSize: '0.9375rem', color: '#1a1a1a' }}>{campaign.subject}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Calendar size={14} />
                                Created
                            </span>
                            <span style={{ fontSize: '0.9375rem', color: '#1a1a1a' }}>{formatDate(campaign.createdAt)}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Send size={14} />
                                Sent
                            </span>
                            <span style={{ fontSize: '0.9375rem', color: '#1a1a1a' }}>{formatDate(campaign.sentAt) || 'Not sent yet'}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Users size={14} />
                                Recipients
                            </span>
                            <span style={{ fontSize: '0.9375rem', color: '#1a1a1a' }}>{campaign.stats?.recipients || 0} contacts</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</span>
                            <span style={{ fontSize: '0.9375rem', color: '#1a1a1a' }}>
                                {campaign.fromName || brand.name} &lt;{campaign.fromEmail || brand.fromEmail || 'Not set'}&gt;
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                                className="button button--secondary button--small"
                                onClick={() => setShowPreviewModal(true)}
                            >
                                <Eye size={14} />
                                <span>Preview Email</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Performance Stats */}
                {campaign.status !== 'draft' && (
                    <>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500', color: '#1a1a1a' }}>Campaign Performance</h2>

                            {!stats ? (
                                <div className="loading-section">
                                    <div className="spinner"></div>
                                    <p>Loading statistics...</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', flexShrink: 0 }}>
                                            <Mail size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a1a1a', lineHeight: 1, marginBottom: '0.25rem' }}>{stats.recipients || 0}</div>
                                            <div style={{ fontSize: '0.8125rem', color: '#666' }}>Recipients</div>
                                        </div>
                                    </div>

                                    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', flexShrink: 0 }}>
                                            <Mail size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a1a1a', lineHeight: 1, marginBottom: '0.25rem' }}>{stats.open?.unique || 0}</div>
                                            <div style={{ fontSize: '0.8125rem', color: '#666' }}>Unique Opens</div>
                                            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>{stats.openRate || 0}% open rate</div>
                                        </div>
                                    </div>

                                    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '0.5rem', background: 'rgba(251, 191, 36, 0.1)', color: '#d97706', flexShrink: 0 }}>
                                            <MousePointer size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a1a1a', lineHeight: 1, marginBottom: '0.25rem' }}>{stats.click?.unique || 0}</div>
                                            <div style={{ fontSize: '0.8125rem', color: '#666' }}>Unique Clicks</div>
                                            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>{stats.clickRate || 0}% click rate</div>
                                        </div>
                                    </div>

                                    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '0.5rem', background: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', flexShrink: 0 }}>
                                            <Users size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a1a1a', lineHeight: 1, marginBottom: '0.25rem' }}>{stats.unsubscribed?.total || 0}</div>
                                            <div style={{ fontSize: '0.8125rem', color: '#666' }}>Unsubscribes</div>
                                        </div>
                                    </div>

                                    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', flexShrink: 0 }}>
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a1a1a', lineHeight: 1, marginBottom: '0.25rem' }}>{stats.bounce?.total || 0}</div>
                                            <div style={{ fontSize: '0.8125rem', color: '#666' }}>Bounces</div>
                                            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>{stats.recipients ? (((stats.bounce?.total || 0) / stats.recipients) * 100).toFixed(1) : 0}% bounce rate</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Geographic & Device Insights */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: 0, fontSize: '1.125rem', fontWeight: '500', color: '#1a1a1a' }}>
                                    <Globe size={20} />
                                    Geographic & Device Insights
                                </h2>

                                <button
                                    className="button button--secondary button--small"
                                    onClick={() => setShowGeoFilters(!showGeoFilters)}
                                >
                                    <Filter size={14} />
                                    <span>Filter</span>
                                    <ChevronDown
                                        size={14}
                                        style={{ transform: showGeoFilters ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                    />
                                </button>
                            </div>

                            {showGeoFilters && (
                                <div style={{ padding: '1rem', background: '#fafafa', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div style={{ flex: '1 1 200px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#666', marginBottom: '0.5rem' }}>Event Type</label>
                                            <select
                                                value={eventTypeFilter}
                                                onChange={(e) => setEventTypeFilter(e.target.value)}
                                                className="form-select"
                                            >
                                                {eventTypes.map((type) => (
                                                    <option
                                                        key={type.value}
                                                        value={type.value}
                                                    >
                                                        {type.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {eventTypeFilter && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#fff', borderRadius: '0.375rem', border: '1px solid #e5e5e5' }}>
                                                <span style={{ fontSize: '0.75rem', color: '#666' }}>Active:</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#1a1a1a' }}>{eventTypes.find((t) => t.value === eventTypeFilter)?.label}</span>
                                                <button
                                                    onClick={() => setEventTypeFilter('')}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', color: '#666', fontSize: '1.25rem', lineHeight: 1 }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', borderBottom: '1px solid #f0f0f0' }}>
                                <button
                                    onClick={() => setActiveGeoTab('location')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1rem',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: activeGeoTab === 'location' ? '2px solid #1a1a1a' : '2px solid transparent',
                                        fontSize: '0.875rem',
                                        color: activeGeoTab === 'location' ? '#1a1a1a' : '#666',
                                        fontWeight: activeGeoTab === 'location' ? '500' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Globe size={16} />
                                    <span>Location</span>
                                </button>
                                <button
                                    onClick={() => setActiveGeoTab('devices')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1rem',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: activeGeoTab === 'devices' ? '2px solid #1a1a1a' : '2px solid transparent',
                                        fontSize: '0.875rem',
                                        color: activeGeoTab === 'devices' ? '#1a1a1a' : '#666',
                                        fontWeight: activeGeoTab === 'devices' ? '500' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Smartphone size={16} />
                                    <span>Devices</span>
                                </button>
                                <button
                                    onClick={() => setActiveGeoTab('browsers')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1rem',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: activeGeoTab === 'browsers' ? '2px solid #1a1a1a' : '2px solid transparent',
                                        fontSize: '0.875rem',
                                        color: activeGeoTab === 'browsers' ? '#1a1a1a' : '#666',
                                        fontWeight: activeGeoTab === 'browsers' ? '500' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Globe size={16} />
                                    <span>Browsers</span>
                                </button>
                                <button
                                    onClick={() => setActiveGeoTab('os')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1rem',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: activeGeoTab === 'os' ? '2px solid #1a1a1a' : '2px solid transparent',
                                        fontSize: '0.875rem',
                                        color: activeGeoTab === 'os' ? '#1a1a1a' : '#666',
                                        fontWeight: activeGeoTab === 'os' ? '500' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Server size={16} />
                                    <span>OS</span>
                                </button>
                            </div>

                            {/* Location Tab - Toggle between Countries/Cities */}
                            {activeGeoTab === 'location' && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <button
                                        onClick={() => setMapView('countries')}
                                        className={`button button--small ${mapView === 'countries' ? 'button--primary' : 'button--secondary'}`}
                                    >
                                        <Globe size={14} />
                                        <span>Countries</span>
                                    </button>
                                    <button
                                        onClick={() => setMapView('cities')}
                                        className={`button button--small ${mapView === 'cities' ? 'button--primary' : 'button--secondary'}`}
                                    >
                                        <MapPin size={14} />
                                        <span>Cities</span>
                                    </button>
                                </div>
                            )}

                            {/* Chart */}
                            {geoLoading ? (
                                <div className="loading-section">
                                    <div className="spinner"></div>
                                    <p>Loading geographic insights...</p>
                                </div>
                            ) : geoData.totalEvents === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', textAlign: 'center' }}>
                                    <Globe
                                        size={24}
                                        style={{ color: '#999', marginBottom: '1rem' }}
                                    />
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>No location data available{eventTypeFilter ? ` for ${eventTypeFilter} events` : ''}</p>
                                    {eventTypeFilter && (
                                        <button
                                            className="button button--secondary button--small"
                                            onClick={() => setEventTypeFilter('')}
                                            style={{ marginTop: '1rem' }}
                                        >
                                            Clear filter
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <GeoBarChart
                                    data={getChartData()}
                                    title={getChartTitle()}
                                    totalLabel="events"
                                    type={activeGeoTab === 'location' ? (mapView === 'countries' ? 'countries' : 'cities') : activeGeoTab}
                                />
                            )}
                        </div>

                        {/* Events Section */}
                        <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: 0, fontSize: '1.125rem', fontWeight: '500', color: '#1a1a1a' }}>
                                    <Clock size={20} />
                                    Email Activity
                                </h2>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="button button--secondary button--small"
                                        onClick={() => setShowFilters(!showFilters)}
                                    >
                                        <Filter size={14} />
                                        <span>Filter</span>
                                    </button>

                                    <button
                                        className="button button--secondary button--small"
                                        onClick={exportEvents}
                                    >
                                        <Download size={14} />
                                        <span>Export</span>
                                    </button>
                                </div>
                            </div>

                            {/* Filters */}
                            {showFilters && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem', background: '#fafafa', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#666', marginBottom: '0.5rem' }}>Event Type</label>
                                        <select
                                            name="eventType"
                                            value={filters.eventType}
                                            onChange={handleFilterChange}
                                            className="form-select"
                                        >
                                            <option value="">All Events</option>
                                            <option value="open">Opens</option>
                                            <option value="click">Clicks</option>
                                            <option value="bounce">Bounces</option>
                                            <option value="complaint">Complaints</option>
                                            <option value="delivery">Deliveries</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#666', marginBottom: '0.5rem' }}>Email Address</label>
                                        <input
                                            type="text"
                                            name="email"
                                            value={filters.email}
                                            onChange={handleFilterChange}
                                            placeholder="Filter by email"
                                            className="form-input"
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#666', marginBottom: '0.5rem' }}>Sort By</label>
                                        <select
                                            name="sort"
                                            value={filters.sort}
                                            onChange={handleFilterChange}
                                            className="form-select"
                                        >
                                            <option value="timestamp">Date/Time</option>
                                            <option value="email">Email</option>
                                            <option value="eventType">Event Type</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#666', marginBottom: '0.5rem' }}>Order</label>
                                        <select
                                            name="order"
                                            value={filters.order}
                                            onChange={handleFilterChange}
                                            className="form-select"
                                        >
                                            <option value="desc">Newest First</option>
                                            <option value="asc">Oldest First</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Events Table */}
                            {eventsLoading ? (
                                <div className="loading-section">
                                    <div className="spinner"></div>
                                    <p>Loading events...</p>
                                </div>
                            ) : events.length > 0 ? (
                                <>
                                    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', overflow: 'hidden' }}>
                                        <table className="campaigns-table">
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
                                                            <td>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <span style={{ color: eventInfo.color }}>{eventInfo.icon}</span>
                                                                    <span>{eventInfo.label}</span>
                                                                </div>
                                                            </td>
                                                            <td>{event.email}</td>
                                                            <td>
                                                                <span title={new Date(event.timestamp).toLocaleString()}>{formatDistance(new Date(event.timestamp), new Date(), { addSuffix: true })}</span>
                                                            </td>
                                                            <td>
                                                                {(event.eventType === 'click' || event.type === 'click') && (event.metadata?.url || event.url) && (
                                                                    <span
                                                                        style={{ fontSize: '0.8125rem', color: '#666' }}
                                                                        title={event.metadata?.url || event.url}
                                                                    >
                                                                        {(event.metadata?.url || event.url).length > 50 ? `${(event.metadata?.url || event.url).substring(0, 50)}...` : event.metadata?.url || event.url}
                                                                    </span>
                                                                )}
                                                                {(event.eventType === 'bounce' || event.type === 'bounce') && (
                                                                    <span style={{ fontSize: '0.8125rem', color: '#666' }}>
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

                                    {/* Pagination */}
                                    {pagination.totalPages > 1 && (
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem' }}>
                                            <button
                                                className="button button--secondary button--small"
                                                onClick={() => handlePageChange(pagination.page - 1)}
                                                disabled={pagination.page <= 1}
                                            >
                                                <span>Previous</span>
                                            </button>

                                            <span style={{ fontSize: '0.875rem', color: '#666' }}>
                                                Page {pagination.page} of {pagination.totalPages}
                                            </span>

                                            <button
                                                className="button button--secondary button--small"
                                                onClick={() => handlePageChange(pagination.page + 1)}
                                                disabled={pagination.page >= pagination.totalPages}
                                            >
                                                <span>Next</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', textAlign: 'center' }}>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>No events have been recorded for this campaign yet.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Email Preview Modal */}
                {showPreviewModal && (
                    <div className="modal-overlay">
                        <div className="modal-container">
                            <div className="modal-header">
                                <h2>Email Preview</h2>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowPreviewModal(false)}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f0f0f0' }}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: '500', color: '#666' }}>Subject:</span> <span style={{ fontSize: '0.875rem', color: '#1a1a1a' }}>{campaign.subject}</span>
                                </div>
                                <div
                                    dangerouslySetInnerHTML={{ __html: campaign.content || '<p>No content available.</p>' }}
                                    style={{ fontFamily: 'Arial, sans-serif', fontSize: '0.9375rem', lineHeight: '1.6', color: '#1a1a1a' }}
                                ></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </BrandLayout>
    );
}
