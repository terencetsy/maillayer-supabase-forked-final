import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { MailSend02 } from '@/lib/icons';

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

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
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = () => {
        signOut({ callbackUrl: '/login' });
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
                        <MailSend02 />
                        <span>Maillayer</span>
                    </div>

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
                        <p>You are logged in as {userProfile?.role === 'admin' ? 'an administrator' : 'a user'}.</p>
                    </div>

                    <div className="dashboard-content">
                        <div className="dashboard-card">
                            <h2>Getting Started</h2>
                            <p>This is your Maillayer dashboard. From here, you can manage your email campaigns, subscribers, and more.</p>
                            <p>Start by exploring the menu on the left to access different features.</p>
                        </div>

                        <div className="dashboard-card">
                            <h2>Recent Activity</h2>
                            <p>Your account was created recently.</p>
                            <p>No email campaigns have been sent yet.</p>
                        </div>

                        <div className="dashboard-card">
                            <h2>Quick Actions</h2>
                            <p>Create your first email campaign</p>
                            <p>Import your subscribers</p>
                            <p>Configure your sending settings</p>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
