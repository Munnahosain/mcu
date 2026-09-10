import crypto from 'crypto';

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `v2:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  if (!storedValue || typeof storedValue !== 'string') return false;

  const parts = storedValue.split(':');
  
  if (parts.length === 3 && parts[0] === 'v2') {
    const [, salt, originalHash] = parts;
    if (!salt || !originalHash) return false;
    const computed = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
    const computedBuf = Buffer.from(computed, 'hex');
    const originalBuf = Buffer.from(originalHash, 'hex');
    if (computedBuf.length !== originalBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, originalBuf);
  }

  // Backward compatibility with legacy 1000 iteration sha512 hashes
  if (parts.length === 2) {
    const [salt, originalHash] = parts;
    if (!salt || !originalHash) return false;
    const computed = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    const computedBuf = Buffer.from(computed, 'hex');
    const originalBuf = Buffer.from(originalHash, 'hex');
    if (computedBuf.length !== originalBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, originalBuf);
  }

  return false;
}

