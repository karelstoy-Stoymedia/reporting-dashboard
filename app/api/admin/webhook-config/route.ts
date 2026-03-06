import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase.from('app_config').select('value').eq('key', 'alert_webhook_url').single()
  return NextResponse.json({ value: data?.value ?? '' })
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const { value } = await request.json()
  const { error } = await supabase.from('app_config').upsert({ key: 'alert_webhook_url', value }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
