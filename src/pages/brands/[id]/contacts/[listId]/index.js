import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Search, PlusCircle, Upload, Trash, DownloadCloud, ChevronDown, X, Users, RefreshCw, Check, UserCheck, UserX, AlertOctagon } from 'lucide-react';
import ImportContactsModal from '@/components/contact/ImportContactsModal';
import DailyContactsChart from '@/components/contact/DailyContactsChart';
import ContactListApiSettings from '@/components/contact/ContactListApiSettings';
import { Code } from 'lucide-react';

export default function ContactListDetails() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, listId } = router.query;

    const [brand, setBrand] = useState(null);
    const [contactList, setContactList] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isUpdatingContact, setIsUpdatingContact] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [sortField, setSortField] = useState('email');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showDropdown, setShowDropdown] = useState(false);
    const [contactStatusCounts, setContactStatusCounts] = useState({
        active: 0,
        unsubscribed: 0,
        bounced: 0,
        complained: 0,
    });
    const [statusFilter, setStatusFilter] = useState('all');

    // Modal states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMethod, setImportMethod] = useState(null);
    const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [statusUpdateReason, setStatusUpdateReason] = useState('');

    const [activeTab, setActiveTab] = useState('contacts'); // 'contacts' or 'api'

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id && listId) {
            fetchBrandDetails();
            fetchContactList();
        }
    }, [status, id, listId, router]);

    useEffect(() => {
        if (contactList) {
            fetchContacts();
        }
    }, [contactList, currentPage, sortField, sortOrder, searchQuery, statusFilter]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (showDropdown) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showDropdown]);

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

    const fetchContactList = async () => {
        try {
            setIsLoadingList(true);
            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Contact list not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch contact list');
                }
            }

            const data = await res.json();
            setContactList(data);
        } catch (error) {
            console.error('Error fetching contact list:', error);
            setError(error.message);
        } finally {
            setIsLoadingList(false);
        }
    };

    const fetchContacts = async () => {
        try {
            setIsLoading(true);
            const queryParams = new URLSearchParams({
                page: currentPage,
                limit: 20,
                sort: sortField,
                order: sortOrder,
                search: searchQuery,
                status: statusFilter !== 'all' ? statusFilter : '',
            });

            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}/contacts?${queryParams}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch contacts');
            }

            const data = await res.json();
            setContacts(data.contacts);
            setTotalPages(data.totalPages);
            setContactStatusCounts(
                data.statusCounts || {
                    active: 0,
                    unsubscribed: 0,
                    bounced: 0,
                    complained: 0,
                }
            );
        } catch (error) {
            console.error('Error fetching contacts:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportContacts = (method) => {
        setImportMethod(method);
        setShowImportModal(true);
        setShowDropdown(false);
    };

    const handleImportSuccess = () => {
        fetchContactList();
        fetchContacts();
        setShowImportModal(false);
        setSuccess('Contacts imported successfully!');

        setTimeout(() => {
            setSuccess('');
        }, 3000);
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handleContactSelect = (contactId) => {
        if (selectedContacts.includes(contactId)) {
            setSelectedContacts(selectedContacts.filter((id) => id !== contactId));
        } else {
            setSelectedContacts([...selectedContacts, contactId]);
        }
    };

    const handleSelectAll = () => {
        if (selectedContacts.length === contacts.length) {
            setSelectedContacts([]);
        } else {
            setSelectedContacts(contacts.map((contact) => contact._id));
        }
    };

    const handleStatusFilterChange = (newStatus) => {
        setStatusFilter(newStatus);
        setCurrentPage(1);
    };

    const handleDeleteSelected = async () => {
        if (selectedContacts.length === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedContacts.length} selected contacts?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}/contacts`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contactIds: selectedContacts,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to delete contacts');
            }

            setSelectedContacts([]);
            setSuccess(`Successfully deleted ${selectedContacts.length} contacts`);
            fetchContactList();
            fetchContacts();

            setTimeout(() => {
                setSuccess('');
            }, 3000);
        } catch (error) {
            console.error('Error deleting contacts:', error);
            setError(error.message);
        }
    };

    const handleExportContacts = async () => {
        try {
            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}/export?status=${statusFilter !== 'all' ? statusFilter : ''}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to export contacts');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${contactList.name}-contacts.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error('Error exporting contacts:', error);
            setError(error.message);
        }
    };

    const handleUpdateContactStatus = async (contactId, newStatus, reason = '') => {
        try {
            setIsUpdatingContact(true);

            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}/contacts/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contactId,
                    status: newStatus,
                    reason,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update contact status');
            }

            setSuccess(`Contact status updated to ${newStatus}`);
            fetchContacts();

            if (showStatusUpdateModal) {
                setShowStatusUpdateModal(false);
                setSelectedStatus('');
                setStatusUpdateReason('');
            }

            setTimeout(() => {
                setSuccess('');
            }, 3000);
        } catch (error) {
            console.error('Error updating contact status:', error);
            setError(error.message);
        } finally {
            setIsUpdatingContact(false);
        }
    };

    const handleBulkStatusUpdate = async () => {
        if (selectedContacts.length === 0) {
            setError('No contacts selected');
            return;
        }

        if (!selectedStatus) {
            setError('Please select a status');
            return;
        }

        try {
            setIsUpdatingContact(true);

            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}/contacts/bulk-status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contactIds: selectedContacts,
                    status: selectedStatus,
                    reason: statusUpdateReason,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update contacts');
            }

            const data = await res.json();
            setSuccess(`Updated ${data.updated} contacts to ${selectedStatus}`);
            setSelectedContacts([]);
            fetchContacts();

            setShowStatusUpdateModal(false);
            setSelectedStatus('');
            setStatusUpdateReason('');

            setTimeout(() => {
                setSuccess('');
            }, 3000);
        } catch (error) {
            console.error('Error updating contacts:', error);
            setError(error.message);
        } finally {
            setIsUpdatingContact(false);
        }
    };

    const toggleDropdown = (e) => {
        e.stopPropagation();
        setShowDropdown(!showDropdown);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setCurrentPage(1);
    };

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'active':
                return { padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: '#e8f5e9', color: '#2e7d32', display: 'inline-flex', alignItems: 'center', gap: '4px' };
            case 'unsubscribed':
                return { padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: '#fff3e0', color: '#f57c00', display: 'inline-flex', alignItems: 'center', gap: '4px' };
            case 'bounced':
                return { padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: '#ffebee', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' };
            case 'complained':
                return { padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: '#ffebee', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' };
            default:
                return { padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: '#f5f5f5', color: '#666', display: 'inline-flex', alignItems: 'center', gap: '4px' };
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'active':
                return <UserCheck size={14} />;
            case 'unsubscribed':
                return <UserX size={14} />;
            case 'bounced':
                return <AlertOctagon size={14} />;
            case 'complained':
                return <AlertOctagon size={14} />;
            default:
                return null;
        }
    };

    if (!brand || isLoadingList) {
        return (
            <BrandLayout brand={brand}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
                    <div style={{ width: '2rem', height: '2rem', border: '3px solid #f0f0f0', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                    <p style={{ margin: 0, fontSize: '0.9375rem', color: '#666' }}>Loading contact list...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Header */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <Link
                        href={`/brands/${id}/contacts`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#666', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem' }}
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Contact Lists</span>
                    </Link>
                    <div>
                        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '500', color: '#1a1a1a' }}>{contactList.name}</h1>
                        {contactList.description && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem', color: '#666' }}>{contactList.description}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#999' }}>
                            <span>{contactList.contactCount || 0} contacts total</span>
                            <span>•</span>
                            <span>Created {new Date(contactList.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div
                        className="alert alert--error"
                        style={{ marginBottom: '1rem' }}
                    >
                        <span>{error}</span>
                        <button
                            onClick={() => setError('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {success && (
                    <div
                        className="alert alert--success"
                        style={{ marginBottom: '1rem' }}
                    >
                        <span>{success}</span>
                        <button
                            onClick={() => setSuccess('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Status Summary */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
                    <button
                        onClick={() => handleStatusFilterChange('all')}
                        style={{
                            padding: '0.75rem 1rem',
                            border: statusFilter === 'all' ? '2px solid #1a1a1a' : '1px solid #e0e0e0',
                            borderRadius: '0.5rem',
                            background: statusFilter === 'all' ? '#fafafa' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '100px',
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a1a1a' }}>{contactList.contactCount || 0}</span>
                        <span style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All</span>
                    </button>
                    <button
                        onClick={() => handleStatusFilterChange('active')}
                        style={{
                            padding: '0.75rem 1rem',
                            border: statusFilter === 'active' ? '2px solid #2e7d32' : '1px solid #e0e0e0',
                            borderRadius: '0.5rem',
                            background: statusFilter === 'active' ? '#e8f5e9' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '100px',
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#2e7d32' }}>{contactStatusCounts.active || 0}</span>
                        <span style={{ fontSize: '0.75rem', color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</span>
                    </button>
                    <button
                        onClick={() => handleStatusFilterChange('unsubscribed')}
                        style={{
                            padding: '0.75rem 1rem',
                            border: statusFilter === 'unsubscribed' ? '2px solid #f57c00' : '1px solid #e0e0e0',
                            borderRadius: '0.5rem',
                            background: statusFilter === 'unsubscribed' ? '#fff3e0' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '100px',
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f57c00' }}>{contactStatusCounts.unsubscribed || 0}</span>
                        <span style={{ fontSize: '0.75rem', color: '#f57c00', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unsubscribed</span>
                    </button>
                    <button
                        onClick={() => handleStatusFilterChange('bounced')}
                        style={{
                            padding: '0.75rem 1rem',
                            border: statusFilter === 'bounced' ? '2px solid #dc2626' : '1px solid #e0e0e0',
                            borderRadius: '0.5rem',
                            background: statusFilter === 'bounced' ? '#ffebee' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '100px',
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#dc2626' }}>{contactStatusCounts.bounced || 0}</span>
                        <span style={{ fontSize: '0.75rem', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bounced</span>
                    </button>
                    <button
                        onClick={() => handleStatusFilterChange('complained')}
                        style={{
                            padding: '0.75rem 1rem',
                            border: statusFilter === 'complained' ? '2px solid #dc2626' : '1px solid #e0e0e0',
                            borderRadius: '0.5rem',
                            background: statusFilter === 'complained' ? '#ffebee' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '100px',
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#dc2626' }}>{contactStatusCounts.complained || 0}</span>
                        <span style={{ fontSize: '0.75rem', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complained</span>
                    </button>
                </div>

                {/* Chart */}
                {!isLoading && contactList && (
                    <DailyContactsChart
                        brandId={id}
                        listId={listId}
                        status={statusFilter}
                    />
                )}

                {/* Actions Bar */}
                <div
                    className="campaigns-header"
                    style={{ marginTop: '1.5rem' }}
                >
                    <div
                        className="search-container"
                        style={{ display: 'flex', gap: '0.5rem' }}
                    >
                        <div
                            className="search-input-wrapper"
                            style={{ position: 'relative' }}
                        >
                            <Search
                                size={18}
                                className="search-icon"
                            />
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="search-input"
                            />
                            {searchQuery && (
                                <button
                                    onClick={clearSearch}
                                    style={{
                                        position: 'absolute',
                                        right: '0.625rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: '#666',
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <button
                            className="button button--secondary button--small"
                            onClick={() => fetchContacts()}
                            title="Refresh contacts"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <button
                                className="button button--secondary"
                                onClick={toggleDropdown}
                            >
                                <Upload size={16} />
                                <span>Import</span>
                                <ChevronDown size={16} />
                            </button>
                            {showDropdown && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '0.25rem',
                                        background: '#ffffff',
                                        border: '1px solid #f0f0f0',
                                        borderRadius: '0.5rem',
                                        boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.1)',
                                        minWidth: '180px',
                                        zIndex: 100,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <button
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.875rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.625rem',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.8125rem',
                                            color: '#1a1a1a',
                                            transition: 'all 0.15s ease',
                                            textAlign: 'left',
                                        }}
                                        onClick={() => handleImportContacts('manual')}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f8f8')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <PlusCircle size={16} />
                                        <span>Add Manually</span>
                                    </button>
                                    <button
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.875rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.625rem',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.8125rem',
                                            color: '#1a1a1a',
                                            transition: 'all 0.15s ease',
                                            textAlign: 'left',
                                        }}
                                        onClick={() => handleImportContacts('csv')}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f8f8')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <Upload size={16} />
                                        <span>Import CSV</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            className="button button--secondary"
                            onClick={handleExportContacts}
                            disabled={contactList.contactCount === 0}
                        >
                            <DownloadCloud size={16} />
                            <span>Export</span>
                        </button>

                        {selectedContacts.length > 0 && (
                            <>
                                <button
                                    className="button button--secondary"
                                    onClick={() => setShowStatusUpdateModal(true)}
                                >
                                    <UserCheck size={16} />
                                    <span>Update Status</span>
                                </button>
                                <button
                                    className="button button--secondary"
                                    onClick={handleDeleteSelected}
                                    style={{ color: '#dc2626' }}
                                >
                                    <Trash size={16} />
                                    <span>Delete ({selectedContacts.length})</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ borderBottom: '1px solid #f0f0f0', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => setActiveTab('contacts')}
                            style={{
                                padding: '0.75rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'contacts' ? '2px solid #1a1a1a' : '2px solid transparent',
                                cursor: 'pointer',
                                fontWeight: activeTab === 'contacts' ? '500' : '400',
                                color: activeTab === 'contacts' ? '#1a1a1a' : '#666',
                            }}
                        >
                            <Users
                                size={16}
                                style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}
                            />
                            Contacts
                        </button>
                        <button
                            onClick={() => setActiveTab('api')}
                            style={{
                                padding: '0.75rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'api' ? '2px solid #1a1a1a' : '2px solid transparent',
                                cursor: 'pointer',
                                fontWeight: activeTab === 'api' ? '500' : '400',
                                color: activeTab === 'api' ? '#1a1a1a' : '#666',
                            }}
                        >
                            <Code
                                size={16}
                                style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}
                            />
                            API Access
                        </button>
                    </div>
                </div>

                {/* Contacts Table */}
                {activeTab === 'contacts' && (
                    <div style={{ marginTop: '1rem' }}>
                        {isLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
                                <div style={{ width: '2rem', height: '2rem', border: '3px solid #f0f0f0', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                                <p style={{ margin: 0, fontSize: '0.9375rem', color: '#666' }}>Loading contacts...</p>
                            </div>
                        ) : (
                            <>
                                {contacts.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
                                        <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: 'linear-gradient(145deg, #f5f5f5 0%, #e8e8e8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', marginBottom: '1.5rem' }}>
                                            <Users size={32} />
                                        </div>
                                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '500', color: '#1a1a1a' }}>No contacts found</h3>
                                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9375rem', color: '#666', maxWidth: '400px' }}>{searchQuery || statusFilter !== 'all' ? 'No contacts match your search criteria. Try a different search term or clear your filters.' : "This list doesn't have any contacts yet. Import contacts to get started."}</p>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            {searchQuery || statusFilter !== 'all' ? (
                                                <button
                                                    className="button button--secondary"
                                                    onClick={() => {
                                                        clearSearch();
                                                        setStatusFilter('all');
                                                    }}
                                                >
                                                    Clear Filters
                                                </button>
                                            ) : (
                                                <button
                                                    className="button button--primary"
                                                    onClick={() => handleImportContacts('csv')}
                                                >
                                                    <Upload size={16} />
                                                    Import Contacts
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="contacts-details-table-wrapper">
                                            <table className="campaigns-table">
                                                <thead>
                                                <tr>
                                                    <th>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedContacts.length === contacts.length && contacts.length > 0}
                                                            onChange={handleSelectAll}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </th>
                                                    <th
                                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('email')}
                                                    >
                                                        Email {sortField === 'email' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                                    </th>
                                                    <th
                                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('firstName')}
                                                    >
                                                        First Name {sortField === 'firstName' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                                    </th>
                                                    <th
                                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('lastName')}
                                                    >
                                                        Last Name {sortField === 'lastName' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                                    </th>
                                                    <th
                                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('status')}
                                                    >
                                                        Status {sortField === 'status' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                                    </th>
                                                    <th>Phone</th>
                                                    <th
                                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('createdAt')}
                                                    >
                                                        Added {sortField === 'createdAt' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                                    </th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {contacts.map((contact) => (
                                                    <tr key={contact._id}>
                                                        <td>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedContacts.includes(contact._id)}
                                                                onChange={() => handleContactSelect(contact._id)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        </td>
                                                        <td>{contact.email}</td>
                                                        <td>{contact.firstName || '-'}</td>
                                                        <td>{contact.lastName || '-'}</td>
                                                        <td>
                                                            <span style={getStatusBadgeStyle(contact.status || 'active')}>
                                                                {getStatusIcon(contact.status || 'active')}
                                                                <span>{contact.status || 'active'}</span>
                                                            </span>
                                                        </td>
                                                        <td>{contact.phone || '-'}</td>
                                                        <td>{new Date(contact.createdAt).toLocaleDateString()}</td>
                                                        <td className="actions-col">
                                                            <div className="action-buttons">
                                                                {contact.status !== 'active' && (
                                                                    <button
                                                                        className="action-btn"
                                                                        onClick={() => handleUpdateContactStatus(contact._id, 'active')}
                                                                        title="Set as Active"
                                                                    >
                                                                        <UserCheck
                                                                            size={14}
                                                                            style={{ color: '#2e7d32' }}
                                                                        />
                                                                    </button>
                                                                )}
                                                                {contact.status !== 'unsubscribed' && (
                                                                    <button
                                                                        className="action-btn"
                                                                        onClick={() => handleUpdateContactStatus(contact._id, 'unsubscribed')}
                                                                        title="Unsubscribe"
                                                                    >
                                                                        <UserX
                                                                            size={14}
                                                                            style={{ color: '#f57c00' }}
                                                                        />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    className="action-btn delete-btn"
                                                                    onClick={() => {
                                                                        if (window.confirm('Are you sure you want to delete this contact?')) {
                                                                            setSelectedContacts([contact._id]);
                                                                            handleDeleteSelected();
                                                                        }
                                                                    }}
                                                                    title="Delete"
                                                                >
                                                                    <Trash size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem' }}>
                                                <button
                                                    className="button button--secondary button--small"
                                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                                    disabled={currentPage === 1}
                                                >
                                                    Previous
                                                </button>
                                                <span style={{ fontSize: '0.875rem', color: '#666' }}>
                                                    Page {currentPage} of {totalPages}
                                                </span>
                                                <button
                                                    className="button button--secondary button--small"
                                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                                    disabled={currentPage === totalPages}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'api' && (
                    <ContactListApiSettings
                        brandId={id}
                        listId={listId}
                    />
                )}
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <ImportContactsModal
                    brandId={id}
                    listId={listId}
                    method={importMethod}
                    onClose={() => setShowImportModal(false)}
                    onSuccess={handleImportSuccess}
                />
            )}

            {/* Status Update Modal */}
            {showStatusUpdateModal && (
                <div className="form-modal-overlay">
                    <div className="form-modal">
                        <div className="modal-form-container">
                            <div className="modal-form-header">
                                <h2>Update Contact Status</h2>
                                <button
                                    className="modal-form-close"
                                    onClick={() => setShowStatusUpdateModal(false)}
                                    type="button"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <p
                                className="form-help"
                                style={{ marginBottom: '1rem' }}
                            >
                                Update the status for {selectedContacts.length} selected contacts.
                            </p>

                            <div className="form">
                                <div className="form-group">
                                    <label className="form-label">
                                        New Status<span className="form-required">*</span>
                                    </label>
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        required
                                        className="form-select"
                                    >
                                        <option value="">Select a status</option>
                                        <option value="active">Active</option>
                                        <option value="unsubscribed">Unsubscribed</option>
                                        <option value="bounced">Bounced</option>
                                        <option value="complained">Complained</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Reason (optional)</label>
                                    <textarea
                                        value={statusUpdateReason}
                                        onChange={(e) => setStatusUpdateReason(e.target.value)}
                                        placeholder="Enter a reason for this status change..."
                                        rows={3}
                                        className="form-textarea"
                                    ></textarea>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="button button--secondary"
                                        onClick={() => setShowStatusUpdateModal(false)}
                                        disabled={isUpdatingContact}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="button button--primary"
                                        onClick={handleBulkStatusUpdate}
                                        disabled={!selectedStatus || isUpdatingContact}
                                    >
                                        {isUpdatingContact ? (
                                            <>
                                                <span className="spinner-icon">⟳</span>
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <Check size={16} />
                                                Update Contacts
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </BrandLayout>
    );
}
