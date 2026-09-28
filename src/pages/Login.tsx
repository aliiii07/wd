import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, LogIn, Mail } from 'lucide-react'
import { useI18n } from '../i18n'
import { useStore } from '../data/store'
import { DEMO_PASSWORD } from '../data/seed'
import { LangSelect } from '../components/Layout'
import { Avatar, Field } from '../components/ui'

export default function Login() {
  const { t, lang, setLang } = useI18n()
  const { db, login } = useStore()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (login(email, password)) nav('/today', { replace: true })
    else setError(t('auth.error'))
  }

  const demo = db.accounts.filter((a) => a.password === DEMO_PASSWORD && a.active)

  return (
    <div className="login">
      <section className="login-art">
        <div className="lang">
          <LangSelect lang={lang} setLang={setLang} label={t('c.language')} />
        </div>
        <span className="monogram">OL</span>
        <h1>{t('auth.heroTitle')}</h1>
        <span className="rule" />
        <p>{t('auth.heroText')}</p>
      </section>
      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit} noValidate>
          <h2>{t('auth.welcome')}</h2>
          <p className="sub">{t('auth.subtitle')}</p>
          <Field label={t('auth.email')} htmlFor="email">
            <div className="input-group">
              <Mail />
              <input id="email" className="input" type="email" autoComplete="username" value={email} placeholder={t('auth.emailPh')} onChange={(e) => { setEmail(e.target.value); setError('') }} />
            </div>
          </Field>
          <Field label={t('auth.password')} htmlFor="password" error={error}>
            <div className="input-group">
              <KeyRound />
              <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} placeholder={t('auth.passwordPh')} onChange={(e) => { setPassword(e.target.value); setError('') }} style={{ paddingRight: 44 }} />
              <button type="button" className="icon-btn" style={{ position: 'absolute', right: 4 }} onClick={() => setShow((s) => !s)} aria-label={t('auth.password')}>
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </Field>
          <button className="btn btn-primary btn-block" type="submit" style={{ height: 44 }}>
            <LogIn />
            {t('auth.login')}
          </button>
          {demo.length > 0 && (
            <div className="demo-accs">
              <span className="label">{t('auth.demo')}</span>
              {demo.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className="demo-acc"
                  onClick={() => {
                    setEmail(a.email)
                    setPassword(DEMO_PASSWORD)
                    setError('')
                  }}
                >
                  <Avatar name={a.name} />
                  <span>
                    <b>{a.role === 'founder' ? t('role.founder') : `${t('c.branch')}: ${db.branches.find((b) => b.id === a.branchId)?.name ?? ''}`}</b>
                    <br />
                    <span>{a.email}</span>
                  </span>
                </button>
              ))}
              <span className="muted small">
                {t('auth.demoPassword')}: <b className="num">{DEMO_PASSWORD}</b>
              </span>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
