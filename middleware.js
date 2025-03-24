import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { hasAdminUser } from './services/userService';

export async function middleware(req) {
    const { pathname } = req.nextUrl;

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isAuthenticated = !!token;

    let adminExists = false;
    try {
        adminExists = await hasAdminUser();
    } catch (error) {
        console.error('Error checking admin existence:', error);
    }

    const publicPaths = ['/login'];
    const isPublicPath = publicPaths.includes(pathname);

    if (pathname === '/signup') {
        if (adminExists) {
            return NextResponse.redirect(new URL('/login', req.url));
        }
        return NextResponse.next();
    }

    if (pathname === '/') {
        if (isAuthenticated) {
            return NextResponse.redirect(new URL('/dashboard', req.url));
        } else {
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
        return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
