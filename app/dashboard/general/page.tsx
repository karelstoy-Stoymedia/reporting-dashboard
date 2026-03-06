'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DashboardData {
  kpis: {
    newCustomers: number
    totalRevenue: number
    totalCashCollected: number
    totalAdspend: number
    grossProfit: number
    totalLeadsDelivered: number
  }
  leaderboard: { rank: number; name: string; revenue: number; closes: number; closeRate: string }[]
  revenueBySource: { ads: number; outbound: number }
  newCustomersList: { id: string; starts_at: string }[]
}

const COLORS = ['#dc2626', '#2563eb']

function fmt(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '$0'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function KpiCard({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${money ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function SkeletonCard() {
  return <div className="bg-white border border-gray-200 rounded-xl p-5 h-24 animate-pulse" />
}

function GeneralContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/general?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [startDate, endDate])

  const dailyMap: Record<string, number> = {}
  data?.newCustomersList?.forEach((c) => {
    const d = c.starts_at?.split('T')[0] ?? ''
    if (d) dailyMap[d] = (dailyMap[d] ?? 0) + 1
  })
  const customersGainedDaily = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const revenueBySource = [
    { name: 'Ads', value: data?.revenueBySource?.ads ?? 0 },
    { name: 'Outbound', value: data?.revenueBySource?.outbound ?? 0 },
  ]

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">General Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Business overview</p>
        </div>
        <DateRangePicker />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)
        ) : data ? (
          <>
            <KpiCard label="New Customers"   value={String(data.kpis.newCustomers ?? 0)} />
            <KpiCard label="Revenue"          value={fmt(data.kpis.totalRevenue)}          money />
            <KpiCard label="Cash Collected"   value={fmt(data.kpis.totalCashCollected)}    money />
            <KpiCard label="Gross Profit"     value={fmt(data.kpis.grossProfit)}            money />
            <KpiCard label="Leads Delivered"  value={String(data.kpis.totalLeadsDelivered ?? 0)} />
            <KpiCard label="Total Adspend"    value={fmt(data.kpis.totalAdspend)} />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-gray-900 font-semibold mb-4">Customers Gained Daily</h3>
          {loading ? (
            <div className="h-48 animate-pulse bg-gray-100 rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={customersGainedDaily}>
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }} />
                <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-gray-900 font-semibold mb-4">Revenue by Source</h3>
          {loading ? (
            <div className="h-48 animate-pulse bg-gray-100 rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={revenueBySource}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {revenueBySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(v) => fmt(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-4">Sales Rep Leaderboard</h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['#', 'Rep', 'Revenue', 'Closes', 'Close Rate'].map(h => (
                    <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-6 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!data?.leaderboard || data.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">No data for this date range</td>
                  </tr>
                ) : (
                  data.leaderboard.map((rep, i) => (
                    <tr key={rep.name}>
                      <td className="py-3 pr-6 text-gray-400 font-bold text-xs">{i + 1}</td>
                      <td className="py-3 pr-6 text-gray-900 font-medium">{rep.name}</td>
                      <td className="py-3 pr-6 text-emerald-600 font-medium">{fmt(rep.revenue)}</td>
                      <td className="py-3 pr-6 text-gray-900">{rep.closes}</td>
                      <td className="py-3 text-gray-500">{rep.closeRate}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GeneralPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
      <GeneralContent />
    </Suspense>
  )
}