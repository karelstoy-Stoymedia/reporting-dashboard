import { createServiceClient } from '@/lib/supabase/server'

export async function getRepsDashboardData(startDate: string, endDate: string, repId?: string) {
  const supabase = createServiceClient()

  const [
    { data: reps },
    { data: bookings },
    { data: leads },
  ] = await Promise.all([
    supabase
      .from('sales_reps')
      .select('id, name, email, is_active')
      .order('name', { ascending: true }),

    supabase
      .from('bookings')
      .select(`
        id, lead_id, rep_id, call_number, booked_at, scheduled_at,
        showed, offer_made, outcome, cash_collected, revenue,
        recording_url, notes, call_duration_seconds, is_qualified,
        is_self_set, created_at, updated_at
      `)
      .gte('booked_at', startDate)
      .lte('booked_at', endDate + 'T23:59:59Z')
      .order('booked_at', { ascending: false }),

    supabase
      .from('leads')
      .select('id, full_name, phone, source_type, platform_id, channel_id, external_ref'),
  ])

  const allBookings = bookings ?? []
  const allLeads = leads ?? []
  const allReps = reps ?? []

  // Build lead lookup map
  const leadMap = new Map(allLeads.map(l => [l.id, l]))

  // Full booking log — all bookings with lead + rep info attached
  const bookingLog = allBookings.map(b => {
    const lead = leadMap.get(b.lead_id)
    const rep = allReps.find(r => r.id === b.rep_id)
    return {
      ...b,
      leadName: lead?.full_name ?? '—',
      leadPhone: lead?.phone ?? '—',
      sourceType: lead?.source_type ?? '—',
      repName: rep?.name ?? '—',
    }
  })

  // Per-rep metrics
  const repMetrics = allReps.map(rep => {
    const repBookings = allBookings.filter(b => b.rep_id === rep.id)

    const totalBookings = repBookings.length
    const shows = repBookings.filter(b => b.showed === true)
    const noShows = repBookings.filter(b => b.showed === false)
    const closes = repBookings.filter(b => b.outcome === 'full_pay' || b.outcome === 'split_pay')
    const offersMade = repBookings.filter(b => b.offer_made === true && b.showed === true)
    const disqualified = repBookings.filter(b => b.outcome === 'unqualified')
    const reschedules = repBookings.filter(b => b.outcome === 'scheduled_again')
    const selfSets = repBookings.filter(b => b.is_self_set === true)

    const showRate = totalBookings > 0 ? shows.length / totalBookings : 0
    const closeRate = shows.length > 0 ? closes.length / shows.length : 0
    const offerRate = shows.length > 0 ? offersMade.length / shows.length : 0
    const disqualRate = shows.length > 0 ? disqualified.length / shows.length : 0
    const selfSetRate = totalBookings > 0 ? selfSets.length / totalBookings : 0

    const cashCollected = closes.reduce((s, b) => s + Number(b.cash_collected || 0), 0)
    const revenueGenerated = closes.reduce((s, b) => s + Number(b.revenue || 0), 0)
    const revPerCall = totalBookings > 0 ? revenueGenerated / totalBookings : 0
    const avgDealSize = closes.length > 0 ? revenueGenerated / closes.length : 0

    const callsWithDuration = repBookings.filter(b => b.call_duration_seconds && b.call_duration_seconds > 0)
    const avgTimeOnCallSeconds = callsWithDuration.length > 0
      ? callsWithDuration.reduce((s, b) => s + Number(b.call_duration_seconds || 0), 0) / callsWithDuration.length
      : 0

    return {
      id: rep.id,
      name: rep.name,
      email: rep.email,
      isActive: rep.is_active,
      totalBookings,
      shows: shows.length,
      noShows: noShows.length,
      closes: closes.length,
      reschedules: reschedules.length,
      showRate,
      closeRate,
      offerRate,
      disqualRate,
      selfSetRate,
      cashCollected,
      revenueGenerated,
      revPerCall,
      avgDealSize,
      avgTimeOnCallMinutes: avgTimeOnCallSeconds / 60,
    }
  })

  const activeReps = repMetrics.filter(r => r.isActive)
  const inactiveReps = repMetrics.filter(r => !r.isActive)

  // Blended metrics across all active reps
  const totalBookings = activeReps.reduce((s, r) => s + r.totalBookings, 0)
  const totalShows = activeReps.reduce((s, r) => s + r.shows, 0)
  const totalCloses = activeReps.reduce((s, r) => s + r.closes, 0)
  const totalCash = activeReps.reduce((s, r) => s + r.cashCollected, 0)
  const totalRevenue = activeReps.reduce((s, r) => s + r.revenueGenerated, 0)

  return {
    reps: activeReps,
    inactiveReps,
    bookingLog,
    summary: {
      totalBookings,
      totalShows,
      totalCloses,
      totalCash,
      totalRevenue,
      blendedShowRate: totalBookings > 0 ? totalShows / totalBookings : 0,
      blendedCloseRate: totalShows > 0 ? totalCloses / totalShows : 0,
    },
  }
}