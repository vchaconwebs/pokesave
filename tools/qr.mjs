// Generador de códigos QR propio (sin dependencias): modo byte, corrección de errores M,
// versiones 1-10 (hasta 213 bytes). Sigue el estándar ISO/IEC 18004.
// Uso como script: node tools/qr.mjs <url> <salida.svg>
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Por versión (1-10), nivel M: bytes totales, bloques y bytes de corrección por bloque.
const RAW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]

const gfMul = (x, y) => {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0)
  r[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = gfMul(r[j], root)
      if (j + 1 < degree) r[j] ^= r[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return r
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0)
  for (const b of data) {
    const f = b ^ r.shift()
    r.push(0)
    div.forEach((d, i) => (r[i] ^= gfMul(d, f)))
  }
  return r
}

export function encode(text) {
  const bytes = [...new TextEncoder().encode(text)]
  let ver = 1
  for (; ver <= 10; ver++) {
    const dataCap = RAW[ver] - BLOCKS[ver] * ECC[ver]
    const bits = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8
    if (bits <= dataCap * 8) break
  }
  if (ver > 10) throw new Error('Texto demasiado largo para el QR')
  const size = ver * 4 + 17
  const dataCap = RAW[ver] - BLOCKS[ver] * ECC[ver]

  // Bits: modo byte (0100), longitud, datos, terminador y relleno.
  const bb = []
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bb.push((v >>> i) & 1) }
  put(4, 4)
  put(bytes.length, ver < 10 ? 8 : 16)
  bytes.forEach((b) => put(b, 8))
  put(0, Math.min(4, dataCap * 8 - bb.length))
  put(0, (8 - (bb.length % 8)) % 8)
  for (let pad = 0xec; bb.length < dataCap * 8; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data = []
  for (let i = 0; i < bb.length; i += 8) data.push(bb.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))

  // Bloques con corrección de errores, intercalados.
  const nb = BLOCKS[ver], ecc = ECC[ver], raw = RAW[ver]
  const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb)
  const div = rsDivisor(ecc)
  const blocks = []
  for (let i = 0, k = 0; i < nb; i++) {
    const len = shortLen - ecc + (i < nShort ? 0 : 1)
    const dat = data.slice(k, k + len)
    k += len
    const e = rsRemainder(dat, div)
    if (i < nShort) dat.push(0)
    blocks.push(dat.concat(e))
  }
  const cw = []
  for (let i = 0; i < blocks[0].length; i++)
    for (let j = 0; j < nb; j++) if (i !== shortLen - ecc || j >= nShort) cw.push(blocks[j][i])

  // Matriz con los patrones fijos.
  const mod = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array(size).fill(false))
  const set = (x, y, v) => { mod[y][x] = v; fn[y][x] = true }
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4)
      }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)
  const al = ALIGN[ver]
  for (let i = 0; i < al.length; i++)
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  const formatBits = (mask) => {
    const d = (0 << 3) | mask // nivel M = 00
    let r = d
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
    const bits = ((d << 10) | r) ^ 0x5412
    const bit = (i) => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) set(8, i, bit(i))
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i))
    set(8, size - 8, true)
  }
  formatBits(0)
  if (ver >= 7) {
    let r = ver
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const bits = (ver << 12) | r
    for (let i = 0; i < 18; i++) {
      const v = ((bits >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3)
      set(a, b, v); set(b, a, v)
    }
  }

  // Datos en zigzag.
  let bi = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert
        if (!fn[y][x] && bi < cw.length * 8) { mod[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++ }
      }
  }

  // Máscara: la de menor penalización (reglas 1, 2 y 4 del estándar).
  const MASKS = [
    (x, y) => (x + y) % 2, (x, y) => y % 2, (x) => x % 3, (x, y) => (x + y) % 3,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2, (x, y) => ((x * y) % 2) + ((x * y) % 3),
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2,
  ]
  const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y) === 0) mod[y][x] = !mod[y][x] }
  const penalty = () => {
    let p = 0, dark = 0
    for (let y = 0; y < size; y++) {
      for (const line of [mod[y], mod.map((r) => r[y])]) {
        let run = 1
        for (let i = 1; i < size; i++) { if (line[i] === line[i - 1]) run++; else { if (run >= 5) p += run - 2; run = 1 } }
        if (run >= 5) p += run - 2
      }
      for (let x = 0; x < size; x++) {
        if (mod[y][x]) dark++
        if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3
      }
    }
    return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10
  }
  let best = 0, bestP = Infinity
  for (let m = 0; m < 8; m++) {
    apply(m); formatBits(m)
    const p = penalty()
    if (p < bestP) { bestP = p; best = m }
    apply(m) // deshacer (la máscara es su propia inversa)
  }
  apply(best); formatBits(best)
  return { size, version: ver, mask: best, get: (x, y) => mod[y][x] }
}

export function toSvg(qr, { border = 3, dark = '#0e1430', light = '#fff' } = {}) {
  const n = qr.size + border * 2
  let d = ''
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.get(x, y)) d += `M${x + border},${y + border}h1v1h-1z`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [url, out] = process.argv.slice(2)
  const qr = encode(url)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, toSvg(qr))
  console.log(`${out}: QR versión ${qr.version} (${qr.size}×${qr.size}), máscara ${qr.mask} → ${url}`)
}
