// Period metrics shared by the analytics, branches and staff pages.
import type { DB, ID, Order, PaymentMethod, ProductStatus } from './types'
import { groupByOrder, itemsSubtotal, orderMoney, orderTotal, rentedDaysIn, revenueOf } from './domain'
import { addDays, addMonths, dateOf, diffDays, eachDay, eachMonth, endOfMonth, inRange, startOfMonth } from '../lib/date'

export type PeriodKey = 'thisMonth' | 'lastMonth' | 'last3' | 'thisYear' | 'last12'
export const PERIODS: PeriodKey[] = ['thisMonth', 'lastMonth', 'last3', 'thisYear', 'last12']

export interface Period {
  from: string
  to: string
  prevFrom: string
  prevTo: string
  bucket: 'day' | 'month'
}

export function periodRange(key: PeriodKey, today: string): Period {
  switch (key) {
    case 'thisMonth': {
      const from = startOfMonth(today)
      const span = diffDays(from, today)
      const prevFrom = addMonths(from, -1)
      return { from, to: today, prevFrom, prevTo: addDays(prevFrom, span), bucket: 'day' }
    }
    case 'lastMonth': {
      const from = addMonths(startOfMonth(today), -1)
      const prevFrom = addMonths(from, -1)
      return { from, to: endOfMonth(from), prevFrom, prevTo: endOfMonth(prevFrom), bucket: 'day' }
    }
    case 'last3': {
      const from = addMonths(startOfMonth(today), -2)
      return { from, to: today, prevFrom: addMonths(from, -3), prevTo: addDays(from, -1), bucket: 'month' }
    }
    case 'thisYear': {
      const from = `${today.slice(0, 4)}-01-01`
      const prevFrom = `${Number(today.slice(0, 4)) - 1}-01-01`
      return { from, to: today, prevFrom, prevTo: addDays(prevFrom, diffDays(from, today)), bucket: 'month' }
    }
    case 'last12': {
      const from = addMonths(startOfMonth(today), -11)
      return { from, to: today, prevFrom: addMonths(from, -12), prevTo: addDays(from, -1), bucket: 'month' }
    }
  }
}

export type Slice = Pick<DB, 'orders' | 'payments' | 'clients' | 'products' | 'appointments' | 'productTypes' | 'settings'>

export function sliceFor(db: DB, branchIds: ID[] | 'all'): Slice {
  const keep = <T extends { branchId: ID }>(arr: T[]) => (branchIds === 'all' ? arr : arr.filter((x) => branchIds.includes(x.branchId)))
  return {
    orders: keep(db.orders),
    payments: keep(db.payments),
    clients: keep(db.clients),
    products: keep(db.products),
    appointments: keep(db.appointments),
    productTypes: db.productTypes,
    settings: db.settings,
  }
}

const liveOrders = (s: Slice, from: string, to: string) => s.orders.filter((o) => o.status !== 'cancelled' && inRange(dateOf(o.createdAt), from, to))

export interface Metrics {
  revenue: number
  orders: number
  rentals: number
  sales: number
  volume: number
  rentalVolume: number
  saleVolume: number
  avgOrder: number
  outstanding: number
  securityHeld: number
  utilization: number
  newClients: number
  /** Completed viewings in the period whose client went on to book, in percent. */
  visitConversion: number
  activeRentals: number
  dresses: number
}

export function metrics(s: Slice, from: string, to: string, today: string): Metrics {
  const revenue = s.payments.filter((p) => inRange(dateOf(p.date), from, to)).reduce((sum, p) => sum + revenueOf(p), 0)
  const orders = liveOrders(s, from, to)
  const volume = orders.reduce((sum, o) => sum + orderTotal(o), 0)
  const rentalVolume = orders.filter((o) => o.type === 'rental').reduce((sum, o) => sum + orderTotal(o), 0)
  const pays = groupByOrder(s.payments)
  let outstanding = 0
  let securityHeld = 0
  for (const o of s.orders) {
    if (o.status === 'cancelled') continue
    const m = orderMoney(o, pays.get(o.id))
    if (o.status !== 'completed') outstanding += m.balance
    securityHeld += m.securityHeld
  }
  const kind = new Map(s.productTypes.map((t) => [t.id, t.kind]))
  const rentable = s.products.filter((p) => kind.get(p.typeId) === 'dress' && p.mode !== 'sale' && p.status !== 'sold')
  const end = to < today ? to : today
  const days = Math.max(1, diffDays(from, end) + 1)
  const rentableIds = new Set(rentable.map((p) => p.id))
  let rentedDays = 0
  for (const o of s.orders) {
    if (o.type !== 'rental') continue
    const n = rentedDaysIn(o, from, end)
    if (n) rentedDays += n * o.items.filter((i) => rentableIds.has(i.productId)).length
  }
  const booked = new Set(s.orders.filter((o) => o.status !== 'cancelled').map((o) => o.clientId))
  const viewings = s.appointments.filter((a) => a.type === 'viewing' && a.status === 'completed' && inRange(a.date, from, to))
  return {
    revenue,
    orders: orders.length,
    rentals: orders.filter((o) => o.type === 'rental').length,
    sales: orders.filter((o) => o.type === 'sale').length,
    volume,
    rentalVolume,
    saleVolume: volume - rentalVolume,
    avgOrder: orders.length ? volume / orders.length : 0,
    outstanding,
    securityHeld,
    utilization: rentable.length ? (rentedDays / (rentable.length * days)) * 100 : 0,
    newClients: s.clients.filter((c) => inRange(dateOf(c.createdAt), from, to)).length,
    visitConversion: viewings.length ? (viewings.filter((v) => booked.has(v.clientId)).length / viewings.length) * 100 : 0,
    activeRentals: s.orders.filter((o) => o.type === 'rental' && o.status === 'picked_up').length,
    dresses: s.products.filter((p) => kind.get(p.typeId) === 'dress' && p.status !== 'sold').length,
  }
}

/** Time buckets of the period with a label for the x axis. */
export function buckets(p: Period): { key: string; from: string; to: string }[] {
  if (p.bucket === 'day') return eachDay(p.from, p.to).map((d) => ({ key: d, from: d, to: d }))
  return eachMonth(p.from, p.to).map((m) => ({ key: m, from: `${m}-01`, to: endOfMonth(`${m}-01`) }))
}

export function revenueSeries(s: Slice, p: Period) {
  const bs = buckets(p)
  const index = new Map(bs.map((b, i) => [b.key, i]))
  const values = bs.map(() => 0)
  for (const pay of s.payments) {
    const d = dateOf(pay.date)
    if (!inRange(d, p.from, p.to)) continue
    const i = index.get(p.bucket === 'day' ? d : d.slice(0, 7))
    if (i != null) values[i] += revenueOf(pay)
  }
  return bs.map((b, i) => ({ key: b.key, value: values[i] }))
}

export function methodBreakdown(s: Slice, from: string, to: string): Record<PaymentMethod, number> {
  const out = { cash: 0, card: 0, terminal: 0, transfer: 0, click: 0, payme: 0 } as Record<PaymentMethod, number>
  for (const p of s.payments) {
    if (p.fromDeposit || !inRange(dateOf(p.date), from, to)) continue
    const v = revenueOf(p)
    if (v > 0) out[p.method] += v
  }
  return out
}

/** Order value attributed to each product type (items only). */
export function typeBreakdown(s: Slice, from: string, to: string) {
  const byProduct = new Map(s.products.map((p) => [p.id, p]))
  const out = new Map<ID, { revenue: number; count: number }>()
  for (const o of liveOrders(s, from, to)) {
    for (const i of o.items) {
      const typeId = byProduct.get(i.productId)?.typeId
      if (!typeId) continue
      const row = out.get(typeId) ?? { revenue: 0, count: 0 }
      row.revenue += i.price * i.qty
      row.count += i.qty
      out.set(typeId, row)
    }
  }
  return out
}

export function statusBreakdown(s: Slice): Record<ProductStatus, number> {
  const kind = new Map(s.productTypes.map((t) => [t.id, t.kind]))
  const out = { available: 0, reserved: 0, rented: 0, sold: 0, cleaning: 0 } as Record<ProductStatus, number>
  for (const p of s.products) if (kind.get(p.typeId) === 'dress') out[p.status] += 1
  return out
}

export interface DressRow {
  id: ID
  rentals: number
  sold: boolean
  periodRevenue: number
  lifetimeRevenue: number
}

/** Revenue each dress earned from its order lines, in the period and over its life. */
export function dressRevenue(s: Slice, from: string, to: string): Map<ID, DressRow> {
  const out = new Map<ID, DressRow>()
  for (const o of s.orders) {
    if (o.status === 'cancelled') continue
    const inPeriod = inRange(dateOf(o.createdAt), from, to)
    for (const i of o.items) {
      const row = out.get(i.productId) ?? { id: i.productId, rentals: 0, sold: false, periodRevenue: 0, lifetimeRevenue: 0 }
      row.lifetimeRevenue += i.price * i.qty
      if (inPeriod) {
        row.periodRevenue += i.price * i.qty
        if (o.type === 'rental') row.rentals += 1
        else row.sold = true
      }
      out.set(i.productId, row)
    }
  }
  return out
}

export interface StaffRow {
  orders: number
  volume: number
  commission: number
  appointments: number
}

export function staffPerformance(s: Slice, staff: DB['staff'], from: string, to: string): Map<ID, StaffRow> {
  const out = new Map<ID, StaffRow>(staff.map((x) => [x.id, { orders: 0, volume: 0, commission: 0, appointments: 0 }]))
  const rate = new Map(staff.map((x) => [x.id, x.commissionRate]))
  for (const o of liveOrders(s, from, to)) {
    const row = o.staffId ? out.get(o.staffId) : undefined
    if (!row) continue
    const base = itemsSubtotal(o) - o.discount
    row.orders += 1
    row.volume += base
    row.commission += (base * (rate.get(o.staffId!) ?? 0)) / 100
  }
  for (const a of s.appointments) {
    if (a.status === 'completed' && a.staffId && inRange(a.date, from, to)) {
      const row = out.get(a.staffId)
      if (row) row.appointments += 1
    }
  }
  return out
}

export function weddingsAhead(orders: Order[], today: string, months = 6) {
  const keys = eachMonth(today, addMonths(today, months - 1))
  const counts = new Map(keys.map((k) => [k, 0]))
  for (const o of orders) {
    if (o.status === 'cancelled' || !o.weddingDate || o.weddingDate < today) continue
    const k = o.weddingDate.slice(0, 7)
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1)
  }
  return keys.map((k) => ({ key: k, value: counts.get(k)! }))
}

/** Payment methods in four groups, so a pie never needs more than four colours. */
export const METHOD_GROUPS: { key: 'cash' | 'card' | 'mobile' | 'transfer'; methods: PaymentMethod[] }[] = [
  { key: 'cash', methods: ['cash'] },
  { key: 'card', methods: ['card', 'terminal'] },
  { key: 'mobile', methods: ['click', 'payme'] },
  { key: 'transfer', methods: ['transfer'] },
]

export function methodGroupTotals(byMethod: Record<PaymentMethod, number>) {
  return METHOD_GROUPS.map((g) => ({ key: g.key, value: g.methods.reduce((sum, m) => sum + byMethod[m], 0) }))
}

export interface MixGroup {
  key: string
  /** The product type behind the group; absent for the accessories and "other" groups. */
  typeId?: ID
  value: number
}

/**
 * Order value by product group for a pie: the first three dress types each get a slice,
 * all accessories share one, and any further dress types fall into "other".
 */
export function salesMix(s: Slice, from: string, to: string): MixGroup[] {
  const byType = typeBreakdown(s, from, to)
  const dressTypes = s.productTypes.filter((t) => t.kind === 'dress')
  const main = dressTypes.slice(0, 3)
  const value = (ids: ID[]) => ids.reduce((sum, id) => sum + (byType.get(id)?.revenue ?? 0), 0)
  return [
    ...main.map((t) => ({ key: t.id, typeId: t.id, value: value([t.id]) })),
    { key: 'accessories', value: value(s.productTypes.filter((t) => t.kind === 'accessory').map((t) => t.id)) },
    { key: 'other', value: value(dressTypes.slice(3).map((t) => t.id)) },
  ]
}
