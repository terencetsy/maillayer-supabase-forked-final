import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Search, PlusCircle, Upload, Globe, Trash, DownloadCloud, Filter, ChevronDown, X, Users } from 'lucide-react';
import ImportContactsModal from '@/components/contact/ImportContactsModal';

export default function ContactListDetails() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, listId } = router.query;

    const [brand, setBrand] = useState(null);
    const [contactList, setContactList] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [sortField, setSortField] = useState('email');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showDropdown, setShowDropdown] = useState(false);

    // Modal states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMethod, setImportMethod] = useState(null);

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
    }, [contactList, currentPage, sortField, sortOrder, searchQuery]);

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

            // Clear selected contacts and refresh list
            setSelectedContacts([]);
            fetchContactList();
            fetchContacts();
        } catch (error) {
            console.error('Error deleting contacts:', error);
            setError(error.message);
        }
    };

    const handleExportContacts = async () => {
        try {
            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}/export`, {
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

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setCurrentPage(1);
    };

    if (!brand || isLoadingList) {
        return (
            <BrandLayout brand={brand}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading contact list...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="contact-list-details-container">
                <div className="details-header">
                    <div className="header-left">
                        <Link
                            href={`/brands/${id}/contacts`}
                            className="back-link"
                        >
                            <ArrowLeft size={16} />
                            <span>Back to Contact Lists</span>
                        </Link>
                        <div className="list-info">
                            <h1>{contactList.name}</h1>
                            {contactList.description && <p className="list-description">{contactList.description}</p>}
                            <div className="list-stats">
                                <span>{contactList.contactCount || 0} contacts</span>
                                <span>•</span>
                                <span>Created {new Date(contactList.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="contacts-actions">
                    <div className="search-container">
                        <div className="search-input-wrapper">
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
                                    setCurrentPage(1); // Reset to first page on search
                                }}
                                className="search-input"
                            />
                            {searchQuery && (
                                <button
                                    className="clear-search"
                                    onClick={clearSearch}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <button className="filter-button">
                            <Filter size={16} />
                            <span>Filter</span>
                        </button>
                    </div>

                    <div className="actions-right">
                        <div className="dropdown">
                            <button
                                className="import-button"
                                onClick={toggleDropdown}
                            >
                                <Upload size={16} />
                                <span>Import</span>
                                <ChevronDown size={16} />
                            </button>
                            {showDropdown && (
                                <div className="dropdown-menu">
                                    <button
                                        className="dropdown-item"
                                        onClick={() => handleImportContacts('manual')}
                                    >
                                        <PlusCircle size={16} />
                                        <span>Add Manually</span>
                                    </button>
                                    <button
                                        className="dropdown-item"
                                        onClick={() => handleImportContacts('csv')}
                                    >
                                        <Upload size={16} />
                                        <span>Import CSV</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            className="export-button"
                            onClick={handleExportContacts}
                            disabled={contactList.contactCount === 0}
                        >
                            <DownloadCloud size={16} />
                            <span>Export</span>
                        </button>

                        {selectedContacts.length > 0 && (
                            <button
                                className="delete-button"
                                onClick={handleDeleteSelected}
                            >
                                <Trash size={16} />
                                <span>Delete ({selectedContacts.length})</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Contacts Table */}
                <div className="contacts-table-container">
                    {isLoading ? (
                        <div className="table-loading">
                            <div className="spinner"></div>
                            <p>Loading contacts...</p>
                        </div>
                    ) : (
                        <>
                            {contacts.length === 0 ? (
                                <div className="empty-contacts">
                                    <div className="icon-wrapper">
                                        <Users size={32} />
                                    </div>
                                    <h3>No contacts found</h3>
                                    {searchQuery ? <p>No contacts match your search query. Try a different search term or clear your search.</p> : <p>This list doesn't have any contacts yet. Import contacts to get started.</p>}
                                    <div className="empty-actions">
                                        {searchQuery ? (
                                            <button
                                                className="btn btn-secondary"
                                                onClick={clearSearch}
                                            >
                                                Clear Search
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-primary"
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
                                    <table className="contacts-table">
                                        <thead>
                                            <tr>
                                                <th className="checkbox-cell">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedContacts.length === contacts.length && contacts.length > 0}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th
                                                    className={`sortable ${sortField === 'email' ? 'active' : ''}`}
                                                    onClick={() => handleSort('email')}
                                                >
                                                    Email Address
                                                    {sortField === 'email' && <span className={`sort-icon ${sortOrder === 'desc' ? 'desc' : ''}`}>↓</span>}
                                                </th>
                                                <th
                                                    className={`sortable ${sortField === 'firstName' ? 'active' : ''}`}
                                                    onClick={() => handleSort('firstName')}
                                                >
                                                    First Name
                                                    {sortField === 'firstName' && <span className={`sort-icon ${sortOrder === 'desc' ? 'desc' : ''}`}>↓</span>}
                                                </th>
                                                <th
                                                    className={`sortable ${sortField === 'lastName' ? 'active' : ''}`}
                                                    onClick={() => handleSort('lastName')}
                                                >
                                                    Last Name
                                                    {sortField === 'lastName' && <span className={`sort-icon ${sortOrder === 'desc' ? 'desc' : ''}`}>↓</span>}
                                                </th>
                                                <th>Phone</th>
                                                <th
                                                    className={`sortable ${sortField === 'createdAt' ? 'active' : ''}`}
                                                    onClick={() => handleSort('createdAt')}
                                                >
                                                    Added
                                                    {sortField === 'createdAt' && <span className={`sort-icon ${sortOrder === 'desc' ? 'desc' : ''}`}>↓</span>}
                                                </th>
                                                <th className="actions-cell">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {contacts.map((contact) => (
                                                <tr key={contact._id}>
                                                    <td className="checkbox-cell">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedContacts.includes(contact._id)}
                                                            onChange={() => handleContactSelect(contact._id)}
                                                        />
                                                    </td>
                                                    <td>{contact.email}</td>
                                                    <td>{contact.firstName || '-'}</td>
                                                    <td>{contact.lastName || '-'}</td>
                                                    <td>{contact.phone || '-'}</td>
                                                    <td>{new Date(contact.createdAt).toLocaleDateString()}</td>
                                                    <td className="actions-cell">
                                                        <button
                                                            className="delete-contact-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm('Are you sure you want to delete this contact?')) {
                                                                    handleContactSelect(contact._id);
                                                                    handleDeleteSelected();
                                                                }
                                                            }}
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="pagination">
                                            <button
                                                className="pagination-btn prev"
                                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Previous
                                            </button>

                                            <div className="pagination-info">
                                                Page {currentPage} of {totalPages}
                                            </div>

                                            <button
                                                className="pagination-btn next"
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
        </BrandLayout>
    );
}
