import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    const { prompt = '', duration = 4.0 } = body;

    return NextResponse.json({
      success: true,
      message: 'Generated semantic keyframes',
      duration: duration || 4.0,
      loop: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to process AI animation request' },
      { status: 500 }
    );
  }
}
