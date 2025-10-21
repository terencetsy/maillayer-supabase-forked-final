import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { Code, ContactBook, DatabaseSync, Home03, Mail02, Setting07, Shield02 } from '@/lib/icons';

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
                        <Link
                            href="/brands"
                            className="nav-item secondary"
                        >
                            <span>20,000 emails sent</span>
                        </Link>
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
