'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Channel { id: string; name: string; slug: string }
interface OutboundData {
  channels: Channel[]
  channelBreakdown: { id: string; name: string; slug: string; leads: number }[]
  totalAllLeads: number
  metrics: Record<string, number>
  charts: { dialsDaily: { date: string; count: number }[] }
}

function fmt(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '$0'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}
function pct(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '0%'
  return `${(n * 100).toFixed(1)}%`
}
function num(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '0'
  return n.toFixed(1)
}

function MetricRow({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-sm font-medium ${money ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-gray-500 font-semibold mb-3 text-xs uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }

function OutboundContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<OutboundData | null>(null)
  const [loading, setLoading] = useState(true)

  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]
  const channelId = searchParams.get('channelId') ?? 'all'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/outbound?startDate=${startDate}&endDate=${endDate}&channelId=${channelId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [startDate, endDate, channelId])

  function setChannel(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('channelId', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  const m = data?.metrics ?? {}

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">Outbound Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Cold outbound channel performance</p>
        </div>
        <DateRangePicker />
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setChannel('all')}
          className={`p-4 rounded-xl border text-left transition-colors shadow-sm ${channelId === 'all' ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}
        >
          <p className="text-gray-500 text-xs mb-1">All Channels</p>
          <p className="text-gray-900 text-2xl font-bold">{data?.totalAllLeads ?? 0}</p>
          <p className="text-gray-400 text-xs mt-1">Total leads</p>
        </button>
        {data?.channelBreakdown.map(ch => (
          <button key={ch.id} onClick={() => setChannel(ch.id)}
            className={`p-4 rounded-xl border text-left transition-colors shadow-sm ${channelId === ch.id ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
            <p className="text-gray-500 text-xs mb-1">{ch.name}</p>
            <p className="text-gray-900 text-2xl font-bold">{ch.leads}</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full"
                style={{ width: data.totalAllLeads > 0 ? `${(ch.leads / data.totalAllLeads) * 100}%` : '0%' }} />
            </div>
          </button>
        ))}
      </div>

      {/* Metrics */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-48 bg-white rounded-xl animate-pulse border border-gray-200" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Dials & Activity">
            <MetricRow label="Total Outbound Leads" value={String(m.totalLeads ?? 0)} />
            <MetricRow label="Dials Made"           value={String(m.totalDials ?? 0)} />
            <MetricRow label="Connects"             value={String(m.totalConnects ?? 0)} />
            <MetricRow label="Connect Rate"         value={pct(m.connectRate)} />
            <MetricRow label="Dials To Lead"        value={num(m.dialsToLead)} />
            <MetricRow label="Dials To Meeting"     value={num(m.dialsToMeeting)} />
            <MetricRow label="Dials To Deal"        value={num(m.dialsToDeal)} />
          </Section>

          <Section title="Calls & Shows">
            <MetricRow label="Total Calls Booked" value={String(m.totalCalls ?? 0)} />
            <MetricRow label="Qualified Calls"    value={String(m.qualifiedCalls ?? 0)} />
            <MetricRow label="Booking Rate"       value={pct(m.bookingRate)} />
            <MetricRow label="Show Rate"          value={pct(m.showRate)} />
            <MetricRow label="No Show Rate"       value={pct(m.noShowRate)} />
            <MetricRow label="Offer Rate"         value={pct(m.offerRate)} />
          </Section>

          <Section title="Revenue & Closes">
            <MetricRow label="Closes"                  value={String(m.closes ?? 0)} />
            <MetricRow label="Cash Collected"          value={fmt(m.totalCash)}           money />
            <MetricRow label="Revenue"                 value={fmt(m.totalRevenue)}         money />
            <MetricRow label="Rev Per Call"            value={fmt(m.revPerCall)}           money />
            <MetricRow label="Cost Per Outbound Deal"  value={fmt(m.costPerOutboundDeal)} />
            <MetricRow label="Avg Deal Size"           value={fmt(m.avgDealSize)}          money />
            <MetricRow label="Follow-Up Close Rate"    value={pct(m.followUpCloseRate)} />
          </Section>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-4">Dials Per Day</h3>
        {loading ? (
          <div className="h-48 animate-pulse bg-gray-100 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.charts.dialsDaily ?? []}>
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#dc2626" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default function OutboundPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
      <OutboundContent />
    </Suspense>
  )
}