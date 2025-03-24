import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { MailSend02 } from '@/lib/icons';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
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
            console.error('Login error:', error);
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Login | Maillayer</title>
                <meta
                    name="description"
                    content="Login to your Maillayer account"
                />
            </Head>

            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="logo">
                            <MailSend02 />
                        </div>
                        <h1>Welcome back</h1>
                        <p>Sign in to your Maillayer account</p>
                    </div>

                    {error && <div className="alert alert-error">{error}</div>}

                    <form onSubmit={handleSubmit}>
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
                                placeholder="••••••••"
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={isLoading}
                        >
                            <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
                        </button>
                    </form>

                    <div className="text-center mt-lg">
                        <Link
                            href="/signup"
                            className="auth-link"
                        >
                            Don't have an account yet? Set up Maillayer
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
