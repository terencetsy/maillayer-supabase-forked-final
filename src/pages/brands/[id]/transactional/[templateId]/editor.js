import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Save, Code, Info, CheckCircle, Clock, AlertCircle, Send, AlertTriangle } from 'lucide-react';
import UnifiedEditor from '@/components/editor/UnifiedEditor';

export default function TemplateEditor() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, templateId } = router.query;

    const [brand, setBrand] = useState(null);
    const [template, setTemplate] = useState(null);
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [saveMessage, setSaveMessage] = useState('');
    const [showVarTooltip, setShowVarTooltip] = useState(false);
    const [detectedVariables, setDetectedVariables] = useState([]);
    const [variableEditMode, setVariableEditMode] = useState(false);
    const [editableVariables, setEditableVariables] = useState([]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id && templateId) {
            fetchBrandDetails();
            fetchTemplateDetails();
        }
    }, [status, id, templateId, router]);

    // Detect variables and sync with editableVariables
    useEffect(() => {
        if (content || template) {
            detectAndSyncVariables(content, template?.subject);
        }
    }, [content, template?.subject]);

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

    const fetchTemplateDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Template not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch template details');
                }
            }

            const data = await res.json();
            setTemplate(data);
            setContent(data.content || getDefaultEmailTemplate());
            if (data.variables && data.variables.length > 0) {
                setEditableVariables(data.variables);
            }
        } catch (error) {
            console.error('Error fetching template details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Detect variables and sync with editableVariables
    const detectAndSyncVariables = (emailContent, subjectLine) => {
        const regex = /\[([\w\d_]+)\]/g;
        const variables = [];
        let match;

        // Look for variables in content
        if (emailContent) {
            while ((match = regex.exec(emailContent)) !== null) {
                if (!variables.includes(match[1])) {
                    variables.push(match[1]);
                }
            }
        }

        // Also check the subject line if available
        if (subjectLine) {
            regex.lastIndex = 0; // Reset the regex
            while ((match = regex.exec(subjectLine)) !== null) {
                if (!variables.includes(match[1])) {
                    variables.push(match[1]);
                }
            }
        }

        setDetectedVariables(variables);

        // Sync with editableVariables
        setEditableVariables((prevEditableVars) => {
            const updatedVariables = [...prevEditableVars];

            // Add newly detected variables that don't exist yet
            variables.forEach((varName) => {
                if (!updatedVariables.some((v) => v.name === varName)) {
                    updatedVariables.push({
                        name: varName,
                        description: `Variable for ${varName}`,
                        required: false,
                    });
                }
            });

            // Remove variables that no longer exist in the content
            const filteredVariables = updatedVariables.filter((v) => variables.includes(v.name));

            return filteredVariables;
        });
    };

    const handleContentChange = (newContent) => {
        setContent(newContent);
        // Clear any previous save messages
        setSaveMessage('');
        // Variables will be detected by the useEffect
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            setSaveMessage('');
            setError('');

            const res = await fetch(`/api/brands/${id}/transactional/${templateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: content,
                    variables: editableVariables,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to save template content');
            }

            setSaveMessage('Template saved successfully');

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSaveMessage('');
            }, 3000);
        } catch (error) {
            console.error('Error saving template:', error);
            setError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        try {
            setIsPublishing(true);
            setError('');

            // Verify the template has content
            if (!content || content.trim() === '') {
                setError('Cannot publish empty template. Please add content first.');
                setIsPublishing(false);
                return;
            }

            const res = await fetch(`/api/brands/${id}/transactional/${templateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'active',
                    content: content,
                    variables: editableVariables,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to publish template');
            }

            // Refresh template data
            const updatedTemplate = await res.json();
            if (updatedTemplate) {
                setTemplate(updatedTemplate);
            } else {
                await fetchTemplateDetails();
            }

            setSaveMessage('Template published successfully');

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSaveMessage('');
            }, 3000);
        } catch (error) {
            console.error('Error publishing template:', error);
            setError(error.message);
        } finally {
            setIsPublishing(false);
        }
    };

    const updateVariable = (index, field, value) => {
        const updated = [...editableVariables];
        updated[index] = { ...updated[index], [field]: value };
        setEditableVariables(updated);
    };

    // This is used just for the layout to identify the brand
    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="campaign-editor-page">
                <div className="editor-top-bar">
                    <div className="editor-nav">
                        <Link
                            href={`/brands/${id}/transactional`}
                            className="back-link"
                        >
                            <ArrowLeft size={16} />
                            <span>All templates</span>
                        </Link>
                    </div>

                    <div className="editor-actions">
                        {saveMessage && <div className="status-message success">{saveMessage}</div>}
                        {error && <div className="status-message error">{error}</div>}

                        <button
                            className="button button--secondary"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <div className="button-spinner"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>Save</span>
                                </>
                            )}
                        </button>

                        <Link
                            href={`/brands/${id}/transactional/${templateId}/api`}
                            className="button button--secondary"
                        >
                            <Code size={16} />
                            <span>API Documentation</span>
                        </Link>

                        {template && template.status !== 'active' && (
                            <button
                                className="button button--primary"
                                onClick={handlePublish}
                                disabled={isPublishing}
                            >
                                <Send size={16} />
                                <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="campaign-header">
                    <h1>{template?.name}</h1>
                    <div className="template-info">
                        <div className="subject-line">
                            <span>Subject:</span> {template?.subject}
                        </div>
                        <div className={`status-badge ${template?.status}`}>
                            {template?.status === 'active' && <CheckCircle size={14} />}
                            {template?.status === 'draft' && <Clock size={14} />}
                            {template?.status === 'inactive' && <AlertCircle size={14} />}
                            {template?.status === 'active' ? 'Active' : template?.status === 'draft' ? 'Draft' : 'Inactive'}
                        </div>
                    </div>
                </div>

                <div className="variables-section">
                    <div
                        className="variables-header"
                        onClick={() => setVariableEditMode(!variableEditMode)}
                    >
                        <h3>
                            <span>Template Variables</span>
                            {!variableEditMode && <span className="toggle-edit">(Click to edit)</span>}
                        </h3>
                        <div className="variables-detected">{detectedVariables.length === 0 ? <span className="no-variables">No variables detected</span> : <span className="variables-count">{detectedVariables.length} variables detected</span>}</div>
                    </div>

                    {variableEditMode ? (
                        <div className="variables-editor">
                            <div className="variables-table-container">
                                <table className="variables-table">
                                    <thead>
                                        <tr>
                                            <th>Variable</th>
                                            <th>Description</th>
                                            <th>Required</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editableVariables.map((variable, index) => (
                                            <tr key={variable.name}>
                                                <td>[{variable.name}]</td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={variable.description}
                                                        onChange={(e) => updateVariable(index, 'description', e.target.value)}
                                                        className="variable-input"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={variable.required}
                                                        onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                                                        className="variable-checkbox"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        {editableVariables.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan="3"
                                                    className="no-variables-message"
                                                >
                                                    Add variables to your template using [variableName] syntax
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="variables-actions">
                                <button
                                    className="button button--primary"
                                    onClick={() => setVariableEditMode(false)}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="variables-list">
                            {editableVariables.length > 0 ? (
                                <div className="variables-chips">
                                    {editableVariables.map((variable) => (
                                        <div
                                            key={variable.name}
                                            className={`variable-chip ${variable.required ? 'required' : ''}`}
                                        >
                                            <span className="variable-name">[{variable.name}]</span>
                                            {variable.required && <span className="required-badge">Required</span>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="variables-placeholder">
                                    <AlertTriangle size={14} />
                                    <span>No variables defined yet. Add variables using [variableName] syntax in your template.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="editor-container">
                    <div className="editor-info-bar">
                        <Info size={14} />
                        <span>Email template editor - Use [variableName] to define dynamic content</span>
                    </div>

                    <UnifiedEditor
                        value={content}
                        onChange={handleContentChange}
                        placeholder="Design your template or write HTML..."
                        editable={true}
                        defaultMode="visual"
                    />
                </div>
            </div>
        </BrandLayout>
    );
}

// Default email template with a standard email font
function getDefaultEmailTemplate() {
    return `
    <div style="font-family: Arial, sans-serif; color: #333333; max-width: 600px; margin: 0 auto;">
        <h2>Email Title</h2>
        <p>Hello [firstName],</p>
        <p>This is your transactional email template. Edit this to create your content.</p>
        <p>You can use variables like [firstName], [lastName], etc.</p>
        <p>Best regards,</p>
        <p>[companyName]</p>
    </div>
    `;
}
