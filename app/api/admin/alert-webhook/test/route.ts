import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'alert_webhook_url')
    .single()

  const url = config?.value
  if (!url) return NextResponse.json({ error: 'No alert webhook URL configured' }, { status: 400 })

  const samplePayload = {
    event: 'customer_behind_pace',
    customer_id: '00000000-0000-0000-0000-000000000000',
    customer_name: 'Test Customer LLC',
    service: 'Roof Replacement',
    monthly_quota: 80,
    leads_delivered: 12,
    days_elapsed: 9,
    days_in_month: 31,
    pace_percent: 52,
    required_pace_percent: 100,
    deficit: 68,
    message: 'Test Customer LLC is at 52% pace — 68 leads behind target (TEST ALERT)',
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload),
    })
    return NextResponse.json({ success: true, status: res.status })
  } catch (err) {
    console.error('Alert webhook test error:', err)
    return NextResponse.json({ error: 'Failed to reach webhook URL' }, { status: 500 })
  }
}