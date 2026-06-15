import { getServerSession } from 'next-auth'
import { redirect }         from 'next/navigation'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { MembersTable }     from '@/components/admin/MembersTable'

export const metadata = { title: 'Members | Admin' }

export default async function AdminAccountsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login?error=forbidden')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id:        true,
      name:      true,
      email:     true,
      role:      true,
      points:    true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  })

  const totalPoints = users.reduce((s, u) => s + u.points, 0)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#3b82f6', marginBottom: 6 }}>
        Admin
      </div>
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 28 }}>
        Members
      </h1>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', padding: '16px 22px', minWidth: 140 }}>
          <div style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>สมาชิกทั้งหมด</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: '2rem', fontWeight: 700, color: 'var(--ink)' }}>{users.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', padding: '16px 22px', minWidth: 140 }}>
          <div style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Admin</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>
            {users.filter(u => u.role === 'ADMIN').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', padding: '16px 22px', minWidth: 140 }}>
          <div style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>แต้มสะสมรวม</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: '2rem', fontWeight: 700, color: 'var(--ink)' }}>
            {totalPoints.toLocaleString()}
          </div>
        </div>
      </div>

      <MembersTable initialUsers={users} />
    </div>
  )
}
