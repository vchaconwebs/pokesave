// Fase 5 · Mapas interactivos. Mapas PROPIOS dibujados a partir de la posición de cada lugar
// (public/data/maps/*.json, tools/build-region-maps.mjs, de las decompilaciones de pret): no se
// usa ninguna imagen oficial. El número de cada casilla es el de PKHeX (sección de mapa en
// Gen 3, landmark en Gen 2), el mismo que llevan los encuentros y los objetos.

export interface RegionMap {
  version: number
  /** grid: casillas que forman rutas y ciudades; points: un punto por lugar. */
  kind: 'grid' | 'points'
  width: number
  height: number
  /** [lugar, x, y] */
  cells: [number, number, number][]
  source: string
}

/** Mapas de cada juego (por el gameId de PKHeX). */
export function regionMapsFor(gameId: string): string[] {
  if (['E', 'R', 'S', 'RS', 'RSE'].includes(gameId)) return ['hoenn']
  if (['FR', 'LG', 'FRLG'].includes(gameId)) return ['kanto-frlg', 'sevii-123', 'sevii-45', 'sevii-67']
  if (['GD', 'SI', 'GS', 'C', 'GSC'].includes(gameId)) return ['johto', 'kanto-gsc']
  return []
}

/** Archivo de nombres de lugar según la generación del mapa. */
export const locationsFileFor = (gameId: string) => (['GD', 'SI', 'GS', 'C', 'GSC'].includes(gameId) ? 'gen2-locations.json' : 'gen3-locations.json')

export interface PlaceSummary<I, P> {
  id: number
  items: I[]
  pokemon: P[]
}

/** Junta por lugar lo que le pasas (objetos pendientes, Pokémon que faltan…). */
export function groupByPlace<I, P>(items: { place: number; value: I }[], pokemon: { place: number; value: P }[]): Map<number, PlaceSummary<I, P>> {
  const map = new Map<number, PlaceSummary<I, P>>()
  const get = (id: number) => {
    let p = map.get(id)
    if (!p) map.set(id, (p = { id, items: [], pokemon: [] }))
    return p
  }
  for (const it of items) get(it.place).items.push(it.value)
  for (const pk of pokemon) {
    const list = get(pk.place).pokemon
    if (!list.includes(pk.value)) list.push(pk.value)
  }
  return map
}

/** Rectángulo que ocupa un lugar (para poner su nombre o centrar el foco). */
export function bounds(map: RegionMap, id: number) {
  const cells = map.cells.filter((c) => c[0] === id)
  if (!cells.length) return null
  const xs = cells.map((c) => c[1])
  const ys = cells.map((c) => c[2])
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }
}

const cache = new Map<string, Promise<unknown>>()

export function loadJson<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${path} ${r.status}`)
        return r.json()
      })
      .catch((err) => {
        cache.delete(path)
        throw err
      })
    cache.set(path, p)
  }
  return p as Promise<T>
}
