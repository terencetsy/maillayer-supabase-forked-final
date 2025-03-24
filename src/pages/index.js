import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        // Redirects are handled in middleware, but this is a fallback
        const checkAndRedirect = async () => {
            if (status === 'loading') return;

            try {
                // Check if admin exists
                const res = await fetch('/api/auth/check-admin');
                const data = await res.json();

                if (session) {
                    // If authenticated, go to dashboard
                    router.push('/dashboard');
                } else if (!data.adminExists) {
                    // If no admin, go to signup
                    router.push('/signup');
                } else {
                    // Otherwise, go to login
                    router.push('/login');
                }
            } catch (error) {
                console.error('Error checking admin existence:', error);
                // Default to login page on error
                router.push('/login');
            }
        };

        checkAndRedirect();
    }, [session, status, router]);

    // Loading state
    return (
        <>
            <Head>
                <title>Maillayer - Email Marketing Platform</title>
            </Head>
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Preparing Maillayer...</p>
            </div>
        </>
    );
}
