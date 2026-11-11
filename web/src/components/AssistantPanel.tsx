import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Engine } from '../engine'
import type { DexEntry, SaveSummary } from '../types'
import { useI18n, type Key } from '../i18n'
import { spriteStillUrl } from '../theme'
import {
  METHOD_GROUP,
  howToGet,
  itemName,
  loadBwData,
  placeName,
  seasonFor,
  type BwData,
  type BwEvolution,
  type Encounter,
  type How,
  type Season,
  type Version,
} from '../assistant'
import { PokeBall } from './visuals'

type Scope = 'unova' | 'national'
type View = 'pokemon' | 'place'
type Group = 'all' | 'grass' | 'water' | 'fishing' | 'special'

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']
const SEASON_ICON: Record<Season, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' }

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* sin almacenamiento */
    }
  },
}

interface Missing {
  entry: DexEntry
  number: number
  how: How
}

export function AssistantPanel({ engine, save, version, dexVersion }: { engine: Engine; save: SaveSummary; version: Version; dexVersion: number }) {
  const { t, lang } = useI18n()
  const [data, setData] = useState<BwData | null>(null)
  const [failed, setFailed] = useState(false)
  const [scope, setScope] = useState<Scope>('unova')
  const [view, setView] = useState<View>('pokemon')
  const [group, setGroup] = useState<Group>('all')
  const [onlyNow, setOnlyNow] = useState(true)
  const [postgame, setPostgame] = useState(() => store.get('pokesave.postgame') === '1')
  const [season, setSeason] = useState<Season>(() => seasonFor(new Date()))
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadBwData().then(setData, () => setFailed(true))
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dex = useMemo(() => engine.dex(lang), [engine, lang, dexVersion])
  const badges = save.trainer.badges?.earned ?? 0
  const progress = useMemo(() => ({ badges, postgame }), [badges, postgame])

  const missing = useMemo<Missing[]>(() => {
    if (!data || !dex) return []
    return dex.entries
      .filter((e) => !e.caught && (scope === 'national' || (e.species >= 494 && e.species <= 649)))
      .map((entry) => ({
        entry,
        number: scope === 'unova' ? entry.species - 494 : entry.species,
        how: howToGet(data, entry.species, version, progress, season),
      }))
  }, [data, dex, scope, version, progress, season])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return missing.filter((m) => {
      if (onlyNow && !m.how.available) return false
      if (group !== 'all') {
        const enc = encountersOf(m)
        if (!enc.some((e) => METHOD_GROUP[e.method] === group)) return false
      }
      return !q || m.entry.name.toLowerCase().includes(q)
    })
  }, [missing, onlyNow, group, query])

  if (failed) return <p className="dialog dialog--error">{t('asLoadError')}</p>
  if (!data || !dex) {
    return (
      <div className="assist__loading">
        <PokeBall size={56} shake />
      </div>
    )
  }

  const total = scope === 'unova' ? 156 : dex.entries.length
  const canNow = missing.filter((m) => m.how.available).length
  const other = version === 'W' ? t('asBlack') : t('asWhite')

  return (
    <section className="assist" aria-label={t('navAssistant')}>
      <div className="lcd__screen assist__lcd">
        <span className="px lcd__value">{t('asMissing', { n: missing.length, total })}</span>
        <span className="lcd__sub">{t('asCanNow', { n: canNow })}</span>
        <span className="lcd__bar" aria-hidden="true">
          <span style={{ width: `${((total - missing.length) / Math.max(1, total)) * 100}%` }} />
        </span>
      </div>

      <div className="assist__controls">
        <div className="chips" role="group" aria-label={t('navDex')}>
          <Chip on={scope === 'unova'} onClick={() => setScope('unova')} label={t('dex_unova')} />
          <Chip on={scope === 'national'} onClick={() => setScope('national')} label={t('dexNational')} />
          <span className="assist__sep" aria-hidden="true" />
          <Chip on={view === 'pokemon'} onClick={() => setView('pokemon')} label={t('asByPokemon')} />
          <Chip on={view === 'place'} onClick={() => setView('place')} label={t('asByPlace')} />
        </div>

        <div className="assist__switches">
          <label className="switch">
            <input type="checkbox" checked={onlyNow} onChange={(e) => setOnlyNow(e.target.checked)} />
            <span className="switch__track" aria-hidden="true" />
            {t('asOnlyNow')}
          </label>
          <label className="switch switch--gold">
            <input
              type="checkbox"
              checked={postgame}
              onChange={(e) => {
                setPostgame(e.target.checked)
                store.set('pokesave.postgame', e.target.checked ? '1' : '0')
              }}
            />
            <span className="switch__track" aria-hidden="true" />
            {t('asPostgame')}
          </label>
        </div>

        <div className="chips" role="group" aria-label={t('asSeason')}>
          <span className="field__label">{t('asSeason')}</span>
          {SEASONS.map((s) => (
            <Chip key={s} on={season === s} onClick={() => setSeason(s)} label={`${SEASON_ICON[s]} ${t(`season_${s}` as Key)}`} />
          ))}
        </div>

        <div className="chips" role="group" aria-label={t('asMethod')}>
          {(['all', 'grass', 'water', 'fishing', 'special'] as Group[]).map((g) => (
            <Chip key={g} on={group === g} onClick={() => setGroup(g)} label={t(`asGroup_${g}` as Key)} />
          ))}
        </div>

        <input className="input" type="search" placeholder={t('dexSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <p className="muted assist__note">{t('asProgressNote', { n: badges })}</p>
      </div>

      {shown.length === 0 ? (
        <p className="dialog">{missing.length === 0 ? t('asComplete') : t('asNoneNow')}</p>
      ) : view === 'pokemon' ? (
        <ul className="assist__list">
          {shown.map((m) => (
            <MissingCard key={m.entry.species} m={m} dex={dex.entries} other={other} season={season} onlyNow={onlyNow} />
          ))}
        </ul>
      ) : (
        <PlaceView items={shown} onlyNow={onlyNow} group={group} />
      )}

      <p className="muted assist__source">{t('asSource')}</p>
    </section>
  )
}

const encountersOf = (m: Missing) => m.how.encounters

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  )
}

function MissingCard({ m, dex, other, season, onlyNow }: { m: Missing; dex: DexEntry[]; other: string; season: Season; onlyNow: boolean }) {
  const { t, lang } = useI18n()
  const { entry, how } = m
  const url = spriteStillUrl(entry.species, false)
  const encs = (onlyNow ? how.encounters.filter((e) => e.available) : how.encounters).slice(0, 4)
  const preName = how.evolveFrom ? (dex.find((d) => d.species === how.evolveFrom)?.name ?? `#${how.evolveFrom}`) : null

  return (
    <li className={`assist-card assist-card--${how.kind}${how.available ? ' is-now' : ''}`}>
      <div className="assist-card__head">
        {url && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className={entry.seen ? '' : 'is-unseen'} />}
        <div className="assist-card__title">
          <span className="px assist-card__n">{String(m.number).padStart(3, '0')}</span>
          <h4>{entry.name}</h4>
          <span className={`assist-tag assist-tag--${how.kind}`}>
            {how.kind === 'other-version' ? t('asOnlyIn', { v: other }) : t(`asKind_${how.kind}` as Key)}
          </span>
          {entry.seen && <span className="assist-tag assist-tag--seen">{t('dexState_seen')}</span>}
        </div>
      </div>

      {encs.length > 0 && (
        <ul className="assist-enc">
          {encs.map((e, i) => (
            <EncounterRow key={i} e={e} season={season} />
          ))}
        </ul>
      )}
      {how.kind === 'wild' && encs.length === 0 && <p className="muted">{t('asNotYet')}</p>}

      {how.evolveFrom && preName && (
        <p className={`assist-evo${how.kind === 'evolve' ? '' : ' assist-evo--also'}`}>
          {how.kind === 'evolve' ? '' : `${t('asAlso')} `}
          {t('asEvolvesFrom', { name: preName })}: <b>{evolutionText(how.evolution, dex, t, lang)}</b>
          {how.kind === 'evolve' && !how.preAvailable && <span className="muted"> · {t('asPreNotYet')}</span>}
        </p>
      )}
      {how.kind === 'other-version' && <p className="muted">{t('asTradeOther', { v: other })}</p>}
      {how.kind === 'transfer' && <p className="muted">{t('asTransfer')}</p>}
      {how.kind === 'event' && <p className="muted">{t('asEvent')}</p>}
    </li>
  )
}

function EncounterRow({ e, season }: { e: Encounter; season: Season }) {
  const { t, lang } = useI18n()
  const lock = !e.available
  const reason = e.season && e.season !== season ? `${SEASON_ICON[e.season]} ${t(`season_${e.season}` as Key)}` : e.needs >= 9 ? t('asAfterLeague') : t('asNeedsBadges', { n: e.needs })
  return (
    <li className={`assist-enc__row${lock ? ' is-locked' : ''}`} style={{ ['--g' as string]: groupColor(e.method) } as CSSProperties}>
      <span className="assist-enc__method">{t(`method_${e.method}` as Key)}</span>
      <span className="assist-enc__place">{placeName(e.location, lang)}</span>
      {e.note && <span className="assist-enc__note">{t(`note_${e.note}` as Key) ?? e.note}</span>}
      <span className="assist-enc__meta">
        {t('level')}
        {e.min === e.max ? e.min : `${e.min}–${e.max}`}
        {e.chance > 0 && e.chance < 100 && ` · ${e.chance}%`}
        {e.season && ` · ${SEASON_ICON[e.season]}`}
      </span>
      {lock && <span className="assist-enc__lock">🔒 {reason}</span>}
    </li>
  )
}

function PlaceView({ items, onlyNow, group }: { items: Missing[]; onlyNow: boolean; group: Group }) {
  const { t, lang } = useI18n()
  const places = useMemo(() => {
    const map = new Map<string, { name: string; badges: number; mons: { m: Missing; e: Encounter }[] }>()
    for (const m of items) {
      for (const e of m.how.encounters) {
        if (onlyNow && !e.available) continue
        if (group !== 'all' && METHOD_GROUP[e.method] !== group) continue
        const p = map.get(e.location.key) ?? { name: placeName(e.location, lang), badges: e.location.badges, mons: [] }
        if (!p.mons.some((x) => x.m.entry.species === m.entry.species)) p.mons.push({ m, e })
        map.set(e.location.key, p)
      }
    }
    return [...map.values()].sort((a, b) => a.badges - b.badges || b.mons.length - a.mons.length)
  }, [items, onlyNow, group, lang])

  if (places.length === 0) return <p className="dialog">{t('asNoneNow')}</p>
  return (
    <ul className="assist-places">
      {places.map((p) => (
        <li key={p.name} className="assist-place">
          <div className="assist-place__head">
            <h4>{p.name}</h4>
            <span className="px assist-place__n">{p.mons.length}</span>
          </div>
          <ul className="assist-place__mons">
            {p.mons.map(({ m, e }) => {
              const url = spriteStillUrl(m.entry.species, false)
              return (
                <li key={m.entry.species} className={e.available ? '' : 'is-locked'} title={`${t(`method_${e.method}` as Key)} · ${t('level')}${e.min}–${e.max}`}>
                  {url && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                  <span>{m.entry.name}</span>
                  <small>
                    {t(`method_${e.method}` as Key)}
                    {e.chance > 0 && e.chance < 100 ? ` · ${e.chance}%` : ''}
                  </small>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function groupColor(method: string) {
  return { grass: '#4fc46a', water: '#3ba6e0', fishing: '#5c7ad6', special: '#e0b93b' }[METHOD_GROUP[method] ?? 'special']
}

/** Texto de cómo evoluciona: "nivel 36", "con Piedra Noche", "por intercambio con Shelmet"… */
function evolutionText(evo: BwEvolution | undefined, dex: DexEntry[], t: (k: Key, v?: Record<string, string | number>) => string, lang: string) {
  if (!evo) return '—'
  const parts: string[] = []
  if (evo.t === 'trade') {
    parts.push(evo.with ? t('evoTradeWith', { name: dex.find((d) => d.species === evo.with)?.name ?? `#${evo.with}` }) : t('evoTrade'))
  } else if (evo.t === 'use-item' && evo.item) {
    parts.push(t('evoItem', { item: itemName(evo.item, lang) }))
  } else if (evo.lvl) {
    parts.push(t('evoLevel', { n: evo.lvl }))
  } else if (evo.happy) {
    parts.push(t('evoHappy'))
  } else if (evo.t === 'level-up') {
    parts.push(t('evoLevelUp'))
  } else {
    parts.push(t('evoOther'))
  }
  if (evo.held) parts.push(t('evoHeld', { item: itemName(evo.held, lang) }))
  if (evo.move) parts.push(t('evoMove', { move: evo.move.replace(/-/g, ' ') }))
  if (evo.time) parts.push(t(evo.time === 'night' ? 'evoNight' : 'evoDay'))
  return parts.join(', ')
}
