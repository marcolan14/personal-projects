import { createSupabaseServerClient } from '@/lib/supabase-server'
import { WodMeta, flattenMovementNames } from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

const HISTORY_POOL = 40
const HISTORY_LIMIT = 10
const RELEVANT_CAP = 6

function namesOverlap(a: string[], b: string[]): boolean {
  return a.some(x => b.some(y => x === y || x.includes(y) || y.includes(x)))
}

export async function buildResultHistoryText(
  supabase: SupabaseServerClient,
  userId: string,
  currentWodMeta?: WodMeta | null
): Promise<string> {
  const { data } = await supabase
    .from('results')
    .select('result, rx, notes, comment, created_at, workouts(date, raw_text, wod_meta)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_POOL)

  if (!data?.length) return 'Nessun risultato precedente registrato.'

  const focusNames = flattenMovementNames(currentWodMeta)

  const withMeta = data.map((r, i) => {
    const workoutData = r.workouts as { date: string; raw_text: string; wod_meta: WodMeta | null } | { date: string; raw_text: string; wod_meta: WodMeta | null }[] | null
    const workout = Array.isArray(workoutData) ? workoutData[0] : workoutData
    const relevant = focusNames.length > 0 && namesOverlap(flattenMovementNames(workout?.wod_meta), focusNames)
    return { i, r, workout, relevant }
  })

  // Same-movement history is prioritized (e.g. past runs when today's WOD is a run),
  // topped up with the most recent results overall, then re-sorted to preserve recency order.
  let selected = withMeta.slice(0, HISTORY_LIMIT)
  if (focusNames.length > 0) {
    const relevantRows = withMeta.filter(x => x.relevant).slice(0, RELEVANT_CAP)
    const relevantIdx = new Set(relevantRows.map(x => x.i))
    const fillerRows = withMeta.filter(x => !relevantIdx.has(x.i)).slice(0, Math.max(0, HISTORY_LIMIT - relevantRows.length))
    selected = [...relevantRows, ...fillerRows].sort((a, b) => a.i - b.i)
  }

  return selected
    .map(({ r, workout, relevant }) => {
      const wodLabel = workout?.raw_text
        ? workout.raw_text.slice(0, 200).replace(/\s+/g, ' ')
        : 'WOD non disponibile'
      const tag = relevant ? ' [stesso movimento/test di oggi]' : ''
      const lines = [
        `- ${workout?.date ?? '?'} — ${wodLabel}${tag}`,
        `  Risultato: ${r.result} (${r.rx ? 'RX' : 'scalato'})`,
      ]
      if (r.notes) lines.push(`  Note: ${r.notes}`)
      if (r.comment) lines.push(`  Valutazione precedente: ${r.comment}`)
      return lines.join('\n')
    })
    .join('\n')
}
