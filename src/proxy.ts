import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { REFRESH_COOKIE } from '@/server/auth/jwt';

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(REFRESH_COOKIE)?.value;
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!token || !secret || secret.length < 32) return false;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.type === 'refresh' && typeof payload.sub === 'string';
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  if (pathname === '/admin/login') return NextResponse.next();

  // Bootstrap is protected by its own one-time server secret before a session exists.
  if (pathname === '/api/admin/bootstrap' && request.method === 'POST') {
    return NextResponse.next();
  }

  if (await hasValidSession(request)) return NextResponse.next();

  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};