// Música y efectos del vídeo, sintetizados desde cero (sin samples de nadie) y sincronizados
// con src/timeline.json: cada escena, transición y "golpe" cae exactamente en su compás.
// Uso: node scripts/music.mjs → public/music.wav
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const T = JSON.parse(readFileSync(resolve(here, '../src/timeline.json'), 'utf8'))
const SR = 44100
const BEAT = 60 / T.bpm
const FRAME = 1 / T.fps
const totalFrames = T.scenes.reduce((s, x) => s + x.beats * T.beat, 0) - (T.scenes.length - 1) * T.transition
const DUR = totalFrames * FRAME + 0.6
const N = Math.ceil(DUR * SR)
const L = new Float32Array(N)
const R = new Float32Array(N)
const duck = new Float32Array(N).fill(1) // sidechain del bombo sobre bajo y acordes

// Inicio (en segundos) de cada escena
const starts = {}
let f = 0
T.scenes.forEach((s, i) => {
  starts[s.id] = f * FRAME
  f += s.beats * T.beat - (i < T.scenes.length - 1 ? T.transition : 0)
})

let seed = 1
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

function biquad(type, freq, q = 0.7) {
  const w = (2 * Math.PI * freq) / SR, a = Math.sin(w) / (2 * q), c = Math.cos(w)
  let b0, b1, b2
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0 }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0 }
  else { b0 = a; b1 = 0; b2 = -a }
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  return (x) => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y }
}

/** Mete un sonido generado muestra a muestra. gen(t, i) → [l, r] o número. */
function put(at, dur, gen, { ducked = false, pan = 0 } = {}) {
  const s0 = Math.floor(at * SR), n = Math.floor(dur * SR)
  for (let i = 0; i < n; i++) {
    const k = s0 + i
    if (k < 0 || k >= N) continue
    let v = gen(i / SR, i)
    if (ducked) v *= duck[k]
    L[k] += v * (1 - Math.max(0, pan))
    R[k] += v * (1 + Math.min(0, pan))
  }
}

// ---------- instrumentos ----------
function kick(at, gain = 1) {
  put(at, 0.32, (t) => {
    const fr = 45 + 120 * Math.exp(-t * 28)
    const ph = 2 * Math.PI * (45 * t + (120 / 28) * (1 - Math.exp(-t * 28)))
    return (Math.sin(ph) * Math.exp(-t * 9) + (t < 0.004 ? noise() * 0.6 : 0)) * gain * 0.9 + fr * 0
  })
  const s0 = Math.floor(at * SR)
  for (let i = 0; i < SR * 0.22; i++) if (s0 + i < N) duck[s0 + i] = Math.min(duck[s0 + i], 0.25 + 0.75 * (i / (SR * 0.22)))
}
function snare(at, gain = 1) {
  const bp = biquad('bp', 1900, 0.9)
  put(at, 0.22, (t) => (bp(noise()) * 2.2 * Math.exp(-t * 18) + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30) * 0.5) * gain * 0.55)
}
function hat(at, gain = 1, open = false) {
  const hp = biquad('hp', 8000)
  put(at, open ? 0.2 : 0.05, (t) => hp(noise()) * Math.exp(-t * (open ? 14 : 70)) * gain * 0.25, { pan: 0.25 })
}
function bass(at, dur, note, gain = 1) {
  const lp = biquad('lp', 900, 1.2)
  put(at, dur, (t) => { const p = (t * midi(note)) % 1; return lp(2 * p - 1) * Math.min(1, t * 200) * Math.exp(-t * 2) * gain * 0.42 }, { ducked: true })
}
function lead(at, dur, note, gain = 1, pan = 0) {
  put(at, dur, (t) => { const v = Math.sin(2 * Math.PI * 5.5 * t) * 0.004; const p = (t * midi(note) * (1 + v)) % 1; return (p < 0.5 ? 1 : -1) * Math.min(1, t * 400) * Math.exp(-t * 7) * gain * 0.09 }, { pan })
}
function pad(at, dur, notes, gain = 1) {
  const lp = biquad('lp', 1500)
  put(at, dur, (t) => { let s = 0; for (const n of notes) for (const d of [-0.12, 0.12]) s += ((t * midi(n + d)) % 1) * 2 - 1; return lp(s) * Math.min(1, t * 8) * Math.min(1, (dur - t) * 8) * gain * 0.025 }, { ducked: true })
}

// ---------- efectos ----------
const sfx = {
  impact(at) { kick(at, 1.2); const bp = biquad('bp', 800, 0.5); put(at, 0.5, (t) => bp(noise()) * Math.exp(-t * 7) * 0.9); put(at, 0.6, (t) => Math.sin(2 * Math.PI * 50 * t) * Math.exp(-t * 4) * 0.7) },
  boom(at) { kick(at, 1.3); put(at, 1.6, (t) => Math.sin(2 * Math.PI * (38 + 30 * Math.exp(-t * 3)) * t) * Math.exp(-t * 2) * 0.9); const lp = biquad('lp', 2500); put(at, 1.2, (t) => lp(noise()) * Math.exp(-t * 3) * 0.45) },
  ding(at) { put(at, 1.2, (t) => (Math.sin(2 * Math.PI * 1318 * t) + 0.5 * Math.sin(2 * Math.PI * 2637 * t) + 0.25 * Math.sin(2 * Math.PI * 3951 * t)) * Math.exp(-t * 4) * 0.16) },
  pop(at) { put(at, 0.14, (t) => Math.sin(2 * Math.PI * (500 + 1800 * t / 0.14) * t) * Math.exp(-t * 25) * 0.4) },
  shiny(at) { [76, 81, 84, 88, 93, 96].forEach((n, i) => put(at + i * 0.045, 0.9, (t) => (Math.sin(2 * Math.PI * midi(n) * t) + 0.4 * Math.sin(4 * Math.PI * midi(n) * t)) * Math.exp(-t * 5) * 0.11, { pan: i % 2 ? 0.4 : -0.4 })) },
}
function whoosh(at, dur = 0.5) {
  let st = 0
  put(at, dur, (t) => {
    const k = t / dur, fr = 300 + 6000 * Math.sin(Math.PI * k)
    const w = (2 * Math.PI * fr) / SR, a = Math.sin(w) / 1.4
    st = st * (1 - a) + noise() * a
    return st * Math.sin(Math.PI * k) * 1.6
  })
}
function riser(at, dur) {
  let st = 0
  put(at, dur, (t) => { const k = t / dur; const w = (2 * Math.PI * (200 + 8000 * k * k)) / SR, a = Math.sin(w) / 1.5; st = st * (1 - a) + noise() * a; return st * k * k * 1.4 + Math.sin(2 * Math.PI * (200 + 900 * k) * t) * k * 0.08 })
}

// ---------- canción ----------
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] // Lam Fa Do Sol
const DROP = starts.hook + 3.5 * BEAT
const END = totalFrames * FRAME
const beats = Math.floor(END / BEAT)
riser(0.2, DROP - 0.2)
for (let i = 0; i < beats; i++) {
  const t = i * BEAT
  if (t < DROP - 0.01) continue
  const bar = Math.floor((t - DROP) / (BEAT * 4))
  const ch = CHORDS[bar % 4]
  const last = t > END - BEAT * 2
  kick(t)
  if (i % 2 === 1) snare(t)
  hat(t + BEAT / 2, 1, i % 4 === 3)
  hat(t + BEAT / 4, 0.5)
  hat(t + (3 * BEAT) / 4, 0.5)
  bass(t, BEAT / 2 * 0.95, ch[0] - 24)
  bass(t + BEAT / 2, BEAT / 2 * 0.95, ch[0] - 12)
  if (!last) for (let s = 0; s < 4; s++) lead(t + (s * BEAT) / 4, BEAT / 4, ch[[0, 1, 2, 1][s]] + 12 + (s === 2 && bar % 2 ? 12 : 0), 1, s % 2 ? 0.3 : -0.3)
  if (i % 4 === 0) pad(t, BEAT * 4, ch)
}
// redobles antes de algunas escenas
for (const id of ['editor', 'dex', 'ds', 'outro']) for (let k = 0; k < 4; k++) snare(starts[id] - BEAT + k * (BEAT / 4), 0.5 + k * 0.15)
// transiciones
T.scenes.forEach((s, i) => { if (i > 0) whoosh(starts[s.id] - 0.05, 0.55) })
// golpes
for (const h of T.hits) sfx[h.sfx](starts[h.scene] + h.beat * BEAT)
sfx.boom(END - 0.05)

// ---------- mezcla y WAV ----------
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
const g = 0.95 / Math.max(1, peak * 0.6)
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40)
const soft = (x) => Math.tanh(x * g)
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(soft(L[i]) * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(soft(R[i]) * 32000), 46 + i * 4) }
writeFileSync(resolve(here, '../public/music.wav'), buf)
console.log(`music.wav: ${DUR.toFixed(1)} s, pico ${peak.toFixed(2)}`)
