// src/app/api/pinterest/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // merchant_id
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error: `Pinterest auth failed: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  const redirectUri = process.env.PINTEREST_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Pinterest credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const tokens = await pinterestService.exchangeCodeForToken(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const refreshTokenExpiresAt = tokens.refresh_token_expires_in 
      ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
      : null;

    // Store tokens (singleton approach for now - upsert if we have a way to identify the app/owner)
    // For simplicity, we'll just store/update the latest one.
    const { error: upsertError } = await supabase
      .from('cakegenie_pinterest_tokens')
      .upsert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        scope: tokens.scope,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }); // This might need a better unique key if not singleton

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      throw new Error(`Failed to store Pinterest tokens: ${upsertError.message}`);
    }
    
    return NextResponse.json({
      message: 'Successfully connected to Pinterest!',
      merchant_id: state
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
