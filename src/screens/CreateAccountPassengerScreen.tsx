import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// AsyncStorage removed - using Supabase only
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
} from '../utils/validation';
import { ImagePicker } from '../components';
import { requestOtp, verifyOtp, getOtpRemainingTime } from '../utils/otpService';
import { registerUser } from '../services/authService';
import { uploadProfilePhoto } from '../services/storageService';

interface CreateAccountPassengerScreenProps {
  onSubmit: (data: PassengerFormData) => void;
  onBack: () => void;
}

export interface PassengerFormData {
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  profilePhoto?: string;
  phoneVerified?: boolean;
  termsAccepted?: boolean;
}

export const CreateAccountPassengerScreen: React.FC<CreateAccountPassengerScreenProps> = ({
  onSubmit,
  onBack,
}) => {
  const [formData, setFormData] = useState<PassengerFormData>({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    profilePhoto: undefined,
    phoneVerified: false,
    termsAccepted: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [errors, setErrors] = useState<Partial<PassengerFormData & { otpCode?: string }>>({});
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<PassengerFormData & { otpCode?: string }> = {};

    if (!validateRequired(formData.fullName) || formData.fullName.length < 2) {
      newErrors.fullName = 'Please enter your full name';
    }

    if (!validatePhone(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid Philippine phone number';
    }

    if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!validateRequired(formData.password) || formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.phoneVerified) {
      newErrors.phoneVerified = false;
      Alert.alert('Verification Required', 'Please verify your phone number via OTP');
      return false;
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = false;
      Alert.alert('Terms Required', 'Please accept the Terms & Conditions');
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    console.log('🟢 ===== PASSENGER SUBMIT BUTTON CLICKED =====');
    console.log('🟢 Form data:', { 
      fullName: formData.fullName,
      email: formData.email, 
      phone: formData.phoneNumber,
      phoneVerified: formData.phoneVerified,
      termsAccepted: formData.termsAccepted
    });
    
    if (validateForm()) {
      console.log('✅ Form validation PASSED');
      try {
        Alert.alert('Creating Account', 'Please wait...');

        console.log('🟢 Calling registerUser...');
        // 1. Register user with Supabase Auth
        const result = await registerUser(
          formData.email.toLowerCase(),
          formData.password,
          formData.fullName,
          formData.phoneNumber,
          'passenger'
        );
        
        console.log('🟢 registerUser returned:', result);

        if (!result.success) {
          console.log('🔴 ===== SIGNUP FAILED =====');
          console.log('🔴 Error:', result.error);
          Alert.alert('Registration Failed', result.error || 'Failed to create account. Please try again.');
          return;
        }
        
        console.log('✅ Registration successful!');

        // 2. Upload profile photo if provided and save to database
        if (formData.profilePhoto && result.userId) {
          console.log('📸 Uploading profile photo...');
          const uploadResult = await uploadProfilePhoto(result.userId, formData.profilePhoto);
          
          if (uploadResult.success && uploadResult.url) {
            console.log('✅ Profile photo uploaded:', uploadResult.url);
            
            // Save the URL to the database
            const { supabase } = await import('../config/supabase');
            console.log('💾 Saving passenger profile photo URL to database...');
            console.log('💾 User ID:', result.userId);
            console.log('💾 URL to save:', uploadResult.url);
            
            const { data: updateData, error: updateError } = await supabase
              .from('users')
              .update({ profile_photo_url: uploadResult.url })
              .eq('id', result.userId)
              .select();
            
            if (updateError) {
              console.error('❌ Failed to save profile photo URL to database:', updateError);
              console.error('❌ Error details:', JSON.stringify(updateError, null, 2));
              Alert.alert(
                'Warning',
                'Profile photo uploaded but failed to save to database. You can update it later from your profile.',
                [{ text: 'OK' }]
              );
            } else {
              console.log('✅ Profile photo URL saved to database');
              console.log('✅ Updated data:', JSON.stringify(updateData, null, 2));
            }
          } else {
            console.warn('❌ Failed to upload profile photo:', uploadResult.error);
            Alert.alert(
              'Upload Warning',
              `Profile photo upload failed: ${uploadResult.error}\n\nYou can add it later from your profile.`,
              [{ text: 'OK' }]
            );
          }
        } else if (!formData.profilePhoto) {
          console.log('⚠️ No profile photo selected by user');
        }

        // 3. Success!
        console.log('🟢 ===== SIGNUP SUCCESS =====');
        Alert.alert(
          'Account Created!',
          'Your passenger account has been created successfully. You can now login.',
          [{ text: 'OK', onPress: () => onSubmit(formData) }]
        );
      } catch (error: any) {
        console.error('🔴 ===== SIGNUP ERROR =====');
        console.error('Error creating account:', error);
        Alert.alert('Error', error.message || 'An unexpected error occurred. Please try again.');
      }
    } else {
      console.log('🔴 Form validation FAILED');
      console.log('🔴 ===== SUBMIT CANCELLED =====');
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
      if (showOtpInput && !formData.phoneVerified) {
        const remaining = await getOtpRemainingTime(formData.phoneNumber);
        setOtpCountdown(remaining);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [showOtpInput, formData.phoneVerified, formData.phoneNumber]);

  const handleSendOtp = async () => {
    if (!validatePhone(formData.phoneNumber)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Philippine phone number');
      return;
    }
    
    setIsSendingOtp(true);
    try {
      const result = await requestOtp(formData.phoneNumber);
      
      if (result.success) {
        setShowOtpInput(true);
        setFormData((prev) => ({ ...prev, phoneVerified: false }));
        setOtpCode('');
        // Set initial countdown (5 minutes = 300 seconds)
        setOtpCountdown(300);
        
        // Show alert with OTP code in development mode for testing
        if (__DEV__ && result.devCode) {
          Alert.alert(
            'OTP Sent (Development Mode)', 
            `OTP Code: ${result.devCode}\n\nAn OTP has been sent to ${formData.phoneNumber}. In development mode, you can use the code shown above for testing.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('OTP Sent', `An OTP has been sent to ${formData.phoneNumber}. Please check your SMS.`);
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
      const result = await verifyOtp(formData.phoneNumber, otpCode);
      
      if (result.valid) {
        setFormData((prev) => ({ ...prev, phoneVerified: true }));
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

  const updateField = (field: keyof PassengerFormData, value: string | boolean) => {
    console.log(`[CreateAccountPassenger] Field updated: ${field} = ${value}`);
    
    // Special logging for profile photo
    if (field === 'profilePhoto') {
      if (value) {
        console.log('✅ [CreateAccountPassenger] Profile photo selected!');
        console.log('📸 [CreateAccountPassenger] Profile photo URI:', value);
      } else {
        console.log('⚠️ [CreateAccountPassenger] Profile photo cleared');
      }
    }
    
    // Reset phone verification when phone number changes
    if (field === 'phoneNumber' && typeof value === 'string' && value !== formData.phoneNumber) {
      setFormData((prev) => ({ ...prev, [field]: value, phoneVerified: false }));
      setShowOtpInput(false);
      setOtpCode('');
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Blank illustration area at top */}
        <View style={styles.illustrationContainer} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Register</Text>
          <Text style={styles.subtitle}>Please register to login.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={colors.gray} style={styles.inputIcon} />
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChangeText={(text) => updateField('fullName', text)}
                />
              </View>
            </View>
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
          </View>

          {/* Phone Number */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color={colors.gray} style={styles.inputIcon} />
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="+63 9XX XXX XXXX"
                  value={formData.phoneNumber}
                  onChangeText={(text) => updateField('phoneNumber', text)}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
          </View>

          {/* Verify Phone via OTP */}
          <View style={styles.inputContainer}>
            {!formData.phoneVerified ? (
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
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={colors.gray} style={styles.inputIcon} />
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email"
                  value={formData.email}
                  onChangeText={(text) => updateField('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.gray} style={styles.inputIcon} />
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChangeText={(text) => updateField('password', text)}
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

          {/* Profile Photo (optional) */}
          <View style={styles.inputContainer}>
            <ImagePicker
              label="Profile Photo (optional)"
              onImageSelected={(uri) => updateField('profilePhoto', uri)}
              currentImage={formData.profilePhoto}
            />
          </View>

          {/* Accept Terms & Condition */}
          <TouchableOpacity 
            style={styles.termsContainer}
            onPress={() => updateField('termsAccepted', !formData.termsAccepted)}
            activeOpacity={0.7}
          >
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, formData.termsAccepted && styles.checkboxChecked]}>
                {formData.termsAccepted && (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                )}
              </View>
              <Text style={styles.termsText}>
                I accept the <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Primary Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Sign Up</Text>
        </TouchableOpacity>

        {/* Secondary Link */}
        <View style={styles.secondaryLinkContainer}>
          <Text style={styles.secondaryLinkText}>Already have account? </Text>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.secondaryLinkAction}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Light peach/off-white background
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  illustrationContainer: {
    height: 200,
    width: '100%',
    marginBottom: spacing.xl,
    // Blank area for illustration - user will add image later
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary, // Dark blue/teal
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    fontWeight: '400',
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
  termsContainer: {
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
  termsText: {
    fontSize: 14,
    color: colors.darkText,
    fontWeight: '400',
    flex: 1,
  },
  termsLink: {
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
  resendOtpButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  resendOtpButtonDisabled: {
    opacity: 0.5,
  },
  resendOtpButtonTextDisabled: {
    color: colors.gray,
  },
  otpButtonDisabled: {
    opacity: 0.6,
  },
  countdownText: {
    fontSize: 12,
    color: colors.gray,
    marginTop: spacing.xs,
    marginLeft: spacing.md,
    fontStyle: 'italic',
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
  primaryButton: {
    backgroundColor: colors.buttonPrimary, // Orange from splash screen
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
});





