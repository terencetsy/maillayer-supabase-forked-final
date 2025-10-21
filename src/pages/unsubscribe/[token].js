import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Unsubscribe() {
    const router = useRouter();
    const { token } = router.query;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isUnsubscribed, setIsUnsubscribed] = useState(false);
    const [success, setSuccess] = useState(false);

    // Fetch contact details from token
    useEffect(() => {
        if (!token) return;

        const fetchContactDetails = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/unsubscribe/${token}`, {
                    method: 'GET',
                });

                const data = await res.json();

                if (data.success) {
                    setEmail(data.email);
                    setIsUnsubscribed(data.isUnsubscribed);
                } else {
                    setError(data.message || 'Invalid unsubscribe link');
                }
            } catch (err) {
                setError('Error loading unsubscribe page');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchContactDetails();
    }, [token]);

    const handleUnsubscribe = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            const res = await fetch(`/api/unsubscribe/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(true);
                setIsUnsubscribed(true);
            } else {
                setError(data.message || 'Failed to unsubscribe');
            }
        } catch (err) {
            setError('Error processing your request');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="unsubscribe-container">
                <div className="unsubscribe-card">
                    <div className="loading-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="unsubscribe-container">
                <div className="unsubscribe-card">
                    <h1>Error</h1>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="unsubscribe-container">
            <Head>
                <title>Unsubscribe from Emails</title>
            </Head>

            <div className="unsubscribe-card">
                {isUnsubscribed ? (
                    <div className="unsubscribe-success">
                        <h1>You&apos;re Unsubscribed</h1>
                        <p>You have been successfully unsubscribed from our mailing list.</p>
                        <p>Email: {email}</p>
                        {success && <p>Thank you for your feedback.</p>}
                    </div>
                ) : (
                    <div className="unsubscribe-form">
                        <h1>Unsubscribe from Emails</h1>
                        <p>Are you sure you want to unsubscribe {email} from our emails?</p>

                        <form onSubmit={handleUnsubscribe}>
                            <div className="form-group">
                                <label htmlFor="reason">Reason for unsubscribing (optional):</label>
                                <select
                                    id="reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                >
                                    <option value="">Select a reason</option>
                                    <option value="too_many_emails">Too many emails</option>
                                    <option value="not_relevant">Content not relevant</option>
                                    <option value="didnt_signup">I didn&apos;t sign up</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    className="unsubscribe-btn"
                                >
                                    {loading ? 'Processing...' : 'Unsubscribe'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
