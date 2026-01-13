import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBooking } from '../utils/tripStorage';
import { getUserAccount } from '../utils/userStorage';

interface ConfirmBookingScreenProps {
  navigation: any;
  route: {
    params: {
      pickupLocation: string;
      dropoffLocation: string;
      pickupCoordinates?: { latitude: number; longitude: number };
      dropoffCoordinates?: { latitude: number; longitude: number };
      distance: number;
      fareEstimate: { min: number; max: number; base?: number; discountAmount?: number; discountType?: 'senior' | 'pwd' | 'none' };
      eta: string;
      availableDrivers: number;
      rideType?: 'normal' | 'errand';
      errandNotes?: string;
      isSeniorCitizen?: boolean;
      isPWD?: boolean;
      selectedDriver?: {
        id: string;
        name: string;
        distance: string;
        eta: string;
        tricyclePlate?: string;
        rating?: number;
        coordinates: { latitude: number; longitude: number };
      };
    };
  };
}

export const ConfirmBookingScreen: React.FC<ConfirmBookingScreenProps> = ({ navigation, route }) => {
  const { 
    pickupLocation, 
    dropoffLocation, 
    distance, 
    fareEstimate, 
    eta, 
    availableDrivers, 
    rideType = 'normal',
    errandNotes,
    selectedDriver 
  } = route.params;

  const handleBookNow = async () => {
    try {
      // Get passenger account info
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (!currentUserEmail) {
        Alert.alert('Error', 'Please login to book a ride');
        return;
      }

      const passengerAccount = await getUserAccount(currentUserEmail);
      if (!passengerAccount) {
        Alert.alert('Error', 'User account not found');
        return;
      }

      // Create booking with passenger info
      // If a driver was pre-selected, include their ID
      const booking = await createBooking(
        currentUserEmail,
        passengerAccount.fullName,
        passengerAccount.phoneNumber,
        pickupLocation,
        dropoffLocation,
        route.params.pickupCoordinates,
        route.params.dropoffCoordinates,
        distance,
        fareEstimate,
        selectedDriver?.id, // Pre-selected driver ID if available
        rideType, // Ride type (normal or errand)
        errandNotes // Errand notes if errand mode
      );

      // Navigate to searching screen
      navigation.navigate('SearchingDriver', {
        pickupLocation,
        dropoffLocation,
        pickupCoordinates: route.params.pickupCoordinates,
        dropoffCoordinates: route.params.dropoffCoordinates,
        distance,
        fareEstimate,
        bookingId: booking.id,
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
        </View>

        {/* Selected Driver Info (if pre-selected) */}
        {selectedDriver && (
          <Card style={styles.selectedDriverCard}>
            <View style={styles.selectedDriverHeader}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.selectedDriverTitle}>Driver Selected</Text>
            </View>
            <View style={styles.selectedDriverInfo}>
              <Text style={styles.selectedDriverName}>{selectedDriver.name}</Text>
              {selectedDriver.tricyclePlate && (
                <Text style={styles.selectedDriverPlate}>{selectedDriver.tricyclePlate}</Text>
              )}
              <View style={styles.selectedDriverStats}>
                <View style={styles.selectedDriverStat}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={styles.selectedDriverStatText}>{selectedDriver.eta}</Text>
                </View>
                <View style={styles.selectedDriverStat}>
                  <Ionicons name="location-outline" size={14} color={colors.error} />
                  <Text style={styles.selectedDriverStatText}>{selectedDriver.distance}</Text>
                </View>
                {selectedDriver.rating && selectedDriver.rating > 0 && (
                  <View style={styles.selectedDriverStat}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.selectedDriverStatText}>{selectedDriver.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* Route Info */}
        <Card style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Trip Details</Text>
          </View>

          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{pickupLocation}</Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>{dropoffLocation}</Text>
            </View>
          </View>
        </Card>

        {/* Ride Type Badge */}
        {rideType === 'errand' && (
          <Card style={styles.rideTypeBadge}>
            <View style={styles.rideTypeBadgeContent}>
              <Ionicons name="cube" size={20} color={colors.primary} />
              <Text style={styles.rideTypeBadgeText}>Pasabay/Padala Mode</Text>
            </View>
            {errandNotes && (
              <Text style={styles.errandNotesText}>{errandNotes}</Text>
            )}
          </Card>
        )}

        {/* Trip Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Trip Summary</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Distance</Text>
            <Text style={styles.summaryValue}>{distance.toFixed(1)} km</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated Time</Text>
            <Text style={styles.summaryValue}>{eta}</Text>
          </View>

          {rideType === 'errand' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ride Type</Text>
              <Text style={styles.summaryValue}>Pasabay/Padala (+20%)</Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          {fareEstimate.base && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Base Fare</Text>
              <Text style={styles.summaryValue}>₱{fareEstimate.base}</Text>
            </View>
          )}

          {fareEstimate.discountAmount && fareEstimate.discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.discountRow}>
                <Ionicons 
                  name={fareEstimate.discountType === 'senior' ? 'person' : 'heart'} 
                  size={16} 
                  color={colors.success} 
                />
                <Text style={styles.summaryLabel}>
                  {fareEstimate.discountType === 'senior' ? 'Senior Citizen' : 'PWD'} Discount (20%)
                </Text>
              </View>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                -₱{fareEstimate.discountAmount}
              </Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Estimated Fare</Text>
            <Text style={styles.fareAmount}>
              ₱{fareEstimate.min} - ₱{fareEstimate.max}
            </Text>
          </View>
        </Card>

        {/* Available Drivers Info */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            {availableDrivers} drivers available nearby. Your driver will be assigned shortly.
          </Text>
        </View>
      </ScrollView>

      {/* Book Now Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Book Now"
          onPress={handleBookNow}
          variant="primary"
          style={styles.bookButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  selectedDriverCard: {
    marginBottom: spacing.md,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: colors.success,
  },
  selectedDriverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  selectedDriverTitle: {
    ...typography.bodyBold,
    color: colors.success,
  },
  selectedDriverInfo: {
    gap: spacing.xs,
  },
  selectedDriverName: {
    ...typography.h3,
    color: colors.darkText,
  },
  selectedDriverPlate: {
    ...typography.body,
    color: colors.gray,
  },
  selectedDriverStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  selectedDriverStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectedDriverStatText: {
    ...typography.caption,
    color: colors.darkText,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    flex: 1,
  },
  driverCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  driverAvatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  driverAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.lightGray,
  },
  driverAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.white,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    ...typography.h3,
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    ...typography.bodyBold,
    color: colors.warning,
  },
  ridesText: {
    ...typography.caption,
    color: colors.gray,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  tricycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tricycleDetails: {
    flex: 1,
  },
  tricycleLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 2,
  },
  tricyclePlate: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  routeCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  routeHeader: {
    marginBottom: spacing.md,
  },
  routeTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  routeItem: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 2,
  },
  routeText: {
    ...typography.body,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 20,
    marginVertical: spacing.md,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.gray,
  },
  summaryValue: {
    ...typography.bodyBold,
  },
  summaryDivider: {
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
    fontSize: 24,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    lineHeight: 18,
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
  bookButton: {
    paddingVertical: spacing.lg,
  },
  rideTypeBadge: {
    marginBottom: spacing.md,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.medium,
  },
  rideTypeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  rideTypeBadgeText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  errandNotesText: {
    ...typography.body,
    color: colors.darkText,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});


