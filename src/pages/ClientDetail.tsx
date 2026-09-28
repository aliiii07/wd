import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarHeart, CalendarPlus, ClipboardList, ClipboardPlus, MessageSquare, Pencil, Ruler, Scissors, Trash2, Users } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { displayStatus, groupByOrder, orderMoney } from '../data/domain'
import { diffDays, todayStr } from '../lib/date'
import { Page } from '../components/Layout'
import { AppointmentFormModal, ClientFormModal, MEAS_KEYS } from '../components/forms'
import { SmsComposeModal } from '../components/sms'
import { altTone, apptTone, Avatar, Chip, Empty, orderTone, useConfirm, useToast } from '../components/ui'

export default function ClientDetail() {
  const { id } = useParams()
  const { t, money, date, dateShort, dateTime } = useI18n()
  const { db, remove } = useStore()
  const L = useLookups()
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const today = todayStr()
  const [modal, setModal] = useState<'' | 'edit' | 'appt' | 'sms'>('')
  const client = db.clients.find((c) => c.id === id)
  const pays = useMemo(() => groupByOrder(db.payments), [db.payments])

  if (!client) {
    return <Page title={t('cl.title')}><Empty icon={<Users />} title={t('c.nothingFound')} action={<Link className="btn btn-outline" to="/clients">{t('c.back')}</Link>} /></Page>
  }
  const orders = db.orders.filter((o) => o.clientId === client.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const appts = db.appointments.filter((a) => a.clientId === client.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const alts = db.alterations.filter((a) => a.clientId === client.id)
  const sms = db.smsLog.filter((s) => s.clientId === client.id)
  const totals = orders.filter((o) => o.status !== 'cancelled').reduce(
    (s, o) => {
      const m = orderMoney(o, pays.get(o.id))
      return { paid: s.paid + m.paid, balance: s.balance + m.balance }
    },
    { paid: 0, balance: 0 },
  )
  const days = client.weddingDate ? diffDays(today, client.weddingDate) : null
  const meas = client.measurements

  const del = async () => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('clients', client.id)
    toast(t('c.deleted'))
    nav('/clients')
  }

  return (
    <Page title={client.name} crumb={L.branch.get(client.branchId)?.name}>
      <div className="grid g-side">
        <section className="card">
          <div className="card-body row" style={{ gap: 18, alignItems: 'flex-start' }}>
            <Avatar name={client.name} lg />
            <div className="stack sm" style={{ flex: 1, minWidth: 200 }}>
              <h2 className="section-title">{client.name}</h2>
              <div className="soft num">{client.phone}</div>
              <div className="row" style={{ gap: 6 }}>
                <Chip tone="gold" plain>{t(`source.${client.source}` as DictKey)}</Chip>
                <Chip plain>SMS: {t(`lang.${client.lang}` as DictKey)}</Chip>
                <Chip plain>{t('cl.since')}: {dateShort(client.createdAt.slice(0, 10))}</Chip>
              </div>
              {client.notes && <p className="soft">{client.notes}</p>}
            </div>
            <div className="row">
              <button className="btn btn-primary" onClick={() => nav(`/orders/new?client=${client.id}`)}><ClipboardPlus />{t('qa.newOrder')}</button>
              <button className="btn btn-outline" onClick={() => setModal('appt')}><CalendarPlus />{t('qa.newAppointment')}</button>
              <button className="btn btn-outline" onClick={() => setModal('sms')}><MessageSquare />{t('cl.sendSms')}</button>
              <button className="icon-btn" title={t('c.edit')} onClick={() => setModal('edit')}><Pencil /></button>
              {orders.length === 0 && <button className="icon-btn" title={t('c.delete')} onClick={del}><Trash2 /></button>}
            </div>
          </div>
        </section>
        <section className={`card countdown ${days !== null && days >= 0 && days <= 3 ? 'hot' : ''}`} style={{ cursor: 'default', padding: 18 }}>
          <span className="days" style={{ width: 76, height: 76 }}>
            <b className="num" style={{ fontSize: 32 }}>{days !== null && days >= 0 ? days : '—'}</b>
            <small>{t('c.days', { n: '' }).trim()}</small>
          </span>
          <div className="stack sm">
            <span className="label">{t('ord.weddingDate')}</span>
            <span className="strong">{client.weddingDate ? date(client.weddingDate) : t('cl.noWedding')}</span>
            {days !== null && <span className="muted small">{days < 0 ? t('cl.weddingPassed') : days === 0 ? t('today.weddingToday') : t('cl.weddingIn', { n: days })}</span>}
          </div>
        </section>
      </div>

      <div className="stats">
        <div className="card stat"><div className="stat-label"><ClipboardList />{t('cl.orders')}</div><div className="stat-value">{orders.length}</div></div>
        <div className="card stat"><div className="stat-label">{t('cl.totalSpent')}</div><div className="stat-value">{money(totals.paid)}</div></div>
        <div className={`card stat ${totals.balance > 0 ? 'alert' : ''}`}><div className="stat-label">{t('cl.debt')}</div><div className="stat-value">{money(totals.balance)}</div></div>
      </div>

      <div className="grid g-side">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="card-head"><h3><ClipboardList />{t('cl.orders')}</h3></div>
            {orders.length === 0 ? <Empty title={t('ord.empty')} /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t('ord.number')}</th><th>{t('c.type')}</th><th>{t('ord.items')}</th><th>{t('ord.pickupDate')}</th><th className="num">{t('ord.total')}</th><th className="num">{t('ord.balance')}</th><th>{t('c.status')}</th></tr></thead>
                  <tbody>
                    {orders.map((o) => {
                      const m = orderMoney(o, pays.get(o.id))
                      const st = displayStatus(o, today)
                      return (
                        <tr key={o.id} className="click" onClick={() => nav(`/orders/${o.id}`)}>
                          <td className="strong">{o.number}</td>
                          <td>{t(`orderType.${o.type}` as DictKey)}</td>
                          <td>{o.items.map((i) => L.product.get(i.productId)?.name).filter(Boolean).join(', ')}</td>
                          <td className="nowrap">{dateShort(o.pickupDate)}</td>
                          <td className="num">{money(m.total)}</td>
                          <td className="num">{m.balance ? money(m.balance) : '—'}</td>
                          <td><Chip tone={orderTone[st]}>{t(`orderStatus.${st}` as DictKey)}</Chip></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h3><CalendarHeart />{t('cl.appointments')}</h3></div>
            {appts.length === 0 ? <Empty title={t('ap.empty')} /> : (
              <div className="list">
                {appts.map((a) => (
                  <div className="list-row" key={a.id}>
                    <span className="time-badge">{a.time}</span>
                    <div className="grow">
                      <div className="title">{t(`appt.${a.type}` as DictKey)} · {date(a.date)}</div>
                      <div className="meta">{L.staff.get(a.staffId ?? '')?.name ?? '—'}{a.productIds.length ? ` · ${a.productIds.map((p) => L.product.get(p)?.name).filter(Boolean).join(', ')}` : ''}</div>
                    </div>
                    <Chip tone={apptTone[a.status]}>{t(`apptStatus.${a.status}` as DictKey)}</Chip>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="card-head">
              <h3><Ruler />{t('cl.measurements')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal('edit')}><Pencil />{t('c.edit')}</button>
            </div>
            <div className="card-body">
              <dl className="kv">
                {MEAS_KEYS.map((k) => (
                  <Fragment key={k}><dt>{t(`meas.${k}` as DictKey)}</dt><dd>{meas[k] ? `${meas[k]} ${k === 'shoe' ? '' : t('c.cm')}` : '—'}</dd></Fragment>
                ))}
              </dl>
              {meas.updatedAt && <div className="muted small" style={{ marginTop: 10 }}>{date(meas.updatedAt)}</div>}
            </div>
          </section>
          {alts.length > 0 && (
            <section className="card">
              <div className="card-head"><h3><Scissors />{t('cl.alterations')}</h3></div>
              <div className="list">
                {alts.map((a) => (
                  <div className="list-row click" key={a.id} onClick={() => nav('/alterations')}>
                    <div className="grow"><div className="title">{a.tasks}</div><div className="meta">{t('al.due')}: {date(a.dueDate)}</div></div>
                    <Chip tone={altTone[a.status]}>{t(`alt.${a.status}` as DictKey)}</Chip>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="card">
            <div className="card-head"><h3><MessageSquare />{t('nt.history')}</h3></div>
            {sms.length === 0 ? <Empty title={t('c.noData')} /> : (
              <div className="list">
                {sms.slice(0, 8).map((s) => (
                  <div className="list-row" key={s.id} style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="meta">{dateTime(s.sentAt)} · {t(`rem.${s.type}` as DictKey)}</div>
                      <div style={{ fontSize: 13 }}>{s.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <ClientFormModal open={modal === 'edit'} onClose={() => setModal('')} client={client} />
      <AppointmentFormModal open={modal === 'appt'} onClose={() => setModal('')} defaults={{ clientId: client.id }} />
      <SmsComposeModal open={modal === 'sms'} onClose={() => setModal('')} client={client} />
    </Page>
  )
}
