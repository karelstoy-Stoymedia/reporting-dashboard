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
    retainer:    'bg-red-50 text-red-600 border border-red-200',
    pay_per_lead:'bg-amber-50 text-amber-600 border border-amber-200',
    hybrid:      'bg-emerald-50 text-emerald-600 border border-emerald-200',
  }
  const labels: Record<string, string> = {
    retainer: 'Retainer', pay_per_lead: 'Pay Per Lead', hybrid: 'Hybrid',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[tier] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[tier] ?? tier}
    </span>
  )
}

function HealthBadge({ behindPace, daysSinceLast, isActive }: { behindPace: boolean; daysSinceLast: number | null; isActive: boolean }) {
  if (!isActive) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
  if (behindPace) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">⚠ Behind Pace</span>
  if (daysSinceLast !== null && daysSinceLast > 7) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">No leads {daysSinceLast}d</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">On Track</span>
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

  const allCustomers = [...(data?.activeCustomers ?? []), ...(data?.pastCustomers ?? [])]
  const visibleCustomers = allCustomers
    .filter(c => filter === 'active' ? c.isActive : filter === 'past' ? !c.isActive : true)
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 text-2xl font-bold">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">Active and past customer roster</p>
        </div>
        <DateRangePicker />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Active Customers', value: String(data?.summary.totalActive ?? 0) },
          { label: 'Total Lead Quota / Month', value: String(data?.summary.totalQuota ?? 0) },
          { label: 'Avg Customer LTV', value: fmt(data?.summary.avgLtv) },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide">{c.label}</p>
            <p className="text-gray-900 text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
            {(['active', 'past', 'all'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === tab ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {tab === 'active' ? `Active (${data?.activeCustomers.length ?? 0})` : tab === 'past' ? `Past (${data?.pastCustomers.length ?? 0})` : `All (${allCustomers.length})`}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Customer','Tier','Health','Quota / Delivered','Days Since Lead','Avg Lead Price','Leads (Range)','Spend (Range)','All Time LTV','All Time LTGP','Account Age','Source'].map(h => (
                    <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleCustomers.length === 0 ? (
                  <tr><td colSpan={12} className="py-8 text-center text-gray-400">No customers found</td></tr>
                ) : (
                  visibleCustomers.map(c => (
                    <tr key={c.id} className={c.behindPace ? 'bg-amber-50/50' : 'hover:bg-gray-50'}>
                      <td className="py-3 pr-4 text-gray-900 font-medium whitespace-nowrap">
                        {c.behindPace && <span className="mr-2 text-amber-500">⚠</span>}
                        {c.name}
                      </td>
                      <td className="py-3 pr-4"><TierBadge tier={c.tier} /></td>
                      <td className="py-3 pr-4"><HealthBadge behindPace={c.behindPace} daysSinceLast={c.daysSinceLast} isActive={c.isActive} /></td>
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap">
                        {c.quota > 0 ? (
                          <div>
                            <span>{c.delivered}/{c.quota}</span>
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, (c.delivered / c.quota) * 100)}%` }} />
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className={`py-3 pr-4 whitespace-nowrap ${c.daysSinceLast !== null && c.daysSinceLast > 7 ? 'text-red-500' : 'text-gray-500'}`}>
                        {c.daysSinceLast !== null ? `${c.daysSinceLast}d` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-900">{c.currentPricePerLead != null ? fmt(c.currentPricePerLead) : '—'}</td>
                      <td className="py-3 pr-4 text-gray-900">
                        {c.rangeLeads}
                        {c.leadChangePct !== 0 && (
                          <span className={`ml-2 text-xs ${c.leadChangePct > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {c.leadChangePct > 0 ? '+' : ''}{c.leadChangePct.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-900">{fmt(c.rangeSpend)}</td>
                      <td className="py-3 pr-4 text-emerald-600 font-medium">{fmt(c.allTimeLtv)}</td>
                      <td className="py-3 pr-4 text-emerald-600 font-medium">{fmt(c.allTimeLtgp)}</td>
                      <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                        {c.accountAgeDays < 30 ? `${c.accountAgeDays}d` : `${Math.floor(c.accountAgeDays / 30)}mo`}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">{c.source ?? '—'}</td>
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
    <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
      <CustomersContent />
    </Suspense>
  )
}