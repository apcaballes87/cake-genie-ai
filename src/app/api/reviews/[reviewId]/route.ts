import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePublicReviewRecord, REVIEW_SELECT_WITH_ORDER_NUMBER } from '@/lib/reviews';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  try {
    const { reviewId } = await params;

    const { data, error } = await supabaseAdmin
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT_WITH_ORDER_NUMBER)
      .eq('review_id', reviewId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Review not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching review:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: normalizePublicReviewRecord(data) });
  } catch (err) {
    console.error('Unexpected error in GET /api/reviews/[reviewId]:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  try {
    const { reviewId } = await params;
    const body = await request.json();
    const { action, merchantId, isApproved, isVisible, merchantResponse } = body;

    // First, get the current review to verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('cakegenie_reviews')
      .select('merchant_id')
      .eq('review_id', reviewId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      );
    }

    // Verify merchant ownership if merchantId provided
    if (merchantId && existing.merchant_id !== merchantId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    switch (action) {
      case 'approve':
        if (isApproved !== undefined) {
          updates.is_approved = isApproved;
        }
        if (isVisible !== undefined) {
          updates.is_visible = isVisible;
        }
        break;

      case 'respond':
        if (!merchantResponse) {
          return NextResponse.json(
            { success: false, error: 'Response text is required' },
            { status: 400 }
          );
        }
        updates.merchant_response = merchantResponse;
        updates.merchant_response_at = new Date().toISOString();
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    const { data, error } = await supabaseAdmin
      .from('cakegenie_reviews')
      .update(updates)
      .eq('review_id', reviewId)
      .select(REVIEW_SELECT_WITH_ORDER_NUMBER)
      .single();

    if (error) {
      console.error('Error updating review:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: normalizePublicReviewRecord(data) });
  } catch (err) {
    console.error('Unexpected error in PATCH /api/reviews/[reviewId]:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
