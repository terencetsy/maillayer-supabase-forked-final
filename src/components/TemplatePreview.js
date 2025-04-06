// src/components/TemplatePreview.js
import { useState } from 'react';

const TemplatePreview = ({ template }) => {
    const [testValues, setTestValues] = useState({});
    const [showVariablesForm, setShowVariablesForm] = useState(template.variables?.length > 0);

    // Generate sample content by replacing variables with test values
    const generateContent = () => {
        if (!template.content) return '<p>No content available</p>';

        let content = template.content;

        // If there are variables, replace them with test values or placeholders
        if (template.variables && template.variables.length > 0) {
            template.variables.forEach((variable) => {
                const regex = new RegExp(`\\[${variable.name}\\]`, 'g');
                const value = testValues[variable.name] || `[${variable.name}]`;
                content = content.replace(regex, value);
            });
        }

        return content;
    };

    const handleInputChange = (variable, value) => {
        setTestValues((prev) => ({
            ...prev,
            [variable]: value,
        }));
    };

    return (
        <div className="template-preview">
            {template.variables && template.variables.length > 0 && (
                <div className="variables-section">
                    <div
                        className="variables-toggle"
                        onClick={() => setShowVariablesForm(!showVariablesForm)}
                    >
                        <h3>Test with Variables {showVariablesForm ? '▼' : '▶'}</h3>
                    </div>

                    {showVariablesForm && (
                        <div className="variables-form">
                            {template.variables.map((variable, index) => (
                                <div
                                    key={index}
                                    className="variable-input"
                                >
                                    <label htmlFor={`var-${variable.name}`}>{variable.name}</label>
                                    <input
                                        id={`var-${variable.name}`}
                                        type="text"
                                        placeholder={`Value for ${variable.name}`}
                                        value={testValues[variable.name] || ''}
                                        onChange={(e) => handleInputChange(variable.name, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="email-preview-container">
                <div className="preview-header">
                    <div>
                        <div className="preview-subject">
                            <span className="label">Subject:</span>
                            <span className="value">{template.subject}</span>
                        </div>
                        <div className="preview-from">
                            <span className="label">From:</span>
                            <span className="value">
                                {template.fromName || 'Sender'} &lt;{template.fromEmail || 'sender@example.com'}&gt;
                            </span>
                        </div>
                    </div>
                </div>

                <div className="email-content-preview">
                    <div
                        className="email-body-preview"
                        dangerouslySetInnerHTML={{ __html: generateContent() }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default TemplatePreview;
