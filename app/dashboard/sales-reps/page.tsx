'use client'

import { useEffect, useState, useCallback } from 'react'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { useSearchParams } from 'next/navigation'

interface RepMetric {
  id: string; name: string; email: string | null; isActive: boolean
  totalBookings: number; shows: number; noShows: number; closes: number
  reschedules: number; showRate: number; closeRate: number; offerRate: number
  disqualRate: number; selfSetRate: number; cashCollected: number
  revenueGenerated: number; revPerCall: number; avgDealSize: number
  avgTimeOnCallMinutes: number
}
interface BookingLogEntry {
  id: string; leadName: string; leadPhone: string; sourceType: string
  repName: string; outcome: string | null; cash_collected: number | null
  revenue: number | null; booked_at: string; call_number: number
  showed: boolean | null; notes: string | null; recording_url: string | null
  is_self_set: boolean | null
}
interface DashboardData {
  reps: RepMetric[]; inactiveReps: RepMetric[]; bookingLog: BookingLogEntry[]
  summary: { totalBookings: number; totalShows: number; totalCloses: number; totalCash: number; totalRevenue: number; blendedShowRate: number; blendedCloseRate: number }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function pct(n: number) { return (n * 100).toFixed(1) + '%' }

function outcomeBadge(outcome: string | null, showed: boolean | null) {
  if (!outcome && showed === false) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">No Show</span>
  if (!outcome) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">—</span>
  const map: Record<string, string> = {
    full_pay:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
    split_pay:       'bg-teal-50 text-teal-700 border border-teal-200',
    scheduled_again: 'bg-blue-50 text-blue-700 border border-blue-200',
    follow_up:       'bg-amber-50 text-amber-700 border border-amber-200',
    unqualified:     'bg-red-50 text-red-600 border border-red-200',
    no_show:         'bg-gray-100 text-gray-500',
  }
  const labels: Record<string, string> = {
    full_pay: 'Full Pay', split_pay: 'Split Pay', scheduled_again: 'Rescheduled',
    follow_up: 'Follow Up', unqualified: 'Unqualified', no_show: 'No Show',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[outcome] ?? 'bg-gray-100 text-gray-500'}`}>{labels[outcome] ?? outcome}</span>
}

function MetricRow({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-sm font-medium ${money ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

export default function SalesRepsPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRepId, setSelectedRepId] = useState<string | 'all'>('all')
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)

  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/dashboard/reps?${new URLSearchParams({ startDate, endDate })}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const selectedRep = selectedRepId === 'all' ? null : data?.reps.find(r => r.id === selectedRepId) ?? null
  const metrics: RepMetric | null = selectedRep ?? (data ? {
    id: 'all', name: 'All Reps', email: null, isActive: true,
    totalBookings: data.summary.totalBookings, shows: data.summary.totalShows,
    noShows: data.summary.totalBookings - data.summary.totalShows,
    closes: data.summary.totalCloses, reschedules: 0,
    showRate: data.summary.blendedShowRate, closeRate: data.summary.blendedCloseRate,
    offerRate: 0, disqualRate: 0, selfSetRate: 0,
    cashCollected: data.summary.totalCash, revenueGenerated: data.summary.totalRevenue,
    revPerCall: data.summary.totalBookings > 0 ? data.summary.totalRevenue / data.summary.totalBookings : 0,
    avgDealSize: data.summary.totalCloses > 0 ? data.summary.totalRevenue / data.summary.totalCloses : 0,
    avgTimeOnCallMinutes: 0,
  } : null)

  const filteredLog = selectedRepId === 'all'
    ? (data?.bookingLog ?? [])
    : (data?.bookingLog ?? []).filter(b => b.repName === (data?.reps.find(r => r.id === selectedRepId)?.name))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 pt-8 pb-4">
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">Sales Reps</h1>
          <p className="text-gray-500 text-sm mt-1">Rep performance and live booking log</p>
        </div>
        <DateRangePicker />
      </div>

      <div className="flex flex-1 min-h-0 px-8 pb-8 gap-6">
        {/* Rep Selector */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Reps</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => setSelectedRepId('all')}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedRepId === 'all' ? 'bg-red-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                All Reps
              </button>
              {loading ? [1,2,3].map(i => <div key={i} className="mx-4 my-2 h-6 bg-gray-100 rounded animate-pulse" />) : (
                (data?.reps ?? []).map(rep => (
                  <button
                    key={rep.id}
                    onClick={() => setSelectedRepId(rep.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedRepId === rep.id ? 'bg-red-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {rep.name}
                  </button>
                ))
              )}
              {(data?.inactiveReps ?? []).length > 0 && (
                <>
                  <div className="px-4 py-2 border-t border-gray-100 mt-1">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Inactive</p>
                  </div>
                  {data!.inactiveReps.map(rep => (
                    <button key={rep.id} onClick={() => setSelectedRepId(rep.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 transition-colors ${selectedRepId === rep.id ? 'bg-gray-100' : ''}`}>
                      {rep.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {loading ? (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-gray-200" />)}
            </div>
          ) : metrics ? (
            <>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Bookings',       value: metrics.totalBookings.toString() },
                  { label: 'Shows',          value: `${metrics.shows} (${pct(metrics.showRate)})` },
                  { label: 'Closes',         value: `${metrics.closes} (${pct(metrics.closeRate)})` },
                  { label: 'Revenue',        value: fmt(metrics.revenueGenerated), money: true },
                  { label: 'Cash Collected', value: fmt(metrics.cashCollected),    money: true },
                  { label: 'Rev / Call',     value: fmt(metrics.revPerCall),       money: true },
                  { label: 'Avg Deal Size',  value: fmt(metrics.avgDealSize),      money: true },
                  { label: 'No Shows',       value: metrics.noShows.toString() },
                ].map(card => (
                  <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">{card.label}</p>
                    <p className={`text-2xl font-bold ${(card as { money?: boolean }).money ? 'text-emerald-600' : 'text-gray-900'}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-gray-900 font-medium text-sm mb-3">Detailed Metrics</p>
                <div className="grid grid-cols-2 gap-x-12">
                  <div>
                    <MetricRow label="Offer Rate"             value={pct(metrics.offerRate)} />
                    <MetricRow label="Disqualification Rate"  value={pct(metrics.disqualRate)} />
                    <MetricRow label="Self-Set Rate"          value={pct(metrics.selfSetRate)} />
                    <MetricRow label="Reschedules"            value={metrics.reschedules.toString()} />
                  </div>
                  <div>
                    <MetricRow label="Avg Time On Call" value={metrics.avgTimeOnCallMinutes > 0 ? metrics.avgTimeOnCallMinutes.toFixed(1) + ' min' : '—'} />
                    <MetricRow label="Close Rate"       value={pct(metrics.closeRate)} />
                    <MetricRow label="Show Rate"        value={pct(metrics.showRate)} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">No data for this date range</div>
          )}

          {/* Booking Log */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-gray-900 font-medium text-sm">Live Booking Log</p>
              <p className="text-gray-400 text-xs">{filteredLog.length} bookings in range</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Date','Name','Phone','Source','Rep','Call #','Outcome','Cash','Revenue'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3,4,5].map(i => (
                      <tr key={i} className="border-b border-gray-100">
                        {[1,2,3,4,5,6,7,8,9].map(j => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-16" /></td>)}
                      </tr>
                    ))
                  ) : filteredLog.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No bookings in this date range</td></tr>
                  ) : (
                    filteredLog.map(b => (
                      <>
                        <tr
                          key={b.id}
                          onClick={() => setExpandedBooking(expandedBooking === b.id ? null : b.id)}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(b.booked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{b.leadName}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{b.leadPhone}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.sourceType === 'ad' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                              {b.sourceType === 'ad' ? 'Ad' : 'Outbound'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{b.repName}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs text-center">{b.call_number}</td>
                          <td className="px-4 py-3">{outcomeBadge(b.outcome, b.showed)}</td>
                          <td className="px-4 py-3 text-emerald-600 text-xs font-medium whitespace-nowrap">
                            {b.cash_collected ? fmt(Number(b.cash_collected)) : '—'}
                          </td>
                          <td className="px-4 py-3 text-emerald-600 text-xs font-medium whitespace-nowrap">
                            {b.revenue ? fmt(Number(b.revenue)) : '—'}
                          </td>
                        </tr>
                        {expandedBooking === b.id && (
                          <tr key={b.id + '-exp'} className="border-b border-gray-100 bg-gray-50">
                            <td colSpan={9} className="px-6 py-3">
                              <div className="flex items-start gap-8 text-sm">
                                {b.notes && <div><p className="text-gray-400 text-xs mb-1">Notes</p><p className="text-gray-700">{b.notes}</p></div>}
                                {b.recording_url && (
                                  <div>
                                    <p className="text-gray-400 text-xs mb-1">Recording</p>
                                    <a href={b.recording_url} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 underline text-xs">Watch Recording →</a>
                                  </div>
                                )}
                                {b.is_self_set !== null && <div><p className="text-gray-400 text-xs mb-1">Set By</p><p className="text-gray-700">{b.is_self_set ? 'Self-Set' : 'Setter'}</p></div>}
                                {!b.notes && !b.recording_url && <p className="text-gray-400 text-xs">No additional details</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}