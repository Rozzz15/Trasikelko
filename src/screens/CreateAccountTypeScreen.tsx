import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface CreateAccountTypeScreenProps {
  onSelectPassenger: () => void;
  onSelectDriver: () => void;
  onBack: () => void;
}

export const CreateAccountTypeScreen: React.FC<CreateAccountTypeScreenProps> = ({
  onSelectPassenger,
  onSelectDriver,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.darkText} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Choose your account type to get started
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <Card
            style={styles.accountCard}
            onPress={onSelectPassenger}
            variant="elevated"
          >
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="person" size={40} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Passenger</Text>
              <Text style={styles.cardDescription}>
                Book rides and travel conveniently around the city
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.featureText}>Find nearby tricycles</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.featureText}>Easy booking</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.featureText}>Track your ride</Text>
                </View>
              </View>
            </View>
          </Card>

          <Card
            style={styles.accountCard}
            onPress={onSelectDriver}
            variant="elevated"
          >
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="bicycle" size={40} color={colors.success} />
              </View>
              <Text style={styles.cardTitle}>Driver</Text>
              <Text style={styles.cardDescription}>
                Start earning by accepting ride bookings
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.featureText}>Receive bookings</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.featureText}>Manage earnings</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.featureText}>Flexible schedule</Text>
                </View>
              </View>
            </View>
          </Card>
        </View>
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
  backButton: {
    padding: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
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
  cardsContainer: {
    gap: spacing.lg,
  },
  accountCard: {
    padding: spacing.lg,
  },
  cardContent: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  cardDescription: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  featuresList: {
    width: '100%',
    gap: spacing.sm,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.body,
    color: colors.darkText,
  },
});





