import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '../components';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { validateEmail, validateRequired } from '../utils/validation';
import { validateAdminLogin } from '../utils/adminAuth';

interface AdminLoginScreenProps {
  navigation: any;
  onLoginSuccess: () => void;
  onBack: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  navigation,
  onLoginSuccess,
  onBack,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!validateRequired(email)) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!validateRequired(password)) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const isValid = await validateAdminLogin(email, password);
      if (isValid) {
        onLoginSuccess();
      } else {
        Alert.alert('Access Denied', 'Invalid admin credentials. Only authorized administrators can access this dashboard.');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      Alert.alert('Error', 'An error occurred during login. Please try again.');
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
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.darkText} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={64} color={colors.primary} />
            </View>
            <Text style={styles.title}>Admin Access</Text>
            <Text style={styles.subtitle}>Secure Administrator Login</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Admin Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="admin@traysikelko.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              icon="mail-outline"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              error={errors.password}
              icon="lock-closed-outline"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            <Button
              title={loading ? 'Verifying...' : 'Login to Dashboard'}
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              style={styles.loginButton}
            />

            <View style={styles.securityNote}>
              <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.securityNoteText}>
                This is a restricted area. Unauthorized access is prohibited.
              </Text>
            </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: spacing.sm,
    marginBottom: spacing.md,
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
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  loginButton: {
    marginTop: spacing.lg,
  },
  loader: {
    marginLeft: spacing.sm,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  securityNoteText: {
    ...typography.caption,
    color: colors.darkText,
    flex: 1,
    fontSize: 12,
  },
});


