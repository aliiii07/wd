// Reminders the boutique should send today, derived from orders and appointments.
import type { Appointment, Branch, Client, DB, ID, Lang, Order, Payment, ReminderType, SmsSettings } from './types'
import { addDays, diffDays, dotDate } from '../lib/date'
import { groupByOrder, isActiveOrder, isOverdue, lateDays, orderMoney, planRows } from './domain'
import { formatMoney } from '../i18n'

export interface Reminder {
  key: string
  type: ReminderType
  branchId: ID
  clientId: ID
  /** The date the reminder is about (appointment day, pickup day…). */
  date: string
  time?: string
  days?: number
  amount?: number
  orderId?: ID
}

interface Sources {
  orders: Order[]
  appointments: Appointment[]
  payments: Payment[]
  smsLog: DB['smsLog']
}

type Rules = Pick<SmsSettings, 'reminders' | 'pickupDaysAhead' | 'weddingDaysAhead' | 'balanceDaysAhead'>

export const REMINDER_ORDER: ReminderType[] = ['overdue', 'pickup', 'return', 'balance', 'appointment', 'wedding']

export function computeReminders(src: Sources, today: string, rules: Rules): Reminder[] {
  const sent = new Set(src.smsLog.map((s) => s.refKey).filter(Boolean))
  const pays = groupByOrder(src.payments)
  const out: Reminder[] = []
  const tomorrow = addDays(today, 1)

  for (const a of src.appointments) {
    if (a.status === 'scheduled' && a.date === tomorrow && a.type !== 'pickup' && a.type !== 'return') {
      out.push({ key: `appointment:${a.id}`, type: 'appointment', branchId: a.branchId, clientId: a.clientId, date: a.date, time: a.time })
    }
  }

  for (const o of src.orders) {
    const money = orderMoney(o, pays.get(o.id))
    const base = { branchId: o.branchId, clientId: o.clientId, orderId: o.id }
    if (o.status === 'booked') {
      const until = diffDays(today, o.pickupDate)
      if (until >= 0 && until <= rules.pickupDaysAhead) {
        out.push({ ...base, key: `pickup:${o.id}`, type: 'pickup', date: o.pickupDate, amount: money.balance })
      } else if (money.balance > 0 && until > rules.pickupDaysAhead) {
        const late = planRows(o, money.paid, today).find((r) => r.state === 'late')
        if (until <= rules.balanceDaysAhead || late) {
          const due = late ? late.dueDate : addDays(o.pickupDate, -1)
          out.push({ ...base, key: `balance:${o.id}:${due}`, type: 'balance', date: due < today ? today : due, amount: money.balance })
        }
      }
    }
    if (o.type === 'rental' && o.status === 'picked_up' && o.returnDate) {
      if (isOverdue(o, today)) {
        out.push({ ...base, key: `overdue:${o.id}:${today}`, type: 'overdue', date: o.returnDate, days: lateDays(o, today) })
      } else if (o.returnDate === today || o.returnDate === tomorrow) {
        out.push({ ...base, key: `return:${o.id}`, type: 'return', date: o.returnDate })
      }
    }
    if ((o.status === 'booked' || o.status === 'picked_up') && o.weddingDate) {
      const days = diffDays(today, o.weddingDate)
      if (days >= 1 && days <= rules.weddingDaysAhead) out.push({ ...base, key: `wedding:${o.id}`, type: 'wedding', date: o.weddingDate, days })
    }
  }

  return out
    .filter((r) => rules.reminders[r.type] !== false && !sent.has(r.key))
    .sort((a, b) => REMINDER_ORDER.indexOf(a.type) - REMINDER_ORDER.indexOf(b.type) || a.date.localeCompare(b.date))
}

type Fill = Pick<Reminder, 'date' | 'time' | 'days' | 'amount'>

/** Fills a template's placeholders. With `keepMissing`, a value we don't know stays as `{days}` so the sender notices it. */
export function renderSms(template: string, r: Fill, client: Client, branch: Branch | undefined, storeName: string, lang: Lang = client.lang, keepMissing = false): string {
  const vars: Record<string, string> = {
    name: client.name.split(' ')[0],
    date: r.date ? dotDate(r.date) : '',
    time: r.time ?? '',
    days: r.days != null ? String(r.days) : '',
    // number formatting uses no-break spaces, which would switch the SMS to Unicode (70 characters a part)
    amount: r.amount != null ? formatMoney(r.amount, lang).replace(/[\u00a0\u202f]/g, ' ') : '',
    store: storeName,
    phone: branch?.phone ?? '',
  }
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars && (vars[k] || !keepMissing) ? vars[k] : m))
}

/** Values for a template sent by hand to one client: her next visit, pickup, return, balance or wedding. */
export function templateFill(type: ReminderType, client: Pick<Client, 'id' | 'weddingDate'>, src: Pick<Sources, 'orders' | 'appointments' | 'payments'>, today: string): Fill {
  const pays = groupByOrder(src.payments)
  const live = src.orders.filter((o) => o.clientId === client.id && isActiveOrder(o))
  const balanceOf = (o: Order) => orderMoney(o, pays.get(o.id)).balance
  const debt = live.reduce((sum, o) => sum + balanceOf(o), 0)
  switch (type) {
    case 'appointment': {
      const a = src.appointments
        .filter((x) => x.clientId === client.id && x.status === 'scheduled' && x.date >= today)
        .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))[0]
      return a ? { date: a.date, time: a.time } : { date: '' }
    }
    case 'pickup': {
      const o = live.filter((x) => x.status === 'booked').sort((x, y) => x.pickupDate.localeCompare(y.pickupDate))[0]
      return o ? { date: o.pickupDate, amount: balanceOf(o) } : { date: '', amount: debt }
    }
    case 'return':
    case 'overdue': {
      const o = live.filter((x) => x.status === 'picked_up' && x.returnDate).sort((x, y) => x.returnDate!.localeCompare(y.returnDate!))[0]
      if (!o) return { date: '' }
      const late = diffDays(o.returnDate!, today)
      return { date: o.returnDate!, days: type === 'overdue' ? (late > 0 ? late : undefined) : Math.max(0, -late) }
    }
    case 'wedding': {
      const w = client.weddingDate ?? live.map((o) => o.weddingDate).filter((d): d is string => !!d).sort()[0]
      const left = w ? diffDays(today, w) : -1
      return w && left >= 0 ? { date: w, days: left } : { date: w ?? '' }
    }
    case 'balance':
      return { date: today, amount: debt }
  }
}
