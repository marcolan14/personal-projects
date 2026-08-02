export type PresetItem = {
  name: string
  unit: string
  inputType: 'number' | 'text'
}

export type PresetCategory = {
  category: string
  items: PresetItem[]
}

export function matchPreset(movementName: string): PresetItem | null {
  const target = movementName.trim().toLowerCase()
  if (!target) return null
  for (const category of PRESET_PROFILE) {
    for (const item of category.items) {
      const preset = item.name.toLowerCase()
      if (target === preset || target.includes(preset) || preset.includes(target)) {
        return item
      }
    }
  }
  return null
}

export const PRESET_PROFILE: PresetCategory[] = [
  {
    category: 'Lifts',
    items: [
      { name: 'Back Squat', unit: 'kg', inputType: 'number' },
      { name: 'Front Squat', unit: 'kg', inputType: 'number' },
      { name: 'Overhead Squat', unit: 'kg', inputType: 'number' },
      { name: 'Deadlift', unit: 'kg', inputType: 'number' },
      { name: 'Bench Press', unit: 'kg', inputType: 'number' },
      { name: 'Overhead Press', unit: 'kg', inputType: 'number' },
      { name: 'Push Press', unit: 'kg', inputType: 'number' },
      { name: 'Push Jerk', unit: 'kg', inputType: 'number' },
      { name: 'Clean', unit: 'kg', inputType: 'number' },
      { name: 'Clean & Jerk', unit: 'kg', inputType: 'number' },
      { name: 'Snatch', unit: 'kg', inputType: 'number' },
      { name: 'Thruster', unit: 'kg', inputType: 'number' },
    ],
  },
  {
    category: 'Girls',
    items: [
      { name: 'Amanda', unit: 'mm:ss', inputType: 'text' },
      { name: 'Angie', unit: 'mm:ss', inputType: 'text' },
      { name: 'Annie', unit: 'mm:ss', inputType: 'text' },
      { name: 'Chelsea', unit: 'rounds', inputType: 'number' },
      { name: 'Cindy', unit: 'rounds', inputType: 'number' },
      { name: 'Diane', unit: 'mm:ss', inputType: 'text' },
      { name: 'Elizabeth', unit: 'mm:ss', inputType: 'text' },
      { name: 'Eva', unit: 'mm:ss', inputType: 'text' },
      { name: 'Fran', unit: 'mm:ss', inputType: 'text' },
      { name: 'Grace', unit: 'mm:ss', inputType: 'text' },
      { name: 'Helen', unit: 'mm:ss', inputType: 'text' },
      { name: 'Isabel', unit: 'mm:ss', inputType: 'text' },
      { name: 'Jackie', unit: 'mm:ss', inputType: 'text' },
      { name: 'Karen', unit: 'mm:ss', inputType: 'text' },
      { name: 'Kelly', unit: 'mm:ss', inputType: 'text' },
      { name: 'Linda', unit: 'mm:ss', inputType: 'text' },
      { name: 'Lynne', unit: 'reps', inputType: 'number' },
      { name: 'Mary', unit: 'rounds', inputType: 'number' },
      { name: 'Nancy', unit: 'mm:ss', inputType: 'text' },
      { name: 'Nicole', unit: 'rounds', inputType: 'number' },
    ],
  },
  {
    category: 'Heroes',
    items: [
      { name: 'Murph', unit: 'mm:ss', inputType: 'text' },
      { name: 'DT', unit: 'mm:ss', inputType: 'text' },
      { name: 'JT', unit: 'mm:ss', inputType: 'text' },
      { name: 'The Seven', unit: 'mm:ss', inputType: 'text' },
      { name: 'Randy', unit: 'mm:ss', inputType: 'text' },
      { name: 'Nate', unit: 'rounds', inputType: 'number' },
      { name: 'Wittman', unit: 'mm:ss', inputType: 'text' },
      { name: 'Danny', unit: 'rounds', inputType: 'number' },
      { name: 'Josh', unit: 'mm:ss', inputType: 'text' },
      { name: 'Griff', unit: 'mm:ss', inputType: 'text' },
      { name: 'Glen', unit: 'mm:ss', inputType: 'text' },
      { name: 'Ryan', unit: 'mm:ss', inputType: 'text' },
    ],
  },
  {
    category: 'Skills',
    items: [
      { name: 'Strict Pull-ups', unit: 'reps', inputType: 'number' },
      { name: 'Kipping Pull-ups', unit: 'reps', inputType: 'number' },
      { name: 'Chest-to-Bar Pull-ups', unit: 'reps', inputType: 'number' },
      { name: 'Muscle-ups', unit: 'reps', inputType: 'number' },
      { name: 'Bar Muscle-ups', unit: 'reps', inputType: 'number' },
      { name: 'Strict HSPU', unit: 'reps', inputType: 'number' },
      { name: 'HSPU', unit: 'reps', inputType: 'number' },
      { name: 'Toes-to-Bar', unit: 'reps', inputType: 'number' },
      { name: 'Double Unders (unbroken)', unit: 'reps', inputType: 'number' },
      { name: 'Max Handstand Hold', unit: 'mm:ss', inputType: 'text' },
    ],
  },
  {
    category: 'Endurance',
    items: [
      { name: '400m Run', unit: 'mm:ss', inputType: 'text' },
      { name: '1 Mile Run', unit: 'mm:ss', inputType: 'text' },
      { name: '5K Run', unit: 'mm:ss', inputType: 'text' },
      { name: '10K Run', unit: 'mm:ss', inputType: 'text' },
      { name: '500m Row', unit: 'mm:ss', inputType: 'text' },
      { name: '1000m Row', unit: 'mm:ss', inputType: 'text' },
      { name: '2000m Row', unit: 'mm:ss', inputType: 'text' },
      { name: '5000m Row', unit: 'mm:ss', inputType: 'text' },
    ],
  },
]
