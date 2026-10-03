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

export async function checkFeatureFlag(userId: string, key: string, fallbackKey?: string): Promise<FeatureFlagResult> {
  let enabled: boolean;
  let plans: string[];
  let message: string;
  let planSlug: string;

  if (!hasMongoDbConfig()) {
    const flag = inMemoryStore.featureFlags.find((item) => item.key === key)
      || (fallbackKey ? inMemoryStore.featureFlags.find((item) => item.key === fallbackKey) : undefined);
    if (!flag) return { allowed: true };

    const user = findDevUserById(userId);
    enabled = flag.enabled;
    plans = flag.plans;
    message = flag.message || '';
    planSlug = String(user?.planId || 'free').toLowerCase();
  } else {
    await connectToDatabase();
    const flag = await FeatureFlag.findOne({ key }).select('enabled plans message').lean()
      || (fallbackKey ? await FeatureFlag.findOne({ key: fallbackKey }).select('enabled plans message').lean() : null);
    if (!flag) return { allowed: true };

    const user = await User.findById(userId).select('planId').lean();
    if (!user) return { allowed: false, reason: 'plan' };

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'trial'] },
    }).sort({ createdAt: -1 }).populate('planId', 'slug').lean();
    const subscribedPlan = subscription?.planId as { slug?: string } | null;
    const assignedPlan = user.planId
      ? await Plan.findById(user.planId).select('slug').lean()
      : null;

    enabled = flag.enabled;
    plans = flag.plans || [];
    message = flag.message || '';
    planSlug = String(subscribedPlan?.slug || assignedPlan?.slug || 'free').toLowerCase();
  }

  if (!enabled) return { allowed: false, reason: 'disabled', message };
  if (plans.some((plan) => plan.trim().toLowerCase() === planSlug)) {
    return { allowed: false, reason: 'plan', message };
  }
  return { allowed: true };
}

export async function getFeatureFlagDenial(userId: string, key: string, label: string, fallbackKey?: string) {
  const result = await checkFeatureFlag(userId, key, fallbackKey);
  if (result.allowed) return null;
  if (result.message) return result.message;
  if (result.reason === 'plan') {
    return `${label} is not available on your current plan.`;
  }
  return `${label} is currently disabled.`;
}
