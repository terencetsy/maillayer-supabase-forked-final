import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Mail, PlusCircle } from 'lucide-react';

export default function BrandCampaigns() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
            // In a real application, you would also fetch campaigns here
            // For now, we'll just set an empty array after a delay to simulate loading
            setTimeout(() => {
                setCampaigns([]);
                setIsLoading(false);
            }, 500);
        }
    }, [status, id, router]);

    const fetchBrandDetails = async () => {
        try {
            const res = await fetch(`/api/brands/${id}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Brand not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch brand details');
                }
            }

            const data = await res.json();
            setBrand(data);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            setError(error.message);
        }
    };

    // This is used just for the layout to identify the brand
    if (isLoading || !brand) return null;

    return (
        <BrandLayout brand={brand}>
            <div className="campaigns-container">
                {/* Campaigns Section */}
                <div className="campaigns-section">
                    {/* Empty State */}
                    {campaigns.length === 0 && (
                        <div className="empty-state">
                            <div className="icon-wrapper">
                                <Mail size={32} />
                            </div>
                            <h2>No campaigns yet</h2>
                            <p>Create your first email campaign to start engaging with your audience</p>
                            <button className="btn">
                                <PlusCircle size={18} />
                                Create Campaign
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </BrandLayout>
    );
}
