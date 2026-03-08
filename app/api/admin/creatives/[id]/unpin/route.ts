import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient()

  // Unpin only — is_on_leaderboard reverts to threshold on next nightly sync
  const { error } = await supabase
    .from('meta_creatives')
    .update({
      is_pinned: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}