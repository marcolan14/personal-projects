'use client'

import { useState } from 'react'
import { PRESET_PROFILE } from '@/lib/profile-presets'
import { FitnessHistoryEntry } from '@/lib/types'

type Benchmark = { name: string; unit: string; entries: FitnessHistoryEntry[] }

const today = () => new Date().toISOString().split('T')[0]

export default function ProfileForm({ history }: { history: FitnessHistoryEntry[] }) {
  const [entries, setEntries] = useState<FitnessHistoryEntry[]>(history)
  const [error, setError] = useState<string | null>(null)

  const presetNames = new Set(PRESET_PROFILE.flatMap(cat => cat.items.map(i => i.name)))

  const benchmarks: Benchmark[] = [
    ...PRESET_PROFILE.flatMap(cat =>
      cat.items.map(item => ({
        name: item.name,
        unit: item.unit,
        entries: entries.filter(e => e.name === item.name),
      }))
    ),
    ...Array.from(new Set(entries.filter(e => !presetNames.has(e.name)).map(e => e.name))).map(name => ({
      name,
      unit: entries.find(e => e.name === name)?.unit ?? '',
      entries: entries.filter(e => e.name === name),
    })),
  ]

  async function addEntry(name: string, unit: string, value: string, recordedOn: string) {
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value, unit, recorded_on: recordedOn }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Errore ${res.status}`)
      }
      const saved: FitnessHistoryEntry = await res.json()
      setEntries(prev => [saved, ...prev.filter(e => !(e.name === name && e.recorded_on === recordedOn))])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  async function deleteEntry(id: string) {
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Errore ${res.status}`)
      }
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {PRESET_PROFILE.map(cat => (
        <div key={cat.category} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-orange-400">
            {cat.category}
          </h3>
          <div className="space-y-2">
            {benchmarks
              .filter(b => cat.items.some(i => i.name === b.name))
              .map(b => (
                <BenchmarkCard
                  key={b.name}
                  benchmark={b}
                  inputType={cat.items.find(i => i.name === b.name)!.inputType}
                  onAdd={addEntry}
                  onDelete={deleteEntry}
                />
              ))}
          </div>
        </div>
      ))}

      <CustomBenchmarks
        benchmarks={benchmarks.filter(b => !presetNames.has(b.name))}
        onAdd={addEntry}
        onDelete={deleteEntry}
      />
    </div>
  )
}

function BenchmarkCard({
  benchmark, inputType, onAdd, onDelete,
}: {
  benchmark: Benchmark
  inputType: 'number' | 'text'
  onAdd: (name: string, unit: string, value: string, recordedOn: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [value, setValue] = useState('')
  const [recordedOn, setRecordedOn] = useState(today())
  const [saving, setSaving] = useState(false)

  const latest = benchmark.entries[0]

  async function handleAdd() {
    if (!value.trim()) return
    setSaving(true)
    await onAdd(benchmark.name, benchmark.unit, value.trim(), recordedOn)
    setSaving(false)
    setValue('')
    setRecordedOn(today())
    setAdding(false)
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-gray-200">{benchmark.name}</p>
          <p className="text-xs text-gray-500">
            {latest ? `${latest.value} ${benchmark.unit} · ${formatDate(latest.recorded_on)}` : 'Nessun risultato'}
          </p>
        </div>
        {benchmark.entries.length > 1 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Storico ({benchmark.entries.length})
          </button>
        )}
        <button
          onClick={() => setAdding(v => !v)}
          className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
        >
          + Aggiungi
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type={inputType}
            inputMode={inputType === 'number' ? 'decimal' : 'text'}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={benchmark.unit || 'valore'}
            className="w-24 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
          />
          <input
            type="date"
            value={recordedOn}
            max={today()}
            onChange={e => setRecordedOn(e.target.value)}
            className="bg-gray-800 text-sm text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !value.trim()}
            className="flex-1 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      )}

      {showHistory && benchmark.entries.length > 1 && (
        <div className="space-y-1 pt-1 border-t border-gray-800">
          {benchmark.entries.map(e => (
            <div key={e.id} className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <span>{formatDate(e.recorded_on)}</span>
              <span className="text-gray-200">{e.value} {benchmark.unit}</span>
              <button
                onClick={() => onDelete(e.id)}
                className="text-gray-600 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomBenchmarks({
  benchmarks, onAdd, onDelete,
}: {
  benchmarks: Benchmark[]
  onAdd: (name: string, unit: string, value: string, recordedOn: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [value, setValue] = useState('')
  const [recordedOn, setRecordedOn] = useState(today())
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim() || !value.trim()) return
    setSaving(true)
    await onAdd(name.trim(), unit.trim(), value.trim(), recordedOn)
    setSaving(false)
    setName('')
    setUnit('')
    setValue('')
    setRecordedOn(today())
    setCreating(false)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-orange-400">
        Personalizzati
      </h3>

      {benchmarks.length > 0 && (
        <div className="space-y-2">
          {benchmarks.map(b => (
            <BenchmarkCard
              key={b.name}
              benchmark={b}
              inputType="text"
              onAdd={onAdd}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {creating ? (
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome indicatore"
            className="w-full bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Valore"
              className="flex-1 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="unità"
              className="w-20 bg-gray-800 text-sm text-white placeholder-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 text-center"
            />
            <input
              type="date"
              value={recordedOn}
              max={today()}
              onChange={e => setRecordedOn(e.target.value)}
              className="bg-gray-800 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim() || !value.trim()}
              className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-3 py-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-gray-700 text-sm text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
        >
          + Aggiungi indicatore
        </button>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}
