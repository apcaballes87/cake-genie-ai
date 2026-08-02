import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

import { requireChatbotStaff, type ChatbotStaffRole } from '@/lib/chatbot/adminAuth';
import { getChatImageObjectPath, isStaffAttachmentPath } from '@/lib/chatbot/attachments';
import { CHATBOT_OUTPUT_MAX_LENGTH } from '@/lib/chatbot/types';

type RouteContext = { params: Promise<{ path?: string[] }> };

const CORS_HEADERS = {
  ...(process.env.ADMIN_DASHBOARD_ORIGIN?.trim()
    ? { 'Access-Control-Allow-Origin': process.env.ADMIN_DASHBOARD_ORIGIN.trim() }
    : process.env.NODE_ENV === 'development'
      ? { 'Access-Control-Allow-Origin': 'http://localhost:5173' }
      : {}),
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  Vary: 'Origin',
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function auth(request: NextRequest, roles?: readonly ChatbotStaffRole[]) {
  return requireChatbotStaff(request, roles);
}

async function audit(
  database: NonNullable<Awaited<ReturnType<typeof requireChatbotStaff>>['staff']>['database'],
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeState: unknown = {},
  afterState: unknown = {},
  metadata: unknown = {},
) {
  const { error } = await database.from('chatbot_audit_log').insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_state: beforeState,
    after_state: afterState,
    metadata,
  });
  if (error) console.error('[chatbot-admin] Audit insert failed:', error);
}

type AdminChatMessage = { image_url?: string | null; [key: string]: unknown };

async function signMessageAttachments(database: SupabaseClient, messages: AdminChatMessage[]) {
  return Promise.all(messages.map(async (message) => {
    const objectPath = getChatImageObjectPath(message.image_url);
    if (!objectPath) return { ...message, image_url: null };
    const { data } = await database.storage.from('chat-images').createSignedUrl(objectPath, 3_600);
    return { ...message, image_url: data?.signedUrl || null, attachment_reference: objectPath };
  }));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path ?? [];
  const chatRead = path[0] === 'conversations';
  const knowledgeRead = path[0] === 'business-profile' || path[0] === 'knowledge';
  const verified = await auth(request, chatRead
    ? ['owner', 'admin', 'support']
    : knowledgeRead
      ? ['owner', 'admin', 'knowledge_editor']
      : ['owner', 'admin', 'support', 'knowledge_editor']);
  if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
  const { database } = verified.staff;

  if (path.length === 0 || path[0] === 'settings') {
    const { data, error } = await database.from('chatbot_settings').select('*').eq('id', true).maybeSingle();
    if (error) return json({ success: false, error: 'Unable to load settings' }, 500);
    return json({ success: true, data: data ? {
      ...data,
      killSwitch: data.kill_switch,
      autoSendIntents: data.auto_send_intents,
      minConfidence: Number(data.min_confidence),
    } : null });
  }

  if (path[0] === 'conversations' && path.length === 1) {
    const status = new URL(request.url).searchParams.get('status');
    let query = database.from('chat_conversations').select('*').order('updated_at', { ascending: false }).limit(200);
    if (status && ['active', 'closed', 'archived'].includes(status)) query = query.eq('status', status);
    const { data, error } = await query;
    return error ? json({ success: false, error: 'Unable to load conversations' }, 500) : json({ success: true, data: data || [] });
  }

  if (path[0] === 'conversations' && path[2] === 'messages') {
    const { data, error } = await database.from('chat_messages').select('*')
      .eq('conversation_id', path[1]).order('created_at', { ascending: true });
    if (error) return json({ success: false, error: 'Unable to load messages' }, 500);
    return json({ success: true, data: await signMessageAttachments(database, data || []) });
  }

  if (path[0] === 'conversations' && path[2] === 'drafts') {
    const { data, error } = await database.from('chatbot_runs').select('*')
      .eq('conversation_id', path[1]).in('status', ['pending', 'generating', 'draft', 'handoff']).order('created_at', { ascending: true });
    return error ? json({ success: false, error: 'Unable to load drafts' }, 500) : json({ success: true, data: data || [] });
  }

  if (path[0] === 'business-profile') {
    const { data, error } = await database.from('chatbot_business_profile_versions').select('*').order('version', { ascending: false });
    return error ? json({ success: false, error: 'Unable to load business profiles' }, 500) : json({ success: true, data: data || [] });
  }

  if (path[0] === 'knowledge') {
    const { data, error } = await database.from('chatbot_knowledge_entries').select('*')
      .order('knowledge_key', { ascending: true }).order('version', { ascending: false });
    return error ? json({ success: false, error: 'Unable to load knowledge' }, 500) : json({ success: true, data: data || [] });
  }
  return json({ success: false, error: 'Not found' }, 404);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path ?? [];
  if (path[0] === 'settings') {
    const verified = await auth(request, ['owner', 'admin']);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const body = await request.json();
    const { database, user } = verified.staff;
    const { data: before } = await database.from('chatbot_settings').select('*').eq('id', true).maybeSingle();
    if (!before) return json({ success: false, error: 'Chatbot settings are unavailable' }, 500);
    const mode = body.mode ?? before.mode;
    const killSwitch = body.killSwitch ?? before.kill_switch;
    const autoSendIntents = body.autoSendIntents ?? before.auto_send_intents;
    if (!['draft', 'auto', 'off'].includes(mode) || typeof killSwitch !== 'boolean' || !Array.isArray(autoSendIntents)) {
      return json({ success: false, error: 'Invalid settings' }, 400);
    }
    if (mode === 'auto') {
      const requestedIntents = autoSendIntents.filter((item: unknown): item is string => typeof item === 'string');
      const rolloutStartedAt = before?.rollout_started_at ? new Date(before.rollout_started_at).getTime() : Number.NaN;
      const rolloutAgeMs = Date.now() - rolloutStartedAt;
      if (requestedIntents.length === 0 || !Number.isFinite(rolloutAgeMs) || rolloutAgeMs < 14 * 24 * 60 * 60 * 1_000) {
        return json({ success: false, error: 'Auto-send requires a 14-day draft rollout and at least one eligible intent.' }, 409);
      }
      const { data: reviewedRuns, error: reviewedError } = await database.from('chatbot_runs')
        .select('intent, status, draft_response, final_response, safety_flags')
        .gte('reviewed_at', before.rollout_started_at)
        .in('status', ['sent', 'rejected']);
      if (reviewedError || !reviewedRuns || reviewedRuns.length < 100) {
        return json({ success: false, error: 'Auto-send requires at least 100 reviewed drafts.' }, 409);
      }
      const criticalFlags = new Set(['critical_safety', 'fabricated_fact', 'fabricated_price', 'order_status_claim', 'unauthorized_disclosure']);
      if (reviewedRuns.some((run) => (run.safety_flags || []).some((flag: string) => criticalFlags.has(flag)))) {
        return json({ success: false, error: 'Auto-send is blocked by a critical safety failure.' }, 409);
      }
      for (const intent of requestedIntents) {
        const intentRuns = reviewedRuns.filter((run) => run.intent === intent);
        const approvedWithoutEdit = intentRuns.filter((run) => run.status === 'sent' && run.final_response === run.draft_response).length;
        if (intentRuns.length === 0 || approvedWithoutEdit / intentRuns.length < 0.95) {
          return json({ success: false, error: `Intent ${intent} has not reached the 95% approval-without-edit threshold.` }, 409);
        }
      }
    }
    const { data, error } = await database.from('chatbot_settings').update({
      mode,
      kill_switch: killSwitch,
      auto_send_intents: autoSendIntents.filter((item: unknown) => typeof item === 'string').slice(0, 50),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq('id', true).select().single();
    if (error) return json({ success: false, error: 'Unable to update settings' }, 500);
    await audit(database, user.id, 'settings.update', 'chatbot_settings', null, before, data);
    return json({ success: true, data });
  }

  if (path[0] === 'conversations' && path[2] === 'status') {
    const verified = await auth(request, ['owner', 'admin', 'support']);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const body = await request.json();
    if (!['active', 'closed', 'archived'].includes(body.status)) return json({ success: false, error: 'Invalid status' }, 400);
    const { data, error } = await verified.staff.database.from('chat_conversations')
      .update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', path[1]).select().single();
    return error ? json({ success: false, error: 'Unable to update conversation' }, 500) : json({ success: true, data });
  }
  return json({ success: false, error: 'Not found' }, 404);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const path = (await context.params).path ?? [];
  const standardRoles: ChatbotStaffRole[] = ['owner', 'admin', 'support'];

  if (path[0] === 'conversations' && path[2] === 'attachments') {
    const verified = await auth(request, standardRoles);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const formData = await request.formData();
    const file = formData.get('file');
    const allowedTypes: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    if (!(file instanceof File) || !allowedTypes[file.type] || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return json({ success: false, error: 'Unsupported image type or size' }, 400);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height || metadata.width > 8_000 || metadata.height > 8_000) throw new Error('Invalid dimensions');
    } catch {
      return json({ success: false, error: 'Invalid image data' }, 400);
    }
    const reference = `staff/${path[1]}/${randomUUID()}.${allowedTypes[file.type]}`;
    const { database } = verified.staff;
    const { data: conversation } = await database.from('chat_conversations')
      .select('id').eq('id', path[1]).maybeSingle();
    if (!conversation) return json({ success: false, error: 'Conversation not found' }, 404);
    const { error } = await database.storage.from('chat-images').upload(reference, bytes, {
      contentType: file.type, cacheControl: '3600', upsert: false,
    });
    if (error) return json({ success: false, error: 'Unable to upload attachment' }, 500);
    const { data: signed } = await database.storage.from('chat-images').createSignedUrl(reference, 3_600);
    return json({ success: true, data: { reference, signedUrl: signed?.signedUrl || null } }, 201);
  }

  if (path[0] === 'runs' && (path[2] === 'approve' || path[2] === 'reject')) {
    const verified = await auth(request, standardRoles);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const { database, user } = verified.staff;
    const { data: run } = await database.from('chatbot_runs').select('*').eq('id', path[1]).maybeSingle();
    if (!run) return json({ success: false, error: 'Draft not found' }, 404);
    const body = await request.json();

    if (path[2] === 'reject') {
      if (!['draft', 'handoff'].includes(run.status)) return json({ success: false, error: 'Draft is no longer reviewable' }, 409);
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
      const { data, error } = await database.from('chatbot_runs').update({
        status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString(),
        error_code: reason ? 'staff_rejected' : null, error_message: reason || null,
      }).eq('id', run.id).in('status', ['draft', 'handoff']).select().single();
      if (error) return json({ success: false, error: 'Unable to reject draft' }, 409);
      await database.from('chatbot_feedback').insert({
        run_id: run.id,
        feedback_type: 'rejected',
        original_response: run.draft_response,
        edited_response: null,
        notes: reason || null,
        created_by: user.id,
      });
      await audit(database, user.id, 'run.reject', 'chatbot_run', run.id, run, data, { reason });
      return json({ success: true, data });
    }

    const answer = typeof body.answer === 'string' ? body.answer.trim().slice(0, CHATBOT_OUTPUT_MAX_LENGTH) : '';
    if (!answer) return json({ success: false, error: 'answer is required' }, 400);
    const { data, error } = await database.rpc('chatbot_approve_run', {
      p_run_id: run.id,
      p_answer: answer,
      p_reviewer_id: user.id,
    });
    if (error) {
      const conflict = /not found|no longer|not enabled|disabled/i.test(error.message || '');
      return json({ success: false, error: error.message || 'Unable to approve draft' }, conflict ? 409 : 500);
    }
    const result = data as { run?: unknown; message?: unknown; idempotent?: boolean } | null;
    return json({ success: true, data: result?.run ?? null, message: result?.message ?? null, idempotent: result?.idempotent === true });
  }

  if (path[0] === 'conversations' && ['takeover', 'reenable', 'mark-read'].includes(path[2])) {
    const verified = await auth(request, standardRoles);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const { database, user } = verified.staff;
    if (path[2] === 'mark-read') {
      const { error } = await database.from('chat_messages').update({ is_read: true })
        .eq('conversation_id', path[1]).eq('sender_type', 'customer').eq('is_read', false);
      return error ? json({ success: false, error: 'Unable to mark messages read' }, 500) : json({ success: true });
    }
    const body = path[2] === 'takeover' ? await request.json().catch(() => ({})) : {};
    const now = new Date().toISOString();
    const update = path[2] === 'takeover' ? {
      handoff_state: 'human',
      handoff_reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'staff_takeover',
      human_takeover_at: now,
    } : {
      handoff_state: 'assistant', handoff_reason: null, assistant_reenabled_at: now,
    };
    const { data, error } = await database.from('chat_conversations').update({ ...update, updated_at: now })
      .eq('id', path[1]).select().single();
    if (error) return json({ success: false, error: 'Unable to update handoff state' }, 500);
    if (path[2] === 'takeover') {
      await database.from('chatbot_runs').update({
        status: 'handoff',
        handoff_reason: 'staff_takeover',
        updated_at: now,
      }).eq('conversation_id', path[1]).in('status', ['pending', 'generating', 'draft']);
    }
    await audit(database, user.id, `conversation.${path[2]}`, 'chat_conversation', path[1], {}, data);
    return json({ success: true, data });
  }

  if (path[0] === 'conversations' && path[2] === 'messages') {
    const verified = await auth(request, standardRoles);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 2_000) : '';
    const attachmentReference = getChatImageObjectPath(typeof body.attachmentReference === 'string' ? body.attachmentReference : null);
    if (!content && !attachmentReference) return json({ success: false, error: 'content or attachmentReference is required' }, 400);
    if (attachmentReference && !isStaffAttachmentPath(attachmentReference, path[1])) {
      return json({ success: false, error: 'Invalid attachment reference' }, 400);
    }
    const { database } = verified.staff;
    const { data, error } = await database.from('chat_messages').insert({
      conversation_id: path[1], content, sender_type: 'merchant', is_read: true,
      client_message_id: typeof body.clientMessageId === 'string' ? body.clientMessageId : randomUUID(),
      image_url: attachmentReference,
    }).select().single();
    if (error) return json({ success: false, error: 'Unable to send message' }, 500);
    await database.from('chat_conversations').update({
      handoff_state: 'human', handoff_reason: 'staff_replied', human_takeover_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', path[1]);
    return json({ success: true, data });
  }

  if (path[0] === 'business-profile' && path.length === 1) {
    const verified = await auth(request, ['owner', 'admin', 'knowledge_editor']);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const body = await request.json();
    const draft = {
      name: body.name,
      legal_name: body.legal_name ?? null,
      address_line: body.address_line,
      hours_display: body.hours_display,
      operating_hours: body.operating_hours ?? [],
      support_email: body.support_email,
      phone_display: body.phone_display,
      phone_href: body.phone_href,
      map_url: body.map_url,
      service_area: body.service_area,
      valid_from: body.valid_from ?? null,
      valid_until: body.valid_until ?? null,
    };
    if (![draft.name, draft.address_line, draft.hours_display, draft.support_email, draft.phone_display, draft.phone_href, draft.map_url, draft.service_area]
      .every((value) => typeof value === 'string' && value.trim())) {
      return json({ success: false, error: 'Missing required business profile fields' }, 400);
    }
    const { data: latest } = await verified.staff.database.from('chatbot_business_profile_versions')
      .select('version').order('version', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await verified.staff.database.from('chatbot_business_profile_versions').insert({
      ...draft, version: (latest?.version || 0) + 1, status: 'draft', created_by: verified.staff.user.id,
    }).select().single();
    return error ? json({ success: false, error: 'Unable to create business profile draft' }, 500) : json({ success: true, data }, 201);
  }

  if (path[0] === 'business-profile' && path[2] === 'publish') {
    return publishVersioned(request, path[1], 'chatbot_business_profile_versions', ['owner', 'admin']);
  }

  if (path[0] === 'knowledge' && path.length === 1) {
    const verified = await auth(request, ['owner', 'admin', 'knowledge_editor']);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const body = await request.json();
    if (typeof body.knowledge_key !== 'string' || typeof body.answer !== 'string') return json({ success: false, error: 'knowledge_key and answer are required' }, 400);
    const { data: latest } = await verified.staff.database.from('chatbot_knowledge_entries').select('version')
      .eq('knowledge_key', body.knowledge_key).eq('locale', body.locale || 'en').order('version', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await verified.staff.database.from('chatbot_knowledge_entries').insert({
      knowledge_key: body.knowledge_key,
      category: body.category,
      locale: body.locale || 'en',
      question_patterns: Array.isArray(body.question_patterns) ? body.question_patterns.filter((item: unknown) => typeof item === 'string').slice(0, 50) : [],
      answer: body.answer.trim().slice(0, 4_000),
      source_links: Array.isArray(body.source_links) ? body.source_links.slice(0, 20) : [],
      valid_from: body.valid_from ?? null,
      valid_until: body.valid_until ?? null,
      version: (latest?.version || 0) + 1,
      status: 'draft',
      created_by: verified.staff.user.id,
    }).select().single();
    return error ? json({ success: false, error: 'Unable to create knowledge draft' }, 500) : json({ success: true, data }, 201);
  }

  if (path[0] === 'knowledge' && (path[2] === 'publish' || path[2] === 'archive')) {
    if (path[2] === 'publish') return publishVersioned(request, path[1], 'chatbot_knowledge_entries', ['owner', 'admin']);
    const verified = await auth(request, ['owner', 'admin', 'knowledge_editor']);
    if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
    const { data, error } = await verified.staff.database.from('chatbot_knowledge_entries').update({
      status: 'archived', published_at: null,
    }).eq('id', path[1]).select().single();
    if (error) return json({ success: false, error: 'Unable to archive knowledge' }, 500);
    await verified.staff.database.from('chatbot_audit_log').insert({
      actor_user_id: verified.staff.user.id, action: 'archive', entity_type: 'knowledge', entity_id: path[1], before_state: {}, after_state: data,
    });
    return json({ success: true, data });
  }

  return json({ success: false, error: 'Not found' }, 404);
}

async function publishVersioned(request: NextRequest, id: string, table: string, roles: readonly ChatbotStaffRole[]) {
  const verified = await auth(request, roles);
  if (!verified.staff) return json({ success: false, error: verified.error }, verified.status);
  const { database, user } = verified.staff;
  const functionName = table === 'chatbot_business_profile_versions'
    ? 'chatbot_publish_business_profile'
    : 'chatbot_publish_knowledge_entry';
  const idArgument = table === 'chatbot_business_profile_versions' ? 'p_profile_id' : 'p_entry_id';
  const { data, error } = await database.rpc(functionName, {
    [idArgument]: id,
    p_actor_user_id: user.id,
  });
  if (error) return json({ success: false, error: 'Unable to publish draft' }, 500);
  return json({ success: true, data });
}
