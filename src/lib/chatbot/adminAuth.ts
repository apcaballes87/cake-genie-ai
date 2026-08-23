import { createHash } from 'crypto';
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

export const DEFAULT_ADMIN_DASHBOARD_ORIGIN = 'https://genie-ph-admin-dashboard.vercel.app';

function getAllowedAdminOrigin() {
  return process.env.ADMIN_DASHBOARD_ORIGIN?.trim() || DEFAULT_ADMIN_DASHBOARD_ORIGIN;
}

export function getNetworkAdminIpHash(request: NextRequest): string | null {
  if (request.headers.get('origin') !== getAllowedAdminOrigin()) return null;
  const rawIp = request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || (process.env.NODE_ENV === 'development' ? request.headers.get('x-real-ip') : null);
  const ip = rawIp?.split(',')[0]?.trim();
  if (!ip || ip.length > 64) return null;
  return createHash('sha256').update(ip).digest('hex');
}

export function adminCorsHeaders(
  request: NextRequest,
  methods: readonly string[],
): HeadersInit {
  const requestOrigin = request.headers.get('origin');
  const allowedOrigin = getAllowedAdminOrigin();
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
  let userResult = bearerToken
    ? await database.auth.getUser(bearerToken)
    : await (await createServerSupabaseClient()).auth.getUser();
  let user = userResult.data.user;

  if (!user) {
    const ipHash = getNetworkAdminIpHash(request);
    if (ipHash) {
      const now = Date.now();
      const { data: networkRows } = await database
        .from('chatbot_admin_network_allowlist')
        .select('staff_user_id, expires_at')
        .eq('ip_sha256', ipHash)
        .eq('active', true)
        .limit(5);
      const networkAccess = networkRows?.find((row) => (
        !row.expires_at || new Date(row.expires_at).getTime() > now
      ));
      if (networkAccess?.staff_user_id) {
        const networkUserResult = await database.auth.admin.getUserById(networkAccess.staff_user_id);
        userResult = networkUserResult;
        user = networkUserResult.data.user;
      }
    }
  }

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
