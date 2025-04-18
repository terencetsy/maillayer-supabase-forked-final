import { useState, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle, Info, Check, Table, FileSpreadsheet, ToggleLeft, ToggleRight } from 'lucide-react';

export default function SheetsTableSyncModal({ availableSheets, contactLists, initialData, onClose, onSave, isLoadingSheets, onFetchSheets, brandId }) {
    // State for the form
    const [name, setName] = useState('');
    const [spreadsheetId, setSpreadsheetId] = useState('');
    const [sheetId, setSheetId] = useState('');
    const [contactListId, setContactListId] = useState('');
    const [createNewList, setCreateNewList] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [autoSync, setAutoSync] = useState(true);
    const [skipHeader, setSkipHeader] = useState(true);
    const [mapping, setMapping] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
    });
    const [headerRow, setHeaderRow] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [sheetColumns, setSheetColumns] = useState([]);
    const [error, setError] = useState('');
    const [activeSpreadsheet, setActiveSpreadsheet] = useState(null);
    const [activeSheet, setActiveSheet] = useState(null);

    // Initialize form with initial data if editing
    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setSpreadsheetId(initialData.spreadsheetId || '');
            setSheetId(initialData.sheetId || '');
            setContactListId(initialData.contactListId || '');
            setCreateNewList(initialData.createNewList || false);
            setNewListName(initialData.newListName || '');
            setAutoSync(initialData.autoSync !== undefined ? initialData.autoSync : true);
            setSkipHeader(initialData.skipHeader !== undefined ? initialData.skipHeader : true);
            setMapping(
                initialData.mapping || {
                    email: '',
                    firstName: '',
                    lastName: '',
                    phone: '',
                }
            );
            setHeaderRow(initialData.headerRow || 1);

            // Find active spreadsheet and sheet from available sheets
            if (initialData.spreadsheetId) {
                const spreadsheet = availableSheets.find((s) => s.id === initialData.spreadsheetId);
                if (spreadsheet) {
                    setActiveSpreadsheet(spreadsheet);
                    if (initialData.sheetId) {
                        const sheet = spreadsheet.sheets.find((s) => s.id === initialData.sheetId);
                        if (sheet) {
                            setActiveSheet(sheet);
                        }
                    }
                }
            }
        }
    }, [initialData]);

    // Handle spreadsheet selection
    const handleSpreadsheetChange = (e) => {
        const selectedSpreadsheetId = e.target.value;
        setSpreadsheetId(selectedSpreadsheetId);
        setSheetId('');
        setActiveSheet(null);

        // Find and set the active spreadsheet
        const spreadsheet = availableSheets.find((s) => s.id === selectedSpreadsheetId);
        if (spreadsheet) {
            setActiveSpreadsheet(spreadsheet);
        } else {
            setActiveSpreadsheet(null);
        }
    };

    // Handle sheet selection
    const handleSheetChange = (e) => {
        const selectedSheetId = e.target.value;
        setSheetId(selectedSheetId);

        // Find and set the active sheet
        if (activeSpreadsheet) {
            const sheet = activeSpreadsheet.sheets.find((s) => s.id === selectedSheetId);
            if (sheet) {
                setActiveSheet(sheet);
                // Fetch column headers for this sheet
                fetchSheetColumns(spreadsheetId, selectedSheetId);
            } else {
                setActiveSheet(null);
                setSheetColumns([]);
            }
        }
    };

    // Fetch column headers for the selected sheet
    const fetchSheetColumns = async (spreadsheetId, sheetId) => {
        if (!spreadsheetId || !sheetId) return;

        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${brandId}/integrations/google-sheets/columns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spreadsheetId,
                    sheetId,
                    headerRow,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to fetch sheet columns');
            }

            const data = await res.json();
            setSheetColumns(data.columns || []);
        } catch (error) {
            console.error('Error fetching sheet columns:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle mapping changes
    const handleMappingChange = (field, value) => {
        setMapping((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Handle header row change
    const handleHeaderRowChange = (e) => {
        const row = parseInt(e.target.value) || 1;
        setHeaderRow(row);

        // Re-fetch columns with new header row if sheet is selected
        if (spreadsheetId && sheetId) {
            fetchSheetColumns(spreadsheetId, sheetId);
        }
    };

    // Handle form submission
    const handleSave = () => {
        // Validate form
        if (!name) {
            setError('Please enter a name for this sync');
            return;
        }

        if (!spreadsheetId) {
            setError('Please select a spreadsheet');
            return;
        }

        if (!sheetId) {
            setError('Please select a sheet');
            return;
        }

        if (!mapping.email) {
            setError('Please select a column for email mapping');
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
            spreadsheetId,
            spreadsheetName: activeSpreadsheet ? activeSpreadsheet.name : '',
            spreadsheetUrl: activeSpreadsheet ? activeSpreadsheet.url : '',
            sheetId,
            sheetName: activeSheet ? activeSheet.name : '',
            contactListId,
            createNewList,
            newListName,
            autoSync,
            skipHeader,
            headerRow,
            mapping,
            status: 'idle',
            lastSyncedAt: initialData ? initialData.lastSyncedAt : null,
            lastSyncResult: initialData ? initialData.lastSyncResult : null,
        };

        // Save the sync
        onSave(syncData);
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
                            <h4 className="section-title">Google Sheet Selection</h4>

                            <div className="sheet-selection-actions">
                                <button
                                    className="refresh-sheets-button"
                                    onClick={onFetchSheets}
                                    disabled={isLoadingSheets}
                                >
                                    {isLoadingSheets ? (
                                        <RefreshCw
                                            size={14}
                                            className="spinner"
                                        />
                                    ) : (
                                        <RefreshCw size={14} />
                                    )}
                                    <span>Refresh Sheets</span>
                                </button>
                            </div>

                            <div className="form-group">
                                <label htmlFor="spreadsheet">Spreadsheet</label>
                                <select
                                    id="spreadsheet"
                                    value={spreadsheetId}
                                    onChange={handleSpreadsheetChange}
                                    required
                                >
                                    <option value="">Select a spreadsheet</option>
                                    {availableSheets.map((spreadsheet) => (
                                        <option
                                            key={spreadsheet.id}
                                            value={spreadsheet.id}
                                        >
                                            {spreadsheet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {activeSpreadsheet && (
                                <div className="form-group">
                                    <label htmlFor="sheet">Sheet</label>
                                    <select
                                        id="sheet"
                                        value={sheetId}
                                        onChange={handleSheetChange}
                                        required
                                    >
                                        <option value="">Select a sheet</option>
                                        {activeSpreadsheet.sheets.map((sheet) => (
                                            <option
                                                key={sheet.id}
                                                value={sheet.id}
                                            >
                                                {sheet.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="header-row">Header Row</label>
                                <input
                                    type="number"
                                    id="header-row"
                                    value={headerRow}
                                    onChange={handleHeaderRowChange}
                                    min="1"
                                    required
                                />
                                <div className="field-description">The row number that contains column headers (usually row 1)</div>
                            </div>

                            <div className="form-group checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={skipHeader}
                                        onChange={() => setSkipHeader(!skipHeader)}
                                    />
                                    <span>Skip header row when importing data</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-section">
                            <h4 className="section-title">Column Mapping</h4>
                            <div className="field-description">Map sheet columns to contact fields</div>

                            <div className="mapping-fields">
                                <div className="form-group required">
                                    <label htmlFor="email-column">Email (required)</label>
                                    <select
                                        id="email-column"
                                        value={mapping.email}
                                        onChange={(e) => handleMappingChange('email', e.target.value)}
                                        required
                                    >
                                        <option value="">Select a column</option>
                                        {sheetColumns.map((column) => (
                                            <option
                                                key={column.name}
                                                value={column.name}
                                            >
                                                {column.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="first-name-column">First Name</label>
                                    <select
                                        id="first-name-column"
                                        value={mapping.firstName}
                                        onChange={(e) => handleMappingChange('firstName', e.target.value)}
                                    >
                                        <option value="">Select a column</option>
                                        {sheetColumns.map((column) => (
                                            <option
                                                key={column.name}
                                                value={column.name}
                                            >
                                                {column.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="last-name-column">Last Name</label>
                                    <select
                                        id="last-name-column"
                                        value={mapping.lastName}
                                        onChange={(e) => handleMappingChange('lastName', e.target.value)}
                                    >
                                        <option value="">Select a column</option>
                                        {sheetColumns.map((column) => (
                                            <option
                                                key={column.name}
                                                value={column.name}
                                            >
                                                {column.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="phone-column">Phone</label>
                                    <select
                                        id="phone-column"
                                        value={mapping.phone}
                                        onChange={(e) => handleMappingChange('phone', e.target.value)}
                                    >
                                        <option value="">Select a column</option>
                                        {sheetColumns.map((column) => (
                                            <option
                                                key={column.name}
                                                value={column.name}
                                            >
                                                {column.name}
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
                                    <h4>Auto-Sync Sheet Data</h4>
                                    <p>Automatically import data from this sheet every hour</p>
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
                                <p>Auto-sync will import data from the selected Google Sheet into the contact list. Contacts will be matched by email address to prevent duplicates.</p>
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
