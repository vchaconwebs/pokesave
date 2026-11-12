// Servidor local para renderizar el vídeo promocional fotograma a fotograma.
// Sirve el repositorio (para las fuentes de web/node_modules) y guarda lo que manda la página:
//   POST /frame?i=N  → promo/out/frames/NNNN.jpg
//   POST /audio      → promo/out/audio.wav
// Uso: node promo/server.mjs  → http://localhost:5199/promo/video.html
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const OUT = resolve(ROOT, 'promo', 'out')
mkdirSync(resolve(OUT, 'frames'), { recursive: true })
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }

createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'POST') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      if (url.pathname === '/frame') writeFileSync(resolve(OUT, 'frames', String(url.searchParams.get('i')).padStart(4, '0') + '.jpg'), body)
      else if (url.pathname === '/audio') writeFileSync(resolve(OUT, 'audio.wav'), body)
      res.end('ok')
    })
    return
  }
  const path = resolve(ROOT, '.' + decodeURIComponent(url.pathname))
  if (!path.startsWith(ROOT + sep) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path))
}).listen(5199, () => console.log('http://localhost:5199/promo/video.html'))
