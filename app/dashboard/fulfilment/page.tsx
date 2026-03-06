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

interface Order {
  id: string
  lead_quota: number
  price_per_lead: number
  starts_at: string
  ends_at: string
  status: string
  is_renewal: boolean
  leads_delivered: number
  weekend_delivery: boolean
  notes: string | null
}

interface CustomerRow {
  id: string
  name: string
  tier: string
  source: string | null
  started_at: string
  isActive: boolean
  serviceNames: string[]
  serviceIds: string[]
  firstLeadDate: string | null
  lastLeadDate: string | null
  daysSinceLast: number | null
  leadsInRange: number
  spendInRange: number
  allTimeLtv: number
  allTimeLtgp: number
  returnRate: number
  currentOrder: Order | null
  allOrders: Order[]
  quota: number
  delivered: number
  onPace: number
  behindPace: boolean
  pricePerLead: number | null
  weekendDelivery: boolean
}

interface DashboardData {
  services: Service[]
  serviceMetrics: ServiceMetric[]
  blended: ServiceMetric
  dailyData: DailyData[]
  customerList: CustomerRow[]
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

function returnRateBg(rate: number) {
  if (rate < 0.10) return 'bg-emerald-900/40 text-emerald-400'
  if (rate < 0.20) return 'bg-amber-900/40 text-amber-400'
  return 'bg-red-900/40 text-red-400'
}

function returnRateColor(rate: number) {
  if (rate < 0.10) return 'text-emerald-400'
  if (rate < 0.20) return 'text-amber-400'
  return 'text-red-400'
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

function PaceBar({ onPace, delivered, quota }: { onPace: number; delivered: number; quota: number }) {
  const fillPct = Math.min((delivered / Math.max(quota, 1)) * 100, 100)
  const color = onPace >= 0.9 ? 'bg-emerald-500' : onPace >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800 rounded-full h-1.5 min-w-16">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${fillPct}%` }} />
      </div>
      <span className="text-slate-400 text-xs whitespace-nowrap">{delivered}/{quota}</span>
    </div>
  )
}

function CustomerDetailModal({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">{customer.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded text-xs bg-amber-900/50 text-amber-400">Pay Per Lead</span>
              {customer.isActive
                ? <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/50 text-emerald-400">Active</span>
                : <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">Inactive</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Key stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'All Time LTV', value: fmt(customer.allTimeLtv) },
              { label: 'All Time LTGP', value: fmt(customer.allTimeLtgp) },
              { label: 'Return Rate', value: pct(customer.returnRate) },
              { label: 'First Lead', value: customer.firstLeadDate ?? '—' },
              { label: 'Last Lead', value: customer.lastLeadDate ?? '—' },
              { label: 'Days Since Last', value: customer.daysSinceLast !== null ? `${customer.daysSinceLast}d` : '—' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-xl p-3">
                <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                <p className="text-white font-medium text-sm">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Services */}
          {customer.serviceNames.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Services</p>
              <div className="flex flex-wrap gap-2">
                {customer.serviceNames.map(s => (
                  <span key={s} className="px-3 py-1 bg-indigo-900/40 text-indigo-400 rounded-full text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Current order pace */}
          {customer.currentOrder && (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Current Order Pace</p>
              <div className="bg-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Quota</span>
                  <span className="text-white">{customer.quota} leads</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Delivered</span>
                  <span className="text-white">{customer.delivered}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Price Per Lead</span>
                  <span className="text-white">{customer.pricePerLead ? fmt(Number(customer.pricePerLead)) : '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Order Period</span>
                  <span className="text-white">{customer.currentOrder.starts_at} → {customer.currentOrder.ends_at}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Weekend Delivery</span>
                  <span className="text-white">{customer.weekendDelivery ? 'Yes' : 'No (weekdays only)'}</span>
                </div>
                <PaceBar onPace={customer.onPace} delivered={customer.delivered} quota={customer.quota} />
                {customer.behindPace && (
                  <p className="text-amber-400 text-xs">⚠ Behind pace — {pct(customer.onPace)} of expected delivery</p>
                )}
              </div>
            </div>
          )}

          {/* Order history */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Order History</p>
            <div className="space-y-2">
              {customer.allOrders.length === 0 ? (
                <p className="text-slate-500 text-sm">No orders found</p>
              ) : (
                customer.allOrders.map(o => (
                  <div key={o.id} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{o.lead_quota} leads @ {fmt(Number(o.price_per_lead))}/lead</p>
                      <p className="text-slate-500 text-xs">{o.starts_at} → {o.ends_at}{o.notes ? ` · ${o.notes}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.is_renewal && <span className="px-2 py-0.5 rounded text-xs bg-indigo-900/40 text-indigo-400">Renewal</span>}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        o.status === 'active' ? 'bg-emerald-900/50 text-emerald-400'
                        : o.status === 'fulfilled' ? 'bg-blue-900/50 text-blue-400'
                        : 'bg-slate-700 text-slate-400'
                      }`}>{o.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FulfilmentPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)

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

  // Filter customer list by selected service
  const visibleCustomers = (data?.customerList ?? []).filter(c =>
    selectedServiceId === 'all' || c.serviceIds.includes(selectedServiceId)
  )

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
            <MetricCard label="Return Rate" value={pct(metrics.returnRate)} />
            <MetricCard label="Avg Lead Price" value={fmt(metrics.avgLeadPrice)} />
            <MetricCard label="Revenue (Net)" value={fmt(metrics.revenue)} highlight />
            <MetricCard label="Cost" value={fmt(metrics.cost)} />
            <MetricCard label="Profit" value={fmt(metrics.profit)} highlight={metrics.profit > 0} />
            <MetricCard label="Gross Margin" value={pct(metrics.grossMargin)} sub={metrics.profit > 0 ? 'Profitable' : 'Below breakeven'} />
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">No data for this date range</div>
        )}

        {/* Service breakdown table — All Services view only */}
        {!loading && selectedServiceId === 'all' && (data?.serviceMetrics ?? []).some(m => m.leadsSold > 0) && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-white font-medium text-sm">Breakdown by Service</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Service','Leads Sold','Returned','Return Rate','Revenue','Cost','Profit','Margin','Avg Price'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.serviceMetrics ?? [])
                    .filter(m => m.leadsSold > 0)
                    .sort((a, b) => b.revenue - a.revenue)
                    .map(m => (
                      <tr key={m.id} onClick={() => setSelectedServiceId(m.id)} className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                        <td className="px-4 py-3 text-slate-300">{m.leadsSold}</td>
                        <td className="px-4 py-3 text-slate-300">{m.leadsReturned}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${returnRateBg(m.returnRate)}`}>{pct(m.returnRate)}</span></td>
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

        {/* Customer list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <p className="text-white font-medium text-sm">Customers</p>
            <p className="text-slate-500 text-xs">{visibleCustomers.length} pay-per-lead {selectedServiceId !== 'all' ? `· ${data?.services.find(s => s.id === selectedServiceId)?.name}` : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Customer','Services','Price/Lead','Quota Pace','Leads (Range)','Spend (Range)','All Time LTV','Return Rate','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3].map(i => (
                    <tr key={i} className="border-b border-slate-800/50">
                      {[1,2,3,4,5,6,7,8,9].map(j => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse w-16" /></td>
                      ))}
                    </tr>
                  ))
                ) : visibleCustomers.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No pay-per-lead customers found</td></tr>
                ) : (
                  visibleCustomers.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.behindPace && <span className="text-amber-400 text-xs">⚠</span>}
                          <span className="text-white font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.serviceNames.length > 0
                            ? c.serviceNames.map(s => (
                                <span key={s} className="px-1.5 py-0.5 bg-indigo-900/40 text-indigo-400 rounded text-xs">{s}</span>
                              ))
                            : <span className="text-slate-500 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {c.pricePerLead ? fmt(Number(c.pricePerLead)) : '—'}
                      </td>
                      <td className="px-4 py-3 min-w-36">
                        {c.quota > 0
                          ? <PaceBar onPace={c.onPace} delivered={c.delivered} quota={c.quota} />
                          : <span className="text-slate-500 text-xs">No active order</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{c.leadsInRange}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{fmt(c.spendInRange)}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{fmt(c.allTimeLtv)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${returnRateBg(c.returnRate)}`}>
                          {pct(c.returnRate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.isActive
                          ? <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/50 text-emerald-400">Active</span>
                          : <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">Inactive</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts */}
        {!loading && chartData.length > 0 && (
          <div className="grid grid-cols-2 gap-6">
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

        {!loading && chartData.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            No lead events in this date range
          </div>
        )}
      </div>

      {/* Customer detail modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}