import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function countBusinessDays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(count, 1)
}

export async function GET(request: NextRequest) {
  // Protect with CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Read alert webhook URL
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'alert_webhook_url')
    .single()

  const alertUrl = config?.value
  if (!alertUrl) {
    return NextResponse.json({ skipped: true, reason: 'No alert webhook URL configured' })
  }

  // Get all active customer_orders, join customers to filter by tier
  // tier lives on customers, NOT on customer_orders
  const { data: orders, error: ordersErr } = await supabase
    .from('customer_orders')
    .select(`
      id,
      customer_id,
      lead_quota,
      leads_delivered,
      starts_at,
      ends_at,
      weekend_delivery,
      service_id,
      customers!inner(id, name, tier),
      services(name)
    `)
    .eq('status', 'active')
    .eq('customers.tier', 'pay_per_lead')

  if (ordersErr) {
    console.error('Pace check orders error:', ordersErr)
    return NextResponse.json({ error: ordersErr.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ checked: 0, alerts_fired: 0, customers: [] })
  }

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const results = []
  let alertsFired = 0

  for (const order of orders) {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const service = Array.isArray(order.services) ? order.services[0] : order.services

    // Count leads delivered this calendar month from lead_events
    // Also cross-check against leads_delivered on the order itself
    const { count: monthCount } = await supabase
      .from('lead_events')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', order.customer_id)
      .eq('event_type', 'lead_sold')
      .gte('event_date', firstOfMonth.toISOString().split('T')[0])
      .lte('event_date', now.toISOString().split('T')[0])

    const leadsDelivered = monthCount ?? 0
    const quota = order.lead_quota ?? 0
    if (quota === 0) continue

    const daysElapsed = countBusinessDays(firstOfMonth, now)
    const totalBusinessDays = countBusinessDays(firstOfMonth, lastOfMonth)

    const pacePercent = Math.round(
      ((leadsDelivered / daysElapsed) / (quota / totalBusinessDays)) * 100
    )
    const deficit = Math.max(
      0,
      Math.round((quota / totalBusinessDays) * daysElapsed) - leadsDelivered
    )

    const result = {
      customer_id: order.customer_id,
      customer_name: customer?.name ?? 'Unknown',
      service: service?.name ?? 'Unknown',
      monthly_quota: quota,
      leads_delivered: leadsDelivered,
      days_elapsed: daysElapsed,
      days_in_month: totalBusinessDays,
      pace_percent: pacePercent,
      deficit,
      alert_fired: false,
    }

    if (pacePercent < 90) {
      try {
        await fetch(alertUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'customer_behind_pace',
            customer_id: order.customer_id,
            customer_name: customer?.name ?? 'Unknown',
            service: service?.name ?? 'Unknown',  // "service" not "industry"
            monthly_quota: quota,
            leads_delivered: leadsDelivered,
            days_elapsed: daysElapsed,
            days_in_month: totalBusinessDays,
            pace_percent: pacePercent,
            required_pace_percent: 100,
            deficit,
            message: `${customer?.name ?? 'Unknown'} is at ${pacePercent}% pace — ${deficit} leads behind target`,
          }),
        })
        result.alert_fired = true
        alertsFired++
      } catch (err) {
        console.error(`Alert fire failed for customer ${order.customer_id}:`, err)
      }
    }

    results.push(result)
  }

  // Update last run timestamp in app_config
  await supabase
    .from('app_config')
    .upsert(
      { key: 'pace_check_last_run', value: now.toISOString() },
      { onConflict: 'key' }
    )

  return NextResponse.json({
    checked: orders.length,
    alerts_fired: alertsFired,
    customers: results,
  })
}