import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, LogIn, Mail } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useStore } from '../data/store'
import { DEMO_PASSWORD } from '../data/seed'
import { PLATFORM } from '../lib/brand'
import { LangSelect, ThemeToggle } from '../components/Layout'
import { Avatar, Field } from '../components/ui'

export default function Login() {
  const { t, lang, setLang } = useI18n()
  const { platform, login } = useStore()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = login(email, password)
    if (result === 'ok') nav(platform.accounts.find((a) => a.email === email.trim().toLowerCase())?.role === 'admin' ? '/admin' : '/today', { replace: true })
    else setError(t(result === 'disabled' ? 'auth.disabled' : 'auth.error'))
  }

  // Boutique logins first; the platform admin last.
  const demo = platform.accounts.filter((a) => a.password === DEMO_PASSWORD && a.active).sort((a, b) => Number(a.role === 'admin') - Number(b.role === 'admin'))
  const shopName = (id?: string) => platform.shops.find((s) => s.id === id)?.name ?? ''

  return (
    <div className="login">
      <div className="login-lang">
        <LangSelect lang={lang} setLang={setLang} label={t('c.language')} />
        <ThemeToggle />
      </div>
      <header className="login-brand">
        <span className="monogram">{PLATFORM.monogram}</span>
        <span className="login-brand-name">{PLATFORM.name}</span>
        <span className="login-brand-sub">{PLATFORM.product}</span>
      </header>
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="stack sm" style={{ textAlign: 'center' }}>
          <h1>{t('auth.welcome')}</h1>
          <p className="muted">{t('auth.subtitle')}</p>
        </div>
        <Field label={t('auth.email')} htmlFor="email">
          <div className="input-group">
            <Mail />
            <input id="email" className="input" type="email" autoComplete="username" value={email} placeholder={t('auth.emailPh')}
              onChange={(e) => { setEmail(e.target.value); setError('') }} />
          </div>
        </Field>
        <Field label={t('auth.password')} htmlFor="password" error={error}>
          <div className="input-group">
            <KeyRound />
            <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password}
              placeholder={t('auth.passwordPh')} onChange={(e) => { setPassword(e.target.value); setError('') }} style={{ paddingRight: 44 }} />
            <button type="button" className="icon-btn" style={{ position: 'absolute', right: 4 }} onClick={() => setShow((s) => !s)} aria-label={t('auth.password')}>
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </Field>
        <button className="btn btn-primary btn-block" type="submit" style={{ height: 46 }}>
          <LogIn />
          {t('auth.login')}
        </button>
        {demo.length > 0 && (
          <details className="demo-accs">
            <summary>{t('auth.demo')} · {t('auth.password').toLowerCase()} <b className="num">{DEMO_PASSWORD}</b></summary>
            <span className="muted small">{t('auth.demoHint')}</span>
            {demo.map((a) => (
              <button type="button" key={a.id} className="demo-acc" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError('') }}>
                <Avatar name={a.name} dark={a.role !== 'manager'} />
                <span>
                  <b>{a.name}</b>
                  <br />
                  <span>{t(`role.${a.role}` as DictKey)}{a.shopId ? ` · ${shopName(a.shopId)}` : ''} · {a.email}</span>
                </span>
              </button>
            ))}
          </details>
        )}
      </form>
      <footer className="login-foot">© {new Date().getFullYear()} {PLATFORM.name} · {t('brand.tagline')}</footer>
    </div>
  )
}
