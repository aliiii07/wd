// Product artwork shown until a real photo is uploaded: a gown on a dress form, or an accessory drawing.
import { useId } from 'react'
import type { DressColor, Product, Silhouette } from '../data/types'
import { useFileUrl } from '../lib/files'

export const dressColorHex: Record<DressColor, string> = {
  white: '#fbfaf7', ivory: '#f6efdf', champagne: '#ead7b5', blush: '#eecfc8', silver: '#d9d9d6', gold: '#d9bb79', red: '#a9333f', other: '#cfc6b6',
}

function mix(hex: string, target: string, amount: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = p(hex)
  const b = p(target)
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('')}`
}

const SKIRTS: Record<Silhouette, string> = {
  a_line: 'M96 122 Q120 128 144 122 L188 272 Q120 288 52 272 Z',
  ball_gown: 'M96 122 Q120 128 144 122 Q206 186 216 272 Q120 294 24 272 Q34 186 96 122 Z',
  mermaid: 'M97 122 Q120 128 143 122 Q149 186 140 214 Q178 246 194 274 Q120 290 46 274 Q62 246 100 214 Q91 186 97 122 Z',
  sheath: 'M97 122 Q120 128 143 122 L151 276 Q120 283 89 276 Z',
  princess: 'M96 122 Q120 128 144 122 Q198 192 204 272 Q120 292 36 272 Q42 192 96 122 Z',
  empire: 'M94 104 Q120 110 146 104 Q178 188 184 274 Q120 288 56 274 Q62 188 94 104 Z',
  short: 'M96 122 Q120 128 144 122 Q172 160 180 192 Q120 206 60 192 Q68 160 96 122 Z',
  national: 'M93 112 Q120 118 147 112 L174 274 Q120 284 66 274 Z',
}

const HEM_Y: Record<Silhouette, number> = { a_line: 272, ball_gown: 272, mermaid: 274, sheath: 276, princess: 272, empire: 274, short: 192, national: 274 }
const HEM_X: Record<Silhouette, [number, number]> = {
  a_line: [52, 188], ball_gown: [24, 216], mermaid: [46, 194], sheath: [89, 151], princess: [36, 204], empire: [56, 184], short: [60, 180], national: [66, 174],
}

/** A gown on a dress form, tinted with the dress colour and shaped by its silhouette. */
export function DressArt({ color, style = 'a_line' }: { color: DressColor; style?: Silhouette }) {
  const uid = useId().replace(/:/g, '')
  const base = dressColorHex[color]
  const light = mix(base, '#ffffff', 0.55)
  const dark = mix(base, '#3b2f22', color === 'red' ? 0.35 : 0.16)
  const edge = mix(base, '#3b2f22', color === 'red' ? 0.5 : 0.3)
  const skirt = SKIRTS[style]
  const empire = style === 'empire'
  const waist = empire ? 104 : style === 'national' ? 112 : 122
  const [hx0, hx1] = HEM_X[style]
  const hemY = HEM_Y[style]
  const scallops = style === 'sheath' || style === 'short' ? 0 : Math.round((hx1 - hx0) / 11)
  const folds = style === 'sheath' ? [0.5] : [0.22, 0.42, 0.62, 0.8]
  return (
    <svg className="art" viewBox="0 0 240 300" aria-hidden="true">
      <defs>
        <linearGradient id={`f${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={light} />
          <stop offset="0.45" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`s${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${uid}`}>
          <path d={skirt} />
        </clipPath>
      </defs>
      <ellipse cx="120" cy={style === 'short' ? 286 : 283} rx={style === 'short' ? 46 : 96} ry="7" className="art-shadow" />
      {style === 'short' && (
        <g className="art-stand">
          <rect x="118" y="198" width="4" height="82" rx="2" />
          <rect x="96" y="278" width="48" height="5" rx="2.5" />
        </g>
      )}
      {/* dress form: neck cap and shoulders */}
      <g className="art-form">
        <rect x="112" y="40" width="16" height="10" rx="3" />
        <path d="M108 50 Q120 46 132 50 L134 62 Q120 58 106 62 Z" />
        <path d="M106 62 Q90 64 82 76 Q101 70 108 78 M134 62 Q150 64 158 76 Q139 70 132 78" fill="none" strokeWidth="1.4" />
      </g>
      {/* skirt */}
      <path d={skirt} fill={`url(#f${uid})`} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
      <g clipPath={`url(#c${uid})`}>
        {folds.map((t) => {
          const x = hx0 + (hx1 - hx0) * t
          return <path key={t} d={`M${120 + (x - 120) * 0.18} ${waist + 6} Q${120 + (x - 120) * 0.6} ${(waist + hemY) / 2} ${x} ${hemY}`} fill="none" stroke={edge} strokeOpacity="0.22" strokeWidth="1.1" />
        })}
        <path d={skirt} fill={`url(#s${uid})`} />
        {scallops > 0 && (
          <path
            d={Array.from({ length: scallops }, (_, i) => {
              const x = hx0 + i * ((hx1 - hx0) / scallops)
              const w = (hx1 - hx0) / scallops
              return `M${x} ${hemY - 2} q${w / 2} -9 ${w} 0`
            }).join(' ')}
            fill="none"
            stroke={edge}
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        )}
      </g>
      {/* bodice */}
      {empire ? (
        <path d="M96 86 Q107 78 120 90 Q133 78 144 86 L146 104 Q120 110 94 104 Z" fill={`url(#f${uid})`} stroke={edge} strokeWidth="1" />
      ) : style === 'national' ? (
        <path d="M100 72 Q120 80 140 72 L147 112 Q120 118 93 112 Z M100 72 L84 108 L92 110 L101 84 M140 72 L156 108 L148 110 L139 84" fill={`url(#f${uid})`} stroke={edge} strokeWidth="1" />
      ) : (
        <path d="M94 88 Q107 78 120 92 Q133 78 146 88 L144 122 Q120 128 96 122 Z" fill={`url(#f${uid})`} stroke={edge} strokeWidth="1" />
      )}
      {(style === 'sheath' || empire) && <path d="M101 70 L98 87 M139 70 L142 87" stroke={edge} strokeWidth="1.2" />}
      {/* waistband and a little sparkle on the bodice */}
      <path d={`M${empire ? 94 : 96} ${waist} Q120 ${waist + 6} ${empire ? 146 : 144} ${waist}`} fill="none" stroke={style === 'national' ? '#b8862b' : edge} strokeWidth={style === 'national' ? 2 : 1.4} strokeOpacity="0.7" />
      {style === 'national' && <path d="M72 230 L168 230 M70 250 L170 250" stroke="#b8862b" strokeWidth="2" strokeDasharray="5 4" strokeOpacity="0.8" />}
      <g fill="#ffffff" fillOpacity="0.75">
        <circle cx="110" cy="100" r="1.1" />
        <circle cx="127" cy="104" r="1" />
        <circle cx="118" cy="112" r="0.9" />
        <circle cx="134" cy="96" r="0.8" />
      </g>
    </svg>
  )
}

type AccessoryShape = 'veil' | 'shoe' | 'jewelry' | 'tiara' | 'petticoat' | 'other'
const ACCESSORY_BY_TYPE: Record<string, AccessoryShape> = { t4: 'veil', t5: 'shoe', t6: 'jewelry', t7: 'tiara', t8: 'petticoat' }

export function AccessoryArt({ typeId, color }: { typeId: string; color: DressColor }) {
  const uid = useId().replace(/:/g, '')
  const shape = ACCESSORY_BY_TYPE[typeId] ?? 'other'
  const base = color === 'white' || color === 'ivory' ? '#efe7d6' : dressColorHex[color]
  const metal = color === 'silver' ? '#bfc3c7' : '#c9a35a'
  const edge = mix(base, '#3b2f22', 0.35)
  return (
    <svg className="art" viewBox="0 0 240 300" aria-hidden="true">
      <defs>
        <linearGradient id={`a${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor={mix(base, '#ffffff', 0.5)} />
          <stop offset="1" stopColor={mix(base, '#3b2f22', 0.12)} />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="252" rx="70" ry="6" className="art-shadow" />
      {shape === 'veil' && (
        <g>
          <path d="M98 62 Q120 52 142 62" fill="none" stroke={metal} strokeWidth="5" strokeLinecap="round" />
          <path d="M100 64 Q66 140 58 246 Q120 262 182 246 Q174 140 140 64 Z" fill={`url(#a${uid})`} fillOpacity="0.55" stroke={edge} strokeOpacity="0.4" />
          <path d="M60 244 Q120 258 180 244" fill="none" stroke={edge} strokeOpacity="0.5" strokeDasharray="3 3" />
        </g>
      )}
      {shape === 'shoe' && (
        <g>
          <path d="M52 196 Q60 160 98 168 Q130 176 160 150 L176 150 Q184 178 176 206 L168 206 L166 186 Q140 204 110 210 Q70 216 52 196 Z" fill={`url(#a${uid})`} stroke={edge} />
          <path d="M168 206 L172 244 L178 244 L176 206" fill={edge} />
          <circle cx="104" cy="178" r="5" fill={metal} />
        </g>
      )}
      {shape === 'jewelry' && (
        <g fill="none" stroke={metal} strokeWidth="2.5">
          <path d="M66 90 Q120 176 174 90" />
          <path d="M120 133 L120 150" />
          <path d="M120 150 l9 14 l-9 14 l-9 -14 z" fill={metal} fillOpacity="0.6" />
          <circle cx="78" cy="208" r="8" fill={metal} fillOpacity="0.4" />
          <circle cx="162" cy="208" r="8" fill={metal} fillOpacity="0.4" />
          <path d="M78 186 L78 200 M162 186 L162 200" />
        </g>
      )}
      {shape === 'tiara' && (
        <g>
          <path d="M60 196 Q120 214 180 196 L170 156 L148 178 L134 128 L120 164 L106 128 L92 178 L70 156 Z" fill={metal} fillOpacity="0.85" stroke={mix(metal, '#3b2f22', 0.4)} />
          {[[106, 128], [134, 128], [70, 156], [170, 156], [120, 164]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill="#ffffff" stroke={mix(metal, '#3b2f22', 0.4)} />
          ))}
        </g>
      )}
      {shape === 'petticoat' && (
        <g>
          <path d="M100 70 L140 70 Q196 170 206 240 Q120 260 34 240 Q44 170 100 70 Z" fill={`url(#a${uid})`} fillOpacity="0.7" stroke={edge} strokeOpacity="0.6" />
          {[120, 160, 200, 234].map((y, i) => (
            <path key={y} d={`M${88 - i * 14} ${y} Q120 ${y + 10} ${152 + i * 14} ${y}`} fill="none" stroke={edge} strokeOpacity="0.45" />
          ))}
        </g>
      )}
      {shape === 'other' && (
        <g>
          <rect x="70" y="120" width="100" height="100" rx="4" fill={`url(#a${uid})`} stroke={edge} />
          <path d="M120 120 L120 220 M70 160 L170 160" stroke={metal} strokeWidth="5" />
          <path d="M120 120 Q100 96 92 112 Q100 126 120 120 Q140 96 148 112 Q140 126 120 120" fill="none" stroke={metal} strokeWidth="4" />
        </g>
      )}
    </svg>
  )
}

/** The product's cover photo when it has one, otherwise its artwork. */
export function ProductVisual({ product, kind, className = '' }: { product: Product; kind?: 'dress' | 'accessory'; className?: string }) {
  const url = useFileUrl(product.photos?.[0])
  const accessory = kind === 'accessory'
  return (
    <div className={`pv ${accessory ? 'pv-acc' : ''} ${className}`} style={{ ['--tint' as string]: dressColorHex[product.color] }}>
      {url ? (
        <img src={url} alt={product.name} loading="lazy" />
      ) : accessory ? (
        <AccessoryArt typeId={product.typeId} color={product.color} />
      ) : (
        <DressArt color={product.color} style={product.style} />
      )}
    </div>
  )
}
