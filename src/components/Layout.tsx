import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, Bell, Building2, CalendarDays, CalendarHeart, ChevronsLeft, ChevronsRight, ClipboardList, Globe, LayoutDashboard,
  LogOut, Menu, MessageSquare, Moon, Receipt, Settings, Shirt, Sun, UserCog, Users, Wallet,
} from 'lucide-react'
import { useI18n, LANGS } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useScoped, useStore } from '../data/store'
import { computeReminders } from '../data/reminders'
import { todayStr } from '../lib/date'
import { storage } from '../lib/storage'
import { initialsOf, PLATFORM } from '../lib/brand'
import { swapColors, useTheme } from '../lib/theme'
import { Avatar } from './ui'
import type { Lang } from '../data/types'

interface Shell {
  openDrawer: () => void
  reminderCount: number
}
const ShellCtx = createContext<Shell>({ openDrawer: () => {}, reminderCount: 0 })

type NavItem = { to: string; key: DictKey; icon: typeof LayoutDashboard; founderOnly?: boolean }
const NAV: { group: DictKey; items: NavItem[] }[] = [
  {
    group: 'nav.group.daily',
    items: [
      { to: '/today', key: 'nav.today', icon: LayoutDashboard },
      { to: '/calendar', key: 'nav.calendar', icon: CalendarDays },
      { to: '/appointments', key: 'nav.appointments', icon: CalendarHeart },
      { to: '/orders', key: 'nav.orders', icon: ClipboardList },
    ],
  },
  {
    group: 'nav.group.sales',
    items: [
      { to: '/clients', key: 'nav.clients', icon: Users },
      { to: '/products', key: 'nav.products', icon: Shirt },
      { to: '/payments', key: 'nav.payments', icon: Wallet },
      { to: '/notifications', key: 'nav.notifications', icon: MessageSquare },
    ],
  },
  {
    group: 'nav.group.manage',
    items: [
      { to: '/analytics', key: 'nav.analytics', icon: BarChart3 },
      { to: '/expenses', key: 'nav.expenses', icon: Receipt },
      { to: '/staff', key: 'nav.staff', icon: UserCog },
      { to: '/branches', key: 'nav.branches', icon: Building2, founderOnly: true },
      { to: '/settings', key: 'nav.settings', icon: Settings },
    ],
  },
]

const COLLAPSE_KEY = 'oqlibos.sidebar'

export function AppLayout() {
  const { t, lang, setLang } = useI18n()
  const { db, user, isFounder, logout } = useStore()
  const scoped = useScoped()
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSE_KEY) === '1')
  const [drawer, setDrawer] = useState(false)
  const loc = useLocation()

  // A new page starts at the top, like a normal website.
  useEffect(() => {
    setDrawer(false)
    window.scrollTo(0, 0)
  }, [loc.pathname])

  // The boutique's brand colour drives highlights across the app.
  useEffect(() => {
    swapColors(() => {
      document.documentElement.dataset.accent = db.settings.accent ?? 'gold'
    })
    return () => {
      document.documentElement.dataset.accent = 'gold'
    }
  }, [db.settings.accent])

  const reminderCount = useMemo(
    () => computeReminders({ orders: scoped.orders, appointments: scoped.appointments, payments: scoped.payments, smsLog: db.smsLog }, todayStr(), db.settings.sms).length,
    [scoped, db.smsLog, db.settings.sms],
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
            <span className="monogram">{initialsOf(db.settings.storeName)}</span>
            <span className="hide-collapsed">
              <span className="brand-name">{db.settings.storeName}</span>
              <span className="brand-sub">{PLATFORM.name}</span>
            </span>
          </Link>
          <nav className="nav">
            {NAV.map((section) => {
              const items = section.items.filter((n) => !n.founderOnly || isFounder)
              return (
                <div className="nav-section" key={section.group}>
                  <span className="nav-label hide-collapsed">{t(section.group)}</span>
                  {items.map(({ to, key, icon: Icon }) => (
                    <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={t(key)}>
                      <Icon />
                      <span className="hide-collapsed">{t(key)}</span>
                      {to === '/notifications' && reminderCount > 0 && <span className="nav-badge">{reminderCount}</span>}
                    </NavLink>
                  ))}
                </div>
              )
            })}
          </nav>
          <div className="sidebar-foot">
            <div className="sidebar-prefs">
              <LangSelect lang={lang} setLang={setLang} label={t('c.language')} />
              <ThemeToggle />
            </div>
            {user && (
              <div className="user-card">
                <Avatar name={user.name} dark />
                <div className="who hide-collapsed">
                  <b>{user.name}</b>
                  <span>{isFounder ? t('role.founder') : t('role.manager')}</span>
                </div>
              </div>
            )}
            <button className="collapse-btn" onClick={logout} title={t('auth.logout')}>
              <LogOut size={17} />
              <span className="hide-collapsed">{t('auth.logout')}</span>
            </button>
            <button className="collapse-btn desktop" onClick={toggle} title={t('nav.collapse')}>
              {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
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

export function Page({ title, crumb, tabs, active, onTab, actions, children }: {
  title: ReactNode
  crumb?: ReactNode
  tabs?: PageTab[]
  active?: string
  onTab?: (key: string) => void
  /** Buttons shown on the right of the title row. */
  actions?: ReactNode
  children: ReactNode
}) {
  const { openDrawer } = useContext(ShellCtx)
  const { t } = useI18n()
  const { db } = useStore()
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · ${db.settings.storeName}`
  }, [title, db.settings.storeName])
  return (
    <>
      <header className="page-head">
        <div className="head-bar">
          <button className="ctl ctl-icon menu-btn" onClick={openDrawer} aria-label={t('nav.menu')}>
            <Menu />
          </button>
          <span className="spacer" />
          <HeaderControls />
        </div>
        <div className="head-row">
          <div className="head-title">
            {crumb && <span className="crumb">{crumb}</span>}
            <h1>{title}</h1>
          </div>
          {actions && <div className="head-actions">{actions}</div>}
        </div>
        {tabs && (
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
        )}
      </header>
      <main className="content">{children}</main>
    </>
  )
}

export function ThemeToggle() {
  const { t } = useI18n()
  const { resolved, toggle } = useTheme()
  return (
    <button className="ctl ctl-icon" onClick={toggle} title={t('theme.toggle')} aria-label={t('theme.toggle')}>
      {resolved === 'dark' ? <Sun /> : <Moon />}
    </button>
  )
}

function HeaderControls() {
  const { t, lang, setLang } = useI18n()
  const { db, isFounder, scope, setScope, user } = useStore()
  const { reminderCount } = useContext(ShellCtx)
  return (
    <div className="head-controls">
      {isFounder ? (
        <span className="ctl-wrap">
          <Building2 />
          <select id="scope" className="ctl" value={scope} onChange={(e) => setScope(e.target.value)} aria-label={t('c.branch')}>
            <option value="all">{t('c.allBranches')}</option>
            {db.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </span>
      ) : (
        <span className="ctl ctl-static">
          <Building2 />
          {db.branches.find((b) => b.id === user?.branchId)?.name}
        </span>
      )}
      <span className="head-prefs">
        <LangSelect lang={lang} setLang={setLang} label={t('c.language')} />
        <ThemeToggle />
      </span>
      <Link to="/notifications" className="ctl ctl-icon" aria-label={t('nav.notifications')}>
        <Bell />
        {reminderCount > 0 && <span className="ctl-dot">{reminderCount}</span>}
      </Link>
    </div>
  )
}

export function LangSelect({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  const names: Record<Lang, string> = { uz: "O'zbek", ru: 'Русский', en: 'English' }
  return (
    <span className="ctl-wrap">
      <Globe />
      <select id="lang" className="ctl" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={label}>
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {names[l]}
          </option>
        ))}
      </select>
    </span>
  )
}
