// Colores derivados de los datos de la partida (sin logos ni artes oficiales).

/** Matiz estable por especie usando el ángulo áureo: especies cercanas no se parecen. */
export const speciesHue = (species: number) => Math.round((species * 137.508) % 360)

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
