import { describe, expect, it } from 'vitest'
import { decodeTeam, encodeTeam, teamFromHash, type SharedTeam } from './share'

const team: SharedTeam = {
  v: 1,
  game: 'Blanco',
  gameId: 'W',
  trainer: 'ASH',
  mons: [
    { s: 25, n: 'Pikachu', l: 30, ty: [[12, 'Eléctrico']], mv: [['Impactrueno', 12]] },
    { s: 6, n: 'Charizard', l: 50, sh: 1, it: 'Restos', ty: [[9, 'Fuego'], [2, 'Volador']], mv: [['Lanzallamas', 9]] },
  ],
}

describe('compartir equipo (Fase 6)', () => {
  it('ida y vuelta por el enlace', async () => {
    const enc = await encodeTeam(team)
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/) // seguro para una URL
    expect(await decodeTeam(enc)).toEqual(team)
  })

  it('un enlace roto o manipulado no se muestra', async () => {
    expect(await decodeTeam('esto-no-es-un-equipo')).toBeNull()
    const bad = await encodeTeam({ ...team, mons: [{ ...team.mons[0], s: 99999 }] })
    expect(await decodeTeam(bad)).toBeNull()
  })

  it('lee el equipo del #team= de la dirección', () => {
    expect(teamFromHash('#team=abc')).toBe('abc')
    expect(teamFromHash('#otra')).toBeNull()
  })
})
