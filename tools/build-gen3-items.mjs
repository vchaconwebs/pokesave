// Genera web/public/data/items/<juego>.json: dónde está cada objeto en Esmeralda, Rojo Fuego /
// Verde Hoja y Rubí/Zafiro, con el flag de evento que el juego activa al cogerlo.
// Fuente: las decompilaciones de pret (github.com/pret/pokeemerald, pokefirered, pokeruby):
//   - data/maps/*/map.json: objetos en el suelo (Poké Ball con script de finditem) y ocultos.
//   - data/maps/*/scripts.inc: regalos de NPC (giveitem + setflag) y tiendas (pokemart).
//   - include/constants/flags.h e items.h: números de flags y objetos.
// Los números de objeto son los internos de Gen 3, los mismos que usa PKHeX para la mochila.
// Uso: node tools/build-gen3-items.mjs  (caché en tools/.cache/pret, no se sube)
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CACHE = resolve(here, '.cache', 'pret')
const OUT = resolve(here, '..', 'web', 'public', 'data', 'items')
mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

const GAMES = [
  { key: 'e', repo: 'pokeemerald', branch: 'master', balls: 'data/scripts/item_ball_scripts.inc' },
  { key: 'frlg', repo: 'pokefirered', branch: 'master', balls: 'data/scripts/item_ball_scripts.inc' },
  { key: 'rs', repo: 'pokeruby', branch: 'master', balls: 'data/item_ball_scripts.inc' },
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
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

/**
 * Lee los #define y los enum de un .h y resuelve expresiones sencillas ((A + 0x10), B, 123…).
 * pokeemerald tiene los objetos en un enum; pokefirered y pokeruby, en #define.
 */
function parseDefines(text) {
  const exprs = new Map()
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const line of clean.split('\n')) {
    const m = /^\s*#define\s+(\w+)\s+(.+?)\s*(\/\/.*)?$/.exec(line)
    if (m) exprs.set(m[1], m[2].trim())
  }
  for (const e of clean.matchAll(/\benum\b[^{]*\{([\s\S]*?)\}/g)) {
    let prev = null
    for (const rawItem of e[1].replace(/\/\/.*$/gm, '').split(',')) {
      const it = rawItem.trim()
      if (!it || it.startsWith('#')) continue
      const m = /^(\w+)\s*(?:=\s*(.+))?$/.exec(it)
      if (!m) continue
      if (!exprs.has(m[1])) exprs.set(m[1], m[2] ?? (prev ? `(${prev} + 1)` : '0'))
      prev = m[1]
    }
  }
  const cache = new Map()
  const evaluate = (name, depth = 0) => {
    if (cache.has(name)) return cache.get(name)
    const expr = exprs.get(name)
    if (expr === undefined || depth > 2000) return undefined
    const js = expr.replace(/\b[A-Za-z_]\w*\b/g, (id) => {
      const v = evaluate(id, depth + 1)
      return v === undefined ? 'NaN' : String(v)
    })
    let value
    if (/^[\d\s+\-*()xXa-fA-F<>|]+$/.test(js)) {
      try {
        value = Function(`"use strict"; return (${js})`)()
      } catch {
        value = undefined
      }
    }
    if (typeof value !== 'number' || Number.isNaN(value)) value = undefined
    cache.set(name, value)
    return value
  }
  return evaluate
}

/** Bloques de script: etiqueta → líneas (hasta la siguiente etiqueta). */
function scriptBlocks(text) {
  const blocks = []
  let current = null
  for (const line of text.split('\n')) {
    const label = /^(\w+)::?\s*(@.*)?$/.exec(line.trim()) // pokeruby: "Etiqueta:: @ 81B1439"
    if (label) {
      current = { label: label[1], lines: [] }
      blocks.push(current)
    } else if (current) {
      current.lines.push(line.trim())
    }
  }
  return blocks
}

for (const g of GAMES) {
  console.log(`== ${g.repo}`)
  const tree = JSON.parse(await fetchText(`https://api.github.com/repos/pret/${g.repo}/git/trees/${g.branch}?recursive=1`, `${g.repo}/tree.json`))
  const paths = tree.tree.map((t) => t.path)
  // pokeemerald: ITEM_TM_<MOVIMIENTO> sale de la lista de include/constants/tms_hms.h.
  const tmsHms = await raw(g, 'include/constants/tms_hms.h')
  const listOf = (macro) => {
    const start = tmsHms.indexOf(`#define ${macro}(F)`)
    if (start < 0) return []
    const body = tmsHms.slice(start).split(/\n\s*\n/)[0]
    return [...body.matchAll(/F\((\w+)\)/g)].map((m) => m[1])
  }
  const aliases = [
    ...listOf('FOREACH_TM').map((mv, i) => `#define ITEM_TM_${mv} (ITEM_TM01 + ${i})`),
    ...listOf('FOREACH_HM').map((mv, i) => `#define ITEM_HM_${mv} (ITEM_HM01 + ${i})`),
  ].join('\n')
  const item = parseDefines((await raw(g, 'include/constants/items.h')) + '\n' + aliases)
  const flag = parseDefines(await raw(g, 'include/constants/flags.h'))

  // Secciones del mapa (= número de lugar de Gen 3 que usa PKHeX para el nombre).
  const secText = await raw(g, 'src/data/region_map/region_map_sections.json')
  let secIndex
  if (secText) {
    const list = JSON.parse(secText).map_sections.map((s) => s.id)
    secIndex = (id) => list.indexOf(id)
  } else {
    // pokeruby: enum en include/constants/region_map_sections.h
    const h = (await raw(g, 'include/constants/region_map_sections.h')) || (await raw(g, 'include/constants/map_sections.h'))
    const ids = [...h.matchAll(/\b(MAPSEC_\w+)\b/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i)
    secIndex = (id) => ids.indexOf(id)
  }

  // Script de "encontrar objeto" → objeto.
  const ballText = await raw(g, g.balls)
  const ballItem = new Map()
  for (const b of scriptBlocks(ballText)) {
    const line = b.lines.find((l) => /^(finditem|giveitem|finditem_std|giveitem_std)\b/.test(l))
    const m = line && /\b(ITEM_\w+)/.exec(line)
    if (m) ballItem.set(b.label, m[1])
  }

  const mapDirs = paths.filter((p) => /^data\/maps\/[^/]+\/map\.json$/.test(p)).map((p) => p.split('/')[2])
  const maps = []
  const entries = [] // [item, map, kind, flag]
  const marts = [] // [map, [items]]
  const missing = new Set()

  await pool(mapDirs, 8, async (dir) => {
    const json = await raw(g, `data/maps/${dir}/map.json`)
    if (!json) return
    const map = JSON.parse(json)
    const sec = secIndex(map.region_map_section)
    const mapIdx = maps.push({ name: map.name, sec }) - 1
    const itemId = (name) => {
      const v = item(name)
      if (v === undefined) missing.add(name)
      return v
    }
    const flagId = (name) => (name && name !== '0' ? (flag(name) ?? -1) : -1)

    for (const o of map.object_events ?? []) {
      const it = ballItem.get(o.script)
      if (!it) continue
      const id = itemId(it)
      if (id) entries.push([id, mapIdx, 0, flagId(o.flag)])
    }
    for (const b of map.bg_events ?? []) {
      if (b.type !== 'hidden_item') continue
      const id = itemId(b.item)
      if (id) entries.push([id, mapIdx, 1, flagId(b.flag)])
    }

    const scripts = await raw(g, `data/maps/${dir}/scripts.inc`)
    if (!scripts) return
    const blocks = scriptBlocks(scripts)
    const byLabel = new Map(blocks.map((b) => [b.label, b]))
    for (const b of blocks) {
      b.lines.forEach((line, i) => {
        // Regalos: giveitem ITEM_X [, n]. El flag es el primer setflag que viene detrás, o el
        // goto_if_set del principio del bloque ("si ya lo tienes…").
        // Esmeralda/Rubí: giveitem. Rojo Fuego: giveitem_msg <texto>, ITEM_X o additem ITEM_X.
        const give = /^(?:giveitem(?:_std)?|additem)\s+(ITEM_\w+)/.exec(line) ?? /^giveitem_msg\s+\w+,\s*(ITEM_\w+)/.exec(line)
        if (give) {
          const id = itemId(give[1])
          if (!id) return
          const after = b.lines.slice(i + 1).find((l) => /^setflag\s+FLAG_/.test(l))
          const before = b.lines.slice(0, i).find((l) => /^goto_if_set\s+FLAG_/.test(l) || /^checkflag\s+FLAG_/.test(l))
          const f = /\b(FLAG_\w+)/.exec(after ?? before ?? '')
          entries.push([id, mapIdx, 2, f ? flagId(f[1]) : -1])
        }
        const mart = /^pokemart\s+(\w+)/.exec(line)
        if (mart) {
          const list = byLabel.get(mart[1])
          const items = []
          for (const l of list?.lines ?? []) {
            const m = /^\.2byte\s+(ITEM_\w+)/.exec(l)
            if (!m || m[1] === 'ITEM_NONE') continue
            const id = itemId(m[1])
            if (id) items.push(id)
          }
          if (items.length) marts.push([mapIdx, items])
        }
      })
    }
  })

  // Quitar duplicados exactos (algunos scripts se repiten en varias etiquetas).
  const seen = new Set()
  const unique = entries.filter((e) => {
    const k = e.join(',')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const out = { version: 1, game: g.key, source: `pret/${g.repo}`, maps, items: unique, marts }
  writeFileSync(resolve(OUT, `${g.key}.json`), JSON.stringify(out))
  const kinds = [0, 1, 2].map((k) => unique.filter((e) => e[2] === k).length)
  const noFlag = unique.filter((e) => e[3] < 0).length
  console.log(`  ${maps.length} mapas · ${kinds[0]} en el suelo · ${kinds[1]} ocultos · ${kinds[2]} regalos (${noFlag} sin flag) · ${marts.length} tiendas`)
  if (missing.size) console.log(`  ⚠ objetos sin número: ${[...missing].slice(0, 10).join(', ')}`)
  if (maps.some((m) => m.sec < 0)) console.log(`  ⚠ mapas sin sección: ${maps.filter((m) => m.sec < 0).slice(0, 5).map((m) => m.name).join(', ')}`)
}
