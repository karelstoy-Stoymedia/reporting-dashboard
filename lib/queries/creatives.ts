import { createServiceClient } from '@/lib/supabase/server'

// ─── Signed URL helper ────────────────────────────────────────────────────────
export async function generateSignedUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const validPaths = paths.filter((p): p is string => !!p)
  if (validPaths.length === 0) return new Map()
  const supabase = createServiceClient()
  const { data } = await supabase.storage
    .from('creative-thumbnails')
    .createSignedUrls(validPaths, 3600)
  const map = new Map<string, string>()
  ;(data ?? []).forEach(item => {
    if (item.signedUrl && item.path != null) map.set(item.path, item.signedUrl)
  })
  return map
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export async function getCreativesLeaderboard({
  startDate,
  endDate,
  tagId,
  accountId,
  includeArchived = false,
}: {
  startDate: string
  endDate: string
  tagId?: string
  accountId?: string
  includeArchived?: boolean
}) {
  const supabase = createServiceClient()

  let creativesQuery = supabase
    .from('meta_creatives')
    .select('id, meta_ad_id, ad_account_id, campaign_name, adset_name, ad_name, thumbnail_path, creative_type, headline, body, cta, status, is_tagged, is_archived_from_board, first_seen_at, last_seen_at')
    .order('created_at', { ascending: false })

  if (!includeArchived) creativesQuery = creativesQuery.eq('is_archived_from_board', false)
  if (accountId) creativesQuery = creativesQuery.eq('ad_account_id', accountId)

  const { data: creatives, error: creativesErr } = await creativesQuery
  if (creativesErr) throw creativesErr
  if (!creatives || creatives.length === 0) return []

  const ids = creatives.map(c => c.id)

  const [{ data: metrics }, { data: tagAssignments }] = await Promise.all([
    supabase
      .from('meta_creative_metrics')
      .select('creative_id, spend, impressions, clicks, leads, hook_rate, metric_date')
      .in('creative_id', ids)
      .gte('metric_date', startDate)
      .lte('metric_date', endDate),
    supabase
      .from('meta_creative_tag_assignments')
      .select('creative_id, meta_creative_tags(id, name, color)')
      .in('creative_id', ids),
  ])

  const metricsMap = new Map<string, typeof metrics>()
  ;(metrics ?? []).forEach(m => {
    if (!metricsMap.has(m.creative_id)) metricsMap.set(m.creative_id, [])
    metricsMap.get(m.creative_id)!.push(m)
  })

  const tagsMap = new Map<string, { id: string; name: string; color: string }[]>()
  ;(tagAssignments ?? []).forEach((a: any) => {
    if (!tagsMap.has(a.creative_id)) tagsMap.set(a.creative_id, [])
    if (a.meta_creative_tags) tagsMap.get(a.creative_id)!.push(a.meta_creative_tags)
  })

  const signedUrls = await generateSignedUrls(creatives.map(c => c.thumbnail_path))

  const aggregated = creatives.map(c => {
    const rows = metricsMap.get(c.id) ?? []
    const totalSpend = rows.reduce((s, m) => s + Number(m.spend || 0), 0)
    const totalLeads = rows.reduce((s, m) => s + Number(m.leads || 0), 0)
    const totalClicks = rows.reduce((s, m) => s + Number(m.clicks || 0), 0)
    const totalImpressions = rows.reduce((s, m) => s + Number(m.impressions || 0), 0)
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : null
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : null
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : null
    const hookRows = c.creative_type === 'video' ? rows.filter(m => m.hook_rate !== null) : []
    const avgHookRate = hookRows.length > 0
      ? hookRows.reduce((s, m) => s + Number(m.hook_rate), 0) / hookRows.length
      : null

    return {
      ...c,
      thumbnail_url: c.thumbnail_path ? (signedUrls.get(c.thumbnail_path) ?? null) : null,
      tags: tagsMap.get(c.id) ?? [],
      totalSpend,
      totalLeads,
      totalClicks,
      totalImpressions,
      cpl,
      ctr,
      cpm,
      cpc,
      avgHookRate,
    }
  })

  let filtered = aggregated
  if (tagId) filtered = aggregated.filter(c => c.tags.some(t => t.id === tagId))

  filtered.sort((a, b) => {
    if (a.cpl === null && b.cpl === null) return 0
    if (a.cpl === null) return 1
    if (b.cpl === null) return -1
    return a.cpl - b.cpl
  })

  return filtered
}

// ─── Detail ───────────────────────────────────────────────────────────────────
export async function getCreativeDetail(id: string) {
  const supabase = createServiceClient()

  const [{ data: creative, error }, { data: metrics }, { data: tagAssignments }] = await Promise.all([
    supabase.from('meta_creatives').select('*').eq('id', id).single(),
    supabase.from('meta_creative_metrics')
      .select('metric_date, spend, impressions, clicks, leads, cpm, cpc, ctr, cpl, hook_rate, video_3s_views')
      .eq('creative_id', id)
      .order('metric_date', { ascending: true }),
    supabase.from('meta_creative_tag_assignments')
      .select('meta_creative_tags(id, name, color)')
      .eq('creative_id', id),
  ])

  if (error) throw error

  const signedUrls = await generateSignedUrls([creative?.thumbnail_path ?? null])
  const tags = (tagAssignments ?? []).map((a: any) => a.meta_creative_tags).filter(Boolean)

  return {
    ...creative,
    thumbnail_url: creative?.thumbnail_path ? (signedUrls.get(creative.thumbnail_path) ?? null) : null,
    metrics: metrics ?? [],
    tags,
  }
}

// ─── Live creatives ───────────────────────────────────────────────────────────
export async function getLiveCreatives({
  accountId,
  campaignId,
  adsetId,
}: {
  accountId?: string
  campaignId?: string
  adsetId?: string
}) {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('meta_creatives')
    .select('id, meta_ad_id, ad_account_id, campaign_id, campaign_name, adset_id, adset_name, ad_name, thumbnail_path, creative_type, headline, status, is_tagged')
    .eq('status', 'ACTIVE')
    .eq('is_archived_from_board', false)

  if (accountId) query = query.eq('ad_account_id', accountId)
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (adsetId) query = query.eq('adset_id', adsetId)

  const { data: creatives, error } = await query
  if (error) throw error
  if (!creatives || creatives.length === 0) return []

  const ids = creatives.map(c => c.id)

  const [{ data: todayMetrics }, { data: tagAssignments }, signedUrls] = await Promise.all([
    supabase.from('meta_creative_metrics')
      .select('creative_id, spend, leads, cpl, ctr, hook_rate, metric_date')
      .in('creative_id', ids)
      .eq('metric_date', today),
    supabase.from('meta_creative_tag_assignments')
      .select('creative_id, meta_creative_tags(id, name, color)')
      .in('creative_id', ids),
    generateSignedUrls(creatives.map(c => c.thumbnail_path)),
  ])

  const metricsMap = new Map((todayMetrics ?? []).map(m => [m.creative_id, m]))
  const tagsMap = new Map<string, any[]>()
  ;(tagAssignments ?? []).forEach((a: any) => {
    if (!tagsMap.has(a.creative_id)) tagsMap.set(a.creative_id, [])
    if (a.meta_creative_tags) tagsMap.get(a.creative_id)!.push(a.meta_creative_tags)
  })

  return creatives.map(c => ({
    ...c,
    thumbnail_url: c.thumbnail_path ? (signedUrls.get(c.thumbnail_path) ?? null) : null,
    tags: tagsMap.get(c.id) ?? [],
    todayMetrics: metricsMap.get(c.id) ?? null,
  }))
}

// ─── Untagged queue ───────────────────────────────────────────────────────────
export async function getUntaggedCreatives() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('meta_creatives')
    .select('id, meta_ad_id, ad_account_id, ad_name, thumbnail_path, creative_type, status')
    .eq('is_tagged', false)
    .eq('is_archived_from_board', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  const ids = data.map(c => c.id)
  const { data: metrics } = await supabase
    .from('meta_creative_metrics')
    .select('creative_id, spend, leads')
    .in('creative_id', ids)

  const signedUrls = await generateSignedUrls(data.map(c => c.thumbnail_path))

  const metricsMap = new Map<string, { spend: number; leads: number }[]>()
  ;(metrics ?? []).forEach(m => {
    if (!metricsMap.has(m.creative_id)) metricsMap.set(m.creative_id, [])
    metricsMap.get(m.creative_id)!.push(m)
  })

  return data.map(c => {
    const rows = metricsMap.get(c.id) ?? []
    const totalSpend = rows.reduce((s, m) => s + Number(m.spend || 0), 0)
    const totalLeads = rows.reduce((s, m) => s + Number(m.leads || 0), 0)
    return {
      ...c,
      thumbnail_url: c.thumbnail_path ? (signedUrls.get(c.thumbnail_path) ?? null) : null,
      totalSpend,
      totalLeads,
      cpl: totalLeads > 0 ? totalSpend / totalLeads : null,
    }
  })
}

// ─── Tags + accounts ──────────────────────────────────────────────────────────
export async function getCreativeTags() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('meta_creative_tags').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function getMetaAdAccounts() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('meta_ad_accounts').select('*').order('account_name')
  if (error) throw error
  return data ?? []
}