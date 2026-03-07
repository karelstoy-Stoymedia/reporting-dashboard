import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'alert_webhook_url')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: lastRun } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'pace_check_last_run')
    .single()

  return NextResponse.json({
    url: data?.value ?? '',
    lastRun: lastRun?.value ?? null,
  })
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { url } = body

  if (url === undefined) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'alert_webhook_url', value: url }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}