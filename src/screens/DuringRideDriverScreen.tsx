import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Card, SOSButton } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { generateAccurateRoute, Coordinate } from '../utils/routeUtils';
import { updateTrip } from '../services/tripService';
// Using Supabase only - like Grab/Angkas
import { updateDriverStatus } from '../services/driverService';

interface DuringRideDriverScreenProps {
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
      driverLocation?: { latitude: number; longitude: number };
    };
  };
}

export const DuringRideDriverScreen: React.FC<DuringRideDriverScreenProps> = ({ navigation, route }) => {
  const { passengerName, pickupLocation, dropoffLocation, pickupCoordinates, dropoffCoordinates, driverLocation } = route.params;
  const [tripDuration, setTripDuration] = useState(0);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(
    driverLocation || pickupCoordinates || null
  );
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [isNearDropoff, setIsNearDropoff] = useState(false);

  useEffect(() => {
    // Ensure driver status is set to 'on_ride' when on this screen
    const ensureOnRideStatus = async () => {
      try {
        const { getCurrentUser } = require('../utils/sessionHelper');
        const currentUser = await getCurrentUser();
        if (currentUser?.id) {
          await updateDriverStatus(currentUser.id, 'on_ride');
        }
      } catch (error) {
        console.error('Error updating driver status:', error);
      }
    };
    
    ensureOnRideStatus();
    
    if (pickupCoordinates && dropoffCoordinates) {
      const region: Region = {
        latitude: (pickupCoordinates.latitude + dropoffCoordinates.latitude) / 2,
        longitude: (pickupCoordinates.longitude + dropoffCoordinates.longitude) / 2,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setMapRegion(region);
    }

    // Trip duration counter (every minute)
    const durationInterval = setInterval(() => {
      setTripDuration((prev) => prev + 1);
    }, 60000);

    // Real GPS tracking
    let locationSubscription: any = null;
    
    const startGPSTracking = async () => {
      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          // Get initial location
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          
          setCurrentLocation(coords);
          
          // Check distance to dropoff
          if (dropoffCoordinates) {
            const distance = calculateDistance(
              coords.latitude,
              coords.longitude,
              dropoffCoordinates.latitude,
              dropoffCoordinates.longitude
            );
            
            // If within 100 meters of dropoff, enable complete button
            if (distance < 0.1) {
              setIsNearDropoff(true);
            }
          }
          
          // Watch for location updates
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000, // Update every 5 seconds
              distanceInterval: 10, // Or every 10 meters
            },
            (location: any) => {
              const newCoords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };
              
              setCurrentLocation(newCoords);
              
              // Check if near dropoff
              if (dropoffCoordinates) {
                const distance = calculateDistance(
                  newCoords.latitude,
                  newCoords.longitude,
                  dropoffCoordinates.latitude,
                  dropoffCoordinates.longitude
                );
                
                // If within 100 meters of dropoff
                if (distance < 0.1) {
                  setIsNearDropoff(true);
                } else {
                  setIsNearDropoff(false);
                }
              }
            }
          );
        }
      } catch (error) {
        console.error('Error starting GPS tracking:', error);
      }
    };
    
    startGPSTracking();

    return () => {
      clearInterval(durationInterval);
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [dropoffCoordinates]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // Returns distance in kilometers
  };

  const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  // Generate route coordinates when current location or dropoff changes
  useEffect(() => {
    if (currentLocation && dropoffCoordinates) {
      const route = generateAccurateRoute(currentLocation, dropoffCoordinates);
      setRouteCoordinates(route);
    } else {
      setRouteCoordinates([]);
    }
  }, [currentLocation, dropoffCoordinates]);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleCompleteTrip = async () => {
    try {
      // Mark trip as completed
      if (route.params.bookingId) {
        const result = await updateTrip(route.params.bookingId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
        });
        
        if (!result.success) {
          console.error('Error updating trip status:', result.error);
          return;
        }
      }
      
      // Navigate to ride completed screen
      navigation.replace('RideCompleted', {
        ...route.params,
        duration: tripDuration,
      });
    } catch (error) {
      console.error('Error completing trip:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* SOS Button at Top Middle */}
      <View style={styles.sosTopContainer}>
        <SOSButton
          onPress={() => navigation.navigate('SOS')}
        />
      </View>

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
            title="Pickup"
            pinColor={colors.primary}
          />
        )}
        {dropoffCoordinates && (
          <Marker
            coordinate={dropoffCoordinates}
            title="Dropoff"
            pinColor={colors.error}
          />
        )}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Current Location"
          >
            <View style={styles.currentMarker}>
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

      <Card style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.passengerInfo}>
            <View style={styles.passengerAvatarPlaceholder}>
              <Ionicons name="person" size={24} color={colors.white} />
            </View>
            <View style={styles.passengerDetails}>
              <Text style={styles.passengerName}>{passengerName}</Text>
              <Text style={styles.tripStatus}>In Progress</Text>
            </View>
          </View>
          <View style={styles.durationContainer}>
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={styles.durationText}>{formatDuration(tripDuration)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {pickupLocation}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.error }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {dropoffLocation}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Complete Trip Button */}
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleCompleteTrip}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={24} 
            color={colors.white} 
          />
          <Text style={styles.completeButtonText}>
            Complete Trip
          </Text>
        </TouchableOpacity>
      </Card>
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
  tripCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.large,
  },
  tripHeader: {
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    ...typography.bodyBold,
    fontSize: 16,
    marginBottom: 2,
  },
  tripStatus: {
    ...typography.caption,
    color: colors.gray,
    fontSize: 13,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  durationText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  locationInfo: {
    gap: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationText: {
    ...typography.body,
    flex: 1,
    fontSize: 14,
  },
  currentMarker: {
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
  // SOS Button at Top
  sosTopContainer: {
    position: 'absolute',
    top: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  // Complete Trip Button
  completeButton: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
    ...shadows.medium,
  },
  completeButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  completeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  completeButtonTextDisabled: {
    color: colors.gray,
  },
  nearDropoffText: {
    textAlign: 'center',
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});


