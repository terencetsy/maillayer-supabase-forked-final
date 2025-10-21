import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Upload, Save, Check, X, Trash, AlertTriangle, RefreshCw, UserPlus, ToggleLeft, ToggleRight } from 'lucide-react';
import { FirebaseOutline } from '@/lib/icons';

export default function FirebaseIntegration() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [integration, setIntegration] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [contactLists, setContactLists] = useState([]);

    // Form state
    const [name, setName] = useState('Firebase Integration');
    const [serviceAccountJson, setServiceAccountJson] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [validationError, setValidationError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Auto-sync configuration
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [selectedListId, setSelectedListId] = useState('');
    const [createNewList, setCreateNewList] = useState(false);
    const [newListName, setNewListName] = useState('Firebase Auth Users');
    const [isTestingSyncConnection, setIsTestingSyncConnection] = useState(false);
    const [syncingStatus, setSyncingStatus] = useState(null);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            fetchFirebaseIntegration();
            fetchContactLists();
        }
    }, [status, id, router]);

    useEffect(() => {
        if (integration && integration.config) {
            setName(integration.name || 'Firebase Integration');
            setAutoSyncEnabled(integration.config.autoSyncEnabled || false);
            setSelectedListId(integration.config.autoSyncListId || '');
            setCreateNewList(integration.config.createNewList || false);
            setNewListName(integration.config.newListName || 'Firebase Auth Users');
            setLastSyncedAt(integration.config.lastSyncedAt || null);
        }
    }, [integration]);

    const fetchBrandDetails = async () => {
        try {
            const res = await fetch(`/api/brands/${id}`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to fetch brand details');
            const data = await res.json();
            setBrand(data);
        } catch (error) {
            setError(error.message);
        }
    };

    const fetchFirebaseIntegration = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/integrations/firebase`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to fetch Firebase integration');
            const data = await res.json();
            if (data) setIntegration(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchContactLists = async () => {
        try {
            const res = await fetch(`/api/brands/${id}/contact-lists`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to fetch contact lists');
            const data = await res.json();
            setContactLists(data);
        } catch (error) {
            console.error('Error fetching contact lists:', error);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            processFile(file);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = (file) => {
        setUploadedFile(file);
        setValidationError('');

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target.result;
                const parsedContent = JSON.parse(content);

                if (!parsedContent.type || !parsedContent.project_id || !parsedContent.private_key) {
                    setValidationError('Invalid service account file');
                    return;
                }

                setServiceAccountJson(content);
            } catch (error) {
                setValidationError('Invalid JSON format');
            }
        };

        reader.readAsText(file);
    };

    const removeFile = () => {
        setUploadedFile(null);
        setServiceAccountJson('');
        setValidationError('');
    };

    const saveIntegration = async () => {
        try {
            setError('');
            setSuccess('');
            setIsSaving(true);

            if (!serviceAccountJson && !integration) {
                setError('Please upload a service account file');
                setIsSaving(false);
                return;
            }

            if (autoSyncEnabled && !createNewList && !selectedListId) {
                setError('Please select a contact list or create a new one');
                setIsSaving(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/firebase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    serviceAccountJson: serviceAccountJson || JSON.stringify(integration.config.serviceAccount),
                    autoSyncConfig: {
                        autoSyncEnabled,
                        autoSyncListId: selectedListId,
                        createNewList,
                        newListName,
                    },
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save integration');
            }

            const data = await res.json();
            setIntegration(data);
            setSuccess('Integration saved successfully');
            setUploadedFile(null);
            setServiceAccountJson('');
            fetchFirebaseIntegration();
        } catch (error) {
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteIntegration = async () => {
        try {
            setError('');
            setSuccess('');
            setIsSaving(true);

            const res = await fetch(`/api/brands/${id}/integrations/${integration._id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Failed to delete integration');

            setSuccess('Integration disconnected successfully');
            setIntegration(null);
            setShowDeleteConfirm(false);
            setName('Firebase Integration');
            setAutoSyncEnabled(false);
            setSelectedListId('');
        } catch (error) {
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const testSyncConnection = async () => {
        try {
            setError('');
            setSyncingStatus('testing');
            setIsTestingSyncConnection(true);

            const res = await fetch(`/api/brands/${id}/integrations/firebase/test-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ integrationId: integration._id }),
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Connection test failed');

            const data = await res.json();
            setSyncingStatus('success');
            setSuccess(`Found ${data.userCount} users in Firebase`);
        } catch (error) {
            setError(error.message);
            setSyncingStatus('error');
        } finally {
            setIsTestingSyncConnection(false);
            setTimeout(() => setSyncingStatus(null), 3000);
        }
    };

    const triggerManualSync = async () => {
        try {
            setError('');
            setSyncingStatus('syncing');
            setIsSaving(true);

            if (!createNewList && !selectedListId) {
                setError('Please select a contact list');
                setIsSaving(false);
                setSyncingStatus(null);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/firebase/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    integrationId: integration._id,
                    listId: selectedListId,
                    createNewList,
                    newListName,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Sync failed');

            const data = await res.json();

            if (data.newList) {
                setContactLists([...contactLists, data.newList]);
                setSelectedListId(data.newList._id);
                setCreateNewList(false);
            }

            setSuccess(`Synced ${data.importedCount} users successfully`);
            setLastSyncedAt(data.syncedAt);
            setSyncingStatus('success');
            fetchFirebaseIntegration();
        } catch (error) {
            setError(error.message);
            setSyncingStatus('error');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSyncingStatus(null), 3000);
        }
    };

    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="firebase-integration-container">
                {/* Header */}
                <div className="integration-header">
                    <Link
                        href={`/brands/${id}/integrations`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Integrations</span>
                    </Link>

                    <div className="header-content">
                        <div className="header-icon">
                            <FirebaseOutline size={24} />
                        </div>
                        <div className="header-text">
                            <h1>Firebase Integration</h1>
                            <p>Sync Firebase Auth users to contact lists</p>
                        </div>
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="alert alert-error">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                        <button
                            onClick={() => setError('')}
                            className="close-alert"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success">
                        <Check size={16} />
                        <span>{success}</span>
                        <button
                            onClick={() => setSuccess('')}
                            className="close-alert"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Status Panel */}
                {integration && (
                    <div className="integration-status-panel">
                        <div className="status-indicator">
                            <div className="status-dot"></div>
                            <span>Connected: {integration.config.projectId}</span>
                        </div>
                        <div className="status-meta">
                            <span>Connected {new Date(integration.createdAt).toLocaleDateString()}</span>
                            {lastSyncedAt && (
                                <>
                                    <span>•</span>
                                    <span>Last synced {new Date(lastSyncedAt).toLocaleString()}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Setup Card */}
                <div className="integration-setup-container">
                    <div className="setup-card">
                        <div className="setup-header">
                            <h2>{integration ? 'Settings' : 'Connect Firebase'}</h2>
                            {integration && (
                                <button
                                    className="delete-button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={isSaving}
                                >
                                    <Trash size={16} />
                                    <span>Disconnect</span>
                                </button>
                            )}
                        </div>

                        <div className="setup-form">
                            {/* Integration Name */}
                            <div className="form-group">
                                <label htmlFor="integration-name">Integration Name</label>
                                <input
                                    type="text"
                                    id="integration-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Firebase Integration"
                                    disabled={isSaving}
                                />
                            </div>

                            {/* Service Account */}
                            <div className="service-account-section">
                                <h3>Service Account</h3>
                                <p className="section-description">Upload your Firebase service account JSON file</p>

                                {integration ? (
                                    <div className="current-connection">
                                        <div className="connection-info">
                                            <span className="label">Project ID:</span>
                                            <span className="value">{integration.config.projectId}</span>
                                            <span className="label">Client Email:</span>
                                            <span className="value">{integration.config.serviceAccount.client_email}</span>
                                        </div>

                                        <div className="update-service-account">
                                            <p>Upload new service account to update:</p>
                                            <div className="file-upload-container">
                                                <input
                                                    type="file"
                                                    id="service-account-file"
                                                    accept=".json"
                                                    onChange={handleFileChange}
                                                    disabled={isSaving}
                                                    className="file-input"
                                                />
                                                <div
                                                    className={`file-upload-zone ${isDragging ? 'drag-over' : ''} ${uploadedFile ? 'has-file' : ''}`}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                    onClick={() => document.getElementById('service-account-file').click()}
                                                >
                                                    <div className="upload-icon">
                                                        <Upload size={20} />
                                                    </div>
                                                    <div className="upload-text">
                                                        {uploadedFile ? (
                                                            <>
                                                                <p className="file-name">{uploadedFile.name}</p>
                                                                <span>Click or drag to replace</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p>Drop JSON file or click to browse</p>
                                                                <span>Service account JSON only</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    {uploadedFile && (
                                                        <div className="file-actions">
                                                            <button
                                                                type="button"
                                                                className="button button--secondary button--small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeFile();
                                                                }}
                                                            >
                                                                <X size={14} />
                                                                Remove
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="file-upload-section">
                                        <div className="file-upload-container">
                                            <input
                                                type="file"
                                                id="service-account-file"
                                                accept=".json"
                                                onChange={handleFileChange}
                                                disabled={isSaving}
                                                className="file-input"
                                            />
                                            <div
                                                className={`file-upload-zone ${isDragging ? 'drag-over' : ''} ${uploadedFile ? 'has-file' : ''}`}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={handleDrop}
                                                onClick={() => document.getElementById('service-account-file').click()}
                                            >
                                                <div className="upload-icon">
                                                    <Upload size={20} />
                                                </div>
                                                <div className="upload-text">
                                                    {uploadedFile ? (
                                                        <>
                                                            <p className="file-name">{uploadedFile.name}</p>
                                                            <span>Click or drag to replace</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p>Drop JSON file or click to browse</p>
                                                            <span>Service account JSON only</span>
                                                        </>
                                                    )}
                                                </div>
                                                {uploadedFile && (
                                                    <div className="file-actions">
                                                        <button
                                                            type="button"
                                                            className="button button--secondary button--small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeFile();
                                                            }}
                                                        >
                                                            <X size={14} />
                                                            Remove
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {validationError && (
                                            <div className="validation-error">
                                                <AlertTriangle size={16} />
                                                <span>{validationError}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Auth Users Sync */}
                            {integration && (
                                <div className="auth-sync-section">
                                    <h3>Auth Users Sync</h3>
                                    <p className="section-description">Sync Firebase Authentication users to a contact list</p>

                                    <div className="test-connection-container">
                                        <button
                                            className="test-connection-button"
                                            onClick={testSyncConnection}
                                            disabled={isTestingSyncConnection || isSaving}
                                        >
                                            {isTestingSyncConnection ? (
                                                <>
                                                    <RefreshCw
                                                        size={16}
                                                        className="spinner"
                                                    />
                                                    <span>Testing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`test-status-icon ${syncingStatus}`}>{syncingStatus === 'success' ? <Check size={16} /> : syncingStatus === 'error' ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}</div>
                                                    <span>Test Connection</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="auto-sync-toggle">
                                        <div className="toggle-label">
                                            <h4>Auto-Sync</h4>
                                            <p>Automatically sync new users every hour</p>
                                        </div>
                                        <button
                                            className="toggle-button"
                                            onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                                            disabled={isSaving}
                                        >
                                            {autoSyncEnabled ? (
                                                <ToggleRight
                                                    size={24}
                                                    className="toggle-icon active"
                                                />
                                            ) : (
                                                <ToggleLeft
                                                    size={24}
                                                    className="toggle-icon"
                                                />
                                            )}
                                        </button>
                                    </div>

                                    {autoSyncEnabled && (
                                        <div className="sync-config-section">
                                            <div className="radio-group">
                                                <label className="radio-label">
                                                    <input
                                                        type="radio"
                                                        checked={!createNewList}
                                                        onChange={() => setCreateNewList(false)}
                                                        disabled={isSaving}
                                                    />
                                                    <span>Use existing list</span>
                                                </label>
                                            </div>

                                            {!createNewList && (
                                                <div className="contact-list-select">
                                                    <select
                                                        value={selectedListId}
                                                        onChange={(e) => setSelectedListId(e.target.value)}
                                                        disabled={isSaving}
                                                    >
                                                        <option value="">Select list</option>
                                                        {contactLists.map((list) => (
                                                            <option
                                                                key={list._id}
                                                                value={list._id}
                                                            >
                                                                {list.name} ({list.contactCount || 0})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="radio-group">
                                                <label className="radio-label">
                                                    <input
                                                        type="radio"
                                                        checked={createNewList}
                                                        onChange={() => setCreateNewList(true)}
                                                        disabled={isSaving}
                                                    />
                                                    <span>Create new list</span>
                                                </label>
                                            </div>

                                            {createNewList && (
                                                <div className="new-list-input">
                                                    <input
                                                        type="text"
                                                        value={newListName}
                                                        onChange={(e) => setNewListName(e.target.value)}
                                                        placeholder="List name"
                                                        disabled={isSaving}
                                                    />
                                                </div>
                                            )}

                                            <div className="manual-sync-button-container">
                                                <button
                                                    className="button button--primary"
                                                    onClick={triggerManualSync}
                                                    disabled={isSaving || syncingStatus === 'syncing'}
                                                >
                                                    {syncingStatus === 'syncing' ? (
                                                        <>
                                                            <RefreshCw
                                                                size={16}
                                                                className="spinner"
                                                            />
                                                            <span>Syncing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserPlus size={16} />
                                                            <span>Sync Now</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    className="button button--primary"
                                    onClick={saveIntegration}
                                    disabled={isSaving || (!serviceAccountJson && !integration)}
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="spinner-sm"></div>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>{integration ? 'Update' : 'Connect'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Delete Modal */}
                {showDeleteConfirm && (
                    <div className="modal-overlay">
                        <div className="modal-container delete-modal">
                            <div className="modal-header">
                                <h3>Disconnect Firebase</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isSaving}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="modal-content">
                                <div className="warning-icon">
                                    <AlertTriangle size={32} />
                                </div>
                                <p>Disconnect Firebase integration?</p>
                                <p className="warning-text">This will disable user syncing and event tracking</p>

                                <div className="modal-actions">
                                    <button
                                        className="button button--secondary"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="button button--primary"
                                        onClick={deleteIntegration}
                                        disabled={isSaving}
                                        style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="spinner-sm"></div>
                                                <span>Disconnecting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Trash size={16} />
                                                <span>Disconnect</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </BrandLayout>
    );
}
