import { NextResponse } from 'next/server'

// Thin proxy so the client-side "Sync Now" button can trigger the cron
// without exposing CRON_SECRET to the browser
export async function POST() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/cron/sync-meta-creatives`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}