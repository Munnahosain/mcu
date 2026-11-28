import { SignJWT, jwtVerify } from 'jose';
import { getSecret } from './secrets';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

function secret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET') {
  return new TextEncoder().encode(getSecret(name));
}

export const REFRESH_COOKIE = 'mcustock_refresh_token';

export async function createAccessToken(userId: string) {
  return new SignJWT({ sub: userId, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRES_IN || ACCESS_TOKEN_TTL)
    .sign(secret('JWT_ACCESS_SECRET'));
}

export async function createRefreshToken(userId: string) {
  return new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || REFRESH_TOKEN_TTL)
    .sign(secret('JWT_REFRESH_SECRET'));
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret('JWT_ACCESS_SECRET'));
  if (payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return payload.sub;
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, secret('JWT_REFRESH_SECRET'));
  if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
    throw new Error('Invalid refresh token');
  }
  return payload.sub;
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}
