'use client'

import { useState } from 'react'
import { WodRecommendation as WodRecommendationType } from '@/lib/types'

type Props = {
  workoutId: string
  recommendation: WodRecommendationType | null
  onGenerated: (rec: WodRecommendationType) => void
}

export default function WodRecommendation({ workoutId, recommendation, onGenerated }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wod-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_id: workoutId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Errore ${res.status}`)
      }
      const data: WodRecommendationType = await res.json()
      onGenerated(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  if (!recommendation) {
    return (
      <div className="space-y-2">
        <button
          onClick={generate}
          disabled={loading}
          className="w-full py-2.5 rounded-xl border border-dashed border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Analisi del profilo in corso…' : '✨ Consigli e risultato atteso'}
        </button>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Consigli WOD</p>
        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{recommendation.recommendations}</p>
      </div>
      <div className="space-y-1 pt-3 border-t border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Risultato atteso</p>
        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{recommendation.expected_result}</p>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={generate}
        disabled={loading}
        className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Rigenerazione…' : 'Rigenera'}
      </button>
    </div>
  )
}
