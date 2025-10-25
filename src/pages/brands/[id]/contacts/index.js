import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import BrandLayout from '@/components/BrandLayout';
import { PlusCircle, Search, Users, Trash, UploadCloud, UserPlus, ExternalLink } from 'lucide-react';
import CreateContactListModal from '@/components/contact/CreateContactListModal';
import ImportContactsModal from '@/components/contact/ImportContactsModal';
import { Eye, PlusSign } from '@/lib/icons';
import Link from 'next/link';

export default function BrandContacts() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [contactLists, setContactLists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals state
    const [showCreateListModal, setShowCreateListModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMethod, setImportMethod] = useState(null);
    const [selectedListId, setSelectedListId] = useState(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            fetchContactLists();
        }
    }, [status, id, router]);

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

    const fetchContactLists = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/contact-lists`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch contact lists');
            }

            const data = await res.json();
            setContactLists(data);
        } catch (error) {
            console.error('Error fetching contact lists:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateList = () => {
        setShowCreateListModal(true);
    };

    const handleCreateListSuccess = (newList) => {
        setContactLists([newList, ...contactLists]);
        setShowCreateListModal(false);
    };

    const handleDeleteList = async (e, listId) => {
        e.preventDefault();
        e.stopPropagation();

        const list = contactLists.find((l) => l._id === listId);
        if (!list) return;

        if (window.confirm(`Are you sure you want to delete the "${list.name}" contact list?`)) {
            try {
                const res = await fetch(`/api/brands/${id}/contact-lists/${listId}`, {
                    method: 'DELETE',
                    credentials: 'same-origin',
                });

                if (!res.ok) {
                    throw new Error('Failed to delete contact list');
                }

                setContactLists(contactLists.filter((list) => list._id !== listId));
            } catch (error) {
                console.error('Error deleting contact list:', error);
                setError(error.message);
            }
        }
    };

    const handleImportContacts = (e, listId, method) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedListId(listId);
        setImportMethod(method);
        setShowImportModal(true);
    };

    const handleImportSuccess = () => {
        fetchContactLists();
        setShowImportModal(false);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Filter contact lists based on search query
    const filteredContactLists = contactLists.filter((list) => {
        const searchLower = searchQuery.toLowerCase();
        return list.name.toLowerCase().includes(searchLower) || (list.description && list.description.toLowerCase().includes(searchLower));
    });

    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Search and Create Bar */}
                <div className="campaigns-header">
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <Search
                                size={18}
                                className="search-icon"
                            />
                            <input
                                type="text"
                                placeholder="Search contact lists..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                    <button
                        className="button button--primary"
                        onClick={handleCreateList}
                    >
                        <PlusSign size={18} />
                        Create Contact List
                    </button>
                </div>

                {/* Contact Lists Table or Empty State */}
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
                        <div style={{ width: '2rem', height: '2rem', border: '3px solid #f0f0f0', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        <p style={{ margin: 0, fontSize: '0.9375rem', color: '#666' }}>Loading contact lists...</p>
                    </div>
                ) : (
                    <>
                        {contactLists.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
                                <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: 'linear-gradient(145deg, #f5f5f5 0%, #e8e8e8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', marginBottom: '1.5rem' }}>
                                    <Users size={32} />
                                </div>
                                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 500, color: '#1a1a1a' }}>No contact lists yet</h2>
                                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9375rem', color: '#666', maxWidth: '400px' }}>Create your first contact list to start managing your contacts</p>
                                <button
                                    className="button button--primary"
                                    onClick={handleCreateList}
                                >
                                    <PlusCircle size={18} />
                                    Create Contact List
                                </button>
                            </div>
                        ) : (
                            <>
                                {filteredContactLists.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
                                        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 500, color: '#1a1a1a' }}>No matching contact lists</h2>
                                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9375rem', color: '#666' }}>No contact lists match your search criteria</p>
                                        <button
                                            className="button button--secondary"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            Clear Search
                                        </button>
                                    </div>
                                ) : (
                                    <div className="contact-lists-table-wrapper">
                                        <table className="campaigns-table">
                                            <thead>
                                                <tr>
                                                    <th>List Name</th>
                                                    <th>Contacts</th>
                                                    <th>Created</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredContactLists.map((list) => (
                                                    <tr key={list._id}>
                                                        <td className="campaign-col">
                                                            <div className="campaign-info">
                                                                <div>
                                                                    <div style={{ fontWeight: '500' }}>{list.name}</div>
                                                                    {list.description && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{list.description}</div>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="stats-value">
                                                                <span style={{ fontWeight: '500' }}>{list.contactCount || 0}</span>
                                                            </div>
                                                        </td>
                                                        <td>{formatDate(list.createdAt)}</td>
                                                        <td>
                                                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500', backgroundColor: '#e8f5e9', color: '#2e7d32' }}>Active</span>
                                                        </td>
                                                        <td className="actions-col">
                                                            <div className="action-buttons">
                                                                <Link
                                                                    href={`/brands/${id}/contacts/${list._id}`}
                                                                    className="action-btn"
                                                                    title="View Details"
                                                                >
                                                                    <Eye />
                                                                </Link>
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={(e) => handleImportContacts(e, list._id, 'manual')}
                                                                    title="Add Contact"
                                                                >
                                                                    <UserPlus size={16} />
                                                                    Add
                                                                </button>
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={(e) => handleImportContacts(e, list._id, 'csv')}
                                                                    title="Import CSV"
                                                                >
                                                                    <UploadCloud size={16} />
                                                                    Import
                                                                </button>
                                                                {/* <button
                                                                className="action-btn delete-btn"
                                                                onClick={(e) => handleDeleteList(e, list._id)}
                                                                title="Delete List"
                                                            >
                                                                <Trash size={16} />
                                                            </button> */}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {showCreateListModal && (
                <CreateContactListModal
                    brandId={id}
                    onClose={() => setShowCreateListModal(false)}
                    onSuccess={handleCreateListSuccess}
                />
            )}

            {showImportModal && (
                <ImportContactsModal
                    brandId={id}
                    listId={selectedListId}
                    method={importMethod}
                    onClose={() => setShowImportModal(false)}
                    onSuccess={handleImportSuccess}
                />
            )}
        </BrandLayout>
    );
}
