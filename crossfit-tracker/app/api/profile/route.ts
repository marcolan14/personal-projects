import { createSupabaseServerClient } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

type Entry = { name: string; value: string; unit: string }

export async function POST(request: NextRequest) {
  try {
    const { entries }: { entries: Entry[] } = await request.json()

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const toUpsert = entries.filter(e => e.value.trim() !== '')
    const toDelete = entries.filter(e => e.value.trim() === '').map(e => e.name)

    if (toUpsert.length > 0) {
      const { error } = await supabase.from('fitness_profile').upsert(
        toUpsert.map(e => ({ user_id: user.id, name: e.name, value: e.value.trim(), unit: e.unit })),
        { onConflict: 'user_id,name' }
      )
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('fitness_profile')
        .delete()
        .eq('user_id', user.id)
        .in('name', toDelete)
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[profile]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
