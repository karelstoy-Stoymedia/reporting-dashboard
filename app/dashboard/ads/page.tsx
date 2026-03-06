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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h3 className="text-white font-semibold mb-2 text-sm uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  )
}

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
  const COLORS = ['#6366f1', '#22d3ee']
  const closesSplit = [
    { name: 'First Call', value: m.closedFirst ?? 0 },
    { name: 'Second Call', value: m.closedSecond ?? 0 },
  ]

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Ads Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Paid advertising performance</p>
        </div>
        <DateRangePicker />
      </div>

      {/* Hero Section - always all platforms */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Total Adspend</p>
          <p className="text-white text-3xl font-bold">{fmt(data?.hero.totalAdspend)}</p>
          <p className="text-slate-500 text-xs mt-1">All platforms</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Cash / Revenue</p>
          <p className="text-white text-3xl font-bold">{fmt(data?.hero.totalCash)} <span className="text-slate-500 text-xl">/</span> {fmt(data?.hero.totalRevenue)}</p>
          <p className="text-slate-500 text-xs mt-1">Collected / Total</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">ROAS</p>
          <p className="text-white text-3xl font-bold">{num(data?.hero.roas)}x</p>
          <p className="text-slate-500 text-xs mt-1">Revenue / Adspend</p>
        </div>
      </div>

      {/* Platform Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setPlatform('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${platformId === 'all' ? 'bg-red-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}
        >
          All Platforms
        </button>
        {data?.platforms.map(p => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${platformId === p.id ? 'bg-red-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Metrics Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array(9).fill(0).map((_, i) => <div key={i} className="h-48 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Spend & Leads">
            <MetricRow label="Adspend" value={fmt(m.totalAdspend)} />
            <MetricRow label="Leads" value={String(m.totalLeads ?? 0)} />
            <MetricRow label="Cost Per Lead" value={fmt(m.costPerLead)} />
            <MetricRow label="Self Set Rate" value={pct(m.selfSetRate)} />
            <MetricRow label="Setter Set Rate" value={pct(m.setterSetRate)} />
            <MetricRow label="Blended Set Rate" value={pct(m.blendedSetRate)} />
          </Section>

          <Section title="Calls & Quality">
            <MetricRow label="Total Calls" value={String(m.totalCalls ?? 0)} />
            <MetricRow label="Qualified Calls" value={String(m.qualifiedCalls ?? 0)} />
            <MetricRow label="Qualified Call Rate" value={pct(m.qualifiedCallRate)} />
            <MetricRow label="Cost Per Call" value={fmt(m.costPerCall)} />
            <MetricRow label="Cost Per Qualified Call" value={fmt(m.costPerQualifiedCall)} />
            <MetricRow label="Offer Rate" value={pct(m.offerRate)} />
          </Section>

          <Section title="First Call">
            <MetricRow label="First Calls Booked" value={String(m.firstCallsBooked ?? 0)} />
            <MetricRow label="First Call Shows" value={String(m.firstCallShows ?? 0)} />
            <MetricRow label="Show Rate" value={pct(m.firstCallShowRate)} />
            <MetricRow label="No Show Rate" value={pct(m.firstCallNoShowRate)} />
            <MetricRow label="Closes" value={String(m.closedFirst ?? 0)} />
            <MetricRow label="Close Rate" value={pct(m.closeRateFirst)} />
            <MetricRow label="Cash Collected" value={fmt(m.cashFirst)} />
            <MetricRow label="Revenue" value={fmt(m.revenueFirst)} />
          </Section>

          <Section title="Second Call">
            <MetricRow label="Second Calls Booked" value={String(m.secondCallsBooked ?? 0)} />
            <MetricRow label="Second Call Set Rate" value={pct(m.secondCallSetRate)} />
            <MetricRow label="Show Rate" value={pct(m.secondCallShowRate)} />
            <MetricRow label="No Show Rate" value={pct(m.secondCallNoShowRate)} />
            <MetricRow label="Closes" value={String(m.closedSecond ?? 0)} />
            <MetricRow label="Close Rate" value={pct(m.closeRateSecond)} />
            <MetricRow label="Cash Collected" value={fmt(m.cashSecond)} />
            <MetricRow label="Revenue" value={fmt(m.revenueSecond)} />
          </Section>

          <Section title="Overall Performance">
            <MetricRow label="Total Closed Deals" value={String(m.totalClosed ?? 0)} />
            <MetricRow label="Blended Close Rate" value={pct(m.blendedCloseRate)} />
            <MetricRow label="Total Revenue" value={fmt(m.totalRevenue)} />
            <MetricRow label="Total Cash" value={fmt(m.totalCash)} />
            <MetricRow label="Rev Per Call" value={fmt(m.revPerCall)} />
            <MetricRow label="CAC" value={fmt(m.cac)} />
            <MetricRow label="Avg Ticket" value={fmt(m.avgTicket)} />
            <MetricRow label="Leads For Close" value={num(m.leadsForClose)} />
            <MetricRow label="Lead Conversion Rate" value={pct(m.leadConversionRate)} />
          </Section>

          {/* First vs Second Call Close Split */}
          <Section title="Close Split">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={closesSplit} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {closesSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Section>
        </div>
      )}

      {/* Adspend Daily Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4">Adspend Per Day</h3>
        {loading ? (
          <div className="h-48 animate-pulse bg-slate-700 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.charts.adspendDaily ?? []}>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="adspend" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default function AdsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
      <AdsContent />
    </Suspense>
  )
}

