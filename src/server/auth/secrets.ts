/**
 * Secret + dev-mode helpers. Edge-safe (no Node-only imports) so proxy.ts can use them.
 */

const DEV_DEFAULTS = {
  JWT_ACCESS_SECRET: 'mcustock-dev-jwt-access-secret-32-chars-minimum-key',
  JWT_REFRESH_SECRET: 'mcustock-dev-jwt-refresh-secret-32-chars-minimum-key',
  ENCRYPTION_KEY: 'mcustock-dev-secret-encryption-fallback-key-32chars',
} as const;

export type SecretName = keyof typeof DEV_DEFAULTS;

const MIN_SECRET_LENGTH = 32;

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/** In-memory dev users / auto-login are only allowed outside production and when explicitly enabled. */
export function isDevAuthAllowed() {
  return !isProduction() && process.env.ALLOW_DEV_AUTH === 'true';
}

/**
 * Returns the secret from the environment. In production a missing or short secret is a hard error,
 * so the public development defaults can never be used to forge tokens or decrypt keys.
 */
export function getSecret(name: SecretName): string {
  const value = process.env[name]?.trim();
  if (value && value.length >= MIN_SECRET_LENGTH) return value;
  if (isProduction()) {
    throw new Error(`${name} must be set to at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
  return value || DEV_DEFAULTS[name];
}
