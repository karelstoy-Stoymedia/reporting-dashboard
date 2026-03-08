import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const META_API_VERSION = 'v19.0'
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`

const EDGE_FUNCTION_URL =
  'https://yswjrfivgupbqrpxcwog.supabase.co/functions/v1/fetch-thumbnails'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_BASE}/${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(JSON.stringify(data.error ?? data))
  }
  return data
}

async function metaGetAll(path: string, token: string, params: Record<string, string> = {}): Promise<any[]> {
  const results: any[] = []
  let nextUrl: string | null = null
  let isFirst = true
  while (isFirst || nextUrl) {
    let data: any
    if (isFirst) {
      data = await metaGet(path, token, { ...params, limit: '100' })
      isFirst = false
    } else {
      const res = await fetch(nextUrl!)
      if (!res.ok) break
      data = await res.json()
      if (data.error) break
    }
    results.push(...(data.data ?? []))
    nextUrl = data.paging?.next ?? null
  }
  return results
}

async function chunkParallel<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

function needsThumbnailFetch(existingPath: string | null, freshUrl: string | null): boolean {
  if (!freshUrl) return false
  if (!existingPath) return true
  if (existingPath.startsWith('http')) return true
  return false
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const errors: string[] = []
  let adsProcessed = 0
  let metricsInserted = 0
  let thumbnailsUploaded = 0

  const needsThumbnail: Array<{
    id: string
    meta_ad_id: string
    ad_account_id: string
    thumbnail_url: string
  }> = []

  // ── Step 1: Read token ────────────────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'meta_access_token')
    .single()

  const token = tokenRow?.value
  if (!token) {
    return NextResponse.json({ error: 'meta_access_token not configured' }, { status: 400 })
  }

  // ── Step 2: Auto-discover ad accounts ────────────────────────────────────
  let adAccounts: any[] = []
  try {
    adAccounts = await metaGetAll('me/adaccounts', token, { fields: 'name,account_id' })
    for (const acc of adAccounts) {
      await supabase
        .from('meta_ad_accounts')
        .upsert({ account_id: acc.id, account_name: acc.name, is_active: true }, { onConflict: 'account_id' })
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Account discovery failed: ${err.message}` }, { status: 500 })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

  // ── Step 3: Process each account ─────────────────────────────────────────
  for (const account of adAccounts) {
    const accountId = account.id

    let ads: any[] = []
    try {
      ads = await metaGetAll(`${accountId}/ads`, token, {
        fields: 'id,name,status,effective_status,adset_id,campaign_id,creative',
      })
    } catch (err: any) {
      errors.push(`Ads fetch failed for ${accountId}: ${err.message}`)
      continue
    }

    const campaignIds = [...new Set(ads.map((a: any) => a.campaign_id).filter(Boolean))] as string[]
    const adsetIds = [...new Set(ads.map((a: any) => a.adset_id).filter(Boolean))] as string[]

    const campaignNames = new Map<string, string>()
    const adsetNames = new Map<string, string>()

    await Promise.all([
      ...campaignIds.map(async (cid) => {
        try {
          const d = await metaGet(cid, token, { fields: 'name' })
          campaignNames.set(cid, d.name ?? cid)
        } catch { campaignNames.set(cid, cid) }
      }),
      ...adsetIds.map(async (aid) => {
        try {
          const d = await metaGet(aid, token, { fields: 'name' })
          adsetNames.set(aid, d.name ?? aid)
        } catch { adsetNames.set(aid, aid) }
      }),
    ])

    const adIds = ads.map((a: any) => a.id)
    const { data: existingRows } = await supabase
      .from('meta_creatives')
      .select('id, meta_ad_id, meta_creative_id, thumbnail_path')
      .in('meta_ad_id', adIds)

    const existingMap = new Map(existingRows?.map((r: any) => [r.meta_ad_id, r]) ?? [])

    const adResults = await chunkParallel(ads, 10, async (ad: any) => {
      const result = {
        metricInserted: false,
        error: null as string | null,
        thumbnailNeeded: null as { id: string; meta_ad_id: string; ad_account_id: string; thumbnail_url: string } | null,
      }
      const creativeId: string | null = ad.creative?.id ?? null
      const existing: any = existingMap.get(ad.id) ?? null

      let creativeData: any = {}
      if (creativeId) {
        try {
          creativeData = await metaGet(creativeId, token, {
            fields: 'thumbnail_url,image_url,title,body,call_to_action_type,video_id',
          })
        } catch { /* non-fatal */ }
      }

      let insights: any = null
      try {
        const insightData = await metaGet(`${ad.id}/insights`, token, {
          fields: 'spend,impressions,clicks,cpm,cpc,ctr,actions,video_play_actions',
          date_preset: 'yesterday',
          level: 'ad',
        })
        insights = insightData.data?.[0] ?? null
      } catch (err: any) {
        result.error = `Insights failed for ${ad.id}: ${err.message}`
      }

      const isVideo = !!creativeData.video_id || !!(insights?.video_play_actions?.length)
      const creativeType = isVideo ? 'video' : 'image'
      const thumbnailUrl: string | null = creativeData.image_url ?? creativeData.thumbnail_url ?? null
      const existingStoragePath: string | null = existing?.thumbnail_path ?? null
      const hasValidStoragePath =
        existingStoragePath !== null && !existingStoragePath.startsWith('http')

      if (needsThumbnailFetch(existingStoragePath, thumbnailUrl)) {
        result.thumbnailNeeded = {
          id: '',
          meta_ad_id: ad.id,
          ad_account_id: accountId,
          thumbnail_url: thumbnailUrl!,
        }
      }

      const actions: any[] = insights?.actions ?? []
      const leads = actions
        .filter((a: any) => a.action_type === 'lead')
        .reduce((sum: number, a: any) => sum + parseInt(a.value ?? '0', 10), 0)

      const spend = parseFloat(insights?.spend ?? '0')
      const impressions = parseInt(insights?.impressions ?? '0', 10)
      const clicks = parseInt(insights?.clicks ?? '0', 10)
      const videoPlayActions: any[] = insights?.video_play_actions ?? []
      const video3sViews = videoPlayActions.length > 0
        ? parseInt(videoPlayActions[0]?.value ?? '0', 10)
        : null

      const cpl = leads > 0 ? spend / leads : null
      const hookRate =
        creativeType === 'video' && impressions > 0 && video3sViews !== null
          ? video3sViews / impressions
          : null

      const { data: upsertedCreative, error: upsertErr } = await supabase
        .from('meta_creatives')
        .upsert(
          {
            meta_ad_id: ad.id,
            meta_creative_id: creativeId,
            ad_account_id: accountId,
            campaign_id: ad.campaign_id ?? null,
            campaign_name: campaignNames.get(ad.campaign_id) ?? null,
            adset_id: ad.adset_id ?? null,
            adset_name: adsetNames.get(ad.adset_id) ?? null,
            ad_name: ad.name,
            ...(hasValidStoragePath ? { thumbnail_path: existingStoragePath } : {}),
            creative_type: creativeType,
            headline: creativeData.title ?? null,
            body: creativeData.body ?? null,
            cta: creativeData.call_to_action_type ?? null,
            status: ad.effective_status ?? ad.status ?? 'UNKNOWN',
            first_seen_at: existing ? undefined : todayStr,
            last_seen_at: todayStr,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'meta_ad_id' }
        )
        .select('id')
        .single()

      if (upsertErr) {
        result.error = (result.error ? result.error + ' | ' : '') + `Upsert failed for ${ad.id}: ${upsertErr.message}`
        return result
      }

      if (result.thumbnailNeeded && upsertedCreative) {
        result.thumbnailNeeded.id = upsertedCreative.id
      }

      if (insights && upsertedCreative) {
        const { error: metricsErr } = await supabase
          .from('meta_creative_metrics')
          .upsert(
            {
              creative_id: upsertedCreative.id,
              metric_date: yesterdayStr,
              spend,
              impressions,
              clicks,
              leads,
              cpm: insights.cpm ? parseFloat(insights.cpm) : null,
              cpc: insights.cpc ? parseFloat(insights.cpc) : null,
              ctr: insights.ctr ? parseFloat(insights.ctr) : null,
              cpl,
              hook_rate: hookRate,
              video_3s_views: video3sViews,
            },
            { onConflict: 'creative_id,metric_date' }
          )

        if (metricsErr) {
          result.error = (result.error ? result.error + ' | ' : '') + `Metrics failed for ${ad.id}: ${metricsErr.message}`
        } else {
          result.metricInserted = true
        }
      }

      return result
    })

    for (const r of adResults) {
      adsProcessed++
      if (r.metricInserted) metricsInserted++
      if (r.error) errors.push(r.error)
      if (r.thumbnailNeeded && r.thumbnailNeeded.id) {
        needsThumbnail.push(r.thumbnailNeeded)
      }
    }
  }

  // ── Step 4: Thumbnail Edge Function handoff ───────────────────────────────
  if (needsThumbnail.length > 0) {
    try {
      const edgeRes = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ creatives: needsThumbnail }),
      })

      if (!edgeRes.ok) {
        const text = await edgeRes.text()
        errors.push(`Edge Function call failed (${edgeRes.status}): ${text}`)
      } else {
        const edgeResult = await edgeRes.json()
        thumbnailsUploaded = edgeResult.processed ?? 0
        if (edgeResult.errors?.length) {
          errors.push(...edgeResult.errors)
        }
      }
    } catch (err: any) {
      errors.push(`Edge Function call threw: ${err.message}`)
    }
  }

  // ── Step 5: Leaderboard ranking — top 30% by CPL + CTR tiebreaker ────────
  // Rules:
  // - Ads with 0 leads are excluded entirely — CPL cannot be calculated
  // - Primary sort: CPL ascending (lower is better)
  // - Tiebreaker: CTR descending (higher is better)
  // - Top 30% of qualifying ads get is_on_leaderboard = true
  // - is_pinned overrides bottom 70% (always on)
  // - is_removed overrides top 30% (always off)
  let leaderboardUpdated = 0
  try {
    // Pull all-time metrics per creative
    const { data: metricTotals, error: totalsErr } = await supabase
      .from('meta_creative_metrics')
      .select('creative_id, spend, leads, clicks, impressions')

    if (totalsErr) throw new Error(totalsErr.message)

    // Aggregate totals per creative across all metric_date rows
    const totalsMap = new Map<string, { spend: number; leads: number; clicks: number; impressions: number }>()
    for (const row of metricTotals ?? []) {
      const existing = totalsMap.get(row.creative_id) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0 }
      totalsMap.set(row.creative_id, {
        spend: existing.spend + (row.spend ?? 0),
        leads: existing.leads + (row.leads ?? 0),
        clicks: existing.clicks + (row.clicks ?? 0),
        impressions: existing.impressions + (row.impressions ?? 0),
      })
    }

    // Only rank ads that have at least 1 lead — zero-lead ads are excluded entirely
    const rankable = Array.from(totalsMap.entries())
      .filter(([, t]) => t.leads > 0 && t.spend > 0)
      .map(([creative_id, t]) => ({
        creative_id,
        cpl: t.spend / t.leads,
        ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
        spend: t.spend,
        leads: t.leads,
      }))
      // Primary: CPL ascending. Tiebreaker: CTR descending
      .sort((a, b) => {
        if (a.cpl !== b.cpl) return a.cpl - b.cpl
        return b.ctr - a.ctr
      })

    const topCount = Math.ceil(rankable.length * 0.3)
    const topIds = new Set(rankable.slice(0, topCount).map((r) => r.creative_id))
    const bottomIds = rankable.slice(topCount).map((r) => r.creative_id)

    // Also collect all creative_ids that have zero leads — force them off leaderboard
    const zeroLeadIds = Array.from(totalsMap.entries())
      .filter(([, t]) => t.leads === 0)
      .map(([creative_id]) => creative_id)

    // Set top 30% on leaderboard — never override is_removed
    if (topIds.size > 0) {
      const { error: topErr } = await supabase
        .from('meta_creatives')
        .update({ is_on_leaderboard: true })
        .in('id', [...topIds])
        .eq('is_removed', false)

      if (topErr) throw new Error(topErr.message)
    }

    // Set bottom 70% off leaderboard — never override is_pinned
    if (bottomIds.length > 0) {
      const { error: bottomErr } = await supabase
        .from('meta_creatives')
        .update({ is_on_leaderboard: false })
        .in('id', bottomIds)
        .eq('is_pinned', false)

      if (bottomErr) throw new Error(bottomErr.message)
    }

    // Force zero-lead ads off leaderboard — never override is_pinned
    if (zeroLeadIds.length > 0) {
      const { error: zeroErr } = await supabase
        .from('meta_creatives')
        .update({ is_on_leaderboard: false })
        .in('id', zeroLeadIds)
        .eq('is_pinned', false)

      if (zeroErr) throw new Error(zeroErr.message)
    }

    leaderboardUpdated = rankable.length
  } catch (err: any) {
    errors.push(`Leaderboard ranking failed: ${err.message}`)
  }

  // ── Step 6: Update last sync timestamp ───────────────────────────────────
  await supabase
    .from('app_config')
    .upsert({ key: 'creatives_last_synced', value: new Date().toISOString() }, { onConflict: 'key' })

  return NextResponse.json({
    success: true,
    synced_at: yesterdayStr,
    accounts_discovered: adAccounts.length,
    ads_processed: adsProcessed,
    thumbnails_queued: needsThumbnail.length,
    thumbnails_uploaded: thumbnailsUploaded,
    metrics_inserted: metricsInserted,
    leaderboard_ranked: leaderboardUpdated,
    errors,
  })
}