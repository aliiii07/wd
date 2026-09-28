import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarHeart, Coins, Inbox, Pencil, Phone, Plus, Trash2, UserCheck, UserRound } from 'lucide-react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { useLookups, useScoped, useStore } from '../data/store'
import { convertLead, moveLead } from '../data/actions'
import { nowIso } from '../lib/date'
import { uid } from '../lib/storage'
import type { Lead, LeadInterest, LeadSource, LeadStage } from '../data/types'
import { Page } from '../components/Layout'
import { SOURCES, useBranchChoice } from '../components/forms'
import { Chip, Field, FormFooter, Modal, MoneyInput, SearchInput, stageTone, useConfirm, useToast } from '../components/ui'

const STAGES: LeadStage[] = ['new', 'contacted', 'appointment', 'won', 'lost']

export default function Leads() {
  const { t, dateShort, moneyShort } = useI18n()
  const { mutate, remove, scope } = useStore()
  const scoped = useScoped()
  const L = useLookups()
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Lead | undefined>()
  const [open, setOpen] = useState(false)
  const [dragOver, setDragOver] = useState<LeadStage | null>(null)

  const s = q.trim().toLowerCase()
  const leads = scoped.leads
    .filter((l) => !s || l.name.toLowerCase().includes(s) || l.phone.replace(/\D/g, '').includes(s.replace(/\D/g, '') || '§'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const move = (id: string, stage: LeadStage) => mutate((d) => moveLead(d, id, stage))
  const convert = (l: Lead) => {
    const clientId = uid()
    mutate((d) => convertLead(d, l.id, clientId))
    toast(t('ld.converted'))
    nav(`/clients/${clientId}`)
  }
  const del = async (l: Lead) => {
    if (!(await confirm(t('c.confirmDelete'), { danger: true, confirmLabel: t('c.delete') }))) return
    remove('leads', l.id)
  }

  return (
    <Page title={t('ld.title')}>
      <div className="row between">
        <div style={{ flex: '1 1 260px', maxWidth: 360 }}><SearchInput value={q} onChange={setQ} placeholder={t('cl.searchPh')} /></div>
        <button className="btn btn-primary" onClick={() => { setEdit(undefined); setOpen(true) }}><Plus />{t('ld.add')}</button>
      </div>
      <div className="board">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.stage === stage)
          return (
            <section
              key={stage}
              className="column"
              style={dragOver === stage ? { borderColor: 'var(--gold)', background: 'var(--gold-soft)' } : undefined}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(null)
                const id = e.dataTransfer.getData('text/plain')
                if (id) move(id, stage)
              }}
            >
              <div className="column-head">
                <Chip tone={stageTone[stage]}>{t(`stage.${stage}` as DictKey)}</Chip>
                <span className="count num">{items.length}</span>
              </div>
              <div className="column-body">
                {items.length === 0 && <div className="muted small" style={{ textAlign: 'center', padding: 12 }}><Inbox size={18} /><br />{t('ld.empty')}</div>}
                {items.map((l) => (
                  <article key={l.id} className="k-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}>
                    <div className="row between nowrap-row">
                      <span className="k-title">{l.name}</span>
                      <span className="row nowrap-row" style={{ gap: 0 }}>
                        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('c.edit')} onClick={() => { setEdit(l); setOpen(true) }}><Pencil size={14} /></button>
                        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('c.delete')} onClick={() => del(l)}><Trash2 size={14} /></button>
                      </span>
                    </div>
                    <div className="k-meta">
                      <span className="num"><Phone />{l.phone}</span>
                      {l.weddingDate && <span><CalendarHeart />{dateShort(l.weddingDate)} {l.weddingDate.slice(0, 4)}</span>}
                      {l.budget ? <span><Coins />{moneyShort(l.budget)}</span> : null}
                      {l.staffId && <span><UserRound />{L.staff.get(l.staffId)?.name}</span>}
                    </div>
                    <div className="row" style={{ gap: 5 }}>
                      <Chip plain>{t(`source.${l.source}` as DictKey)}</Chip>
                      <Chip tone="gold" plain>{t(`interest.${l.interest}` as DictKey)}</Chip>
                      {scope === 'all' && <Chip plain>{L.branch.get(l.branchId)?.name}</Chip>}
                    </div>
                    {l.notes && <div className="soft small">{l.notes}</div>}
                    <div className="row" style={{ gap: 6 }}>
                      <select className="select" style={{ height: 31, fontSize: 12.5, flex: 1 }} value={l.stage} onChange={(e) => move(l.id, e.target.value as LeadStage)} aria-label={t('ld.moveTo')}>
                        {STAGES.map((x) => <option key={x} value={x}>{t(`stage.${x}` as DictKey)}</option>)}
                      </select>
                      {l.clientId ? (
                        <button className="btn btn-outline btn-sm" onClick={() => nav(`/clients/${l.clientId}`)}><UserCheck />{t('ld.openClient')}</button>
                      ) : stage !== 'lost' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => convert(l)}><UserCheck />{t('ld.convert')}</button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <LeadModal open={open} onClose={() => setOpen(false)} lead={edit} />
    </Page>
  )
}

function LeadModal({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: Lead }) {
  const { t } = useI18n()
  const { upsert } = useStore()
  const scoped = useScoped()
  const toast = useToast()
  const blank = (): Lead => ({ id: '', branchId: '', name: '', phone: '+998 ', source: 'instagram', interest: 'rent', stage: 'new', createdAt: '' })
  const [l, setL] = useState<Lead>(lead ?? blank())
  const [tried, setTried] = useState(false)
  const branch = useBranchChoice(lead?.branchId)
  useEffect(() => {
    if (open) {
      setL(lead ?? blank())
      setTried(false)
    }
  }, [open, lead])
  const branchId = lead?.branchId ?? branch.branchId
  const valid = l.name.trim().length > 1 && !!branchId
  const save = () => {
    setTried(true)
    if (!valid) return
    upsert('leads', { ...l, id: l.id || uid(), branchId, name: l.name.trim(), createdAt: l.createdAt || nowIso() })
    toast(t('c.saved'))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={lead ? t('c.edit') : t('ld.add')} footer={<FormFooter onCancel={onClose} onSave={save} />}>
      <div className="form-grid">
        <Field label={t('c.fullName')} htmlFor="ld-name" error={tried && l.name.trim().length < 2 ? t('c.required') : undefined}>
          <input id="ld-name" className="input" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} autoFocus />
        </Field>
        <Field label={t('c.phone')} htmlFor="ld-phone"><input id="ld-phone" className="input num" value={l.phone} onChange={(e) => setL({ ...l, phone: e.target.value })} /></Field>
        <Field label={t('cl.source')} htmlFor="ld-source">
          <select id="ld-source" className="select" value={l.source} onChange={(e) => setL({ ...l, source: e.target.value as LeadSource })}>
            {SOURCES.map((s) => <option key={s} value={s}>{t(`source.${s}` as DictKey)}</option>)}
          </select>
        </Field>
        <Field label={t('ld.interest')} htmlFor="ld-interest">
          <select id="ld-interest" className="select" value={l.interest} onChange={(e) => setL({ ...l, interest: e.target.value as LeadInterest })}>
            {(['rent', 'buy', 'undecided'] as LeadInterest[]).map((s) => <option key={s} value={s}>{t(`interest.${s}` as DictKey)}</option>)}
          </select>
        </Field>
        <Field label={t('ord.weddingDate')} htmlFor="ld-wedding"><input id="ld-wedding" type="date" className="input" value={l.weddingDate ?? ''} onChange={(e) => setL({ ...l, weddingDate: e.target.value || undefined })} /></Field>
        <Field label={t('ld.budget')} htmlFor="ld-budget"><MoneyInput id="ld-budget" value={l.budget ?? 0} onChange={(v) => setL({ ...l, budget: v || undefined })} /></Field>
        <Field label={t('ld.assigned')} htmlFor="ld-staff">
          <select id="ld-staff" className="select" value={l.staffId ?? ''} onChange={(e) => setL({ ...l, staffId: e.target.value || undefined })}>
            <option value="">{t('c.none')}</option>
            {scoped.staff.filter((s) => s.active && (!branchId || s.branchId === branchId)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        {branch.field}
        <Field label={t('c.notes')} htmlFor="ld-notes" className="span-2"><textarea id="ld-notes" className="textarea" value={l.notes ?? ''} onChange={(e) => setL({ ...l, notes: e.target.value })} /></Field>
      </div>
      {tried && !branchId && <div className="notice bad">{t('c.chooseBranch')}</div>}
    </Modal>
  )
}
