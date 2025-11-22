interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_AI_API_KEY: string
  readonly VITE_XENDIT_PUBLIC_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
