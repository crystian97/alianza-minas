import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

// Inicialização sob demanda: a demonstração local funciona sem configurar a nuvem.
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local.');
  }
  if (!key.startsWith('sb_publishable_')) {
    throw new Error('Use a chave publicável do Supabase no frontend.');
  }
  client = createClient(url, key);
  return client;
}
