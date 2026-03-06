'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Megaphone, Phone,
  Users, UserCheck, Package, Settings,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard/general', label: 'General', icon: LayoutDashboard },
  { href: '/dashboard/ads', label: 'Ads', icon: Megaphone },
  { href: '/dashboard/outbound', label: 'Outbound', icon: Phone },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/sales-reps', label: 'Sales Reps', icon: UserCheck },
  { href: '/dashboard/fulfilment', label: 'Fulfilment', icon: Package },
]

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm group ${
                isActive
                  ? 'bg-red-600/15 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon
                size={16}
                className={`transition-colors ${
                  isActive ? 'text-red-400' : 'text-slate-500 group-hover:text-red-400'
                }`}
              />
              {label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400" />
              )}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-slate-800">
        <Link
          href="/dashboard/admin"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm group ${
            pathname.startsWith('/dashboard/admin')
              ? 'bg-red-600/15 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Settings
            size={16}
            className={`transition-colors ${
              pathname.startsWith('/dashboard/admin') ? 'text-red-400' : 'text-slate-500 group-hover:text-red-400'
            }`}
          />
          Admin
          {pathname.startsWith('/dashboard/admin') && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400" />
          )}
        </Link>
      </div>
    </>
  )
}
