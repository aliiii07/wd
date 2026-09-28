import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, CalendarHeart, ChevronLeft, ChevronRight, Gem, Users } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { monthNames, weekdayShort } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { isOverdue } from '../data/domain'
import { addDays, addMonths, diffDays, eachDay, endOfMonth, parseDate, startOfMonth, todayStr, weekday } from '../lib/date'
import { Page } from '../components/Layout'
import { Chip, Empty } from '../components/ui'
import type { Appointment, Order } from '../data/types'

type Tab = 'month' | 'timeline'
type Ev =
  | { kind: 'wedding' | 'pickup' | 'return' | 'overdue'; order: Order }
  | { kind: 'appt'; appt: Appointment }

export default function CalendarPage() {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<Tab>('month')
  const [month, setMonth] = useState(startOfMonth(todayStr()))
  const d = parseDate(month)
  const nav = (n: number) => setMonth(addMonths(month, n))

  return (
    <Page title={t('cal.title')} tabs={[{ key: 'month', label: t('cal.month') }, { key: 'timeline', label: t('cal.timeline') }]} active={tab} onTab={(k) => setTab(k as Tab)}>
      <div className="row between">
        <div className="row">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="prev"><ChevronLeft /></button>
          <h2 className="section-title" style={{ minWidth: 190, textAlign: 'center' }}>{monthNames[lang][d.getMonth()]} {d.getFullYear()}</h2>
          <button className="icon-btn" onClick={() => nav(1)} aria-label="next"><ChevronRight /></button>
          <button className="btn btn-outline btn-sm" onClick={() => setMonth(startOfMonth(todayStr()))}>{t('c.today')}</button>
        </div>
        {tab === 'month' ? (
          <div className="legend">
            <span><i className="ev-wedding" />{t('cal.wedding')}</span>
            <span><i className="ev-pickup" />{t('cal.pickup')}</span>
            <span><i className="ev-return" style={{ border: '1px solid var(--line-2)' }} />{t('cal.return')}</span>
            <span><i className="ev-appt" />{t('cal.appointment')}</span>
            <span><i className="ev-overdue" />{t('c.overdue')}</span>
          </div>
        ) : (
          <div className="legend">
            <span><i style={{ background: 'var(--gold)' }} />{t('orderStatus.booked')}</span>
            <span><i style={{ background: 'var(--ink)' }} />{t('status.rented')}</span>
            <span><i style={{ background: 'var(--bad)' }} />{t('c.overdue')}</span>
            <span><i style={{ background: 'var(--info-bg)', border: '1px solid #cfc7ea' }} />{t('orderType.sale')}</span>
            <span><i style={{ background: 'repeating-linear-gradient(135deg,#e6dfd0 0 3px,#f4f0e6 3px 6px)' }} />{t('cal.cleaning')}</span>
            <span><i style={{ background: 'var(--gold-light)', border: '1.5px solid var(--ink)', transform: 'rotate(45deg) scale(.7)' }} />{t('cal.wedding')}</span>
          </div>
        )}
      </div>
      {tab === 'month' ? <MonthView month={month} /> : <Timeline month={month} />}
    </Page>
  )
}

function MonthView({ month }: { month: string }) {
  const { t, lang, date } = useI18n()
  const scoped = useScoped()
  const L = useLookups()
  const navTo = useNavigate()
  const today = todayStr()
  const [sel, setSel] = useState<string>(today.slice(0, 7) === month.slice(0, 7) ? today : month)
  const start = addDays(month, -weekday(month))
  const last = endOfMonth(month)
  const end = addDays(last, 6 - weekday(last))
  const days = eachDay(start, end)

  const byDay = useMemo(() => {
    const m = new Map<string, Ev[]>()
    const push = (d: string | undefined, e: Ev) => {
      if (!d || d < start || d > end) return
      const list = m.get(d)
      if (list) list.push(e)
      else m.set(d, [e])
    }
    for (const o of scoped.orders) {
      if (o.status === 'cancelled') continue
      push(o.weddingDate, { kind: 'wedding', order: o })
      push(o.pickupDate, { kind: 'pickup', order: o })
      if (o.type === 'rental') push(o.returnDate, { kind: isOverdue(o, today) ? 'overdue' : 'return', order: o })
    }
    for (const a of scoped.appointments) {
      if (a.status === 'cancelled' || a.type === 'pickup' || a.type === 'return') continue
      push(a.date, { kind: 'appt', appt: a })
    }
    return m
  }, [scoped, start, end, today])

  const cls = { wedding: 'ev-wedding', pickup: 'ev-pickup', return: 'ev-return', overdue: 'ev-overdue', appt: 'ev-appt' }
  const icon = (k: Ev['kind']) => (k === 'wedding' ? <Gem /> : k === 'pickup' ? <ArrowUpFromLine /> : k === 'appt' ? <Users /> : <ArrowDownToLine />)
  const label = (e: Ev) => (e.kind === 'appt' ? `${e.appt.time} ${L.client.get(e.appt.clientId)?.name ?? ''}` : L.client.get(e.order.clientId)?.name ?? '')
  const selEvents = byDay.get(sel) ?? []

  return (
    <div className="grid g-side">
      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="cal-grid">
          {weekdayShort[lang].map((w) => <div className="cal-dow" key={w}>{w}</div>)}
          {days.map((d) => {
            const evs = byDay.get(d) ?? []
            const shown = evs.filter((e) => e.kind !== 'appt').slice(0, 3)
            const appts = evs.filter((e) => e.kind === 'appt').length
            const extra = evs.filter((e) => e.kind !== 'appt').length - shown.length
            return (
              <button key={d} className={`cal-cell ${d.slice(0, 7) !== month.slice(0, 7) ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''}`} onClick={() => setSel(d)}>
                <span className="cal-daynum"><span>{parseDate(d).getDate()}</span></span>
                {shown.map((e, i) => (
                  <span key={i} className={`cal-ev ${cls[e.kind]}`}>{icon(e.kind)}<span>{label(e)}</span></span>
                ))}
                {appts > 0 && <span className="cal-ev ev-appt"><Users /><span>{appts} {t('cal.appointment').toLowerCase()}</span></span>}
                {extra > 0 && <span className="cal-more">{t('cal.more', { n: extra })}</span>}
              </button>
            )
          })}
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h3><CalendarHeart />{t('cal.dayEvents', { date: date(sel) })}</h3></div>
        {selEvents.length === 0 ? (
          <Empty icon={<CalendarHeart />} title={t('cal.noEvents')} />
        ) : (
          <div className="list">
            {selEvents
              .sort((a, b) => (a.kind === 'appt' ? a.appt.time : '0') .localeCompare(b.kind === 'appt' ? b.appt.time : '0'))
              .map((e, i) => (
                <div
                  key={i}
                  className="list-row click"
                  onClick={() => (e.kind === 'appt' ? navTo(`/clients/${e.appt.clientId}`) : navTo(`/orders/${e.order.id}`))}
                >
                  <span className={`avatar ${cls[e.kind]}`} style={{ border: 0 }}>{icon(e.kind)}</span>
                  <div className="grow">
                    <div className="title">{label(e)}</div>
                    <div className="meta">
                      {e.kind === 'appt'
                        ? `${t(`appt.${e.appt.type}` as DictKey)} · ${L.staff.get(e.appt.staffId ?? '')?.name ?? '—'}`
                        : `${e.order.number} · ${t(`orderType.${e.order.type}` as DictKey)} · ${e.order.items.map((it) => L.product.get(it.productId)?.name).filter(Boolean).slice(0, 2).join(', ')}`}
                    </div>
                  </div>
                  <Chip tone={e.kind === 'wedding' ? 'gold' : e.kind === 'pickup' ? 'dark' : e.kind === 'overdue' ? 'bad' : e.kind === 'appt' ? 'info' : 'neutral'}>
                    {e.kind === 'appt' ? t('cal.appointment') : t(e.kind === 'overdue' ? 'c.overdue' : (`cal.${e.kind}` as DictKey))}
                  </Chip>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Timeline({ month }: { month: string }) {
  const { t, loc, lang } = useI18n()
  const { db } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const navTo = useNavigate()
  const today = todayStr()
  const [typeId, setTypeId] = useState('')
  const [onlyBusy, setOnlyBusy] = useState(true)
  const from = month
  const to = endOfMonth(month)
  const days = eachDay(from, to)
  const dressTypes = db.productTypes.filter((x) => x.kind === 'dress')
  const cleaning = db.settings.cleaningDays

  type Seg = { start: string; end: string; cls: string; order?: Order; label?: string }
  const rows = useMemo(() => {
    const ordersBy = new Map<string, Order[]>()
    for (const o of scoped.orders) {
      if (o.status === 'cancelled') continue
      for (const i of o.items) {
        const list = ordersBy.get(i.productId)
        if (list) list.push(o)
        else ordersBy.set(i.productId, [o])
      }
    }
    return scoped.products
      .filter((p) => dressTypes.some((x) => x.id === p.typeId) && (!typeId || p.typeId === typeId))
      .map((p) => {
        const segs: Seg[] = []
        for (const o of ordersBy.get(p.id) ?? []) {
          if (o.type === 'sale') {
            const s = o.createdAt.slice(0, 10)
            const e = o.status === 'completed' ? o.pickedUpAt?.slice(0, 10) ?? o.pickupDate : o.pickupDate
            segs.push({ start: s, end: e, cls: 'sale', order: o })
            continue
          }
          const overdue = isOverdue(o, today)
          const end = overdue ? today : o.returnedAt?.slice(0, 10) ?? o.returnDate ?? o.pickupDate
          const cls = overdue ? 'overdue' : o.status === 'booked' ? 'booked' : 'out'
          segs.push({ start: o.pickupDate, end, cls, order: o })
          if (cleaning > 0 && !overdue) segs.push({ start: addDays(end, 1), end: addDays(end, cleaning), cls: 'clean' })
        }
        return { p, segs: segs.filter((s) => s.end >= from && s.start <= to) }
      })
      .filter((r) => !onlyBusy || r.segs.some((s) => s.cls !== 'clean'))
      .sort((a, b) => a.p.code.localeCompare(b.p.code))
  }, [scoped, typeId, onlyBusy, from, to, today, cleaning, dressTypes])

  const col = (d: string) => Math.min(days.length, Math.max(1, diffDays(from, d) + 1))
  const cols = `repeat(${days.length}, 32px)`
  const todayCol = today >= from && today <= to ? col(today) : null

  return (
    <section className="card">
      <div className="toolbar">
        <select id="tl-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">{t('pr.allTypes')}</option>
          {dressTypes.map((x) => <option key={x.id} value={x.id}>{loc(x.name)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={onlyBusy} onChange={(e) => setOnlyBusy(e.target.checked)} />{t('cal.onlyBusy')}</label>
        <span className="spacer" />
        <span className="muted small">{rows.length} {t('an.dresses').toLowerCase()}</span>
      </div>
      {rows.length === 0 ? (
        <Empty icon={<Gem />} title={t('cal.noEvents')} />
      ) : (
        <div className="tl">
          <div className="tl-row tl-head">
            <div className="tl-name">{t('c.product')}</div>
            <div className="tl-track" style={{ gridTemplateColumns: cols }}>
              {days.map((d) => {
                const wd = weekday(d)
                return (
                  <div key={d} className={`tl-day ${d === today ? 'today' : ''} ${wd >= 5 ? 'we' : ''}`}>
                    <span>{parseDate(d).getDate()}</span>
                    <small>{weekdayShort[lang][wd].slice(0, 2)}</small>
                  </div>
                )
              })}
            </div>
          </div>
          {rows.map(({ p, segs }) => (
            <div className="tl-row" key={p.id}>
              <button className="tl-name" onClick={() => navTo(`/products/${p.id}`)} title={`${p.code} · ${p.name}`}>
                <b>{p.name}</b>
                <span>{p.code} · {p.size} · {loc(L.type.get(p.typeId)!.name)}</span>
              </button>
              <div className="tl-track" style={{ gridTemplateColumns: cols, backgroundSize: '32px 100%' }}>
                {todayCol && <span className="tl-today" style={{ gridColumn: `${todayCol} / ${todayCol + 1}` }} />}
                {segs.map((s, i) => {
                  const a = col(s.start < from ? from : s.start)
                  const b = col(s.end > to ? to : s.end)
                  const client = s.order ? L.client.get(s.order.clientId)?.name : undefined
                  return (
                    <span
                      key={i}
                      className={`tl-bar ${s.cls} ${s.start >= from ? 'start' : ''} ${s.end <= to ? 'end' : ''}`}
                      style={{ gridColumn: `${a} / ${b + 1}` }}
                      title={s.order ? `${s.order.number} · ${client ?? ''} · ${s.order.pickupDate} → ${s.order.returnDate ?? ''}` : t('cal.cleaning')}
                      onClick={() => s.order && navTo(`/orders/${s.order.id}`)}
                    >
                      {s.order && b - a >= 1 ? client : ''}
                    </span>
                  )
                })}
                {segs
                  .filter((s) => s.order?.weddingDate && s.order.weddingDate >= from && s.order.weddingDate <= to && s.cls !== 'sale')
                  .map((s) => (
                    <span key={`w${s.order!.id}`} className="tl-wedding" style={{ gridColumn: `${col(s.order!.weddingDate!)} / ${col(s.order!.weddingDate!) + 1}` }} title={t('cal.wedding')} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
