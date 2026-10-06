import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Minus, Search, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { AppointmentStatus, DressColor, ProductStatus } from '../data/types'
import type { DisplayStatus } from '../data/domain'
import { dressColorHex } from './art'

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'gold' | 'dark'

// ---------- tone maps ----------
export const productTone: Record<ProductStatus, Tone> = {
  available: 'good', reserved: 'gold', rented: 'dark', sold: 'neutral', cleaning: 'warn',
}
export const orderTone: Record<DisplayStatus, Tone> = {
  booked: 'gold', picked_up: 'dark', returned: 'warn', completed: 'good', cancelled: 'neutral', overdue: 'bad',
}
export const apptTone: Record<AppointmentStatus, Tone> = {
  scheduled: 'gold', completed: 'good', cancelled: 'neutral', no_show: 'bad',
}

export function Chip({ tone = 'neutral', children, plain, className = '' }: { tone?: Tone; children: ReactNode; plain?: boolean; className?: string }) {
  return <span className={`chip ${tone} ${plain ? 'plain' : ''} ${className}`}>{children}</span>
}

// ---------- modal ----------
export function Modal({ open, onClose, title, children, footer, size }: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'wide' | 'narrow'
}) {
  const { t } = useI18n()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ?? ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('c.close')}>
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- confirm (window.confirm is blocked in some embeds) ----------
interface ConfirmReq { message: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void }
const ConfirmCtx = createContext<(message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmReq | null>(null)
  const { t } = useI18n()
  const ask = useCallback(
    (message: string, opts?: { confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setReq({ message, ...opts, resolve })),
    [],
  )
  const close = (v: boolean) => {
    req?.resolve(v)
    setReq(null)
  }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal
        open={!!req}
        onClose={() => close(false)}
        title={t('c.confirm')}
        size="narrow"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => close(false)}>{t('c.cancel')}</button>
            <button className={`btn ${req?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
              {req?.confirmLabel ?? t('c.confirm')}
            </button>
          </>
        }
      >
        <div className="notice warn">
          <AlertTriangle />
          <span>{req?.message}</span>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)

// ---------- toasts ----------
interface Toast { id: number; text: string; bad?: boolean }
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const push = useCallback((text: string, bad?: boolean) => {
    const id = ++seq.current
    setToasts((ts) => [...ts, { id, text, bad }])
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.bad ? 'bad' : ''}`}>
            {x.bad ? <AlertTriangle /> : <Check />}
            {x.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------- form bits ----------
export function Field({ label, hint, error, children, className = '', htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

/** Digits-only money input that shows thousands separators while typing. */
export function MoneyInput({ value, onChange, id, placeholder, invalid }: { value: number; onChange: (n: number) => void; id?: string; placeholder?: string; invalid?: boolean }) {
  const { lang } = useI18n()
  const suffix = lang === 'uz' ? "so'm" : lang === 'ru' ? 'сум' : 'UZS'
  const shown = value ? Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''
  return (
    <div className="input-group">
      <input
        id={id}
        className={`input has-suffix num ${invalid ? 'invalid' : ''}`}
        inputMode="numeric"
        value={shown}
        placeholder={placeholder ?? '0'}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      />
      <span className="suffix">{suffix}</span>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder, id = 'search' }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  const { t } = useI18n()
  return (
    <div className="input-group">
      <Search />
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? t('c.search')} />
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- display bits ----------
export function Stat({ label, value, icon, delta, hint, alert, upIsGood = true }: {
  label: ReactNode
  value: ReactNode
  icon?: ReactNode
  delta?: { pct: number | null; label: string }
  hint?: ReactNode
  alert?: boolean
  upIsGood?: boolean
}) {
  let deltaEl: ReactNode = null
  if (delta) {
    const p = delta.pct
    const dir = p == null || Math.abs(p) < 0.5 ? 'flat' : p > 0 ? 'up' : 'down'
    const good = dir === 'flat' ? 'flat' : (dir === 'up') === upIsGood ? 'up' : 'down'
    deltaEl = (
      <span className="row" style={{ gap: 6 }}>
        <span className={`delta ${good}`}>
          {dir === 'up' ? <ArrowUpRight /> : dir === 'down' ? <ArrowDownRight /> : <Minus />}
          {p == null ? '—' : `${p > 0 ? '+' : ''}${Math.round(p)}%`}
        </span>
        <span className="stat-hint">{delta.label}</span>
      </span>
    )
  }
  return (
    <div className={`card stat ${alert ? 'alert' : ''}`}>
      <div className="stat-label">
        {icon}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {deltaEl}
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0
  return ((cur - prev) / prev) * 100
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <b>{title}</b>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  )
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/** One of five soft brand tints, fixed per name so a person keeps her colour everywhere. */
function tintOf(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `a${h % 5}`
}

export function Avatar({ name, dark, lg, src }: { name: string; dark?: boolean; lg?: boolean; src?: string }) {
  return (
    <span className={`avatar ${dark ? 'dark' : tintOf(name)} ${lg ? 'lg' : ''} ${src ? 'photo' : ''}`}>
      {src ? <img src={src} alt={name} /> : initials(name)}
    </span>
  )
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`progress ${pct >= 100 ? 'done' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ColorDot({ color }: { color: DressColor }) {
  return <span className="color-dot" style={{ background: dressColorHex[color] }} />
}

/** A modal's standard cancel/save pair. */
export function FormFooter({ onCancel, onSave, saveLabel, disabled, extra }: { onCancel: () => void; onSave: () => void; saveLabel?: string; disabled?: boolean; extra?: ReactNode }) {
  const { t } = useI18n()
  return (
    <>
      {extra}
      <span className="spacer" />
      <button className="btn btn-outline" onClick={onCancel}>{t('c.cancel')}</button>
      <button className="btn btn-primary" onClick={onSave} disabled={disabled}>{saveLabel ?? t('c.save')}</button>
    </>
  )
}
