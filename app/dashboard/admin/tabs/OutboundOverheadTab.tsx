'use client'

import { useEffect, useState } from 'react'
import { AdminCard } from './shared'

interface Channel { id: string; name: string }
interface OverheadEntry {
  id: string
  channel_id: string
  month_year: string
  overhead_amount: number
  outbound_channels: { name: string }
}

export default function OutboundOverheadTab() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [entries, setEntries] = useState<OverheadEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [channelId, setChannelId] = useState('')
  const [monthYear, setMonthYear] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<OverheadEntry | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    const [chRes, enRes] = await Promise.all([fetch('/api/admin/outbound-channels'), fetch('/api/admin/outbound-overhead')])
    const ch = await chRes.json()
    const en = await enRes.json()
    setChannels(ch.filter((c: Channel & { is_active: boolean }) => c.is_active))
    setEntries(en)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!channelId || !monthYear || !amount) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/outbound-overhead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, month_year: monthYear + '-01', overhead_amount: parseFloat(amount) }),
    })
    if (res.ok) { setAmount(''); load() }
    else { const d = await res.json(); setError(d.error ?? 'Failed to save') }
    setSaving(false)
  }

  async function handleEdit() {
    if (!editItem || !editAmount) return
    setEditSaving(true)
    await fetch(`/api/admin/outbound-overhead/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overhead_amount: parseFloat(editAmount), updated_at: new Date().toISOString() }),
    })
    setEditItem(null)
    setEditSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/outbound-overhead/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  return (
    <AdminCard>
      <div className="mb-6">
        <h2 className="text-white font-semibold text-lg">Outbound Overhead</h2>
        <p className="text-gray-500 text-sm mt-0.5">Enter monthly overhead cost per outbound channel</p>
      </div>

      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6 flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-gray-500 text-xs mb-1.5">Channel</label>
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Select channel</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-500 text-xs mb-1.5">Month</label>
          <input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-gray-500 text-xs mb-1.5">Amount ($)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 3500" className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? 'Saving...' : 'Save'}</button>
        {error && <p className="text-red-400 text-sm w-full">{error}</p>}
      </div>

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white font-semibold mb-4">Edit Overhead Entry</h3>
            <p className="text-gray-500 text-sm mb-4">{editItem.outbound_channels?.name} — {editItem.month_year?.slice(0, 7)}</p>
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Amount ($)</label>
              <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleEdit} disabled={editSaving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{editSaving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditItem(null)} className="text-gray-500 hover:text-white text-sm px-3 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-white font-semibold mb-2">Delete Entry?</h3>
            <p className="text-gray-500 text-sm mb-6">This will permanently remove this overhead entry.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Delete</button>
              <button onClick={() => setDeleteId(null)} className="text-gray-500 hover:text-white text-sm px-3 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {['Channel', 'Month', 'Amount', 'Actions'].map(h => <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.slice(0, 12).map((e) => (
                <tr key={e.id}>
                  <td className="py-3 pr-4 text-white">{e.outbound_channels?.name}</td>
                  <td className="py-3 pr-4 text-gray-500">{e.month_year?.slice(0, 7)}</td>
                  <td className="py-3 pr-4 text-white">${Number(e.overhead_amount).toLocaleString()}</td>
                  <td className="py-3 flex gap-3">
                    <button onClick={() => { setEditItem(e); setEditAmount(String(e.overhead_amount)) }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                    <button onClick={() => setDeleteId(e.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  )
}



