import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Loader, ArrowRight, Check } from 'lucide-react';

export default function Signup() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkAdminExists = async () => {
            try {
                const res = await fetch('/api/auth/check-admin', { method: 'GET' });
                const data = await res.json();
                if (data.adminExists) {
                    router.push('/login');
                }
            } catch (error) {
                console.error('Error checking admin existence:', error);
            }
        };

        checkAdminExists();
    }, [router]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name || !email || !password) {
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

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                }),
            });

            if (!res.ok) {
                let errorMessage = 'Something went wrong';
                try {
                    const data = await res.json();
                    errorMessage = data.message || errorMessage;
                } catch (e) {
                    // If JSON parse fails, try text or use status text
                    const text = await res.text();
                    errorMessage = text || `Server error: ${res.status} ${res.statusText}`;
                    console.error('Non-JSON error response:', text);
                }
                throw new Error(errorMessage);
            }

            const result = await signIn('credentials', {
                redirect: false,
                email,
                password,
            });

            if (result.error) {
                setError(result.error);
                setIsLoading(false);
                return;
            }

            router.push('/brands');
        } catch (error) {
            console.error('Signup error:', error);
            setError(error.message || 'An unexpected error occurred');
            setIsLoading(false);
        }
    };

    const passwordRequirements = [
        { met: password.length >= 8, label: 'At least 8 characters' },
        { met: password === confirmPassword && password.length > 0, label: 'Passwords match' },
    ];

    return (
        <>
            <Head>
                <title>Sign Up - Maillayer</title>
                <meta
                    name="description"
                    content="Create your account"
                />
            </Head>

            <div className="auth-page">
                {/* Background effects */}
                <div className="auth-bg">
                    <div className="gradient-orb gradient-orb-1"></div>
                    <div className="gradient-orb gradient-orb-2"></div>
                </div>

                <div className="auth-container">
                    <div className="auth-card">
                        {/* Logo */}
                        <div className="auth-logo">
                            <img
                                src="https://c1.tablecdn.com/maillayer/logo.png"
                                alt="Maillayer"
                                className="auth-logo-img"
                            />
                        </div>

                        {/* Header */}
                        <div className="auth-header">
                            <h1>Create your account</h1>
                            <p>Set up your administrator account to get started</p>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <div className="auth-alert auth-alert-error">
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Form */}
                        <form
                            onSubmit={handleSubmit}
                            className="auth-form"
                        >
                            <div className="form-group">
                                <label htmlFor="name">Full Name</label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    disabled={isLoading}
                                    autoComplete="name"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    disabled={isLoading}
                                    autoComplete="email"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create a password"
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
                                    placeholder="Re-enter your password"
                                    disabled={isLoading}
                                    autoComplete="new-password"
                                />
                            </div>

                            {/* Password requirements */}
                            {password.length > 0 && (
                                <div className="password-requirements">
                                    {passwordRequirements.map((req, index) => (
                                        <div
                                            key={index}
                                            className={`requirement ${req.met ? 'met' : ''}`}
                                        >
                                            <Check size={12} />
                                            <span>{req.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

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
                                        <span>Creating account...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Create Account</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="auth-footer">
                            <span>Already have an account?</span>
                            <Link href="/login">Sign in</Link>
                        </div>
                    </div>

                    {/* Bottom text */}
                    <p className="auth-tagline">Email Marketing Platform</p>
                </div>
            </div>

            <style jsx>{`
                .auth-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                    position: relative;
                    overflow: hidden;
                    padding: 24px;
                }

                .auth-bg {
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

                .auth-container {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    max-width: 400px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .auth-card {
                    width: 100%;
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

                .auth-logo :global(.auth-logo-img) {
                    height: 28px !important;
                    max-height: 28px !important;
                    width: auto !important;
                    display: block;
                }

                .auth-header {
                    text-align: center;
                    margin-bottom: 28px;
                }

                .auth-header h1 {
                    font-size: 24px;
                    font-weight: 600;
                    color: #fafafa;
                    margin: 0 0 8px;
                    letter-spacing: -0.3px;
                }

                .auth-header p {
                    font-size: 14px;
                    color: #71717a;
                    margin: 0;
                }

                .auth-alert {
                    padding: 12px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    margin-bottom: 20px;
                }

                .auth-alert-error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
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

                .form-group input {
                    width: 100%;
                    padding: 12px 14px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    color: #fafafa;
                    font-size: 14px;
                    transition: all 0.15s;
                    outline: none;
                }

                .form-group input:focus {
                    border-color: rgba(99, 102, 241, 0.5);
                    background: rgba(255, 255, 255, 0.05);
                }

                .form-group input::placeholder {
                    color: #52525b;
                }

                .form-group input:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .password-requirements {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 8px;
                }

                .requirement {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    color: #52525b;
                    transition: color 0.15s;
                }

                .requirement.met {
                    color: #22c55e;
                }

                .auth-submit {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: 100%;
                    padding: 12px 20px;
                    background: #fafafa;
                    border: none;
                    border-radius: 8px;
                    color: #0a0a0a;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                    margin-top: 4px;
                }

                .auth-submit:hover:not(:disabled) {
                    background: #e4e4e7;
                }

                .auth-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .auth-footer {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    margin-top: 24px;
                    padding-top: 24px;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                }

                .auth-footer span {
                    font-size: 13px;
                    color: #71717a;
                }

                .auth-footer :global(a) {
                    font-size: 13px;
                    color: #6366f1;
                    text-decoration: none;
                    font-weight: 500;
                    transition: color 0.15s;
                }

                .auth-footer :global(a:hover) {
                    color: #818cf8;
                }

                .auth-tagline {
                    margin-top: 24px;
                    font-size: 12px;
                    color: #3f3f46;
                    letter-spacing: 0.5px;
                }

                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                :global(.spin) {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </>
    );
}
