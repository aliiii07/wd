// Getting a text to the client: through the boutique's SMS gateway, or by opening the phone's SMS app.
import type { SmsSettings } from '../data/types'

/** 998XXXXXXXXX, the format Uzbek SMS providers expect. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 9 ? `998${digits}` : digits
}

/** `sms:` link that opens the phone's messaging app with the text filled in (works on iOS and Android). */
export function smsLink(phone: string, text: string): string {
  return `sms:+${normalizePhone(phone)}?&body=${encodeURIComponent(text)}`
}

export function openSmsApp(phone: string, text: string) {
  window.location.href = smsLink(phone, text)
}

export interface SendResult {
  ok: boolean
  error?: string
}

/** POSTs one message to the gateway (see server/sms-gateway). The gateway holds the provider login. */
export async function sendViaGateway(cfg: SmsSettings, phone: string, text: string): Promise<SendResult> {
  if (!cfg.gatewayUrl.trim()) return { ok: false, error: 'No gateway address in Settings → SMS' }
  try {
    const res = await fetch(`${cfg.gatewayUrl.trim().replace(/\/+$/, '')}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': cfg.apiKey },
      body: JSON.stringify({ to: normalizePhone(phone), text, from: cfg.sender || undefined }),
    })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || body.ok === false) return { ok: false, error: body.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Swaps typographic characters for plain ones before sending: curly and Uzbek apostrophes (oʻ, gʻ), dashes and
 * no-break spaces. Any of them would make the provider bill a Latin text as Unicode, at 70 characters a part.
 */
export function cleanSmsText(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02bb\u02bc\u0060\u00b4]/g, "'")
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(/\u2026/g, '...')
    .trim()
}

/** SMS parts: 160 Latin characters per part, or 70 when Cyrillic or other Unicode is present. */
export function smsParts(raw: string): { parts: number; perPart: number } {
  const text = cleanSmsText(raw)
  const unicode = /[^\u0000-\u007f]/.test(text)
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  const len = text.length
  if (len <= single) return { parts: len ? 1 : 0, perPart: single }
  return { parts: Math.ceil(len / multi), perPart: multi }
}
