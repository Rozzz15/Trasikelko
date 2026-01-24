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
// AsyncStorage removed - using Supabase only
import { createTrip } from '../services/tripService';
import { getUserAccount } from '../utils/userStorage';
import { supabase } from '../config/supabase';
import * as Location from 'expo-location';

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
      console.log('[ConfirmBooking] Starting booking process...');
      
      // Get passenger account info
      const { getCurrentUserEmail } = require('../utils/sessionHelper');
      const currentUserEmail = await getCurrentUserEmail();
      console.log('[ConfirmBooking] Current user email:', currentUserEmail);
      
      if (!currentUserEmail) {
        console.error('[ConfirmBooking] ❌ No user email in session');
        Alert.alert('Error', 'Please login to book a ride');
        return;
      }

      console.log('[ConfirmBooking] Getting user account for:', currentUserEmail);
      const passengerAccount = await getUserAccount(currentUserEmail);
      console.log('[ConfirmBooking] Passenger account result:', passengerAccount);
      
      if (!passengerAccount) {
        console.error('[ConfirmBooking] ❌ User account not found in database');
        console.error('[ConfirmBooking] ❌ This means the user does not exist in users table');
        Alert.alert('Error', 'User account not found. Your account may have been deleted or not properly created. Please try logging out and logging in again.');
        return;
      }
      
      console.log('[ConfirmBooking] ✅ User account found:', {
        email: passengerAccount.email,
        fullName: passengerAccount.fullName,
        phoneNumber: passengerAccount.phoneNumber,
      });

      // Get user ID from Supabase
      const { getCurrentUser } = require('../utils/sessionHelper');
      const user = await getCurrentUser();
      
      if (!user || !user.id) {
        console.error('[ConfirmBooking] ❌ User ID not found');
        Alert.alert('Error', 'User session not found. Please login again.');
        return;
      }

      console.log('[ConfirmBooking] Creating trip in Supabase for user:', user.id);

      // Reverse geocode "Current Location" to actual address
      let actualPickupLocation = pickupLocation;
      if (pickupLocation === 'Current Location' && route.params.pickupCoordinates) {
        try {
          console.log('[ConfirmBooking] Converting "Current Location" to actual address...');
          const results = await Location.reverseGeocodeAsync({
            latitude: route.params.pickupCoordinates.latitude,
            longitude: route.params.pickupCoordinates.longitude,
          });
          
          if (results && results.length > 0) {
            const address = results[0];
            const addressParts = [
              address.street,
              address.streetNumber,
              address.name,
              address.district,
              address.city,
              address.subregion,
              address.region,
            ].filter(Boolean);
            
            actualPickupLocation = addressParts.join(', ') || 'Current Location';
            console.log('[ConfirmBooking] Reverse geocoded address:', actualPickupLocation);
          }
        } catch (error) {
          console.error('[ConfirmBooking] Error reverse geocoding:', error);
          // Keep "Current Location" if reverse geocoding fails
        }
      }

      // Verify user exists in users table (required for foreign key constraint)
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (userError || !userRecord) {
        console.error('[ConfirmBooking] ❌ User not found in users table:', userError);
        console.log('[ConfirmBooking] Attempting to auto-fix missing user record...');
        
        // Try to create the missing user record
        const { createMissingUserRecord } = require('../utils/fixMissingUsers');
        const fixResult = await createMissingUserRecord();
        
        if (!fixResult.success) {
          console.error('[ConfirmBooking] ❌ Failed to fix user record:', fixResult.error);
          Alert.alert(
            'Account Setup Error',
            'Your account is not properly set up in the database. Please try:\n\n1. Log out\n2. Log back in\n3. Try booking again\n\nIf this persists, please create a new account.'
          );
          return;
        }
        
        console.log('[ConfirmBooking] ✅ User record created successfully');
      } else {
        console.log('[ConfirmBooking] ✅ User exists in users table');
      }

      // CHECK PROFILES TABLE - This is what the foreign key actually references!
      console.log('[ConfirmBooking] Checking profiles table...');
      const { data: profileRecord, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[ConfirmBooking] Profile record:', profileRecord);

      if (profileError || !profileRecord) {
        console.error('[ConfirmBooking] ❌ Profile record not found:', profileError);
        console.log('[ConfirmBooking] Creating profile record...');
        
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: passengerAccount.fullName,
            phone_number: passengerAccount.phoneNumber,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (createProfileError || !newProfile) {
          console.error('[ConfirmBooking] ❌ Failed to create profile record:', createProfileError);
          Alert.alert('Database Error', `Failed to create profile record: ${createProfileError?.message || 'Unknown error'}`);
          return;
        }
        
        console.log('[ConfirmBooking] ✅ Profile record created:', newProfile);
      } else {
        console.log('[ConfirmBooking] ✅ Profile record exists');
      }

      // ALSO verify user exists in passengers table
      const { data: passengerRecord, error: passengerError } = await supabase
        .from('passengers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('[ConfirmBooking] Passenger record full data:', passengerRecord);

      if (passengerError || !passengerRecord) {
        console.error('[ConfirmBooking] ❌ Passenger record not found:', passengerError);
        console.log('[ConfirmBooking] Creating passenger record...');
        
        const { data: newPassenger, error: createPassengerError } = await supabase
          .from('passengers')
          .insert({
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (createPassengerError || !newPassenger) {
          console.error('[ConfirmBooking] ❌ Failed to create passenger record:', createPassengerError);
          Alert.alert('Database Error', 'Failed to create passenger record. Please contact support.');
          return;
        }
        
        console.log('[ConfirmBooking] ✅ Passenger record created:', newPassenger);
      } else {
        console.log('[ConfirmBooking] ✅ Passenger record exists');
      }

      // Calculate fare values
      const baseFare = fareEstimate?.base || Math.round((fareEstimate.min + fareEstimate.max) / 2);
      const discountAmount = fareEstimate?.discountAmount || 0;
      const finalFare = Math.max(baseFare - discountAmount, 20); // Minimum ₱20

      // Determine correct passenger_id for foreign key
      // Check if passengers table has a separate 'id' column
      let passengerIdForTrip = user.id; // Default to user.id
      
      if (passengerRecord && 'id' in passengerRecord && passengerRecord.id !== user.id) {
        // passengers table has a separate id column (likely serial/auto-increment)
        console.log('[ConfirmBooking] Using passengers.id instead of user.id for trip');
        passengerIdForTrip = passengerRecord.id;
      }
      
      console.log('[ConfirmBooking] passenger_id to use in trip:', passengerIdForTrip);

      // Create booking in Supabase database
      const tripData = {
        passenger_id: passengerIdForTrip,
        driver_id: selectedDriver?.id, // Pre-selected driver ID if available
        pickup_location: actualPickupLocation,
        dropoff_location: dropoffLocation,
        pickup_latitude: route.params.pickupCoordinates?.latitude,
        pickup_longitude: route.params.pickupCoordinates?.longitude,
        dropoff_latitude: route.params.dropoffCoordinates?.latitude,
        dropoff_longitude: route.params.dropoffCoordinates?.longitude,
        distance: distance,
        estimated_fare: baseFare,
        base_fare: baseFare,
        discount_amount: discountAmount,
        discount_type: fareEstimate?.discountType || 'none',
        fare: finalFare,
        ride_type: rideType || 'normal',
        errand_notes: errandNotes,
        status: 'searching' as const,
        payment_method: 'cash' as const,
        payment_status: 'pending' as const,
      };

      console.log('[ConfirmBooking] Trip data:', tripData);

      // Try to insert directly to get more detailed error info
      console.log('[ConfirmBooking] Attempting direct insert to trips table...');
      const { data: directInsert, error: directError } = await supabase
        .from('trips')
        .insert(tripData)
        .select()
        .single();

      if (directError) {
        console.error('[ConfirmBooking] ❌ Direct insert error:', directError);
        console.error('[ConfirmBooking] ❌ Error details:', JSON.stringify(directError, null, 2));
        console.error('[ConfirmBooking] ❌ Error hint:', directError.hint);
        console.error('[ConfirmBooking] ❌ Error detail:', directError.details);
        
        // The error message should tell us what table/column the FK references
        Alert.alert(
          'Database Error',
          `Failed to create trip: ${directError.message}\n\nThis is a database configuration issue. The foreign key constraint needs to be fixed in Supabase.`
        );
        return;
      }

      console.log('[ConfirmBooking] ✅ Trip created successfully:', directInsert.id);
      
      const result = { success: true, trip: directInsert };

      console.log('[ConfirmBooking] ✅ Trip created successfully:', result.trip.id);

      // Navigate to searching screen
      navigation.navigate('SearchingDriver', {
        pickupLocation,
        dropoffLocation,
        pickupCoordinates: route.params.pickupCoordinates,
        dropoffCoordinates: route.params.dropoffCoordinates,
        distance,
        fareEstimate,
        bookingId: result.trip.id,
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
                  {fareEstimate.discountType === 'senior' ? 'Senior Citizen' : 'PWD'} Discount
                </Text>
              </View>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                -₱{fareEstimate.discountAmount}
              </Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.fareAmount}>
              ₱{fareEstimate.base ? (fareEstimate.base - (fareEstimate.discountAmount || 0)) : fareEstimate.min}
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


