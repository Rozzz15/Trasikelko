// Authentication Service - Supabase (FIXED TO USE TRIGGER)
// This version relies on the database trigger to create user profiles automatically
// ✅ NO ASYNCSTORAGE - All data comes from Supabase session and database

import { supabase } from '../config/supabase';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  account_type: 'passenger' | 'driver';
  profile_photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PassengerProfile extends UserProfile {
  is_senior_citizen?: boolean;
  is_pwd?: boolean;
  senior_citizen_id?: string;
  pwd_id?: string;
}

export interface DriverProfile extends UserProfile {
  address?: string;
  drivers_license_number?: string;
  license_expiry_date?: string;
  license_front_photo_url?: string;
  license_back_photo_url?: string;
  plate_number?: string;
  orcr_photo_url?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  franchise_number?: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
  is_online?: boolean;
  average_rating?: number;
  total_rides?: number;
}

/**
 * Register a new user
 * ✅ FIXED: Now uses trigger - only creates auth user, trigger handles the rest
 */
export const registerUser = async (
  email: string,
  password: string,
  fullName: string,
  phoneNumber: string,
  accountType: 'passenger' | 'driver'
): Promise<{ success: boolean; userId?: string; error?: string }> => {
  try {
    console.log('🔵 ===== SIGNUP START =====');
    console.log('📝 Registering:', { email, accountType });

    // 1. Create auth user
    console.log('Step 1: Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone_number: phoneNumber,
          account_type: accountType,
        },
      },
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    console.log('✅ Auth user created:', authData.user.id);

    // 2. Check if profile already exists (trigger may have created it)
    console.log('Step 2: Checking if profile exists...');
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (existingProfile) {
      console.log('✅ Profile already exists (created by trigger)');
    } else {
      // Create profile if it doesn't exist
      console.log('Creating user profile...');
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: fullName,
          phone_number: phoneNumber,
          account_type: accountType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
        return { success: false, error: `Failed to create profile: ${profileError.message}` };
      }

      console.log('✅ User profile created');
    }

    // 3. Check if driver/passenger record exists
    if (accountType === 'driver') {
      console.log('Step 3: Checking driver record...');
      
      const { data: existingDriver } = await supabase
        .from('drivers')
        .select('user_id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (existingDriver) {
        console.log('✅ Driver record already exists (created by trigger)');
      } else {
        console.log('Creating driver record...');
        const { error: driverError } = await supabase
          .from('drivers')
          .insert({
            user_id: authData.user.id,
            verification_status: 'pending',
            is_online: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (driverError) {
          console.error('❌ Driver record error:', driverError);
          return { success: false, error: `Failed to create driver record: ${driverError.message}` };
        }

        console.log('✅ Driver record created (pending verification)');
      }
    } else {
      console.log('Step 3: Checking passenger record...');
      
      const { data: existingPassenger } = await supabase
        .from('passengers')
        .select('user_id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (existingPassenger) {
        console.log('✅ Passenger record already exists (created by trigger)');
      } else {
        console.log('Creating passenger record...');
        const { error: passengerError } = await supabase
          .from('passengers')
          .insert({
            user_id: authData.user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (passengerError) {
          console.error('❌ Passenger record error:', passengerError);
          return { success: false, error: `Failed to create passenger record: ${passengerError.message}` };
        }

        console.log('✅ Passenger record created');
      }
    }

    // 4. Auto-login
    console.log('Step 4: Logging in...');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.warn('⚠️ Auto-login failed, but registration succeeded');
    } else {
      console.log('✅ Logged in successfully');
    }

    console.log('✅ Registration complete!');
    console.log('🔵 ===== SIGNUP END (SUCCESS) =====');
    return { success: true, userId: authData.user.id };
  } catch (error: any) {
    console.error('❌ Registration error:', error);
    console.log('🔵 ===== SIGNUP END (ERROR) =====');
    return { success: false, error: error.message || 'Registration failed' };
  }
};

/**
 * Login user
 */
export const loginUser = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> => {
  try {
    // 1. Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Login failed' };
    }

    // 2. Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Failed to load user profile' };
    }

    // Session is automatically stored by Supabase client
    // No need for AsyncStorage - session is managed by Supabase

    return { success: true, user: profile };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Logout user
 */
export const logoutUser = async (): Promise<void> => {
  await supabase.auth.signOut();
  // Session is automatically cleared by Supabase client
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (): Promise<UserProfile | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return profile;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Get passenger profile (with passenger-specific data)
 */
export const getPassengerProfile = async (userId: string): Promise<PassengerProfile | null> => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*, passengers(*)')
      .eq('id', userId)
      .single();

    if (!user) return null;

    return {
      ...user,
      ...user.passengers[0],
    };
  } catch (error) {
    console.error('Error getting passenger profile:', error);
    return null;
  }
};

/**
 * Get driver profile (with driver-specific data)
 */
export const getDriverProfile = async (userId: string): Promise<DriverProfile | null> => {
  try {
    console.log('[getDriverProfile] Fetching driver profile for userId:', userId);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*, drivers(*)')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[getDriverProfile] Error fetching profile:', error);
      return null;
    }

    if (!user) {
      console.log('[getDriverProfile] No user found');
      return null;
    }

    console.log('[getDriverProfile] User data:', user);
    console.log('[getDriverProfile] Driver data:', user.drivers);
    
    const driverData = Array.isArray(user.drivers) ? user.drivers[0] : user.drivers;
    console.log('[getDriverProfile] Extracted driver data:', driverData);
    console.log('[getDriverProfile] Verification status:', driverData?.verification_status);

    return {
      ...user,
      ...driverData,
    };
  } catch (error) {
    console.error('[getDriverProfile] Error getting driver profile:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Update passenger-specific data
 */
export const updatePassengerData = async (
  userId: string,
  updates: Partial<PassengerProfile>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('passengers')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Update driver-specific data
 */
export const updateDriverData = async (
  userId: string,
  updates: Partial<DriverProfile>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('drivers')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Check if user is logged in
 */
export const isUserLoggedIn = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

/**
 * Get account type from Supabase database
 */
export const getAccountType = async (): Promise<'passenger' | 'driver' | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: user, error } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', session.user.id)
      .single();

    if (error || !user) return null;
    return user.account_type as 'passenger' | 'driver';
  } catch (error) {
    console.error('Error getting account type:', error);
    return null;
  }
};
