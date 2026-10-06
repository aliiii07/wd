import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarRange, ClipboardCheck, Plus, ReceiptText, Trash2, UserRound } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { buildPlan, conflictsFor } from '../data/domain'
import { createOrder } from '../data/actions'
import { addDays, diffDays, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import type { OrderItem, OrderType, PaymentMethod } from '../data/types'
import { Page } from '../components/Layout'
import { ClientFormModal, ClientPicker, MethodPicker } from '../components/forms'
import { Chip, Field, MoneyInput, Segmented, useToast } from '../components/ui'

export default function OrderNew() {
  const { t, money, date, loc } = useI18n()
  const { db, scope, mutate } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const today = todayStr()

  const preProduct = params.get('product') ? L.product.get(params.get('product')!) : undefined
  const preClient = params.get('client') ? L.client.get(params.get('client')!) : undefined
  const [type, setType] = useState<OrderType>((params.get('type') as OrderType) || (preProduct?.mode === 'sale' ? 'sale' : 'rental'))
  const [clientId, setClientId] = useState(preClient?.id ?? '')
  const [branchChoice, setBranchChoice] = useState(preProduct?.branchId ?? preClient?.branchId ?? (scope !== 'all' ? scope : ''))
  const client = clientId ? L.client.get(clientId) : undefined
  const branchId = client?.branchId ?? branchChoice

  const initialWedding = preClient?.weddingDate && preClient.weddingDate > today ? preClient.weddingDate : addDays(today, 30)
  const [wedding, setWedding] = useState(initialWedding)
  const [pickup, setPickup] = useState(addDays(initialWedding, type === 'rental' ? -1 : -3))
  const [ret, setRet] = useState(addDays(initialWedding, db.settings.defaultRentalDays - 1))
  const [staffId, setStaffId] = useState('')
  const [items, setItems] = useState<OrderItem[]>(() =>
    preProduct ? [{ productId: preProduct.id, qty: 1, price: type === 'sale' ? preProduct.salePrice : preProduct.rentPrice }] : [],
  )
  const [discount, setDiscount] = useState(0)
  const [security, setSecurity] = useState(preProduct?.securityDeposit ? Math.max(preProduct.securityDeposit, db.settings.defaultSecurityDeposit) : db.settings.defaultSecurityDeposit)
  const [lateFee, setLateFee] = useState(db.settings.lateFeePerDay)
  const [depositTouched, setDepositTouched] = useState(false)
  const [depositInput, setDeposit] = useState(0)
  const [nInst, setNInst] = useState(db.settings.defaultInstallments || 1)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [payNow, setPayNow] = useState(true)
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)
  const [newClient, setNewClient] = useState(false)

  const changeWedding = (w: string) => {
    setWedding(w)
    setPickup(addDays(w, type === 'rental' ? -1 : -3))
    setRet(addDays(w, db.settings.defaultRentalDays - 1))
  }
  const changeType = (tp: OrderType) => {
    setType(tp)
    setPickup(addDays(wedding, tp === 'rental' ? -1 : -3))
    setItems((its) =>
      its
        .filter((i) => {
          const p = L.product.get(i.productId)
          return p && (tp === 'rental' ? p.mode !== 'sale' : p.mode !== 'rent')
        })
        .map((i) => ({ ...i, price: tp === 'rental' ? L.product.get(i.productId)!.rentPrice : L.product.get(i.productId)!.salePrice })),
    )
  }

  const kind = (typeId: string) => L.type.get(typeId)?.kind
  const span: [string, string] = type === 'rental' ? [pickup, addDays(ret, db.settings.cleaningDays)] : [today, '9999-12-31']
  const candidates = useMemo(
    () =>
      scoped.products
        .filter((p) => (!branchId || p.branchId === branchId) && p.status !== 'sold' && (type === 'rental' ? p.mode !== 'sale' : p.mode !== 'rent'))
        .map((p) => ({ p, busy: kind(p.typeId) === 'dress' ? conflictsFor(db, p.id, span[0], span[1]) : [] }))
        .sort((a, b) => (kind(a.p.typeId) === kind(b.p.typeId) ? a.p.code.localeCompare(b.p.code) : kind(a.p.typeId) === 'dress' ? -1 : 1)),
    [scoped.products, branchId, type, span[0], span[1], db.orders],
  )
  const busyOf = (id: string) => candidates.find((c) => c.p.id === id)?.busy ?? []

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const total = Math.max(0, subtotal - discount)
  const deposit = depositTouched ? Math.min(depositInput, total) : Math.round((total * (db.settings.defaultDepositPercent ?? 30)) / 100 / 100_000) * 100_000
  const plan = buildPlan(total, deposit, nInst, today, addDays(pickup, -1))
  const staff = scoped.staff.filter((s) => s.active && (!branchId || s.branchId === branchId) && (s.role === 'sales' || s.role === 'manager' || s.role === 'stylist'))

  const addItem = (id: string) => {
    const p = L.product.get(id)
    if (!p || items.some((i) => i.productId === id)) return
    setItems([...items, { productId: id, qty: 1, price: type === 'rental' ? p.rentPrice : p.salePrice }])
    if (type === 'rental' && kind(p.typeId) === 'dress' && p.securityDeposit > security) setSecurity(p.securityDeposit)
  }

  const errors = {
    client: !clientId ? t('ord.needClient') : '',
    items: items.length === 0 ? t('ord.needItems') : '',
    dates: type === 'rental' && ret < pickup ? t('ord.returnBeforePickup') : '',
    branch: !branchId ? t('c.chooseBranch') : '',
  }
  const valid = !Object.values(errors).some(Boolean)

  const submit = () => {
    setTried(true)
    if (!valid) return
    const id = uid()
    mutate((d) => {
      createOrder(
        d,
        id,
        {
          branchId, clientId, type, status: 'booked', items, discount, charges: [], weddingDate: wedding, pickupDate: pickup,
          returnDate: type === 'rental' ? ret : undefined, securityDeposit: type === 'rental' ? security : 0, lateFeePerDay: lateFee,
          installments: plan, staffId: staffId || undefined, notes: notes || undefined,
        },
        payNow ? { amount: deposit, method } : undefined,
      )
      const c = d.clients.find((x) => x.id === clientId)
      if (c && !c.weddingDate) c.weddingDate = wedding
    })
    toast(t('ord.created'))
    nav(`/orders/${id}`)
  }

  return (
    <Page title={t('ord.new')} tabs={[{ key: 'list', label: t('ord.list'), to: '/orders' }, { key: 'new', label: t('ord.new'), to: '/orders/new' }]} active="new">
      <div className="grid g-side">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="card-head"><h3><UserRound />{t('c.client')}</h3>
              <Segmented<OrderType> value={type} onChange={changeType} options={[{ value: 'rental', label: t('orderType.rental') }, { value: 'sale', label: t('orderType.sale') }]} />
            </div>
            <div className="card-body form-grid">
              <Field label={t('c.client')} htmlFor="o-client" className="span-2" error={tried ? errors.client : undefined}
                hint={<button type="button" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => setNewClient(true)}>{t('ord.newClientInline')}</button>}>
                <ClientPicker id="o-client" value={clientId} onChange={setClientId} branchId={branchChoice || undefined} />
              </Field>
              {scope === 'all' && !client && (
                <Field label={t('c.branch')} htmlFor="o-branch" error={tried ? errors.branch : undefined}>
                  <select id="o-branch" className="select" value={branchChoice} onChange={(e) => { setBranchChoice(e.target.value); setItems([]) }}>
                    <option value="">{t('c.select')}</option>
                    {db.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label={t('ord.consultant')} htmlFor="o-staff">
                <select id="o-staff" className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">{t('c.none')}</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {t(`staffRole.${s.role}` as DictKey)}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3><CalendarRange />{t('ord.info')}</h3>
              {type === 'rental' && ret >= pickup && <span className="sub">{t('ord.rentalDays', { n: diffDays(pickup, ret) + 1 })}</span>}
            </div>
            <div className="card-body form-grid g3">
              <Field label={t('ord.weddingDate')} htmlFor="o-wedding">
                <input id="o-wedding" type="date" className="input" value={wedding} onChange={(e) => e.target.value && changeWedding(e.target.value)} />
              </Field>
              <Field label={type === 'rental' ? t('ord.pickupDate') : t('ord.handoverDate')} htmlFor="o-pickup">
                <input id="o-pickup" type="date" className="input" value={pickup} onChange={(e) => e.target.value && setPickup(e.target.value)} />
              </Field>
              {type === 'rental' && (
                <Field label={t('ord.returnDate')} htmlFor="o-return" error={tried ? errors.dates : undefined}>
                  <input id="o-return" type="date" className="input" value={ret} onChange={(e) => e.target.value && setRet(e.target.value)} />
                </Field>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3><ClipboardCheck />{t('ord.items')}</h3>{tried && errors.items && <span className="chip bad">{errors.items}</span>}</div>
            <div className="card-body stack">
              <Field label={t('ord.addItem')} htmlFor="o-add">
                <select id="o-add" className="select" value="" onChange={(e) => addItem(e.target.value)} disabled={!branchId}>
                  <option value="">{branchId ? t('ord.selectProduct') : t('c.chooseBranch')}</option>
                  {candidates.map(({ p, busy }) => {
                    const acc = kind(p.typeId) === 'accessory'
                    const out = acc && type === 'sale' && p.quantity <= 0
                    return (
                      <option key={p.id} value={p.id} disabled={out || items.some((i) => i.productId === p.id)}>
                        {busy.length ? '⚠ ' : ''}{p.code} · {p.name} · {loc(L.type.get(p.typeId)!.name)}{p.size !== '—' ? ` · ${p.size}` : ''} · {money(type === 'rental' ? p.rentPrice : p.salePrice)}
                        {acc ? ` · ${t('pay.inStock', { n: p.quantity })}` : ''}
                      </option>
                    )
                  })}
                </select>
              </Field>
              {items.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>{t('c.product')}</th><th style={{ width: 90 }}>{t('c.qty')}</th><th style={{ width: 200 }}>{t('c.price')}</th><th /></tr></thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const p = L.product.get(it.productId)!
                        const busy = busyOf(it.productId)
                        const acc = kind(p.typeId) === 'accessory'
                        return (
                          <tr key={it.productId}>
                            <td>
                              <div className="cell-main">{p.name}</div>
                              <div className="cell-sub">{p.code} · {loc(L.type.get(p.typeId)!.name)}{p.size !== '—' ? ` · ${p.size}` : ''}</div>
                              {busy.length > 0 && (
                                <div className="chip bad" style={{ marginTop: 6 }}><AlertTriangle />{t('ord.conflict', { orders: busy.map((o) => o.number).join(', ') })}</div>
                              )}
                            </td>
                            <td>
                              {acc ? (
                                <input className="input num" type="number" min={1} value={it.qty} aria-label={t('c.qty')}
                                  onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)))} />
                              ) : '1'}
                            </td>
                            <td><MoneyInput value={it.price} onChange={(v) => setItems(items.map((x, i) => (i === idx ? { ...x, price: v } : x)))} /></td>
                            <td className="right"><button className="icon-btn" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label={t('c.delete')}><Trash2 /></button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="form-grid g3">
                <Field label={t('ord.discount')} htmlFor="o-discount"><MoneyInput id="o-discount" value={discount} onChange={(v) => setDiscount(Math.min(v, subtotal))} /></Field>
                {type === 'rental' && (
                  <>
                    <Field label={t('ord.security')} htmlFor="o-security"><MoneyInput id="o-security" value={security} onChange={setSecurity} /></Field>
                    <Field label={t('ord.lateFee')} htmlFor="o-late"><MoneyInput id="o-late" value={lateFee} onChange={setLateFee} /></Field>
                  </>
                )}
                <Field label={t('c.notes')} htmlFor="o-notes" className="span-2">
                  <input id="o-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
            </div>
          </section>
        </div>

        <aside className="stack" style={{ gap: 20, alignSelf: 'start', position: 'sticky', top: 16 }}>
          <section className="card">
            <div className="card-head"><h3><ReceiptText />{t('ord.summary')}</h3><Chip tone={type === 'rental' ? 'gold' : 'info'} plain>{t(`orderType.${type}` as DictKey)}</Chip></div>
            <div className="card-body stack">
              <dl className="kv">
                <dt>{t('ord.subtotal')}</dt><dd>{money(subtotal)}</dd>
                {discount > 0 && (<><dt>{t('ord.discount')}</dt><dd>−{money(discount)}</dd></>)}
                <dt className="total">{t('ord.total')}</dt><dd className="total">{money(total)}</dd>
                {type === 'rental' && (<><dt>{t('ord.security')}</dt><dd className="soft">{money(security)}</dd></>)}
              </dl>
              <div className="stack sm">
                <span className="label">{t('ord.plan')}</span>
                <span className="muted small">{t('ord.planHint')}</span>
              </div>
              <div className="form-grid">
                <Field label={t('ord.deposit')} htmlFor="o-deposit"><MoneyInput id="o-deposit" value={deposit} onChange={(v) => { setDepositTouched(true); setDeposit(v) }} /></Field>
                <Field label={t('ord.installments')} htmlFor="o-inst">
                  <select id="o-inst" className="select" value={nInst} onChange={(e) => setNInst(Number(e.target.value))}>
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
              </div>
              {plan.length > 0 && total > 0 && (
                <table className="table">
                  <tbody>
                    {plan.map((r, i) => (
                      <tr key={i}>
                        <td className="soft">{i === 0 ? t('ord.deposit') : t('ord.installmentN', { n: i })}</td>
                        <td className="soft nowrap">{date(r.dueDate)}</td>
                        <td className="num strong">{money(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <label className="check"><input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />{t('ord.recordPayment')}: {money(deposit)}</label>
              {payNow && <MethodPicker value={method} onChange={setMethod} />}
              {tried && !valid && <div className="notice bad"><AlertTriangle />{Object.values(errors).filter(Boolean).join(' · ')}</div>}
              <button className="btn btn-primary btn-block" style={{ height: 44 }} onClick={submit}><Plus />{t('c.create')}</button>
            </div>
          </section>
        </aside>
      </div>
      <ClientFormModal open={newClient} onClose={() => setNewClient(false)} onSaved={(id) => setClientId(id)} />
    </Page>
  )
}
