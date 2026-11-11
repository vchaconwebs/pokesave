// Genera web/public/data/items/{c,gs}.json: dónde está cada objeto en Cristal y en Oro/Plata,
// con el evento (flag) que el juego activa al cogerlo. Mismo formato que build-gen3-items.mjs.
// Fuente: decompilaciones de pret (github.com/pret/pokecrystal y pokegold):
//   - maps/*.asm: object_event con OBJECTTYPE_ITEMBALL (+ itemball), bg_event BGEVENT_ITEM
//     (+ hiddenitem), regalos (verbosegiveitem/giveitem + setevent) y tiendas (pokemart).
//   - constants/*.asm: números de objetos (item_constants), eventos (event_flags), lugares
//     (landmark_constants) y tiendas (mart_constants); data/maps/maps.asm: lugar de cada mapa.
// Uso: node tools/build-gen2-items.mjs  (caché en tools/.cache/pret, no se sube)
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CACHE = resolve(here, '.cache', 'pret')
const OUT = resolve(here, '..', 'web', 'public', 'data', 'items')
mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

const GAMES = [
  { key: 'c', repo: 'pokecrystal', branch: 'master' },
  { key: 'gs', repo: 'pokegold', branch: 'master' },
]

async function fetchText(url, cacheName) {
  const file = resolve(CACHE, cacheName.replace(/[\\/:?=&]/g, '_'))
  if (existsSync(file)) return readFileSync(file, 'utf8')
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'PokeSave-data-builder' } })
    if (res.status === 404) {
      writeFileSync(file, '')
      return ''
    }
    if (res.ok) {
      const text = await res.text()
      writeFileSync(file, text)
      return text
    }
    if (attempt >= 4) throw new Error(`${res.status} ${url}`)
    await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
}

const raw = (g, path) => fetchText(`https://raw.githubusercontent.com/pret/${g.repo}/${g.branch}/${path}`, `${g.repo}/${path}`)

async function pool(items, limit, fn) {
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

/**
 * Constantes de RGBDS: const_def [inicio], const X, const_skip [n], const_next n, y los macros
 * add_tm/add_hm de los objetos (TM_X / HM_X). add_mt (tutores) no ocupa número de objeto.
 */
function parseConsts(text) {
  const values = new Map()
  let value = 0
  let inMacro = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/;.*$/, '').trim()
    // El cuerpo de MACRO … ENDM es una definición, no constantes (tiene "const TM_\1").
    if (/^MACRO\b/.test(line)) inMacro = true
    if (inMacro) {
      if (/^ENDM\b/.test(line)) inMacro = false
      continue
    }
    let m
    if ((m = /^const_def\s*(-?\d+)?/.exec(line))) value = m[1] ? Number(m[1]) : 0
    else if ((m = /^const\s+(\w+)/.exec(line))) values.set(m[1], value++)
    else if ((m = /^const_skip\s*(\d+)?/.exec(line))) value += m[1] ? Number(m[1]) : 1
    else if ((m = /^const_next\s+(\$?[\da-fA-F]+)/.exec(line))) value = m[1].startsWith('$') ? parseInt(m[1].slice(1), 16) : Number(m[1])
    else if ((m = /^add_tm\s+(\w+)/.exec(line))) values.set(`TM_${m[1]}`, value++)
    else if ((m = /^add_hm\s+(\w+)/.exec(line))) values.set(`HM_${m[1]}`, value++)
  }
  return values
}

/** Bloques de script: etiqueta (global o .local) → líneas. */
function scriptBlocks(text) {
  const blocks = []
  let current = null
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/;.*$/, '').trim()
    const label = /^(\.?\w+):{1,2}$/.exec(line)
    if (label) {
      current = { label: label[1], lines: [] }
      blocks.push(current)
    } else if (current && line) {
      current.lines.push(line)
    }
  }
  return blocks
}

for (const g of GAMES) {
  console.log(`== ${g.repo}`)
  const tree = JSON.parse(await fetchText(`https://api.github.com/repos/pret/${g.repo}/git/trees/${g.branch}?recursive=1`, `${g.repo}/tree.json`))
  const items = parseConsts(await raw(g, 'constants/item_constants.asm'))
  const events = parseConsts(await raw(g, 'constants/event_flags.asm'))
  const landmarks = parseConsts(await raw(g, 'constants/landmark_constants.asm'))
  const martIds = parseConsts(await raw(g, 'constants/mart_constants.asm'))

  // Mapa → lugar (LANDMARK_*), de data/maps/maps.asm.
  const landmarkOf = new Map()
  for (const m of (await raw(g, 'data/maps/maps.asm')).matchAll(/^\s*map\s+(\w+),\s*\w+,\s*\w+,\s*(LANDMARK_\w+)/gm)) landmarkOf.set(m[1], landmarks.get(m[2]) ?? -1)

  // Tiendas: MART_X → etiqueta (tabla dw en el orden de las constantes) → objetos.
  const martsText = await raw(g, 'data/items/marts.asm')
  const martLabels = [...martsText.matchAll(/^\s*dw\s+(\w+)/gm)].map((m) => m[1])
  const martBlocks = new Map(scriptBlocks(martsText).map((b) => [b.label, b]))
  const martItems = (martConst) => {
    const label = martLabels[martIds.get(martConst)]
    const list = []
    for (const l of martBlocks.get(label)?.lines.slice(1) ?? []) {
      const m = /^db\s+(\w+)/.exec(l)
      if (m && items.has(m[1])) list.push(items.get(m[1]))
    }
    return list
  }

  const files = tree.tree.map((t) => t.path).filter((p) => /^maps\/\w+\.asm$/.test(p))
  const maps = []
  const entries = []
  const marts = []
  const missing = new Set()
  const item = (name) => {
    if (!items.has(name)) missing.add(name)
    return items.get(name)
  }
  const event = (name) => (name && events.has(name) ? events.get(name) : -1)

  await pool(files, 8, async (path) => {
    const text = await raw(g, path)
    const name = path.slice(5, -4)
    const mapIdx = maps.push({ name, sec: landmarkOf.get(name) ?? -1 }) - 1
    const blocks = scriptBlocks(text)
    const byLabel = new Map(blocks.map((b) => [b.label, b]))

    for (const m of text.matchAll(/^\s*object_event\s+(.+)$/gm)) {
      const args = m[1].replace(/;.*$/, '').split(',').map((a) => a.trim())
      if (!args.includes('OBJECTTYPE_ITEMBALL')) continue
      const ball = byLabel.get(args.at(-2))?.lines.find((l) => l.startsWith('itemball'))
      const it = ball && /^itemball\s+(\w+)/.exec(ball)?.[1]
      const id = it && item(it)
      if (id) entries.push([id, mapIdx, 0, event(args.at(-1))])
    }
    for (const m of text.matchAll(/^\s*bg_event\s+[^,]+,[^,]+,\s*BGEVENT_ITEM,\s*(\w+)/gm)) {
      const hidden = byLabel.get(m[1])?.lines.find((l) => l.startsWith('hiddenitem'))
      const h = hidden && /^hiddenitem\s+(\w+),\s*(\w+)/.exec(hidden)
      const id = h && item(h[1])
      if (id) entries.push([id, mapIdx, 1, event(h[2])])
    }
    for (const b of blocks) {
      b.lines.forEach((line, i) => {
        const give = /^(?:verbosegiveitem|giveitem)\s+(\w+)/.exec(line)
        if (give) {
          const id = item(give[1])
          if (!id) return
          const after = b.lines.slice(i + 1).find((l) => /^setevent\s+EVENT_/.test(l))
          const before = b.lines.slice(0, i).find((l) => /^checkevent\s+EVENT_/.test(l))
          const e = /\b(EVENT_\w+)/.exec(after ?? before ?? '')
          entries.push([id, mapIdx, 2, e ? event(e[1]) : -1])
        }
        const mart = /^pokemart\s+\w+,\s*(MART_\w+)/.exec(line)
        if (mart) {
          const list = martItems(mart[1])
          if (list.length) marts.push([mapIdx, list])
        }
      })
    }
  })

  const seen = new Set()
  const unique = entries.filter((e) => !seen.has(e.join(',')) && seen.add(e.join(',')))
  writeFileSync(resolve(OUT, `${g.key}.json`), JSON.stringify({ version: 1, game: g.key, source: `pret/${g.repo}`, maps, items: unique, marts }))
  const kinds = [0, 1, 2].map((k) => unique.filter((e) => e[2] === k).length)
  console.log(`  ${maps.length} mapas · ${kinds[0]} en el suelo · ${kinds[1]} ocultos · ${kinds[2]} regalos (${unique.filter((e) => e[3] < 0).length} sin flag) · ${marts.length} tiendas`)
  if (missing.size) console.log(`  ⚠ objetos sin número: ${[...missing].slice(0, 12).join(', ')}`)
}
