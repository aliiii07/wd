import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Printer } from 'lucide-react'
import { useI18n, formatMoney } from '../i18n'
import { dict, type DictKey } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import { orderTotal } from '../data/domain'
import { dotDate } from '../lib/date'
import { CAN_PRINT } from '../lib/env'
import type { Lang } from '../data/types'
import { Page } from '../components/Layout'
import { Empty, Segmented } from '../components/ui'

export default function Contract() {
  const { id } = useParams()
  const { t } = useI18n()
  const { db } = useStore()
  const L = useLookups()
  const order = db.orders.find((o) => o.id === id)
  const client = order ? L.client.get(order.clientId) : undefined
  const [lang, setLang] = useState<Lang>(client?.lang ?? 'uz')

  if (!order || !client) {
    return <Page title={t('ord.contract')}><Empty icon={<FileText />} title={t('c.nothingFound')} /></Page>
  }
  const tr = (key: DictKey, vars: Record<string, string> = {}) =>
    (dict[key] as Record<Lang, string>)[lang].replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
  const money = (n: number) => formatMoney(n, lang)
  const branch = L.branch.get(order.branchId)
  const value = order.items.reduce((s, i) => s + (L.product.get(i.productId)?.salePrice ?? i.price) * i.qty, 0)
  const rental = order.type === 'rental'

  return (
    <Page title={t('ord.contract')} crumb={order.number}>
      <div className="row between no-print">
        <Link to={`/orders/${order.id}`} className="btn btn-ghost"><ArrowLeft />{order.number}</Link>
        <div className="row">
          <Segmented<Lang> value={lang} onChange={setLang} options={[{ value: 'uz', label: "O'zbek" }, { value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]} />
          {CAN_PRINT && <button className="btn btn-primary" onClick={() => window.print()}><Printer />{t('c.print')}</button>}
        </div>
      </div>
      <article className="contract" lang={lang}>
        <div className="c-brand">
          <span className="monogram">OL</span>
          <span className="display" style={{ fontSize: 22 }}>{db.settings.storeName}</span>
        </div>
        <h1>{tr(rental ? 'ct.rentalTitle' : 'ct.saleTitle')} № {order.number}</h1>
        <div className="c-meta">
          <span>{branch?.address || tr('ct.city')}</span>
          <span>{dotDate(order.createdAt.slice(0, 10))}</span>
        </div>
        <p>{tr('ct.parties', { store: `«${db.settings.storeName}»`, client: `${client.name} (${client.phone})` })}</p>
        <table>
          <thead>
            <tr><th>#</th><th>{tr('c.product')}</th><th>{tr('pr.code')}</th><th>{tr('pr.size')}</th><th>{tr('c.price')}</th>{rental && <th>{tr('ct.value')}</th>}</tr>
          </thead>
          <tbody>
            {order.items.map((i, n) => {
              const p = L.product.get(i.productId)
              return (
                <tr key={i.productId}>
                  <td>{n + 1}</td>
                  <td>{p?.name}{i.qty > 1 ? ` × ${i.qty}` : ''}</td>
                  <td>{p?.code}</td>
                  <td>{p?.size}</td>
                  <td>{money(i.price * i.qty)}</td>
                  {rental && <td>{money((p?.salePrice ?? 0) * i.qty)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        <ol>
          {rental ? (
            <>
              <li>{tr('ct.r1', { wedding: order.weddingDate ? dotDate(order.weddingDate) : '—' })}</li>
              <li>{tr('ct.r2', { pickup: dotDate(order.pickupDate), ret: order.returnDate ? dotDate(order.returnDate) : '—' })}</li>
              <li>{tr('ct.r3', { fee: money(order.lateFeePerDay) })}</li>
              <li>{tr('ct.r4', { deposit: money(order.securityDeposit) })}</li>
              <li>{tr('ct.r5')}</li>
              <li>{tr('ct.r6', { value: money(value) })}</li>
            </>
          ) : (
            <>
              <li>{tr('ct.s1', { pickup: dotDate(order.pickupDate) })}</li>
              <li>{tr('ct.s2')}</li>
              <li>{tr('ct.s3')}</li>
              <li>{tr('ct.s4')}</li>
            </>
          )}
        </ol>
        <h3 style={{ marginTop: 22, fontSize: 15 }}>{tr('ct.payments')}</h3>
        <table>
          <tbody>
            <tr><td>{tr('ord.total')}</td><td><b>{money(orderTotal(order))}</b></td></tr>
            {order.installments.map((r, n) => (
              <tr key={n}><td>{n === 0 ? tr('ord.deposit') : tr('ord.installmentN', { n: String(n) })}</td><td>{money(r.amount)} — {dotDate(r.dueDate)}</td></tr>
            ))}
            {rental && <tr><td>{tr('ord.security')}</td><td>{money(order.securityDeposit)}</td></tr>}
          </tbody>
        </table>
        <div className="sign">
          <div>{tr('ct.signBoutique')}: {db.settings.storeName}<br />_____________ ({tr('ct.signature')})</div>
          <div>{tr('ct.signClient')}: {client.name}<br />_____________ ({tr('ct.signature')})</div>
        </div>
      </article>
    </Page>
  )
}
