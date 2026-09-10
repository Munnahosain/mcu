import { verifyAccessToken, verifyRefreshToken, REFRESH_COOKIE } from './jwt';

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

  return null;
}