import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard,
  Megaphone,
  Phone,
  Users,
  UserCheck,
  Package,
  Settings,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard/general', label: 'General', icon: LayoutDashboard },
  { href: '/dashboard/ads', label: 'Ads', icon: Megaphone },
  { href: '/dashboard/outbound', label: 'Outbound', icon: Phone },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/sales-reps', label: 'Sales Reps', icon: UserCheck },
  { href: '/dashboard/fulfilment', label: 'Fulfilment', icon: Package },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-800">
          <h1 className="text-white font-bold text-lg">Stoy Media</h1>
          <p className="text-slate-500 text-xs mt-0.5">Reporting Dashboard</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm group"
            >
              <Icon size={16} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Admin gear */}
        <div className="px-3 py-4 border-t border-slate-800">
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm group"
          >
            <Settings size={16} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
            Admin
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-950">
        {children}
      </main>
    </div>
  )
}