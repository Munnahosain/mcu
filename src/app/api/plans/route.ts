import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/server/db/mongodb';
import { Plan, OFFICIAL_PLANS_SEED } from '@/server/models/Plan';
import { hasMongoDbConfig } from '@/server/db/database-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatSeedPlans() {
  return OFFICIAL_PLANS_SEED.map((plan, idx) => {
    const mPrice = Number(plan.monthlyPrice ?? 0);
    const yPrice = Number(plan.yearlyPrice ?? (mPrice * 10));
    return {
      ...plan,
      _id: `seed-${idx}`,
      monthlyPrice: mPrice,
      yearlyPrice: yPrice,
      price: mPrice,
      currency: plan.currency || 'BDT',
      monthlyCredits: Number(plan.monthlyCredits ?? 100),
      batchLimit: Number(plan.batchLimit ?? (mPrice === 0 ? 5 : 25)),
      bgRemovalLimit: Number(plan.bgRemovalLimit ?? (mPrice === 0 ? 3 : 50)),
      activeDeviceLimit: Number(plan.activeDeviceLimit ?? 1),
      creditRolloverEnabled: Boolean(plan.creditRolloverEnabled),
      maxRolloverCredits: Number(plan.maxRolloverCredits ?? 0),
      features: Array.isArray(plan.features) ? plan.features : [],
    };
  });
}

export async function GET() {
  try {
    if (!hasMongoDbConfig()) {
      return NextResponse.json({
        success: true,
        plans: formatSeedPlans(),
      });
    }

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        plans: formatSeedPlans(),
      });
    }

    // Check if plans have monthlyPrice populated. If not or empty, reseed official BDT plans.
    const validPlan = await Plan.findOne({ monthlyPrice: { $exists: true, $ne: null } });
    if (!validPlan) {
      await Plan.deleteMany({});
      await Plan.insertMany(OFFICIAL_PLANS_SEED);
    }

    const plans = await Plan.find({ active: true })
      .sort({ sortOrder: 1, monthlyPrice: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      plans: plans.map((plan) => {
        const mPrice = Number(plan.monthlyPrice ?? (plan as any).price ?? 0);
        const yPrice = Number(plan.yearlyPrice ?? (mPrice * 10));
        return {
          ...plan,
          _id: String(plan._id),
          monthlyPrice: mPrice,
          yearlyPrice: yPrice,
          price: mPrice,
          currency: plan.currency || 'BDT',
          monthlyCredits: Number(plan.monthlyCredits ?? 100),
          batchLimit: Number(plan.batchLimit ?? (mPrice === 0 ? 5 : 25)),
          bgRemovalLimit: Number(plan.bgRemovalLimit ?? (mPrice === 0 ? 3 : 50)),
          activeDeviceLimit: Number(plan.activeDeviceLimit ?? 1),
          creditRolloverEnabled: Boolean(plan.creditRolloverEnabled),
          maxRolloverCredits: Number(plan.maxRolloverCredits ?? 0),
          features: Array.isArray(plan.features) ? plan.features : [],
        };
      }),
    });
  } catch (error) {
    console.warn('Returning fallback public plans due to database status:', error);
    return NextResponse.json({
      success: true,
      plans: formatSeedPlans(),
    });
  }
}
