import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { MailSend02 } from '@/lib/icons';

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
                const data = await res.json();
                throw new Error(data.message || 'Something went wrong');
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

            router.push('/dashboard');
        } catch (error) {
            console.error('Signup error:', error);
            setError(error.message || 'An unexpected error occurred');
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Setup Maillayer | Maillayer</title>
                <meta
                    name="description"
                    content="Set up your Maillayer admin account"
                />
            </Head>

            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="logo">
                            <MailSend02 />
                        </div>
                        <h1>Welcome to Maillayer</h1>
                        <p>Create your administrator account</p>
                    </div>

                    {error && <div className="alert alert-error">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Full name</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email address</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={isLoading}
                        >
                            <span>{isLoading ? 'Setting up...' : 'Create account'}</span>
                        </button>
                    </form>

                    <div className="text-center mt-lg">
                        <Link
                            href="/login"
                            className="auth-link"
                        >
                            Already have an account? Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
