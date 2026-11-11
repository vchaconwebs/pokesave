import { useEffect, useRef, useState } from 'react'
import type { Engine } from '../engine'
import type { SaveSummary } from '../types'
import { useI18n } from '../i18n'
import { gameAccent, spriteStillUrl, typeColor, typeInk } from '../theme'
import { encodeTeam, teamFromSave, teamLink, type SharedTeam } from '../share'
import { Modal } from './controls'

const W = 1200
const H = 630

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // PokéAPI (raw.githubusercontent.com) permite CORS: el canvas no queda "manchado"
    img.referrerPolicy = 'no-referrer'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Dibuja la tarjeta del equipo (1200×630, el tamaño de las vistas previas de redes sociales). */
async function drawTeamCard(canvas: HTMLCanvasElement, team: SharedTeam, footer: string) {
  await document.fonts?.ready
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const [a, b] = gameAccent(team.gameId) ?? ['#ffcb05', '#ff4b4f']

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0e1430')
  bg.addColorStop(1, '#182150')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createLinearGradient(0, 0, W, 0)
  glow.addColorStop(0, a)
  glow.addColorStop(1, b)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 10)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 44px Fredoka, system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(team.trainer, 48, 40)
  ctx.fillStyle = a
  ctx.font = '600 26px Fredoka, system-ui, sans-serif'
  ctx.fillText(team.game, 48, 96)

  const sprites = await Promise.all(team.mons.map((m) => (spriteStillUrl(m.s, !!m.sh) ? loadImage(spriteStillUrl(m.s, !!m.sh)!) : Promise.resolve(null))))

  const cw = 352
  const ch = 210
  team.mons.forEach((m, i) => {
    const x = 48 + (i % 3) * (cw + 24)
    const y = 150 + Math.floor(i / 3) * (ch + 24)
    ctx.fillStyle = 'rgb(255 255 255 / 0.06)'
    roundRect(ctx, x, y, cw, ch, 22)
    ctx.fill()
    ctx.strokeStyle = typeColor(m.ty[0]?.[0] ?? 0)
    ctx.lineWidth = 3
    ctx.stroke()

    const img = sprites[i]
    if (img) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, x + 6, y + 10, 120, 120)
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 26px Fredoka, system-ui, sans-serif'
    ctx.fillText(m.n + (m.sh ? ' ✨' : ''), x + 132, y + 18, cw - 145)
    ctx.fillStyle = '#a8b0d6'
    ctx.font = '600 20px Fredoka, system-ui, sans-serif'
    ctx.fillText(`Nv. ${m.l}${m.it ? ` · ${m.it}` : ''}`, x + 132, y + 52, cw - 145)

    let tx = x + 132
    for (const [id, name] of m.ty) {
      ctx.font = '700 16px Fredoka, system-ui, sans-serif'
      const w = ctx.measureText(name).width + 20
      ctx.fillStyle = typeColor(id)
      roundRect(ctx, tx, y + 84, w, 26, 13)
      ctx.fill()
      ctx.fillStyle = typeInk(id)
      ctx.fillText(name, tx + 10, y + 89)
      tx += w + 8
    }

    ctx.font = '600 17px Fredoka, system-ui, sans-serif'
    m.mv.slice(0, 4).forEach(([name, type], k) => {
      const mx = x + 16 + (k % 2) * ((cw - 32) / 2)
      const my = y + 138 + Math.floor(k / 2) * 32
      ctx.fillStyle = typeColor(type)
      roundRect(ctx, mx, my + 6, 10, 10, 5)
      ctx.fill()
      ctx.fillStyle = '#f3f5ff'
      ctx.fillText(name, mx + 16, my, (cw - 32) / 2 - 20)
    })
  })

  ctx.fillStyle = '#a8b0d6'
  ctx.font = '600 18px Fredoka, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(footer, W - 48, H - 36)
  ctx.textAlign = 'left'
}

/** Diálogo para compartir el equipo: imagen, enlace y texto de Showdown. */
export function TeamShareDialog({ engine, save, onClose }: { engine: Engine; save: SaveSummary; onClose: () => void }) {
  const { t, lang } = useI18n()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [link, setLink] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const team = teamFromSave(save)

  useEffect(() => {
    let alive = true
    encodeTeam(team).then((enc) => alive && setLink(teamLink(enc)))
    if (canvas.current) {
      drawTeamCard(canvas.current, team, 'PokeSave').then(() => canvas.current?.toBlob((b) => alive && setBlob(b), 'image/png'))
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, lang])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* sin portapapeles */
    }
  }

  const showdown = () =>
    save.party
      .map((p) => engine.exportPokemon({ kind: 'party', box: 0, slot: p.slot }, lang)?.info.showdown)
      .filter(Boolean)
      .join('\n\n')

  const download = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `equipo-${save.trainer.name || 'pokesave'}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const file = blob ? new File([blob], 'equipo.png', { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  return (
    <Modal title={t('shTitle')} onClose={onClose} wide>
      <div className="share">
        <canvas ref={canvas} className="share__card" aria-label={t('shTitle')} />
        <div className="share__actions">
          <button type="button" className="btn btn--red" onClick={download} disabled={!blob}>
            {t('shDownload')}
          </button>
          {canShareFile && (
            <button type="button" className="btn" onClick={() => navigator.share({ files: [file!], title: t('shTitle') }).catch(() => {})}>
              {t('shShare')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => link && copy(link, 'link')} disabled={!link}>
            {copied === 'link' ? t('shCopied') : t('shCopyLink')}
          </button>
          <button type="button" className="btn" onClick={() => copy(showdown(), 'sd')}>
            {copied === 'sd' ? t('shCopied') : t('shCopyShowdown')}
          </button>
        </div>
        <p className="muted">{t('shPrivacy')}</p>
      </div>
    </Modal>
  )
}

/** Vista de un equipo compartido por enlace (no hace falta partida ni motor). */
export function SharedTeamView({ team, onClose }: { team: SharedTeam; onClose: () => void }) {
  const { t } = useI18n()
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) drawTeamCard(canvas.current, team, 'PokeSave')
  }, [team])
  return (
    <section className="share share--page" aria-label={t('shSharedTitle')}>
      <h2>{t('shSharedTitle')}</h2>
      <canvas ref={canvas} className="share__card" aria-label={t('shSharedTitle')} />
      <ul className="share__list">
        {team.mons.map((m, i) => (
          <li key={i}>
            <b>{m.n}</b> · {t('level')}
            {m.l}
            {m.ab && ` · ${m.ab}`}
            {m.na && ` · ${m.na}`}
            {m.it && ` · ${m.it}`}
            <br />
            <span className="muted">{m.mv.map(([n]) => n).join(' / ')}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--red" onClick={onClose}>
        {t('shOpenEditor')}
      </button>
    </section>
  )
}
