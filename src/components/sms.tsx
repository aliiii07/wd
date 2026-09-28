import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { useI18n } from '../i18n'
import { useStore } from '../data/store'
import { logSms } from '../data/actions'
import type { Client } from '../data/types'
import { Field, FormFooter, Modal, useToast } from './ui'

/** Free-text SMS to one client; logged to SMS history until a gateway is connected. */
export function SmsComposeModal({ open, onClose, client }: { open: boolean; onClose: () => void; client?: Client }) {
  const { t } = useI18n()
  const { mutate, user } = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])
  if (!client) return null
  const send = () => {
    if (!text.trim()) return
    mutate((d) => logSms(d, [{ branchId: client.branchId, clientId: client.id, phone: client.phone, type: 'custom', text: text.trim(), sentBy: user?.name }]))
    toast(t('nt.sentN', { n: 1 }))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={t('nt.custom')} size="narrow" footer={<FormFooter onCancel={onClose} onSave={send} saveLabel={t('c.send')} disabled={!text.trim()} />}>
      <Field label={t('nt.recipient')}>
        <div className="strong">{client.name} · <span className="num">{client.phone}</span></div>
      </Field>
      <Field label={t('nt.preview')} htmlFor="sms-text" hint={`${text.length} / 160`}>
        <textarea id="sms-text" className="textarea" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </Field>
      <div className="notice"><Info />{t('nt.gatewayNote')}</div>
    </Modal>
  )
}
