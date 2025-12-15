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
import { updateTrip, setActiveTrip } from '../utils/tripStorage';
import { updateDriverStatus } from '../utils/driverLocationStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RideCompletedScreenProps {
  navigation: any;
  route: {
    params: {
      bookingId: string;
      passengerName: string;
      passengerPhone: string;
      pickupLocation: string;
      dropoffLocation: string;
      fare: string;
      distance: string;
      duration?: number;
    };
  };
}

export const RideCompletedScreen: React.FC<RideCompletedScreenProps> = ({ navigation, route }) => {
  const { passengerName, pickupLocation, dropoffLocation, fare, distance, duration = 5 } = route.params;
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | null>(null);
  const [paymentCollected, setPaymentCollected] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const fareAmount = parseInt(fare.replace('₱', ''));

  const handlePaymentMethodSelect = (method: 'cash' | 'gcash') => {
    setPaymentMethod(method);
  };

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      Alert.alert('Select Payment Method', 'Please choose the payment method used');
      return;
    }

    setPaymentCollected(true);

    // Update trip with payment info and mark as completed
    try {
      if (route.params.bookingId) {
        await updateTrip(route.params.bookingId, {
          status: 'completed',
          paymentMethod,
          paymentStatus: 'completed',
          completedAt: new Date().toISOString(),
        });
      } else {
        // Fallback: update last trip if bookingId not available
        const trips = await AsyncStorage.getItem('trips');
        if (trips) {
          const tripsArray = JSON.parse(trips);
          const lastTrip = tripsArray[tripsArray.length - 1];
          if (lastTrip) {
            lastTrip.paymentMethod = paymentMethod;
            lastTrip.paymentStatus = 'completed';
            lastTrip.status = 'completed';
            lastTrip.completedAt = new Date().toISOString();
            await AsyncStorage.setItem('trips', JSON.stringify(tripsArray));
          }
        }
      }
    } catch (error) {
      console.error('Error updating trip payment:', error);
    }

    setTimeout(() => {
      setShowRating(true);
    }, 500);
  };

  const handleRatingSubmit = async (ratingValue: number, feedbackText?: string) => {
    setRating(ratingValue);
    setFeedback(feedbackText || '');

    try {
      // Update trip with rating
      if (route.params.bookingId) {
        await updateTrip(route.params.bookingId, {
          driverRating: ratingValue,
          driverFeedback: feedbackText,
          status: 'completed',
        });
      } else {
        // Fallback: update last trip if bookingId not available
        const trips = await AsyncStorage.getItem('trips');
        if (trips) {
          const tripsArray = JSON.parse(trips);
          const lastTrip = tripsArray[tripsArray.length - 1];
          if (lastTrip) {
            lastTrip.driverRating = ratingValue;
            lastTrip.driverFeedback = feedbackText;
            lastTrip.status = 'completed';
            await AsyncStorage.setItem('trips', JSON.stringify(tripsArray));
          }
        }
      }
      
      // Clear active trip
      await setActiveTrip(null);
      
      // Reset driver status to 'available' after trip completion
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (currentUserEmail) {
        await updateDriverStatus(currentUserEmail, 'available');
      }
    } catch (error) {
      console.error('Error updating trip rating:', error);
    }

    Alert.alert(
      'Thank You!',
      'Your rating has been submitted. Ride completed successfully!',
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'DriverHome' }],
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
                    onPress: async () => {
                      // Update trip status to completed and clear active trip
                      try {
                        if (route.params.bookingId) {
                          await updateTrip(route.params.bookingId, {
                            status: 'completed',
                            completedAt: new Date().toISOString(),
                          });
                        }
                        await setActiveTrip(null);
                        
                        // Reset driver status to 'available' when skipping rating
                        const currentUserEmail = await AsyncStorage.getItem('current_user_email');
                        if (currentUserEmail) {
                          await updateDriverStatus(currentUserEmail, 'available');
                        }
                      } catch (error) {
                        console.error('Error resetting driver status:', error);
                      }
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'DriverHome' }],
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
            title="Rate your Passenger"
            subtitle={`How was your ride with ${passengerName}?`}
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
        <View style={styles.header}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>
          <Text style={styles.headerTitle}>Ride Completed!</Text>
          <Text style={styles.headerSubtitle}>Great job!</Text>
        </View>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Trip Summary</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="person" size={20} color={colors.primary} />
              <View style={styles.summaryItemContent}>
                <Text style={styles.summaryLabel}>Passenger</Text>
                <Text style={styles.summaryValue}>{passengerName}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="navigate" size={20} color={colors.primary} />
              <View style={styles.summaryItemContent}>
                <Text style={styles.summaryLabel}>Distance</Text>
                <Text style={styles.summaryValue}>{distance}</Text>
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
            <Text style={styles.fareAmount}>{fare}</Text>
          </View>
        </Card>

        <Card style={styles.routeCard}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationText}>{pickupLocation}</Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.error }]} />
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>Dropoff</Text>
              <Text style={styles.locationText}>{dropoffLocation}</Text>
            </View>
          </View>
        </Card>

        {!paymentCollected && (
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

        {paymentCollected && (
          <Card style={styles.confirmedCard}>
            <View style={styles.confirmedContent}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <Text style={styles.confirmedText}>Payment Collected</Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {!paymentCollected && (
        <View style={styles.buttonContainer}>
          <Button
            title="Confirm Payment Collected"
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
  routeCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  locationRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 2,
  },
  locationText: {
    ...typography.body,
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


