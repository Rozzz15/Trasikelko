import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// AsyncStorage removed - using Supabase only
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Button, Input, ImagePicker, Card, DatePicker } from '../components';
import { storeUserAccount, type UserAccount } from '../utils/userStorage';
import {
  colors,
  typography,
  spacing,
  borderRadius,
} from '../theme';
import { Ionicons } from '@expo/vector-icons';
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validateLicenseNumber,
  validatePlateNumber,
  formatPhoneNumber,
} from '../utils/validation';
import { requestOtp, verifyOtp, getOtpRemainingTime } from '../utils/otpService';
import { registerUser } from '../services/authService';
import { updateDriverData } from '../services/authService';
import { uploadProfilePhoto, uploadDriverLicense, uploadORCR } from '../services/storageService';
import { supabase } from '../config/supabase';

interface CreateAccountScreenProps {
  onSubmit?: (data: PassengerFormData | DriverFormData, accountType: 'passenger' | 'driver') => void;
  onBack: () => void;
}

type CreateAccountScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateAccount'>;

export interface PassengerFormData {
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  profilePhoto?: string;
}

export interface DriverFormData {
  // Personal Information
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  profilePhoto?: string;
  address: string;
  
  // Driver Identification
  driversLicenseNumber: string;
  licenseExpiryDate: string;
  licenseFrontPhoto?: string;
  licenseBackPhoto?: string;
  
  // Vehicle Information
  plateNumber: string;
  orcrPhoto?: string;
  vehicleModel: string;
  vehicleColor: string;
  franchiseNumber?: string;
}

export const CreateAccountScreen: React.FC<CreateAccountScreenProps> = ({
  onSubmit,
  onBack,
}) => {
  const navigation = useNavigation<CreateAccountScreenNavigationProp>();
  const [accountType, setAccountType] = useState<'passenger' | 'driver'>('passenger');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Passenger form data
  const [passengerData, setPassengerData] = useState<PassengerFormData>({
    fullName: '',
    phoneNumber: '+63',
    email: '',
    password: '',
    profilePhoto: undefined,
  });
  
  // Driver form data
  const [driverData, setDriverData] = useState<DriverFormData>({
    fullName: '',
    phoneNumber: '+63',
    email: '',
    password: '',
    profilePhoto: undefined,
    address: '',
    driversLicenseNumber: '',
    licenseExpiryDate: '',
    licenseFrontPhoto: undefined,
    licenseBackPhoto: undefined,
    plateNumber: '',
    orcrPhoto: undefined,
    vehicleModel: '',
    vehicleColor: '',
    franchiseNumber: '',
  });
  
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // OTP verification state (for passenger accounts)
  const [otpCode, setOtpCode] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const validatePassengerForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!validateRequired(passengerData.fullName) || passengerData.fullName.length < 2) {
      newErrors.fullName = 'Please enter your full name';
    }

    if (!validatePhone(passengerData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid Philippine phone number (+63 9XX XXX XXXX)';
    }

    if (!phoneVerified) {
      newErrors.phoneVerified = 'Please verify your phone number via OTP';
    }

    if (!validateEmail(passengerData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!validateRequired(passengerData.password) || passengerData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDriverForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Personal Information
    if (!validateRequired(driverData.fullName) || driverData.fullName.length < 2) {
      newErrors.fullName = 'Please enter your full name';
    }
    if (!validatePhone(driverData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid Philippine phone number (+63 9XX XXX XXXX)';
    }
    if (!validateEmail(driverData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!validateRequired(driverData.password) || driverData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!validateRequired(confirmPassword)) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (driverData.password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!validateRequired(driverData.address)) {
      newErrors.address = 'Please enter your address';
    }

    // Driver Identification
    if (!validateLicenseNumber(driverData.driversLicenseNumber)) {
      newErrors.driversLicenseNumber = 'Please enter a valid license number';
    }
    if (!validateRequired(driverData.licenseExpiryDate)) {
      newErrors.licenseExpiryDate = 'Please enter license expiry date';
    }
    if (!driverData.licenseFrontPhoto) {
      newErrors.licenseFrontPhoto = 'Please upload license front photo';
    }
    if (!driverData.licenseBackPhoto) {
      newErrors.licenseBackPhoto = 'Please upload license back photo';
    }

    // Vehicle Information
    if (!validatePlateNumber(driverData.plateNumber)) {
      newErrors.plateNumber = 'Please enter a valid plate number';
    }
    if (!driverData.orcrPhoto) {
      newErrors.orcrPhoto = 'Please upload OR/CR photo';
    }
    if (!validateRequired(driverData.vehicleModel)) {
      newErrors.vehicleModel = 'Please enter vehicle model/brand';
    }
    if (!validateRequired(driverData.vehicleColor)) {
      newErrors.vehicleColor = 'Please enter vehicle color';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    const isValid = accountType === 'passenger' ? validatePassengerForm() : validateDriverForm();
    
    if (isValid) {
      setIsSubmitting(true);
      try {
        console.log('🔵 ===== SIGNUP START =====');
        const currentData = accountType === 'passenger' ? passengerData : driverData;
        const email = currentData.email;
        const password = currentData.password;
        const fullName = currentData.fullName;
        const phoneNumber = currentData.phoneNumber;
        
        console.log('📝 Registering user in Supabase:', { email, accountType });
        
        // 1. Register user with Supabase (this will create auth user + profile via trigger)
        const result = await registerUser(
          email.toLowerCase(),
          password,
          fullName,
          phoneNumber,
          accountType
        );
        
        if (!result.success) {
          console.error('❌ Registration failed:', result.error);
          Alert.alert('Registration Failed', result.error || 'Failed to create account. Please try again.');
          setIsSubmitting(false);
          return;
        }
        
        console.log('✅ User registered successfully, userId:', result.userId);
        const userId = result.userId!;
        
        // 2. Handle driver-specific data and uploads
        if (accountType === 'driver') {
          console.log('📸 Uploading driver documents...');
          
          // Upload profile photo
          let profilePhotoUrl: string | undefined;
          if (driverData.profilePhoto) {
            console.log('📸 [DRIVER] Uploading profile photo...');
            const profileUpload = await uploadProfilePhoto(userId, driverData.profilePhoto);
            if (profileUpload.success && profileUpload.url) {
              profilePhotoUrl = profileUpload.url;
              console.log('✅ [DRIVER] Profile photo uploaded:', profilePhotoUrl);
              
              // Save to database
              console.log('💾 [DRIVER] Saving profile photo URL to database...');
              const { data: updateData, error: dbError } = await supabase
                .from('users')
                .update({ profile_photo_url: profilePhotoUrl })
                .eq('id', userId)
                .select();
              
              if (dbError) {
                console.error('❌ [DRIVER] Failed to save profile photo to database:', dbError);
              } else {
                console.log('✅ [DRIVER] Profile photo URL saved to database successfully');
                console.log('✅ [DRIVER] Updated data:', JSON.stringify(updateData, null, 2));
              }
            } else {
              console.error('❌ [DRIVER] Profile photo upload failed:', profileUpload.error);
            }
          } else {
            console.log('⚠️ [DRIVER] No profile photo selected');
          }
          
          // Upload driver documents
          const uploads: Promise<any>[] = [];
          
          if (driverData.licenseFrontPhoto) {
            uploads.push(uploadDriverLicense(userId, driverData.licenseFrontPhoto, 'front'));
          }
          if (driverData.licenseBackPhoto) {
            uploads.push(uploadDriverLicense(userId, driverData.licenseBackPhoto, 'back'));
          }
          if (driverData.orcrPhoto) {
            uploads.push(uploadORCR(userId, driverData.orcrPhoto));
          }
          
          const uploadResults = await Promise.all(uploads);
          const [licenseFrontUrl, licenseBackUrl, orcrUrl] = uploadResults.map(
            r => r.success ? r.url : undefined
          );
          
          // Update driver profile with all details
          console.log('💾 Updating driver profile data...');
          const updateResult = await updateDriverData(userId, {
            address: driverData.address,
            drivers_license_number: driverData.driversLicenseNumber,
            license_expiry_date: driverData.licenseExpiryDate,
            license_front_photo_url: licenseFrontUrl,
            license_back_photo_url: licenseBackUrl,
            plate_number: driverData.plateNumber,
            orcr_photo_url: orcrUrl,
            vehicle_model: driverData.vehicleModel,
            vehicle_color: driverData.vehicleColor,
            franchise_number: driverData.franchiseNumber || undefined,
            verification_status: 'pending',
          });
          
          if (!updateResult.success) {
            console.error('⚠️  Failed to update driver details:', updateResult.error);
          }
        } else {
          // Upload passenger profile photo if provided
          if (passengerData.profilePhoto) {
            console.log('📸 [PASSENGER] Uploading profile photo...');
            const uploadResult = await uploadProfilePhoto(userId, passengerData.profilePhoto);
            if (uploadResult.success && uploadResult.url) {
              console.log('✅ [PASSENGER] Profile photo uploaded:', uploadResult.url);
              
              // Save to database
              console.log('💾 [PASSENGER] Saving profile photo URL to database...');
              const { data: updateData, error: dbError } = await supabase
                .from('users')
                .update({ profile_photo_url: uploadResult.url })
                .eq('id', userId)
                .select();
              
              if (dbError) {
                console.error('❌ [PASSENGER] Failed to save profile photo to database:', dbError);
              } else {
                console.log('✅ [PASSENGER] Profile photo URL saved to database successfully');
                console.log('✅ [PASSENGER] Updated data:', JSON.stringify(updateData, null, 2));
              }
            } else {
              console.error('❌ [PASSENGER] Profile photo upload failed:', uploadResult.error);
            }
          } else {
            console.log('⚠️ [PASSENGER] No profile photo selected');
          }
        }
        
        // 3. Also store locally for backward compatibility
        const userAccount: UserAccount = accountType === 'passenger' 
          ? {
              email: passengerData.email,
              password: passengerData.password,
              fullName: passengerData.fullName,
              phoneNumber: passengerData.phoneNumber,
              accountType: 'passenger',
              profilePhoto: passengerData.profilePhoto,
            }
          : {
              email: driverData.email,
              password: driverData.password,
              fullName: driverData.fullName,
              phoneNumber: driverData.phoneNumber,
              accountType: 'driver',
              profilePhoto: driverData.profilePhoto,
              address: driverData.address,
              driversLicenseNumber: driverData.driversLicenseNumber,
              licenseExpiryDate: driverData.licenseExpiryDate,
              licenseFrontPhoto: driverData.licenseFrontPhoto,
              licenseBackPhoto: driverData.licenseBackPhoto,
              plateNumber: driverData.plateNumber,
              orcrPhoto: driverData.orcrPhoto,
              vehicleModel: driverData.vehicleModel,
              vehicleColor: driverData.vehicleColor,
              franchiseNumber: driverData.franchiseNumber,
              verificationStatus: 'pending',
              submittedAt: new Date().toISOString(),
            };
        
        // Local storage no longer used - all data in Supabase
        await storeUserAccount(userAccount); // Keep for backward compatibility only
        
        setIsSubmitting(false);
        console.log('✅ Account creation complete!');
        console.log('🔵 ===== SIGNUP END (SUCCESS) =====');
        
        // Show confirmation message for driver accounts
        if (accountType === 'driver') {
          Alert.alert(
            'Application Submitted!',
            'Your driver account has been created and submitted for verification.\n\nWe will review your documents and notify you once approved.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Navigate back to login - driver cannot access account until approved
                  navigation.navigate('Login', { email: driverData.email });
                },
              },
            ]
          );
          return;
        }
        
        // For passengers - call onSubmit to trigger auto-login
        if (onSubmit) {
          onSubmit(passengerData, 'passenger');
        }
        
        // Show success notification
        Alert.alert(
          'Account Created!',
          'Your passenger account has been created successfully. You are now logged in!',
          [{ text: 'OK' }]
        );
      } catch (error: any) {
        console.error('❌ Error creating account:', error);
        console.log('🔵 ===== SIGNUP END (ERROR) =====');
        setIsSubmitting(false);
        Alert.alert(
          'Account Creation Failed',
          error.message || 'An error occurred while creating your account. Please try again.'
        );
      }
    } else {
      Alert.alert('Validation Error', 'Please fill in all required fields correctly');
    }
  };

  const updatePassengerField = (field: keyof PassengerFormData, value: string) => {
    // Format phone number with +63 prefix
    if (field === 'phoneNumber') {
      value = formatPhoneNumber(value);
      // Reset phone verification when phone number changes
      if (value !== passengerData.phoneNumber) {
        setPhoneVerified(false);
        setShowOtpInput(false);
        setOtpCode('');
      }
    }
    setPassengerData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // OTP countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (otpCountdown > 0) {
      interval = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [otpCountdown]);

  // Update countdown from stored OTP
  useEffect(() => {
    const updateCountdown = async () => {
      if (showOtpInput && !phoneVerified) {
        const remaining = await getOtpRemainingTime(passengerData.phoneNumber);
        setOtpCountdown(remaining);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [showOtpInput, phoneVerified, passengerData.phoneNumber]);

  const handleSendOtp = async () => {
    if (!validatePhone(passengerData.phoneNumber)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Philippine phone number');
      return;
    }
    
    setIsSendingOtp(true);
    try {
      const result = await requestOtp(passengerData.phoneNumber);
      
      if (result.success) {
        setShowOtpInput(true);
        setPhoneVerified(false);
        setOtpCode('');
        // Set initial countdown (5 minutes = 300 seconds)
        setOtpCountdown(300);
        
        // Show alert with OTP code in development mode for testing
        if (__DEV__ && result.devCode) {
          Alert.alert(
            'OTP Sent (Development Mode)', 
            `OTP Code: ${result.devCode}\n\nAn OTP has been sent to ${passengerData.phoneNumber}. In development mode, you can use the code shown above for testing.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('OTP Sent', `An OTP has been sent to ${passengerData.phoneNumber}. Please check your SMS.`);
        }
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP code');
      return;
    }
    
    setIsVerifyingOtp(true);
    try {
      const result = await verifyOtp(passengerData.phoneNumber, otpCode);
      
      if (result.valid) {
        setPhoneVerified(true);
        setShowOtpInput(false);
        setOtpCode('');
        setOtpCountdown(0);
        Alert.alert('Success', 'Phone number verified successfully');
      } else {
        Alert.alert('Verification Failed', result.message);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Error', 'An error occurred during verification. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) {
      Alert.alert('Please Wait', `Please wait ${otpCountdown} seconds before requesting a new OTP.`);
      return;
    }
    await handleSendOtp();
  };

  const updateDriverField = (field: keyof DriverFormData, value: string) => {
    // Format phone number with +63 prefix
    if (field === 'phoneNumber') {
      value = formatPhoneNumber(value);
    }
    setDriverData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
        {/* Blank illustration area at top */}
        <View style={styles.illustrationContainer} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Choose your account type to get started</Text>
        </View>

        {/* Account Type Selection */}
        <View style={styles.accountTypeContainer}>
          <TouchableOpacity
            style={[
              styles.accountTypeCard,
              accountType === 'passenger' && styles.accountTypeCardActive,
            ]}
            onPress={() => {
              setAccountType('passenger');
              setErrors({});
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="person" size={32} color={colors.primary} />
            </View>
            <Text style={[
              styles.accountTypeTitle,
              accountType === 'passenger' && styles.accountTypeTitleActive,
            ]}>
              Passenger
            </Text>
            <Text style={styles.accountTypeDescription}>
              Book rides and travel conveniently
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.accountTypeCard,
              accountType === 'driver' && styles.accountTypeCardActive,
            ]}
            onPress={() => {
              setAccountType('driver');
              setErrors({});
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="bicycle" size={32} color={colors.success} />
            </View>
            <Text style={[
              styles.accountTypeTitle,
              accountType === 'driver' && styles.accountTypeTitleActive,
            ]}>
              Driver
            </Text>
            <Text style={styles.accountTypeDescription}>
              Start earning by accepting bookings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          {accountType === 'passenger' ? (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={colors.gray} style={styles.inputIcon} />
                  <View style={styles.inputField}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your full name"
                      value={passengerData.fullName}
                      onChangeText={(text) => updatePassengerField('fullName', text)}
                    />
                  </View>
                </View>
                {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color={colors.gray} style={styles.inputIcon} />
                  <View style={styles.inputField}>
                    <Text style={styles.inputLabel}>Mobile Number</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="+63 9XX XXX XXXX"
                      value={passengerData.phoneNumber}
                      onChangeText={(text) => updatePassengerField('phoneNumber', text)}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
                {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
              </View>

              {/* OTP Verification */}
              <View style={styles.inputContainer}>
                {!phoneVerified ? (
                  !showOtpInput ? (
                    <TouchableOpacity 
                      style={[styles.otpButton, isSendingOtp && styles.otpButtonDisabled]} 
                      onPress={handleSendOtp}
                      activeOpacity={0.7}
                      disabled={isSendingOtp}
                    >
                      <Ionicons name="shield-checkmark-outline" size={20} color={colors.white} />
                      <Text style={styles.otpButtonText}>
                        {isSendingOtp ? 'Sending...' : 'Send OTP'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="keypad-outline" size={20} color={colors.gray} style={styles.inputIcon} />
                        <View style={styles.inputField}>
                          <Text style={styles.inputLabel}>Enter OTP Code</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="Enter 6-digit OTP"
                            value={otpCode}
                            onChangeText={(text) => {
                              const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
                              setOtpCode(numericText);
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                          />
                        </View>
                      </View>
                      {otpCountdown > 0 && (
                        <Text style={styles.countdownText}>
                          Resend available in {Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, '0')}
                        </Text>
                      )}
                      <View style={styles.otpActions}>
                        <TouchableOpacity 
                          style={[styles.verifyOtpButton, isVerifyingOtp && styles.otpButtonDisabled]} 
                          onPress={handleVerifyOtp}
                          activeOpacity={0.7}
                          disabled={isVerifyingOtp}
                        >
                          <Text style={styles.verifyOtpButtonText}>
                            {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.resendOtpButton, otpCountdown > 0 && styles.resendOtpButtonDisabled]} 
                          onPress={handleResendOtp}
                          activeOpacity={0.7}
                          disabled={otpCountdown > 0}
                        >
                          <Text style={[styles.resendOtpButtonText, otpCountdown > 0 && styles.resendOtpButtonTextDisabled]}>
                            Resend
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                ) : (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.verifiedText}>Phone number verified</Text>
                  </View>
                )}
                {errors.phoneVerified && <Text style={styles.errorText}>{errors.phoneVerified}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={colors.gray} style={styles.inputIcon} />
                  <View style={styles.inputField}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="your.email@example.com"
                      value={passengerData.email}
                      onChangeText={(text) => updatePassengerField('email', text)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.gray} style={styles.inputIcon} />
                  <View style={styles.inputField}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your password"
                      value={passengerData.password}
                      onChangeText={(text) => updatePassengerField('password', text)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons 
                      name={showPassword ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color={colors.gray} 
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>
            </>
          ) : (
            <>
              {/* Personal Information */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person" size={24} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                </View>
                
                <ImagePicker
                  label="Profile Photo"
                  onImageSelected={(uri) => updateDriverField('profilePhoto', uri)}
                  currentImage={driverData.profilePhoto}
                />

                <Input
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={driverData.fullName}
                  onChangeText={(text) => updateDriverField('fullName', text)}
                  error={errors.fullName}
                  icon="person-outline"
                />

                <Input
                  label="Phone Number"
                  placeholder="+63 9XX XXX XXXX"
                  value={driverData.phoneNumber}
                  onChangeText={(text) => updateDriverField('phoneNumber', text)}
                  error={errors.phoneNumber}
                  icon="call-outline"
                  keyboardType="phone-pad"
                />

                <Input
                  label="Email"
                  placeholder="your.email@example.com"
                  value={driverData.email}
                  onChangeText={(text) => updateDriverField('email', text)}
                  error={errors.email}
                  icon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={driverData.password}
                  onChangeText={(text) => updateDriverField('password', text)}
                  error={errors.password}
                  icon="lock-closed-outline"
                  secureTextEntry={true}
                  autoCapitalize="none"
                />

                <Input
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    // Clear error when user starts typing
                    if (errors.confirmPassword) {
                      setErrors({ ...errors, confirmPassword: '' });
                    }
                  }}
                  error={errors.confirmPassword}
                  icon="lock-closed-outline"
                  secureTextEntry={true}
                  autoCapitalize="none"
                />

                <Input
                  label="Address"
                  placeholder="Enter your complete address"
                  value={driverData.address}
                  onChangeText={(text) => updateDriverField('address', text)}
                  error={errors.address}
                  icon="location-outline"
                  multiline
                />
              </Card>

              {/* Driver Identification */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="card" size={24} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Driver Identification</Text>
                </View>

                <Input
                  label="Driver's License Number"
                  placeholder="Enter license number"
                  value={driverData.driversLicenseNumber}
                  onChangeText={(text) => updateDriverField('driversLicenseNumber', text)}
                  error={errors.driversLicenseNumber}
                  icon="id-card-outline"
                />

                <DatePicker
                  label="License Expiry Date"
                  value={driverData.licenseExpiryDate}
                  onDateSelected={(date) => updateDriverField('licenseExpiryDate', date)}
                  error={errors.licenseExpiryDate}
                  placeholder="Select expiry date"
                  minimumDate={new Date()}
                />

                <ImagePicker
                  label="License Front Photo"
                  onImageSelected={(uri) => updateDriverField('licenseFrontPhoto', uri)}
                  currentImage={driverData.licenseFrontPhoto}
                  aspect={[16, 9]}
                />
                {errors.licenseFrontPhoto && (
                  <Text style={styles.errorText}>{errors.licenseFrontPhoto}</Text>
                )}

                <ImagePicker
                  label="License Back Photo"
                  onImageSelected={(uri) => updateDriverField('licenseBackPhoto', uri)}
                  currentImage={driverData.licenseBackPhoto}
                  aspect={[16, 9]}
                />
                {errors.licenseBackPhoto && (
                  <Text style={styles.errorText}>{errors.licenseBackPhoto}</Text>
                )}
              </Card>

              {/* Vehicle Information */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bicycle" size={24} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Vehicle Information</Text>
                </View>

                <View style={styles.vehicleTypeBadge}>
                  <Ionicons name="bicycle" size={20} color={colors.primary} />
                  <Text style={styles.vehicleTypeText}>Vehicle Type: Tricycle</Text>
                </View>

                <Input
                  label="Plate Number"
                  placeholder="ABC 1234"
                  value={driverData.plateNumber}
                  onChangeText={(text) => updateDriverField('plateNumber', text.toUpperCase())}
                  error={errors.plateNumber}
                  icon="car-outline"
                  autoCapitalize="characters"
                />

                <ImagePicker
                  label="OR/CR Photo"
                  onImageSelected={(uri) => updateDriverField('orcrPhoto', uri)}
                  currentImage={driverData.orcrPhoto}
                  aspect={[16, 9]}
                />
                {errors.orcrPhoto && (
                  <Text style={styles.errorText}>{errors.orcrPhoto}</Text>
                )}

                <Input
                  label="Vehicle Model/Brand"
                  placeholder="e.g., Honda TMX 155"
                  value={driverData.vehicleModel}
                  onChangeText={(text) => updateDriverField('vehicleModel', text)}
                  error={errors.vehicleModel}
                  icon="construct-outline"
                />

                <Input
                  label="Color"
                  placeholder="e.g., Red, Blue, White"
                  value={driverData.vehicleColor}
                  onChangeText={(text) => updateDriverField('vehicleColor', text)}
                  error={errors.vehicleColor}
                  icon="color-palette-outline"
                />

                <Input
                  label="Franchise/Body Number (Optional)"
                  placeholder="Enter franchise number if applicable"
                  value={driverData.franchiseNumber || ''}
                  onChangeText={(text) => updateDriverField('franchiseNumber', text)}
                  icon="receipt-outline"
                />
              </Card>
            </>
          )}

          {/* Remember me toggle */}
          <TouchableOpacity 
            style={styles.rememberMeContainer}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.7}
          >
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                )}
              </View>
              <Text style={styles.rememberMeText}>Remember me next time</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Primary Button */}
        <TouchableOpacity 
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting 
              ? 'Creating Account...' 
              : accountType === 'passenger' 
                ? 'Sign Up' 
                : 'Submit Driver Account'}
          </Text>
        </TouchableOpacity>

        {/* Secondary Link */}
        <View style={styles.secondaryLinkContainer}>
          <Text style={styles.secondaryLinkText}>Already have account? </Text>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.secondaryLinkAction}>Sign In</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 300, // Extra padding at bottom for keyboard
  },
  illustrationContainer: {
    height: 200,
    width: '100%',
    marginBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    fontWeight: '400',
  },
  accountTypeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  accountTypeCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  accountTypeCardActive: {
    borderColor: colors.buttonPrimary,
    backgroundColor: '#FFF8F5',
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  accountTypeTitle: {
    ...typography.h3,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  accountTypeTitleActive: {
    color: colors.buttonPrimary,
    fontWeight: '700',
  },
  accountTypeDescription: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    fontSize: 12,
  },
  form: {
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  inputField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 4,
  },
  textInput: {
    fontSize: 16,
    color: colors.darkText,
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
  sectionCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.darkText,
  },
  vehicleTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lightGray,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  vehicleTypeText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  rememberMeContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberMeText: {
    fontSize: 14,
    color: colors.darkText,
    fontWeight: '400',
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  secondaryLinkText: {
    fontSize: 14,
    color: colors.gray,
  },
  secondaryLinkAction: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  otpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  otpButtonDisabled: {
    opacity: 0.6,
  },
  otpButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  otpActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  verifyOtpButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyOtpButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  resendOtpButton: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendOtpButtonDisabled: {
    opacity: 0.5,
  },
  resendOtpButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  resendOtpButtonTextDisabled: {
    color: colors.gray,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  countdownText: {
    fontSize: 12,
    color: colors.gray,
    marginTop: spacing.xs,
    marginLeft: spacing.md,
    fontStyle: 'italic',
  },
});

