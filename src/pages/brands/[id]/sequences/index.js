// src/pages/brands/[id]/sequences/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Search, PlusCircle, Zap, Users, CheckCircle, Pause, Trash, Edit, Play, Settings, X, FileText, Loader } from 'lucide-react';
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
        const icons = {
            active: Play,
            paused: Pause,
            draft: Edit,
            archived: CheckCircle,
        };

        const Icon = icons[status] || icons.draft;

        return (
            <span className={`status-badge ${status}`}>
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
                    <div className="alert alert-error">
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="close-alert">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success">
                        <span>{success}</span>
                        <button onClick={() => setSuccess('')} className="close-alert">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Sequences Table or Empty State */}
                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading sequences...</p>
                    </div>
                ) : (
                    <>
                        {sequences.length === 0 ? (
                            <div className="empty-state">
                                <div className="icon-wrapper">
                                    <Zap size={32} />
                                </div>
                                <h2>No email sequences yet</h2>
                                <p>Create your first automated email sequence to engage contacts when they join your lists</p>
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
                                    <div className="empty-state search-empty">
                                        <h2>No matching sequences</h2>
                                        <p>No sequences match your search criteria</p>
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
                                                    <td className="sequence-name-col">
                                                        <div className="sequence-info">
                                                            <span className="sequence-name">{sequence.name}</span>
                                                            {sequence.description && <span className="sequence-description">{sequence.description}</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="stat-value">{sequence.emails?.length || 0}</span> emails
                                                    </td>
                                                    <td>
                                                        {sequence.triggerType === 'contact_list' && <span>{sequence.triggerConfig?.contactListIds?.length || 0} lists</span>}
                                                        {sequence.triggerType === 'integration' && <span>Integration</span>}
                                                        {!sequence.triggerType && <span className="text-warning">Not configured</span>}
                                                    </td>
                                                    <td>
                                                        <div className="stat-cell">
                                                            <Users size={14} className="stat-icon" />
                                                            <span className="stat-value">{sequence.stats?.totalEnrolled || 0}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="stat-cell">
                                                            <CheckCircle size={14} className="stat-icon stat-icon--success" />
                                                            <span className="stat-value">{sequence.stats?.totalCompleted || 0}</span>
                                                        </div>
                                                    </td>
                                                    <td>{getStatusBadge(sequence.status)}</td>
                                                    <td className="actions-col">
                                                        <div className="action-buttons">
                                                            <Link
                                                                href={`/brands/${id}/sequences/${sequence._id}/logs`}
                                                                className="action-btn"
                                                                title="View Logs"
                                                            >
                                                                <FileText size={16} />
                                                            </Link>
                                                            <Link
                                                                href={`/brands/${id}/sequences/${sequence._id}/design`}
                                                                className="action-btn edit-btn"
                                                                title="Edit Sequence"
                                                            >
                                                                <Settings size={16} />
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
        <div className="form-modal-overlay" onClick={onClose}>
            <div className="form-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-form-container">
                    <div className="modal-form-header">
                        <h2>Create Email Sequence</h2>
                        <button className="modal-form-close" onClick={onClose} type="button">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="form">
                        <div className="form-group">
                            <label htmlFor="sequence-name" className="form-label">
                                Sequence Name<span className="form-required">*</span>
                            </label>
                            <input
                                id="sequence-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Welcome Series"
                                autoFocus
                                required
                                disabled={isCreating}
                                className="form-input"
                            />
                            <p className="form-help">Choose a descriptive name for your automation</p>
                        </div>

                        <div className="form-actions">
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
                                        <Loader size={16} className="spinner-icon" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Sequence'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
