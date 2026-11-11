import { createContext, useContext } from 'react'

export type Lang = 'es' | 'en'

const es = {
  tagline: 'Editor de partidas en tu navegador',
  heroTitle1: 'Tu partida,',
  heroTitle2: 'a tu manera.',
  heroBody:
    'Sube tu archivo .sav, mira tu equipo y tus cajas y edítalo desde el móvil o el ordenador. Todo ocurre en tu dispositivo: la partida nunca sale de él.',
  dropTitle: 'Suelta aquí tu archivo .sav',
  dropOr: 'o',
  dropButton: 'elige un archivo',
  dropHint: '.sav, .dsv, main, .bin… de cualquier generación',
  dropWaiting: 'Preparando el motor…',
  dropReading: 'Leyendo partida…',
  featPrivate: 'Privado',
  featPrivateBody: 'Se procesa en tu navegador. Sin subidas, sin cuentas.',
  featGens: '9 generaciones',
  featGensBody: 'Basado en PKHeX.Core, el estándar de la comunidad.',
  featSafe: 'Sin riesgos',
  featSafeBody: 'Siempre puedes descargar tu archivo original intacto.',
  engineLoading: 'Cargando motor',
  engineReady: 'Motor listo',
  engineError: 'Error del motor',
  retry: 'Reintentar',
  errEmpty: 'El archivo está vacío.',
  errUnknown: 'No reconocemos este archivo como una partida compatible.',
  errUnknownHint: 'Comprueba que es el archivo de guardado del juego (no una ROM ni un estado de emulador).',
  errEngine: 'No se pudo cargar el motor. Revisa tu conexión y vuelve a intentarlo.',
  gen: 'Gen',
  trainer: 'Entrenador',
  trainerId: 'ID',
  secretId: 'ID secreto',
  money: 'Dinero',
  playTime: 'Tiempo de juego',
  notAvailable: '—',
  pokedex: 'Pokédex',
  seen: 'vistos',
  caught: 'capturados',
  pc: 'PC',
  inBoxes: 'en {n} cajas',
  file: 'Archivo',
  checksumOk: 'Checksums correctos',
  checksumBad: 'Checksums incorrectos',
  team: 'Equipo',
  emptyTeam: 'No hay Pokémon en el equipo.',
  level: 'Nv.',
  egg: 'Huevo',
  shiny: 'Variocolor',
  nature: 'Naturaleza',
  ability: 'Habilidad',
  item: 'Objeto',
  none: 'Ninguno',
  moves: 'Movimientos',
  hp: 'PS',
  legal: 'Legal',
  illegal: 'Revisar',
  legalTitle: 'Comprobación de legalidad de PKHeX',
  loadAnother: 'Abrir otra partida',
  downloadOriginal: 'Descargar copia del original',
  phase: 'Fase 0 · prueba técnica',
  phaseBody: 'De momento se puede ver la partida. La edición llega en la Fase 1.',
  metrics: 'Motor en {engine} ms · partida leída en {parse} ms · PKHeX.Core {ver}',
  footer: 'Proyecto de código abierto (GPL-3.0) basado en PKHeX.Core. No afiliado a Nintendo, Game Freak ni The Pokémon Company.',
  privacy: 'Tu partida no sale de este dispositivo.',
  theme: 'Cambiar tema',
  language: 'Idioma',
  male: 'Macho',
  female: 'Hembra',
}

type Dict = typeof es

const en: Dict = {
  tagline: 'Save editor in your browser',
  heroTitle1: 'Your save,',
  heroTitle2: 'your way.',
  heroBody:
    'Drop in your .sav file, browse your party and boxes and edit it from your phone or computer. Everything runs on your device: your save never leaves it.',
  dropTitle: 'Drop your .sav file here',
  dropOr: 'or',
  dropButton: 'choose a file',
  dropHint: '.sav, .dsv, main, .bin… from any generation',
  dropWaiting: 'Warming up the engine…',
  dropReading: 'Reading save…',
  featPrivate: 'Private',
  featPrivateBody: 'Processed in your browser. No uploads, no accounts.',
  featGens: '9 generations',
  featGensBody: 'Powered by PKHeX.Core, the community standard.',
  featSafe: 'Risk-free',
  featSafeBody: 'You can always download your untouched original file.',
  engineLoading: 'Loading engine',
  engineReady: 'Engine ready',
  engineError: 'Engine error',
  retry: 'Retry',
  errEmpty: 'The file is empty.',
  errUnknown: "We don't recognise this file as a supported save.",
  errUnknownHint: "Make sure it's the game's save file (not a ROM or an emulator save state).",
  errEngine: "The engine couldn't load. Check your connection and try again.",
  gen: 'Gen',
  trainer: 'Trainer',
  trainerId: 'ID',
  secretId: 'Secret ID',
  money: 'Money',
  playTime: 'Play time',
  notAvailable: '—',
  pokedex: 'Pokédex',
  seen: 'seen',
  caught: 'caught',
  pc: 'PC',
  inBoxes: 'in {n} boxes',
  file: 'File',
  checksumOk: 'Checksums valid',
  checksumBad: 'Checksums invalid',
  team: 'Party',
  emptyTeam: 'No Pokémon in the party.',
  level: 'Lv.',
  egg: 'Egg',
  shiny: 'Shiny',
  nature: 'Nature',
  ability: 'Ability',
  item: 'Item',
  none: 'None',
  moves: 'Moves',
  hp: 'HP',
  legal: 'Legal',
  illegal: 'Check',
  legalTitle: 'PKHeX legality check',
  loadAnother: 'Open another save',
  downloadOriginal: 'Download original backup',
  phase: 'Phase 0 · technical spike',
  phaseBody: 'For now you can view your save. Editing arrives in Phase 1.',
  metrics: 'Engine in {engine} ms · save read in {parse} ms · PKHeX.Core {ver}',
  footer: 'Open-source project (GPL-3.0) powered by PKHeX.Core. Not affiliated with Nintendo, Game Freak or The Pokémon Company.',
  privacy: 'Your save never leaves this device.',
  theme: 'Toggle theme',
  language: 'Language',
  male: 'Male',
  female: 'Female',
}

export const dictionaries: Record<Lang, Dict> = { es, en }
export type Key = keyof Dict

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('pokesave.lang')
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    /* almacenamiento no disponible */
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export const I18nContext = createContext<{ lang: Lang; t: (k: Key, vars?: Record<string, string | number>) => string }>({
  lang: 'es',
  t: (k) => es[k],
})

export function makeT(lang: Lang) {
  return (k: Key, vars?: Record<string, string | number>) => {
    let s = dictionaries[lang][k]
    if (vars) for (const [name, v] of Object.entries(vars)) s = s.replace(`{${name}}`, String(v))
    return s
  }
}

export const useI18n = () => useContext(I18nContext)
