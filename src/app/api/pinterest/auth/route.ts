// src/app/api/pinterest/auth/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';

export async function GET(request: Request) {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const redirectUri = process.env.PINTEREST_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error('Pinterest credentials missing:', { clientId: !!clientId, redirectUri: !!redirectUri });
    return NextResponse.json(
      { error: 'Pinterest credentials not configured' },
      { status: 500 }
    );
  }

  // State parameter for CSRF protection
  const state = crypto.randomUUID();

  const authUrl = pinterestService.getAuthUrl(clientId, redirectUri, state);
  
  return NextResponse.redirect(authUrl);
}
