import { getAdsDashboardData } from '@/lib/queries/ads'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]
  const platformId = searchParams.get('platformId') ?? 'all'

  try {
    const data = await getAdsDashboardData(startDate, endDate, platformId)
    return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=60' } })
  } catch (e) {
    console.error('Ads dashboard error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}