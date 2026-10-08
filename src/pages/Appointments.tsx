import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarHeart, CalendarPlus, Check, Pencil, UserX, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { addDays, todayStr } from '../lib/date'
import type { Appointment } from '../data/types'
import { Page } from '../components/Layout'
import { APPT_TYPES, AppointmentFormModal } from '../components/forms'
import { apptTone, Chip, Empty, SearchInput } from '../components/ui'

type Tab = 'upcoming' | 'past'

export default function Appointments() {
  const { t, date } = useI18n()
  const { mutate, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const today = todayStr()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [staffId, setStaffId] = useState('')
  const [edit, setEdit] = useState<Appointment | undefined>()
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(80)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return scoped.appointments
      .filter((a) => (tab === 'upcoming' ? a.date >= today : a.date < today))
      .filter((a) => (!type || a.type === type) && (!staffId || a.staffId === staffId))
      .filter((a) => !s || !!L.client.get(a.clientId)?.name.toLowerCase().includes(s))
      .sort((a, b) => (tab === 'upcoming' ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time)))
  }, [scoped.appointments, tab, today, type, staffId, q, L])

  const setStatus = (a: Appointment, status: Appointment['status']) =>
    mutate((d) => {
      const x = d.appointments.find((y) => y.id === a.id)
      if (x) x.status = status
    })

  const dayLabel = (d: string) => (d === today ? t('c.today') : d === addDays(today, 1) ? t('c.tomorrow') : d === addDays(today, -1) ? t('c.yesterday') : date(d))
  const shown = list.slice(0, limit)

  return (
    <Page title={t('ap.title')} tabs={[{ key: 'upcoming', label: t('ap.upcoming') }, { key: 'past', label: t('ap.past') }]} active={tab} onTab={(k) => setTab(k as Tab)}>
      <section className="card">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder={t('cl.searchPh')} />
          <select id="ap-f-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('c.type')}: {t('c.all').toLowerCase()}</option>
            {APPT_TYPES.map((x) => <option key={x} value={x}>{t(`appt.${x}` as DictKey)}</option>)}
          </select>
          <select id="ap-f-staff" className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">{t('c.staff')}: {t('c.all').toLowerCase()}</option>
            {scoped.staff.filter((s) => s.role === 'stylist' || s.role === 'tailor' || s.role === 'manager').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={() => { setEdit(undefined); setOpen(true) }}><CalendarPlus />{t('ap.new')}</button>
        </div>
        {shown.length === 0 ? (
          <Empty icon={<CalendarHeart />} title={t('ap.empty')} />
        ) : (
          <div className="list">
            {shown.map((a, i) => {
              const c = L.client.get(a.clientId)
              const newDay = i === 0 || shown[i - 1].date !== a.date
              const dresses = a.productIds.map((id) => L.product.get(id)?.name).filter(Boolean)
              return (
                <Fragment key={a.id}>
                  {newDay && <div className="day-sep">{dayLabel(a.date)}</div>}
                  <div className="list-row">
                    <span className="time-badge">{a.time}</span>
                    <div className="grow">
                      <div className="title">
                        <button onClick={() => nav(`/clients/${a.clientId}`)} style={{ all: 'unset', cursor: 'pointer' }}>{c?.name}</button>
                        <span className="muted small num" style={{ fontWeight: 500, marginLeft: 8 }}>{c?.phone}</span>
                      </div>
                      <div className="meta">
                        {t(`appt.${a.type}` as DictKey)} · {a.duration} {t('c.minutes')} · {L.staff.get(a.staffId ?? '')?.name ?? '—'}
                        {scope === 'all' ? ` · ${L.branch.get(a.branchId)?.name}` : ''}
                        {dresses.length ? ` · ${dresses.join(', ')}` : ''}
                      </div>
                    </div>
                    <Chip tone={apptTone[a.status]}>{t(`apptStatus.${a.status}` as DictKey)}</Chip>
                    <div className="row nowrap-row" style={{ gap: 2 }}>
                      {a.status === 'scheduled' && (
                        <>
                          <button className="icon-btn" title={t('ap.complete')} onClick={() => setStatus(a, 'completed')}><Check /></button>
                          <button className="icon-btn" title={t('ap.noShow')} onClick={() => setStatus(a, 'no_show')}><UserX /></button>
                          <button className="icon-btn" title={t('apptStatus.cancelled')} onClick={() => setStatus(a, 'cancelled')}><X /></button>
                        </>
                      )}
                      <button className="icon-btn" title={t('c.edit')} onClick={() => { setEdit(a); setOpen(true) }}><Pencil /></button>
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>
        )}
        {list.length > limit && (
          <div className="table-foot row between">
            <span>{t('c.showing', { n: limit, total: list.length })}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + 80)}>{t('c.seeAll')}</button>
          </div>
        )}
      </section>
      <AppointmentFormModal open={open} onClose={() => setOpen(false)} appt={edit} />
    </Page>
  )
}
