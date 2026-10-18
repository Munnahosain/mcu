import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

const DEFAULT_ACCESS_SECRET = 'mcustock-dev-jwt-access-secret-32-chars-minimum-key';
const DEFAULT_REFRESH_SECRET = 'mcustock-dev-jwt-refresh-secret-32-chars-minimum-key';

function secret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET') {
  const configured = process.env[name];
  // Never fall back to the publicly known dev secrets in production: anyone could forge tokens.
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production.`);
  }
  const value = configured || (name === 'JWT_ACCESS_SECRET' ? DEFAULT_ACCESS_SECRET : DEFAULT_REFRESH_SECRET);
  return new TextEncoder().encode(value);
}

/** Refresh-token verification key, shared with src/proxy.ts so both use the same secret. */
export function getRefreshSecretKey() {
  return secret('JWT_REFRESH_SECRET');
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
  const { payload } = await jwtVerify(token, secret('JWT_ACCESS_SECRET'), { algorithms: ['HS256'] });
  if (payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return payload.sub;
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, secret('JWT_REFRESH_SECRET'), { algorithms: ['HS256'] });
  if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
    throw new Error('Invalid refresh token');
  }
  return payload.sub;
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}
