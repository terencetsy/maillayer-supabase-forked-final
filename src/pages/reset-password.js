import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Loader } from 'lucide-react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';

export default function ResetPassword() {
    const router = useRouter();
    const supabase = useSupabaseClient();
    const session = useSession();

    // In Supabase recovery flow, the user is signed in automatically when they click the link
    // and redirected here (if configured in generateLink).
    // The URL will have #access_token=...

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // If session is established (via recovery link), we are good to go.
        // If not, and no hash, maybe redirect to login?

        // Supabase helps us here: useSession() will be populating.
    }, [session]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!password || !confirmPassword) {
            setError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                throw error;
            }

            setMessage('Your password has been reset successfully. Redirecting to brands...');
            setPassword('');
            setConfirmPassword('');

            setTimeout(() => {
                router.push('/brands');
            }, 2000);
        } catch (error) {
            console.error('Reset password error:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Reset Password - Maillayer</title>
                <meta
                    name="description"
                    content="Reset your password"
                />
            </Head>

            <div className="auth-page">
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="auth-logo">
                            <img src="https://c1.tablecdn.com/maillayer/logo.png" alt="Maillayer" height={32} />
                        </div>

                        <div className="auth-header">
                            <h1>Reset Password</h1>
                            <p>Create a new password for your account</p>
                        </div>

                        {error && <div className="alert alert-error">{error}</div>}

                        {message && <div className="alert alert-success">{message}</div>}

                        <form
                            onSubmit={handleSubmit}
                            className="auth-form"
                        >
                            <div className="form-group">
                                <label htmlFor="password">New Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    disabled={isLoading}
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    disabled={isLoading}
                                    autoComplete="new-password"
                                />
                            </div>

                            <button
                                type="submit"
                                className="auth-submit"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader
                                            size={16}
                                            className="spin"
                                        />
                                        <span>Resetting...</span>
                                    </>
                                ) : (
                                    <span>Reset Password</span>
                                )}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>
                                Remember your password? <Link href="/login">Sign in</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .auth-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                    padding: 24px;
                }
                .auth-container {
                    width: 100%;
                    max-width: 400px;
                }
                .auth-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 16px;
                    padding: 40px 32px;
                }
                .auth-logo {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 32px;
                }
                .auth-header {
                    text-align: center;
                    margin-bottom: 28px;
                }
                .auth-header h1 {
                    font-size: 24px;
                    font-weight: 600;
                    color: #fafafa;
                    margin-bottom: 8px;
                }
                .auth-header p {
                    color: #71717a;
                    font-size: 14px;
                }
                .auth-form {
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
                    color: #a1a1aa;
                    font-size: 13px;
                    font-weight: 500;
                }
                .form-group input {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    padding: 12px 14px;
                    color: #fafafa;
                    font-size: 14px;
                    outline: none;
                }
                .form-group input:focus {
                    border-color: rgba(99, 102, 241, 0.5);
                    background: rgba(255, 255, 255, 0.05);
                }
                .auth-submit {
                    background: #171717;
                    border: none;
                    border-radius: 8px;
                    padding: 12px;
                    color: #fafafa;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .auth-submit:hover {
                    background: #262626;
                }
                .auth-footer {
                    margin-top: 24px;
                    text-align: center;
                    font-size: 13px;
                    color: #71717a;
                }
                .auth-footer a {
                    color: #6366f1;
                    text-decoration: none;
                }
                .alert {
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    margin-bottom: 20px;
                }
                .alert-error {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }
                .alert-success {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                :global(.spin) {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </>
    );
}
