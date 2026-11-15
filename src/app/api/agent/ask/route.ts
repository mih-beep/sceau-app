import { NextResponse } from 'next/server';

const AI_URL = process.env.SCEAU_AI_URL || 'http://localhost:8080';
const AI_KEY = process.env.SCEAU_AI_KEY || '';

export const runtime = 'nodejs';
export const maxDuration = 60; // Le routeur + l'agent peuvent prendre du temps

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { question, url } = body;

  if (!question) {
    return NextResponse.json({ error: 'question requise' }, { status: 400 });
  }

  try {
    const res = await fetch(`${AI_URL}/v1/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SCEAU-AI-Key': AI_KEY },
      body: JSON.stringify({ question, url }),
      signal: AbortSignal.timeout(55000),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Erreur de l\'agent' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: `SCEAU AI injoignable : ${(e as Error).message}` }, { status: 502 });
  }
}
