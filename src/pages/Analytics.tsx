import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, Building2, CalendarHeart, CircleDollarSign, ClipboardList, Gauge, HandCoins, Layers, Percent, Receipt, ShieldCheck, Shirt, Table2,
  TrendingUp, Users, Wallet,
} from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { monthShort } from '../i18n/dict'
import { useLookups, useStore } from '../data/store'
import {
  dressRevenue, EXPENSE_CATEGORIES, EXPENSE_PIE, expenseByCategory, expenseSeries, methodBreakdown, metrics, PERIODS, periodRange, revenueSeries, salesMix,
  sliceFor, staffPerformance, statusBreakdown, typeBreakdown, weddingsAhead, type PeriodKey, type Slice,
} from '../data/analytics'
import { dateOf, inRange, parseDate, todayStr } from '../lib/date'
import { Page } from '../components/Layout'
import { AreaTrend, Columns, Donut, expenseColor, foldSlices, HBars, Legend, OTHER_COLOR, SERIES, seriesColor, ShareBar, useMethodSlices } from '../components/charts'
import { Chip, Empty, pctChange, productTone, Segmented, Stat } from '../components/ui'
import { PRODUCT_STATUSES, SOURCES } from '../components/forms'
import type { Lang } from '../data/types'
import { ROLE_TONE } from '../components/roles'

type Tab = 'overview' | 'expenses' | 'branches' | 'products' | 'staff' | 'clients'
const TABS: Tab[] = ['overview', 'expenses', 'branches', 'products', 'staff', 'clients']

function bucketLabel(key: string, lang: Lang) {
  if (key.length === 7) {
    const d = parseDate(`${key}-01`)
    return `${monthShort[lang][d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
  }
  return String(parseDate(key).getDate())
}

export default function Analytics() {
  const { t, lang } = useI18n()
  const { db, scope, isFounder } = useStore()
  const L = useLookups()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const asked = params.get('tab') as Tab | null
    return asked && TABS.includes(asked) ? asked : 'overview'
  })
  const [period, setPeriod] = useState<PeriodKey>('last3')
  const today = todayStr()
  const p = periodRange(period, today)
  const slice = useMemo(() => sliceFor(db, scope === 'all' ? 'all' : [scope]), [db, scope])

  const tabs = [
    { key: 'overview', label: t('an.overview') },
    { key: 'expenses', label: t('ex.title') },
    ...(isFounder && db.branches.length > 1 ? [{ key: 'branches', label: t('an.branches') }] : []),
    { key: 'products', label: t('an.products') },
    { key: 'staff', label: t('an.staff') },
    { key: 'clients', label: t('an.clients') },
  ]

  return (
    <Page title={t('an.title')} tabs={tabs} active={tab} onTab={(k) => setTab(k as Tab)}>
      <div className="row between">
        <div className="row">
          {scope === 'all' ? (
            <Chip tone="dark" className="wrap"><Building2 />{t('an.founderView')}</Chip>
          ) : (
            <Chip tone="gold" className="wrap">{t('an.branchView', { name: L.branch.get(scope)?.name ?? '' })}</Chip>
          )}
        </div>
        <Segmented value={period} onChange={setPeriod} options={PERIODS.map((k) => ({ value: k, label: t(`an.p.${k}` as DictKey) }))} />
      </div>
      {tab === 'overview' && <Overview slice={slice} period={period} lang={lang} />}
      {tab === 'expenses' && <ExpensesTab slice={slice} period={period} lang={lang} />}
      {tab === 'branches' && isFounder && <BranchCompare period={period} lang={lang} />}
      {tab === 'products' && <ProductsTab slice={slice} period={period} />}
      {tab === 'staff' && <StaffTab slice={slice} period={period} />}
      {tab === 'clients' && <ClientsTab slice={slice} period={period} lang={lang} />}
      <span className="muted small">{tab === 'expenses' ? t('ex.hint') : t('an.revenueHint')} · {p.from} → {p.to}</span>
    </Page>
  )
}

function Overview({ slice, period, lang }: { slice: Slice; period: PeriodKey; lang: Lang }) {
  const { t, money, moneyShort, num, loc } = useI18n()
  const today = todayStr()
  const p = periodRange(period, today)
  const cur = metrics(slice, p.from, p.to, today)
  const prev = metrics(slice, p.prevFrom, p.prevTo, today)
  const vs = t('an.vsPrev')
  const series = revenueSeries(slice, p).map((x) => ({ label: bucketLabel(x.key, lang), value: x.value }))
  const methodSlices = useMethodSlices(methodBreakdown(slice, p.from, p.to))
  const mix = salesMix(slice, p.from, p.to)
    .filter((g) => g.key !== 'other' || g.value > 0)
    .map((g, i) => ({
      key: g.key,
      label: g.typeId ? loc(slice.productTypes.find((x) => x.id === g.typeId)!.name) : g.key === 'accessories' ? t('pr.accessories') : t('c.other'),
      value: g.value,
      color: g.key === 'other' ? OTHER_COLOR : SERIES[i],
    }))
  const statuses = statusBreakdown(slice)
  const weddings = weddingsAhead(slice.orders, today)
  const [table, setTable] = useState(false)

  return (
    <>
      <div className="stats four">
        <Stat icon={<CircleDollarSign />} label={t('an.revenue')} value={<span title={money(cur.revenue)}>{moneyShort(cur.revenue)}</span>} delta={{ pct: pctChange(cur.revenue, prev.revenue), label: vs }} />
        <Stat icon={<ClipboardList />} label={t('an.orders')} value={num(cur.orders)} delta={{ pct: pctChange(cur.orders, prev.orders), label: vs }} hint={`${t('orderType.rental')}: ${cur.rentals} · ${t('orderType.sale')}: ${cur.sales}`} />
        <Stat icon={<HandCoins />} label={t('an.avgOrder')} value={moneyShort(cur.avgOrder)} delta={{ pct: pctChange(cur.avgOrder, prev.avgOrder), label: vs }} />
        <Stat icon={<Gauge />} label={t('an.utilization')} value={`${Math.round(cur.utilization)}%`} delta={{ pct: pctChange(cur.utilization, prev.utilization), label: vs }} hint={t('an.utilizationHint')} />
        <Stat icon={<Wallet />} label={t('an.outstanding')} value={moneyShort(cur.outstanding)} hint={`${t('an.activeRentals')}: ${cur.activeRentals}`} />
        <Stat icon={<ShieldCheck />} label={t('an.securityHeld')} value={moneyShort(cur.securityHeld)} />
        <Stat icon={<Users />} label={t('an.newClients')} value={num(cur.newClients)} delta={{ pct: pctChange(cur.newClients, prev.newClients), label: vs }} />
        <Stat icon={<Percent />} label={t('an.visitToOrder')} value={`${Math.round(cur.visitConversion)}%`} delta={{ pct: pctChange(cur.visitConversion, prev.visitConversion), label: vs }} />
      </div>

      <section className="card">
        <div className="card-head">
          <h3><CircleDollarSign />{t('an.revenueTrend')}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setTable((v) => !v)}><Table2 />{table ? t('c.chartView') : t('c.tableView')}</button>
        </div>
        <div className="card-body">
          {table ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{p.bucket === 'day' ? t('c.date') : t('an.month')}</th><th className="num">{t('an.revenue')}</th></tr></thead>
                <tbody>{series.map((r) => <tr key={r.label}><td>{r.label}</td><td className="num">{money(r.value)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : p.bucket === 'day' ? (
            <Columns data={series.map((x) => ({ label: x.label, v: x.value }))} series={[{ key: 'v', name: t('an.revenue'), color: seriesColor(0) }]} />
          ) : (
            <AreaTrend data={series} name={t('an.revenue')} />
          )}
        </div>
      </section>

      <div className="grid g-2">
        <section className="card">
          <div className="card-head"><h3><Layers />{t('an.rentalVsSale')}</h3><span className="sub">{t('an.salesVolume')}</span></div>
          <div className="card-body">
            <ShareBar
              format={money}
              parts={[
                { key: 'rental', label: `${t('orderType.rental')} · ${cur.rentals}`, value: cur.rentalVolume, color: seriesColor(0) },
                { key: 'sale', label: `${t('orderType.sale')} · ${cur.sales}`, value: cur.saleVolume, color: seriesColor(1) },
              ]}
            />
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3><Wallet />{t('an.methods')}</h3><span className="sub">{t('an.revenue')}</span></div>
          <div className="card-body">
            <Donut parts={methodSlices} format={money} centerFormat={moneyShort} centerLabel={t('c.total')} emptyLabel={t('c.noData')} />
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3><Shirt />{t('an.salesMix')}</h3><span className="sub">{t('an.salesVolume')}</span></div>
          <div className="card-body">
            <Donut parts={mix} format={money} centerFormat={moneyShort} centerLabel={t('c.total')} emptyLabel={t('c.noData')} />
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3><Shirt />{t('an.inventory')}</h3><span className="sub">{t('an.dresses')}: {cur.dresses}</span></div>
          <div className="card-body">
            <HBars
              format={(n) => num(n)}
              rows={PRODUCT_STATUSES.map((s) => ({ key: s, label: <Chip tone={productTone[s]}>{t(`status.${s}` as DictKey)}</Chip>, value: statuses[s] }))}
            />
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h3><CalendarHeart />{t('an.weddingsByMonth')}</h3><span className="sub">{t('an.weddingsHint')}</span></div>
        <div className="card-body">
          <Columns money={false} height={220} data={weddings.map((w) => ({ label: bucketLabel(w.key, lang), v: w.value }))} series={[{ key: 'v', name: t('cal.wedding'), color: seriesColor(0) }]} />
        </div>
      </section>
    </>
  )
}

/** Growth of a figure that can be negative (profit): measured against the size of the old value, so less loss reads as up. */
function signedChange(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0
  return ((cur - prev) / Math.abs(prev)) * 100
}

function ExpensesTab({ slice, period, lang }: { slice: Slice; period: PeriodKey; lang: Lang }) {
  const { t, money, moneyShort } = useI18n()
  const { db, scope, isFounder } = useStore()
  const nav = useNavigate()
  const today = todayStr()
  const p = periodRange(period, today)
  const cur = metrics(slice, p.from, p.to, today)
  const prev = metrics(slice, p.prevFrom, p.prevTo, today)
  const vs = t('an.vsPrev')
  const [table, setTable] = useState(false)

  const expenses = expenseSeries(slice, p)
  const rows = revenueSeries(slice, p).map((r, i) => ({ label: bucketLabel(r.key, lang), revenue: r.value, expenses: expenses[i].value }))
  const byCategory = expenseByCategory(slice, p.from, p.to)
  const pieKeys = new Set(EXPENSE_PIE.map((x) => x.key))
  const pie = [
    ...EXPENSE_PIE.map((x) => ({ key: x.key, label: t(`expCat.${x.key}` as DictKey), value: byCategory[x.key], color: expenseColor(x.key) })),
    { key: 'other', label: t('c.other'), value: EXPENSE_CATEGORIES.filter((c) => !pieKeys.has(c)).reduce((s, c) => s + byCategory[c], 0), color: OTHER_COLOR },
  ].filter((x) => x.value > 0)
  const ranked = EXPENSE_CATEGORIES.map((c) => ({ c, value: byCategory[c] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const branches = isFounder && scope === 'all' && db.branches.length > 1
    ? db.branches.map((b, i) => ({ b, color: seriesColor(i), m: metrics(sliceFor(db, [b.id]), p.from, p.to, today) }))
    : []

  return (
    <>
      <div className="stats four">
        <Stat icon={<CircleDollarSign />} label={t('an.revenue')} value={<span title={money(cur.revenue)}>{moneyShort(cur.revenue)}</span>} delta={{ pct: pctChange(cur.revenue, prev.revenue), label: vs }} />
        <Stat icon={<Receipt />} label={t('ex.title')} value={<span title={money(cur.expenses)}>{moneyShort(cur.expenses)}</span>} delta={{ pct: pctChange(cur.expenses, prev.expenses), label: vs }} upIsGood={false} />
        <Stat
          icon={<TrendingUp />}
          label={cur.profit < 0 ? t('ex.loss') : t('ex.profit')}
          value={<span title={money(cur.profit)}>{moneyShort(cur.profit)}</span>}
          delta={{ pct: signedChange(cur.profit, prev.profit), label: vs }}
          alert={cur.profit < 0}
        />
        <Stat icon={<Percent />} label={t('ex.margin')} value={`${Math.round(cur.margin)}%`} hint={t('ex.marginHint')} />
      </div>

      <section className="card">
        <div className="card-head">
          <h3><TrendingUp />{t('ex.vsRevenue')}</h3>
          <div className="row" style={{ gap: 16 }}>
            <Legend items={[{ name: t('an.revenue'), color: seriesColor(0) }, { name: t('ex.title'), color: seriesColor(3) }]} />
            <button className="btn btn-ghost btn-sm" onClick={() => setTable((v) => !v)}><Table2 />{table ? t('c.chartView') : t('c.tableView')}</button>
          </div>
        </div>
        <div className="card-body">
          {table ? (
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>{p.bucket === 'day' ? t('c.date') : t('an.month')}</th>
                    <th className="num">{t('an.revenue')}</th>
                    <th className="num">{t('ex.title')}</th>
                    <th className="num">{t('ex.profit')}</th>
                    <th className="num">{t('ex.margin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((r) => r.revenue || r.expenses).map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num">{money(r.revenue)}</td>
                      <td className="num">{money(r.expenses)}</td>
                      <td className={`num strong ${r.revenue - r.expenses < 0 ? 'text-bad' : ''}`}>{money(r.revenue - r.expenses)}</td>
                      <td className="num soft">{r.revenue ? `${Math.round(((r.revenue - r.expenses) / r.revenue) * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Columns
              data={rows.map((r) => ({ label: r.label, revenue: r.revenue, expenses: r.expenses }))}
              series={[{ key: 'revenue', name: t('an.revenue'), color: seriesColor(0) }, { key: 'expenses', name: t('ex.title'), color: seriesColor(3) }]}
            />
          )}
        </div>
      </section>

      <div className="grid g-2">
        <section className="card">
          <div className="card-head"><h3><Receipt />{t('ex.structure')}</h3><span className="sub">{t('ex.title')}</span></div>
          <div className="card-body">
            <Donut parts={pie} format={money} centerFormat={moneyShort} centerLabel={t('c.total')} emptyLabel={t('ex.empty')} />
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h3><Layers />{t('ex.byCategory')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/expenses')}>{t('nav.expenses')}<ArrowRight /></button>
          </div>
          <div className="card-body">
            {ranked.length === 0 ? <Empty icon={<Receipt />} title={t('ex.empty')} /> : (
              <HBars
                format={moneyShort}
                rows={ranked.map((r) => ({
                  key: r.c,
                  label: t(`expCat.${r.c}` as DictKey),
                  value: r.value,
                  color: expenseColor(r.c),
                  sub: `${Math.round((r.value / (cur.expenses || 1)) * 100)}%`,
                }))}
              />
            )}
          </div>
        </section>
      </div>

      {branches.length > 0 && (
        <section className="card">
          <div className="card-head"><h3><Building2 />{t('ex.byBranch')}</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('c.branch')}</th>
                  <th className="num">{t('an.revenue')}</th>
                  <th className="num">{t('ex.title')}</th>
                  <th className="num">{t('ex.profit')}</th>
                  <th className="num">{t('ex.margin')}</th>
                  <th style={{ minWidth: 160 }}>{t('an.share')} · {t('ex.title').toLowerCase()}</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(({ b, color, m }) => (
                  <tr key={b.id}>
                    <td><span className="row nowrap-row" style={{ gap: 8 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: color }} /><span className="cell-main">{b.name}</span></span></td>
                    <td className="num">{money(m.revenue)}</td>
                    <td className="num">{money(m.expenses)}</td>
                    <td className={`num strong ${m.profit < 0 ? 'text-bad' : ''}`}>{money(m.profit)}</td>
                    <td className="num soft">{Math.round(m.margin)}%</td>
                    <td>
                      <span style={{ display: 'block', height: 8 }}>
                        <span style={{ display: 'block', height: '100%', width: `${cur.expenses ? (m.expenses / cur.expenses) * 100 : 0}%`, background: color, borderRadius: '0 3px 3px 0', minWidth: m.expenses ? 2 : 0 }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

function BranchCompare({ period, lang }: { period: PeriodKey; lang: Lang }) {
  const { t, money, moneyShort, num } = useI18n()
  const { db } = useStore()
  const today = todayStr()
  const p = periodRange(period, today)
  const rows = db.branches.map((b, i) => {
    const s = sliceFor(db, [b.id])
    return { b, color: seriesColor(i), m: metrics(s, p.from, p.to, today), series: revenueSeries(s, p), staff: db.staff.filter((x) => x.branchId === b.id && x.active).length }
  })
  const total = metrics(sliceFor(db, 'all'), p.from, p.to, today)
  const chart = rows[0]?.series.map((x, i) => {
    const row: Record<string, string | number> = { label: bucketLabel(x.key, lang) }
    rows.forEach((r) => (row[r.b.id] = r.series[i].value))
    return row
  }) ?? []

  const lines: { label: string; get: (m: typeof total) => string; total?: string }[] = [
    { label: t('an.revenue'), get: (m) => money(m.revenue) },
    { label: t('ex.title'), get: (m) => money(m.expenses) },
    { label: t('ex.profit'), get: (m) => money(m.profit) },
    { label: t('ex.margin'), get: (m) => `${Math.round(m.margin)}%` },
    { label: t('an.orders'), get: (m) => num(m.orders) },
    { label: `${t('orderType.rental')} / ${t('orderType.sale')}`, get: (m) => `${m.rentals} / ${m.sales}` },
    { label: t('an.salesVolume'), get: (m) => money(m.volume) },
    { label: t('an.avgOrder'), get: (m) => money(m.avgOrder) },
    { label: t('an.utilization'), get: (m) => `${Math.round(m.utilization)}%` },
    { label: t('an.outstanding'), get: (m) => money(m.outstanding) },
    { label: t('an.securityHeld'), get: (m) => money(m.securityHeld) },
    { label: t('an.activeRentals'), get: (m) => num(m.activeRentals) },
    { label: t('an.newClients'), get: (m) => num(m.newClients) },
    { label: t('an.visitToOrder'), get: (m) => `${Math.round(m.visitConversion)}%` },
    { label: t('an.dresses'), get: (m) => num(m.dresses) },
  ]

  return (
    <>
      <div className="stats">
        {rows.map((r) => (
          <Stat key={r.b.id} icon={<i style={{ width: 10, height: 10, borderRadius: 3, background: r.color, display: 'inline-block' }} />} label={r.b.name} value={<span title={money(r.m.revenue)}>{moneyShort(r.m.revenue)}</span>} hint={`${t('an.share')}: ${total.revenue ? Math.round((r.m.revenue / total.revenue) * 100) : 0}% · ${t('an.orders')}: ${r.m.orders}`} />
        ))}
        <Stat icon={<Building2 />} label={t('c.allBranches')} value={<span title={money(total.revenue)}>{moneyShort(total.revenue)}</span>} hint={`${t('an.orders')}: ${total.orders}`} />
      </div>

      <section className="card">
        <div className="card-head">
          <h3><Building2 />{t('an.revenueByBranch')}</h3>
          <Legend items={rows.map((r) => ({ name: r.b.name, color: r.color }))} />
        </div>
        <div className="card-body">
          <Columns data={chart} series={rows.map((r) => ({ key: r.b.id, name: r.b.name, color: r.color }))} />
        </div>
      </section>

      <div className="grid g-side">
        <section className="card">
          <div className="card-head"><h3><Table2 />{t('an.branchCompare')}</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('an.metric')}</th>
                  {rows.map((r) => <th key={r.b.id} className="num"><span className="row nowrap-row" style={{ gap: 6, justifyContent: 'flex-end' }}><i style={{ width: 9, height: 9, borderRadius: 2, background: r.color }} />{r.b.name}</span></th>)}
                  <th className="num">{t('c.total')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.label}>
                    <td className="soft">{l.label}</td>
                    {rows.map((r) => <td key={r.b.id} className="num">{l.get(r.m)}</td>)}
                    <td className="num strong">{l.get(total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="soft">{t('br.staff')}</td>
                  {rows.map((r) => <td key={r.b.id} className="num">{r.staff}</td>)}
                  <td className="num strong">{rows.reduce((s, r) => s + r.staff, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3><Percent />{t('an.share')}</h3></div>
          <div className="card-body stack" style={{ gap: 22 }}>
            <div className="stack sm">
              <span className="label">{t('an.revenueShare')}</span>
              <Donut
                parts={foldSlices(rows.map((r) => ({ key: r.b.id, label: r.b.name, value: r.m.revenue, color: r.color })), t('c.other'))}
                format={moneyShort}
                centerLabel={t('c.total')}
                emptyLabel={t('c.noData')}
                size={170}
              />
            </div>
            <div className="stack sm">
              <span className="label">{t('an.orders')}</span>
              <ShareBar format={(n) => num(n)} parts={rows.map((r) => ({ key: r.b.id, label: r.b.name, value: r.m.orders, color: r.color }))} />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function ProductsTab({ slice, period }: { slice: Slice; period: PeriodKey }) {
  const { t, money, loc } = useI18n()
  const L = useLookups()
  const { scope } = useStore()
  const nav = useNavigate()
  const p = periodRange(period, todayStr())
  const rev = dressRevenue(slice, p.from, p.to)
  const types = typeBreakdown(slice, p.from, p.to)
  const dressTypes = new Set(slice.productTypes.filter((x) => x.kind === 'dress').map((x) => x.id))
  const dresses = slice.products
    .filter((x) => dressTypes.has(x.typeId))
    .map((x) => ({ p: x, r: rev.get(x.id) ?? { id: x.id, rentals: 0, sold: false, periodRevenue: 0, lifetimeRevenue: 0 } }))
    .sort((a, b) => b.r.periodRevenue - a.r.periodRevenue || b.r.lifetimeRevenue - a.r.lifetimeRevenue)
  const top = dresses.filter((d) => d.r.periodRevenue > 0).slice(0, 8)
  const maxRev = Math.max(1, ...dresses.map((d) => d.r.periodRevenue))

  return (
    <>
      <div className="grid g-2">
        <section className="card">
          <div className="card-head"><h3><Shirt />{t('an.topDresses')}</h3></div>
          <div className="card-body">
            {top.length === 0 ? <Empty title={t('c.noData')} /> : (
              <HBars format={money} rows={top.map((d) => ({ key: d.p.id, label: `${d.p.name} · ${d.p.code}`, value: d.r.periodRevenue }))} />
            )}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3><Layers />{t('an.byType')}</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('c.type')}</th><th className="num">{t('c.qty')}</th><th className="num">{t('an.itemRevenue')}</th></tr></thead>
              <tbody>
                {slice.productTypes.map((ty) => {
                  const r = types.get(ty.id)
                  return (
                    <tr key={ty.id}>
                      <td><span className="strong">{loc(ty.name)}</span> <span className="muted small">· {t(`kind.${ty.kind}` as DictKey)}</span></td>
                      <td className="num">{r?.count ?? 0}</td>
                      <td className="num">{money(r?.revenue ?? 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-head"><h3><Shirt />{t('an.revenuePerDress')}</h3><span className="sub">{t('an.roi')} = {t('an.itemRevenue').toLowerCase()} / {t('pr.cost').toLowerCase()}</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('c.product')}</th>
                <th>{t('c.type')}</th>
                {scope === 'all' && <th>{t('c.branch')}</th>}
                <th>{t('c.status')}</th>
                <th className="num">{t('an.timesRented')}</th>
                <th style={{ minWidth: 200 }}>{t('an.itemRevenue')} ({t('c.period').toLowerCase()})</th>
                <th className="num">{t('pr.cost')}</th>
                <th className="num">{t('an.roi')}</th>
              </tr>
            </thead>
            <tbody>
              {dresses.map(({ p: d, r }) => {
                const roi = d.cost ? (r.lifetimeRevenue / d.cost) * 100 : 0
                return (
                  <tr key={d.id} className="click" onClick={() => nav(`/products/${d.id}`)}>
                    <td><div className="cell-main">{d.name}</div><div className="cell-sub">{d.code} · {d.size}</div></td>
                    <td className="soft">{loc(L.type.get(d.typeId)!.name)}</td>
                    {scope === 'all' && <td className="soft">{L.branch.get(d.branchId)?.name}</td>}
                    <td><Chip tone={productTone[d.status]}>{t(`status.${d.status}` as DictKey)}</Chip></td>
                    <td className="num">{r.rentals}{r.sold ? ` + ${t('orderType.sale').toLowerCase()}` : ''}</td>
                    <td>
                      <div className="row nowrap-row" style={{ gap: 10 }}>
                        <span style={{ flex: 1, height: 8, minWidth: 60 }}>
                          <span style={{ display: 'block', height: '100%', width: `${(r.periodRevenue / maxRev) * 100}%`, background: 'var(--s1)', borderRadius: '0 4px 4px 0', minWidth: r.periodRevenue ? 2 : 0 }} />
                        </span>
                        <span className="num strong" style={{ minWidth: 110, textAlign: 'right' }}>{money(r.periodRevenue)}</span>
                      </div>
                    </td>
                    <td className="num soft">{money(d.cost)}</td>
                    <td className="num"><Chip tone={roi >= 100 ? 'good' : roi >= 50 ? 'gold' : 'neutral'} plain>{Math.round(roi)}%</Chip></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function StaffTab({ slice, period }: { slice: Slice; period: PeriodKey }) {
  const { t, money } = useI18n()
  const { db, scope } = useStore()
  const L = useLookups()
  const p = periodRange(period, todayStr())
  const staff = db.staff.filter((s) => scope === 'all' || s.branchId === scope)
  const perf = staffPerformance(slice, staff, p.from, p.to)
  const rows = staff.map((s) => ({ s, r: perf.get(s.id)! })).sort((a, b) => b.r.volume - a.r.volume)
  const sellers = rows.filter((x) => x.r.volume > 0)
  return (
    <div className="grid g-side">
      <section className="card">
        <div className="card-head"><h3><Users />{t('an.staff')}</h3><span className="sub">{t('st.commissionHint')}</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('c.staff')}</th><th>{t('st.role')}</th>{scope === 'all' && <th>{t('c.branch')}</th>}
                <th className="num">{t('st.salesCount')}</th><th className="num">{t('an.salesVolume')}</th><th className="num">{t('an.commission')}</th>
                <th className="num">{t('an.appointments')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, r }) => (
                <tr key={s.id}>
                  <td className="cell-main">{s.name}</td>
                  <td><Chip tone={ROLE_TONE[s.role]} plain>{t(`staffRole.${s.role}` as DictKey)}</Chip></td>
                  {scope === 'all' && <td className="soft">{L.branch.get(s.branchId)?.name}</td>}
                  <td className="num">{r.orders}</td>
                  <td className="num">{money(r.volume)}</td>
                  <td className="num strong">{money(r.commission)}</td>
                  <td className="num">{r.appointments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h3><HandCoins />{t('an.salesVolume')}</h3></div>
        <div className="card-body">
          {sellers.length === 0 ? <Empty title={t('c.noData')} /> : <HBars format={money} rows={sellers.map(({ s, r }) => ({ key: s.id, label: s.name, value: r.volume }))} />}
        </div>
      </section>
    </div>
  )
}

function ClientsTab({ slice, period, lang }: { slice: Slice; period: PeriodKey; lang: Lang }) {
  const { t, num } = useI18n()
  const p = periodRange(period, todayStr())
  const clients = slice.clients.filter((c) => inRange(dateOf(c.createdAt), p.from, p.to))
  const sources = SOURCES.map((s) => ({ key: s, label: t(`source.${s}` as DictKey), value: clients.filter((c) => c.source === s).length })).sort((a, b) => b.value - a.value)
  const viewings = slice.appointments.filter((a) => a.type === 'viewing' && a.status === 'completed' && inRange(a.date, p.from, p.to))
  const withOrder = new Set(slice.orders.filter((o) => o.status !== 'cancelled').map((o) => o.clientId))
  const converted = viewings.filter((v) => withOrder.has(v.clientId)).length
  const byBucket = new Map<string, number>()
  for (const c of clients) {
    const d = dateOf(c.createdAt)
    const k = p.bucket === 'day' ? d : d.slice(0, 7)
    byBucket.set(k, (byBucket.get(k) ?? 0) + 1)
  }
  const series = revenueSeries({ ...slice, payments: [] }, p).map((b) => ({ label: bucketLabel(b.key, lang), v: byBucket.get(b.key) ?? 0 }))

  return (
    <>
      <div className="stats">
        <Stat icon={<Users />} label={t('an.newClients')} value={num(clients.length)} />
        <Stat icon={<CalendarHeart />} label={t('an.visitToOrder')} value={`${viewings.length ? Math.round((converted / viewings.length) * 100) : 0}%`} hint={`${converted} / ${viewings.length}`} />
      </div>
      <div className="grid g-2">
        <section className="card">
          <div className="card-head"><h3><Users />{t('an.sources')}</h3></div>
          <div className="card-body">
            <HBars format={(n) => num(n)} rows={sources} />
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-head"><h3><Users />{t('an.newClients')}</h3></div>
        <div className="card-body">
          <Columns money={false} height={220} data={series} series={[{ key: 'v', name: t('an.newClients'), color: seriesColor(0) }]} />
        </div>
      </section>
    </>
  )
}
