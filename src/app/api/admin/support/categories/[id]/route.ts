import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SupportCategory } from '@/server/models/SupportCategory';
import { sanitizeSupportText } from '@/server/services/support-service';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) { try { await requireAdmin(req); const { id } = await params; const body = await req.json().catch(() => ({})); await connectToDatabase(); const category = await SupportCategory.findByIdAndUpdate(id, { $set: { ...(typeof body.name === 'string' ? { name: sanitizeSupportText(body.name, 100) } : {}), ...(typeof body.description === 'string' ? { description: sanitizeSupportText(body.description, 500) } : {}), ...(typeof body.order === 'number' ? { order: body.order } : {}), ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}) } }, { new: true }).lean(); if (!category) return NextResponse.json({ success: false, error: 'Category not found.' }, { status: 404 }); return NextResponse.json({ success: true, category }); } catch (error) { return authorizationErrorResponse(error); } }
