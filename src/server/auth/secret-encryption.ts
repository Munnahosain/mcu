import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_ENCRYPTION_KEY = 'mcustock-dev-secret-encryption-fallback-key-32chars';

function encryptionKey() {
  const source = process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;
  return crypto.createHash('sha256').update(source.trim()).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value: string) {
  const [ivHex, tagHex, encryptedHex] = value.split(':');
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid encrypted secret.');
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}