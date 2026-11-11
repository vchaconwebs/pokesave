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
  const runtime = await mod.default({
    onDownloadResourceProgress: (loaded: number, total: number) => onProgress?.({ loaded, total }),
  })
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

export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' })
  const href = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href, download: fileName })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
