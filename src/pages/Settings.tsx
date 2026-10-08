import { useEffect, useState, type ReactNode } from 'react'
import { Check, Database, Download, FileText, KeyRound, MessageSquare, Monitor, Moon, Palette, RotateCcw, Save, Send, Store, Sun, Upload, Wallet } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useStore } from '../data/store'
import { DEMO_SHOP_ID, migrateShopDb } from '../data/seed'
import { REMINDER_ORDER } from '../data/reminders'
import { CAN_DOWNLOAD } from '../lib/env'
import { todayStr } from '../lib/date'
import { openSmsApp, sendViaGateway } from '../lib/sms'
import { useTheme, type ThemeMode } from '../lib/theme'
import type { Accent, DB, Settings, SmsMode } from '../data/types'
import { Page } from '../components/Layout'
import { METHODS } from '../components/forms'
import { Avatar, Field, MoneyInput, Segmented, useConfirm, useToast } from '../components/ui'

type Tab = 'store' | 'rental' | 'sms' | 'contract' | 'look' | 'account' | 'data'
const ACCENTS: { key: Accent; color: string }[] = [
  { key: 'gold', color: '#a8864f' },
  { key: 'rose', color: '#b07a6e' },
  { key: 'emerald', color: '#3f7b67' },
  { key: 'wine', color: '#8e3b4a' },
  { key: 'noir', color: '#3a3631' },
  { key: 'sage', color: '#6f8a6c' },
  { key: 'dusk', color: '#5e7d96' },
  { key: 'mauve', color: '#8a6a86' },
]
const MODES: SmsMode[] = ['log', 'device', 'gateway']

export default function SettingsPage() {
  const { t } = useI18n()
  const { db, mutate, mutatePlatform, shop, isFounder } = useStore()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('store')
  const [s, setS] = useState<Settings>(db.settings)
  useEffect(() => setS(db.settings), [db.settings])
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings)
  const editable = ['store', 'rental', 'sms', 'contract'].includes(tab)

  const save = () => {
    const name = s.storeName.trim() || db.settings.storeName
    mutate((d) => (d.settings = { ...s, storeName: name, orderPrefix: s.orderPrefix.trim().toUpperCase() || d.settings.orderPrefix }))
    // The boutique's name also shows on the platform's list of boutiques.
    mutatePlatform((p) => {
      const x = p.shops.find((y) => y.id === shop?.id)
      if (x) x.name = name
    })
    toast(t('c.saved'))
  }

  return (
    <Page
      title={t('set.title')}
      tabs={[
        { key: 'store', label: t('set.tab.store') },
        { key: 'rental', label: t('set.tab.rental') },
        { key: 'sms', label: t('set.tab.sms') },
        { key: 'contract', label: t('set.tab.contract') },
        { key: 'look', label: t('set.tab.look') },
        { key: 'account', label: t('set.tab.account') },
        { key: 'data', label: t('set.tab.data') },
      ]}
      active={tab}
      onTab={(k) => setTab(k as Tab)}
      actions={editable && isFounder ? <button className="btn btn-primary" disabled={!dirty} onClick={save}><Save />{t('c.save')}</button> : undefined}
    >
      {editable && !isFounder && <div className="notice warn">{t('set.onlyFounder')}</div>}
      <fieldset className="settings" disabled={editable && !isFounder}>
        {tab === 'store' && <StoreTab s={s} setS={setS} />}
        {tab === 'rental' && <RentalTab s={s} setS={setS} />}
        {tab === 'sms' && <SmsTab s={s} setS={setS} />}
        {tab === 'contract' && <ContractTab s={s} setS={setS} />}
      </fieldset>
      {tab === 'look' && <LookTab />}
      {tab === 'account' && <AccountTab />}
      {tab === 'data' && <DataTab />}
    </Page>
  )
}

type TabProps = { s: Settings; setS: (s: Settings) => void }

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card settings-section">
      <div className="settings-side">
        <h3>{icon}{title}</h3>
        {hint && <p className="muted small">{hint}</p>}
      </div>
      <div className="settings-body">{children}</div>
    </section>
  )
}

function StoreTab({ s, setS }: TabProps) {
  const { t } = useI18n()
  return (
    <>
      <Section icon={<Store />} title={t('set.store')}>
        <div className="form-grid">
          <Field label={t('set.storeName')} htmlFor="set-name"><input id="set-name" className="input" value={s.storeName} onChange={(e) => setS({ ...s, storeName: e.target.value })} /></Field>
          <Field label={t('set.orderPrefix')} htmlFor="set-prefix" hint={t('set.orderPrefixHint')}>
            <input id="set-prefix" className="input" maxLength={4} value={s.orderPrefix} onChange={(e) => setS({ ...s, orderPrefix: e.target.value.toUpperCase() })} />
          </Field>
          <Field label={t('set.phone')} htmlFor="set-phone"><input id="set-phone" className="input num" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
          <Field label={t('set.instagram')} htmlFor="set-ig"><input id="set-ig" className="input" value={s.instagram} placeholder="@" onChange={(e) => setS({ ...s, instagram: e.target.value })} /></Field>
          <Field label={t('set.telegram')} htmlFor="set-tg"><input id="set-tg" className="input" value={s.telegram} placeholder="@" onChange={(e) => setS({ ...s, telegram: e.target.value })} /></Field>
        </div>
      </Section>
      <Section icon={<Store />} title={t('set.hours')}>
        <div className="form-grid g3">
          <Field label={t('set.open')} htmlFor="set-open"><input id="set-open" type="time" className="input" value={s.openTime} onChange={(e) => setS({ ...s, openTime: e.target.value })} /></Field>
          <Field label={t('set.close')} htmlFor="set-close"><input id="set-close" type="time" className="input" value={s.closeTime} onChange={(e) => setS({ ...s, closeTime: e.target.value })} /></Field>
          <Field label={t('set.apptMinutes')} htmlFor="set-appt">
            <select id="set-appt" className="select" value={s.appointmentMinutes} onChange={(e) => setS({ ...s, appointmentMinutes: Number(e.target.value) })}>
              {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
      </Section>
    </>
  )
}

function RentalTab({ s, setS }: TabProps) {
  const { t } = useI18n()
  const toggleMethod = (m: (typeof METHODS)[number]) => {
    const on = s.methods.includes(m) ? s.methods.filter((x) => x !== m) : [...s.methods, m]
    if (on.length) setS({ ...s, methods: on })
  }
  return (
    <>
      <Section icon={<Wallet />} title={t('set.rules')}>
        <div className="form-grid">
          <Field label={t('set.lateFee')} htmlFor="set-late"><MoneyInput id="set-late" value={s.lateFeePerDay} onChange={(v) => setS({ ...s, lateFeePerDay: v })} /></Field>
          <Field label={t('set.security')} htmlFor="set-sec"><MoneyInput id="set-sec" value={s.defaultSecurityDeposit} onChange={(v) => setS({ ...s, defaultSecurityDeposit: v })} /></Field>
          <Field label={t('set.cleaning')} htmlFor="set-clean" hint={t('set.cleaningHint')}>
            <input id="set-clean" className="input num" type="number" min={0} max={14} value={s.cleaningDays} onChange={(e) => setS({ ...s, cleaningDays: Math.max(0, Number(e.target.value)) })} />
          </Field>
          <Field label={t('set.rentalDays')} htmlFor="set-days">
            <input id="set-days" className="input num" type="number" min={1} max={30} value={s.defaultRentalDays} onChange={(e) => setS({ ...s, defaultRentalDays: Math.max(1, Number(e.target.value)) })} />
          </Field>
          <Field label={t('set.depositPercent')} htmlFor="set-dep">
            <input id="set-dep" className="input num" type="number" min={0} max={100} step={5} value={s.defaultDepositPercent} onChange={(e) => setS({ ...s, defaultDepositPercent: Math.min(100, Math.max(0, Number(e.target.value))) })} />
          </Field>
          <Field label={t('set.installments')} htmlFor="set-inst">
            <select id="set-inst" className="select" value={s.defaultInstallments} onChange={(e) => setS({ ...s, defaultInstallments: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
      </Section>
      <Section icon={<Wallet />} title={t('set.methods')} hint={t('set.methodsHint')}>
        <div className="choice-grid">
          {METHODS.map((m) => (
            <label key={m} className={`choice ${s.methods.includes(m) ? 'on' : ''}`}>
              <input type="checkbox" checked={s.methods.includes(m)} onChange={() => toggleMethod(m)} />
              <span>{t(`method.${m}` as DictKey)}</span>
            </label>
          ))}
        </div>
      </Section>
    </>
  )
}

function SmsTab({ s, setS }: TabProps) {
  const { t } = useI18n()
  const toast = useToast()
  const sms = s.sms
  const set = (patch: Partial<Settings['sms']>) => setS({ ...s, sms: { ...sms, ...patch } })
  const [phone, setPhone] = useState('+998 ')
  const [busy, setBusy] = useState(false)
  const test = async () => {
    const text = t('set.sms.testText')
    if (sms.mode === 'device') return openSmsApp(phone, text)
    setBusy(true)
    const r = await sendViaGateway(sms, phone, text)
    setBusy(false)
    toast(r.ok ? t('set.sms.testOk') : t('nt.failedN', { n: 1, error: r.error ?? '' }), !r.ok)
  }
  return (
    <>
      <Section icon={<MessageSquare />} title={t('set.sms.mode')}>
        <div className="mode-cards">
          {MODES.map((m) => (
            <label key={m} className={`mode-card ${sms.mode === m ? 'on' : ''}`}>
              <input type="radio" name="sms-mode" checked={sms.mode === m} onChange={() => set({ mode: m })} />
              <b>{t(`nt.mode.${m}` as DictKey)}</b>
              <span>{t(m === 'log' ? 'set.sms.modeLog' : m === 'device' ? 'set.sms.modeDevice' : 'set.sms.modeGateway')}</span>
            </label>
          ))}
        </div>
        {sms.mode === 'gateway' && (
          <div className="form-grid" style={{ marginTop: 18 }}>
            <Field label={t('set.sms.gatewayUrl')} htmlFor="sms-url" className="span-2">
              <input id="sms-url" className="input" value={sms.gatewayUrl} placeholder="https://sms.example.uz" onChange={(e) => set({ gatewayUrl: e.target.value.trim() })} />
            </Field>
            <Field label={t('set.sms.apiKey')} htmlFor="sms-key" hint={t('set.sms.secret')}>
              <input id="sms-key" className="input" type="password" autoComplete="off" value={sms.apiKey} onChange={(e) => set({ apiKey: e.target.value })} />
            </Field>
            <Field label={t('set.sms.sender')} htmlFor="sms-from" hint={t('set.sms.senderHint')}>
              <input id="sms-from" className="input" value={sms.sender} onChange={(e) => set({ sender: e.target.value })} />
            </Field>
          </div>
        )}
        {sms.mode !== 'log' && (
          <div className="row" style={{ marginTop: 18, alignItems: 'flex-end' }}>
            <Field label={t('set.sms.testPhone')} htmlFor="sms-test"><input id="sms-test" className="input num" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <button className="btn btn-outline" disabled={busy || phone.replace(/\D/g, '').length < 9} onClick={test}><Send />{t('set.sms.test')}</button>
          </div>
        )}
      </Section>
      <Section icon={<MessageSquare />} title={t('set.sms.reminders')}>
        <div className="choice-grid">
          {REMINDER_ORDER.map((r) => (
            <label key={r} className={`choice ${sms.reminders[r] !== false ? 'on' : ''}`}>
              <input type="checkbox" checked={sms.reminders[r] !== false} onChange={(e) => set({ reminders: { ...sms.reminders, [r]: e.target.checked } })} />
              <span>{t(`rem.${r}` as DictKey)}</span>
            </label>
          ))}
        </div>
        <div className="form-grid g3" style={{ marginTop: 18 }}>
          <Field label={t('set.sms.pickupAhead')} htmlFor="sms-pick"><input id="sms-pick" className="input num" type="number" min={0} max={14} value={sms.pickupDaysAhead} onChange={(e) => set({ pickupDaysAhead: Math.max(0, Number(e.target.value)) })} /></Field>
          <Field label={t('set.sms.weddingAhead')} htmlFor="sms-wed"><input id="sms-wed" className="input num" type="number" min={1} max={30} value={sms.weddingDaysAhead} onChange={(e) => set({ weddingDaysAhead: Math.max(1, Number(e.target.value)) })} /></Field>
          <Field label={t('set.sms.balanceAhead')} htmlFor="sms-bal"><input id="sms-bal" className="input num" type="number" min={1} max={30} value={sms.balanceDaysAhead} onChange={(e) => set({ balanceDaysAhead: Math.max(1, Number(e.target.value)) })} /></Field>
        </div>
      </Section>
      <Section icon={<MessageSquare />} title={t('set.sms.guide')}>
        <ol className="guide">
          {(['set.sms.g1', 'set.sms.g2', 'set.sms.g3', 'set.sms.g4'] as DictKey[]).map((k) => <li key={k}>{t(k)}</li>)}
        </ol>
      </Section>
    </>
  )
}

function ContractTab({ s, setS }: TabProps) {
  const { t } = useI18n()
  return (
    <Section icon={<FileText />} title={t('set.legal')} hint={t('set.legalHint')}>
      <div className="form-grid">
        <Field label={t('set.legalName')} htmlFor="set-legal" className="span-2"><input id="set-legal" className="input" value={s.legalName} onChange={(e) => setS({ ...s, legalName: e.target.value })} /></Field>
        <Field label={t('set.inn')} htmlFor="set-inn"><input id="set-inn" className="input num" value={s.inn} onChange={(e) => setS({ ...s, inn: e.target.value })} /></Field>
        <Field label={t('set.mfo')} htmlFor="set-mfo"><input id="set-mfo" className="input num" value={s.mfo} onChange={(e) => setS({ ...s, mfo: e.target.value })} /></Field>
        <Field label={t('set.bankName')} htmlFor="set-bank"><input id="set-bank" className="input" value={s.bankName} onChange={(e) => setS({ ...s, bankName: e.target.value })} /></Field>
        <Field label={t('set.bankAccount')} htmlFor="set-acc"><input id="set-acc" className="input num" value={s.bankAccount} onChange={(e) => setS({ ...s, bankAccount: e.target.value })} /></Field>
        <Field label={t('set.contractNote')} htmlFor="set-note" className="span-2">
          <textarea id="set-note" className="textarea" rows={3} value={s.contractNote} onChange={(e) => setS({ ...s, contractNote: e.target.value })} />
        </Field>
      </div>
    </Section>
  )
}

function LookTab() {
  const { t } = useI18n()
  const { db, mutate, isFounder } = useStore()
  const { mode, setMode } = useTheme()
  return (
    <>
      <Section icon={<Palette />} title={t('set.theme')} hint={t('set.themeHint')}>
        <Segmented<ThemeMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'light', label: <><Sun />{t('theme.light')}</> },
            { value: 'dark', label: <><Moon />{t('theme.dark')}</> },
            { value: 'system', label: <><Monitor />{t('theme.system')}</> },
          ]}
        />
      </Section>
      <Section icon={<Palette />} title={t('set.accent')} hint={t('set.accentHint')}>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              className={`swatch-btn ${db.settings.accent === a.key ? 'on' : ''}`}
              disabled={!isFounder}
              onClick={() => mutate((d) => (d.settings.accent = a.key))}
              aria-pressed={db.settings.accent === a.key}
            >
              <i style={{ background: a.color }}>{db.settings.accent === a.key && <Check />}</i>
              <span>{t(`accent.${a.key}` as DictKey)}</span>
            </button>
          ))}
        </div>
        {!isFounder && <p className="muted small">{t('set.onlyFounder')}</p>}
      </Section>
    </>
  )
}

function AccountTab() {
  const { t } = useI18n()
  const { mutatePlatform, user } = useStore()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const change = () => {
    if (password.length < 6) return setError(t('set.passwordShort'))
    mutatePlatform((p) => {
      const a = p.accounts.find((x) => x.id === user?.id)
      if (a) a.password = password
    })
    setPassword('')
    setError('')
    toast(t('c.saved'))
  }
  return (
    <Section icon={<KeyRound />} title={t('set.profile')}>
      {user && (
        <div className="person" style={{ marginBottom: 18 }}>
          <Avatar name={user.name} dark />
          <div><div className="cell-main">{user.name}</div><div className="cell-sub">{user.email} · {t(`role.${user.role}` as DictKey)}</div></div>
        </div>
      )}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label={t('set.newPassword')} htmlFor="set-pass" error={error}>
          <input id="set-pass" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
        </Field>
        <button className="btn btn-outline" onClick={change}>{t('set.changePassword')}</button>
      </div>
    </Section>
  )
}

function DataTab() {
  const { t } = useI18n()
  const { db, mutate, shop, isFounder, resetDemo } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const backup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${db.settings.storeName.trim().toLowerCase().replace(/\s+/g, '-') || 'boutique'}-backup-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      // Backups from an older version are upgraded the same way stored data is.
      const data = migrateShopDb(JSON.parse(await file.text()) as DB)
      if (!data || !Array.isArray(data.clients)) throw new Error('shape')
      if (!(await confirm(t('set.importConfirm'), { danger: true, confirmLabel: t('set.import') }))) return
      mutate((d) => Object.assign(d, data))
      toast(t('set.importOk'))
    } catch {
      toast(t('set.importBad'), true)
    }
  }
  const doReset = async () => {
    if (!(await confirm(t('set.resetConfirm'), { danger: true, confirmLabel: t('set.reset') }))) return
    resetDemo()
    toast(t('c.saved'))
  }
  return (
    <Section icon={<Database />} title={t('set.data')} hint={t('set.dataNote')}>
      <div className="row">
        {CAN_DOWNLOAD && <button className="btn btn-outline" onClick={backup}><Download />{t('set.export')}</button>}
        {isFounder && (
          <label className="btn btn-outline" htmlFor="set-restore">
            <Upload />{t('set.import')}
            <input id="set-restore" type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          </label>
        )}
        {isFounder && shop?.id === DEMO_SHOP_ID && <button className="btn btn-danger" onClick={doReset}><RotateCcw />{t('set.reset')}</button>}
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>{t('set.exportHint')}</p>
    </Section>
  )
}
