'use client'

import { useEffect, useState, useCallback } from 'react'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { useSearchParams } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

interface ServiceMetric {
  id: string
  name: string
  slug: string
  leadsSold: number
  leadsReturned: number
  returnRate: number
  revenue: number
  cost: number
  profit: number
  grossMargin: number
  avgLeadPrice: number
}

interface DailyData {
  date: string
  sold: number
  returned: number
  revenue: number
  cost: number
}

interface Service {
  id: string
  name: string
  slug: string
}

interface DashboardData {
  services: Service[]
  serviceMetrics: ServiceMetric[]
  blended: ServiceMetric
  dailyData: DailyData[]
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

function returnRateColor(rate: number) {
  if (rate < 0.10) return 'text-emerald-400'
  if (rate < 0.20) return 'text-amber-400'
  return 'text-red-400'
}

function returnRateBg(rate: number) {
  if (rate < 0.10) return 'bg-emerald-900/40 text-emerald-400'
  if (rate < 0.20) return 'bg-amber-900/40 text-amber-400'
  return 'bg-red-900/40 text-red-400'
}

function MetricCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-indigo-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function FulfilmentPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all')

  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ startDate, endDate })
    const res = await fetch(`/api/dashboard/fulfilment?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const metrics: ServiceMetric | null = selectedServiceId === 'all'
    ? (data?.blended ?? null)
    : (data?.serviceMetrics.find(m => m.id === selectedServiceId) ?? null)

  // Filter daily data by selected service
  const chartData = data?.dailyData ?? []

  const formatDate = (d: unknown) => {
    const date = new Date(d as string)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4">
        <div>
          <h1 className="text-white text-2xl font-bold">Fulfilment</h1>
          <p className="text-slate-400 text-sm mt-1">Pay-per-lead delivery metrics by service</p>
        </div>
        <DateRangePicker />
      </div>

      <div className="flex-1 px-8 pb-8 flex flex-col gap-6 min-h-0 overflow-y-auto">
        {/* Service selector tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedServiceId('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedServiceId === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'}`}
          >
            All Services
          </button>
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-9 w-28 bg-slate-900 rounded-lg animate-pulse" />)
          ) : (
            (data?.services ?? []).map(service => (
              <button
                key={service.id}
                onClick={() => setSelectedServiceId(service.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedServiceId === service.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'}`}
              >
                {service.name}
              </button>
            ))
          )}
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-24 bg-slate-900 rounded-xl animate-pulse" />)}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Leads Sold" value={metrics.leadsSold.toString()} />
            <MetricCard label="Leads Returned" value={metrics.leadsReturned.toString()} sub={`${pct(metrics.returnRate)} return rate`} />
            <MetricCard
              label="Return Rate"
              value={pct(metrics.returnRate)}
              highlight={false}
            />
            <MetricCard label="Avg Lead Price" value={fmt(metrics.avgLeadPrice)} />
            <MetricCard label="Revenue (Net)" value={fmt(metrics.revenue)} highlight />
            <MetricCard label="Cost" value={fmt(metrics.cost)} />
            <MetricCard label="Profit" value={fmt(metrics.profit)} highlight={metrics.profit > 0} />
            <MetricCard
              label="Gross Margin"
              value={pct(metrics.grossMargin)}
              sub={metrics.profit > 0 ? 'Profitable' : 'Below breakeven'}
            />
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            No data for this date range
          </div>
        )}

        {/* Return rate badge for selected service */}
        {!loading && metrics && metrics.id !== 'all' && (
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">Return Rate Status:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${returnRateBg(metrics.returnRate)}`}>
              {metrics.returnRate < 0.10 ? '✓ Healthy (< 10%)' : metrics.returnRate < 0.20 ? '⚠ Watch (10–20%)' : '✗ High (> 20%)'}
            </span>
          </div>
        )}

        {/* Service breakdown table — only shown on All Services view */}
        {!loading && selectedServiceId === 'all' && (data?.serviceMetrics ?? []).some(m => m.leadsSold > 0) && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-white font-medium text-sm">Breakdown by Service</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Service', 'Leads Sold', 'Returned', 'Return Rate', 'Revenue', 'Cost', 'Profit', 'Margin', 'Avg Price'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.serviceMetrics ?? [])
                    .filter(m => m.leadsSold > 0)
                    .sort((a, b) => b.revenue - a.revenue)
                    .map(m => (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedServiceId(m.id)}
                        className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                        <td className="px-4 py-3 text-slate-300">{m.leadsSold}</td>
                        <td className="px-4 py-3 text-slate-300">{m.leadsReturned}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${returnRateBg(m.returnRate)}`}>
                            {pct(m.returnRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{fmt(m.revenue)}</td>
                        <td className="px-4 py-3 text-slate-300">{fmt(m.cost)}</td>
                        <td className={`px-4 py-3 font-medium ${m.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(m.profit)}</td>
                        <td className={`px-4 py-3 ${returnRateColor(1 - m.grossMargin)}`}>{pct(m.grossMargin)}</td>
                        <td className="px-4 py-3 text-slate-300">{fmt(m.avgLeadPrice)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Charts */}
        {!loading && chartData.length > 0 && (
          <div className="grid grid-cols-2 gap-6">
            {/* Leads Sold vs Returned per day */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-white font-medium text-sm mb-4">Leads Sold vs Returned — Daily</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    labelFormatter={(l) => formatDate(l)}
                  />
                  <Bar dataKey="sold" name="Sold" fill="#6366f1" radius={[2,2,0,0]} />
                  <Bar dataKey="returned" name="Returned" fill="#ef4444" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue vs Cost per day */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-white font-medium text-sm mb-4">Revenue vs Cost — Daily</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    labelFormatter={(l) => formatDate(l)}
                    formatter={(v: unknown) => fmt(Number(v))}
                  />
                  <Line dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line dataKey="cost" name="Cost" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Empty chart state */}
        {!loading && chartData.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            No lead events in this date range
          </div>
        )}
      </div>
    </div>
  )
}