import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { LayoutDashboard, Package, ShoppingCart, ArrowLeft, Tag, BookOpen, FileText, Mail, Shield, History } from 'lucide-react'

export const metadata = { title: { template: '%s | Admin — MOCAVA', default: 'Admin — MOCAVA' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login?error=forbidden')

  const NAV = [
    { href: '/admin',            icon: LayoutDashboard, label: 'Dashboard'  },
    { href: '/admin/products',   icon: Package,         label: 'Products'   },
    { href: '/admin/orders',     icon: ShoppingCart,    label: 'Orders'     },
    { href: '/admin/coupons',    icon: Tag,             label: 'Coupons'    },
    { href: '/admin/accounts',   icon: BookOpen,        label: 'Members'    },
    { href: '/admin/invoices',   icon: FileText,        label: 'Invoices'   },
    { href: '/admin/send-email', icon: Mail,            label: 'ส่งเมล'      },
    { href: '/admin/audit-log',  icon: History,         label: 'Audit Log'  },
    { href: '/admin/security',   icon: Shield,          label: 'Security'   },
  ]

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Sidebar — solid blue */}
      <aside className="w-56 bg-blue-700 border-r border-blue-800 flex-shrink-0 hidden md:flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="font-mono text-[10px] text-blue-200/60 tracking-[.18em] uppercase">Admin Panel</div>
        </div>
        <nav className="p-3 flex flex-col gap-0.5 flex-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              <Icon size={15} />{label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <Link href="/" className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <ArrowLeft size={15} /> กลับสู่หน้าหลัก
          </Link>
        </div>
      </aside>

      {/* Content — light blue-gray bg */}
      <div className="admin-content flex-1 overflow-auto bg-[#f0f6ff]">
        {children}
      </div>
    </div>
  )
}
