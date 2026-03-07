import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()
  const { passcode } = body

  if (!passcode) return NextResponse.json({ error: 'passcode is required' }, { status: 400 })

  // Verify passcode against app_config
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'creative_board_passcode')
    .single()

  if (!config || config.value !== passcode) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 403 })
  }

  // Get thumbnail path for storage deletion
  const { data: creative } = await supabase
    .from('meta_creatives')
    .select('id, thumbnail_path')
    .eq('id', id)
    .single()

  if (!creative) return NextResponse.json({ error: 'Creative not found' }, { status: 404 })

  // Delete from Supabase Storage
  if (creative.thumbnail_path) {
    await supabase.storage.from('creative-thumbnails').remove([creative.thumbnail_path])
  }

  // Mark archived
  const { error } = await supabase
    .from('meta_creatives')
    .update({ is_archived_from_board: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}