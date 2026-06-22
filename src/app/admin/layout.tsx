import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata = { title: { template: '%s | Admin — MOCAVA', default: 'Admin — MOCAVA' } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login?error=forbidden')

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <AdminNav />
      {/* Content — light blue-gray bg, push right on mobile to clear hamburger button */}
      <div className="admin-content flex-1 overflow-auto bg-[#f0f6ff] md:pl-0 pl-0">
        {children}
      </div>
    </div>
  )
}
