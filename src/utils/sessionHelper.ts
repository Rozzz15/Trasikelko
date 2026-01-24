// Session Helper - Replaces AsyncStorage user email lookups
// Use this instead of: await AsyncStorage.getItem('current_user_email')

import { getCurrentUserFromSupabase } from '../services/userService';

/**
 * Get current user's email (replaces AsyncStorage lookup)
 * @returns User email or null
 */
export const getCurrentUserEmail = async (): Promise<string | null> => {
  try {
    const user = await getCurrentUserFromSupabase();
    return user?.email || null;
  } catch (error) {
    console.error('Error getting current user email:', error);
    return null;
  }
};

/**
 * Get current user's ID
 * @returns User ID or null
 */
export const getCurrentUserIdFromSession = async (): Promise<string | null> => {
  try {
    const user = await getCurrentUserFromSupabase();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};

/**
 * Get current user's full data
 * @returns User object or null
 */
export const getCurrentUser = async () => {
  try {
    return await getCurrentUserFromSupabase();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};
