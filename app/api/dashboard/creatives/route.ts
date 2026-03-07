import { getCreativesLeaderboard, getCreativeTags, getUntaggedCreatives } from '@/lib/queries/creatives'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]
  const tagId = searchParams.get('tagId') ?? undefined
  const accountId = searchParams.get('accountId') ?? undefined
  const includeArchived = searchParams.get('includeArchived') === 'true'

  try {
    const [creatives, tags, untagged] = await Promise.all([
      getCreativesLeaderboard({ startDate, endDate, tagId, accountId, includeArchived }),
      getCreativeTags(),
      getUntaggedCreatives(),
    ])

    // KPI summary
    const totalSpend = creatives.reduce((s, c) => s + c.totalSpend, 0)
    const totalLeads = creatives.reduce((s, c) => s + c.totalLeads, 0)
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null
    const hookRateCreatives = creatives.filter(c => c.avgHookRate !== null)
    const avgHookRate = hookRateCreatives.length > 0
      ? hookRateCreatives.reduce((s, c) => s + (c.avgHookRate ?? 0), 0) / hookRateCreatives.length
      : null
    const totalImpressions = creatives.reduce((s, c) => s + c.totalImpressions, 0)
    const totalClicks = creatives.reduce((s, c) => s + c.totalClicks, 0)
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : null

    return NextResponse.json({
      creatives,
      tags,
      untaggedCount: untagged.length,
      summary: { totalSpend, totalLeads, avgCpl, avgHookRate, avgCtr },
    }, {
      headers: { 'Cache-Control': 's-maxage=60' }
    })
  } catch (err) {
    console.error('Creatives leaderboard error:', err)
    return NextResponse.json({ error: 'Failed to load creatives' }, { status: 500 })
  }
}