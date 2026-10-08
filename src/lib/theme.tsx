import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { storage } from './storage'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

const KEY = 'oqlibos.theme'
const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

/** The system setting: the host page's own light/dark choice (data-theme on <html>) when it sets one, else the OS. */
function systemIsDark(): boolean {
  const forced = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined
  if (forced === 'dark' || forced === 'light') return forced === 'dark'
  return !!query()?.matches
}

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
  const [systemDark, setSystemDark] = useState(systemIsDark)

  useEffect(() => {
    const read = () => setSystemDark(systemIsDark())
    const mq = query()
    mq?.addEventListener('change', read)
    const host = new MutationObserver(read)
    host.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq?.removeEventListener('change', read)
      host.disconnect()
    }
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
