import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CalendarHeart, CalendarPlus, CircleDollarSign, ClipboardPlus, Gem,
  Inbox, Scissors, ShoppingBag, UserPlus, Wallet,
} from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { groupByOrder, isOverdue, lateDays, orderMoney, revenueOf } from '../data/domain'
import { addDays, dateOf, diffDays, timeOf, todayStr } from '../lib/date'
import { Page } from '../components/Layout'
import { AppointmentFormModal, ClientFormModal } from '../components/forms'
import { apptTone, Avatar, Chip, Empty, pctChange, Stat } from '../components/ui'
import { Donut, useMethodSlices } from '../components/charts'
import { methodBreakdown, sliceFor } from '../data/analytics'
import type { Appointment, Order } from '../data/types'

export default function Today() {
  const { t, money, moneyShort, date, dateShort } = useI18n()
  const { user, scope, db, mutate } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const today = todayStr()
  const [apptOpen, setApptOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const pays = useMemo(() => groupByOrder(db.payments), [db.payments])

  const revenueOn = (d: string) => scoped.payments.filter((p) => dateOf(p.date) === d).reduce((s, p) => s + revenueOf(p), 0)
  const revToday = revenueOn(today)
  const revYesterday = revenueOn(addDays(today, -1))

  const apptsToday = scoped.appointments
    .filter((a) => a.date === today && a.status !== 'cancelled' && a.type !== 'pickup' && a.type !== 'return')
    .sort((a, b) => a.time.localeCompare(b.time))
  const pickupsToday = scoped.orders.filter((o) => o.status === 'booked' && o.pickupDate === today)
  const returnsToday = scoped.orders.filter((o) => o.status === 'picked_up' && o.type === 'rental' && o.returnDate === today)
  const overdue = scoped.orders.filter((o) => isOverdue(o, today))

  type Handover = { o: Order; kind: 'pickup' | 'return' | 'overdue'; date: string }
  const handovers: Handover[] = [
    ...overdue.map((o) => ({ o, kind: 'overdue' as const, date: o.returnDate! })),
    ...scoped.orders.filter((o) => o.status === 'booked' && o.pickupDate >= today && o.pickupDate <= addDays(today, 2)).map((o) => ({ o, kind: 'pickup' as const, date: o.pickupDate })),
    ...scoped.orders.filter((o) => o.status === 'picked_up' && o.type === 'rental' && o.returnDate && o.returnDate >= today && o.returnDate <= addDays(today, 2)).map((o) => ({ o, kind: 'return' as const, date: o.returnDate! })),
  ].sort((a, b) => (a.kind === 'overdue' ? -1 : b.kind === 'overdue' ? 1 : a.date.localeCompare(b.date)))

  const weddings = scoped.orders
    .filter((o) => (o.status === 'booked' || o.status === 'picked_up') && o.weddingDate && o.weddingDate >= today && o.weddingDate <= addDays(today, 14))
    .sort((a, b) => a.weddingDate!.localeCompare(b.weddingDate!))

  const methodSlices = useMethodSlices(methodBreakdown(sliceFor(db, scope === 'all' ? 'all' : [scope]), today, today))
  const byBranch = db.branches.map((b) => ({ b, value: db.payments.filter((p) => p.branchId === b.id && dateOf(p.date) === today).reduce((s, p) => s + revenueOf(p), 0) }))

  const altsDue = scoped.alterations
    .filter((a) => a.status !== 'delivered' && a.dueDate <= addDays(today, 5))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
  const newLeads = scoped.leads.filter((l) => l.stage === 'new').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  const setApptStatus = (a: Appointment, status: Appointment['status']) =>
    mutate((d) => {
      const x = d.appointments.find((y) => y.id === a.id)
      if (x) x.status = status
    })

  const dayLabel = (d: string) => (d === today ? t('c.today') : d === addDays(today, 1) ? t('c.tomorrow') : dateShort(d))
  const nowHHMM = timeOf(new Date().toISOString())
  const nextIdx = apptsToday.findIndex((a) => a.status === 'scheduled' && a.time >= nowHHMM)

  return (
    <Page title={t('today.title')} crumb={date(today)}>
      <div className="card hero-bar">
        <div>
          <h2>{t('today.greeting', { name: (user?.role === 'founder' ? user.name.split(' ')[0] : user?.name) ?? '' })}</h2>
          <div className="date">{scope === 'all' ? t('c.allBranches') : `${t('c.branch')}: ${L.branch.get(scope)?.name}`}</div>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => nav('/orders/new')}><ClipboardPlus />{t('qa.newOrder')}</button>
          <button className="btn btn-outline" onClick={() => setApptOpen(true)}><CalendarPlus />{t('qa.newAppointment')}</button>
          <button className="btn btn-gold" onClick={() => nav('/payments?tab=pos')}><ShoppingBag />{t('qa.quickSale')}</button>
          <button className="btn btn-outline" onClick={() => setClientOpen(true)}><UserPlus />{t('qa.newClient')}</button>
        </div>
      </div>

      <div className="stats">
        <Stat icon={<CircleDollarSign />} label={t('today.revenue')} value={<span title={money(revToday)}>{moneyShort(revToday)}</span>} delta={{ pct: pctChange(revToday, revYesterday), label: t('today.vsYesterday') }} />
        <Stat icon={<CalendarHeart />} label={t('today.appointments')} value={apptsToday.length} hint={`${apptsToday.filter((a) => a.status === 'completed').length} ${t('apptStatus.completed').toLowerCase()}`} />
        <Stat icon={<ArrowUpFromLine />} label={t('today.pickups')} value={pickupsToday.length} />
        <Stat icon={<ArrowDownToLine />} label={t('today.returns')} value={returnsToday.length} />
        <Stat icon={<AlertTriangle />} label={t('today.overdue')} value={overdue.length} alert={overdue.length > 0} />
      </div>

      <div className="grid g-main">
        <section className="card">
          <div className="card-head">
            <h3><CalendarHeart />{t('today.schedule')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/appointments')}>{t('c.seeAll')}</button>
          </div>
          {apptsToday.length === 0 ? (
            <Empty icon={<CalendarHeart />} title={t('today.noSchedule')} />
          ) : (
            <div className="list">
              {apptsToday.map((a, i) => {
                const c = L.client.get(a.clientId)
                return (
                  <div className="list-row" key={a.id}>
                    <span className={`time-badge ${i === nextIdx ? 'now' : ''}`}>{a.time}</span>
                    <div className="grow">
                      <div className="title">
                        <button className="btn-link" onClick={() => c && nav(`/clients/${c.id}`)} style={{ all: 'unset', cursor: 'pointer' }}>{c?.name}</button>
                      </div>
                      <div className="meta">
                        {t(`appt.${a.type}` as DictKey)} · {L.staff.get(a.staffId ?? '')?.name ?? '—'} · <span className="num">{c?.phone}</span>
                      </div>
                    </div>
                    <Chip tone={apptTone[a.status]}>{t(`apptStatus.${a.status}` as DictKey)}</Chip>
                    {a.status === 'scheduled' && (
                      <div className="row nowrap-row" style={{ gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setApptStatus(a, 'completed')}>{t('ap.complete')}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setApptStatus(a, 'no_show')}>{t('ap.noShow')}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3><Gem />{t('today.handovers')}</h3>
            <span className="sub">{t('today.next3')}</span>
          </div>
          {handovers.length === 0 ? (
            <Empty icon={<Gem />} title={t('today.noHandovers')} />
          ) : (
            <div className="list">
              {handovers.map(({ o, kind, date: d }) => {
                const c = L.client.get(o.clientId)
                const m = orderMoney(o, pays.get(o.id))
                return (
                  <div className="list-row click" key={`${kind}${o.id}`} onClick={() => nav(`/orders/${o.id}`)}>
                    <span className="avatar" style={kind === 'overdue' ? { background: 'var(--bad-bg)', color: 'var(--bad)', borderColor: '#efc9c5' } : kind === 'pickup' ? { background: 'var(--ink)', color: 'var(--gold-light)', borderColor: 'var(--ink)' } : undefined}>
                      {kind === 'return' || kind === 'overdue' ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                    </span>
                    <div className="grow">
                      <div className="title">{c?.name}</div>
                      <div className="meta">
                        {o.number} · {kind === 'overdue' ? t('today.lateBy', { n: lateDays(o, today) }) : `${kind === 'pickup' ? t('cal.pickup') : t('cal.return')} · ${dayLabel(d)}`}
                      </div>
                    </div>
                    {kind === 'pickup' ? (
                      m.balance > 0 ? <Chip tone="warn">{t('today.balanceDue', { amount: money(m.balance) })}</Chip> : <Chip tone="good">{t('today.fullyPaid')}</Chip>
                    ) : kind === 'overdue' ? (
                      <Chip tone="bad">{t('c.overdue')}</Chip>
                    ) : (
                      <Chip tone="dark">{t('orderStatus.picked_up')}</Chip>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid g-2">
        <section className="card">
          <div className="card-head">
            <h3><Wallet />{t('today.payments')}</h3>
            <span className="sub">{scope === 'all' ? t('c.allBranches') : L.branch.get(scope)?.name}</span>
          </div>
          <div className="card-body stack">
            <Donut parts={methodSlices} format={money} centerFormat={moneyShort} centerLabel={t('c.total')} emptyLabel={t('today.noPayments')} />
            {scope === 'all' && db.branches.length > 1 && (
              <table className="table">
                <thead>
                  <tr><th>{t('c.branch')}</th><th className="num">{t('an.revenue')}</th></tr>
                </thead>
                <tbody>
                  {byBranch.map(({ b, value }) => (
                    <tr key={b.id}><td>{b.name}</td><td className="num">{money(value)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3><CalendarHeart />{t('today.weddings')}</h3>
            <span className="sub">{t('today.weddingsHint')}</span>
          </div>
          {weddings.length === 0 ? (
            <Empty icon={<CalendarHeart />} title={t('today.noWeddings')} />
          ) : (
            <div className="countdowns">
              {weddings.map((o) => {
                const c = L.client.get(o.clientId)
                const days = diffDays(today, o.weddingDate!)
                const m = orderMoney(o, pays.get(o.id))
                return (
                  <div className={`countdown ${days <= 2 ? 'hot' : ''}`} key={o.id} onClick={() => nav(`/orders/${o.id}`)} role="button" tabIndex={0}>
                    <span className="days">
                      <b className="num">{days}</b>
                      <small>{t('c.days', { n: '' }).trim()}</small>
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c?.name}</div>
                      <div className="cell-sub">{days === 0 ? t('today.weddingToday') : days === 1 ? t('today.weddingTomorrow') : date(o.weddingDate)}</div>
                      <div style={{ marginTop: 6 }}>
                        {m.balance > 0 ? <Chip tone="warn">{t('today.balanceDue', { amount: money(m.balance) })}</Chip> : <Chip tone="good">{t('today.fullyPaid')}</Chip>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid g-2">
        <section className="card">
          <div className="card-head">
            <h3><Scissors />{t('today.alterations')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/alterations')}>{t('c.seeAll')}</button>
          </div>
          {altsDue.length === 0 ? (
            <Empty icon={<Scissors />} title={t('today.noAlterations')} />
          ) : (
            <div className="list">
              {altsDue.map((a) => (
                <div className="list-row click" key={a.id} onClick={() => nav('/alterations')}>
                  <div className="grow">
                    <div className="title">{L.client.get(a.clientId)?.name}</div>
                    <div className="meta">{L.product.get(a.productId)?.name} · {L.staff.get(a.tailorId ?? '')?.name ?? '—'}</div>
                  </div>
                  <Chip tone={a.dueDate < today ? 'bad' : a.status === 'ready' ? 'good' : 'gold'}>
                    {a.status === 'ready' ? t('alt.ready') : dayLabel(a.dueDate)}
                  </Chip>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3><Inbox />{t('today.leads')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/leads')}>{t('c.seeAll')}</button>
          </div>
          {newLeads.length === 0 ? (
            <Empty icon={<Inbox />} title={t('today.noLeads')} />
          ) : (
            <div className="list">
              {newLeads.map((l) => (
                <div className="list-row click" key={l.id} onClick={() => nav('/leads')}>
                  <Avatar name={l.name} />
                  <div className="grow">
                    <div className="title">{l.name}</div>
                    <div className="meta">{t(`source.${l.source}` as DictKey)} · {t(`interest.${l.interest}` as DictKey)}{l.weddingDate ? ` · ${dateShort(l.weddingDate)}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AppointmentFormModal open={apptOpen} onClose={() => setApptOpen(false)} />
      <ClientFormModal open={clientOpen} onClose={() => setClientOpen(false)} onSaved={(id) => nav(`/clients/${id}`)} />
    </Page>
  )
}
