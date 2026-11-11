// Fase 3 · Asistente de Pokédex (Blanco/Negro). Lógica pura, sin React, para poder probarla.
// Datos: public/data/bw.json (lo genera tools/build-bw-data.mjs a partir de PokéAPI).

export type Version = 'B' | 'W'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface BwLocation {
  key: string
  en: string
  es: string
  /** Medallas para llegar (aprox.); 9 = después de la Liga. */
  badges: number
}

/** [lugar, método, nivel mín., nivel máx., probabilidad %, versiones (1 Negro, 2 Blanco), condición]. */
export type RawEncounter = [number, string, number, number, number, number, string]

export interface BwEvolution {
  t: string
  lvl?: number
  item?: string
  held?: string
  with?: number
  happy?: number
  move?: string
  time?: string
}

export interface BwSpecies {
  enc?: RawEncounter[]
  from?: number
  evo?: BwEvolution
  event?: 1
  legend?: 1
  old?: 1
}

export interface BwData {
  version: number
  locations: BwLocation[]
  species: Record<string, BwSpecies>
}

export interface Encounter {
  location: BwLocation
  method: string
  min: number
  max: number
  chance: number
  season: Season | null
  /** Otras condiciones de PokéAPI (p. ej. encuentro especial). */
  note: string | null
  /** Medallas necesarias contando el método (Surf, Supercaña). */
  needs: number
  available: boolean
}

export type HowKind = 'wild' | 'evolve' | 'other-version' | 'event' | 'transfer' | 'unknown'

export interface How {
  kind: HowKind
  /** Encuentros en tu versión, los disponibles primero. */
  encounters: Encounter[]
  /** Si se consigue evolucionando: de qué especie y cómo. */
  evolveFrom?: number
  evolution?: BwEvolution
  /** La preevolución se puede conseguir ya (en estado salvaje o evolucionando). */
  preAvailable?: boolean
  /** ¿Se puede conseguir ya con tu progreso? */
  available: boolean
  /** Necesitas intercambiar (evolución por intercambio). */
  trade: boolean
}

export interface Progress {
  badges: number
  /** Ya has terminado la Liga. */
  postgame: boolean
}

/** ¿Este juego tiene asistente? De momento solo Blanco y Negro. */
export const assistantVersion = (gameId: string): Version | null => (gameId === 'W' ? 'W' : gameId === 'B' ? 'B' : null)

/** Medallas que pide cada método además del lugar. */
const METHOD_NEEDS: Record<string, number> = {
  surf: 6, // Surf (MO03) en el Monte Tuerca, tras la 6.ª medalla
  'surf-spots': 6,
  'super-rod': 9, // Supercaña: te la da Looker al terminar la Liga
  'super-rod-spots': 9,
}

/** Grupos de métodos para los filtros de la UI. */
export const METHOD_GROUP: Record<string, 'grass' | 'water' | 'fishing' | 'special'> = {
  walk: 'grass',
  'dark-grass': 'grass',
  'grass-spots': 'grass',
  'cave-spots': 'grass',
  'bridge-spots': 'grass',
  surf: 'water',
  'surf-spots': 'water',
  'super-rod': 'fishing',
  'super-rod-spots': 'fishing',
  gift: 'special',
  'gift-egg': 'special',
  static: 'special',
  'roaming-grass': 'special',
}

/** Estación de Blanco/Negro según el mes: cambia cada mes (ene primavera, feb verano…). */
export function seasonFor(date: Date): Season {
  return (['spring', 'summer', 'autumn', 'winter'] as const)[date.getMonth() % 4]
}

const level = (p: Progress) => (p.postgame ? 9 : Math.min(8, Math.max(0, p.badges)))

export function encountersFor(data: BwData, species: number, version: Version, progress: Progress, season: Season): Encounter[] {
  const bit = version === 'B' ? 1 : 2
  const info = data.species[species]
  const raw = info?.enc ?? []
  const lvl = level(progress)
  const list: Encounter[] = []
  for (const [loc, method, min, max, chance, v, cond] of raw) {
    if (!(v & bit)) continue
    const conds = cond ? cond.split('+') : []
    const seasonCond = conds.find((c) => c.startsWith('season-'))
    const encSeason = (seasonCond?.slice(7) as Season | undefined) ?? null
    // Un encuentro de otra estación no está "disponible" ahora, pero se muestra.
    const location = data.locations[loc]
    // Los legendarios fijos (Cobalion, Terrakion, Virizion, Landorus, Kyurem…) aparecen tras
    // la Liga. Zekrom/Reshiram en el Castillo de N son parte de la historia.
    const postLeagueLegend = info?.legend && method === 'static' && location.key !== 'ns-castle'
    const needs = Math.max(location.badges, METHOD_NEEDS[method] ?? 0, postLeagueLegend ? 9 : 0)
    const note = conds.filter((c) => !c.startsWith('season-')).join('+') || null
    list.push({
      location,
      method,
      min,
      max,
      chance,
      season: encSeason,
      note,
      needs,
      available: needs <= lvl && (encSeason === null || encSeason === season),
    })
  }
  // Disponibles primero, luego por medallas y por probabilidad.
  return list.sort((a, b) => Number(b.available) - Number(a.available) || a.needs - b.needs || b.chance - a.chance)
}

/** Cómo se consigue una especie en tu versión, con tu progreso. */
export function howToGet(data: BwData, species: number, version: Version, progress: Progress, season: Season, depth = 0): How {
  const info = data.species[species] ?? {}
  const encounters = encountersFor(data, species, version, progress, season)
  const trade = info.evo?.t === 'trade'

  if (info.event) {
    // Singulares (Victini, Genesect…) y los que solo salen por evento (Zorua).
    return { kind: 'event', encounters, available: false, trade: false }
  }
  if (encounters.length > 0) {
    // También se dice de qué evoluciona: a veces es más fácil que encontrarlo.
    return {
      kind: 'wild',
      encounters,
      available: encounters.some((e) => e.available),
      trade: false,
      evolveFrom: info.from,
      evolution: info.from ? info.evo : undefined,
    }
  }
  if (info.from && depth < 3) {
    const pre = howToGet(data, info.from, version, progress, season, depth + 1)
    if (pre.kind === 'wild' || pre.kind === 'evolve') {
      return {
        kind: 'evolve',
        encounters: [],
        evolveFrom: info.from,
        evolution: info.evo,
        preAvailable: pre.available,
        available: pre.available,
        trade,
      }
    }
  }
  const otherBit = version === 'B' ? 2 : 1
  if ((info.enc ?? []).some((e) => e[5] & otherBit)) {
    return { kind: 'other-version', encounters: [], available: false, trade: false }
  }
  if (info.old) {
    // De generaciones anteriores sin encuentros en Teselia: Pokétransfer o intercambio.
    return { kind: 'transfer', encounters: [], available: false, trade: false }
  }
  return { kind: 'unknown', encounters: [], available: false, trade: false }
}

/** Nombre del lugar en el idioma de la web. */
export const placeName = (loc: BwLocation, lang: string) => (lang === 'es' ? loc.es : loc.en)

/** Objetos de evolución (nombres de PokéAPI) en español. */
const ITEMS_ES: Record<string, string> = {
  'fire-stone': 'Piedra Fuego',
  'water-stone': 'Piedra Agua',
  'thunder-stone': 'Piedra Trueno',
  'leaf-stone': 'Piedra Hoja',
  'moon-stone': 'Piedra Lunar',
  'sun-stone': 'Piedra Solar',
  'shiny-stone': 'Piedra Día',
  'dusk-stone': 'Piedra Noche',
  'dawn-stone': 'Piedra Alba',
  'oval-stone': 'Piedra Oval',
  'kings-rock': 'Roca del Rey',
  'metal-coat': 'Revestimiento Metálico',
  'dragon-scale': 'Escamadragón',
  'up-grade': 'Mejora',
  'dubious-disc': 'Disco Extraño',
  protector: 'Protector',
  electirizer: 'Electrizador',
  magmarizer: 'Magmatizador',
  'reaper-cloth': 'Tela Terrible',
  'deep-sea-tooth': 'Diente Marino',
  'deep-sea-scale': 'Escama Marina',
  'razor-fang': 'Colmillo Agudo',
  'razor-claw': 'Garra Afilada',
  'prism-scale': 'Escama Bella',
}

export function itemName(slug: string, lang: string) {
  if (lang === 'es' && ITEMS_ES[slug]) return ITEMS_ES[slug]
  return slug
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

let cache: Promise<BwData> | null = null

/** Carga perezosa de los datos (~56 KB, solo al abrir el asistente). */
export function loadBwData(): Promise<BwData> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/bw.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`bw.json ${r.status}`)
      return r.json() as Promise<BwData>
    })
    .catch((err) => {
      cache = null
      throw err
    })
  return cache
}
