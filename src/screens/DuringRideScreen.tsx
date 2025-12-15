import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Card, Button, SOSButton } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { generateAccurateRoute, Coordinate } from '../utils/routeUtils';

interface DuringRideScreenProps {
  navigation: any;
  route: {
    params: {
      pickupLocation: string;
      dropoffLocation: string;
      pickupCoordinates?: { latitude: number; longitude: number };
      dropoffCoordinates?: { latitude: number; longitude: number };
      driver: {
        name: string;
        photo?: string;
        rating: number;
        tricyclePlate: string;
      };
      driverLocation?: { latitude: number; longitude: number };
    };
  };
}

export const DuringRideScreen: React.FC<DuringRideScreenProps> = ({ navigation, route }) => {
  const { driver, pickupCoordinates, dropoffCoordinates, driverLocation } = route.params;
  const [tripDuration, setTripDuration] = useState(0); // in minutes
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(
    driverLocation || pickupCoordinates || null
  );
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);

  useEffect(() => {
    // Initialize map
    if (pickupCoordinates && dropoffCoordinates) {
      const region: Region = {
        latitude: (pickupCoordinates.latitude + dropoffCoordinates.latitude) / 2,
        longitude: (pickupCoordinates.longitude + dropoffCoordinates.longitude) / 2,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setMapRegion(region);
    }
    
    // Simulate trip progress
    const durationInterval = setInterval(() => {
      setTripDuration((prev) => prev + 1);
      
      // Simulate moving towards destination
      if (currentLocation && dropoffCoordinates) {
        const progress = Math.min(tripDuration / 10, 0.9); // Assume 10 min trip
        setCurrentLocation({
          latitude: currentLocation.latitude + (dropoffCoordinates.latitude - currentLocation.latitude) * 0.1,
          longitude: currentLocation.longitude + (dropoffCoordinates.longitude - currentLocation.longitude) * 0.1,
        });
      }
    }, 60000); // Update every minute

    // Simulate trip completion after 5 minutes
    const completionTimeout = setTimeout(() => {
      navigation.replace('EndOfRide', {
        ...route.params,
        duration: tripDuration + 1,
      });
    }, 300000); // 5 minutes for demo

    return () => {
      clearInterval(durationInterval);
      clearTimeout(completionTimeout);
    };
  }, []);

  // Generate route coordinates when current location or dropoff changes
  useEffect(() => {
    if (currentLocation && dropoffCoordinates) {
      const route = generateAccurateRoute(currentLocation, dropoffCoordinates);
      setRouteCoordinates(route);
    } else {
      setRouteCoordinates([]);
    }
  }, [currentLocation, dropoffCoordinates]);

  const handleCallDriver = () => {
    console.log('Calling driver...');
  };

  const handleMessageDriver = () => {
    console.log('Messaging driver...');
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
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

      {/* Trip Info Card */}
      <Card style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatarPlaceholder}>
              <Ionicons name="person" size={24} color={colors.white} />
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.tricyclePlate}>{driver.tricyclePlate}</Text>
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
              {route.params.pickupLocation}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.error }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {route.params.dropoffLocation}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCallDriver}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={24} color={colors.primary} />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleMessageDriver}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble" size={24} color={colors.primary} />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
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
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    ...typography.bodyBold,
    fontSize: 16,
    marginBottom: 2,
  },
  tricyclePlate: {
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
    marginBottom: spacing.md,
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
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    ...typography.bodyBold,
    color: colors.primary,
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
});


