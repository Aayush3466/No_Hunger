import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Routes that require a session. Middleware is the first gate, not the only
 * one: every page and server action re-checks auth server-side, because
 * middleware can be bypassed by a direct RSC payload request.
 */
const PROTECTED = ['/donate', '/orders', '/history', '/profile', '/onboarding'];

const AUTH_PAGES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // Bring them back to exactly what they were doing.
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/map';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Auth cookies still need
     * refreshing on plain page loads, so this is intentionally broad.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
