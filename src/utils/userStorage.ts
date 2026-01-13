import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserAccount {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  accountType: 'passenger' | 'driver';
  profilePhoto?: string;
  // Passenger-specific fields
  isSeniorCitizen?: boolean;
  isPWD?: boolean;
  seniorCitizenId?: string;
  pwdId?: string;
  // Driver-specific fields
  address?: string;
  driversLicenseNumber?: string;
  licenseExpiryDate?: string;
  licenseFrontPhoto?: string;
  licenseBackPhoto?: string;
  plateNumber?: string;
  orcrPhoto?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  franchiseNumber?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  submittedAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// Store user account data
export const storeUserAccount = async (account: UserAccount): Promise<void> => {
  try {
    const emailKey = account.email.toLowerCase();
    
    // Store full account data
    await AsyncStorage.setItem(`user_account_${emailKey}`, JSON.stringify(account));
    
    // Store account type for quick lookup
    await AsyncStorage.setItem(`account_type_${emailKey}`, account.accountType);
    
    // Store list of all registered emails
    const existingEmails = await AsyncStorage.getItem('registered_emails');
    const emails = existingEmails ? JSON.parse(existingEmails) : [];
    if (!emails.includes(emailKey)) {
      emails.push(emailKey);
      await AsyncStorage.setItem('registered_emails', JSON.stringify(emails));
    }
  } catch (error) {
    console.error('Error storing user account:', error);
    throw error;
  }
};

// Get user account by email
export const getUserAccount = async (email: string): Promise<UserAccount | null> => {
  try {
    const emailKey = email.toLowerCase();
    const accountData = await AsyncStorage.getItem(`user_account_${emailKey}`);
    if (accountData) {
      return JSON.parse(accountData);
    }
    return null;
  } catch (error) {
    console.error('Error getting user account:', error);
    return null;
  }
};

// Validate login credentials
export const validateLogin = async (email: string, password: string): Promise<{ valid: boolean; account?: UserAccount }> => {
  try {
    const account = await getUserAccount(email);
    if (account && account.password === password) {
      return { valid: true, account };
    }
    return { valid: false };
  } catch (error) {
    console.error('Error validating login:', error);
    return { valid: false };
  }
};

// Get account type by email
export const getAccountType = async (email: string): Promise<'passenger' | 'driver' | null> => {
  try {
    const account = await getUserAccount(email);
    return account ? account.accountType : null;
  } catch (error) {
    console.error('Error getting account type:', error);
    return null;
  }
};

// Update user account (for profile updates)
export const updateUserAccount = async (email: string, updates: Partial<UserAccount>): Promise<void> => {
  try {
    const account = await getUserAccount(email);
    if (account) {
      const updatedAccount = { ...account, ...updates };
      await storeUserAccount(updatedAccount);
    } else {
      throw new Error('Account not found');
    }
  } catch (error) {
    console.error('Error updating user account:', error);
    throw error;
  }
};

