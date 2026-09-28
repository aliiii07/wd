import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { displayStatus, groupByOrder, orderMoney, type DisplayStatus } from '../data/domain'
import { todayStr } from '../lib/date'
import { Page } from '../components/Layout'
import { Chip, Empty, orderTone, Progress, SearchInput, Segmented } from '../components/ui'

type Filter = 'active' | 'debt' | 'all'
const STATUSES: DisplayStatus[] = ['booked', 'picked_up', 'overdue', 'returned', 'completed', 'cancelled']

export default function Orders() {
  const { t, money, dateShort } = useI18n()
  const { db, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const today = todayStr()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [limit, setLimit] = useState(60)
  const pays = useMemo(() => groupByOrder(db.payments), [db.payments])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return scoped.orders
      .map((o) => ({ o, m: orderMoney(o, pays.get(o.id)), st: displayStatus(o, today), c: L.client.get(o.clientId) }))
      .filter(({ o, m, st, c }) => {
        if (filter === 'active' && !(o.status === 'booked' || o.status === 'picked_up' || o.status === 'returned')) return false
        if (filter === 'debt' && m.balance <= 0) return false
        if (type && o.type !== type) return false
        if (status && st !== status) return false
        if (!s) return true
        return o.number.toLowerCase().includes(s) || !!c?.name.toLowerCase().includes(s) || !!c?.phone.replace(/\D/g, '').includes(s.replace(/\D/g, '') || '§')
      })
      .sort((a, b) =>
        filter === 'active' ? (a.o.pickupDate).localeCompare(b.o.pickupDate) : b.o.createdAt.localeCompare(a.o.createdAt),
      )
  }, [scoped.orders, pays, today, L, q, filter, type, status])

  return (
    <Page title={t('ord.title')} tabs={[{ key: 'list', label: t('ord.list'), to: '/orders' }, { key: 'new', label: t('ord.new'), to: '/orders/new' }]} active="list">
      <section className="card">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder={`${t('ord.number')} / ${t('cl.searchPh').toLowerCase()}`} />
          <Segmented<Filter> value={filter} onChange={setFilter} options={[{ value: 'active', label: t('ord.active') }, { value: 'debt', label: t('ord.withDebt') }, { value: 'all', label: t('c.all') }]} />
          <select id="ord-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('ord.type')}: {t('c.all').toLowerCase()}</option>
            <option value="rental">{t('orderType.rental')}</option>
            <option value="sale">{t('orderType.sale')}</option>
          </select>
          <select id="ord-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('pr.allStatuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`orderStatus.${s}` as DictKey)}</option>)}
          </select>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={() => nav('/orders/new')}><Plus />{t('ord.new')}</button>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<ClipboardList />} title={q ? t('c.nothingFound') : t('ord.empty')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('ord.number')}</th>
                    <th>{t('c.client')}</th>
                    <th>{t('c.type')}</th>
                    <th>{t('ord.items')}</th>
                    <th>{t('ord.weddingDate')}</th>
                    <th>{t('ord.pickupDate')} → {t('ord.returnDate')}</th>
                    {scope === 'all' && <th>{t('c.branch')}</th>}
                    <th className="num">{t('ord.total')}</th>
                    <th style={{ minWidth: 130 }}>{t('ord.paid')}</th>
                    <th>{t('c.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map(({ o, m, st, c }) => {
                    const first = L.product.get(o.items[0]?.productId ?? '')
                    return (
                      <tr key={o.id} className="click" onClick={() => nav(`/orders/${o.id}`)}>
                        <td className="strong nowrap">{o.number}</td>
                        <td><div className="cell-main">{c?.name}</div><div className="cell-sub num">{c?.phone}</div></td>
                        <td><Chip tone={o.type === 'rental' ? 'gold' : 'info'} plain>{t(`orderType.${o.type}` as DictKey)}</Chip></td>
                        <td><div className="cell-main">{first?.name}</div><div className="cell-sub">{first?.code}{o.items.length > 1 ? ` +${o.items.length - 1}` : ''}</div></td>
                        <td className="nowrap">{dateShort(o.weddingDate)}</td>
                        <td className="nowrap soft">{dateShort(o.pickupDate)}{o.returnDate ? ` → ${dateShort(o.returnDate)}` : ''}</td>
                        {scope === 'all' && <td className="soft">{L.branch.get(o.branchId)?.name}</td>}
                        <td className="num strong">{money(m.total)}</td>
                        <td>
                          <div className="stack sm" style={{ gap: 4 }}>
                            <Progress value={m.paid} max={m.total} />
                            <span className="cell-sub num">{m.balance > 0 ? `${t('ord.balance')}: ${money(m.balance)}` : t('today.fullyPaid')}</span>
                          </div>
                        </td>
                        <td><Chip tone={orderTone[st]}>{t(`orderStatus.${st}` as DictKey)}</Chip></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-foot row between">
              <span>{t('c.showing', { n: Math.min(limit, rows.length), total: rows.length })}</span>
              {rows.length > limit && <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + 60)}>{t('c.seeAll')}</button>}
            </div>
          </>
        )}
      </section>
    </Page>
  )
}
