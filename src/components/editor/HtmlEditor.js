// src/components/editor/HtmlEditor.js
import { useState, useEffect } from 'react';
import { Code, Eye, AlertCircle } from 'lucide-react';

const HtmlEditor = ({ value, onChange, placeholder = 'Enter HTML content...', editable = true }) => {
    const [htmlContent, setHtmlContent] = useState(value || '');
    const [showPreview, setShowPreview] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setHtmlContent(value || '');
    }, [value]);

    const handleChange = (e) => {
        const newValue = e.target.value;
        setHtmlContent(newValue);

        // Basic HTML validation
        try {
            // Simple validation - check for common HTML issues
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newValue;
            setError('');
        } catch (err) {
            setError('Invalid HTML structure');
        }

        onChange(newValue);
    };

    const formatHtml = () => {
        try {
            // Basic HTML formatting
            let formatted = htmlContent
                .replace(/></g, '>\n<')
                .replace(/^\s+|\s+$/gm, '')
                .split('\n')
                .map((line, index) => {
                    const depth = (line.match(/^<(?!\/)/) || []).length - (line.match(/<\//) || []).length;
                    return '  '.repeat(Math.max(0, depth)) + line.trim();
                })
                .join('\n');

            setHtmlContent(formatted);
            onChange(formatted);
        } catch (err) {
            setError('Could not format HTML');
        }
    };

    return (
        <div className="html-editor-container">
            <div className="html-editor-toolbar">
                <div className="toolbar-left">
                    <button
                        type="button"
                        className={`toolbar-btn ${!showPreview ? 'active' : ''}`}
                        onClick={() => setShowPreview(false)}
                        title="Edit HTML"
                    >
                        <Code size={16} />
                        <span>HTML</span>
                    </button>
                    <button
                        type="button"
                        className={`toolbar-btn ${showPreview ? 'active' : ''}`}
                        onClick={() => setShowPreview(true)}
                        title="Preview"
                    >
                        <Eye size={16} />
                        <span>Preview</span>
                    </button>
                </div>

                <div className="toolbar-right">
                    <button
                        type="button"
                        className="toolbar-btn format-btn"
                        onClick={formatHtml}
                        title="Format HTML"
                        disabled={!editable}
                    >
                        Format
                    </button>
                </div>
            </div>

            {error && (
                <div className="html-editor-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <div className="html-editor-content">
                {!showPreview ? (
                    <textarea
                        value={htmlContent}
                        onChange={handleChange}
                        placeholder={placeholder}
                        disabled={!editable}
                        className="html-textarea"
                        spellCheck={false}
                    />
                ) : (
                    <div className="html-preview">
                        <div
                            className="preview-content"
                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default HtmlEditor;
