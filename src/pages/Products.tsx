import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Pencil, Plus, Shirt, Tags, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { nextBooking } from '../data/domain'
import { nowIso, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import type { Product, ProductKind, ProductType } from '../data/types'
import { Page } from '../components/Layout'
import { MODES, PRODUCT_STATUSES, ProductFormModal } from '../components/forms'
import { Chip, ColorDot, Empty, Field, FormFooter, Modal, productTone, SearchInput, Segmented, useConfirm, useToast } from '../components/ui'
import { ProductVisual } from '../components/art'

type Tab = 'dresses' | 'accessories' | 'types'

export default function Products() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'dresses'
  const setTab = (k: string) => setParams(k === 'dresses' ? {} : { tab: k }, { replace: true })
  return (
    <Page
      title={t('pr.title')}
      tabs={[{ key: 'dresses', label: t('pr.list') }, { key: 'accessories', label: t('pr.accessories') }, { key: 'types', label: t('pr.types') }]}
      active={tab}
      onTab={setTab}
    >
      {tab === 'dresses' && <Dresses />}
      {tab === 'accessories' && <Accessories />}
      {tab === 'types' && <Types />}
    </Page>
  )
}

function Dresses() {
  const { t, money, loc, dateShort } = useI18n()
  const { db, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const today = todayStr()
  const [q, setQ] = useState('')
  const [typeId, setTypeId] = useState('')
  const [status, setStatus] = useState('')
  const [size, setSize] = useState('')
  const [mode, setMode] = useState('')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [edit, setEdit] = useState<Product | undefined>()
  const [open, setOpen] = useState(false)
  const dressTypes = db.productTypes.filter((x) => x.kind === 'dress')
  const all = scoped.products.filter((p) => dressTypes.some((x) => x.id === p.typeId))
  const typeOrder = (p: Product) => dressTypes.findIndex((x) => x.id === p.typeId)
  const sizes = [...new Set(all.map((p) => p.size))].sort()
  const s = q.trim().toLowerCase()
  const list = all
    .filter((p) => (!typeId || p.typeId === typeId) && (!status || p.status === status) && (!size || p.size === size) && (!mode || p.mode === mode))
    .filter((p) => !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) || !!p.designer?.toLowerCase().includes(s))
    .sort((a, b) => (a.status === 'sold' ? 1 : 0) - (b.status === 'sold' ? 1 : 0) || typeOrder(a) - typeOrder(b) || a.code.localeCompare(b.code))

  return (
    <section className="card">
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder={t('pr.searchPh')} />
        <select id="f-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">{t('pr.allTypes')}</option>
          {dressTypes.map((x) => <option key={x.id} value={x.id}>{loc(x.name)}</option>)}
        </select>
        <select id="f-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('pr.allStatuses')}</option>
          {PRODUCT_STATUSES.map((x) => <option key={x} value={x}>{t(`status.${x}` as DictKey)}</option>)}
        </select>
        <select id="f-size" className="select" value={size} onChange={(e) => setSize(e.target.value)} style={{ minWidth: 120, flexBasis: 130 }}>
          <option value="">{t('pr.allSizes')}</option>
          {sizes.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select id="f-mode" className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">{t('pr.mode')}</option>
          {MODES.map((x) => <option key={x} value={x}>{t(`mode.${x}` as DictKey)}</option>)}
        </select>
        <span className="spacer" />
        <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: <LayoutGrid /> }, { value: 'table', label: <List /> }]} />
        <button className="btn btn-primary" onClick={() => { setEdit(undefined); setOpen(true) }}><Plus />{t('pr.add')}</button>
      </div>
      {list.length === 0 ? (
        <Empty icon={<Shirt />} title={t('pr.empty')} />
      ) : view === 'grid' ? (
        <div className="product-grid">
          {list.map((p) => {
            const next = nextBooking(db.orders, p.id, today)
            return (
              <article className="product-card" key={p.id}>
                <button className="pc-media" onClick={() => nav(`/products/${p.id}`)} aria-label={p.name}>
                  <ProductVisual product={p} />
                  <span className="pc-status"><Chip tone={productTone[p.status]}>{t(`status.${p.status}` as DictKey)}</Chip></span>
                  <span className="pc-code">{p.code}</span>
                </button>
                <div className="pc-body">
                  <div className="pc-head">
                    <h4 className="pc-title">{p.name}</h4>
                    <span className="pc-size num">{p.size}</span>
                  </div>
                  <div className="pc-sub">{loc(L.type.get(p.typeId)!.name)}{p.designer ? ` · ${p.designer}` : ''}{scope === 'all' ? ` · ${L.branch.get(p.branchId)?.name}` : ''}</div>
                  <div className="pc-prices">
                    {p.mode !== 'sale' && <span><small>{t('pr.rent')}</small>{money(p.rentPrice)}</span>}
                    {p.mode !== 'rent' && <span><small>{t('pr.sell')}</small>{money(p.salePrice)}</span>}
                  </div>
                  <div className="pc-meta">
                    <ColorDot color={p.color} />{t(`color.${p.color}` as DictKey)}
                    {p.style && <> · {t(`style.${p.style}` as DictKey)}</>} · {t(`cond.${p.condition}` as DictKey)}
                  </div>
                  {next && <div className="pc-next">{t('pr.nextBooking', { date: dateShort(next.pickupDate) })}</div>}
                </div>
                <div className="pc-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(p); setOpen(true) }}><Pencil />{t('c.edit')}</button>
                  <span className="spacer" />
                  {p.status !== 'sold' && p.mode !== 'sale' && <button className="btn btn-outline btn-sm" onClick={() => nav(`/orders/new?product=${p.id}&type=rental`)}>{t('pr.rent')}</button>}
                  {p.status !== 'sold' && p.mode !== 'rent' && <button className="btn btn-primary btn-sm" onClick={() => nav(`/orders/new?product=${p.id}&type=sale`)}>{t('pr.sell')}</button>}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('c.product')}</th><th>{t('c.type')}</th><th>{t('pr.size')}</th><th>{t('pr.color')}</th><th>{t('pr.style')}</th>
                {scope === 'all' && <th>{t('c.branch')}</th>}
                <th className="num">{t('pr.rentPrice')}</th><th className="num">{t('pr.salePrice')}</th><th>{t('pr.condition')}</th><th>{t('c.status')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="click" onClick={() => nav(`/products/${p.id}`)}>
                  <td><div className="person"><ProductVisual product={p} className="pv-thumb" /><div><div className="cell-main">{p.name}</div><div className="cell-sub">{p.code}</div></div></div></td>
                  <td className="soft">{loc(L.type.get(p.typeId)!.name)}</td>
                  <td>{p.size}</td>
                  <td className="nowrap"><ColorDot color={p.color} />{t(`color.${p.color}` as DictKey)}</td>
                  <td className="soft">{p.style ? t(`style.${p.style}` as DictKey) : '—'}</td>
                  {scope === 'all' && <td className="soft">{L.branch.get(p.branchId)?.name}</td>}
                  <td className="num">{p.mode !== 'sale' ? money(p.rentPrice) : '—'}</td>
                  <td className="num">{p.mode !== 'rent' ? money(p.salePrice) : '—'}</td>
                  <td className="soft">{t(`cond.${p.condition}` as DictKey)}</td>
                  <td><Chip tone={productTone[p.status]}>{t(`status.${p.status}` as DictKey)}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-foot">{t('c.showing', { n: list.length, total: all.length })}</div>
      <ProductFormModal open={open} onClose={() => setOpen(false)} product={edit} kind="dress" />
    </section>
  )
}

function Accessories() {
  const { t, money, loc } = useI18n()
  const { db, scope, remove } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const confirm = useConfirm()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [typeId, setTypeId] = useState('')
  const [edit, setEdit] = useState<Product | undefined>()
  const [open, setOpen] = useState(false)
  const accTypes = db.productTypes.filter((x) => x.kind === 'accessory')
  const s = q.trim().toLowerCase()
  const list = scoped.products
    .filter((p) => accTypes.some((x) => x.id === p.typeId) && (!typeId || p.typeId === typeId))
    .filter((p) => !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s))
    .sort((a, b) => a.typeId.localeCompare(b.typeId) || a.code.localeCompare(b.code))
  const inUse = new Set(db.orders.flatMap((o) => o.items.map((i) => i.productId)))

  const del = async (p: Product) => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('products', p.id)
    toast(t('c.deleted'))
  }

  return (
    <section className="card">
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder={t('pr.searchPh')} />
        <select id="fa-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">{t('pr.allTypes')}</option>
          {accTypes.map((x) => <option key={x.id} value={x.id}>{loc(x.name)}</option>)}
        </select>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => { setEdit(undefined); setOpen(true) }}><Plus />{t('pr.add')}</button>
      </div>
      {list.length === 0 ? <Empty icon={<Shirt />} title={t('pr.empty')} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('c.product')}</th><th>{t('c.type')}</th><th>{t('pr.size')}</th>{scope === 'all' && <th>{t('c.branch')}</th>}
                <th className="num">{t('pr.quantity')}</th><th className="num">{t('pr.rentPrice')}</th><th className="num">{t('pr.salePrice')}</th><th>{t('pr.mode')}</th><th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><div className="person"><ProductVisual product={p} kind="accessory" className="pv-thumb" /><div><div className="cell-main">{p.name}</div><div className="cell-sub">{p.code}</div></div></div></td>
                  <td className="soft">{loc(L.type.get(p.typeId)!.name)}</td>
                  <td>{p.size}</td>
                  {scope === 'all' && <td className="soft">{L.branch.get(p.branchId)?.name}</td>}
                  <td className="num">{p.quantity <= 1 ? <Chip tone={p.quantity === 0 ? 'bad' : 'warn'}>{p.quantity} · {p.quantity === 0 ? t('pay.outOfStock') : t('pr.lowStock')}</Chip> : p.quantity}</td>
                  <td className="num">{p.mode !== 'sale' ? money(p.rentPrice) : '—'}</td>
                  <td className="num">{p.mode !== 'rent' ? money(p.salePrice) : '—'}</td>
                  <td className="soft">{t(`mode.${p.mode}` as DictKey)}</td>
                  <td className="right nowrap">
                    <button className="icon-btn" title={t('c.edit')} onClick={() => { setEdit(p); setOpen(true) }}><Pencil /></button>
                    {!inUse.has(p.id) && <button className="icon-btn" title={t('c.delete')} onClick={() => del(p)}><Trash2 /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ProductFormModal open={open} onClose={() => setOpen(false)} product={edit} kind="accessory" />
    </section>
  )
}

function Types() {
  const { t, loc } = useI18n()
  const { db, remove } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const [edit, setEdit] = useState<ProductType | undefined>()
  const [open, setOpen] = useState(false)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of db.products) m.set(p.typeId, (m.get(p.typeId) ?? 0) + 1)
    return m
  }, [db.products])

  const del = async (x: ProductType) => {
    if (counts.get(x.id)) {
      toast(t('pr.typeInUse'), true)
      return
    }
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('productTypes', x.id)
    toast(t('c.deleted'))
  }

  return (
    <>
      <div className="notice"><Tags /><span>{t('pr.typesHint')}</span></div>
      <section className="card">
        <div className="card-head">
          <h3><Tags />{t('pr.types')}</h3>
          <button className="btn btn-primary" onClick={() => { setEdit(undefined); setOpen(true) }}><Plus />{t('pr.addType')}</button>
        </div>
        {db.productTypes.length === 0 ? <Empty icon={<Tags />} title={t('pr.typesEmpty')} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('pr.typeName')}</th><th>O'zbekcha / Русский / English</th><th>{t('pr.kind')}</th><th>{t('pr.description')}</th><th className="num">{t('pr.productsCount')}</th><th /></tr></thead>
              <tbody>
                {db.productTypes.map((x) => (
                  <tr key={x.id}>
                    <td className="cell-main">{loc(x.name)}</td>
                    <td className="soft small">{x.name.uz} / {x.name.ru || '—'} / {x.name.en || '—'}</td>
                    <td><Chip tone={x.kind === 'dress' ? 'gold' : 'info'} plain>{t(`kind.${x.kind}` as DictKey)}</Chip></td>
                    <td className="soft">{x.description || '—'}</td>
                    <td className="num">{counts.get(x.id) ?? 0}</td>
                    <td className="right nowrap">
                      <button className="icon-btn" title={t('c.edit')} onClick={() => { setEdit(x); setOpen(true) }}><Pencil /></button>
                      <button className="icon-btn" title={t('c.delete')} onClick={() => del(x)}><Trash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <TypeModal open={open} onClose={() => setOpen(false)} type={edit} />
    </>
  )
}

function TypeModal({ open, onClose, type }: { open: boolean; onClose: () => void; type?: ProductType }) {
  const { t } = useI18n()
  const { upsert } = useStore()
  const toast = useToast()
  const blank = (): ProductType => ({ id: '', name: { uz: '', ru: '', en: '' }, kind: 'dress', createdAt: '' })
  const [x, setX] = useState<ProductType>(type ?? blank())
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (open) {
      setX(type ?? blank())
      setTried(false)
    }
  }, [open, type])
  const save = () => {
    setTried(true)
    if (!x.name.uz.trim()) return
    upsert('productTypes', { ...x, id: x.id || uid(), name: { uz: x.name.uz.trim(), ru: x.name.ru?.trim(), en: x.name.en?.trim() }, createdAt: x.createdAt || nowIso() })
    toast(t('c.saved'))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={type ? t('pr.editType') : t('pr.addType')} footer={<FormFooter onCancel={onClose} onSave={save} />}>
      <Field label={t('pr.kind')} hint={t('pr.kindHint')}>
        <Segmented<ProductKind> value={x.kind} onChange={(k) => setX({ ...x, kind: k })} options={[{ value: 'dress', label: t('kind.dress') }, { value: 'accessory', label: t('kind.accessory') }]} />
      </Field>
      <div className="form-grid g3">
        <Field label={t('pr.nameUz')} htmlFor="ty-uz" error={tried && !x.name.uz.trim() ? t('c.required') : undefined}>
          <input id="ty-uz" className="input" value={x.name.uz} onChange={(e) => setX({ ...x, name: { ...x.name, uz: e.target.value } })} autoFocus />
        </Field>
        <Field label={t('pr.nameRu')} htmlFor="ty-ru" hint={t('c.optional')}>
          <input id="ty-ru" className="input" value={x.name.ru ?? ''} onChange={(e) => setX({ ...x, name: { ...x.name, ru: e.target.value } })} />
        </Field>
        <Field label={t('pr.nameEn')} htmlFor="ty-en" hint={t('c.optional')}>
          <input id="ty-en" className="input" value={x.name.en ?? ''} onChange={(e) => setX({ ...x, name: { ...x.name, en: e.target.value } })} />
        </Field>
      </div>
      <Field label={t('pr.description')} htmlFor="ty-desc">
        <input id="ty-desc" className="input" value={x.description ?? ''} onChange={(e) => setX({ ...x, description: e.target.value })} />
      </Field>
    </Modal>
  )
}
