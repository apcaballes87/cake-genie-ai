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

    // In a real app, you would store tokens.access_token and tokens.refresh_token 
    // in the database associated with the merchantId (state).
    
    // For now, we'll return a success message with the tokens (DANGEROUS but for demo/user confirmation)
    // and a instruction to the user on how to proceed.
    
    return NextResponse.json({
      message: 'Successfully connected to Pinterest!',
      merchant_id: state,
      // tokens: tokens // Hide tokens in production
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
