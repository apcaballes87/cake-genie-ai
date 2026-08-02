import type { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export type ChatbotStaffRole = 'owner' | 'admin' | 'support' | 'knowledge_editor';

export type VerifiedChatbotStaff = {
  user: User;
  role: ChatbotStaffRole;
  database: SupabaseClient;
};

export function adminCorsHeaders(
  request: NextRequest,
  methods: readonly string[],
): HeadersInit {
  const configuredOrigin = process.env.ADMIN_DASHBOARD_ORIGIN?.trim();
  const requestOrigin = request.headers.get('origin');
  const allowedOrigin = configuredOrigin || request.nextUrl.origin;
  const allowRequestOrigin = !requestOrigin || requestOrigin === allowedOrigin;

  return {
    ...(allowRequestOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': [...methods, 'OPTIONS'].join(', '),
    Vary: 'Origin',
  };
}

export function forwardStaffAuthHeaders(request: NextRequest): Record<string, string> {
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  return {
    ...(authorization ? { Authorization: authorization } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

export async function requireChatbotStaff(
  request: NextRequest,
  allowedRoles: readonly ChatbotStaffRole[] = ['owner', 'admin', 'support', 'knowledge_editor'],
): Promise<{ staff: VerifiedChatbotStaff | null; error: string | null; status: number }> {
  const database = createAdminServerSupabaseClient();
  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
  const userResult = bearerToken
    ? await database.auth.getUser(bearerToken)
    : await (await createServerSupabaseClient()).auth.getUser();
  const user = userResult.data.user;

  if (userResult.error || !user) {
    return { staff: null, error: 'Authentication required', status: 401 };
  }

  const { data: staffRow, error } = await database
    .from('chatbot_admin_staff')
    .select('user_id, role, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (error || !staffRow || !allowedRoles.includes(staffRow.role as ChatbotStaffRole)) {
    return { staff: null, error: 'Insufficient permissions', status: 403 };
  }

  return {
    staff: { user, role: staffRow.role as ChatbotStaffRole, database },
    error: null,
    status: 200,
  };
}
