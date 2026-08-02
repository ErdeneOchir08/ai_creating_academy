import { NextResponse } from 'next/server'

// The AI tutor is intentionally not part of the launch release. Keeping this
// endpoint unavailable prevents an unmetered public route from consuming a
// provider API key before authenticated, enrolled-user access and rate limits
// are implemented.
export async function POST() {
  return NextResponse.json(
    { error: 'AI tutor is not available in this release.' },
    { status: 503 },
  )
}
