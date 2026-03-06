import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { name, tier, source, started_at, weekend_delivery, notes, lead_quota, order_price_per_lead, service_id } = body

  if (!name || !tier || !started_at || !lead_quota || !order_price_per_lead) {
    return NextResponse.json({ error: 'name, tier, started_at, lead_quota, order_price_per_lead are required' }, { status: 400 })
  }

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({ name, tier, source: source || null, started_at, notes: notes || null })
    .select('id')
    .single()

  if (custError) return NextResponse.json({ error: custError.message }, { status: 500 })

  const startsAt = started_at
  const endsAt = new Date(new Date(startsAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { error: orderError } = await supabase.from('customer_orders').insert({
    customer_id: customer.id,
    lead_quota,
    price_per_lead: order_price_per_lead,
    starts_at: startsAt,
    ends_at: endsAt,
    source: 'manual',
    is_renewal: false,
    weekend_delivery: weekend_delivery ?? false,
    service_id: service_id || null,
  })

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })
  return NextResponse.json({ success: true, customer_id: customer.id })
}