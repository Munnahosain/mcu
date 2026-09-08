import { NextResponse } from 'next/server';
import { REFRESH_COOKIE, refreshCookieOptions } from '@/lib/jwt';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(REFRESH_COOKIE, '', { ...refreshCookieOptions(), maxAge: 0 });
  return response;
}