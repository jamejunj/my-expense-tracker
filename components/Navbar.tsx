'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: '/budget', label: '📋 วางแผนงบ'     },
    { href: '/daily',  label: '📅 บันทึกรายวัน' },
  ]

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <span className="font-bold text-gray-900 text-base tracking-tight">
          💰 บัญชีรายรับรายจ่าย
        </span>
        <div className="flex gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
