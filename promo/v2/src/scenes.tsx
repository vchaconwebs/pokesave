import React from 'react'
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion'
import { CameraMotionBlur } from '@remotion/motion-blur'
import {
  B, Bg, Camera, Card, Check, Confetti, Flash, FR, Glitch, H, Item, Kinetic, Lcd, Phone, PokeBall, Pop, PX, Ring, Shake, Slam, Sparkles, SpeedLines, Sprite, Txt, TypePill, W, center, clamp01, inOut, outCubic, prog, useSpring,
} from './kit'

const b = (n: number) => Math.round(n * B)
type P = { dur: number }

const TEAM = [
  { id: 555, n: 'Darmanitan', l: 51, t: ['fire'] },
  { id: 537, n: 'Seismitoad', l: 51, t: ['water', 'ground'] },
  { id: 642, n: 'Thundurus', l: 51, t: ['electric', 'flying'] },
  { id: 584, n: 'Vanilluxe', l: 51, t: ['ice'] },
  { id: 591, n: 'Amoonguss', l: 51, t: ['grass', 'poison'] },
  { id: 530, n: 'Excadrill', l: 53, t: ['ground', 'steel'] },
]

// ---------- 1 · Gancho ----------
export function Hook({ dur }: P) {
  const frame = useCurrentFrame()
  const open = prog(frame, b(3.5), b(4.2), outCubic)
  const ball = useSpring(b(2.6), { damping: 8 })
  const spin = interpolate(frame, [b(2.6), b(3.5)], [-720, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const wobble = frame > b(3) && frame < b(3.5) ? Math.sin(frame * 1.6) * 14 : 0
  const pika = useSpring(b(3.6), { damping: 7 })
  return (
    <AbsoluteFill>
      <Bg a="#1a0306" b="#e3242b" accent="#ffcb05" />
      <Shake hits={[0, b(1), b(2), b(3.5)]}>
        <Camera dur={dur} zoom={0.08}>
          <div style={{ ...center, top: 230 }}>
            <Glitch at={[0, b(1), b(2)]}>
              <div>
                <Slam delay={0}>
                  <Txt size={150} stroke="#3a0007">¿TU PARTIDA</Txt>
                </Slam>
                <Slam delay={b(1)}>
                  <Txt size={150} stroke="#3a0007">DE POKÉMON?</Txt>
                </Slam>
              </div>
            </Glitch>
          </div>
          <div style={{ ...center, top: 600 }}>
            <Slam delay={b(2)} from={4}>
              <Txt size={230} color="#ffcb05" stroke="#1b1d26" glow="#ffcb05" style={{ transform: 'rotate(-5deg)' }}>
                EDÍTALA
              </Txt>
            </Slam>
          </div>
          {frame >= b(2.6) && (
            <div style={{ position: 'absolute', left: W / 2 - 200, top: 1060, transform: `scale(${ball}) rotate(${wobble}deg)` }}>
              <PokeBall size={400} open={open} rot={spin} />
            </div>
          )}
          {frame >= b(3.6) && (
            <div style={{ position: 'absolute', left: W / 2 - 330, top: 1000 - pika * 120, transform: `scale(${pika})` }}>
              <Sprite id={25} size={660} />
            </div>
          )}
          <Ring at={b(3.5)} cy={1260} color="#fff" max={900} />
          <SpeedLines at={b(3.5)} cy={1260} />
          <div style={{ ...center, top: 1640 }}>
            <Kinetic text="desde el navegador" delay={b(4.6)} size={76} stagger={1} />
          </div>
        </Camera>
      </Shake>
      <Flash at={b(3.5)} len={10} />
    </AbsoluteFill>
  )
}

// ---------- 2 · Todos los juegos ----------
const GAMES: [string, number, string][] = [
  ['ROJO', 150, '#ef4444'], ['ORO', 250, '#d4a017'], ['RUBÍ', 383, '#e11d48'], ['DIAMANTE', 483, '#60a5fa'], ['BLANCO', 643, '#e5e7eb'],
  ['X', 716, '#3b82f6'], ['SOL', 791, '#f59e0b'], ['ESPADA', 888, '#38bdf8'], ['ESCARLATA', 1007, '#ef4444'], ['Z-A', 718, '#22c55e'],
]
export function Games({ dur }: P) {
  const frame = useCurrentFrame()
  const idx = Math.min(GAMES.length - 1, Math.floor(prog(frame, b(0.5), b(4)) * GAMES.length))
  const [name, legend, color] = GAMES[idx]
  const local = (frame - b(0.5)) % Math.round((b(3.5)) / GAMES.length)
  const pulse = 1 + 0.2 * Math.exp(-local / 2)
  const gen = Math.min(9, 1 + Math.floor(prog(frame, b(0.5), b(4)) * 9))
  const final = useSpring(b(4), { damping: 8 })
  return (
    <AbsoluteFill>
      <Bg a="#05070f" b={color} accent={color} />
      <Camera dur={dur} zoom={0.1}>
        <div style={{ ...center, top: 220 }}>
          <Kinetic text="TODOS LOS JUEGOS" delay={0} size={104} stagger={1} />
        </div>
        {/* carrusel de legendarios en abanico */}
        {GAMES.map(([, id], i) => {
          const off = i - prog(frame, b(0.5), b(4)) * (GAMES.length - 1)
          const x = W / 2 + off * 420
          const sc = Math.max(0.35, 1 - Math.abs(off) * 0.4)
          const o = clamp01(1 - Math.abs(off) * 0.55)
          return (
            <div key={id} style={{ position: 'absolute', left: x - 260, top: 560 - (1 - sc) * -120, transform: `scale(${sc}) rotateY(${off * 25}deg)`, opacity: o }}>
              <Sprite id={id} size={520} />
            </div>
          )
        })}
        <div style={{ ...center, top: 1120, transform: `scale(${pulse})` }}>
          <Txt size={name.length > 7 ? 120 : 170} color={color} stroke="#05070f" font={PX}>
            {name}
          </Txt>
        </div>
        <div style={{ ...center, top: 1400 }}>
          <Lcd style={{ width: 760, height: 220, transform: `scale(${frame >= b(4) ? final : 1})` }}>
            <div style={{ fontSize: 86 }}>GEN {frame >= b(4) ? '1 → 9' : gen}</div>
          </Lcd>
        </div>
      </Camera>
      <Flash at={b(4)} len={6} max={0.6} />
    </AbsoluteFill>
  )
}

// ---------- 3 · Subir partida ----------
export function Upload({ dur }: P) {
  const frame = useCurrentFrame()
  const phone = useSpring(0, { damping: 13 })
  const fall = prog(frame, b(0.3), b(1.5), (x) => x * x)
  const caught = frame >= b(1.5)
  const card = useSpring(b(2.2), { damping: 12 })
  return (
    <AbsoluteFill>
      <Bg a="#0e1430" b="#243a8f" />
      <Shake hits={[b(1.5)]}>
        <Camera dur={dur}>
          <div style={{ ...center, top: 170 }}>
            <Kinetic text="SUBE TU .SAV" delay={0} size={120} stagger={1.2} />
          </div>
          <div style={{ position: 'absolute', left: W / 2 - 310, top: 420 + (1 - phone) * 1500 }}>
            <Phone w={620} h={1320}>
              <div style={{ padding: 40 }}>
                {!caught ? (
                  <div style={{ marginTop: 200, height: 520, border: '6px dashed #3a4380', borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Txt size={44} color="#a8b0d6">Suelta aquí tu partida</Txt>
                  </div>
                ) : (
                  <>
                    <Pop delay={b(1.5)}>
                      <Lcd style={{ height: 230, marginTop: 30 }}>
                        <div style={{ fontSize: 40 }}>¡PARTIDA</div>
                        <div style={{ fontSize: 40, marginTop: 14 }}>ATRAPADA!</div>
                      </Lcd>
                    </Pop>
                    <div style={{ transform: `translateX(${(1 - card) * 700}px)`, marginTop: 40 }}>
                      <Card color="#ffcb05" style={{ padding: 34 }}>
                        <Txt size={30} color="#a8b0d6" style={{ textAlign: 'left' }}>TARJETA DE ENTRENADOR</Txt>
                        <Txt size={96} style={{ textAlign: 'left', marginTop: 10 }}>Fl3xix</Txt>
                        <div style={{ display: 'flex', gap: 14, marginTop: 20 }}>
                          {Array.from({ length: 8 }, (_, i) => (
                            <div key={i} style={{ width: 46, height: 46, borderRadius: '50%', background: frame > b(2.6) + i * 2 ? '#ffcb05' : '#2a3366', boxShadow: frame > b(2.6) + i * 2 ? '0 0 20px #ffcb05' : 'none' }} />
                          ))}
                        </div>
                        <Txt size={34} color="#ffcb05" style={{ textAlign: 'left', marginTop: 18 }}>Blanco · 8 medallas</Txt>
                      </Card>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 34 }}>
                      {TEAM.map((m, i) => (
                        <Pop key={m.id} delay={b(3) + i * 3}>
                          <div style={{ background: '#182150', borderRadius: 24, border: `4px solid ${TYPEC(m.t[0])}`, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sprite id={m.id} size={150} />
                          </div>
                        </Pop>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Phone>
          </div>
          {!caught && (
            <div style={{ position: 'absolute', left: W / 2 - 120, top: interpolate(fall, [0, 1], [-300, 900]), transform: `rotate(${(1 - fall) * 40}deg)` }}>
              <div style={{ width: 240, height: 300, background: '#fff', borderRadius: 26, boxShadow: '0 20px 40px rgba(0,0,0,.4)', overflow: 'hidden' }}>
                <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 120 }}>💾</div>
                <div style={{ height: 90, background: '#29a8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={50}>.sav</Txt>
                </div>
              </div>
            </div>
          )}
          <Ring at={b(1.5)} cy={800} />
          <SpeedLines at={b(1.5)} cy={800} color="#ffcb05" />
        </Camera>
      </Shake>
      <Flash at={b(1.5)} len={6} />
    </AbsoluteFill>
  )
}

// ---------- 4 · Equipo ----------
export function Team({ dur }: P) {
  const frame = useCurrentFrame()
  const tap = frame >= b(4.5)
  const zoomIn = prog(frame, b(4.5), b(5), inOut)
  return (
    <AbsoluteFill>
      <Bg a="#141a3d" b="#3b1f6b" accent="#a855f7" />
      <Camera dur={dur}>
        <AbsoluteFill style={{ transform: `scale(${1 + zoomIn * 1.6})`, transformOrigin: '290px 640px' }}>
          <div style={{ ...center, top: 190 }}>
            <Kinetic text="TU EQUIPO" delay={0} size={140} />
          </div>
          {TEAM.map((m, i) => {
            const col = i % 2
            const row = Math.floor(i / 2)
            const d = b(0.5) + i * 4
            return (
              <CardIn key={m.id} delay={d} dir={col ? 1 : -1}>
                <div style={{ position: 'absolute', left: 65 + col * 490, top: 420 + row * 430 }}>
                  <Card color={TYPEC(m.t[0])} style={{ width: 460, height: 390, padding: 22, boxSizing: 'border-box', position: 'relative', outline: tap && i === 0 ? '10px solid #fff' : 'none' }}>
                    <div style={{ position: 'absolute', left: -10, top: 10 + Math.sin((frame + i * 9) / 6) * 10 }}>
                      <Sprite id={m.id} size={260} />
                    </div>
                    <div style={{ position: 'absolute', right: 26, top: 40, textAlign: 'right' }}>
                      <Txt size={42} style={{ textAlign: 'right' }}>{m.n}</Txt>
                      <Txt size={34} color="#a8b0d6" style={{ textAlign: 'right', marginTop: 8 }}>Nv. {m.l}</Txt>
                    </div>
                    <div style={{ position: 'absolute', left: 24, bottom: 26 }}>
                      {m.t.map((t) => <TypePill key={t} type={t} size={28} />)}
                    </div>
                  </Card>
                </div>
              </CardIn>
            )
          })}
          {frame > b(3.6) && frame < b(4.7) && (
            <div style={{ position: 'absolute', left: 300, top: 760 - prog(frame, b(3.6), b(4.4), outCubic) * 120, fontSize: 150 }}>👆</div>
          )}
          <Ring at={b(4.5)} cx={290} cy={640} color="#fff" max={300} len={10} />
        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  )
}
const TYPEC = (t: string) => ({ fire: '#EE8130', water: '#6390F0', electric: '#F7D02C', ice: '#96D9D6', grass: '#7AC74C', ground: '#E2BF65' })[t] ?? '#fff'
function CardIn({ children, delay, dir }: { children: React.ReactNode; delay: number; dir: number }) {
  const s = useSpring(delay, { damping: 12, stiffness: 120 })
  const frame = useCurrentFrame()
  if (frame < delay) return null
  return <AbsoluteFill style={{ transform: `translateX(${(1 - s) * dir * 900}px) rotate(${(1 - s) * dir * 12}deg)` }}>{children}</AbsoluteFill>
}

// ---------- 5 · Editor ----------
export function Editor({ dur }: P) {
  const frame = useCurrentFrame()
  const lvl = Math.round(interpolate(frame, [b(0.5), b(3)], [51, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut }))
  const shiny = frame >= b(4.5)
  const pop = useSpring(b(4.5), { damping: 6 })
  const mon = useSpring(0, { damping: 10 })
  const stats = ['PS', 'ATQ', 'DEF', 'AtE', 'DfE', 'VEL']
  return (
    <AbsoluteFill>
      <Bg a={shiny ? '#3a2400' : '#2b0508'} b={shiny ? '#ffb300' : '#e3242b'} accent="#fff" />
      <Shake hits={[b(3), b(4.5)]}>
        <Camera dur={dur} zoom={0.05}>
          <div style={{ ...center, top: 150 }}>
            {!shiny ? <Kinetic text="NIVEL 100" delay={0} size={140} /> : <Slam delay={b(4.5)} from={3.4}><Txt size={190} color="#ffcb05" stroke="#3a2400" glow="#fff3b0" style={{ transform: 'rotate(-6deg)' }}>¡SHINY!</Txt></Slam>}
          </div>
          <div style={{ position: 'absolute', left: W / 2 - 330, top: 330, width: 660, height: 660, borderRadius: '50%', background: `radial-gradient(circle, ${shiny ? '#fff3b0' : '#ffffff'}66, transparent 65%)`, transform: `scale(${1 + Math.sin(frame / 5) * 0.04})` }} />
          <div style={{ position: 'absolute', left: W / 2 - 340, top: 320, transform: `scale(${mon * (shiny ? 1 + (1 - pop) * 0.6 : 1)}) rotate(${shiny ? (1 - pop) * 25 : 0}deg)` }}>
            <Sprite id={555} size={680} shiny={shiny} />
          </div>
          {shiny && <Sparkles cx={W / 2} cy={660} spread={360} n={18} from={b(4.5)} />}
          <Ring at={b(4.5)} cy={660} color="#fff3b0" max={800} />
          <SpeedLines at={b(4.5)} cy={660} color="#fff3b0" />
          <div style={{ ...center, top: 1020 }}>
            <Lcd style={{ width: 820, height: 210, flexDirection: 'row', justifyContent: 'space-between', padding: '0 60px', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 52 }}>NIVEL</div>
              <div style={{ fontSize: 120, transform: `scale(${lvl === 100 ? 1 + 0.25 * Math.exp(-(frame - b(3)) / 4) : 1})` }}>{lvl}</div>
            </Lcd>
          </div>
          {stats.map((s, i) => {
            const k = prog(frame, b(1.2) + i * 3, b(2.8) + i * 3, outCubic)
            return (
              <div key={s} style={{ position: 'absolute', left: 120, top: 1300 + i * 86, display: 'flex', alignItems: 'center', gap: 24 }}>
                <Txt size={44} style={{ width: 110, textAlign: 'right' }}>{s}</Txt>
                <div style={{ width: 640, height: 48, borderRadius: 24, background: 'rgba(0,0,0,.35)', overflow: 'hidden' }}>
                  <div style={{ width: `${k * 100}%`, height: '100%', borderRadius: 24, background: k > 0.99 ? 'linear-gradient(90deg,#3ddc84,#a7ffcf)' : 'linear-gradient(90deg,#ffcf33,#fff09a)', boxShadow: k > 0.99 ? '0 0 20px #3ddc84' : 'none' }} />
                </div>
                <Txt size={44}>{Math.round(31 * k)}</Txt>
              </div>
            )
          })}
        </Camera>
      </Shake>
      <Flash at={b(4.5)} len={10} color="#fff3b0" />
    </AbsoluteFill>
  )
}

// ---------- 6 · Mochila + MT ----------
const BAG = ['rare-candy', 'master-ball', 'potion', 'max-revive', 'pp-up', 'leftovers', 'ultra-ball', 'nugget', 'lucky-egg', 'choice-scarf', 'life-orb', 'focus-sash']
export function Bag({ dur }: P) {
  const frame = useCurrentFrame()
  const n = Math.round(interpolate(frame, [b(1), b(3)], [1, 999], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut }))
  const c = useSpring(b(0.5), { damping: 10 })
  return (
    <AbsoluteFill>
      <Bg a="#062a1d" b="#1d8a5a" accent="#3ddc84" />
      <Shake hits={[b(3)]}>
        <Camera dur={dur}>
          <div style={{ ...center, top: 160 }}>
            <Kinetic text="MOCHILA Y MT" delay={0} size={120} />
          </div>
          {/* objetos en órbita */}
          {BAG.map((it, i) => {
            const a = (i / BAG.length) * Math.PI * 2 + frame / 18
            const r = 380 + Math.sin(frame / 10 + i) * 30
            const k = prog(frame, i * 1.5, i * 1.5 + 10, outCubic)
            return (
              <div key={it} style={{ position: 'absolute', left: W / 2 + Math.cos(a) * r * k - 80, top: 820 + Math.sin(a) * r * 0.8 * k - 80, transform: `rotate(${frame * 3 + i * 30}deg)` }}>
                <Item name={it} size={160} />
              </div>
            )
          })}
          <div style={{ position: 'absolute', left: W / 2 - 300, top: 620, transform: `scale(${c})` }}>
            <Card color="#ffcb05" style={{ width: 600, height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Item name="rare-candy" size={180} />
              <Txt size={48}>Caramelo Raro</Txt>
              <Txt size={110} font={PX} color="#ffcb05" style={{ marginTop: 10, transform: `scale(${n === 999 ? 1 + 0.25 * Math.exp(-(frame - b(3)) / 4) : 1})` }}>×{n}</Txt>
            </Card>
          </div>
          <Ring at={b(3)} cy={820} />
          {[['MT01', 'Puño Certero', '#C22E28'], ['MO03', 'Surf', '#6390F0'], ['MT26', 'Terremoto', '#E2BF65']].map(([a, m, col], i) => {
            const d = b(3.3) + i * 5
            const k = useSpringStatic(frame, d)
            return (
              <div key={a} style={{ position: 'absolute', left: 90, right: 90, top: 1300 + i * 150, transform: `translateX(${(1 - k) * 1100}px)`, display: 'flex', alignItems: 'center', gap: 20, background: '#182150', borderRadius: 30, padding: '18px 26px', border: '5px solid #3ddc84' }}>
                <Txt size={50}>{a}</Txt>
                <span style={{ background: col, borderRadius: 30, padding: '8px 22px', fontFamily: FR, fontWeight: 700, fontSize: 38, color: '#fff' }}>{m}</span>
                <div style={{ marginLeft: 'auto' }}>
                  <Check size={74} k={clamp01((frame - d - 6) / 8)} />
                </div>
              </div>
            )
          })}
        </Camera>
      </Shake>
    </AbsoluteFill>
  )
}
function useSpringStatic(frame: number, d: number) {
  const x = clamp01((frame - d) / 12)
  return 1 - Math.pow(1 - x, 3) * Math.cos(x * 6) // rebote ligero sin hook (dentro de map)
}

// ---------- 7 · Pokédex ----------
export function Dex({ dur }: P) {
  const frame = useCurrentFrame()
  const fill = prog(frame, b(0.5), b(4))
  const cols = 6
  const rows = 8
  const n = Math.round(156 * fill)
  return (
    <AbsoluteFill>
      <Bg a="#0e1430" b="#1f5fa8" accent="#29a8ff" />
      <Shake hits={[b(4)]}>
        <Camera dur={dur} zoom={0.12}>
          <div style={{ ...center, top: 150 }}>
            <Kinetic text="POKÉDEX" delay={0} size={150} />
          </div>
          {Array.from({ length: cols * rows }, (_, i) => {
            const c = i % cols
            const r = Math.floor(i / cols)
            const d = (Math.hypot(c - 2.5, r - 3.5) / 5.5) * 0.9
            const on = fill > d
            const k = on ? clamp01((fill - d) * 9) : 0
            const sc = on ? 1 + Math.sin(k * Math.PI) * 0.45 : 1
            return (
              <div key={i} style={{ position: 'absolute', left: 75 + c * 155, top: 360 + r * 150, transform: `scale(${sc})` }}>
                <Sprite id={494 + i * 3} size={160} sil={!on} />
              </div>
            )
          })}
          <div style={{ ...center, top: 1620 }}>
            <Lcd style={{ width: 820, height: 170 }}>
              <div style={{ fontSize: 46, whiteSpace: 'nowrap' }}>TESELIA {n}/156</div>
            </Lcd>
          </div>
          <div style={{ ...center, top: 820 }}>
            <Slam delay={b(4)} from={3}>
              <Txt size={158} color="#ffcb05" stroke="#0b0f22" glow="#ffcb05" style={{ transform: 'rotate(-7deg)' }}>¡COMPLETA!</Txt>
            </Slam>
          </div>
        </Camera>
      </Shake>
      <Confetti at={b(4)} seed="dex" />
      <Flash at={b(4)} len={6} max={0.6} />
    </AbsoluteFill>
  )
}

// ---------- 8 · Asistente ----------
export function Assistant({ dur }: P) {
  const frame = useCurrentFrame()
  const rows = [
    { id: 610, n: 'Axew', tag: 'Salvaje', c: '#3ddc84', d: 'Ruta 11 · Nv. 22–25 · Hierba' },
    { id: 246, n: 'Larvitar', tag: 'Solo en Escarlata', c: '#ff8a3d', d: 'Pídeselo a un amigo' },
    { id: 570, n: 'Zorua', tag: 'Evento', c: '#ff7ab8', d: 'Solo con un evento oficial' },
  ]
  return (
    <AbsoluteFill>
      <Bg a="#1b0b3a" b="#7c3aed" accent="#c084fc" />
      <Camera dur={dur}>
        <div style={{ ...center, top: 150 }}>
          <Kinetic text="¿QUÉ TE FALTA?" delay={0} size={118} />
        </div>
        {/* radar */}
        <div style={{ position: 'absolute', left: W / 2 - 420, top: 380, width: 840, height: 840, borderRadius: '50%', border: '4px solid #c084fc55', background: `conic-gradient(from ${frame * 8}deg, #c084fc66, transparent 25%)`, opacity: 0.6 }} />
        {rows.map((r, i) => {
          const d = b(1) + i * Math.round(B * 0.75)
          const k = useSpringStatic(frame, d)
          const typed = r.d.slice(0, Math.floor(clamp01((frame - d - 10) / 36) * r.d.length))
          return (
            <div key={r.n} style={{ position: 'absolute', left: 70, right: 70, top: 470 + i * 360, transform: `translateX(${(1 - k) * (i % 2 ? 1200 : -1200)}px) rotate(${(1 - k) * (i % 2 ? 8 : -8)}deg)` }}>
              <Card color={r.c} style={{ height: 300, display: 'flex', alignItems: 'center', gap: 20, padding: '0 30px' }}>
                <Sprite id={r.id} size={250} />
                <div>
                  <Txt size={64} style={{ textAlign: 'left' }}>{r.n}</Txt>
                  <span style={{ display: 'inline-block', marginTop: 12, background: r.c, color: '#1b1d26', fontFamily: FR, fontWeight: 700, fontSize: 36, padding: '8px 22px', borderRadius: 30 }}>{r.tag}</span>
                  <Txt size={36} color="#e9d8ff" weight={600} style={{ textAlign: 'left', marginTop: 14 }}>{typed}</Txt>
                </div>
              </Card>
            </div>
          )
        })}
        <div style={{ ...center, top: 1580 }}>
          <Slam delay={b(3.8)}>
            <Txt size={84} color="#ffcb05" stroke="#1b0b3a">en TODOS los juegos</Txt>
          </Slam>
        </div>
      </Camera>
    </AbsoluteFill>
  )
}

// ---------- 9 · Compartir ----------
export function Share({ dur }: P) {
  const frame = useCurrentFrame()
  const phone = useSpring(0, { damping: 13 })
  const fly = prog(frame, b(2.5), b(3.5), inOut)
  return (
    <AbsoluteFill>
      <Bg a="#2a0618" b="#db2777" accent="#ff7ab8" />
      <Camera dur={dur}>
        <div style={{ ...center, top: 140 }}>
          <Kinetic text="COMPARTE" delay={0} size={140} />
        </div>
        <div style={{ ...center, top: 290 }}>
          <Kinetic text="tu equipo" delay={4} size={96} color="#ffcb05" />
        </div>
        <div style={{ position: 'absolute', left: W / 2 - 280, top: 480 + (1 - phone) * 1400, transform: `rotate(${-fly * 8}deg) scale(${1 - fly * 0.15})` }}>
          <Phone w={560} h={1100}>
            <div style={{ padding: '30px 30px' }}>
              <Txt size={58}>Fl3xix</Txt>
              <Txt size={34} color="#ffcb05">Blanco</Txt>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 26 }}>
                {TEAM.map((m, i) => (
                  <Pop key={m.id} delay={6 + i * 3}>
                    <div style={{ background: '#182150', borderRadius: 26, border: `5px solid ${TYPEC(m.t[0])}`, height: 230, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <Sprite id={m.id} size={170} />
                      <Txt size={28}>{m.n}</Txt>
                    </div>
                  </Pop>
                ))}
              </div>
            </div>
          </Phone>
        </div>
        {[['🔗', 'Enlace', -1], ['🖼️', 'Imagen', 0], ['⚔️', 'Showdown', 1]].map(([e, l, side], i) => {
          const k = useSpringStatic(frame, b(2.5) + i * 4)
          if (frame < b(2.5) + i * 4) return null
          return (
            <div key={l as string} style={{ position: 'absolute', left: W / 2 - 130 + (side as number) * 340 * k, top: 1560 - (side === 0 ? 120 : 0) * k, transform: `scale(${k})`, width: 260, height: 210, background: '#fff', borderRadius: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px rgba(0,0,0,.35)' }}>
              <div style={{ fontSize: 90 }}>{e}</div>
              <Txt size={36} color="#1b1d26">{l as string}</Txt>
            </div>
          )
        })}
      </Camera>
    </AbsoluteFill>
  )
}

// ---------- 10 · 3DS ----------
export function Ds({ dur }: P) {
  const frame = useCurrentFrame()
  const ds = useSpring(b(0.3), { damping: 12 })
  const phone = useSpring(b(3), { damping: 12 })
  const lines: [string, string][] = [['PokeSave Link', '#ff5a5a'], ['Pokémon X', '#fff'], ['', '#fff'], ['Abre en el móvil:', '#a8b0d6'], ['192.168.1.50:8000', '#29a8ff'], ['PIN  4821', '#ffcb05']]
  const shown = prog(frame, b(1), b(3)) * lines.length
  const press = frame >= b(5) && frame < b(5) + 5
  const save = prog(frame, b(5.2), b(7))
  const done = frame >= b(7)
  return (
    <AbsoluteFill>
      <Bg a="#03050c" b="#1d2a5e" accent="#29a8ff" />
      <Shake hits={[b(7)]}>
        <Camera dur={dur} zoom={0.05}>
          <div style={{ ...center, top: 120 }}>
            <Kinetic text="Y DESDE TU 3DS" delay={0} size={112} />
          </div>
          {/* consola dibujada (estilo 3DS, sin logos) */}
          <div style={{ position: 'absolute', left: 60, top: 360, transform: `scale(${ds}) rotate(${(1 - ds) * -20}deg)`, transformOrigin: '330px 500px' }}>
            <div style={{ width: 660, height: 440, background: 'linear-gradient(#2a3b85,#1d2a5e)', borderRadius: 44, padding: 40, boxSizing: 'border-box', boxShadow: 'inset 0 0 0 5px #3a4b9f' }}>
              <div style={{ width: '100%', height: '100%', background: '#05070f', borderRadius: 16, padding: 28, boxSizing: 'border-box', fontFamily: FR, fontWeight: 600 }}>
                {lines.map(([l, c], i) => (i < shown ? <div key={i} style={{ color: c, fontSize: 38, height: 54 }}>{l.slice(0, Math.ceil((shown - i) * 24))}{i === Math.floor(shown) && frame % 10 < 5 ? '▌' : ''}</div> : null))}
              </div>
            </div>
            <div style={{ width: 660, height: 470, background: 'linear-gradient(#22306b,#1a2554)', borderRadius: 44, marginTop: 14, position: 'relative', boxShadow: 'inset 0 0 0 5px #33438f' }}>
              <div style={{ position: 'absolute', left: 140, top: 40, width: 380, height: 300, background: '#05070f', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {done ? (
                  <Pop delay={b(7)}>
                    <Txt size={52} color="#3ddc84">¡Guardado!</Txt>
                    <Txt size={32} style={{ marginTop: 10 }}>Copia en la SD ✓</Txt>
                  </Pop>
                ) : (
                  <>
                    <Txt size={32} color="#a8b0d6">Copia de seguridad</Txt>
                    <div style={{ marginTop: 16 }}><Check size={80} k={clamp01((frame - b(1.5)) / 10)} /></div>
                  </>
                )}
              </div>
              <div style={{ position: 'absolute', left: 30, top: 60, width: 80, height: 80, borderRadius: '50%', background: '#111733', boxShadow: 'inset 0 0 0 16px #3a4380' }} />
              {[[560, 70, '#e3242b'], [530, 110, '#ffcb05'], [590, 110, '#29a8ff'], [560, 150, '#3ddc84']].map(([x, y, c], i) => (
                <div key={i} style={{ position: 'absolute', left: (x as number) - 22, top: (y as number) - 22, width: 44, height: 44, borderRadius: '50%', background: c as string, boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.25)' }} />
              ))}
            </div>
          </div>
          {/* señal wifi: partículas de la consola al móvil */}
          {frame > b(3) && frame < b(7.5) &&
            Array.from({ length: 14 }, (_, i) => {
              const k = ((frame / 18 + i / 14) % 1)
              const x = interpolate(k, [0, 1], [560, 820])
              const y = interpolate(k, [0, 1], [560, 840]) - Math.sin(k * Math.PI) * 140
              return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 26, height: 26, borderRadius: 13, background: '#29a8ff', boxShadow: '0 0 24px #29a8ff', opacity: Math.sin(k * Math.PI) }} />
            })}
          <div style={{ position: 'absolute', left: 640, top: 760 + (1 - phone) * 1400, transform: `rotate(${(1 - phone) * 20}deg)` }}>
            <Phone w={380} h={780}>
              <div style={{ padding: 26, textAlign: 'center' }}>
                <Txt size={30}>🎮 Conectado</Txt>
                <Txt size={30}>a tu 3DS</Txt>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}><Sprite id={658} size={210} /></div>
                <div style={{ margin: '10px auto 0', width: 300, height: 96, borderRadius: 48, background: press ? '#9e0f1b' : 'linear-gradient(#ff4b4f,#e3242b)', transform: `scale(${press ? 0.92 : 1})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 0 #7a0a14' }}>
                  <Txt size={32}>Guardar en la 3DS</Txt>
                </div>
                <div style={{ margin: '26px auto 0', width: 300, height: 26, borderRadius: 13, background: '#2a3366', overflow: 'hidden' }}>
                  <div style={{ width: `${save * 100}%`, height: '100%', background: '#3ddc84' }} />
                </div>
              </div>
            </Phone>
          </div>
          {frame > b(4.2) && frame < b(5.4) && <div style={{ position: 'absolute', left: 790, top: 1310 - prog(frame, b(4.2), b(5), outCubic) * 90, fontSize: 130 }}>👆</div>}
          <div style={{ ...center, top: 1630 }}>
            <Slam delay={b(7)} from={3}>
              <Txt size={124} color="#3ddc84" stroke="#03050c" glow="#3ddc84" style={{ transform: 'rotate(-4deg)' }}>¡SOBRESCRITA!</Txt>
            </Slam>
          </div>
          <div style={{ ...center, top: 1790 }}>
            <Pop delay={b(7.6)}>
              <Txt size={52}>con copia de seguridad</Txt>
            </Pop>
          </div>
          <Ring at={b(7)} cx={390} cy={830} color="#3ddc84" />
          <SpeedLines at={b(7)} cx={390} cy={830} color="#3ddc84" />
        </Camera>
      </Shake>
      <Flash at={b(7)} len={8} color="#d8ffe9" />
    </AbsoluteFill>
  )
}

// ---------- 11 · Final ----------
export function Outro({ dur }: P) {
  const frame = useCurrentFrame()
  const ball = useSpring(0, { damping: 7 })
  const logo = useSpring(b(0.5), { damping: 8 })
  const items = ['Gen 1 → 9', 'Gratis', 'Sin instalar nada', 'Tu partida no sale de tu móvil']
  const url = useSpring(b(4), { damping: 10 })
  return (
    <AbsoluteFill>
      <Bg a="#3a0007" b="#e3242b" accent="#ffcb05" />
      <Shake hits={[b(0.5)]}>
        <Camera dur={dur} zoom={0.06}>
          <div style={{ position: 'absolute', left: W / 2 - 170, top: 240, transform: `scale(${ball}) rotate(${(1 - ball) * 540}deg)` }}>
            <PokeBall size={340} />
          </div>
          <div style={{ ...center, top: 640, transform: `scale(${logo})` }}>
            <Txt size={190} stroke="#3a0007" glow="#ffcb05">PokeSave</Txt>
          </div>
          {items.map((s, i) => {
            const d = b(1.2) + i * 7
            const k = clamp01((frame - d) / 10)
            return (
              <div key={s} style={{ position: 'absolute', left: 120, top: 920 + i * 120, display: 'flex', alignItems: 'center', gap: 26, opacity: k, transform: `translateX(${(1 - outCubic(k)) * 200}px)` }}>
                <Check size={72} color="#ffcb05" k={k} />
                <Txt size={60} style={{ textAlign: 'left' }}>{s}</Txt>
              </div>
            )
          })}
          <div style={{ ...center, top: 1450, transform: `scale(${url})` }}>
            <Lcd style={{ width: 920, height: 190, borderRadius: 95 }}>
              <div style={{ fontSize: 36 }}>vchaconwebs.github.io</div>
              <div style={{ fontSize: 36, marginTop: 12 }}>/pokesave</div>
            </Lcd>
          </div>
          <div style={{ ...center, top: 1700, transform: `scale(${frame > b(5) ? 1 + Math.sin(frame / 3) * 0.06 : 0})` }}>
            <Txt size={100} color="#ffcb05" stroke="#3a0007">¡PRUÉBALO!</Txt>
          </div>
          <SpeedLines at={b(0.5)} cy={410} />
        </Camera>
      </Shake>
      <Confetti at={b(4)} n={150} seed="end" />
      <Flash at={b(0.5)} len={8} />
    </AbsoluteFill>
  )
}

/** Para efectos de cámara con desenfoque de movimiento real en los golpes del gancho. */
export const Blur = ({ children }: { children: React.ReactNode }) => (
  <CameraMotionBlur shutterAngle={200} samples={6}>
    {children}
  </CameraMotionBlur>
)
export const _unused = random
export const _h = H
