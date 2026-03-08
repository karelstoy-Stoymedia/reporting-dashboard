import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const body = await request.json().catch(() => ({}))
  const { passcode } = body

  const { data: configRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'creative_board_passcode')
    .single()

  const expectedPasscode = configRow?.value ?? 'stoy2024'

  if (!passcode || passcode !== expectedPasscode) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 403 })
  }

  const { error } = await supabase
    .from('meta_creatives')
    .update({
      is_removed: true,
      is_pinned: false,
      is_on_leaderboard: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}