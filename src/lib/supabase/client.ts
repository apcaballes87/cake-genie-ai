import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env'

let browserClient: SupabaseClient | null = null

export function createClient() {
    if (!browserClient) {
        browserClient = createBrowserClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        )
    }

    return browserClient
}

// Backward compatibility export for existing code
export function getSupabaseClient() {
    return createClient()
}
