import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Database, Eye, EyeOff, Save, Check, X, Trash, AlertTriangle, Info, Plus, RefreshCw, Edit, Table, ExternalLink } from 'lucide-react';
import AirtableTableSyncModal from '@/components/integrations/AirtableTableSyncModal';

export default function AirtableIntegration() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [integration, setIntegration] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Table sync state
    const [tableSyncs, setTableSyncs] = useState([]);
    const [availableBases, setAvailableBases] = useState([]);
    const [isLoadingBases, setIsLoadingBases] = useState(false);
    const [contactLists, setContactLists] = useState([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);

    // Modal state
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [editingSyncId, setEditingSyncId] = useState(null);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);

    // Form state
    const [name, setName] = useState('Airtable Integration');
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDeleteSyncConfirm, setShowDeleteSyncConfirm] = useState(false);
    const [deletingSyncId, setDeletingSyncId] = useState(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            fetchAirtableIntegration();
            fetchContactLists();
        }
    }, [status, id, router]);

    useEffect(() => {
        // Set table syncs from integration if available
        if (integration && integration.config) {
            // Ensure tableSyncs exists and is an array
            if (integration.config.tableSyncs) {
                setTableSyncs(Array.isArray(integration.config.tableSyncs) ? integration.config.tableSyncs : []);
            } else {
                setTableSyncs([]);
            }
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

    const fetchAirtableIntegration = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/integrations/airtable`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch Airtable integration');
            }

            const data = await res.json();

            if (data) {
                setIntegration(data);
                setName(data.name || 'Airtable Integration');
            }
        } catch (error) {
            console.error('Error fetching Airtable integration:', error);
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

    const fetchAvailableBases = async () => {
        if (!integration) return;

        try {
            setIsLoadingBases(true);
            const res = await fetch(`/api/brands/${id}/integrations/airtable/bases`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch Airtable bases');
            }

            const data = await res.json();
            setAvailableBases(data.bases || []);
        } catch (error) {
            console.error('Error fetching Airtable bases:', error);
            setError(error.message);
        } finally {
            setIsLoadingBases(false);
        }
    };

    const toggleShowApiKey = () => {
        setShowApiKey(!showApiKey);
    };

    const saveIntegration = async () => {
        try {
            setError('');
            setSuccess('');
            setIsSaving(true);

            if (!apiKey && !integration) {
                setError('Please enter your Airtable API key');
                setIsSaving(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/airtable`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    apiKey: apiKey || integration?.config?.apiKey || '',
                    tableSyncs: tableSyncs,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save Airtable integration');
            }

            const data = await res.json();
            setIntegration(data);
            setSuccess('Airtable integration saved successfully');

            // Clear API key input
            setApiKey('');

            // Refresh integration data
            await fetchAirtableIntegration();
        } catch (error) {
            console.error('Error saving Airtable integration:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const saveIntegrationWithSyncs = async (syncsToSave) => {
        try {
            setError('');
            setSuccess('');
            setIsSaving(true);

            if (!integration && !apiKey) {
                setError('Please enter your Airtable API key');
                setIsSaving(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/airtable`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    apiKey: apiKey || integration?.config?.apiKey || '',
                    tableSyncs: syncsToSave,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save Airtable integration');
            }

            const data = await res.json();
            setIntegration(data);
            setSuccess('Table sync saved successfully');

            // Refresh integration data to ensure we have the latest state
            await fetchAirtableIntegration();
        } catch (error) {
            console.error('Error saving integration with syncs:', error);
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
                throw new Error(data.message || 'Failed to delete Airtable integration');
            }

            setSuccess('Airtable integration deleted successfully');
            setIntegration(null);
            setShowDeleteConfirm(false);
            setTableSyncs([]);

            // Reset form
            setName('Airtable Integration');
            setApiKey('');
        } catch (error) {
            console.error('Error deleting Airtable integration:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const testConnection = async () => {
        if (!integration) return;

        try {
            setError('');
            setIsTestingConnection(true);
            setConnectionStatus('testing');

            const res = await fetch(`/api/brands/${id}/integrations/airtable/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to test Airtable connection');
            }

            const data = await res.json();
            setConnectionStatus('success');
            setSuccess(`Connection test successful! Found ${data.bases.length} bases.`);

            // Fetch available bases after successful connection test
            fetchAvailableBases();
        } catch (error) {
            console.error('Error testing Airtable connection:', error);
            setError(error.message);
            setConnectionStatus('error');
        } finally {
            setIsTestingConnection(false);
            // Reset status after 3 seconds
            setTimeout(() => {
                setConnectionStatus(null);
            }, 3000);
        }
    };

    const handleAddTableSync = () => {
        setEditingSyncId(null);
        setShowSyncModal(true);
    };

    const handleEditTableSync = (syncId) => {
        setEditingSyncId(syncId);
        setShowSyncModal(true);
    };

    const handleSaveTableSync = (syncData) => {
        let updatedSyncs = [];

        if (editingSyncId) {
            // Update existing sync
            updatedSyncs = tableSyncs.map((sync) => (sync.id === editingSyncId ? { ...syncData, id: editingSyncId } : sync));
        } else {
            // Add new sync
            const newSync = {
                ...syncData,
                id: `sync-${Date.now()}`,
                createdAt: new Date().toISOString(),
            };
            updatedSyncs = [...tableSyncs, newSync];
        }

        // Update local state
        setTableSyncs(updatedSyncs);

        // Save changes to the database immediately
        saveIntegrationWithSyncs(updatedSyncs);

        // Close modal and reset editing state
        setShowSyncModal(false);
        setEditingSyncId(null);
    };

    const confirmDeleteSync = (syncId) => {
        setDeletingSyncId(syncId);
        setShowDeleteSyncConfirm(true);
    };

    const handleDeleteSync = () => {
        if (!deletingSyncId) return;

        const updatedSyncs = tableSyncs.filter((sync) => sync.id !== deletingSyncId);
        setTableSyncs(updatedSyncs);
        saveIntegrationWithSyncs(updatedSyncs);

        setShowDeleteSyncConfirm(false);
        setDeletingSyncId(null);
    };

    const getEditingSyncData = () => {
        if (!editingSyncId) return null;
        return tableSyncs.find((sync) => sync.id === editingSyncId);
    };

    const handleRunSync = async (syncId) => {
        const syncToRun = tableSyncs.find((sync) => sync.id === syncId);
        if (!syncToRun) return;

        try {
            setError('');

            // Update sync status to syncing
            const syncIndex = tableSyncs.findIndex((sync) => sync.id === syncId);
            const updatedTableSyncs = [...tableSyncs];
            updatedTableSyncs[syncIndex].status = 'syncing';
            setTableSyncs(updatedTableSyncs);

            // Save the updated status to the database
            await saveIntegrationWithSyncs(updatedTableSyncs);

            // Call the API to perform the sync
            const res = await fetch(`/api/brands/${id}/integrations/airtable/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    syncId: syncId,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to sync Airtable data');
            }

            const data = await res.json();

            // Update the sync status, timestamp, and results
            const newTableSyncs = [...tableSyncs];
            const updatedSyncIndex = newTableSyncs.findIndex((sync) => sync.id === syncId);

            if (updatedSyncIndex !== -1) {
                newTableSyncs[updatedSyncIndex] = {
                    ...newTableSyncs[updatedSyncIndex],
                    status: 'success',
                    lastSyncedAt: new Date().toISOString(),
                    lastSyncResult: {
                        importedCount: data.importedCount,
                        updatedCount: data.updatedCount,
                        skippedCount: data.skippedCount,
                        totalCount: data.totalCount,
                    },
                };

                // Update state and save to database
                setTableSyncs(newTableSyncs);
                await saveIntegrationWithSyncs(newTableSyncs);
            }

            setSuccess(`Successfully synced ${data.importedCount} contacts from Airtable!`);
        } catch (error) {
            console.error('Error syncing Airtable data:', error);
            setError(error.message);

            // Update the sync status to error
            const errorTableSyncs = [...tableSyncs];
            const errorSyncIndex = errorTableSyncs.findIndex((sync) => sync.id === syncId);

            if (errorSyncIndex !== -1) {
                errorTableSyncs[errorSyncIndex].status = 'error';
                setTableSyncs(errorTableSyncs);
                await saveIntegrationWithSyncs(errorTableSyncs);
            }
        }
    };

    const getContactListName = (listId) => {
        const list = contactLists.find((list) => list._id === listId);
        return list ? list.name : 'Unknown List';
    };

    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="airtable-integration-container">
                <div className="integration-header">
                    <Link
                        href={`/brands/${id}/integrations`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Integrations</span>
                    </Link>

                    <div className="header-content">
                        <div className="header-icon airtable">
                            <Database size={24} />
                        </div>
                        <div className="header-text">
                            <h1>Airtable Integration</h1>
                            <p>Connect your Airtable account to import contacts and sync data</p>
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
                            <span>Connected to Airtable</span>
                        </div>
                        <div className="status-meta">
                            <span>Connected on {new Date(integration.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>Last updated: {new Date(integration.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                )}

                <div className="integration-setup-container">
                    <div className="setup-card">
                        <div className="setup-header">
                            <h2>{integration ? 'Airtable Integration Settings' : 'Connect to Airtable'}</h2>
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
                                    placeholder="Airtable Integration"
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="api-key-section">
                                <h3>API Key</h3>
                                <p className="section-description">Enter your Airtable API key to connect to your Airtable account.</p>

                                {integration ? (
                                    <div className="current-connection">
                                        <div className="connection-info">
                                            <div className="info-item">
                                                <span className="label">API Key:</span>
                                                <span className="value api-key">
                                                    {showApiKey ? integration.config.apiKey : '••••••••••••••••••••••••••'}
                                                    <button
                                                        className="toggle-visibility"
                                                        onClick={toggleShowApiKey}
                                                        type="button"
                                                    >
                                                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="test-connection-container">
                                            <button
                                                className="test-connection-button"
                                                onClick={testConnection}
                                                disabled={isTestingConnection}
                                            >
                                                {isTestingConnection ? (
                                                    <>
                                                        <RefreshCw
                                                            size={16}
                                                            className="spinner"
                                                        />
                                                        <span>Testing connection...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className={`test-status-icon ${connectionStatus}`}>{connectionStatus === 'success' ? <Check size={16} /> : connectionStatus === 'error' ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}</div>
                                                        <span>Test Airtable Connection</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <div className="update-api-key">
                                            <p>To update your API key, enter a new one below:</p>
                                            <div className="api-key-input-group">
                                                <input
                                                    type={showApiKey ? 'text' : 'password'}
                                                    id="api-key"
                                                    value={apiKey}
                                                    onChange={(e) => setApiKey(e.target.value)}
                                                    placeholder="Enter new API key"
                                                    disabled={isSaving}
                                                    className="api-key-input"
                                                />
                                                <button
                                                    className="toggle-visibility-button"
                                                    onClick={toggleShowApiKey}
                                                    type="button"
                                                >
                                                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="api-key-section-2">
                                        <div className="instructions">
                                            <div className="instruction-note">
                                                <Info size={16} />
                                                <p>To get your Airtable API key, go to your Airtable account settings and under the API section, generate or view your API key.</p>
                                            </div>
                                        </div>

                                        <div className="api-key-input-group">
                                            <input
                                                type={showApiKey ? 'text' : 'password'}
                                                id="api-key"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                placeholder="Enter your Airtable API key"
                                                disabled={isSaving}
                                                className="api-key-input"
                                            />
                                            <button
                                                className="toggle-visibility-button"
                                                onClick={toggleShowApiKey}
                                                type="button"
                                            >
                                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Table Sync Section - only visible when integration exists */}
                            {integration && (
                                <div className="airtable-sync-section">
                                    <h3>Airtable Table Sync</h3>
                                    <p className="section-description">Configure which Airtable bases and tables to sync with your contact lists. You can set up multiple syncs for different tables and bases.</p>

                                    {tableSyncs.length > 0 ? (
                                        <div className="table-syncs-list">
                                            {tableSyncs.map((sync) => (
                                                <div
                                                    key={sync.id}
                                                    className="table-sync-item"
                                                >
                                                    <div className="sync-item-header">
                                                        <div className="sync-item-icon">
                                                            <Table size={20} />
                                                        </div>
                                                        <div className="sync-item-title">
                                                            <h4>{sync.name}</h4>
                                                            <span className="sync-meta">
                                                                Base: {sync.baseName} • Table: {sync.tableName} • List: {getContactListName(sync.contactListId)}
                                                            </span>
                                                        </div>
                                                        <div className="sync-item-actions">
                                                            <button
                                                                className="sync-action-button edit"
                                                                onClick={() => handleEditTableSync(sync.id)}
                                                                title="Edit Sync"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                className="sync-action-button delete"
                                                                onClick={() => confirmDeleteSync(sync.id)}
                                                                title="Delete Sync"
                                                            >
                                                                <Trash size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="sync-item-body">
                                                        <div className="sync-sheet-info">
                                                            <span>
                                                                <strong>Table:</strong> {sync.tableName}
                                                            </span>
                                                            {sync.baseUrl && (
                                                                <a
                                                                    href={sync.baseUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="sheet-link"
                                                                >
                                                                    Open in Airtable <ExternalLink size={14} />
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div className="sync-mapping-info">
                                                            <div className="mapping-item">
                                                                <span className="mapping-label">Email:</span>
                                                                <span className="mapping-value">{sync.mapping.email}</span>
                                                            </div>
                                                            <div className="mapping-item">
                                                                <span className="mapping-label">First Name:</span>
                                                                <span className="mapping-value">{sync.mapping.firstName || '—'}</span>
                                                            </div>
                                                            <div className="mapping-item">
                                                                <span className="mapping-label">Last Name:</span>
                                                                <span className="mapping-value">{sync.mapping.lastName || '—'}</span>
                                                            </div>
                                                            <div className="mapping-item">
                                                                <span className="mapping-label">Phone:</span>
                                                                <span className="mapping-value">{sync.mapping.phone || '—'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="sync-schedule-info">
                                                            <div className="schedule-details">
                                                                <span className="schedule-status">
                                                                    <span className={`status-dot ${sync.autoSync ? 'active' : 'inactive'}`}></span>
                                                                    {sync.autoSync ? 'Auto-sync every hour' : 'Manual sync only'}
                                                                </span>
                                                                {sync.lastSyncedAt && <span className="last-synced">Last synced: {new Date(sync.lastSyncedAt).toLocaleString()}</span>}
                                                                {sync.lastSyncResult && (
                                                                    <span className="sync-result">
                                                                        Result: {sync.lastSyncResult.importedCount} imported,
                                                                        {sync.lastSyncResult.updatedCount} updated,
                                                                        {sync.lastSyncResult.skippedCount} skipped
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                className="sync-now-button"
                                                                onClick={() => handleRunSync(sync.id)}
                                                                disabled={sync.status === 'syncing'}
                                                            >
                                                                {sync.status === 'syncing' ? (
                                                                    <>
                                                                        <RefreshCw
                                                                            size={16}
                                                                            className="spinner"
                                                                        />
                                                                        <span>Syncing...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <RefreshCw size={16} />
                                                                        <span>Sync Now</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-syncs">
                                            <Database size={32} />
                                            <p>No table syncs configured</p>
                                            <p className="empty-syncs-description">Add a table sync to import contacts from Airtable</p>
                                        </div>
                                    )}

                                    <div className="add-sync-container">
                                        <button
                                            className="add-sync-button"
                                            onClick={handleAddTableSync}
                                        >
                                            <Plus size={16} />
                                            <span>Add Table Sync</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    className="save-button"
                                    onClick={saveIntegration}
                                    disabled={isSaving || (!apiKey && !integration)}
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="spinner-sm"></div>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>{integration ? 'Update Integration' : 'Connect Airtable'}</span>
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
                                <h3>Disconnect Airtable</h3>
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
                                <p>Are you sure you want to disconnect Airtable integration?</p>
                                <p className="warning-text">This will disable all Airtable-related functionality, including data imports and syncing.</p>

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

                {/* Delete sync confirmation modal */}
                {showDeleteSyncConfirm && (
                    <div className="modal-overlay">
                        <div className="modal-container delete-modal">
                            <div className="modal-header">
                                <h3>Delete Table Sync</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowDeleteSyncConfirm(false)}
                                    disabled={isSaving}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="modal-content">
                                <div className="warning-icon">
                                    <AlertTriangle size={32} />
                                </div>
                                <p>Are you sure you want to delete this table sync?</p>
                                <p className="warning-text">This will stop syncing data between this Airtable table and your contact list.</p>

                                <div className="modal-actions">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowDeleteSyncConfirm(false)}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleDeleteSync}
                                        disabled={isSaving}
                                    >
                                        <Trash size={16} />
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table Sync Modal */}
                {showSyncModal && (
                    <AirtableTableSyncModal
                        availableBases={availableBases}
                        contactLists={contactLists}
                        initialData={getEditingSyncData()}
                        onClose={() => setShowSyncModal(false)}
                        onSave={handleSaveTableSync}
                        isLoadingBases={isLoadingBases}
                        onFetchBases={fetchAvailableBases}
                        brandId={id}
                    />
                )}
            </div>
        </BrandLayout>
    );
}
