// Reminders the boutique should send today, derived from orders, appointments and alterations.
import type { Alteration, Appointment, Branch, Client, DB, ID, Lang, Order, Payment, ReminderType } from './types'
import { addDays, diffDays, dotDate } from '../lib/date'
import { groupByOrder, isOverdue, lateDays, orderMoney, planRows } from './domain'
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
  alterations: Alteration[]
  payments: Payment[]
  smsLog: DB['smsLog']
}

export function computeReminders(src: Sources, today: string): Reminder[] {
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
      if (until >= 0 && until <= 2) {
        out.push({ ...base, key: `pickup:${o.id}`, type: 'pickup', date: o.pickupDate, amount: money.balance })
      } else if (money.balance > 0 && until > 2) {
        const late = planRows(o, money.paid, today).find((r) => r.state === 'late')
        if (until <= 7 || late) {
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
      if (days >= 1 && days <= 7) out.push({ ...base, key: `wedding:${o.id}`, type: 'wedding', date: o.weddingDate, days })
    }
  }

  for (const a of src.alterations) {
    if (a.status === 'ready') out.push({ key: `alteration_ready:${a.id}`, type: 'alteration_ready', branchId: a.branchId, clientId: a.clientId, date: a.dueDate })
  }

  const order: ReminderType[] = ['overdue', 'pickup', 'return', 'balance', 'appointment', 'alteration_ready', 'wedding']
  return out
    .filter((r) => !sent.has(r.key))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.date.localeCompare(b.date))
}

export function renderSms(template: string, r: Pick<Reminder, 'date' | 'time' | 'days' | 'amount'>, client: Client, branch: Branch | undefined, storeName: string, lang: Lang = client.lang): string {
  const vars: Record<string, string> = {
    name: client.name.split(' ')[0],
    date: r.date ? dotDate(r.date) : '',
    time: r.time ?? '',
    days: r.days != null ? String(r.days) : '',
    amount: r.amount != null ? formatMoney(r.amount, lang) : '',
    store: storeName,
    phone: branch?.phone ?? '',
  }
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
}
