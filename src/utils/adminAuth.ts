import AsyncStorage from '@react-native-async-storage/async-storage';

// Admin credentials - In production, use secure storage and hashed passwords
const ADMIN_EMAIL = 'admin@traysikelko.com';
const ADMIN_PASSWORD = 'Admin@2024!Secure';

// Store admin session
export const setAdminSession = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem('admin_session', 'active');
    await AsyncStorage.setItem('admin_session_time', new Date().toISOString());
  } catch (error) {
    console.error('Error setting admin session:', error);
    throw error;
  }
};

// Check if admin is logged in
export const isAdminLoggedIn = async (): Promise<boolean> => {
  try {
    const session = await AsyncStorage.getItem('admin_session');
    if (session === 'active') {
      // Check if session is still valid (24 hours)
      const sessionTime = await AsyncStorage.getItem('admin_session_time');
      if (sessionTime) {
        const sessionDate = new Date(sessionTime);
        const now = new Date();
        const hoursDiff = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          return true;
        } else {
          // Session expired
          await clearAdminSession();
          return false;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking admin session:', error);
    return false;
  }
};

// Clear admin session
export const clearAdminSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('admin_session');
    await AsyncStorage.removeItem('admin_session_time');
  } catch (error) {
    console.error('Error clearing admin session:', error);
    throw error;
  }
};

// Validate admin credentials
export const validateAdminLogin = async (email: string, password: string): Promise<boolean> => {
  try {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check credentials
    if (normalizedEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      await setAdminSession();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error validating admin login:', error);
    return false;
  }
};

// Get admin email (for display purposes)
export const getAdminEmail = (): string => {
  return ADMIN_EMAIL;
};


