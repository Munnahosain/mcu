import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/server/db/mongodb";
import { User } from "@/server/models/User";
import { Plan } from "@/server/models/Plan";
import { hashPassword } from "@/server/auth/hash";
import { createAccessToken, createRefreshToken, REFRESH_COOKIE, refreshCookieOptions } from "@/server/auth/jwt";
import { hasMongoDbConfig } from "@/server/db/database-config";
import { findDevUser, createDevUser } from "@/server/auth/dev-auth";

type GoogleToken = { aud?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string };

export async function POST(req: Request) {
  try {
    const { credential, mode = "user" } = await req.json() as { credential?: string; mode?: "user" | "admin" };
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return NextResponse.json({ success: false, error: "Google sign-in is not configured." }, { status: 503 });
    if (!credential) return NextResponse.json({ success: false, error: "Google credential is missing." }, { status: 400 });

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      console.error("Google token verification request failed:", error);
      return NextResponse.json({ success: false, error: "Could not reach Google to verify sign-in. Please try again." }, { status: 502 });
    }
    const googleUser = await tokenResponse.json() as GoogleToken;
    if (!tokenResponse.ok || googleUser.aud !== clientId || String(googleUser.email_verified) !== "true" || !googleUser.email) {
      return NextResponse.json({ success: false, error: "Google account verification failed." }, { status: 401 });
    }

    const userEmail = googleUser.email.toLowerCase().trim();
    const isConfiguredAdmin = Boolean(
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_EMAIL.split(',').map((e) => e.trim().toLowerCase()).includes(userEmail)
    );

    if (!hasMongoDbConfig()) {
      let devUser = findDevUser(userEmail);
      if (!devUser) {
        devUser = createDevUser(
          googleUser.name || userEmail.split('@')[0],
          userEmail,
          undefined,
          (mode === 'admin' || isConfiguredAdmin) ? 'super_admin' : 'user'
        );
      }
      if (!devUser) {
        devUser = findDevUser(userEmail) || {
          id: 'dev-google-user',
          _id: 'dev-google-user',
          name: googleUser.name || userEmail.split('@')[0],
          email: userEmail,
          role: (mode === 'admin' || isConfiguredAdmin) ? 'super_admin' : 'user',
          status: 'active',
          credits: { monthly: 2000, bonus: 500, used: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      const userId = String(devUser.id || devUser._id);
      const accessToken = await createAccessToken(userId);
      const refreshToken = await createRefreshToken(userId);
      const response = NextResponse.json({
        success: true,
        user: {
          id: userId,
          name: devUser.name,
          email: devUser.email,
          role: isConfiguredAdmin ? 'super_admin' : devUser.role,
          avatarUrl: googleUser.picture || '',
        },
        accessToken,
      });
      response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
      return response;
    }

    const database = await connectToDatabase();
    if (!database) {
      return NextResponse.json({ success: false, error: "The database is temporarily unavailable. Please try again." }, { status: 503 });
    }

    let user;
    try {
      user = await User.findOne({ email: userEmail });
      if (user && mode === "admin") {
        if (isConfiguredAdmin && user.role !== 'super_admin') {
          user.role = 'super_admin';
          await user.save();
        } else if (!["super_admin", "admin", "support"].includes(user.role)) {
          return NextResponse.json({ success: false, error: "This Google account does not have admin access." }, { status: 403 });
        }
      }

      if (!user) {
        if (mode === "admin" && !isConfiguredAdmin) {
          return NextResponse.json({ success: false, error: "This Google account is not an authorized admin." }, { status: 403 });
        }
        const freePlan = await Plan.findOne({ slug: "free", active: true }).lean();
        const initialCredits = Number(freePlan?.monthlyCredits ?? (isConfiguredAdmin ? 2000 : 100));
        user = await User.create({
          name: googleUser.name || userEmail.split("@")[0],
          email: userEmail,
          avatarUrl: googleUser.picture || '',
          password: hashPassword(crypto.randomUUID()),
          role: isConfiguredAdmin ? 'super_admin' : 'user',
          emailVerified: true,
          planId: freePlan?._id || null,
          credits: { monthly: initialCredits, bonus: 0, used: 0 },
        });
      } else {
        if (isConfiguredAdmin && user.role !== 'super_admin') {
          user.role = 'super_admin';
        }
        const activePlan = user.planId
          ? await Plan.findById(user.planId).lean()
          : await Plan.findOne({ slug: "free", active: true }).lean();

        if (activePlan) {
          user.planId = activePlan._id;
          const targetMonthly = Number(activePlan.monthlyCredits ?? 100);
          if (Number(user.credits?.monthly ?? 0) < targetMonthly && Number(user.credits?.used ?? 0) === 0) {
            user.credits = {
              monthly: targetMonthly,
              bonus: Number(user.credits?.bonus ?? 0),
              used: Number(user.credits?.used ?? 0),
            };
          }
        }
        user.emailVerified = true;
        if (googleUser.picture) user.avatarUrl = googleUser.picture;
        user.lastLoginAt = new Date();
        await user.save();
      }
    } catch (error) {
      console.error("Google account database operation failed:", error);
      return NextResponse.json({ success: false, error: "Could not save your account right now. Please try again." }, { status: 503 });
    }

    const userId = String(user._id);
    const accessToken = await createAccessToken(userId);
    const refreshToken = await createRefreshToken(userId);
    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: isConfiguredAdmin ? 'super_admin' : (user.role || 'user'),
        avatarUrl: user.avatarUrl || googleUser.picture || '',
      },
      accessToken,
    });
    response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return response;
  } catch (error) {
    console.error("Google authentication error:", error);
    return NextResponse.json({ success: false, error: "Unable to complete Google sign-in." }, { status: 500 });
  }
}
