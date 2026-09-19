import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/server/db/mongodb";
import { User } from "@/server/models/User";
import { Plan } from "@/server/models/Plan";
import { hashPassword } from "@/server/auth/hash";
import { createAccessToken, createRefreshToken, REFRESH_COOKIE, refreshCookieOptions } from "@/server/auth/jwt";

type GoogleToken = { aud?: string; email?: string; email_verified?: string; name?: string; picture?: string };

export async function POST(req: Request) {
  try {
    const { credential, mode = "user" } = await req.json() as { credential?: string; mode?: "user" | "admin" };
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return NextResponse.json({ success: false, error: "Google sign-in is not configured." }, { status: 503 });
    if (!credential) return NextResponse.json({ success: false, error: "Google credential is missing." }, { status: 400 });

    const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { cache: "no-store" });
    const googleUser = await tokenResponse.json() as GoogleToken;
    if (!tokenResponse.ok || googleUser.aud !== clientId || googleUser.email_verified !== "true" || !googleUser.email) {
      return NextResponse.json({ success: false, error: "Google account verification failed." }, { status: 401 });
    }

    await connectToDatabase();
    let user = await User.findOne({ email: googleUser.email.toLowerCase() });
    if (user && mode === "admin" && !["super_admin", "admin", "support"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "This Google account does not have admin access." }, { status: 403 });
    }

    if (!user) {
      if (mode === "admin") return NextResponse.json({ success: false, error: "This Google account is not an authorized admin." }, { status: 403 });
      const freePlan = await Plan.findOne({ slug: "free", active: true }).lean();
      user = await User.create({
        name: googleUser.name || googleUser.email.split("@")[0],
        email: googleUser.email.toLowerCase(),
        avatarUrl: googleUser.picture || '',
        password: hashPassword(crypto.randomUUID()),
        emailVerified: true,
        planId: freePlan?._id || null,
        credits: { monthly: Number(freePlan?.monthlyCredits ?? 100), bonus: 0, used: 0 },
      });
    } else {
      if (!user.planId) {
        const freePlan = await Plan.findOne({ slug: "free", active: true }).lean();
        if (freePlan) {
          user.planId = freePlan._id;
          user.credits = {
            monthly: Math.max(Number(user.credits?.monthly ?? 0), Number(freePlan.monthlyCredits ?? 100)),
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

    const userId = String(user._id);
    const accessToken = await createAccessToken(userId);
    const refreshToken = await createRefreshToken(userId);
    const response = NextResponse.json({ success: true, user: { id: userId, name: user.name, email: user.email, avatarUrl: user.avatarUrl || googleUser.picture || '' }, accessToken });
    response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return response;
  } catch (error) {
    console.error("Google authentication error:", error);
    return NextResponse.json({ success: false, error: "Unable to complete Google sign-in." }, { status: 500 });
  }
}
