import { createSupabaseServerClient } from '@/lib/supabase-server'

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

const HISTORY_LIMIT = 10

export async function buildResultHistoryText(supabase: SupabaseServerClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('results')
    .select('result, rx, notes, comment, created_at, workouts(date, raw_text)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (!data?.length) return 'Nessun risultato precedente registrato.'

  return data
    .map(r => {
      const workoutData = r.workouts as { date: string; raw_text: string } | { date: string; raw_text: string }[] | null
      const workout = Array.isArray(workoutData) ? workoutData[0] : workoutData
      const wodLabel = workout?.raw_text
        ? workout.raw_text.slice(0, 200).replace(/\s+/g, ' ')
        : 'WOD non disponibile'
      const lines = [
        `- ${workout?.date ?? '?'} — ${wodLabel}`,
        `  Risultato: ${r.result} (${r.rx ? 'RX' : 'scalato'})`,
      ]
      if (r.notes) lines.push(`  Note: ${r.notes}`)
      if (r.comment) lines.push(`  Valutazione precedente: ${r.comment}`)
      return lines.join('\n')
    })
    .join('\n')
}
