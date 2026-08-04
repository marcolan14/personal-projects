import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { WodMeta } from '@/lib/types'
import { todayISO } from '@/lib/dates'
import { NextRequest } from 'next/server'

type ImageInput = {
  imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

const PROMPT = `Analizza queste immagini del WOD CrossFit. Restituisci SOLO un oggetto JSON valido (niente markdown, niente backtick, niente testo prima o dopo):
{
  "raw_text": "testo completo del WOD formattato e leggibile",
  "meta": {
    "sections": [
      {
        "label": "nome sezione opzionale (es. Strength, Metcon, Part A)",
        "type": "strength oppure for_time oppure amrap oppure emom. Usa 'strength' anche per schemi a intervallo fisso tipo 'ogni 1:30 per 7 round: 3 hang power clean (carico crescente)' — è comunque un lavoro di forza a set fissi, non un vero EMOM condizionamento. Usa 'emom' SOLO per formati cardio/conditioning a intervallo dove si registra il tempo o il completamento (es. 'EMOM 12: min pari 200m run, min dispari 15 burpee'), non per set di forza scanditi da un intervallo.",
        "duration_min": numero (solo per amrap/emom, durata di ogni round se ce ne sono più di uno),
        "rounds": numero di round/set fissi dichiarati per l'INTERA sezione nel WOD (es. "5 SETS (2:00 AMRAP)" → 5, oppure "ogni 1:30 per 7 round" → 7). Usa SEMPRE questo campo (non "sets" sui movimenti) quando il numero di round è dichiarato a livello di sezione/intervallo. Ometti se non indicato,
        "movements": [
          {
            "name": "nome del movimento",
            "sets": numero di set — SOLO per un tradizionale schema di forza dichiarato sul singolo movimento (es. "5x5 back squat" → 5). Non usarlo se il numero di round è già in "rounds" a livello di sezione,
            "reps": "5" oppure "21-15-9",
            "weight_rx_kg": numero in kg,
            "weight_percent": numero (es. 80 per 80% del massimale),
            "height_cm": numero (per box jump),
            "distance_m": numero,
            "calories": numero,
            "max_reps": true se il movimento è "Max reps"/"AMRAP" nel tempo rimanente del round (es. "Max Push Ups in the remaining time"), altrimenti ometti il campo
          }
        ]
      }
    ]
  }
}
Includi solo i campi presenti nel WOD. Converti sempre i pesi in kg. Per WOD con più parti usa più elementi in sections.`

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
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: PROMPT }] }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let rawText: string
    let wodMeta: WodMeta | null

    // Claude may wrap JSON in markdown code fences despite instructions
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    try {
      const parsed = JSON.parse(cleaned)
      rawText = parsed.raw_text ?? responseText
      wodMeta = parsed.meta ?? null
    } catch {
      rawText = responseText
      wodMeta = null
    }

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
