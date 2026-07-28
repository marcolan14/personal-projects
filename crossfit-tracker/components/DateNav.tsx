import Link from 'next/link'
import { addDaysISO } from '@/lib/dates'

function formatLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type Props = {
  selectedDate: string
  todayDate: string
}

export default function DateNav({ selectedDate, todayDate }: Props) {
  const prev = addDaysISO(selectedDate, -1)
  const next = addDaysISO(selectedDate, 1)
  const isToday = selectedDate === todayDate
  const canGoNext = next <= todayDate

  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={`/?date=${prev}`}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors text-lg"
        aria-label="Giorno precedente"
      >
        ‹
      </Link>

      <div className="text-center">
        <p className="text-xs text-gray-500 uppercase tracking-widest">{formatLabel(selectedDate)}</p>
        <h2 className="text-xl font-bold mt-1">{isToday ? 'WOD di oggi' : 'WOD del giorno'}</h2>
        {!isToday && (
          <Link href="/" className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors">
            Torna a oggi
          </Link>
        )}
      </div>

      {canGoNext ? (
        <Link
          href={`/?date=${next}`}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors text-lg"
          aria-label="Giorno successivo"
        >
          ›
        </Link>
      ) : (
        <span className="shrink-0 w-9 h-9" />
      )}
    </div>
  )
}
