import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '../components';
import { colors, typography, spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { validateEmail } from '../utils/validation';
import { supabase } from '../config/supabase';

interface ForgotPasswordScreenProps {
  navigation: any;
  onBack: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
  onBack,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  const handleResetPassword = async () => {
    setError('');

    // Validate email
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Send password reset email via Supabase Auth
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'traysikelko://reset-password', // Deep link for mobile app
      });

      if (resetError) {
        console.error('Password reset error:', resetError);
        Alert.alert(
          'Error',
          'Failed to send password reset email. Please make sure the email is registered.'
        );
        return;
      }

      // Success
      setEmailSent(true);
      Alert.alert(
        'Email Sent!',
        `A password reset link has been sent to ${email}.\n\nPlease check your email and follow the instructions to reset your password.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Go back to login after they acknowledge
              setTimeout(() => {
                onBack();
              }, 500);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={64} color={colors.primary} />
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              {emailSent
                ? 'Check your email for reset instructions'
                : 'Enter your email address and we\'ll send you instructions to reset your password.'}
            </Text>
          </View>

          {/* Form */}
          {!emailSent && (
            <View style={styles.form}>
              <Input
                label="Email Address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
                placeholder="your.email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={error}
                icon="mail-outline"
              />

              <Button
                title={loading ? 'Sending...' : 'Send Reset Link'}
                onPress={handleResetPassword}
                disabled={loading}
                loading={loading}
                style={styles.submitButton}
              />

              <Button
                title="Back to Login"
                onPress={onBack}
                variant="outline"
                style={styles.backButton}
              />
            </View>
          )}

          {emailSent && (
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color={colors.success} />
              </View>
              <Text style={styles.successText}>
                We've sent password reset instructions to:
              </Text>
              <Text style={styles.emailText}>{email}</Text>
              <Text style={styles.instructionsText}>
                Please check your inbox and spam folder. The link will expire in 1 hour.
              </Text>
              
              <Button
                title="Back to Login"
                onPress={onBack}
                style={styles.backButton}
              />

              <Text style={styles.resendText}>
                Didn't receive the email?{' '}
                <Text
                  style={styles.resendLink}
                  onPress={() => {
                    setEmailSent(false);
                    setEmail('');
                  }}
                >
                  Try again
                </Text>
              </Text>
            </View>
          )}
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  form: {
    width: '100%',
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  backButton: {
    marginTop: spacing.md,
  },
  successContainer: {
    alignItems: 'center',
    width: '100%',
  },
  successIconContainer: {
    marginBottom: spacing.lg,
  },
  successText: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emailText: {
    ...typography.h3,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  instructionsText: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
    fontSize: 14,
  },
  resendText: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontSize: 14,
  },
  resendLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
