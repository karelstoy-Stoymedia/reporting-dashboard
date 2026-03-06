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

export async function getFulfilmentDashboardData(startDate: string, endDate: string) {
  const supabase = createServiceClient()

  const [
    { data: services },
    { data: customers },
    { data: orders },
    { data: leadEvents },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, slug, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true }),

    supabase
      .from('customers')
      .select('id, name, tier, source, started_at')
      .eq('tier', 'pay_per_lead'),

    supabase
      .from('customer_orders')
      .select('id, customer_id, lead_quota, price_per_lead, starts_at, ends_at, status, is_renewal, leads_delivered, weekend_delivery, notes')
      .order('starts_at', { ascending: false }),

    supabase
      .from('lead_events')
      .select('id, customer_id, service_id, event_type, lead_price, lead_cost, event_date, created_at')
      .in('event_type', ['lead_sold', 'lead_returned']),
  ])

  const allServices = services ?? []
  const allCustomers = customers ?? []
  const allOrders = orders ?? []
  const allEvents = leadEvents ?? []

  const pplCustomerIds = new Set(allCustomers.map(c => c.id))

  // All events for ppl customers only
  const pplEvents = allEvents.filter(e => e.customer_id && pplCustomerIds.has(e.customer_id))

  // Range-filtered events for metrics
  const rangeEvents = pplEvents.filter(e => e.event_date >= startDate && e.event_date <= endDate)

  // ── Service metrics ──────────────────────────────────────────────────────
  const serviceMetrics = allServices.map(service => {
    const events = rangeEvents.filter(e => e.service_id === service.id)
    const soldEvents = events.filter(e => e.event_type === 'lead_sold')
    const returnedEvents = events.filter(e => e.event_type === 'lead_returned')

    const leadsSold = soldEvents.length
    const leadsReturned = returnedEvents.length
    const returnRate = leadsSold > 0 ? leadsReturned / leadsSold : 0

    const revenue = soldEvents.reduce((s, e) => s + Number(e.lead_price || 0), 0)
    const cost = soldEvents.reduce((s, e) => s + Number(e.lead_cost || 0), 0)
    const returnedRevenue = returnedEvents.reduce((s, e) => s + Number(e.lead_price || 0), 0)
    const returnedCost = returnedEvents.reduce((s, e) => s + Number(e.lead_cost || 0), 0)

    const netRevenue = revenue - returnedRevenue
    const netCost = cost - returnedCost
    const profit = netRevenue - netCost
    const grossMargin = netRevenue > 0 ? profit / netRevenue : 0
    const avgLeadPrice = leadsSold > 0 ? revenue / leadsSold : 0

    return {
      id: service.id,
      name: service.name,
      slug: service.slug,
      leadsSold,
      leadsReturned,
      returnRate,
      revenue: netRevenue,
      cost: netCost,
      profit,
      grossMargin,
      avgLeadPrice,
    }
  })

  const blended = {
    id: 'all',
    name: 'All Services',
    slug: 'all',
    leadsSold: serviceMetrics.reduce((s, m) => s + m.leadsSold, 0),
    leadsReturned: serviceMetrics.reduce((s, m) => s + m.leadsReturned, 0),
    returnRate: 0,
    revenue: serviceMetrics.reduce((s, m) => s + m.revenue, 0),
    cost: serviceMetrics.reduce((s, m) => s + m.cost, 0),
    profit: serviceMetrics.reduce((s, m) => s + m.profit, 0),
    grossMargin: 0,
    avgLeadPrice: 0,
  }
  blended.returnRate = blended.leadsSold > 0 ? blended.leadsReturned / blended.leadsSold : 0
  blended.grossMargin = blended.revenue > 0 ? blended.profit / blended.revenue : 0
  blended.avgLeadPrice = blended.leadsSold > 0 ? blended.revenue / blended.leadsSold : 0

  // ── Daily chart data ─────────────────────────────────────────────────────
  const dailyMap = new Map<string, { date: string; sold: number; returned: number; revenue: number; cost: number }>()
  rangeEvents.forEach(e => {
    const d = e.event_date
    if (!dailyMap.has(d)) dailyMap.set(d, { date: d, sold: 0, returned: 0, revenue: 0, cost: 0 })
    const day = dailyMap.get(d)!
    if (e.event_type === 'lead_sold') {
      day.sold++
      day.revenue += Number(e.lead_price || 0)
      day.cost += Number(e.lead_cost || 0)
    } else {
      day.returned++
      day.revenue -= Number(e.lead_price || 0)
      day.cost -= Number(e.lead_cost || 0)
    }
  })
  const dailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  // ── Customer list with pace ──────────────────────────────────────────────
  const now = new Date()

  const customerList = allCustomers.map(c => {
    const cOrders = allOrders.filter(o => o.customer_id === c.id)
    const activeOrders = cOrders.filter(o => o.status === 'active')
    const currentOrder = activeOrders[0] ?? null

    // All-time events for this customer
    const cAllEvents = pplEvents.filter(e => e.customer_id === c.id)
    const cSoldAll = cAllEvents.filter(e => e.event_type === 'lead_sold')
    const cReturnedAll = cAllEvents.filter(e => e.event_type === 'lead_returned')

    // Services this customer buys (from all-time sold events)
    const serviceIds = [...new Set(cSoldAll.map(e => e.service_id).filter(Boolean))]
    const serviceNames = serviceIds
      .map(sid => allServices.find(s => s.id === sid)?.name)
      .filter(Boolean) as string[]

    // Range events
    const cRangeEvents = rangeEvents.filter(e => e.customer_id === c.id)
    const cRangeSold = cRangeEvents.filter(e => e.event_type === 'lead_sold')
    const leadsInRange = cRangeSold.length
    const spendInRange = cRangeSold.reduce((s, e) => s + Number(e.lead_price || 0), 0)

    // First / last lead
    const sortedSold = [...cSoldAll].sort((a, b) => a.event_date.localeCompare(b.event_date))
    const firstLeadDate = sortedSold[0]?.event_date ?? null
    const lastLeadDate = sortedSold[sortedSold.length - 1]?.event_date ?? null
    const daysSinceLast = lastLeadDate
      ? Math.floor((now.getTime() - new Date(lastLeadDate).getTime()) / (1000 * 60 * 60 * 24))
      : null

    // LTV / LTGP
    const allTimeLtv = cSoldAll.reduce((s, e) => s + Number(e.lead_price || 0), 0)
    const allTimeLtgp = cSoldAll.reduce((s, e) => s + (Number(e.lead_price || 0) - Number(e.lead_cost || 0)), 0)
    const allTimeReturned = cReturnedAll.reduce((s, e) => s + Number(e.lead_price || 0), 0)
    const returnRate = allTimeLtv > 0 ? allTimeReturned / allTimeLtv : 0

    // Pace calculation using weekend_delivery from active order
    const weekendDelivery = currentOrder?.weekend_delivery ?? false
    const quota = currentOrder?.lead_quota ?? 0
    const orderStart = currentOrder ? new Date(currentOrder.starts_at) : null
    const orderEnd = currentOrder ? new Date(currentOrder.ends_at) : null

    const daysInOrder = orderStart && orderEnd
      ? (weekendDelivery
        ? Math.ceil((orderEnd.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24))
        : countWeekdays(orderStart, orderEnd))
      : (weekendDelivery ? 30 : 22)

    const daysElapsed = orderStart
      ? (weekendDelivery
        ? Math.max(1, Math.floor((now.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24)))
        : countWeekdays(orderStart, now))
      : 1

    // Count leads delivered to current active order only
    const delivered = currentOrder
      ? pplEvents.filter(e =>
          e.customer_id === c.id &&
          e.event_type === 'lead_sold' &&
          e.event_date >= currentOrder.starts_at &&
          e.event_date <= currentOrder.ends_at
        ).length
      : 0

    const expectedByNow = quota > 0 ? (quota / daysInOrder) * daysElapsed : 0
    const onPace = expectedByNow > 0 ? delivered / expectedByNow : 1
    const behindPace = onPace < 0.9 && quota > 0
    const isActive = activeOrders.length > 0

    return {
      id: c.id,
      name: c.name,
      tier: c.tier,
      source: c.source,
      started_at: c.started_at,
      isActive,
      serviceNames,
      serviceIds,
      firstLeadDate,
      lastLeadDate,
      daysSinceLast,
      leadsInRange,
      spendInRange,
      allTimeLtv,
      allTimeLtgp,
      returnRate,
      currentOrder,
      allOrders: cOrders,
      quota,
      delivered,
      onPace,
      behindPace,
      pricePerLead: currentOrder?.price_per_lead ?? null,
      weekendDelivery,
    }
  })

  // Sort: behind pace first, then by LTV
  customerList.sort((a, b) => {
    if (a.behindPace && !b.behindPace) return -1
    if (!a.behindPace && b.behindPace) return 1
    return b.allTimeLtv - a.allTimeLtv
  })

  return {
    services: allServices,
    serviceMetrics,
    blended,
    dailyData,
    customerList,
  }
}