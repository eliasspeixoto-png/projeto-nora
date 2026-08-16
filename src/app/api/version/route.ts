import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Identificador único de build/deploy
const BUILD_TIME = process.env.BUILD_TIME || process.env.NEXT_PUBLIC_BUILD_TIME || '2026-08-16T13:30:00Z';

export async function GET() {
  return NextResponse.json(
    {
      version: '4.5.2',
      buildTime: BUILD_TIME,
      timestamp: Date.now(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}
