// Helpers for scheduled product releases ("coming soon").
// A product with a future `releaseAt` is visible but not yet buyable.

export function isComingSoon(releaseAt: Date | string | null | undefined): boolean {
  if (!releaseAt) return false
  const d = new Date(releaseAt)
  return !isNaN(d.getTime()) && d.getTime() > Date.now()
}

// Thai-friendly absolute date+time, e.g. "25 มิ.ย. 2026 14:00".
// Forces the Gregorian calendar so the year isn't shown as Buddhist-era.
export function formatReleaseDate(releaseAt: Date | string | null | undefined): string {
  if (!releaseAt) return ''
  const d = new Date(releaseAt)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', calendar: 'gregory',
  }).format(d)
}

// Break the time remaining until `releaseAt` into d/h/m/s for a countdown.
// Returns null once the release time has passed.
export function countdownTo(releaseAt: Date | string | null | undefined, now: number = Date.now()) {
  if (!releaseAt) return null
  const target = new Date(releaseAt).getTime()
  if (isNaN(target)) return null
  let diff = Math.floor((target - now) / 1000)
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400); diff -= days * 86400
  const hours = Math.floor(diff / 3600); diff -= hours * 3600
  const minutes = Math.floor(diff / 60)
  const seconds = diff - minutes * 60
  return { days, hours, minutes, seconds }
}
