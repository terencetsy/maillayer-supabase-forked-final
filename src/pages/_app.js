import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import '../styles/globals.scss';

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
    return (
        <SessionProvider session={session}>
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
