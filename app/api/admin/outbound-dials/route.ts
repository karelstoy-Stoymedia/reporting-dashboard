import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('outbound_dial_events')
    .select('*, outbound_channels(name)')
    .order('event_date', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const { channel_id, event_date, dials_made, connects } = await request.json()
  if (!channel_id || !event_date || !dials_made || connects === undefined) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  const { error } = await supabase.from('outbound_dial_events').upsert({ channel_id, event_date, dials_made, connects }, { onConflict: 'channel_id,event_date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
