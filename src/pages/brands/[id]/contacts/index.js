import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import BrandLayout from '@/components/BrandLayout';
import { Search, PlusCircle, Users, Upload, Globe } from 'lucide-react';
import ContactListItem from '@/components/contact/ContactListItem';
import CreateContactListModal from '@/components/contact/CreateContactListModal';
import ImportContactsModal from '@/components/contact/ImportContactsModal';

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
    const [importMethod, setImportMethod] = useState(null); // 'manual', 'csv', or 'api'
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
        setContactLists([...contactLists, newList]);
        setShowCreateListModal(false);
    };

    const handleDeleteList = async (listId) => {
        try {
            const res = await fetch(`/api/brands/${id}/contact-lists/${listId}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to delete contact list');
            }

            // Remove the deleted list from state
            setContactLists(contactLists.filter((list) => list._id !== listId));
        } catch (error) {
            console.error('Error deleting contact list:', error);
            setError(error.message);
        }
    };

    const handleImportContacts = (listId, method) => {
        setSelectedListId(listId);
        setImportMethod(method);
        setShowImportModal(true);
    };

    const handleImportSuccess = () => {
        // Refresh the contact lists to update contact counts
        fetchContactLists();
        setShowImportModal(false);
    };

    // Filter contact lists based on search query
    const filteredContactLists = contactLists.filter((list) => list.name.toLowerCase().includes(searchQuery.toLowerCase()) || list.description?.toLowerCase().includes(searchQuery.toLowerCase()));

    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="contacts-container">
                {/* Search and Actions Bar */}
                <div className="contacts-header">
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
                        className="create-button"
                        onClick={handleCreateList}
                    >
                        <PlusCircle size={18} />
                        Create Contact List
                    </button>
                </div>

                {/* Contact Lists */}
                {isLoading ? (
                    <div className="loading-section">
                        <div className="spinner"></div>
                        <p>Loading contact lists...</p>
                    </div>
                ) : (
                    <>
                        {contactLists.length === 0 ? (
                            <div className="empty-state">
                                <div className="icon-wrapper">
                                    <Users size={32} />
                                </div>
                                <h2>No contact lists yet</h2>
                                <p>Create your first contact list to start managing your contacts</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleCreateList}
                                >
                                    <PlusCircle size={18} />
                                    Create Contact List
                                </button>
                            </div>
                        ) : (
                            <>
                                {filteredContactLists.length === 0 ? (
                                    <div className="empty-state search-empty">
                                        <h2>No matching contact lists</h2>
                                        <p>No contact lists match your search query</p>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            Clear Search
                                        </button>
                                    </div>
                                ) : (
                                    <div className="contact-lists-grid">
                                        {filteredContactLists.map((list) => (
                                            <ContactListItem
                                                key={list._id}
                                                list={list}
                                                brandId={id}
                                                onDelete={() => handleDeleteList(list._id)}
                                                onImport={handleImportContacts}
                                            />
                                        ))}
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
