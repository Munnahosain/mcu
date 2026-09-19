import { ensureAccessToken } from '@/lib/auth';

export async function consumeFeatureCredit(feature: string) {
  const token = await ensureAccessToken();
  const response = await fetch('/api/account/credits', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ feature }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Unable to reserve credits for this feature.');
}