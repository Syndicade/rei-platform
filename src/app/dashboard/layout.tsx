'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Dashboard',   href: '/dashboard' },
  { label: 'Properties',  href: '/dashboard/properties' },
  { label: 'Pipeline',    href: '/dashboard/pipeline' },
  { label: 'Deals',       href: '/dashboard/deals' },
  { label: 'Buy Boxes',   href: '/dashboard/buy-boxes' },
  { label: 'Review Queue', href: '/dashboard/review' },
  { label: 'Contacts',    href: '/dashboard/contacts' },
  { label: 'Documents',   href: '/dashboard/documents' },
  { label: 'Map',         href: '/dashboard/map' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">

      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-700">
          <span className="text-white font-semibold text-sm tracking-wide">REI Platform</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-700">
          <button
            onClick={handleSignOut}
            className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>

    </div>
  )
}