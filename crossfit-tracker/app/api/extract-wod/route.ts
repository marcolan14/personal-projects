import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { WodMeta } from '@/lib/types'
import { todayISO } from '@/lib/dates'
import { NextRequest } from 'next/server'

type ImageInput = {
  imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'submit_wod',
  description: 'Registra il testo formattato del WOD e la sua struttura.',
  input_schema: {
    type: 'object',
    properties: {
      raw_text: { type: 'string', description: 'Testo completo del WOD formattato e leggibile.' },
      sections: {
        type: 'array',
        description: 'Le sezioni del WOD (es. strength, metcon).',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Nome sezione opzionale (es. Strength, Metcon, Part A).' },
            type: { type: 'string', description: "strength, for_time, amrap oppure emom. Usa 'strength' anche per schemi a intervallo fisso tipo 'ogni 1:30 per 7 round: 3 hang power clean (carico crescente)' — è comunque un lavoro di forza a set fissi, non un vero EMOM condizionamento. Usa 'emom' SOLO per formati cardio/conditioning a intervallo dove si registra il tempo o il completamento (es. 'EMOM 12: min pari 200m run, min dispari 15 burpee'), non per set di forza scanditi da un intervallo. Usa 'amrap' anche per un test a reps massime di UN SOLO movimento senza round (es. 'Max Power Cleans in 5 minuti', 'AMRAP 3 min: max reps power clean @ 60kg') — in questo caso metti il movimento in movements con max_reps=true e NON impostare 'rounds'; NON usare 'for_time' per questi test, perché il risultato è un numero di reps, non un tempo." },
            duration_min: { type: 'number', description: 'Durata in minuti (solo per amrap/emom, durata di ogni round se ce ne sono più di uno).' },
            rounds: { type: 'number', description: 'Numero di round/set fissi dichiarati per l\'INTERA sezione nel WOD (es. "5 SETS (2:00 AMRAP)" → 5, oppure "ogni 1:30 per 7 round" → 7). Usa SEMPRE questo campo (non "sets" sui movimenti) quando il numero di round è dichiarato a livello di sezione/intervallo. Ometti se non indicato.' },
            movements: {
              type: 'array',
              description: 'I movimenti della sezione. Usa un array vuoto se la sezione non ne elenca nessuno.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sets: { type: 'number', description: 'Numero di set — SOLO per un tradizionale schema di forza dichiarato sul singolo movimento (es. "5x5 back squat" → 5). Non usarlo se il numero di round è già in "rounds" a livello di sezione.' },
                  reps: { type: 'string', description: 'Es. "5" oppure "21-15-9".' },
                  weight_rx_kg: { type: 'number', description: 'Peso RX in kg.' },
                  weight_percent: { type: 'number', description: 'Es. 80 per 80% del massimale.' },
                  height_cm: { type: 'number', description: 'Per box jump.' },
                  distance_m: { type: 'number' },
                  calories: { type: 'number' },
                  max_reps: { type: 'boolean', description: 'true se il movimento è "Max reps"/"AMRAP" nel tempo rimanente del round (es. "Max Push Ups in the remaining time"), oppure se è l\'unico movimento di un test a reps massime senza round (es. "Max Power Cleans in 5 minuti").' },
                },
                required: ['name'],
              },
            },
          },
          required: ['type', 'movements'],
        },
      },
    },
    required: ['raw_text', 'sections'],
  },
}

const PROMPT = `Analizza queste immagini del WOD CrossFit e registra il testo e la struttura chiamando il tool "submit_wod". Converti sempre i pesi in kg. Includi solo i campi presenti nel WOD. Se il WOD ha più parti usa più elementi in sections.`

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: NextRequest) {
  try {
    const { images, date }: { images: ImageInput[]; date?: string } = await request.json()

    if (!images?.length) {
      return Response.json({ error: 'Nessuna immagine ricevuta' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const client = new Anthropic()

    const imageBlocks: Anthropic.ImageBlockParam[] = images.map(({ imageBase64, mediaType }) => ({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: imageBase64 },
    }))

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: EXTRACT_TOOL.name },
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: PROMPT }] }],
    })

    const toolUse = message.content.find(block => block.type === 'tool_use')
    const input = toolUse?.input as { raw_text?: string; sections?: WodMeta['sections'] } | undefined

    if (!input?.raw_text || !input?.sections) {
      console.error('[extract-wod] unexpected response:', message.content)
      return Response.json({ error: 'Errore nel parsing della risposta AI' }, { status: 500 })
    }

    const rawText = input.raw_text
    const wodMeta: WodMeta = { sections: input.sections }

    const today = todayISO()
    const targetDate = date && isoDateRe.test(date) && date <= today ? date : today

    const { data: workout, error: dbError } = await supabase
      .from('workouts')
      .upsert(
        { date: targetDate, raw_text: rawText, wod_meta: wodMeta },
        { onConflict: 'date' }
      )
      .select('id')
      .single()

    if (dbError) {
      return Response.json({ error: dbError.message }, { status: 500 })
    }

    return Response.json({ rawText, wodMeta, workoutId: workout.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore interno del server'
    console.error('[extract-wod]', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
