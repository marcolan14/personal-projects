export type Movement = {
  name: string
  sets?: number
  reps?: string
  weight_rx_kg?: number
  weight_percent?: number
  height_cm?: number
  distance_m?: number
  calories?: number
  max_reps?: boolean
}

export type WodSection = {
  label?: string
  type: 'strength' | 'for_time' | 'amrap' | 'emom' | string
  duration_min?: number
  rounds?: number
  movements: Movement[]
}

export type WodMeta = {
  sections: WodSection[]
}

export function flattenMovementNames(meta: WodMeta | null | undefined): string[] {
  if (!meta) return []
  return meta.sections.flatMap(s => s.movements.map(m => m.name.toLowerCase().trim())).filter(Boolean)
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

export type WodRecommendation = {
  recommendations: string
  expected_result: string
}

export type PredictionRating = 'too_easy' | 'accurate' | 'too_hard'
