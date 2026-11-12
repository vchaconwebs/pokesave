import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Engine } from '../engine'
import type { BagView as Bag, DexEntry, SaveSummary, SlotRef } from '../types'
import { errorKey, useI18n, type Key } from '../i18n'
import { spriteStillUrl } from '../theme'
import { Combobox, Modal, NumberField } from './controls'
import { Icon, PokeBall } from './visuals'

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Color de cada bolsillo (como las pestañas de la mochila en los juegos). */
const POUCH_COLORS: Record<string, string> = {
  Items: '#ef8a3a',
  KeyItems: '#8a6be0',
  TMHMs: '#3ba6e0',
  Medicine: '#4fc46a',
  Berries: '#e0567a',
  Balls: '#e3242b',
  BattleItems: '#e0b93b',
  MailItems: '#9aa6c4',
  PCItems: '#5c7ad6',
  ZCrystals: '#d6a43b',
  Candy: '#e07ac4',
  Treasure: '#c9a227',
  Ingredients: '#7cb342',
  MegaStones: '#7e57c2',
}

// ---------- Mochila ----------

export function BagPanel({ engine, version, onSaved }: { engine: Engine; version: number; onSaved: (s: SaveSummary) => void }) {
  const { t, lang } = useI18n()
  // `version` cambia tras cada edición o al deshacer: obliga a releer la mochila.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bag = useMemo<Bag | null>(() => engine.bag(lang), [engine, lang, version])
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')

  if (!bag || bag.pouches.length === 0) return null
  const index = Math.min(active, bag.pouches.length - 1)
  const q = normalize(query.trim())

  return (
    <section className="bag" aria-label={t('navBag')}>
      <div className="bag__search">
        <input className="input" type="search" placeholder={t('bagSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {q ? (
        <div className="bag__results">
          {bag.pouches.map((p) => {
            const hits = p.items.filter((i) => normalize(i.name).includes(q))
            if (hits.length === 0) return null
            return (
              <div key={p.type} className="bag__group">
                <p className="px bag__group-title" style={{ ['--p' as string]: POUCH_COLORS[p.type] ?? '#888' } as CSSProperties}>
                  {t(`pouch_${p.type}` as Key)}
                </p>
                <ul className="bag__list">
                  {hits.map((i) => (
                    <li key={i.id} className="bag__row">
                      <span className="bag__name">{i.name}</span>
                      <span className="px bag__count">×{i.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div className="pouches" role="tablist">
            {bag.pouches.map((p, i) => (
              <button
                key={p.type}
                type="button"
                role="tab"
                aria-selected={i === index}
                className="pouch-tab"
                style={{ ['--p' as string]: POUCH_COLORS[p.type] ?? '#888' } as CSSProperties}
                onClick={() => setActive(i)}
              >
                {t(`pouch_${p.type}` as Key)}
                <span className="pouch-tab__n">{p.items.length}</span>
              </button>
            ))}
          </div>
          <PouchEditor key={`${bag.pouches[index].type}-${version}`} engine={engine} pouch={bag.pouches[index]} onSaved={onSaved} />
        </>
      )}
    </section>
  )
}

function PouchEditor({ engine, pouch, onSaved }: { engine: Engine; pouch: Bag['pouches'][number]; onSaved: (s: SaveSummary) => void }) {
  const { t, lang } = useI18n()
  const [items, setItems] = useState(pouch.items)
  const [adding, setAdding] = useState(0)
  // El objeto añadido va al final (como en el juego): se baja hasta él y se resalta un momento.
  const [justAdded, setJustAdded] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (justAdded === null) return
    listRef.current?.querySelector('.is-new')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const id = setTimeout(() => setJustAdded(null), 1600)
    return () => clearTimeout(id)
  }, [justAdded])
  const [error, setError] = useState<string | null>(null)
  const changed = JSON.stringify(items) !== JSON.stringify(pouch.items)
  const available = useMemo(() => pouch.allowed.filter((o) => !items.some((i) => i.id === o.id)), [pouch.allowed, items])
  const single = pouch.maxCount <= 1

  const save = () => {
    const r = engine.setPouch({ type: pouch.type, items: items.map((i) => ({ id: i.id, count: i.count })) }, lang)
    if (r.ok && r.save) onSaved(r.save)
    else setError(r.error)
  }

  return (
    <div className="pouch" style={{ ['--p' as string]: POUCH_COLORS[pouch.type] ?? '#888' } as CSSProperties}>
      <div className="pouch__head">
        <span className="px">{t('bagSlots', { n: items.length, max: pouch.slots })}</span>
      </div>

      {items.length < pouch.slots && available.length > 0 && (
        <div className="pouch__add">
          <Combobox label={t('bagAdd')} options={available} value={adding} noneLabel="—" onChange={setAdding} />
          <button
            type="button"
            className="btn btn--sm"
            disabled={!adding}
            onClick={() => {
              const opt = pouch.allowed.find((o) => o.id === adding)
              if (!opt) return
              setItems([...items, { id: opt.id, name: opt.name, count: 1 }])
              setAdding(0)
              setJustAdded(opt.id)
            }}
          >
            ＋ {t('bagAddButton')}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="pouch__empty">{t('bagEmpty')}</p>
      ) : (
        <ul className="bag__list" ref={listRef}>
          {items.map((i, n) => (
            <li key={i.id} className={`bag__row${i.id === justAdded ? ' is-new' : ''}`}>
              <span className="bag__name">{i.name}</span>
              {!single && (
                <span className="bag__qty">
                  <NumberField
                    label={t('quantity')}
                    value={i.count}
                    min={1}
                    max={pouch.maxCount}
                    onChange={(c) => setItems(items.map((x, j) => (j === n ? { ...x, count: c } : x)))}
                  />
                </span>
              )}
              <button
                type="button"
                className="bag__remove"
                aria-label={t('bagRemove', { name: i.name })}
                onClick={() => setItems(items.filter((_, j) => j !== n))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}


      {(changed || error) && (
        <div className="pouch__foot">
          {error ? (
            <p className="ed__error" role="alert">
              <Icon name="alert" /> {t(errorKey(error))}
            </p>
          ) : (
            <p className="muted">{t('bagUnsaved')}</p>
          )}
          <div className="ed__actions">
            <button type="button" className="btn btn--sm" onClick={() => { setItems(pouch.items); setError(null) }}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btn--red btn--sm" onClick={save} disabled={!changed}>
              <Icon name="check" /> {t('bagSave')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Pokédex ----------

type DexFilter = 'all' | 'caught' | 'seen' | 'missing'

export function DexPanel({ engine, version, onSaved }: { engine: Engine; version: number; onSaved: (s: SaveSummary) => void }) {
  const { t, lang } = useI18n()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dex = useMemo(() => engine.dex(lang), [engine, lang, version])
  const [filter, setFilter] = useState<DexFilter>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Pokédex elegida: la regional del juego por defecto, o la Nacional.
  const [chosen, setChosen] = useState<string | null>(null)
  const region = chosen === 'national' ? null : (dex?.regions.find((r) => r.key === chosen) ?? dex?.regions[0] ?? null)

  // Entradas de la Pokédex elegida, con su número (regional o nacional).
  const book = useMemo(() => {
    if (!dex) return []
    if (!region) return dex.entries.map((e) => ({ ...e, number: e.species }))
    const bySpecies = new Map(dex.entries.map((e) => [e.species, e]))
    return region.entries.flatMap((r) => {
      const e = bySpecies.get(r.species)
      return e ? [{ ...e, number: r.number }] : []
    })
  }, [dex, region])

  const shown = useMemo(() => {
    const q = normalize(query.trim())
    return book.filter((e) => {
      if (filter === 'caught' && !e.caught) return false
      if (filter === 'seen' && (!e.seen || e.caught)) return false
      if (filter === 'missing' && e.caught) return false
      return !q || normalize(e.name).includes(q) || String(e.number) === q || String(e.species) === q
    })
  }, [book, filter, query])

  if (!dex) return null
  const caught = book.filter((e) => e.caught).length
  const seen = book.filter((e) => e.seen).length
  const total = book.length
  // Las acciones en bloque se aplican a la Pokédex que se está viendo.
  const scope = region ? book.map((e) => e.species) : []

  const apply = (species: number[], s: boolean, c: boolean) => {
    const r = engine.setDex({ species, seen: s, caught: c }, lang)
    if (r.ok && r.save) {
      setError(null)
      onSaved(r.save)
    } else setError(r.error)
  }

  const cycle = (e: DexEntry) => {
    if (!dex.editable) return
    if (e.caught) apply([e.species], false, false)
    else if (e.seen) apply([e.species], true, true)
    else apply([e.species], true, false)
  }

  return (
    <section className="dex-panel" aria-label={t('navDex')}>
      {dex.regions.length > 0 && (
        <div className="dex-books" role="tablist">
          {[...dex.regions.map((r) => ({ key: r.key, n: r.entries.length })), { key: 'national', n: dex.entries.length }].map((b) => {
            const on = b.key === 'national' ? !region : region?.key === b.key
            return (
              <button key={b.key} type="button" role="tab" aria-selected={on} className="dex-book" onClick={() => setChosen(b.key)}>
                {b.key === 'national' ? t('dexNational') : t(`dex_${b.key}` as Key)}
                <span className="pouch-tab__n">{b.n}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="dex-panel__top">
        <div className="lcd__screen dex-panel__lcd">
          <span className="px lcd__value">
            {caught}/{total}
          </span>
          <span className="lcd__sub">{t('dexStats', { caught, seen, total })}</span>
          <span className="lcd__bar" aria-hidden="true">
            <span style={{ width: `${(caught / Math.max(1, total)) * 100}%` }} />
          </span>
        </div>
        {dex.editable ? (
          <div className="dex-panel__bulk">
            <button type="button" className="btn btn--sm" onClick={() => apply(scope, true, false)}>
              {t('dexSeenAll')}
            </button>
            <button type="button" className="btn btn--red btn--sm" onClick={() => apply(scope, true, true)}>
              <PokeBall size={18} /> {t('dexCompleteAll')}
            </button>
            <button type="button" className="btn btn--sm" onClick={() => window.confirm(t('dexConfirmClear')) && apply(scope, false, false)}>
              {t('dexClearAll')}
            </button>
          </div>
        ) : (
          <p className="dialog dialog--note">{t('dexReadonly')}</p>
        )}
      </div>

      {error && (
        <p className="ed__error" role="alert">
          <Icon name="alert" /> {t(errorKey(error))}
        </p>
      )}

      <div className="dex-panel__filters">
        <input className="input" type="search" placeholder={t('dexSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chips" role="group">
          {(
            [
              ['all', 'dexAll'],
              ['caught', 'dexCaught'],
              ['seen', 'dexSeen'],
              ['missing', 'dexMissing'],
            ] as [DexFilter, Key][]
          ).map(([id, key]) => (
            <button key={id} type="button" className={`chip${filter === id ? ' is-on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {t(key)}
            </button>
          ))}
        </div>
        {dex.editable && <p className="muted dex-panel__help">{t('dexHelp')}</p>}
        {!region && dex.regions.length > 0 && <p className="muted dex-panel__help">{t('dexNationalNote')}</p>}
      </div>

      {shown.length === 0 ? (
        <p className="dialog">{t('dexNone')}</p>
      ) : (
        <ul className="dex-grid">
          {shown.map((e) => {
            const state = e.caught ? 'caught' : e.seen ? 'seen' : 'none'
            const url = spriteStillUrl(e.species, false)
            return (
              <li key={e.species}>
                <button
                  type="button"
                  className={`dex-cell dex-cell--${state}`}
                  onClick={() => cycle(e)}
                  disabled={!dex.editable}
                  aria-label={`#${e.number} ${e.seen ? e.name : '???'}: ${t(`dexState_${state}` as Key)}`}
                >
                  <span className="px dex-cell__n">{String(e.number).padStart(3, '0')}</span>
                  {url && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                  <span className="dex-cell__name">{e.seen ? e.name : '???'}</span>
                  {e.caught && (
                    <span className="dex-cell__ball" aria-hidden="true">
                      <PokeBall size={16} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ---------- Importar ----------

export function ImportDialog({
  engine,
  at,
  onClose,
  onImported,
}: {
  engine: Engine
  at: SlotRef
  onClose: () => void
  onImported: (s: SaveSummary, at: SlotRef) => void
}) {
  const { t, lang } = useI18n()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const done = (r: ReturnType<Engine['importShowdown']>) => {
    if (r.ok && r.save) onImported(r.save, r.pokemon?.ref ?? at)
    else setError(r.error)
  }

  return (
    <Modal title={t('importTitle')} onClose={onClose}>
      <div className="import">
        <section className="import__block">
          <h3 className="px">{t('importFile')}</h3>
          <p className="muted">{t('importFileHint')}</p>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".pk1,.pk2,.pk3,.pk4,.pk5,.pk6,.pk7,.pk8,.pk9,.pb7,.pb8,.pa8,.pa9,.ck3,.xk3,.bk4,.rk4"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              done(engine.importPokemonFile(at, new Uint8Array(await f.arrayBuffer()), f.name, lang))
            }}
          />
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> {t('importChoose')}
          </button>
        </section>

        <section className="import__block">
          <h3 className="px">{t('importShowdown')}</h3>
          <p className="muted">{t('importShowdownHint')}</p>
          <textarea
            className="input import__text"
            rows={8}
            value={text}
            spellCheck={false}
            placeholder={'Garchomp @ Choice Scarf\nAbility: Rough Skin\nLevel: 50\nJolly Nature\n- Earthquake\n- Dragon Claw'}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" className="btn btn--red" disabled={!text.trim()} onClick={() => done(engine.importShowdown(at, text, lang))}>
            <Icon name="check" /> {t('importDo')}
          </button>
        </section>

        {error && (
          <p className="ed__error" role="alert">
            <Icon name="alert" /> {t(errorKey(error))}
          </p>
        )}
      </div>
    </Modal>
  )
}
