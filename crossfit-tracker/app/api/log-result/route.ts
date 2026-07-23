import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { workout_id, result, rx, notes } = await request.json()

    if (!workout_id || !result) {
      return Response.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { error } = await supabase.from('results').insert({
      user_id: user.id,
      workout_id,
      result: JSON.stringify(result),
      rx: rx ?? true,
      notes: notes ?? null,
    })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[log-result]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
