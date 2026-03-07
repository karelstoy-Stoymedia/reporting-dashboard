import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()
  const { tag_ids } = body

  if (!Array.isArray(tag_ids)) {
    return NextResponse.json({ error: 'tag_ids must be an array' }, { status: 400 })
  }

  // Verify creative exists
  const { data: creative } = await supabase
    .from('meta_creatives')
    .select('id')
    .eq('id', id)
    .single()
  if (!creative) return NextResponse.json({ error: 'Creative not found' }, { status: 404 })

  // Delete existing tag assignments for this creative
  await supabase
    .from('meta_creative_tag_assignments')
    .delete()
    .eq('creative_id', id)

  // Insert new assignments
  if (tag_ids.length > 0) {
    const rows = tag_ids.map((tag_id: string) => ({ creative_id: id, tag_id }))
    const { error } = await supabase.from('meta_creative_tag_assignments').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update is_tagged flag
  await supabase
    .from('meta_creatives')
    .update({ is_tagged: tag_ids.length > 0, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ success: true })
}