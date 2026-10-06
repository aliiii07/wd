import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import type {
  Appointment, AppointmentType, Client, ClientSource, Condition, DealMode, DressColor, ID, Lang, Order,
  PaymentKind, PaymentMethod, Product, ProductStatus, Silhouette,
} from '../data/types'
import { groupByOrder, orderMoney, planRows } from '../data/domain'
import { addPayment } from '../data/actions'
import { nowIso, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import { deleteFile } from '../lib/files'
import { Avatar, Field, FormFooter, Modal, MoneyInput, useToast } from './ui'
import { PhotoManager } from './photos'

export const SOURCES: ClientSource[] = ['instagram', 'telegram', 'referral', 'walk_in', 'website', 'other']
export const METHODS: PaymentMethod[] = ['cash', 'card', 'terminal', 'click', 'payme', 'transfer']
export const APPT_TYPES: AppointmentType[] = ['viewing', 'measurement', 'fitting', 'pickup', 'return']
export const COLORS: DressColor[] = ['white', 'ivory', 'champagne', 'blush', 'silver', 'gold', 'red', 'other']
export const STYLES: Silhouette[] = ['a_line', 'ball_gown', 'mermaid', 'sheath', 'princess', 'empire', 'short', 'national']
export const CONDITIONS: Condition[] = ['new', 'excellent', 'good', 'fair', 'damaged']
export const MODES: DealMode[] = ['both', 'rent', 'sale']
export const PRODUCT_STATUSES: ProductStatus[] = ['available', 'reserved', 'rented', 'sold', 'cleaning']

/** Branch picker shown only when the founder is looking at all branches. */
export function useBranchChoice(initial?: ID) {
  const { scope, db } = useStore()
  const [branchId, setBranchId] = useState<ID>(initial ?? (scope !== 'all' ? scope : ''))
  const { t } = useI18n()
  const needed = scope === 'all' && !initial
  const field = needed ? (
    <Field label={t('c.branch')} htmlFor="branch">
      <select id="branch" className="select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
        <option value="">{t('c.select')}</option>
        {db.branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </Field>
  ) : null
  return { branchId, setBranchId, field }
}

// ---------- client picker ----------
export function ClientPicker({ value, onChange, branchId, id = 'client' }: { value: ID; onChange: (id: ID) => void; branchId?: ID; id?: string }) {
  const { t } = useI18n()
  const scoped = useScoped()
  const { client: byId } = useLookups()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selected = value ? byId.get(value) : undefined
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const digits = s.replace(/\D/g, '')
    return scoped.clients
      .filter((c) => (!branchId || c.branchId === branchId) && !c.id.startsWith('walkin-'))
      .filter((c) => !s || c.name.toLowerCase().includes(s) || (digits.length > 2 && c.phone.replace(/\D/g, '').includes(digits)))
      .slice(0, 8)
  }, [q, scoped.clients, branchId])

  if (selected) {
    return (
      <div className="input-group" style={{ border: '1px solid var(--line-2)', borderRadius: 9, padding: '6px 8px', gap: 10 }}>
        <Avatar name={selected.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="strong">{selected.name}</div>
          <div className="cell-sub num">{selected.phone}</div>
        </div>
        <button type="button" className="icon-btn" onClick={() => onChange('')} aria-label={t('c.clear')}>
          <X />
        </button>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <div className="input-group">
        <Search />
        <input
          id={id}
          className="input"
          value={q}
          placeholder={t('cl.searchPh')}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          autoComplete="off"
        />
      </div>
      {open && results.length > 0 && (
        <div className="card" style={{ position: 'absolute', left: 0, right: 0, top: 44, zIndex: 5, boxShadow: 'var(--shadow-pop)', maxHeight: 300, overflowY: 'auto' }}>
          {results.map((c) => (
            <button
              type="button"
              key={c.id}
              className="list-row click"
              style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left' }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c.id); setQ(''); setOpen(false) }}
            >
              <Avatar name={c.name} />
              <span className="grow">
                <span className="title" style={{ display: 'block' }}>{c.name}</span>
                <span className="meta num" style={{ display: 'block' }}>{c.phone}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- client ----------
export function ClientFormModal({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client; onSaved?: (id: ID) => void }) {
  const { t } = useI18n()
  const { upsert } = useStore()
  const toast = useToast()
  const blank = (): Client => ({ id: '', branchId: '', name: '', phone: '+998 ', lang: 'uz', source: 'instagram', createdAt: '' })
  const [c, setC] = useState<Client>(client ?? blank())
  const [tried, setTried] = useState(false)
  const branch = useBranchChoice(client?.branchId)
  useEffect(() => {
    if (open) {
      setC(client ?? blank())
      setTried(false)
    }
  }, [open, client])

  const valid = c.name.trim().length > 1 && c.phone.replace(/\D/g, '').length >= 9 && !!(client?.branchId || branch.branchId)
  const save = () => {
    setTried(true)
    if (!valid) return
    const saved: Client = {
      ...c,
      id: c.id || uid(),
      branchId: client?.branchId ?? branch.branchId,
      name: c.name.trim(),
      createdAt: c.createdAt || nowIso(),
    }
    upsert('clients', saved)
    toast(t('c.saved'))
    onSaved?.(saved.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? t('cl.edit') : t('cl.add')} footer={<FormFooter onCancel={onClose} onSave={save} />}>
      <div className="form-grid">
        <Field label={t('c.fullName')} htmlFor="cl-name" error={tried && c.name.trim().length < 2 ? t('c.required') : undefined}>
          <input id="cl-name" className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} autoFocus />
        </Field>
        <Field label={t('c.phone')} htmlFor="cl-phone" error={tried && c.phone.replace(/\D/g, '').length < 9 ? t('c.required') : undefined}>
          <input id="cl-phone" className="input num" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} inputMode="tel" />
        </Field>
        <Field label={t('ord.weddingDate')} htmlFor="cl-wedding">
          <input id="cl-wedding" type="date" className="input" value={c.weddingDate ?? ''} onChange={(e) => setC({ ...c, weddingDate: e.target.value || undefined })} />
        </Field>
        <Field label={t('cl.source')} htmlFor="cl-source">
          <select id="cl-source" className="select" value={c.source} onChange={(e) => setC({ ...c, source: e.target.value as ClientSource })}>
            {SOURCES.map((s) => <option key={s} value={s}>{t(`source.${s}` as DictKey)}</option>)}
          </select>
        </Field>
        <Field label={t('cl.smsLang')} htmlFor="cl-lang">
          <select id="cl-lang" className="select" value={c.lang} onChange={(e) => setC({ ...c, lang: e.target.value as Lang })}>
            {(['uz', 'ru', 'en'] as Lang[]).map((l) => <option key={l} value={l}>{t(`lang.${l}` as DictKey)}</option>)}
          </select>
        </Field>
        {branch.field}
        <Field label={t('c.notes')} htmlFor="cl-notes" className="span-2">
          <input id="cl-notes" className="input" value={c.notes ?? ''} onChange={(e) => setC({ ...c, notes: e.target.value })} />
        </Field>
      </div>
      {tried && !client?.branchId && !branch.branchId && <div className="notice bad">{t('c.chooseBranch')}</div>}
    </Modal>
  )
}

// ---------- appointment ----------
export function AppointmentFormModal({ open, onClose, appt, defaults }: {
  open: boolean
  onClose: () => void
  appt?: Appointment
  defaults?: Partial<Appointment>
}) {
  const { t } = useI18n()
  const { upsert, db } = useStore()
  const scoped = useScoped()
  const { client: clientById, staff: staffById } = useLookups()
  const toast = useToast()
  const blank = (): Appointment => ({
    id: '', branchId: '', clientId: '', type: 'viewing', date: todayStr(), time: '11:00', duration: db.settings.appointmentMinutes || 60, productIds: [], status: 'scheduled', createdAt: '', ...defaults,
  })
  const [a, setA] = useState<Appointment>(appt ?? blank())
  const [tried, setTried] = useState(false)
  const [newClient, setNewClient] = useState(false)
  useEffect(() => {
    if (open) {
      setA(appt ?? blank())
      setTried(false)
    }
  }, [open, appt])

  const client = a.clientId ? clientById.get(a.clientId) : undefined
  const branchId = client?.branchId ?? a.branchId
  const staff = scoped.staff.filter((s) => s.active && (!branchId || s.branchId === branchId))
  const dresses = scoped.products.filter((p) => (!branchId || p.branchId === branchId) && db.productTypes.find((x) => x.id === p.typeId)?.kind === 'dress' && p.status !== 'sold')
  const clash = a.staffId
    ? scoped.appointments.find((x) => x.id !== a.id && x.staffId === a.staffId && x.date === a.date && x.time === a.time && x.status === 'scheduled')
    : undefined

  const save = () => {
    setTried(true)
    if (!a.clientId || !a.date || !a.time) return
    upsert('appointments', { ...a, id: a.id || uid(), branchId: client!.branchId, createdAt: a.createdAt || nowIso() })
    toast(t('c.saved'))
    onClose()
  }

  return (
    <>
      <Modal open={open && !newClient} onClose={onClose} title={appt ? t('c.edit') : t('ap.new')} size="wide" footer={<FormFooter onCancel={onClose} onSave={save} />}>
        <div className="form-grid">
          <Field label={t('c.client')} htmlFor="ap-client" className="span-2" error={tried && !a.clientId ? t('ord.needClient') : undefined}
            hint={<button type="button" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => setNewClient(true)}>{t('ord.newClientInline')}</button>}>
            <ClientPicker id="ap-client" value={a.clientId} onChange={(id) => setA({ ...a, clientId: id })} />
          </Field>
          <Field label={t('c.type')} htmlFor="ap-type">
            <select id="ap-type" className="select" value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as AppointmentType })}>
              {APPT_TYPES.map((x) => <option key={x} value={x}>{t(`appt.${x}` as DictKey)}</option>)}
            </select>
          </Field>
          <Field label={t('ap.stylist')} htmlFor="ap-staff" error={clash ? t('ap.busy', { name: staffById.get(a.staffId!)?.name ?? '' }) : undefined}>
            <select id="ap-staff" className="select" value={a.staffId ?? ''} onChange={(e) => setA({ ...a, staffId: e.target.value || undefined })}>
              <option value="">{t('c.none')}</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {t(`staffRole.${s.role}` as DictKey)}</option>)}
            </select>
          </Field>
          <Field label={t('c.date')} htmlFor="ap-date">
            <input id="ap-date" type="date" className="input" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} />
          </Field>
          <div className="form-grid" style={{ gap: 12 }}>
            <Field label={t('c.time')} htmlFor="ap-time">
              <input id="ap-time" type="time" className="input" value={a.time} step={900} onChange={(e) => setA({ ...a, time: e.target.value })} />
            </Field>
            <Field label={`${t('ap.duration')}, ${t('c.minutes')}`} htmlFor="ap-dur">
              <select id="ap-dur" className="select" value={a.duration} onChange={(e) => setA({ ...a, duration: Number(e.target.value) })}>
                {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('ap.dresses')} htmlFor="ap-dresses" className="span-2" hint={a.productIds.length ? a.productIds.map((id) => dresses.find((d) => d.id === id)?.name).filter(Boolean).join(', ') : undefined}>
            <select
              id="ap-dresses"
              className="select"
              value=""
              onChange={(e) => e.target.value && !a.productIds.includes(e.target.value) && setA({ ...a, productIds: [...a.productIds, e.target.value] })}
            >
              <option value="">{t('ord.selectProduct')}</option>
              {dresses.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} · {p.size} · {t(`status.${p.status}` as DictKey)}</option>)}
            </select>
          </Field>
          {a.productIds.length > 0 && (
            <div className="row span-2">
              {a.productIds.map((id) => (
                <button type="button" key={id} className="chip gold plain" style={{ border: 0, cursor: 'pointer' }} onClick={() => setA({ ...a, productIds: a.productIds.filter((x) => x !== id) })}>
                  {dresses.find((d) => d.id === id)?.name ?? id} <X />
                </button>
              ))}
            </div>
          )}
          <Field label={t('c.notes')} htmlFor="ap-notes" className="span-2">
            <input id="ap-notes" className="input" value={a.notes ?? ''} onChange={(e) => setA({ ...a, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <ClientFormModal open={open && newClient} onClose={() => setNewClient(false)} onSaved={(id) => setA((x) => ({ ...x, clientId: id }))} />
    </>
  )
}

// ---------- payment ----------
export function PaymentModal({ open, onClose, order }: { open: boolean; onClose: () => void; order: Order }) {
  const { t, money } = useI18n()
  const { db, mutate } = useStore()
  const toast = useToast()
  const pays = groupByOrder(db.payments).get(order.id)
  const m = orderMoney(order, pays)
  const next = planRows(order, m.paid, todayStr()).find((r) => r.state !== 'paid')
  const suggested = Math.min(m.balance, next ? next.amount - next.paid : m.balance)
  const [amount, setAmount] = useState(suggested)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setAmount(suggested)
      setNote('')
    }
  }, [open])
  const kind: PaymentKind = m.paid === 0 ? 'advance' : amount >= m.balance ? 'balance' : 'installment'
  const tooMuch = amount > m.balance

  const save = () => {
    if (amount <= 0 || tooMuch) return
    mutate((d) => addPayment(d, { orderId: order.id, branchId: order.branchId, clientId: order.clientId, amount, kind, method, staffId: order.staffId, note: note || undefined }))
    toast(t('pay.recorded'))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('ord.recordPayment')} size="narrow" footer={<FormFooter onCancel={onClose} onSave={save} saveLabel={t('ord.recordPayment')} disabled={amount <= 0 || tooMuch} />}>
      <dl className="kv">
        <dt>{t('ord.total')}</dt><dd>{money(m.total)}</dd>
        <dt>{t('ord.paid')}</dt><dd>{money(m.paid)}</dd>
        <dt>{t('ord.balance')}</dt><dd className="gold">{money(m.balance)}</dd>
      </dl>
      <Field label={t('c.amount')} htmlFor="pay-amount" error={tooMuch ? t('pay.tooMuch') : undefined} hint={t(`payKind.${kind}` as DictKey)}>
        <MoneyInput id="pay-amount" value={amount} onChange={setAmount} invalid={tooMuch} />
      </Field>
      <div className="row" style={{ gap: 6 }}>
        {[next ? next.amount - next.paid : 0, m.balance].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
          <button key={v} type="button" className="btn btn-outline btn-sm" onClick={() => setAmount(v)}>{money(v)}</button>
        ))}
      </div>
      <Field label={t('pay.method')} htmlFor="pay-method">
        <MethodPicker value={method} onChange={setMethod} />
      </Field>
      <Field label={t('c.notes')} htmlFor="pay-note">
        <input id="pay-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  )
}

/** Payment methods the boutique accepts (Settings → Rental & payments). */
export function useMethods(): PaymentMethod[] {
  const { db } = useStore()
  const on = db.settings.methods?.length ? db.settings.methods : METHODS
  return METHODS.filter((m) => on.includes(m))
}

export function MethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  const { t } = useI18n()
  const methods = useMethods()
  useEffect(() => {
    if (!methods.includes(value) && methods[0]) onChange(methods[0])
  }, [methods, value, onChange])
  return (
    <div className="segmented">
      {methods.map((m) => (
        <button key={m} type="button" className={value === m ? 'on' : ''} onClick={() => onChange(m)}>{t(`method.${m}` as DictKey)}</button>
      ))}
    </div>
  )
}

// ---------- product ----------
export function ProductFormModal({ open, onClose, product, kind }: { open: boolean; onClose: () => void; product?: Product; kind?: 'dress' | 'accessory' }) {
  const { t, loc } = useI18n()
  const { db, upsert } = useStore()
  const toast = useToast()
  const types = db.productTypes.filter((x) => !kind || x.kind === kind || x.id === product?.typeId)
  const blank = (): Product => ({
    id: '', code: '', name: '', typeId: types[0]?.id ?? '', branchId: '', size: '', color: 'white', style: 'a_line', condition: 'new',
    status: 'available', mode: 'both', rentPrice: 0, salePrice: 0, cost: 0, securityDeposit: db.settings.defaultSecurityDeposit, quantity: 1, createdAt: '',
  })
  const [p, setP] = useState<Product>(product ?? blank())
  const [tried, setTried] = useState(false)
  const branch = useBranchChoice(product?.branchId)
  useEffect(() => {
    if (open) {
      setP(product ?? blank())
      setTried(false)
    }
  }, [open, product])
  const before = product?.photos ?? []
  const photos = p.photos ?? []
  // Photos uploaded in this session but not saved are thrown away on cancel.
  const cancel = () => {
    photos.filter((x) => !before.includes(x)).forEach(deleteFile)
    onClose()
  }
  const type = db.productTypes.find((x) => x.id === p.typeId)
  const isAcc = type?.kind === 'accessory'

  const nextCode = () => {
    const prefix = isAcc ? 'AC' : type?.id === 't2' ? 'EV' : type?.id === 't3' ? 'KS' : 'WD'
    const max = Math.max(100, ...db.products.map((x) => Number(x.code.replace(/\D/g, '')) || 0))
    return `${prefix}-${max + 1}`
  }
  const valid = p.name.trim() && p.typeId && (product?.branchId || branch.branchId)
  const save = () => {
    setTried(true)
    if (!valid) return
    upsert('products', {
      ...p,
      id: p.id || uid(),
      code: p.code.trim() || nextCode(),
      branchId: product?.branchId ?? branch.branchId,
      style: isAcc ? undefined : p.style,
      quantity: isAcc ? p.quantity : p.status === 'sold' ? 0 : 1,
      photos,
      createdAt: p.createdAt || nowIso(),
    })
    before.filter((x) => !photos.includes(x)).forEach(deleteFile)
    toast(t('c.saved'))
    onClose()
  }
  const num = (k: keyof Product) => (v: number) => setP({ ...p, [k]: v })

  return (
    <Modal open={open} onClose={cancel} title={product ? t('pr.edit') : t('pr.add')} size="wide" footer={<FormFooter onCancel={cancel} onSave={save} />}>
      <Field label={t('ph.photos')}>
        <PhotoManager id="p-photos" photos={photos} onChange={(ids) => setP((x) => ({ ...x, photos: ids }))} />
      </Field>
      <div className="form-grid g3">
        <Field label={t('c.type')} htmlFor="p-type">
          <select id="p-type" className="select" value={p.typeId} onChange={(e) => setP({ ...p, typeId: e.target.value })}>
            {types.map((x) => <option key={x.id} value={x.id}>{loc(x.name)} · {t(`kind.${x.kind}` as DictKey)}</option>)}
          </select>
        </Field>
        <Field label={t('c.name')} htmlFor="p-name" error={tried && !p.name.trim() ? t('c.required') : undefined}>
          <input id="p-name" className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </Field>
        <Field label={t('pr.code')} htmlFor="p-code" hint={!p.code ? nextCode() : undefined}>
          <input id="p-code" className="input" value={p.code} placeholder={nextCode()} onChange={(e) => setP({ ...p, code: e.target.value.toUpperCase() })} />
        </Field>
        {branch.field}
        <Field label={t('pr.size')} htmlFor="p-size">
          <input id="p-size" className="input" list="sizes" value={p.size} onChange={(e) => setP({ ...p, size: e.target.value })} />
          <datalist id="sizes">{['36', '38', '40', '42', '44', '46', '48', '50', 'XS', 'S', 'M', 'L', 'XL'].map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label={t('pr.color')} htmlFor="p-color">
          <select id="p-color" className="select" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value as DressColor })}>
            {COLORS.map((c) => <option key={c} value={c}>{t(`color.${c}` as DictKey)}</option>)}
          </select>
        </Field>
        {!isAcc && (
          <Field label={t('pr.style')} htmlFor="p-style">
            <select id="p-style" className="select" value={p.style ?? 'a_line'} onChange={(e) => setP({ ...p, style: e.target.value as Silhouette })}>
              {STYLES.map((s) => <option key={s} value={s}>{t(`style.${s}` as DictKey)}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('pr.designer')} htmlFor="p-designer">
          <input id="p-designer" className="input" value={p.designer ?? ''} onChange={(e) => setP({ ...p, designer: e.target.value })} />
        </Field>
        <Field label={t('pr.condition')} htmlFor="p-cond">
          <select id="p-cond" className="select" value={p.condition} onChange={(e) => setP({ ...p, condition: e.target.value as Condition })}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{t(`cond.${c}` as DictKey)}</option>)}
          </select>
        </Field>
        {!isAcc && (
          <Field label={t('c.status')} htmlFor="p-status">
            <select id="p-status" className="select" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as ProductStatus })}>
              {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}` as DictKey)}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('pr.mode')} htmlFor="p-mode">
          <select id="p-mode" className="select" value={p.mode} onChange={(e) => setP({ ...p, mode: e.target.value as DealMode })}>
            {MODES.map((m) => <option key={m} value={m}>{t(`mode.${m}` as DictKey)}</option>)}
          </select>
        </Field>
        {p.mode !== 'sale' && (
          <Field label={t('pr.rentPrice')} htmlFor="p-rent"><MoneyInput id="p-rent" value={p.rentPrice} onChange={num('rentPrice')} /></Field>
        )}
        {p.mode !== 'rent' && (
          <Field label={t('pr.salePrice')} htmlFor="p-sale"><MoneyInput id="p-sale" value={p.salePrice} onChange={num('salePrice')} /></Field>
        )}
        <Field label={t('pr.cost')} htmlFor="p-cost"><MoneyInput id="p-cost" value={p.cost} onChange={num('cost')} /></Field>
        {!isAcc && p.mode !== 'sale' && (
          <Field label={t('pr.security')} htmlFor="p-sec"><MoneyInput id="p-sec" value={p.securityDeposit} onChange={num('securityDeposit')} /></Field>
        )}
        {isAcc && (
          <Field label={t('pr.quantity')} htmlFor="p-qty">
            <input id="p-qty" className="input num" type="number" min={0} value={p.quantity} onChange={(e) => setP({ ...p, quantity: Math.max(0, Number(e.target.value)) })} />
          </Field>
        )}
        <Field label={t('c.notes')} htmlFor="p-notes" className="span-2">
          <input id="p-notes" className="input" value={p.notes ?? ''} onChange={(e) => setP({ ...p, notes: e.target.value })} />
        </Field>
      </div>
      {tried && !product?.branchId && !branch.branchId && <div className="notice bad">{t('c.chooseBranch')}</div>}
    </Modal>
  )
}
