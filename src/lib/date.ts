// Dates are stored as local `YYYY-MM-DD` strings; timestamps as ISO strings.

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function addMonths(s: string, n: number): string {
  const d = parseDate(s)
  d.setMonth(d.getMonth() + n)
  return toDateStr(d)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}

export function monthKey(s: string): string {
  return s.slice(0, 7)
}

export function startOfMonth(s: string): string {
  return s.slice(0, 8) + '01'
}

export function endOfMonth(s: string): string {
  const d = parseDate(startOfMonth(s))
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return toDateStr(d)
}

/** Monday-based weekday: 0 = Monday … 6 = Sunday. */
export function weekday(s: string): number {
  return (parseDate(s).getDay() + 6) % 7
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Local date part of an ISO timestamp or a plain date string. */
export function dateOf(isoOrDate: string): string {
  if (isoOrDate.length <= 10) return isoOrDate
  return toDateStr(new Date(isoOrDate))
}

export function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function inRange(s: string, from: string, to: string): boolean {
  const d = s.slice(0, 10)
  return d >= from && d <= to
}

/** Inclusive overlap of two date ranges. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function eachMonth(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = startOfMonth(from); monthKey(d) <= monthKey(to); d = addMonths(d, 1)) out.push(monthKey(d))
  return out
}
