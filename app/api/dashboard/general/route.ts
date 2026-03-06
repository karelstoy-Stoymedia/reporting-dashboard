import { getGeneralDashboardData } from '@/lib/queries/general'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]

  try {
    const data = await getGeneralDashboardData(startDate, endDate)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=60' }
    })
  } catch (err) {
    console.error('General dashboard error:', err)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
