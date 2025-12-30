import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { Code, ContactBook, DatabaseSync, Home03, Mail02, Setting07, Shield02, Zap } from '@/lib/icons';

export default function BrandLayout({ children, brand }) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [isLoading, setIsLoading] = useState(true);
    const [quota, setQuota] = useState(null);
    const [quotaProvider, setQuotaProvider] = useState(null);
    const [loadingQuota, setLoadingQuota] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            setIsLoading(false);
        }
    }, [status, router]);

    // Fetch quota information
    useEffect(() => {
        if (brand && brand._id) {
            fetchQuota();
            // Refresh quota every 5 minutes
            const interval = setInterval(fetchQuota, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [brand]);

    const getQuotaClass = (percentage) => {
        if (percentage >= 90) return 'quota-critical';
        if (percentage >= 75) return 'quota-high';
        if (percentage >= 50) return 'quota-medium';
        return 'quota-low';
    };

    const fetchQuota = async () => {
        try {
            const response = await fetch(`/api/brands/${brand._id}/quota`);
            const data = await response.json();

            if (response.ok && data.configured) {
                setQuota(data.quota);
                setQuotaProvider(data.providerName || 'Email Provider');
            } else {
                setQuota(null);
                setQuotaProvider(data.providerName || null);
            }
        } catch (error) {
            console.error('Error fetching quota:', error);
            setQuota(null);
            setQuotaProvider(null);
        } finally {
            setLoadingQuota(false);
        }
    };

    // Determine active menu item based on the current path
    const getActiveMenuItem = () => {
        const path = router.pathname;
        console.log(path);
        if (path.includes('/brands/[id]/campaigns/[campaignId]')) return 'campaignEditor';
        if (path.includes('/campaigns')) return 'campaigns';
        if (path.includes('/brands/[id]/contacts/[listId]')) return 'contactsList';
        if (path.includes('/contacts')) return 'contacts';
        if (path.includes('/transactional')) return 'transactional';
        if (path.includes('/integrations')) return 'integrations';
        if (path.includes('/settings')) return 'settings';
        if (path.includes('/verification')) return 'verification';
        return '';
    };

    const activeMenuItem = getActiveMenuItem();

    // Format number with commas
    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US').format(Math.round(num));
    };

    // Get color based on percentage
    const getQuotaColor = (percentage) => {
        if (percentage >= 90) return '#ef4444'; // red
        if (percentage >= 75) return '#f59e0b'; // orange
        if (percentage >= 50) return '#eab308'; // yellow
        return '#10b981'; // green
    };

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!brand) return null;

    return (
        <>
            <Head>
                <title>{brand.name}</title>
                <meta
                    name="description"
                    content={`${brand.name} - Brand Management`}
                />
                <link
                    rel="icon"
                    href="/favicon.png"
                />
            </Head>

            <div className="app-container">
                {/* Sidebar */}
                <div className="sidebar">
                    <div>
                        <div className="sidebar-header">
                            <div className="brand-logo">
                                <div className="logo-icon">
                                    <img
                                        src={`https://www.google.com/s2/favicons?sz=64&domain_url=${brand.website}`}
                                        height={24}
                                        width={24}
                                    />
                                </div>
                                <div className="brand-info">
                                    <div className="brand-name">{brand.name}</div>
                                    <div className="brand-website">{brand.website}</div>
                                </div>
                            </div>
                        </div>

                        <nav className="sidebar-nav">
                            <Link
                                href={`/brands/${brand._id}/campaigns`}
                                className={`nav-item ${activeMenuItem === 'campaigns' ? 'active' : ''}`}
                            >
                                <Mail02 size={20} />
                                <span>Campaigns</span>
                            </Link>

                            <Link
                                href={`/brands/${brand._id}/contacts`}
                                className={`nav-item ${activeMenuItem === 'contacts' ? 'active' : ''}`}
                            >
                                <ContactBook size={20} />
                                <span>Contacts</span>
                            </Link>

                            <Link
                                href={`/brands/${brand._id}/transactional`}
                                className={`nav-item ${activeMenuItem === 'transactional' ? 'active' : ''}`}
                            >
                                <Code size={20} />
                                <span>Transactional</span>
                            </Link>
                            <Link
                                href={`/brands/${brand._id}/integrations`}
                                className={`nav-item ${router.pathname.includes('/brands/[id]/integrations') ? 'active' : ''}`}
                            >
                                <DatabaseSync size={18} />
                                Integrations
                            </Link>
                            <Link
                                href={`/brands/${brand._id}/sequences`}
                                className={router.pathname.includes('/sequences') ? 'active' : ''}
                            >
                                <Zap size={20} />
                                <span>Email Sequences</span>
                            </Link>
                            <Link
                                href={`/brands/${brand._id}/settings`}
                                className={`nav-item ${activeMenuItem === 'settings' ? 'active' : ''}`}
                            >
                                <Setting07 size={20} />
                                <span>Settings</span>
                            </Link>

                            {(brand.status === 'pending_setup' || brand.status === 'pending_verification') && (
                                <Link
                                    href={`/brands/${brand._id}/verification`}
                                    className={`nav-item verification ${activeMenuItem === 'verification' ? 'active' : ''}`}
                                >
                                    <Shield02 />
                                    <span>Verification</span>
                                    <span className="verification-badge">Required</span>
                                </Link>
                            )}
                            <div className="divider" />
                            <Link
                                href="/brands"
                                className="nav-item secondary"
                            >
                                <Home03 size={20} />
                                <span>Back to Brands</span>
                            </Link>
                        </nav>
                    </div>

                    <div className="sidebar-footer">
                        {loadingQuota ? (
                            <div className="quota-loading">
                                <span className="spinner-small"></span>
                                <span>Loading quota...</span>
                            </div>
                        ) : quota ? (
                            <div className={`quota-container ${getQuotaClass(quota.percentageUsed)}`}>
                                <div className="quota-header">
                                    <span className="quota-label">{quotaProvider || 'Email'} Quota</span>
                                    <span className="quota-percentage">{quota.percentageUsed.toFixed(1)}%</span>
                                </div>
                                <div className="quota-bar-container">
                                    <div
                                        className="quota-bar"
                                        style={{
                                            width: `${Math.min(quota.percentageUsed, 100)}%`,
                                        }}
                                    />
                                </div>
                                <div className="quota-details">
                                    <span className="quota-sent">{formatNumber(quota.sentLast24Hours)} sent{quota.isMonthlyQuota ? ' this month' : ''}</span>
                                    <span className="quota-total">of {formatNumber(quota.max24HourSend)}{quota.isMonthlyQuota ? '/mo' : ''}</span>
                                </div>
                                <div className="quota-remaining">{formatNumber(quota.remainingQuota)} emails remaining</div>
                            </div>
                        ) : (
                            <Link
                                href={`/brands/${brand._id}/verification`}
                                className="nav-item secondary"
                            >
                                <span>Configure {quotaProvider || 'email provider'} to view quota</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Main content */}
                <main className="brand-main-content">
                    <header className="top-header">
                        <h1 className="page-title">
                            {activeMenuItem === 'campaigns' && 'Campaigns'}
                            {activeMenuItem === 'campaignEditor' && ''}
                            {activeMenuItem === 'contacts' && 'Contacts'}
                            {activeMenuItem === 'contactsList' && ''}
                            {activeMenuItem === 'analytics' && 'Analytics'}
                        </h1>
                    </header>

                    <div className="content-area">{children}</div>
                </main>
            </div>
        </>
    );
}
