import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSpots, flagIds, itemDataKey, mapDetail, spotsByItem, type ItemData } from './items'

const load = (f: string) => JSON.parse(readFileSync(resolve(__dirname, `../public/data/items/${f}`), 'utf8'))
const locations = load('gen3-locations.json') as { Es: string; En: string }[]

describe('buscador de objetos (Gen 3)', () => {
  it('elige los datos según el juego de la partida', () => {
    expect(itemDataKey('E')).toBe('e')
    expect(itemDataKey('LG')).toBe('frlg')
    expect(itemDataKey('RS')).toBe('rs')
    expect(itemDataKey('W')).toBeNull()
  })

  it('las MO de Esmeralda están donde se dan en el juego', () => {
    const e = load('e.json') as ItemData
    const by = spotsByItem(buildSpots(e, locations, new Map(), 'es'))
    // MO01 (Corte) = objeto 339 en Gen 3: la da el cortador de Ciudad Férrica.
    expect(by.get(339)?.map((s) => s.place)).toContain('Ciudad Férrica')
    // MO03 (Surf): en casa de Blasco, en Ciudad Petalia.
    expect(by.get(341)?.map((s) => s.place)).toContain('Ciudad Petalia')
  })

  it('marca lo recogido con los flags de la partida', () => {
    const e = load('e.json') as ItemData
    const ids = flagIds(e)
    expect(ids.length).toBeGreaterThan(200)
    const potion = e.items.find((s) => s[0] === 13 && s[2] === 0)! // una Poción en el suelo
    const flags = new Map(ids.map((id) => [id, id === potion[3]]))
    const spots = buildSpots(e, locations, flags, "es")
    const mine = spots.find((s) => s.flag === potion[3] && s.item === 13)!
    expect(mine.collected).toBe(true)
    expect(spots.filter((s) => s.collected === false).length).toBeGreaterThan(0)
  })

  it('Rojo Fuego tiene objetos ocultos y tiendas', () => {
    const fr = load('frlg.json') as ItemData
    const spots = buildSpots(fr, locations, new Map(), 'es')
    expect(spots.some((s) => s.kind === 'hidden')).toBe(true)
    expect(spots.some((s) => s.kind === 'mart' && s.place === 'Ciudad Verde')).toBe(true)
  })

  it('nombre de interiores y plantas', () => {
    expect(mapDetail('GraniteCave_B1F', 'es')).toBe('B1F')
    expect(mapDetail('PetalburgCity_Mart', 'es')).toBe('Tienda')
    expect(mapDetail('Route102', 'es')).toBeNull()
  })
})
