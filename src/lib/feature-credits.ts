import { ensureAccessToken } from '@/lib/auth';

export async function consumeFeatureCredit(feature: string, amount = 1) {
  try {
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
    if (!response.ok || !data.success) {
      if (response.status === 402) {
        throw new Error(data.error || 'You do not have enough credits to use this feature.');
      }
      // If server or network issue, log and do not crash creative workflow
      console.warn('[Credits] Feature credit deduction skipped or failed:', data.error);
    }
  } catch (err: any) {
    if (err?.message?.includes('enough credits')) {
      throw err;
    }
    console.warn('[Credits] consumeFeatureCredit error:', err);
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mcustock:credits-updated'));
    }
  }
}

export async function refillFeatureCredits(amount = 5000) {
  try {
    const token = await ensureAccessToken();
    const response = await fetch('/api/account/credits', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'refill', amount }),
    });
    const data = await response.json().catch(() => ({}));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mcustock:credits-updated'));
    }
    return data;
  } catch (err) {
    console.error('[Credits] Refill failed:', err);
    return null;
  }
}