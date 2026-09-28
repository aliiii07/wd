import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, Bell, Building2, CalendarDays, CalendarHeart, ChevronsLeft, ChevronsRight, ClipboardList, Globe, Inbox,
  LayoutDashboard, LogOut, Menu, MessageSquare, Scissors, Settings, Shirt, UserCog, Users, Wallet,
} from 'lucide-react'
import { useI18n, LANGS } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useScoped, useStore } from '../data/store'
import { computeReminders } from '../data/reminders'
import { todayStr } from '../lib/date'
import { storage } from '../lib/storage'
import { Avatar } from './ui'
import type { Lang } from '../data/types'

interface Shell {
  openDrawer: () => void
  reminderCount: number
}
const ShellCtx = createContext<Shell>({ openDrawer: () => {}, reminderCount: 0 })

const NAV: { to: string; key: DictKey; icon: typeof LayoutDashboard; founderOnly?: boolean; group?: DictKey }[] = [
  { to: '/today', key: 'nav.today', icon: LayoutDashboard },
  { to: '/analytics', key: 'nav.analytics', icon: BarChart3 },
  { to: '/calendar', key: 'nav.calendar', icon: CalendarDays },
  { to: '/orders', key: 'nav.orders', icon: ClipboardList },
  { to: '/appointments', key: 'nav.appointments', icon: CalendarHeart },
  { to: '/clients', key: 'nav.clients', icon: Users },
  { to: '/leads', key: 'nav.leads', icon: Inbox },
  { to: '/products', key: 'nav.products', icon: Shirt },
  { to: '/alterations', key: 'nav.alterations', icon: Scissors },
  { to: '/payments', key: 'nav.payments', icon: Wallet },
  { to: '/staff', key: 'nav.staff', icon: UserCog },
  { to: '/notifications', key: 'nav.notifications', icon: MessageSquare },
  { to: '/branches', key: 'nav.branches', icon: Building2, founderOnly: true },
  { to: '/settings', key: 'nav.settings', icon: Settings },
]

const COLLAPSE_KEY = 'oqlibos.sidebar'

export function AppLayout() {
  const { t } = useI18n()
  const { db, user, isFounder, logout } = useStore()
  const scoped = useScoped()
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSE_KEY) === '1')
  const [drawer, setDrawer] = useState(false)
  const loc = useLocation()

  useEffect(() => setDrawer(false), [loc.pathname])

  const reminderCount = useMemo(
    () => computeReminders({ orders: scoped.orders, appointments: scoped.appointments, alterations: scoped.alterations, payments: scoped.payments, smsLog: db.smsLog }, todayStr()).length,
    [scoped, db.smsLog],
  )

  const toggle = () => {
    setCollapsed((c) => {
      storage.set(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  return (
    <ShellCtx.Provider value={{ openDrawer: () => setDrawer(true), reminderCount }}>
      <div className={`app ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer' : ''}`}>
        <aside className="sidebar" aria-label={t('nav.menu')}>
          <Link to="/today" className="brand">
            <span className="monogram">OL</span>
            <span className="hide-collapsed">
              <span className="brand-name">{db.settings.storeName}</span>
              <span className="brand-sub">Bridal ERP</span>
            </span>
          </Link>
          <nav className="nav">
            {NAV.filter((n) => !n.founderOnly || isFounder).map(({ to, key, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={t(key)}>
                <Icon />
                <span className="hide-collapsed">{t(key)}</span>
                {to === '/notifications' && reminderCount > 0 && <span className="nav-badge">{reminderCount}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            {user && (
              <div className="user-card">
                <Avatar name={user.name} dark />
                <div className="who hide-collapsed">
                  <b>{user.name}</b>
                  <span>{isFounder ? t('role.founder') : `${t('role.manager')} · ${db.branches.find((b) => b.id === user.branchId)?.name ?? ''}`}</span>
                </div>
              </div>
            )}
            <button className="collapse-btn" onClick={logout} title={t('auth.logout')}>
              <LogOut size={18} />
              <span className="hide-collapsed">{t('auth.logout')}</span>
            </button>
            <button className="collapse-btn desktop" onClick={toggle} title={t('nav.collapse')}>
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
              <span className="hide-collapsed">{t('nav.collapse')}</span>
            </button>
          </div>
        </aside>
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
        <div className="main">
          <Outlet />
        </div>
      </div>
    </ShellCtx.Provider>
  )
}

export interface PageTab {
  key: string
  label: ReactNode
  to?: string
}

export function Page({ title, crumb, tabs, active, onTab, children }: {
  title: ReactNode
  crumb?: ReactNode
  tabs?: PageTab[]
  active?: string
  onTab?: (key: string) => void
  children: ReactNode
}) {
  const { openDrawer } = useContext(ShellCtx)
  const { t } = useI18n()
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · Oq Libos ERP`
  }, [title])
  return (
    <>
      <header className="page-head">
        <div className="head-row">
          <button className="head-pill icon-pill menu-btn" onClick={openDrawer} aria-label={t('nav.menu')}>
            <Menu />
          </button>
          <div className="head-title">
            <h1>{title}</h1>
            {crumb && <span className="crumb">{crumb}</span>}
          </div>
          <HeaderControls />
        </div>
        {tabs ? (
          <div className="tabs" role="tablist">
            {tabs.map((tab) =>
              tab.to ? (
                <NavLink key={tab.key} to={tab.to} end className={({ isActive }) => `tab ${isActive || active === tab.key ? 'active' : ''}`}>
                  {tab.label}
                </NavLink>
              ) : (
                <button key={tab.key} role="tab" aria-selected={active === tab.key} className={`tab ${active === tab.key ? 'active' : ''}`} onClick={() => onTab?.(tab.key)}>
                  {tab.label}
                </button>
              ),
            )}
          </div>
        ) : (
          <div className="head-spacer" />
        )}
      </header>
      <main className="content">{children}</main>
    </>
  )
}

function HeaderControls() {
  const { t, lang, setLang } = useI18n()
  const { db, isFounder, scope, setScope, user } = useStore()
  const { reminderCount } = useContext(ShellCtx)
  return (
    <div className="head-controls">
      {isFounder ? (
        <span className="pill-wrap">
          <Building2 />
          <select id="scope" className="head-pill" value={scope} onChange={(e) => setScope(e.target.value)} aria-label={t('c.branch')}>
            <option value="all">{t('c.allBranches')}</option>
            {db.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {t('c.branch')}: {b.name}
              </option>
            ))}
          </select>
        </span>
      ) : (
        <span className="head-pill">
          <Building2 />
          {db.branches.find((b) => b.id === user?.branchId)?.name}
        </span>
      )}
      <LangSelect lang={lang} setLang={setLang} label={t('c.language')} />
      <Link to="/notifications" className="head-pill icon-pill" aria-label={t('nav.notifications')}>
        <Bell />
        {reminderCount > 0 && <span className="dot">{reminderCount}</span>}
      </Link>
    </div>
  )
}

export function LangSelect({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  const names: Record<Lang, string> = { uz: "O'zbek", ru: 'Русский', en: 'English' }
  return (
    <span className="pill-wrap">
      <Globe />
      <select id="lang" className="head-pill" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={label}>
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {names[l]}
          </option>
        ))}
      </select>
    </span>
  )
}
