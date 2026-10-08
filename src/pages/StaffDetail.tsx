import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarHeart, Camera, ClipboardList, HandCoins, Loader2, Pencil, Trash2, UserCog, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { weekdayShort } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { periodRange, sliceFor, staffPerformance } from '../data/analytics'
import { displayStatus, orderTotal } from '../data/domain'
import { addDays, todayStr } from '../lib/date'
import { deleteFile } from '../lib/files'
import { Page } from '../components/Layout'
import { storeImages } from '../components/photos'
import { DocumentsCard } from '../components/documents'
import { apptTone, Chip, Empty, orderTone, Stat, useConfirm, useToast } from '../components/ui'
import { StaffAvatar, StaffModal } from './Staff'
import { ROLE_TONE } from '../components/roles'

export default function StaffDetail() {
  const { id } = useParams()
  const { t, money, moneyShort, date, dateShort, lang } = useI18n()
  const { db, mutate, remove } = useStore()
  const L = useLookups()
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const today = todayStr()
  const s = db.staff.find((x) => x.id === id)

  if (!s) {
    return <Page title={t('st.title')}><Empty icon={<UserCog />} title={t('c.nothingFound')} action={<Link className="btn btn-outline" to="/staff">{t('c.back')}</Link>} /></Page>
  }
  const p = periodRange('thisMonth', today)
  const perf = staffPerformance(sliceFor(db, [s.branchId]), [s], p.from, p.to).get(s.id)!
  const orders = db.orders.filter((o) => o.staffId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
  const upcoming = db.appointments
    .filter((a) => a.staffId === s.id && a.status === 'scheduled' && a.date >= today && a.date <= addDays(today, 14))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const referenced = db.orders.some((o) => o.staffId === s.id) || db.appointments.some((a) => a.staffId === s.id)

  const setPhoto = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const [fileId] = await storeImages(files)
    if (fileId) {
      const old = s.photo
      mutate((d) => {
        const x = d.staff.find((y) => y.id === s.id)
        if (x) x.photo = fileId
      })
      if (old) deleteFile(old)
      toast(t('c.saved'))
    }
    setBusy(false)
    if (input.current) input.current.value = ''
  }
  const removePhoto = () => {
    const old = s.photo
    if (!old) return
    mutate((d) => {
      const x = d.staff.find((y) => y.id === s.id)
      if (x) delete x.photo
    })
    deleteFile(old)
  }
  const del = async () => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('staff', s.id)
    if (s.photo) deleteFile(s.photo)
    toast(t('c.deleted'))
    nav('/staff')
  }

  return (
    <Page
      title={s.name}
      crumb={`${t('st.profile')} · ${L.branch.get(s.branchId)?.name ?? ''}`}
      actions={
        <>
          <button className="btn btn-outline" onClick={() => setEdit(true)}><Pencil />{t('c.edit')}</button>
          {!referenced && <button className="btn btn-danger" onClick={del}><Trash2 />{t('c.delete')}</button>}
        </>
      }
    >
      <div className="grid g-side">
        <section className="card profile">
          <div className="profile-photo">
            <StaffAvatar staff={s} lg />
            <label className="photo-change" htmlFor="staff-photo" title={s.photo ? t('st.changePhoto') : t('st.addPhoto')}>
              {busy ? <Loader2 className="spin" /> : <Camera />}
              <input ref={input} id="staff-photo" type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files)} />
            </label>
            {s.photo && (
              <button className="photo-remove" onClick={removePhoto} title={t('st.removePhoto')} aria-label={t('st.removePhoto')}>
                <X />
              </button>
            )}
          </div>
          <div className="profile-main">
            <div className="row" style={{ gap: 8 }}>
              <Chip tone={ROLE_TONE[s.role]} plain>{t(`staffRole.${s.role}` as DictKey)}</Chip>
              <Chip tone={s.active ? 'good' : 'neutral'}>{s.active ? t('st.active') : t('st.inactive')}</Chip>
            </div>
            <span className="profile-phone num">{s.phone}</span>
            <dl className="facts">
              <div><dt>{t('st.birthday')}</dt><dd>{s.birthday ? date(s.birthday) : '—'}</dd></div>
              <div><dt>{t('st.hiredAt')}</dt><dd>{date(s.hiredAt)}</dd></div>
              <div><dt>{t('c.address')}</dt><dd>{s.address || '—'}</dd></div>
              <div><dt>{t('st.workDays')}</dt><dd>{s.workDays.slice().sort().map((d) => weekdayShort[lang][d]).join(' · ') || '—'}</dd></div>
              <div><dt>{t('st.shift')}</dt><dd className="num">{s.shiftStart}–{s.shiftEnd}</dd></div>
              <div><dt>{t('st.salary')}</dt><dd className="num">{money(s.salary)}</dd></div>
              <div><dt>{t('st.commissionRate')}</dt><dd className="num">{s.commissionRate}%</dd></div>
            </dl>
            {s.notes && <p className="soft">{s.notes}</p>}
          </div>
        </section>
        <div className="stack" style={{ gap: 16 }}>
          <Stat icon={<ClipboardList />} label={`${t('st.salesCount')} · ${t('an.p.thisMonth').toLowerCase()}`} value={perf.orders} hint={`${t('an.salesVolume')}: ${moneyShort(perf.volume)}`} />
          <Stat icon={<HandCoins />} label={t('st.toPay')} value={<span title={money(s.salary + perf.commission)}>{moneyShort(s.salary + perf.commission)}</span>} hint={`${t('an.commission')}: ${money(perf.commission)}`} />
          <Stat icon={<CalendarHeart />} label={t('an.appointments')} value={perf.appointments} hint={t('an.p.thisMonth')} />
        </div>
      </div>

      <div className="grid g-side">
        <div className="stack" style={{ gap: 24 }}>
          <section className="card">
            <div className="card-head"><h3><CalendarHeart />{t('st.upcoming')}</h3></div>
            {upcoming.length === 0 ? <Empty title={t('ap.empty')} /> : (
              <div className="list">
                {upcoming.map((a) => (
                  <div className="list-row click" key={a.id} onClick={() => nav(`/clients/${a.clientId}`)}>
                    <span className="time-badge">{a.time}</span>
                    <div className="grow">
                      <div className="title">{L.client.get(a.clientId)?.name}</div>
                      <div className="meta">{t(`appt.${a.type}` as DictKey)} · {a.date === today ? t('c.today') : dateShort(a.date)}</div>
                    </div>
                    <Chip tone={apptTone[a.status]}>{t(`apptStatus.${a.status}` as DictKey)}</Chip>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h3><ClipboardList />{t('st.recentOrders')}</h3></div>
            {orders.length === 0 ? <Empty title={t('ord.empty')} /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t('ord.number')}</th><th>{t('c.client')}</th><th>{t('c.type')}</th><th>{t('c.date')}</th><th className="num">{t('ord.total')}</th><th>{t('c.status')}</th></tr></thead>
                  <tbody>
                    {orders.map((o) => {
                      const st = displayStatus(o, today)
                      return (
                        <tr key={o.id} className="click" onClick={() => nav(`/orders/${o.id}`)}>
                          <td className="strong">{o.number}</td>
                          <td>{L.client.get(o.clientId)?.name}</td>
                          <td>{t(`orderType.${o.type}` as DictKey)}</td>
                          <td className="nowrap">{dateShort(o.createdAt.slice(0, 10))}</td>
                          <td className="num">{money(orderTotal(o))}</td>
                          <td><Chip tone={orderTone[st]}>{t(`orderStatus.${st}` as DictKey)}</Chip></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <aside className="stack" style={{ gap: 24 }}>
          <DocumentsCard ownerType="staff" ownerId={s.id} branchId={s.branchId} />
        </aside>
      </div>
      <StaffModal open={edit} onClose={() => setEdit(false)} staff={s} />
    </Page>
  )
}
