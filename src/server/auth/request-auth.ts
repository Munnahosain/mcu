import { verifyAccessToken, verifyRefreshToken, REFRESH_COOKIE } from './jwt';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { findUserById } from '@/server/db/database';
import { isDevAuthAllowed } from './secrets';

// Short cache of account status so banned/suspended users are blocked without a DB hit on every request.
const STATUS_CACHE_MS = 30_000;
const statusCache = new Map<string, { active: boolean; expires: number }>();

async function isActiveUser(userId: string): Promise<boolean> {
  const cached = statusCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.active;
  let active = false;
  try {
    const user = await findUserById(userId) as { status?: string } | null;
    active = Boolean(user) && (!user?.status || user.status === 'active');
  } catch (error) {
    console.error('[auth] Could not check user status:', error);
    // Do not cache a failed lookup.
    return false;
  }
  statusCache.set(userId, { active, expires: Date.now() + STATUS_CACHE_MS });
  if (statusCache.size > 5000) {
    const now = Date.now();
    for (const [key, value] of statusCache) if (value.expires <= now) statusCache.delete(key);
  }
  return active;
}

/** Call after changing a user's status so the change applies immediately on this instance. */
export function clearUserStatusCache(userId?: string) {
  if (userId) statusCache.delete(userId);
  else statusCache.clear();
}

async function getTokenUserId(req: Request): Promise<string | null> {
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
        const userId = await verifyRefreshToken(decodeURIComponent(refreshToken));
        if (userId) return userId;
      } catch {
        // Token expired or invalid
      }
    }
  }
  return null;
}

/**
 * Returns the id of the signed-in, active user, or null.
 * Banned / suspended / deleted accounts get null even with a still-valid token.
 */
export async function getAuthenticatedUserId(req: Request) {
  const userId = await getTokenUserId(req);
  if (userId) return (await isActiveUser(userId)) ? userId : null;

  // Local development without MongoDB only, and only when explicitly enabled (ALLOW_DEV_AUTH=true).
  if (!hasMongoDbConfig() && isDevAuthAllowed()) {
    return 'dev-admin-id';
  }

  return null;
}
