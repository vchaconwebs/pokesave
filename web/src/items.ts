// Fase 4 · Buscador de objetos. Lógica pura, sin React, para poder probarla.
// - Todos los juegos: qué objetos existen, cuántos tienes y qué enseña cada MT (motor PKHeX).
// - Gen 2 y 3 (Oro/Plata, Cristal, Rubí/Zafiro, Esmeralda, Rojo Fuego/Verde Hoja): dónde está
//   cada objeto y si ya lo has recogido, con public/data/items/<juego>.json
//   (tools/build-gen2-items.mjs y build-gen3-items.mjs, sacados de las decompilaciones de pret)
//   y los flags de evento de la partida.

/** [objeto, mapa, tipo (0 suelo, 1 oculto, 2 regalo), flag (-1 si no hay)]. */
export type RawSpot = [number, number, number, number]

export interface ItemData {
  version: number
  game: string
  source: string
  maps: { name: string; sec: number }[]
  items: RawSpot[]
  /** [mapa, objetos que vende]. */
  marts: [number, number[]][]
}

export type SpotKind = 'ground' | 'hidden' | 'gift' | 'mart'

export interface ItemSpot {
  item: number
  kind: SpotKind
  map: number
  /** Lugar (nombre del juego) y, si es un interior o una planta, cuál. */
  place: string
  detail: string | null
  flag: number
  /** true = ya lo cogiste; false = aún no; null = no se sabe (sin flag o tienda). */
  collected: boolean | null
}

const KINDS: SpotKind[] = ['ground', 'hidden', 'gift']

/** Datos de objetos para la partida (por su gameId de PKHeX), si los hay. */
export function itemDataKey(gameId: string): string | null {
  if (gameId === 'C') return 'c'
  if (['GD', 'SI', 'GS'].includes(gameId)) return 'gs'
  if (gameId === 'E') return 'e'
  if (['FR', 'LG', 'FRLG'].includes(gameId)) return 'frlg'
  if (['R', 'S', 'RS'].includes(gameId)) return 'rs'
  return null
}

/** Palabras de los nombres de mapa de pret → español. */
const ROOM_ES: Record<string, string> = {
  Mart: 'Tienda',
  PokemonCenter: 'Centro Pokémon',
  Gym: 'Gimnasio',
  House: 'Casa',
  Room: 'Sala',
  Rooms: 'Salas',
  Corridors: 'Pasillos',
  Deck: 'Cubierta',
  Hold: 'Bodega',
  Entrance: 'Entrada',
  Lobby: 'Recepción',
  Summit: 'Cima',
  Underwater: 'Bajo el agua',
  Interior: 'Interior',
  Tunnel: 'Túnel',
  Cave: 'Cueva',
  Lab: 'Laboratorio',
  Top: 'Cima',
}

/**
 * "GraniteCave_B1F" → "B1F"; "PetalburgCity_Mart" → "Tienda"; "Route102" → null.
 * En Gen 2 los mapas no llevan "_": "GoldenrodDeptStore2F" → "2F" si hay planta.
 */
export function mapDetail(name: string, lang: string): string | null {
  const i = name.indexOf('_')
  if (i < 0) {
    const floor = /(B?\d+F)$/.exec(name)
    return floor ? floor[1] : null
  }
  return name
    .slice(i + 1)
    .split('_')
    .map((part) =>
      part
        .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
        .split(' ')
        .map((w) => (lang === 'es' ? (ROOM_ES[w] ?? w) : w))
        .join(' '),
    )
    .join(' · ')
}

/** Todos los sitios de objetos del juego, con lo recogido según los flags. */
export function buildSpots(data: ItemData, locations: { Es: string; En: string; Fr?: string; De?: string; It?: string }[], flags: ReadonlyMap<number, boolean>, lang: string): ItemSpot[] {
  const placeOf = (map: number) => {
    const m = data.maps[map]
    const loc = locations[m.sec]
    return loc ? (({ es: loc.Es, fr: loc.Fr, de: loc.De, it: loc.It } as Record<string, string | undefined>)[lang] ?? loc.En) : m.name
  }
  const spots: ItemSpot[] = data.items.map(([item, map, kind, flag]) => ({
    item,
    kind: KINDS[kind] ?? 'ground',
    map,
    place: placeOf(map),
    detail: mapDetail(data.maps[map].name, lang),
    flag,
    collected: flag >= 0 && flags.has(flag) ? flags.get(flag)! : null,
  }))
  for (const [map, items] of data.marts) {
    for (const item of items) {
      spots.push({ item, kind: 'mart', map, place: placeOf(map), detail: mapDetail(data.maps[map].name, lang), flag: -1, collected: null })
    }
  }
  return spots
}

/** Flags que hay que preguntar a la partida. */
export const flagIds = (data: ItemData) => [...new Set(data.items.map((s) => s[3]).filter((f) => f >= 0))]

/** Agrupa por objeto. */
export function spotsByItem(spots: ItemSpot[]): Map<number, ItemSpot[]> {
  const map = new Map<number, ItemSpot[]>()
  for (const s of spots) {
    const list = map.get(s.item) ?? []
    list.push(s)
    map.set(s.item, list)
  }
  return map
}

const cache = new Map<string, Promise<{ data: ItemData; locations: { Es: string; En: string; Fr?: string; De?: string; It?: string }[] }>>()

export function loadItemData(key: string) {
  let p = cache.get(key)
  if (!p) {
    const base = `${import.meta.env.BASE_URL}data/items/`
    const get = (file: string) =>
      fetch(base + file).then((r) => {
        if (!r.ok) throw new Error(`${file} ${r.status}`)
        return r.json()
      })
    const locations = key === 'c' || key === 'gs' ? 'gen2-locations.json' : 'gen3-locations.json'
    p = Promise.all([get(`${key}.json`), get(locations)])
      .then(([data, locations]) => ({ data: data as ItemData, locations: locations as { Es: string; En: string; Fr?: string; De?: string; It?: string }[] }))
      .catch((err) => {
        cache.delete(key)
        throw err
      })
    cache.set(key, p)
  }
  return p
}
