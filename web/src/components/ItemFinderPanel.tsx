import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Engine } from '../engine'
import type { FinderItem } from '../types'
import { useI18n, type Key } from '../i18n'
import { typeColor, typeInk } from '../theme'
import { buildSpots, flagIds, itemDataKey, loadItemData, spotsByItem, type ItemSpot } from '../items'
import { PokeBall } from './visuals'

type Tab = 'all' | 'tm' | 'map'

const KIND_ICON: Record<ItemSpot['kind'], string> = { ground: '🔴', hidden: '✨', gift: '🎁', mart: '🛒' }

/** Fase 4: buscador de objetos y MT; en Gen 3, también dónde está cada uno y si ya lo cogiste. */
export function ItemFinderPanel({ engine, gameId, version }: { engine: Engine; gameId: string; version: number }) {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [spots, setSpots] = useState<ItemSpot[] | null>(null)
  const [failed, setFailed] = useState(false)
  const key = itemDataKey(gameId)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const finder = useMemo(() => engine.itemFinder(lang), [engine, lang, version])

  useEffect(() => {
    if (!key) return
    let alive = true
    loadItemData(key).then(
      ({ data, locations }) => {
        if (!alive) return
        const ids = flagIds(data)
        const values = engine.eventFlags(ids) ?? []
        const flags = new Map(ids.map((id, i) => [id, values[i] ?? false]))
        setSpots(buildSpots(data, locations, flags, lang))
      },
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [engine, key, lang, version])

  const byItem = useMemo(() => (spots ? spotsByItem(spots) : new Map<number, ItemSpot[]>()), [spots])

  if (!finder) return <p className="dialog dialog--error">{t('err_input')}</p>
  if (key && !spots && !failed) {
    return (
      <div className="assist__loading">
        <PokeBall size={56} shake />
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const matches = (it: FinderItem) => !q || it.name.toLowerCase().includes(q) || (it.moveName?.toLowerCase().includes(q) ?? false)
  const machines = finder.items.filter((i) => i.move !== null).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const missingTms = machines.filter((m) => m.count === 0).length
  const pending = spots?.filter((s) => s.collected === false).length ?? 0
  const known = spots?.filter((s) => s.collected !== null).length ?? 0

  const list = (tab === 'tm' ? machines : finder.items).filter((it) => matches(it) && (!onlyMissing || it.count === 0))

  return (
    <section className="finder" aria-label={t('navItems')}>
      <div className="finder__stats">
        <div className="lcd__screen">
          <span className="px lcd__value">
            {machines.length - missingTms}/{machines.length}
          </span>
          <span className="lcd__sub">{t('fiTms')}</span>
        </div>
        {spots && (
          <div className="lcd__screen">
            <span className="px lcd__value">
              {known - pending}/{known}
            </span>
            <span className="lcd__sub">{t('fiPicked')}</span>
          </div>
        )}
      </div>

      <div className="assist__controls">
        <div className="chips" role="tablist">
          {(['all', 'tm', ...(spots ? ['map'] : [])] as Tab[]).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`chip${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>
              {t(`fiTab_${id}` as Key)}
            </button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          <span className="switch__track" aria-hidden="true" />
          {tab === 'map' ? t('fiOnlyPending') : t('fiOnlyMissing')}
        </label>
        <input className="input" type="search" placeholder={t('fiSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />
        {!key && <p className="muted assist__note">{t('fiNoMapData')}</p>}
        {failed && <p className="dialog dialog--error">{t('asLoadError')}</p>}
      </div>

      {tab === 'map' && spots ? (
        <MapView spots={spots} items={finder.items} onlyPending={onlyMissing} query={q} />
      ) : list.length === 0 ? (
        <p className="dialog">{t('fiNone')}</p>
      ) : (
        <ul className="finder__list">
          {list.slice(0, 300).map((it) => (
            <ItemRow key={it.id} it={it} spots={byItem.get(it.id) ?? []} />
          ))}
        </ul>
      )}
      {list.length > 300 && tab !== 'map' && <p className="muted">{t('fiMore', { n: list.length - 300 })}</p>}
      {spots && <p className="muted assist__source">{t('fiSource')}</p>}
    </section>
  )
}

function ItemRow({ it, spots }: { it: FinderItem; spots: ItemSpot[] }) {
  const { t } = useI18n()
  const shown = spots.slice(0, 6)
  return (
    <li className={`finder-item${it.count > 0 ? ' is-owned' : ''}`}>
      <div className="finder-item__head">
        <span className="finder-item__name">{it.name}</span>
        {it.moveName && (
          <span className="finder-item__move" style={{ background: typeColor(it.moveType ?? 0), color: typeInk(it.moveType ?? 0) } as CSSProperties}>
            {it.moveName}
          </span>
        )}
        <span className="finder-item__pouch">{t(`pouch_${it.pouch}` as Key) ?? it.pouch}</span>
        <span className={`finder-item__count${it.count > 0 ? '' : ' is-zero'}`}>{it.count > 0 ? `×${it.count}` : t('fiNotOwned')}</span>
      </div>
      {shown.length > 0 && (
        <ul className="finder-spots">
          {shown.map((s, i) => (
            <SpotRow key={i} s={s} />
          ))}
          {spots.length > shown.length && <li className="muted">{t('fiMoreSpots', { n: spots.length - shown.length })}</li>}
        </ul>
      )}
    </li>
  )
}

function SpotRow({ s, name }: { s: ItemSpot; name?: string }) {
  const { t } = useI18n()
  return (
    <li className={`finder-spot${s.collected ? ' is-done' : ''}`}>
      <span aria-hidden="true">{KIND_ICON[s.kind]}</span>
      {name && <b>{name}</b>}
      <span>
        {t(`fiKind_${s.kind}` as Key)} · {s.place}
        {s.detail && <small> ({s.detail})</small>}
      </span>
      {s.collected === true && <span className="finder-spot__state">✓ {t('fiDone')}</span>}
      {s.collected === false && <span className="finder-spot__state is-pending">{t('fiPending')}</span>}
    </li>
  )
}

/** Por lugar: qué objetos hay en cada sitio (modo personal: solo los que te faltan). */
function MapView({ spots, items, onlyPending, query }: { spots: ItemSpot[]; items: FinderItem[]; onlyPending: boolean; query: string }) {
  const { t } = useI18n()
  const names = useMemo(() => new Map(items.map((i) => [i.id, i.name])), [items])
  const places = useMemo(() => {
    const map = new Map<string, ItemSpot[]>()
    for (const s of spots) {
      if (s.kind === 'mart') continue
      if (onlyPending && s.collected !== false) continue
      const name = names.get(s.item) ?? `#${s.item}`
      if (query && !s.place.toLowerCase().includes(query) && !name.toLowerCase().includes(query)) continue
      const list = map.get(s.place) ?? []
      list.push(s)
      map.set(s.place, list)
    }
    return [...map.entries()].sort((a, b) => b[1].filter((s) => s.collected === false).length - a[1].filter((s) => s.collected === false).length)
  }, [spots, names, onlyPending, query])

  if (places.length === 0) return <p className="dialog">{onlyPending ? t('fiAllPicked') : t('fiNone')}</p>
  return (
    <ul className="assist-places">
      {places.map(([place, list]) => (
        <li key={place} className="assist-place">
          <div className="assist-place__head">
            <h4>{place}</h4>
            <span className="px assist-place__n">{list.filter((s) => s.collected === false).length}</span>
          </div>
          <ul className="finder-spots">
            {list.map((s, i) => (
              <SpotRow key={i} s={s} name={names.get(s.item) ?? `#${s.item}`} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
