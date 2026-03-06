import { createServiceClient } from '@/lib/supabase/server'

function countWeekdays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(count, 1)
}

export async function getCustomersDashboardData(startDate: string, endDate: string) {
  const supabase = createServiceClient()

  const [
  { data: customers, error: custErr },
  { data: orders, error: ordersErr },
  { data: leadEvents, error: eventsErr },
] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, tier, source, started_at, notes')
      .order('started_at', { ascending: false }),

    supabase
      .from('customer_orders')
      .select('id, customer_id, lead_quota, price_per_lead, starts_at, ends_at, status, is_renewal, leads_delivered, weekend_delivery')
      .order('starts_at', { ascending: false }),

    supabase
      .from('lead_events')
      .select('id, customer_id, lead_price, lead_cost, event_date, created_at')
      .eq('event_type', 'lead_sold'),
  ])

  if (custErr) console.error('CUSTOMERS QUERY ERROR:', custErr)
  if (ordersErr) console.error('ORDERS QUERY ERROR:', ordersErr)
  if (eventsErr) console.error('EVENTS QUERY ERROR:', eventsErr)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const enriched = (customers ?? []).map(c => {
    const cOrders = (orders ?? []).filter(o => o.customer_id === c.id)
    const cEvents = (leadEvents ?? []).filter(e => e.customer_id === c.id)

    // Active order = has an order where status is active
    const activeOrders = cOrders.filter(o => o.status === 'active')
    const isActive = activeOrders.length > 0

    // Lead stats
    const allTimeLtv = cEvents.reduce((s, e) => s + Number(e.lead_price || 0), 0)
    const allTimeLtgp = cEvents.reduce((s, e) => s + (Number(e.lead_price || 0) - Number(e.lead_cost || 0)), 0)

    const last30Events = cEvents.filter(e => new Date(e.created_at) >= thirtyDaysAgo)
    const prev30Events = cEvents.filter(e => new Date(e.created_at) >= sixtyDaysAgo && new Date(e.created_at) < thirtyDaysAgo)
    const leadsLast30 = last30Events.length
    const leadsPrev30 = prev30Events.length
    const leadChangePct = leadsPrev30 > 0 ? ((leadsLast30 - leadsPrev30) / leadsPrev30) * 100 : 0

    const allEventsSorted = [...cEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const firstLead = allEventsSorted[allEventsSorted.length - 1]?.created_at ?? null
    const lastLead = allEventsSorted[0]?.created_at ?? null
    const daysSinceLast = lastLead ? Math.floor((now.getTime() - new Date(lastLead).getTime()) / (1000 * 60 * 60 * 24)) : null

    // Range events
    const rangeEvents = cEvents.filter(e => e.event_date >= startDate && e.event_date <= endDate)
    const rangeLeads = rangeEvents.length
    const rangeSpend = rangeEvents.reduce((s, e) => s + Number(e.lead_price || 0), 0)

    const currentPricePerLead = activeOrders[0]?.price_per_lead ?? null

    // Current order quota and pace
    const currentOrder = activeOrders[0] ?? null
    const quota = currentOrder?.lead_quota ?? 0
    const delivered = currentOrder?.leads_delivered ?? 0
    const orderStart = currentOrder ? new Date(currentOrder.starts_at) : null
    const orderEnd = currentOrder ? new Date(currentOrder.ends_at) : null
    const weekendDelivery = currentOrder?.weekend_delivery ?? false
    const daysInOrder = orderStart && orderEnd
      ? (weekendDelivery ? Math.ceil((orderEnd.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24)) : countWeekdays(orderStart, orderEnd))
      : (weekendDelivery ? 30 : 22)
    const daysElapsed = orderStart
      ? (weekendDelivery ? Math.max(1, Math.floor((now.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24))) : countWeekdays(orderStart, now))
      : 1
    const expectedByNow = quota > 0 ? (quota / daysInOrder) * daysElapsed : 0
    const onPace = expectedByNow > 0 ? delivered / expectedByNow : 1
    const behindPace = onPace < 0.9 && quota > 0

    // Account age
    const accountAgeDays = Math.floor((now.getTime() - new Date(c.started_at).getTime()) / (1000 * 60 * 60 * 24))

    return {
      ...c,
      isActive,
      allTimeLtv,
      allTimeLtgp,
      currentPricePerLead,
      leadsLast30,
      leadsPrev30,
      leadChangePct,
      firstLead,
      lastLead,
      daysSinceLast,
      rangeLeads,
      rangeSpend,
      quota,
      delivered,
      onPace,
      behindPace,
      accountAgeDays,
      activeOrders,
    }
  })

  const activeCustomers = enriched.filter(c => c.isActive)
  const pastCustomers = enriched.filter(c => !c.isActive)

  // Sort: behind pace first, then by LTV
  activeCustomers.sort((a, b) => {
    if (a.behindPace && !b.behindPace) return -1
    if (!a.behindPace && b.behindPace) return 1
    return b.allTimeLtv - a.allTimeLtv
  })

  return {
    activeCustomers,
    pastCustomers,
    summary: {
      totalActive: activeCustomers.length,
      totalQuota: activeCustomers.reduce((s, c) => s + c.quota, 0),
      avgLtv: activeCustomers.length > 0
        ? activeCustomers.reduce((s, c) => s + c.allTimeLtv, 0) / activeCustomers.length
        : 0,
    },
  }
}