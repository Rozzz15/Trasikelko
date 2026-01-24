import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Admin credentials stored in database
const ADMIN_EMAIL = 'admin@traysikelko.com';
const ADMIN_PASSWORD = 'Admin@2024!Secure';

// AsyncStorage keys
const ADMIN_SESSION_KEY = '@traysikelko_admin_session';
const ADMIN_SESSION_TIME_KEY = '@traysikelko_admin_session_time';

// Store admin session in Supabase
let adminSessionCache: { active: boolean; time: Date } | null = null;

export const setAdminSession = async (): Promise<void> => {
  try {
    const sessionData = {
      active: true,
      time: new Date().toISOString()
    };
    
    // Store in AsyncStorage for persistence
    await AsyncStorage.setItem(ADMIN_SESSION_KEY, 'true');
    await AsyncStorage.setItem(ADMIN_SESSION_TIME_KEY, sessionData.time);
    
    // Store in memory cache for quick access
    adminSessionCache = {
      active: true,
      time: new Date(sessionData.time)
    };
    
    console.log('[AdminAuth] Session set successfully');
  } catch (error) {
    console.error('[AdminAuth] Error setting admin session:', error);
    throw error;
  }
};

// Check if admin is logged in
export const isAdminLoggedIn = async (): Promise<boolean> => {
  try {
    // First check memory cache
    if (adminSessionCache && adminSessionCache.active) {
      // Check if session is still valid (24 hours)
      const now = new Date();
      const hoursDiff = (now.getTime() - adminSessionCache.time.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        console.log('[AdminAuth] Session valid from cache');
        return true;
      } else {
        // Session expired
        console.log('[AdminAuth] Session expired');
        await clearAdminSession();
        return false;
      }
    }
    
    // If not in memory cache, check AsyncStorage (for app restart)
    const sessionActive = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
    const sessionTime = await AsyncStorage.getItem(ADMIN_SESSION_TIME_KEY);
    
    if (sessionActive === 'true' && sessionTime) {
      const sessionDate = new Date(sessionTime);
      const now = new Date();
      const hoursDiff = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        // Restore memory cache
        adminSessionCache = {
          active: true,
          time: sessionDate
        };
        console.log('[AdminAuth] Session restored from AsyncStorage');
        return true;
      } else {
        // Session expired
        console.log('[AdminAuth] Stored session expired');
        await clearAdminSession();
        return false;
      }
    }
    
    console.log('[AdminAuth] No active session found');
    return false;
  } catch (error) {
    console.error('[AdminAuth] Error checking admin session:', error);
    return false;
  }
};

// Clear admin session
export const clearAdminSession = async (): Promise<void> => {
  try {
    // Sign out from Supabase Auth
    await supabase.auth.signOut();
    
    // Clear AsyncStorage
    await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
    await AsyncStorage.removeItem(ADMIN_SESSION_TIME_KEY);
    
    // Clear memory cache
    adminSessionCache = null;
    
    console.log('[AdminAuth] Session cleared successfully');
  } catch (error) {
    console.error('[AdminAuth] Error clearing admin session:', error);
    throw error;
  }
};

// Validate admin credentials using Supabase Auth (SECURE)
export const validateAdminLogin = async (email: string, password: string): Promise<boolean> => {
  try {
    console.log('[AdminAuth] Attempting admin login with Supabase Auth...');
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Step 1: Sign in using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password,
    });
    
    if (authError || !authData.user) {
      console.error('[AdminAuth] Supabase Auth login failed:', authError?.message);
      return false;
    }
    
    console.log('[AdminAuth] Supabase Auth successful, checking if user is admin...');
    
    // Step 2: Check if this authenticated user is in admin_users table
    // Check by email instead of ID to handle cases where IDs might not match
    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', normalizedEmail) // Match by email (more reliable)
      .eq('is_active', true)
      .single();
    
    if (adminError || !admin) {
      console.log('[AdminAuth] User authenticated but not an admin');
      // Sign out if not an admin
      await supabase.auth.signOut();
      return false;
    }
    
    console.log('[AdminAuth] Admin verified successfully!');
    
    // Step 3: Set admin session
    await setAdminSession();
    
    return true;
  } catch (error) {
    console.error('[AdminAuth] Error validating admin login:', error);
    return false;
  }
};

// Get admin email (for display purposes)
export const getAdminEmail = (): string => {
  return ADMIN_EMAIL;
};


