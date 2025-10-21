import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Plus, Search, LogOut, X, Mail } from 'lucide-react';
import BrandForm from '@/components/BrandForm';
import { SendMail } from '@/lib/icons';

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [brands, setBrands] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && session?.user) {
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
            const res = await fetch('/api/user/profile', { credentials: 'same-origin' });
            if (!res.ok) return;
            const data = await res.json();
            setUserProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const fetchBrands = async () => {
        try {
            const res = await fetch('/api/brands', { credentials: 'same-origin' });
            if (!res.ok) return;
            const data = await res.json();
            setBrands(data);

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

    const getStatusBadge = (status) => {
        const statusConfig = {
            active: { label: 'Active', class: 'success' },
            inactive: { label: 'Inactive', class: 'neutral' },
            pending_setup: { label: 'Setup Needed', class: 'warning' },
            pending_verification: { label: 'Verification Pending', class: 'error' },
        };

        const config = statusConfig[status] || { label: status, class: 'neutral' };

        return <span className={`status-badge ${config.class}`}>{config.label}</span>;
    };

    const filteredBrands = brands.filter((brand) => brand.name.toLowerCase().includes(searchQuery.toLowerCase()) || brand.website.toLowerCase().includes(searchQuery.toLowerCase()));

    if (status === 'loading' || isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!session) return null;

    return (
        <>
            <Head>
                <title>Brands - Maillayer</title>
                <meta
                    name="description"
                    content="Brand Dashboard"
                />
                <link
                    rel="icon"
                    href="/favicon.png"
                />
            </Head>

            <div className="brands-page">
                <header className="brands-header">
                    <div className="header-left">
                        <Link
                            href="/brands"
                            className="logo"
                        >
                            <SendMail size={24} />
                            <span>Maillayer</span>
                        </Link>
                    </div>

                    <div className="header-right">
                        <div className="user-menu">
                            <div className="user-info">
                                <div className="avatar">{userProfile?.name?.charAt(0) || 'U'}</div>
                                <span className="user-name">{userProfile?.name || 'User'}</span>
                            </div>
                            <button
                                className="logout-btn"
                                onClick={handleSignOut}
                                title="Sign out"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="brands-main">
                    <div className="brands-container">
                        <div className="page-header">
                            <div className="header-content">
                                <h1>Brands</h1>
                                {brands.length > 0 && (
                                    <span className="count-badge">
                                        {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
                                    </span>
                                )}
                            </div>

                            <div className="header-actions">
                                {brands.length > 0 && (
                                    <div className="search-box">
                                        <Search size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search brands..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                className="clear-btn"
                                                onClick={() => setSearchQuery('')}
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {!showCreateForm && (
                                    <button
                                        className="button button--primary"
                                        onClick={handleCreateClick}
                                    >
                                        <Plus size={16} />
                                        <span>New Brand</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {showCreateForm ? (
                            <div className="create-form-card">
                                <BrandForm
                                    onCancel={handleCancelCreate}
                                    onSuccess={handleCreateSuccess}
                                />
                            </div>
                        ) : (
                            <>
                                {brands.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-icon">
                                            <Mail size={48} />
                                        </div>
                                        <h2>No brands yet</h2>
                                        <p>Create your first brand to start sending campaigns</p>
                                        <button
                                            className="button button--primary"
                                            onClick={handleCreateClick}
                                        >
                                            <Plus size={16} />
                                            <span>Create Brand</span>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {filteredBrands.length === 0 ? (
                                            <div className="empty-state">
                                                <h2>No results</h2>
                                                <p>No brands match "{searchQuery}"</p>
                                                <button
                                                    className="button button--secondary"
                                                    onClick={() => setSearchQuery('')}
                                                >
                                                    Clear Search
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="brands-grid">
                                                {filteredBrands.map((brand) => (
                                                    <Link
                                                        href={`/brands/${brand._id}`}
                                                        key={brand._id}
                                                        className="brand-card"
                                                    >
                                                        <div className="brand-card-header">
                                                            <h3>{brand.name}</h3>
                                                            {getStatusBadge(brand.status)}
                                                        </div>
                                                        <div className="brand-card-body">
                                                            <div className="brand-info">
                                                                <span className="label">Website</span>
                                                                <span className="value">{brand.website}</span>
                                                            </div>
                                                            <div className="brand-info">
                                                                <span className="label">Created</span>
                                                                <span className="value">{new Date(brand.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
