import { NextResponse } from 'next/server';

/**
 * Rate limiting.
 * - With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set, counts are shared across all
 *   serverless instances (fixed window in Upstash Redis, via its REST API — no extra dependency).
 * - Without them it falls back to a per-instance in-memory counter (fine for local/dev).
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodic cleanup every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Client IP. On Vercel only the platform-set headers are trusted; a client-sent
 * x-forwarded-for can be spoofed to dodge per-IP limits.
 */
export function getClientIp(req: Request): string {
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) return vercelForwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  if (!process.env.VERCEL) {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
  }
  return '127.0.0.1';
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
  keyPrefix?: string;
}

type RateLimitResult = { allowed: boolean; remaining: number; resetTime: number };

export function checkRateLimit(identifier: string, options: RateLimitOptions = {}): RateLimitResult {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60 * 1000;
  const key = `${options.keyPrefix || 'global'}:${identifier}`;
  const now = Date.now();

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
}

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function checkRateLimitUpstash(
  config: { url: string; token: string },
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60 * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetTime = windowStart + windowMs;
  const key = `rl:${options.keyPrefix || 'global'}:${identifier}:${windowStart}`;

  const res = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['PEXPIRE', key, String(windowMs + 1000)],
    ]),
    cache: 'no-store',
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = await res.json() as Array<{ result?: number; error?: string }>;
  const count = Number(data?.[0]?.result);
  if (!Number.isFinite(count)) throw new Error(data?.[0]?.error || 'Upstash returned no count');
  return { allowed: count <= limit, remaining: Math.max(limit - count, 0), resetTime };
}

export async function enforceRateLimit(
  req: Request,
  userId?: string | null,
  options: RateLimitOptions = {}
): Promise<NextResponse | null> {
  const identifier = userId || `ip:${getClientIp(req)}`;
  const upstash = upstashConfig();

  let result: RateLimitResult;
  if (upstash) {
    try {
      result = await checkRateLimitUpstash(upstash, identifier, options);
    } catch (error) {
      // Never block users because the limiter store is down — fall back to the local counter.
      console.warn('[rate-limit] Upstash unavailable, using in-memory limiter:', error);
      result = checkRateLimit(identifier, options);
    }
  } else {
    result = checkRateLimit(identifier, options);
  }

  if (!result.allowed) {
    const retryAfterSec = Math.ceil((result.resetTime - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(retryAfterSec, 1)),
          'X-RateLimit-Limit': String(options.limit ?? 60),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
        },
      }
    );
  }

  return null;
}
