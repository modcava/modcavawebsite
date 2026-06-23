// Pure date-bucketing helpers for the sales export (Report A).
// Periods are computed in Asia/Bangkok so late-night orders land on the right
// calendar day/week/year regardless of where the server runs. No DB or app deps
// here on purpose — keeps it unit-testable.

export type Granularity = 'week' | 'month' | 'year'

const TZ = 'Asia/Bangkok'
const pad = (n: number) => String(n).padStart(2, '0')
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

/** Human-readable Thai label for a bucket key (e.g. "มิถุนายน 2026", "สัปดาห์ที่ 26/2026"). */
export function thaiPeriod(g: Granularity, key: string): string {
  if (g === 'year') return `ปี ${key}`
  if (g === 'month') {
    const [y, m] = key.split('-').map(Number)
    return `${THAI_MONTHS[m - 1]} ${y}`
  }
  const [y, w] = key.split('-W')   // YYYY-Www
  return `สัปดาห์ที่ ${Number(w)}/${y}`
}

/** Calendar Y/M/D of an instant as seen in Bangkok. */
export function bkkParts(d: Date) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const [y, m, day] = s.split('-').map(Number)
  return { y, m, d: day }
}

/** ISO-8601 week number + the week-numbering year for a calendar date. */
export function isoWeek(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = (date.getUTCDay() + 6) % 7        // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3)  // shift to the Thursday of this week
  const isoYear = date.getUTCFullYear()
  const firstThu = new Date(Date.UTC(isoYear, 0, 4))
  const fd = (firstThu.getUTCDay() + 6) % 7
  firstThu.setUTCDate(firstThu.getUTCDate() - fd + 3)
  const week = 1 + Math.round((date.getTime() - firstThu.getTime()) / 604800000)
  return { isoYear, week }
}

/** Monday→Sunday calendar range (YYYY-MM-DD) for the week containing a date. */
export function weekRange(y: number, m: number, d: number) {
  const base = new Date(Date.UTC(y, m - 1, d))
  const dayNum = (base.getUTCDay() + 6) % 7
  const mon = new Date(base); mon.setUTCDate(base.getUTCDate() - dayNum)
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
}

/** Bucket an instant into its period key + inclusive calendar range. */
export function bucketOf(d: Date, g: Granularity) {
  const { y, m, d: day } = bkkParts(d)
  if (g === 'year') return { key: `${y}`, start: `${y}-01-01`, end: `${y}-12-31` }
  if (g === 'month') {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { key: `${y}-${pad(m)}`, start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` }
  }
  const { isoYear, week } = isoWeek(y, m, day)
  return { key: `${isoYear}-W${pad(week)}`, ...weekRange(y, m, day) }
}
