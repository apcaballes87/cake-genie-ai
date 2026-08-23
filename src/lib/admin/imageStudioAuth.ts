import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { forwardStaffAuthHeaders, requireChatbotStaff } from '@/lib/chatbot/adminAuth';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export type VerifiedImageStudioAuth = {
  database: SupabaseClient;
  isPinAuth: boolean;
};

export async function verifyImageStudioAuth(req: NextRequest): Promise<{
  auth: VerifiedImageStudioAuth | null;
  error: string | null;
  status: number;
}> {
  const pinHeader = req.headers.get('x-admin-pin');
  if (pinHeader && pinHeader === ADMIN_IMAGE_STUDIO_PIN) {
    return {
      auth: {
        database: createAdminServerSupabaseClient(),
        isPinAuth: true,
      },
      error: null,
      status: 200,
    };
  }

  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (verified.staff) {
    return {
      auth: {
        database: verified.staff.database,
        isPinAuth: false,
      },
      error: null,
      status: 200,
    };
  }

  return {
    auth: null,
    error: verified.error || 'Authentication required',
    status: verified.status || 401,
  };
}

export function forwardImageStudioAuthHeaders(req: NextRequest): Record<string, string> {
  const pinHeader = req.headers.get('x-admin-pin');
  const staffHeaders = forwardStaffAuthHeaders(req);
  return {
    ...(pinHeader ? { 'x-admin-pin': pinHeader } : {}),
    ...staffHeaders,
  };
}
