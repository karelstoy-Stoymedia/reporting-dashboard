import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function validateSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-webhook-secret')
  return secret === process.env.WEBHOOK_SECRET
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!validateSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path } = await params
  const route = path.join('/')
  const body = await request.json()
  const supabase = createServiceClient()

  try {
    switch (route) {

      // ── leads/new ────────────────────────────────────────────────────────
      case 'leads/new': {
        const {
          full_name, source_type, platform_slug, channel_slug,
          external_ref, phone, email, is_qualified, assigned_rep_slug, created_at
        } = body

        if (!full_name || !source_type) {
          return NextResponse.json({ error: 'full_name and source_type are required' }, { status: 400 })
        }

        let platform_id = null
        let channel_id = null

        if (source_type === 'ad' && platform_slug) {
          const { data: platform } = await supabase
            .from('ad_platforms')
            .select('id')
            .eq('slug', platform_slug)
            .single()
          platform_id = platform?.id ?? null
        }

        if (source_type === 'outbound' && channel_slug) {
          const { data: channel } = await supabase
            .from('outbound_channels')
            .select('id')
            .eq('slug', channel_slug)
            .single()
          channel_id = channel?.id ?? null
        }

        let assigned_rep_id = null
        if (assigned_rep_slug) {
          const { data: rep } = await supabase
            .from('sales_reps')
            .select('id')
            .eq('slug', assigned_rep_slug)
            .single()
          assigned_rep_id = rep?.id ?? null
        }

        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .insert({
            full_name,
            source_type,
            platform_id,
            channel_id,
            external_ref: external_ref ?? null,
            phone: phone ?? null,
            email: email ?? null,
            is_qualified: is_qualified ?? null,
            assigned_rep_id,
            created_at: created_at ?? new Date().toISOString(),
            last_event_at: created_at ?? new Date().toISOString(),
          })
          .select('id')
          .single()

        if (leadError) throw leadError

        await supabase.from('lead_journey_events').insert({
          lead_id: lead.id,
          event_type: 'new_lead',
          event_at: created_at ?? new Date().toISOString(),
        })

        return NextResponse.json({ lead_id: lead.id })
      }

      // ── leads/update ─────────────────────────────────────────────────────
      case 'leads/update': {
        const { lead_id, external_ref, is_qualified, assigned_rep_slug, status } = body

        if (!lead_id && !external_ref) {
          return NextResponse.json({ error: 'lead_id or external_ref required' }, { status: 400 })
        }

        let query = supabase.from('leads').select('id').limit(1)
        if (lead_id) query = query.eq('id', lead_id)
        else query = query.eq('external_ref', external_ref)

        const { data: lead } = await query.single()
        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

        const updates: Record<string, unknown> = { last_event_at: new Date().toISOString() }
        if (is_qualified !== undefined) updates.is_qualified = is_qualified
        if (status) updates.status = status

        if (assigned_rep_slug) {
          const { data: rep } = await supabase
            .from('sales_reps')
            .select('id')
            .eq('slug', assigned_rep_slug)
            .single()
          if (rep) updates.assigned_rep_id = rep.id
        }

        await supabase.from('leads').update(updates).eq('id', lead.id)
        await supabase.from('lead_journey_events').insert({
          lead_id: lead.id,
          event_type: 'contacted',
          event_at: new Date().toISOString(),
        })

        return NextResponse.json({ success: true })
      }

      // ── leads/booking ────────────────────────────────────────────────────
      case 'leads/booking': {
        const { lead_id, external_ref, rep_slug, call_number, booked_at, scheduled_at } = body

        if (!rep_slug || !call_number) {
          return NextResponse.json({ error: 'rep_slug and call_number are required' }, { status: 400 })
        }

        let query = supabase.from('leads').select('id, created_at').limit(1)
        if (lead_id) query = query.eq('id', lead_id)
        else if (external_ref) query = query.eq('external_ref', external_ref)
        else return NextResponse.json({ error: 'lead_id or external_ref required' }, { status: 400 })

        const { data: lead } = await query.single()
        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

        const { data: rep } = await supabase
          .from('sales_reps')
          .select('id')
          .eq('slug', rep_slug)
          .single()
        if (!rep) return NextResponse.json({ error: 'Rep not found' }, { status: 404 })

        const bookedTime = booked_at ? new Date(booked_at) : new Date()
        const leadCreated = new Date(lead.created_at)
        const diffSeconds = (bookedTime.getTime() - leadCreated.getTime()) / 1000
        const isSelfSet = diffSeconds <= 180

        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            lead_id: lead.id,
            rep_id: rep.id,
            call_number,
            booked_at: bookedTime.toISOString(),
            scheduled_at: scheduled_at ?? null,
          })
          .select('id')
          .single()

        if (bookingError) throw bookingError

        await supabase.from('leads').update({ last_event_at: new Date().toISOString() }).eq('id', lead.id)

        const eventType = call_number === 1 ? 'first_appointment_set' : 'second_appointment_set'
        await supabase.from('lead_journey_events').insert({
          lead_id: lead.id,
          event_type: eventType,
          event_at: bookedTime.toISOString(),
          metadata: { booking_id: booking.id, is_self_set: isSelfSet },
        })

        return NextResponse.json({ success: true, booking_id: booking.id, is_self_set: isSelfSet })
      }

      // ── leads/call-outcome ───────────────────────────────────────────────
      case 'leads/call-outcome': {
        const {
          lead_id, external_ref, call_number, showed, outcome,
          cash_collected, revenue, recording_url, call_duration_seconds,
          notes, is_qualified, offer_made,
          customer_name, customer_tier, lead_quota, price_per_lead, order_starts_at
        } = body

        if (!call_number || showed === undefined) {
          return NextResponse.json({ error: 'call_number and showed are required' }, { status: 400 })
        }

        let query = supabase.from('leads').select('id').limit(1)
        if (lead_id) query = query.eq('id', lead_id)
        else if (external_ref) query = query.eq('external_ref', external_ref)
        else return NextResponse.json({ error: 'lead_id or external_ref required' }, { status: 400 })

        const { data: lead } = await query.single()
        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

        // Update booking
        const bookingUpdates: Record<string, unknown> = {
          showed, updated_at: new Date().toISOString()
        }
        if (outcome) bookingUpdates.outcome = outcome
        if (cash_collected !== undefined) bookingUpdates.cash_collected = cash_collected
        if (revenue !== undefined) bookingUpdates.revenue = revenue
        if (recording_url) bookingUpdates.recording_url = recording_url
        if (call_duration_seconds !== undefined) bookingUpdates.call_duration_seconds = call_duration_seconds
        if (notes) bookingUpdates.notes = notes
        if (is_qualified !== undefined) bookingUpdates.is_qualified = is_qualified
        if (offer_made !== undefined) bookingUpdates.offer_made = offer_made

        await supabase.from('bookings')
          .update(bookingUpdates)
          .eq('lead_id', lead.id)
          .eq('call_number', call_number)

        // Update lead status
        const isClosed = outcome === 'full_pay' || outcome === 'split_pay'
        const leadUpdates: Record<string, unknown> = { last_event_at: new Date().toISOString() }
        if (isClosed) leadUpdates.status = 'closed_won'
        if (outcome === 'unqualified' || outcome === 'no_show') leadUpdates.status = 'closed_lost'
        await supabase.from('leads').update(leadUpdates).eq('id', lead.id)

        // Journey event
        let eventType = showed ? `first_appointment_showed` : `first_appointment_no_show`
        if (call_number === 2) eventType = showed ? 'second_appointment_showed' : 'second_appointment_no_show'
        if (isClosed && call_number === 1) eventType = 'closed_won_first_call'
        if (isClosed && call_number === 2) eventType = 'closed_won_second_call'
        if (isClosed && call_number >= 3) eventType = 'closed_won_followup'
        if (outcome === 'unqualified') eventType = 'disqualified'

        await supabase.from('lead_journey_events').insert({
          lead_id: lead.id,
          event_type: eventType,
          event_at: new Date().toISOString(),
          metadata: { outcome, revenue, cash_collected },
        })

        // If deal closed → upsert customer + create order
        if (isClosed && customer_name && lead_quota && price_per_lead) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', customer_name)
            .single()

          let customerId = existingCustomer?.id

          if (!customerId) {
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                name: customer_name,
                tier: customer_tier ?? 'retainer',
                price_per_lead,
                started_at: order_starts_at ?? new Date().toISOString().split('T')[0],
              })
              .select('id')
              .single()
            customerId = newCustomer?.id
          }

          if (customerId) {
            const startsAt = order_starts_at ?? new Date().toISOString().split('T')[0]
            const endsAt = new Date(new Date(startsAt).getTime() + 30 * 24 * 60 * 60 * 1000)
              .toISOString().split('T')[0]

            await supabase.from('customer_orders').insert({
              customer_id: customerId,
              lead_quota,
              price_per_lead,
              starts_at: startsAt,
              ends_at: endsAt,
              source: 'webhook',
            })
          }
        }

        return NextResponse.json({ success: true })
      }

      // ── customers/new-order ──────────────────────────────────────────────
      case 'customers/new-order': {
        const {
          customer_id, customer_name, lead_quota, price_per_lead,
          order_starts_at, end_current_order, notes
        } = body

        if (!lead_quota || !price_per_lead) {
          return NextResponse.json({ error: 'lead_quota and price_per_lead are required' }, { status: 400 })
        }

        let customerId = customer_id
        if (!customerId && customer_name) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', customer_name)
            .single()
          customerId = customer?.id
        }
        if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

        if (end_current_order) {
          await supabase
            .from('customer_orders')
            .update({ status: 'cancelled' })
            .eq('customer_id', customerId)
            .eq('status', 'active')
        }

        const startsAt = order_starts_at ?? new Date().toISOString().split('T')[0]
        const endsAt = new Date(new Date(startsAt).getTime() + 30 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0]

        await supabase.from('customer_orders').insert({
          customer_id: customerId,
          lead_quota,
          price_per_lead,
          starts_at: startsAt,
          ends_at: endsAt,
          source: 'webhook',
          notes: notes ?? null,
        })

        return NextResponse.json({ success: true })
      }

      // ── fulfilment/lead-sold ─────────────────────────────────────────────
      case 'fulfilment/lead-sold': {
        const { customer_id, customer_name, service_slug, lead_price, lead_cost, event_date } = body

        if (!service_slug || !lead_price || !lead_cost) {
          return NextResponse.json({ error: 'service_slug, lead_price, lead_cost are required' }, { status: 400 })
        }

        const { data: service } = await supabase
          .from('services')
          .select('id')
          .eq('slug', service_slug)
          .single()
        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

        let customerId = customer_id
        if (!customerId && customer_name) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', customer_name)
            .single()
          customerId = customer?.id
        }
        if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

        // FIFO — find oldest active unfulfilled order
        const { data: orders } = await supabase
          .from('customer_orders')
          .select('id, lead_quota')
          .eq('customer_id', customerId)
          .eq('status', 'active')
          .order('starts_at', { ascending: true })

        let orderId = null

        if (orders && orders.length > 0) {
          for (const order of orders) {
            // Count leads already delivered to this order
            const { count } = await supabase
              .from('lead_events')
              .select('id', { count: 'exact', head: true })
              .eq('order_id', order.id)
              .eq('event_type', 'lead_sold')

            const delivered = count ?? 0

            if (delivered < order.lead_quota) {
              orderId = order.id

              // If this lead fills the quota → mark order fulfilled
              if (delivered + 1 >= order.lead_quota) {
                await supabase
                  .from('customer_orders')
                  .update({ status: 'fulfilled' })
                  .eq('id', order.id)
              }
              break
            }
          }
        }

        // Insert lead event with order reference
        await supabase.from('lead_events').insert({
          service_id: service.id,
          customer_id: customerId,
          order_id: orderId,
          event_type: 'lead_sold',
          event_date: event_date ?? new Date().toISOString().split('T')[0],
          lead_price,
          lead_cost,
        })

        return NextResponse.json({ success: true, order_id: orderId })
      }

      // ── fulfilment/lead-returned ─────────────────────────────────────────
      case 'fulfilment/lead-returned': {
        const { customer_id, customer_name, service_slug, lead_price, lead_cost } = body

        const { data: service } = await supabase
          .from('services')
          .select('id')
          .eq('slug', service_slug)
          .single()
        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

        let customerId = customer_id
        if (!customerId && customer_name) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', customer_name)
            .single()
          customerId = customer?.id
        }

        await supabase.from('lead_events').insert({
          service_id: service.id,
          customer_id: customerId ?? null,
          event_type: 'lead_returned',
          event_date: new Date().toISOString().split('T')[0],
          lead_price,
          lead_cost,
        })

        return NextResponse.json({ success: true })
      }

      // ── fulfilment/daily-spend ───────────────────────────────────────────
      case 'fulfilment/daily-spend': {
        const { service_slug, event_date, adspend } = body

        const { data: service } = await supabase
          .from('services')
          .select('id')
          .eq('slug', service_slug)
          .single()
        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

        await supabase.from('lead_events').insert({
          service_id: service.id,
          event_type: 'adspend_daily',
          event_date,
          lead_price: adspend,
        })

        return NextResponse.json({ success: true })
      }

      // ── ads/daily-spend ──────────────────────────────────────────────────
      case 'ads/daily-spend': {
        const { platform_slug, event_date, adspend, leads } = body

        const { data: platform } = await supabase
          .from('ad_platforms')
          .select('id')
          .eq('slug', platform_slug)
          .single()
        if (!platform) return NextResponse.json({ error: 'Platform not found' }, { status: 404 })

        await supabase.from('ad_events').upsert({
          platform_id: platform.id,
          event_date,
          adspend,
          leads,
        }, { onConflict: 'platform_id,event_date' })

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown webhook route' }, { status: 404 })
    }
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}