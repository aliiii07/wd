import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { storage } from './storage'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

const KEY = 'oqlibos.theme'
const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

interface ThemeValue {
  mode: ThemeMode
  resolved: Resolved
  setMode: (m: ThemeMode) => void
  toggle: () => void
}

const Ctx = createContext<ThemeValue | null>(null)

/** Recolours the whole page at once, instead of letting every element's hover transition fade separately. */
export function swapColors(apply: () => void) {
  const root = document.documentElement
  root.dataset.switching = ''
  apply()
  void document.body?.offsetHeight
  window.setTimeout(() => delete root.dataset.switching, 50)
}

/** Light / dark per device; "system" follows the operating system. Sets `data-mode` on <html>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = storage.get(KEY)
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [systemDark, setSystemDark] = useState(() => !!query()?.matches)

  useEffect(() => {
    const mq = query()
    if (!mq) return
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolved: Resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    swapColors(() => {
      document.documentElement.dataset.mode = resolved
    })
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0e0d0c' : '#ffffff')
  }, [resolved])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    storage.set(KEY, m)
  }, [])
  const toggle = useCallback(() => setMode(resolved === 'dark' ? 'light' : 'dark'), [resolved, setMode])

  const value = useMemo(() => ({ mode, resolved, setMode, toggle }), [mode, resolved, setMode, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme outside ThemeProvider')
  return v
}
