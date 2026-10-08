import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, HandCoins, Plus, UserCog } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { weekdayShort } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { periodRange, sliceFor, staffPerformance, type PeriodKey } from '../data/analytics'
import { addDays, parseDate, todayStr, weekday } from '../lib/date'
import { uid } from '../lib/storage'
import type { Staff, StaffRole } from '../data/types'
import { Page } from '../components/Layout'
import { useBranchChoice } from '../components/forms'
import { Avatar, Chip, Empty, Field, FormFooter, Modal, MoneyInput, Segmented, useToast } from '../components/ui'
import { useFileUrl } from '../lib/files'
import { ROLES, ROLE_TONE } from '../components/roles'

type Tab = 'list' | 'schedule' | 'commissions'
/** Default commission when a role is picked; only people who sell earn one. */
const ROLE_COMMISSION: Partial<Record<StaffRole, number>> = { sales: 4, stylist: 2, manager: 1, makeup: 0, hair: 0 }

export default function StaffPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('list')
  return (
    <Page title={t('st.title')} tabs={[{ key: 'list', label: t('st.list') }, { key: 'schedule', label: t('st.schedule') }, { key: 'commissions', label: t('st.commissions') }]} active={tab} onTab={(k) => setTab(k as Tab)}>
      {tab === 'list' && <List />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'commissions' && <Commissions />}
    </Page>
  )
}

function List() {
  const { t, money, lang } = useI18n()
  const { scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const [role, setRole] = useState('')
  const [open, setOpen] = useState(false)
  const list = scoped.staff.filter((s) => !role || s.role === role).sort((a, b) => Number(b.active) - Number(a.active) || ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
  const present = ROLES.filter((r) => scoped.staff.some((s) => s.role === r))

  return (
    <section className="card">
      <div className="toolbar">
        <select id="st-role-filter" className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('st.role')}>
          <option value="">{t('st.role')}: {t('c.all').toLowerCase()}</option>
          {present.map((r) => <option key={r} value={r}>{t(`staffRole.${r}` as DictKey)}</option>)}
        </select>
        <span className="muted small">{list.length}</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus />{t('st.add')}</button>
      </div>
      {list.length === 0 ? <Empty icon={<UserCog />} title={t('st.empty')} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t('c.staff')}</th><th>{t('st.role')}</th>{scope === 'all' && <th>{t('c.branch')}</th>}<th>{t('st.workDays')}</th><th>{t('st.shift')}</th><th className="num">{t('st.commissionRate')}</th><th className="num">{t('st.salary')}</th><th>{t('c.status')}</th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="click" onClick={() => nav(`/staff/${s.id}`)}>
                  <td><div className="person"><StaffAvatar staff={s} /><div><div className="cell-main">{s.name}</div><div className="cell-sub num">{s.phone}</div></div></div></td>
                  <td><Chip tone={ROLE_TONE[s.role]} plain>{t(`staffRole.${s.role}` as DictKey)}</Chip></td>
                  {scope === 'all' && <td className="soft">{L.branch.get(s.branchId)?.name}</td>}
                  <td className="soft small">{s.workDays.slice().sort().map((d) => weekdayShort[lang][d]).join(' · ')}</td>
                  <td className="num nowrap">{s.shiftStart}–{s.shiftEnd}</td>
                  <td className="num">{s.commissionRate}%</td>
                  <td className="num">{money(s.salary)}</td>
                  <td><Chip tone={s.active ? 'good' : 'neutral'}>{s.active ? t('st.active') : t('st.inactive')}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <StaffModal open={open} onClose={() => setOpen(false)} onSaved={(id) => nav(`/staff/${id}`)} />
    </section>
  )
}

export function StaffAvatar({ staff, lg }: { staff: Staff; lg?: boolean }) {
  const url = useFileUrl(staff.photo)
  return <Avatar name={staff.name} src={url} lg={lg} />
}

function Schedule() {
  const { t, lang, dateShort } = useI18n()
  const scoped = useScoped()
  const today = todayStr()
  const monday = addDays(today, -weekday(today))
  const [week, setWeek] = useState(0)
  const start = addDays(monday, week * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const staff = scoped.staff.filter((s) => s.active)
  const load = (id: string, d: string) => scoped.appointments.filter((a) => a.staffId === id && a.date === d && a.status !== 'cancelled').length

  return (
    <section className="card">
      <div className="card-head">
        <h3><CalendarDays />{t('st.schedule')}</h3>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => setWeek((w) => w - 1)} aria-label="prev"><ChevronLeft /></button>
          <button className="btn btn-outline btn-sm" onClick={() => setWeek(0)}>{t('c.today')}</button>
          <button className="icon-btn" onClick={() => setWeek((w) => w + 1)} aria-label="next"><ChevronRight /></button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('c.staff')}</th>
              {days.map((d, i) => (
                <th key={d} className="num" style={d === today ? { background: 'var(--accent-soft)', color: 'var(--accent-ink)' } : undefined}>
                  {weekdayShort[lang][i]} · {dateShort(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td><div className="cell-main">{s.name}</div><div className="cell-sub">{t(`staffRole.${s.role}` as DictKey)}</div></td>
                {days.map((d, i) => {
                  const works = s.workDays.includes(i)
                  const n = load(s.id, d)
                  return (
                    <td key={d} className="num" style={d === today ? { background: '#fdf9ef' } : undefined}>
                      {works ? (
                        <div className="stack sm" style={{ gap: 2, alignItems: 'flex-end' }}>
                          <span className="strong">{s.shiftStart}–{s.shiftEnd}</span>
                          {n > 0 && <Chip tone="gold" plain>{n} {t('cal.appointment').toLowerCase()}</Chip>}
                        </div>
                      ) : (
                        <span className="muted">{t('st.dayOff')}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">{parseDate(start).getFullYear()}</div>
    </section>
  )
}

function Commissions() {
  const { t, money } = useI18n()
  const { db, scope } = useStore()
  const L = useLookups()
  const [period, setPeriod] = useState<PeriodKey>('thisMonth')
  const p = periodRange(period, todayStr())
  const staff = db.staff.filter((s) => (scope === 'all' || s.branchId === scope) && s.active)
  const perf = staffPerformance(sliceFor(db, scope === 'all' ? 'all' : [scope]), staff, p.from, p.to)
  const rows = staff.map((s) => ({ s, r: perf.get(s.id)! })).sort((a, b) => b.r.commission - a.r.commission)
  const totals = rows.reduce((acc, { s, r }) => ({ volume: acc.volume + r.volume, commission: acc.commission + r.commission, salary: acc.salary + s.salary }), { volume: 0, commission: 0, salary: 0 })
  return (
    <>
      <div className="row between">
        <span className="muted small">{t('st.commissionHint')}</span>
        <Segmented<PeriodKey> value={period} onChange={setPeriod} options={[{ value: 'thisMonth', label: t('an.p.thisMonth') }, { value: 'lastMonth', label: t('an.p.lastMonth') }]} />
      </div>
      <section className="card">
        <div className="card-head"><h3><HandCoins />{t('st.commissions')}</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t('c.staff')}</th><th>{t('st.role')}</th>{scope === 'all' && <th>{t('c.branch')}</th>}<th className="num">{t('st.commissionRate')}</th><th className="num">{t('st.salesCount')}</th><th className="num">{t('an.salesVolume')}</th><th className="num">{t('an.commission')}</th><th className="num">{t('st.salary')}</th><th className="num">{t('st.toPay')}</th></tr>
            </thead>
            <tbody>
              {rows.map(({ s, r }) => (
                <tr key={s.id}>
                  <td className="cell-main">{s.name}</td>
                  <td className="soft">{t(`staffRole.${s.role}` as DictKey)}</td>
                  {scope === 'all' && <td className="soft">{L.branch.get(s.branchId)?.name}</td>}
                  <td className="num">{s.commissionRate}%</td>
                  <td className="num">{r.orders}</td>
                  <td className="num">{money(r.volume)}</td>
                  <td className="num strong gold">{money(r.commission)}</td>
                  <td className="num">{money(s.salary)}</td>
                  <td className="num strong">{money(s.salary + r.commission)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={scope === 'all' ? 5 : 4}>{t('c.total')}</td>
                <td className="num">{money(totals.volume)}</td>
                <td className="num">{money(totals.commission)}</td>
                <td className="num">{money(totals.salary)}</td>
                <td className="num">{money(totals.salary + totals.commission)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  )
}

export function StaffModal({ open, onClose, staff, onSaved }: { open: boolean; onClose: () => void; staff?: Staff; onSaved?: (id: string) => void }) {
  const { t, lang } = useI18n()
  const { upsert } = useStore()
  const toast = useToast()
  const blank = (): Staff => ({ id: '', branchId: '', name: '', phone: '+998 ', role: 'stylist', commissionRate: 2, salary: 5_000_000, workDays: [0, 1, 2, 3, 4, 5], shiftStart: '10:00', shiftEnd: '19:00', hiredAt: todayStr(), active: true })
  const [s, setS] = useState<Staff>(staff ?? blank())
  const [tried, setTried] = useState(false)
  const branch = useBranchChoice(staff?.branchId)
  useEffect(() => {
    if (open) {
      setS(staff ?? blank())
      setTried(false)
    }
  }, [open, staff])
  const branchId = staff?.branchId ?? branch.branchId
  const valid = s.name.trim().length > 1 && !!branchId
  const save = () => {
    setTried(true)
    if (!valid) return
    const saved = { ...s, id: s.id || uid(), branchId, name: s.name.trim() }
    upsert('staff', saved)
    toast(t('c.saved'))
    onSaved?.(saved.id)
    onClose()
  }
  const toggleDay = (d: number) => setS({ ...s, workDays: s.workDays.includes(d) ? s.workDays.filter((x) => x !== d) : [...s.workDays, d] })
  const setRole = (role: StaffRole) => setS({ ...s, role, commissionRate: staff ? s.commissionRate : ROLE_COMMISSION[role] ?? 0 })
  return (
    <Modal open={open} onClose={onClose} title={staff ? t('st.edit') : t('st.add')} size="wide" footer={<FormFooter onCancel={onClose} onSave={save} />}>
      <div className="form-section">
        <span className="eyebrow">{t('st.personal')}</span>
        <div className="form-grid g3">
          <Field label={t('c.fullName')} htmlFor="st-name" error={tried && s.name.trim().length < 2 ? t('c.required') : undefined}>
            <input id="st-name" className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} autoFocus />
          </Field>
          <Field label={t('c.phone')} htmlFor="st-phone"><input id="st-phone" className="input num" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
          <Field label={t('st.birthday')} htmlFor="st-birthday"><input id="st-birthday" type="date" className="input" value={s.birthday ?? ''} onChange={(e) => setS({ ...s, birthday: e.target.value || undefined })} /></Field>
          <Field label={t('c.address')} htmlFor="st-address" className="span-2"><input id="st-address" className="input" value={s.address ?? ''} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
          {branch.field}
        </div>
      </div>
      <div className="form-section">
        <span className="eyebrow">{t('st.work')}</span>
        <div className="form-grid g3">
          <Field label={t('st.role')} htmlFor="st-role">
            <select id="st-role" className="select" value={s.role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{t(`staffRole.${r}` as DictKey)}</option>)}
            </select>
          </Field>
          <Field label={t('st.commissionRate')} htmlFor="st-rate">
            <input id="st-rate" className="input num" type="number" min={0} max={50} step={0.5} value={s.commissionRate} onChange={(e) => setS({ ...s, commissionRate: Math.max(0, Number(e.target.value)) })} />
          </Field>
          <Field label={t('st.salary')} htmlFor="st-salary"><MoneyInput id="st-salary" value={s.salary} onChange={(v) => setS({ ...s, salary: v })} /></Field>
          <Field label={t('st.shiftStart')} htmlFor="st-start"><input id="st-start" type="time" className="input" value={s.shiftStart} onChange={(e) => setS({ ...s, shiftStart: e.target.value })} /></Field>
          <Field label={t('st.shiftEnd')} htmlFor="st-end"><input id="st-end" type="time" className="input" value={s.shiftEnd} onChange={(e) => setS({ ...s, shiftEnd: e.target.value })} /></Field>
          <Field label={t('st.hiredAt')} htmlFor="st-hired"><input id="st-hired" type="date" className="input" value={s.hiredAt} onChange={(e) => setS({ ...s, hiredAt: e.target.value })} /></Field>
          <Field label={t('st.workDays')} className="span-2">
            <div className="day-picks">
              {weekdayShort[lang].map((w, i) => <button type="button" key={w} className={s.workDays.includes(i) ? 'on' : ''} onClick={() => toggleDay(i)}>{w}</button>)}
            </div>
          </Field>
          <label className="check"><input type="checkbox" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} />{t('st.active')}</label>
          <Field label={t('c.notes')} htmlFor="st-notes" className="span-2"><input id="st-notes" className="input" value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} /></Field>
        </div>
      </div>
      {tried && !branchId && <div className="notice bad">{t('c.chooseBranch')}</div>}
    </Modal>
  )
}
