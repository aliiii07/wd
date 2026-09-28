import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, Gauge, Pencil, Shirt, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { displayStatus, nextBooking } from '../data/domain'
import { setProductStatus } from '../data/actions'
import { todayStr } from '../lib/date'
import type { ProductStatus } from '../data/types'
import { Page } from '../components/Layout'
import { PRODUCT_STATUSES, ProductFormModal } from '../components/forms'
import { Chip, ColorDot, DressSvg, Empty, orderTone, productTone, Stat, useConfirm, useToast } from '../components/ui'

export default function ProductDetail() {
  const { id } = useParams()
  const { t, money, moneyShort, loc, date, dateShort } = useI18n()
  const { db, mutate, remove } = useStore()
  const L = useLookups()
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const today = todayStr()
  const [open, setOpen] = useState(false)
  const p = db.products.find((x) => x.id === id)
  if (!p) {
    return <Page title={t('pr.title')}><Empty icon={<Shirt />} title={t('c.nothingFound')} action={<Link className="btn btn-outline" to="/products">{t('c.back')}</Link>} /></Page>
  }
  const type = L.type.get(p.typeId)
  const isAcc = type?.kind === 'accessory'
  const orders = db.orders.filter((o) => o.items.some((i) => i.productId === p.id)).sort((a, b) => b.pickupDate.localeCompare(a.pickupDate))
  const live = orders.filter((o) => o.status !== 'cancelled')
  const revenue = live.reduce((s, o) => s + o.items.filter((i) => i.productId === p.id).reduce((x, i) => x + i.price * i.qty, 0), 0)
  const rentals = live.filter((o) => o.type === 'rental').length
  const next = nextBooking(db.orders, p.id, today)
  const payback = p.cost ? Math.round((revenue / p.cost) * 100) : 0

  const del = async () => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('products', p.id)
    toast(t('c.deleted'))
    nav('/products')
  }

  return (
    <Page title={p.name} crumb={`${p.code} · ${type ? loc(type.name) : ''}`} tabs={[{ key: 'list', label: t('pr.list'), to: '/products' }, { key: 'this', label: p.name }]} active="this">
      <div className="grid g-side">
        <section className="card" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) 1fr', overflow: 'hidden' }}>
          <div className="swatch" style={{ height: 'auto', minHeight: 230, borderBottom: 0, borderRight: '1px solid var(--line)', cursor: 'default' }}>
            <DressSvg color={p.color} style={p.style} />
          </div>
          <div className="card-body stack">
            <div className="row between">
              <div>
                <h2 className="section-title">{p.name}</h2>
                <div className="muted">{p.code} · {type ? loc(type.name) : ''}{p.designer ? ` · ${p.designer}` : ''} · {L.branch.get(p.branchId)?.name}</div>
              </div>
              <div className="row">
                <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}><Pencil />{t('c.edit')}</button>
                {orders.length === 0 && <button className="btn btn-danger btn-sm" onClick={del}><Trash2 />{t('c.delete')}</button>}
              </div>
            </div>
            <dl className="pc-rows" style={{ maxWidth: 420 }}>
              <dt>{t('pr.size')}</dt><dd>{p.size}</dd>
              <dt>{t('pr.color')}</dt><dd><ColorDot color={p.color} />{t(`color.${p.color}` as DictKey)}</dd>
              {p.style && (<><dt>{t('pr.style')}</dt><dd>{t(`style.${p.style}` as DictKey)}</dd></>)}
              <dt>{t('pr.condition')}</dt><dd>{t(`cond.${p.condition}` as DictKey)}</dd>
              <dt>{t('pr.mode')}</dt><dd>{t(`mode.${p.mode}` as DictKey)}</dd>
              {p.mode !== 'sale' && (<><dt>{t('pr.rentPrice')}</dt><dd>{money(p.rentPrice)}</dd></>)}
              {p.mode !== 'rent' && (<><dt>{t('pr.salePrice')}</dt><dd>{money(p.salePrice)}</dd></>)}
              {!isAcc && p.mode !== 'sale' && (<><dt>{t('pr.security')}</dt><dd>{money(p.securityDeposit)}</dd></>)}
              {isAcc && (<><dt>{t('pr.quantity')}</dt><dd>{p.quantity}</dd></>)}
              <dt>{t('pr.addedOn')}</dt><dd>{date(p.createdAt.slice(0, 10))}</dd>
            </dl>
            {p.notes && <p className="soft">{p.notes}</p>}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3><Shirt />{t('pr.changeStatus')}</h3><Chip tone={productTone[p.status]}>{t(`status.${p.status}` as DictKey)}</Chip></div>
          <div className="card-body stack">
            {!isAcc && (
              <div className="segmented" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {PRODUCT_STATUSES.map((s) => (
                  <button key={s} className={p.status === s ? 'on' : ''} onClick={() => mutate((d) => setProductStatus(d, p.id, s as ProductStatus))}>
                    {t(`status.${s}` as DictKey)}
                  </button>
                ))}
              </div>
            )}
            {next && <div className="notice"><ClipboardList />{t('pr.nextBooking', { date: date(next.pickupDate) })} · {next.number}</div>}
            <div className="row">
              {p.status !== 'sold' && p.mode !== 'sale' && <button className="btn btn-primary" onClick={() => nav(`/orders/new?product=${p.id}&type=rental`)}>{t('pr.rent')}</button>}
              {p.status !== 'sold' && p.mode !== 'rent' && <button className="btn btn-gold" onClick={() => nav(`/orders/new?product=${p.id}&type=sale`)}>{t('pr.sell')}</button>}
            </div>
          </div>
        </section>
      </div>

      <div className="stats">
        <Stat icon={<ClipboardList />} label={t('an.timesRented')} value={rentals} />
        <Stat label={t('an.itemRevenue')} value={<span title={money(revenue)}>{moneyShort(revenue)}</span>} />
        <Stat label={t('pr.cost')} value={moneyShort(p.cost)} />
        <Stat icon={<Gauge />} label={t('an.roi')} value={`${payback}%`} />
      </div>

      <section className="card">
        <div className="card-head"><h3><ClipboardList />{t('pr.history')}</h3></div>
        {orders.length === 0 ? <Empty title={t('ord.empty')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('ord.number')}</th><th>{t('c.client')}</th><th>{t('c.type')}</th><th>{t('ord.weddingDate')}</th><th>{t('ord.pickupDate')} → {t('ord.returnDate')}</th><th className="num">{t('c.price')}</th><th>{t('c.status')}</th></tr></thead>
              <tbody>
                {orders.map((o) => {
                  const st = displayStatus(o, today)
                  const line = o.items.find((i) => i.productId === p.id)!
                  return (
                    <tr key={o.id} className="click" onClick={() => nav(`/orders/${o.id}`)}>
                      <td className="strong">{o.number}</td>
                      <td>{L.client.get(o.clientId)?.name}</td>
                      <td>{t(`orderType.${o.type}` as DictKey)}</td>
                      <td className="nowrap">{dateShort(o.weddingDate)} {o.weddingDate?.slice(0, 4)}</td>
                      <td className="nowrap soft">{dateShort(o.pickupDate)}{o.returnDate ? ` → ${dateShort(o.returnDate)}` : ''}</td>
                      <td className="num">{money(line.price * line.qty)}</td>
                      <td><Chip tone={orderTone[st]}>{t(`orderStatus.${st}` as DictKey)}</Chip></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ProductFormModal open={open} onClose={() => setOpen(false)} product={p} />
    </Page>
  )
}
