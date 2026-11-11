// Cliente mínimo de PokéAPI con caché en disco (tools/.cache, en .gitignore).
// PokéAPI pide cachear: cada recurso se descarga una sola vez.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CACHE = resolve(here, '.cache')
const BASE = 'https://pokeapi.co/api/v2/'
const UA = 'PokeSave-data-builder (open-source fan project)'

mkdirSync(CACHE, { recursive: true })

export async function get(path) {
  const key = path.replace(/^https:\/\/pokeapi\.co\/api\/v2\//, '').replace(/\/$/, '')
  const file = resolve(CACHE, key.replace(/[\\/:?=&]/g, '_') + '.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(BASE + key, { headers: { 'User-Agent': UA } })
      if (res.status === 404) {
        writeFileSync(file, 'null')
        return null
      }
      if (!res.ok) throw new Error(`${res.status} ${key}`)
      const json = await res.json()
      writeFileSync(file, JSON.stringify(json))
      return json
    } catch (err) {
      if (attempt >= 4) throw err
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
}

/** Ejecuta `fn` sobre `items` con como mucho `limit` peticiones a la vez. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  let done = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
        if (++done % 100 === 0) process.stdout.write(`  ${done}/${items.length}\n`)
      }
    }),
  )
  return out
}

export const idFromUrl = (url) => Number(url.split('/').filter(Boolean).pop())
export { dirname }
