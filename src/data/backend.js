// Which storage backend to use. Supabase is only loaded (dynamic import) when it is configured, so the
// local demo build never ships the Supabase client.

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
}

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey)

let clientPromise = null

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return Promise.resolve(null)
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(supabaseConfig.url, supabaseConfig.anonKey),
  )
  return clientPromise
}
