import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, RatingComponent } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { updateTrip, getActiveTrip, setActiveTrip, Trip } from '../utils/tripStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EndOfRideScreenProps {
  navigation: any;
  route: {
    params: {
      pickupLocation: string;
      dropoffLocation: string;
      distance: number;
      fareEstimate: { min: number; max: number };
      duration?: number;
      driver: {
        name: string;
        photo?: string;
        rating: number;
        tricyclePlate: string;
      };
    };
  };
}

export const EndOfRideScreen: React.FC<EndOfRideScreenProps> = ({ navigation, route }) => {
  const { pickupLocation, dropoffLocation, distance, fareEstimate, duration = 5, driver } = route.params;
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  // Calculate final fare (use average of estimate for demo)
  const finalFare = Math.round((fareEstimate.min + fareEstimate.max) / 2);

  const handlePaymentMethodSelect = (method: 'cash' | 'gcash') => {
    setPaymentMethod(method);
  };

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      Alert.alert('Select Payment Method', 'Please choose how you want to pay');
      return;
    }

    setPaymentConfirmed(true);
    
    // Update existing active trip with completion and payment info
    try {
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (currentUserEmail) {
        // Get active trip for this passenger
        const activeTrip = await getActiveTrip(currentUserEmail, 'passenger');
        if (activeTrip) {
          // Update existing trip with completion data
          await updateTrip(activeTrip.id, {
            status: 'completed',
            paymentMethod,
            paymentStatus: 'completed',
            completedAt: new Date().toISOString(),
            distance,
            duration,
            fare: finalFare,
            driverName: driver.name,
            tricyclePlate: driver.tricyclePlate,
          });
        } else {
          // Fallback: Create new trip if active trip not found (shouldn't happen)
          console.warn('Active trip not found, creating new trip record');
          const trip: Trip = {
            id: `trip_${Date.now()}`,
            passengerId: currentUserEmail,
            driverId: `driver_${driver.name}`,
            pickupLocation,
            dropoffLocation,
            fare: finalFare,
            estimatedFare: finalFare,
            distance,
            duration,
            status: 'completed',
            paymentMethod,
            paymentStatus: 'completed',
            driverName: driver.name,
            tricyclePlate: driver.tricyclePlate,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
          
          const { storeTrip } = await import('../utils/tripStorage');
          await storeTrip(trip);
        }
      }
    } catch (error) {
      console.error('Error updating trip:', error);
    }

    // Show rating after payment confirmation
    setTimeout(() => {
      setShowRating(true);
    }, 500);
  };

  const handleRatingSubmit = async (ratingValue: number, feedbackText?: string) => {
    setRating(ratingValue);
    setFeedback(feedbackText || '');

    // Update trip with passenger rating of driver
    // passengerRating = rating given BY passenger TO driver
    try {
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (currentUserEmail) {
        // Get the completed trip (should be the active trip we just updated)
        const activeTrip = await getActiveTrip(currentUserEmail, 'passenger');
        if (activeTrip) {
          // Update trip with passenger rating of driver
          await updateTrip(activeTrip.id, {
            passengerRating: ratingValue,
            passengerFeedback: feedbackText,
            status: 'completed',
          });

          // Recalculate driver's overall rating and trust score after rating submission
          // This updates the driver's safety badge based on the new rating
          try {
            const { getDriverSafetyRecord } = await import('../utils/safetyStorage');
            if (activeTrip.driverId) {
              await getDriverSafetyRecord(activeTrip.driverId);
            }
          } catch (error) {
            console.error('Error updating driver safety record:', error);
          }

          // Clear active trip after rating is submitted
          await setActiveTrip(null);
        } else {
          // Fallback: Update last completed trip if active trip not found
          const { getTrips } = await import('../utils/tripStorage');
          const trips = await getTrips();
          const lastCompletedTrip = trips
            .filter(t => t.passengerId === currentUserEmail && t.status === 'completed')
            .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())[0];
          
          if (lastCompletedTrip) {
            await updateTrip(lastCompletedTrip.id, {
              passengerRating: ratingValue,
              passengerFeedback: feedbackText,
            });

            // Recalculate driver's safety record
            try {
              const { getDriverSafetyRecord } = await import('../utils/safetyStorage');
              if (lastCompletedTrip.driverId) {
                await getDriverSafetyRecord(lastCompletedTrip.driverId);
              }
            } catch (error) {
              console.error('Error updating driver safety record:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating trip rating:', error);
    }

    Alert.alert(
      'Thank You!',
      'Your rating has been submitted. Thank you for using Traysikel KO!',
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'PassengerHome' }],
            });
          },
        },
      ]
    );
  };

  if (showRating) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              Alert.alert(
                'Skip Rating',
                'Are you sure you want to skip rating?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Skip',
                    onPress: () => {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'PassengerHome' }],
                      });
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <RatingComponent
            title="Rate your Driver"
            subtitle={`How was your ride with ${driver.name}?`}
            onRate={handleRatingSubmit}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>
          <Text style={styles.headerTitle}>Trip Completed!</Text>
          <Text style={styles.headerSubtitle}>Thank you for riding with us</Text>
        </View>

        {/* Trip Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Trip Summary</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="navigate" size={20} color={colors.primary} />
              <View style={styles.summaryItemContent}>
                <Text style={styles.summaryLabel}>Distance</Text>
                <Text style={styles.summaryValue}>{distance.toFixed(1)} km</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="time" size={20} color={colors.warning} />
              <View style={styles.summaryItemContent}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{duration} min</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.fareAmount}>₱{finalFare}</Text>
          </View>
        </Card>

        {/* Driver Info Card */}
        <Card style={styles.driverCard}>
          <View style={styles.driverHeader}>
            <View style={styles.driverAvatarPlaceholder}>
              <Ionicons name="person" size={30} color={colors.white} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.tricyclePlate}>{driver.tricyclePlate}</Text>
            </View>
          </View>
        </Card>

        {/* Payment Method Selection */}
        {!paymentConfirmed && (
          <Card style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Payment Method</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'cash' && styles.paymentOptionSelected,
                ]}
                onPress={() => handlePaymentMethodSelect('cash')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="cash"
                  size={24}
                  color={paymentMethod === 'cash' ? colors.white : colors.primary}
                />
                <Text
                  style={[
                    styles.paymentOptionText,
                    paymentMethod === 'cash' && styles.paymentOptionTextSelected,
                  ]}
                >
                  Cash
                </Text>
                {paymentMethod === 'cash' && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'gcash' && styles.paymentOptionSelected,
                ]}
                onPress={() => handlePaymentMethodSelect('gcash')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="phone-portrait"
                  size={24}
                  color={paymentMethod === 'gcash' ? colors.white : colors.primary}
                />
                <Text
                  style={[
                    styles.paymentOptionText,
                    paymentMethod === 'gcash' && styles.paymentOptionTextSelected,
                  ]}
                >
                  GCash
                </Text>
                {paymentMethod === 'gcash' && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Payment Confirmed */}
        {paymentConfirmed && (
          <Card style={styles.confirmedCard}>
            <View style={styles.confirmedContent}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <Text style={styles.confirmedText}>Payment Confirmed</Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Confirm Payment Button */}
      {!paymentConfirmed && (
        <View style={styles.buttonContainer}>
          <Button
            title="Confirm Payment"
            onPress={handleConfirmPayment}
            variant="primary"
            disabled={!paymentMethod}
            style={styles.confirmButton}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.gray,
  },
  summaryCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  summaryHeader: {
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  summaryRow: {
    marginBottom: spacing.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryItemContent: {
    flex: 1,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 2,
  },
  summaryValue: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    ...typography.h3,
    fontSize: 18,
  },
  fareAmount: {
    ...typography.h2,
    color: colors.buttonPrimary,
    fontSize: 28,
  },
  driverCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  tricyclePlate: {
    ...typography.body,
    color: colors.gray,
  },
  paymentCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  paymentTitle: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  paymentOptions: {
    gap: spacing.md,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  paymentOptionSelected: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  paymentOptionText: {
    ...typography.bodyBold,
    flex: 1,
    color: colors.darkText,
  },
  paymentOptionTextSelected: {
    color: colors.white,
  },
  confirmedCard: {
    marginBottom: spacing.md,
    backgroundColor: '#E8F5E9',
    ...shadows.medium,
  },
  confirmedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  confirmedText: {
    ...typography.bodyBold,
    color: colors.success,
    fontSize: 16,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.white,
    ...shadows.large,
  },
  confirmButton: {
    paddingVertical: spacing.lg,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: spacing.sm,
  },
  skipButtonText: {
    ...typography.body,
    color: colors.gray,
  },
});


