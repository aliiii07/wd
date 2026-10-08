import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, Check, Copy, MessageSquare, Pencil, Send, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { computeReminders, renderSms, type Reminder } from '../data/reminders'
import { todayStr } from '../lib/date'
import type { Lang, ReminderType, SmsTemplate } from '../data/types'
import { Page } from '../components/Layout'
import { SMS_STATUS_TONE, SmsComposer, SmsModeNotice, useSmsSender } from '../components/sms'
import { Chip, Empty, type Tone, useToast } from '../components/ui'

type Tab = 'reminders' | 'compose' | 'templates' | 'history'
const TONE: Record<ReminderType | 'custom', Tone> = {
  overdue: 'bad', pickup: 'dark', return: 'neutral', balance: 'warn', appointment: 'info', wedding: 'gold', custom: 'neutral',
}
const LANGS: Lang[] = ['uz', 'ru', 'en']

/** Copies text and confirms with a toast; falls back silently where the clipboard is blocked. */
function useCopy() {
  const { t } = useI18n()
  const toast = useToast()
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(t('nt.copied'))
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      if (ok) toast(t('nt.copied'))
    }
  }
}

export default function Notifications() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('reminders')
  return (
    <Page
      title={t('nt.title')}
      tabs={[
        { key: 'reminders', label: t('nt.reminders') },
        { key: 'compose', label: t('nt.compose') },
        { key: 'templates', label: t('nt.templates') },
        { key: 'history', label: t('nt.history') },
      ]}
      active={tab}
      onTab={(k) => setTab(k as Tab)}
    >
      {tab !== 'templates' && <SmsModeNotice />}
      {tab === 'reminders' && <Reminders />}
      {tab === 'compose' && (
        <section className="card compose-card">
          <div className="card-head"><h3><MessageSquare />{t('nt.compose')}</h3></div>
          <div className="card-body"><SmsComposer /></div>
        </section>
      )}
      {tab === 'templates' && <Templates />}
      {tab === 'history' && <History />}
    </Page>
  )
}

function Reminders() {
  const { t, money, date } = useI18n()
  const { db, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const send = useSmsSender()
  const copy = useCopy()
  const today = todayStr()
  const device = db.settings.sms.mode === 'device'
  const reminders = useMemo(
    () => computeReminders({ orders: scoped.orders, appointments: scoped.appointments, payments: scoped.payments, smsLog: db.smsLog }, today, db.settings.sms),
    [scoped, db.smsLog, today, db.settings.sms],
  )
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  useEffect(() => setPicked(new Set(reminders.map((r) => r.key))), [reminders])

  const textOf = (r: Reminder) => {
    const c = L.client.get(r.clientId)!
    const tpl = db.smsTemplates.find((x) => x.type === r.type)
    return tpl ? renderSms(tpl.text[c.lang] || tpl.text.uz, r, c, L.branch.get(r.branchId), db.settings.storeName) : ''
  }
  const go = async (list: Reminder[]) => {
    setBusy(true)
    await send(list.map((r) => ({ branchId: r.branchId, clientId: r.clientId, phone: L.client.get(r.clientId)!.phone, text: textOf(r), type: r.type, refKey: r.key })))
    setBusy(false)
  }
  const reason = (r: Reminder) => {
    const parts = [date(r.date)]
    if (r.time) parts.push(r.time)
    if (r.days != null) parts.push(r.type === 'overdue' ? t('today.lateBy', { n: r.days }) : t('today.daysLeft', { n: r.days }))
    if (r.amount) parts.push(money(r.amount))
    return parts.join(' · ')
  }

  if (reminders.length === 0) return <section className="card"><Empty icon={<BellRing />} title={t('nt.none')} /></section>
  const selected = reminders.filter((r) => picked.has(r.key))
  return (
    <section className="card">
      <div className="toolbar">
        {!device && (
          <label className="check">
            <input type="checkbox" checked={selected.length === reminders.length} onChange={(e) => setPicked(e.target.checked ? new Set(reminders.map((r) => r.key)) : new Set())} />
            {t('c.all')}
          </label>
        )}
        <span className="spacer" />
        {!device && <button className="btn btn-primary" disabled={!selected.length || busy} onClick={() => go(selected)}><Send />{t('nt.sendAll', { n: selected.length })}</button>}
      </div>
      <div className="list">
        {reminders.map((r) => {
          const c = L.client.get(r.clientId)
          const text = textOf(r)
          return (
            <div className="list-row reminder" key={r.key}>
              {!device && (
                <input type="checkbox" aria-label={c?.name} className="row-check" checked={picked.has(r.key)}
                  onChange={(e) => {
                    const next = new Set(picked)
                    if (e.target.checked) next.add(r.key)
                    else next.delete(r.key)
                    setPicked(next)
                  }} />
              )}
              <div className="grow stack sm" style={{ gap: 6 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Chip tone={TONE[r.type]}>{t(`rem.${r.type}` as DictKey)}</Chip>
                  <button className="title link" onClick={() => nav(r.orderId ? `/orders/${r.orderId}` : `/clients/${r.clientId}`)}>{c?.name}</button>
                  <span className="muted small num">{c?.phone}</span>
                  {scope === 'all' && <span className="muted small">· {L.branch.get(r.branchId)?.name}</span>}
                </div>
                <div className="muted small">{t('nt.due')}: {reason(r)} · SMS: {c ? t(`lang.${c.lang}` as DictKey) : ''}</div>
                <button className="sms-bubble copyable" onClick={() => copy(text)} title={t('nt.clickToCopy')}>
                  {text}
                  <Copy className="copy-icon" />
                </button>
              </div>
              <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => go([r])}><Send />{t('c.send')}</button>
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
  const copy = useCopy()
  const [editing, setEditing] = useState<ReminderType | null>(null)
  const [draft, setDraft] = useState<SmsTemplate | null>(null)

  const start = (tpl: SmsTemplate) => {
    setEditing(tpl.type)
    setDraft(structuredClone(tpl))
  }
  const save = () => {
    if (!draft) return
    mutate((d) => {
      const i = d.smsTemplates.findIndex((x) => x.type === draft.type)
      if (i >= 0) d.smsTemplates[i] = draft
    })
    toast(t('c.saved'))
    setEditing(null)
    setDraft(null)
  }

  return (
    <>
      <div className="notice"><Copy /><span>{t('nt.clickToCopy')}. {t('nt.placeholders')}</span></div>
      <div className="grid g-2">
        {db.smsTemplates.map((tpl) => {
          const isEditing = editing === tpl.type && draft
          return (
            <section className={`card template ${isEditing ? 'editing' : ''}`} key={tpl.type}>
              <div className="card-head">
                <h3>{t(`rem.${tpl.type}` as DictKey)}</h3>
                {isEditing ? (
                  <div className="row nowrap-row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setDraft(null) }}><X />{t('c.cancel')}</button>
                    <button className="btn btn-primary btn-sm" onClick={save}><Check />{t('c.save')}</button>
                  </div>
                ) : (
                  isFounder && <button className="btn btn-ghost btn-sm" onClick={() => start(tpl)}><Pencil />{t('c.edit')}</button>
                )}
              </div>
              <div className="card-body stack">
                {LANGS.map((l) =>
                  isEditing ? (
                    <label key={l} className="field" htmlFor={`tpl-${tpl.type}-${l}`}>
                      <span className="eyebrow">{t(`lang.${l}` as DictKey)} · {draft.text[l].length}</span>
                      <textarea id={`tpl-${tpl.type}-${l}`} className="textarea" rows={3} value={draft.text[l]} onChange={(e) => setDraft({ ...draft, text: { ...draft.text, [l]: e.target.value } })} />
                    </label>
                  ) : (
                    <div key={l} className="stack sm" style={{ gap: 4 }}>
                      <span className="eyebrow">{t(`lang.${l}` as DictKey)}</span>
                      <button className="sms-bubble copyable" onClick={() => copy(tpl.text[l])} title={t('nt.clickToCopy')}>
                        {tpl.text[l]}
                        <Copy className="copy-icon" />
                      </button>
                    </div>
                  ),
                )}
              </div>
            </section>
          )
        })}
      </div>
      {!isFounder && <div className="notice warn">{t('set.onlyFounder')}</div>}
    </>
  )
}

function History() {
  const { t, dateTime } = useI18n()
  const { db, scope } = useStore()
  const L = useLookups()
  const copy = useCopy()
  const [limit, setLimit] = useState(60)
  const log = db.smsLog.filter((s) => scope === 'all' || s.branchId === scope).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  if (!log.length) return <section className="card"><Empty icon={<MessageSquare />} title={t('c.noData')} /></section>
  return (
    <section className="card">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('c.date')}</th><th>{t('nt.recipient')}</th><th>{t('c.type')}</th><th>{t('nt.preview')}</th><th>{t('c.status')}</th><th>{t('nt.sentBy')}</th></tr></thead>
          <tbody>
            {log.slice(0, limit).map((s) => (
              <tr key={s.id}>
                <td className="nowrap soft">{dateTime(s.sentAt)}</td>
                <td><div className="cell-main">{L.client.get(s.clientId ?? '')?.name ?? '—'}</div><div className="cell-sub num">{s.phone}</div></td>
                <td><Chip tone={TONE[s.type]}>{t(`rem.${s.type}` as DictKey)}</Chip></td>
                <td style={{ minWidth: 300, maxWidth: 480 }}>
                  <button className="link small text-left" onClick={() => copy(s.text)} title={t('nt.clickToCopy')}>{s.text}</button>
                  {s.error && <div className="small text-bad">{s.error}</div>}
                </td>
                <td>{s.status ? <Chip tone={SMS_STATUS_TONE[s.status]}>{t(`nt.status.${s.status}` as DictKey)}</Chip> : '—'}</td>
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
