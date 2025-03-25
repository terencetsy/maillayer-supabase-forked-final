import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// This component redirects to the campaigns page
export default function BrandDetail() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            // Redirect to the campaigns page
            router.push(`/brands/${id}/campaigns`);
        }
    }, [status, id, router]);

    // Show a loading state while redirecting
    return (
        <div className="loading-screen">
            <div className="spinner"></div>
            <p>Loading...</p>
        </div>
    );
}
