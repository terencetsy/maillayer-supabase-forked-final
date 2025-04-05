import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Mail, Plus, Search, MoreVertical, Bell, LogOut, Grid, List, X, Filter } from 'lucide-react';
import BrandForm from '@/components/BrandForm';
import { MailSend02 } from '@/lib/icons';

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [brands, setBrands] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && session?.user) {
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

    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return '#51cf66';
            case 'inactive':
                return '#adb5bd';
            case 'pending_setup':
                return '#74c0fc';
            case 'pending_verification':
                return '#ff5252';
            default:
                return '#adb5bd';
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

    // Filter brands based on search query
    const filteredBrands = brands.filter((brand) => brand.name.toLowerCase().includes(searchQuery.toLowerCase()) || brand.website.toLowerCase().includes(searchQuery.toLowerCase()));

    if (status === 'loading' || isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (!session) return null;

    return (
        <>
            <Head>
                <title>Brands | Iconbuddy</title>
                <meta
                    name="description"
                    content="Iconbuddy Brand Dashboard"
                />
            </Head>

            <div className="modern-dashboard">
                <header className="dashboard-header">
                    <div className="dashboard-logo">
                        <Link href="/brands">
                            <MailSend02 size={24} />
                            <span>Iconbuddy</span>
                        </Link>
                    </div>

                    <div className="header-actions">
                        <div className="search-bar">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search brands..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    className="clear-search"
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <div className="user-menu">
                            <button className="notification-bell">
                                <Bell size={20} />
                            </button>

                            <div className="user-profile">
                                <div className="avatar">{userProfile?.name?.charAt(0) || 'U'}</div>
                                <span className="user-name">{userProfile?.name || 'User'}</span>
                            </div>

                            <div className="dropdown">
                                <button className="more-options">
                                    <MoreVertical size={20} />
                                </button>
                                <div className="dropdown-menu">
                                    <button
                                        onClick={handleSignOut}
                                        className="dropdown-item"
                                    >
                                        <LogOut size={16} />
                                        <span>Sign out</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="main-content">
                    <div className="dashboard-title-row">
                        <div className="title-section">
                            <h1>Your Brands</h1>
                            {brands.length > 0 && (
                                <div className="brands-count">
                                    {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
                                </div>
                            )}
                        </div>

                        <div className="action-buttons">
                            {brands.length > 0 && (
                                <div className="view-toggle">
                                    <button
                                        className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                        onClick={() => setViewMode('grid')}
                                        aria-label="Grid view"
                                    >
                                        <Grid size={18} />
                                    </button>
                                    <button
                                        className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                        onClick={() => setViewMode('list')}
                                        aria-label="List view"
                                    >
                                        <List size={18} />
                                    </button>
                                </div>
                            )}

                            {!showCreateForm && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleCreateClick}
                                >
                                    <Plus size={16} />
                                    Create New Brand
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="brands-content">
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
                                        <div className="icon-wrapper">
                                            <Mail size={32} />
                                        </div>
                                        <h2>No brands found</h2>
                                        <p>Create your first brand to start sending emails with Iconbuddy.</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleCreateClick}
                                        >
                                            <Plus size={16} />
                                            Create Your First Brand
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {filteredBrands.length === 0 ? (
                                            <div className="empty-state search-empty">
                                                <h2>No matching brands</h2>
                                                <p>No brands match your search query: "{searchQuery}"</p>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => setSearchQuery('')}
                                                >
                                                    Clear Search
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={viewMode === 'grid' ? 'brands-grid' : 'brands-list'}>
                                                    {filteredBrands.map((brand) => (
                                                        <Link
                                                            href={`/brands/${brand._id}`}
                                                            key={brand._id}
                                                            className="brand-card"
                                                        >
                                                            <div className="brand-card-content">
                                                                <div className="brand-header">
                                                                    <h3>{brand.name}</h3>
                                                                    <div
                                                                        className="status-indicator"
                                                                        style={{ backgroundColor: getStatusColor(brand.status) }}
                                                                    >
                                                                        <span>{getStatusText(brand.status)}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="brand-details">
                                                                    <div className="detail-row">
                                                                        <span className="detail-label">Website</span>
                                                                        <span className="detail-value">{brand.website}</span>
                                                                    </div>
                                                                    <div className="detail-row">
                                                                        <span className="detail-label">Created</span>
                                                                        <span className="detail-value">{new Date(brand.createdAt).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                                {viewMode === 'list' && (
                                                                    <div className="brand-actions">
                                                                        <button className="view-details-btn">View Details</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </>
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
