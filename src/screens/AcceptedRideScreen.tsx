import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Card, Button, SOSButton } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { generateAccurateRoute, Coordinate } from '../utils/routeUtils';
import { updateTrip, getTrips } from '../utils/tripStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDriverStatus, updateDriverLocation } from '../utils/driverLocationStorage';
import { getUserAccount } from '../utils/userStorage';

interface AcceptedRideScreenProps {
  navigation: any;
  route: {
    params: {
      bookingId: string;
      passengerName: string;
      passengerPhone: string;
      pickupLocation: string;
      dropoffLocation: string;
      pickupCoordinates?: { latitude: number; longitude: number };
      dropoffCoordinates?: { latitude: number; longitude: number };
      fare: string;
      distance: string;
    };
  };
}

export const AcceptedRideScreen: React.FC<AcceptedRideScreenProps> = ({ navigation, route }) => {
  const {
    passengerName,
    passengerPhone,
    pickupLocation,
    dropoffLocation,
    pickupCoordinates,
    dropoffCoordinates,
  } = route.params;
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [hasArrived, setHasArrived] = useState(false);
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [tripStarted, setTripStarted] = useState(false);
  const [rideType, setRideType] = useState<'normal' | 'errand'>('normal');
  const [errandNotes, setErrandNotes] = useState<string>('');

  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Get trip details to determine ride type
        if (route.params.bookingId) {
          const trips = await getTrips();
          const trip = trips.find(t => t.id === route.params.bookingId);
          if (trip) {
            setRideType(trip.rideType || 'normal');
            setErrandNotes(trip.errandNotes || '');
          }
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setDriverLocation(coords);

          if (pickupCoordinates) {
            const region: Region = {
              latitude: (coords.latitude + pickupCoordinates.latitude) / 2,
              longitude: (coords.longitude + pickupCoordinates.longitude) / 2,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            };
            setMapRegion(region);
          }
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();
  }, []);

  // Generate route coordinates when driver location or pickup coordinates change
  useEffect(() => {
    if (driverLocation && pickupCoordinates) {
      const route = generateAccurateRoute(driverLocation, pickupCoordinates);
      setRouteCoordinates(route);
    } else {
      setRouteCoordinates([]);
    }
  }, [driverLocation, pickupCoordinates]);

  const handleArrived = async () => {
    setHasArrived(true);
    
    // Update trip status to 'arrived'
    try {
      if (route.params.bookingId) {
        await updateTrip(route.params.bookingId, {
          status: 'arrived',
        });
      }
    } catch (error) {
      console.error('Error updating trip status:', error);
    }
    
    Alert.alert('Arrived', 'You have arrived at the pickup location');
  };

  const handleConfirmPickup = async () => {
    setPickupConfirmed(true);
    
    // Update trip status to 'in_progress' when pickup is confirmed
    // According to the documented flow: "Driver confirms passenger or item pickup"
    // "The system updates the booking status to In Progress"
    try {
      if (route.params.bookingId) {
        await updateTrip(route.params.bookingId, {
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating trip status:', error);
    }
    
    Alert.alert(
      rideType === 'errand' ? 'Item Pickup Confirmed' : 'Passenger Pickup Confirmed',
      rideType === 'errand' 
        ? 'Item/package pickup confirmed. You can now start the trip.' 
        : 'Passenger pickup confirmed. You can now start the trip.'
    );
  };

  const handleStartTrip = async () => {
    if (!pickupConfirmed) {
      Alert.alert('Pickup Not Confirmed', 'Please confirm pickup before starting the trip.');
      return;
    }

    setTripStarted(true);
    
    // Ensure trip status is in_progress (should already be set by confirm pickup)
    try {
      if (route.params.bookingId) {
        await updateTrip(route.params.bookingId, {
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        });
      }
      
      // Update driver status to 'on_ride' when trip actually starts
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (currentUserEmail) {
        await updateDriverStatus(currentUserEmail, 'on_ride');
        
        // Update driver location with on_ride status
        const driverAccount = await getUserAccount(currentUserEmail);
        if (driverAccount && driverLocation) {
          await updateDriverLocation(
            currentUserEmail,
            currentUserEmail,
            driverAccount.fullName || 'Driver',
            driverLocation.latitude,
            driverLocation.longitude,
            true,
            'on_ride',
            driverAccount.plateNumber,
            undefined, // rating not stored in UserAccount
            undefined  // totalRides not stored in UserAccount
          );
        }
      }
    } catch (error) {
      console.error('Error updating trip status:', error);
    }
    
    navigation.replace('DuringRideDriver', {
      ...route.params,
      driverLocation,
    });
  };

  const handleCallPassenger = () => {
    console.log('Calling passenger...');
  };

  const handleMessagePassenger = () => {
    console.log('Messaging passenger...');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map View */}
      <MapView
        style={styles.map}
        region={
          mapRegion || {
            latitude: 14.5995,
            longitude: 120.9842,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }
        }
        showsUserLocation
      >
        {pickupCoordinates && (
          <Marker
            coordinate={pickupCoordinates}
            title="Pickup Location"
            pinColor={colors.primary}
          />
        )}
        {dropoffCoordinates && (
          <Marker
            coordinate={dropoffCoordinates}
            title="Dropoff Location"
            pinColor={colors.error}
          />
        )}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Your Location"
          >
            <View style={styles.driverMarker}>
              <Image 
                source={require('../../assets/TRAYSIKEL.png')} 
                style={styles.driverMarkerImage}
                resizeMode="contain"
              />
            </View>
          </Marker>
        )}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Passenger Info Card */}
      <Card style={styles.passengerCard}>
        <View style={styles.passengerHeader}>
          <View style={styles.passengerInfo}>
            <View style={styles.passengerAvatarPlaceholder}>
              <Ionicons name="person" size={30} color={colors.white} />
            </View>
            <View style={styles.passengerDetails}>
              <Text style={styles.passengerName}>{passengerName}</Text>
              <Text style={styles.passengerPhone}>{passengerPhone}</Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCallPassenger}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleMessagePassenger}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.locationInfo}>
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
        </View>

        <View style={styles.tripStats}>
          <View style={styles.statItem}>
            <Ionicons name="cash-outline" size={20} color={colors.success} />
            <Text style={styles.statValue}>{route.params.fare}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{route.params.distance}</Text>
          </View>
        </View>

        {rideType === 'errand' && errandNotes && (
          <View style={styles.errandInfo}>
            <Ionicons name="cube-outline" size={16} color={colors.primary} />
            <Text style={styles.errandInfoText}>{errandNotes}</Text>
          </View>
        )}

        {!hasArrived && (
          <Button
            title="I've Arrived"
            onPress={handleArrived}
            variant="primary"
            style={styles.arrivedButton}
          />
        )}

        {hasArrived && !pickupConfirmed && (
          <Button
            title={rideType === 'errand' ? 'Confirm Item Pickup' : 'Confirm Passenger Pickup'}
            onPress={handleConfirmPickup}
            variant="primary"
            style={styles.confirmPickupButton}
          />
        )}

        {hasArrived && pickupConfirmed && !tripStarted && (
          <Button
            title="Start Trip"
            onPress={handleStartTrip}
            variant="primary"
            style={styles.startButton}
          />
        )}
      </Card>

      {/* SOS Button */}
      <SOSButton
        onPress={() => navigation.navigate('SOS')}
        variant="floating"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  passengerCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.large,
  },
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  passengerPhone: {
    ...typography.body,
    color: colors.gray,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  locationInfo: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statValue: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  arrivedButton: {
    marginTop: spacing.sm,
  },
  confirmPickupButton: {
    marginTop: spacing.sm,
  },
  startButton: {
    marginTop: spacing.sm,
  },
  errandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#E3F2FD',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errandInfoText: {
    ...typography.body,
    flex: 1,
    fontSize: 13,
    color: colors.darkText,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    ...shadows.medium,
  },
  driverMarkerImage: {
    width: 28,
    height: 28,
  },
});

