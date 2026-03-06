import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'abandoned' })
    .eq('status', 'active')
    .lt('last_event_at', new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString())
    .select('id')

  if (error) {
    console.error('Abandoned leads error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`Marked ${data?.length ?? 0} leads as abandoned`)
  return new Response(JSON.stringify({ marked: data?.length ?? 0 }), { status: 200 })
})