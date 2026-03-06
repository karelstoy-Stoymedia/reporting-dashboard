import { createServiceClient } from '@/lib/supabase/server'

export async function getFulfilmentDashboardData(startDate: string, endDate: string, serviceId?: string) {
  const supabase = createServiceClient()

  const [
    { data: services },
    { data: customers },
    { data: leadEvents },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, slug, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true }),

    supabase
      .from('customers')
      .select('id, tier'),

    supabase
      .from('lead_events')
      .select('id, customer_id, service_id, event_type, lead_price, lead_cost, event_date')
      .in('event_type', ['lead_sold', 'lead_returned'])
      .gte('event_date', startDate)
      .lte('event_date', endDate),
  ])

  const allServices = services ?? []
  const allCustomers = customers ?? []
  const allEvents = leadEvents ?? []

  // Only pay_per_lead customer IDs
  const pplCustomerIds = new Set(
    allCustomers
      .filter(c => c.tier === 'pay_per_lead')
      .map(c => c.id)
  )

  // Filter events to pay_per_lead customers only
  const pplEvents = allEvents.filter(e => e.customer_id && pplCustomerIds.has(e.customer_id))

  // Build metrics per service
  const serviceMetrics = allServices.map(service => {
    const events = serviceId && serviceId !== 'all'
      ? pplEvents.filter(e => e.service_id === service.id)
      : pplEvents.filter(e => e.service_id === service.id)

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

  // Blended totals across all services
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

  // Daily breakdown for charts (all ppl events in range)
  const dailyMap = new Map<string, { date: string; sold: number; returned: number; revenue: number; cost: number }>()
  pplEvents.forEach(e => {
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

  return {
    services: allServices,
    serviceMetrics,
    blended,
    dailyData,
  }
}