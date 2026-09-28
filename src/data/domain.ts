import type { DB, ID, Order, OrderStatus, Payment, PaymentKind, Product } from './types'
import { addDays, diffDays, overlaps, toDateStr } from '../lib/date'

// ---------- money ----------

const REVENUE_KINDS: PaymentKind[] = ['advance', 'installment', 'balance', 'fee']

/** Contribution of a payment to revenue. Security deposits are a liability, not revenue. */
export function revenueOf(p: Payment): number {
  if (REVENUE_KINDS.includes(p.kind)) return p.amount
  if (p.kind === 'refund') return -p.amount
  return 0
}

/** Contribution of a payment to the cash drawer. */
export function cashOf(p: Payment): number {
  if (p.fromDeposit) return 0
  if (p.kind === 'refund' || p.kind === 'security_return') return -p.amount
  return p.amount
}

export const itemsSubtotal = (o: Order) => o.items.reduce((s, i) => s + i.price * i.qty, 0)
export const chargesTotal = (o: Order) => o.charges.reduce((s, c) => s + c.amount, 0)
export const orderTotal = (o: Order) => Math.max(0, itemsSubtotal(o) - o.discount + chargesTotal(o))

export function groupByOrder(payments: Payment[]): Map<ID, Payment[]> {
  const m = new Map<ID, Payment[]>()
  for (const p of payments) {
    if (!p.orderId) continue
    const list = m.get(p.orderId)
    if (list) list.push(p)
    else m.set(p.orderId, [p])
  }
  return m
}

export const paidOf = (ps: Payment[] = []) => ps.reduce((s, p) => s + revenueOf(p), 0)

export function securityHeldOf(ps: Payment[] = []): number {
  let held = 0
  for (const p of ps) {
    if (p.kind === 'security') held += p.amount
    if (p.kind === 'security_return') held -= p.amount
    if (p.fromDeposit) held -= p.amount
  }
  return Math.max(0, held)
}

export interface OrderMoney {
  subtotal: number
  charges: number
  total: number
  paid: number
  balance: number
  securityHeld: number
}

export function orderMoney(o: Order, ps: Payment[] = []): OrderMoney {
  const total = orderTotal(o)
  const paid = paidOf(ps)
  return {
    subtotal: itemsSubtotal(o),
    charges: chargesTotal(o),
    total,
    paid,
    balance: o.status === 'cancelled' ? 0 : Math.max(0, total - paid),
    securityHeld: securityHeldOf(ps),
  }
}

// ---------- status ----------

export type DisplayStatus = OrderStatus | 'overdue'

export function isOverdue(o: Order, today: string): boolean {
  return o.type === 'rental' && o.status === 'picked_up' && !!o.returnDate && o.returnDate < today
}

export function lateDays(o: Order, today: string): number {
  return isOverdue(o, today) ? diffDays(o.returnDate!, today) : 0
}

export function displayStatus(o: Order, today: string): DisplayStatus {
  return isOverdue(o, today) ? 'overdue' : o.status
}

export const isActiveOrder = (o: Order) => o.status === 'booked' || o.status === 'picked_up'

// ---------- installment plan ----------

export interface PlanRow {
  n: number
  dueDate: string
  amount: number
  paid: number
  state: 'paid' | 'partial' | 'open' | 'late'
}

/** Payments are applied to the plan in order, oldest installment first. */
export function planRows(o: Order, paid: number, today: string): PlanRow[] {
  let left = paid
  return o.installments.map((ins, i) => {
    const applied = Math.min(left, ins.amount)
    left -= applied
    const state: PlanRow['state'] =
      applied >= ins.amount ? 'paid' : ins.dueDate < today ? 'late' : applied > 0 ? 'partial' : 'open'
    return { n: i + 1, dueDate: ins.dueDate, amount: ins.amount, paid: applied, state }
  })
}

/** Split `total` into a deposit today plus `count` equal installments due before `lastDue`. */
export function buildPlan(total: number, deposit: number, count: number, start: string, lastDue: string) {
  const rows = [{ dueDate: start, amount: Math.min(deposit, total) }]
  const rest = Math.max(0, total - deposit)
  if (rest > 0 && count > 0) {
    const span = Math.max(0, diffDays(start, lastDue))
    const base = Math.floor(rest / count / 1000) * 1000
    for (let i = 1; i <= count; i++) {
      const due = addDays(start, Math.round((span * i) / count))
      rows.push({ dueDate: due, amount: i === count ? rest - base * (count - 1) : base })
    }
  }
  return rows.filter((r) => r.amount > 0)
}

// ---------- availability ----------

/** Dates during which an order keeps its items away from other bookings. */
export function blockingWindow(o: Order, cleaningDays: number, historical = false): [string, string] | null {
  if (o.status === 'cancelled') return null
  // A sold dress never comes back.
  if (o.type === 'sale') return [o.createdAt.slice(0, 10), '9999-12-31']
  if (!historical && (o.status === 'returned' || o.status === 'completed')) return null
  return [o.pickupDate, addDays(o.returnDate ?? o.pickupDate, cleaningDays)]
}

export function conflictsFor(
  db: Pick<DB, 'orders' | 'settings'>,
  productId: ID,
  start: string,
  end: string,
  excludeOrderId?: ID,
  historical = false,
): Order[] {
  return db.orders.filter((o) => {
    if (o.id === excludeOrderId) return false
    if (!o.items.some((i) => i.productId === productId)) return false
    const w = blockingWindow(o, db.settings.cleaningDays, historical)
    return !!w && overlaps(start, end, w[0], w[1])
  })
}

export function nextBooking(orders: Order[], productId: ID, today: string): Order | undefined {
  return orders
    .filter((o) => o.status === 'booked' && o.items.some((i) => i.productId === productId) && o.pickupDate >= today)
    .sort((a, b) => a.pickupDate.localeCompare(b.pickupDate))[0]
}

/** Status a dress should fall back to when nothing else holds it. */
export function restingStatus(db: Pick<DB, 'orders'>, productId: ID): Product['status'] {
  const holders = db.orders.filter((o) => isActiveOrder(o) && o.items.some((i) => i.productId === productId))
  if (holders.some((o) => o.status === 'picked_up' && o.type === 'rental')) return 'rented'
  if (holders.length) return 'reserved'
  return 'available'
}

// ---------- utilization ----------

/** Days (inclusive) each rental order kept a dress out, clipped to [from, to]. */
export function rentedDaysIn(o: Order, from: string, to: string): number {
  if (o.type !== 'rental' || o.status === 'cancelled' || o.status === 'booked') return 0
  const start = o.pickedUpAt ? o.pickedUpAt.slice(0, 10) : o.pickupDate
  const end = o.returnedAt ? o.returnedAt.slice(0, 10) : o.returnDate ?? start
  const s = start > from ? start : from
  const e = end < to ? end : to
  return e < s ? 0 : diffDays(s, e) + 1
}

export function weddingCountdown(weddingDate: string | undefined, today: string): number | null {
  if (!weddingDate) return null
  return diffDays(today, weddingDate)
}

export function isoAt(date: string, hour: number, minute = 0): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute).toISOString()
}

export function localToday(): string {
  return toDateStr(new Date())
}
