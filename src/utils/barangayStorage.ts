import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserAccount } from './userStorage';

export interface BarangayDriver {
  driverEmail: string;
  fullName: string;
  phoneNumber: string;
  address?: string;
  driversLicenseNumber?: string;
  plateNumber?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedByBarangay: boolean;
  barangayVerifiedAt?: string;
  barangayId?: string;
}

export interface BarangayIssue {
  id: string;
  reportedBy: string;
  reportedByName: string;
  driverEmail?: string;
  driverName?: string;
  type: 'driver_complaint' | 'safety_concern' | 'overcharging' | 'general' | 'other';
  description: string;
  location?: string;
  coordinates?: { latitude: number; longitude: number };
  date: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  barangayResponse?: string;
  respondedAt?: string;
}

const BARANGAY_DRIVERS_KEY = 'barangay_drivers';
const BARANGAY_ISSUES_KEY = 'barangay_issues';
const BARANGAY_TANOD_CONTACTS_KEY = 'barangay_tanod_contacts';

// Verify driver with barangay database
export const verifyDriverWithBarangay = async (driverEmail: string): Promise<boolean> => {
  try {
    const account = await getUserAccount(driverEmail);
    if (!account || account.accountType !== 'driver') {
      return false;
    }

    // In a real implementation, this would connect to barangay database
    // For now, we simulate verification by checking if driver has all required documents
    const hasRequiredDocs = !!(
      account.driversLicenseNumber &&
      account.plateNumber &&
      account.address
    );

    if (hasRequiredDocs) {
      // Store in barangay drivers list
      const barangayDrivers = await getBarangayDrivers();
      const existingDriver = barangayDrivers.find(d => d.driverEmail === driverEmail);
      
      if (!existingDriver) {
        const barangayDriver: BarangayDriver = {
          driverEmail,
          fullName: account.fullName,
          phoneNumber: account.phoneNumber,
          address: account.address,
          driversLicenseNumber: account.driversLicenseNumber,
          plateNumber: account.plateNumber,
          verificationStatus: account.verificationStatus || 'pending',
          verifiedByBarangay: true,
          barangayVerifiedAt: new Date().toISOString(),
        };
        
        barangayDrivers.push(barangayDriver);
        await AsyncStorage.setItem(BARANGAY_DRIVERS_KEY, JSON.stringify(barangayDrivers));
      } else {
        // Update existing record
        const index = barangayDrivers.findIndex(d => d.driverEmail === driverEmail);
        barangayDrivers[index] = {
          ...existingDriver,
          verifiedByBarangay: true,
          barangayVerifiedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(BARANGAY_DRIVERS_KEY, JSON.stringify(barangayDrivers));
      }
    }

    return hasRequiredDocs;
  } catch (error) {
    console.error('Error verifying driver with barangay:', error);
    return false;
  }
};

// Get barangay drivers
export const getBarangayDrivers = async (): Promise<BarangayDriver[]> => {
  try {
    const data = await AsyncStorage.getItem(BARANGAY_DRIVERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting barangay drivers:', error);
    return [];
  }
};

// Check if driver is verified by barangay
export const isDriverBarangayVerified = async (driverEmail: string): Promise<boolean> => {
  try {
    const barangayDrivers = await getBarangayDrivers();
    const driver = barangayDrivers.find(d => d.driverEmail === driverEmail);
    return driver?.verifiedByBarangay || false;
  } catch (error) {
    console.error('Error checking barangay verification:', error);
    return false;
  }
};

// Report issue to barangay
export const reportIssueToBarangay = async (
  issue: Omit<BarangayIssue, 'id' | 'date' | 'status'>
): Promise<BarangayIssue> => {
  try {
    const issues = await getBarangayIssues();
    const newIssue: BarangayIssue = {
      ...issue,
      id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString(),
      status: 'pending',
    };
    
    issues.push(newIssue);
    await AsyncStorage.setItem(BARANGAY_ISSUES_KEY, JSON.stringify(issues));
    
    return newIssue;
  } catch (error) {
    console.error('Error reporting issue to barangay:', error);
    throw error;
  }
};

// Get barangay issues
export const getBarangayIssues = async (): Promise<BarangayIssue[]> => {
  try {
    const data = await AsyncStorage.getItem(BARANGAY_ISSUES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting barangay issues:', error);
    return [];
  }
};

// Get issues reported by a user
export const getUserBarangayIssues = async (userEmail: string): Promise<BarangayIssue[]> => {
  try {
    const issues = await getBarangayIssues();
    return issues.filter(i => i.reportedBy === userEmail);
  } catch (error) {
    console.error('Error getting user barangay issues:', error);
    return [];
  }
};

// Get barangay tanod contacts
export const getBarangayTanodContacts = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(BARANGAY_TANOD_CONTACTS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    
    // Default tanod contacts (can be configured)
    const defaultContacts = [
      '09123456789', // Barangay Tanod 1
      '09123456790', // Barangay Tanod 2
    ];
    
    await AsyncStorage.setItem(BARANGAY_TANOD_CONTACTS_KEY, JSON.stringify(defaultContacts));
    return defaultContacts;
  } catch (error) {
    console.error('Error getting barangay tanod contacts:', error);
    return [];
  }
};

// Set barangay tanod contacts (admin function)
export const setBarangayTanodContacts = async (contacts: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(BARANGAY_TANOD_CONTACTS_KEY, JSON.stringify(contacts));
  } catch (error) {
    console.error('Error setting barangay tanod contacts:', error);
    throw error;
  }
};










