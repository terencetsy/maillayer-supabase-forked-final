import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { Mail, Users, BarChart, Settings, Shield, Home, Search, Bell, MoreVertical } from 'lucide-react';

export default function BrandLayout({ children, brand }) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            setIsLoading(false);
        }
    }, [status, router]);

    // Determine active menu item based on the current path
    const getActiveMenuItem = () => {
        const path = router.pathname;
        if (path.includes('/campaigns')) return 'campaigns';
        if (path.includes('/contacts')) return 'contacts';
        if (path.includes('/analytics')) return 'analytics';
        if (path.includes('/settings')) return 'settings';
        if (path.includes('/verification')) return 'verification';
        return '';
    };

    const activeMenuItem = getActiveMenuItem();

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
                <title>{brand.name} | Iconbuddy</title>
                <meta
                    name="description"
                    content={`${brand.name} - Iconbuddy Brand Management`}
                />
            </Head>

            <div className="app-container">
                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <div className="brand-logo">
                            <div className="logo-icon"></div>
                            <div className="brand-info">
                                <div className="brand-name">{brand.name}</div>
                                <div className="brand-email">{brand.website}</div>
                            </div>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <Link
                            href={`/brands/${brand._id}/campaigns`}
                            className={`nav-item ${activeMenuItem === 'campaigns' ? 'active' : ''}`}
                        >
                            <Mail size={20} />
                            <span>Campaigns</span>
                        </Link>

                        <Link
                            href={`/brands/${brand._id}/contacts`}
                            className={`nav-item ${activeMenuItem === 'contacts' ? 'active' : ''}`}
                        >
                            <Users size={20} />
                            <span>Contacts</span>
                        </Link>

                        <Link
                            href={`/brands/${brand._id}/analytics`}
                            className={`nav-item ${activeMenuItem === 'analytics' ? 'active' : ''}`}
                        >
                            <BarChart size={20} />
                            <span>Analytics</span>
                        </Link>

                        <Link
                            href={`/brands/${brand._id}/settings`}
                            className={`nav-item ${activeMenuItem === 'settings' ? 'active' : ''}`}
                        >
                            <Settings size={20} />
                            <span>Settings</span>
                        </Link>

                        {(brand.status === 'pending_setup' || brand.status === 'pending_verification') && (
                            <Link
                                href={`/brands/${brand._id}/verification`}
                                className={`nav-item verification ${activeMenuItem === 'verification' ? 'active' : ''}`}
                            >
                                <Shield size={20} />
                                <span>Verification</span>
                                <span className="verification-badge">Required</span>
                            </Link>
                        )}
                    </nav>

                    <div className="sidebar-footer">
                        <Link
                            href="/brands"
                            className="nav-item secondary"
                        >
                            <Home size={20} />
                            <span>Back to Brands</span>
                        </Link>
                    </div>
                </aside>

                {/* Main content */}
                <main className="brand-main-content">
                    <header className="top-header">
                        <h1 className="page-title">
                            {activeMenuItem === 'campaigns' && 'Campaigns'}
                            {activeMenuItem === 'contacts' && 'Contacts'}
                            {activeMenuItem === 'analytics' && 'Analytics'}
                            {activeMenuItem === 'settings' && 'Settings'}
                            {activeMenuItem === 'verification' && 'Verification'}
                        </h1>

                        <div className="header-actions">
                            <div className="user-menu">
                                <button className="notification-bell">
                                    <Bell size={20} />
                                </button>

                                <div className="user-profile">
                                    <div className="avatar">{session?.user?.name?.charAt(0) || 'U'}</div>
                                    <span className="user-name">{session?.user?.name || 'User'}</span>
                                </div>

                                <button className="more-options">
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="content-area">{children}</div>
                </main>
            </div>
        </>
    );
}
