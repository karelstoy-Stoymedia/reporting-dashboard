'use client'

import { useEffect, useState } from 'react'
import { AdminCard } from './shared'

export default function WebhookConfigTab() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/webhook-config')
      .then(r => r.json())
      .then(d => { setUrl(d.value ?? ''); setLoading(false) })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/webhook-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: url }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError('Failed to save')
    }
    setSaving(false)
  }

  return (
    <AdminCard>
      <div className="mb-6">
        <h2 className="text-white font-semibold text-lg">Webhook Config</h2>
        <p className="text-slate-400 text-sm mt-0.5">Alert webhook URL for system notifications</p>
      </div>

      {loading ? (
        <div className="h-10 bg-slate-800 rounded animate-pulse w-96" />
      ) : (
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Alert Webhook URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {saved && <p className="text-green-400 text-sm">Saved successfully</p>}
          <button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      )}
    </AdminCard>
  )
}


