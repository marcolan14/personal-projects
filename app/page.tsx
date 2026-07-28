import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import WodSection from '@/components/WodSection'
import DateNav from '@/components/DateNav'
import { todayISO } from '@/lib/dates'

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const todayDate = todayISO()
  const { date: dateParam } = await searchParams
  const selectedDate = dateParam && isoDateRe.test(dateParam) && dateParam <= todayDate
    ? dateParam
    : todayDate

  const { data: workout } = await supabase.from('workouts').select('*').eq('date', selectedDate).single()

  const [{ data: profileHistory }, { data: existingResult }, { data: recommendation }] = await Promise.all([
    supabase.from('fitness_profile')
      .select('name, value, unit, recorded_on')
      .eq('user_id', user.id)
      .order('recorded_on', { ascending: false }),
    workout
      ? supabase.from('results')
          .select('id, comment')
          .eq('user_id', user.id)
          .eq('workout_id', workout.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    workout
      ? supabase.from('wod_recommendations')
          .select('recommendations, expected_result')
          .eq('user_id', user.id)
          .eq('workout_id', workout.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // one entry per benchmark: the most recent result, used to suggest loads
  const latestByName = new Map<string, { name: string; value: string; unit: string | null }>()
  for (const entry of profileHistory ?? []) {
    if (!latestByName.has(entry.name)) latestByName.set(entry.name, entry)
  }
  const profile = Array.from(latestByName.values())

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
        <DateNav selectedDate={selectedDate} todayDate={todayDate} />

        <WodSection
          key={selectedDate}
          date={selectedDate}
          workout={workout}
          profile={profile ?? []}
          existingResult={!!existingResult}
          existingResultComment={existingResult?.comment ?? null}
          initialRecommendation={recommendation ?? null}
        />
      </div>
    </main>
  )
}
