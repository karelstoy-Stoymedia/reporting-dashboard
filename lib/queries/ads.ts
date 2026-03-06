import { createServiceClient } from '@/lib/supabase/server'

export async function getAdsDashboardData(startDate: string, endDate: string, platformId?: string) {
  const supabase = createServiceClient()

  // Build platform filter
  const platformFilter = platformId && platformId !== 'all' ? platformId : null

  const [
    { data: platforms },
    { data: adEvents },
    { data: bookings },
    { data: leads },
  ] = await Promise.all([
    supabase.from('ad_platforms').select('id, name, slug').eq('is_active', true),

    supabase
      .from('ad_events')
      .select('adspend, leads, event_date, platform_id')
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .then(r => platformFilter
        ? { data: r.data?.filter(e => e.platform_id === platformFilter) ?? [] }
        : r
      ),

    supabase
      .from('bookings')
      .select('id, outcome, showed, call_number, cash_collected, revenue, booked_at, is_self_set, offer_made, call_duration_seconds, rep_id, lead_id, leads!inner(source_type, platform_id, created_at)')
      .gte('booked_at', startDate)
      .lte('booked_at', endDate)
      .eq('leads.source_type', 'ad')
      .then(r => platformFilter
        ? { data: r.data?.filter(b => (b.leads as unknown as { platform_id: string })?.platform_id === platformFilter) ?? [] }
        : r
      ),

    supabase
      .from('leads')
      .select('id, platform_id, created_at')
      .eq('source_type', 'ad')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .then(r => platformFilter
        ? { data: r.data?.filter(l => l.platform_id === platformFilter) ?? [] }
        : r
      ),
  ])

  const allBookings = bookings ?? []
  const allLeads = leads ?? []
  const allAdEvents = adEvents ?? []

  // Spend & leads
  const totalAdspend = allAdEvents.reduce((s, e) => s + Number(e.adspend || 0), 0)
  const totalLeads = allAdEvents.reduce((s, e) => s + Number(e.leads || 0), 0)
  const costPerLead = totalLeads > 0 ? totalAdspend / totalLeads : 0

  // Calls
  const totalCalls = allBookings.length
  const firstCalls = allBookings.filter(b => b.call_number === 1)
  const secondCalls = allBookings.filter(b => b.call_number === 2)

  // Shows
  const firstCallShows = firstCalls.filter(b => b.showed === true)
  const secondCallShows = secondCalls.filter(b => b.showed === true)
  const firstCallShowRate = firstCalls.length > 0 ? firstCallShows.length / firstCalls.length : 0
  const secondCallShowRate = secondCalls.length > 0 ? secondCallShows.length / secondCalls.length : 0

  // Closes
  const closedFirst = firstCalls.filter(b => b.outcome === 'full_pay' || b.outcome === 'split_pay')
  const closedSecond = secondCalls.filter(b => b.outcome === 'full_pay' || b.outcome === 'split_pay')
  const closedFollowUp = allBookings.filter(b => b.call_number > 2 && (b.outcome === 'full_pay' || b.outcome === 'split_pay'))
  const totalClosed = closedFirst.length + closedSecond.length + closedFollowUp.length

  // Revenue & cash
  const totalRevenue = allBookings.reduce((s, b) => s + Number(b.revenue || 0), 0)
  const totalCash = allBookings.reduce((s, b) => s + Number(b.cash_collected || 0), 0)
  const revenueFirst = closedFirst.reduce((s, b) => s + Number(b.revenue || 0), 0)
  const revenueSecond = closedSecond.reduce((s, b) => s + Number(b.revenue || 0), 0)
  const cashFirst = closedFirst.reduce((s, b) => s + Number(b.cash_collected || 0), 0)
  const cashSecond = closedSecond.reduce((s, b) => s + Number(b.cash_collected || 0), 0)

  // Set rates
  const selfSet = allBookings.filter(b => b.is_self_set === true)
  const selfSetRate = totalLeads > 0 ? selfSet.length / totalLeads : 0
  const setterSetRate = totalLeads > 0 ? (allBookings.length - selfSet.length) / totalLeads : 0
  const blendedSetRate = totalLeads > 0 ? allBookings.length / totalLeads : 0

  // Qualified calls
  const qualifiedCalls = allBookings.filter(b => b.is_self_set !== null).length
  const costPerCall = totalCalls > 0 ? totalAdspend / totalCalls : 0
  const costPerQualifiedCall = qualifiedCalls > 0 ? totalAdspend / qualifiedCalls : 0

  // Rates
  const blendedCloseRate = firstCalls.length > 0 ? totalClosed / firstCalls.length : 0
  const closeRateFirst = firstCalls.length > 0 ? closedFirst.length / firstCalls.length : 0
  const closeRateSecond = secondCalls.length > 0 ? closedSecond.length / secondCalls.length : 0
  const cac = totalClosed > 0 ? totalAdspend / totalClosed : 0
  const avgTicket = totalClosed > 0 ? totalRevenue / totalClosed : 0
  const leadsForClose = totalClosed > 0 ? totalLeads / totalClosed : 0
  const leadConversionRate = totalLeads > 0 ? totalClosed / totalLeads : 0
  const revPerCall = totalCalls > 0 ? totalRevenue / totalCalls : 0
  const offerRate = firstCallShows.length > 0 ? allBookings.filter(b => b.offer_made).length / firstCallShows.length : 0
  const secondCallSetRate = firstCallShows.filter(b => !(b.outcome === 'full_pay' || b.outcome === 'split_pay')).length > 0
    ? secondCalls.length / firstCallShows.filter(b => !(b.outcome === 'full_pay' || b.outcome === 'split_pay')).length
    : 0

  // Hero (always all platforms blended)
  const heroAdspend = (adEvents ?? []).reduce((s, e) => s + Number(e.adspend || 0), 0)
  const heroCash = allBookings.reduce((s, b) => s + Number(b.cash_collected || 0), 0)
  const heroRevenue = allBookings.reduce((s, b) => s + Number(b.revenue || 0), 0)
  const heroRoas = heroAdspend > 0 ? heroRevenue / heroAdspend : 0

  // Adspend per day chart
  const spendByDay: Record<string, number> = {}
  allAdEvents.forEach(e => {
    spendByDay[e.event_date] = (spendByDay[e.event_date] ?? 0) + Number(e.adspend || 0)
  })
  const adspendDaily = Object.entries(spendByDay).map(([date, adspend]) => ({ date, adspend })).sort((a, b) => a.date.localeCompare(b.date))

  return {
    platforms: platforms ?? [],
    hero: { totalAdspend: heroAdspend, totalCash: heroCash, totalRevenue: heroRevenue, roas: heroRoas },
    metrics: {
      totalAdspend, totalLeads, costPerLead,
      selfSetRate, setterSetRate, blendedSetRate,
      totalCalls, qualifiedCalls, costPerCall, costPerQualifiedCall,
      qualifiedCallRate: totalCalls > 0 ? qualifiedCalls / totalCalls : 0,
      firstCallsBooked: firstCalls.length,
      firstCallShows: firstCallShows.length,
      firstCallShowRate,
      firstCallNoShowRate: 1 - firstCallShowRate,
      closedFirst: closedFirst.length,
      closeRateFirst,
      cashFirst, revenueFirst,
      secondCallsBooked: secondCalls.length,
      secondCallSetRate,
      secondCallShowRate,
      secondCallNoShowRate: 1 - secondCallShowRate,
      closedSecond: closedSecond.length,
      closeRateSecond,
      cashSecond, revenueSecond,
      totalClosed, blendedCloseRate,
      totalRevenue, totalCash,
      revPerCall, cac, avgTicket,
      leadsForClose, leadConversionRate,
      offerRate,
    },
    charts: { adspendDaily },
  }
}
