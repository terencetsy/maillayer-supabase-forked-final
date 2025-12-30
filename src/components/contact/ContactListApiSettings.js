// src/components/contact/ContactListApiSettings.js
import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Globe, Code, ChevronDown, ChevronUp, Plus, X, Info } from 'lucide-react';

export default function ContactListApiSettings({ brandId, listId }) {
    const [settings, setSettings] = useState({
        apiKey: '',
        apiEnabled: false,
        allowedDomains: [],
        apiSettings: {
            allowDuplicates: false,
            redirectUrl: '',
        },
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copied, setCopied] = useState(false);
    const [copiedExample, setCopiedExample] = useState(null);
    const [newDomain, setNewDomain] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [activeTab, setActiveTab] = useState('javascript'); // javascript, html, curl

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    useEffect(() => {
        fetchSettings();
    }, [brandId, listId]);

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${brandId}/contact-lists/${listId}/api-settings`);
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (err) {
            console.error('Error fetching API settings:', err);
            setError('Failed to load API settings');
        } finally {
            setIsLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            setIsSaving(true);
            setError('');

            const res = await fetch(`/api/brands/${brandId}/contact-lists/${listId}/api-settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (!res.ok) {
                throw new Error('Failed to save settings');
            }

            setSuccess('Settings saved successfully');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const regenerateApiKey = async () => {
        if (!window.confirm('Are you sure you want to regenerate the API key? The old key will stop working immediately.')) {
            return;
        }

        try {
            const res = await fetch(`/api/brands/${brandId}/contact-lists/${listId}/api-settings/regenerate`, {
                method: 'POST',
            });

            if (res.ok) {
                const data = await res.json();
                setSettings((prev) => ({ ...prev, apiKey: data.apiKey }));
                setSuccess('API key regenerated successfully');
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err) {
            setError('Failed to regenerate API key');
        }
    };

    const copyToClipboard = async (text, exampleId = null) => {
        try {
            await navigator.clipboard.writeText(text);
            if (exampleId) {
                setCopiedExample(exampleId);
                setTimeout(() => setCopiedExample(null), 2000);
            } else {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const addDomain = () => {
        if (!newDomain.trim()) return;

        const domain = newDomain
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');

        if (!settings.allowedDomains.includes(domain)) {
            setSettings((prev) => ({
                ...prev,
                allowedDomains: [...prev.allowedDomains, domain],
            }));
        }
        setNewDomain('');
    };

    const removeDomain = (domain) => {
        setSettings((prev) => ({
            ...prev,
            allowedDomains: prev.allowedDomains.filter((d) => d !== domain),
        }));
    };

    const apiEndpoint = `${baseUrl}/api/public/contacts/${settings.apiKey}`;

    // Code examples
    const codeExamples = {
        javascript: `// Basic usage
fetch('${apiEndpoint}', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
    })
})
.then(res => res.json())
.then(data => console.log(data));

// With custom fields
fetch('${apiEndpoint}', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        // Custom fields - add any data you need
        customFields: {
            company: 'Acme Inc',
            jobTitle: 'Developer',
            plan: 'premium',
            referralSource: 'google',
            signupPage: window.location.pathname,
            interests: ['saas', 'marketing', 'automation'],
            metadata: {
                campaign: 'summer-sale',
                utm_source: 'newsletter'
            }
        }
    })
})
.then(res => res.json())
.then(data => {
    if (data.success) {
        // Handle success
        if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
        }
    }
});`,

        javascriptShort: `// Shorthand - extra fields automatically become custom fields
fetch('${apiEndpoint}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'user@example.com',
        firstName: 'John',
        company: 'Acme Inc',     // → customFields.company
        plan: 'premium',          // → customFields.plan
        referralSource: 'google'  // → customFields.referralSource
    })
});`,

        html: `<!-- Basic Form -->
<form id="subscribeForm">
    <input type="email" name="email" placeholder="Email" required />
    <input type="text" name="firstName" placeholder="First Name" />
    <input type="text" name="lastName" placeholder="Last Name" />
    <button type="submit">Subscribe</button>
</form>

<script>
document.getElementById('subscribeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    const response = await fetch('${apiEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: formData.get('email'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName')
        })
    });
    
    const data = await response.json();
    
    if (data.success) {
        alert('Successfully subscribed!');
        e.target.reset();
    }
});
</script>

<!-- Form with Custom Fields -->
<form id="leadForm">
    <input type="email" name="email" placeholder="Email" required />
    <input type="text" name="firstName" placeholder="First Name" />
    <input type="text" name="company" placeholder="Company" />
    <select name="plan">
        <option value="starter">Starter</option>
        <option value="pro">Pro</option>
        <option value="enterprise">Enterprise</option>
    </select>
    <input type="hidden" name="referralSource" value="landing-page" />
    <button type="submit">Get Started</button>
</form>

<script>
document.getElementById('leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // All extra fields go to customFields
    const response = await fetch('${apiEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: formData.get('email'),
            firstName: formData.get('firstName'),
            customFields: {
                company: formData.get('company'),
                plan: formData.get('plan'),
                referralSource: formData.get('referralSource'),
                signupUrl: window.location.href,
                signupDate: new Date().toISOString()
            }
        })
    });
    
    const data = await response.json();
    if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
    }
});
</script>`,

        curl: `# Basic request
curl -X POST '${apiEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }'

# With custom fields
curl -X POST '${apiEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "customFields": {
      "company": "Acme Inc",
      "plan": "premium",
      "referralSource": "api",
      "tags": ["lead", "enterprise"],
      "metadata": {
        "source": "crm-integration",
        "importedAt": "2024-01-15"
      }
    }
  }'

# Response (success)
{
  "success": true,
  "message": "Contact added successfully",
  "contactId": "507f1f77bcf86cd799439011",
  "redirectUrl": null
}

# Response (duplicate)
{
  "success": true,
  "message": "Contact already exists in this list",
  "contactId": "507f1f77bcf86cd799439011",
  "duplicate": true,
  "customFieldsUpdated": true
}`,

        react: `import { useState } from 'react';

function SubscribeForm() {
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [company, setCompany] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const response = await fetch('${apiEndpoint}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    firstName,
                    customFields: {
                        company,
                        signupSource: 'react-app',
                        signupTimestamp: Date.now()
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setMessage(data.duplicate 
                    ? 'You\\'re already subscribed!' 
                    : 'Successfully subscribed!');
                setEmail('');
                setFirstName('');
                setCompany('');
            } else {
                setMessage(data.message || 'Something went wrong');
            }
        } catch (error) {
            setMessage('Failed to subscribe');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
            />
            <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
            />
            <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company"
            />
            <button type="submit" disabled={loading}>
                {loading ? 'Subscribing...' : 'Subscribe'}
            </button>
            {message && <p>{message}</p>}
        </form>
    );
}`,

        nextjs: `// pages/api/subscribe.js (or app/api/subscribe/route.js)
// Proxy through your own API for added security

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, firstName, lastName, ...customData } = req.body;

    try {
        const response = await fetch('${apiEndpoint}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                firstName,
                lastName,
                customFields: {
                    ...customData,
                    subscribedVia: 'nextjs-api',
                    ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                    userAgent: req.headers['user-agent']
                }
            })
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to subscribe' 
        });
    }
}`,
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ width: '2rem', height: '2rem', border: '3px solid #f0f0f0', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '900px' }}>
            {error && (
                <div
                    className="alert alert--error"
                    style={{ marginBottom: '1rem' }}
                >
                    <span>{error}</span>
                    <button
                        onClick={() => setError('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {success && (
                <div
                    className="alert alert--success"
                    style={{ marginBottom: '1rem' }}
                >
                    <span>{success}</span>
                    <button
                        onClick={() => setSuccess('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Enable API Toggle */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '500' }}>API Access</h3>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>Allow external forms and applications to add contacts to this list</p>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.apiEnabled}
                            onChange={(e) => setSettings((prev) => ({ ...prev, apiEnabled: e.target.checked }))}
                            style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                        />
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>{settings.apiEnabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                </div>

                {settings.apiEnabled && (
                    <>
                        {/* API Key */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>API Key</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={settings.apiKey || 'No API key generated'}
                                        readOnly
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 2.5rem 0.625rem 0.75rem',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem',
                                            fontFamily: 'monospace',
                                            background: '#f9f9f9',
                                        }}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(settings.apiKey)}
                                        style={{
                                            position: 'absolute',
                                            right: '0.5rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '0.25rem',
                                            color: copied ? '#2e7d32' : '#666',
                                        }}
                                        title="Copy API key"
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <button
                                    className="button button--secondary"
                                    onClick={regenerateApiKey}
                                    title="Regenerate API key"
                                >
                                    <RefreshCw size={16} />
                                    <span>Regenerate</span>
                                </button>
                            </div>
                        </div>

                        {/* API Endpoint */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>API Endpoint</label>
                            <div
                                style={{
                                    padding: '0.625rem 0.75rem',
                                    background: '#f0f7ff',
                                    border: '1px solid #cce0ff',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    fontFamily: 'monospace',
                                    wordBreak: 'break-all',
                                }}
                            >
                                POST {apiEndpoint}
                            </div>
                        </div>

                        {/* Allowed Domains */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                                <Globe
                                    size={14}
                                    style={{ verticalAlign: 'middle', marginRight: '0.25rem' }}
                                />
                                Allowed Domains
                            </label>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#666' }}>Restrict API access to specific domains. Leave empty to allow all domains.</p>

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    placeholder="example.com"
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem 0.75rem',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                    }}
                                />
                                <button
                                    className="button button--secondary"
                                    onClick={addDomain}
                                >
                                    <Plus size={16} />
                                    <span>Add</span>
                                </button>
                            </div>

                            {settings.allowedDomains.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {settings.allowedDomains.map((domain) => (
                                        <span
                                            key={domain}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                padding: '0.25rem 0.5rem',
                                                background: '#f5f5f5',
                                                border: '1px solid #e0e0e0',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.8125rem',
                                            }}
                                        >
                                            {domain}
                                            <button
                                                onClick={() => removeDomain(domain)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#666', display: 'flex' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Additional Settings */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.apiSettings?.allowDuplicates || false}
                                    onChange={(e) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            apiSettings: { ...prev.apiSettings, allowDuplicates: e.target.checked },
                                        }))
                                    }
                                    style={{ width: '1rem', height: '1rem' }}
                                />
                                <span style={{ fontSize: '0.875rem' }}>
                                    <strong>Allow duplicate submissions</strong>
                                    <span style={{ color: '#666', marginLeft: '0.25rem' }}>- If disabled, duplicate emails will update custom fields only</span>
                                </span>
                            </label>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Redirect URL (optional)</label>
                                <input
                                    type="url"
                                    value={settings.apiSettings?.redirectUrl || ''}
                                    onChange={(e) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            apiSettings: { ...prev.apiSettings, redirectUrl: e.target.value },
                                        }))
                                    }
                                    placeholder="https://example.com/thank-you"
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem 0.75rem',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                    }}
                                />
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>Returned in API response for client-side redirects</p>
                            </div>
                        </div>

                        <button
                            className="button button--primary"
                            onClick={saveSettings}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </>
                )}
            </div>

            {/* API Documentation */}
            {settings.apiEnabled && (
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '0.5rem', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Code size={18} />
                        API Documentation
                    </h3>

                    {/* Request/Response Info */}
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: '600' }}>Request Format</h4>
                        <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0', fontWeight: '600' }}>Field</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0', fontWeight: '600' }}>Type</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0', fontWeight: '600' }}>Required</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0', fontWeight: '600' }}>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        <code style={{ background: '#e8f5e9', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>email</code>
                                    </td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>string</td>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        <span style={{ color: '#dc2626', fontWeight: '500' }}>Yes</span>
                                    </td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>Contact&apos;s email address</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        <code style={{ background: '#f5f5f5', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>firstName</code>
                                    </td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>string</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>No</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>Contact&apos;s first name</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        <code style={{ background: '#f5f5f5', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>lastName</code>
                                    </td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>string</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>No</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>Contact&apos;s last name</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        <code style={{ background: '#f5f5f5', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>phone</code>
                                    </td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>string</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>No</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>Contact&apos;s phone number</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        <code style={{ background: '#fff3e0', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>customFields</code>
                                    </td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>object</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>No</td>
                                    <td style={{ padding: '0.5rem 0', color: '#666' }}>Any additional data (see below)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Custom Fields Info Box */}
                    <div
                        style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                            borderRadius: '0.5rem',
                            border: '1px solid #fed7aa',
                        }}
                    >
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Info
                                size={16}
                                style={{ color: '#ea580c' }}
                            />
                            Custom Fields
                        </h4>
                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#9a3412' }}>
                            Store any additional data with your contacts using the <code style={{ background: '#fff', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>customFields</code> object. This is perfect for:
                        </p>
                        <ul style={{ margin: '0', paddingLeft: '1.25rem', fontSize: '0.8125rem', color: '#9a3412' }}>
                            <li>Tracking referral sources and UTM parameters</li>
                            <li>Storing company information and job titles</li>
                            <li>Recording signup page URLs and timestamps</li>
                            <li>Segmentation data (interests, preferences, plans)</li>
                            <li>Any metadata your application needs</li>
                        </ul>
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fff', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#666' }}>
                            <strong>Pro tip:</strong> Any extra fields you send (besides email, firstName, lastName, phone) are automatically added to customFields!
                        </div>
                    </div>

                    {/* Code Examples Tabs */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #e0e0e0', marginBottom: '1rem' }}>
                            {[
                                { id: 'javascript', label: 'JavaScript' },
                                { id: 'html', label: 'HTML Form' },
                                { id: 'curl', label: 'cURL' },
                                { id: 'react', label: 'React' },
                                { id: 'nextjs', label: 'Next.js' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeTab === tab.id ? '2px solid #1a1a1a' : '2px solid transparent',
                                        cursor: 'pointer',
                                        fontSize: '0.8125rem',
                                        fontWeight: activeTab === tab.id ? '500' : '400',
                                        color: activeTab === tab.id ? '#1a1a1a' : '#666',
                                        marginBottom: '-1px',
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Code Block */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => copyToClipboard(codeExamples[activeTab], activeTab)}
                                style={{
                                    position: 'absolute',
                                    top: '0.5rem',
                                    right: '0.5rem',
                                    padding: '0.375rem 0.625rem',
                                    background: copiedExample === activeTab ? '#e8f5e9' : '#fff',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    color: copiedExample === activeTab ? '#2e7d32' : '#666',
                                    zIndex: 10,
                                }}
                            >
                                {copiedExample === activeTab ? <Check size={14} /> : <Copy size={14} />}
                                {copiedExample === activeTab ? 'Copied!' : 'Copy'}
                            </button>
                            <pre
                                style={{
                                    margin: 0,
                                    padding: '1rem',
                                    background: '#1e1e1e',
                                    borderRadius: '0.5rem',
                                    overflow: 'auto',
                                    maxHeight: '400px',
                                    fontSize: '0.8125rem',
                                    lineHeight: '1.5',
                                }}
                            >
                                <code style={{ color: '#d4d4d4', fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace" }}>{codeExamples[activeTab]}</code>
                            </pre>
                        </div>
                    </div>

                    {/* Shorthand Example */}
                    {activeTab === 'javascript' && (
                        <div style={{ marginTop: '1rem' }}>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    color: '#1a1a1a',
                                    padding: '0',
                                }}
                            >
                                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                Shorthand Syntax
                            </button>

                            {showAdvanced && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#666' }}>You can also pass custom fields directly in the body - they&apos;ll automatically be stored in customFields:</p>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => copyToClipboard(codeExamples.javascriptShort, 'shorthand')}
                                            style={{
                                                position: 'absolute',
                                                top: '0.5rem',
                                                right: '0.5rem',
                                                padding: '0.375rem 0.625rem',
                                                background: copiedExample === 'shorthand' ? '#e8f5e9' : '#fff',
                                                border: '1px solid #e0e0e0',
                                                borderRadius: '0.25rem',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                color: copiedExample === 'shorthand' ? '#2e7d32' : '#666',
                                                zIndex: 10,
                                            }}
                                        >
                                            {copiedExample === 'shorthand' ? <Check size={14} /> : <Copy size={14} />}
                                            {copiedExample === 'shorthand' ? 'Copied!' : 'Copy'}
                                        </button>
                                        <pre
                                            style={{
                                                margin: 0,
                                                padding: '1rem',
                                                background: '#1e1e1e',
                                                borderRadius: '0.5rem',
                                                overflow: 'auto',
                                                fontSize: '0.8125rem',
                                                lineHeight: '1.5',
                                            }}
                                        >
                                            <code style={{ color: '#d4d4d4', fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace" }}>{codeExamples.javascriptShort}</code>
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Response Format */}
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: '600' }}>Response Format</h4>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div>
                                <span style={{ display: 'inline-block', padding: '0.125rem 0.5rem', background: '#dcfce7', color: '#166534', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>201 Created</span>
                                <pre style={{ margin: '0.25rem 0 0 0', padding: '0.5rem', background: '#fff', borderRadius: '0.25rem', fontSize: '0.75rem', overflow: 'auto' }}>
                                    {`{
  "success": true,
  "message": "Contact added successfully",
  "contactId": "507f1f77bcf86cd799439011",
  "redirectUrl": "${settings.apiSettings?.redirectUrl || 'null'}"
}`}
                                </pre>
                            </div>
                            <div>
                                <span style={{ display: 'inline-block', padding: '0.125rem 0.5rem', background: '#fef3c7', color: '#92400e', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>200 Duplicate</span>
                                <pre style={{ margin: '0.25rem 0 0 0', padding: '0.5rem', background: '#fff', borderRadius: '0.25rem', fontSize: '0.75rem', overflow: 'auto' }}>
                                    {`{
  "success": true,
  "message": "Contact already exists in this list",
  "contactId": "507f1f77bcf86cd799439011",
  "duplicate": true,
  "customFieldsUpdated": true
}`}
                                </pre>
                            </div>
                            <div>
                                <span style={{ display: 'inline-block', padding: '0.125rem 0.5rem', background: '#fee2e2', color: '#991b1b', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>400 Error</span>
                                <pre style={{ margin: '0.25rem 0 0 0', padding: '0.5rem', background: '#fff', borderRadius: '0.25rem', fontSize: '0.75rem', overflow: 'auto' }}>
                                    {`{
  "success": false,
  "message": "Email is required"
}`}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
