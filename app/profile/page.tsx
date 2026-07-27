import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileForm from '@/components/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: history } = await supabase
    .from('fitness_profile')
    .select('id, name, value, unit, recorded_on')
    .eq('user_id', user.id)
    .order('recorded_on', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Dashboard
        </Link>
        <h1 className="font-bold text-lg text-orange-500">Profilo Fitness</h1>
        <div className="w-16" />
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <p className="text-sm text-gray-500 mb-6">
          Registra i tuoi massimali e benchmark. Aggiungi un nuovo risultato ogni volta che migliori,
          così puoi seguire i tuoi progressi nel tempo.
        </p>
        <ProfileForm history={history ?? []} />
      </div>
    </main>
  )
}
