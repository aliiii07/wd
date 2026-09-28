import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight, Pencil, Plus, Ruler, Scissors, Trash2, UserRound } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { addCharge, deleteAlteration, saveAlteration } from '../data/actions'
import { addDays, nowIso, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import type { Alteration, AlterationStatus, Measurements } from '../data/types'
import { Page } from '../components/Layout'
import { ClientPicker, MEAS_KEYS } from '../components/forms'
import { altTone, Chip, Empty, Field, FormFooter, Modal, MoneyInput, SearchInput, useToast } from '../components/ui'

const FLOW: AlterationStatus[] = ['pending', 'in_progress', 'fitting', 'ready', 'delivered']
type Tab = 'board' | 'list'

export default function Alterations() {
  const { t, money, dateShort } = useI18n()
  const { mutate, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const today = todayStr()
  const [tab, setTab] = useState<Tab>('board')
  const [q, setQ] = useState('')
  const [tailor, setTailor] = useState('')
  const [edit, setEdit] = useState<Alteration | undefined>()
  const [open, setOpen] = useState(false)

  const s = q.trim().toLowerCase()
  const list = scoped.alterations
    .filter((a) => (!tailor || a.tailorId === tailor) && (!s || !!L.client.get(a.clientId)?.name.toLowerCase().includes(s) || !!L.product.get(a.productId)?.name.toLowerCase().includes(s)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const advance = (a: Alteration) => {
    const next = FLOW[FLOW.indexOf(a.status) + 1]
    if (next) mutate((d) => saveAlteration(d, { ...a, status: next }))
  }
  const dueChip = (a: Alteration) =>
    a.status === 'delivered' ? null : <Chip tone={a.status === 'ready' ? 'good' : a.dueDate < today ? 'bad' : a.dueDate <= addDays(today, 3) ? 'warn' : 'neutral'}><CalendarClock />{dateShort(a.dueDate)}</Chip>

  const card = (a: Alteration) => {
    const p = L.product.get(a.productId)
    const done = a.fittings.filter((f) => f.done).length
    return (
      <article key={a.id} className="k-card">
        <div className="row between nowrap-row">
          <span className="k-title">{L.client.get(a.clientId)?.name}</span>
          <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('c.edit')} onClick={() => { setEdit(a); setOpen(true) }}><Pencil size={14} /></button>
        </div>
        <div className="soft small" style={{ fontWeight: 700 }}>{p?.code} · {p?.name}</div>
        <div className="small">{a.tasks}</div>
        <div className="k-meta">
          <span><UserRound />{L.staff.get(a.tailorId ?? '')?.name ?? '—'}</span>
          <span><Ruler />{t('al.fittings')}: {done}/{a.fittings.length}</span>
          {a.price > 0 && <span className="num">{money(a.price)}</span>}
          {scope === 'all' && <span>{L.branch.get(a.branchId)?.name}</span>}
        </div>
        <div className="row between">
          {dueChip(a)}
          {a.status !== 'delivered' && <button className="btn btn-outline btn-sm" onClick={() => advance(a)}>{t(`alt.${FLOW[FLOW.indexOf(a.status) + 1]}` as DictKey)}<ChevronRight /></button>}
        </div>
      </article>
    )
  }

  return (
    <Page title={t('al.title')} tabs={[{ key: 'board', label: t('al.board') }, { key: 'list', label: t('ord.list') }]} active={tab} onTab={(k) => setTab(k as Tab)}>
      <div className="row between">
        <div className="row" style={{ flex: 1 }}>
          <div style={{ flex: '1 1 240px', maxWidth: 340 }}><SearchInput value={q} onChange={setQ} placeholder={t('cl.searchPh')} /></div>
          <select id="al-tailor" className="select" style={{ width: 'auto', minWidth: 180 }} value={tailor} onChange={(e) => setTailor(e.target.value)}>
            <option value="">{t('al.tailor')}: {t('c.all').toLowerCase()}</option>
            {scoped.staff.filter((x) => x.role === 'tailor').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => { setEdit(undefined); setOpen(true) }}><Plus />{t('al.new')}</button>
      </div>
      {tab === 'board' ? (
        <div className="board">
          {FLOW.map((st) => {
            const items = list.filter((a) => a.status === st && (st !== 'delivered' || a.dueDate >= addDays(today, -21)))
            return (
              <section key={st} className="column">
                <div className="column-head"><Chip tone={altTone[st]}>{t(`alt.${st}` as DictKey)}</Chip><span className="count num">{items.length}</span></div>
                <div className="column-body">
                  {items.length === 0 && <div className="muted small" style={{ textAlign: 'center', padding: 12 }}>{t('al.empty')}</div>}
                  {items.map(card)}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <section className="card">
          {list.length === 0 ? <Empty icon={<Scissors />} title={t('al.empty')} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('c.client')}</th><th>{t('c.product')}</th><th>{t('al.tasks')}</th><th>{t('al.tailor')}</th><th>{t('al.due')}</th><th>{t('al.fittings')}</th><th className="num">{t('al.price')}</th><th>{t('c.status')}</th><th /></tr></thead>
                <tbody>
                  {[...list].reverse().map((a) => (
                    <tr key={a.id}>
                      <td className="cell-main">{L.client.get(a.clientId)?.name}</td>
                      <td><div className="cell-main">{L.product.get(a.productId)?.name}</div><div className="cell-sub">{L.product.get(a.productId)?.code}</div></td>
                      <td className="soft" style={{ maxWidth: 280 }}>{a.tasks}</td>
                      <td>{L.staff.get(a.tailorId ?? '')?.name ?? '—'}</td>
                      <td>{dueChip(a) ?? dateShort(a.dueDate)}</td>
                      <td className="num">{a.fittings.filter((f) => f.done).length}/{a.fittings.length}</td>
                      <td className="num">{money(a.price)}</td>
                      <td><Chip tone={altTone[a.status]}>{t(`alt.${a.status}` as DictKey)}</Chip></td>
                      <td className="right nowrap">
                        {a.orderId && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/orders/${a.orderId}`)}>{L.order.get(a.orderId)?.number}</button>}
                        <button className="icon-btn" onClick={() => { setEdit(a); setOpen(true) }} title={t('c.edit')}><Pencil /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <AlterationModal open={open} onClose={() => setOpen(false)} alteration={edit} />
    </Page>
  )
}

function AlterationModal({ open, onClose, alteration }: { open: boolean; onClose: () => void; alteration?: Alteration }) {
  const { t, money, loc } = useI18n()
  const { db, mutate } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const toast = useToast()
  const today = todayStr()
  const blank = (): Alteration => ({ id: '', branchId: '', clientId: '', productId: '', tasks: '', measurements: {}, fittings: [], dueDate: addDays(today, 7), price: 0, status: 'pending', createdAt: '' })
  const [a, setA] = useState<Alteration>(alteration ?? blank())
  const [charge, setCharge] = useState(true)
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (open) {
      setA(alteration ?? blank())
      setTried(false)
      setCharge(true)
    }
  }, [open, alteration])

  const client = a.clientId ? L.client.get(a.clientId) : undefined
  const branchId = client?.branchId ?? a.branchId
  const clientOrders = useMemo(() => db.orders.filter((o) => o.clientId === a.clientId && o.status !== 'cancelled'), [db.orders, a.clientId])
  const orderProducts = new Set(clientOrders.flatMap((o) => o.items.map((i) => i.productId)))
  const dresses = scoped.products
    .filter((p) => p.branchId === branchId && L.type.get(p.typeId)?.kind === 'dress')
    .sort((x, y) => Number(orderProducts.has(y.id)) - Number(orderProducts.has(x.id)) || x.code.localeCompare(y.code))
  const tailors = scoped.staff.filter((s) => s.role === 'tailor' && s.branchId === branchId)

  const pickClient = (id: string) => {
    const c = L.client.get(id)
    const firstOrder = db.orders.find((o) => o.clientId === id && o.status === 'booked')
    setA({
      ...a,
      clientId: id,
      measurements: c ? { ...c.measurements } : {},
      orderId: firstOrder?.id,
      productId: firstOrder?.items.find((i) => L.type.get(L.product.get(i.productId)?.typeId ?? '')?.kind === 'dress')?.productId ?? '',
      dueDate: firstOrder ? addDays(firstOrder.pickupDate, -2) : a.dueDate,
    })
  }
  const setM = (k: keyof Measurements, v: string) => setA({ ...a, measurements: { ...a.measurements, [k]: v === '' ? undefined : Number(v) } })
  const valid = a.clientId && a.productId && a.tasks.trim()

  const save = () => {
    setTried(true)
    if (!valid) return
    const isNew = !a.id
    const saved: Alteration = { ...a, id: a.id || uid(), branchId, tasks: a.tasks.trim(), createdAt: a.createdAt || nowIso() }
    mutate((d) => {
      saveAlteration(d, saved)
      if (isNew && charge && saved.orderId && saved.price > 0) addCharge(d, saved.orderId, { kind: 'alteration', amount: saved.price })
    })
    toast(t('c.saved'))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={alteration ? t('al.edit') : t('al.new')} size="wide"
      footer={<FormFooter onCancel={onClose} onSave={save}
        extra={alteration && <button className="btn btn-danger" onClick={() => { mutate((d) => deleteAlteration(d, alteration.id)); onClose() }}><Trash2 />{t('c.delete')}</button>} />}>
      <div className="form-grid">
        <Field label={t('c.client')} htmlFor="al-client" className="span-2" error={tried && !a.clientId ? t('ord.needClient') : undefined}>
          <ClientPicker id="al-client" value={a.clientId} onChange={pickClient} />
        </Field>
        <Field label={t('c.product')} htmlFor="al-product" error={tried && !a.productId ? t('c.required') : undefined}>
          <select id="al-product" className="select" value={a.productId} onChange={(e) => setA({ ...a, productId: e.target.value })} disabled={!a.clientId}>
            <option value="">{t('ord.selectProduct')}</option>
            {dresses.map((p) => <option key={p.id} value={p.id}>{orderProducts.has(p.id) ? '★ ' : ''}{p.code} · {p.name} · {loc(L.type.get(p.typeId)!.name)} · {p.size}</option>)}
          </select>
        </Field>
        <Field label={t('al.linkedOrder')} htmlFor="al-order">
          <select id="al-order" className="select" value={a.orderId ?? ''} onChange={(e) => setA({ ...a, orderId: e.target.value || undefined })}>
            <option value="">{t('c.none')}</option>
            {clientOrders.map((o) => <option key={o.id} value={o.id}>{o.number} · {t(`orderType.${o.type}` as DictKey)} · {o.pickupDate}</option>)}
          </select>
        </Field>
        <Field label={t('al.tasks')} htmlFor="al-tasks" className="span-2" error={tried && !a.tasks.trim() ? t('c.required') : undefined}>
          <textarea id="al-tasks" className="textarea" value={a.tasks} placeholder={t('al.tasksPh')} onChange={(e) => setA({ ...a, tasks: e.target.value })} />
        </Field>
        <Field label={t('al.tailor')} htmlFor="al-tailor-f">
          <select id="al-tailor-f" className="select" value={a.tailorId ?? ''} onChange={(e) => setA({ ...a, tailorId: e.target.value || undefined })}>
            <option value="">{t('c.none')}</option>
            {tailors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t('al.due')} htmlFor="al-due"><input id="al-due" type="date" className="input" value={a.dueDate} onChange={(e) => setA({ ...a, dueDate: e.target.value })} /></Field>
        <Field label={t('al.price')} htmlFor="al-price"><MoneyInput id="al-price" value={a.price} onChange={(v) => setA({ ...a, price: v })} /></Field>
        <Field label={t('c.status')} htmlFor="al-status">
          <select id="al-status" className="select" value={a.status} onChange={(e) => setA({ ...a, status: e.target.value as AlterationStatus })}>
            {FLOW.map((s) => <option key={s} value={s}>{t(`alt.${s}` as DictKey)}</option>)}
          </select>
        </Field>
        {!alteration && a.orderId && a.price > 0 && (
          <label className="check span-2"><input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} />{t('ord.addCharge')}: {money(a.price)} → {L.order.get(a.orderId)?.number}</label>
        )}
      </div>

      <div className="stack sm">
        <div className="row between">
          <b>{t('al.fittings')}</b>
          <button className="btn btn-outline btn-sm" onClick={() => setA({ ...a, fittings: [...a.fittings, { id: uid(), date: addDays(today, 3), time: '14:00', done: false }] })}><Plus />{t('al.addFitting')}</button>
        </div>
        {a.fittings.map((f, i) => (
          <div className="row nowrap-row" key={f.id}>
            <input type="checkbox" checked={f.done} aria-label={t('ap.complete')} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }}
              onChange={(e) => setA({ ...a, fittings: a.fittings.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} />
            <input type="date" className="input" style={{ maxWidth: 170 }} value={f.date} aria-label={t('c.date')} onChange={(e) => setA({ ...a, fittings: a.fittings.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} />
            <input type="time" className="input" style={{ maxWidth: 120 }} value={f.time ?? ''} aria-label={t('c.time')} onChange={(e) => setA({ ...a, fittings: a.fittings.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
            <input className="input" value={f.notes ?? ''} placeholder={t('c.notes')} aria-label={t('c.notes')} onChange={(e) => setA({ ...a, fittings: a.fittings.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)) })} />
            <button className="icon-btn" aria-label={t('c.delete')} onClick={() => setA({ ...a, fittings: a.fittings.filter((_, j) => j !== i) })}><Trash2 /></button>
          </div>
        ))}
      </div>

      <div className="stack sm">
        <b>{t('al.measSnapshot')}</b>
        <div className="form-grid g4">
          {MEAS_KEYS.map((k) => (
            <Field key={k} label={t(`meas.${k}` as DictKey)} htmlFor={`am-${k}`}>
              <input id={`am-${k}`} className="input num" inputMode="numeric" value={a.measurements[k] ?? ''} onChange={(e) => setM(k, e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
          ))}
        </div>
      </div>
    </Modal>
  )
}
