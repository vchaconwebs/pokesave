// Piezas reutilizables del vídeo: textos con rebote, fondos, efectos y "maquetas" de la app.
import React from 'react'
import { AbsoluteFill, Img, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { noise2D } from '@remotion/noise'
import T from './timeline.json'

export const B = T.beat // fotogramas por tiempo de compás
export const W = 1080
export const H = 1920
export const PX = 'PX'
export const FR = 'FR'

export const TYPE: Record<string, string> = { normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C', grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1', ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', steel: '#B7B7CE', dragon: '#6F35FC', dark: '#705746' }
export const TYPE_ES: Record<string, string> = { fire: 'Fuego', water: 'Agua', ground: 'Tierra', electric: 'Eléctrico', flying: 'Volador', ice: 'Hielo', grass: 'Planta', poison: 'Veneno', steel: 'Acero', fighting: 'Lucha' }
const DARK_INK = new Set(['electric', 'ice', 'ground', 'steel', 'normal'])

const SPR = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites'
export const spriteUrl = (id: number, shiny = false) => `${SPR}/pokemon/${shiny ? 'shiny/' : ''}${id}.png`
export const itemUrl = (name: string) => `${SPR}/items/${name}.png`

/** Muelle a partir de un fotograma (en compases o fotogramas). */
export function useSpring(delay: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 140, mass: 0.7, ...config } })
}
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export function prog(frame: number, a: number, b: number, ease = (x: number) => x) {
  return ease(clamp01((frame - a) / (b - a)))
}
export const outCubic = (x: number) => 1 - Math.pow(1 - x, 3)
export const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

// ---------- texto ----------
type TxtProps = { children: React.ReactNode; size: number; color?: string; font?: string; stroke?: string; weight?: number; style?: React.CSSProperties; glow?: string }
export function Txt({ children, size, color = '#fff', font = FR, stroke, weight = 700, style, glow }: TxtProps) {
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: 1.05,
        textAlign: 'center',
        WebkitTextStroke: stroke ? `${Math.round(size * 0.07)}px ${stroke}` : undefined,
        paintOrder: 'stroke fill',
        textShadow: glow ? `0 0 ${size * 0.4}px ${glow}, 0 ${size * 0.06}px 0 rgba(0,0,0,.35)` : `0 ${size * 0.06}px 0 rgba(0,0,0,.35)`,
        letterSpacing: font === PX ? 2 : -1,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Letras que caen una a una con rebote y un poco de giro. */
export function Kinetic({ text, delay, size, color = '#fff', stroke = '#0b0f22', font = FR, stagger = 1.5, from = 'top' }: { text: string; delay: number; size: number; color?: string; stroke?: string; font?: string; stagger?: number; from?: 'top' | 'scale' }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'nowrap' }}>
      {[...text].map((ch, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 10, stiffness: 180, mass: 0.6 } })
        const y = from === 'top' ? interpolate(s, [0, 1], [-size * 1.4, 0]) : 0
        const sc = from === 'scale' ? interpolate(s, [0, 1], [3, 1]) : interpolate(s, [0, 1], [0.4, 1])
        const rot = interpolate(s, [0, 1], [(random(`r${text}${i}`) - 0.5) * 60, 0])
        return (
          <span key={i} style={{ display: 'inline-block', transform: `translateY(${y}px) scale(${sc}) rotate(${rot}deg)`, opacity: clamp01(s * 2), whiteSpace: 'pre' }}>
            <Txt size={size} color={color} stroke={stroke} font={font}>
              {ch}
            </Txt>
          </span>
        )
      })}
    </div>
  )
}

/** Golpe: aparece enorme y "aterriza" con temblor. */
export function Slam({ children, delay, from = 2.6 }: { children: React.ReactNode; delay: number; from?: number }) {
  const s = useSpring(delay, { damping: 9, stiffness: 220, mass: 0.6 })
  const frame = useCurrentFrame()
  if (frame < delay) return null
  const sc = interpolate(s, [0, 1], [from, 1])
  return <div style={{ transform: `scale(${sc})`, opacity: clamp01(s * 3) }}>{children}</div>
}

/** Aparición con muelle (escala), útil para tarjetas e iconos. */
export function Pop({ children, delay, style, rot = 0 }: { children: React.ReactNode; delay: number; style?: React.CSSProperties; rot?: number }) {
  const s = useSpring(delay)
  const frame = useCurrentFrame()
  if (frame < delay) return null
  return <div style={{ transform: `scale(${s}) rotate(${(1 - s) * rot}deg)`, opacity: clamp01(s * 2), ...style }}>{children}</div>
}

/** Separación RGB (efecto "glitch") durante unos fotogramas. */
export function Glitch({ children, at, len = 6 }: { children: React.ReactNode; at: number[]; len?: number }) {
  const frame = useCurrentFrame()
  const on = at.some((a) => frame >= a && frame < a + len)
  if (!on) return <>{children}</>
  const d = 10 + random(frame) * 14
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${-d}px,0)`, filter: 'drop-shadow(0 0 0 #ff2a6d)', mixBlendMode: 'screen', opacity: 0.8 }}>
        <div style={{ filter: 'sepia(1) saturate(20) hue-rotate(-50deg)' }}>{children}</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${d}px,${d * 0.3}px)`, mixBlendMode: 'screen', opacity: 0.8 }}>
        <div style={{ filter: 'sepia(1) saturate(20) hue-rotate(160deg)' }}>{children}</div>
      </div>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

// ---------- cámara ----------
/** Temblor de cámara que decae tras cada golpe. */
export function Shake({ children, hits, power = 26 }: { children: React.ReactNode; hits: number[]; power?: number }) {
  const frame = useCurrentFrame()
  let amp = 0
  for (const h of hits) if (frame >= h) amp = Math.max(amp, power * Math.exp(-(frame - h) / 4))
  const x = noise2D('sx', frame * 0.9, 0) * amp
  const y = noise2D('sy', frame * 0.9, 0) * amp
  const r = noise2D('sr', frame * 0.9, 0) * amp * 0.05
  return <AbsoluteFill style={{ transform: `translate(${x}px,${y}px) rotate(${r}deg)` }}>{children}</AbsoluteFill>
}

/** Acercamiento lento continuo + pulso en cada compás. */
export function Camera({ children, zoom = 0.06, dur }: { children: React.ReactNode; zoom?: number; dur: number }) {
  const frame = useCurrentFrame()
  const beat = 1 - (frame % B) / B
  const sc = 1 + (frame / dur) * zoom + Math.pow(beat, 6) * 0.012
  return <AbsoluteFill style={{ transform: `scale(${sc})` }}>{children}</AbsoluteFill>
}

// ---------- fondos y efectos ----------
export function Bg({ a, b, accent = '#ffcb05', stripes = true }: { a: string; b: string; accent?: string; stripes?: boolean }) {
  const frame = useCurrentFrame()
  const ang = 160 + Math.sin(frame / 40) * 20
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${ang}deg, ${a}, ${b})`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + Math.sin(frame / 30) * 20}% ${40 + Math.cos(frame / 35) * 15}%, ${accent}33, transparent 55%)` }} />
      {stripes && (
        <AbsoluteFill style={{ opacity: 0.07, transform: `rotate(-28deg) scale(2) translateY(${(frame * 6) % 240}px)` }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', left: -600, right: -600, top: i * 240 - 1200, height: 90, background: '#fff' }} />
          ))}
        </AbsoluteFill>
      )}
      {Array.from({ length: 26 }, (_, i) => {
        const x = random(`px${i}`) * W
        const sp = 0.6 + random(`ps${i}`) * 1.6
        const y = (((random(`py${i}`) * H - frame * sp * 6) % H) + H) % H
        const s = 6 + random(`pz${i}`) * 14
        const o = 0.25 + noise2D(`po${i}`, frame / 60, 0) * 0.25
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: s, background: '#fff', opacity: o, boxShadow: `0 0 ${s * 2}px #fff` }} />
      })}
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,.5))' }} />
    </AbsoluteFill>
  )
}

export function Flash({ at, len = 8, color = '#fff', max = 0.85 }: { at: number; len?: number; color?: string; max?: number }) {
  const frame = useCurrentFrame()
  if (frame < at || frame > at + len) return null
  return <AbsoluteFill style={{ background: color, opacity: max * (1 - (frame - at) / len) }} />
}

/** Líneas de velocidad desde el centro (impacto). */
export function SpeedLines({ at, len = 14, color = '#fff', cx = W / 2, cy = H / 2, n = 28 }: { at: number; len?: number; color?: string; cx?: number; cy?: number; n?: number }) {
  const frame = useCurrentFrame()
  const k = (frame - at) / len
  if (k < 0 || k > 1) return null
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`sl${i}`) * 0.2
        const r0 = 200 + outCubic(k) * 700
        const r1 = r0 + 300 * (1 - k)
        return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} stroke={color} strokeWidth={14 * (1 - k)} strokeLinecap="round" opacity={1 - k} />
      })}
    </svg>
  )
}

export function Ring({ at, cx = W / 2, cy = H / 2, color = '#ffcb05', max = 700, len = 18 }: { at: number; cx?: number; cy?: number; color?: string; max?: number; len?: number }) {
  const frame = useCurrentFrame()
  const k = (frame - at) / len
  if (k < 0 || k > 1) return null
  const r = outCubic(k) * max
  return <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `${30 * (1 - k)}px solid ${color}`, opacity: 1 - k }} />
}

export function Confetti({ at, n = 120, seed = 'c' }: { at: number; n?: number; seed?: string }) {
  const frame = useCurrentFrame()
  const t = (frame - at) / 30
  if (t < 0 || t > 2.6) return null
  const cols = ['#ffcb05', '#e3242b', '#3ddc84', '#29a8ff', '#ff7ab8', '#fff']
  return (
    <AbsoluteFill>
      {Array.from({ length: n }, (_, i) => {
        const vx = (random(`${seed}x${i}`) - 0.5) * 1900
        const vy = -1000 - random(`${seed}y${i}`) * 1400
        const x = W / 2 + vx * t
        const y = H * 0.55 + vy * t + 1700 * t * t
        const w = 18 + random(`${seed}w${i}`) * 20
        const rot = (random(`${seed}r${i}`) - 0.5) * 1400 * t
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: w, height: w * 0.5, background: cols[i % cols.length], transform: `rotate(${rot}deg) rotateX(${rot * 2}deg)`, opacity: clamp01(2.6 - t) }} />
      })}
    </AbsoluteFill>
  )
}

export function Sparkles({ cx, cy, spread = 260, n = 14, seed = 's', from = 0 }: { cx: number; cy: number; spread?: number; n?: number; seed?: string; from?: number }) {
  const frame = useCurrentFrame()
  if (frame < from) return null
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const ph = random(`${seed}p${i}`) * 6
        const x = cx + (random(`${seed}x${i}`) - 0.5) * spread * 2
        const y = cy + (random(`${seed}y${i}`) - 0.5) * spread * 2
        const s = 26 + random(`${seed}s${i}`) * 40
        const a = Math.max(0, Math.sin(frame / 4 + ph))
        return (
          <svg key={i} width={s} height={s} viewBox="-10 -10 20 20" style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, opacity: a, transform: `rotate(${frame * 4 + ph * 50}deg) scale(${0.5 + a * 0.7})` }}>
            <path d="M0-10 L2.5-2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5-2.5Z" fill="#fff6b0" />
          </svg>
        )
      })}
    </>
  )
}

// ---------- cosas de Pokémon ----------
export function Sprite({ id, size, shiny, sil, style }: { id: number; size: number; shiny?: boolean; sil?: boolean; style?: React.CSSProperties }) {
  return <Img src={spriteUrl(id, shiny)} style={{ width: size, height: size, imageRendering: 'pixelated', filter: sil ? 'brightness(0) opacity(.55)' : 'drop-shadow(0 12px 0 rgba(0,0,0,.25))', ...style }} />
}
export function Item({ name, size, style }: { name: string; size: number; style?: React.CSSProperties }) {
  return <Img src={itemUrl(name)} style={{ width: size, height: size, imageRendering: 'pixelated', ...style }} />
}

export function PokeBall({ size, open = 0, rot = 0, style }: { size: number; open?: number; rot?: number; style?: React.CSSProperties }) {
  const g = open * size * 0.45
  const s = size
  return (
    <div style={{ width: s, height: s, position: 'relative', transform: `rotate(${rot}deg)`, ...style }}>
      <div style={{ position: 'absolute', left: 0, top: -g, width: s, height: s / 2, background: 'linear-gradient(#ff4b4f,#c8101a)', borderRadius: `${s}px ${s}px 0 0`, border: `${s * 0.05}px solid #111`, boxSizing: 'border-box' }} />
      <div style={{ position: 'absolute', left: 0, top: s / 2 + g, width: s, height: s / 2, background: 'linear-gradient(#fff,#cfd3dc)', borderRadius: `0 0 ${s}px ${s}px`, border: `${s * 0.05}px solid #111`, boxSizing: 'border-box' }} />
      {open < 0.05 && <div style={{ position: 'absolute', left: s * 0.36, top: s * 0.36, width: s * 0.28, height: s * 0.28, borderRadius: '50%', background: '#fff', border: `${s * 0.05}px solid #111`, boxSizing: 'border-box' }} />}
    </div>
  )
}

export function TypePill({ type, size = 30 }: { type: string; size?: number }) {
  return (
    <span style={{ display: 'inline-block', padding: `${size * 0.22}px ${size * 0.6}px`, borderRadius: size, background: TYPE[type], color: DARK_INK.has(type) ? '#1b1d26' : '#fff', fontFamily: FR, fontWeight: 700, fontSize: size, marginRight: size * 0.3 }}>
      {TYPE_ES[type] ?? type}
    </span>
  )
}

export function Lcd({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 3px, transparent 3px 8px), linear-gradient(#b9d84a,#9bbc0f)', border: '8px solid #1f3b12', borderRadius: 24, boxShadow: 'inset 0 6px 0 rgba(255,255,255,.35), 0 14px 0 -4px rgba(0,0,0,.3)', fontFamily: PX, color: '#1f3b12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...style }}>
      {children}
    </div>
  )
}

export function Card({ children, color = '#33438f', style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return <div style={{ background: 'linear-gradient(160deg,#1d2a5e,#141b3f)', border: `6px solid ${color}`, borderRadius: 34, boxShadow: `0 20px 0 -6px rgba(0,0,0,.35), 0 0 40px ${color}55`, ...style }}>{children}</div>
}

/** Móvil con la cabecera de PokeSave (como la web de verdad). */
export function Phone({ children, w = 620, h = 1240, style }: { children: React.ReactNode; w?: number; h?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 80, background: '#0b0f22', padding: 18, boxShadow: '0 40px 80px rgba(0,0,0,.55), inset 0 0 0 4px #3a4380', ...style }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 64, overflow: 'hidden', background: '#0e1430', position: 'relative' }}>
        <div style={{ height: 150, background: 'linear-gradient(#ff4b4f,#e3242b)', display: 'flex', alignItems: 'flex-end', padding: '0 34px 24px', gap: 16 }}>
          <PokeBall size={48} />
          <div style={{ fontFamily: FR, fontWeight: 700, fontSize: 40, color: '#fff' }}>PokeSave</div>
          <div style={{ marginLeft: 'auto', fontFamily: FR, fontWeight: 700, fontSize: 24, color: '#fff', background: 'rgba(0,0,0,.25)', padding: '6px 16px', borderRadius: 20 }}>● Listo</div>
        </div>
        <div style={{ position: 'absolute', top: 18, left: '50%', width: 150, height: 34, marginLeft: -75, background: '#000', borderRadius: 20 }} />
        {children}
      </div>
    </div>
  )
}

export function Check({ size = 70, color = '#3ddc84', k = 1 }: { size?: number; color?: string; k?: number }) {
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" style={{ transform: `scale(${k})` }}>
      <circle r={11} fill={color} />
      <path d="M-5 0 L-1.5 4 L5.5 -4" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={20} strokeDashoffset={20 * (1 - k)} />
    </svg>
  )
}

export const center: React.CSSProperties = { position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center' }
