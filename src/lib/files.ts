// Photos and documents are kept in IndexedDB, which (unlike localStorage) has room for images and PDFs.
// When IndexedDB isn't available (some private windows), files live in memory for the session.
import { useEffect, useState } from 'react'
import { uid } from './storage'

const DB_NAME = 'oqlibos-files'
const STORE = 'files'
const memory = new Map<string, Blob>()
const urls = new Map<string, string>()
let opening: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return opening
}

export async function putFile(blob: Blob, id: string = uid()): Promise<string> {
  memory.set(id, blob)
  const db = await open()
  if (db) {
    await new Promise<void>((done) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, id)
      tx.oncomplete = () => done()
      tx.onerror = () => done()
    })
  }
  return id
}

export async function getFile(id: string): Promise<Blob | undefined> {
  const cached = memory.get(id)
  if (cached) return cached
  const db = await open()
  if (!db) return undefined
  return new Promise((done) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id)
    req.onsuccess = () => {
      const blob = req.result as Blob | undefined
      if (blob) memory.set(id, blob)
      done(blob)
    }
    req.onerror = () => done(undefined)
  })
}

export async function deleteFile(id: string) {
  memory.delete(id)
  const url = urls.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urls.delete(id)
  }
  const db = await open()
  if (db) db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
}

export async function fileUrl(id: string): Promise<string | undefined> {
  const known = urls.get(id)
  if (known) return known
  const blob = await getFile(id)
  if (!blob) return undefined
  const url = URL.createObjectURL(blob)
  urls.set(id, url)
  return url
}

/** Object URL for a stored file, or undefined while it loads / if it's gone. */
export function useFileUrl(id?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (id ? urls.get(id) : undefined))
  useEffect(() => {
    let alive = true
    if (!id) {
      setUrl(undefined)
      return
    }
    setUrl(urls.get(id))
    fileUrl(id).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [id])
  return url
}

/** Shrinks a photo to at most `max` px on its long side and re-encodes it as JPEG. */
export async function compressImage(file: File, max = 1600, quality = 0.86): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  const src = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = src
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(src)
  }
}

export async function downloadStoredFile(id: string, fileName: string) {
  const url = await fileUrl(id)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
