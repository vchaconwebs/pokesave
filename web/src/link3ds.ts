import { useEffect, useState } from 'react'

// Fase 6 · Integración con la 3DS. Cuando la web se abre desde PokeSave Link (el homebrew de
// 3ds/PokeSaveLink, que sirve esta misma web desde la SD), la consola responde en /api/info.
// Entonces se ofrece cargar la partida de la 3DS y guardarla de vuelta (con el PIN que sale en
// la pantalla de la consola). La app de 3DS hace copias de seguridad antes de cada escritura.

export interface Link3dsInfo {
  app: string
  game: string
  size: number
}

export const api3ds = (path: string) => `${import.meta.env.BASE_URL}api/${path}`

/** ¿Estamos servidos desde PokeSave Link? (En GitHub Pages /api/info no existe.) */
export function useLink3ds(): Link3dsInfo | null {
  const [info, setInfo] = useState<Link3dsInfo | null>(null)
  useEffect(() => {
    // Solo por http (la consola no tiene https): en GitHub Pages ni se intenta.
    if (location.protocol !== 'http:') return
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    fetch(api3ds('info'), { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Link3dsInfo | null) => j?.app === 'PokeSave Link' && setInfo(j))
      .catch(() => {})
      .finally(() => clearTimeout(timer))
    return () => ctrl.abort()
  }, [])
  return info
}

export async function loadFrom3ds(): Promise<File> {
  const r = await fetch(api3ds('save'), { cache: 'no-store' })
  if (!r.ok) throw new Error(`api/save ${r.status}`)
  return new File([await r.arrayBuffer()], 'main')
}
