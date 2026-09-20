import { ensureAccessToken } from '@/lib/auth';

export async function consumeFeatureCredit(feature: string, amount = 1) {
  const token = await ensureAccessToken();
  const response = await fetch('/api/account/credits', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ feature, amount }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to reserve credits for this feature.');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mcustock:credits-updated'));
  }
}