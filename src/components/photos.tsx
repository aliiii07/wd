import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { compressImage, putFile, useFileUrl } from '../lib/files'

/** Compresses and stores picked images; returns their file ids. */
export async function storeImages(files: FileList | File[]): Promise<string[]> {
  const ids: string[] = []
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue
    ids.push(await putFile(await compressImage(f)))
  }
  return ids
}

function Thumb({ id, cover, onCover, onRemove }: { id: string; cover: boolean; onCover: () => void; onRemove: () => void }) {
  const { t } = useI18n()
  const url = useFileUrl(id)
  return (
    <figure className={`thumb ${cover ? 'is-cover' : ''}`}>
      {url ? <img src={url} alt="" /> : <span className="thumb-wait" />}
      {cover && <figcaption>{t('ph.cover')}</figcaption>}
      <div className="thumb-actions">
        {!cover && (
          <button type="button" className="icon-btn" onClick={onCover} title={t('ph.makeCover')} aria-label={t('ph.makeCover')}>
            <Star />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onRemove} title={t('c.delete')} aria-label={t('c.delete')}>
          <Trash2 />
        </button>
      </div>
    </figure>
  )
}

/** Photo list with upload, "make cover" and remove. The first photo is the cover. */
export function PhotoManager({ photos, onChange, id = 'photos' }: { photos: string[]; onChange: (ids: string[]) => void; id?: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const ids = await storeImages(files)
    onChange([...photos, ...ids])
    setBusy(false)
    if (input.current) input.current.value = ''
  }
  return (
    <div className="stack sm">
      <div className="photos">
        {photos.map((p, i) => (
          <Thumb
            key={p}
            id={p}
            cover={i === 0}
            onCover={() => onChange([p, ...photos.filter((x) => x !== p)])}
            onRemove={() => onChange(photos.filter((x) => x !== p))}
          />
        ))}
        <label className="photo-add" htmlFor={id}>
          {busy ? <Loader2 className="spin" /> : <ImagePlus />}
          <span>{t('ph.add')}</span>
          <input ref={input} id={id} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
        </label>
      </div>
      <span className="muted small">{t('ph.hint')}</span>
    </div>
  )
}
