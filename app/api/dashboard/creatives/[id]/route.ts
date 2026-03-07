import { getCreativeDetail } from '@/lib/queries/creatives'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const creative = await getCreativeDetail(id)
    return NextResponse.json(creative, {
      headers: { 'Cache-Control': 's-maxage=60' }
    })
  } catch (err) {
    console.error('Creative detail error:', err)
    return NextResponse.json({ error: 'Creative not found' }, { status: 404 })
  }
}