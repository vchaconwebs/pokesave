import type { CSSProperties, ReactNode } from 'react'
import type { PokemonInfo, SaveSummary, SlotRef } from '../types'
import { useI18n } from '../i18n'
import { typeColor, typeInk } from '../theme'
import { Icon, MonSprite, PokeBall, TypeBadge } from './visuals'

export function SaveView({
  save,
  fileName,
  onAnother,
  onDownloadOriginal,
  onDownloadSave,
  onEditTrainer,
  onEditPokemon,
  pc,
}: {
  save: SaveSummary
  fileName: string
  onAnother: () => void
  onDownloadOriginal: () => void
  onDownloadSave: () => void
  onEditTrainer: () => void
  onEditPokemon: (at: SlotRef) => void
  pc?: ReactNode
}) {
  const { t, lang } = useI18n()
  const nf = new Intl.NumberFormat(lang)
  const tr = save.trainer

  return (
    <div className="save">
      <p className="dialog dialog--toast" role="status">
        {t('caughtSave')}
      </p>

      <section className="tcard" aria-labelledby="trainer-name">
        <div className="tcard__holo" aria-hidden="true" />
        <PokeBall size={240} className="tcard__ball" />
        <header className="tcard__head">
          <span className="px">{t('trainerCard')}</span>
          <span className="tcard__game">
            {save.game} <b>{t('gen')} {save.generation}</b>
          </span>
          <button type="button" className="tcard__edit" onClick={onEditTrainer}>
            ✎ {t('edit')}
          </button>
        </header>

        <div className="tcard__body">
          <div className="tcard__who">
            <span className="tcard__label px">
              {t('trainerId')} <b>{tr.id}</b>
            </span>
            <h2 id="trainer-name" className="tcard__name">
              {tr.name || '???'}
            </h2>
            <span className={`tcard__check ${save.checksumsValid ? 'ok' : 'bad'}`}>
              <Icon name={save.checksumsValid ? 'check' : 'alert'} />
              {save.checksumsValid ? t('checksumOk') : t('checksumBad')}
            </span>
          </div>

          <dl className="tcard__facts">
            <Fact label={t('money')} value={tr.money == null ? t('notAvailable') : `₽${nf.format(tr.money)}`} />
            <Fact label={t('playTime')} value={tr.playTime?.replace(/ː/g, ':') ?? t('notAvailable')} />
            {tr.secretId && <Fact label={t('secretId')} value={tr.secretId} />}
          </dl>
        </div>

        {tr.badges && (
          <div className="tcard__badges" aria-label={`${t('badges')}: ${tr.badges.earned}/${tr.badges.total}`}>
            <span className="px tcard__badges-label">
              {t('badges')} {tr.badges.earned}/{tr.badges.total}
            </span>
            <span className="tcard__badge-row" aria-hidden="true">
              {tr.badges.flags.map((on, i) => (
                <i key={i} className={on ? 'on' : ''} style={{ ['--b' as string]: `${(i * 360) / tr.badges!.flags.length}deg` } as CSSProperties} />
              ))}
            </span>
          </div>
        )}

        <footer className="tcard__party" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={i < save.party.length ? 'on' : ''}>
              <PokeBall size={22} />
            </span>
          ))}
        </footer>
      </section>

      <div className="lcds">
        {save.pokedex && (
          <Lcd label={t('pokedex')} value={nf.format(save.pokedex.caught)} pct={save.pokedex.caught / Math.max(1, save.pokedex.total)}>
            {t('caught')} · {nf.format(save.pokedex.seen)} {t('seen')}
          </Lcd>
        )}
        {save.boxCount > 0 && (
          <Lcd label={t('pc')} value={nf.format(save.storedCount)} pct={save.storedCount / Math.max(1, save.boxCount * save.boxSlotCount)}>
            Pokémon {t('inBoxes', { n: save.boxCount })}
          </Lcd>
        )}
        <Lcd label={t('file')} value={formatBytes(save.fileSize, lang)}>
          <span className="truncate" title={fileName}>
            {fileName}
          </span>
        </Lcd>
      </div>

      <section aria-labelledby="team-title">
        <div className="section-head">
          <PokeBall size={28} />
          <h3 id="team-title">{t('team')}</h3>
          <span className="px count">{save.party.length}/6</span>
        </div>
        {save.party.length === 0 ? (
          <p className="dialog">{t('emptyTeam')}</p>
        ) : (
          <ul className="party">
            {save.party.map((pk, i) => (
              <MonCard key={pk.slot} pk={pk} index={i} onEdit={() => onEditPokemon({ kind: 'party', box: 0, slot: pk.slot })} />
            ))}
          </ul>
        )}
      </section>

      {pc}

      <div className="actions">
        <button type="button" className="btn btn--red" onClick={onDownloadSave}>
          <Icon name="download" /> {t('downloadSave')}
        </button>
        <button type="button" className="btn" onClick={onDownloadOriginal}>
          <Icon name="download" /> {t('downloadOriginal')}
        </button>
        <button type="button" className="btn" onClick={onAnother}>
          <Icon name="refresh" /> {t('loadAnother')}
        </button>
      </div>

      <aside className="dialog dialog--note">
        <span className="px badge">{t('phase')}</span> {t('phaseBody')}
      </aside>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="tfact">
      <dt className="px">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Lcd({ label, value, pct, children }: { label: string; value: string; pct?: number; children: ReactNode }) {
  return (
    <div className="lcd">
      <p className="lcd__label px">{label}</p>
      <div className="lcd__screen">
        <span className="lcd__value px">{value}</span>
        <span className="lcd__sub">{children}</span>
        {pct != null && (
          <span className="lcd__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(3, Math.min(100, pct * 100))}%` }} />
          </span>
        )}
      </div>
    </div>
  )
}

function MonCard({ pk, index, onEdit }: { pk: PokemonInfo; index: number; onEdit: () => void }) {
  const { t } = useI18n()
  const hpPct = pk.hpMax > 0 ? Math.max(0, Math.min(1, pk.hpCurrent / pk.hpMax)) : 1
  const hpTone = hpPct > 0.5 ? 'good' : hpPct > 0.2 ? 'mid' : 'low'
  const displayName = pk.isEgg ? t('egg') : pk.nickname || pk.speciesName
  const t1 = pk.types[0]?.id ?? 0
  const t2 = pk.types[1]?.id ?? t1
  const style = {
    animationDelay: `${index * 70}ms`,
    ['--c1' as string]: pk.isEgg ? '#d9d2b4' : typeColor(t1),
    ['--c2' as string]: pk.isEgg ? '#a9cf9a' : typeColor(t2),
  } as CSSProperties

  return (
    <li className={`mon${pk.isShiny ? ' mon--shiny' : ''}`} style={style}>
      <div className="mon__hero">
        <span className="mon__dex px">#{String(pk.species).padStart(4, '0')}</span>
        <span className="mon__lv px">
          <small>{t('level')}</small>
          {pk.level}
        </span>
        <MonSprite species={pk.species} name={pk.speciesName} shiny={pk.isShiny} egg={pk.isEgg} size={116} />
        <button type="button" className="mon__edit" onClick={onEdit} aria-label={`${t('edit')} ${displayName}`}>
          <span className="px">✎ {t('edit')}</span>
        </button>
      </div>

      <div className="mon__body">
        <div className="mon__title">
          <h4 className="truncate">
            {displayName}
            {!pk.isEgg && pk.gender !== 2 && (
              <span className={`sex sex--${pk.gender === 0 ? 'm' : 'f'}`} title={pk.gender === 0 ? t('male') : t('female')}>
                {pk.gender === 0 ? '♂' : '♀'}
              </span>
            )}
          </h4>
          {pk.isNicknamed && !pk.isEgg && <p className="muted truncate">{pk.speciesName}</p>}
        </div>

        {pk.isEgg ? (
          <p className="muted">{t('eggBody')}</p>
        ) : (
          <>
            <div className="types">
              {pk.types.map((ty) => (
                <TypeBadge key={ty.id} type={ty} />
              ))}
              {pk.isShiny && <span className="shiny-tag">✦ {t('shiny')}</span>}
            </div>

            <div className="hp" aria-label={`${t('hp')} ${pk.hpCurrent}/${pk.hpMax}`}>
              <span className="hp__label px">{t('hp')}</span>
              <span className="hp__bar">
                <span className={`hp__fill hp__fill--${hpTone}`} style={{ width: `${hpPct * 100}%` }} />
              </span>
              <span className="hp__num px">
                {pk.hpCurrent}/{pk.hpMax}
              </span>
            </div>

            <dl className="mon__facts">
              {pk.nature && <MiniFact label={t('nature')} value={pk.nature} />}
              {pk.ability && <MiniFact label={t('ability')} value={pk.ability} />}
              <MiniFact label={t('item')} value={pk.heldItem ?? t('none')} dim={!pk.heldItem} />
            </dl>

            <ul className="moves" aria-label={t('moves')}>
              {[0, 1, 2, 3].map((i) => {
                const m = pk.moves[i]
                if (!m)
                  return (
                    <li key={i} className="move move--empty">
                      —
                    </li>
                  )
                return (
                  <li
                    key={i}
                    className="move"
                    style={{ ['--t' as string]: typeColor(m.type.id), ['--t-ink' as string]: typeInk(m.type.id) } as CSSProperties}
                  >
                    <span className="move__name">{m.name}</span>
                    <span className="move__type">{m.type.name}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {pk.legal != null && (
          <span className={`legal ${pk.legal ? 'legal--ok' : 'legal--warn'}`} title={t('legalTitle')}>
            <Icon name={pk.legal ? 'check' : 'alert'} />
            {pk.legal ? t('legal') : t('illegal')}
          </span>
        )}
      </div>
    </li>
  )
}

function MiniFact({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={dim ? 'muted' : undefined}>{value}</dd>
    </div>
  )
}

function formatBytes(n: number, lang: string) {
  const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 })
  if (n >= 1024 * 1024) return `${nf.format(n / 1024 / 1024)} MB`
  return `${nf.format(n / 1024)} KB`
}
