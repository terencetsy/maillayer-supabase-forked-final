import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Database, Lock, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { FirebaseOutline } from '@/lib/icons';

export default function BrandIntegrations() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            fetchIntegrations();
        }
    }, [status, id, router]);

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

    const fetchIntegrations = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/integrations`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch integrations');
            }

            const data = await res.json();
            setIntegrations(data);
        } catch (error) {
            console.error('Error fetching integrations:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getIntegrationByType = (type) => {
        return integrations.find((integration) => integration.type === type);
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'active':
                return 'status-badge badge-success';
            case 'inactive':
                return 'status-badge badge-warning';
            case 'error':
                return 'status-badge badge-danger';
            default:
                return 'status-badge badge-default';
        }
    };

    if (isLoading && !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="integrations-container">
                <div className="integrations-header">
                    <h1>Integrations</h1>
                    <p>Connect your brand with external services to extend functionality</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="integration-cards">
                    {/* Firebase Integration */}
                    <div className="integration-card">
                        <div className="integration-icon firebase">
                            <FirebaseOutline size={24} />
                        </div>
                        <div className="integration-info">
                            <h3>Firebase</h3>
                            <p>Connect to Firebase to sync contacts and track user events</p>

                            {getIntegrationByType('firebase') ? (
                                <div className="integration-status">
                                    <div className={getStatusClass(getIntegrationByType('firebase').status)}>{getIntegrationByType('firebase').status}</div>
                                    <span className="integration-date">Connected on {new Date(getIntegrationByType('firebase').createdAt).toLocaleDateString()}</span>
                                </div>
                            ) : (
                                <div className="integration-status">
                                    <div className="status-badge badge-default">Not connected</div>
                                </div>
                            )}
                        </div>
                        <div className="integration-action">
                            <Link
                                href={`/brands/${id}/integrations/firebase`}
                                className="integration-button"
                            >
                                {getIntegrationByType('firebase') ? 'Manage' : 'Connect'}
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                    {/* Airtable Integration */}
                    <div className="integration-card">
                        <div className="integration-icon airtable">
                            <Database size={24} />
                        </div>
                        <div className="integration-info">
                            <h3>Airtable</h3>
                            <p>Connect to Airtable to sync records and import contacts</p>

                            {getIntegrationByType('airtable') ? (
                                <div className="integration-status">
                                    <div className={getStatusClass(getIntegrationByType('airtable').status)}>{getIntegrationByType('airtable').status}</div>
                                    <span className="integration-date">Connected on {new Date(getIntegrationByType('airtable').createdAt).toLocaleDateString()}</span>
                                </div>
                            ) : (
                                <div className="integration-status">
                                    <div className="status-badge badge-default">Not connected</div>
                                </div>
                            )}
                        </div>
                        <div className="integration-action">
                            <Link
                                href={`/brands/${id}/integrations/airtable`}
                                className="integration-button"
                            >
                                {getIntegrationByType('airtable') ? 'Manage' : 'Connect'}
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                    {/* Google Sheets Integration */}
                    <div className="integration-card">
                        <div className="integration-icon google-sheets">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div className="integration-info">
                            <h3>Google Sheets</h3>
                            <p>Connect to Google Sheets to import and export contacts data</p>

                            {getIntegrationByType('google_sheets') ? (
                                <div className="integration-status">
                                    <div className={getStatusClass(getIntegrationByType('google_sheets').status)}>{getIntegrationByType('google_sheets').status}</div>
                                    <span className="integration-date">Connected on {new Date(getIntegrationByType('google_sheets').createdAt).toLocaleDateString()}</span>
                                </div>
                            ) : (
                                <div className="integration-status">
                                    <div className="status-badge badge-default">Not connected</div>
                                </div>
                            )}
                        </div>
                        <div className="integration-action">
                            <Link
                                href={`/brands/${id}/integrations/google-sheets`}
                                className="integration-button"
                            >
                                {getIntegrationByType('google_sheets') ? 'Manage' : 'Connect'}
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                    {/* Supabase Integration (Coming Soon) */}
                    <div className="integration-card disabled">
                        <div className="integration-icon supabase">
                            <Database size={24} />
                        </div>
                        <div className="integration-info">
                            <h3>Supabase</h3>
                            <p>Connect to Supabase to sync users and send transactional emails</p>
                            <div className="integration-status">
                                <div className="status-badge badge-default">Coming Soon</div>
                            </div>
                        </div>
                        <div className="integration-action">
                            <button className="integration-button disabled">
                                Connect
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                    {/* Auth0 Integration (Coming Soon) */}
                    <div className="integration-card disabled">
                        <div className="integration-icon auth0">
                            <Lock size={24} />
                        </div>
                        <div className="integration-info">
                            <h3>Auth0</h3>
                            <p>Connect to Auth0 to sync users and automate onboarding emails</p>
                            <div className="integration-status">
                                <div className="status-badge badge-default">Coming Soon</div>
                            </div>
                        </div>
                        <div className="integration-action">
                            <button className="integration-button disabled">
                                Connect
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {isLoading && (
                    <div className="loading-section">
                        <div className="spinner"></div>
                        <p>Loading integrations...</p>
                    </div>
                )}
            </div>
        </BrandLayout>
    );
}
