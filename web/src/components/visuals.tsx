// Elementos gráficos. Los sprites NO están en el repositorio: se cargan desde el repositorio
// público de PokéAPI (ver "Riesgos" en la especificación). Si no cargan, se dibuja un "orbe"
// propio generado a partir del número de Pokédex.
import { useState } from 'react'
import { spriteUrl, speciesHue } from '../theme'

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <path d="M7 3h14l6 6v17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="url(#lg)" />
      <rect x="9" y="6" width="11" height="7" rx="1.5" fill="var(--logo-ink)" opacity=".9" />
      <rect x="16" y="7.5" width="2.4" height="4" rx=".6" fill="url(#lg)" />
      <path d="M16 17.2l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="var(--logo-ink)" />
    </svg>
  )
}

/** Sprite del Pokémon con el orbe como respaldo (huevos, sin conexión o sprite inexistente). */
export function MonSprite({
  species,
  name,
  shiny,
  egg,
  size = 72,
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

  if (!url || failed === url) return <SpeciesOrb species={species} name={name} shiny={shiny} egg={egg} size={size} />

  return (
    <div
      className={`sprite${shiny ? ' sprite--shiny' : ''}${loaded === url ? ' sprite--loaded' : ''}`}
      style={{ width: size, height: size, ['--h' as string]: speciesHue(species) }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(url)}
        onError={() => setFailed(url)}
      />
      {shiny && <span className="orb__spark">✦</span>}
    </div>
  )
}

export function SpeciesOrb({
  species,
  name,
  shiny,
  egg,
  size = 72,
}: {
  species: number
  name: string
  shiny: boolean
  egg: boolean
  size?: number
}) {
  const h = speciesHue(species)
  const initials = egg ? '' : name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2)
  return (
    <div
      className={`orb${shiny ? ' orb--shiny' : ''}${egg ? ' orb--egg' : ''}`}
      style={{ width: size, height: size, ['--h' as string]: h }}
      aria-hidden="true"
    >
      <span className="orb__initials">{initials}</span>
      {shiny && <span className="orb__spark">✦</span>}
    </div>
  )
}

export function Icon({ name }: { name: 'lock' | 'layers' | 'shield' | 'upload' | 'download' | 'sun' | 'moon' | 'check' | 'alert' | 'refresh' }) {
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
