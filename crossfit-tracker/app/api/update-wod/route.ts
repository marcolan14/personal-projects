import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { WodMeta } from '@/lib/types'
import { NextRequest } from 'next/server'

const STRUCTURE_TOOL: Anthropic.Tool = {
  name: 'submit_wod_structure',
  description: 'Registra la struttura del WOD estratta dal testo.',
  input_schema: {
    type: 'object',
    properties: {
      sections: {
        type: 'array',
        description: 'Le sezioni del WOD (es. strength, metcon).',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Nome sezione opzionale (es. Strength, Metcon, Part A).' },
            type: { type: 'string', description: 'strength, for_time, amrap oppure emom.' },
            duration_min: { type: 'number', description: 'Durata in minuti (solo per amrap/emom, durata di ogni round se ce ne sono più di uno).' },
            rounds: { type: 'number', description: 'Numero di round/set fissi dichiarati nel WOD (es. "5 SETS (2:00 AMRAP)" → 5). Ometti se non è indicato un numero fisso di round.' },
            movements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sets: { type: 'number', description: 'Solo per strength.' },
                  reps: { type: 'string', description: 'Es. "5" oppure "21-15-9".' },
                  weight_rx_kg: { type: 'number', description: 'Peso RX in kg.' },
                  weight_percent: { type: 'number', description: 'Es. 80 per 80% del massimale.' },
                  height_cm: { type: 'number', description: 'Per box jump.' },
                  distance_m: { type: 'number' },
                  calories: { type: 'number' },
                  max_reps: { type: 'boolean', description: 'true se il movimento è "Max reps"/"AMRAP" nel tempo rimanente del round (es. "Max Push Ups in the remaining time").' },
                },
                required: ['name'],
              },
            },
          },
          required: ['type', 'movements'],
        },
      },
    },
    required: ['sections'],
  },
}

const STRUCTURE_PROMPT = (rawText: string) => `Analizza questo WOD CrossFit ed estrai la struttura chiamando il tool "submit_wod_structure". Converti sempre i pesi in kg. Includi solo i campi presenti nel testo.

${rawText}`

export async function PATCH(request: NextRequest) {
  try {
    const { workout_id, raw_text } = await request.json()

    if (!workout_id || !raw_text?.trim()) {
      return Response.json({ error: 'Dati mancanti' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const trimmed = raw_text.trim()

    // Re-derive the structured movements from the edited text, so the results
    // form (which reads wod_meta, not raw_text) reflects the user's edit too.
    let wodMeta: WodMeta | null = null
    try {
      const client = new Anthropic()
      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        tools: [STRUCTURE_TOOL],
        tool_choice: { type: 'tool', name: STRUCTURE_TOOL.name },
        messages: [{ role: 'user', content: STRUCTURE_PROMPT(trimmed) }],
      })
      const toolUse = message.content.find(block => block.type === 'tool_use')
      const input = toolUse?.input as WodMeta | undefined
      if (input?.sections?.length) wodMeta = input
    } catch (aiErr) {
      console.error('[update-wod] structure re-extraction failed:', aiErr)
    }

    const updatePayload: { raw_text: string; wod_meta?: WodMeta } = { raw_text: trimmed }
    if (wodMeta) updatePayload.wod_meta = wodMeta

    const { data, error } = await supabase
      .from('workouts')
      .update(updatePayload)
      .eq('id', workout_id)
      .select('raw_text, wod_meta')
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[update-wod]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
