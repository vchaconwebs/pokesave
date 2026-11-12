// Genera web/public/data/bw.json: dónde se consigue cada Pokémon en Pokémon Blanco/Negro.
// Fuente: PokéAPI (con caché en tools/.cache) + correcciones a mano de tools/bw-locations.mjs.
// Uso: node tools/build-bw-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { get, pool, idFromUrl } from './pokeapi.mjs'
import { LOCATIONS, EXCLUDED_AREAS, AREA_TO_LOCATION, EXTRA_ENCOUNTERS, EVENT_ONLY } from './bw-locations.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '..', 'web', 'public', 'data', 'bw.json')
const MAX_SPECIES = 649
const VERSION_BIT = { black: 1, white: 2 }

const ids = Array.from({ length: MAX_SPECIES }, (_, i) => i + 1)

console.log('Encuentros…')
const encounters = await pool(ids, 8, (id) => get(`pokemon/${id}/encounters`))
console.log('Especies…')
const species = await pool(ids, 8, (id) => get(`pokemon-species/${id}`))

// ---------- Encuentros ----------
// Clave de agregación: lugar + método + condición. Dentro se juntan niveles, versiones y
// probabilidad (la máxima entre las áreas del mismo lugar).
const areaToLocation = new Map()
const usedLocations = new Set()
const bySpecies = new Map()

const areaNames = new Set()
for (const list of encounters) for (const a of list ?? []) areaNames.add(a.location_area.name)
await pool([...areaNames], 8, async (name) => {
  const area = await get(`location-area/${name}`)
  areaToLocation.set(name, AREA_TO_LOCATION[name] ?? area.location.name)
})

for (let i = 0; i < ids.length; i++) {
  const id = ids[i]
  const merged = new Map()
  for (const a of encounters[i] ?? []) {
    if (EXCLUDED_AREAS.has(a.location_area.name)) continue
    const location = areaToLocation.get(a.location_area.name)
    for (const vd of a.version_details) {
      const bit = VERSION_BIT[vd.version.name]
      if (!bit) continue
      // Juntar los "huecos" de un mismo método: la probabilidad es la suma.
      const slots = new Map()
      for (const e of vd.encounter_details) {
        const cond = e.condition_values.map((c) => c.name).sort().join('+')
        const key = `${e.method.name}|${cond}`
        const s = slots.get(key) ?? { method: e.method.name, cond, min: e.min_level, max: e.max_level, chance: 0 }
        s.min = Math.min(s.min, e.min_level)
        s.max = Math.max(s.max, e.max_level)
        s.chance += e.chance
        slots.set(key, s)
      }
      for (const s of slots.values()) {
        const key = `${location}|${s.method}|${s.cond}`
        const m = merged.get(key) ?? { location, method: s.method, cond: s.cond, min: s.min, max: s.max, chance: 0, v: 0 }
        m.min = Math.min(m.min, s.min)
        m.max = Math.max(m.max, s.max)
        m.chance = Math.max(m.chance, Math.min(100, s.chance))
        m.v |= bit
        merged.set(key, m)
      }
    }
  }
  for (const x of EXTRA_ENCOUNTERS.filter((x) => x.species === id)) {
    merged.set(`${x.location}|${x.method}|`, { location: x.location, method: x.method, cond: '', min: x.min, max: x.max, chance: x.chance, v: x.v })
  }
  const list = [...merged.values()]
  list.forEach((e) => usedLocations.add(e.location))
  if (list.length) bySpecies.set(id, list)
}

// ---------- Lugares ----------
// Los de Blanco/Negro llevan " (B/W)" en PKHeX cuando el nombre se repite en N2B2: van después y mandan.
const GEN5 = new Map(
  JSON.parse(readFileSync(new URL('./gen5-locations.json', import.meta.url), 'utf8'))
    .filter((l) => !l.En.includes('B2/W2'))
    .sort((a, b) => a.En.includes('(B/W)') - b.En.includes('(B/W)'))
    .map((l) => [l.En.replace(' (B/W)', '').toLowerCase(), Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === 'string' ? v.replace(' (B/W)', '') : v]))]),
)
const tower = GEN5.get('dragonspiral tower')
GEN5.set('dragonspiral tower (top)', { Fr: `${tower.Fr} (sommet)`, De: `${tower.De} (Spitze)`, It: `${tower.It} (cima)` })
GEN5.set('all over unova (roaming)', { Fr: 'Partout à Unys (errant)', De: 'Überall in Einall (streunend)', It: 'In tutta Unima (vagante)' })
const locationKeys = [...usedLocations].sort((a, b) => (LOCATIONS[a]?.badges ?? 99) - (LOCATIONS[b]?.badges ?? 99) || a.localeCompare(b))
const locations = await pool(locationKeys, 8, async (key) => {
  const fixed = LOCATIONS[key]
  if (!fixed) console.warn(`  ⚠ lugar sin tabla de medallas: ${key}`)
  let en = fixed?.en
  if (!en) {
    const loc = await get(`location/${key}`)
    en = loc?.names.find((n) => n.language.name === 'en')?.name ?? key
  }
  // Francés, alemán e italiano: los nombres de PKHeX (tools/gen5-locations.json, lo escribe el
  // DataBuilder), buscando por el nombre inglés. Si no está, se queda el inglés.
  const pk = GEN5.get(en.toLowerCase())
  return { key, en, es: fixed?.es ?? en, fr: pk?.Fr ?? en, de: pk?.De ?? en, it: pk?.It ?? en, badges: fixed?.badges ?? 9 }
})
const missing = locations.filter((l) => !GEN5.has(l.en.toLowerCase())).map((l) => l.en)
if (missing.length) console.warn(`  ⚠ lugares sin traducción de PKHeX: ${missing.join(', ')}`)
const locIndex = new Map(locationKeys.map((k, i) => [k, i]))

// ---------- Evoluciones ----------
console.log('Cadenas evolutivas…')
const chainIds = [...new Set(species.map((s) => idFromUrl(s.evolution_chain.url)))]
const chains = await pool(chainIds, 8, (id) => get(`evolution-chain/${id}`))
const evolution = new Map()
const walk = (node) => {
  const id = idFromUrl(node.species.url)
  if (id <= MAX_SPECIES && node.evolution_details.length) {
    const d = node.evolution_details[0]
    evolution.set(id, {
      t: d.trigger.name, // level-up, trade, use-item, shed…
      lvl: d.min_level ?? undefined,
      item: d.item?.name ?? undefined,
      held: d.held_item?.name ?? undefined,
      with: d.trade_species ? idFromUrl(d.trade_species.url) : undefined,
      happy: d.min_happiness ?? undefined,
      move: d.known_move?.name ?? undefined,
      time: d.time_of_day || undefined,
    })
  }
  node.evolves_to.forEach(walk)
}
chains.forEach((c) => c && walk(c.chain))

// ---------- Salida ----------
const out = {
  version: 1,
  game: 'black-white',
  source: 'PokéAPI (https://pokeapi.co) + correcciones propias (tools/bw-locations.mjs)',
  locations: locations.map(({ key, en, es, fr, de, it, badges }) => ({ key, en, es, fr, de, it, badges })),
  species: {},
}
for (const id of ids) {
  const s = species[id - 1]
  const entry = {}
  const enc = bySpecies.get(id)
  if (enc) entry.enc = enc.map((e) => [locIndex.get(e.location), e.method, e.min, e.max, e.chance, e.v, e.cond])
  if (s.evolves_from_species) entry.from = idFromUrl(s.evolves_from_species.url)
  if (evolution.has(id)) entry.evo = Object.fromEntries(Object.entries(evolution.get(id)).filter(([, v]) => v !== undefined))
  if (s.is_mythical || EVENT_ONLY.has(id)) entry.event = 1
  if (s.is_legendary) entry.legend = 1
  if (s.generation.name !== 'generation-v') entry.old = 1 // de juegos anteriores (Pokétransfer)
  out.species[id] = entry
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out))
const wild = [...bySpecies.keys()].length
console.log(`Listo: ${OUT}\n  ${locations.length} lugares, ${wild} especies con encuentros, ${evolution.size} evoluciones`)
