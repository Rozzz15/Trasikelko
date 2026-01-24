// Utility to fix missing user records in the users table
// This can happen if accounts were created before the proper user creation flow was fixed

import { supabase } from '../config/supabase';

/**
 * Check if current user has a record in users table
 */
export const checkUserRecord = async (): Promise<{ exists: boolean; userId?: string; email?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { exists: false };
    }

    const { data: userRecord, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    return {
      exists: !!userRecord,
      userId: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error('Error checking user record:', error);
    return { exists: false };
  }
};

/**
 * Create missing user record for current authenticated user
 */
export const createMissingUserRecord = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if record already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingUser) {
      return { success: true }; // Already exists
    }

    // Get metadata from auth user
    const fullName = user.user_metadata?.full_name || 'User';
    const phoneNumber = user.user_metadata?.phone_number || '';
    const accountType = user.user_metadata?.account_type || 'passenger';

    // Create user record
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: fullName,
        phone_number: phoneNumber,
        account_type: accountType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error creating user record:', insertError);
      return { success: false, error: insertError.message };
    }

    // Create passenger/driver record if needed
    if (accountType === 'passenger') {
      const { error: passengerError } = await supabase
        .from('passengers')
        .insert({
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (passengerError) {
        console.error('Error creating passenger record:', passengerError);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating missing user record:', error);
    return { success: false, error: error.message };
  }
};
