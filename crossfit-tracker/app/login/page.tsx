'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(searchParams.get('error'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setPending(true)
    setError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">CrossFit Tracker</h1>
        <p className="text-gray-400 mb-8 text-sm">Inserisci la tua email per accedere.</p>

        {success ? (
          <div className="bg-green-900/40 border border-green-700 rounded-lg p-4 text-green-300 text-sm">
            Controlla la tua email — ti abbiamo inviato il link di accesso.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="marco@example.com"
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-orange-500 text-sm"
            />
            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {pending ? 'Invio in corso…' : 'Invia link di accesso'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
