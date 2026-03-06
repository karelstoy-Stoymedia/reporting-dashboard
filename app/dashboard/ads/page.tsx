'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface Platform { id: string; name: string; slug: string }
interface AdsData {
  platforms: Platform[]
  hero: { totalAdspend: number; totalCash: number; totalRevenue: number; roas: number }
  metrics: Record<string, number>
  charts: { adspendDaily: { date: string; adspend: number }[] }
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

const COLORS = ['#dc2626', '#2563eb']
const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }

function AdsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<AdsData | null>(null)
  const [loading, setLoading] = useState(true)

  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]
  const platformId = searchParams.get('platformId') ?? 'all'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/ads?startDate=${startDate}&endDate=${endDate}&platformId=${platformId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [startDate, endDate, platformId])

  function setPlatform(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('platformId', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  const m = data?.metrics ?? {}
  const closesSplit = [
    { name: 'First Call',  value: m.closedFirst  ?? 0 },
    { name: 'Second Call', value: m.closedSecond ?? 0 },
  ]

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">Ads Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Paid advertising performance</p>
        </div>
        <DateRangePicker />
      </div>

      {/* Hero */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Total Adspend</p>
          <p className="text-gray-900 text-3xl font-bold">{fmt(data?.hero.totalAdspend)}</p>
          <p className="text-gray-400 text-xs mt-1">All platforms</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Cash / Revenue</p>
          <p className="text-emerald-600 text-3xl font-bold">{fmt(data?.hero.totalCash)} <span className="text-gray-300 text-xl">/</span> {fmt(data?.hero.totalRevenue)}</p>
          <p className="text-gray-400 text-xs mt-1">Collected / Total</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">ROAS</p>
          <p className="text-gray-900 text-3xl font-bold">{num(data?.hero.roas)}x</p>
          <p className="text-gray-400 text-xs mt-1">Revenue / Adspend</p>
        </div>
      </div>

      {/* Platform filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setPlatform('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${platformId === 'all' ? 'bg-red-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'}`}
        >
          All Platforms
        </button>
        {data?.platforms.map(p => (
          <button key={p.id} onClick={() => setPlatform(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${platformId === p.id ? 'bg-red-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'}`}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Metrics grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array(9).fill(0).map((_, i) => <div key={i} className="h-48 bg-white rounded-xl animate-pulse border border-gray-200" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Spend & Leads">
            <MetricRow label="Adspend"          value={fmt(m.totalAdspend)} />
            <MetricRow label="Leads"            value={String(m.totalLeads ?? 0)} />
            <MetricRow label="Cost Per Lead"    value={fmt(m.costPerLead)} />
            <MetricRow label="Self Set Rate"    value={pct(m.selfSetRate)} />
            <MetricRow label="Setter Set Rate"  value={pct(m.setterSetRate)} />
            <MetricRow label="Blended Set Rate" value={pct(m.blendedSetRate)} />
          </Section>

          <Section title="Calls & Quality">
            <MetricRow label="Total Calls"              value={String(m.totalCalls ?? 0)} />
            <MetricRow label="Qualified Calls"          value={String(m.qualifiedCalls ?? 0)} />
            <MetricRow label="Qualified Call Rate"      value={pct(m.qualifiedCallRate)} />
            <MetricRow label="Cost Per Call"            value={fmt(m.costPerCall)} />
            <MetricRow label="Cost Per Qualified Call"  value={fmt(m.costPerQualifiedCall)} />
            <MetricRow label="Offer Rate"               value={pct(m.offerRate)} />
          </Section>

          <Section title="First Call">
            <MetricRow label="First Calls Booked" value={String(m.firstCallsBooked ?? 0)} />
            <MetricRow label="First Call Shows"   value={String(m.firstCallShows ?? 0)} />
            <MetricRow label="Show Rate"          value={pct(m.firstCallShowRate)} />
            <MetricRow label="No Show Rate"       value={pct(m.firstCallNoShowRate)} />
            <MetricRow label="Closes"             value={String(m.closedFirst ?? 0)} />
            <MetricRow label="Close Rate"         value={pct(m.closeRateFirst)} />
            <MetricRow label="Cash Collected"     value={fmt(m.cashFirst)}    money />
            <MetricRow label="Revenue"            value={fmt(m.revenueFirst)} money />
          </Section>

          <Section title="Second Call">
            <MetricRow label="Second Calls Booked"  value={String(m.secondCallsBooked ?? 0)} />
            <MetricRow label="Second Call Set Rate"  value={pct(m.secondCallSetRate)} />
            <MetricRow label="Show Rate"             value={pct(m.secondCallShowRate)} />
            <MetricRow label="No Show Rate"          value={pct(m.secondCallNoShowRate)} />
            <MetricRow label="Closes"                value={String(m.closedSecond ?? 0)} />
            <MetricRow label="Close Rate"            value={pct(m.closeRateSecond)} />
            <MetricRow label="Cash Collected"        value={fmt(m.cashSecond)}    money />
            <MetricRow label="Revenue"               value={fmt(m.revenueSecond)} money />
          </Section>

          <Section title="Overall Performance">
            <MetricRow label="Total Closed Deals"    value={String(m.totalClosed ?? 0)} />
            <MetricRow label="Blended Close Rate"    value={pct(m.blendedCloseRate)} />
            <MetricRow label="Total Revenue"         value={fmt(m.totalRevenue)} money />
            <MetricRow label="Total Cash"            value={fmt(m.totalCash)}    money />
            <MetricRow label="Rev Per Call"          value={fmt(m.revPerCall)}   money />
            <MetricRow label="CAC"                   value={fmt(m.cac)} />
            <MetricRow label="Avg Ticket"            value={fmt(m.avgTicket)} />
            <MetricRow label="Leads For Close"       value={num(m.leadsForClose)} />
            <MetricRow label="Lead Conversion Rate"  value={pct(m.leadConversionRate)} />
          </Section>

          <Section title="Close Split">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={closesSplit} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {closesSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </Section>
        </div>
      )}

      {/* Adspend chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-4">Adspend Per Day</h3>
        {loading ? (
          <div className="h-48 animate-pulse bg-gray-100 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.charts.adspendDaily ?? []}>
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="adspend" fill="#dc2626" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default function AdsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
      <AdsContent />
    </Suspense>
  )
}