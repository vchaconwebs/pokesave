// Asistente de Pokédex. Lógica pura, sin React, para poder probarla.
// Datos:
// - Blanco/Negro: public/data/bw.json (tools/build-bw-data.mjs, PokéAPI + correcciones): con
//   medallas por lugar, estaciones y probabilidades.
// - Resto de juegos: public/data/games/<grupo>.json (tools/PokeSave.DataBuilder, tablas de
//   encuentros de PKHeX): lugar, método, niveles y versión; sin medallas ni probabilidades.

/** Código de versión de PKHeX: W, B2, SL, HG… */
export type Version = string
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
  /** Versiones del grupo en orden de bit (1, 2, 4…). */
  versions: Version[]
  /** Datos "ricos" (Blanco/Negro): medallas por lugar, estaciones, probabilidades. */
  rich: boolean
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
  /** Forma (Alola, Paldea…) en "es|en", si no es la normal. */
  form: string | null
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
  /** Versiones del grupo donde sí sale (para "solo en…"). */
  others?: Version[]
}

export interface Progress {
  badges: number
  /** Ya has terminado la Liga. */
  postgame: boolean
}

/** Grupos de juegos con sus versiones (el orden es el de los bits de los datos). */
const GROUPS: Record<string, Version[]> = {
  bw: ['B', 'W'],
  rby: ['RD', 'GN', 'YW'],
  gsc: ['GD', 'SI', 'C'],
  rse: ['R', 'S', 'E'],
  frlg: ['FR', 'LG'],
  dppt: ['D', 'P', 'Pt'],
  hgss: ['HG', 'SS'],
  b2w2: ['B2', 'W2'],
  xy: ['X', 'Y'],
  oras: ['OR', 'AS'],
  sm: ['SN', 'MN'],
  usum: ['US', 'UM'],
  lgpe: ['GP', 'GE'],
  swsh: ['SW', 'SH'],
  bdsp: ['BD', 'SP'],
  pla: ['PLA'],
  sv: ['SL', 'VL'],
  za: ['ZA'],
}

/** Códigos de "pareja" que da PKHeX cuando la partida no dice cuál de las dos es. */
const PAIRS: Record<string, string> = {
  RBY: 'rby', GS: 'gsc', GSC: 'gsc', RS: 'rse', RSE: 'rse', FRLG: 'frlg', DP: 'dppt', DPPt: 'dppt',
  HGSS: 'hgss', BW: 'bw', B2W2: 'b2w2', XY: 'xy', ORAS: 'oras', SM: 'sm', USUM: 'usum', GG: 'lgpe',
  SWSH: 'swsh', BDSP: 'bdsp', SV: 'sv',
}

export interface AssistantGame {
  group: string
  versions: Version[]
  /** Versión exacta de la partida, o null si hay que preguntarla (p. ej. Rubí o Zafiro). */
  version: Version | null
}

/** Juego del asistente según el `gameId` de la partida (código de versión de PKHeX). */
export function assistantGame(gameId: string): AssistantGame | null {
  if (gameId === 'BU') return { group: 'rby', versions: GROUPS.rby, version: 'GN' } // Azul japonés
  for (const [group, versions] of Object.entries(GROUPS)) {
    if (versions.includes(gameId)) return { group, versions, version: gameId }
  }
  const group = PAIRS[gameId]
  return group ? { group, versions: GROUPS[group], version: null } : null
}

/** Nombre de cada versión en los dos idiomas. */
export const VERSION_NAMES: Record<string, [string, string]> = {
  RD: ['Rojo', 'Red'],
  GN: ['Azul', 'Blue'],
  YW: ['Amarillo', 'Yellow'],
  GD: ['Oro', 'Gold'],
  SI: ['Plata', 'Silver'],
  C: ['Cristal', 'Crystal'],
  R: ['Rubí', 'Ruby'],
  S: ['Zafiro', 'Sapphire'],
  E: ['Esmeralda', 'Emerald'],
  FR: ['Rojo Fuego', 'FireRed'],
  LG: ['Verde Hoja', 'LeafGreen'],
  D: ['Diamante', 'Diamond'],
  P: ['Perla', 'Pearl'],
  Pt: ['Platino', 'Platinum'],
  HG: ['Oro HeartGold', 'HeartGold'],
  SS: ['Plata SoulSilver', 'SoulSilver'],
  B: ['Negro', 'Black'],
  W: ['Blanco', 'White'],
  B2: ['Negro 2', 'Black 2'],
  W2: ['Blanco 2', 'White 2'],
  X: ['X', 'X'],
  Y: ['Y', 'Y'],
  OR: ['Rubí Omega', 'Omega Ruby'],
  AS: ['Zafiro Alfa', 'Alpha Sapphire'],
  SN: ['Sol', 'Sun'],
  MN: ['Luna', 'Moon'],
  US: ['Ultrasol', 'Ultra Sun'],
  UM: ['Ultraluna', 'Ultra Moon'],
  GP: ['Let’s Go, Pikachu!', 'Let’s Go, Pikachu!'],
  GE: ['Let’s Go, Eevee!', 'Let’s Go, Eevee!'],
  SW: ['Espada', 'Sword'],
  SH: ['Escudo', 'Shield'],
  BD: ['Diamante Brillante', 'Brilliant Diamond'],
  SP: ['Perla Reluciente', 'Shining Pearl'],
  PLA: ['Leyendas: Arceus', 'Legends: Arceus'],
  SL: ['Escarlata', 'Scarlet'],
  VL: ['Púrpura', 'Violet'],
  ZA: ['Leyendas: Z-A', 'Legends: Z-A'],
}

export const versionName = (v: Version, lang: string) => {
  const n = VERSION_NAMES[v]
  return n ? (lang === 'es' ? n[0] : n[1]) : v
}

const bitOf = (data: BwData, version: Version) => 1 << Math.max(0, data.versions.indexOf(version))

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
  // Resto de juegos (métodos de PKHeX)
  grass: 'grass',
  standard: 'grass',
  wild: 'grass',
  symbol: 'grass',
  hidden: 'grass',
  ground: 'grass',
  sky: 'grass',
  sos: 'grass',
  horde: 'grass',
  headbutt: 'grass',
  'rock-smash': 'grass',
  'honey-tree': 'grass',
  swarm: 'grass',
  'hidden-grotto': 'grass',
  'friend-safari': 'grass',
  'safari-grass': 'grass',
  'bug-contest': 'grass',
  landmark: 'grass',
  distortion: 'grass',
  outbreak: 'grass',
  hyperspace: 'grass',
  'safari-surf': 'water',
  surfing: 'water',
  sharpedo: 'water',
  'old-rod': 'fishing',
  'good-rod': 'fishing',
  fishing: 'fishing',
  'swarm-fish': 'fishing',
  'safari-old-rod': 'fishing',
  'safari-good-rod': 'fishing',
  'safari-super-rod': 'fishing',
  roaming: 'special',
  trade: 'special',
  pokewalker: 'special',
  'max-raid': 'special',
  'dynamax-adventure': 'special',
}

/** Estación de Blanco/Negro según el mes: cambia cada mes (ene primavera, feb verano…). */
export function seasonFor(date: Date): Season {
  return (['spring', 'summer', 'autumn', 'winter'] as const)[date.getMonth() % 4]
}

const level = (p: Progress) => (p.postgame ? 9 : Math.min(8, Math.max(0, p.badges)))

export function encountersFor(data: BwData, species: number, version: Version, progress: Progress, season: Season): Encounter[] {
  const bit = bitOf(data, version)
  const rich = data.rich
  const info = data.species[species]
  const raw = info?.enc ?? []
  const lvl = level(progress)
  const list: Encounter[] = []
  for (const [loc, method, min, max, chance, v, cond] of raw) {
    if (!(v & bit)) continue
    const form = cond?.startsWith('form:') ? cond.slice(5) : null
    const conds = cond && !form ? cond.split('+') : []
    const seasonCond = conds.find((c) => c.startsWith('season-'))
    const encSeason = (seasonCond?.slice(7) as Season | undefined) ?? null
    // Un encuentro de otra estación no está "disponible" ahora, pero se muestra.
    const location = data.locations[loc]
    // Los legendarios fijos (Cobalion, Terrakion, Virizion, Landorus, Kyurem…) aparecen tras
    // la Liga. Zekrom/Reshiram en el Castillo de N son parte de la historia.
    const postLeagueLegend = rich && info?.legend && method === 'static' && location.key !== 'ns-castle'
    const needs = rich ? Math.max(location.badges, METHOD_NEEDS[method] ?? 0, postLeagueLegend ? 9 : 0) : 0
    const note = conds.filter((c) => !c.startsWith('season-')).join('+') || null
    list.push({
      location,
      method,
      min,
      max,
      chance,
      season: encSeason,
      note,
      form,
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
  const othersMask = (info.enc ?? []).reduce((m, e) => m | e[5], 0) & ~bitOf(data, version)
  if (othersMask) {
    const others = data.versions.filter((_, i) => othersMask & (1 << i))
    return { kind: 'other-version', encounters: [], available: false, trade: false, others }
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
  // Datos de PKHeX: ya vienen traducidos, "Piedra Fuego|Fire Stone".
  if (slug.includes('|')) return slug.split('|')[lang === 'es' ? 0 : 1]
  if (lang === 'es' && ITEMS_ES[slug]) return ITEMS_ES[slug]
  return slug
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/** Formato de public/data/games/<grupo>.json (lo genera tools/PokeSave.DataBuilder). */
export interface PkhexEvolution {
  From: number
  T: string
  Lvl?: number
  Item?: string
  Move?: string
  With?: number
}

export interface PkhexGameData {
  Versions: Version[]
  Methods: string[]
  Locations: { Es: string; En: string }[]
  Species: Record<
    string,
    {
      Enc?: [number, number, number, number, number, number][]
      Forms?: Record<string, string>
      Evo?: PkhexEvolution
      Event?: 1
      Legend?: 1
    }
  >
}

/** Tipos de evolución de PKHeX (EvolutionType) → los del asistente. */
export function evolutionFromPkhex(evo: PkhexEvolution): BwEvolution {
  const t = evo.T
  const out: BwEvolution = { t: 'level-up' }
  if (t.startsWith('Trade')) {
    out.t = 'trade'
    if (t === 'TradeHeldItem') out.held = evo.Item
  } else if (t.startsWith('UseItem')) {
    out.t = 'use-item'
    out.item = evo.Item
  } else if (t.startsWith('LevelUpHeldItem')) {
    out.held = evo.Item
  } else if (t.startsWith('LevelUpFriendship') || t.startsWith('LevelUpAffection')) {
    out.happy = 1
  } else if (t === 'LevelUpKnowMove' || t === 'LevelUpKnowMoveECElse' || t === 'LevelUpUseMoveSpecial' || t === 'UseMoveAgileStyle') {
    out.move = evo.Move
  } else if (t === 'LevelUpWithTeammate') {
    out.with = evo.With
  } else if (!t.startsWith('LevelUp')) {
    out.t = 'other'
  }
  if (evo.Lvl && out.t !== 'trade' && out.t !== 'use-item') out.lvl = evo.Lvl
  if (/Morning|Day/.test(t)) out.time = 'day'
  if (/Night/.test(t)) out.time = 'night'
  return out
}

/** Convierte los datos de PKHeX al mismo formato que los de Blanco/Negro. */
export function fromPkhex(d: PkhexGameData): BwData {
  const species: Record<string, BwSpecies> = {}
  for (const [id, s] of Object.entries(d.Species)) {
    const entry: BwSpecies = {}
    if (s.Enc?.length) {
      entry.enc = s.Enc.map(([loc, m, min, max, v, form]): RawEncounter => [loc, d.Methods[m], min, max, 0, v, form && s.Forms?.[form] ? `form:${s.Forms[form]}` : ''])
    }
    if (s.Evo) {
      entry.from = s.Evo.From
      entry.evo = evolutionFromPkhex(s.Evo)
    }
    if (s.Event) entry.event = 1
    if (s.Legend) entry.legend = 1
    // Sin encuentros en este juego: si no evoluciona de nada que salga, hay que traerlo de otro.
    if (!s.Enc?.length) entry.old = 1
    species[id] = entry
  }
  return {
    version: 1,
    locations: d.Locations.map((l, i) => ({ key: String(i), es: l.Es, en: l.En, badges: 0 })),
    species,
    versions: d.Versions,
    rich: false,
  }
}

const cache = new Map<string, Promise<BwData>>()

/** Carga perezosa de los datos de un grupo de juegos (solo al abrir el asistente). */
export function loadGameData(group: string): Promise<BwData> {
  let p = cache.get(group)
  if (!p) {
    const url = group === 'bw' ? 'data/bw.json' : `data/games/${group}.json`
    p = fetch(`${import.meta.env.BASE_URL}${url}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${url} ${r.status}`)
        return r.json()
      })
      .then((json) => (group === 'bw' ? { ...(json as BwData), versions: ['B', 'W'], rich: true } : fromPkhex(json as PkhexGameData)))
      .catch((err) => {
        cache.delete(group)
        throw err
      })
    cache.set(group, p)
  }
  return p
}
