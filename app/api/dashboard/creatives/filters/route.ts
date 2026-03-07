import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId') ?? undefined
  const campaignId = searchParams.get('campaignId') ?? undefined

  const supabase = createServiceClient()

  let query = supabase
    .from('meta_creatives')
    .select('ad_account_id, campaign_id, campaign_name, adset_id, adset_name')
    .eq('status', 'ACTIVE')
    .eq('is_archived_from_board', false)

  if (accountId) query = query.eq('ad_account_id', accountId)
  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deduplicate campaigns
  const campaignMap = new Map<string, { campaign_id: string; campaign_name: string }>()
  const adsetMap = new Map<string, { adset_id: string; adset_name: string; campaign_id: string }>()

  ;(data ?? []).forEach(row => {
    if (row.campaign_id && !campaignMap.has(row.campaign_id)) {
      campaignMap.set(row.campaign_id, {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name ?? row.campaign_id,
      })
    }
    if (row.adset_id && !adsetMap.has(row.adset_id)) {
      adsetMap.set(row.adset_id, {
        adset_id: row.adset_id,
        adset_name: row.adset_name ?? row.adset_id,
        campaign_id: row.campaign_id,
      })
    }
  })

  return NextResponse.json({
    campaigns: Array.from(campaignMap.values()).sort((a, b) => a.campaign_name.localeCompare(b.campaign_name)),
    adsets: Array.from(adsetMap.values()).sort((a, b) => a.adset_name.localeCompare(b.adset_name)),
  }, {
    headers: { 'Cache-Control': 's-maxage=60' }
  })
}