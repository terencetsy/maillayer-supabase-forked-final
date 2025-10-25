import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import TransactionalTemplateForm from '@/components/TransactionalTemplateForm';
import { AlertCircle, CheckmarkCircle02, Clock01, Code, Edit01, Eye, Mail02, PlusSignCircle, Search01 } from '@/lib/icons';

export default function TransactionalTemplates() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            fetchTemplates();
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

    const fetchTemplates = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/transactional`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch templates');
            }

            const data = await res.json();
            setTemplates(data);
        } catch (error) {
            console.error('Error fetching templates:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateClick = () => {
        setShowCreateForm(true);
    };

    const handleCancelCreate = () => {
        setShowCreateForm(false);
    };

    const handleCreateSuccess = (newTemplate) => {
        setTemplates((prevTemplates) => [newTemplate, ...prevTemplates]);
        setShowCreateForm(false);
        // Redirect to the template editor
        router.push(`/brands/${id}/transactional/${newTemplate._id}/editor`);
    };

    // Filter templates based on search query
    const filteredTemplates = templates.filter((template) => {
        return template.name.toLowerCase().includes(searchQuery.toLowerCase()) || template.subject.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // This is used just for the layout to identify the brand
    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Search and Create Bar */}
                <div className="campaigns-header">
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <Search01
                                size={18}
                                className="search-icon"
                            />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                    <button
                        className="button button--primary"
                        onClick={handleCreateClick}
                    >
                        <PlusSignCircle size={18} />
                        Create Template
                    </button>
                </div>

                {/* Template Form */}
                {showCreateForm && (
                    <div className="form-modal-overlay">
                        <div className="form-modal">
                            <TransactionalTemplateForm
                                brand={brand}
                                onCancel={handleCancelCreate}
                                onSuccess={handleCreateSuccess}
                            />
                        </div>
                    </div>
                )}

                {/* Templates List or Empty State */}
                <>
                    {isLoading ? (
                        <div className="loading-section">
                            <div className="spinner"></div>
                            <p>Loading templates...</p>
                        </div>
                    ) : (
                        <>
                            {templates.length === 0 ? (
                                <div className="empty-state">
                                    <div className="icon-wrapper">
                                        <Code size={36} />
                                    </div>
                                    <h2>No transactional templates yet</h2>
                                    <p>Create your first transactional email template to send programmatic emails via API</p>
                                    <button
                                        className="button button--primary"
                                        onClick={handleCreateClick}
                                    >
                                        <PlusSignCircle size={18} />
                                        Create Template
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {filteredTemplates.length === 0 ? (
                                        <div className="empty-state search-empty">
                                            <h2>No matching templates</h2>
                                            <p>No templates match your search criteria</p>
                                            <button
                                                className="button button--secondary"
                                                onClick={() => setSearchQuery('')}
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="campaigns-table-container">
                                            <table className="campaigns-table">
                                                <thead>
                                                    <tr>
                                                        <th className="campaign-col">Template</th>
                                                        <th className="openrate-col">Sent</th>
                                                        <th className="created-col">Created</th>
                                                        <th className="actions-col">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredTemplates.map((template) => (
                                                        <tr key={template._id}>
                                                            <td className="campaign-col">
                                                                <div className="campaign-info">
                                                                    <div className="email-icon">
                                                                        <div className={`status-badge ${template.status}`}>
                                                                            {template.status === 'active' && <CheckmarkCircle02 size={14} />}
                                                                            {template.status === 'draft' && <Clock01 size={14} />}
                                                                            {template.status === 'inactive' && <AlertCircle size={14} />}
                                                                            {template.status === 'active' ? 'Active' : template.status === 'draft' ? 'Draft' : 'Inactive'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="campaign-details">
                                                                        <div className="campaign-name">{template.name}</div>
                                                                        <div className="campaign-subject">{template.subject}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="openrate-col">
                                                                <div className="stats-value">
                                                                    <Mail02
                                                                        className="stats-icon"
                                                                        size={14}
                                                                    />
                                                                    {template.stats?.sent || 0}
                                                                </div>
                                                            </td>
                                                            <td className="created-col">{new Date(template.createdAt).toLocaleDateString()}</td>
                                                            <td className="actions-col">
                                                                <div className="action-buttons">
                                                                    <Link
                                                                        href={`/brands/${id}/transactional/${template._id}`}
                                                                        className="action-btn view-btn"
                                                                        title="View details"
                                                                    >
                                                                        <Eye size={16} />
                                                                    </Link>
                                                                    <Link
                                                                        href={`/brands/${id}/transactional/${template._id}/editor`}
                                                                        className="action-btn edit-btn"
                                                                        title="Edit template"
                                                                    >
                                                                        <Edit01 size={18} />
                                                                    </Link>
                                                                    <Link
                                                                        href={`/brands/${id}/transactional/${template._id}/api`}
                                                                        className="action-btn duplicate-btn"
                                                                        title="API docs"
                                                                    >
                                                                        <Code size={18} />
                                                                    </Link>
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
                </>
            </div>
        </BrandLayout>
    );
}
