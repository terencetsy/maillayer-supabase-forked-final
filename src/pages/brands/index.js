import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { MailSend02 } from '@/lib/icons';
import BrandList from '@/components/BrandList';
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

                    {/* <nav className="main-nav">
                        <ul>
                            <li className="active">
                                <Link href="/brands">Dashboard</Link>
                            </li>
                        </ul>
                    </nav> */}

                    <div className="dashboard-user">
                        <span>{userProfile?.email || session.user.email}</span>
                        <button
                            onClick={handleSignOut}
                            className="btn btn-secondary btn-sm"
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                <main className="dashboard-main">
                    <div className="dashboard-welcome">
                        <h1>Welcome{userProfile?.name ? `, ${userProfile.name}` : ' to Maillayer'}</h1>
                        <p>Manage your email sending brands below.</p>
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
                            <BrandList
                                brands={brands}
                                onCreateClick={handleCreateClick}
                            />
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
