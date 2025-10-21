import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, FileSpreadsheet, Upload, Save, Check, X, Trash, AlertTriangle, Info, Plus, RefreshCw, Edit, Table, ExternalLink } from 'lucide-react';
import SheetsTableSyncModal from '@/components/integrations/SheetsTableSyncModal';

export default function GoogleSheetsIntegration() {
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
    const [availableSheets, setAvailableSheets] = useState([]);
    const [isLoadingSheets, setIsLoadingSheets] = useState(false);
    const [contactLists, setContactLists] = useState([]);
    const [isLoadingLists, setIsLoadingLists] = useState(false);

    // Modal state
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [editingSyncId, setEditingSyncId] = useState(null);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);

    // Form state
    const [name, setName] = useState('Google Sheets Integration');
    const [serviceAccountJson, setServiceAccountJson] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [validationError, setValidationError] = useState('');
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
            fetchGoogleSheetsIntegration();
            fetchContactLists();
        }
    }, [status, id, router]);

    useEffect(() => {
        // Set table syncs from integration if available
        if (integration && integration.config && integration.config.tableSyncs) {
            setTableSyncs(integration.config.tableSyncs || []);
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

    const fetchGoogleSheetsIntegration = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/integrations/google-sheets`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch Google Sheets integration');
            }

            const data = await res.json();

            if (data) {
                setIntegration(data);
                setName(data.name || 'Google Sheets Integration');
            }
        } catch (error) {
            console.error('Error fetching Google Sheets integration:', error);
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

    const fetchAvailableSheets = async () => {
        if (!integration) return;

        try {
            setIsLoadingSheets(true);
            const res = await fetch(`/api/brands/${id}/integrations/google-sheets/sheets`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch Google Sheets');
            }

            const data = await res.json();
            setAvailableSheets(data.sheets || []);
        } catch (error) {
            console.error('Error fetching Google Sheets:', error);
            setError(error.message);
        } finally {
            setIsLoadingSheets(false);
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
                setValidationError('Invalid JSON format. Please upload a valid Google service account file.');
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
                setError('Please upload a Google service account JSON file');
                setIsSaving(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/google-sheets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    serviceAccountJson: serviceAccountJson || JSON.stringify(integration.config.serviceAccount),
                    tableSyncs: tableSyncs,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save Google Sheets integration');
            }

            const data = await res.json();
            setIntegration(data);
            setSuccess('Google Sheets integration saved successfully');

            // Clear file upload state
            setUploadedFile(null);
            setServiceAccountJson('');

            // Refresh integration data
            fetchGoogleSheetsIntegration();
        } catch (error) {
            console.error('Error saving Google Sheets integration:', error);
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
                throw new Error(data.message || 'Failed to delete Google Sheets integration');
            }

            setSuccess('Google Sheets integration deleted successfully');
            setIntegration(null);
            setShowDeleteConfirm(false);
            setTableSyncs([]);

            // Reset form
            setName('Google Sheets Integration');
            setServiceAccountJson('');
            setUploadedFile(null);
        } catch (error) {
            console.error('Error deleting Google Sheets integration:', error);
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

            const res = await fetch(`/api/brands/${id}/integrations/google-sheets/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to test Google Sheets connection');
            }

            const data = await res.json();
            setConnectionStatus('success');
            setSuccess(`Connection test successful! Found ${data.spreadsheets.length} spreadsheets.`);

            // Fetch available sheets after successful connection test
            fetchAvailableSheets();
        } catch (error) {
            console.error('Error testing Google Sheets connection:', error);
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

    // In the Google Sheets integration page
    const handleSaveTableSync = (syncData) => {
        let updatedSyncs = [];

        // If creating a new list, make sure contactListId is null or undefined, not an empty string
        if (syncData.createNewList) {
            syncData.contactListId = null; // or undefined
        } else if (!syncData.contactListId) {
            // If not creating a new list and no list selected, show error
            setError('Please select a contact list or choose to create a new one');
            return;
        }

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

    const saveIntegrationWithSyncs = async (syncsToSave) => {
        try {
            setError('');
            setSuccess('');
            setIsSaving(true);

            console.log('Saving integration with syncs:', syncsToSave);

            if (!integration && !serviceAccountJson) {
                setError('Please upload a Google service account JSON file');
                setIsSaving(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/integrations/google-sheets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    serviceAccountJson: serviceAccountJson || JSON.stringify(integration.config.serviceAccount),
                    tableSyncs: syncsToSave,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save Google Sheets integration');
            }

            const data = await res.json();
            console.log('Integration saved successfully:', data);
            setIntegration(data);
            setSuccess('Table sync saved successfully');

            // Refresh integration data to ensure we have the latest state
            fetchGoogleSheetsIntegration();
        } catch (error) {
            console.error('Error saving integration with syncs:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDeleteSync = (syncId) => {
        setDeletingSyncId(syncId);
        setShowDeleteSyncConfirm(true);
    };

    const handleDeleteSync = async () => {
        if (!deletingSyncId) return;

        try {
            setIsSaving(true);

            // Call the API to remove the sync
            const res = await fetch(`/api/brands/${id}/integrations/google-sheets/remove-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    syncId: deletingSyncId,
                    removeData: false, // Change to true if you want to also remove the imported contacts
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to remove sync');
            }

            // Update local state
            const updatedTableSyncs = tableSyncs.filter((sync) => sync.id !== deletingSyncId);
            setTableSyncs(updatedTableSyncs);

            setSuccess('Sync configuration removed successfully');

            // Refresh the integration data to ensure everything is in sync
            await fetchGoogleSheetsIntegration();
        } catch (error) {
            console.error('Error removing sync:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
            setShowDeleteSyncConfirm(false);
            setDeletingSyncId(null);
        }
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
            const res = await fetch(`/api/brands/${id}/integrations/google-sheets/sync`, {
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
                throw new Error(data.message || 'Failed to sync Google Sheets data');
            }

            const data = await res.json();
            console.log('Sync completed successfully:', data);

            // Check if a new list was created during the sync
            if (data.newList) {
                console.log('New list was created:', data.newList);

                // Refresh the entire integration to get the updated tableSyncs with the new contactListId
                await fetchGoogleSheetsIntegration();
                setSuccess(`Successfully synced ${data.importedCount} contacts from Google Sheets to new list: ${data.newList.name}!`);
                return;
            }

            // If no new list was created, just update the sync status
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

            setSuccess(`Successfully synced ${data.importedCount} contacts from Google Sheets!`);
        } catch (error) {
            console.error('Error syncing Google Sheets data:', error);
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
            <div className="google-sheets-integration-container">
                <div className="integration-header">
                    <Link
                        href={`/brands/${id}/integrations`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Integrations</span>
                    </Link>

                    <div className="header-content">
                        <div className="header-icon google-sheets">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div className="header-text">
                            <h1>Google Sheets Integration</h1>
                            <p>Connect to Google Sheets to import and export contacts data</p>
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
                            <span>Connected to Google Sheets - Project: {integration.config.projectId}</span>
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
                            <h2>{integration ? 'Google Sheets Integration Settings' : 'Connect to Google Sheets'}</h2>
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
                                    placeholder="Google Sheets Integration"
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="service-account-section">
                                <h3>Service Account</h3>
                                <p className="section-description">Upload your Google service account JSON file to connect to Google Sheets.</p>

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
                                                        <span>Test Google Sheets Connection</span>
                                                    </>
                                                )}
                                            </button>
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
                                                <p>To get your service account JSON file:</p>
                                                <ol className="instruction-steps">
                                                    <li>
                                                        Go to the{' '}
                                                        <a
                                                            href="https://console.cloud.google.com/projectcreate"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Google Cloud Console
                                                        </a>
                                                    </li>
                                                    <li>Create a project or select an existing one</li>
                                                    <li>Enable the Google Sheets API for the project</li>
                                                    <li>Create a service account with &ldquo;Editor&ldquo; permission</li>
                                                    <li>Create a key for the service account (JSON format)</li>
                                                    <li>Download and upload the JSON file below</li>
                                                </ol>
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

                            {/* Table Sync Section - only visible when integration exists */}
                            {integration && (
                                <div className="sheets-sync-section">
                                    <h3>Google Sheets Table Sync</h3>
                                    <p className="section-description">Configure which Google Sheets tables to sync with your contact lists. You can set up multiple syncs for different sheets and spreadsheets.</p>

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
                                                                Sheet: {sync.sheetName} • List: {getContactListName(sync.contactListId)}
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
                                                                <strong>Spreadsheet:</strong> {sync.spreadsheetName}
                                                            </span>
                                                            {sync.spreadsheetUrl && (
                                                                <a
                                                                    href={sync.spreadsheetUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="sheet-link"
                                                                >
                                                                    Open <ExternalLink size={14} />
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
                                            <FileSpreadsheet size={32} />
                                            <p>No table syncs configured</p>
                                            <p className="empty-syncs-description">Add a table sync to import contacts from Google Sheets</p>
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
                                            <span>{integration ? 'Update Integration' : 'Connect Google Sheets'}</span>
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
                                <h3>Disconnect Google Sheets</h3>
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
                                <p>Are you sure you want to disconnect Google Sheets integration?</p>
                                <p className="warning-text">This will disable all Google Sheets functionality, including data imports and exports.</p>

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
                                <p className="warning-text">This will stop syncing data between this Google Sheet and your contact list.</p>

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
                    <SheetsTableSyncModal
                        availableSheets={availableSheets}
                        contactLists={contactLists}
                        initialData={getEditingSyncData()}
                        onClose={() => setShowSyncModal(false)}
                        onSave={handleSaveTableSync}
                        isLoadingSheets={isLoadingSheets}
                        onFetchSheets={fetchAvailableSheets}
                        brandId={id}
                    />
                )}
            </div>
        </BrandLayout>
    );
}
