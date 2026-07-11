import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { remoteEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const supabase: SupabaseClient | null = remoteEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function ensureSignedIn(): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    return data.session.user.id;
  }
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('Anonymous sign-in failed:', error.message);
    return null;
  }
  return anon.user?.id ?? null;
}
