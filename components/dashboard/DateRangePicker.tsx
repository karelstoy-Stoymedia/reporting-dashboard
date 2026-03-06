'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const presets = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'This month', days: -1 },
  { label: 'Last month', days: -2 },
]

function getPresetDates(days: number): { start: string; end: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (days === 0) return { start: fmt(now), end: fmt(now) }
  if (days === 1) {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    return { start: fmt(y), end: fmt(y) }
  }
  if (days === -1) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: fmt(start), end: fmt(now) }
  }
  if (days === -2) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: fmt(start), end: fmt(end) }
  }
  const start = new Date(now); start.setDate(start.getDate() - days)
  return { start: fmt(start), end: fmt(now) }
}

export default function DateRangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showCustom, setShowCustom] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const currentStart = searchParams.get('startDate')
  const currentEnd = searchParams.get('endDate')

  function applyDates(start: string, end: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('startDate', start)
    params.set('endDate', end)
    router.push(`${pathname}?${params.toString()}`)
  }

  function getActivePreset() {
    for (const p of presets) {
      const { start, end } = getPresetDates(p.days)
      if (start === currentStart && end === currentEnd) return p.label
    }
    return currentStart ? 'Custom' : 'Last 30 days'
  }

  const activePreset = getActivePreset()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
        {presets.map((p) => {
          const active = activePreset === p.label
          return (
            <button
              key={p.label}
              onClick={() => {
                const d = getPresetDates(p.days)
                applyDates(d.start, d.end)
                setShowCustom(false)
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                active ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          )
        })}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activePreset === 'Custom' || showCustom
              ? 'bg-red-600 text-white'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <button
            onClick={() => {
              if (customStart && customEnd) {
                applyDates(customStart, customEnd)
                setShowCustom(false)
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded font-medium"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}