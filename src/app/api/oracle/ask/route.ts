import { NextResponse } from 'next/server';

const AI_URL = process.env.SCEAU_AI_URL || 'http://localhost:8080';
const AI_KEY = process.env.SCEAU_AI_KEY || '';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    pubkey?: string; url?: string; question?: string;
  };
  const { pubkey, url, question } = body;

  if (!url || !question) {
    return NextResponse.json({ error: 'url et question requis' }, { status: 400 });
  }
  if (typeof question !== 'string' || question.length > 500) {
    return NextResponse.json({ error: 'Question trop longue (500 caractères max)' }, { status: 400 });
  }

  try {
    const res = await fetch(`${AI_URL}/v1/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SCEAU-AI-Key': AI_KEY },
      body: JSON.stringify({ url, question }),
      signal: AbortSignal.timeout(40_000),
    });

    const data = (await res.json()) as {
      answer?: string; model?: string; latencyMs?: number;
      sources?: { url: string; version: number; v1_ots_status: string | null };
      error?: string; hint?: string;
    };

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Erreur SCEAU AI', hint: data.hint },
        { status: res.status },
      );
    }

    return NextResponse.json({
      answer: data.answer,
      model: data.model,
      latencyMs: data.latencyMs,
      captures_used: 1,
      live_capture: false,
      sources: data.sources
        ? [{
            date: new Date().toISOString(),
            hash_short: data.sources.v1_ots_status || 'pending',
            is_live: false,
          }]
        : [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: `SCEAU AI injoignable : ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
