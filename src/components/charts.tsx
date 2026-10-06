import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { METHOD_GROUPS, methodGroupTotals } from '../data/analytics'
import type { PaymentMethod } from '../data/types'

/** Validated categorical order (gold, plum, jade, rose); color follows the entity, never its rank. */
export const SERIES = ['#b8862b', '#5e4a9e', '#2fa58a', '#c0405f']
export const seriesColor = (i: number) => SERIES[i % SERIES.length]
/** Neutral for folded "other" slices, deliberately lighter and greyer than every series colour. */
export const OTHER_COLOR = '#d3ccbf'

const axis = { fill: '#8a8374', fontSize: 11.5 }
const GRID = '#ece6da'

interface TipPayload { name?: string; value?: number; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: TipPayload[]; label?: string; fmt: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <b>{label}</b>
      {payload.map((p) => (
        <div className="tip-row" key={String(p.dataKey)}>
          <span>
            <i style={{ background: p.color }} />
            {p.name}
          </span>
          <strong>{fmt(Number(p.value ?? 0))}</strong>
        </div>
      ))}
    </div>
  )
}

export function AreaTrend({ data, name, height = 260, money = true }: { data: { label: string; value: number }[]; name: string; height?: number; money?: boolean }) {
  const { money: fmtMoney, compact, num } = useI18n()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="goldWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b8862b" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#b8862b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: '#dcd3c1' }} minTickGap={16} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (money ? compact(v) : num(v))} />
        <Tooltip cursor={{ stroke: '#b8862b', strokeWidth: 1 }} content={<Tip fmt={money ? fmtMoney : num} />} />
        <Area type="monotone" dataKey="value" name={name} stroke="#b8862b" strokeWidth={2} fill="url(#goldWash)" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#b8862b' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function Columns({ data, series, height = 260, money = true, stacked }: {
  data: Record<string, string | number>[]
  series: { key: string; name: string; color: string }[]
  height?: number
  money?: boolean
  stacked?: boolean
}) {
  const { money: fmtMoney, compact, num } = useI18n()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: '#dcd3c1' }} minTickGap={8} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={52} allowDecimals={false} tickFormatter={(v) => (money ? compact(v) : num(v))} />
        <Tooltip cursor={{ fill: 'rgba(184,134,43,0.07)' }} content={<Tip fmt={money ? fmtMoney : num} />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            maxBarSize={24}
            stackId={stacked ? 'a' : undefined}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
            stroke={stacked ? '#fff' : undefined}
            strokeWidth={stacked ? 1 : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.name}>
          <i style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  )
}

/** Horizontal bars in HTML: best for ranked categories with long labels. */
export function HBars({ rows, format, color = '#b8862b', max }: {
  rows: { key: string; label: ReactNode; value: number; sub?: ReactNode; color?: string }[]
  format: (n: number) => string
  color?: string
  max?: number
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.key} title={`${typeof r.label === 'string' ? r.label : ''} ${format(r.value)}`}>
          <span className="lbl">{r.label}</span>
          <span className="track">
            <span className="fill" style={{ display: 'block', width: `${Math.max(0.5, (r.value / top) * 100)}%`, background: r.color ?? color }} />
          </span>
          <span className="val">
            {format(r.value)}
            {r.sub != null && <small>{r.sub}</small>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** One 100% bar split into parts, with a 2px surface gap between segments. */
export function ShareBar({ parts, format }: { parts: { key: string; label: string; value: number; color: string }[]; format: (n: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div className="stack">
      <div className="stackbar" role="img" aria-label={parts.map((p) => `${p.label}: ${format(p.value)}`).join(', ')}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span key={p.key} style={{ width: `${(p.value / (total || 1)) * 100}%`, background: p.color }} title={`${p.label}: ${format(p.value)}`} />
          ))}
      </div>
      <div className="stack sm">
        {parts.map((p) => (
          <div className="row between" key={p.key} style={{ fontSize: 13 }}>
            <span className="row" style={{ gap: 8 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block' }} />
              <span className="soft">{p.label}</span>
            </span>
            <span className="num strong">
              {format(p.value)} <span className="muted">· {total ? Math.round((p.value / total) * 100) : 0}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface PieSlice {
  key: string
  label: string
  value: number
  color: string
}

/** Keeps at most four coloured slices; anything beyond folds into one neutral "other" slice. */
export function foldSlices(parts: PieSlice[], otherLabel: string): PieSlice[] {
  if (parts.length <= SERIES.length) return parts
  const kept = parts.slice(0, SERIES.length - 1)
  const rest = parts.slice(SERIES.length - 1)
  return [...kept, { key: 'other', label: otherLabel, value: rest.reduce((s, p) => s + p.value, 0), color: OTHER_COLOR }]
}

function PieTip({ active, payload, total, fmt }: { active?: boolean; payload?: { payload?: PieSlice }[]; total: number; fmt: (n: number) => string }) {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="chart-tip">
      <div className="tip-row">
        <span><i style={{ background: p.color }} />{p.label}</span>
        <strong>{fmt(p.value)}</strong>
      </div>
      <div className="tip-row"><span /> <span className="muted">{total ? Math.round((p.value / total) * 100) : 0}%</span></div>
    </div>
  )
}

/** Donut with the total in the middle and a legend that carries every value, so colour is never the only key. */
export function Donut({ parts, format, centerFormat, centerLabel, emptyLabel, size = 190 }: {
  parts: PieSlice[]
  format: (n: number) => string
  /** Shorter format for the number in the middle. */
  centerFormat?: (n: number) => string
  centerLabel: string
  emptyLabel: string
  size?: number
}) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const shown = parts.filter((p) => p.value > 0)
  return (
    <div className="donut">
      <div className="donut-chart" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {total > 0 ? (
              <Pie data={shown} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {shown.map((p) => <Cell key={p.key} fill={p.color} />)}
              </Pie>
            ) : (
              <Pie data={[{ key: 'empty', value: 1 }]} dataKey="value" innerRadius="66%" outerRadius="100%" stroke="none" fill="#efebe2" isAnimationActive={false} />
            )}
            {total > 0 && <Tooltip content={<PieTip total={total} fmt={format} />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span>{centerLabel}</span>
          <b>{(centerFormat ?? format)(total)}</b>
        </div>
      </div>
      <ul className="donut-legend">
        {total === 0 && <li className="muted">{emptyLabel}</li>}
        {total > 0 &&
          parts.map((p) => (
            <li key={p.key}>
              <i style={{ background: p.color }} />
              <span className="lbl">{p.label}</span>
              <span className="val num">{format(p.value)}</span>
              <span className="pct num">{Math.round((p.value / total) * 100)}%</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

const GROUP_LABEL: Record<(typeof METHOD_GROUPS)[number]['key'], DictKey> = {
  cash: 'method.cash',
  card: 'pay.group.card',
  mobile: 'pay.group.mobile',
  transfer: 'method.transfer',
}

/** Pie slices for money received, one fixed colour per payment group. */
export function useMethodSlices(byMethod: Record<PaymentMethod, number>): PieSlice[] {
  const { t } = useI18n()
  return methodGroupTotals(byMethod).map((g, i) => ({ key: g.key, label: t(GROUP_LABEL[g.key]), value: g.value, color: SERIES[i] }))
}
