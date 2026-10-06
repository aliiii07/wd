import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarHeart, UserPlus, Users } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useScoped, useStore, useLookups } from '../data/store'
import { groupByOrder, orderMoney } from '../data/domain'
import { diffDays, todayStr } from '../lib/date'
import { Page } from '../components/Layout'
import { ClientFormModal } from '../components/forms'
import { Avatar, Chip, Empty, SearchInput, Segmented } from '../components/ui'

type Filter = 'all' | 'soon' | 'debt'

export default function Clients() {
  const { t, money, dateShort } = useI18n()
  const { db, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const today = todayStr()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(50)

  const stats = useMemo(() => {
    const pays = groupByOrder(db.payments)
    const out = new Map<string, { orders: number; paid: number; balance: number }>()
    for (const o of scoped.orders) {
      if (o.status === 'cancelled') continue
      const m = orderMoney(o, pays.get(o.id))
      const s = out.get(o.clientId) ?? { orders: 0, paid: 0, balance: 0 }
      s.orders += 1
      s.paid += m.paid
      s.balance += m.balance
      out.set(o.clientId, s)
    }
    return out
  }, [scoped.orders, db.payments])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const digits = s.replace(/\D/g, '')
    return scoped.clients
      .filter((c) => !c.id.startsWith('walkin-'))
      .filter((c) => !s || c.name.toLowerCase().includes(s) || (digits.length > 2 && c.phone.replace(/\D/g, '').includes(digits)))
      .filter((c) => {
        if (filter === 'soon') return !!c.weddingDate && c.weddingDate >= today && diffDays(today, c.weddingDate) <= 30
        if (filter === 'debt') return (stats.get(c.id)?.balance ?? 0) > 0
        return true
      })
      .sort((a, b) => (filter === 'soon' ? a.weddingDate!.localeCompare(b.weddingDate!) : b.createdAt.localeCompare(a.createdAt)))
  }, [scoped.clients, q, filter, today, stats])

  return (
    <Page title={t('cl.title')}>
      <section className="card">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder={t('cl.searchPh')} />
          <Segmented<Filter> value={filter} onChange={setFilter} options={[{ value: 'all', label: t('c.all') }, { value: 'soon', label: t('cl.upcomingWedding') }, { value: 'debt', label: t('ord.withDebt') }]} />
          <span className="spacer" />
          <button className="btn btn-primary" onClick={() => setOpen(true)}><UserPlus />{t('cl.add')}</button>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<Users />} title={q ? t('c.nothingFound') : t('cl.empty')} hint={q ? undefined : t('cl.emptyHint')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('c.client')}</th>
                    <th>{t('ord.weddingDate')}</th>
                    <th>{t('cl.source')}</th>
                    {scope === 'all' && <th>{t('c.branch')}</th>}
                    <th className="num">{t('cl.orders')}</th>
                    <th className="num">{t('cl.totalSpent')}</th>
                    <th className="num">{t('cl.debt')}</th>
                    <th>{t('cl.since')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((c) => {
                    const s = stats.get(c.id)
                    const days = c.weddingDate ? diffDays(today, c.weddingDate) : null
                    return (
                      <tr key={c.id} className="click" onClick={() => nav(`/clients/${c.id}`)}>
                        <td>
                          <div className="person">
                            <Avatar name={c.name} />
                            <div><div className="cell-main">{c.name}</div><div className="cell-sub num">{c.phone}</div></div>
                          </div>
                        </td>
                        <td className="nowrap">
                          {c.weddingDate ? (
                            <div className="stack sm" style={{ gap: 2 }}>
                              <span>{dateShort(c.weddingDate)} {c.weddingDate.slice(0, 4)}</span>
                              {days !== null && days >= 0 && days <= 60 && <Chip tone={days <= 7 ? 'dark' : 'gold'}><CalendarHeart />{t('today.daysLeft', { n: days })}</Chip>}
                            </div>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td className="soft">{t(`source.${c.source}` as DictKey)}</td>
                        {scope === 'all' && <td className="soft nowrap">{L.branch.get(c.branchId)?.name}</td>}
                        <td className="num">{s?.orders ?? 0}</td>
                        <td className="num">{money(s?.paid ?? 0)}</td>
                        <td className="num">{s?.balance ? <span className="gold strong">{money(s.balance)}</span> : '—'}</td>
                        <td className="soft nowrap">{dateShort(c.createdAt.slice(0, 10))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-foot row between">
              <span>{t('c.showing', { n: Math.min(limit, rows.length), total: rows.length })}</span>
              {rows.length > limit && <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + 50)}>{t('c.seeAll')}</button>}
            </div>
          </>
        )}
      </section>
      <ClientFormModal open={open} onClose={() => setOpen(false)} onSaved={(id) => nav(`/clients/${id}`)} />
    </Page>
  )
}
