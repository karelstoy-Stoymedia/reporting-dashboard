'use client'

import { useEffect, useState } from 'react'
import { AdminCard } from './shared'

interface Channel { id: string; name: string }
interface DialEntry {
  id: string
  channel_id: string
  event_date: string
  dials_made: number
  connects: number
  outbound_channels: { name: string }
}

export default function OutboundDialsTab() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [entries, setEntries] = useState<DialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [channelId, setChannelId] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [dials, setDials] = useState('')
  const [connects, setConnects] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<DialEntry | null>(null)
  const [editDials, setEditDials] = useState('')
  const [editConnects, setEditConnects] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    const [chRes, enRes] = await Promise.all([fetch('/api/admin/outbound-channels'), fetch('/api/admin/outbound-dials')])
    const ch = await chRes.json()
    const en = await enRes.json()
    setChannels(ch.filter((c: Channel & { is_active: boolean }) => c.is_active))
    setEntries(en)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!channelId || !eventDate || !dials || !connects) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/outbound-dials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, event_date: eventDate, dials_made: parseInt(dials), connects: parseInt(connects) }),
    })
    if (res.ok) { setDials(''); setConnects(''); load() }
    else { const d = await res.json(); setError(d.error ?? 'Failed to save') }
    setSaving(false)
  }

  async function handleEdit() {
    if (!editItem) return
    setEditSaving(true)
    await fetch(`/api/admin/outbound-dials/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dials_made: parseInt(editDials), connects: parseInt(editConnects) }),
    })
    setEditItem(null)
    setEditSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/outbound-dials/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  return (
    <AdminCard>
      <div className="mb-6">
        <h2 className="text-white font-semibold text-lg">Outbound Dials</h2>
        <p className="text-gray-500 text-sm mt-0.5">Enter daily dial activity per channel</p>
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
          <label className="block text-gray-500 text-xs mb-1.5">Date</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-gray-500 text-xs mb-1.5">Dials Made</label>
          <input type="number" value={dials} onChange={(e) => setDials(e.target.value)} placeholder="e.g. 250" className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-gray-500 text-xs mb-1.5">Connects</label>
          <input type="number" value={connects} onChange={(e) => setConnects(e.target.value)} placeholder="e.g. 18" className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? 'Saving...' : 'Save'}</button>
        {error && <p className="text-red-400 text-sm w-full">{error}</p>}
      </div>

      {editItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white font-semibold mb-4">Edit Dial Entry</h3>
            <p className="text-gray-500 text-sm mb-4">{editItem.outbound_channels?.name} — {editItem.event_date}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-500 text-xs mb-1.5">Dials Made</label>
                <input type="number" value={editDials} onChange={(e) => setEditDials(e.target.value)} className="w-full bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1.5">Connects</label>
                <input type="number" value={editConnects} onChange={(e) => setEditConnects(e.target.value)} className="w-full bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleEdit} disabled={editSaving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{editSaving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditItem(null)} className="text-gray-500 hover:text-white text-sm px-3 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-white font-semibold mb-2">Delete Entry?</h3>
            <p className="text-gray-500 text-sm mb-6">This will permanently remove this dial entry.</p>
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
                {['Channel', 'Date', 'Dials', 'Connects', 'Connect Rate', 'Actions'].map(h => <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.slice(0, 20).map((e) => (
                <tr key={e.id}>
                  <td className="py-3 pr-4 text-white">{e.outbound_channels?.name}</td>
                  <td className="py-3 pr-4 text-gray-500">{e.event_date}</td>
                  <td className="py-3 pr-4 text-white">{e.dials_made.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-white">{e.connects.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-gray-500">{e.dials_made > 0 ? ((e.connects / e.dials_made) * 100).toFixed(1) : 0}%</td>
                  <td className="py-3 flex gap-3">
                    <button onClick={() => { setEditItem(e); setEditDials(String(e.dials_made)); setEditConnects(String(e.connects)) }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
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



