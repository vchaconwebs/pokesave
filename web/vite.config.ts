import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.dat': 'application/octet-stream',
}

/**
 * El motor .NET (public/_framework) se carga con import() en tiempo de ejecución. En
 * desarrollo Vite intentaría transformarlo como código fuente y falla, así que lo servimos
 * tal cual antes de que intervenga Vite. En producción se copia como estático normal.
 */
function serveDotnetFramework(): Plugin {
  const root = resolve(__dirname, 'public', '_framework')
  return {
    name: 'pokesave:serve-dotnet-framework',
    configureServer(server) {
      server.middlewares.use('/_framework', (req, res, next) => {
        const path = decodeURIComponent((req.url ?? '/').split('?')[0])
        const file = resolve(root, '.' + path)
        if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(file).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [serveDotnetFramework(), react()],
})
