import type { ReactNode } from 'react'
import type { PokemonInfo, SaveSummary } from '../types'
import { useI18n } from '../i18n'
import { Icon, SpeciesOrb } from './visuals'

export function SaveView({
  save,
  fileName,
  onAnother,
  onDownloadOriginal,
}: {
  save: SaveSummary
  fileName: string
  onAnother: () => void
  onDownloadOriginal: () => void
}) {
  const { t, lang } = useI18n()
  const nf = new Intl.NumberFormat(lang)
  const tr = save.trainer

  return (
    <div className="save">
      <section className="trainer card" aria-labelledby="trainer-name">
        <div className="trainer__glow" aria-hidden="true" />
        <div className="trainer__top">
          <span className="game-chip">
            <span className="game-chip__dot" aria-hidden="true" />
            {save.game}
            <span className="game-chip__gen">
              {t('gen')} {save.generation}
            </span>
          </span>
          <span className={`status ${save.checksumsValid ? 'status--ok' : 'status--bad'}`}>
            <Icon name={save.checksumsValid ? 'check' : 'alert'} />
            {save.checksumsValid ? t('checksumOk') : t('checksumBad')}
          </span>
        </div>

        <p className="eyebrow">{t('trainer')}</p>
        <h2 id="trainer-name" className="trainer__name">
          {tr.name || '???'}
        </h2>

        <dl className="facts">
          <Fact label={t('trainerId')} value={tr.id} mono />
          {tr.secretId && <Fact label={t('secretId')} value={tr.secretId} mono />}
          <Fact label={t('money')} value={tr.money == null ? t('notAvailable') : nf.format(tr.money)} mono prefix={tr.money == null ? undefined : '₽'} />
          <Fact label={t('playTime')} value={tr.playTime?.replace(/ː/g, ':') ?? t('notAvailable')} mono />
        </dl>
      </section>

      <div className="stats">
        {save.pokedex && (
          <Stat label={t('pokedex')}>
            <Ring value={save.pokedex.caught} total={save.pokedex.total} />
            <div>
              <strong className="mono">{nf.format(save.pokedex.caught)}</strong> {t('caught')}
              <br />
              <span className="muted">
                <span className="mono">{nf.format(save.pokedex.seen)}</span> {t('seen')}
              </span>
            </div>
          </Stat>
        )}
        {save.boxCount > 0 && (
          <Stat label={t('pc')}>
            <Ring value={save.storedCount} total={save.boxCount * save.boxSlotCount} />
            <div>
              <strong className="mono">{nf.format(save.storedCount)}</strong> Pokémon
              <br />
              <span className="muted">{t('inBoxes', { n: save.boxCount })}</span>
            </div>
          </Stat>
        )}
        <Stat label={t('file')}>
          <div className="file-stat">
            <strong className="truncate" title={fileName}>
              {fileName}
            </strong>
            <span className="muted mono">{formatBytes(save.fileSize, lang)}</span>
          </div>
        </Stat>
      </div>

      <section aria-labelledby="team-title">
        <div className="section-head">
          <h3 id="team-title">{t('team')}</h3>
          <span className="count mono">{save.party.length}/6</span>
        </div>
        {save.party.length === 0 ? (
          <p className="muted card empty">{t('emptyTeam')}</p>
        ) : (
          <ul className="party">
            {save.party.map((pk, i) => (
              <MonCard key={pk.slot} pk={pk} index={i} />
            ))}
          </ul>
        )}
      </section>

      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onAnother}>
          <Icon name="refresh" /> {t('loadAnother')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDownloadOriginal}>
          <Icon name="download" /> {t('downloadOriginal')}
        </button>
      </div>

      <aside className="phase card">
        <span className="phase__badge">{t('phase')}</span>
        <p>{t('phaseBody')}</p>
      </aside>
    </div>
  )
}

function Fact({ label, value, mono, prefix }: { label: string; value: string; mono?: boolean; prefix?: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>
        {prefix && <span className="fact__prefix">{prefix}</span>}
        {value}
      </dd>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stat card">
      <p className="eyebrow">{label}</p>
      <div className="stat__body">{children}</div>
    </div>
  )
}

function Ring({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 44 44" width="48" height="48" role="img" aria-label={`${Math.round(pct * 100)}%`}>
      <circle cx="22" cy="22" r={r} className="ring__track" />
      <circle cx="22" cy="22" r={r} className="ring__fill" strokeDasharray={`${pct * c} ${c}`} />
      <text x="22" y="25.5" textAnchor="middle" className="ring__text">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

function MonCard({ pk, index }: { pk: PokemonInfo; index: number }) {
  const { t } = useI18n()
  const hpPct = pk.hpMax > 0 ? Math.max(0, Math.min(1, pk.hpCurrent / pk.hpMax)) : 1
  const hpTone = hpPct > 0.5 ? 'good' : hpPct > 0.2 ? 'mid' : 'low'
  const displayName = pk.isEgg ? t('egg') : pk.nickname || pk.speciesName

  return (
    <li className="mon card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="mon__head">
        <SpeciesOrb species={pk.species} name={pk.speciesName} shiny={pk.isShiny} egg={pk.isEgg} />
        <div className="mon__title">
          <h4 className="truncate">
            {displayName}
            {!pk.isEgg && pk.gender !== 2 && (
              <span className={`sex sex--${pk.gender === 0 ? 'm' : 'f'}`} title={pk.gender === 0 ? t('male') : t('female')}>
                {pk.gender === 0 ? '♂' : '♀'}
              </span>
            )}
          </h4>
          <p className="muted truncate">
            <span className="mono">#{String(pk.species).padStart(4, '0')}</span>
            {pk.isNicknamed && !pk.isEgg && <> · {pk.speciesName}</>}
          </p>
        </div>
        <span className="level">
          <small>{t('level')}</small>
          <span className="mono">{pk.level}</span>
        </span>
      </div>

      {!pk.isEgg && (
        <>
          <div className="hp" aria-label={`${t('hp')} ${pk.hpCurrent}/${pk.hpMax}`}>
            <span className="hp__label">{t('hp')}</span>
            <span className="hp__bar">
              <span className={`hp__fill hp__fill--${hpTone}`} style={{ width: `${hpPct * 100}%` }} />
            </span>
            <span className="mono hp__num">
              {pk.hpCurrent}/{pk.hpMax}
            </span>
          </div>

          <dl className="mon__facts">
            {pk.nature && <MiniFact label={t('nature')} value={pk.nature} />}
            {pk.ability && <MiniFact label={t('ability')} value={pk.ability} />}
            <MiniFact label={t('item')} value={pk.heldItem ?? t('none')} dim={!pk.heldItem} />
          </dl>

          <ul className="moves" aria-label={t('moves')}>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={pk.moves[i] ? 'move' : 'move move--empty'}>
                {pk.moves[i] ?? '—'}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mon__foot">
        {pk.isShiny && <span className="tag tag--shiny">✦ {t('shiny')}</span>}
        {pk.legal != null && (
          <span className={`tag ${pk.legal ? 'tag--ok' : 'tag--warn'}`} title={t('legalTitle')}>
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
