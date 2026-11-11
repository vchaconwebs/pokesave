// Espejo de los records de PokeSave.Core/SaveSummary.cs (serializados en camelCase).

export interface LoadResult {
  ok: boolean
  error: 'empty' | 'unknown' | 'none' | null
  save: SaveSummary | null
}

export interface SaveSummary {
  game: string
  gameId: string
  generation: number
  context: string
  trainer: TrainerInfo
  party: PokemonInfo[]
  boxCount: number
  boxNames: string[]
  boxSlotCount: number
  storedCount: number
  pokedex: { seen: number; caught: number; total: number } | null
  checksumsValid: boolean
  fileSize: number
  extension: string
  history: HistoryInfo
}

export interface HistoryInfo {
  position: number
  canUndo: boolean
  canRedo: boolean
}

export interface TrainerInfo {
  name: string
  gender: number
  id: string
  secretId: string | null
  money: number | null
  badges: BadgeInfo | null
  maxMoney: number
  playTime: string | null
}

export interface PokemonInfo {
  slot: number
  species: number
  speciesName: string
  form: number
  nickname: string
  isNicknamed: boolean
  level: number
  isShiny: boolean
  isEgg: boolean
  gender: number
  nature: string | null
  ability: string | null
  heldItem: string | null
  types: TypeInfo[]
  moves: MoveSlot[]
  hpCurrent: number
  hpMax: number
  legal: boolean | null
}

/** id sigue el orden de PKHeX: 0 Normal … 17 Hada, 18 Astral. */
export interface TypeInfo {
  id: number
  name: string
}

export interface MoveSlot {
  id: number
  name: string
  type: TypeInfo
}

export interface BadgeInfo {
  earned: number
  total: number
  flags: boolean[]
}

// ---------- Fase 1: edición (espejo de EditModels.cs) ----------

export interface SlotRef {
  kind: 'party' | 'box'
  box: number
  slot: number
}

export interface Option {
  id: number
  name: string
}

export interface GameLists {
  species: Option[]
  moves: Option[]
  items: Option[]
  natures: Option[]
}

export interface BoxSlot {
  slot: number
  species: number
  name: string
  level: number
  isShiny: boolean
  isEgg: boolean
  legal: boolean
}

export interface BoxView {
  index: number
  name: string
  slotCount: number
  slots: BoxSlot[]
}

/** IVs/EVs en orden PS, Ata, Def, AtE, DeE, Vel. */
export interface PokemonEdit {
  species: number
  nickname: string
  isNicknamed: boolean
  level: number
  nature: number
  abilityIndex: number
  heldItem: number
  isShiny: boolean
  moves: number[]
  ivs: number[]
  evs: number[]
}

export interface EditLimits {
  maxLevel: number
  maxIv: number
  maxEv: number
  maxEvTotal: number
  maxNicknameLength: number
  hasNature: boolean
  hasAbility: boolean
  hasHeldItem: boolean
  hasShiny: boolean
  hpIvDerived: boolean
  specialCombined: boolean
}

export interface PokemonDetail {
  ref: SlotRef
  info: PokemonInfo
  edit: PokemonEdit
  stats: number[]
  limits: EditLimits
  abilities: Option[]
  legality: string[]
}

export interface TrainerEdit {
  name: string
  money: number
}

export interface EditResult {
  ok: boolean
  error: string | null
  pokemon: PokemonDetail | null
  save: SaveSummary | null
}

// ---------- Fase 2 (espejo de Phase2Models.cs) ----------

export interface BagItem {
  id: number
  name: string
  count: number
}

export interface PouchView {
  type: string
  slots: number
  maxCount: number
  items: BagItem[]
  allowed: Option[]
}

export interface BagView {
  pouches: PouchView[]
}

export interface PouchEdit {
  type: string
  items: { id: number; count: number }[]
}

export interface DexEntry {
  species: number
  name: string
  seen: boolean
  caught: boolean
}

export interface DexView {
  editable: boolean
  /** Pokédex Nacional. */
  entries: DexEntry[]
  /** Pokédex regionales del juego, con su numeración. */
  regions: DexRegion[]
}

export interface DexRegion {
  key: string
  entries: { species: number; number: number }[]
}

export interface DexEdit {
  species: number[]
  seen: boolean
  caught: boolean
}

export interface PokemonExport {
  fileName: string
  showdown: string
}
