import { getLiveCreatives } from '@/lib/queries/creatives'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId') ?? undefined
  const campaignId = searchParams.get('campaignId') ?? undefined
  const adsetId = searchParams.get('adsetId') ?? undefined

  try {
    const creatives = await getLiveCreatives({ accountId, campaignId, adsetId })
    return NextResponse.json(creatives, {
      headers: { 'Cache-Control': 's-maxage=30' }
    })
  } catch (err) {
    console.error('Live creatives error:', err)
    return NextResponse.json({ error: 'Failed to load live creatives' }, { status: 500 })
  }
}