import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('outbound_overhead')
    .select('*, outbound_channels(name)')
    .order('month_year', { ascending: false })
    .limit(12)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const { channel_id, month_year, overhead_amount } = await request.json()
  if (!channel_id || !month_year || !overhead_amount) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  const { error } = await supabase.from('outbound_overhead').upsert({ channel_id, month_year, overhead_amount, updated_at: new Date().toISOString() }, { onConflict: 'channel_id,month_year' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
