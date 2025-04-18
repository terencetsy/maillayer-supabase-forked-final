import { useState, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle, Info, Check, Table, Database, ToggleLeft, ToggleRight } from 'lucide-react';

export default function AirtableTableSyncModal({ availableBases, contactLists, initialData, onClose, onSave, isLoadingBases, onFetchBases, brandId }) {
    // State for the form
    const [name, setName] = useState('');
    const [baseId, setBaseId] = useState('');
    const [tableId, setTableId] = useState('');
    const [contactListId, setContactListId] = useState('');
    const [createNewList, setCreateNewList] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [autoSync, setAutoSync] = useState(true);
    const [mapping, setMapping] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [tableFields, setTableFields] = useState([]);
    const [error, setError] = useState('');
    const [activeBase, setActiveBase] = useState(null);
    const [tableLists, setTableLists] = useState([]);
    const [activeTable, setActiveTable] = useState(null);

    // Initialize form with initial data if editing
    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setBaseId(initialData.baseId || '');
            setTableId(initialData.tableId || '');
            setContactListId(initialData.contactListId || '');
            setCreateNewList(initialData.createNewList || false);
            setNewListName(initialData.newListName || '');
            setAutoSync(initialData.autoSync !== undefined ? initialData.autoSync : true);
            setMapping(
                initialData.mapping || {
                    email: '',
                    firstName: '',
                    lastName: '',
                    phone: '',
                }
            );

            // Find active base and table from available bases
            if (initialData.baseId) {
                const base = availableBases.find((b) => b.id === initialData.baseId);
                if (base) {
                    setActiveBase(base);
                    if (initialData.tableId) {
                        const table = base.tables.find((t) => t.id === initialData.tableId);
                        if (table) {
                            setActiveTable(table);
                        }
                    }
                }
            }
        }
    }, [initialData]);

    // Handle base selection
    const handleBaseChange = async (e) => {
        const selectedBaseId = e.target.value;
        setBaseId(selectedBaseId);
        setTableId('');
        setActiveTable(null);

        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${brandId}/integrations/airtable/fields`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    baseId: selectedBaseId,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to fetch table fields');
            }

            const data = await res.json();
            console.log(data);
            setTableLists(data || []);
        } catch (error) {
            console.error('Error fetching table fields:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle table selection
    const handleTableChange = (e) => {
        const selectedTableId = e.target.value;
        setTableId(selectedTableId);

        // Find and set the active table
        const table = tableLists.find((t) => t.id === selectedTableId);
        console.log(table);
        if (table) {
            setActiveTable(table);
            // Fetch fields for this table
            setTableFields(table.fields || []);
        } else {
            setActiveTable(null);
            setTableFields([]);
        }
    };

    // Handle mapping changes
    const handleMappingChange = (field, value) => {
        setMapping((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Handle form submission
    const handleSave = () => {
        // Validate form
        if (!name) {
            setError('Please enter a name for this sync');
            return;
        }

        if (!baseId) {
            setError('Please select a base');
            return;
        }

        if (!tableId) {
            setError('Please select a table');
            return;
        }

        if (!mapping.email) {
            setError('Please select a field for email mapping');
            return;
        }

        if (!createNewList && !contactListId) {
            setError('Please select a contact list or create a new one');
            return;
        }

        if (createNewList && !newListName) {
            setError('Please enter a name for the new contact list');
            return;
        }

        // Prepare the data
        const syncData = {
            name,
            baseId,
            baseName: activeBase ? activeBase.name : '',
            baseUrl: activeBase ? activeBase.url : '',
            tableId,
            tableName: activeTable ? activeTable.name : '',
            contactListId,
            createNewList,
            newListName,
            autoSync,
            mapping,
            status: 'idle',
            lastSyncedAt: initialData ? initialData.lastSyncedAt : null,
            lastSyncResult: initialData ? initialData.lastSyncResult : null,
        };

        console.log('Saving sync data:', syncData);

        // Save the sync
        try {
            onSave(syncData);
        } catch (err) {
            console.error('Error saving sync data:', err);
            setError(`Failed to save sync configuration: ${err.message}`);
        }
    };

    // Toggle auto-sync
    const toggleAutoSync = () => {
        setAutoSync(!autoSync);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container sheets-sync-modal">
                <div className="modal-header">
                    <h3>{initialData ? 'Edit Table Sync' : 'Add Table Sync'}</h3>
                    <button
                        className="close-btn"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-content">
                    {error && (
                        <div className="modal-error">
                            <AlertTriangle size={16} />
                            <span>{error}</span>
                            <button
                                onClick={() => setError('')}
                                className="close-error"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <div className="sync-form">
                        <div className="form-group">
                            <label htmlFor="sync-name">Sync Name</label>
                            <input
                                type="text"
                                id="sync-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Newsletter Subscribers"
                                required
                            />
                        </div>

                        <div className="form-section">
                            <h4 className="section-title">Airtable Selection</h4>

                            <div className="sheet-selection-actions">
                                <button
                                    className="refresh-sheets-button"
                                    onClick={onFetchBases}
                                    disabled={isLoadingBases}
                                >
                                    {isLoadingBases ? (
                                        <RefreshCw
                                            size={14}
                                            className="spinner"
                                        />
                                    ) : (
                                        <RefreshCw size={14} />
                                    )}
                                    <span>Refresh Bases</span>
                                </button>
                            </div>

                            <div className="form-group">
                                <label htmlFor="base">Base</label>
                                <select
                                    id="base"
                                    value={baseId}
                                    onChange={handleBaseChange}
                                    required
                                >
                                    <option value="">Select a base</option>
                                    {availableBases.map((base) => (
                                        <option
                                            key={base.id}
                                            value={base.id}
                                        >
                                            {base.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {tableLists.length > 0 && (
                                <div className="form-group">
                                    <label htmlFor="table">Table</label>
                                    <select
                                        id="table"
                                        value={tableId}
                                        onChange={handleTableChange}
                                        required
                                    >
                                        <option value="">Select a table</option>
                                        {tableLists.map((table) => (
                                            <option
                                                key={table.id}
                                                value={table.id}
                                            >
                                                {table.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="form-section">
                            <h4 className="section-title">Field Mapping</h4>
                            <div className="field-description">Map Airtable fields to contact fields</div>

                            <div className="mapping-fields">
                                <div className="form-group required">
                                    <label htmlFor="email-field">Email (required)</label>
                                    <select
                                        id="email-field"
                                        value={mapping.email}
                                        onChange={(e) => handleMappingChange('email', e.target.value)}
                                        required
                                    >
                                        <option value="">Select a field</option>
                                        {tableFields.map((field) => (
                                            <option
                                                key={field.id}
                                                value={field.id}
                                            >
                                                {field.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="first-name-field">First Name</label>
                                    <select
                                        id="first-name-field"
                                        value={mapping.firstName}
                                        onChange={(e) => handleMappingChange('firstName', e.target.value)}
                                    >
                                        <option value="">Select a field</option>
                                        {tableFields.map((field) => (
                                            <option
                                                key={field.id}
                                                value={field.id}
                                            >
                                                {field.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="last-name-field">Last Name</label>
                                    <select
                                        id="last-name-field"
                                        value={mapping.lastName}
                                        onChange={(e) => handleMappingChange('lastName', e.target.value)}
                                    >
                                        <option value="">Select a field</option>
                                        {tableFields.map((field) => (
                                            <option
                                                key={field.id}
                                                value={field.id}
                                            >
                                                {field.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="phone-field">Phone</label>
                                    <select
                                        id="phone-field"
                                        value={mapping.phone}
                                        onChange={(e) => handleMappingChange('phone', e.target.value)}
                                    >
                                        <option value="">Select a field</option>
                                        {tableFields.map((field) => (
                                            <option
                                                key={field.id}
                                                value={field.id}
                                            >
                                                {field.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h4 className="section-title">Contact List</h4>

                            <div className="form-group">
                                <div className="radio-group">
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            checked={!createNewList}
                                            onChange={() => setCreateNewList(false)}
                                        />
                                        <span>Use existing contact list</span>
                                    </label>
                                </div>

                                {!createNewList && (
                                    <div className="contact-list-select">
                                        <select
                                            value={contactListId}
                                            onChange={(e) => setContactListId(e.target.value)}
                                            required={!createNewList}
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
                                            required={createNewList}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-section">
                            <div className="auto-sync-toggle">
                                <div className="toggle-label">
                                    <h4>Auto-Sync Table Data</h4>
                                    <p>Automatically import data from this table every hour</p>
                                </div>
                                <button
                                    className="toggle-button"
                                    onClick={toggleAutoSync}
                                >
                                    {autoSync ? (
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

                            <div className="sync-info-note">
                                <Info size={16} />
                                <p>Auto-sync will import data from the selected Airtable table into the contact list. Contacts will be matched by email address to prevent duplicates.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <div className="spinner-sm"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                <span>{initialData ? 'Update Sync' : 'Add Sync'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
