// SMS gateway for Oq Libos ERP: a small relay between the ERP in the browser and Eskiz.uz.
//
// Why it exists: the Eskiz password must not live in the browser, and Eskiz does not accept calls from web pages.
// This server keeps the Eskiz login, and the ERP sends it { to, text } with a key you choose.
//
// Needs Node.js 18 or newer, no packages. Settings come from environment variables:
//   ESKIZ_EMAIL      your Eskiz account email                     (required)
//   ESKIZ_PASSWORD   your Eskiz password / API secret             (required)
//   API_KEY          any long random string; the same one goes into ERP → Settings → SMS   (required)
//   ESKIZ_FROM       sender name approved by Eskiz, default "4546" (Eskiz's shared number)
//   ALLOW_ORIGIN     the ERP's address, e.g. https://erp.example.uz; default "*" (any site that knows the key)
//   PORT             default 8787
//
// Run:  ESKIZ_EMAIL=... ESKIZ_PASSWORD=... API_KEY=... node server/sms-gateway/index.mjs

import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'

// ESKIZ_URL only exists so the relay can be tried against a local stand-in.
const ESKIZ = (process.env.ESKIZ_URL || 'https://notify.eskiz.uz/api').replace(/\/+$/, '')
const PORT = Number(process.env.PORT || 8787)
const EMAIL = process.env.ESKIZ_EMAIL
const PASSWORD = process.env.ESKIZ_PASSWORD
const API_KEY = process.env.API_KEY
const FROM = process.env.ESKIZ_FROM || '4546'
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*'
// Eskiz tokens are valid for 30 days; log in again a little before that.
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000
const MAX_TEXT = 1000

if (!EMAIL || !PASSWORD || !API_KEY) {
  console.error('Missing settings. Set ESKIZ_EMAIL, ESKIZ_PASSWORD and API_KEY (see the top of this file).')
  process.exit(1)
}

let token = null
let tokenAt = 0

async function login() {
  const form = new FormData()
  form.set('email', EMAIL)
  form.set('password', PASSWORD)
  const res = await fetch(`${ESKIZ}/auth/login`, { method: 'POST', body: form })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.data?.token) throw new Error(body?.message || `Eskiz login failed (HTTP ${res.status})`)
  token = body.data.token
  tokenAt = Date.now()
  return token
}

async function currentToken(fresh = false) {
  if (!fresh && token && Date.now() - tokenAt < TOKEN_TTL_MS) return token
  return login()
}

/** 998XXXXXXXXX, or null when it isn't an Uzbek mobile number. */
function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  const full = digits.length === 9 ? `998${digits}` : digits
  return /^998\d{9}$/.test(full) ? full : null
}

/** Plain apostrophes, dashes and spaces keep a Latin text in the cheaper 160-character SMS encoding. */
function cleanText(text) {
  return String(text ?? '')
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/…/g, '...')
    .trim()
}

async function sendSms(to, text, from) {
  const attempt = async (bearer) => {
    const form = new FormData()
    form.set('mobile_phone', to)
    form.set('message', text)
    form.set('from', from || FROM)
    return fetch(`${ESKIZ}/message/sms/send`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}` }, body: form })
  }
  let res = await attempt(await currentToken())
  // The token expired or was revoked: log in once more and retry.
  if (res.status === 401) res = await attempt(await currentToken(true))
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message || `Eskiz HTTP ${res.status}`)
  return body
}

function keyMatches(given) {
  const a = Buffer.from(String(given ?? ''))
  const b = Buffer.from(API_KEY)
  return a.length === b.length && timingSafeEqual(a, b)
}

function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('Request too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Body must be JSON'))
      }
    })
    req.on('error', reject)
  })
}

const masked = (phone) => `${phone.slice(0, 5)}*****${phone.slice(-2)}`

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (req.method === 'GET' && path === '/health') return reply(res, 200, { ok: true })
  if (req.method !== 'POST' || path !== '/send') return reply(res, 404, { ok: false, error: 'Not found' })
  if (!keyMatches(req.headers['x-api-key'])) return reply(res, 401, { ok: false, error: 'Wrong API key' })

  let body
  try {
    body = await readJson(req)
  } catch (e) {
    return reply(res, 400, { ok: false, error: e.message })
  }
  const to = normalizePhone(body.to)
  const text = cleanText(body.text)
  if (!to) return reply(res, 400, { ok: false, error: 'Phone must be an Uzbek number: 998XXXXXXXXX' })
  if (!text) return reply(res, 400, { ok: false, error: 'Text is empty' })
  if (text.length > MAX_TEXT) return reply(res, 400, { ok: false, error: `Text is longer than ${MAX_TEXT} characters` })

  try {
    const result = await sendSms(to, text, typeof body.from === 'string' ? body.from.trim() : '')
    console.log(new Date().toISOString(), 'sent', masked(to), result?.status ?? '')
    return reply(res, 200, { ok: true, id: result?.id ?? null, status: result?.status ?? null })
  } catch (e) {
    console.warn(new Date().toISOString(), 'failed', masked(to), e.message)
    return reply(res, 502, { ok: false, error: e.message })
  }
})

server.listen(PORT, () => {
  console.log(`SMS gateway listening on http://localhost:${PORT}  (POST /send, GET /health)`)
})
