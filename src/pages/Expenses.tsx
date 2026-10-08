import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, CircleDollarSign, Landmark, Pencil, Plus, Receipt, Trash2, TrendingUp } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { EXPENSE_CATEGORIES, expenseByCategory, expenseTotal, metrics, PERIODS, periodRange, sliceFor, type PeriodKey } from '../data/analytics'
import { inRange, nowIso, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import type { Expense, ExpenseCategory } from '../data/types'
import { Page } from '../components/Layout'
import { MethodPicker, useMethods } from '../components/forms'
import { expenseColor, HBars } from '../components/charts'
import { Chip, Empty, Field, FormFooter, Modal, MoneyInput, pctChange, SearchInput, Segmented, Stat, useConfirm, useToast } from '../components/ui'

/** The boutique's spending: what went out, on what, from which branch. */
export default function Expenses() {
  const { t, money, moneyShort, date } = useI18n()
  const { db, scope, remove } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const today = todayStr()
  const [period, setPeriod] = useState<PeriodKey>('thisMonth')
  const [category, setCategory] = useState<ExpenseCategory | ''>('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const [modal, setModal] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null })
  const p = periodRange(period, today)
  const slice = useMemo(() => sliceFor(db, scope === 'all' ? 'all' : [scope]), [db, scope])
  const m = metrics(slice, p.from, p.to, today)
  const prevTotal = expenseTotal(slice, p.prevFrom, p.prevTo)
  const byCategory = expenseByCategory(slice, p.from, p.to)
  const ranked = EXPENSE_CATEGORIES.map((c) => ({ c, value: byCategory[c] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const top = ranked[0]
  const inPeriod = scoped.expenses.filter((e) => inRange(e.date, p.from, p.to))

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return scoped.expenses
      .filter((e) => inRange(e.date, p.from, p.to) && (!category || e.category === category))
      .filter((e) => !s || !!e.note?.toLowerCase().includes(s) || !!L.staff.get(e.staffId ?? '')?.name.toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [scoped.expenses, p.from, p.to, category, q, L])
  const listTotal = list.reduce((s, e) => s + e.amount, 0)

  const del = async (e: Expense) => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('expenses', e.id)
    toast(t('c.deleted'))
  }

  return (
    <Page
      title={t('ex.title')}
      crumb={`${date(p.from)} — ${date(p.to)}`}
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setModal({ open: true, expense: null })}><Plus />{t('ex.add')}</button>
          <button className="btn btn-outline" onClick={() => nav('/analytics?tab=expenses')}><BarChart3 />{t('an.title')}</button>
        </>
      }
    >
      <div className="row between">
        <Segmented value={period} onChange={setPeriod} options={PERIODS.map((k) => ({ value: k, label: t(`an.p.${k}` as DictKey) }))} />
      </div>

      <div className="stats four">
        <Stat
          icon={<Receipt />}
          label={t('ex.total')}
          value={<span title={money(m.expenses)}>{moneyShort(m.expenses)}</span>}
          delta={{ pct: pctChange(m.expenses, prevTotal), label: t('an.vsPrev') }}
          upIsGood={false}
          hint={t('ex.count', { n: inPeriod.length })}
        />
        <Stat icon={<CircleDollarSign />} label={t('an.revenue')} value={<span title={money(m.revenue)}>{moneyShort(m.revenue)}</span>} hint={m.revenue ? t('ex.ofRevenue', { n: Math.round((m.expenses / m.revenue) * 100) }) : undefined} />
        <Stat
          icon={<TrendingUp />}
          label={m.profit < 0 ? t('ex.loss') : t('ex.profit')}
          value={<span title={money(m.profit)}>{moneyShort(m.profit)}</span>}
          alert={m.profit < 0}
          hint={`${t('ex.margin')}: ${Math.round(m.margin)}%`}
        />
        <Stat
          icon={<Landmark />}
          label={t('ex.biggest')}
          value={top ? t(`expCat.${top.c}` as DictKey) : '—'}
          hint={top ? `${money(top.value)} · ${Math.round((top.value / (m.expenses || 1)) * 100)}%` : undefined}
        />
      </div>

      <div className="grid g-side">
        <section className="card">
          <div className="toolbar">
            <SearchInput id="ex-search" value={q} onChange={setQ} placeholder={`${t('c.notes')} / ${t('c.staff')}`} />
            <select id="ex-category" className="select" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory | '')} aria-label={t('ex.category')}>
              <option value="">{t('ex.allCategories')}</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`expCat.${c}` as DictKey)}</option>)}
            </select>
          </div>
          {list.length === 0 ? (
            <Empty icon={<Receipt />} title={t('ex.empty')} hint={t('ex.emptyHint')} action={<button className="btn btn-outline btn-sm" onClick={() => setModal({ open: true, expense: null })}><Plus />{t('ex.add')}</button>} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table rows-sm">
                  <thead>
                    <tr>
                      <th>{t('c.date')}</th>
                      <th>{t('ex.category')}</th>
                      <th>{t('c.notes')}</th>
                      <th className="num">{t('c.amount')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.slice(0, limit).map((e) => (
                      <tr key={e.id} className="click" onClick={() => setModal({ open: true, expense: e })}>
                        <td className="nowrap soft c-date">{date(e.date)}</td>
                        <td className="c-cat"><Chip plain>{t(`expCat.${e.category}` as DictKey)}</Chip></td>
                        <td className="c-note">
                          <div className="cell-main" style={{ whiteSpace: 'normal' }}>{e.staffId ? L.staff.get(e.staffId)?.name ?? '—' : e.note || '—'}</div>
                          <div className="cell-sub" style={{ whiteSpace: 'normal' }}>
                            {[e.staffId ? e.note : '', scope === 'all' ? L.branch.get(e.branchId)?.name : '', t(`method.${e.method}` as DictKey), `${t('ex.recordedBy')}: ${e.createdBy ?? '—'}`].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="num strong c-amt">−{money(e.amount)}</td>
                        <td className="right nowrap c-act">
                          <button className="icon-btn" title={t('c.edit')} aria-label={t('c.edit')} onClick={(ev) => { ev.stopPropagation(); setModal({ open: true, expense: e }) }}><Pencil /></button>
                          <button className="icon-btn" title={t('c.delete')} aria-label={t('c.delete')} onClick={(ev) => { ev.stopPropagation(); del(e) }}><Trash2 /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-foot row between">
                <span>{t('c.showing', { n: Math.min(limit, list.length), total: list.length })} · {t('c.total').toLowerCase()} <span className="num strong">{money(listTotal)}</span></span>
                {list.length > limit && <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + 60)}>{t('c.seeAll')}</button>}
              </div>
            </>
          )}
        </section>

        <section className="card" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h3>{t('ex.byCategory')}</h3><span className="sub">{moneyShort(m.expenses)}</span></div>
          <div className="card-body">
            {ranked.length === 0 ? <Empty title={t('c.noData')} /> : (
              <HBars
                format={moneyShort}
                rows={ranked.map((r) => ({
                  key: r.c,
                  label: t(`expCat.${r.c}` as DictKey),
                  value: r.value,
                  color: expenseColor(r.c),
                  sub: `${Math.round((r.value / (m.expenses || 1)) * 100)}%`,
                }))}
              />
            )}
          </div>
        </section>
      </div>

      <ExpenseModal open={modal.open} expense={modal.expense} onClose={() => setModal({ open: false, expense: null })} />
    </Page>
  )
}

/** Add or change one expense. */
export function ExpenseModal({ open, expense, onClose }: { open: boolean; expense: Expense | null; onClose: () => void }) {
  const { t, money } = useI18n()
  const { db, scope, upsert, user } = useStore()
  const methods = useMethods()
  const toast = useToast()
  const blank = (): Expense => ({
    id: '', branchId: scope !== 'all' ? scope : db.branches[0]?.id ?? '', date: todayStr(), category: 'rent', amount: 0,
    method: methods[0] ?? 'cash', note: '', createdAt: '',
  })
  const [x, setX] = useState<Expense>(blank)
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (!open) return
    setX(expense ? { ...expense } : blank())
    setTried(false)
  }, [open, expense])

  const staff = db.staff.filter((s) => s.branchId === x.branchId && (s.active || s.id === x.staffId))
  const pickStaff = (id: string) => {
    const s = db.staff.find((y) => y.id === id)
    setX({ ...x, staffId: id || undefined, amount: s && !x.amount ? s.salary : x.amount })
  }
  const save = () => {
    setTried(true)
    if (x.amount <= 0 || !x.date || !x.branchId) return
    upsert('expenses', {
      ...x,
      id: x.id || uid(),
      note: x.note?.trim() || undefined,
      staffId: x.category === 'salary' ? x.staffId : undefined,
      createdAt: x.createdAt || nowIso(),
      createdBy: x.createdBy || user?.name,
    })
    toast(expense ? t('c.saved') : t('ex.added'))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={expense ? t('ex.edit') : t('ex.add')} footer={<FormFooter onCancel={onClose} onSave={save} saveLabel={expense ? t('c.save') : t('c.add')} />}>
      <div className="form-grid">
        <Field label={t('ex.category')} htmlFor="ex-cat">
          <select id="ex-cat" className="select" value={x.category} onChange={(e) => setX({ ...x, category: e.target.value as ExpenseCategory })}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`expCat.${c}` as DictKey)}</option>)}
          </select>
        </Field>
        <Field label={t('c.date')} htmlFor="ex-date" error={tried && !x.date ? t('c.required') : undefined}>
          <input id="ex-date" type="date" className="input" value={x.date} max={todayStr()} onChange={(e) => setX({ ...x, date: e.target.value })} />
        </Field>
        <Field label={t('c.amount')} htmlFor="ex-amount" error={tried && x.amount <= 0 ? t('ex.amountRequired') : undefined}>
          <MoneyInput id="ex-amount" value={x.amount} onChange={(v) => setX({ ...x, amount: v })} invalid={tried && x.amount <= 0} />
        </Field>
        {scope === 'all' ? (
          <Field label={t('c.branch')} htmlFor="ex-branch">
            <select id="ex-branch" className="select" value={x.branchId} onChange={(e) => setX({ ...x, branchId: e.target.value, staffId: undefined })}>
              {db.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        ) : <span />}
        {x.category === 'salary' && (
          <Field label={`${t('ex.paidTo')} (${t('c.optional')})`} htmlFor="ex-staff" className="span-2" hint={t('ex.paidToHint')}>
            <select id="ex-staff" className="select" value={x.staffId ?? ''} onChange={(e) => pickStaff(e.target.value)}>
              <option value="">—</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(s.salary)}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('pay.method')} className="span-2">
          <MethodPicker value={x.method} onChange={(method) => setX((cur) => ({ ...cur, method }))} />
        </Field>
        <Field label={`${t('c.notes')} (${t('c.optional')})`} htmlFor="ex-note" className="span-2">
          <input id="ex-note" className="input" value={x.note ?? ''} placeholder={t('ex.notePh')} onChange={(e) => setX({ ...x, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}
