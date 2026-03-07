import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  // Preview — returns which creatives would be archived (no changes made)
  const supabase = createServiceClient()

  const { data: creatives, error } = await supabase
    .from('meta_creatives')
    .select('id, ad_name, thumbnail_path, meta_creative_metrics(spend, leads)')
    .eq('is_archived_from_board', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scored = (creatives ?? []).map(c => {
    const metrics = Array.isArray(c.meta_creative_metrics) ? c.meta_creative_metrics : []
    const totalSpend = metrics.reduce((s: number, m: any) => s + Number(m.spend || 0), 0)
    const totalLeads = metrics.reduce((s: number, m: any) => s + Number(m.leads || 0), 0)
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : null
    return { id: c.id, ad_name: c.ad_name, thumbnail_path: c.thumbnail_path, totalSpend, totalLeads, cpl }
  })

  // Sort CPL DESC — worst performers first. Null CPL (no leads) = worst.
  scored.sort((a, b) => {
    if (a.cpl === null && b.cpl === null) return 0
    if (a.cpl === null) return -1
    if (b.cpl === null) return 1
    return b.cpl - a.cpl
  })

  const cutoff = Math.floor(scored.length * 0.8)
  const toArchive = scored.slice(0, cutoff)

  return NextResponse.json({
    total: scored.length,
    toArchiveCount: toArchive.length,
    toArchive: toArchive.map(c => ({ id: c.id, ad_name: c.ad_name, cpl: c.cpl, totalSpend: c.totalSpend })),
  })
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { passcode, percent = 80 } = body

  if (!passcode) return NextResponse.json({ error: 'passcode is required' }, { status: 400 })

  // Verify passcode
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'creative_board_passcode')
    .single()

  if (!config || config.value !== passcode) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 403 })
  }

  // Get all non-archived creatives with all-time metrics
  const { data: creatives, error } = await supabase
    .from('meta_creatives')
    .select('id, thumbnail_path, meta_creative_metrics(spend, leads)')
    .eq('is_archived_from_board', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scored = (creatives ?? []).map(c => {
    const metrics = Array.isArray(c.meta_creative_metrics) ? c.meta_creative_metrics : []
    const totalSpend = metrics.reduce((s: number, m: any) => s + Number(m.spend || 0), 0)
    const totalLeads = metrics.reduce((s: number, m: any) => s + Number(m.leads || 0), 0)
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : null
    return { id: c.id, thumbnail_path: c.thumbnail_path, cpl }
  })

  scored.sort((a, b) => {
    if (a.cpl === null && b.cpl === null) return 0
    if (a.cpl === null) return -1
    if (b.cpl === null) return 1
    return b.cpl - a.cpl
  })

  const cutoff = Math.floor(scored.length * (percent / 100))
  const toArchive = scored.slice(0, cutoff)
  const ids = toArchive.map(c => c.id)
  const paths = toArchive.map(c => c.thumbnail_path).filter((p): p is string => !!p)

  // Delete thumbnails from storage
  if (paths.length > 0) {
    await supabase.storage.from('creative-thumbnails').remove(paths)
  }

  // Mark archived in DB
  const { error: archiveError } = await supabase
    .from('meta_creatives')
    .update({ is_archived_from_board: true, updated_at: new Date().toISOString() })
    .in('id', ids)

  if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 })

  return NextResponse.json({ success: true, archived: ids.length })
}