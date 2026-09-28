import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang, Localized } from '../data/types'
import { dict, monthNamesGen, monthShort, type DictKey } from './dict'
import { parseDate } from '../lib/date'
import { storage } from '../lib/storage'

export type Vars = Record<string, string | number>

export interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: DictKey, vars?: Vars) => string
  /** A user-entered localized name, falling back to Uzbek. */
  loc: (v: Localized) => string
  money: (n: number) => string
  moneyShort: (n: number) => string
  /** Compact number without currency, for chart axes. */
  compact: (n: number) => string
  num: (n: number) => string
  date: (s?: string) => string
  dateShort: (s?: string) => string
  dateTime: (iso: string) => string
}

const LANG_KEY = 'oqlibos.lang'
export const LANGS: Lang[] = ['uz', 'ru', 'en']

const Ctx = createContext<I18n | null>(null)

function interpolate(s: string, vars?: Vars) {
  if (!vars) return s
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? '').toString())
}

const group = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const currency: Record<Lang, string> = { uz: "so'm", ru: 'сум', en: 'UZS' }

export function formatMoney(n: number, lang: Lang): string {
  return lang === 'en' ? `${group(n).replace(/ /g, ',')} ${currency.en}` : `${group(n)} ${currency[lang]}`
}
const million: Record<Lang, string> = { uz: 'mln', ru: 'млн', en: 'M' }
const thousand: Record<Lang, string> = { uz: 'ming', ru: 'тыс', en: 'K' }
const billion: Record<Lang, string> = { uz: 'mlrd', ru: 'млрд', en: 'B' }

function compact(n: number, lang: Lang) {
  const abs = Math.abs(n)
  const fmt = (v: number, unit: string) => {
    const s = (Math.round(v * 10) / 10).toString().replace('.', lang === 'en' ? '.' : ',')
    return lang === 'en' ? `${s}${unit}` : `${s} ${unit}`
  }
  if (abs >= 1e9) return fmt(n / 1e9, billion[lang])
  if (abs >= 1e6) return fmt(n / 1e6, million[lang])
  if (abs >= 1e3) return fmt(n / 1e3, thousand[lang])
  return String(Math.round(n))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = storage.get(LANG_KEY)
    return saved === 'ru' || saved === 'en' || saved === 'uz' ? saved : 'uz'
  })

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    storage.set(LANG_KEY, l)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18n>(() => {
    const t = (key: DictKey, vars?: Vars) => {
      const e = dict[key] as { uz: string; ru: string; en: string } | undefined
      return interpolate(e ? e[lang] : key, vars)
    }
    const date = (s?: string) => {
      if (!s) return '—'
      const d = parseDate(s)
      const m = monthNamesGen[lang][d.getMonth()]
      if (lang === 'uz') return `${d.getDate()}-${m}, ${d.getFullYear()}`
      if (lang === 'ru') return `${d.getDate()} ${m} ${d.getFullYear()}`
      return `${d.getDate()} ${m} ${d.getFullYear()}`
    }
    const dateShort = (s?: string) => {
      if (!s) return '—'
      const d = parseDate(s)
      return `${d.getDate()} ${monthShort[lang][d.getMonth()].toLowerCase()}`
    }
    return {
      lang,
      setLang,
      t,
      loc: (v) => (v[lang] && v[lang]!.trim()) || v.uz,
      money: (n) => formatMoney(n, lang),
      compact: (n) => compact(n, lang),
      moneyShort: (n) => `${compact(n, lang)} ${lang === 'en' ? '' : currency[lang]}`.trim(),
      num: (n) => (lang === 'en' ? group(n).replace(/ /g, ',') : group(n)),
      date,
      dateShort,
      dateTime: (iso) => {
        const d = new Date(iso)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        return `${dateShort(iso.slice(0, 10) === iso ? iso : toLocalDate(d))}, ${hh}:${mm}`
      },
    }
  }, [lang, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
