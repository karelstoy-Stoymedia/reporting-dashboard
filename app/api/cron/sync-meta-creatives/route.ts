import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const META_API_VERSION = 'v19.0'
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_BASE}/${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(`Meta API error on ${path}: ${JSON.stringify(data.error ?? data)}`)
  }
  return data
}

// Paginate through all pages of a Meta API endpoint
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

// Download from Meta CDN and upload to Supabase Storage
async function uploadThumbnail(
  supabase: ReturnType<typeof createServiceClient>,
  thumbnailUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    const res = await fetch(thumbnailUrl)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const { error } = await supabase.storage
      .from('creative-thumbnails')
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    if (error) {
      console.error('Storage upload error:', error.message)
      return null
    }
    return storagePath
  } catch (err) {
    console.error('Thumbnail upload failed:', err)
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const syncLog = {
    accounts_discovered: 0,
    ads_processed: 0,
    thumbnails_uploaded: 0,
    metrics_inserted: 0,
    errors: [] as string[],
  }

  // ── Step 1: Read token ────────────────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'meta_access_token')
    .single()

  const token = tokenRow?.value
  if (!token) {
    return NextResponse.json({ error: 'meta_access_token not configured in app_config' }, { status: 400 })
  }

  // ── Step 2: Auto-discover ad accounts ────────────────────────────────────
  let adAccounts: any[] = []
  try {
    adAccounts = await metaGetAll('me/adaccounts', token, { fields: 'name,account_id' })
    syncLog.accounts_discovered = adAccounts.length

    for (const acc of adAccounts) {
      await supabase
        .from('meta_ad_accounts')
        .upsert(
          { account_id: acc.id, account_name: acc.name, is_active: true },
          { onConflict: 'account_id' }
        )
    }
  } catch (err: any) {
    syncLog.errors.push(`Account discovery failed: ${err.message}`)
    return NextResponse.json({ error: 'Failed to discover ad accounts', details: syncLog }, { status: 500 })
  }

  // Yesterday's date string for metrics
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

  // ── Step 3: Process each account ─────────────────────────────────────────
  for (const account of adAccounts) {
    const accountId = account.id // format: act_XXXXXXXXX

    // Fetch ads with minimal fields — creative details fetched separately below
    let ads: any[] = []
    try {
      ads = await metaGetAll(`${accountId}/ads`, token, {
        fields: 'id,name,status,adset_id,campaign_id,creative',
      })
    } catch (err: any) {
      syncLog.errors.push(`Ads fetch failed for ${accountId}: ${err.message}`)
      continue
    }

    // Batch fetch campaign and adset names
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

    // ── Step 4: Process each ad ───────────────────────────────────────────
    for (const ad of ads) {
      syncLog.ads_processed++

      const creativeId: string | null = ad.creative?.id ?? null

      // Fetch creative details separately — nested expansion is unreliable
      let creativeData: any = {}
      if (creativeId) {
        try {
          creativeData = await metaGet(creativeId, token, {
            fields: 'thumbnail_url,title,body,call_to_action_type,video_id',
          })
        } catch {
          // non-fatal — continue with empty creative data
        }
      }

      // Fetch yesterday's insights
      // FIX: video_play_actions replaces deprecated video_3_sec_watched_actions
      let insights: any = null
      try {
        const insightData = await metaGet(`${ad.id}/insights`, token, {
          fields: 'spend,impressions,clicks,cpm,cpc,ctr,actions,video_play_actions',
          date_preset: 'yesterday',
          level: 'ad',
        })
        insights = insightData.data?.[0] ?? null
      } catch (err: any) {
        syncLog.errors.push(`Insights failed for ad ${ad.id}: ${err.message}`)
        // non-fatal — upsert creative record without metrics
      }

      // Determine creative type
      const isVideo = !!creativeData.video_id || !!(insights?.video_play_actions?.length)
      const creativeType = isVideo ? 'video' : 'image'

      // ── Thumbnail: upload if creative changed or path missing ─────────────
      const { data: existing } = await supabase
        .from('meta_creatives')
        .select('id, meta_creative_id, thumbnail_path')
        .eq('meta_ad_id', ad.id)
        .single()

      const creativeChanged = !existing || existing.meta_creative_id !== creativeId
      let thumbnailPath = existing?.thumbnail_path ?? null

      if (creativeChanged && creativeData.thumbnail_url) {
        const storagePath = `${accountId}/${ad.id}.jpg`
        const uploaded = await uploadThumbnail(supabase, creativeData.thumbnail_url, storagePath)
        if (uploaded) {
          thumbnailPath = storagePath
          syncLog.thumbnails_uploaded++
        }
      }

      // ── Parse metrics ─────────────────────────────────────────────────────
      const actions: any[] = insights?.actions ?? []
      const leads = actions
        .filter((a: any) => a.action_type === 'lead')
        .reduce((sum: number, a: any) => sum + parseInt(a.value ?? '0', 10), 0)

      const spend = parseFloat(insights?.spend ?? '0')
      const impressions = parseInt(insights?.impressions ?? '0', 10)
      const clicks = parseInt(insights?.clicks ?? '0', 10)

      // video_play_actions = 3-second video views (Meta's current field name)
      const videoPlayActions: any[] = insights?.video_play_actions ?? []
      const video3sViews = videoPlayActions.length > 0
        ? parseInt(videoPlayActions[0]?.value ?? '0', 10)
        : null

      const cpl = leads > 0 ? spend / leads : null
      // hook_rate: video only — null for image ads, never 0
      const hookRate =
        creativeType === 'video' && impressions > 0 && video3sViews !== null
          ? video3sViews / impressions
          : null

      // ── Upsert meta_creatives ─────────────────────────────────────────────
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
            thumbnail_path: thumbnailPath,
            creative_type: creativeType,
            headline: creativeData.title ?? null,
            body: creativeData.body ?? null,
            cta: creativeData.call_to_action_type ?? null,
            status: ad.status ?? 'UNKNOWN',
            first_seen_at: existing ? undefined : todayStr,
            last_seen_at: todayStr,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'meta_ad_id' }
        )
        .select('id')
        .single()

      if (upsertErr) {
        syncLog.errors.push(`Upsert failed for ad ${ad.id}: ${upsertErr.message}`)
        continue
      }

      // ── Insert yesterday's metrics ─────────────────────────────────────────
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
          syncLog.errors.push(`Metrics insert failed for ad ${ad.id}: ${metricsErr.message}`)
        } else {
          syncLog.metrics_inserted++
        }
      }
    }
  }

  // ── Update last sync timestamp ─────────────────────────────────────────────
  await supabase
    .from('app_config')
    .upsert(
      { key: 'creatives_last_synced', value: new Date().toISOString() },
      { onConflict: 'key' }
    )

  return NextResponse.json({
    success: true,
    synced_at: yesterdayStr,
    ...syncLog,
  })
}