import { useState } from 'react'
import { Download, ExternalLink, FileText, Paperclip, Plus, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { useStore } from '../data/store'
import { addDocument, removeDocument } from '../data/actions'
import type { DocFile, ID } from '../data/types'
import { deleteFile, downloadStoredFile, formatBytes, getFile, putFile, useFileUrl } from '../lib/files'
import { nowIso } from '../lib/date'
import { uid } from '../lib/storage'
import { CAN_DOWNLOAD, CAN_EMBED_FILES } from '../lib/env'
import { Empty, Field, FormFooter, Modal, useConfirm, useToast } from './ui'

/** Files on a client's or staff member's profile: a name you choose (e.g. "Agreement") plus the file itself. */
export function DocumentsCard({ ownerType, ownerId, branchId }: { ownerType: DocFile['ownerType']; ownerId: ID; branchId: ID }) {
  const { t, dateTime } = useI18n()
  const { db, mutate } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const docs = db.documents.filter((d) => d.ownerType === ownerType && d.ownerId === ownerId)

  const [viewing, setViewing] = useState<DocFile | null>(null)
  const ensure = async (doc: DocFile) => {
    if (await getFile(doc.fileId)) return true
    toast(t('doc.missing'), true)
    return false
  }
  const view = async (doc: DocFile) => (await ensure(doc)) && setViewing(doc)
  const del = async (doc: DocFile) => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    mutate((d) => removeDocument(d, doc.id))
    deleteFile(doc.fileId)
    toast(t('c.deleted'))
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3><Paperclip />{t('doc.title')}</h3>
        <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}><Plus />{t('doc.add')}</button>
      </div>
      {docs.length === 0 ? (
        <Empty icon={<FileText />} title={t('doc.empty')} hint={t('doc.hint')} />
      ) : (
        <div className="list">
          {docs.map((doc) => (
            <div className="list-row" key={doc.id}>
              <span className="doc-icon"><FileText /></span>
              <div className="grow">
                <button className="title link" onClick={() => view(doc)}>{doc.name}</button>
                <div className="meta">{doc.fileName} · {formatBytes(doc.size)} · {dateTime(doc.uploadedAt)}</div>
              </div>
              <div className="row nowrap-row" style={{ gap: 2 }}>
                <button className="icon-btn" title={t('doc.open')} aria-label={t('doc.open')} onClick={() => view(doc)}><ExternalLink /></button>
                {CAN_DOWNLOAD && (
                  <button className="icon-btn" title={t('doc.download')} aria-label={t('doc.download')} onClick={async () => (await ensure(doc)) && downloadStoredFile(doc.fileId, doc.fileName)}><Download /></button>
                )}
                <button className="icon-btn" title={t('c.delete')} aria-label={t('c.delete')} onClick={() => del(doc)}><Trash2 /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AddDocumentModal open={open} onClose={() => setOpen(false)} ownerType={ownerType} ownerId={ownerId} branchId={branchId} />
      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
    </section>
  )
}

/** Shows a stored document inside the app: pictures and PDFs inline, anything else as a download. */
function DocumentViewer({ doc, onClose }: { doc: DocFile | null; onClose: () => void }) {
  const { t } = useI18n()
  const url = useFileUrl(doc?.fileId)
  if (!doc) return null
  const isImage = doc.mime.startsWith('image/')
  const inline = CAN_EMBED_FILES && (doc.mime === 'application/pdf' || doc.mime.startsWith('text/'))
  return (
    <Modal
      open
      onClose={onClose}
      title={doc.name}
      size="wide"
      footer={
        <>
          <span className="muted small">{doc.fileName} · {formatBytes(doc.size)}</span>
          <span className="spacer" />
          {url && CAN_EMBED_FILES && <a className="btn btn-outline" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('doc.newTab')}</a>}
          {CAN_DOWNLOAD && <button className="btn btn-primary" onClick={() => downloadStoredFile(doc.fileId, doc.fileName)}><Download />{t('doc.download')}</button>}
        </>
      }
    >
      {!url ? null : isImage ? (
        <img className="doc-view-img" src={url} alt={doc.name} />
      ) : inline ? (
        <iframe className="doc-view" src={url} title={doc.name} />
      ) : (
        <Empty icon={<FileText />} title={doc.fileName} hint={t(CAN_EMBED_FILES ? 'doc.noPreview' : 'doc.previewOnly')} />
      )}
    </Modal>
  )
}

function AddDocumentModal({ open, onClose, ownerType, ownerId, branchId }: { open: boolean; onClose: () => void; ownerType: DocFile['ownerType']; ownerId: ID; branchId: ID }) {
  const { t } = useI18n()
  const { mutate, user } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const reset = () => {
    setName('')
    setFile(null)
    setTried(false)
  }
  const close = () => {
    reset()
    onClose()
  }
  const save = async () => {
    setTried(true)
    if (!file) return
    setBusy(true)
    const fileId = await putFile(file)
    const doc: DocFile = {
      id: uid(), ownerType, ownerId, branchId, name: name.trim() || file.name.replace(/\.[^.]+$/, ''), fileName: file.name,
      mime: file.type || 'application/octet-stream', size: file.size, fileId, uploadedAt: nowIso(), uploadedBy: user?.name,
    }
    mutate((d) => addDocument(d, doc))
    setBusy(false)
    toast(t('doc.added'))
    close()
  }
  return (
    <Modal open={open} onClose={close} title={t('doc.add')} size="narrow" footer={<FormFooter onCancel={close} onSave={save} disabled={busy} saveLabel={t('c.add')} />}>
      <Field label={t('doc.name')} htmlFor="doc-name">
        <input id="doc-name" className="input" value={name} placeholder={t('doc.namePh')} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label={t('doc.file')} htmlFor="doc-file" error={tried && !file ? t('doc.choose') : undefined} hint={file ? `${file.name} · ${formatBytes(file.size)}` : t('doc.hint')}>
        <label className="file-drop" htmlFor="doc-file">
          <Paperclip />
          <span>{file ? file.name : t('doc.choose')}</span>
          <input id="doc-file" type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </Field>
    </Modal>
  )
}
