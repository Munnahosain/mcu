import { ensureAccessToken } from '@/lib/auth';

type CreditSnapshot = {
  monthly: number;
  bonus: number;
  used: number;
  remaining: number;
  total: number;
};

export async function consumeFeatureCredit(feature: string, amount = 1) {
  let balanceWasPublished = false;
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
    const data = await response.json().catch(() => ({})) as {
      success?: boolean;
      error?: string;
      credits?: CreditSnapshot;
    };
    if (!response.ok || !data.success) {
      if (response.status === 402) {
        throw new Error(data.error || 'You do not have enough credits to use this feature.');
      }
      throw new Error(data.error || `Unable to reserve credits for this feature (HTTP ${response.status}).`);
    }
    if (!data.credits) {
      throw new Error('Credits were charged, but the server did not return the updated balance.');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mcustock:credits-updated', { detail: data.credits }));
      balanceWasPublished = true;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('enough credits')) {
      throw error;
    }
    console.error('[Credits] Feature credit deduction failed:', error);
    throw error;
  } finally {
    if (!balanceWasPublished && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mcustock:credits-updated'));
    }
  }
}
