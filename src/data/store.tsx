import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Account, Collection, DB, ID } from './types'
import { createSeed, DB_VERSION } from './seed'
import { storage } from '../lib/storage'

const DB_KEY = 'oqlibos.db'
const SESSION_KEY = 'oqlibos.session'
const SCOPE_KEY = 'oqlibos.scope'

export type Scope = ID | 'all'

function loadDb(): DB {
  const raw = storage.get(DB_KEY)
  if (raw) {
    try {
      const db = JSON.parse(raw) as DB
      if (db.version === DB_VERSION) return db
    } catch {
      /* corrupted — reseed */
    }
  }
  const db = createSeed()
  storage.set(DB_KEY, JSON.stringify(db))
  return db
}

interface StoreValue {
  db: DB
  user: Account | null
  isFounder: boolean
  /** Effective branch filter: managers are pinned to their branch. */
  scope: Scope
  setScope: (s: Scope) => void
  login: (email: string, password: string) => boolean
  logout: () => void
  /** Apply several changes at once on a copy of the DB, then persist. */
  mutate: (fn: (draft: DB) => void) => void
  upsert: <K extends Collection>(col: K, item: DB[K][number]) => void
  remove: (col: Collection, id: ID) => void
  reset: () => void
}

const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDb)
  const [userId, setUserId] = useState<string | null>(() => storage.get(SESSION_KEY))
  const [chosenScope, setChosenScope] = useState<Scope>(() => storage.get(SCOPE_KEY) ?? 'all')
  const skipSave = useRef(true)

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    storage.set(DB_KEY, JSON.stringify(db))
  }, [db])

  // Another tab (e.g. the other branch's login) changed the data.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DB_KEY || !e.newValue) return
      try {
        skipSave.current = true
        setDb(JSON.parse(e.newValue))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const user = useMemo(() => db.accounts.find((a) => a.id === userId && a.active) ?? null, [db.accounts, userId])
  const isFounder = user?.role === 'founder'
  const scope: Scope = !user ? 'all' : isFounder ? (chosenScope === 'all' || db.branches.some((b) => b.id === chosenScope) ? chosenScope : 'all') : user.branchId ?? 'all'

  const setScope = useCallback((s: Scope) => {
    setChosenScope(s)
    storage.set(SCOPE_KEY, s)
  }, [])

  const login = useCallback(
    (email: string, password: string) => {
      const acc = db.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password && a.active)
      if (!acc) return false
      setUserId(acc.id)
      storage.set(SESSION_KEY, acc.id)
      return true
    },
    [db.accounts],
  )

  const logout = useCallback(() => {
    setUserId(null)
    storage.remove(SESSION_KEY)
  }, [])

  const mutate = useCallback((fn: (draft: DB) => void) => {
    setDb((prev) => {
      const draft = structuredClone(prev)
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

  const reset = useCallback(() => {
    const fresh = createSeed()
    setDb(fresh)
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ db, user, isFounder, scope, setScope, login, logout, mutate, upsert, remove, reset }),
    [db, user, isFounder, scope, setScope, login, logout, mutate, upsert, remove, reset],
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
      leads: f(db.leads),
      appointments: f(db.appointments),
      orders: f(db.orders),
      payments: f(db.payments),
      alterations: f(db.alterations),
      staff: f(db.staff),
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
