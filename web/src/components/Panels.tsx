import { useMemo, useState } from 'react'
import type { Engine } from '../engine'
import { downloadBytes } from '../engine'
import type { BoxView, SaveSummary, SlotRef } from '../types'
import { errorKey, useI18n } from '../i18n'
import { spriteStillUrl } from '../theme'
import { Modal, NumberField } from './controls'
import { Icon, PokeBall, SpeciesOrb } from './visuals'

// ---------- Entrenador ----------

export function TrainerEditor({
  engine,
  save,
  onClose,
  onSaved,
}: {
  engine: Engine
  save: SaveSummary
  onClose: () => void
  onSaved: (save: SaveSummary) => void
}) {
  const { t, lang } = useI18n()
  const [name, setName] = useState(save.trainer.name)
  const [money, setMoney] = useState(save.trainer.money ?? 0)
  const [error, setError] = useState<string | null>(null)
  const canMoney = save.trainer.money != null

  const submit = () => {
    const r = engine.setTrainer({ name, money }, lang)
    if (r.ok && r.save) {
      onSaved(r.save)
      onClose()
    } else setError(r.error)
  }

  return (
    <Modal
      title={t('editTrainer')}
      onClose={onClose}
      footer={
        <>
          {error && (
            <p className="ed__error" role="alert">
              <Icon name="alert" /> {t(errorKey(error))}
            </p>
          )}
          <div className="ed__actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btn--red" onClick={submit}>
              <Icon name="check" /> {t('save')}
            </button>
          </div>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="trainer-name-input">
            {t('trainerName')}
          </label>
          <input id="trainer-name-input" className="input" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
        </div>
        {canMoney && (
          <NumberField label={`${t('money')} (₽)`} value={money} min={0} max={save.trainer.maxMoney} step={1000} onChange={setMoney} />
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

// ---------- Cajas del PC ----------

export function BoxBrowser({
  engine,
  save,
  version,
  onOpen,
  onImport,
}: {
  engine: Engine
  save: SaveSummary
  /** Cambia tras cada edición para volver a leer la caja. */
  version: number
  onOpen: (at: SlotRef) => void
  onImport: (at: SlotRef) => void
}) {
  const { t, lang } = useI18n()
  const [index, setIndex] = useState(0)
  const count = save.boxCount
  // `version` cambia tras cada edición: obliga a volver a leer la caja.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const box = useMemo<BoxView | null>(() => engine.box(index, lang), [engine, index, lang, version])

  if (count === 0) return null
  const go = (d: number) => setIndex((i) => (i + d + count) % count)
  const bySlot = new Map(box?.slots.map((s) => [s.slot, s]))
  const name = save.boxNames[index] ?? `${index + 1}`
  const label = /^\d+$/.test(name) ? `${t('box')} ${name}` : name

  return (
    <section className="pc" aria-labelledby="pc-title">
      <div className="section-head">
        <PokeBall size={28} />
        <h3 id="pc-title">{t('boxes')}</h3>
        <span className="px count">{save.storedCount}</span>
      </div>

      <div className="pc__frame">
        <div className="pc__bar">
          <button type="button" className="pc__arrow" onClick={() => go(-1)} aria-label={t('prevBox')}>
            ◀
          </button>
          <label className="pc__select">
            <span className="px">{label}</span>
            <select value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label={t('box')}>
              {save.boxNames.map((n, i) => (
                <option key={i} value={i}>
                  {/^\d+$/.test(n) ? `${t('box')} ${n}` : n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="pc__arrow" onClick={() => go(1)} aria-label={t('nextBox')}>
            ▶
          </button>
        </div>

        <ul className="pc__grid" style={{ ['--cols' as string]: 6 }}>
          {Array.from({ length: box?.slotCount ?? 30 }, (_, i) => {
            const s = bySlot.get(i)
            if (!s)
              return (
                <li key={i} className="pc__slot pc__slot--empty">
                  <button type="button" className="pc__add" onClick={() => onImport({ kind: 'box', box: index, slot: i })} aria-label={t('addPokemon')}>
                    ＋
                  </button>
                </li>
              )
            const url = s.isEgg ? null : spriteStillUrl(s.species, s.isShiny)
            return (
              <li key={i} className="pc__slot">
                <button
                  type="button"
                  className={`pc__mon${s.isShiny ? ' is-shiny' : ''}`}
                  onClick={() => onOpen({ kind: 'box', box: index, slot: i })}
                  title={`${s.name} · ${t('level')}${s.level}`}
                  aria-label={`${s.isEgg ? t('egg') : s.name}, ${t('level')} ${s.level}`}
                >
                  {url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <SpeciesOrb species={s.species} name={s.name} egg={s.isEgg} size={34} />}
                  {!s.legal && <span className="pc__warn" aria-hidden="true">!</span>}
                  <span className="pc__lv px">{s.level}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {box && box.slots.length === 0 && <p className="pc__empty px">{t('boxEmpty')}</p>}
      </div>
    </section>
  )
}

// ---------- Exportar ----------

export function ExportDialog({ engine, fileName, onClose, onDone }: { engine: Engine; fileName: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [backedUp, setBackedUp] = useState(false)
  const [done, setDone] = useState(false)
  const backupName = fileName.replace(/(\.[^.]*)?$/, (ext) => `.original${ext}`)

  return (
    <Modal title={t('exportTitle')} onClose={onClose}>
      <div className="export">
        <p className="dialog">{done ? t('exportDone') : t('exportBody')}</p>
        <div className="export__steps">
          <button
            type="button"
            className={`btn${backedUp ? ' is-done' : ''}`}
            onClick={() => {
              downloadBytes(engine.exportOriginal(), backupName)
              setBackedUp(true)
            }}
          >
            <Icon name={backedUp ? 'check' : 'download'} /> {t('exportStep1')}
            <small className="export__file">{backupName}</small>
          </button>
          <button
            type="button"
            className="btn btn--red"
            disabled={!backedUp}
            title={backedUp ? undefined : t('exportBackupFirst')}
            onClick={() => {
              downloadBytes(engine.exportSave(), fileName)
              setDone(true)
              onDone()
            }}
          >
            <Icon name={done ? 'check' : 'download'} /> {t('exportStep2')}
            <small className="export__file">{fileName}</small>
          </button>
        </div>
      </div>
    </Modal>
  )
}
