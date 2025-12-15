import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface UserSelectionScreenProps {
  onSelectPassenger: () => void;
  onSelectDriver: () => void;
  onCreateAccount: () => void;
  onSelectAdmin?: () => void;
}

export const UserSelectionScreen: React.FC<UserSelectionScreenProps> = ({
  onSelectPassenger,
  onSelectDriver,
  onCreateAccount,
  onSelectAdmin,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Traysikel KO</Text>
          <Text style={styles.subtitle}>
            Choose how you want to use the app
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Card
            style={styles.optionCard}
            onPress={onSelectPassenger}
            variant="elevated"
          >
            <View style={styles.optionContent}>
              <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="person" size={32} color={colors.primary} />
              </View>
              <Text style={styles.optionTitle}>Login as Passenger</Text>
              <Text style={styles.optionDescription}>
                Book rides and find nearby tricycles
              </Text>
            </View>
          </Card>

          <Card
            style={styles.optionCard}
            onPress={onSelectDriver}
            variant="elevated"
          >
            <View style={styles.optionContent}>
              <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="bicycle" size={32} color={colors.success} />
              </View>
              <Text style={styles.optionTitle}>Login as Driver</Text>
              <Text style={styles.optionDescription}>
                Accept bookings and manage your rides
              </Text>
            </View>
          </Card>
        </View>

        <View style={styles.createAccountContainer}>
          <Text style={styles.createAccountText}>Don't have an account?</Text>
          <Button
            title="Create Account"
            onPress={onCreateAccount}
            variant="outline"
            style={styles.createAccountButton}
          />
        </View>

        {onSelectAdmin && (
          <View style={styles.adminContainer}>
            <TouchableOpacity
              style={styles.adminButton}
              onPress={onSelectAdmin}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.gray} />
              <Text style={styles.adminButtonText}>Admin Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  optionCard: {
    padding: spacing.lg,
  },
  optionContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  optionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  optionDescription: {
    ...typography.caption,
    textAlign: 'center',
  },
  createAccountContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  createAccountText: {
    ...typography.body,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  createAccountButton: {
    minWidth: 200,
  },
  adminContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  adminButtonText: {
    ...typography.body,
    color: colors.gray,
    fontSize: 14,
  },
});





