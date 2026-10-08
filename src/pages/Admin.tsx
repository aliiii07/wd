import { useEffect, useMemo, useState } from 'react'
import { Building2, KeyRound, LogOut, Pencil, Plus, RotateCcw, Store, Users } from 'lucide-react'
import { useI18n } from '../i18n'
import { readShopDb, useStore, writeShopDb } from '../data/store'
import { createShopDb } from '../data/seed'
import { metrics, periodRange, sliceFor } from '../data/analytics'
import { nowIso, todayStr } from '../lib/date'
import { uid } from '../lib/storage'
import { initialsOf, PLATFORM } from '../lib/brand'
import type { Account, Shop } from '../data/types'
import { LangSelect, ThemeToggle } from '../components/Layout'
import { Avatar, Chip, Empty, Field, FormFooter, Modal, Stat, useConfirm, useToast } from '../components/ui'

/** Console for the ERP owner: the boutiques on the platform and their founder logins. */
export default function Admin() {
  const { t, lang, setLang, moneyShort, money, date } = useI18n()
  const { platform, mutatePlatform, user, logout, resetPlatform } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const [edit, setEdit] = useState<Shop | undefined>()
  const [open, setOpen] = useState(false)
  const today = todayStr()

  useEffect(() => {
    document.title = `${t('adm.title')} · ${PLATFORM.name}`
  }, [t])

  const rows = useMemo(() => {
    const p = periodRange('thisMonth', today)
    return platform.shops.map((shop) => {
      const db = readShopDb(shop)
      return {
        shop,
        founder: platform.accounts.find((a) => a.shopId === shop.id && a.role === 'founder'),
        accounts: platform.accounts.filter((a) => a.shopId === shop.id).length,
        branches: db.branches.length,
        clients: db.clients.length,
        orders: db.orders.length,
        revenue: metrics(sliceFor(db, 'all'), p.from, p.to, today).revenue,
      }
    })
  }, [platform, today])

  const toggle = (shop: Shop, active: boolean) =>
    mutatePlatform((p) => {
      const x = p.shops.find((y) => y.id === shop.id)
      if (x) x.active = active
    })

  const reset = async () => {
    if (!(await confirm(t('adm.resetConfirm'), { danger: true, confirmLabel: t('adm.reset') }))) return
    resetPlatform()
    toast(t('c.saved'))
  }

  return (
    <div className="admin">
      <header className="page-head admin-head">
        <div className="head-bar">
          <span className="admin-brand">
            <span className="monogram">{PLATFORM.monogram}</span>
            <span>{PLATFORM.name}<small>{PLATFORM.product}</small></span>
          </span>
          <span className="spacer" />
          <div className="head-controls">
            <LangSelect lang={lang} setLang={setLang} label={t('c.language')} />
            <ThemeToggle />
            <span className="ctl ctl-static"><KeyRound />{user?.email}</span>
            <button className="ctl" onClick={logout}><LogOut />{t('auth.logout')}</button>
          </div>
        </div>
        <div className="head-row">
          <div className="head-title">
            <span className="crumb">{t('adm.hint')}</span>
            <h1>{t('adm.title')}</h1>
          </div>
          <div className="head-actions">
            <button className="btn btn-danger" onClick={reset}><RotateCcw />{t('adm.reset')}</button>
            <button className="btn btn-primary" onClick={() => { setEdit(undefined); setOpen(true) }}><Plus />{t('adm.addShop')}</button>
          </div>
        </div>
      </header>
      <main className="content">
        <div className="stats four">
          <Stat icon={<Store />} label={t('adm.shops')} value={platform.shops.length} hint={`${t('st.active')}: ${platform.shops.filter((s) => s.active).length}`} />
          <Stat icon={<Building2 />} label={t('nav.branches')} value={rows.reduce((s, r) => s + r.branches, 0)} />
          <Stat icon={<KeyRound />} label={t('br.accounts')} value={platform.accounts.filter((a) => a.role !== 'admin').length} />
          <Stat icon={<Users />} label={t('br.monthRevenue')} value={<span title={money(rows.reduce((s, r) => s + r.revenue, 0))}>{moneyShort(rows.reduce((s, r) => s + r.revenue, 0))}</span>} />
        </div>
        <section className="card">
          <div className="card-head">
            <h3><Store />{t('adm.shops')}</h3>
            <span className="sub">{t('adm.openShop')}</span>
          </div>
          {rows.length === 0 ? <Empty icon={<Store />} title={t('c.noData')} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('adm.shopName')}</th><th>{t('role.founder')}</th><th className="num">{t('nav.branches')}</th><th className="num">{t('br.accounts')}</th>
                    <th className="num">{t('nav.clients')}</th><th className="num">{t('nav.orders')}</th><th className="num">{t('br.monthRevenue')}</th><th>{t('adm.since')}</th><th>{t('c.status')}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.shop.id}>
                      <td><div className="person"><span className="avatar dark">{initialsOf(r.shop.name)}</span><span className="cell-main">{r.shop.name}</span></div></td>
                      <td>{r.founder ? <><div className="cell-main">{r.founder.name}</div><div className="cell-sub">{r.founder.email}</div></> : <span className="muted">{t('adm.noFounder')}</span>}</td>
                      <td className="num">{r.branches}</td>
                      <td className="num">{r.accounts}</td>
                      <td className="num">{r.clients}</td>
                      <td className="num">{r.orders}</td>
                      <td className="num">{money(r.revenue)}</td>
                      <td className="soft nowrap">{date(r.shop.createdAt.slice(0, 10))}</td>
                      <td>
                        <label className="check">
                          <input type="checkbox" checked={r.shop.active} onChange={(e) => toggle(r.shop, e.target.checked)} />
                          <Chip tone={r.shop.active ? 'good' : 'neutral'}>{r.shop.active ? t('st.active') : t('st.inactive')}</Chip>
                        </label>
                      </td>
                      <td className="right"><button className="icon-btn" title={t('c.edit')} onClick={() => { setEdit(r.shop); setOpen(true) }}><Pencil /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <ShopModal open={open} onClose={() => setOpen(false)} shop={edit} />
    </div>
  )
}

function ShopModal({ open, onClose, shop }: { open: boolean; onClose: () => void; shop?: Shop }) {
  const { t } = useI18n()
  const { platform, mutatePlatform } = useStore()
  const toast = useToast()
  const founder = shop ? platform.accounts.find((a) => a.shopId === shop.id && a.role === 'founder') : undefined
  const [name, setName] = useState('')
  const [founderName, setFounderName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [branch, setBranch] = useState('')
  const [tried, setTried] = useState(false)
  useEffect(() => {
    if (!open) return
    setName(shop?.name ?? '')
    setFounderName(founder?.name ?? '')
    setEmail(founder?.email ?? '')
    setPassword('')
    setBranch('')
    setTried(false)
  }, [open, shop, founder])

  const emailTaken = platform.accounts.some((a) => a.id !== founder?.id && a.email.toLowerCase() === email.trim().toLowerCase())
  const errors = {
    name: name.trim().length < 2 ? t('c.required') : '',
    founderName: founderName.trim().length < 2 ? t('c.required') : '',
    email: !/^\S+@\S+\.\S+$/.test(email.trim()) ? t('c.required') : emailTaken ? t('br.emailTaken') : '',
    password: (!shop || !founder) && password.length < 6 ? t('set.passwordShort') : password && password.length < 6 ? t('set.passwordShort') : '',
    branch: !shop && branch.trim().length < 2 ? t('c.required') : '',
  }

  const save = () => {
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const shopId = shop?.id ?? uid()
    const now = nowIso()
    const account: Account = {
      id: founder?.id ?? uid(),
      shopId,
      name: founderName.trim(),
      email: email.trim().toLowerCase(),
      password: password || founder?.password || '',
      role: 'founder',
      active: founder?.active ?? true,
    }
    if (!shop) {
      // A new boutique starts with one branch, the default product types and SMS templates.
      const created: Shop = { id: shopId, name: name.trim(), createdAt: now, active: true }
      writeShopDb(shopId, createShopDb(created, [{ id: uid(), name: branch.trim(), address: '', phone: '', createdAt: now }]))
      mutatePlatform((p) => {
        p.shops.push(created)
        p.accounts.push(account)
      })
      toast(t('adm.created'))
    } else {
      const db = readShopDb(shop)
      db.settings.storeName = name.trim()
      writeShopDb(shop.id, db)
      mutatePlatform((p) => {
        const s = p.shops.find((x) => x.id === shop.id)
        if (s) s.name = name.trim()
        const i = p.accounts.findIndex((x) => x.id === account.id)
        if (i >= 0) p.accounts[i] = account
        else p.accounts.push(account)
      })
      toast(t('c.saved'))
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={shop ? t('adm.editShop') : t('adm.addShop')} footer={<FormFooter onCancel={onClose} onSave={save} saveLabel={shop ? t('c.save') : t('c.create')} />}>
      <div className="form-grid">
        <Field label={t('adm.shopName')} htmlFor="sh-name" className="span-2" error={tried ? errors.name : undefined}>
          <input id="sh-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        {!shop && (
          <Field label={t('adm.firstBranch')} htmlFor="sh-branch" className="span-2" error={tried ? errors.branch : undefined}>
            <input id="sh-branch" className="input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={name ? `${name} 1` : ''} />
          </Field>
        )}
        <Field label={t('adm.founderName')} htmlFor="sh-founder" error={tried ? errors.founderName : undefined}>
          <input id="sh-founder" className="input" value={founderName} onChange={(e) => setFounderName(e.target.value)} />
        </Field>
        <Field label={t('adm.founderEmail')} htmlFor="sh-email" error={tried ? errors.email : undefined}>
          <input id="sh-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={shop && founder ? t('set.newPassword') : t('auth.password')} htmlFor="sh-pass" className="span-2" error={tried ? errors.password : undefined} hint={shop && founder ? t('c.optional') : undefined}>
          <input id="sh-pass" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </div>
      {founder && (
        <div className="person">
          <Avatar name={founder.name} dark />
          <span className="muted small">{t('role.founder')} · {founder.email}</span>
        </div>
      )}
    </Modal>
  )
}
