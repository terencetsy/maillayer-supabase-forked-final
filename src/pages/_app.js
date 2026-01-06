import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState } from 'react';
import Head from 'next/head';
import '../styles/globals.scss';
import '@/styles/sequence-builder.scss';
import config from '@/lib/config';

// Ensure NEXTAUTH_URL equivalent isn't needed for Supabase, but keeping config init if essential
if (typeof window === 'undefined' && !process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = config.baseUrl;
}

function MyApp({ Component, pageProps }) {
    const [supabaseClient] = useState(() => createBrowserSupabaseClient());

    return (
        <SessionContextProvider
            supabaseClient={supabaseClient}
            initialSession={pageProps.initialSession}
        >
            <Head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>Maillayer - Email Marketing Platform</title>
            </Head>
            <Component {...pageProps} />
        </SessionContextProvider>
    );
}

export default MyApp;
