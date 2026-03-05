import { createServiceClient } from '@/lib/supabase/server'

export async function getOutboundDashboardData(startDate: string, endDate: string, channelId?: string) {
  const supabase = createServiceClient()

  const channelFilter = channelId && channelId !== 'all' ? channelId : null

  const [
    { data: channels },
    { data: dialEvents },
    { data: overheadEntries },
    { data: bookings },
    { data: leads },
  ] = await Promise.all([
    supabase.from('outbound_channels').select('id, name, slug').eq('is_active', true),

    supabase
      .from('outbound_dial_events')
      .select('dials_made, connects, event_date, channel_id')
      .gte('event_date', startDate)
      .lte('event_date', endDate),

    supabase
      .from('outbound_overhead')
      .select('overhead_amount, month_year, channel_id')
      .gte('month_year', startDate)
      .lte('month_year', endDate),

    supabase
      .from('bookings')
      .select('id, outcome, showed, call_number, cash_collected, revenue, booked_at, offer_made, lead_id, leads!inner(source_type, channel_id, created_at)')
      .gte('booked_at', startDate)
      .lte('booked_at', endDate)
      .eq('leads.source_type', 'outbound'),

    supabase
      .from('leads')
      .select('id, channel_id, created_at')
      .eq('source_type', 'outbound')
      .gte('created_at', startDate)
      .lte('created_at', endDate),
  ])

  // Apply channel filter
  const dials = channelFilter
    ? (dialEvents ?? []).filter(e => e.channel_id === channelFilter)
    : (dialEvents ?? [])

  const overhead = channelFilter
    ? (overheadEntries ?? []).filter(e => e.channel_id === channelFilter)
    : (overheadEntries ?? [])

  const allBookings = channelFilter
    ? (bookings ?? []).filter(b => (b.leads as unknown as { channel_id: string })?.channel_id === channelFilter)
    : (bookings ?? [])

  const allLeads = channelFilter
    ? (leads ?? []).filter(l => l.channel_id === channelFilter)
    : (leads ?? [])

  // Dials
  const totalDials = dials.reduce((s, e) => s + Number(e.dials_made || 0), 0)
  const totalConnects = dials.reduce((s, e) => s + Number(e.connects || 0), 0)
  const connectRate = totalDials > 0 ? totalConnects / totalDials : 0

  // Overhead
  const totalOverhead = overhead.reduce((s, e) => s + Number(e.overhead_amount || 0), 0)

  // Leads
  const totalLeads = allLeads.length

  // Bookings
  const totalCalls = allBookings.length
  const firstCalls = allBookings.filter(b => b.call_number === 1)
  const shows = allBookings.filter(b => b.showed === true)
  const noShows = allBookings.filter(b => b.showed === false)
  const showRate = totalCalls > 0 ? shows.length / totalCalls : 0
  const bookingRate = totalLeads > 0 ? totalCalls / totalLeads : 0

  // Closes
  const closes = allBookings.filter(b => b.outcome === 'full_pay' || b.outcome === 'split_pay')
  const followUpCloses = allBookings.filter(b => (b.call_number ?? 0) >= 3 && (b.outcome === 'full_pay' || b.outcome === 'split_pay'))
  const totalRevenue = closes.reduce((s, b) => s + Number(b.revenue || 0), 0)
  const totalCash = closes.reduce((s, b) => s + Number(b.cash_collected || 0), 0)

  // Rates
  const dialsToLead = totalLeads > 0 ? totalDials / totalLeads : 0
  const dialsToMeeting = totalCalls > 0 ? totalDials / totalCalls : 0
  const dialsToDeal = closes.length > 0 ? totalDials / closes.length : 0
  const offerRate = shows.length > 0 ? allBookings.filter(b => b.offer_made).length / shows.length : 0
  const costPerDeal = closes.length > 0 ? totalOverhead / closes.length : 0
  const avgDealSize = closes.length > 0 ? totalRevenue / closes.length : 0
  const revPerCall = totalCalls > 0 ? totalRevenue / totalCalls : 0
  const followUpCloseRate = shows.length > 0 ? followUpCloses.length / shows.length : 0

  // Channel breakdown for source cards
  const channelBreakdown = (channels ?? []).map(ch => {
    const chLeads = (leads ?? []).filter(l => l.channel_id === ch.id).length
    return { id: ch.id, name: ch.name, slug: ch.slug, leads: chLeads }
  })
  const totalAllLeads = channelBreakdown.reduce((s, c) => s + c.leads, 0)

  // Dials per day chart
  const dialsByDay: Record<string, number> = {}
  dials.forEach(e => {
    dialsByDay[e.event_date] = (dialsByDay[e.event_date] ?? 0) + Number(e.dials_made || 0)
  })
  const dialsDaily = Object.entries(dialsByDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))

  return {
    channels: channels ?? [],
    channelBreakdown,
    totalAllLeads,
    metrics: {
      totalLeads,
      totalDials,
      totalConnects,
      connectRate,
      totalCalls,
      qualifiedCalls: shows.length,
      bookingRate,
      dialsToLead,
      dialsToMeeting,
      dialsToDeal,
      showRate,
      noShowRate: 1 - showRate,
      closes: closes.length,
      offerRate,
      totalCash,
      totalRevenue,
      revPerCall,
      costPerOutboundDeal: costPerDeal,
      avgDealSize,
      followUpCloseRate,
    },
    charts: { dialsDaily },
  }
}