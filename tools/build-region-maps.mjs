// Genera web/public/data/maps/<region>.json: la posición de cada lugar en el mapa de la región,
// para dibujar un mapa PROPIO (cuadrícula SVG; no se usa ninguna imagen oficial).
// Fuente: decompilaciones de pret.
//   - Hoenn: pokeemerald src/data/region_map/region_map_sections.json (x, y, ancho, alto).
//   - Kanto e islas Sete (Rojo Fuego/Verde Hoja): pokefirered region_map_layout_*.h (cuadrícula).
//   - Johto y Kanto (Oro/Plata/Cristal): pokecrystal data/maps/landmarks.asm (un punto por lugar).
// El número de cada lugar es el mismo que usa PKHeX: sección de mapa en Gen 3, landmark en Gen 2.
// Uso: node tools/build-region-maps.mjs
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CACHE = resolve(here, '.cache', 'pret')
const OUT = resolve(here, '..', 'web', 'public', 'data', 'maps')
mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

async function raw(repo, path) {
  const file = resolve(CACHE, `${repo}/${path}`.replace(/[\\/:?=&]/g, '_'))
  if (existsSync(file) && readFileSync(file, 'utf8')) return readFileSync(file, 'utf8')
  const res = await fetch(`https://raw.githubusercontent.com/pret/${repo}/master/${path}`, { headers: { 'User-Agent': 'PokeSave-data-builder' } })
  if (!res.ok) throw new Error(`${res.status} ${repo}/${path}`)
  const text = await res.text()
  writeFileSync(file, text)
  return text
}

const write = (name, data) => {
  writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(data))
  console.log(`${name}: ${data.cells.length} casillas, ${new Set(data.cells.map((c) => c[0])).size} lugares (${data.width}×${data.height})`)
}

// ---------- Hoenn (rectángulos) ----------
{
  const list = JSON.parse(await raw('pokeemerald', 'src/data/region_map/region_map_sections.json')).map_sections
  const cells = []
  list.forEach((s, i) => {
    if (s.width === undefined) return
    for (let dx = 0; dx < s.width; dx++) for (let dy = 0; dy < s.height; dy++) cells.push([i, s.x + dx, s.y + dy])
  })
  const width = Math.max(...cells.map((c) => c[1])) + 1
  const height = Math.max(...cells.map((c) => c[2])) + 1
  write('hoenn', { version: 1, kind: 'grid', width, height, cells, source: 'pret/pokeemerald' })
}

// ---------- Kanto e islas Sete (cuadrícula con MAPSEC_* por casilla) ----------
{
  const ids = JSON.parse(await raw('pokefirered', 'src/data/region_map/region_map_sections.json')).map_sections.map((s) => s.id)
  for (const [name, file] of [
    ['kanto-frlg', 'region_map_layout_kanto.h'],
    ['sevii-123', 'region_map_layout_sevii_123.h'],
    ['sevii-45', 'region_map_layout_sevii_45.h'],
    ['sevii-67', 'region_map_layout_sevii_67.h'],
  ]) {
    const text = await raw('pokefirered', `src/data/region_map/${file}`)
    // Capa del mapa (las mazmorras van en otra capa encima: se añaden si la casilla está vacía).
    const layers = text.split(/\[LAYER_\w+\]\s*=/).slice(1)
    const cells = new Map()
    layers.forEach((layer) => {
      const rows = [...layer.matchAll(/\{([^{}]*MAPSEC[^{}]*)\}/g)].map((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean))
      rows.forEach((row, y) =>
        row.forEach((sec, x) => {
          // Las casillas de Centro Pokémon de ruta ("ROUTE_4_POKECENTER") cuentan como la ruta.
          const id = sec.replace(/_POKECENTER$/, '')
          const i = ids.indexOf(id)
          if (sec !== 'MAPSEC_NONE' && i >= 0 && !cells.has(`${x},${y}`)) cells.set(`${x},${y}`, [i, x, y])
        }),
      )
    })
    const list = [...cells.values()]
    const width = Math.max(...list.map((c) => c[1])) + 1
    const height = Math.max(...list.map((c) => c[2])) + 1
    write(name, { version: 1, kind: 'grid', width, height, cells: list, source: 'pret/pokefirered' })
  }
}

// ---------- Johto y Kanto de Oro/Plata/Cristal (puntos) ----------
{
  const constants = await raw('pokecrystal', 'constants/landmark_constants.asm')
  // Los landmark de Kanto empiezan en KANTO_LANDMARK (justo antes de LANDMARK_PALLET_TOWN).
  let value = 0
  let kantoStart = Infinity
  for (const line of constants.split('\n')) {
    const l = line.replace(/;.*$/, '').trim()
    if (/^DEF KANTO_LANDMARK\s+EQU/.test(l)) kantoStart = value
    if (/^const_def/.test(l)) value = 0
    else if (/^const\s+\w+/.test(l)) value++
  }
  const points = [...(await raw('pokecrystal', 'data/maps/landmarks.asm')).matchAll(/^\s*landmark\s+(-?\d+),\s*(-?\d+),\s*(\w+)/gm)].map((m, i) => [i, Number(m[1]), Number(m[2])])
  for (const [name, list] of [
    ['johto', points.filter((p) => p[0] > 0 && p[0] < kantoStart)],
    ['kanto-gsc', points.filter((p) => p[0] >= kantoStart && p[1] >= 0)],
  ]) {
    // Pasar de píxeles a una cuadrícula de 4 px (la pantalla de la Game Boy es 160×144).
    const cells = list.map(([i, x, y]) => [i, Math.round(x / 4), Math.round(y / 4)])
    const width = Math.max(...cells.map((c) => c[1])) + 2
    const height = Math.max(...cells.map((c) => c[2])) + 2
    write(name, { version: 1, kind: 'points', width, height, cells, source: 'pret/pokecrystal' })
  }
}
