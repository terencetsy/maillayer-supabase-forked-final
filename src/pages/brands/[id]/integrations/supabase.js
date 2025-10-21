// src/pages/brands/[id]/integrations/supabase.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Database, Eye, EyeOff, Save, Check, X, Trash, AlertTriangle, Info, Plus, RefreshCw, Edit, Table, ExternalLink } from 'lucide-react';
import SupabaseTableSyncModal from '@/components/integrations/SupabaseTableSyncModal';

export default function SupabaseIntegration() {
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
    const [availableTables, setAvailableTables] = useState([]);
    const [isLoadingTables, setIsLoadingTables] = useState(false);
    const [contactLists, setContactLists] = useState([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);

    // Modal state
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [editingSyncId, setEditingSyncId] = useState(null);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);

    // Form state
    const [name, setName] = useState('Supabase Integration');
    const [url, setUrl] = useState('');
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
            fetchSupabaseIntegration();
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

    const fetchSupabaseIntegration = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/integrations/supabase`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch Supabase integration');
            }

            const data = await res.json();

            if (data) {
                setIntegration(data);
                setName(data.name || 'Supabase Integration');
                setUrl(data.config.url || '');
            }
        } catch (error) {
            console.error('Error fetching Supabase integration:', error);
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

    const fetchAvailableTables = async () => {
        if (!integration) return;

        try {
            setIsLoadingTables(true);
            const res = await fetch(`/api/brands/${id}/integrations/supabase/tables`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch Supabase tables');
            }

            const data = await res.json();
            setAvailableTables(data.tables || []);
        } catch (error) {
            console.error('Error fetching Supabase tables:', error);
            setError(error.message);
        } finally {
            setIsLoadingTables(false);
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

            if (!url) {
                setError('Please enter your Supabase URL');
                setIsSaving(false);
                return;
            }

            if (!apiKey && !integration) {
                setError('Please enter your Supabase API key');
                setIsSaving(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/supabase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    url,
                    apiKey: apiKey || integration?.config?.apiKey || '',
                    tableSyncs: tableSyncs,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save Supabase integration');
            }

            const data = await res.json();
            setIntegration(data);
            setSuccess('Supabase integration saved successfully');

            // Clear API key input
            setApiKey('');

            // Refresh integration data
            await fetchSupabaseIntegration();
        } catch (error) {
            console.error('Error saving Supabase integration:', error);
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

            if (!integration && !url) {
                setError('Please enter your Supabase URL');
                setIsSaving(false);
                return;
            }

            if (!integration && !apiKey) {
                setError('Please enter your Supabase API key');
                setIsSaving(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/supabase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    url: url || integration?.config?.url || '',
                    apiKey: apiKey || integration?.config?.apiKey || '',
                    tableSyncs: syncsToSave,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save Supabase integration');
            }

            const data = await res.json();
            setIntegration(data);
            setSuccess('Table sync saved successfully');

            // Refresh integration data to ensure we have the latest state
            await fetchSupabaseIntegration();
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
                throw new Error(data.message || 'Failed to delete Supabase integration');
            }

            setSuccess('Supabase integration deleted successfully');
            setIntegration(null);
            setShowDeleteConfirm(false);
            setTableSyncs([]);

            // Reset form
            setName('Supabase Integration');
            setUrl('');
            setApiKey('');
        } catch (error) {
            console.error('Error deleting Supabase integration:', error);
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

            const res = await fetch(`/api/brands/${id}/integrations/supabase/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to test Supabase connection');
            }

            const data = await res.json();
            setConnectionStatus('success');
            setSuccess(`Connection test successful! Found ${data.tables.length} tables.`);

            // Fetch available tables after successful connection test
            fetchAvailableTables();
        } catch (error) {
            console.error('Error testing Supabase connection:', error);
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
            const res = await fetch(`/api/brands/${id}/integrations/supabase/sync`, {
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
                throw new Error(data.message || 'Failed to sync Supabase data');
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

            setSuccess(`Successfully synced ${data.importedCount} contacts from Supabase!`);
        } catch (error) {
            console.error('Error syncing Supabase data:', error);
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
            <div className="supabase-integration-container">
                <div className="integration-header">
                    <Link
                        href={`/brands/${id}/integrations`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Integrations</span>
                    </Link>

                    <div className="header-content">
                        <div className="header-icon supabase">
                            <Database size={24} />
                        </div>
                        <div className="header-text">
                            <h1>Supabase Integration</h1>
                            <p>Connect your Supabase project to import contacts and sync user data</p>
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
                            <span>Connected to Supabase Project: {integration.config.projectId}</span>
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
                            <h2>{integration ? 'Supabase Integration Settings' : 'Connect to Supabase'}</h2>
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
                                    placeholder="Supabase Integration"
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="api-key-section">
                                <h3>Supabase Connection</h3>
                                <p className="section-description">Enter your Supabase URL and API key to connect to your Supabase project.</p>

                                <div className="form-group">
                                    <label htmlFor="supabase-url">Supabase URL</label>
                                    <input
                                        type="text"
                                        id="supabase-url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://your-project.supabase.co"
                                        disabled={isSaving}
                                    />
                                </div>

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
                                                        <span>Test Supabase Connection</span>
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
                                                <p>To get your Supabase API key, go to your Supabase project dashboard, navigate to Project Settings {`>`} API, and find your &ldquo;anon&ldquo; or &ldquo;service_role&ldquo; key.</p>
                                            </div>
                                        </div>

                                        <div className="api-key-input-group">
                                            <input
                                                type={showApiKey ? 'text' : 'password'}
                                                id="api-key"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                placeholder="Enter your Supabase API key"
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
                                <div className="supabase-sync-section">
                                    <h3>Supabase Table Sync</h3>
                                    <p className="section-description">Configure which Supabase tables to sync with your contact lists. You can set up multiple syncs for different tables.</p>

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
                                                                Table: {sync.tableName} • List: {getContactListName(sync.contactListId)}
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
                                            <p className="empty-syncs-description">Add a table sync to import contacts from Supabase</p>
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
                                    disabled={isSaving || (!apiKey && !integration) || !url}
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="spinner-sm"></div>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>{integration ? 'Update Integration' : 'Connect Supabase'}</span>
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
                                <h3>Disconnect Supabase</h3>
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
                                <p>Are you sure you want to disconnect Supabase integration?</p>
                                <p className="warning-text">This will disable all Supabase-related functionality, including data imports and syncing.</p>

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
                                <p className="warning-text">This will stop syncing data between this Supabase table and your contact list.</p>

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
                    <SupabaseTableSyncModal
                        availableTables={availableTables}
                        contactLists={contactLists}
                        initialData={getEditingSyncData()}
                        onClose={() => setShowSyncModal(false)}
                        onSave={handleSaveTableSync}
                        isLoadingTables={isLoadingTables}
                        onFetchTables={fetchAvailableTables}
                        brandId={id}
                    />
                )}
            </div>
        </BrandLayout>
    );
}
