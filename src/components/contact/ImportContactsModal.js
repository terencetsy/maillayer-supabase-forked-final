import { useState, useRef, useEffect } from 'react';
import { X, Loader, AlertCircle, Upload, UserPlus, Globe, ArrowLeft, CheckCircle, FileText } from 'lucide-react';
import Papa from 'papaparse';

export default function ImportContactsModal({ brandId, listId, method = 'manual', onClose, onSuccess }) {
    const [currentMethod, setCurrentMethod] = useState(method);
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    const [batchProgress, setBatchProgress] = useState(0);
    const [batchStats, setBatchStats] = useState({
        processed: 0,
        imported: 0,
        skipped: 0,
        total: 0,
    });
    const [isBatchImporting, setIsBatchImporting] = useState(false);

    // Manual contact form
    const [manualContact, setManualContact] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
    });

    // CSV import
    const [file, setFile] = useState(null);
    const [csvData, setCsvData] = useState([]);
    const [mappedFields, setMappedFields] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
    });
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [parsedContacts, setParsedContacts] = useState([]);
    const [importResult, setImportResult] = useState(null);

    useEffect(() => {
        setCurrentMethod(method);
    }, [method]);

    const handleManualChange = (e) => {
        const { name, value } = e.target;
        setManualContact({
            ...manualContact,
            [name]: value,
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);

            // Parse the CSV file
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    setCsvData(results.data);
                    setCsvHeaders(results.meta.fields);

                    // Try to auto-map fields if headers match
                    const mappings = {};
                    results.meta.fields.forEach((header) => {
                        const lowerHeader = header.toLowerCase();
                        if (lowerHeader.includes('email')) mappings.email = header;
                        if (lowerHeader.includes('first') && lowerHeader.includes('name')) mappings.firstName = header;
                        if (lowerHeader.includes('last') && lowerHeader.includes('name')) mappings.lastName = header;
                        if (lowerHeader.includes('phone') || lowerHeader.includes('mobile')) mappings.phone = header;
                    });

                    setMappedFields(mappings);
                },
                error: function (error) {
                    console.error('Error parsing CSV:', error);
                    setError('Failed to parse CSV file. Please check the format.');
                },
            });
        }
    };

    const handleMappingChange = (e) => {
        const { name, value } = e.target;
        setMappedFields({
            ...mappedFields,
            [name]: value,
        });
    };

    const validateEmail = (email) => {
        return String(email)
            .toLowerCase()
            .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
    };

    const processCSVData = () => {
        if (!mappedFields.email) {
            setError('Email field mapping is required');
            return false;
        }

        // Parse contacts from CSV data using the mapped fields
        const contacts = csvData.map((row) => {
            const contact = {
                email: row[mappedFields.email],
                firstName: mappedFields.firstName ? row[mappedFields.firstName] : '',
                lastName: mappedFields.lastName ? row[mappedFields.lastName] : '',
                phone: mappedFields.phone ? row[mappedFields.phone] : '',
            };

            return contact;
        });

        // Validate emails
        const validContacts = contacts.filter((contact) => validateEmail(contact.email));

        if (validContacts.length === 0) {
            setError('No valid email addresses found in the CSV');
            return false;
        }

        setParsedContacts(validContacts);
        return true;
    };

    // In your ImportContactsModal.js component
    const handleManualSubmit = async (e) => {
        e.preventDefault();

        // Validate email
        if (!validateEmail(manualContact.email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/brands/${brandId}/contact-lists/${listId}/contacts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contacts: [manualContact],
                    skipDuplicates: true, // Set to true to skip duplicates
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to add contact');
            }

            const result = await response.json();

            if (result.skipped > 0) {
                setSuccess(`Contact already exists in this list.`);
            } else {
                setSuccess(`Contact added successfully!`);
            }

            // Clear form
            setManualContact({
                email: '',
                firstName: '',
                lastName: '',
                phone: '',
            });

            // After short delay, close modal
            setTimeout(() => {
                onSuccess();
            }, 1500);
        } catch (error) {
            console.error('Error adding contact:', error);

            // Check if it&apos; a duplicate error
            if (error.message && error.message.includes('duplicate')) {
                setError('This email already exists in the contact list.');
            } else {
                setError(error.message || 'An unexpected error occurred');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCsvNextStep = () => {
        if (step === 1 && !file) {
            setError('Please select a CSV file');
            return;
        }

        if (step === 2) {
            if (processCSVData()) {
                setStep(3);
                setError('');
            }
        } else {
            setStep(step + 1);
            setError('');
        }
    };

    const handleCsvImport = async () => {
        try {
            setIsLoading(true);
            setIsBatchImporting(true);
            setError('');

            const totalContacts = parsedContacts.length;
            const batchSize = 1000; // Process 1000 contacts per batch to stay under the 1MB limit

            // Initialize batch stats
            setBatchStats({
                processed: 0,
                imported: 0,
                skipped: 0,
                total: totalContacts,
            });

            // Process in batches
            for (let i = 0; i < totalContacts; i += batchSize) {
                const endIndex = Math.min(i + batchSize, totalContacts);
                const currentBatch = parsedContacts.slice(i, endIndex);

                try {
                    const response = await fetch(`/api/brands/${brandId}/contact-lists/${listId}/contacts`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contacts: currentBatch,
                            skipDuplicates: true,
                        }),
                        credentials: 'same-origin',
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Failed to import batch ${Math.floor(i / batchSize) + 1}`);
                    }

                    const batchResult = await response.json();

                    // Update progress stats
                    setBatchStats((prev) => ({
                        processed: endIndex,
                        imported: prev.imported + batchResult.imported,
                        skipped: prev.skipped + batchResult.skipped,
                        total: totalContacts,
                    }));

                    // Calculate and update progress percentage
                    const progressPercent = Math.round((endIndex / totalContacts) * 100);
                    setBatchProgress(progressPercent);
                } catch (error) {
                    console.error(`Error importing batch (contacts ${i + 1}-${Math.min(i + batchSize, totalContacts)}):`, error);
                    setError((prev) => (prev ? `${prev}; ${error.message}` : error.message));
                    // Continue with next batch instead of stopping entirely
                }
            }

            // Compile final results
            const finalResult = {
                total: totalContacts,
                imported: batchStats.imported,
                skipped: batchStats.skipped,
            };

            setImportResult(finalResult);
            setStep(4); // Move to success screen
        } catch (error) {
            console.error('Error in import process:', error);
            setError(error.message || 'An unexpected error occurred during the import process');
        } finally {
            setIsLoading(false);
            setIsBatchImporting(false);
        }
    };

    const renderMethodTitle = () => {
        if (currentMethod === 'manual') return 'Add Contact Manually';
        if (currentMethod === 'csv') {
            if (step === 1) return 'Import Contacts from CSV';
            if (step === 2) return 'Map CSV Fields';
            if (step === 3) return 'Review Contacts';
            if (step === 4) return 'Import Complete';
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>{renderMethodTitle()}</h2>
                    <button
                        className="close-btn"
                        onClick={onClose}
                        aria-label="Close form"
                    >
                        <X size={18} />
                    </button>
                </div>

                {error && (
                    <div className="form-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="form-success">
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                <div className="modal-content">
                    {/* Manual Contact Form */}
                    {currentMethod === 'manual' && (
                        <form
                            onSubmit={handleManualSubmit}
                            className="modal-form"
                        >
                            <div className="form-group">
                                <label htmlFor="email">
                                    Email<span className="required">*</span>
                                </label>
                                <div className="input-wrapper">
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={manualContact.email}
                                        onChange={handleManualChange}
                                        placeholder="contact@example.com"
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="firstName">First Name</label>
                                    <div className="input-wrapper">
                                        <input
                                            id="firstName"
                                            name="firstName"
                                            type="text"
                                            value={manualContact.firstName}
                                            onChange={handleManualChange}
                                            placeholder="John"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="lastName">Last Name</label>
                                    <div className="input-wrapper">
                                        <input
                                            id="lastName"
                                            name="lastName"
                                            type="text"
                                            value={manualContact.lastName}
                                            onChange={handleManualChange}
                                            placeholder="Doe"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="phone">Phone Number</label>
                                <div className="input-wrapper">
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        value={manualContact.phone}
                                        onChange={handleManualChange}
                                        placeholder="+1 (555) 123-4567"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={onClose}
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader
                                                size={16}
                                                className="spinner"
                                            />
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Contact'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* CSV Import */}
                    {currentMethod === 'csv' && (
                        <div className="csv-import-container">
                            {/* Step 1: File Upload */}
                            {step === 1 && (
                                <div className="csv-file-upload">
                                    <div
                                        className={`file-upload-area ${file ? 'has-file' : ''}`}
                                        onClick={() => fileInputRef.current.click()}
                                    >
                                        {file ? (
                                            <div className="file-info">
                                                <FileText size={32} />
                                                <div className="file-details">
                                                    <div className="file-name">{file.name}</div>
                                                    <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={32} />
                                                <p>Click to select or drag and drop CSV file</p>
                                                <small>Your CSV should have a header row with column names</small>
                                            </>
                                        )}
                                    </div>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".csv"
                                        style={{ display: 'none' }}
                                    />

                                    <div className="csv-template-info">
                                        <p>
                                            Need a template?{' '}
                                            <a
                                                href="/csv-template.csv"
                                                download
                                            >
                                                Download CSV template
                                            </a>
                                        </p>
                                    </div>

                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={onClose}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleCsvNextStep}
                                            disabled={!file}
                                        >
                                            Continue
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Step 2: Field Mapping */}
                            {step === 2 && (
                                <div className="field-mapping">
                                    <p className="mapping-info">Map the columns from your CSV file to contact fields. Email is required.</p>

                                    <div className="form-group">
                                        <label>
                                            Email<span className="required">*</span>
                                        </label>
                                        <select
                                            name="email"
                                            value={mappedFields.email}
                                            onChange={handleMappingChange}
                                            required
                                        >
                                            <option value="">Select a column</option>
                                            {csvHeaders.map((header) => (
                                                <option
                                                    key={header}
                                                    value={header}
                                                >
                                                    {header}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>First Name</label>
                                        <select
                                            name="firstName"
                                            value={mappedFields.firstName}
                                            onChange={handleMappingChange}
                                        >
                                            <option value="">Select a column (optional)</option>
                                            {csvHeaders.map((header) => (
                                                <option
                                                    key={header}
                                                    value={header}
                                                >
                                                    {header}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Last Name</label>
                                        <select
                                            name="lastName"
                                            value={mappedFields.lastName}
                                            onChange={handleMappingChange}
                                        >
                                            <option value="">Select a column (optional)</option>
                                            {csvHeaders.map((header) => (
                                                <option
                                                    key={header}
                                                    value={header}
                                                >
                                                    {header}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Phone</label>
                                        <select
                                            name="phone"
                                            value={mappedFields.phone}
                                            onChange={handleMappingChange}
                                        >
                                            <option value="">Select a column (optional)</option>
                                            {csvHeaders.map((header) => (
                                                <option
                                                    key={header}
                                                    value={header}
                                                >
                                                    {header}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => setStep(1)}
                                        >
                                            <ArrowLeft size={16} />
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleCsvNextStep}
                                            disabled={!mappedFields.email}
                                        >
                                            Continue
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Step 3: Review Contacts */}
                            {step === 3 && (
                                <div className="review-contacts">
                                    <p className="review-info">{parsedContacts.length} contacts found in your CSV file. These will be imported into your contact list. Duplicate emails will be skipped.</p>

                                    <div className="contacts-preview">
                                        <table className="preview-table">
                                            <thead>
                                                <tr>
                                                    <th>Email</th>
                                                    <th>First Name</th>
                                                    <th>Last Name</th>
                                                    <th>Phone</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedContacts.slice(0, 5).map((contact, index) => (
                                                    <tr key={index}>
                                                        <td>{contact.email}</td>
                                                        <td>{contact.firstName}</td>
                                                        <td>{contact.lastName}</td>
                                                        <td>{contact.phone}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {parsedContacts.length > 5 && <div className="more-contacts">+{parsedContacts.length - 5} more contacts</div>}
                                    </div>

                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => setStep(2)}
                                        >
                                            <ArrowLeft size={16} />
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleCsvImport}
                                            disabled={isLoading || isBatchImporting}
                                        >
                                            {isLoading || isBatchImporting ? (
                                                <>
                                                    <Loader
                                                        size={16}
                                                        className="spinner"
                                                    />
                                                    {isBatchImporting ? `Importing... ${batchProgress}%` : 'Preparing...'}
                                                </>
                                            ) : (
                                                'Import Contacts'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && isBatchImporting && (
                                <div className="batch-import-progress">
                                    <h4>Importing Contacts in Batches</h4>
                                    <div className="progress-container">
                                        <div
                                            className="progress-bar"
                                            style={{ width: `${batchProgress}%` }}
                                            aria-valuenow={batchProgress}
                                            aria-valuemin="0"
                                            aria-valuemax="100"
                                        ></div>
                                    </div>
                                    <div className="progress-stats">
                                        <div className="stat-item">
                                            <span className="stat-label">Processed:</span>
                                            <span className="stat-value">
                                                {batchStats.processed} of {batchStats.total}
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Imported:</span>
                                            <span className="stat-value">{batchStats.imported}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Skipped:</span>
                                            <span className="stat-value">{batchStats.skipped}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 4 && importResult && (
                                <div className="import-complete">
                                    <div className="success-icon">
                                        <CheckCircle size={48} />
                                    </div>

                                    <h3>Import Complete!</h3>

                                    <div className="import-stats">
                                        <div className="stat-item">
                                            <span className="stat-label">Total Processed:</span>
                                            <span className="stat-value">{importResult.total}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Successfully Added:</span>
                                            <span className="stat-value">{importResult.imported}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Duplicates Skipped:</span>
                                            <span className="stat-value">{importResult.skipped}</span>
                                        </div>
                                    </div>

                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={onSuccess}
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
