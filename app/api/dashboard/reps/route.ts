import { getRepsDashboardData } from '@/lib/queries/reps'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]
  const repId = searchParams.get('repId') ?? undefined

  try {
    const data = await getRepsDashboardData(startDate, endDate, repId)
    return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=60' } })
  } catch (e) {
    console.error('Reps dashboard error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}