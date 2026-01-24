import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Using Supabase for all storage - no AsyncStorage
import { supabase } from '../config/supabase';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Button, Input } from '../components';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { validateEmail, validateRequired } from '../utils/validation';
// OLD: import { validateLogin, getAccountType } from '../utils/userStorage';
// NEW: Use Supabase Auth
import { loginUser, getAccountType } from '../services/authService';
import { getAdminEmail, validateAdminLogin } from '../utils/adminAuth';
import { getDriverProfile } from '../services/authService';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;
type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  onLogin: (email: string, password: string, userType: 'passenger' | 'driver') => void;
  onForgotPassword: () => void;
  onBack: () => void;
  onCreateAccount?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onForgotPassword,
  onBack,
  onCreateAccount,
}) => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const route = useRoute<LoginScreenRouteProp>();
  
  const [email, setEmail] = useState(() => {
    try {
      return (route?.params as any)?.email || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [detectedUserType, setDetectedUserType] = useState<'passenger' | 'driver' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load remembered email on component mount and check for passed email from signup
  useEffect(() => {
    const loadEmail = async () => {
      try {
        const routeParams = route?.params as any;
        
        // Check if userType was passed from logout
        if (routeParams?.userType) {
          setDetectedUserType(routeParams.userType);
        }
        
        // First check if email was passed from route params (after signup)
        const routeEmail = routeParams?.email;
        if (routeEmail) {
          setEmail(routeEmail);
          // Check account type for the email (from local storage cache)
          const accountType = await getAccountType();
          if (accountType) {
            setDetectedUserType(accountType);
          }
        } else {
          // Otherwise load remembered email from database
          const { data: userData, error } = await supabase
            .from('users')
            .select('email')
            .eq('remember_email', true)
            .single();
          
          if (!error && userData) {
            setEmail(userData.email);
            setRememberMe(true);
            // Note: Account type will be fetched after login
          }
        }
      } catch (error) {
        console.error('Error loading email:', error);
      }
    };

    loadEmail();
  }, [route.params]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!validateRequired(password) || password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check account type from local storage when logged in
  useEffect(() => {
    const checkAccountType = async () => {
      try {
        // Check if user is already logged in and get account type from cache
        const accountType = await getAccountType();
        if (accountType) {
          setDetectedUserType(accountType);
        } else {
          setDetectedUserType(null);
        }
      } catch (error) {
        console.error('Error checking account type:', error);
        setDetectedUserType(null);
      }
    };

    checkAccountType();
  }, []);

  // Function to validate login and determine user type (UPDATED FOR SUPABASE)
  const determineUserType = async (email: string, password: string): Promise<'passenger' | 'driver'> => {
    try {
      // Login with Supabase Auth
      const result = await loginUser(email, password);
      
      if (!result.success || !result.user) {
        throw new Error(result.error || 'Invalid email or password');
      }
      
      // Check if driver account is verified
      if (result.user.account_type === 'driver') {
        console.log('[LoginScreen] User is a driver, checking verification status...');
        
        // Get driver-specific data to check verification status
        const driverProfile = await getDriverProfile(result.user.id);
        
        if (!driverProfile) {
          console.error('[LoginScreen] Driver profile not found for user:', result.user.id);
          throw new Error('Driver profile not found');
        }
        
        console.log('[LoginScreen] Driver profile retrieved:', driverProfile);
        const verificationStatus = driverProfile.verification_status;
        console.log('[LoginScreen] Verification status:', verificationStatus);
        
        if (verificationStatus === 'verified') {
          console.log('[LoginScreen] ✅ Driver is VERIFIED - allowing login');
          // Driver is verified, allow login
        } else if (!verificationStatus || verificationStatus === 'pending') {
          console.log('[LoginScreen] ❌ Driver is PENDING - blocking login');
          const error = new Error('DRIVER_PENDING');
          (error as any).isVerificationError = true;
          throw error;
        } else if (verificationStatus === 'rejected') {
          console.log('[LoginScreen] ❌ Driver is REJECTED - blocking login');
          const error = new Error('DRIVER_REJECTED');
          (error as any).isVerificationError = true;
          throw error;
        } else {
          console.log('[LoginScreen] ❌ Driver has unknown status - blocking login');
          const error = new Error('DRIVER_NOT_VERIFIED');
          (error as any).isVerificationError = true;
          throw error;
        }
      }
      
      return result.user.account_type;
    } catch (error: any) {
      // Only log unexpected errors, not verification status errors
      if (!error?.isVerificationError) {
        console.error('Error determining user type:', error);
      }
      throw error;
    }
  };

  const handleLogin = async () => {
    if (validateForm()) {
      setIsLoading(true);
      try {
        // Check if admin credentials are being used (wrap in try-catch to handle missing admin table)
        try {
          const isValidAdmin = await validateAdminLogin(email, password);
          if (isValidAdmin) {
            // Reset navigation stack to admin dashboard (prevent going back to login)
            setIsLoading(false);
            navigation.reset({
              index: 0,
              routes: [{ name: 'AdminDashboard' }],
            });
            return;
          }
        } catch (adminError: any) {
          // Silently ignore - user is not admin, continue with normal login
          // This is expected behavior when passenger/driver logs in
        }
        
        const userType = await determineUserType(email, password);
        
        // Update "Remember me" preference in database
        try {
          // First clear all remember_email flags
          await supabase
            .from('users')
            .update({ remember_email: false })
            .neq('email', ''); // Update all users
          
          // Then set the flag for current user if remember_me is checked
          if (rememberMe) {
            await supabase
              .from('users')
              .update({ remember_email: true })
              .eq('email', email.toLowerCase());
          }
        } catch (error) {
          console.error('Error updating remember_email:', error);
          // Non-critical error, continue with login
        }
        
        onLogin(email, password, userType);
      } catch (error: any) {
        // Handle driver verification errors
        if (error.message === 'DRIVER_PENDING') {
          Alert.alert(
            'Account Under Review',
            'Your driver account is currently under review. Please wait for admin approval before accessing your account.',
            [{ text: 'OK' }]
          );
        } else if (error.message === 'DRIVER_REJECTED') {
          Alert.alert(
            'Account Rejected',
            'Your driver account application has been rejected. Please contact support for more information.',
            [{ text: 'OK' }]
          );
        } else if (error.message === 'DRIVER_NOT_VERIFIED') {
          Alert.alert(
            'Account Not Verified',
            'Your driver account has not been verified yet. Please wait for admin approval.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Login Error', 'Invalid email or password. Please check your credentials and try again.');
          // Only log unexpected errors
          if (!error?.isVerificationError) {
            console.error('Login error:', error);
          }
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      Alert.alert('Validation Error', 'Please check your credentials');
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
        {/* Illustration at top */}
        <View style={styles.illustrationContainer}>
          <Image 
            source={require('../../assets/pic1.jpg')} 
            style={styles.illustrationImage}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>Please Sign in to continue.</Text>
          {detectedUserType && (
            <View style={styles.accountTypeBadge}>
              <Ionicons 
                name={detectedUserType === 'passenger' ? 'person' : 'bicycle'} 
                size={16} 
                color={colors.primary} 
              />
              <Text style={styles.accountTypeText}>
                {detectedUserType === 'passenger' ? 'Passenger Account' : 'Driver Account'}
              </Text>
            </View>
          )}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={colors.gray} style={styles.inputIcon} />
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
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
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
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
          style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign in</Text>
          )}
        </TouchableOpacity>

        {/* Forgot Password Link */}
        <TouchableOpacity 
          onPress={onForgotPassword}
          style={styles.forgotPasswordButton}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Secondary Link */}
        <View style={styles.secondaryLinkContainer}>
          <Text style={styles.secondaryLinkText}>Don't have account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')}>
            <Text style={styles.secondaryLinkAction}>Sign Up</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Light peach/off-white background
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
    width: screenWidth,
    height: screenHeight * 0.25,
    maxHeight: 250,
    minHeight: 150,
    marginBottom: spacing.lg,
    marginLeft: -spacing.lg, // Offset the parent padding
    marginRight: -spacing.lg,
    overflow: 'hidden',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    marginBottom: spacing.xs,
  },
  accountTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  accountTypeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
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
    backgroundColor: colors.buttonPrimary, // Orange from splash screen
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
  forgotPasswordButton: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
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





