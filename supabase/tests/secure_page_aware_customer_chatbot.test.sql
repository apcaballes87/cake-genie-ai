BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET LOCAL search_path = public, extensions, pg_temp;

SELECT plan(53);

SELECT has_table('public', 'chatbot_admin_staff', 'staff registry exists');
SELECT has_table('public', 'chatbot_settings', 'chatbot settings exists');
SELECT has_table('public', 'chatbot_business_profile_versions', 'business profile versions exist');
SELECT has_table('public', 'chatbot_knowledge_entries', 'knowledge entries exist');
SELECT has_table('public', 'chatbot_runs', 'durable chatbot runs exist');
SELECT has_table('public', 'chatbot_feedback', 'chatbot feedback exists');
SELECT has_table('public', 'chatbot_audit_log', 'chatbot audit log exists');
SELECT has_table('public', 'chatbot_rate_limit_events', 'durable chatbot rate-limit events exist');

SELECT ok(
  (
    SELECT bool_and(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'chatbot_admin_staff',
        'chatbot_settings',
        'chatbot_business_profile_versions',
        'chatbot_knowledge_entries',
        'chatbot_runs',
        'chatbot_feedback',
        'chatbot_audit_log',
        'chatbot_rate_limit_events'
      )
  ),
  'RLS is enabled on every new public chatbot table'
);

SELECT ok(
  (
    SELECT pg_get_constraintdef(oid) LIKE '%assistant%'
    FROM pg_constraint
    WHERE conrelid = 'public.chat_messages'::regclass
      AND conname = 'chat_messages_sender_type_check'
  ),
  'chat messages accept the assistant sender type'
);

SELECT has_column('public', 'chat_messages', 'client_message_id', 'messages have an idempotency key');
SELECT has_column('public', 'chat_messages', 'reply_to_message_id', 'messages can link to the source message');
SELECT has_column('public', 'chat_messages', 'page_context', 'messages keep an immutable context snapshot');
SELECT has_column('public', 'chat_conversations', 'automation_mode', 'conversations have an automation override');
SELECT has_column('public', 'chat_conversations', 'handoff_state', 'conversations track handoff state');

SELECT ok(
  to_regclass('public.uq_chat_messages_conversation_client_message') IS NOT NULL,
  'conversation-scoped message idempotency index exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_conversations'
      AND policyname = 'chat_conversations_customer_select'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%auth.uid()%'
      AND qual NOT LIKE '%user_id IS NULL%'
  ),
  'conversation reads are restricted to the authenticated owner'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_customer_select'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%auth.uid()%'
  ),
  'message reads are restricted through authenticated conversation ownership'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_conversations'
      AND policyname = 'chat_conversations_staff_select'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%chatbot_admin_staff%'
      AND qual LIKE '%active%'
      AND qual LIKE '%owner%'
      AND qual LIKE '%admin%'
      AND qual LIKE '%support%'
  ),
  'only active owner, admin, or support staff can receive conversation Realtime rows'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_staff_select'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%chatbot_admin_staff%'
      AND qual LIKE '%active%'
      AND qual LIKE '%owner%'
      AND qual LIKE '%admin%'
      AND qual LIKE '%support%'
  ),
  'only active owner, admin, or support staff can receive message Realtime rows'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_conversations'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ),
  0,
  'customers have no direct conversation mutation policy'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ),
  0,
  'customers have no direct message mutation policy'
);

SELECT ok(NOT has_table_privilege('anon', 'public.chat_conversations', 'SELECT'), 'anon cannot read conversations');
SELECT ok(NOT has_table_privilege('anon', 'public.chat_messages', 'SELECT'), 'anon cannot read messages');
SELECT ok(has_table_privilege('authenticated', 'public.chat_conversations', 'SELECT'), 'authenticated users can subscribe to owned conversations');
SELECT ok(NOT has_table_privilege('authenticated', 'public.chat_conversations', 'INSERT'), 'authenticated users cannot directly create conversations');
SELECT ok(has_table_privilege('authenticated', 'public.chat_messages', 'SELECT'), 'authenticated users can subscribe to owned messages');
SELECT ok(NOT has_table_privilege('authenticated', 'public.chat_messages', 'INSERT'), 'authenticated users cannot directly create messages');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chatbot_admin_staff'
      AND policyname = 'chatbot_admin_staff_self_select'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%auth.uid()%user_id%'
  ),
  'staff can read only their own registry row'
);

SELECT ok(has_table_privilege('authenticated', 'public.chatbot_admin_staff', 'SELECT'), 'authenticated users can perform the staff self lookup');
SELECT ok(NOT has_table_privilege('authenticated', 'public.chatbot_admin_staff', 'UPDATE'), 'staff cannot mutate their own role');

SELECT is(
  (
    SELECT count(*)::integer
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee = 'authenticated'
      AND table_name IN (
        'chatbot_settings',
        'chatbot_business_profile_versions',
        'chatbot_knowledge_entries',
        'chatbot_runs',
        'chatbot_feedback',
        'chatbot_audit_log'
      )
  ),
  0,
  'authenticated clients have no direct access to private chatbot data'
);

SELECT ok(
  (
    SELECT bool_and(
      has_table_privilege('service_role', format('%I.%I', table_schema, table_name), 'SELECT')
      AND has_table_privilege('service_role', format('%I.%I', table_schema, table_name), 'INSERT')
      AND has_table_privilege('service_role', format('%I.%I', table_schema, table_name), 'UPDATE')
      AND has_table_privilege('service_role', format('%I.%I', table_schema, table_name), 'DELETE')
    )
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'chatbot_admin_staff',
        'chatbot_settings',
        'chatbot_business_profile_versions',
        'chatbot_knowledge_entries',
        'chatbot_runs',
        'chatbot_feedback',
        'chatbot_audit_log'
      )
  ),
  'trusted server role can manage chatbot data'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('can_access_conversation', 'send_customer_message', 'get_or_create_conversation')
  ),
  0,
  'legacy identity-spoofable chat RPCs are removed'
);

SELECT ok((SELECT NOT public FROM storage.buckets WHERE id = 'chat-images'), 'chat image bucket is private');
SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id = 'chat-images'), 5242880::bigint, 'chat image bucket enforces a 5 MB limit');
SELECT is(
  (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'chat-images'),
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[],
  'chat image bucket permits only decodable still-image formats'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        coalesce(qual, '') LIKE '%chat-images%'
        OR coalesce(with_check, '') LIKE '%chat-images%'
      )
  ),
  0,
  'no client storage policy grants access to chat images'
);

SELECT is((SELECT mode FROM public.chatbot_settings WHERE id), 'draft', 'global launch mode is draft-only');
SELECT ok((SELECT NOT kill_switch FROM public.chatbot_settings WHERE id), 'draft generation is enabled while auto-send remains disabled');
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.chatbot_business_profile_versions
    WHERE status = 'published'
      AND version = 1
      AND support_email = 'support@genie.ph'
      AND phone_display = '+63 908 940 8747'
      AND address_line LIKE 'Unit 3, Treehouse Building%'
  ),
  'confirmed Genie.ph business profile is seeded as published version 1'
);

SELECT ok(
  has_function_privilege('service_role', 'public.chatbot_publish_business_profile(uuid,uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.chatbot_publish_knowledge_entry(uuid,uuid)', 'EXECUTE'),
  'service role can execute atomic publishing functions'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.chatbot_publish_business_profile(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.chatbot_publish_business_profile(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.chatbot_publish_knowledge_entry(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.chatbot_publish_knowledge_entry(uuid,uuid)', 'EXECUTE'),
  'atomic publishing functions are not client-callable'
);
SELECT ok(
  has_function_privilege('service_role', 'public.chatbot_minimize_expired_runs(timestamptz)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.chatbot_minimize_expired_runs(timestamptz)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.chatbot_minimize_expired_runs(timestamptz)', 'EXECUTE'),
  'retention minimization is callable only by the trusted server role'
);
SELECT ok(
  has_function_privilege('service_role', 'public.chatbot_approve_run(uuid,text,uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.chatbot_request_human(uuid,uuid)', 'EXECUTE'),
  'trusted server can execute transactional send and handoff functions'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.chatbot_approve_run(uuid,text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.chatbot_approve_run(uuid,text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.chatbot_request_human(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.chatbot_request_human(uuid,uuid)', 'EXECUTE'),
  'transactional send and handoff functions are not client-callable'
);
SELECT ok(
  has_function_privilege('service_role', 'public.chatbot_consume_rate_limit(text,timestamptz)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.chatbot_consume_rate_limit(text,timestamptz)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.chatbot_consume_rate_limit(text,timestamptz)', 'EXECUTE'),
  'durable rate limiting is callable only by the trusted server role'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.chatbot_rate_limit_events', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.chatbot_rate_limit_events', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.chatbot_rate_limit_events', 'INSERT'),
  'rate-limit events are not browser-readable or writable'
);
SELECT ok(to_regclass('public.uq_chatbot_business_profile_one_published') IS NOT NULL, 'only one business profile may be published');
SELECT ok(to_regclass('public.uq_chatbot_knowledge_one_published') IS NOT NULL, 'only one version per knowledge key and locale may be published');

CREATE TEMP TABLE chatbot_security_test_ids AS
SELECT
  gen_random_uuid() AS conversation_one,
  gen_random_uuid() AS conversation_two,
  gen_random_uuid() AS customer_message_one,
  gen_random_uuid() AS customer_message_two,
  gen_random_uuid() AS customer_message_three,
  gen_random_uuid() AS assistant_message_one,
  gen_random_uuid() AS assistant_message_two,
  gen_random_uuid() AS merchant_message_one;

INSERT INTO public.chat_conversations (id, status)
SELECT conversation_one, 'active' FROM chatbot_security_test_ids
UNION ALL
SELECT conversation_two, 'active' FROM chatbot_security_test_ids;

INSERT INTO public.chat_messages (id, conversation_id, content, sender_type)
SELECT customer_message_one, conversation_one, 'Customer one', 'customer' FROM chatbot_security_test_ids
UNION ALL
SELECT customer_message_two, conversation_one, 'Customer two', 'customer' FROM chatbot_security_test_ids
UNION ALL
SELECT customer_message_three, conversation_one, 'Customer three', 'customer' FROM chatbot_security_test_ids
UNION ALL
SELECT assistant_message_one, conversation_one, 'Assistant one', 'assistant' FROM chatbot_security_test_ids
UNION ALL
SELECT assistant_message_two, conversation_two, 'Assistant two', 'assistant' FROM chatbot_security_test_ids
UNION ALL
SELECT merchant_message_one, conversation_one, 'Merchant one', 'merchant' FROM chatbot_security_test_ids;

INSERT INTO public.chatbot_runs (
  conversation_id,
  customer_message_id,
  assistant_message_id,
  status,
  outcome
)
SELECT conversation_one, customer_message_one, assistant_message_one, 'sent', 'answer'
FROM chatbot_security_test_ids;

CREATE TEMP TABLE chatbot_security_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.chatbot_runs (conversation_id, customer_message_id)
    SELECT conversation_one, customer_message_one FROM chatbot_security_test_ids;
    INSERT INTO chatbot_security_test_results VALUES ('duplicate_customer', false);
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO chatbot_security_test_results VALUES ('duplicate_customer', true);
  END;

  BEGIN
    INSERT INTO public.chatbot_runs (conversation_id, customer_message_id)
    SELECT conversation_one, merchant_message_one FROM chatbot_security_test_ids;
    INSERT INTO chatbot_security_test_results VALUES ('merchant_as_customer', false);
  EXCEPTION WHEN raise_exception THEN
    INSERT INTO chatbot_security_test_results VALUES ('merchant_as_customer', true);
  END;

  BEGIN
    INSERT INTO public.chatbot_runs (
      conversation_id,
      customer_message_id,
      assistant_message_id
    )
    SELECT conversation_one, customer_message_two, assistant_message_two
    FROM chatbot_security_test_ids;
    INSERT INTO chatbot_security_test_results VALUES ('cross_conversation_assistant', false);
  EXCEPTION WHEN raise_exception THEN
    INSERT INTO chatbot_security_test_results VALUES ('cross_conversation_assistant', true);
  END;
END;
$$;

SELECT ok((SELECT passed FROM chatbot_security_test_results WHERE test_name = 'duplicate_customer'), 'one durable run is allowed per customer message');
SELECT ok((SELECT passed FROM chatbot_security_test_results WHERE test_name = 'merchant_as_customer'), 'run source must be a customer message');
SELECT ok((SELECT passed FROM chatbot_security_test_results WHERE test_name = 'cross_conversation_assistant'), 'run output must belong to the same conversation');

SELECT * FROM finish();

ROLLBACK;
