// Carga perezosa del motor .NET WebAssembly (PKHeX.Core). La interfaz se pinta al
// momento y el motor se descarga en segundo plano. Nada de esto hace peticiones con la
// partida: los bytes solo viajan entre JS y WASM dentro de la pestaña.
import type {
  BagView,
  BoxView,
  DexEdit,
  DexView,
  EditResult,
  GameLists,
  LoadResult,
  PokemonDetail,
  PokemonEdit,
  PokemonExport,
  PouchEdit,
  SlotRef,
  TrainerEdit,
 ItemFinderView } from './types'

interface EngineExports {
  Load(data: Uint8Array, fileName: string, language: string): string
  Summary(language: string): string
  Export(): Uint8Array
  ExportOriginal(): Uint8Array
  PkhexVersion(): string
  Lists(language: string): string
  Box(box: number, language: string): string
  Pokemon(slotJson: string, language: string): string
  SetPokemon(slotJson: string, editJson: string, language: string): string
  SetTrainer(editJson: string, language: string): string
  PreviewPokemon(slotJson: string, editJson: string, language: string): string
  Undo(language: string): string
  Redo(language: string): string
  Bag(language: string): string
  SetPouch(editJson: string, language: string): string
  Dex(language: string): string
  ItemFinder(language: string): string
  EventFlags(idsJson: string): string
  SetDex(editJson: string, language: string): string
  ExportPokemonData(slotJson: string, language: string): Uint8Array
  ExportPokemonInfo(slotJson: string, language: string): string
  ImportPokemonFile(slotJson: string, data: Uint8Array, fileName: string, language: string): string
  ImportShowdown(slotJson: string, text: string, language: string): string
}

export interface Engine {
  load(data: Uint8Array, fileName: string, language: string): LoadResult
  summary(language: string): LoadResult
  exportOriginal(): Uint8Array
  /** Partida editada, con checksums recalculados. */
  exportSave(): Uint8Array
  lists(language: string): GameLists | null
  box(box: number, language: string): BoxView | null
  pokemon(at: SlotRef, language: string): PokemonDetail | null
  setPokemon(at: SlotRef, edit: PokemonEdit, language: string): EditResult
  setTrainer(edit: TrainerEdit, language: string): EditResult
  /** Cómo quedaría el Pokémon con estos cambios, sin tocar la partida. */
  previewPokemon(at: SlotRef, edit: PokemonEdit, language: string): EditResult
  undo(language: string): LoadResult
  redo(language: string): LoadResult
  bag(language: string): BagView | null
  setPouch(edit: PouchEdit, language: string): EditResult
  dex(language: string): DexView | null
  setDex(edit: DexEdit, language: string): EditResult
  /** Fase 4: todos los objetos del juego con cuántos tienes y qué enseña cada MT. */
  itemFinder(language: string): ItemFinderView | null
  /** Flags de evento (objetos recogidos…); null si el juego no los expone. */
  eventFlags(ids: number[]): boolean[] | null
  exportPokemon(at: SlotRef, language: string): { data: Uint8Array; info: PokemonExport } | null
  importPokemonFile(at: SlotRef, data: Uint8Array, fileName: string, language: string): EditResult
  importShowdown(at: SlotRef, text: string, language: string): EditResult
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
  // Contra la página, no contra el módulo: con base relativa ("./", la web servida desde la
  // 3DS) import() la resolvería dentro de /assets/.
  const url = new URL(`${import.meta.env.BASE_URL}_framework/dotnet.js`, document.baseURI).href
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
    exportSave: () => exports.Export(),
    lists: (language) => JSON.parse(exports.Lists(language)) as GameLists | null,
    box: (box, language) => JSON.parse(exports.Box(box, language)) as BoxView | null,
    pokemon: (at, language) => JSON.parse(exports.Pokemon(JSON.stringify(at), language)) as PokemonDetail | null,
    setPokemon: (at, edit, language) =>
      JSON.parse(exports.SetPokemon(JSON.stringify(at), JSON.stringify(edit), language)) as EditResult,
    previewPokemon: (at, edit, language) =>
      JSON.parse(exports.PreviewPokemon(JSON.stringify(at), JSON.stringify(edit), language)) as EditResult,
    undo: (language) => parse(exports.Undo(language)),
    redo: (language) => parse(exports.Redo(language)),
    bag: (language) => JSON.parse(exports.Bag(language)) as BagView | null,
    setPouch: (edit, language) => JSON.parse(exports.SetPouch(JSON.stringify(edit), language)) as EditResult,
    dex: (language) => JSON.parse(exports.Dex(language)) as DexView | null,
    setDex: (edit, language) => JSON.parse(exports.SetDex(JSON.stringify(edit), language)) as EditResult,
    itemFinder: (language) => JSON.parse(exports.ItemFinder(language)) as ItemFinderView | null,
    eventFlags: (ids) => JSON.parse(exports.EventFlags(JSON.stringify(ids))) as boolean[] | null,
    exportPokemon: (at, language) => {
      const info = JSON.parse(exports.ExportPokemonInfo(JSON.stringify(at), language)) as PokemonExport | null
      return info ? { info, data: exports.ExportPokemonData(JSON.stringify(at), language) } : null
    },
    importPokemonFile: (at, data, fileName, language) =>
      JSON.parse(exports.ImportPokemonFile(JSON.stringify(at), data, fileName, language)) as EditResult,
    importShowdown: (at, text, language) =>
      JSON.parse(exports.ImportShowdown(JSON.stringify(at), text, language)) as EditResult,
    setTrainer: (edit, language) => JSON.parse(exports.SetTrainer(JSON.stringify(edit), language)) as EditResult,
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
