import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildResultHistoryText } from '@/lib/result-history'
import { matchPreset } from '@/lib/profile-presets'
import { WodMeta, flattenMovementNames } from '@/lib/types'
import { NextRequest } from 'next/server'

const PROFILE_TREND_CAP = 5

const PROMPT_TEMPLATE = (wodText: string, profileText: string, historyText: string) => `Sei un coach di CrossFit esperto. Ecco il WOD di oggi:

${wodText}

Profilo atletico dell'utente (massimali/benchmark noti, valore più recente per ciascuno):
${profileText}

Storico dei risultati recenti dell'utente (più recenti prima):
${historyText}

Chiama il tool "submit_recommendation" con i tuoi consigli. Usa lo storico per calibrare consigli e stima in base alle tendenze reali dell'utente (es. se supera spesso le aspettative, se fatica su certi movimenti o formati). Se per un movimento non ci sono dati rilevanti nel profilo, dai comunque un consiglio generico ragionevole per un atleta intermedio. Sii specifico e concreto, evita frasi generiche.`

const RECOMMENDATION_TOOL: Anthropic.Tool = {
  name: 'submit_recommendation',
  description: "Registra i consigli sul WOD e il risultato atteso per l'utente.",
  input_schema: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'string',
        description: 'Consigli pratici in italiano su pacing, dove fare break, pesi o scaling consigliati per ogni movimento del WOD, basati sul profilo dell\'utente. Elenco puntato con a capo (\\n) tra i punti.',
      },
      expected_result: {
        type: 'string',
        description: 'Stima realistica e specifica del risultato atteso (tempo, round+reps, kg, ecc. secondo il formato del WOD), basata sul profilo dell\'utente.',
      },
    },
    required: ['recommendations', 'expected_result'],
  },
}

export async function POST(request: NextRequest) {
  try {
    const { workout_id } = await request.json()

    if (!workout_id) {
      return Response.json({ error: 'workout_id mancante' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const [{ data: workout }, { data: profileHistory }] = await Promise.all([
      supabase.from('workouts').select('raw_text, wod_meta').eq('id', workout_id).single(),
      supabase.from('fitness_profile')
        .select('name, value, unit, recorded_on')
        .eq('user_id', user.id)
        .order('recorded_on', { ascending: false }),
    ])

    if (!workout) {
      return Response.json({ error: 'WOD non trovato' }, { status: 404 })
    }

    const wodMeta = workout.wod_meta as WodMeta | null

    // Benchmarks matching a movement in today's WOD (e.g. "1 Mile Run") get their
    // full recent history shown, so the AI can spot trends rather than just a single data point.
    const focusPresetNames = new Set(
      flattenMovementNames(wodMeta)
        .map(name => matchPreset(name)?.name)
        .filter((name): name is string => !!name)
    )

    const entriesByName = new Map<string, { name: string; value: string; unit: string | null; recorded_on: string }[]>()
    for (const entry of profileHistory ?? []) {
      const list = entriesByName.get(entry.name) ?? []
      list.push(entry)
      entriesByName.set(entry.name, list)
    }

    const profileLines: string[] = []
    for (const [name, entries] of entriesByName) {
      if (focusPresetNames.has(name) && entries.length > 1) {
        const trend = entries
          .slice(0, PROFILE_TREND_CAP)
          .map(e => `${e.recorded_on}: ${e.value}${e.unit ? ' ' + e.unit : ''}`)
          .join(', ')
        profileLines.push(`- ${name} (storico recente): ${trend}`)
      } else {
        const latest = entries[0]
        profileLines.push(`- ${latest.name}: ${latest.value}${latest.unit ? ' ' + latest.unit : ''}`)
      }
    }

    const profileText = profileLines.length ? profileLines.join('\n') : 'Nessun dato disponibile.'

    const historyText = await buildResultHistoryText(supabase, user.id, wodMeta)

    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      tools: [RECOMMENDATION_TOOL],
      tool_choice: { type: 'tool', name: RECOMMENDATION_TOOL.name },
      messages: [{ role: 'user', content: PROMPT_TEMPLATE(workout.raw_text, profileText, historyText) }],
    })

    const toolUse = message.content.find(block => block.type === 'tool_use')
    const input = toolUse?.input as { recommendations?: string; expected_result?: string } | undefined

    if (!input?.recommendations || !input?.expected_result) {
      console.error('[wod-recommendation] unexpected response:', message.content)
      return Response.json({ error: 'Errore nel parsing della risposta AI' }, { status: 500 })
    }

    const recommendations = input.recommendations
    const expectedResult = input.expected_result

    const { data, error } = await supabase
      .from('wod_recommendations')
      .upsert(
        { user_id: user.id, workout_id, recommendations, expected_result: expectedResult },
        { onConflict: 'user_id,workout_id' }
      )
      .select('recommendations, expected_result')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[wod-recommendation]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
