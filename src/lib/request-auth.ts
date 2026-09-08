import { verifyAccessToken } from './jwt';

export async function getAuthenticatedUserId(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    return await verifyAccessToken(authorization.slice('Bearer '.length));
  } catch {
    return null;
  }
}