import { createContext, useContext } from 'react'

export type Lang = 'es' | 'en'

const es = {
  tagline: 'Editor de partidas',
  heroKicker: '¡Bienvenido, Entrenador!',
  heroTitle1: 'Tu aventura,',
  heroTitle2: 'en tu bolsillo.',
  heroBody:
    'Inserta tu partida, revisa tu equipo y tu Pokédex y edítala desde el móvil o el ordenador. Todo ocurre en tu dispositivo: tu partida nunca sale de él.',
  dexInsert: 'Inserta tu partida',
  dexDrop: 'Arrastra aquí tu archivo .sav',
  dexOr: 'o',
  dexButton: 'elige un archivo',
  dexHint: '.sav · .dsv · main · .bin',
  dexBooting: 'Encendiendo la Pokédex…',
  dexReading: 'Leyendo partida…',
  dexWaitingEngine: 'Esperando al motor…',
  featPrivate: 'Privado',
  featPrivateBody: 'Se procesa en tu navegador. Sin subidas ni cuentas.',
  featGens: 'Gen 1 a 9',
  featGensBody: 'Desde Rojo y Azul hasta Escarlata y Púrpura, con PKHeX.Core.',
  featSafe: 'Sin riesgos',
  featSafeBody: 'Siempre puedes descargar tu partida original intacta.',
  engineLoading: 'Cargando',
  engineReady: 'Listo',
  engineError: 'Error',
  retry: 'Reintentar',
  ohNo: '¡Oh, no!',
  errEmpty: 'El archivo está vacío.',
  errUnknown: 'Este archivo no parece una partida compatible.',
  errUnknownHint: 'Comprueba que es el archivo de guardado del juego, no una ROM ni un estado de emulador.',
  errEngine: 'No se pudo encender la Pokédex. Revisa tu conexión y vuelve a intentarlo.',
  caughtSave: '¡Ya está! ¡Partida atrapada!',
  gen: 'Gen',
  trainerCard: 'Tarjeta de Entrenador',
  trainerId: 'Nº ID',
  secretId: 'ID secreto',
  money: 'Dinero',
  playTime: 'Tiempo',
  notAvailable: '—',
  pokedex: 'Pokédex',
  seen: 'vistos',
  caught: 'capturados',
  pc: 'Sistema de PC',
  inBoxes: 'en {n} cajas',
  file: 'Archivo',
  checksumOk: 'Datos correctos',
  checksumBad: 'Checksums incorrectos',
  team: 'Equipo',
  emptyTeam: 'No llevas ningún Pokémon en el equipo.',
  level: 'Nv.',
  egg: 'Huevo',
  eggBody: 'Parece que va a tardar en abrirse.',
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
  loadAnother: 'Cambiar de partida',
  downloadOriginal: 'Descargar copia del original',
  phase: 'Fase 0',
  phaseBody: 'De momento puedes ver tu partida. La edición llega en la Fase 1.',
  metrics: 'Motor en {engine} ms · partida leída en {parse} ms · PKHeX.Core {ver}',
  footer: 'Proyecto de fans, de código abierto (GPL-3.0) y basado en PKHeX.Core. No afiliado a Nintendo, Game Freak ni The Pokémon Company. Sprites de PokéAPI.',
  privacy: 'Tu partida no sale de este dispositivo.',
  theme: 'Cambiar tema',
  language: 'Idioma',
  male: 'Macho',
  female: 'Hembra',
  dropNow: '¡Suéltala!',
}

type Dict = typeof es

const en: Dict = {
  tagline: 'Save editor',
  heroKicker: 'Welcome, Trainer!',
  heroTitle1: 'Your adventure,',
  heroTitle2: 'in your pocket.',
  heroBody:
    'Insert your save, check your party and Pokédex and edit it from your phone or computer. Everything happens on your device: your save never leaves it.',
  dexInsert: 'Insert your save',
  dexDrop: 'Drag your .sav file here',
  dexOr: 'or',
  dexButton: 'choose a file',
  dexHint: '.sav · .dsv · main · .bin',
  dexBooting: 'Booting up the Pokédex…',
  dexReading: 'Reading save…',
  dexWaitingEngine: 'Waiting for the engine…',
  featPrivate: 'Private',
  featPrivateBody: 'Processed in your browser. No uploads, no accounts.',
  featGens: 'Gen 1 to 9',
  featGensBody: 'From Red and Blue to Scarlet and Violet, powered by PKHeX.Core.',
  featSafe: 'Risk-free',
  featSafeBody: 'You can always download your untouched original save.',
  engineLoading: 'Loading',
  engineReady: 'Ready',
  engineError: 'Error',
  retry: 'Retry',
  ohNo: 'Oh, no!',
  errEmpty: 'The file is empty.',
  errUnknown: "This file doesn't look like a supported save.",
  errUnknownHint: "Make sure it's the game's save file, not a ROM or an emulator save state.",
  errEngine: "The Pokédex couldn't boot. Check your connection and try again.",
  caughtSave: 'Gotcha! Save caught!',
  gen: 'Gen',
  trainerCard: 'Trainer Card',
  trainerId: 'ID No.',
  secretId: 'Secret ID',
  money: 'Money',
  playTime: 'Time',
  notAvailable: '—',
  pokedex: 'Pokédex',
  seen: 'seen',
  caught: 'caught',
  pc: 'PC Storage',
  inBoxes: 'in {n} boxes',
  file: 'File',
  checksumOk: 'Data valid',
  checksumBad: 'Checksums invalid',
  team: 'Party',
  emptyTeam: "You don't have any Pokémon in your party.",
  level: 'Lv.',
  egg: 'Egg',
  eggBody: 'It looks like it will take a while to hatch.',
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
  loadAnother: 'Switch save',
  downloadOriginal: 'Download original backup',
  phase: 'Phase 0',
  phaseBody: 'For now you can view your save. Editing arrives in Phase 1.',
  metrics: 'Engine in {engine} ms · save read in {parse} ms · PKHeX.Core {ver}',
  footer: 'Open-source (GPL-3.0) fan project powered by PKHeX.Core. Not affiliated with Nintendo, Game Freak or The Pokémon Company. Sprites from PokéAPI.',
  privacy: 'Your save never leaves this device.',
  theme: 'Toggle theme',
  language: 'Language',
  male: 'Male',
  female: 'Female',
  dropNow: 'Drop it!',
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
