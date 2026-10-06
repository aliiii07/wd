import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarHeart, CalendarPlus, ClipboardList, ClipboardPlus, MessageSquare, Pencil, Trash2, Users } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { displayStatus, groupByOrder, orderMoney } from '../data/domain'
import { diffDays, todayStr } from '../lib/date'
import { Page } from '../components/Layout'
import { AppointmentFormModal, ClientFormModal } from '../components/forms'
import { SMS_STATUS_TONE, SmsComposeModal } from '../components/sms'
import { DocumentsCard } from '../components/documents'
import { apptTone, Avatar, Chip, Empty, orderTone, useConfirm, useToast } from '../components/ui'

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
  const sms = db.smsLog.filter((s) => s.clientId === client.id)
  const totals = orders.filter((o) => o.status !== 'cancelled').reduce(
    (s, o) => {
      const m = orderMoney(o, pays.get(o.id))
      return { paid: s.paid + m.paid, balance: s.balance + m.balance }
    },
    { paid: 0, balance: 0 },
  )
  const days = client.weddingDate ? diffDays(today, client.weddingDate) : null
  const hasRecords = orders.length > 0 || db.documents.some((d) => d.ownerType === 'client' && d.ownerId === client.id)

  const del = async () => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('clients', client.id)
    toast(t('c.deleted'))
    nav('/clients')
  }

  return (
    <Page
      title={client.name}
      crumb={`${t('cl.title')} · ${L.branch.get(client.branchId)?.name ?? ''}`}
      actions={
        <>
          <button className="btn btn-primary" onClick={() => nav(`/orders/new?client=${client.id}`)}><ClipboardPlus />{t('qa.newOrder')}</button>
          <button className="btn btn-outline" onClick={() => setModal('appt')}><CalendarPlus />{t('qa.newAppointment')}</button>
          <button className="btn btn-outline" onClick={() => setModal('sms')}><MessageSquare />{t('cl.sendSms')}</button>
        </>
      }
    >
      <div className="grid g-side">
        <section className="card profile">
          <Avatar name={client.name} lg />
          <div className="profile-main">
            <div className="row between">
              <div className="stack sm" style={{ gap: 4 }}>
                <span className="eyebrow">{t('c.client')}</span>
                <span className="profile-phone num">{client.phone}</span>
              </div>
              <div className="row nowrap-row" style={{ gap: 2 }}>
                <button className="icon-btn" title={t('c.edit')} aria-label={t('c.edit')} onClick={() => setModal('edit')}><Pencil /></button>
                {!hasRecords && <button className="icon-btn" title={t('c.delete')} aria-label={t('c.delete')} onClick={del}><Trash2 /></button>}
              </div>
            </div>
            <dl className="facts">
              <div><dt>{t('cl.source')}</dt><dd>{t(`source.${client.source}` as DictKey)}</dd></div>
              <div><dt>{t('cl.smsLang')}</dt><dd>{t(`lang.${client.lang}` as DictKey)}</dd></div>
              <div><dt>{t('cl.since')}</dt><dd>{date(client.createdAt.slice(0, 10))}</dd></div>
              <div><dt>{t('cl.orders')}</dt><dd className="num">{orders.length}</dd></div>
              <div><dt>{t('cl.totalSpent')}</dt><dd className="num">{money(totals.paid)}</dd></div>
              <div><dt>{t('cl.debt')}</dt><dd className={`num ${totals.balance > 0 ? 'text-bad' : ''}`}>{totals.balance > 0 ? money(totals.balance) : '—'}</dd></div>
            </dl>
            {client.notes && <p className="soft">{client.notes}</p>}
          </div>
        </section>
        <section className={`card countdown-card ${days !== null && days >= 0 && days <= 3 ? 'hot' : ''}`}>
          <span className="eyebrow">{t('ord.weddingDate')}</span>
          <span className="countdown-big num">{days !== null && days >= 0 ? days : '—'}</span>
          <span className="soft">{days === null ? t('cl.noWedding') : days < 0 ? t('cl.weddingPassed') : days === 0 ? t('today.weddingToday') : t('cl.weddingIn', { n: days })}</span>
          {client.weddingDate && <span className="strong">{date(client.weddingDate)}</span>}
        </section>
      </div>

      <div className="grid g-side">
        <div className="stack" style={{ gap: 24 }}>
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

        <aside className="stack" style={{ gap: 24 }}>
          <DocumentsCard ownerType="client" ownerId={client.id} branchId={client.branchId} />
          <section className="card">
            <div className="card-head">
              <h3><MessageSquare />{t('nt.history')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal('sms')}>{t('nt.compose')}</button>
            </div>
            {sms.length === 0 ? <Empty title={t('c.noData')} /> : (
              <div className="list">
                {sms.slice(0, 8).map((s) => (
                  <div className="list-row" key={s.id} style={{ alignItems: 'flex-start' }}>
                    <div className="grow stack sm" style={{ gap: 4 }}>
                      <div className="row between">
                        <span className="meta">{dateTime(s.sentAt)} · {t(`rem.${s.type}` as DictKey)}</span>
                        {s.status && <Chip tone={SMS_STATUS_TONE[s.status]}>{t(`nt.status.${s.status}` as DictKey)}</Chip>}
                      </div>
                      <div className="small">{s.text}</div>
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
