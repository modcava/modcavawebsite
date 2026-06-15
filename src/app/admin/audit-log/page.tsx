import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Audit Log' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

// Server component — no client interactivity needed.
// Filters via URL search params: ?action=...&resource=...&user=...&page=N
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { action?: string; resource?: string; user?: string; page?: string }
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1))

  const where = {
    ...(searchParams.action   && { action:    { contains: searchParams.action } }),
    ...(searchParams.resource && { resource:  searchParams.resource }),
    ...(searchParams.user     && { userEmail: { contains: searchParams.user } }),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Audit Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกการกระทำของ admin ทั้งหมด · {total.toLocaleString()} รายการ
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <form className="flex flex-wrap gap-2 items-end p-3 bg-white border border-slate-200 rounded">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Action</label>
          <input
            type="text"
            name="action"
            defaultValue={searchParams.action ?? ''}
            placeholder="e.g. product.update"
            className="text-xs px-2 py-1 border border-slate-300 rounded w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Resource</label>
          <select
            name="resource"
            defaultValue={searchParams.resource ?? ''}
            className="text-xs px-2 py-1 border border-slate-300 rounded w-32"
          >
            <option value="">— all —</option>
            <option value="product">product</option>
            <option value="order">order</option>
            <option value="coupon">coupon</option>
            <option value="user">user</option>
            <option value="invoice">invoice</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500">User email</label>
          <input
            type="text"
            name="user"
            defaultValue={searchParams.user ?? ''}
            placeholder="email contains…"
            className="text-xs px-2 py-1 border border-slate-300 rounded w-56"
          />
        </div>
        <button type="submit" className="text-xs px-3 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700">
          กรอง
        </button>
        <a href="/admin/audit-log" className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50">
          ล้าง
        </a>
      </form>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Time</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Admin</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Action</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Details</th>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-xs">
                  ไม่มีบันทึก
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap font-mono">
                    {new Date(l.createdAt).toLocaleString('th-TH', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{l.userEmail}</td>
                  <td className="px-3 py-2">
                    <span className={actionBadgeClass(l.action)}>{l.action}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 font-mono">
                    {l.resource}
                    {l.resourceId ? <span className="text-slate-400">:{l.resourceId.slice(0, 8)}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[400px]">
                    <DetailsCell raw={l.details} />
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-400 font-mono whitespace-nowrap">
                    {l.ip ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <PageLink page={page - 1} totalPages={totalPages} searchParams={searchParams} label="‹ ก่อนหน้า" />
          <span className="text-xs text-slate-500">
            หน้า {page} / {totalPages}
          </span>
          <PageLink page={page + 1} totalPages={totalPages} searchParams={searchParams} label="ถัดไป ›" />
        </div>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────

function actionBadgeClass(action: string): string {
  const base = 'inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold'
  if (action.endsWith('.create'))  return `${base} bg-green-100 text-green-700`
  if (action.endsWith('.update'))  return `${base} bg-blue-100 text-blue-700`
  if (action.endsWith('.delete'))  return `${base} bg-red-100 text-red-700`
  if (action.endsWith('.cancel'))  return `${base} bg-orange-100 text-orange-700`
  if (action.endsWith('.enable'))  return `${base} bg-emerald-100 text-emerald-700`
  if (action.endsWith('.disable')) return `${base} bg-amber-100 text-amber-700`
  return `${base} bg-slate-100 text-slate-600`
}

function DetailsCell({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-slate-300">—</span>
  try {
    const obj = JSON.parse(raw)
    // Compact one-line summary; fall back to JSON pretty-print if structure is odd
    const summary = Object.entries(obj)
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ')
    return <span className="font-mono text-[10px] break-all">{summary}</span>
  } catch {
    return <span className="font-mono text-[10px] break-all">{raw}</span>
  }
}

function PageLink({
  page,
  totalPages,
  searchParams,
  label,
}: {
  page: number
  totalPages: number
  searchParams: Record<string, string | undefined>
  label: string
}) {
  if (page < 1 || page > totalPages) {
    return <span className="text-xs text-slate-300 px-3 py-1">{label}</span>
  }
  const qs = new URLSearchParams()
  Object.entries(searchParams).forEach(([k, v]) => { if (v) qs.set(k, v) })
  qs.set('page', String(page))
  return (
    <a
      href={`?${qs.toString()}`}
      className="text-xs px-3 py-1 rounded border border-slate-300 hover:bg-slate-50"
    >
      {label}
    </a>
  )
}
