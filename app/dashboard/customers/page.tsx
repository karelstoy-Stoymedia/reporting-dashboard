'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import DateRangePicker from '@/components/dashboard/DateRangePicker'

interface Customer {
  id: string
  name: string
  tier: string
  source: string | null
  started_at: string
  isActive: boolean
  allTimeLtv: number
  allTimeLtgp: number
  currentPricePerLead: number | null
  leadsLast30: number
  leadChangePct: number
  firstLead: string | null
  lastLead: string | null
  daysSinceLast: number | null
  rangeLeads: number
  rangeSpend: number
  quota: number
  delivered: number
  onPace: number
  behindPace: boolean
  accountAgeDays: number
}

interface CustomersData {
  activeCustomers: Customer[]
  pastCustomers: Customer[]
  summary: { totalActive: number; totalQuota: number; avgLtv: number }
}

type FilterTab = 'active' | 'past' | 'all'

function fmt(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '$0'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    retainer: 'bg-indigo-900/50 text-indigo-400',
    pay_per_lead: 'bg-amber-900/50 text-amber-400',
    hybrid: 'bg-emerald-900/50 text-emerald-400',
  }
  const labels: Record<string, string> = {
    retainer: 'Retainer',
    pay_per_lead: 'Pay Per Lead',
    hybrid: 'Hybrid',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[tier] ?? 'bg-slate-700 text-slate-400'}`}>
      {labels[tier] ?? tier}
    </span>
  )
}

function HealthBadge({ behindPace, daysSinceLast, isActive }: { behindPace: boolean; daysSinceLast: number | null; isActive: boolean }) {
  if (!isActive) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400">Inactive</span>
  if (behindPace) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-400">⚠ Behind Pace</span>
  if (daysSinceLast !== null && daysSinceLast > 7) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400">No leads {daysSinceLast}d</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/50 text-emerald-400">On Track</span>
}

function CustomersContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<CustomersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('active')
  const [search, setSearch] = useState('')

  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/customers?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [startDate, endDate])

  const allCustomers = [
    ...(data?.activeCustomers ?? []),
    ...(data?.pastCustomers ?? []),
  ]

  const visibleCustomers = allCustomers
    .filter(c => {
      if (filter === 'active') return c.isActive
      if (filter === 'past') return !c.isActive
      return true
    })
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Customers</h1>
          <p className="text-slate-400 text-sm mt-1">Active and past customer roster</p>
        </div>
        <DateRangePicker />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Total Active Customers</p>
          <p className="text-white text-2xl font-bold mt-1">{data?.summary.totalActive ?? 0}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Total Lead Quota / Month</p>
          <p className="text-white text-2xl font-bold mt-1">{data?.summary.totalQuota ?? 0}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Avg Customer LTV</p>
          <p className="text-white text-2xl font-bold mt-1">{fmt(data?.summary.avgLtv)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        {/* Filter + Search bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
            {(['active', 'past', 'all'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${filter === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {tab === 'active' ? `Active (${data?.activeCustomers.length ?? 0})` : tab === 'past' ? `Past (${data?.pastCustomers.length ?? 0})` : `All (${allCustomers.length})`}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-700 rounded animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Customer', 'Tier', 'Health', 'Quota / Delivered', 'Days Since Lead', 'Avg Lead Price', 'Leads (Range)', 'Spend (Range)', 'All Time LTV', 'All Time LTGP', 'Account Age', 'Source'].map(h => (
                    <th key={h} className="text-left text-slate-400 font-medium pb-3 pr-4 whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleCustomers.length === 0 ? (
                  <tr><td colSpan={12} className="py-8 text-center text-slate-500">No customers found</td></tr>
                ) : (
                  visibleCustomers.map(c => (
                    <tr key={c.id} className={c.behindPace ? 'bg-yellow-900/5' : ''}>
                      <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">
                        {c.behindPace && <span className="mr-2">⚠</span>}
                        {c.name}
                      </td>
                      <td className="py-3 pr-4"><TierBadge tier={c.tier} /></td>
                      <td className="py-3 pr-4"><HealthBadge behindPace={c.behindPace} daysSinceLast={c.daysSinceLast} isActive={c.isActive} /></td>
                      <td className="py-3 pr-4 text-white whitespace-nowrap">
                        {c.quota > 0 ? (
                          <div>
                            <span>{c.delivered}/{c.quota}</span>
                            <div className="w-20 h-1 bg-slate-700 rounded-full mt-1">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (c.delivered / c.quota) * 100)}%` }} />
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className={`py-3 pr-4 whitespace-nowrap ${c.daysSinceLast !== null && c.daysSinceLast > 7 ? 'text-red-400' : 'text-slate-400'}`}>
                        {c.daysSinceLast !== null ? `${c.daysSinceLast}d` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-white">{c.currentPricePerLead != null ? fmt(c.currentPricePerLead) : '—'}</td>
                      <td className="py-3 pr-4 text-white">
                        {c.rangeLeads}
                        {c.leadChangePct !== 0 && (
                          <span className={`ml-2 text-xs ${c.leadChangePct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {c.leadChangePct > 0 ? '+' : ''}{c.leadChangePct.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-white">{fmt(c.rangeSpend)}</td>
                      <td className="py-3 pr-4 text-white">{fmt(c.allTimeLtv)}</td>
                      <td className="py-3 pr-4 text-white">{fmt(c.allTimeLtgp)}</td>
                      <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
                        {c.accountAgeDays < 30 ? `${c.accountAgeDays}d` : `${Math.floor(c.accountAgeDays / 30)}mo`}
                      </td>
                      <td className="py-3 pr-4 text-slate-400 text-xs">{c.source ?? '—'}</td>
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

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
      <CustomersContent />
    </Suspense>
  )
}