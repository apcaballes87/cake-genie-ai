// Centralized, sanitized Supabase env values.
//
// Defensive: env vars pasted into Vercel / .env files sometimes pick up
// trailing newlines or surrounding whitespace. A trailing `\n` on the anon
// key gets URL-encoded to `%0A` in the realtime WebSocket URL and breaks the
// connection handshake. We trim both ends here so every client created from
// these values stays valid. (See also the URL trim in `src/constants.ts`.)

function readEnv(name: string, value: string | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (!trimmed) {
    throw new Error(
      `Missing ${name} environment variable. Please add it to your .env.local file (and Vercel project settings).`
    );
  }
  return trimmed;
}

export const SUPABASE_URL = readEnv(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

export const SUPABASE_ANON_KEY = readEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
