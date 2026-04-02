import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service role client for admin operations
const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get('merchant_id');
    const productId = searchParams.get('product_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('cakegenie_reviews')
      .select(`
        *,
        user:cakegenie_users(first_name, email)
      `)
      .eq('is_visible', true)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    if (productId) {
      query = query.eq('product_id', productId);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/reviews:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  try {
    const body = await request.json();
    const {
      orderId,
      orderItemId,
      userId,
      merchantId,
      productId,
      rating,
      title,
      comment,
      photos,
    } = body;

    // Validate required fields
    if (!orderId || !merchantId || !rating) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Verify the order is delivered
    const { data: order, error: orderError } = await supabaseAdmin
      .from('cakegenie_orders')
      .select('order_status, user_id')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.order_status !== 'delivered') {
      return NextResponse.json(
        { success: false, error: 'You can only review delivered orders' },
        { status: 400 }
      );
    }

    // Verify user owns this order
    if (order.user_id && userId && order.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You can only review your own orders' },
        { status: 403 }
      );
    }

    // Check if a review already exists for this order/item
    const { data: existingReview } = await supabaseAdmin
      .from('cakegenie_reviews')
      .select('review_id')
      .eq('order_id', orderId)
      .eq('order_item_id', orderItemId || null)
      .maybeSingle();

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: 'You have already reviewed this item' },
        { status: 409 }
      );
    }

    // Insert the review
    const { data, error } = await supabaseAdmin
      .from('cakegenie_reviews')
      .insert({
        order_id: orderId,
        order_item_id: orderItemId || null,
        user_id: userId || null,
        merchant_id: merchantId,
        product_id: productId || null,
        rating,
        title: title || null,
        comment: comment || null,
        photos: photos || [],
        is_approved: true,
        is_visible: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating review:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/reviews:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}