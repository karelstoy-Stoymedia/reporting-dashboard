import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_ad_accounts')
    .select('*')
    .order('account_name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { account_id, account_name, bm_index } = body

  if (!account_id || !account_name || !bm_index) {
    return NextResponse.json({ error: 'account_id, account_name, and bm_index are required' }, { status: 400 })
  }
  if (![1, 2, 3].includes(Number(bm_index))) {
    return NextResponse.json({ error: 'bm_index must be 1, 2, or 3' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('meta_ad_accounts')
    .insert({ account_id, account_name, bm_index: Number(bm_index) })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}