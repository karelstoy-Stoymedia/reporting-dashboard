import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_creative_tags')
    .select('*')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { name, color } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('meta_creative_tags')
    .insert({ name: name.trim(), color: color ?? '#6366F1' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}