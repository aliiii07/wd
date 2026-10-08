import { useEffect, useMemo, useState } from 'react'
import { Info, Send, Smartphone } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { logSms } from '../data/actions'
import { renderSms, templateFill } from '../data/reminders'
import type { Client, ID, ReminderType, SmsLog } from '../data/types'
import { cleanSmsText, openSmsApp, sendViaGateway, smsParts } from '../lib/sms'
import { todayStr } from '../lib/date'
import { ClientPicker } from './forms'
import { Chip, Field, Modal, useToast, type Tone } from './ui'

export interface Outgoing {
  branchId: ID
  clientId?: ID
  phone: string
  text: string
  type: SmsLog['type']
  refKey?: string
}

export const SMS_STATUS_TONE: Record<NonNullable<SmsLog['status']>, Tone> = { logged: 'neutral', opened: 'info', sent: 'good', failed: 'bad' }

/** Sends (or opens, or just logs) messages according to Settings → SMS, and records each one. */
export function useSmsSender() {
  const { t } = useI18n()
  const { db, mutate, user } = useStore()
  const toast = useToast()
  const cfg = db.settings.sms
  return async (raw: Outgoing[]) => {
    const list = raw.map((m) => ({ ...m, text: cleanSmsText(m.text) })).filter((m) => m.text)
    if (!list.length) return
    const results: (Outgoing & { status: SmsLog['status']; error?: string })[] = []
    if (cfg.mode === 'device') {
      // A phone can only open one prepared message at a time.
      openSmsApp(list[0].phone, list[0].text)
      results.push({ ...list[0], status: 'opened' })
    } else if (cfg.mode === 'gateway') {
      for (const m of list) {
        const r = await sendViaGateway(cfg, m.phone, m.text)
        results.push({ ...m, status: r.ok ? 'sent' : 'failed', error: r.error })
      }
    } else {
      list.forEach((m) => results.push({ ...m, status: 'logged' }))
    }
    mutate((d) => logSms(d, results.map((r) => ({ ...r, sentBy: user?.name }))))
    const failed = results.filter((r) => r.status === 'failed')
    if (failed.length) toast(t('nt.failedN', { n: failed.length, error: failed[0].error ?? '' }), true)
    else toast(cfg.mode === 'gateway' ? t('nt.sentN', { n: results.length }) : cfg.mode === 'device' ? t('nt.openedApp') : t('nt.loggedN', { n: results.length }))
  }
}

export function SmsModeNotice() {
  const { t } = useI18n()
  const { db } = useStore()
  const mode = db.settings.sms.mode
  return (
    <div className={`notice ${mode === 'log' ? 'warn' : ''}`}>
      {mode === 'device' ? <Smartphone /> : <Info />}
      <span>
        {t('nt.modeNow', { mode: t(`nt.mode.${mode}` as DictKey) })} {mode === 'log' ? t('nt.logOnly') : mode === 'device' ? t('nt.deviceOne') : ''}
      </span>
    </div>
  )
}

/** Find any client and write them anything; templates can be dropped in as a starting point. */
export function SmsComposer({ client: fixed, onSent }: { client?: Client; onSent?: () => void }) {
  const { t, lang, dateTime } = useI18n()
  const { db } = useStore()
  const L = useLookups()
  const send = useSmsSender()
  const [clientId, setClientId] = useState(fixed?.id ?? '')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setClientId(fixed?.id ?? ''), [fixed])
  const client = clientId ? L.client.get(clientId) : undefined
  const parts = smsParts(text)
  const history = useMemo(() => db.smsLog.filter((s) => s.clientId && s.clientId === clientId).slice(0, 5), [db.smsLog, clientId])

  const insert = (type: ReminderType) => {
    const tpl = db.smsTemplates.find((x) => x.type === type)
    if (!tpl) return
    const target = client?.lang ?? lang
    const body = tpl.text[target] || tpl.text.uz
    setText(client ? renderSms(body, templateFill(type, client, db, todayStr()), client, L.branch.get(client.branchId), db.settings.storeName, target, true) : body)
  }

  const submit = async () => {
    if (!client || !text.trim()) return
    setBusy(true)
    await send([{ branchId: client.branchId, clientId: client.id, phone: client.phone, text: text.trim(), type: 'custom' }])
    setBusy(false)
    setText('')
    onSent?.()
  }

  return (
    <div className="stack">
      {!fixed && (
        <Field label={t('nt.findClient')} htmlFor="sms-client">
          <ClientPicker id="sms-client" value={clientId} onChange={setClientId} />
        </Field>
      )}
      {fixed && (
        <Field label={t('nt.recipient')}>
          <div className="strong">{fixed.name} · <span className="num">{fixed.phone}</span></div>
        </Field>
      )}
      <div className="row between">
        <label className="label" htmlFor="sms-text">{t('nt.message')}</label>
        <select id="sms-template" className="select select-sm" value="" onChange={(e) => e.target.value && insert(e.target.value as ReminderType)} aria-label={t('nt.insertTemplate')}>
          <option value="">{t('nt.insertTemplate')}</option>
          {db.smsTemplates.map((x) => <option key={x.type} value={x.type}>{t(`rem.${x.type}` as DictKey)}</option>)}
        </select>
      </div>
      <textarea id="sms-text" className="textarea" rows={5} value={text} placeholder={t('nt.messagePh')} onChange={(e) => setText(e.target.value)} />
      <div className="row between">
        <span className="muted small">{t('nt.parts', { len: text.length, n: parts.parts })}</span>
        <button className="btn btn-primary" disabled={!client || !text.trim() || busy} onClick={submit} title={!client ? t('nt.chooseClient') : undefined}>
          <Send />
          {t('c.send')}
        </button>
      </div>
      {history.length > 0 && (
        <div className="stack sm">
          <span className="eyebrow">{t('nt.lastMessages')}</span>
          {history.map((h) => (
            <div key={h.id} className="sms-bubble">
              <div className="row between">
                <span className="muted small">{dateTime(h.sentAt)}</span>
                {h.status && <Chip tone={SMS_STATUS_TONE[h.status]}>{t(`nt.status.${h.status}` as DictKey)}</Chip>}
              </div>
              <div>{h.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SmsComposeModal({ open, onClose, client }: { open: boolean; onClose: () => void; client?: Client }) {
  const { t } = useI18n()
  return (
    <Modal open={open} onClose={onClose} title={t('nt.compose')}>
      <SmsModeNotice />
      <SmsComposer client={client} onSent={onClose} />
    </Modal>
  )
}
