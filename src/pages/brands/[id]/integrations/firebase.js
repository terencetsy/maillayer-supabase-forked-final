import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Upload, Save, Check, X, Trash, AlertTriangle, Info, RefreshCw, UserPlus, ToggleLeft, ToggleRight } from 'lucide-react';
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

    // Contact lists for auto-sync
    const [contactLists, setContactLists] = useState([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);

    // Form state
    const [name, setName] = useState('Firebase Integration');
    const [serviceAccountJson, setServiceAccountJson] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [validationError, setValidationError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Auto-sync configuration state
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
        // Set auto-sync configuration from integration if available
        if (integration && integration.config) {
            setAutoSyncEnabled(integration.config.autoSyncEnabled || false);
            setSelectedListId(integration.config.autoSyncListId || '');
            setCreateNewList(integration.config.createNewList || false);
            setNewListName(integration.config.newListName || 'Firebase Auth Users');
            setLastSyncedAt(integration.config.lastSyncedAt || null);
        }
    }, [integration]);

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

    const fetchFirebaseIntegration = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/integrations/firebase`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch Firebase integration');
            }

            const data = await res.json();

            if (data) {
                setIntegration(data);
                setName(data.name || 'Firebase Integration');
            }
        } catch (error) {
            console.error('Error fetching Firebase integration:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchContactLists = async () => {
        try {
            setIsLoadingLists(true);
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
        } finally {
            setIsLoadingLists(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadedFile(file);
        setValidationError('');

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target.result;
                const parsedContent = JSON.parse(content);

                // Basic validation
                if (!parsedContent.type || !parsedContent.project_id || !parsedContent.private_key) {
                    setValidationError('Invalid service account file. Missing required fields.');
                    return;
                }

                setServiceAccountJson(content);
            } catch (error) {
                console.error('Error parsing service account JSON:', error);
                setValidationError('Invalid JSON format. Please upload a valid Firebase service account file.');
            }
        };

        reader.readAsText(file);
    };

    const saveIntegration = async () => {
        try {
            setError('');
            setSuccess('');
            setIsSaving(true);

            if (!serviceAccountJson && !integration) {
                setError('Please upload a Firebase service account JSON file');
                setIsSaving(false);
                return;
            }

            // Validate auto-sync settings
            if (autoSyncEnabled) {
                if (!createNewList && !selectedListId) {
                    setError('Please select a contact list for auto-sync or choose to create a new list');
                    setIsSaving(false);
                    return;
                }

                if (createNewList && !newListName.trim()) {
                    setError('Please provide a name for the new contact list');
                    setIsSaving(false);
                    return;
                }
            }

            const res = await fetch(`/api/brands/${id}/integrations/firebase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
                throw new Error(data.message || 'Failed to save Firebase integration');
            }

            const data = await res.json();
            setIntegration(data);
            setSuccess('Firebase integration saved successfully');

            // Clear file upload state
            setUploadedFile(null);
            setServiceAccountJson('');

            // Refresh integration data
            fetchFirebaseIntegration();
        } catch (error) {
            console.error('Error saving Firebase integration:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteIntegration = async () => {
        if (!integration) return;

        try {
            setError('');
            setSuccess('');
            setIsSaving(true);

            const res = await fetch(`/api/brands/${id}/integrations/${integration._id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete Firebase integration');
            }

            setSuccess('Firebase integration deleted successfully');
            setIntegration(null);
            setShowDeleteConfirm(false);

            // Reset form
            setName('Firebase Integration');
            setServiceAccountJson('');
            setUploadedFile(null);
            setAutoSyncEnabled(false);
            setSelectedListId('');
            setCreateNewList(false);
            setNewListName('Firebase Auth Users');
        } catch (error) {
            console.error('Error deleting Firebase integration:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const testSyncConnection = async () => {
        if (!integration) return;

        try {
            setError('');
            setSyncingStatus('testing');
            setIsTestingSyncConnection(true);

            const res = await fetch(`/api/brands/${id}/integrations/firebase/test-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    integrationId: integration._id,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to test Firebase connection');
            }

            const data = await res.json();
            setSyncingStatus('success');
            setSuccess(`Connection test successful! Found ${data.userCount} users in Firebase Auth.`);
        } catch (error) {
            console.error('Error testing Firebase connection:', error);
            setError(error.message);
            setSyncingStatus('error');
        } finally {
            setIsTestingSyncConnection(false);
            // Reset status after 3 seconds
            setTimeout(() => {
                setSyncingStatus(null);
            }, 3000);
        }
    };

    const triggerManualSync = async () => {
        if (!integration) return;

        try {
            setError('');
            setSyncingStatus('syncing');
            setIsSaving(true);

            // Validate sync settings
            if (!createNewList && !selectedListId) {
                setError('Please select a contact list for sync or choose to create a new list');
                setIsSaving(false);
                setSyncingStatus(null);
                return;
            }

            if (createNewList && !newListName.trim()) {
                setError('Please provide a name for the new contact list');
                setIsSaving(false);
                setSyncingStatus(null);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/firebase/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    integrationId: integration._id,
                    listId: selectedListId,
                    createNewList,
                    newListName,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to sync Firebase users');
            }

            const data = await res.json();

            if (data.newList) {
                // If a new list was created, update the local state and select it
                setContactLists([...contactLists, data.newList]);
                setSelectedListId(data.newList._id);
                setCreateNewList(false);
            }

            setSuccess(`Successfully synced ${data.importedCount} users from Firebase Auth!`);
            setLastSyncedAt(data.syncedAt);
            setSyncingStatus('success');

            // Refresh integration data to get updated last synced timestamp
            fetchFirebaseIntegration();
        } catch (error) {
            console.error('Error syncing Firebase users:', error);
            setError(error.message);
            setSyncingStatus('error');
        } finally {
            setIsSaving(false);
            // Reset status after 3 seconds
            setTimeout(() => {
                setSyncingStatus(null);
            }, 3000);
        }
    };

    const toggleAutoSync = () => {
        setAutoSyncEnabled(!autoSyncEnabled);
    };

    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="firebase-integration-container">
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
                            <p>Connect your Firebase project to sync user data and track events</p>
                        </div>
                    </div>
                </div>

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

                {/* Integration status */}
                {integration && (
                    <div className="integration-status-panel">
                        <div className="status-indicator active">
                            <div className="status-dot"></div>
                            <span>Connected to Firebase Project: {integration.config.projectId}</span>
                        </div>
                        <div className="status-meta">
                            <span>Connected on {new Date(integration.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>Last updated: {new Date(integration.updatedAt).toLocaleDateString()}</span>
                            {lastSyncedAt && (
                                <>
                                    <span>•</span>
                                    <span>Last synced: {new Date(lastSyncedAt).toLocaleString()}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="integration-setup-container">
                    <div className="setup-card">
                        <div className="setup-header">
                            <h2>{integration ? 'Firebase Integration Settings' : 'Connect to Firebase'}</h2>
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

                            <div className="service-account-section">
                                <h3>Service Account JSON</h3>
                                <p className="section-description">Upload your Firebase service account JSON file to connect to your Firebase project.</p>

                                {integration ? (
                                    <div className="current-connection">
                                        <div className="connection-info">
                                            <div className="info-item">
                                                <span className="label">Project ID:</span>
                                                <span className="value">{integration.config.projectId}</span>
                                            </div>
                                            <div className="info-item">
                                                <span className="label">Client Email:</span>
                                                <span className="value">{integration.config.serviceAccount.client_email}</span>
                                            </div>
                                        </div>

                                        <div className="update-service-account">
                                            <p>To update the service account, upload a new JSON file:</p>
                                            <div className="file-upload-container">
                                                <label
                                                    htmlFor="service-account-file"
                                                    className="file-upload-label"
                                                >
                                                    <Upload size={16} />
                                                    <span>{uploadedFile ? uploadedFile.name : 'Upload New Service Account'}</span>
                                                </label>
                                                <input
                                                    type="file"
                                                    id="service-account-file"
                                                    accept=".json"
                                                    onChange={handleFileChange}
                                                    disabled={isSaving}
                                                    className="file-input"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="file-upload-section">
                                        <div className="instructions">
                                            <div className="instruction-note">
                                                <Info size={16} />
                                                <p>To get your service account JSON file, go to your Firebase project settings, click on "Service accounts" tab, and generate a new private key.</p>
                                            </div>
                                        </div>

                                        <div className="file-upload-container">
                                            <label
                                                htmlFor="service-account-file"
                                                className="file-upload-label primary"
                                            >
                                                <Upload size={16} />
                                                <span>{uploadedFile ? uploadedFile.name : 'Upload Service Account JSON'}</span>
                                            </label>
                                            <input
                                                type="file"
                                                id="service-account-file"
                                                accept=".json"
                                                onChange={handleFileChange}
                                                disabled={isSaving}
                                                className="file-input"
                                            />
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

                            {/* Auth Users Sync Section - only visible when integration exists */}
                            {integration && (
                                <div className="auth-sync-section">
                                    <h3>Firebase Auth Users Sync</h3>
                                    <p className="section-description">Import and automatically sync Firebase Authentication users to a contact list. This feature will sync user data such as email, display name, and phone number.</p>

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
                                                    <span>Testing connection...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`test-status-icon ${syncingStatus}`}>{syncingStatus === 'success' ? <Check size={16} /> : syncingStatus === 'error' ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}</div>
                                                    <span>Test Firebase Auth Connection</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="auto-sync-toggle">
                                        <div className="toggle-label">
                                            <h4>Auto-Sync Firebase Auth Users</h4>
                                            <p>Automatically import new and updated Firebase Auth users every hour</p>
                                        </div>
                                        <button
                                            className="toggle-button"
                                            onClick={toggleAutoSync}
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

                                    {/* List selection section - shown if auto-sync is enabled */}
                                    {autoSyncEnabled && (
                                        <div className="sync-config-section">
                                            <div className="form-group">
                                                <div className="radio-group">
                                                    <label className="radio-label">
                                                        <input
                                                            type="radio"
                                                            checked={!createNewList}
                                                            onChange={() => setCreateNewList(false)}
                                                            disabled={isSaving}
                                                        />
                                                        <span>Use existing contact list</span>
                                                    </label>
                                                </div>

                                                {!createNewList && (
                                                    <div className="contact-list-select">
                                                        <select
                                                            value={selectedListId}
                                                            onChange={(e) => setSelectedListId(e.target.value)}
                                                            disabled={isSaving || isLoadingLists}
                                                        >
                                                            <option value="">Select a contact list</option>
                                                            {contactLists.map((list) => (
                                                                <option
                                                                    key={list._id}
                                                                    value={list._id}
                                                                >
                                                                    {list.name} ({list.contactCount || 0} contacts)
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
                                                        <span>Create a new contact list</span>
                                                    </label>
                                                </div>

                                                {createNewList && (
                                                    <div className="new-list-input">
                                                        <input
                                                            type="text"
                                                            value={newListName}
                                                            onChange={(e) => setNewListName(e.target.value)}
                                                            placeholder="Enter list name"
                                                            disabled={isSaving}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="manual-sync-button-container">
                                                <button
                                                    className="manual-sync-button"
                                                    onClick={triggerManualSync}
                                                    disabled={isSaving || syncingStatus === 'syncing'}
                                                >
                                                    {syncingStatus === 'syncing' ? (
                                                        <>
                                                            <RefreshCw
                                                                size={16}
                                                                className="spinner"
                                                            />
                                                            <span>Syncing users...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserPlus size={16} />
                                                            <span>Sync Users Now</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="sync-info-note">
                                                <Info size={16} />
                                                <p>Auto-sync will import all Firebase Authentication users into the selected contact list. Users will be matched by email address to prevent duplicates. Manual sync can be triggered at any time.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    className="save-button"
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
                                            <span>{integration ? 'Update Integration' : 'Connect Firebase'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Delete confirmation modal */}
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
                                <p>Are you sure you want to disconnect Firebase integration?</p>
                                <p className="warning-text">This will disable all Firebase-related functionality, including user syncing and event tracking.</p>

                                <div className="modal-actions">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={deleteIntegration}
                                        disabled={isSaving}
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
