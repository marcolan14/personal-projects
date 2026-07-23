import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export async function PATCH(request: NextRequest) {
  try {
    const { workout_id, raw_text } = await request.json()

    if (!workout_id || !raw_text?.trim()) {
      return Response.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { error } = await supabase
      .from('workouts')
      .update({ raw_text: raw_text.trim() })
      .eq('id', workout_id)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[update-wod]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
