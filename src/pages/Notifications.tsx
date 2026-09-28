import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, Info, MessageSquare, Save, Send } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { computeReminders, renderSms, type Reminder } from '../data/reminders'
import { logSms } from '../data/actions'
import { todayStr } from '../lib/date'
import type { Lang, ReminderType, SmsTemplate } from '../data/types'
import { Page } from '../components/Layout'
import { Chip, Empty, Field, type Tone, useToast } from '../components/ui'

type Tab = 'reminders' | 'templates' | 'history'
const TONE: Record<ReminderType | 'custom', Tone> = {
  overdue: 'bad', pickup: 'dark', return: 'neutral', balance: 'warn', appointment: 'info', alteration_ready: 'good', wedding: 'gold', custom: 'neutral',
}

export default function Notifications() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('reminders')
  return (
    <Page title={t('nt.title')} tabs={[{ key: 'reminders', label: t('nt.reminders') }, { key: 'templates', label: t('nt.templates') }, { key: 'history', label: t('nt.history') }]} active={tab} onTab={(k) => setTab(k as Tab)}>
      <div className="notice"><Info /><span>{t('nt.gatewayNote')}</span></div>
      {tab === 'reminders' && <Reminders />}
      {tab === 'templates' && <Templates />}
      {tab === 'history' && <History />}
    </Page>
  )
}

function Reminders() {
  const { t, money, date } = useI18n()
  const { db, mutate, user, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const toast = useToast()
  const today = todayStr()
  const reminders = useMemo(
    () => computeReminders({ orders: scoped.orders, appointments: scoped.appointments, alterations: scoped.alterations, payments: scoped.payments, smsLog: db.smsLog }, today),
    [scoped, db.smsLog, today],
  )
  const [picked, setPicked] = useState<Set<string>>(new Set())
  useEffect(() => setPicked(new Set(reminders.map((r) => r.key))), [reminders])

  const textOf = (r: Reminder) => {
    const c = L.client.get(r.clientId)!
    const tpl = db.smsTemplates.find((x) => x.type === r.type)
    return tpl ? renderSms(tpl.text[c.lang] || tpl.text.uz, r, c, L.branch.get(r.branchId), db.settings.storeName) : ''
  }
  const send = (list: Reminder[]) => {
    if (!list.length) return
    mutate((d) =>
      logSms(d, list.map((r) => {
        const c = L.client.get(r.clientId)!
        return { branchId: r.branchId, clientId: r.clientId, phone: c.phone, type: r.type, text: textOf(r), refKey: r.key, sentBy: user?.name }
      })),
    )
    toast(t('nt.sentN', { n: list.length }))
  }
  const reason = (r: Reminder) => {
    const parts = [date(r.date)]
    if (r.time) parts.push(r.time)
    if (r.days != null) parts.push(r.type === 'overdue' ? t('today.lateBy', { n: r.days }) : t('today.daysLeft', { n: r.days }))
    if (r.amount) parts.push(money(r.amount))
    return parts.join(' · ')
  }

  if (reminders.length === 0) {
    return <section className="card"><Empty icon={<BellRing />} title={t('nt.none')} /></section>
  }
  const selected = reminders.filter((r) => picked.has(r.key))
  return (
    <section className="card">
      <div className="toolbar">
        <label className="check">
          <input type="checkbox" checked={selected.length === reminders.length} onChange={(e) => setPicked(e.target.checked ? new Set(reminders.map((r) => r.key)) : new Set())} />
          {t('c.all')}
        </label>
        <span className="spacer" />
        <button className="btn btn-primary" disabled={!selected.length} onClick={() => send(selected)}><Send />{t('nt.sendAll', { n: selected.length })}</button>
      </div>
      <div className="list">
        {reminders.map((r) => {
          const c = L.client.get(r.clientId)
          return (
            <div className="list-row" key={r.key} style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" aria-label={c?.name} style={{ width: 17, height: 17, marginTop: 3, accentColor: 'var(--ink)' }} checked={picked.has(r.key)}
                onChange={(e) => {
                  const next = new Set(picked)
                  if (e.target.checked) next.add(r.key)
                  else next.delete(r.key)
                  setPicked(next)
                }} />
              <div className="grow stack sm" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 8 }}>
                  <Chip tone={TONE[r.type]}>{t(`rem.${r.type}` as DictKey)}</Chip>
                  <button style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }} onClick={() => nav(r.orderId ? `/orders/${r.orderId}` : `/clients/${r.clientId}`)}>{c?.name}</button>
                  <span className="muted small num">{c?.phone}</span>
                  {scope === 'all' && <span className="muted small">· {L.branch.get(r.branchId)?.name}</span>}
                </div>
                <div className="muted small">{t('nt.due')}: {reason(r)} · SMS: {c ? t(`lang.${c.lang}` as DictKey) : ''}</div>
                <div style={{ fontSize: 13, background: 'var(--wash)', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 11px' }}>{textOf(r)}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => send([r])}><Send />{t('c.send')}</button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Templates() {
  const { t } = useI18n()
  const { db, mutate, isFounder } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState<SmsTemplate[]>(db.smsTemplates)
  useEffect(() => setDraft(db.smsTemplates), [db.smsTemplates])
  const set = (type: ReminderType, lang: Lang, text: string) =>
    setDraft(draft.map((x) => (x.type === type ? { ...x, text: { ...x.text, [lang]: text } } : x)))
  const save = () => {
    mutate((d) => (d.smsTemplates = structuredClone(draft)))
    toast(t('c.saved'))
  }
  return (
    <>
      <div className="row between">
        <span className="muted small">{t('nt.placeholders')}</span>
        <button className="btn btn-primary" onClick={save} disabled={!isFounder}><Save />{t('c.save')}</button>
      </div>
      {!isFounder && <div className="notice warn"><Info />{t('set.onlyFounder')}</div>}
      <div className="grid g-2">
        {draft.map((tpl) => (
          <section className="card" key={tpl.type}>
            <div className="card-head"><h3><MessageSquare />{t(`rem.${tpl.type}` as DictKey)}</h3><Chip tone={TONE[tpl.type]}>{tpl.type}</Chip></div>
            <div className="card-body stack">
              {(['uz', 'ru', 'en'] as Lang[]).map((l) => (
                <Field key={l} label={t(`lang.${l}` as DictKey)} htmlFor={`tpl-${tpl.type}-${l}`} hint={`${tpl.text[l].length} / 160`}>
                  <textarea id={`tpl-${tpl.type}-${l}`} className="textarea" style={{ minHeight: 64 }} value={tpl.text[l]} readOnly={!isFounder} onChange={(e) => set(tpl.type, l, e.target.value)} />
                </Field>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function History() {
  const { t, dateTime } = useI18n()
  const { db, scope } = useStore()
  const L = useLookups()
  const [limit, setLimit] = useState(60)
  const log = db.smsLog.filter((s) => scope === 'all' || s.branchId === scope).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  if (!log.length) return <section className="card"><Empty icon={<MessageSquare />} title={t('c.noData')} /></section>
  return (
    <section className="card">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('c.date')}</th><th>{t('nt.recipient')}</th><th>{t('c.type')}</th><th>{t('nt.preview')}</th><th>{t('nt.sentBy')}</th></tr></thead>
          <tbody>
            {log.slice(0, limit).map((s) => (
              <tr key={s.id}>
                <td className="nowrap soft">{dateTime(s.sentAt)}</td>
                <td><div className="cell-main">{L.client.get(s.clientId ?? '')?.name ?? '—'}</div><div className="cell-sub num">{s.phone}</div></td>
                <td><Chip tone={TONE[s.type]}>{t(`rem.${s.type}` as DictKey)}</Chip></td>
                <td style={{ maxWidth: 420, fontSize: 13 }}>{s.text}</td>
                <td className="soft">{s.sentBy === 'auto' ? 'Auto' : s.sentBy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot row between">
        <span>{t('c.showing', { n: Math.min(limit, log.length), total: log.length })}</span>
        {log.length > limit && <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + 60)}>{t('c.seeAll')}</button>}
      </div>
    </section>
  )
}
