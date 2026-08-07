'use client'

import { useState } from 'react'
import { WodMeta, WodSection, FitnessEntry, PredictionRating } from '@/lib/types'
import TimeInput from './TimeInput'

type SetRow = { weight: string; reps: string }

type SectionState = {
  type: string
  movementSets: SetRow[][]
  times: string[]          // 1 entry for single for_time, N entries for sets-based
  movementWeights: string[] // per-movement weights for for_time sections
  rounds: string
  extraReps: string
  maxReps: string
  roundReps: string[]
  minutesDone: string
  rx: boolean
  notes: string
}

type Benchmark = { name: string; value: string; unit: string | null }

type Props = {
  workoutId: string
  meta: WodMeta
  profile: FitnessEntry[]
  hasRecommendation: boolean
  onSaved: (comment: string | null, benchmark: Benchmark | null) => void
  onCancel: () => void
}

const LOGGABLE = new Set(['strength', 'for_time', 'amrap', 'emom'])

// A single-movement AMRAP with no fixed rounds (e.g. "Max Power Cleans in 5 min")
// is scored purely by total reps, not by rounds+extra like a multi-movement circuit.
function isMaxRepsOnly(sec: WodSection): boolean {
  return sec.movements.length === 1 && !!sec.movements[0].max_reps && !(sec.rounds && sec.rounds > 1)
}

const PREDICTION_RATINGS: { value: PredictionRating; label: string }[] = [
  { value: 'too_easy', label: 'Troppo facile' },
  { value: 'accurate', label: 'Giusto' },
  { value: 'too_hard', label: 'Troppo difficile' },
]

export default function ResultForm({ workoutId, meta, profile, hasRecommendation, onSaved, onCancel }: Props) {
  const workoutSections = meta.sections.filter(s => LOGGABLE.has(s.type))

  // If all sections share the same type, treat them as difficulty levels
  const isMultiLevel =
    workoutSections.length > 1 &&
    workoutSections.every(s => s.type === workoutSections[0].type)

  const [selectedLevel, setSelectedLevel] = useState<number | null>(isMultiLevel ? null : undefined as unknown as null)
  const [sections] = useState<SectionState[]>(() =>
    workoutSections.map(s => initSection(s, profile))
  )
  const [sectionState, setSectionState] = useState<SectionState[]>(sections)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [predictionRating, setPredictionRating] = useState<PredictionRating | null>(null)
  const [predictionFeedback, setPredictionFeedback] = useState('')

  // sections to actually render in the form
  const activeSections = isMultiLevel
    ? selectedLevel !== null ? [workoutSections[selectedLevel]] : []
    : workoutSections

  const activeStates = isMultiLevel
    ? selectedLevel !== null ? [sectionState[selectedLevel]] : []
    : sectionState

  function updateSection(realIdx: number, update: Partial<SectionState>) {
    setSectionState(prev => prev.map((s, i) => i === realIdx ? { ...s, ...update } : s))
  }

  function updateSet(si: number, mi: number, ri: number, field: 'weight' | 'reps', value: string) {
    setSectionState(prev => prev.map((s, i) => {
      if (i !== si) return s
      return {
        ...s,
        movementSets: s.movementSets.map((sets, m) =>
          m !== mi ? sets : sets.map((set, r) => r !== ri ? set : { ...set, [field]: value })
        ),
      }
    }))
  }

  function updateMovementWeight(si: number, mi: number, value: string) {
    setSectionState(prev => prev.map((s, i) => {
      if (i !== si) return s
      return { ...s, movementWeights: s.movementWeights.map((w, j) => j === mi ? value : w) }
    }))
  }

  function updateTime(si: number, ti: number, value: string) {
    setSectionState(prev => prev.map((s, i) => {
      if (i !== si) return s
      return { ...s, times: s.times.map((t, j) => j === ti ? value : t) }
    }))
  }

  function updateRoundReps(si: number, ri: number, value: string) {
    setSectionState(prev => prev.map((s, i) => {
      if (i !== si) return s
      return { ...s, roundReps: s.roundReps.map((r, j) => j === ri ? value : r) }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const sectionsToSave = isMultiLevel && selectedLevel !== null
      ? [{ sec: workoutSections[selectedLevel], state: sectionState[selectedLevel] }]
      : workoutSections.map((sec, i) => ({ sec, state: sectionState[i] }))

    const serialized = sectionsToSave.map(({ sec, state }) => {
      if (state.type === 'strength') {
        return {
          type: 'strength', label: sec.label,
          movements: sec.movements.map((m, mi) => ({
            name: m.name,
            sets: state.movementSets[mi]?.map(set => ({
              weight: set.weight ? parseFloat(set.weight) : null,
              reps: set.reps ? parseInt(set.reps) : null,
            })) ?? [],
          })),
          rx: state.rx, notes: state.notes,
        }
      }
      if (state.type === 'for_time') {
        const multiSet = state.times.length > 1
        const weights = sec.movements
          .map((m, i) => ({ name: m.name, weight: state.movementWeights[i] }))
          .filter(w => w.weight)
        return {
          type: 'for_time', label: sec.label,
          ...(multiSet
            ? { sets: state.times.map((t, i) => ({ set: i + 1, time: t })) }
            : { time: state.times[0] ?? '' }),
          ...(weights.length ? { weights } : {}),
          rx: state.rx, notes: state.notes,
        }
      }
      if (state.type === 'amrap') {
        if (sec.rounds && sec.rounds > 1) {
          const roundReps = state.roundReps.map(r => parseInt(r) || 0)
          return {
            type: 'amrap', label: sec.label,
            fixed_rounds: sec.rounds,
            round_reps: roundReps,
            total_reps: roundReps.reduce((a, b) => a + b, 0),
            rx: state.rx, notes: state.notes,
          }
        }
        if (isMaxRepsOnly(sec)) {
          return {
            type: 'amrap', label: sec.label,
            total_reps: parseInt(state.maxReps) || 0,
            rx: state.rx, notes: state.notes,
          }
        }
        return {
          type: 'amrap', label: sec.label,
          rounds: parseInt(state.rounds) || 0,
          extra_reps: parseInt(state.extraReps) || 0,
          rx: state.rx, notes: state.notes,
        }
      }
      return {
        type: 'emom', label: sec.label,
        minutes_done: parseInt(state.minutesDone) || 0,
        total_minutes: sec.duration_min,
        rx: state.rx, notes: state.notes,
      }
    })

    const overallRx = sectionsToSave.every(({ state }) => state.rx)

    try {
      const res = await fetch('/api/log-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout_id: workoutId,
          result: serialized,
          rx: overallRx,
          prediction_rating: predictionRating,
          prediction_feedback: predictionFeedback.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Errore ${res.status}`)
      }
      const data = await res.json()
      onSaved(data.comment ?? null, data.benchmark ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Level picker ---
  if (isMultiLevel && selectedLevel === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400">Seleziona il livello del WOD</p>
        {workoutSections.map((sec, i) => (
          <button
            key={i}
            onClick={() => setSelectedLevel(i)}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-left transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            {sec.label ?? `Livello ${i + 1}`}
          </button>
        ))}
        <button
          onClick={onCancel}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Annulla
        </button>
      </div>
    )
  }

  // --- Form ---
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isMultiLevel && selectedLevel !== null && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedLevel(null)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Cambia livello
          </button>
          <span className="text-sm font-medium text-orange-400">
            {workoutSections[selectedLevel].label}
          </span>
        </div>
      )}

      {activeSections.map((sec, displayIdx) => {
        const realIdx = isMultiLevel ? selectedLevel! : displayIdx
        const state = activeStates[displayIdx]

        return (
          <div key={realIdx} className="bg-gray-800 rounded-xl p-4 space-y-4">
            {!isMultiLevel && sec.label && (
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
                {sec.label}
              </p>
            )}

            {state.type === 'strength' && (
              <StrengthSection
                section={sec}
                movementSets={state.movementSets}
                onUpdateSet={(mi, ri, field, val) => updateSet(realIdx, mi, ri, field, val)}
              />
            )}

            {state.type === 'for_time' && (
              <ForTimeSection
                section={sec}
                numSets={state.times.length}
                times={state.times}
                movementWeights={state.movementWeights}
                onUpdateTime={(ti, val) => updateTime(realIdx, ti, val)}
                onUpdateWeight={(mi, val) => updateMovementWeight(realIdx, mi, val)}
              />
            )}

            {state.type === 'amrap' && (
              <AmrapSection
                durationMin={sec.duration_min}
                fixedRounds={sec.rounds}
                singleMaxReps={isMaxRepsOnly(sec)}
                maxRepsLabel={sec.movements.find(m => m.max_reps)?.name}
                rounds={state.rounds}
                extraReps={state.extraReps}
                maxReps={state.maxReps}
                roundReps={state.roundReps}
                onChange={(field, val) => updateSection(realIdx, { [field]: val })}
                onChangeRoundReps={(ri, val) => updateRoundReps(realIdx, ri, val)}
              />
            )}

            {state.type === 'emom' && (
              <EmomSection
                durationMin={sec.duration_min}
                minutesDone={state.minutesDone}
                onChange={val => updateSection(realIdx, { minutesDone: val })}
              />
            )}

            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.rx}
                  onChange={e => updateSection(realIdx, { rx: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                RX
              </label>
              <input
                type="text"
                value={state.notes}
                onChange={e => updateSection(realIdx, { notes: e.target.value })}
                placeholder="Note / variazioni…"
                className="flex-1 bg-gray-700 text-sm text-white placeholder-gray-500 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
        )
      })}

      {hasRecommendation && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
            Com'era la previsione?
          </p>
          <div className="flex gap-2">
            {PREDICTION_RATINGS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPredictionRating(prev => prev === value ? null : value)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  predictionRating === value
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={predictionFeedback}
            onChange={e => setPredictionFeedback(e.target.value)}
            placeholder="Dettagli (opzionale): cosa era impreciso e perché…"
            className="w-full bg-gray-700 text-sm text-white placeholder-gray-500 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
        >
          {submitting ? 'Salvataggio…' : 'Salva risultato'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}

// --- Sub-components ---

function StrengthSection({
  section, movementSets, onUpdateSet,
}: {
  section: WodSection
  movementSets: SetRow[][]
  onUpdateSet: (mi: number, ri: number, field: 'weight' | 'reps', val: string) => void
}) {
  return (
    <div className="space-y-4">
      {section.movements.map((mov, mi) => (
        <div key={mi} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-white">{mov.name}</p>
            {mov.weight_percent && (
              <p className="text-xs text-gray-500">{mov.weight_percent}% max</p>
            )}
          </div>
          {(movementSets[mi] ?? []).map((set, ri) => (
            <div key={ri} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-10">Set {ri + 1}</span>
              <input
                type="number" inputMode="decimal" value={set.weight}
                onChange={e => onUpdateSet(mi, ri, 'weight', e.target.value)}
                placeholder="kg"
                className="w-20 bg-gray-700 text-sm text-white placeholder-gray-500 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
              />
              <span className="text-gray-500 text-sm">×</span>
              <input
                type="number" inputMode="numeric" value={set.reps}
                onChange={e => onUpdateSet(mi, ri, 'reps', e.target.value)}
                placeholder="reps"
                className="w-20 bg-gray-700 text-sm text-white placeholder-gray-500 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ForTimeSection({
  section, numSets, times, movementWeights, onUpdateTime, onUpdateWeight,
}: {
  section: WodSection
  numSets: number
  times: string[]
  movementWeights: string[]
  onUpdateTime: (ti: number, val: string) => void
  onUpdateWeight: (mi: number, val: string) => void
}) {
  const weightedMovements = section.movements
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.weight_rx_kg != null)

  return (
    <div className="space-y-4">
      {weightedMovements.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Pesi utilizzati</p>
          {weightedMovements.map(({ m, i }) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-gray-300 flex-1 truncate">{m.name}</span>
              <input
                type="number"
                inputMode="decimal"
                value={movementWeights[i] ?? ''}
                onChange={e => onUpdateWeight(i, e.target.value)}
                placeholder="kg"
                className="w-20 bg-gray-700 text-sm text-white placeholder-gray-500 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
              />
              <span className="text-xs text-gray-500">kg</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-gray-400">
          {numSets > 1 ? 'Tempo per ogni set' : 'Tempo'}
        </p>
        {numSets === 1 ? (
          <TimeInput
            value={times[0] ?? ''}
            onChange={val => onUpdateTime(0, val)}
            className="w-32 bg-gray-700 text-xl text-white placeholder-gray-500 px-4 py-3 rounded-lg focus-within:ring-1 focus-within:ring-orange-500"
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {times.map((t, ti) => (
              <div key={ti} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-8 shrink-0">S{ti + 1}</span>
                <TimeInput
                  value={t}
                  onChange={val => onUpdateTime(ti, val)}
                  className="flex-1 bg-gray-700 text-sm text-white placeholder-gray-500 px-3 py-2 rounded-lg focus-within:ring-1 focus-within:ring-orange-500"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AmrapSection({
  durationMin, fixedRounds, singleMaxReps, maxRepsLabel, rounds, extraReps, maxReps, roundReps, onChange, onChangeRoundReps,
}: {
  durationMin?: number
  fixedRounds?: number
  singleMaxReps?: boolean
  maxRepsLabel?: string
  rounds: string
  extraReps: string
  maxReps: string
  roundReps: string[]
  onChange: (field: string, val: string) => void
  onChangeRoundReps: (ri: number, val: string) => void
}) {
  // Fixed round count (e.g. "5 SETS (2:00 AMRAP)") — rounds are known in advance,
  // so only the variable max-reps movement needs to be logged, one input per round.
  if (fixedRounds && fixedRounds > 1) {
    const total = roundReps.reduce((sum, r) => sum + (parseInt(r) || 0), 0)
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-400">
          {fixedRounds} round{durationMin ? ` × ${durationMin} min AMRAP` : ''} — {maxRepsLabel ?? 'reps'} per round
        </p>
        <div className="grid grid-cols-3 gap-2">
          {roundReps.map((val, ri) => (
            <div key={ri} className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 w-5 shrink-0">R{ri + 1}</span>
              <input type="number" inputMode="numeric" value={val}
                onChange={e => onChangeRoundReps(ri, e.target.value)}
                placeholder="reps" min={0}
                className="w-full bg-gray-700 text-sm text-white placeholder-gray-500 px-2 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">Totale: {total}</p>
      </div>
    )
  }

  // Single-movement max-reps test (e.g. "Max Power Cleans in 5 min") — one plain reps input.
  if (singleMaxReps) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-400">
          {durationMin ? `Max reps in ${durationMin} min` : 'Max reps'}
          {maxRepsLabel ? ` — ${maxRepsLabel}` : ''}
        </p>
        <input type="number" inputMode="numeric" value={maxReps}
          onChange={e => onChange('maxReps', e.target.value)}
          placeholder="reps" min={0}
          className="w-24 bg-gray-700 text-lg text-white placeholder-gray-500 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400">
        {durationMin ? `AMRAP ${durationMin} min` : 'AMRAP'} — giri completati
      </p>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" value={rounds}
          onChange={e => onChange('rounds', e.target.value)}
          placeholder="giri" min={0}
          className="w-24 bg-gray-700 text-lg text-white placeholder-gray-500 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
        />
        <span className="text-gray-400">+</span>
        <input type="number" inputMode="numeric" value={extraReps}
          onChange={e => onChange('extraReps', e.target.value)}
          placeholder="reps" min={0}
          className="w-24 bg-gray-700 text-lg text-white placeholder-gray-500 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
        />
      </div>
    </div>
  )
}

function EmomSection({
  durationMin, minutesDone, onChange,
}: {
  durationMin?: number
  minutesDone: string
  onChange: (val: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400">
        {durationMin ? `EMOM ${durationMin} min` : 'EMOM'} — minuti completati
      </p>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" value={minutesDone}
          onChange={e => onChange(e.target.value)}
          placeholder="min" min={0} max={durationMin}
          className="w-24 bg-gray-700 text-lg text-white placeholder-gray-500 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
        />
        {durationMin && <span className="text-gray-500 text-sm">/ {durationMin}</span>}
      </div>
    </div>
  )
}

// --- Helpers ---

function initSection(section: WodSection, profile: FitnessEntry[]): SectionState {
  const base: SectionState = {
    type: section.type,
    movementSets: [],
    times: [],
    movementWeights: section.movements.map(m => m.weight_rx_kg?.toString() ?? ''),
    rounds: '',
    extraReps: '',
    maxReps: '',
    roundReps: [],
    minutesDone: '',
    rx: true,
    notes: '',
  }

  if (section.type === 'amrap' && section.rounds && section.rounds > 1) {
    base.roundReps = Array(section.rounds).fill('')
  }

  if (section.type === 'strength') {
    base.movementSets = section.movements.map(m => {
      const n = section.rounds ?? m.sets ?? 3
      const suggested = m.weight_percent
        ? suggestWeight(m.name, m.weight_percent, profile)
        : m.weight_rx_kg?.toString() ?? ''
      return Array.from({ length: n }, () => ({ weight: suggested, reps: m.reps ?? '' }))
    })
  }

  if (section.type === 'for_time') {
    const numSets = Math.max(...section.movements.map(m => m.sets ?? 1), 1)
    base.times = Array(numSets).fill('')
  }

  return base
}

function suggestWeight(name: string, pct: number, profile: FitnessEntry[]): string {
  const entry = profile.find(p =>
    p.name.toLowerCase().includes(name.toLowerCase()) ||
    name.toLowerCase().includes(p.name.toLowerCase())
  )
  if (!entry) return ''
  const max = parseFloat(entry.value)
  if (isNaN(max)) return ''
  return (Math.round((max * pct) / 100 / 2.5) * 2.5).toString()
}
