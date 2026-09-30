import { verifyAccessToken, verifyRefreshToken, REFRESH_COOKIE } from './jwt';
import { hasMongoDbConfig } from '@/server/db/database-config';

export async function getAuthenticatedUserId(req: Request) {
  const authorization = req.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token && token !== 'null' && token !== 'undefined') {
      try {
        const userId = await verifyAccessToken(token);
        if (userId) return userId;
      } catch {
        // Fall back to refresh cookie
      }
    }
  }

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const refreshToken = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE}=`))
      ?.slice(`${REFRESH_COOKIE}=`.length);

    if (refreshToken) {
      try {
        return await verifyRefreshToken(decodeURIComponent(refreshToken));
      } catch {
        return null;
      }
    }
  }

  // In development / demo mode without external MongoDB, fallback to the dev administrator
  // so credits, feature usage, and generator operations are consistently tracked and never drop
  if (!hasMongoDbConfig()) {
    return 'dev-admin-id';
  }

  return null;
}