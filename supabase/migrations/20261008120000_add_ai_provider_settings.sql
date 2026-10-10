-- Runtime switch for the cake-analysis AI provider. One row per AI feature;
-- the admin dashboard edits it and the Next.js app reads it (cached ~30s).
create table if not exists public.ai_provider_settings (
  id text primary key,
  provider text not null default 'gemini' check (provider in ('gemini', 'claude')),
  gemini_model text not null default 'gemini-3.5-flash-lite',
  claude_model text not null default 'claude-haiku-5-5',
  fallback_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Service-role access only (Next.js server + admin dashboard).
alter table public.ai_provider_settings enable row level security;

insert into public.ai_provider_settings (id)
values ('cake_analysis')
on conflict (id) do nothing;
