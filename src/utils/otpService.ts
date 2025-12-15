import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OtpData {
  code: string;
  phoneNumber: string;
  expiresAt: number;
  attempts: number;
}

const OTP_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_VERIFICATION_ATTEMPTS = 5;
const OTP_STORAGE_PREFIX = 'otp_';

/**
 * Generate a random 6-digit OTP code
 */
export const generateOtpCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store OTP code for a phone number
 */
export const storeOtp = async (phoneNumber: string, code: string): Promise<void> => {
  try {
    const otpData: OtpData = {
      code,
      phoneNumber,
      expiresAt: Date.now() + OTP_EXPIRY_TIME,
      attempts: 0,
    };
    
    const key = `${OTP_STORAGE_PREFIX}${phoneNumber}`;
    await AsyncStorage.setItem(key, JSON.stringify(otpData));
  } catch (error) {
    console.error('Error storing OTP:', error);
    throw error;
  }
};

/**
 * Get stored OTP data for a phone number
 */
export const getOtp = async (phoneNumber: string): Promise<OtpData | null> => {
  try {
    const key = `${OTP_STORAGE_PREFIX}${phoneNumber}`;
    const otpDataString = await AsyncStorage.getItem(key);
    
    if (!otpDataString) {
      return null;
    }
    
    const otpData: OtpData = JSON.parse(otpDataString);
    
    // Check if OTP has expired
    if (Date.now() > otpData.expiresAt) {
      await deleteOtp(phoneNumber);
      return null;
    }
    
    return otpData;
  } catch (error) {
    console.error('Error getting OTP:', error);
    return null;
  }
};

/**
 * Verify OTP code for a phone number
 */
export const verifyOtp = async (phoneNumber: string, inputCode: string): Promise<{ valid: boolean; message: string }> => {
  try {
    const otpData = await getOtp(phoneNumber);
    
    if (!otpData) {
      return {
        valid: false,
        message: 'OTP code has expired. Please request a new one.',
      };
    }
    
    // Check if max attempts exceeded
    if (otpData.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await deleteOtp(phoneNumber);
      return {
        valid: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
      };
    }
    
    // Increment attempts
    otpData.attempts += 1;
    const key = `${OTP_STORAGE_PREFIX}${phoneNumber}`;
    await AsyncStorage.setItem(key, JSON.stringify(otpData));
    
    // Verify code
    if (otpData.code === inputCode) {
      // Delete OTP after successful verification
      await deleteOtp(phoneNumber);
      return {
        valid: true,
        message: 'Phone number verified successfully',
      };
    } else {
      const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - otpData.attempts;
      return {
        valid: false,
        message: remainingAttempts > 0 
          ? `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`
          : 'Invalid OTP code. Maximum attempts exceeded.',
      };
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      valid: false,
      message: 'An error occurred during verification. Please try again.',
    };
  }
};

/**
 * Delete OTP data for a phone number
 */
export const deleteOtp = async (phoneNumber: string): Promise<void> => {
  try {
    const key = `${OTP_STORAGE_PREFIX}${phoneNumber}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error deleting OTP:', error);
  }
};

/**
 * Send OTP via SMS
 * This is a placeholder function that should be replaced with actual SMS service integration
 * Options: Twilio, Firebase Phone Auth, AWS SNS, or custom backend API
 */
export const sendOtpSms = async (phoneNumber: string, code: string): Promise<{ success: boolean; message: string }> => {
  try {
    // TODO: Replace this with actual SMS service integration
    // Example services:
    // - Twilio: https://www.twilio.com/docs/sms
    // - Firebase Phone Auth: https://firebase.google.com/docs/auth/web/phone-auth
    // - AWS SNS: https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html
    // - Custom backend API
    
    // For development/testing, you can use:
    // - Expo's SMS API (only works on physical devices)
    // - A mock service that logs the code
    
    console.log(`[OTP Service] Sending OTP ${code} to ${phoneNumber}`);
    
    // Uncomment below to use Expo SMS (requires physical device)
    /*
    import * as SMS from 'expo-sms';
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      await SMS.sendSMSAsync([phoneNumber], `Your TraysikelKO verification code is: ${code}. Valid for 5 minutes.`);
      return { success: true, message: 'OTP sent successfully' };
    }
    */
    
    // For development: Store in AsyncStorage for testing
    // In production, remove this and use actual SMS service
    await AsyncStorage.setItem(`dev_otp_${phoneNumber}`, code);
    
    // Return success (in production, check actual SMS service response)
    return {
      success: true,
      message: 'OTP sent successfully',
    };
  } catch (error) {
    console.error('Error sending OTP SMS:', error);
    return {
      success: false,
      message: 'Failed to send OTP. Please try again.',
    };
  }
};

/**
 * Request and send OTP to phone number
 */
export const requestOtp = async (phoneNumber: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Generate OTP code
    const code = generateOtpCode();
    
    // Store OTP
    await storeOtp(phoneNumber, code);
    
    // Send OTP via SMS
    const smsResult = await sendOtpSms(phoneNumber, code);
    
    if (smsResult.success) {
      return {
        success: true,
        message: `OTP sent to ${phoneNumber}`,
      };
    } else {
      // Delete stored OTP if SMS failed
      await deleteOtp(phoneNumber);
      return {
        success: false,
        message: smsResult.message,
      };
    }
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return {
      success: false,
      message: 'Failed to send OTP. Please try again.',
    };
  }
};

/**
 * Get remaining time for OTP expiry (in seconds)
 */
export const getOtpRemainingTime = async (phoneNumber: string): Promise<number> => {
  try {
    const otpData = await getOtp(phoneNumber);
    if (!otpData) {
      return 0;
    }
    
    const remaining = Math.max(0, Math.floor((otpData.expiresAt - Date.now()) / 1000));
    return remaining;
  } catch (error) {
    console.error('Error getting OTP remaining time:', error);
    return 0;
  }
};

