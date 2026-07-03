'use client'

import { useState } from 'react'
import { PRESET_PROFILE } from '@/lib/profile-presets'
import { FitnessEntry } from '@/lib/types'

type CustomEntry = { name: string; value: string; unit: string }

export default function ProfileForm({ existing }: { existing: FitnessEntry[] }) {
  const existingMap = Object.fromEntries(existing.map(e => [e.name, e.value]))

  const [values, setValues] = useState<Record<string, string>>(existingMap)
  const [customs, setCustoms] = useState<CustomEntry[]>(
    existing
      .filter(e => !PRESET_PROFILE.flatMap(c => c.items).some(i => i.name === e.name))
      .map(e => ({ name: e.name, value: e.value, unit: e.unit ?? '' }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addCustom() {
    setCustoms(prev => [...prev, { name: '', value: '', unit: '' }])
  }

  function updateCustom(i: number, field: keyof CustomEntry, val: string) {
    setCustoms(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  }

  function removeCustom(i: number) {
    setCustoms(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const presetEntries = PRESET_PROFILE.flatMap(cat =>
      cat.items.map(item => ({
        name: item.name,
        value: values[item.name] ?? '',
        unit: item.unit,
      }))
    )

    const customEntries = customs
      .filter(c => c.name.trim())
      .map(c => ({ name: c.name.trim(), value: c.value, unit: c.unit }))

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [...presetEntries, ...customEntries] }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Errore ${res.status}`)
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {PRESET_PROFILE.map(cat => (
        <div key={cat.category} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-orange-400">
            {cat.category}
          </h3>
          <div className="bg-gray-900 rounded-xl divide-y divide-gray-800">
            {cat.items.map(item => (
              <div key={item.name} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm text-gray-200">{item.name}</span>
                <input
                  type={item.inputType}
                  inputMode={item.inputType === 'number' ? 'decimal' : 'text'}
                  value={values[item.name] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [item.name]: e.target.value }))}
                  placeholder="—"
                  className="w-20 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                />
                <span className="text-xs text-gray-500 w-10">{item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Custom entries */}
      {customs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-orange-400">
            Personalizzati
          </h3>
          <div className="space-y-2">
            {customs.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={c.name}
                  onChange={e => updateCustom(i, 'name', e.target.value)}
                  placeholder="Nome"
                  className="flex-1 bg-gray-900 text-sm text-white placeholder-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <input
                  type="text"
                  value={c.value}
                  onChange={e => updateCustom(i, 'value', e.target.value)}
                  placeholder="Valore"
                  className="w-20 bg-gray-900 text-sm text-white placeholder-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                />
                <input
                  type="text"
                  value={c.unit}
                  onChange={e => updateCustom(i, 'unit', e.target.value)}
                  placeholder="unità"
                  className="w-16 bg-gray-900 text-sm text-white placeholder-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
                />
                <button
                  onClick={() => removeCustom(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={addCustom}
        className="w-full py-2.5 rounded-xl border border-dashed border-gray-700 text-sm text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
      >
        + Aggiungi indicatore
      </button>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {saved && (
        <p className="text-green-400 text-xs">Profilo salvato</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
      >
        {saving ? 'Salvataggio…' : 'Salva profilo'}
      </button>
    </div>
  )
}
