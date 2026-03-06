'use client'

import { useEffect, useState } from 'react'
import { AdminCard, AdminTable } from './shared'

interface Customer {
  id: string
  name: string
  tier: string
  source: string | null
  started_at: string
  notes: string | null
}

interface Service {
  id: string
  name: string
  slug: string
}

export default function CustomersTab() {
  const [items, setItems] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', tier: 'retainer', source: '', started_at: new Date().toISOString().split('T')[0], notes: '', lead_quota: '', order_price_per_lead: '', weekend_delivery: false, service_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState({ name: '', tier: '', source: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')

  async function load() {
    const [customersRes, servicesRes] = await Promise.all([
      fetch('/api/admin/customers'),
      fetch('/api/admin/services'),
    ])
    const customersData = await customersRes.json()
    const servicesData = await servicesRes.json()
    setItems(customersData)
    setServices(servicesData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!form.name || !form.lead_quota || !form.order_price_per_lead) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, lead_quota: parseInt(form.lead_quota), order_price_per_lead: parseFloat(form.order_price_per_lead) }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ name: '', tier: 'retainer', source: '', started_at: new Date().toISOString().split('T')[0], notes: '', lead_quota: '', order_price_per_lead: '', weekend_delivery: false, service_id: '' })
      load()
    } else { const d = await res.json(); setError(d.error ?? 'Failed to create') }
    setSaving(false)
  }

  async function handleEdit() {
    if (!editItem) return
    setEditSaving(true)
    await fetch(`/api/admin/customers/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditItem(null)
    setEditSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/customers/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  const tierBadge = (tier: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tier === 'retainer' ? 'bg-red-900/60/50 text-red-400' : 'bg-amber-900/50 text-amber-400'}`}>
      {tier === 'retainer' ? 'Retainer' : 'Pay Per Lead'}
    </span>
  )

  return (
    <AdminCard>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-lg">Customers</h2>
          <p className="text-slate-400 text-sm mt-0.5">Manual creation seeds first order automatically</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Add Customer</button>
      </div>

      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Customer Name</label>
              <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="e.g. Apex Roofing LLC" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Tier</label>
              <select value={form.tier} onChange={(e) => setForm({...form, tier: e.target.value})} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="retainer">Retainer</option>
                <option value="pay_per_lead">Pay Per Lead</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Lead Quota (first order)</label>
              <input type="number" value={form.lead_quota} onChange={(e) => setForm({...form, lead_quota: e.target.value})} placeholder="e.g. 80" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Price Per Lead ($)</label>
              <input type="number" value={form.order_price_per_lead} onChange={(e) => setForm({...form, order_price_per_lead: e.target.value})} placeholder="e.g. 45" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Started At</label>
              <input type="date" value={form.started_at} onChange={(e) => setForm({...form, started_at: e.target.value})} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Source</label>
              <input value={form.source} onChange={(e) => setForm({...form, source: e.target.value})} placeholder="e.g. Outbound cold call" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            {form.tier === 'pay_per_lead' && (
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Service (leads for)</label>
                <select value={form.service_id} onChange={(e) => setForm({...form, service_id: e.target.value})} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">— Select service —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-slate-400 text-xs mb-1.5">Weekend Delivery (this order)</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setForm({...form, weekend_delivery: !form.weekend_delivery})} className={`w-10 h-5 rounded-full transition-colors ${form.weekend_delivery ? 'bg-red-600' : 'bg-slate-600'} relative`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.weekend_delivery ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-slate-500 text-xs">{form.weekend_delivery ? '7 days/week — pacing uses calendar days' : 'Mon–Fri only — pacing uses weekdays only'}</span>
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? 'Saving...' : 'Create Customer'}</button>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-sm px-3 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-white font-semibold mb-4">Edit Customer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Tier</label>
                <select value={editForm.tier} onChange={(e) => setEditForm({...editForm, tier: e.target.value})} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="retainer">Retainer</option>
                  <option value="pay_per_lead">Pay Per Lead</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Source</label>
                <input value={editForm.source} onChange={(e) => setEditForm({...editForm, source: e.target.value})} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <p className="text-slate-500 text-xs">Weekend delivery is set per order — edit via the Orders tab.</p>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleEdit} disabled={editSaving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{editSaving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditItem(null)} className="text-slate-400 hover:text-white text-sm px-3 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-white font-semibold mb-2">Delete Customer?</h3>
            <p className="text-slate-400 text-sm mb-2">This will permanently delete <span className="text-white font-medium">{deleteName}</span> and cancel all their active orders.</p>
            <p className="text-red-400 text-xs mb-6">⚠ This cannot be undone. Historical lead data will be preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Delete</button>
              <button onClick={() => setDeleteId(null)} className="text-slate-400 hover:text-white text-sm px-3 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-800 rounded animate-pulse" />)}</div>
      ) : (
        <AdminTable headers={['Name', 'Tier', 'Started', 'Source', 'Actions']}>
          {items.map((c) => (
            <tr key={c.id}>
              <td className="py-3 pr-4 text-white">{c.name}</td>
              <td className="py-3 pr-4">{tierBadge(c.tier)}</td>
              <td className="py-3 pr-4 text-slate-400 text-xs">{c.started_at}</td>
              <td className="py-3 pr-4 text-slate-400 text-xs">{c.source ?? '—'}</td>
              <td className="py-3 flex gap-3">
                <button onClick={() => { setEditItem(c); setEditForm({ name: c.name, tier: c.tier, source: c.source ?? '', notes: c.notes ?? '' }) }} className="text-red-400 hover:text-red-300 text-xs">Edit</button>
                <button onClick={() => { setDeleteId(c.id); setDeleteName(c.name) }} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminCard>
  )
}


