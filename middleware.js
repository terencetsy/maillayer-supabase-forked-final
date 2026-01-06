import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';


export async function middleware(req) {
    const { pathname } = req.nextUrl;

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isAuthenticated = !!token;

    const publicPaths = ['/login'];
    const isPublicPath = publicPaths.includes(pathname);

    // Helper to check for admin existence via API
    const checkAdminExists = async () => {
        try {
            const url = req.nextUrl.clone();
            url.pathname = '/api/auth/check-admin';
            url.search = ''; // Clear query params

            const res = await fetch(url);
            if (!res.ok) return false;
            const data = await res.json();
            return !!data.adminExists;
        } catch (error) {
            console.error('Error checking admin existence via API:', error);
            // Default to false or handle as needed - fail safe
            return false;
        }
    };

    if (pathname === '/signup') {
        const adminExists = await checkAdminExists();
        if (adminExists) {
            return NextResponse.redirect(new URL('/login', req.url));
        }
        return NextResponse.next();
    }

    if (pathname === '/') {
        if (isAuthenticated) {
            return NextResponse.redirect(new URL('/brands', req.url));
        } else {
            const adminExists = await checkAdminExists();
            if (!adminExists) {
                return NextResponse.redirect(new URL('/signup', req.url));
            }
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    if (!isPublicPath && !isAuthenticated) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    if (isAuthenticated && isPublicPath) {
        return NextResponse.redirect(new URL('/brands', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
