import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { MailSend02 } from '@/lib/icons';
import BrandForm from '@/components/BrandForm';

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [brands, setBrands] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && session?.user) {
            console.log('Session:', session);

            // Use session data as a basic fallback
            setUserProfile({
                name: session.user.name || '',
                email: session.user.email || '',
                role: session.user.role || 'user',
            });

            fetchUserProfile();
            fetchBrands();
        }
    }, [status, session, router]);

    const fetchUserProfile = async () => {
        try {
            const res = await fetch('/api/user/profile', {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                console.error('Failed to fetch profile:', res.status);
                return;
            }

            const data = await res.json();
            console.log('Profile data:', data);
            setUserProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const fetchBrands = async () => {
        try {
            const res = await fetch('/api/brands', {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                console.error('Failed to fetch brands:', res.status);
                return;
            }

            const data = await res.json();
            console.log('Brands data:', data);
            setBrands(data);

            // Automatically show create form if no brands exist
            if (data.length === 0) {
                setShowCreateForm(true);
            }
        } catch (error) {
            console.error('Error fetching brands:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = () => {
        signOut({ callbackUrl: '/login' });
    };

    const handleCreateClick = () => {
        setShowCreateForm(true);
    };

    const handleCancelCreate = () => {
        setShowCreateForm(false);
    };

    const handleCreateSuccess = (newBrand) => {
        setBrands((prevBrands) => [...prevBrands, newBrand]);
        setShowCreateForm(false);
    };

    const getBadgeClass = (status) => {
        switch (status) {
            case 'active':
                return 'badge-success';
            case 'inactive':
                return 'badge-inactive';
            case 'pending_setup':
                return 'badge-setup';
            case 'pending_verification':
                return 'badge-pending';
            default:
                return 'badge-inactive';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'active':
                return 'Active';
            case 'inactive':
                return 'Inactive';
            case 'pending_setup':
                return 'Needs Setup';
            case 'pending_verification':
                return 'Pending Verification';
            default:
                return status;
        }
    };

    if (status === 'loading' || isLoading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (!session) return null;

    return (
        <>
            <Head>
                <title>Dashboard | Maillayer</title>
                <meta
                    name="description"
                    content="Maillayer Dashboard"
                />
            </Head>

            <div className="dashboard">
                <header className="dashboard-header">
                    <div className="dashboard-logo">
                        <Link href="/brands">
                            <MailSend02 />
                            <span>Maillayer</span>
                        </Link>
                    </div>

                    <div className="dashboard-user">
                        <div className="user-info">
                            <span className="user-name">{userProfile?.name || 'User'}</span>
                            <span className="user-email">{userProfile?.email || session.user.email}</span>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="btn btn-outline"
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                <main className="dashboard-main">
                    <div className="dashboard-welcome">
                        <h1>Brands</h1>
                        {!showCreateForm && (
                            <button
                                className="btn btn-primary create-brand-btn"
                                onClick={handleCreateClick}
                            >
                                <span className="btn-icon">+</span>
                                Create New Brand
                            </button>
                        )}
                    </div>

                    <div className="dashboard-content">
                        {showCreateForm ? (
                            <div className="form-container">
                                <BrandForm
                                    onCancel={handleCancelCreate}
                                    onSuccess={handleCreateSuccess}
                                />
                            </div>
                        ) : (
                            <>
                                {brands.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📧</div>
                                        <h2>No brands found</h2>
                                        <p>Create your first brand to start sending emails with Maillayer.</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleCreateClick}
                                        >
                                            Create Your First Brand
                                        </button>
                                    </div>
                                ) : (
                                    <div className="brands-grid">
                                        {brands.map((brand) => (
                                            <Link
                                                href={`/brands/${brand._id}`}
                                                key={brand._id}
                                                className="brand-card"
                                            >
                                                <div className="brand-card-content">
                                                    <div className="brand-header">
                                                        <h3>{brand.name}</h3>
                                                        <span className={`badge ${getBadgeClass(brand.status)}`}>{getStatusText(brand.status)}</span>
                                                    </div>
                                                    <div className="brand-details">
                                                        <div className="detail-row">
                                                            <span className="detail-label">Website</span>
                                                            <span className="detail-value">{brand.website}</span>
                                                        </div>
                                                        <div className="detail-row">
                                                            <span className="detail-label">Status</span>
                                                            <span className="detail-value status-text">{getStatusText(brand.status)}</span>
                                                        </div>
                                                        <div className="detail-row">
                                                            <span className="detail-label">Created</span>
                                                            <span className="detail-value">{new Date(brand.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="brand-footer">
                                                        <button className="btn btn-secondary view-details-btn">View Details</button>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>

                <footer className="dashboard-footer">
                    <div className="footer-content">
                        <p>&copy; {new Date().getFullYear()} Maillayer. All rights reserved.</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
