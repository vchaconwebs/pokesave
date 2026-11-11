// Elementos gráficos. Los sprites NO están en el repositorio: se cargan desde el repositorio
// público de PokéAPI (ver "Riesgos" en la especificación). Si no cargan, se dibuja un "orbe"
// propio generado a partir del número de Pokédex. El resto (Poké Ball, Pokédex…) son
// dibujos propios en SVG/CSS.
import { useState, type CSSProperties } from 'react'
import type { TypeInfo } from '../types'
import { spriteUrl, speciesHue, typeColor, typeInk } from '../theme'

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".25" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="32" height="32" rx="9" fill="#e3242b" />
      <rect x="2" y="2" width="32" height="32" rx="9" fill="url(#logo-shine)" />
      <circle cx="13" cy="13" r="6.5" fill="#fff" />
      <circle cx="13" cy="13" r="4.6" fill="#29a8ff" />
      <circle cx="11.4" cy="11.4" r="1.6" fill="#fff" opacity=".85" />
      <circle cx="24" cy="9" r="2" fill="#ff6b6b" stroke="#7a0f17" strokeWidth=".8" />
      <circle cx="29" cy="9" r="2" fill="#ffd23f" stroke="#7a0f17" strokeWidth=".8" />
      <rect x="8" y="23" width="20" height="5" rx="2.5" fill="#7a0f17" opacity=".55" />
    </svg>
  )
}

/** Poké Ball dibujada a mano. `shake` la hace temblar como en una captura. */
export function PokeBall({ size = 48, shake = false, className = '' }: { size?: number; shake?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`pokeball${shake ? ' pokeball--shake' : ''} ${className}`}
    >
      <circle cx="50" cy="50" r="46" fill="#f4f4f4" />
      <path d="M4 50a46 46 0 0 1 92 0z" fill="#ee1b24" />
      <path d="M22 26a34 34 0 0 1 22-12" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="6" strokeLinecap="round" />
      <rect x="4" y="46" width="92" height="8" fill="#1d1f2b" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#1d1f2b" strokeWidth="6" />
      <circle cx="50" cy="50" r="15" fill="#f4f4f4" stroke="#1d1f2b" strokeWidth="6" />
      <circle cx="50" cy="50" r="7" fill="#fff" stroke="#d6d6d6" strokeWidth="2" className="pokeball__button" />
    </svg>
  )
}

export function TypeBadge({ type }: { type: TypeInfo }) {
  return (
    <span className="type" style={{ ['--t' as string]: typeColor(type.id), ['--t-ink' as string]: typeInk(type.id) } as CSSProperties}>
      {type.name}
    </span>
  )
}

/** Sprite del Pokémon sobre su plataforma, con el orbe como respaldo. */
export function MonSprite({
  species,
  name,
  shiny,
  egg,
  size = 96,
}: {
  species: number
  name: string
  shiny: boolean
  egg: boolean
  size?: number
}) {
  const url = egg ? null : spriteUrl(species, shiny)
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const still = !!url && !url.endsWith('.gif')

  return (
    <div className="stage" style={{ width: size, height: size }}>
      <span className="stage__platform" aria-hidden="true" />
      {!url || failed === url ? (
        <SpeciesOrb species={species} name={name} egg={egg} size={Math.round(size * 0.62)} />
      ) : (
        <img
          className={`stage__sprite${loaded === url ? ' is-loaded' : ''}${still ? ' stage__sprite--still' : ''}`}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(url)}
          onError={() => setFailed(url)}
        />
      )}
      {shiny && (
        <span className="stage__sparkles" aria-hidden="true">
          <i>✦</i>
          <i>✦</i>
          <i>✦</i>
        </span>
      )}
    </div>
  )
}

export function SpeciesOrb({ species, name, egg, size = 64 }: { species: number; name: string; egg: boolean; size?: number }) {
  const initials = egg ? '' : name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2)
  return (
    <div
      className={`orb${egg ? ' orb--egg' : ''}`}
      style={{ width: size, height: size, ['--h' as string]: speciesHue(species) } as CSSProperties}
      aria-hidden="true"
    >
      <span className="orb__initials">{initials}</span>
    </div>
  )
}

type IconName = 'lock' | 'layers' | 'shield' | 'upload' | 'download' | 'sun' | 'moon' | 'check' | 'alert' | 'refresh'

export function Icon({ name }: { name: IconName }) {
  const p = {
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
    shield: <><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
    upload: <><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
    download: <><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
  }[name]
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  )
}
