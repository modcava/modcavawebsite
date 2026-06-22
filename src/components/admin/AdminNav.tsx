'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, ArrowLeft,
  Tag, BookOpen, FileText, Mail, Shield, History, Users, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin',             icon: LayoutDashboard, label: 'Dashboard'   },
  { href: '/admin/products',    icon: Package,         label: 'Products'    },
  { href: '/admin/orders',      icon: ShoppingCart,    label: 'Orders'      },
  { href: '/admin/coupons',     icon: Tag,             label: 'Coupons'     },
  { href: '/admin/influencers', icon: Users,           label: 'Influencers' },
  { href: '/admin/accounts',    icon: BookOpen,        label: 'Members'     },
  { href: '/admin/invoices',    icon: FileText,        label: 'Invoices'    },
  { href: '/admin/send-email',  icon: Mail,            label: 'ส่งเมล'       },
  { href: '/admin/audit-log',   icon: History,         label: 'Audit Log'   },
  { href: '/admin/security',    icon: Shield,          label: 'Security'    },
]

function NavLinks({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <>
      <nav className="p-3 flex flex-col gap-0.5 flex-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
                active
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10',
              )}
            >
              <Icon size={15} />{label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={15} /> กลับสู่หน้าหลัก
        </Link>
      </div>
    </>
  )
}

export function AdminNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="w-56 bg-blue-700 border-r border-blue-800 flex-shrink-0 hidden md:flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="font-mono text-[10px] text-blue-200/60 tracking-[.18em] uppercase">Admin Panel</div>
        </div>
        <NavLinks pathname={pathname} />
      </aside>

      {/* ── Mobile hamburger button ── */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-blue-700 text-white shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* ── Mobile drawer backdrop ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 h-full w-64 z-50 bg-blue-700 flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-mono text-[10px] text-blue-200/60 tracking-[.18em] uppercase">Admin Panel</div>
          <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <NavLinks pathname={pathname} onClose={() => setOpen(false)} />
      </aside>
    </>
  )
}
