import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Loader, CheckCircle, AlertCircle, Mail, MailX } from 'lucide-react';

export default function Unsubscribe() {
    const router = useRouter();
    const { token } = router.query;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isUnsubscribed, setIsUnsubscribed] = useState(false);
    const [success, setSuccess] = useState(false);

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

    // Loading state
    if (loading && !email) {
        return (
            <>
                <Head>
                    <title>Unsubscribe - Maillayer</title>
                    <link rel="icon" href="/favicon.png" />
                </Head>
                <div className="unsubscribe-page">
                    <div className="unsubscribe-bg">
                        <div className="gradient-orb gradient-orb-1"></div>
                        <div className="gradient-orb gradient-orb-2"></div>
                    </div>
                    <div className="unsubscribe-container">
                        <div className="unsubscribe-card">
                            <div className="loading-state">
                                <Loader size={24} className="spin" />
                                <span>Loading...</span>
                            </div>
                        </div>
                    </div>
                </div>
                <style jsx>{styles}</style>
            </>
        );
    }

    // Error state (no email found)
    if (error && !email) {
        return (
            <>
                <Head>
                    <title>Unsubscribe - Error</title>
                    <link rel="icon" href="/favicon.png" />
                </Head>
                <div className="unsubscribe-page">
                    <div className="unsubscribe-bg">
                        <div className="gradient-orb gradient-orb-1"></div>
                        <div className="gradient-orb gradient-orb-2"></div>
                    </div>
                    <div className="unsubscribe-container">
                        <div className="unsubscribe-card">
                            <div className="unsubscribe-logo">
                                <img src="https://c1.tablecdn.com/maillayer/logo.png" alt="Maillayer" />
                            </div>
                            <div className="error-state">
                                <div className="error-icon">
                                    <AlertCircle size={28} />
                                </div>
                                <h1>Something went wrong</h1>
                                <p>{error}</p>
                            </div>
                        </div>
                        <p className="unsubscribe-tagline">Email Marketing Platform</p>
                    </div>
                </div>
                <style jsx>{styles}</style>
            </>
        );
    }

    return (
        <>
            <Head>
                <title>Unsubscribe - Maillayer</title>
                <link rel="icon" href="/favicon.png" />
            </Head>

            <div className="unsubscribe-page">
                <div className="unsubscribe-bg">
                    <div className="gradient-orb gradient-orb-1"></div>
                    <div className="gradient-orb gradient-orb-2"></div>
                </div>

                <div className="unsubscribe-container">
                    <div className="unsubscribe-card">
                        <div className="unsubscribe-logo">
                            <img src="https://c1.tablecdn.com/maillayer/logo.png" alt="Maillayer" />
                        </div>

                        {isUnsubscribed ? (
                            <div className="success-state">
                                <div className="success-icon">
                                    <CheckCircle size={32} />
                                </div>
                                <h1>You&apos;re Unsubscribed</h1>
                                <p className="success-message">You have been successfully unsubscribed from our mailing list.</p>
                                <div className="email-badge">
                                    <Mail size={14} />
                                    <span>{email}</span>
                                </div>
                                {success && (
                                    <div className="feedback-thanks">
                                        <CheckCircle size={14} />
                                        <span>Thank you for your feedback</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="unsubscribe-header">
                                    <div className="header-icon">
                                        <MailX size={24} />
                                    </div>
                                    <h1>Unsubscribe</h1>
                                    <p>We&apos;re sorry to see you go</p>
                                </div>

                                {error && (
                                    <div className="unsubscribe-alert">
                                        <AlertCircle size={14} />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="email-confirm">
                                    <span className="confirm-label">You are unsubscribing:</span>
                                    <div className="email-badge">
                                        <Mail size={14} />
                                        <span>{email}</span>
                                    </div>
                                </div>

                                <form onSubmit={handleUnsubscribe} className="unsubscribe-form">
                                    <div className="form-group">
                                        <label htmlFor="reason">Reason for unsubscribing</label>
                                        <select
                                            id="reason"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            disabled={loading}
                                        >
                                            <option value="">Select a reason (optional)</option>
                                            <option value="too_many_emails">Too many emails</option>
                                            <option value="not_relevant">Content not relevant</option>
                                            <option value="didnt_signup">I didn&apos;t sign up</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <button type="submit" className="unsubscribe-submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader size={16} className="spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <span>Confirm Unsubscribe</span>
                                        )}
                                    </button>
                                </form>

                                <div className="unsubscribe-footer">
                                    <span>Changed your mind? Simply close this page.</span>
                                </div>
                            </>
                        )}
                    </div>

                    <p className="unsubscribe-tagline">Email Marketing Platform</p>
                </div>
            </div>

            <style jsx>{styles}</style>
        </>
    );
}

const styles = `
    .unsubscribe-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        position: relative;
        overflow: hidden;
        padding: 24px;
    }

    .unsubscribe-bg {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
    }

    .gradient-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.12;
    }

    .gradient-orb-1 {
        width: 500px;
        height: 500px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        top: -150px;
        right: -100px;
    }

    .gradient-orb-2 {
        width: 400px;
        height: 400px;
        background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
        bottom: -100px;
        left: -50px;
    }

    .unsubscribe-container {
        position: relative;
        z-index: 1;
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .unsubscribe-card {
        width: 100%;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 16px;
        padding: 40px 32px;
    }

    .unsubscribe-logo {
        display: flex;
        justify-content: center;
        margin-bottom: 32px;
    }

    .unsubscribe-logo img {
        height: 28px;
        width: auto;
    }

    /* Loading State */
    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 40px 0;
        color: #71717a;
        font-size: 14px;
    }

    /* Error State */
    .error-state {
        text-align: center;
        padding: 20px 0;
    }

    .error-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        color: #ef4444;
    }

    .error-state h1 {
        font-size: 20px;
        font-weight: 600;
        color: #fafafa;
        margin: 0 0 8px;
    }

    .error-state p {
        font-size: 14px;
        color: #71717a;
        margin: 0;
    }

    /* Success State */
    .success-state {
        text-align: center;
        padding: 20px 0;
    }

    .success-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 24px;
        color: #22c55e;
    }

    .success-state h1 {
        font-size: 22px;
        font-weight: 600;
        color: #fafafa;
        margin: 0 0 8px;
    }

    .success-message {
        font-size: 14px;
        color: #a1a1aa;
        margin: 0 0 20px;
        line-height: 1.5;
    }

    .feedback-thanks {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 20px;
        padding: 10px 16px;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.2);
        border-radius: 8px;
        color: #22c55e;
        font-size: 13px;
    }

    /* Header */
    .unsubscribe-header {
        text-align: center;
        margin-bottom: 24px;
    }

    .header-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        color: #ef4444;
    }

    .unsubscribe-header h1 {
        font-size: 22px;
        font-weight: 600;
        color: #fafafa;
        margin: 0 0 8px;
        letter-spacing: -0.3px;
    }

    .unsubscribe-header p {
        font-size: 14px;
        color: #71717a;
        margin: 0;
    }

    /* Alert */
    .unsubscribe-alert {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 8px;
        color: #ef4444;
        font-size: 13px;
        margin-bottom: 20px;
    }

    /* Email Confirm */
    .email-confirm {
        text-align: center;
        margin-bottom: 24px;
    }

    .confirm-label {
        display: block;
        font-size: 13px;
        color: #71717a;
        margin-bottom: 10px;
    }

    .email-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        color: #a1a1aa;
        font-size: 14px;
    }

    /* Form */
    .unsubscribe-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .form-group label {
        font-size: 13px;
        font-weight: 500;
        color: #a1a1aa;
    }

    .form-group select {
        width: 100%;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        color: #fafafa;
        font-size: 14px;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.15s;
        outline: none;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        padding-right: 40px;
    }

    .form-group select:focus {
        border-color: rgba(99, 102, 241, 0.5);
        background-color: rgba(255, 255, 255, 0.05);
    }

    .form-group select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .form-group select option {
        background: #1c1c1c;
        color: #fafafa;
        padding: 8px;
    }

    .unsubscribe-submit {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px 20px;
        background: rgba(239, 68, 68, 0.9);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.15s;
    }

    .unsubscribe-submit:hover:not(:disabled) {
        background: #ef4444;
        border-color: #ef4444;
    }

    .unsubscribe-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* Footer */
    .unsubscribe-footer {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        text-align: center;
    }

    .unsubscribe-footer span {
        font-size: 13px;
        color: #52525b;
    }

    .unsubscribe-tagline {
        margin-top: 24px;
        font-size: 12px;
        color: #3f3f46;
        letter-spacing: 0.5px;
    }

    /* Animation */
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    /* Responsive */
    @media (max-width: 480px) {
        .unsubscribe-card {
            padding: 32px 24px;
        }

        .unsubscribe-header h1,
        .success-state h1 {
            font-size: 20px;
        }
    }
`;
