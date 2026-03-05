import { createServiceClient } from '@/lib/supabase/server'

export async function getGeneralDashboardData(startDate: string, endDate: string) {
  const supabase = createServiceClient()

  const [
    { data: newCustomers },
    { data: revenue },
    { data: adspend },
    { data: leadsDelivered },
    { data: repLeaderboard },
  ] = await Promise.all([
    // New customers gained — count of orders starting in range
    supabase
      .from('customer_orders')
      .select('id, starts_at, customers(name)')
      .gte('starts_at', startDate)
      .lte('starts_at', endDate)
      .eq('is_renewal', false),

    // Revenue — sum of bookings.revenue in range
    supabase
      .from('bookings')
      .select('revenue, cash_collected, booked_at, leads(source_type)')
      .gte('booked_at', startDate)
      .lte('booked_at', endDate)
      .not('revenue', 'is', null),

    // Total adspend in range
    supabase
      .from('ad_events')
      .select('adspend, event_date')
      .gte('event_date', startDate)
      .lte('event_date', endDate),

    // Leads delivered to customers
    supabase
      .from('lead_events')
      .select('id, event_date')
      .eq('event_type', 'lead_sold')
      .gte('event_date', startDate)
      .lte('event_date', endDate),

    // Rep leaderboard
    supabase
      .from('bookings')
      .select('revenue, cash_collected, outcome, rep_id, sales_reps(name)')
      .gte('booked_at', startDate)
      .lte('booked_at', endDate)
      .not('revenue', 'is', null),
  ])

  // Calculate KPIs
  const totalRevenue = (revenue ?? []).reduce((sum, b) => sum + (Number(b.revenue) || 0), 0)
  const totalAdspend = (adspend ?? []).reduce((sum, a) => sum + (Number(a.adspend) || 0), 0)
  const totalLeadsDelivered = leadsDelivered?.length ?? 0
  const newCustomersCount = newCustomers?.length ?? 0
  const totalCashCollected = (revenue ?? []).reduce((sum, b) => sum + (Number(b.cash_collected) || 0), 0)

  // Rep leaderboard aggregation
  const repMap: Record<string, { name: string; revenue: number; closes: number }> = {}
  for (const b of repLeaderboard ?? []) {
    const repId = b.rep_id
    const repName = (b.sales_reps as unknown as { name: string })?.name ?? 'Unknown'
    if (!repMap[repId]) repMap[repId] = { name: repName, revenue: 0, closes: 0 }
    repMap[repId].revenue += Number(b.revenue) || 0
    if (b.outcome === 'full_pay' || b.outcome === 'split_pay') {
      repMap[repId].closes += 1
    }
  }

  const leaderboard = Object.values(repMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map((r, i) => ({
      rank: i + 1,
      name: r.name,
      revenue: r.revenue,
      closes: r.closes,
      closeRate: r.closes > 0 ? ((r.closes / Math.max(1, repLeaderboard?.filter(b => b.rep_id).length || 1)) * 100).toFixed(1) : '0.0',
    }))

  // Ads vs outbound split
  const adRevenue = (revenue ?? []).filter(b => (b.leads as unknown as { source_type: string })?.source_type === 'ad').reduce((sum, b) => sum + (Number(b.revenue) || 0), 0)
  const outboundRevenue = totalRevenue - adRevenue

  return {
    kpis: {
      newCustomers: newCustomersCount,
      totalRevenue,
      totalCashCollected,
      totalAdspend,
      grossProfit: totalRevenue - totalAdspend,
      totalLeadsDelivered,
    },
    leaderboard,
    revenueBySource: { ads: adRevenue, outbound: outboundRevenue },
    newCustomersList: newCustomers ?? [],
  }
}