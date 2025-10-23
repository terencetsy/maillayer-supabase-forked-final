import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { CheckmarkCircle02, AlertCircle, MailOutgoing } from '@/lib/icons';

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

    if (loading && !email) {
        return (
            <div className="auth-page">
                <Head>
                    <title>Unsubscribe from Emails</title>
                    <link
                        rel="icon"
                        href="/favicon.png"
                    />
                </Head>
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="loading-section">
                            <div className="spinner"></div>
                            <p>Loading...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !email) {
        return (
            <div className="auth-page">
                <Head>
                    <title>Unsubscribe - Error</title>
                    <link
                        rel="icon"
                        href="/favicon.png"
                    />
                </Head>
                <div className="auth-container">
                    <div className="auth-card">
                        <div
                            className="empty-view"
                            style={{ padding: '2rem 1rem' }}
                        >
                            <div
                                className="empty-icon"
                                style={{ width: '64px', height: '64px' }}
                            >
                                <AlertCircle size={32} />
                            </div>
                            <h2>Error</h2>
                            <p>{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <Head>
                <title>Unsubscribe from Emails</title>
                <link
                    rel="icon"
                    href="/favicon.png"
                />
            </Head>

            <div className="auth-container">
                <div className="auth-card">
                    {/* Logo */}
                    <div className="auth-logo">
                        <MailOutgoing size={24} />
                        <span>Unsubscribe</span>
                    </div>

                    {isUnsubscribed ? (
                        // Success State
                        <div
                            className="empty-view"
                            style={{ padding: '2rem 1rem' }}
                        >
                            <div
                                className="empty-icon"
                                style={{ width: '64px', height: '64px', background: '#dcfce7' }}
                            >
                                <CheckmarkCircle02
                                    size={32}
                                    style={{ color: '#16a34a' }}
                                />
                            </div>
                            <h2>You&apos;re Unsubscribed</h2>
                            <p style={{ marginBottom: '0.5rem' }}>You have been successfully unsubscribed from our mailing list.</p>
                            <p style={{ fontSize: '0.8125rem', color: '#999', margin: 0 }}>{email}</p>
                            {success && (
                                <div
                                    className="alert alert--success"
                                    style={{ marginTop: '1.5rem', marginBottom: 0 }}
                                >
                                    <CheckmarkCircle02 size={16} />
                                    <span>Thank you for your feedback.</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Unsubscribe Form
                        <>
                            <div className="auth-header">
                                <h1>Unsubscribe from Emails</h1>
                                <p>We&apos;re sorry to see you go</p>
                            </div>

                            {error && (
                                <div className="alert alert--error">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#1a1a1a' }}>Are you sure you want to unsubscribe?</p>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#666' }}>{email}</p>
                            </div>

                            <form
                                onSubmit={handleUnsubscribe}
                                className="auth-form"
                            >
                                <div className="form-group">
                                    <label htmlFor="reason">Reason for unsubscribing (optional)</label>
                                    <select
                                        id="reason"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="form-select"
                                        disabled={loading}
                                    >
                                        <option value="">Select a reason</option>
                                        <option value="too_many_emails">Too many emails</option>
                                        <option value="not_relevant">Content not relevant</option>
                                        <option value="didnt_signup">I didn&apos;t sign up</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className="button button--primary button--full"
                                    disabled={loading}
                                >
                                    {loading && <span className="spinner"></span>}
                                    {!loading && <span>Confirm Unsubscribe</span>}
                                </button>
                            </form>

                            <div className="auth-footer">
                                <p style={{ fontSize: '0.75rem' }}>Changed your mind? You can close this page.</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
