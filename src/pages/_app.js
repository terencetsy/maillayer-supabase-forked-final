import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import '../styles/globals.scss';
import '@/styles/sequence-builder.scss';
import config from '@/lib/config';

if (typeof window === 'undefined' && !process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = config.baseUrl;
}

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
    return (
        <SessionProvider
            session={session}
            refetchInterval={0}
            refetchOnWindowFocus={false}
        >
            <Head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>Maillayer - Email Marketing Platform</title>
            </Head>
            <Component {...pageProps} />
        </SessionProvider>
    );
}

export default MyApp;
