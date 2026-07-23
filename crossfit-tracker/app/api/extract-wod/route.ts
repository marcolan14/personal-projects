import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { WodMeta } from '@/lib/types'
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
        "type": "strength oppure for_time oppure amrap oppure emom",
        "duration_min": numero (solo per amrap/emom),
        "movements": [
          {
            "name": "nome del movimento",
            "sets": numero (solo per strength),
            "reps": "5" oppure "21-15-9",
            "weight_rx_kg": numero in kg,
            "weight_percent": numero (es. 80 per 80% del massimale),
            "height_cm": numero (per box jump),
            "distance_m": numero,
            "calories": numero
          }
        ]
      }
    ]
  }
}
Includi solo i campi presenti nel WOD. Converti sempre i pesi in kg. Per WOD con più parti usa più elementi in sections.`

export async function POST(request: NextRequest) {
  try {
    const { images }: { images: ImageInput[] } = await request.json()

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

    const today = new Date().toISOString().split('T')[0]

    const { data: workout, error: dbError } = await supabase
      .from('workouts')
      .upsert(
        { date: today, raw_text: rawText, wod_meta: wodMeta },
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
