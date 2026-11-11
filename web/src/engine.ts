// Carga perezosa del motor .NET WebAssembly (PKHeX.Core). La interfaz se pinta al
// momento y el motor se descarga en segundo plano. Nada de esto hace peticiones con la
// partida: los bytes solo viajan entre JS y WASM dentro de la pestaña.
import type { LoadResult } from './types'

interface EngineExports {
  Load(data: Uint8Array, fileName: string, language: string): string
  Summary(language: string): string
  Export(): Uint8Array
  ExportOriginal(): Uint8Array
  PkhexVersion(): string
}

export interface Engine {
  load(data: Uint8Array, fileName: string, language: string): LoadResult
  summary(language: string): LoadResult
  exportOriginal(): Uint8Array
  pkhexVersion: string
  loadMs: number
}

export type Progress = { loaded: number; total: number }

let pending: Promise<Engine> | null = null

export function loadEngine(onProgress?: (p: Progress) => void): Promise<Engine> {
  pending ??= start(onProgress).catch((err) => {
    pending = null // permite reintentar
    throw err
  })
  return pending
}

async function start(onProgress?: (p: Progress) => void): Promise<Engine> {
  const t0 = performance.now()
  const url = `${import.meta.env.BASE_URL}_framework/dotnet.js`
  const mod = await import(/* @vite-ignore */ url)
  // withModuleConfig existe en el runtime aunque no aparezca en dotnet.d.ts de .NET 10.
  const runtime = await mod.dotnet
    .withModuleConfig({
      onDownloadResourceProgress: (loaded: number, total: number) => onProgress?.({ loaded, total }),
    })
    .withResourceLoader(loadCompressed)
    .create()
  const exports = (await runtime.getAssemblyExports('PokeSave.Wasm.dll')).Engine as EngineExports
  const parse = (json: string) => JSON.parse(json) as LoadResult

  return {
    load: (data, fileName, language) => parse(exports.Load(data, fileName, language)),
    summary: (language) => parse(exports.Summary(language)),
    exportOriginal: () => exports.ExportOriginal(),
    pkhexVersion: exports.PkhexVersion(),
    loadMs: Math.round(performance.now() - t0),
  }
}

/**
 * Algunos hostings estáticos (GitHub Pages) no sirven los .br/.gz precomprimidos que genera
 * .NET, así que se descargarían ~20 MB sin comprimir. Pedimos nosotros el .gz y lo
 * descomprimimos con DecompressionStream (~5 MB). Si algo falla, se usa la URL normal.
 */
function loadCompressed(type: string, _name: string, defaultUri: string): Promise<Response> | undefined {
  if ((type !== 'assembly' && type !== 'dotnetwasm') || typeof DecompressionStream === 'undefined') return undefined
  const contentType = type === 'dotnetwasm' ? 'application/wasm' : 'application/octet-stream'
  const [path, query] = defaultUri.split('?')
  const gzUri = `${path}.gz${query ? `?${query}` : ''}`

  return fetch(gzUri)
    .then((res) => {
      if (!res.ok || !res.body) throw new Error(`${res.status} ${gzUri}`)
      // Si el servidor ya lo marca como Content-Encoding: gzip, el navegador lo ha descomprimido.
      const body = /gzip/i.test(res.headers.get('content-encoding') ?? '')
        ? res.body
        : res.body.pipeThrough(new DecompressionStream('gzip'))
      return new Response(body, { headers: { 'Content-Type': contentType } })
    })
    .catch(() => fetch(defaultUri))
}

export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' })
  const href = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
