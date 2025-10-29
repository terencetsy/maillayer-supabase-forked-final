// src/pages/brands/[id]/sequences/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Search, PlusCircle, Zap, Users, CheckCircle, Pause, Trash, Edit, Play, Settings } from 'lucide-react';
import { getEmailSequences, deleteEmailSequence, createEmailSequence } from '@/services/clientEmailSequenceService';

export default function EmailSequences() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [sequences, setSequences] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            fetchSequences();
        }
    }, [status, id, router]);

    const fetchBrandDetails = async () => {
        try {
            const res = await fetch(`/api/brands/${id}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch brand details');
            }

            const data = await res.json();
            setBrand(data);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            setError(error.message);
        }
    };

    const fetchSequences = async () => {
        try {
            setIsLoading(true);
            const data = await getEmailSequences(id);
            setSequences(data);
        } catch (error) {
            console.error('Error fetching sequences:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSequence = async (sequenceName) => {
        if (!sequenceName.trim()) {
            setError('Please enter a sequence name');
            return;
        }

        try {
            setIsCreating(true);

            // Create a basic sequence in draft mode
            const newSequence = await createEmailSequence(id, {
                name: sequenceName,
                description: '',
                status: 'draft',
                triggerType: 'contact_list',
                triggerConfig: {
                    contactListIds: [],
                },
                emailConfig: {
                    fromName: brand?.fromName || '',
                    fromEmail: brand?.fromEmail || '',
                    replyToEmail: brand?.replyToEmail || '',
                },
                emails: [],
            });

            // Redirect to the visual designer
            router.push(`/brands/${id}/sequences/${newSequence._id}/design`);
        } catch (error) {
            console.error('Error creating sequence:', error);
            setError(error.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteSequence = async (sequenceId, sequenceName) => {
        if (!window.confirm(`Are you sure you want to delete the "${sequenceName}" sequence?`)) {
            return;
        }

        try {
            await deleteEmailSequence(id, sequenceId);
            setSuccess('Sequence deleted successfully');
            fetchSequences();

            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            console.error('Error deleting sequence:', error);
            setError(error.message);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            active: { bg: '#e8f5e9', color: '#2e7d32', icon: Play },
            paused: { bg: '#fff3e0', color: '#f57c00', icon: Pause },
            draft: { bg: '#f5f5f5', color: '#666', icon: Edit },
            archived: { bg: '#f5f5f5', color: '#666', icon: CheckCircle },
        };

        const style = styles[status] || styles.draft;
        const Icon = style.icon;

        return (
            <span
                style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: style.bg,
                    color: style.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                }}
            >
                <Icon size={12} />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const filteredSequences = sequences.filter((seq) => {
        const searchLower = searchQuery.toLowerCase();
        return seq.name.toLowerCase().includes(searchLower) || (seq.description && seq.description.toLowerCase().includes(searchLower));
    });

    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Header */}
                <div className="campaigns-header">
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <Search
                                size={18}
                                className="search-icon"
                            />
                            <input
                                type="text"
                                placeholder="Search sequences..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                    <button
                        className="button button--primary"
                        onClick={() => setShowCreateModal(true)}
                        disabled={isCreating}
                    >
                        <PlusCircle size={18} />
                        {isCreating ? 'Creating...' : 'Create Sequence'}
                    </button>
                </div>

                {/* Alerts */}
                {error && (
                    <div
                        className="alert alert--error"
                        style={{ marginBottom: '1rem' }}
                    >
                        <span>{error}</span>
                        <button
                            onClick={() => setError('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            ×
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
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Sequences Table or Empty State */}
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', gap: '1rem' }}>
                        <div style={{ width: '2rem', height: '2rem', border: '3px solid #f0f0f0', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        <p style={{ margin: 0, fontSize: '0.9375rem', color: '#666' }}>Loading sequences...</p>
                    </div>
                ) : (
                    <>
                        {sequences.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
                                <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: 'linear-gradient(145deg, #f5f5f5 0%, #e8e8e8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', marginBottom: '1.5rem' }}>
                                    <Zap size={32} />
                                </div>
                                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 500, color: '#1a1a1a' }}>No email sequences yet</h2>
                                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9375rem', color: '#666', maxWidth: '400px' }}>Create your first automated email sequence to engage contacts when they join your lists</p>
                                <button
                                    className="button button--primary"
                                    onClick={() => setShowCreateModal(true)}
                                >
                                    <PlusCircle size={18} />
                                    Create Sequence
                                </button>
                            </div>
                        ) : (
                            <>
                                {filteredSequences.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
                                        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 500, color: '#1a1a1a' }}>No matching sequences</h2>
                                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9375rem', color: '#666' }}>No sequences match your search criteria</p>
                                        <button
                                            className="button button--secondary"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            Clear Search
                                        </button>
                                    </div>
                                ) : (
                                    <table className="campaigns-table">
                                        <thead>
                                            <tr>
                                                <th>Sequence Name</th>
                                                <th>Steps</th>
                                                <th>Trigger</th>
                                                <th>Enrolled</th>
                                                <th>Completed</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSequences.map((sequence) => (
                                                <tr key={sequence._id}>
                                                    <td className="campaign-col">
                                                        <div className="campaign-info">
                                                            <div>
                                                                <div style={{ fontWeight: '500' }}>{sequence.name}</div>
                                                                {sequence.description && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{sequence.description}</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: '500' }}>{sequence.emails?.length || 0}</span> emails
                                                    </td>
                                                    <td>
                                                        {sequence.triggerType === 'contact_list' && <span>{sequence.triggerConfig?.contactListIds?.length || 0} lists</span>}
                                                        {sequence.triggerType === 'integration' && <span>Integration</span>}
                                                        {!sequence.triggerType && <span style={{ color: '#f57c00' }}>Not configured</span>}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Users
                                                                size={14}
                                                                style={{ color: '#666' }}
                                                            />
                                                            <span style={{ fontWeight: '500' }}>{sequence.stats?.totalEnrolled || 0}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <CheckCircle
                                                                size={14}
                                                                style={{ color: '#2e7d32' }}
                                                            />
                                                            <span style={{ fontWeight: '500' }}>{sequence.stats?.totalCompleted || 0}</span>
                                                        </div>
                                                    </td>
                                                    <td>{getStatusBadge(sequence.status)}</td>
                                                    <td className="actions-col">
                                                        <div className="action-buttons">
                                                            <Link
                                                                href={`/brands/${id}/sequences/${sequence._id}/design`}
                                                                className="action-btn"
                                                                title="Edit Sequence"
                                                            >
                                                                <Settings size={16} />
                                                                Edit
                                                            </Link>
                                                            <button
                                                                className="action-btn delete-btn"
                                                                onClick={() => handleDeleteSequence(sequence._id, sequence.name)}
                                                                title="Delete"
                                                            >
                                                                <Trash size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Create Sequence Modal */}
            {showCreateModal && (
                <CreateSequenceModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateSequence}
                    isCreating={isCreating}
                />
            )}
        </BrandLayout>
    );
}

// Create Sequence Modal Component
function CreateSequenceModal({ onClose, onCreate, isCreating }) {
    const [name, setName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onCreate(name);
    };

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
        >
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>Create Email Sequence</h2>
                    <button
                        className="modal-close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', color: '#666' }}>Give your sequence a name to get started. You'll configure the trigger and emails next.</p>

                        <div className="form-group">
                            <label className="form-label">
                                Sequence Name<span className="form-required">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Welcome Series"
                                className="form-input"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="button button--secondary"
                            onClick={onClose}
                            disabled={isCreating}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button button--primary"
                            disabled={isCreating || !name.trim()}
                        >
                            {isCreating ? (
                                <>
                                    <span className="spinner-icon">⟳</span>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <PlusCircle size={16} />
                                    Create & Configure
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
