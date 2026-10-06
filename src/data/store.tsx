import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Account, Collection, DB, ID, Platform, Shop } from './types'
import { createDemoShopDb, createPlatformSeed, createShopDb, DB_VERSION, DEMO_SHOP_ID, PLATFORM_VERSION } from './seed'
import { storage } from '../lib/storage'

// The platform registry (boutiques + logins) and each boutique's data are stored separately,
// so one boutique never loads another's records.
const PLATFORM_KEY = 'oqlibos.platform'
const SESSION_KEY = 'oqlibos.session'
const SCOPE_KEY = 'oqlibos.scope'
const LEGACY_KEY = 'oqlibos.db'
export const shopKey = (shopId: ID) => `oqlibos.shop.${shopId}`

export type Scope = ID | 'all'
export type LoginResult = 'ok' | 'invalid' | 'disabled'

function save(key: string, value: unknown) {
  const json = JSON.stringify(value)
  if (storage.get(key) !== json) storage.set(key, json)
}

function loadPlatform(): Platform {
  const raw = storage.get(PLATFORM_KEY)
  if (raw) {
    try {
      const p = JSON.parse(raw) as Platform
      if (p.version === PLATFORM_VERSION) return p
    } catch {
      /* corrupted — reseed */
    }
  }
  const seed = createPlatformSeed()
  storage.remove(LEGACY_KEY)
  save(PLATFORM_KEY, seed.platform)
  for (const [id, db] of Object.entries(seed.shops)) save(shopKey(id), db)
  return seed.platform
}

/** A boutique's data from storage; recreated (demo or empty) when missing or outdated. */
export function readShopDb(shop: Shop): DB {
  const raw = storage.get(shopKey(shop.id))
  if (raw) {
    try {
      const db = JSON.parse(raw) as DB
      if (db.version === DB_VERSION) return db
    } catch {
      /* fall through */
    }
  }
  const db = shop.id === DEMO_SHOP_ID ? createDemoShopDb(shop) : createShopDb(shop, [])
  save(shopKey(shop.id), db)
  return db
}

export function writeShopDb(shopId: ID, db: DB) {
  save(shopKey(shopId), db)
}

const EMPTY_DB = createShopDb({ id: '', name: '', createdAt: '', active: true }, [])

interface Session {
  accountId: ID | null
  shopId: ID | null
  db: DB
}

function sessionFor(platform: Platform, accountId: ID | null): Session {
  const account = platform.accounts.find((a) => a.id === accountId)
  const shop = account?.shopId ? platform.shops.find((s) => s.id === account.shopId) : undefined
  return { accountId: account?.id ?? null, shopId: shop?.id ?? null, db: shop ? readShopDb(shop) : EMPTY_DB }
}

interface StoreValue {
  platform: Platform
  /** Change logins and boutiques (platform admin, or a founder managing their boutique's logins). */
  mutatePlatform: (fn: (draft: Platform) => void) => void
  /** The signed-in boutique; undefined for the platform admin. */
  shop?: Shop
  db: DB
  user: Account | null
  isAdmin: boolean
  isFounder: boolean
  /** Effective branch filter: branch accounts are pinned to their branch. */
  scope: Scope
  setScope: (s: Scope) => void
  login: (email: string, password: string) => LoginResult
  logout: () => void
  /** Apply several changes at once on a copy of the boutique's data, then persist. */
  mutate: (fn: (draft: DB) => void) => void
  upsert: <K extends Collection>(col: K, item: DB[K][number]) => void
  remove: (col: Collection, id: ID) => void
  /** Regenerate the demo boutique's data. */
  resetDemo: () => void
  /** Regenerate the whole platform demo (admin). */
  resetPlatform: () => void
}

const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    const platform = loadPlatform()
    return { platform, session: sessionFor(platform, storage.get(SESSION_KEY)) }
  })
  const [platform, setPlatform] = useState<Platform>(initial.platform)
  const [session, setSession] = useState<Session>(initial.session)
  const [chosenScope, setChosenScope] = useState<Scope>(() => storage.get(SCOPE_KEY) ?? 'all')

  useEffect(() => save(PLATFORM_KEY, platform), [platform])
  useEffect(() => {
    if (session.shopId) save(shopKey(session.shopId), session.db)
  }, [session])

  // Another tab (e.g. a branch account in a second window) changed the data.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.newValue) return
      try {
        if (e.key === PLATFORM_KEY) setPlatform(JSON.parse(e.newValue))
        else if (session.shopId && e.key === shopKey(session.shopId)) {
          const db = JSON.parse(e.newValue) as DB
          setSession((s) => (s.shopId === session.shopId ? { ...s, db } : s))
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [session.shopId])

  const shop = session.shopId ? platform.shops.find((s) => s.id === session.shopId) : undefined
  const user = useMemo(() => {
    const a = platform.accounts.find((x) => x.id === session.accountId && x.active)
    if (!a) return null
    if (a.role !== 'admin' && !shop?.active) return null
    return a
  }, [platform.accounts, session.accountId, shop])
  const isAdmin = user?.role === 'admin'
  const isFounder = user?.role === 'founder'
  const db = session.db
  const scope: Scope = !user
    ? 'all'
    : isFounder
      ? chosenScope === 'all' || db.branches.some((b) => b.id === chosenScope) ? chosenScope : 'all'
      : user.branchId ?? 'all'

  const setScope = useCallback((s: Scope) => {
    setChosenScope(s)
    storage.set(SCOPE_KEY, s)
  }, [])

  const login = useCallback(
    (email: string, password: string): LoginResult => {
      const a = platform.accounts.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password)
      if (!a) return 'invalid'
      const s = a.shopId ? platform.shops.find((x) => x.id === a.shopId) : undefined
      if (!a.active || (a.role !== 'admin' && !s?.active)) return 'disabled'
      storage.set(SESSION_KEY, a.id)
      setSession(sessionFor(platform, a.id))
      return 'ok'
    },
    [platform],
  )

  const logout = useCallback(() => {
    storage.remove(SESSION_KEY)
    setSession({ accountId: null, shopId: null, db: EMPTY_DB })
  }, [])

  const mutate = useCallback((fn: (draft: DB) => void) => {
    setSession((s) => {
      if (!s.shopId) return s
      const draft = structuredClone(s.db)
      fn(draft)
      return { ...s, db: draft }
    })
  }, [])

  const mutatePlatform = useCallback((fn: (draft: Platform) => void) => {
    setPlatform((p) => {
      const draft = structuredClone(p)
      fn(draft)
      return draft
    })
  }, [])

  const upsert = useCallback(
    <K extends Collection>(col: K, item: DB[K][number]) =>
      mutate((d) => {
        const list = d[col] as { id: ID }[]
        const i = list.findIndex((x) => x.id === (item as { id: ID }).id)
        if (i >= 0) list[i] = item as { id: ID }
        else list.unshift(item as { id: ID })
      }),
    [mutate],
  )

  const remove = useCallback(
    (col: Collection, id: ID) =>
      mutate((d) => {
        const list = d[col] as { id: ID }[]
        const i = list.findIndex((x) => x.id === id)
        if (i >= 0) list.splice(i, 1)
      }),
    [mutate],
  )

  const resetDemo = useCallback(() => {
    if (!shop || shop.id !== DEMO_SHOP_ID) return
    setSession((s) => ({ ...s, db: createDemoShopDb(shop) }))
  }, [shop])

  const resetPlatform = useCallback(() => {
    const seed = createPlatformSeed()
    for (const s of platform.shops) storage.remove(shopKey(s.id))
    for (const [id, data] of Object.entries(seed.shops)) save(shopKey(id), data)
    setPlatform(seed.platform)
  }, [platform.shops])

  const value = useMemo<StoreValue>(
    () => ({ platform, mutatePlatform, shop, db, user, isAdmin, isFounder, scope, setScope, login, logout, mutate, upsert, remove, resetDemo, resetPlatform }),
    [platform, mutatePlatform, shop, db, user, isAdmin, isFounder, scope, setScope, login, logout, mutate, upsert, remove, resetDemo, resetPlatform],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}

/** Collections filtered to the current branch scope. */
export function useScoped() {
  const { db, scope } = useStore()
  return useMemo(() => {
    const f = <T extends { branchId: ID }>(arr: T[]) => (scope === 'all' ? arr : arr.filter((x) => x.branchId === scope))
    return {
      branches: scope === 'all' ? db.branches : db.branches.filter((b) => b.id === scope),
      products: f(db.products),
      clients: f(db.clients),
      appointments: f(db.appointments),
      orders: f(db.orders),
      payments: f(db.payments),
      staff: f(db.staff),
      documents: f(db.documents),
      smsLog: f(db.smsLog),
    }
  }, [db, scope])
}

/** Fast id → record lookups for rendering lists. */
export function useLookups() {
  const { db } = useStore()
  return useMemo(
    () => ({
      client: new Map(db.clients.map((x) => [x.id, x])),
      product: new Map(db.products.map((x) => [x.id, x])),
      type: new Map(db.productTypes.map((x) => [x.id, x])),
      staff: new Map(db.staff.map((x) => [x.id, x])),
      branch: new Map(db.branches.map((x) => [x.id, x])),
      order: new Map(db.orders.map((x) => [x.id, x])),
    }),
    [db],
  )
}
