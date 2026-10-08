import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ClipboardList, Gauge, ImagePlus, Loader2, Pencil, Shirt, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { displayStatus, nextBooking } from '../data/domain'
import { setProductStatus } from '../data/actions'
import { todayStr } from '../lib/date'
import type { Product, ProductStatus } from '../data/types'
import { Page } from '../components/Layout'
import { PRODUCT_STATUSES, ProductFormModal } from '../components/forms'
import { Chip, ColorDot, Empty, orderTone, productTone, Stat, useConfirm, useToast } from '../components/ui'
import { ProductVisual } from '../components/art'
import { storeImages } from '../components/photos'
import { useFileUrl } from '../lib/files'

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
      <section className="card product-hero">
        <Gallery product={p} kind={isAcc ? 'accessory' : 'dress'} />
        <div className="product-info">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="stack sm" style={{ gap: 6 }}>
              <span className="eyebrow">{type ? loc(type.name) : ''}{p.designer ? ` · ${p.designer}` : ''}</span>
              <h2 className="section-title">{p.name}</h2>
              <span className="muted small">{p.code} · {L.branch.get(p.branchId)?.name}</span>
            </div>
            <div className="row nowrap-row" style={{ gap: 2 }}>
              <button className="icon-btn" title={t('c.edit')} aria-label={t('c.edit')} onClick={() => setOpen(true)}><Pencil /></button>
              {orders.length === 0 && <button className="icon-btn" title={t('c.delete')} aria-label={t('c.delete')} onClick={del}><Trash2 /></button>}
            </div>
          </div>
          <dl className="pc-rows">
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
        <aside className="product-side">
          <span className="eyebrow">{t('pr.changeStatus')}</span>
          {isAcc ? (
            <Chip tone={productTone[p.status]}>{t(`status.${p.status}` as DictKey)}</Chip>
          ) : (
            <div className="status-list" role="radiogroup" aria-label={t('pr.changeStatus')}>
              {PRODUCT_STATUSES.map((s) => (
                <button key={s} role="radio" aria-checked={p.status === s} className={p.status === s ? 'on' : ''} onClick={() => mutate((d) => setProductStatus(d, p.id, s as ProductStatus))}>
                  <Chip tone={productTone[s as ProductStatus]}>{t(`status.${s}` as DictKey)}</Chip>
                  {p.status === s && <Check />}
                </button>
              ))}
            </div>
          )}
          {next && <div className="notice"><ClipboardList /><span>{t('pr.nextBooking', { date: date(next.pickupDate) })} · {next.number}</span></div>}
          <div className="stack sm">
            {p.status !== 'sold' && p.mode !== 'sale' && <button className="btn btn-primary btn-block" onClick={() => nav(`/orders/new?product=${p.id}&type=rental`)}>{t('pr.rent')}</button>}
            {p.status !== 'sold' && p.mode !== 'rent' && <button className="btn btn-outline btn-block" onClick={() => nav(`/orders/new?product=${p.id}&type=sale`)}>{t('pr.sell')}</button>}
          </div>
        </aside>
      </section>

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

function GalleryThumb({ id, on, onClick }: { id: string; on: boolean; onClick: () => void }) {
  const url = useFileUrl(id)
  return <button className={`gallery-thumb ${on ? 'on' : ''}`} onClick={onClick}>{url && <img src={url} alt="" />}</button>
}

/** Big photo with thumbnails; shows the artwork until photos are added. */
function Gallery({ product, kind }: { product: Product; kind: 'dress' | 'accessory' }) {
  const { t } = useI18n()
  const { mutate } = useStore()
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const photos = product.photos ?? []
  const current = photos[Math.min(index, photos.length - 1)]
  const url = useFileUrl(current)
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const ids = await storeImages(files)
    mutate((d) => {
      const x = d.products.find((y) => y.id === product.id)
      if (x) x.photos = [...(x.photos ?? []), ...ids]
    })
    setBusy(false)
    if (input.current) input.current.value = ''
  }
  return (
    <div className="gallery">
      <div className="gallery-main">
        {url ? <div className="pv"><img src={url} alt={product.name} /></div> : <ProductVisual product={product} kind={kind} />}
      </div>
      <div className="gallery-strip">
        {photos.map((id, i) => <GalleryThumb key={id} id={id} on={i === index} onClick={() => setIndex(i)} />)}
        <label className="gallery-add" htmlFor="pd-photos" title={t('ph.add')}>
          {busy ? <Loader2 className="spin" /> : <ImagePlus />}
          <input ref={input} id="pd-photos" type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
        </label>
      </div>
    </div>
  )
}
