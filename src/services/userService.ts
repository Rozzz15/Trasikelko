// User Service - Supabase Integration
// This service provides functions to interact with user data in Supabase

import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SupabaseUser {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  account_type: 'passenger' | 'driver';
  profile_photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabasePassenger extends SupabaseUser {
  is_senior_citizen?: boolean;
  is_pwd?: boolean;
  senior_citizen_id?: string;
  pwd_id?: string;
}

/**
 * Get current logged-in user from Supabase
 */
export const getCurrentUserFromSupabase = async (): Promise<SupabaseUser | null> => {
  try {
    // Get current session
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('No authenticated user');
      return null;
    }

    // Fetch user profile from database
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return profile as SupabaseUser;
  } catch (error) {
    console.error('Error in getCurrentUserFromSupabase:', error);
    return null;
  }
};

/**
 * Get passenger profile with passenger-specific data
 */
export const getPassengerFromSupabase = async (userId: string): Promise<SupabasePassenger | null> => {
  try {
    // Fetch user with passenger data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return null;
    }

    // Fetch passenger-specific data
    const { data: passenger, error: passengerError } = await supabase
      .from('passengers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (passengerError) {
      console.error('Error fetching passenger data:', passengerError);
      return user as SupabaseUser;
    }

    // Merge user and passenger data
    return {
      ...user,
      is_senior_citizen: passenger.is_senior_citizen,
      is_pwd: passenger.is_pwd,
      senior_citizen_id: passenger.senior_citizen_id,
      pwd_id: passenger.pwd_id,
    } as SupabasePassenger;
  } catch (error) {
    console.error('Error in getPassengerFromSupabase:', error);
    return null;
  }
};

/**
 * Update user profile in Supabase
 */
export const updateUserProfileInSupabase = async (
  userId: string,
  updates: Partial<SupabaseUser>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        full_name: updates.full_name,
        phone_number: updates.phone_number,
        profile_photo_url: updates.profile_photo_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user profile:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateUserProfileInSupabase:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update passenger-specific data in Supabase
 */
export const updatePassengerDataInSupabase = async (
  userId: string,
  updates: {
    is_senior_citizen?: boolean;
    is_pwd?: boolean;
    senior_citizen_id?: string;
    pwd_id?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('passengers')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating passenger data:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updatePassengerDataInSupabase:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user ID from current session
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};

/**
 * Cache user data locally for offline access
 */
export const cacheUserDataLocally = async (userData: SupabaseUser): Promise<void> => {
  try {
    await AsyncStorage.setItem('cached_user_data', JSON.stringify(userData));
    await AsyncStorage.setItem('cached_user_email', userData.email);
  } catch (error) {
    console.error('Error caching user data:', error);
  }
};

/**
 * Get cached user data (for offline mode)
 */
export const getCachedUserData = async (): Promise<SupabaseUser | null> => {
  try {
    const cachedData = await AsyncStorage.getItem('cached_user_data');
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    return null;
  } catch (error) {
    console.error('Error getting cached user data:', error);
    return null;
  }
};

/**
 * Hybrid approach: Try Supabase first, fallback to cache
 */
export const getUserData = async (): Promise<SupabaseUser | null> => {
  try {
    // Try to get from Supabase
    const supabaseUser = await getCurrentUserFromSupabase();
    
    if (supabaseUser) {
      // Cache for offline access
      await cacheUserDataLocally(supabaseUser);
      return supabaseUser;
    }

    // Fallback to cached data if offline
    console.log('Supabase unavailable, using cached data');
    return await getCachedUserData();
  } catch (error) {
    console.error('Error in getUserData:', error);
    // Try cache as last resort
    return await getCachedUserData();
  }
};

