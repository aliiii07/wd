// localStorage can be missing or throw (private mode, sandboxed previews); the app must keep working in memory.
const memory = new Map<string, string>()

export const storage = {
  get(key: string): string | null {
    try {
      const v = window.localStorage.getItem(key)
      if (v !== null) return v
    } catch {
      /* fall through to memory */
    }
    return memory.get(key) ?? null
  },
  set(key: string, value: string) {
    memory.set(key, value)
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* memory copy is enough for this session */
    }
  },
  remove(key: string) {
    memory.delete(key)
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

export function uid(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  } catch {
    return Math.random().toString(36).slice(2, 14)
  }
}
