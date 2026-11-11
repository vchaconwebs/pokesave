// Fase 6 · Compartir el equipo. Lógica pura (sin React).
// - Enlace: el equipo va comprimido DENTRO de la URL, después de "#team=". El fragmento (#…)
//   no se envía nunca a ningún servidor: quien abre el enlace lo ve sin que el equipo pase por
//   GitHub Pages ni por ningún otro sitio.
// - Imagen: una tarjeta PNG dibujada en un canvas (sprites de PokéAPI, que permite CORS).
import type { PokemonInfo, SaveSummary } from './types'

/** Lo que viaja en el enlace: lo justo para dibujar el equipo, sin datos de la partida. */
export interface SharedTeam {
  v: 1
  /** Nombre del juego (ya traducido por quien comparte). */
  game: string
  gameId: string
  trainer: string
  mons: SharedMon[]
}

export interface SharedMon {
  s: number
  f?: number
  n: string
  l: number
  sh?: 1
  g?: number
  na?: string
  ab?: string
  it?: string
  ty: [number, string][]
  mv: [string, number][]
}

export function teamFromSave(save: SaveSummary): SharedTeam {
  return {
    v: 1,
    game: save.game,
    gameId: save.gameId,
    trainer: save.trainer.name,
    mons: save.party.filter((p) => !p.isEgg).map(monFromInfo),
  }
}

function monFromInfo(p: PokemonInfo): SharedMon {
  const m: SharedMon = {
    s: p.species,
    n: p.isNicknamed ? p.nickname : p.speciesName,
    l: p.level,
    ty: p.types.map((t) => [t.id, t.name]),
    mv: p.moves.map((x) => [x.name, x.type.id]),
  }
  if (p.form) m.f = p.form
  if (p.isShiny) m.sh = 1
  if (p.gender !== 2) m.g = p.gender
  if (p.nature) m.na = p.nature
  if (p.ability) m.ab = p.ability
  if (p.heldItem) m.it = p.heldItem
  return m
}

// ---------- Codificar en la URL ----------

const toBase64Url = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string) => {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** Equipo → texto para poner tras "#team=" (JSON comprimido con deflate y en base64url). */
export async function encodeTeam(team: SharedTeam): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(team))
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

/** Lo contrario. Devuelve null si el enlace está roto o no es un equipo. */
export async function decodeTeam(text: string): Promise<SharedTeam | null> {
  try {
    const json = await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'))
    const team = JSON.parse(new TextDecoder().decode(json)) as SharedTeam
    if (team?.v !== 1 || !Array.isArray(team.mons) || team.mons.length > 6) return null
    // Solo números y textos cortos: nada de lo que venga en el enlace se usa como HTML.
    const ok = team.mons.every((m) => Number.isInteger(m.s) && m.s > 0 && m.s <= 1025 && Number.isInteger(m.l) && typeof m.n === 'string' && m.n.length <= 24)
    return ok ? team : null
  } catch {
    return null
  }
}

export function teamLink(encoded: string, base = `${location.origin}${location.pathname}`) {
  return `${base}#team=${encoded}`
}

/** "#team=…" de la URL actual, si lo hay. */
export const teamFromHash = (hash = location.hash) => (hash.startsWith('#team=') ? hash.slice(6) : null)
