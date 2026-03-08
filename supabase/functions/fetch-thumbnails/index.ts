// supabase/functions/fetch-thumbnails/index.ts
// Deno runtime — can reach Meta CDN (scontent-*.xx.fbcdn.net) freely
// Vercel serverless cannot reach this domain — that's why this lives here

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreativeInput {
  id: string           // UUID in meta_creatives
  meta_ad_id: string   // e.g. "120210..."
  ad_account_id: string // e.g. "act_123456789"
  thumbnail_url: string // Meta CDN URL
}

interface Result {
  processed: number
  failed: number
  errors: string[]
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth check — require service role key
  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { creatives: CreativeInput[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { creatives } = body
  if (!Array.isArray(creatives) || creatives.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, failed: 0, errors: ['No creatives provided'] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey ?? ''
  )

  const result: Result = { processed: 0, failed: 0, errors: [] }

  // Process creatives sequentially to avoid overwhelming Meta CDN or Supabase Storage
  for (const creative of creatives) {
    const storagePath = `${creative.ad_account_id}/${creative.meta_ad_id}.jpg`

    try {
      // 1. Fetch from Meta CDN — Deno can reach fbcdn.net freely
      const fetchRes = await fetch(creative.thumbnail_url, {
        headers: {
          // Mimic a browser request to avoid Meta CDN blocks
          'User-Agent': 'Mozilla/5.0 (compatible; StorageBot/1.0)',
        },
      })

      if (!fetchRes.ok) {
        throw new Error(`Meta CDN returned ${fetchRes.status} for ${creative.meta_ad_id}`)
      }

      const contentType = fetchRes.headers.get('content-type') ?? 'image/jpeg'
      const buffer = await fetchRes.arrayBuffer()

      if (buffer.byteLength === 0) {
        throw new Error(`Empty response from Meta CDN for ${creative.meta_ad_id}`)
      }

      // 2. Upload to Supabase Storage — upsert so re-runs are safe
      const { error: uploadError } = await supabase.storage
        .from('creative-thumbnails')
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        })

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      // 3. Update meta_creatives.thumbnail_path with the permanent storage path
      //    (not a signed URL — signed URLs are generated at query time)
      const { error: updateError } = await supabase
        .from('meta_creatives')
        .update({ thumbnail_path: storagePath })
        .eq('id', creative.id)

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`)
      }

      result.processed++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      result.failed++
      result.errors.push(`[${creative.meta_ad_id}] ${message}`)
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})