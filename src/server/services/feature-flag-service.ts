import { connectToDatabase } from '@/server/db/mongodb';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';
import { findDevUserById } from '@/server/auth/dev-auth';
import { FeatureFlag } from '@/server/models/FeatureFlag';
import { Plan } from '@/server/models/Plan';
import { Subscription } from '@/server/models/Subscription';
import { User } from '@/server/models/User';

type FeatureFlagResult = {
  allowed: boolean;
  reason?: 'disabled' | 'plan';
  message?: string;
};

export type FeatureFlagCheck = {
  key: string;
  label: string;
  fallbackKey?: string;
};

function denialMessage(label: string, result: FeatureFlagResult) {
  if (result.allowed) return null;
  if (result.message) return result.message;
  if (result.reason === 'plan') return `${label} is not available on your current plan.`;
  return `${label} is currently disabled.`;
}

async function checkFeatureFlags(userId: string, checks: FeatureFlagCheck[]) {
  if (checks.length === 0) return [];

  const lookupKeys = [...new Set(checks.flatMap(({ key, fallbackKey }) => fallbackKey ? [key, fallbackKey] : [key]))];
  const flagsByKey = new Map<string, { enabled: boolean; plans: string[]; message: string }>();
  let planSlug = 'free';
  let userExists = true;

  if (!hasMongoDbConfig()) {
    for (const flag of inMemoryStore.featureFlags) {
      if (lookupKeys.includes(flag.key)) {
        flagsByKey.set(flag.key, {
          enabled: flag.enabled,
          plans: flag.plans || [],
          message: flag.message || '',
        });
      }
    }
    const user = findDevUserById(userId);
    planSlug = String(user?.planId || 'free').toLowerCase();
  } else {
    await connectToDatabase();
    const [flags, user] = await Promise.all([
      FeatureFlag.find({ key: { $in: lookupKeys } }).select('key enabled plans message').lean(),
      User.findById(userId).select('planId').lean(),
    ]);
    for (const flag of flags) {
      flagsByKey.set(flag.key, {
        enabled: flag.enabled,
        plans: flag.plans || [],
        message: flag.message || '',
      });
    }

    userExists = Boolean(user);
    if (user && flagsByKey.size > 0) {
      const [subscription, assignedPlan] = await Promise.all([
        Subscription.findOne({
          userId,
          status: { $in: ['active', 'trial'] },
        }).sort({ createdAt: -1 }).populate('planId', 'slug').lean(),
        user.planId ? Plan.findById(user.planId).select('slug').lean() : Promise.resolve(null),
      ]);
      const subscribedPlan = subscription?.planId as { slug?: string } | null;
      planSlug = String(subscribedPlan?.slug || assignedPlan?.slug || 'free').toLowerCase();
    }
  }

  return checks.map(({ key, fallbackKey }) => {
    const flag = flagsByKey.get(key) || (fallbackKey ? flagsByKey.get(fallbackKey) : undefined);
    if (!flag) return { key, result: { allowed: true } satisfies FeatureFlagResult };
    if (!userExists) return { key, result: { allowed: false, reason: 'plan' } satisfies FeatureFlagResult };
    if (!flag.enabled) {
      return { key, result: { allowed: false, reason: 'disabled', message: flag.message } satisfies FeatureFlagResult };
    }
    if (flag.plans.some((plan) => plan.trim().toLowerCase() === planSlug)) {
      return { key, result: { allowed: false, reason: 'plan', message: flag.message } satisfies FeatureFlagResult };
    }
    return { key, result: { allowed: true } satisfies FeatureFlagResult };
  });
}

export async function checkFeatureFlag(userId: string, key: string, fallbackKey?: string): Promise<FeatureFlagResult> {
  const [{ result }] = await checkFeatureFlags(userId, [{ key, label: key, fallbackKey }]);
  return result;
}

export async function getFirstFeatureFlagDenial(userId: string, checks: FeatureFlagCheck[]) {
  const results = await checkFeatureFlags(userId, checks);
  for (const { key, result } of results) {
    const check = checks.find((item) => item.key === key);
    const error = denialMessage(check?.label || key, result);
    if (error) return { key, error };
  }
  return null;
}

export async function getFeatureFlagDenial(userId: string, key: string, label: string, fallbackKey?: string) {
  const denial = await getFirstFeatureFlagDenial(userId, [{ key, label, fallbackKey }]);
  return denial?.error || null;
}
