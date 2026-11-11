import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bounds, groupByPlace, regionMapsFor, type RegionMap } from './regionMap'

const map = (name: string) => JSON.parse(readFileSync(resolve(__dirname, `../public/data/maps/${name}.json`), 'utf8')) as RegionMap

describe('mapas de región (Fase 5)', () => {
  it('cada juego tiene sus mapas', () => {
    expect(regionMapsFor('E')).toEqual(['hoenn'])
    expect(regionMapsFor('FR')).toContain('sevii-123')
    expect(regionMapsFor('C')).toEqual(['johto', 'kanto-gsc'])
    expect(regionMapsFor('W')).toEqual([])
  })

  it('Hoenn: Villa Raíz (0) al sur de la Ruta 101 (16)', () => {
    const h = map('hoenn')
    const root = bounds(h, 0)!
    const r101 = bounds(h, 16)!
    expect(root.y).toBeGreaterThan(r101.y)
  })

  it('Kanto de Rojo Fuego: Pueblo Paleta (88) está en el mapa', () => {
    expect(bounds(map('kanto-frlg'), 88)).not.toBeNull()
  })

  it('Johto: Pueblo Primavera (1) al este de Ciudad Cerezo (3)', () => {
    const j = map('johto')
    expect(bounds(j, 1)!.x).toBeGreaterThan(bounds(j, 3)!.x)
  })

  it('agrupa por lugar sin repetir Pokémon', () => {
    const g = groupByPlace([{ place: 5, value: 'Poción' }], [
      { place: 5, value: 25 },
      { place: 5, value: 25 },
    ])
    expect(g.get(5)).toEqual({ id: 5, items: ['Poción'], pokemon: [25] })
  })
})
