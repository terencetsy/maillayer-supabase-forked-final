// src/pages/brands/[id]/transactional/[templateId]/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Copy, Code, Eye, Edit, Play, Shield, Send, Mail, AlertCircle } from 'lucide-react';
import APIDocsSection from '@/components/APIDocsSection';
import TemplatePreview from '@/components/TemplatePreview';

export default function TransactionalTemplateDetail() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, templateId } = router.query;

    const [brand, setBrand] = useState(null);
    const [template, setTemplate] = useState(null);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [copied, setCopied] = useState(false);

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

    useEffect(() => {
        if (template && template.status === 'published') {
            fetchTemplateStats();
        }
    }, [template]);

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
        } catch (error) {
            console.error('Error fetching template details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTemplateStats = async () => {
        try {
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}/stats`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                console.warn('Could not fetch template stats');
                return;
            }

            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching template stats:', error);
        }
    };

    const copyAPIKey = () => {
        if (!template || !template.apiKey) return;

        navigator.clipboard.writeText(template.apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePublish = async () => {
        if (!template) return;

        try {
            const res = await fetch(`/api/brands/${id}/transactional/${templateId}/publish`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to publish template');
            }

            fetchTemplateDetails();
        } catch (error) {
            console.error('Error publishing template:', error);
            setError(error.message);
        }
    };

    // If loading or brand/template not loaded yet
    if (isLoading || !brand || !template) {
        return (
            <BrandLayout brand={brand}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading template details...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="template-detail-container">
                {/* Header */}
                <div className="template-detail-header">
                    <Link
                        href={`/brands/${id}/transactional`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Transactional Templates</span>
                    </Link>

                    <div className="template-title-section">
                        <h1>{template.name}</h1>
                        <div className="template-meta">
                            <span className={`template-status status-${template.status}`}>{template.status === 'draft' ? 'Draft' : 'Published'}</span>
                            {template.status === 'published' && (
                                <div className="template-api-key">
                                    <span>API Key: </span>
                                    <code>{template.apiKey}</code>
                                    <button
                                        onClick={copyAPIKey}
                                        className="copy-btn"
                                        title="Copy API Key"
                                    >
                                        <Copy size={14} />
                                        {copied && <span className="copy-tooltip">Copied!</span>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="template-actions">
                        <Link
                            href={`/brands/${id}/transactional/${templateId}/edit`}
                            className="btn btn-secondary"
                        >
                            <Edit size={16} />
                            <span>Edit Template</span>
                        </Link>

                        {template.status === 'draft' && (
                            <button
                                onClick={handlePublish}
                                className="btn btn-primary"
                            >
                                <Play size={16} />
                                <span>Publish Template</span>
                            </button>
                        )}

                        <button
                            onClick={() => setShowPreviewModal(true)}
                            className="btn btn-outline"
                        >
                            <Eye size={16} />
                            <span>Preview</span>
                        </button>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="template-tabs">
                    <div className="tabs-navigation">
                        <button
                            className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <Mail size={16} />
                            <span>Overview</span>
                        </button>
                        <button
                            className={`tab-item ${activeTab === 'api' ? 'active' : ''}`}
                            onClick={() => setActiveTab('api')}
                        >
                            <Code size={16} />
                            <span>API Documentation</span>
                        </button>
                        <button
                            className={`tab-item ${activeTab === 'logs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('logs')}
                        >
                            <Shield size={16} />
                            <span>Logs</span>
                        </button>
                    </div>

                    {/* Tab Contents */}
                    <div className="tab-content">
                        {activeTab === 'overview' && (
                            <div className="overview-tab">
                                <div className="template-info-card">
                                    <div className="card-header">
                                        <h3>Template Details</h3>
                                    </div>
                                    <div className="card-body">
                                        <div className="info-group">
                                            <div className="info-label">Subject</div>
                                            <div className="info-value">{template.subject}</div>
                                        </div>
                                        <div className="info-group">
                                            <div className="info-label">From</div>
                                            <div className="info-value">
                                                {template.fromName || brand.fromName} &lt;{template.fromEmail || brand.fromEmail}&gt;
                                            </div>
                                        </div>
                                        <div className="info-group">
                                            <div className="info-label">Created</div>
                                            <div className="info-value">
                                                {new Date(template.createdAt).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </div>
                                        </div>
                                        <div className="info-group">
                                            <div className="info-label">Variables</div>
                                            <div className="info-value variables-list">
                                                {template.variables && template.variables.length > 0 ? (
                                                    template.variables.map((variable, index) => (
                                                        <span
                                                            key={index}
                                                            className="variable-tag"
                                                        >
                                                            {variable.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-muted">No variables defined</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="info-group">
                                            <div className="info-label">Description</div>
                                            <div className="info-value">{template.description || <span className="text-muted">No description provided</span>}</div>
                                        </div>
                                    </div>
                                </div>

                                {template.status === 'published' && stats && (
                                    <div className="stats-section">
                                        <h3>Usage Statistics</h3>
                                        <div className="stats-grid">
                                            <div className="stat-card">
                                                <div className="stat-icon stat-icon-sent">
                                                    <Send size={20} />
                                                </div>
                                                <div className="stat-content">
                                                    <div className="stat-value">{stats.sent || 0}</div>
                                                    <div className="stat-label">Total Sent</div>
                                                </div>
                                            </div>
                                            <div className="stat-card">
                                                <div className="stat-icon stat-icon-opened">
                                                    <Mail size={20} />
                                                </div>
                                                <div className="stat-content">
                                                    <div className="stat-value">{stats.opened || 0}</div>
                                                    <div className="stat-label">Opened</div>
                                                    <div className="stat-secondary">{stats.sent > 0 ? `${((stats.opened / stats.sent) * 100).toFixed(1)}% open rate` : '0% open rate'}</div>
                                                </div>
                                            </div>
                                            <div className="stat-card">
                                                <div className="stat-icon stat-icon-clicked">
                                                    <Mail size={20} />
                                                </div>
                                                <div className="stat-content">
                                                    <div className="stat-value">{stats.clicked || 0}</div>
                                                    <div className="stat-label">Clicked</div>
                                                    <div className="stat-secondary">{stats.sent > 0 ? `${((stats.clicked / stats.sent) * 100).toFixed(1)}% click rate` : '0% click rate'}</div>
                                                </div>
                                            </div>
                                            <div className="stat-card">
                                                <div className="stat-icon stat-icon-failed">
                                                    <AlertCircle size={20} />
                                                </div>
                                                <div className="stat-content">
                                                    <div className="stat-value">{stats.failed || 0}</div>
                                                    <div className="stat-label">Failed</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'api' && (
                            <div className="api-tab">
                                <APIDocsSection
                                    template={template}
                                    brand={brand}
                                />
                            </div>
                        )}

                        {activeTab === 'logs' && (
                            <div className="logs-tab">
                                <h3>API Request Logs</h3>
                                {/* Logs table will be implemented here */}
                                <div className="logs-table-container">
                                    {/* Implementation of logs table will go here */}
                                    <p className="text-center text-muted">Coming soon - Request logs will be displayed here</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview Modal */}
                {showPreviewModal && (
                    <div
                        className="modal-overlay"
                        onClick={() => setShowPreviewModal(false)}
                    >
                        <div
                            className="modal-container"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>Email Preview</h2>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowPreviewModal(false)}
                                >
                                    <span>&times;</span>
                                </button>
                            </div>
                            <TemplatePreview template={template} />
                        </div>
                    </div>
                )}
            </div>
        </BrandLayout>
    );
}
