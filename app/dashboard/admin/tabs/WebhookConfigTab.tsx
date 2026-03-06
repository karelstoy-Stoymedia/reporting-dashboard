'use client'

import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

const BASE_URL = 'https://reporting-dashboard-ashen.vercel.app'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="bg-slate-900 text-slate-100 text-xs p-4 overflow-x-auto leading-relaxed font-mono whitespace-pre">{code}</pre>
    </div>
  )
}

function FieldTable({ fields }: { fields: { name: string; required: boolean; notes: string }[] }) {
  return (
    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-40">Field</th>
          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Required</th>
          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {fields.map(f => (
          <tr key={f.name} className="hover:bg-gray-50">
            <td className="px-4 py-2.5 font-mono text-xs text-slate-700 font-medium">{f.name}</td>
            <td className="px-4 py-2.5">
              {f.required
                ? <span className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-200 font-medium">Yes</span>
                : <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">No</span>}
            </td>
            <td className="px-4 py-2.5 text-gray-600 text-xs">{f.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface WebhookDef {
  id: string
  method: string
  path: string
  title: string
  description: string
  ghlTrigger: string
  fields: { name: string; required: boolean; notes: string }[]
  payload: string
}

const webhooks: WebhookDef[] = [
  {
    id: 'new-lead',
    method: 'POST',
    path: '/api/webhooks/leads/new',
    title: 'New Lead',
    description: 'Fire when a new lead enters GHL from any source. Returns a lead_id — store this in a GHL custom field to use in all future webhooks for this contact.',
    ghlTrigger: 'Workflow trigger: "Contact Created" or "Tag Added" (e.g. "new-lead")',
    fields: [
      { name: 'full_name',         required: true,  notes: 'Use {{contact.full_name}} in GHL' },
      { name: 'phone',             required: false, notes: '{{contact.phone}}' },
      { name: 'email',             required: false, notes: '{{contact.email}}' },
      { name: 'source_type',       required: true,  notes: '"ad" or "outbound" — hardcode per workflow' },
      { name: 'platform_slug',     required: false, notes: 'Required if source_type=ad. E.g. "facebook". Must match slug in Ad Platforms.' },
      { name: 'channel_slug',      required: false, notes: 'Required if source_type=outbound. E.g. "cold_calling". Must match slug in Outbound Channels.' },
      { name: 'external_ref',      required: false, notes: 'Use {{contact.id}} — GHL contact ID for matching future webhooks if lead_id not stored.' },
      { name: 'is_qualified',      required: false, notes: 'true or false. Can be omitted and set later.' },
      { name: 'assigned_rep_slug', required: false, notes: 'Rep slug if known at lead time.' },
    ],
    payload: `{
  "full_name": "{{contact.full_name}}",
  "phone": "{{contact.phone}}",
  "email": "{{contact.email}}",
  "source_type": "ad",
  "platform_slug": "facebook",
  "external_ref": "{{contact.id}}"
}`,
  },
  {
    id: 'booking',
    method: 'POST',
    path: '/api/webhooks/leads/booking',
    title: 'Booking Created',
    description: 'Fire when a call is booked for a lead. The system auto-detects self-set (booked within 3 min of lead creation) vs setter-set. Use for both first and second calls.',
    ghlTrigger: 'Workflow trigger: "Appointment Created" or "Opportunity Stage Changed" to a booking stage',
    fields: [
      { name: 'lead_id',      required: false, notes: 'Preferred — the UUID returned from new-lead response, stored in a GHL custom field' },
      { name: 'external_ref', required: false, notes: 'Fallback — {{contact.id}}. One of lead_id or external_ref required.' },
      { name: 'rep_slug',     required: true,  notes: 'Must match a slug in Sales Reps. Hardcode per rep workflow or use a custom field.' },
      { name: 'call_number',  required: true,  notes: '1 for first call, 2 for second call' },
      { name: 'booked_at',    required: false, notes: 'ISO timestamp. Defaults to now if omitted.' },
      { name: 'scheduled_at', required: false, notes: 'When the call is scheduled for. ISO timestamp.' },
    ],
    payload: `{
  "external_ref": "{{contact.id}}",
  "rep_slug": "john-smith",
  "call_number": 1,
  "scheduled_at": "{{appointment.start_time}}"
}`,
  },
  {
    id: 'call-outcome',
    method: 'POST',
    path: '/api/webhooks/leads/call-outcome',
    title: 'Call Outcome',
    description: 'Fire after a call completes. Updates the booking record and advances the lead journey. This is your most important webhook — it drives revenue, close rate, and all funnel metrics.',
    ghlTrigger: 'Workflow trigger: "Opportunity Stage Changed" to outcome stages (Closed Won, No Show, etc.) or "Tag Added"',
    fields: [
      { name: 'lead_id',              required: false, notes: 'Preferred identifier' },
      { name: 'external_ref',         required: false, notes: 'Fallback — {{contact.id}}' },
      { name: 'call_number',          required: true,  notes: '1 or 2' },
      { name: 'showed',               required: true,  notes: 'true or false' },
      { name: 'outcome',              required: false, notes: '"full_pay" | "split_pay" | "unqualified" | "scheduled_again" | "follow_up" | "no_show"' },
      { name: 'cash_collected',       required: false, notes: 'Amount collected upfront if closed' },
      { name: 'revenue',              required: false, notes: 'Total deal value if closed' },
      { name: 'offer_made',           required: false, notes: 'true or false — did rep pitch?' },
      { name: 'is_qualified',         required: false, notes: 'true or false — mark after reviewing call' },
      { name: 'recording_url',        required: false, notes: 'Link to call recording' },
      { name: 'call_duration_seconds',required: false, notes: 'Total call length in seconds' },
      { name: 'notes',                required: false, notes: 'Rep notes on the call' },
    ],
    payload: `{
  "external_ref": "{{contact.id}}",
  "call_number": 1,
  "showed": true,
  "outcome": "full_pay",
  "cash_collected": 2500,
  "revenue": 5000,
  "offer_made": true,
  "is_qualified": true
}`,
  },
  {
    id: 'lead-sold',
    method: 'POST',
    path: '/api/webhooks/fulfilment/lead-sold',
    title: 'Lead Sold (Fulfilment)',
    description: 'Fire from Lead Prosper (via Zapier) when a lead is sold to a pay-per-lead customer. Powers all fulfilment tab metrics — quota tracking, LTV, revenue.',
    ghlTrigger: 'Zapier trigger: Lead Prosper "Lead Sold" event → Zapier Webhook POST action',
    fields: [
      { name: 'customer_id',   required: false, notes: 'UUID of customer in dashboard. Use customer_name as fallback.' },
      { name: 'customer_name', required: false, notes: 'Exact customer name if customer_id not known. One of these required.' },
      { name: 'service_slug',  required: true,  notes: 'E.g. "roof-replacement". Must match slug in Services.' },
      { name: 'lead_price',    required: true,  notes: 'Price customer paid for this lead' },
      { name: 'lead_cost',     required: true,  notes: 'Your cost to acquire this lead (ad spend allocation)' },
      { name: 'event_date',    required: false, notes: 'YYYY-MM-DD. Defaults to today.' },
    ],
    payload: `{
  "customer_name": "Apex Roofing LLC",
  "service_slug": "roof-replacement",
  "lead_price": 42,
  "lead_cost": 18,
  "event_date": "2025-03-06"
}`,
  },
  {
    id: 'lead-returned',
    method: 'POST',
    path: '/api/webhooks/fulfilment/lead-returned',
    title: 'Lead Returned (Fulfilment)',
    description: 'Fire when a sold lead is disputed or returned by a customer. Reverses the revenue and cost from fulfilment metrics.',
    ghlTrigger: 'Zapier trigger: Lead Prosper "Lead Returned" event → Zapier Webhook POST action',
    fields: [
      { name: 'customer_id',   required: false, notes: 'UUID of customer' },
      { name: 'customer_name', required: false, notes: 'Fallback if no customer_id' },
      { name: 'service_slug',  required: true,  notes: 'Must match slug in Services' },
      { name: 'lead_price',    required: true,  notes: 'Price to reverse' },
      { name: 'lead_cost',     required: true,  notes: 'Cost to reverse' },
    ],
    payload: `{
  "customer_name": "Apex Roofing LLC",
  "service_slug": "roof-replacement",
  "lead_price": 42,
  "lead_cost": 18
}`,
  },
  {
    id: 'adspend-daily',
    method: 'POST',
    path: '/api/webhooks/ads/adspend-daily',
    title: 'Daily Ad Spend',
    description: 'Fire once per day per platform via Zapier automation. Logs daily spend and lead count for the Ads Dashboard.',
    ghlTrigger: 'Zapier: Schedule trigger (daily) → pull from Facebook/Google Ads → Webhook POST',
    fields: [
      { name: 'platform_slug', required: true, notes: 'E.g. "facebook", "google". Must match slug in Ad Platforms.' },
      { name: 'event_date',    required: true, notes: 'YYYY-MM-DD — the day this data represents' },
      { name: 'adspend',       required: true, notes: 'Total spend that day for this platform' },
      { name: 'leads',         required: true, notes: 'Total leads generated that day for this platform' },
    ],
    payload: `{
  "platform_slug": "facebook",
  "event_date": "2025-03-06",
  "adspend": 450.00,
  "leads": 12
}`,
  },
  {
    id: 'outbound-dials',
    method: 'POST',
    path: '/api/webhooks/outbound/dials',
    title: 'Outbound Dials',
    description: 'Log daily dial activity for a cold calling channel. Use the Outbound Dials tab in Admin to enter this manually if your dialer can\'t fire webhooks automatically.',
    ghlTrigger: 'Manual entry via Admin → Outbound Dials tab  (or Zapier if your dialer supports it)',
    fields: [
      { name: 'channel_slug',  required: true, notes: 'E.g. "cold_calling". Must match slug in Outbound Channels.' },
      { name: 'event_date',    required: true, notes: 'YYYY-MM-DD' },
      { name: 'dials_made',    required: true, notes: 'Total dials that day' },
      { name: 'conversations', required: true, notes: 'Calls over 3 minutes (connects)' },
    ],
    payload: `{
  "channel_slug": "cold_calling",
  "event_date": "2025-03-06",
  "dials_made": 180,
  "conversations": 24
}`,
  },
  {
    id: 'new-order',
    method: 'POST',
    path: '/api/webhooks/customers/new-order',
    title: 'New Customer Order',
    description: 'Fire when a new pay-per-lead order is created for a customer. Creates the order record that drives quota tracking in Fulfilment.',
    ghlTrigger: 'GHL Workflow: "Opportunity Won" or "Tag Added" (e.g. "new-order") → HTTP Request',
    fields: [
      { name: 'customer_name',   required: true,  notes: 'Exact name matching a customer in the system' },
      { name: 'service_slug',    required: true,  notes: 'E.g. "roof-replacement". Must match a service slug.' },
      { name: 'lead_quota',      required: true,  notes: 'Number of leads in this order' },
      { name: 'price_per_lead',  required: true,  notes: 'Price per lead for this order' },
      { name: 'starts_at',       required: true,  notes: 'YYYY-MM-DD order start date' },
      { name: 'ends_at',         required: true,  notes: 'YYYY-MM-DD order end date' },
      { name: 'weekend_delivery',required: false, notes: 'true or false. Default false (weekdays only).' },
      { name: 'is_renewal',      required: false, notes: 'true if this is a renewal order' },
      { name: 'notes',           required: false, notes: 'Any notes about this order' },
    ],
    payload: `{
  "customer_name": "Apex Roofing LLC",
  "service_slug": "roof-replacement",
  "lead_quota": 100,
  "price_per_lead": 42,
  "starts_at": "2025-03-01",
  "ends_at": "2025-03-31",
  "weekend_delivery": false,
  "is_renewal": false
}`,
  },
]

function WebhookCard({ wh }: { wh: WebhookDef }) {
  const [open, setOpen] = useState(false)
  const fullUrl = BASE_URL + wh.path

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">POST</span>
          <span className="font-mono text-sm text-slate-700 font-medium">{wh.path}</span>
          <span className="text-gray-900 font-medium text-sm">{wh.title}</span>
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-200 px-5 py-5 space-y-5">
          <p className="text-gray-600 text-sm">{wh.description}</p>

          {/* GHL trigger */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <span className="text-amber-500 mt-0.5 text-sm">⚡</span>
            <div>
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-0.5">GHL Setup</p>
              <p className="text-amber-800 text-sm">{wh.ghlTrigger}</p>
            </div>
          </div>

          {/* Full URL */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Endpoint URL</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-slate-700 flex-1 break-all">{fullUrl}</span>
              <CopyButton text={fullUrl} />
            </div>
          </div>

          {/* Required header */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Required Header</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-slate-700 flex-1">X-Webhook-Secret: YOUR_WEBHOOK_SECRET</span>
              <CopyButton text="X-Webhook-Secret" />
            </div>
          </div>

          {/* Fields */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Fields</p>
            <FieldTable fields={wh.fields} />
          </div>

          {/* Payload */}
          <div>
            <CodeBlock code={wh.payload} label="Example JSON Body (paste into GHL HTTP Request → Body)" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function WebhookConfigTab() {
  return (
    <div className="space-y-6">
      {/* Setup banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-gray-900 font-semibold text-base mb-1">GHL Webhook Setup Guide</h2>
        <p className="text-gray-500 text-sm mb-5">
          All webhooks are HTTP POST requests. Set these up in GHL using <strong className="text-gray-700">Workflows → HTTP Request action</strong>. Store your secret and base URL as GHL Custom Values so you don't hardcode them in every workflow.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Step 1 — GHL Custom Values</p>
            <p className="text-gray-700 text-sm mb-3">Add these two Custom Values in GHL Settings → Custom Values:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-1.5">
                <span className="font-mono text-xs text-slate-700">dashboard_base_url</span>
                <CopyButton text={BASE_URL} />
              </div>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-1.5">
                <span className="font-mono text-xs text-slate-700">webhook_secret</span>
                <span className="text-xs text-gray-400">your WEBHOOK_SECRET value</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Step 2 — HTTP Request Setup</p>
            <p className="text-gray-700 text-sm">In every GHL Workflow HTTP Request action:</p>
            <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
              <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">→</span> Method: <strong>POST</strong></li>
              <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">→</span> URL: paste endpoint from below</li>
              <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">→</span> Header: <code className="bg-gray-100 px-1 rounded text-xs">X-Webhook-Secret</code> = your secret</li>
              <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">→</span> Body type: <strong>JSON</strong></li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Step 3 — Store lead_id</p>
            <p className="text-gray-700 text-sm">The <code className="bg-gray-100 px-1 rounded text-xs">new-lead</code> webhook returns a <code className="bg-gray-100 px-1 rounded text-xs">lead_id</code> UUID in its response. Use a GHL Webhook Response action to save it to a custom field (e.g. <code className="bg-gray-100 px-1 rounded text-xs">dashboard_lead_id</code>) — then pass it in all future webhooks for that contact.</p>
          </div>
        </div>
      </div>

      {/* Webhook cards */}
      <div className="space-y-3">
        <h3 className="text-gray-900 font-semibold text-sm uppercase tracking-wide px-1">All Webhook Routes</h3>
        {webhooks.map(wh => (
          <WebhookCard key={wh.id} wh={wh} />
        ))}
      </div>

      {/* Quick reference */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-gray-900 font-semibold text-sm mb-4">Quick Reference — All Endpoints</h3>
        <div className="space-y-2">
          {webhooks.map(wh => (
            <div key={wh.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white flex-shrink-0">POST</span>
              <span className="font-mono text-xs text-slate-700 flex-1">{BASE_URL + wh.path}</span>
              <span className="text-gray-500 text-xs hidden lg:block">{wh.title}</span>
              <CopyButton text={BASE_URL + wh.path} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}