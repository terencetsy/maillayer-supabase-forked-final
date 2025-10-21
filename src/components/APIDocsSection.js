// src/components/APIDocsSection.js
import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

const APIDocsSection = ({ template, brand }) => {
    console.log('APIDocsSection', template, brand);
    const [copiedSection, setCopiedSection] = useState(null);
    const [activeTab, setActiveTab] = useState('curl');

    const apiEndpoint = `${window.location.origin}/api/transactional/send`;

    const copyToClipboard = (text, section) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(section);

        setTimeout(() => {
            setCopiedSection(null);
        }, 2000);
    };

    const curlExample = `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "${template.apiKey}",
    "to": "recipient@example.com",
    "variables": {
      ${template.variables?.map((v) => `"${v.name}": "Example Value"`).join(',\n      ') || '"example": "value"'}
    }
  }'`;

    const jsExample = `const response = await fetch("${apiEndpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    apiKey: "${template.apiKey}",
    to: "recipient@example.com",
    variables: {
      ${template.variables?.map((v) => `${v.name}: "Example Value"`).join(',\n      ') || 'example: "value"'}
    }
  })
});

const data = await response.json();
console.log(data);`;

    const pythonExample = `import requests

response = requests.post(
    "${apiEndpoint}",
    json={
        "apiKey": "${template.apiKey}",
        "to": "recipient@example.com",
        "variables": {
            ${template.variables?.map((v) => `"${v.name}": "Example Value"`).join(',\n            ') || '"example": "value"'}
        }
    }
)

print(response.json())`;

    const phpExample = `<?php
$data = [
    'apiKey' => '${template.apiKey}',
    'to' => 'recipient@example.com',
    'variables' => [
        ${template.variables?.map((v) => `'${v.name}' => 'Example Value'`).join(',\n        ') || "'example' => 'value'"}
    ]
];

$ch = curl_init('${apiEndpoint}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?>`;

    return (
        <div className="api-docs-section">
            <div className="api-info-card">
                <h3>Transactional Email API</h3>
                <p>Use this API to send transactional emails with your template. You&apos;ll need to include your API key and provide values for all template variables.</p>

                <div className="api-endpoint">
                    <h4>Endpoint</h4>
                    <div className="endpoint-url">
                        <code>{apiEndpoint}</code>
                        <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(apiEndpoint, 'endpoint')}
                        >
                            {copiedSection === 'endpoint' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>

                <div className="request-params">
                    <h4>Request Parameters</h4>
                    <table className="params-table">
                        <thead>
                            <tr>
                                <th>Parameter</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>apiKey</td>
                                <td>String</td>
                                <td>Yes</td>
                                <td>Your template API key</td>
                            </tr>
                            <tr>
                                <td>to</td>
                                <td>String</td>
                                <td>Yes</td>
                                <td>Recipient email address</td>
                            </tr>
                            <tr>
                                <td>variables</td>
                                <td>Object</td>
                                <td>Yes</td>
                                <td>
                                    Key-value pairs of template variables
                                    {template.variables && template.variables.length > 0 && (
                                        <div className="required-vars">
                                            Required variables:
                                            {template.variables.map((v, i) => (
                                                <span
                                                    key={i}
                                                    className="var-name"
                                                >
                                                    {v.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td>replyTo</td>
                                <td>String</td>
                                <td>No</td>
                                <td>Reply-to email address (defaults to template&apos;s from email)</td>
                            </tr>
                            <tr>
                                <td>cc</td>
                                <td>String[]</td>
                                <td>No</td>
                                <td>Array of CC email addresses</td>
                            </tr>
                            <tr>
                                <td>bcc</td>
                                <td>String[]</td>
                                <td>No</td>
                                <td>Array of BCC email addresses</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="response-info">
                    <h4>Response Format</h4>
                    <pre className="response-example">
                        {`{
  "success": true,
  "messageId": "unique-message-id",
  "message": "Email sent successfully"
}`}
                    </pre>
                </div>

                <div className="code-examples">
                    <h4>Code Examples</h4>

                    <div className="code-tabs">
                        <button
                            className={`code-tab ${activeTab === 'curl' ? 'active' : ''}`}
                            onClick={() => setActiveTab('curl')}
                        >
                            cURL
                        </button>
                        <button
                            className={`code-tab ${activeTab === 'javascript' ? 'active' : ''}`}
                            onClick={() => setActiveTab('javascript')}
                        >
                            JavaScript
                        </button>
                        <button
                            className={`code-tab ${activeTab === 'python' ? 'active' : ''}`}
                            onClick={() => setActiveTab('python')}
                        >
                            Python
                        </button>
                        <button
                            className={`code-tab ${activeTab === 'php' ? 'active' : ''}`}
                            onClick={() => setActiveTab('php')}
                        >
                            PHP
                        </button>
                    </div>

                    <div className="code-content">
                        {activeTab === 'curl' && (
                            <div className="code-block">
                                <pre>{curlExample}</pre>
                                <button
                                    className="copy-btn"
                                    onClick={() => copyToClipboard(curlExample, 'curl')}
                                >
                                    {copiedSection === 'curl' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}

                        {activeTab === 'javascript' && (
                            <div className="code-block">
                                <pre>{jsExample}</pre>
                                <button
                                    className="copy-btn"
                                    onClick={() => copyToClipboard(jsExample, 'javascript')}
                                >
                                    {copiedSection === 'javascript' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}

                        {activeTab === 'python' && (
                            <div className="code-block">
                                <pre>{pythonExample}</pre>
                                <button
                                    className="copy-btn"
                                    onClick={() => copyToClipboard(pythonExample, 'python')}
                                >
                                    {copiedSection === 'python' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}

                        {activeTab === 'php' && (
                            <div className="code-block">
                                <pre>{phpExample}</pre>
                                <button
                                    className="copy-btn"
                                    onClick={() => copyToClipboard(phpExample, 'php')}
                                >
                                    {copiedSection === 'php' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default APIDocsSection;
