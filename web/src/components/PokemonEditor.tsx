import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { downloadBytes, type Engine } from '../engine'
import type { GameLists, PokemonDetail, PokemonEdit, SaveSummary, SlotRef } from '../types'
import { errorKey, useI18n, type Key } from '../i18n'
import { typeColor, typeInk } from '../theme'
import { Combobox, Modal, NumberField } from './controls'
import { Icon, MonSprite, TypeBadge } from './visuals'

type Tab = 'general' | 'moves' | 'stats' | 'legality' | 'export'

const STAT_KEYS: Key[] = ['statHP', 'statAtk', 'statDef', 'statSpA', 'statSpD', 'statSpe']

export function PokemonEditor({
  engine,
  at,
  lists,
  onClose,
  onSaved,
}: {
  engine: Engine
  at: SlotRef
  lists: GameLists
  onClose: () => void
  onSaved: (save: SaveSummary) => void
}) {
  const { t, lang } = useI18n()
  const [detail] = useState<PokemonDetail | null>(() => engine.pokemon(at, lang))
  const [draft, setDraft] = useState<PokemonEdit | null>(() => detail?.edit ?? null)
  const [preview, setPreview] = useState<PokemonDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('general')

  // Vista previa en vivo, con un pequeño retraso para no recalcular en cada tecla.
  useEffect(() => {
    if (!detail || !draft || JSON.stringify(draft) === JSON.stringify(detail.edit)) return
    const id = setTimeout(() => {
      const r = engine.previewPokemon(at, draft, lang)
      if (r.ok && r.pokemon) {
        setPreview(r.pokemon)
        setError(null)
        // En Gen 1/2 el variocolor reescribe los IVs: se reflejan en el formulario.
        if (r.pokemon.limits.hpIvDerived && JSON.stringify(r.pokemon.edit.ivs) !== JSON.stringify(draft.ivs)) {
          setDraft((d) => (d ? { ...d, ivs: r.pokemon!.edit.ivs } : d))
        }
      } else {
        setError(r.error)
      }
    }, 180)
    return () => clearTimeout(id)
  }, [engine, at, draft, detail, lang])

  if (!detail || !draft) {
    return (
      <Modal title="—" onClose={onClose}>
        <p className="dialog">{t('err_slot')}</p>
      </Modal>
    )
  }

  const changed = JSON.stringify(draft) !== JSON.stringify(detail.edit)
  // Sin cambios se muestra el Pokémon tal cual está en la partida.
  const view = changed && preview ? preview : detail
  const shownError = changed ? error : null
  const limits = view.limits
  const set = <K extends keyof PokemonEdit>(key: K, value: PokemonEdit[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))

  const save = () => {
    const r = engine.setPokemon(at, draft, lang)
    if (r.ok && r.save) {
      onSaved(r.save)
      onClose()
    } else {
      setError(r.error)
    }
  }

  const info = view.info
  const name = info.isEgg ? t('egg') : draft.isNicknamed && draft.nickname ? draft.nickname : info.speciesName
  const t1 = info.types[0]?.id ?? 0
  const t2 = info.types[1]?.id ?? t1

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="ed__title">
          {name}
          <span className="px ed__lv">
            {t('level')}
            {draft.level}
          </span>
        </span>
      }
      footer={
        <>
          {shownError && (
            <p className="ed__error" role="alert">
              <Icon name="alert" /> {t(errorKey(shownError))}
            </p>
          )}
          <div className="ed__actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btn--red" onClick={save} disabled={!changed || !!shownError}>
              <Icon name="check" /> {t('save')}
            </button>
          </div>
        </>
      }
    >
      <div className="ed__hero" style={{ ['--c1' as string]: typeColor(t1), ['--c2' as string]: typeColor(t2) } as CSSProperties}>
        <MonSprite species={draft.species} name={info.speciesName} shiny={draft.isShiny} egg={info.isEgg} size={120} />
        <div className="ed__hero-info">
          <span className="px ed__dex">#{String(draft.species).padStart(4, '0')}</span>
          <div className="types">
            {info.types.map((ty) => (
              <TypeBadge key={ty.id} type={ty} />
            ))}
          </div>
          <LegalBadge lines={view.legality} onClick={() => setTab('legality')} />
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['general', 'tabGeneral'],
            ['moves', 'tabMoves'],
            ['stats', 'tabStats'],
            ['legality', 'tabLegality'],
            ['export', 'tabExport'],
          ] as [Tab, Key][]
        ).map(([id, key]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {t(key)}
            {id === 'legality' && view.legality.length > 0 && <span className="tab__dot" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="ed__panel" role="tabpanel">
        {tab === 'general' && (
          <div className="form-grid">
            <Combobox label={t('species')} options={lists.species} value={draft.species} onChange={(v) => set('species', v)} />
            <NumberField label={t('levelLabel')} value={draft.level} min={1} max={limits.maxLevel} onChange={(v) => set('level', v)} />

            <div className="field field--wide">
              <label className="switch">
                <input type="checkbox" checked={draft.isNicknamed} onChange={(e) => set('isNicknamed', e.target.checked)} />
                <span className="switch__track" aria-hidden="true" />
                {t('hasNickname')}
              </label>
              {draft.isNicknamed && (
                <input
                  className="input"
                  aria-label={t('nickname')}
                  value={draft.nickname}
                  maxLength={limits.maxNicknameLength}
                  onChange={(e) => set('nickname', e.target.value)}
                />
              )}
            </div>

            {limits.hasNature && (
              <Combobox label={t('nature')} options={lists.natures} value={draft.nature} onChange={(v) => set('nature', v)} />
            )}
            {limits.hasHeldItem && (
              <Combobox
                label={t('item')}
                options={lists.items}
                value={draft.heldItem}
                noneLabel={t('none')}
                onChange={(v) => set('heldItem', v)}
              />
            )}

            {limits.hasAbility && view.abilities.length > 0 && (
              <fieldset className="field field--wide chips">
                <legend className="field__label">{t('ability')}</legend>
                {view.abilities
                  // En muchas especies los dos huecos normales tienen la misma habilidad: se
                  // muestra una vez (salvo que el Pokémon esté justo en ese segundo hueco).
                  .filter((a) => !(a.id === 1 && a.name === view.abilities[0]?.name && draft.abilityIndex !== 1))
                  .map((a) => (
                  <label key={a.id} className={`chip${draft.abilityIndex === a.id ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name="ability"
                      checked={draft.abilityIndex === a.id}
                      onChange={() => set('abilityIndex', a.id)}
                    />
                    {a.name}
                    {a.id === 2 && <small> ✦</small>}
                  </label>
                ))}
              </fieldset>
            )}

            <div className="field field--wide">
              <label className="switch switch--gold">
                <input type="checkbox" checked={draft.isShiny} onChange={(e) => set('isShiny', e.target.checked)} />
                <span className="switch__track" aria-hidden="true" />✦ {t('shiny')}
              </label>
            </div>
          </div>
        )}

        {tab === 'moves' && (
          <div className="form-grid">
            {[0, 1, 2, 3].map((i) => {
              const moveType = info.moves.find((m) => m.id === draft.moves[i])?.type
              return (
                <div key={i} className="move-field" style={moveType ? ({ ['--t' as string]: typeColor(moveType.id), ['--t-ink' as string]: typeInk(moveType.id) } as CSSProperties) : undefined}>
                  <Combobox
                    label={t('move', { n: i + 1 })}
                    options={lists.moves}
                    value={draft.moves[i] ?? 0}
                    noneLabel={t('noMove')}
                    onChange={(v) => set('moves', draft.moves.map((m, j) => (j === i ? v : m)))}
                  />
                  {moveType && <span className="move-field__type">{moveType.name}</span>}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'stats' && <StatsTab draft={draft} view={view} onChange={(ivs, evs) => setDraft({ ...draft, ivs, evs })} />}

        {tab === 'export' && <ExportTab engine={engine} at={at} />}

        {tab === 'legality' && (
          <div className="legality">
            {view.legality.length === 0 ? (
              <p className="dialog legality__ok">
                <Icon name="check" /> {t('legalOk')}
              </p>
            ) : (
              <>
                <p className="field__label">{t('legalBad')}</p>
                <ul className="legality__list">
                  {view.legality.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="muted legality__note">{t('legalNote')}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function ExportTab({ engine, at }: { engine: Engine; at: SlotRef }) {
  const { t, lang } = useI18n()
  const [copied, setCopied] = useState(false)
  // Se exporta tal y como está guardado en la partida (no el borrador sin guardar).
  const [exp] = useState(() => engine.exportPokemon(at, lang))
  if (!exp) return null
  const ext = exp.info.fileName.split('.').pop() ?? 'pk'

  return (
    <div className="export-tab">
      <div className="field">
        <button type="button" className="btn" onClick={() => downloadBytes(exp.data, exp.info.fileName)}>
          <Icon name="download" /> {t('exportFile', { ext: `.${ext}` })}
        </button>
        <p className="muted">{t('exportFileHint')}</p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="showdown-out">
          {t('showdownText')}
        </label>
        <textarea id="showdown-out" className="input import__text" rows={9} readOnly value={exp.info.showdown} />
        <button
          type="button"
          className="btn btn--sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(exp.info.showdown)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              ;(document.getElementById('showdown-out') as HTMLTextAreaElement | null)?.select()
            }
          }}
        >
          {copied ? `✓ ${t('copied')}` : t('copy')}
        </button>
      </div>
    </div>
  )
}

function LegalBadge({ lines, onClick }: { lines: string[]; onClick: () => void }) {
  const { t } = useI18n()
  const ok = lines.length === 0
  return (
    <button type="button" className={`legal ${ok ? 'legal--ok' : 'legal--warn'}`} onClick={onClick}>
      <Icon name={ok ? 'check' : 'alert'} />
      {ok ? t('legal') : t('illegal')}
    </button>
  )
}

function StatsTab({
  draft,
  view,
  onChange,
}: {
  draft: PokemonEdit
  view: PokemonDetail
  onChange: (ivs: number[], evs: number[]) => void
}) {
  const { t } = useI18n()
  const l = view.limits
  const evTotal = draft.evs.reduce((a, b) => a + b, 0)
  const evLeft = Math.max(0, l.maxEvTotal - evTotal)
  const maxStat = Math.max(...view.stats, 1)
  // En Gen 1/2 AtE y DeE son una sola estadística ("Especial").
  const rows = useMemo(() => (l.specialCombined ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5]), [l.specialCombined])

  const setIv = (i: number, v: number) => onChange(draft.ivs.map((x, j) => (j === i || (l.specialCombined && i === 3 && j === 4) ? v : x)), draft.evs)
  const setEv = (i: number, v: number) => {
    const others = evTotal - draft.evs[i] - (l.specialCombined && i === 3 ? draft.evs[4] : 0)
    const capped = Math.min(v, l.maxEvTotal - others)
    onChange(draft.ivs, draft.evs.map((x, j) => (j === i || (l.specialCombined && i === 3 && j === 4) ? Math.max(0, capped) : x)))
  }

  return (
    <div className="stats">
      <p className="muted stats__hint">
        {t('ivsHint', { max: l.maxIv })} {t('evsHint', { max: l.maxEv, total: l.maxEvTotal })}
      </p>
      {l.hpIvDerived && <p className="dialog dialog--note stats__note">{t('gen12Iv')}</p>}

      <div className="stats__tools">
        <button type="button" className="btn btn--sm" onClick={() => onChange(draft.ivs.map(() => l.maxIv), draft.evs)}>
          {t('ivs')}: {t('maxAll')}
        </button>
        <button type="button" className="btn btn--sm" onClick={() => onChange(draft.ivs, draft.evs.map(() => 0))}>
          {t('evs')}: {t('clearAll')}
        </button>
        <span className="px stats__left">{t('evsLeft', { n: evLeft })}</span>
      </div>

      <p className="field__label">{t('statsResult', { lvl: draft.level })}</p>
      <div className="stat-table" role="table">
        <div className="stat-row stat-row--head" role="row">
          <span role="columnheader" />
          <span role="columnheader">{t('ivs')}</span>
          <span role="columnheader">{t('evs')}</span>
          <span role="columnheader" />
        </div>
        {rows.map((i) => (
          <div key={i} className="stat-row" role="row">
            <span role="rowheader" className="stat-row__name">
              {l.specialCombined && i === 3 ? t('statSpecial') : t(STAT_KEYS[i])}
            </span>
            <span role="cell">
              <input
                className="mini-num"
                type="number"
                inputMode="numeric"
                aria-label={`${t('ivs')} ${t(STAT_KEYS[i])}`}
                min={0}
                max={l.maxIv}
                value={draft.ivs[i]}
                disabled={l.hpIvDerived && i === 0}
                onChange={(e) => setIv(i, clamp(e.target.valueAsNumber, 0, l.maxIv))}
              />
            </span>
            <span role="cell" className="ev-cell">
              <input
                type="range"
                min={0}
                max={l.maxEv}
                value={draft.evs[i]}
                aria-label={`${t('evs')} ${t(STAT_KEYS[i])}`}
                onChange={(e) => setEv(i, e.target.valueAsNumber)}
              />
              <input
                className="mini-num"
                type="number"
                inputMode="numeric"
                aria-label={`${t('evs')} ${t(STAT_KEYS[i])}`}
                min={0}
                max={l.maxEv}
                value={draft.evs[i]}
                onChange={(e) => setEv(i, clamp(e.target.valueAsNumber, 0, l.maxEv))}
              />
            </span>
            <span role="cell" className="stat-bar">
              <span className="stat-bar__fill" style={{ width: `${(view.stats[i] / maxStat) * 100}%` }} />
              <b>{view.stats[i]}</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? Math.round(n) : min))
