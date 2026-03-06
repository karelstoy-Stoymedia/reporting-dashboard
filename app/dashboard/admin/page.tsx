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
  { id: 'services',           label: 'Services' },
  { id: 'ad-platforms',       label: 'Ad Platforms' },
  { id: 'outbound-channels',  label: 'Outbound Channels' },
  { id: 'sales-reps',         label: 'Sales Reps' },
  { id: 'outbound-overhead',  label: 'Outbound Overhead' },
  { id: 'outbound-dials',     label: 'Outbound Dials' },
  { id: 'customers',          label: 'Customers' },
  { id: 'webhook-config',     label: 'Webhook Config' },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('services')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-gray-900 text-2xl font-bold">Admin Panel</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage all configuration data</p>
      </div>

      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-8 flex-wrap shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'services'          && <ServicesTab />}
        {activeTab === 'ad-platforms'      && <AdPlatformsTab />}
        {activeTab === 'outbound-channels' && <OutboundChannelsTab />}
        {activeTab === 'sales-reps'        && <SalesRepsTab />}
        {activeTab === 'outbound-overhead' && <OutboundOverheadTab />}
        {activeTab === 'outbound-dials'    && <OutboundDialsTab />}
        {activeTab === 'customers'         && <CustomersTab />}
        {activeTab === 'webhook-config'    && <WebhookConfigTab />}
      </div>
    </div>
  )
}