// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Initialise Supabase client using environment variables.
// In a Vite environment you can expose these via import.meta.env.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Optional: export auth helper
export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
