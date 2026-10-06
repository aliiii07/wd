import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Ban, CalendarHeart, CircleDollarSign, FileText, ListChecks, Plus, ReceiptText, ShieldCheck, Wallet,
} from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { conflictsFor, displayStatus, groupByOrder, lateDays, orderMoney, planRows } from '../data/domain'
import { acceptReturn, addCharge, addPayment, cancelOrder, handOver } from '../data/actions'
import { diffDays, todayStr } from '../lib/date'
import type { ChargeKind, Order, PaymentMethod, ProductStatus } from '../data/types'
import { Page } from '../components/Layout'
import { MethodPicker, PaymentModal } from '../components/forms'
import { Chip, Empty, Field, FormFooter, Modal, MoneyInput, orderTone, Progress, useConfirm, useToast } from '../components/ui'

export default function OrderDetail() {
  const { id } = useParams()
  const { t, money, date, dateTime, loc } = useI18n()
  const { db, mutate } = useStore()
  const L = useLookups()
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const today = todayStr()
  const [modal, setModal] = useState<'' | 'pay' | 'handover' | 'return' | 'charge'>('')
  const order = db.orders.find((o) => o.id === id)
  const pays = useMemo(() => (order ? groupByOrder(db.payments).get(order.id) ?? [] : []), [db.payments, order])

  if (!order) {
    return (
      <Page title={t('ord.number')}>
        <Empty icon={<FileText />} title={t('c.nothingFound')} action={<Link className="btn btn-outline" to="/orders">{t('c.back')}</Link>} />
      </Page>
    )
  }
  const client = L.client.get(order.clientId)
  const m = orderMoney(order, pays)
  const st = displayStatus(order, today)
  const plan = planRows(order, m.paid, today)
  const countdown = order.weddingDate ? diffDays(today, order.weddingDate) : null
  const conflicts = order.status === 'booked'
    ? order.items.flatMap((i) => conflictsFor(db, i.productId, order.pickupDate, order.returnDate ?? '9999-12-31', order.id).map((o) => o.number))
    : []

  const cancel = async () => {
    if (!(await confirm(t('ord.cancelConfirm'), { danger: true, confirmLabel: t('ord.cancel') }))) return
    mutate((d) => cancelOrder(d, order.id))
    toast(t('c.saved'))
  }

  return (
    <Page title={`${order.number}`} crumb={client?.name} tabs={[{ key: 'list', label: t('ord.list'), to: '/orders' }, { key: 'this', label: order.number }]} active="this">
      <div className="card hero-bar">
        <div className="row">
          <Chip tone={order.type === 'rental' ? 'gold' : 'info'} plain>{t(`orderType.${order.type}` as DictKey)}</Chip>
          <Chip tone={orderTone[st]}>{t(`orderStatus.${st}` as DictKey)}</Chip>
          {countdown !== null && countdown >= 0 && (order.status === 'booked' || order.status === 'picked_up') && (
            <Chip tone="dark"><CalendarHeart />{countdown === 0 ? t('today.weddingToday') : t('cl.weddingIn', { n: countdown })}</Chip>
          )}
        </div>
        <div className="row">
          {m.balance > 0 && order.status !== 'cancelled' && <button className="btn btn-outline" onClick={() => setModal('pay')}><Wallet />{t('ord.recordPayment')}</button>}
          {order.status === 'booked' && <button className="btn btn-primary" onClick={() => setModal('handover')}><ArrowUpFromLine />{t('ord.handOver')}</button>}
          {order.status === 'picked_up' && order.type === 'rental' && <button className="btn btn-primary" onClick={() => setModal('return')}><ArrowDownToLine />{t('ord.acceptReturn')}</button>}
          {(order.status === 'picked_up' || order.status === 'booked') && <button className="btn btn-ghost" onClick={() => setModal('charge')}><Plus />{t('ord.addCharge')}</button>}
          <button className="btn btn-outline" onClick={() => nav(`/orders/${order.id}/contract`)}><FileText />{t('ord.contract')}</button>
          {order.status === 'booked' && <button className="btn btn-danger" onClick={cancel}><Ban />{t('ord.cancel')}</button>}
        </div>
      </div>

      {st === 'overdue' && (
        <div className="notice bad"><AlertTriangle />{t('ord.lateDays', { n: lateDays(order, today) })} · {t('ord.lateFee')}: {money(order.lateFeePerDay)}</div>
      )}
      {order.status === 'booked' && m.balance > 0 && diffDays(today, order.pickupDate) <= 7 && (
        <div className="notice warn"><AlertTriangle />{t('ord.balanceBeforePickup', { amount: money(m.balance) })}</div>
      )}
      {conflicts.length > 0 && <div className="notice bad"><AlertTriangle />{t('ord.conflict', { orders: conflicts.join(', ') })}</div>}

      <div className="grid g-side">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="card-head"><h3><ListChecks />{t('ord.info')}</h3></div>
            <div className="card-body">
              <div className="form-grid g3">
                <Info label={t('c.client')}>{client ? <Link to={`/clients/${client.id}`} className="gold strong">{client.name}</Link> : '—'}<div className="cell-sub num">{client?.phone}</div></Info>
                <Info label={t('ord.weddingDate')}>{date(order.weddingDate)}</Info>
                <Info label={t('c.branch')}>{L.branch.get(order.branchId)?.name}</Info>
                <Info label={order.type === 'rental' ? t('ord.pickupDate') : t('ord.handoverDate')}>{date(order.pickupDate)}{order.pickedUpAt && <div className="cell-sub">✓ {dateTime(order.pickedUpAt)}</div>}</Info>
                {order.type === 'rental' && <Info label={t('ord.returnDate')}>{date(order.returnDate)}{order.returnedAt && <div className="cell-sub">✓ {dateTime(order.returnedAt)}</div>}</Info>}
                <Info label={t('ord.consultant')}>{L.staff.get(order.staffId ?? '')?.name ?? '—'}</Info>
                {order.type === 'rental' && <Info label={t('ord.lateFee')}>{money(order.lateFeePerDay)}</Info>}
                <Info label={t('c.date')}>{dateTime(order.createdAt)}</Info>
                {order.notes && <Info label={t('c.notes')}>{order.notes}</Info>}
                {order.damageNotes && <Info label={t('ord.damageNotes')}>{order.damageNotes}</Info>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3><ReceiptText />{t('ord.items')}</h3></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('c.product')}</th><th>{t('c.type')}</th><th>{t('pr.size')}</th><th className="num">{t('c.price')}</th><th className="num">{t('c.total')}</th></tr></thead>
                <tbody>
                  {order.items.map((i) => {
                    const p = L.product.get(i.productId)
                    return (
                      <tr key={i.productId} className="click" onClick={() => p && nav(`/products/${p.id}`)}>
                        <td><div className="cell-main">{p?.name}</div><div className="cell-sub">{p?.code}</div></td>
                        <td className="soft">{p ? loc(L.type.get(p.typeId)!.name) : ''}</td>
                        <td className="soft">{p?.size}</td>
                        <td className="num">{money(i.price)} × {i.qty}</td>
                        <td className="num strong">{money(i.price * i.qty)}</td>
                      </tr>
                    )
                  })}
                  {order.discount > 0 && (
                    <tr><td colSpan={4} className="soft">{t('ord.discount')}</td><td className="num">−{money(order.discount)}</td></tr>
                  )}
                  {order.charges.map((c) => (
                    <tr key={c.id}><td colSpan={4} className="soft">{t(`charge.${c.kind}` as DictKey)}{c.note ? ` · ${c.note}` : ''} <span className="muted small">· {date(c.date)}</span></td><td className="num">{money(c.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={4}>{t('ord.total')}</td><td className="num">{money(m.total)}</td></tr></tfoot>
              </table>
            </div>
          </section>

        </div>

        <aside className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="card-head"><h3><CircleDollarSign />{t('ord.summary')}</h3></div>
            <div className="card-body stack">
              <dl className="kv">
                <dt>{t('ord.subtotal')}</dt><dd>{money(m.subtotal)}</dd>
                {order.discount > 0 && (<><dt>{t('ord.discount')}</dt><dd>−{money(order.discount)}</dd></>)}
                {m.charges > 0 && (<><dt>{t('ord.charges')}</dt><dd>{money(m.charges)}</dd></>)}
                <dt className="total">{t('ord.total')}</dt><dd className="total">{money(m.total)}</dd>
                <dt>{t('ord.paid')}</dt><dd>{money(m.paid)}</dd>
                <dt>{t('ord.balance')}</dt><dd className={m.balance > 0 ? 'gold' : ''}>{money(m.balance)}</dd>
              </dl>
              <Progress value={m.paid} max={m.total} />
              {order.type === 'rental' && (
                <div className="notice"><ShieldCheck /><span>{t('ord.security')}: <b>{money(order.securityDeposit)}</b> · {t('ord.securityHeld')}: <b>{money(m.securityHeld)}</b></span></div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3><ListChecks />{t('ord.plan')}</h3></div>
            <div className="list">
              {plan.map((r) => (
                <div className="list-row" key={r.n}>
                  <div className="grow">
                    <div className="title">{r.n === 1 ? t('ord.deposit') : t('ord.installmentN', { n: r.n - 1 })}</div>
                    <div className="meta">{t('ord.due')}: {date(r.dueDate)}</div>
                  </div>
                  <div className="stack sm" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <span className="num strong nowrap">{money(r.amount)}</span>
                    <Chip tone={r.state === 'paid' ? 'good' : r.state === 'late' ? 'bad' : r.state === 'partial' ? 'warn' : 'neutral'}>
                      {t(r.state === 'paid' ? 'ord.planPaid' : r.state === 'late' ? 'ord.planLate' : r.state === 'partial' ? 'ord.planPartial' : 'ord.planOpen')}
                    </Chip>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3><Wallet />{t('ord.payments')}</h3></div>
            {pays.length === 0 ? (
              <Empty title={t('ord.noPayments')} />
            ) : (
              <div className="list">
                {[...pays].sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
                  const out = p.kind === 'refund' || p.kind === 'security_return'
                  return (
                    <div className="list-row" key={p.id}>
                      <div className="grow">
                        <div className="title">{t(`payKind.${p.kind}` as DictKey)}</div>
                        <div className="meta">{dateTime(p.date)} · {p.fromDeposit ? t('ord.security') : t(`method.${p.method}` as DictKey)}</div>
                      </div>
                      <span className={`num strong ${out ? 'soft' : ''}`}>{out ? '−' : '+'}{money(p.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </aside>
      </div>

      <PaymentModal open={modal === 'pay'} onClose={() => setModal('')} order={order} />
      <HandOverModal open={modal === 'handover'} onClose={() => setModal('')} order={order} balance={m.balance} />
      <ReturnModal open={modal === 'return'} onClose={() => setModal('')} order={order} held={m.securityHeld} />
      <ChargeModal open={modal === 'charge'} onClose={() => setModal('')} order={order} />
    </Page>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stack sm" style={{ gap: 2 }}>
      <span className="muted small">{label}</span>
      <span className="strong">{children}</span>
    </div>
  )
}

function HandOverModal({ open, onClose, order, balance }: { open: boolean; onClose: () => void; order: Order; balance: number }) {
  const { t, money } = useI18n()
  const { mutate } = useStore()
  const toast = useToast()
  const [payBalance, setPayBalance] = useState(true)
  const [collect, setCollect] = useState(true)
  const [security, setSecurity] = useState(order.securityDeposit)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const save = () => {
    mutate((d) => {
      if (balance > 0 && payBalance) addPayment(d, { orderId: order.id, branchId: order.branchId, clientId: order.clientId, amount: balance, kind: 'balance', method, staffId: order.staffId })
      handOver(d, order.id, { security: order.type === 'rental' && collect ? { amount: security, method } : undefined })
    })
    toast(t('c.saved'))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={t('ord.handOver')} size="narrow" footer={<FormFooter onCancel={onClose} onSave={save} saveLabel={t('today.handOver')} />}>
      {balance > 0 && (
        <>
          <div className="notice warn"><AlertTriangle />{t('ord.balanceBeforePickup', { amount: money(balance) })}</div>
          <label className="check"><input type="checkbox" checked={payBalance} onChange={(e) => setPayBalance(e.target.checked)} />{t('ord.recordPayment')}: {money(balance)}</label>
        </>
      )}
      {order.type === 'rental' && (
        <>
          <label className="check"><input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} />{t('ord.collectSecurity')}</label>
          {collect && <Field label={t('ord.security')} htmlFor="ho-sec"><MoneyInput id="ho-sec" value={security} onChange={setSecurity} /></Field>}
        </>
      )}
      <Field label={t('pay.method')}><MethodPicker value={method} onChange={setMethod} /></Field>
    </Modal>
  )
}

function ReturnModal({ open, onClose, order, held }: { open: boolean; onClose: () => void; order: Order; held: number }) {
  const { t, money } = useI18n()
  const { mutate } = useStore()
  const toast = useToast()
  const days = lateDays(order, todayStr())
  const [chargeLate, setChargeLate] = useState(true)
  const [damage, setDamage] = useState(0)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ProductStatus>('cleaning')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const late = chargeLate ? days * order.lateFeePerDay : 0
  const refund = Math.max(0, held - late - damage)
  const uncovered = Math.max(0, late + damage - held)
  const save = () => {
    mutate((d) => acceptReturn(d, order.id, { lateFee: late, damage, damageNotes: notes || undefined, refund, method, productStatus: status }))
    toast(t('c.saved'))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={t('ord.returnTitle')} footer={<FormFooter onCancel={onClose} onSave={save} saveLabel={t('ord.acceptReturn')} />}>
      {days > 0 && (
        <>
          <div className="notice bad"><AlertTriangle />{t('ord.lateDays', { n: days })} × {money(order.lateFeePerDay)}</div>
          <label className="check"><input type="checkbox" checked={chargeLate} onChange={(e) => setChargeLate(e.target.checked)} />{t('ord.chargeLate')}: {money(days * order.lateFeePerDay)}</label>
        </>
      )}
      <div className="form-grid">
        <Field label={t('ord.damage')} htmlFor="rt-dmg"><MoneyInput id="rt-dmg" value={damage} onChange={setDamage} /></Field>
        <Field label={t('ord.afterReturn')} htmlFor="rt-status">
          <select id="rt-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
            {(['cleaning', 'available'] as ProductStatus[]).map((s) => <option key={s} value={s}>{t(`status.${s}` as DictKey)}</option>)}
          </select>
        </Field>
        {damage > 0 && (
          <Field label={t('ord.damageNotes')} htmlFor="rt-notes" className="span-2">
            <input id="rt-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        )}
      </div>
      <dl className="kv">
        <dt>{t('ord.securityHeld')}</dt><dd>{money(held)}</dd>
        {late > 0 && (<><dt>{t('charge.late_fee')}</dt><dd>−{money(late)}</dd></>)}
        {damage > 0 && (<><dt>{t('charge.damage')}</dt><dd>−{money(damage)}</dd></>)}
        <dt className="total">{t('ord.refundSecurity')}</dt><dd className="total">{money(refund)}</dd>
        {uncovered > 0 && (<><dt>{t('ord.balance')}</dt><dd className="gold">{money(uncovered)}</dd></>)}
      </dl>
      <Field label={t('pay.method')}><MethodPicker value={method} onChange={setMethod} /></Field>
    </Modal>
  )
}

function ChargeModal({ open, onClose, order }: { open: boolean; onClose: () => void; order: Order }) {
  const { t } = useI18n()
  const { mutate } = useStore()
  const toast = useToast()
  const [kind, setKind] = useState<ChargeKind>('damage')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const save = () => {
    if (amount <= 0) return
    mutate((d) => addCharge(d, order.id, { kind, amount, note: note || undefined }))
    toast(t('c.saved'))
    setAmount(0)
    setNote('')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={t('ord.addCharge')} size="narrow" footer={<FormFooter onCancel={onClose} onSave={save} disabled={amount <= 0} />}>
      <Field label={t('c.type')} htmlFor="ch-kind">
        <select id="ch-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as ChargeKind)}>
          {(['damage', 'late_fee', 'other'] as ChargeKind[]).map((k) => <option key={k} value={k}>{t(`charge.${k}` as DictKey)}</option>)}
        </select>
      </Field>
      <Field label={t('c.amount')} htmlFor="ch-amount"><MoneyInput id="ch-amount" value={amount} onChange={setAmount} /></Field>
      <Field label={t('c.notes')} htmlFor="ch-note"><input id="ch-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  )
}
