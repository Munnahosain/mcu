import { NextResponse } from 'next/server';
import { findUserById, hasMongoDbConfig } from '@/server/db/database';
import { getAuthenticatedUserId } from './request-auth';
import { USER_ROLES, type UserRole } from '@/server/models/User';

export type { UserRole };

export class AuthorizationError extends Error {
  status: 401 | 403 | 503;

  constructor(status: 401 | 403 | 503, message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

export async function requireAuthenticatedUser(req: Request) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    throw new AuthorizationError(401, 'Authentication required.');
  }

  if (!hasMongoDbConfig()) {
    throw new AuthorizationError(503, 'Admin services require a configured database.');
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new AuthorizationError(401, 'Authentication required.');
  }

  if (user.status && user.status !== 'active') {
    throw new AuthorizationError(403, 'This account is not active.');
  }

  return user;
}

export async function requireRole(req: Request, allowedRoles: readonly UserRole[]) {
  const user = await requireAuthenticatedUser(req);
  const role = USER_ROLES.includes(user.role as UserRole) ? user.role as UserRole : 'user';

  if (!allowedRoles.includes(role)) {
    throw new AuthorizationError(403, 'You do not have permission to perform this action.');
  }

  return user;
}

export async function requireAdmin(req: Request) {
  return requireRole(req, ['super_admin', 'admin', 'support']);
}

export async function requireSuperAdmin(req: Request) {
  return requireRole(req, ['super_admin']);
}

export function authorizationErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }

  console.error('Authorization error:', error);
  return NextResponse.json({ success: false, error: 'Unable to verify authorization.' }, { status: 500 });
}