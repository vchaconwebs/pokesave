// Simulador de PokeSave Link (el homebrew de 3DS) para probar la web sin consola.
// Sirve dist-3ds/ (npm run build:3ds) y la misma API que la 3DS:
//   GET /api/info, GET /api/save, POST /api/save (cabecera X-PokeSave-Pin)
// Uso: node scripts/mock-3ds.mjs <partida> [puerto]   → http://localhost:8000
// Lo que se "guarda en la 3DS" se escribe en <partida>.guardada (nunca toca el original).
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const [file, port = '8000'] = process.argv.slice(2)
if (!file) throw new Error('Uso: node scripts/mock-3ds.mjs <partida> [puerto]')
const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', 'dist-3ds')
const PIN = '1234'
let save = readFileSync(file)

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' }

createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0]
  if (url === '/api/info') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ app: 'PokeSave Link', game: 'SD', file: file.split(/[\\/]/).pop(), size: save.length }))
  if (url === '/api/save' && req.method === 'GET') return res.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end(save)
  if (url === '/api/save' && req.method === 'POST') {
    if (req.headers['x-pokesave-pin'] !== PIN) return res.writeHead(403).end('{"error":"pin"}')
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      if (body.length !== save.length) return res.writeHead(400).end('{"error":"size"}')
      save = body
      writeFileSync(`${file}.guardada`, body)
      console.log(`Guardada (${body.length} bytes) → ${file}.guardada`)
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}')
    })
    return
  }
  let path = resolve(ROOT, '.' + decodeURIComponent(url))
  if (!path.startsWith(ROOT)) return res.writeHead(400).end()
  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html')
  if (!existsSync(path) || !path.startsWith(ROOT + sep)) return res.writeHead(404).end('404')
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path))
}).listen(Number(port), () => console.log(`PokeSave Link simulado en http://localhost:${port} (PIN ${PIN})`))
