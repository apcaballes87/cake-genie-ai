import { NextResponse } from 'next/server';

function retiredResponse() {
  return NextResponse.json({
    success: false,
    error: 'This legacy admin chat endpoint is retired. Use /api/admin/chatbot/conversations instead.',
  }, { status: 410 });
}

export async function GET() {
  return retiredResponse();
}

export async function PATCH() {
  return retiredResponse();
}
