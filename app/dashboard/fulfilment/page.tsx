'use client'

import { useEffect, useState, useCallback } from 'react'
import DateRangePicker from '@/components/dashboard/DateRangePicker'
import { useSearchParams } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

interface ServiceMetric {
  id: string; name: string; slug: string
  leadsSold: number; leadsReturned: number; returnRate: number
  revenue: number; cost: number; profit: number
  grossMargin: number; avgLeadPrice: number
}
interface DailyData { date: string; sold: number; returned: number; revenue: number; cost: number }
interface Service { id: string; name: string; slug: string }
interface Order {
  id: string; lead_quota: number; price_per_lead: number
  starts_at: string; ends_at: string; status: string
  is_renewal: boolean; leads_delivered: number; weekend_delivery: boolean; notes: string | null
}
interface CustomerRow {
  id: string; name: string; tier: string; source: string | null; started_at: string
  isActive: boolean; serviceNames: string[]; serviceIds: string[]
  firstLeadDate: string | null; lastLeadDate: string | null; daysSinceLast: number | null
  leadsInRange: number; spendInRange: number; allTimeLtv: number; allTimeLtgp: number
  returnRate: number; currentOrder: Order | null; allOrders: Order[]
  quota: number; delivered: number; onPace: number; behindPace: boolean
  pricePerLead: number | null; weekendDelivery: boolean
}
interface DashboardData {
  services: Service[]; serviceMetrics: ServiceMetric[]; blended: ServiceMetric
  dailyData: DailyData[]; customerList: CustomerRow[]
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function pct(n: number) { return (n * 100).toFixed(1) + '%' }

function returnRateBadge(rate: number) {
  if (rate < 0.10) return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (rate < 0.20) return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-red-50 text-red-700 border border-red-200'
}

function MetricCard({ label, value, sub, money }: { label: string; value: string; sub?: string; money?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${money ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function PaceBar({ onPace, delivered, quota }: { onPace: number; delivered: number; quota: number }) {
  const fillPct = Math.min((delivered / Math.max(quota, 1)) * 100, 100)
  const color = onPace >= 0.9 ? 'bg-emerald-500' : onPace >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-16">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${fillPct}%` }} />
      </div>
      <span className="text-gray-500 text-xs whitespace-nowrap">{delivered}/{quota}</span>
    </div>
  )
}

function CustomerDetailModal({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-gray-900 font-semibold text-lg">{customer.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-600 border border-amber-200">Pay Per Lead</span>
              {customer.isActive
                ? <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-600 border border-emerald-200">Active</span>
                : <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">Inactive</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'All Time LTV',   value: fmt(customer.allTimeLtv),   money: true },
              { label: 'All Time LTGP',  value: fmt(customer.allTimeLtgp),  money: true },
              { label: 'Return Rate',    value: pct(customer.returnRate) },
              { label: 'First Lead',     value: customer.firstLeadDate ?? '—' },
              { label: 'Last Lead',      value: customer.lastLeadDate ?? '—' },
              { label: 'Days Since Last',value: customer.daysSinceLast !== null ? `${customer.daysSinceLast}d` : '—' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                <p className={`font-medium text-sm ${(s as { money?: boolean }).money ? 'text-emerald-600' : 'text-gray-900'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {customer.serviceNames.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Services</p>
              <div className="flex flex-wrap gap-2">
                {customer.serviceNames.map(s => (
                  <span key={s} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}

          {customer.currentOrder && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Current Order Pace</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
                {[
                  ['Quota', `${customer.quota} leads`],
                  ['Delivered', String(customer.delivered)],
                  ['Price Per Lead', customer.pricePerLead ? fmt(Number(customer.pricePerLead)) : '—'],
                  ['Order Period', `${customer.currentOrder.starts_at} → ${customer.currentOrder.ends_at}`],
                  ['Weekend Delivery', customer.weekendDelivery ? 'Yes' : 'No (weekdays only)'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-900">{v}</span>
                  </div>
                ))}
                <PaceBar onPace={customer.onPace} delivered={customer.delivered} quota={customer.quota} />
                {customer.behindPace && (
                  <p className="text-amber-600 text-xs">⚠ Behind pace — {pct(customer.onPace)} of expected delivery</p>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Order History</p>
            <div className="space-y-2">
              {customer.allOrders.length === 0 ? (
                <p className="text-gray-400 text-sm">No orders found</p>
              ) : (
                [...customer.allOrders]
                  .sort((a, b) => {
                    if (a.status === 'active' && b.status !== 'active') return -1
                    if (a.status !== 'active' && b.status === 'active') return 1
                    return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
                  })
                  .map(o => (
                    <div key={o.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-gray-900 text-sm font-medium">{o.lead_quota} leads @ {fmt(Number(o.price_per_lead))}/lead</p>
                        <p className="text-gray-500 text-xs">{o.starts_at} → {o.ends_at}{o.notes ? ` · ${o.notes}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {o.is_renewal && <span className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-200">Renewal</span>}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          o.status === 'active'    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : o.status === 'fulfilled' ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'bg-gray-100 text-gray-500'
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

  const visibleCustomers = (data?.customerList ?? []).filter(c =>
    selectedServiceId === 'all' || c.serviceIds.includes(selectedServiceId)
  )
  const chartData = data?.dailyData ?? []

  const formatDate = (d: unknown) => {
    const date = new Date(d as string)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 pt-8 pb-4">
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">Fulfilment</h1>
          <p className="text-gray-500 text-sm mt-1">Pay-per-lead delivery metrics by service</p>
        </div>
        <DateRangePicker />
      </div>

      <div className="flex-1 px-8 pb-8 flex flex-col gap-6 min-h-0 overflow-y-auto">

        {/* Service tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedServiceId('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedServiceId === 'all' ? 'bg-red-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'}`}
          >
            All Services
          </button>
          {loading ? [1,2,3].map(i => <div key={i} className="h-9 w-28 bg-white rounded-lg animate-pulse border border-gray-200" />) : (
            (data?.services ?? []).map(service => (
              <button
                key={service.id}
                onClick={() => setSelectedServiceId(service.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedServiceId === service.id ? 'bg-red-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'}`}
              >
                {service.name}
              </button>
            ))
          )}
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-gray-200" />)}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Leads Sold"       value={metrics.leadsSold.toString()} />
            <MetricCard label="Leads Returned"   value={metrics.leadsReturned.toString()} sub={`${pct(metrics.returnRate)} return rate`} />
            <MetricCard label="Return Rate"      value={pct(metrics.returnRate)} />
            <MetricCard label="Avg Lead Price"   value={fmt(metrics.avgLeadPrice)} money />
            <MetricCard label="Revenue (Net)"    value={fmt(metrics.revenue)} money />
            <MetricCard label="Cost"             value={fmt(metrics.cost)} />
            <MetricCard label="Profit"           value={fmt(metrics.profit)} money={metrics.profit > 0} />
            <MetricCard label="Gross Margin"     value={pct(metrics.grossMargin)} sub={metrics.profit > 0 ? 'Profitable' : 'Below breakeven'} />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">No data for this date range</div>
        )}

        {/* Service breakdown table */}
        {!loading && selectedServiceId === 'all' && (data?.serviceMetrics ?? []).some(m => m.leadsSold > 0) && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-gray-900 font-medium text-sm">Breakdown by Service</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Service','Leads Sold','Returned','Return Rate','Revenue','Cost','Profit','Margin','Avg Price'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.serviceMetrics ?? []).filter(m => m.leadsSold > 0).sort((a, b) => b.revenue - a.revenue).map(m => (
                    <tr key={m.id} onClick={() => setSelectedServiceId(m.id)} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-gray-900 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-gray-700">{m.leadsSold}</td>
                      <td className="px-4 py-3 text-gray-700">{m.leadsReturned}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${returnRateBadge(m.returnRate)}`}>{pct(m.returnRate)}</span></td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">{fmt(m.revenue)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(m.cost)}</td>
                      <td className={`px-4 py-3 font-medium ${m.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(m.profit)}</td>
                      <td className="px-4 py-3 text-gray-700">{pct(m.grossMargin)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(m.avgLeadPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer list */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <p className="text-gray-900 font-medium text-sm">Customers</p>
            <p className="text-gray-400 text-xs">{visibleCustomers.length} pay-per-lead {selectedServiceId !== 'all' ? `· ${data?.services.find(s => s.id === selectedServiceId)?.name}` : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Customer','Services','Price/Lead','Quota Pace','Leads (Range)','Spend (Range)','All Time LTV','Return Rate','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3].map(i => (
                    <tr key={i} className="border-b border-gray-100">
                      {[1,2,3,4,5,6,7,8,9].map(j => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-16" /></td>
                      ))}
                    </tr>
                  ))
                ) : visibleCustomers.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No pay-per-lead customers found</td></tr>
                ) : (
                  visibleCustomers.map(c => (
                    <tr key={c.id} onClick={() => setSelectedCustomer(c)} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.behindPace && <span className="text-amber-500 text-xs">⚠</span>}
                          <span className="text-gray-900 font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.serviceNames.length > 0
                            ? c.serviceNames.map(s => <span key={s} className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-xs">{s}</span>)
                            : <span className="text-gray-400 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{c.pricePerLead ? fmt(Number(c.pricePerLead)) : '—'}</td>
                      <td className="px-4 py-3 min-w-36">
                        {c.quota > 0 ? <PaceBar onPace={c.onPace} delivered={c.delivered} quota={c.quota} /> : <span className="text-gray-400 text-xs">No active order</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{c.leadsInRange}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{fmt(c.spendInRange)}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium text-xs">{fmt(c.allTimeLtv)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${returnRateBadge(c.returnRate)}`}>{pct(c.returnRate)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.isActive
                          ? <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-600 border border-emerald-200">Active</span>
                          : <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">Inactive</span>}
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
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-gray-900 font-medium text-sm mb-4">Leads Sold vs Returned — Daily</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={formatDate} />
                  <Bar dataKey="sold" name="Sold" fill="#dc2626" radius={[2,2,0,0]} />
                  <Bar dataKey="returned" name="Returned" fill="#fca5a5" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-gray-900 font-medium text-sm mb-4">Revenue vs Cost — Daily</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={formatDate} formatter={(v: unknown) => fmt(Number(v))} />
                  <Line dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line dataKey="cost"    name="Cost"    stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!loading && chartData.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            No lead events in this date range
          </div>
        )}
      </div>

      {selectedCustomer && (
        <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  )
}