export type Movement = {
  name: string
  sets?: number
  reps?: string
  weight_rx_kg?: number
  weight_percent?: number
  height_cm?: number
  distance_m?: number
  calories?: number
}

export type WodSection = {
  label?: string
  type: 'strength' | 'for_time' | 'amrap' | 'emom' | string
  duration_min?: number
  movements: Movement[]
}

export type WodMeta = {
  sections: WodSection[]
}

export type FitnessEntry = {
  name: string
  value: string
  unit: string | null
}

export type FitnessHistoryEntry = FitnessEntry & {
  id: string
  recorded_on: string
}
