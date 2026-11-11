import { useEffect, useMemo, useState } from 'react'
import type { Engine } from '../engine'
import { useI18n, type Key } from '../i18n'
import { spriteStillUrl } from '../theme'
import { encountersFor, loadGameData, versionName, type AssistantGame, type BwData } from '../assistant'
import { buildSpots, flagIds, itemDataKey, loadItemData, type ItemSpot } from '../items'
import { groupByPlace, loadJson, locationsFileFor, regionMapsFor, type RegionMap } from '../regionMap'
import { PokeBall } from './visuals'

interface Loaded {
  maps: Record<string, RegionMap>
  names: { Es: string; En: string }[]
  game: BwData | null
  spots: ItemSpot[] | null
  /** Lugar (número de PKHeX) de cada mapa de objetos. */
  secOfMap: number[]
}

const CELL = 22

/**
 * Fase 5: mapa de la región dibujado por nosotros, con lo que te falta en cada sitio
 * (objetos sin coger y Pokémon sin capturar). Toca una casilla para ver el detalle.
 */
export function MapPanel({ engine, gameId, game, version }: { engine: Engine; gameId: string; game: AssistantGame | null; version: number }) {
  const { t, lang } = useI18n()
  const regions = regionMapsFor(gameId)
  const [region, setRegion] = useState(regions[0])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [personal, setPersonal] = useState(true)

  // Versión del asistente: la de la partida o la que el usuario eligió allí.
  const dexVersion = useMemo(() => {
    if (!game) return null
    if (game.version) return game.version
    try {
      const saved = localStorage.getItem(`pokesave.version.${game.group}`)
      if (saved && game.versions.includes(saved)) return saved
    } catch {
      /* sin almacenamiento */
    }
    return game.versions[0]
  }, [game])

  useEffect(() => {
    let alive = true
    const key = itemDataKey(gameId)
    Promise.all([
      Promise.all(regions.map((r) => loadJson<RegionMap>(`maps/${r}.json`))),
      loadJson<{ Es: string; En: string }[]>(`items/${locationsFileFor(gameId)}`),
      game ? loadGameData(game.group) : Promise.resolve(null),
      key ? loadItemData(key) : Promise.resolve(null),
    ]).then(
      ([maps, names, gameData, items]) => {
        if (!alive) return
        let spots: ItemSpot[] | null = null
        let secOfMap: number[] = []
        if (items) {
          const ids = flagIds(items.data)
          const values = engine.eventFlags(ids) ?? []
          spots = buildSpots(items.data, items.locations, new Map(ids.map((id, i) => [id, values[i] ?? false])), lang)
          secOfMap = items.data.maps.map((m) => m.sec)
        }
        setLoaded({ maps: Object.fromEntries(regions.map((r, i) => [r, maps[i]])), names, game: gameData, spots, secOfMap })
      },
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, gameId, game?.group, lang, version])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dex = useMemo(() => engine.dex(lang), [engine, lang, version])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const finder = useMemo(() => engine.itemFinder(lang), [engine, lang, version])

  const places = useMemo(() => {
    if (!loaded) return new Map()
    const itemNames = new Map(finder?.items.map((i) => [i.id, i.name]) ?? [])
    const items = (loaded.spots ?? [])
      .filter((s) => s.kind !== 'mart' && (!personal || s.collected === false))
      .map((s) => ({ place: loaded.secOfMap[s.map], value: { name: itemNames.get(s.item) ?? `#${s.item}`, spot: s } }))
    const pokemon: { place: number; value: number }[] = []
    if (loaded.game && dex && dexVersion) {
      for (const e of dex.entries) {
        if (personal && e.caught) continue
        for (const enc of encountersFor(loaded.game, e.species, dexVersion, { badges: 8, postgame: true }, 'spring')) {
          if (enc.location.id !== undefined) pokemon.push({ place: enc.location.id, value: e.species })
        }
      }
    }
    return groupByPlace(items, pokemon)
  }, [loaded, finder, dex, dexVersion, personal])

  if (failed) return <p className="dialog dialog--error">{t('asLoadError')}</p>
  if (!loaded) {
    return (
      <div className="assist__loading">
        <PokeBall size={56} shake />
      </div>
    )
  }

  const map = loaded.maps[region]
  const nameOf = (id: number) => (lang === 'es' ? loaded.names[id]?.Es : loaded.names[id]?.En) ?? `#${id}`
  const countOf = (id: number) => {
    const p = places.get(id)
    return p ? p.items.length + p.pokemon.length : 0
  }
  const max = Math.max(1, ...map.cells.map((c) => countOf(c[0])))
  const sel = selected !== null ? places.get(selected) : null
  const speciesName = (s: number) => dex?.entries.find((e) => e.species === s)?.name ?? `#${s}`

  return (
    <section className="map-panel" aria-label={t('navMap')}>
      <div className="assist__controls">
        {regions.length > 1 && (
          <div className="chips" role="tablist">
            {regions.map((r) => (
              <button key={r} type="button" role="tab" aria-selected={region === r} className={`chip${region === r ? ' is-on' : ''}`} onClick={() => setRegion(r)}>
                {t(`map_${r}` as Key)}
              </button>
            ))}
          </div>
        )}
        <label className="switch">
          <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
          <span className="switch__track" aria-hidden="true" />
          {t('mapPersonal')}
        </label>
        <p className="muted assist__note">
          {t('mapHelp')}
          {dexVersion && ` ${t('mapVersion', { v: versionName(dexVersion, lang) })}`}
        </p>
      </div>

      <div className="map-panel__frame">
        <svg className="region-map" viewBox={`0 0 ${map.width * CELL} ${map.height * CELL}`} role="img" aria-label={t(`map_${region}` as Key)}>
          {map.cells.map(([id, x, y], i) => {
            const n = countOf(id)
            const heat = n / max
            const isSel = selected === id
            const common = {
              className: `region-map__cell${n ? ' has-todo' : ''}${isSel ? ' is-selected' : ''}`,
              style: { ['--heat' as string]: heat.toFixed(2) },
              onClick: () => setSelected(isSel ? null : id),
            }
            return map.kind === 'points' ? (
              <circle key={i} cx={x * CELL + CELL / 2} cy={y * CELL + CELL / 2} r={CELL * 0.42} {...common}>
                <title>{`${nameOf(id)}${n ? ` · ${n}` : ''}`}</title>
              </circle>
            ) : (
              <rect key={i} x={x * CELL + 1} y={y * CELL + 1} width={CELL - 2} height={CELL - 2} rx={4} {...common}>
                <title>{`${nameOf(id)}${n ? ` · ${n}` : ''}`}</title>
              </rect>
            )
          })}
        </svg>
      </div>

      {selected !== null && (
        <div className="assist-place map-panel__detail">
          <div className="assist-place__head">
            <h4>{nameOf(selected)}</h4>
            <button type="button" className="btn btn--sm" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          {!sel || (sel.items.length === 0 && sel.pokemon.length === 0) ? (
            <p className="muted">{personal ? t('mapNothingLeft') : t('mapNothing')}</p>
          ) : (
            <>
              {sel.pokemon.length > 0 && (
                <>
                  <p className="field__label">{t('mapPokemon', { n: sel.pokemon.length })}</p>
                  <ul className="assist-place__mons">
                    {sel.pokemon.map((s: number) => {
                      const url = spriteStillUrl(s, false)
                      return (
                        <li key={s}>
                          {url && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                          <span>{speciesName(s)}</span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {sel.items.length > 0 && (
                <>
                  <p className="field__label">{t('mapItems', { n: sel.items.length })}</p>
                  <ul className="finder-spots">
                    {sel.items.map((it: { name: string; spot: ItemSpot }, i: number) => (
                      <li key={i} className={`finder-spot${it.spot.collected ? ' is-done' : ''}`}>
                        <b>{it.name}</b>
                        <span>
                          {t(`fiKind_${it.spot.kind}` as Key)}
                          {it.spot.detail && <small> ({it.spot.detail})</small>}
                        </span>
                        {it.spot.collected === true && <span className="finder-spot__state">✓ {t('fiDone')}</span>}
                        {it.spot.collected === false && <span className="finder-spot__state is-pending">{t('fiPending')}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
      <p className="muted assist__source">{t('mapSource')}</p>
    </section>
  )
}
