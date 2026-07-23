import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import WodSection from '@/components/WodSection'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: workout }, { data: profile }, { data: todayResult }] = await Promise.all([
    supabase.from('workouts').select('*').eq('date', today).single(),
    supabase.from('fitness_profile').select('name, value, unit').eq('user_id', user.id),
    supabase.from('results')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <h1 className="font-bold text-lg text-orange-500">CrossFit Tracker</h1>
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-xs text-gray-400 hover:text-white transition-colors">
            Profilo
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h2 className="text-xl font-bold mt-1">WOD di oggi</h2>
        </div>

        <WodSection
          workout={workout}
          profile={profile ?? []}
          existingResult={!!todayResult}
        />
      </div>
    </main>
  )
}
