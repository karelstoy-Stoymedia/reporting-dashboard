'use client'

import { useEffect, useState } from 'react'
import { AdminCard, AdminTable, StatusBadge, slugify } from './shared'

interface AdPlatform {
  id: string
  name: string
  slug: string
  is_active: boolean
}

export default function AdPlatformsTab() {
  const [items, setItems] = useState<AdPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<AdPlatform | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/ad-platforms')
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!name || !slug) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/ad-platforms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    })
    if (res.ok) { setName(''); setSlug(''); setShowForm(false); load() }
    else { const d = await res.json(); setError(d.error ?? 'Failed to create') }
    setSaving(false)
  }

  async function handleEdit() {
    if (!editItem) return
    setEditSaving(true)
    await fetch(`/api/admin/ad-platforms/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, slug: editSlug }),
    })
    setEditItem(null)
    setEditSaving(false)
    load()
  }

  async function handleToggle(id: string, is_active: boolean) {
    await fetch(`/api/admin/ad-platforms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !is_active }),
    })
    load()
  }

  return (
    <AdminCard>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-lg">Ad Platforms</h2>
          <p className="text-gray-500 text-sm mt-0.5">e.g. Facebook, Google, TikTok</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Add Platform</button>
      </div>

      {showForm && (
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6 flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-gray-500 text-xs mb-1.5">Name</label>
            <input value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)) }} placeholder="e.g. Facebook" className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-gray-500 text-xs mb-1.5">Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. facebook" className="bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <button onClick={handleCreate} disabled={saving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? 'Saving...' : 'Save'}</button>
          <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-sm px-3 py-2">Cancel</button>
          {error && <p className="text-red-400 text-sm w-full">{error}</p>}
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-white font-semibold mb-4">Edit Ad Platform</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-500 text-xs mb-1.5">Name</label>
                <input value={editName} onChange={(e) => { setEditName(e.target.value); setEditSlug(slugify(e.target.value)) }} className="w-full bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1.5">Slug</label>
                <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="w-full bg-white border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                <p className="text-amber-400 text-xs mt-1">⚠ Changing the slug will break existing webhooks using the old slug.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleEdit} disabled={editSaving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{editSaving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditItem(null)} className="text-gray-500 hover:text-white text-sm px-3 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : (
        <AdminTable headers={['Name', 'Slug', 'Status', 'Actions']}>
          {items.map((s) => (
            <tr key={s.id}>
              <td className="py-3 pr-4 text-white">{s.name}</td>
              <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{s.slug}</td>
              <td className="py-3 pr-4"><StatusBadge active={s.is_active} /></td>
              <td className="py-3 flex gap-3">
                <button onClick={() => { setEditItem(s); setEditName(s.name); setEditSlug(s.slug) }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                <button onClick={() => handleToggle(s.id, s.is_active)} className="text-gray-500 hover:text-white text-xs">{s.is_active ? 'Archive' : 'Restore'}</button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminCard>
  )
}



