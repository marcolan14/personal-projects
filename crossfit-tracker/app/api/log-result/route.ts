import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildResultHistoryText } from '@/lib/result-history'
import { matchPreset } from '@/lib/profile-presets'
import { WodMeta } from '@/lib/types'
import { NextRequest } from 'next/server'

const LOGGABLE = new Set(['strength', 'for_time', 'amrap', 'emom'])

// A single-movement "for time" section (e.g. a 1 mile run, a row test) that matches
// a known preset name doubles as a benchmark, so logging it also updates fitness_profile.
function extractBenchmark(result: unknown[], wodMeta: WodMeta | null) {
  if (!wodMeta) return null

  const loggableSections = wodMeta.sections.filter(s => LOGGABLE.has(s.type))

  for (const entry of result as Array<{ type: string; label?: string; time?: string }>) {
    if (entry.type !== 'for_time' || !entry.time) continue

    const section = loggableSections.length === result.length
      ? loggableSections[result.indexOf(entry)]
      : loggableSections.find(s => s.type === entry.type && s.label === entry.label)

    if (!section || section.movements.length !== 1) continue

    const preset = matchPreset(section.movements[0].name)
    if (preset) return { name: preset.name, value: entry.time, unit: preset.unit }
  }

  return null
}

const COMMENT_TOOL: Anthropic.Tool = {
  name: 'submit_comment',
  description: 'Registra un breve commento sul risultato ottenuto rispetto a quello atteso.',
  input_schema: {
    type: 'object',
    properties: {
      comment: {
        type: 'string',
        description: 'Commento breve (2-4 frasi) in italiano su come il risultato effettivo si confronta con quello atteso: se lo ha superato, raggiunto o non raggiunto, e perché o cosa migliorare la prossima volta.',
      },
    },
    required: ['comment'],
  },
}

const COMMENT_PROMPT = (wodText: string, expected: string, resultJson: string, historyText: string) => `WOD:
${wodText}

Risultato atteso (stimato prima di svolgere il WOD, basato sul profilo dell'utente):
${expected}

Risultato effettivo registrato dall'utente (JSON):
${resultJson}

Storico dei risultati precedenti dell'utente (più recenti prima), utile per notare tendenze o miglioramenti:
${historyText}

Confronta il risultato effettivo con quello atteso, ed eventualmente con lo storico, e chiama il tool "submit_comment" con un breve commento.`

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

    const [{ data: workout }, { data: recommendation }] = await Promise.all([
      supabase.from('workouts').select('raw_text, wod_meta, date').eq('id', workout_id).single(),
      supabase.from('wod_recommendations')
        .select('expected_result')
        .eq('user_id', user.id)
        .eq('workout_id', workout_id)
        .maybeSingle(),
    ])

    const wodMeta = (workout?.wod_meta as WodMeta | null) ?? null

    // Only worth commenting when there's an expected result to compare against.
    let comment: string | null = null
    if (recommendation?.expected_result && workout?.raw_text) {
      try {
        const historyText = await buildResultHistoryText(supabase, user.id, wodMeta)
        const client = new Anthropic()
        const message = await client.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 512,
          tools: [COMMENT_TOOL],
          tool_choice: { type: 'tool', name: COMMENT_TOOL.name },
          messages: [{
            role: 'user',
            content: COMMENT_PROMPT(workout.raw_text, recommendation.expected_result, JSON.stringify(result), historyText),
          }],
        })
        const toolUse = message.content.find(block => block.type === 'tool_use')
        const input = toolUse?.input as { comment?: string } | undefined
        if (input?.comment) comment = input.comment
      } catch (aiErr) {
        console.error('[log-result] comment generation failed:', aiErr)
      }
    }

    const { error } = await supabase.from('results').insert({
      user_id: user.id,
      workout_id,
      result: JSON.stringify(result),
      rx: rx ?? true,
      notes: notes ?? null,
      comment,
    })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    let benchmark: { name: string; value: string; unit: string | null } | null = null
    const detected = extractBenchmark(result, wodMeta)
    if (detected && workout?.date) {
      const { error: benchmarkError } = await supabase.from('fitness_profile').upsert(
        { user_id: user.id, name: detected.name, value: detected.value, unit: detected.unit, recorded_on: workout.date },
        { onConflict: 'user_id,name,recorded_on' }
      )
      if (!benchmarkError) benchmark = detected
      else console.error('[log-result] benchmark upsert failed:', benchmarkError)
    }

    return Response.json({ ok: true, comment, benchmark })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[log-result]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
