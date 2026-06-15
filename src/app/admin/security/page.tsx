import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { TwoFactorPanel } from './TwoFactorPanel'

export const metadata = { title: 'Security' }
export const dynamic = 'force-dynamic'

export default async function AdminSecurityPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/login?error=forbidden')
  }

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { email: true, twoFactorEnabled: true },
  })

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Security</h1>
        <p className="text-xs text-slate-500 mt-0.5">การตั้งค่าความปลอดภัยของบัญชี admin</p>
      </div>

      <TwoFactorPanel initialEnabled={user?.twoFactorEnabled ?? false} email={user?.email ?? ''} />
    </div>
  )
}
