import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Wallet } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { cashOf, revenueOf } from '../data/domain'
import { addPayment, createOrder, handOver } from '../data/actions'
import { addDays, dateOf, inRange, nowIso, startOfMonth, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import type { ID, PaymentKind, PaymentMethod } from '../data/types'
import { Page } from '../components/Layout'
import { ClientPicker, MethodPicker, METHODS } from '../components/forms'
import { Chip, Empty, Field, MoneyInput, SearchInput, Segmented, Stat, useToast } from '../components/ui'

type Range = 'today' | 'week' | 'month' | 'all'
const KINDS: PaymentKind[] = ['advance', 'installment', 'balance', 'fee', 'refund', 'security', 'security_return']

export default function Payments() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'pos' ? 'pos' : 'history'
  return (
    <Page title={t('pay.title')} tabs={[{ key: 'history', label: t('pay.history') }, { key: 'pos', label: t('pay.pos') }]} active={tab}
      onTab={(k) => setParams(k === 'pos' ? { tab: 'pos' } : {}, { replace: true })}>
      {tab === 'history' ? <History /> : <Pos />}
    </Page>
  )
}

function History() {
  const { t, money, moneyShort, dateTime } = useI18n()
  const { scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const today = todayStr()
  const [range, setRange] = useState<Range>('month')
  const [method, setMethod] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(80)
  const from = range === 'today' ? today : range === 'week' ? addDays(today, -6) : range === 'month' ? startOfMonth(today) : '0000-01-01'

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return scoped.payments
      .filter((p) => inRange(dateOf(p.date), from, today) && (!method || p.method === method) && (!kind || p.kind === kind))
      .filter((p) => !s || !!L.client.get(p.clientId ?? '')?.name.toLowerCase().includes(s) || !!L.order.get(p.orderId ?? '')?.number.toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [scoped.payments, from, today, method, kind, q, L])

  const income = list.reduce((s, p) => s + Math.max(0, revenueOf(p)), 0)
  const refunds = list.filter((p) => p.kind === 'refund' || p.kind === 'security_return').reduce((s, p) => s + p.amount, 0)
  const deposits = list.filter((p) => p.kind === 'security').reduce((s, p) => s + p.amount, 0)
  const net = list.reduce((s, p) => s + cashOf(p), 0)

  return (
    <>
      <div className="row between">
        <Segmented<Range> value={range} onChange={setRange} options={[
          { value: 'today', label: t('c.today') }, { value: 'week', label: '7 ' + t('c.days', { n: '' }).trim() },
          { value: 'month', label: t('an.p.thisMonth') }, { value: 'all', label: t('c.all') },
        ]} />
      </div>
      <div className="stats">
        <Stat icon={<ArrowDownLeft />} label={t('pay.income')} value={<span title={money(income)}>{moneyShort(income)}</span>} />
        <Stat icon={<ArrowUpRight />} label={t('pay.refunds')} value={moneyShort(refunds)} />
        <Stat icon={<ShieldCheck />} label={t('pay.securityIn')} value={moneyShort(deposits)} />
        <Stat icon={<Wallet />} label={t('c.total')} value={<span title={money(net)}>{moneyShort(net)}</span>} />
      </div>
      <section className="card">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder={`${t('c.client')} / ${t('ord.number')}`} />
          <select id="py-method" className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">{t('pay.method')}: {t('c.all').toLowerCase()}</option>
            {METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}` as DictKey)}</option>)}
          </select>
          <select id="py-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t('pay.kind')}: {t('c.all').toLowerCase()}</option>
            {KINDS.map((k) => <option key={k} value={k}>{t(`payKind.${k}` as DictKey)}</option>)}
          </select>
        </div>
        {list.length === 0 ? <Empty icon={<Wallet />} title={t('pay.empty')} /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>{t('c.date')}</th><th>{t('c.client')}</th><th>{t('ord.number')}</th><th>{t('pay.kind')}</th><th>{t('pay.method')}</th>{scope === 'all' && <th>{t('c.branch')}</th>}<th>{t('c.staff')}</th><th className="num">{t('c.amount')}</th></tr>
                </thead>
                <tbody>
                  {list.slice(0, limit).map((p) => {
                    const out = p.kind === 'refund' || p.kind === 'security_return'
                    const sec = p.kind === 'security' || p.kind === 'security_return'
                    const order = p.orderId ? L.order.get(p.orderId) : undefined
                    return (
                      <tr key={p.id} className={order ? 'click' : ''} onClick={() => order && nav(`/orders/${order.id}`)}>
                        <td className="nowrap soft">{dateTime(p.date)}</td>
                        <td className="cell-main">{L.client.get(p.clientId ?? '')?.name ?? '—'}</td>
                        <td className="nowrap">{order?.number ?? '—'}</td>
                        <td><Chip tone={out ? 'neutral' : sec ? 'info' : p.kind === 'fee' ? 'warn' : 'good'}>{t(`payKind.${p.kind}` as DictKey)}</Chip></td>
                        <td className="soft">{p.fromDeposit ? t('ord.security') : t(`method.${p.method}` as DictKey)}</td>
                        {scope === 'all' && <td className="soft">{L.branch.get(p.branchId)?.name}</td>}
                        <td className="soft">{L.staff.get(p.staffId ?? '')?.name ?? '—'}</td>
                        <td className={`num strong ${out ? 'soft' : ''}`}>{out ? '−' : '+'}{money(p.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-foot row between">
              <span>{t('c.showing', { n: Math.min(limit, list.length), total: list.length })}</span>
              {list.length > limit && <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + 80)}>{t('c.seeAll')}</button>}
            </div>
          </>
        )}
      </section>
    </>
  )
}

function Pos() {
  const { t, money, loc } = useI18n()
  const { db, scope, mutate } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const toast = useToast()
  const [branchId, setBranchId] = useState<ID>(scope !== 'all' ? scope : db.branches[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<{ productId: ID; qty: number }[]>([])
  const [clientId, setClientId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const accTypes = new Set(db.productTypes.filter((x) => x.kind === 'accessory').map((x) => x.id))
  const s = q.trim().toLowerCase()
  const goods = scoped.products
    .filter((p) => p.branchId === branchId && accTypes.has(p.typeId) && p.mode !== 'rent')
    .filter((p) => !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s))
  const inCart = (id: ID) => cart.find((c) => c.productId === id)?.qty ?? 0
  const add = (id: ID, delta: number) => {
    const p = L.product.get(id)!
    setCart((c) => {
      const cur = c.find((x) => x.productId === id)?.qty ?? 0
      const qty = Math.max(0, Math.min(p.quantity, cur + delta))
      const rest = c.filter((x) => x.productId !== id)
      return qty ? [...rest, { productId: id, qty }] : rest
    })
  }
  const subtotal = cart.reduce((sum, c) => sum + L.product.get(c.productId)!.salePrice * c.qty, 0)
  const total = Math.max(0, subtotal - discount)

  const checkout = () => {
    if (!cart.length || !branchId) return
    const walkInId = `walkin-${branchId}`
    const orderId = uid()
    mutate((d) => {
      let cid = clientId
      if (!cid) {
        cid = walkInId
        if (!d.clients.some((c) => c.id === walkInId)) {
          d.clients.push({ id: walkInId, branchId, name: t('ord.walkIn'), phone: '—', lang: 'uz', source: 'walk_in', measurements: {}, createdAt: nowIso() })
        }
      }
      const today = todayStr()
      createOrder(d, orderId, {
        branchId, clientId: cid, type: 'sale', status: 'booked', discount, charges: [], pickupDate: today, securityDeposit: 0,
        lateFeePerDay: 0, installments: [{ dueDate: today, amount: total }],
        items: cart.map((c) => ({ productId: c.productId, qty: c.qty, price: L.product.get(c.productId)!.salePrice })),
      })
      addPayment(d, { orderId, branchId, clientId: cid, amount: total, kind: 'balance', method })
      handOver(d, orderId, {})
    })
    toast(t('pay.done'))
    setCart([])
    setDiscount(0)
    setClientId('')
  }

  return (
    <div className="grid g-side">
      <section className="card">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder={t('pr.searchPh')} />
          {scope === 'all' && (
            <select id="pos-branch" className="select" value={branchId} onChange={(e) => { setBranchId(e.target.value); setCart([]) }}>
              {db.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        {goods.length === 0 ? <Empty icon={<ShoppingBag />} title={t('pr.empty')} /> : (
          <div className="product-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {goods.map((p) => {
              const out = p.quantity - inCart(p.id) <= 0
              return (
                <button key={p.id} className="product-card" style={{ textAlign: 'left', cursor: out ? 'not-allowed' : 'pointer', opacity: p.quantity === 0 ? 0.5 : 1, padding: 14, gap: 6 }} disabled={out} onClick={() => add(p.id, 1)}>
                  <span className="muted small">{p.code} · {loc(L.type.get(p.typeId)!.name)}</span>
                  <span className="strong">{p.name}</span>
                  <span className="row between" style={{ marginTop: 'auto' }}>
                    <span className="num strong gold">{money(p.salePrice)}</span>
                    <Chip tone={p.quantity === 0 ? 'bad' : p.quantity <= 1 ? 'warn' : 'neutral'} plain>{p.quantity === 0 ? t('pay.outOfStock') : t('pay.inStock', { n: p.quantity })}</Chip>
                  </span>
                  {inCart(p.id) > 0 && <Chip tone="dark">× {inCart(p.id)}</Chip>}
                </button>
              )
            })}
          </div>
        )}
      </section>
      <aside className="card" style={{ alignSelf: 'start' }}>
        <div className="card-head"><h3><ShoppingBag />{t('pay.cart')}</h3>{cart.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setCart([])}><Trash2 />{t('c.clear')}</button>}</div>
        {cart.length === 0 ? <Empty icon={<ShoppingBag />} title={t('pay.cartEmpty')} /> : (
          <div className="list">
            {cart.map((c) => {
              const p = L.product.get(c.productId)!
              return (
                <div className="list-row" key={c.productId}>
                  <div className="grow"><div className="title">{p.name}</div><div className="meta num">{money(p.salePrice)}</div></div>
                  <div className="row nowrap-row" style={{ gap: 4 }}>
                    <button className="icon-btn" onClick={() => add(p.id, -1)} aria-label="-"><Minus /></button>
                    <span className="num strong" style={{ minWidth: 20, textAlign: 'center' }}>{c.qty}</span>
                    <button className="icon-btn" onClick={() => add(p.id, 1)} aria-label="+"><Plus /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="card-body stack" style={{ borderTop: '1px solid var(--line)' }}>
          <Field label={`${t('c.client')} (${t('c.optional')})`} htmlFor="pos-client"><ClientPicker id="pos-client" value={clientId} onChange={setClientId} branchId={branchId} /></Field>
          <Field label={t('ord.discount')} htmlFor="pos-discount"><MoneyInput id="pos-discount" value={discount} onChange={(v) => setDiscount(Math.min(v, subtotal))} /></Field>
          <Field label={t('pay.method')}><MethodPicker value={method} onChange={setMethod} /></Field>
          <dl className="kv">
            <dt>{t('ord.subtotal')}</dt><dd>{money(subtotal)}</dd>
            {discount > 0 && (<><dt>{t('ord.discount')}</dt><dd>−{money(discount)}</dd></>)}
            <dt className="total">{t('c.total')}</dt><dd className="total">{money(total)}</dd>
          </dl>
          <button className="btn btn-gold btn-block" style={{ height: 44 }} disabled={!cart.length} onClick={checkout}><Wallet />{t('pay.checkout')} · {money(total)}</button>
        </div>
      </aside>
    </div>
  )
}
