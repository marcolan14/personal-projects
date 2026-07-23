export type PresetItem = {
  name: string
  unit: string
  inputType: 'number' | 'text'
}

export type PresetCategory = {
  category: string
  items: PresetItem[]
}

export const PRESET_PROFILE: PresetCategory[] = [
  {
    category: 'Forza',
    items: [
      { name: 'Back Squat', unit: 'kg', inputType: 'number' },
      { name: 'Front Squat', unit: 'kg', inputType: 'number' },
      { name: 'Deadlift', unit: 'kg', inputType: 'number' },
      { name: 'Overhead Press', unit: 'kg', inputType: 'number' },
      { name: 'Clean & Jerk', unit: 'kg', inputType: 'number' },
      { name: 'Snatch', unit: 'kg', inputType: 'number' },
    ],
  },
  {
    category: 'Ginnastica',
    items: [
      { name: 'Strict Pull-ups', unit: 'reps', inputType: 'number' },
      { name: 'Kipping Pull-ups', unit: 'reps', inputType: 'number' },
      { name: 'Strict HSPU', unit: 'reps', inputType: 'number' },
      { name: 'Muscle-ups', unit: 'reps', inputType: 'number' },
    ],
  },
  {
    category: 'Conditioning',
    items: [
      { name: 'Fran', unit: 'mm:ss', inputType: 'text' },
      { name: 'Grace', unit: 'mm:ss', inputType: 'text' },
      { name: 'Cindy', unit: 'rounds', inputType: 'number' },
      { name: '2000m Row', unit: 'mm:ss', inputType: 'text' },
      { name: '5K Run', unit: 'mm:ss', inputType: 'text' },
    ],
  },
]
