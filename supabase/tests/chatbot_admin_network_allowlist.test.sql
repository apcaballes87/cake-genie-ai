BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

SELECT has_table(
  'public',
  'chatbot_admin_network_allowlist',
  'network-bound admin allowlist exists'
);

SELECT col_is_pk(
  'public',
  'chatbot_admin_network_allowlist',
  'id',
  'network-bound admin allowlist has a primary key'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.chatbot_admin_network_allowlist'::regclass
      AND relrowsecurity
  ),
  'network-bound admin allowlist has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.chatbot_admin_network_allowlist', 'SELECT'),
  'anonymous clients cannot read the allowlist'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.chatbot_admin_network_allowlist', 'SELECT'),
  'authenticated browser clients cannot read the allowlist'
);

SELECT ok(
  has_table_privilege('service_role', 'public.chatbot_admin_network_allowlist', 'SELECT'),
  'service role can read the allowlist'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.chatbot_admin_network_allowlist'::regclass
      AND contype = 'u'
  ),
  'staff and IP hash pairs are unique'
);

SELECT * FROM finish();
ROLLBACK;
