import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encountersFor, howToGet, itemName, seasonFor, type BwData, type Progress } from './assistant'

// Los datos reales que se publican con la web.
const data = JSON.parse(readFileSync(resolve(__dirname, '../public/data/bw.json'), 'utf8')) as BwData

const all: Progress = { badges: 8, postgame: true }
const start: Progress = { badges: 0, postgame: false }

describe('estación de Blanco/Negro', () => {
  it('cambia cada mes y se repite cada 4', () => {
    expect(seasonFor(new Date(2026, 0, 15))).toBe('spring')
    expect(seasonFor(new Date(2026, 1, 15))).toBe('summer')
    expect(seasonFor(new Date(2026, 2, 15))).toBe('autumn')
    expect(seasonFor(new Date(2026, 3, 15))).toBe('winter')
    expect(seasonFor(new Date(2026, 10, 11))).toBe('autumn')
  })
})

describe('cómo se consigue cada Pokémon', () => {
  it('Snivy es el regalo inicial en Pueblo Arcilla', () => {
    const h = howToGet(data, 495, 'W', start, 'spring')
    expect(h.kind).toBe('wild')
    expect(h.available).toBe(true)
    expect(h.encounters[0].method).toBe('gift')
    expect(h.encounters[0].location.es).toBe('Pueblo Arcilla')
  })

  it('exclusivos de versión: Solosis en Blanco, Gothita en Negro', () => {
    expect(howToGet(data, 577, 'W', all, 'spring').kind).toBe('wild')
    expect(howToGet(data, 574, 'W', all, 'spring').kind).toBe('other-version')
    expect(howToGet(data, 574, 'B', all, 'spring').kind).toBe('wild')
  })

  it('Reshiram en Blanco es de la otra versión; Zekrom sí está', () => {
    expect(howToGet(data, 643, 'W', all, 'spring').kind).toBe('other-version')
    expect(howToGet(data, 644, 'W', all, 'spring').kind).toBe('wild')
  })

  it('Thundurus vaga por Teselia en Blanco después de la Liga', () => {
    const h = howToGet(data, 642, 'W', all, 'spring')
    expect(h.kind).toBe('wild')
    expect(h.encounters[0].method).toBe('roaming-grass')
    expect(howToGet(data, 642, 'W', { badges: 8, postgame: false }, 'spring').available).toBe(false)
    expect(howToGet(data, 641, 'W', all, 'spring').kind).toBe('other-version')
  })

  it('evoluciones: Serperior solo evolucionando a Servine (nivel 36)', () => {
    const h = howToGet(data, 497, 'W', all, 'spring')
    expect(h.kind).toBe('evolve')
    expect(h.evolveFrom).toBe(496)
    expect(h.evolution?.lvl).toBe(36)
    expect(h.available).toBe(true)
  })

  it('salvaje que además evoluciona: Jellicent (también de Frillish a nivel 40)', () => {
    const h = howToGet(data, 593, 'W', all, 'spring')
    expect(h.kind).toBe('wild')
    expect(h.evolveFrom).toBe(592)
    expect(h.evolution?.lvl).toBe(40)
  })

  it('evolución por intercambio: Escavalier con Shelmet', () => {
    const h = howToGet(data, 589, 'W', all, 'spring')
    expect(h.kind).toBe('evolve')
    expect(h.trade).toBe(true)
    expect(h.evolution?.with).toBe(616)
  })

  it('eventos: Victini, Zorua y Genesect', () => {
    for (const s of [494, 570, 649]) expect(howToGet(data, s, 'W', all, 'spring').kind).toBe('event')
  })

  it('Pokémon de otras regiones sin encuentros: Pokétransfer', () => {
    expect(howToGet(data, 1, 'W', all, 'spring').kind).toBe('transfer') // Bulbasaur
  })

  it('todas las especies de Teselia tienen una forma de conseguirse', () => {
    for (let s = 494; s <= 649; s++) expect(howToGet(data, s, 'W', all, 'spring').kind, `#${s}`).not.toBe('unknown')
  })
})

describe('progreso', () => {
  it('surfear pide 6 medallas aunque el lugar sea del principio', () => {
    // Basculin se pesca/surfea en Ciudad Gres (0 medallas), pero Surf llega tras la 6.ª.
    const enc = encountersFor(data, 550, 'W', { badges: 5, postgame: false }, 'spring')
    const surf = enc.find((e) => e.method.startsWith('surf') && e.location.key === 'striaton-city')!
    expect(surf.needs).toBe(6)
    expect(surf.available).toBe(false)
    const later = encountersFor(data, 550, 'W', { badges: 6, postgame: false }, 'spring')
    expect(later.find((e) => e.method.startsWith('surf') && e.location.key === 'striaton-city')!.available).toBe(true)
  })

  it('la Supercaña solo después de la Liga', () => {
    const enc = encountersFor(data, 550, 'W', { badges: 8, postgame: false }, 'spring')
    expect(enc.filter((e) => e.method.includes('rod')).every((e) => !e.available)).toBe(true)
  })

  it('los encuentros de otra estación no cuentan como disponibles', () => {
    const enc = encountersFor(data, 585, 'W', all, 'spring') // Deerling
    const winter = enc.filter((e) => e.season === 'winter')
    expect(winter.length).toBeGreaterThan(0)
    expect(winter.every((e) => !e.available)).toBe(true)
  })
})

describe('datos', () => {
  it('no hay áreas de otros juegos (Game Freak HQ de N2B2, base del Team Flare de XY)', () => {
    const keys = data.locations.map((l) => l.key)
    expect(keys).not.toContain('team-flare-secret-hq')
    expect(data.species['570'].enc).toBeUndefined()
  })

  it('todos los lugares tienen medallas y nombre', () => {
    for (const l of data.locations) {
      expect(l.badges).toBeGreaterThanOrEqual(0)
      expect(l.badges).toBeLessThanOrEqual(9)
      expect(l.es.length).toBeGreaterThan(0)
    }
  })

  it('objetos de evolución en español', () => {
    expect(itemName('dusk-stone', 'es')).toBe('Piedra Noche')
    expect(itemName('dusk-stone', 'en')).toBe('Dusk Stone')
  })
})
