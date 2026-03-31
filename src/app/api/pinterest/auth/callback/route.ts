// src/app/api/pinterest/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const baseUrl = new URL(request.url).origin;

  if (error) {
    const redirectUrl = new URL('/admin/pinterest', baseUrl);
    redirectUrl.searchParams.set('error', `Pinterest auth failed: ${error}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/admin/pinterest', baseUrl);
    redirectUrl.searchParams.set('error', 'No authorization code provided');
    return NextResponse.redirect(redirectUrl);
  }

  const clientId = process.env.PINTEREST_CLIENT_ID || process.env.NEXT_PUBLIC_PINTEREST_APP_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET || process.env.PINTEREST_APP_SECRET;
  const redirectUri = process.env.PINTEREST_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('Pinterest credentials missing:', {
      clientId: !!clientId,
      clientSecret: !!clientSecret,
      redirectUri: !!redirectUri
    });
    return NextResponse.json(
      { error: 'Pinterest configuration error' },
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

    // Fetch the authenticated Pinterest user's account info
    const userAccount = await pinterestService.getUserAccount(tokens.access_token);

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      });
      return NextResponse.json({
        error: 'Supabase configuration error'
      }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const refreshTokenExpiresAt = tokens.refresh_token_expires_in
      ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
      : null;

    // Delete any existing tokens first, then insert fresh (singleton pattern)
    await supabase.from('cakegenie_pinterest_tokens').delete().neq('id', 0);

    const { error: insertError } = await supabase
      .from('cakegenie_pinterest_tokens')
      .insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        scope: tokens.scope,
        pinterest_user_id: userAccount.id,
        pinterest_username: userAccount.username,
        pinterest_business_name: userAccount.business_name || null,
        pinterest_account_type: userAccount.account_type,
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Failed to store tokens:', insertError);
      throw new Error(`Failed to store Pinterest tokens: ${insertError.message}`);
    }

    // Redirect back to admin page with success message
    const redirectUrl = new URL('/admin/pinterest', baseUrl);
    redirectUrl.searchParams.set('success', `Connected as @${userAccount.username}${userAccount.business_name ? ` (${userAccount.business_name})` : ''}`);
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error('Pinterest OAuth callback error:', err);
    const redirectUrl = new URL('/admin/pinterest', baseUrl);
    redirectUrl.searchParams.set('error', err.message);
    return NextResponse.redirect(redirectUrl);
  }
}
