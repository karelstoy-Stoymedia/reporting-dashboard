import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params
  const body = await request.json()
  const { name, tier, source, notes } = body
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (tier !== undefined) updates.tier = tier
  if (source !== undefined) updates.source = source
  if (notes !== undefined) updates.notes = notes
  const { error } = await supabase.from('customers').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  // Cancel all active orders before deleting
  await supabase
    .from('customer_orders')
    .update({ status: 'cancelled' })
    .eq('customer_id', id)
    .eq('status', 'active')

  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}