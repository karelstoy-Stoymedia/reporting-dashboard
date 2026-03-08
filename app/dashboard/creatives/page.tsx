'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Sparkles, Pin, Trash2, Download, ExternalLink,
  X, ChevronUp, ChevronDown, Tag, Plus, AlertTriangle, RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreativeTag { id: string; name: string; color: string }

interface LeaderboardCreative {
  id: string
  meta_ad_id: string
  ad_account_id: string
  campaign_name: string | null
  adset_name: string | null
  ad_name: string
  thumbnail_url: string | null
  creative_type: string
  headline: string | null
  body: string | null
  cta: string | null
  status: string
  is_tagged: boolean
  is_on_leaderboard: boolean
  is_pinned: boolean
  is_removed: boolean
  tags: CreativeTag[]
  totalSpend: number
  totalLeads: number
  totalClicks: number
  totalImpressions: number
  cpl: number | null
  ctr: number | null
  avgHookRate: number | null
}

interface Summary {
  totalSpend: number
  totalLeads: number
  avgCpl: number | null
  avgHookRate: number | null
  avgCtr: number | null
}

interface LeaderboardResponse {
  creatives: LeaderboardCreative[]
  tags: CreativeTag[]
  untaggedCount: number
  summary: Summary
}

interface MetricRow {
  metric_date: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpl: number | null
  hook_rate: number | null
}

interface CreativeDetail extends LeaderboardCreative {
  campaign_id: string | null
  adset_id: string | null
  metrics: MetricRow[]
}

interface LiveCreative {
  id: string
  meta_ad_id: string
  ad_account_id: string
  campaign_id: string | null
  campaign_name: string | null
  adset_id: string | null
  adset_name: string | null
  ad_name: string
  thumbnail_url: string | null
  creative_type: string
  headline: string | null
  status: string
  tags: CreativeTag[]
  todayMetrics: { spend: number; leads: number; cpl: number | null; ctr: number | null } | null
}

interface MetaAccount { id: string; account_id: string; account_name: string; is_active: boolean }
interface FiltersResponse {
  campaigns: { campaign_id: string; campaign_name: string }[]
  adsets: { adset_id: string; adset_name: string; campaign_id: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`
}
function fmtPct(n: number) { return `${(n * 100).toFixed(2)}%` }
function fmtCpl(n: number | null) { return n === null ? '—' : `$${n.toFixed(2)}` }
function adsManagerUrl(adAccountId: string, metaAdId: string) {
  return `https://www.facebook.com/adsmanager/manage/ads?act=${adAccountId.replace('act_', '')}&selected_ad_ids=${metaAdId}`
}
function getDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 29)
  return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }
}

// ─── TagPill ──────────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: CreativeTag }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </span>
  )
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function Thumb({ url, size = 56 }: { url: string | null; size?: number }) {
  if (!url) return (
    <div className="bg-gray-100 rounded flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <Sparkles size={14} className="text-gray-300" />
    </div>
  )
  return <img src={url} alt="" className="rounded object-cover flex-shrink-0" style={{ width: size, height: size }} />
}

// ─── KPI Bar ──────────────────────────────────────────────────────────────────

function KPIBar({ summary }: { summary: Summary }) {
  const kpis = [
    { label: 'Total Spend', value: fmtCurrency(summary.totalSpend) },
    { label: 'Total Leads', value: summary.totalLeads.toLocaleString() },
    { label: 'Avg CPL', value: fmtCpl(summary.avgCpl) },
    { label: 'Avg Hook Rate', value: summary.avgHookRate !== null ? fmtPct(summary.avgHookRate) : '—' },
    { label: 'Avg CTR', value: summary.avgCtr !== null ? fmtPct(summary.avgCtr) : '—' },
  ]
  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {kpis.map(({ label, value }) => (
        <div key={label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Remove Modal ─────────────────────────────────────────────────────────────

function RemoveModal({ creativeId, onClose, onSuccess }: { creativeId: string; onClose: () => void; onSuccess: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true); setError('')
    const res = await fetch(`/api/admin/creatives/${creativeId}/remove`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    })
    res.ok ? onSuccess() : setError((await res.json()).error ?? 'Failed')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove from Board</h3>
        <p className="text-sm text-gray-500 mb-4">Enter the admin passcode to remove this creative.</p>
        <input type="password" placeholder="Passcode" value={passcode} onChange={e => setPasscode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm w-full mb-3" />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading || !passcode} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">
            {loading ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Cleanup Modal ────────────────────────────────────────────────────────────

function CleanupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true); setError('')
    const res = await fetch('/api/admin/creatives/bulk-archive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, threshold: 0.8 }),
    })
    res.ok ? onSuccess() : setError((await res.json()).error ?? 'Failed')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Clean Up Bottom 80%</h3>
        <p className="text-sm text-gray-500 mb-4">Archives all creatives outside the top 20% by CPL. Enter passcode to confirm.</p>
        <input type="password" placeholder="Passcode" value={passcode} onChange={e => setPasscode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm w-full mb-3" />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading || !passcode} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">
            {loading ? 'Archiving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tag Assignment Modal ─────────────────────────────────────────────────────

const TAG_COLORS = ['#6366F1', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6']

function TagAssignmentModal({ creative, allTags, onClose, onSuccess }: {
  creative: LeaderboardCreative; allTags: CreativeTag[]
  onClose: () => void; onSuccess: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(creative.tags.map(t => t.id))
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366F1')
  const [localTags, setLocalTags] = useState<CreativeTag[]>(allTags)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const filtered = localTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  function toggle(id: string) {
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  async function createTag() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/admin/creative-tags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    if (res.ok) {
      const tag = await res.json()
      setLocalTags(p => [...p, tag])
      setSelectedIds(p => [...p, tag.id])
      setNewName('')
    }
    setCreating(false)
  }

  async function save() {
    setLoading(true); setError('')
    const res = await fetch(`/api/admin/creatives/${creative.id}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: selectedIds }),
    })
    res.ok ? onSuccess() : setError((await res.json()).error ?? 'Failed')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Assign Tags</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-3 truncate">{creative.ad_name}</p>
        <input type="text" placeholder="Search tags..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm w-full mb-3" />
        <div className="flex-1 overflow-y-auto min-h-0 mb-4 space-y-0.5">
          {filtered.map(tag => (
            <button key={tag.id} onClick={() => toggle(tag.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${selectedIds.includes(tag.id) ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 text-left text-gray-900">{tag.name}</span>
              {selectedIds.includes(tag.id) && <span className="text-emerald-600 text-xs">✓</span>}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No tags found</p>}
        </div>
        <div className="border-t border-gray-200 pt-4 mb-4">
          <p className="text-xs text-gray-500 font-medium mb-2">Create new tag</p>
          <input type="text" placeholder="Tag name" value={newName} onChange={e => setNewName(e.target.value)}
            className="bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm w-full mb-2" />
          <div className="flex gap-1.5 mb-2">
            {TAG_COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <button onClick={createTag} disabled={creating || !newName.trim()}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
            <Plus size={13} />{creating ? 'Creating...' : 'Create Tag'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Tags'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ creativeId, onClose, allTags, onTagSuccess }: {
  creativeId: string; onClose: () => void
  allTags: CreativeTag[]; onTagSuccess: () => void
}) {
  const [detail, setDetail] = useState<CreativeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTagModal, setShowTagModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/creatives/${creativeId}`)
      .then(r => r.json()).then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [creativeId])

  const metrics = detail?.metrics ?? []
  const totalSpend = metrics.reduce((s, m) => s + Number(m.spend || 0), 0)
  const totalLeads = metrics.reduce((s, m) => s + Number(m.leads || 0), 0)
  const totalImpressions = metrics.reduce((s, m) => s + Number(m.impressions || 0), 0)
  const totalClicks = metrics.reduce((s, m) => s + Number(m.clicks || 0), 0)
  const allTimeCpl = totalLeads > 0 ? totalSpend / totalLeads : null
  const allTimeCtr = totalImpressions > 0 ? totalClicks / totalImpressions : null

  const chartData = metrics.map(m => ({
    date: m.metric_date.slice(5),
    spend: Number(m.spend ?? 0),
    cpl: m.cpl ? Number(m.cpl) : null,
  }))

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <p className="font-semibold text-gray-900 text-sm truncate pr-4">{detail?.ad_name ?? '...'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detail ? (
          <div className="flex-1 overflow-y-auto">
            {detail.thumbnail_url && (
              <img src={detail.thumbnail_url} alt="Creative" className="w-full aspect-video object-cover" />
            )}
            <div className="p-5 space-y-5">
              {(detail.headline || detail.body) && (
                <div>
                  {detail.headline && <p className="font-semibold text-gray-900 text-sm">{detail.headline}</p>}
                  {detail.body && <p className="text-sm text-gray-500 mt-1 line-clamp-3">{detail.body}</p>}
                </div>
              )}
              <p className="text-xs text-gray-400">
                {[detail.campaign_name, detail.adset_name, detail.ad_name].filter(Boolean).join(' → ')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'All-Time Spend', value: fmtCurrency(totalSpend) },
                  { label: 'All-Time Leads', value: totalLeads.toLocaleString() },
                  { label: 'All-Time CPL', value: fmtCpl(allTimeCpl) },
                  { label: 'All-Time CTR', value: allTimeCtr !== null ? fmtPct(allTimeCtr) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {chartData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-3">Daily CPL & Spend</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="spend" orientation="left" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} width={42} />
                      <YAxis yAxisId="cpl" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} width={42} />
                      <Tooltip formatter={(v: any, name?: string) => [`$${Number(v).toFixed(2)}`, name === 'spend' ? 'Spend' : 'CPL']} />
                      <Bar yAxisId="spend" dataKey="spend" fill="#E2E8F0" name="spend" />
                      <Line yAxisId="cpl" dataKey="cpl" stroke="#DC2626" strokeWidth={2} dot={false} connectNulls name="cpl" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500">Tags</p>
                  <button onClick={() => setShowTagModal(true)} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                    <Tag size={12} /> Edit
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.length > 0
                    ? detail.tags.map(t => <TagPill key={t.id} tag={t} />)
                    : <span className="text-xs text-gray-400">No tags assigned</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <a href={adsManagerUrl(detail.ad_account_id, detail.meta_ad_id)} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
                  <ExternalLink size={14} /> Ads Manager
                </a>
                {detail.thumbnail_url && (
                  <a href={detail.thumbnail_url} download target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
                    <Download size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Failed to load</div>
        )}
      </div>
      {showTagModal && detail && (
        <TagAssignmentModal creative={detail} allTags={allTags}
          onClose={() => setShowTagModal(false)}
          onSuccess={() => { setShowTagModal(false); onTagSuccess() }} />
      )}
    </>
  )
}

// ─── Leaderboard Table ────────────────────────────────────────────────────────

type SortField = 'cpl' | 'ctr' | 'totalSpend' | 'totalLeads'

function LeaderboardTable({ creatives, allTags, onSelectCreative, onRefresh }: {
  creatives: LeaderboardCreative[]; allTags: CreativeTag[]
  onSelectCreative: (id: string) => void; onRefresh: () => void
}) {
  const [sortField, setSortField] = useState<SortField>('cpl')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pinningId, setPinningId] = useState<string | null>(null)
  const [removeModal, setRemoveModal] = useState<{ open: boolean; id: string }>({ open: false, id: '' })
  const [tagModal, setTagModal] = useState<{ open: boolean; creative: LeaderboardCreative | null }>({ open: false, creative: null })

  function handleSort(field: SortField) {
    if (sortField === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortField(field); setSortDir(field === 'ctr' || field === 'totalLeads' || field === 'totalSpend' ? 'desc' : 'asc') }
  }

  const sorted = [...creatives].sort((a, b) => {
    const av = a[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    const bv = b[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  async function handlePin(c: LeaderboardCreative) {
    setPinningId(c.id)
    await fetch(`/api/admin/creatives/${c.id}/${c.is_pinned ? 'unpin' : 'pin'}`, { method: 'POST' })
    setPinningId(null); onRefresh()
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronUp size={11} className="text-gray-300" />
    return sortDir === 'asc' ? <ChevronUp size={11} className="text-gray-600" /> : <ChevronDown size={11} className="text-gray-600" />
  }

  function medal(rank: number) {
    if (rank === 1) return <span className="text-base">🥇</span>
    if (rank === 2) return <span className="text-base">🥈</span>
    if (rank === 3) return <span className="text-base">🥉</span>
    return <span className="text-xs text-gray-500 font-medium">#{rank}</span>
  }

  if (creatives.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
      <Sparkles size={28} className="text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">No creatives on the leaderboard yet.</p>
      <p className="text-gray-400 text-xs mt-1">Run a sync to populate leaderboard data.</p>
    </div>
  )

  const Th = ({ field, label, right = false }: { field: SortField; label: string; right?: boolean }) => (
    <th onClick={() => handleSort(field)}
      className={`px-4 py-3 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      <span className="inline-flex items-center gap-1">{label}<SortIcon field={field} /></span>
    </th>
  )

  return (
    <>
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-center w-12">Rank</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left">Creative</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left">Tags</th>
                <Th field="totalSpend" label="Spend" right />
                <Th field="totalLeads" label="Leads" right />
                <Th field="cpl" label="CPL" right />
                <Th field="ctr" label="CTR" right />
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left">Hook Rate</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((c, i) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onSelectCreative(c.id)}>
                  <td className="px-4 py-3 text-center">{medal(i + 1)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb url={c.thumbnail_url} size={56} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-[180px]">{c.ad_name}</p>
                        {c.headline && <p className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5">{c.headline}</p>}
                        {c.is_pinned && (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-600 mt-0.5">
                            <Pin size={9} /> Pinned
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {c.tags.length > 0
                        ? c.tags.map(t => <TagPill key={t.id} tag={t} />)
                        : (
                          <button onClick={e => { e.stopPropagation(); setTagModal({ open: true, creative: c }) }}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <Plus size={10} /> Add
                          </button>
                        )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCurrency(c.totalSpend)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{c.totalLeads}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmtCpl(c.cpl)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{c.ctr !== null ? fmtPct(c.ctr) : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.creative_type === 'video' && c.avgHookRate !== null ? fmtPct(c.avgHookRate) : '—'}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handlePin(c)} disabled={pinningId === c.id}
                        title={c.is_pinned ? 'Unpin' : 'Pin to board'}
                        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${c.is_pinned ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <Pin size={14} />
                      </button>
                      {c.thumbnail_url && (
                        <a href={c.thumbnail_url} download target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                          <Download size={14} />
                        </a>
                      )}
                      <button onClick={() => setRemoveModal({ open: true, id: c.id })}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {removeModal.open && (
        <RemoveModal creativeId={removeModal.id}
          onClose={() => setRemoveModal({ open: false, id: '' })}
          onSuccess={() => { setRemoveModal({ open: false, id: '' }); onRefresh() }} />
      )}
      {tagModal.open && tagModal.creative && (
        <TagAssignmentModal creative={tagModal.creative} allTags={allTags}
          onClose={() => setTagModal({ open: false, creative: null })}
          onSuccess={() => { setTagModal({ open: false, creative: null }); onRefresh() }} />
      )}
    </>
  )
}

// ─── Untagged Queue ───────────────────────────────────────────────────────────

function UntaggedQueue({ creatives, allTags, onSelectCreative, onRefresh }: {
  creatives: LeaderboardCreative[]; allTags: CreativeTag[]
  onSelectCreative: (id: string) => void; onRefresh: () => void
}) {
  const [tagModal, setTagModal] = useState<{ open: boolean; creative: LeaderboardCreative | null }>({ open: false, creative: null })

  if (creatives.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
      <Tag size={28} className="text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">All leaderboard creatives are tagged.</p>
    </div>
  )

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {creatives.map(c => (
          <div key={c.id} onClick={() => onSelectCreative(c.id)}
            className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
            <div className="aspect-video bg-gray-100 overflow-hidden">
              {c.thumbnail_url
                ? <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Sparkles size={20} className="text-gray-200" /></div>}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900 truncate mb-2">{c.ad_name}</p>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>{fmtCurrency(c.totalSpend)}</span>
                <span>{c.totalLeads} leads</span>
                <span className="text-emerald-600 font-medium">{fmtCpl(c.cpl)}</span>
              </div>
              <button onClick={e => { e.stopPropagation(); setTagModal({ open: true, creative: c }) }}
                className="w-full flex items-center justify-center gap-1.5 border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50">
                <Tag size={11} /> Assign Tags
              </button>
            </div>
          </div>
        ))}
      </div>
      {tagModal.open && tagModal.creative && (
        <TagAssignmentModal creative={tagModal.creative} allTags={allTags}
          onClose={() => setTagModal({ open: false, creative: null })}
          onSuccess={() => { setTagModal({ open: false, creative: null }); onRefresh() }} />
      )}
    </>
  )
}

// ─── Live View ────────────────────────────────────────────────────────────────

function LiveView({ accounts, onSelectCreative }: { accounts: MetaAccount[]; onSelectCreative: (id: string) => void }) {
  const [accountId, setAccountId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [adsetId, setAdsetId] = useState('')
  const [creatives, setCreatives] = useState<LiveCreative[]>([])
  const [filters, setFilters] = useState<FiltersResponse>({ campaigns: [], adsets: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCampaignId(''); setAdsetId('')
    const p = new URLSearchParams()
    if (accountId) p.set('accountId', accountId)
    fetch(`/api/dashboard/creatives/filters?${p}`).then(r => r.json()).then(setFilters).catch(() => {})
  }, [accountId])

  useEffect(() => {
    setAdsetId('')
    const p = new URLSearchParams()
    if (accountId) p.set('accountId', accountId)
    if (campaignId) p.set('campaignId', campaignId)
    fetch(`/api/dashboard/creatives/filters?${p}`).then(r => r.json())
      .then(d => setFilters(prev => ({ ...prev, adsets: d.adsets }))).catch(() => {})
  }, [campaignId])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (accountId) p.set('accountId', accountId)
    if (campaignId) p.set('campaignId', campaignId)
    if (adsetId) p.set('adsetId', adsetId)
    fetch(`/api/dashboard/creatives/live?${p}`).then(r => r.json())
      .then(d => { setCreatives(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [accountId, campaignId, adsetId])

  const sel = "bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"
  const visibleAdsets = campaignId ? filters.adsets.filter(a => a.campaign_id === campaignId) : filters.adsets

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <select value={accountId} onChange={e => setAccountId(e.target.value)} className={sel}>
          <option value="">All Accounts</option>
          {accounts.filter(a => a.is_active).map(a => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
        </select>
        <select value={campaignId} onChange={e => setCampaignId(e.target.value)} className={sel}>
          <option value="">All Campaigns</option>
          {filters.campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>)}
        </select>
        <select value={adsetId} onChange={e => setAdsetId(e.target.value)} className={sel}>
          <option value="">All Ad Sets</option>
          {visibleAdsets.map(a => <option key={a.adset_id} value={a.adset_id}>{a.adset_name}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-100" />
              <div className="p-3 space-y-2"><div className="h-3 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : creatives.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Sparkles size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No active creatives for these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {creatives.map(c => (
            <div key={c.id} onClick={() => onSelectCreative(c.id)}
              className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gray-100 overflow-hidden">
                {c.thumbnail_url
                  ? <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Sparkles size={20} className="text-gray-200" /></div>}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate mb-1">{c.ad_name}</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.status}
                </span>
                {c.todayMetrics && (
                  <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                    <div><p className="text-gray-400">Spend</p><p className="font-medium text-gray-900">{fmtCurrency(c.todayMetrics.spend)}</p></div>
                    <div><p className="text-gray-400">Leads</p><p className="font-medium text-gray-900">{c.todayMetrics.leads}</p></div>
                    <div><p className="text-gray-400">CPL</p><p className="font-medium text-emerald-600">{fmtCpl(c.todayMetrics.cpl)}</p></div>
                  </div>
                )}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.tags.slice(0, 2).map(t => <TagPill key={t.id} tag={t} />)}
                    {c.tags.length > 2 && <span className="text-xs text-gray-400">+{c.tags.length - 2}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreativesPage() {
  const [dateRange, setDateRange] = useState(getDefaultDates())
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null)
  const [showCleanupModal, setShowCleanupModal] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate })
    if (selectedAccountId) p.set('accountId', selectedAccountId)
    const [lbRes, accRes] = await Promise.all([
      fetch(`/api/dashboard/creatives?${p}`),
      fetch('/api/admin/meta-accounts'),
    ])
    const [lb, accs] = await Promise.all([lbRes.json(), accRes.json()])
    setData(lb); setAccounts(Array.isArray(accs) ? accs : [])
    setLoading(false)
  }, [dateRange, selectedAccountId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSync() {
    setSyncing(true)
    await fetch('/api/admin/sync-creatives', { method: 'POST' })
    await fetchData()
    setSyncing(false)
  }

  const allCreatives: LeaderboardCreative[] = data?.creatives ?? []
  const allTags: CreativeTag[] = data?.tags ?? []
  const leaderboardCreatives = allCreatives.filter(c => (c.is_on_leaderboard || c.is_pinned) && !c.is_removed)
  const untaggedCreatives = leaderboardCreatives.filter(c => !c.is_tagged)
  const untaggedCount = untaggedCreatives.length
  const summary: Summary = data?.summary ?? { totalSpend: 0, totalLeads: 0, avgCpl: null, avgHookRate: null, avgCtr: null }

  const tabCreatives = activeTab === 'leaderboard' ? leaderboardCreatives
    : activeTab === 'untagged' ? untaggedCreatives
    : activeTab === 'live' ? []
    : leaderboardCreatives.filter(c => c.tags.some(t => t.id === activeTab))

  const sel = "bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Creatives</h1>
          <p className="text-sm text-gray-500 mt-0.5">Meta / Facebook ad performance leaderboard</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className={sel}>
            <option value="">All Accounts</option>
            {accounts.filter(a => a.is_active).map(a => (
              <option key={a.account_id} value={a.account_id}>{a.account_name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
            <input type="date" value={dateRange.startDate}
              onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))}
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={dateRange.endDate}
              onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))}
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 transition-colors">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-0 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'leaderboard', label: 'All Creatives' },
          ...allTags.map(t => ({ id: t.id, label: t.name })),
          { id: 'untagged', label: 'Untagged' },
          { id: 'live', label: 'Live View' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'text-red-600 border-b-2 border-red-600 -mb-px' : 'text-gray-500 hover:text-gray-900'
            }`}>
            {tab.label}
            {tab.id === 'untagged' && untaggedCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full">
                {untaggedCount > 9 ? '9+' : untaggedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" /><div className="h-7 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-8 animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded" />)}
          </div>
        </div>
      ) : activeTab === 'live' ? (
        <LiveView accounts={accounts} onSelectCreative={setSelectedCreativeId} />
      ) : (
        <>
          {activeTab !== 'untagged' && <KPIBar summary={summary} />}
          {activeTab === 'leaderboard' && untaggedCount > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{untaggedCount} creative{untaggedCount !== 1 ? 's' : ''}</span> on the leaderboard {untaggedCount !== 1 ? 'have' : 'has'} no tags.{' '}
                <button onClick={() => setActiveTab('untagged')} className="underline hover:no-underline">Tag them now</button>
              </p>
            </div>
          )}
          {activeTab === 'leaderboard' && leaderboardCreatives.length > 0 && (
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowCleanupModal(true)}
                className="flex items-center gap-2 border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">
                <Trash2 size={13} /> Clean up bottom 80%
              </button>
            </div>
          )}
          {activeTab === 'untagged' ? (
            <UntaggedQueue creatives={untaggedCreatives} allTags={allTags} onSelectCreative={setSelectedCreativeId} onRefresh={fetchData} />
          ) : (
            <LeaderboardTable creatives={tabCreatives} allTags={allTags} onSelectCreative={setSelectedCreativeId} onRefresh={fetchData} />
          )}
        </>
      )}

      {selectedCreativeId && (
        <DetailPanel creativeId={selectedCreativeId} onClose={() => setSelectedCreativeId(null)} allTags={allTags} onTagSuccess={fetchData} />
      )}
      {showCleanupModal && (
        <CleanupModal onClose={() => setShowCleanupModal(false)} onSuccess={() => { setShowCleanupModal(false); fetchData() }} />
      )}
    </div>
  )
}