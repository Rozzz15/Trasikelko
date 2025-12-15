import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserAccount, getUserAccount, updateUserAccount } from './userStorage';

export interface PendingDriver {
  email: string;
  fullName: string;
  phoneNumber: string;
  submittedAt: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

// Get all pending driver applications
export const getPendingDrivers = async (): Promise<UserAccount[]> => {
  try {
    const allEmails = await AsyncStorage.getItem('registered_emails');
    if (!allEmails) return [];

    const emails: string[] = JSON.parse(allEmails);
    const drivers: UserAccount[] = [];

    for (const email of emails) {
      const accountData = await AsyncStorage.getItem(`user_account_${email}`);
      if (accountData) {
        const account: UserAccount = JSON.parse(accountData);
        if (account.accountType === 'driver') {
          drivers.push(account);
        }
      }
    }

    // Sort by submission date (newest first)
    return drivers.sort((a, b) => {
      const dateA = (a as any).submittedAt || '0';
      const dateB = (b as any).submittedAt || '0';
      return dateB.localeCompare(dateA);
    });
  } catch (error) {
    console.error('Error getting pending drivers:', error);
    return [];
  }
};

// Approve a driver
export const approveDriver = async (email: string): Promise<void> => {
  try {
    const account = await getUserAccount(email);
    if (account) {
      await updateUserAccount(email, {
        verificationStatus: 'verified',
        verifiedAt: new Date().toISOString(),
      } as any);
    }
  } catch (error) {
    console.error('Error approving driver:', error);
    throw error;
  }
};

// Reject a driver
export const rejectDriver = async (email: string, reason?: string): Promise<void> => {
  try {
    const account = await getUserAccount(email);
    if (account) {
      await updateUserAccount(email, {
        verificationStatus: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
      } as any);
    }
  } catch (error) {
    console.error('Error rejecting driver:', error);
    throw error;
  }
};

// Get all users (passengers and drivers)
export const getAllUsers = async (): Promise<UserAccount[]> => {
  try {
    const allEmails = await AsyncStorage.getItem('registered_emails');
    if (!allEmails) return [];

    const emails: string[] = JSON.parse(allEmails);
    const users: UserAccount[] = [];

    for (const email of emails) {
      const accountData = await AsyncStorage.getItem(`user_account_${email}`);
      if (accountData) {
        const account: UserAccount = JSON.parse(accountData);
        users.push(account);
      }
    }

    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
};

// Get all passengers
export const getAllPassengers = async (): Promise<UserAccount[]> => {
  try {
    const allUsers = await getAllUsers();
    return allUsers.filter(user => user.accountType === 'passenger');
  } catch (error) {
    console.error('Error getting passengers:', error);
    return [];
  }
};

// Get all drivers
export const getAllDrivers = async (): Promise<UserAccount[]> => {
  try {
    const allUsers = await getAllUsers();
    return allUsers.filter(user => user.accountType === 'driver');
  } catch (error) {
    console.error('Error getting drivers:', error);
    return [];
  }
};

// Get statistics
export const getAdminStatistics = async () => {
  try {
    const allUsers = await getAllUsers();
    const passengers = allUsers.filter(u => u.accountType === 'passenger');
    const drivers = allUsers.filter(u => u.accountType === 'driver');
    const verifiedDrivers = drivers.filter(d => d.verificationStatus === 'verified');
    const pendingDrivers = drivers.filter(d => {
      const status = d.verificationStatus || 'pending';
      return status === 'pending';
    });
    const rejectedDrivers = drivers.filter(d => d.verificationStatus === 'rejected');

    return {
      totalUsers: allUsers.length,
      totalPassengers: passengers.length,
      totalDrivers: verifiedDrivers.length, // Only count verified/approved drivers
      verifiedDrivers: verifiedDrivers.length,
      pendingDrivers: pendingDrivers.length,
      rejectedDrivers: rejectedDrivers.length,
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    return {
      totalUsers: 0,
      totalPassengers: 0,
      totalDrivers: 0,
      verifiedDrivers: 0,
      pendingDrivers: 0,
      rejectedDrivers: 0,
    };
  }
};

