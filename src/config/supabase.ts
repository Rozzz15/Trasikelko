import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ohuhbchbhdjevsoksqqz.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.error('⚠️ SUPABASE_ANON_KEY is not set! Please add it to your .env file');
}

// Supabase client for all operations (uses RLS for security)
// Admin operations are secured via RLS policies - admins must authenticate via Supabase Auth
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ⚠️ SECURITY FIX: Service role key removed from client code
// All operations now use the anon key with Row Level Security (RLS) policies
// Admin users authenticate via supabase.auth.signInWithPassword()
// RLS policies check auth.uid() against admin_users table

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!supabaseAnonKey && supabaseAnonKey !== 'your_anon_key_here';
};

// Test connection
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase connection test failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connected successfully!');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
};
