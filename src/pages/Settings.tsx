import { useState } from 'react'
import { Database, Download, Globe, KeyRound, RotateCcw, Save, Store } from 'lucide-react'
import { useI18n, LANGS } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useStore } from '../data/store'
import { CAN_DOWNLOAD } from '../lib/env'
import { todayStr } from '../lib/date'
import type { Settings } from '../data/types'
import { Page } from '../components/Layout'
import { Avatar, Field, MoneyInput, useConfirm, useToast } from '../components/ui'

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const { db, mutate, user, isFounder, reset } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const [s, setS] = useState<Settings>(db.settings)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')

  const saveSettings = () => {
    mutate((d) => (d.settings = { ...s, storeName: s.storeName.trim() || d.settings.storeName }))
    toast(t('c.saved'))
  }
  const changePassword = () => {
    if (password.length < 6) return setPwError(t('set.passwordShort'))
    mutate((d) => {
      const a = d.accounts.find((x) => x.id === user?.id)
      if (a) a.password = password
    })
    setPassword('')
    setPwError('')
    toast(t('c.saved'))
  }
  const doReset = async () => {
    if (!(await confirm(t('set.resetConfirm'), { danger: true, confirmLabel: t('set.reset') }))) return
    reset()
    toast(t('c.saved'))
  }
  const backup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `oqlibos-backup-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Page title={t('set.title')}>
      <div className="grid g-2">
        <section className="card">
          <div className="card-head"><h3><Store />{t('set.store')} · {t('set.rules')}</h3></div>
          <div className="card-body stack">
            {!isFounder && <div className="notice warn">{t('set.onlyFounder')}</div>}
            <fieldset disabled={!isFounder} style={{ border: 0, padding: 0, margin: 0 }} className="form-grid">
              <Field label={t('set.storeName')} htmlFor="set-name" className="span-2"><input id="set-name" className="input" value={s.storeName} onChange={(e) => setS({ ...s, storeName: e.target.value })} /></Field>
              <Field label={t('set.lateFee')} htmlFor="set-late"><MoneyInput id="set-late" value={s.lateFeePerDay} onChange={(v) => setS({ ...s, lateFeePerDay: v })} /></Field>
              <Field label={t('set.security')} htmlFor="set-sec"><MoneyInput id="set-sec" value={s.defaultSecurityDeposit} onChange={(v) => setS({ ...s, defaultSecurityDeposit: v })} /></Field>
              <Field label={t('set.cleaning')} htmlFor="set-clean" hint={t('set.cleaningHint')}>
                <input id="set-clean" className="input num" type="number" min={0} max={14} value={s.cleaningDays} onChange={(e) => setS({ ...s, cleaningDays: Math.max(0, Number(e.target.value)) })} />
              </Field>
              <Field label={t('set.rentalDays')} htmlFor="set-days">
                <input id="set-days" className="input num" type="number" min={1} max={30} value={s.defaultRentalDays} onChange={(e) => setS({ ...s, defaultRentalDays: Math.max(1, Number(e.target.value)) })} />
              </Field>
            </fieldset>
            {isFounder && <div><button className="btn btn-primary" onClick={saveSettings}><Save />{t('c.save')}</button></div>}
          </div>
        </section>

        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="card-head"><h3><Globe />{t('c.language')}</h3></div>
            <div className="card-body">
              <div className="segmented">
                {LANGS.map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{t(`lang.${l}` as DictKey)}</button>)}
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h3><KeyRound />{t('set.profile')}</h3></div>
            <div className="card-body stack">
              {user && (
                <div className="person">
                  <Avatar name={user.name} dark />
                  <div><div className="cell-main">{user.name}</div><div className="cell-sub">{user.email} · {t(`role.${user.role}` as DictKey)}</div></div>
                </div>
              )}
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <Field label={t('set.newPassword')} htmlFor="set-pass" error={pwError} className="span-2">
                  <input id="set-pass" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setPwError('') }} />
                </Field>
                <button className="btn btn-outline" onClick={changePassword}>{t('set.changePassword')}</button>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h3><Database />{t('set.data')}</h3></div>
            <div className="card-body stack">
              <p className="soft">{t('set.dataNote')}</p>
              <div className="row">
                {CAN_DOWNLOAD && <button className="btn btn-outline" onClick={backup}><Download />{t('set.export')}</button>}
                {isFounder && <button className="btn btn-danger" onClick={doReset}><RotateCcw />{t('set.reset')}</button>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </Page>
  )
}
