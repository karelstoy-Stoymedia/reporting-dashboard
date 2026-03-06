'use client'

import { useState } from 'react'
import ServicesTab from './tabs/ServicesTab'
import AdPlatformsTab from './tabs/AdPlatformsTab'
import OutboundChannelsTab from './tabs/OutboundChannelsTab'
import SalesRepsTab from './tabs/SalesRepsTab'
import OutboundOverheadTab from './tabs/OutboundOverheadTab'
import OutboundDialsTab from './tabs/OutboundDialsTab'
import CustomersTab from './tabs/CustomersTab'
import WebhookConfigTab from './tabs/WebhookConfigTab'

const tabs = [
  { id: 'services', label: 'Services' },
  { id: 'ad-platforms', label: 'Ad Platforms' },
  { id: 'outbound-channels', label: 'Outbound Channels' },
  { id: 'sales-reps', label: 'Sales Reps' },
  { id: 'outbound-overhead', label: 'Outbound Overhead' },
  { id: 'outbound-dials', label: 'Outbound Dials' },
  { id: 'customers', label: 'Customers' },
  { id: 'webhook-config', label: 'Webhook Config' },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('services')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Admin Panel</h1>
        <p className="text-slate-400 mt-1 text-sm">Manage all configuration data</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-8 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'services' && <ServicesTab />}
        {activeTab === 'ad-platforms' && <AdPlatformsTab />}
        {activeTab === 'outbound-channels' && <OutboundChannelsTab />}
        {activeTab === 'sales-reps' && <SalesRepsTab />}
        {activeTab === 'outbound-overhead' && <OutboundOverheadTab />}
        {activeTab === 'outbound-dials' && <OutboundDialsTab />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'webhook-config' && <WebhookConfigTab />}
      </div>
    </div>
  )
}

