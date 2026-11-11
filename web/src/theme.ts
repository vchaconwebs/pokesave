// Colores derivados de los datos de la partida (sin logos ni artes oficiales).

/** Matiz estable por especie usando el ángulo áureo: especies cercanas no se parecen. */
export const speciesHue = (species: number) => Math.round((species * 137.508) % 360)

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

/**
 * Sprite de la especie. Hasta la 5.ª generación (#649) se usan los sprites animados de
 * Blanco/Negro; a partir de ahí, el sprite estático por defecto. De momento no se
 * distinguen formas (Alola, Galar…): se muestra la forma base.
 */
export function spriteUrl(species: number, shiny: boolean) {
  if (species <= 0 || species > 1025) return null
  const s = shiny ? 'shiny/' : ''
  return species <= 649
    ? `${SPRITES}/versions/generation-v/black-white/animated/${s}${species}.gif`
    : `${SPRITES}/${s}${species}.png`
}

/** Color de acento por juego (solo colores, sin logos). */
const GAME_ACCENTS: Record<string, [string, string]> = {
  RD: ['#ef4444', '#f97316'], BU: ['#3b82f6', '#6366f1'], GN: ['#22c55e', '#84cc16'], YW: ['#eab308', '#f59e0b'],
  GD: ['#d4a017', '#f59e0b'], SI: ['#94a3b8', '#cbd5e1'], C: ['#22d3ee', '#818cf8'],
  R: ['#e11d48', '#f43f5e'], S: ['#2563eb', '#0ea5e9'], E: ['#10b981', '#34d399'], FR: ['#f97316', '#ef4444'], LG: ['#65a30d', '#22c55e'],
  D: ['#60a5fa', '#818cf8'], P: ['#f472b6', '#e879f9'], Pt: ['#a1a1aa', '#d4d4d8'], HG: ['#f59e0b', '#fbbf24'], SS: ['#94a3b8', '#a5b4fc'],
  B: ['#64748b', '#38bdf8'], W: ['#e2e8f0', '#f472b6'], B2: ['#475569', '#60a5fa'], W2: ['#f1f5f9', '#fb7185'],
  X: ['#3b82f6', '#22d3ee'], Y: ['#ef4444', '#f43f5e'], OR: ['#dc2626', '#f97316'], AS: ['#2563eb', '#06b6d4'],
  SN: ['#f97316', '#facc15'], MN: ['#8b5cf6', '#6366f1'], US: ['#fb923c', '#f43f5e'], UM: ['#7c3aed', '#3b82f6'],
  GP: ['#facc15', '#f97316'], GE: ['#a16207', '#f59e0b'], SW: ['#06b6d4', '#3b82f6'], SH: ['#d946ef', '#f43f5e'],
  BD: ['#3b82f6', '#60a5fa'], SP: ['#f472b6', '#c084fc'], PLA: ['#d6a35c', '#a3e635'], SL: ['#f97316', '#ef4444'], VL: ['#a855f7', '#6366f1'],
  ZA: ['#22c55e', '#14b8a6'],
}

export const gameAccent = (gameId: string | undefined) => (gameId && GAME_ACCENTS[gameId]) || null

/** Colores de tipo (paleta habitual de la comunidad), por id de PKHeX. */
const TYPE_COLORS = [
  '#A8A77A', // Normal
  '#C22E28', // Lucha
  '#A98FF3', // Volador
  '#A33EA1', // Veneno
  '#E2BF65', // Tierra
  '#B6A136', // Roca
  '#A6B91A', // Bicho
  '#735797', // Fantasma
  '#B7B7CE', // Acero
  '#EE8130', // Fuego
  '#6390F0', // Agua
  '#7AC74C', // Planta
  '#F7D02C', // Eléctrico
  '#F95587', // Psíquico
  '#96D9D6', // Hielo
  '#6F35FC', // Dragón
  '#705746', // Siniestro
  '#D685AD', // Hada
  '#40B5A5', // Astral
]

export const typeColor = (id: number) => TYPE_COLORS[id] ?? TYPE_COLORS[0]

/** Texto oscuro sobre los tipos claros (Eléctrico, Hielo…) para que el contraste sea bueno. */
export function typeInk(id: number) {
  const hex = typeColor(id).slice(1)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.6 ? '#1b1d26' : '#ffffff'
}
