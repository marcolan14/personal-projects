import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { name, value, unit, recorded_on } = await request.json()

    if (!name?.trim() || !value?.toString().trim() || !recorded_on) {
      return Response.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('fitness_profile')
      .upsert(
        { user_id: user.id, name: name.trim(), value: value.toString().trim(), unit, recorded_on },
        { onConflict: 'user_id,name,recorded_on' }
      )
      .select('id, name, value, unit, recorded_on')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[profile]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return Response.json({ error: 'Id mancante' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { error } = await supabase
      .from('fitness_profile')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[profile]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
