import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportCategory } from '@/server/models/SupportCategory';
import { sanitizeSupportText } from '@/server/services/support-service';

export async function GET(req: Request) { try { await requireAdmin(req); await connectToDatabase(); const categories = await SupportCategory.find().sort({ order: 1 }).lean(); return NextResponse.json({ success: true, categories }); } catch (error) { return authorizationErrorResponse(error); } }
export async function POST(req: Request) { try { await requireAdmin(req); const body = await req.json().catch(() => ({})); const name = sanitizeSupportText(body.name, 100); const slug = sanitizeSupportText(body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 100).toLowerCase(); if (!name || !slug) return NextResponse.json({ success: false, error: 'Name and slug are required.' }, { status: 400 }); await connectToDatabase(); const category = await SupportCategory.create({ name, slug, description: sanitizeSupportText(body.description, 500), icon: sanitizeSupportText(body.icon || 'LifeBuoy', 40), color: sanitizeSupportText(body.color || 'primary', 40), order: Number(body.order) || 0, enabled: body.enabled !== false }); return NextResponse.json({ success: true, category }, { status: 201 }); } catch (error) { return authorizationErrorResponse(error); } }
