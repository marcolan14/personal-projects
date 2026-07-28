'use client'

import { useState } from 'react'
import { WodMeta, FitnessEntry, WodRecommendation as WodRecommendationType } from '@/lib/types'
import ResultForm from './ResultForm'
import WodRecommendation from './WodRecommendation'

type Workout = {
  id: string
  date: string
  raw_text: string
  wod_meta: WodMeta | null
  image_url: string | null
} | null

type Props = {
  workout: Workout
  profile: FitnessEntry[]
  existingResult: boolean
  initialRecommendation: WodRecommendationType | null
  date: string
}

type WorkoutState = {
  id: string | null
  rawText: string | null
  wodMeta: WodMeta | null
}

export default function WodSection({ workout, profile, existingResult, initialRecommendation, date }: Props) {
  const [wod, setWod] = useState<WorkoutState>({
    id: workout?.id ?? null,
    rawText: workout?.raw_text ?? null,
    wodMeta: workout?.wod_meta ?? null,
  })
  const [replacing, setReplacing] = useState(false)
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [resultSaved, setResultSaved] = useState(existingResult)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<WodRecommendationType | null>(initialRecommendation)

  async function handleSaveEdit() {
    if (!wod.id || !editText.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/update-wod', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_id: wod.id, raw_text: editText }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Errore ${res.status}`)
      }
      setWod(prev => ({ ...prev, rawText: editText.trim() }))
      setRecommendation(null)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSaving(false)
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    setUploading(true)
    setError(null)
    setProgress(files.length > 1 ? `Conversione ${files.length} immagini…` : 'Conversione immagine…')

    try {
      const images = await Promise.all(
        files.map(async (file) => ({
          imageBase64: await toBase64(file),
          mediaType: 'image/jpeg' as const,
        }))
      )

      setProgress(files.length > 1 ? `Analisi di ${files.length} screenshot…` : 'Analisi screenshot…')

      const res = await fetch('/api/extract-wod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, date }),
      })

      if (!res.ok) {
        let message = `Errore ${res.status}`
        try {
          const data = await res.json()
          if (data.error) message = data.error
        } catch {}
        throw new Error(message)
      }

      const data = await res.json()
      setWod({ id: data.workoutId, rawText: data.rawText, wodMeta: data.wodMeta })
      setReplacing(false)
      setResultSaved(false)
      setRecommendation(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  // --- logging view ---
  if (logging && wod.id && wod.wodMeta) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Registra risultato</h3>
        </div>
        <ResultForm
          workoutId={wod.id}
          meta={wod.wodMeta}
          profile={profile}
          onSaved={() => { setLogging(false); setResultSaved(true) }}
          onCancel={() => setLogging(false)}
        />
      </div>
    )
  }

  // --- edit mode ---
  if (editing && wod.rawText) {
    return (
      <div className="space-y-3">
        <textarea
          value={editText}
          onChange={e => setEditText(e.target.value)}
          rows={12}
          className="w-full bg-gray-900 rounded-xl p-4 text-sm text-gray-200 font-sans leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
          >
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
          <button
            onClick={() => { setEditing(false); setError(null) }}
            className="px-4 py-2.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Annulla
          </button>
        </div>
      </div>
    )
  }

  // --- wod display ---
  if (wod.rawText && !replacing) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
            {wod.rawText}
          </pre>
          <div className="flex gap-4">
            <button
              onClick={() => { setEditText(wod.rawText!); setEditing(true) }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Modifica
            </button>
            <button
              onClick={() => setReplacing(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Sostituisci WOD
            </button>
          </div>
        </div>

        {wod.id && hasWorkoutSections(wod.wodMeta) && (
          <WodRecommendation
            workoutId={wod.id}
            recommendation={recommendation}
            onGenerated={setRecommendation}
          />
        )}

        {resultSaved ? (
          <div className="bg-green-900/30 border border-green-800 rounded-xl px-4 py-3 text-sm text-green-300">
            Risultato salvato
          </div>
        ) : wod.id && hasWorkoutSections(wod.wodMeta) ? (
          <button
            onClick={() => setLogging(true)}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 transition-colors text-white font-semibold text-sm"
          >
            Registra risultato
          </button>
        ) : null}
      </div>
    )
  }

  // --- upload view ---
  return (
    <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center gap-4 text-center border-2 border-dashed border-gray-700">
      <div className="text-4xl">📸</div>
      <div>
        <p className="font-semibold text-gray-200">
          {replacing ? 'Carica nuovi screenshot' : 'Nessun WOD per questo giorno'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Carica uno o più screenshot della pagina WOD
        </p>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex flex-col items-center gap-2 w-full">
        <label className="cursor-pointer bg-orange-500 hover:bg-orange-400 transition-colors text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
          {uploading ? progress : 'Carica screenshot'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={handleFiles}
          />
        </label>
        {replacing && !uploading && (
          <button
            onClick={() => { setReplacing(false); setError(null) }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Annulla
          </button>
        )}
      </div>
    </div>
  )
}

const WORKOUT_TYPES = new Set(['strength', 'for_time', 'amrap', 'emom'])

function hasWorkoutSections(meta: WodMeta | null): boolean {
  return meta?.sections.some(s => WORKOUT_TYPES.has(s.type)) ?? false
}

const MAX_PX = 1600
const JPEG_QUALITY = 0.82

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1])
    }

    img.onerror = reject
    img.src = url
  })
}
