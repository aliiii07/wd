import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Building2, KeyRound, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useStore } from '../data/store'
import { metrics, periodRange, sliceFor } from '../data/analytics'
import { nowIso, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import type { Account, AccountRole, Branch } from '../data/types'
import { Page } from '../components/Layout'
import { Avatar, Chip, Field, FormFooter, Modal, useConfirm, useToast } from '../components/ui'
import { seriesColor } from '../components/charts'

export default function Branches() {
  const { t, moneyShort, money } = useI18n()
  const { db, user, shop, platform, setScope, remove, mutatePlatform } = useStore()
  const shopAccounts = platform.accounts.filter((a) => a.shopId === shop?.id)
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [branchEdit, setBranchEdit] = useState<Branch | undefined>()
  const [branchOpen, setBranchOpen] = useState(false)
  const [accEdit, setAccEdit] = useState<Account | undefined>()
  const [accOpen, setAccOpen] = useState(false)
  const today = todayStr()
  const p = periodRange('thisMonth', today)

  const hasData = (id: string) => db.products.some((x) => x.branchId === id) || db.orders.some((x) => x.branchId === id) || db.clients.some((x) => x.branchId === id)
  const delBranch = async (b: Branch) => {
    if (hasData(b.id)) return toast(t('br.inUse'), true)
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('branches', b.id)
    toast(t('c.deleted'))
  }
  const delAccount = async (a: Account) => {
    if (a.id === user?.id) return toast(t('br.lastYou'), true)
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    mutatePlatform((p) => {
      p.accounts = p.accounts.filter((x) => x.id !== a.id)
    })
    toast(t('c.deleted'))
  }

  return (
    <Page title={t('br.title')}>
      <div className="row between">
        <span className="muted">{t('br.accountsHint')}</span>
        <button className="btn btn-primary" onClick={() => { setBranchEdit(undefined); setBranchOpen(true) }}><Plus />{t('br.add')}</button>
      </div>
      <div className="grid g-2">
        {db.branches.map((b, i) => {
          const m = metrics(sliceFor(db, [b.id]), p.from, p.to, today)
          const staff = db.staff.filter((s) => s.branchId === b.id && s.active).length
          const accounts = shopAccounts.filter((a) => a.branchId === b.id)
          return (
            <section className="card" key={b.id}>
              <div className="card-head">
                <h3><i style={{ width: 10, height: 10, borderRadius: 3, background: seriesColor(i), display: 'inline-block' }} /><span className="display" style={{ fontSize: 24, fontWeight: 600 }}>{b.name}</span></h3>
                <div className="row" style={{ gap: 2 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setScope(b.id); nav('/analytics') }}><BarChart3 />{t('nav.analytics')}</button>
                  <button className="icon-btn" title={t('c.edit')} onClick={() => { setBranchEdit(b); setBranchOpen(true) }}><Pencil /></button>
                  {!hasData(b.id) && <button className="icon-btn" title={t('c.delete')} onClick={() => delBranch(b)}><Trash2 /></button>}
                </div>
              </div>
              <div className="card-body stack">
                <div className="stack sm soft small">
                  <span className="row" style={{ gap: 6 }}><MapPin size={14} />{b.address}</span>
                  <span className="row num" style={{ gap: 6 }}><Phone size={14} />{b.phone}</span>
                </div>
                <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                  <div className="stat" style={{ padding: 0 }}><span className="stat-label">{t('br.monthRevenue')}</span><span className="stat-value" style={{ fontSize: 20 }} title={money(m.revenue)}>{moneyShort(m.revenue)}</span></div>
                  <div className="stat" style={{ padding: 0 }}><span className="stat-label">{t('br.active')}</span><span className="stat-value" style={{ fontSize: 20 }}>{m.activeRentals}</span></div>
                  <div className="stat" style={{ padding: 0 }}><span className="stat-label">{t('br.dresses')}</span><span className="stat-value" style={{ fontSize: 20 }}>{m.dresses}</span></div>
                  <div className="stat" style={{ padding: 0 }}><span className="stat-label">{t('br.staff')}</span><span className="stat-value" style={{ fontSize: 20 }}>{staff}</span></div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <KeyRound size={15} className="gold" />
                  {accounts.length ? accounts.map((a) => <Chip key={a.id} tone={a.active ? 'gold' : 'neutral'} plain>{a.email}</Chip>) : <span className="muted small">—</span>}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <section className="card">
        <div className="card-head">
          <h3><KeyRound />{t('br.accounts')}</h3>
          <button className="btn btn-outline" onClick={() => { setAccEdit(undefined); setAccOpen(true) }}><Plus />{t('br.addAccount')}</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('c.fullName')}</th><th>{t('auth.email')}</th><th>{t('st.role')}</th><th>{t('c.branch')}</th><th>{t('c.status')}</th><th /></tr></thead>
            <tbody>
              {shopAccounts.map((a) => (
                <tr key={a.id}>
                  <td><div className="person"><Avatar name={a.name} dark={a.role === 'founder'} /><span className="cell-main">{a.name}</span></div></td>
                  <td className="num">{a.email}</td>
                  <td><Chip tone={a.role === 'founder' ? 'dark' : 'gold'}>{t(`role.${a.role}` as DictKey)}</Chip></td>
                  <td className="soft">{a.role === 'founder' ? t('c.allBranches') : db.branches.find((b) => b.id === a.branchId)?.name ?? '—'}</td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={a.active} disabled={a.id === user?.id}
                        onChange={(e) => mutatePlatform((p) => { const x = p.accounts.find((y) => y.id === a.id); if (x) x.active = e.target.checked })} />
                      {a.active ? t('st.active') : t('st.inactive')}
                    </label>
                  </td>
                  <td className="right nowrap">
                    <button className="icon-btn" title={t('c.edit')} onClick={() => { setAccEdit(a); setAccOpen(true) }}><Pencil /></button>
                    {a.id !== user?.id && <button className="icon-btn" title={t('c.delete')} onClick={() => delAccount(a)}><Trash2 /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <BranchModal open={branchOpen} onClose={() => setBranchOpen(false)} branch={branchEdit} />
      <AccountModal open={accOpen} onClose={() => setAccOpen(false)} account={accEdit} />
    </Page>
  )
}

function BranchModal({ open, onClose, branch }: { open: boolean; onClose: () => void; branch?: Branch }) {
  const { t } = useI18n()
  const { upsert } = useStore()
  const toast = useToast()
  const blank = (): Branch => ({ id: '', name: '', address: '', phone: '+998 ', createdAt: '' })
  const [b, setB] = useState<Branch>(branch ?? blank())
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (open) {
      setB(branch ?? blank())
      setTried(false)
    }
  }, [open, branch])
  const save = () => {
    setTried(true)
    if (!b.name.trim()) return
    upsert('branches', { ...b, id: b.id || uid(), name: b.name.trim(), createdAt: b.createdAt || nowIso() })
    toast(t('c.saved'))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={branch ? t('br.edit') : t('br.add')} footer={<FormFooter onCancel={onClose} onSave={save} />}>
      <Field label={t('c.name')} htmlFor="br-name" error={tried && !b.name.trim() ? t('c.required') : undefined}>
        <input id="br-name" className="input" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} autoFocus />
      </Field>
      <Field label={t('c.address')} htmlFor="br-address"><input id="br-address" className="input" value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} /></Field>
      <Field label={t('c.phone')} htmlFor="br-phone"><input id="br-phone" className="input num" value={b.phone} onChange={(e) => setB({ ...b, phone: e.target.value })} /></Field>
    </Modal>
  )
}

function AccountModal({ open, onClose, account }: { open: boolean; onClose: () => void; account?: Account }) {
  const { t } = useI18n()
  const { db, shop, platform, mutatePlatform } = useStore()
  const toast = useToast()
  const blank = (): Account => ({ id: '', shopId: shop?.id, name: '', email: '', password: '', role: 'manager', branchId: db.branches[0]?.id, active: true })
  const [a, setA] = useState<Account>(account ?? blank())
  const [password, setPassword] = useState('')
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (open) {
      setA(account ?? blank())
      setPassword('')
      setTried(false)
    }
  }, [open, account])
  // Emails are logins, so they must be unique across every boutique on the platform.
  const emailTaken = platform.accounts.some((x) => x.id !== a.id && x.email.toLowerCase() === a.email.trim().toLowerCase())
  const errors = {
    name: a.name.trim().length < 2 ? t('c.required') : '',
    email: !/^\S+@\S+\.\S+$/.test(a.email.trim()) ? t('c.required') : emailTaken ? t('br.emailTaken') : '',
    password: !account && password.length < 6 ? t('set.passwordShort') : password && password.length < 6 ? t('set.passwordShort') : '',
    branch: a.role === 'manager' && !a.branchId ? t('c.chooseBranch') : '',
  }
  const save = () => {
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const saved: Account = {
      ...a,
      id: a.id || uid(),
      shopId: shop?.id,
      name: a.name.trim(),
      email: a.email.trim().toLowerCase(),
      password: password || a.password,
      branchId: a.role === 'manager' ? a.branchId : undefined,
    }
    mutatePlatform((p) => {
      const i = p.accounts.findIndex((x) => x.id === saved.id)
      if (i >= 0) p.accounts[i] = saved
      else p.accounts.push(saved)
    })
    toast(t('c.saved'))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={account ? t('br.editAccount') : t('br.addAccount')} footer={<FormFooter onCancel={onClose} onSave={save} />}>
      <div className="form-grid">
        <Field label={t('c.fullName')} htmlFor="ac-name" error={tried ? errors.name : undefined}><input id="ac-name" className="input" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} autoFocus /></Field>
        <Field label={t('auth.email')} htmlFor="ac-email" error={tried ? errors.email : undefined}><input id="ac-email" className="input" type="email" value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })} /></Field>
        <Field label={account ? t('set.newPassword') : t('auth.password')} htmlFor="ac-pass" error={tried ? errors.password : undefined} hint={account ? t('c.optional') : undefined}>
          <input id="ac-pass" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('st.role')} htmlFor="ac-role">
          <select id="ac-role" className="select" value={a.role} onChange={(e) => setA({ ...a, role: e.target.value as AccountRole })}>
            <option value="manager">{t('role.manager')}</option>
            <option value="founder">{t('role.founder')}</option>
          </select>
        </Field>
        {a.role === 'manager' && (
          <Field label={t('c.branch')} htmlFor="ac-branch" error={tried ? errors.branch : undefined}>
            <select id="ac-branch" className="select" value={a.branchId ?? ''} onChange={(e) => setA({ ...a, branchId: e.target.value || undefined })}>
              <option value="">{t('c.select')}</option>
              {db.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="notice"><Building2 />{t('br.accountsHint')}</div>
    </Modal>
  )
}
