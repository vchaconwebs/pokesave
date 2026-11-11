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
  boxSlotCount: number
  storedCount: number
  pokedex: { seen: number; caught: number; total: number } | null
  checksumsValid: boolean
  fileSize: number
  extension: string
}

export interface TrainerInfo {
  name: string
  gender: number
  id: string
  secretId: string | null
  money: number | null
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
