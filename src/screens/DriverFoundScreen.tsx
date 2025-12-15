import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { Card, Button } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface DriverFoundScreenProps {
  navigation: any;
  route: {
    params: {
      pickupLocation: string;
      dropoffLocation: string;
      pickupCoordinates?: { latitude: number; longitude: number };
      dropoffCoordinates?: { latitude: number; longitude: number };
      distance: number;
      fareEstimate: { min: number; max: number };
      driver: {
        name: string;
        photo?: string;
        rating: number;
        totalRides: number;
        tricyclePlate: string;
        estimatedArrival: string;
      };
    };
  };
}

export const DriverFoundScreen: React.FC<DriverFoundScreenProps> = ({ navigation, route }) => {
  const { driver, pickupLocation, dropoffLocation, pickupCoordinates, dropoffCoordinates } = route.params;
  const [eta, setEta] = useState(driver.estimatedArrival);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const initializeMap = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && pickupCoordinates) {
          // Driver location will be updated from real-time location tracking
          // For now, use pickup location as initial position
          const initialDriverLocation = {
            latitude: pickupCoordinates.latitude,
            longitude: pickupCoordinates.longitude,
          };
          setDriverLocation(initialDriverLocation);

          const region: Region = {
            latitude: pickupCoordinates.latitude,
            longitude: pickupCoordinates.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          };
          setMapRegion(region);
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();

    // Simulate ETA countdown
    const etaInterval = setInterval(() => {
      setEta((prev) => {
        const minutes = parseInt(prev.split(' ')[0]);
        if (minutes > 1) {
          return `${minutes - 1} min`;
        }
        return 'Arriving now';
      });
    }, 30000); // Update every 30 seconds

    // Simulate driver arriving and starting trip
    const arrivalTimeout = setTimeout(() => {
      navigation.replace('DuringRide', {
        ...route.params,
        driverLocation: driverLocation || pickupCoordinates,
      });
    }, 120000); // 2 minutes for demo

    return () => {
      clearInterval(etaInterval);
      clearTimeout(arrivalTimeout);
    };
  }, []);

  const handleCallDriver = () => {
    // In real app, this would initiate a call
    console.log('Calling driver...');
  };

  const handleMessageDriver = () => {
    // In real app, this would open chat
    console.log('Messaging driver...');
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
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title={driver.name}
          >
            <View style={styles.driverMarkerContainer}>
              <View style={styles.driverMarker}>
                <Image 
                  source={require('../../assets/TRAYSIKEL.png')} 
                  style={styles.driverMarkerImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Driver Info Card */}
      <Card style={styles.driverCard}>
        <View style={styles.driverHeader}>
          <View style={styles.driverInfoSection}>
            <View style={styles.driverAvatarContainer}>
              {driver.photo ? (
                <Image source={{ uri: driver.photo }} style={styles.driverAvatar} />
              ) : (
                <View style={styles.driverAvatarPlaceholder}>
                  <Ionicons name="person" size={30} color={colors.white} />
                </View>
              )}
              <View style={styles.onlineIndicator} />
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text style={styles.ratingText}>{driver.rating}</Text>
                <Text style={styles.ridesText}>({driver.totalRides} rides)</Text>
              </View>
              <Text style={styles.tricyclePlate}>{driver.tricyclePlate}</Text>
            </View>
          </View>
          <View style={styles.etaContainer}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaValue}>{eta}</Text>
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
  driverCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.large,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  driverInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.lightGray,
  },
  driverAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  ratingText: {
    ...typography.bodyBold,
    color: colors.warning,
    fontSize: 14,
  },
  ridesText: {
    ...typography.caption,
    color: colors.gray,
    fontSize: 12,
  },
  tricyclePlate: {
    ...typography.body,
    color: colors.gray,
    fontSize: 13,
  },
  etaContainer: {
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 80,
  },
  etaLabel: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 11,
    marginBottom: 2,
  },
  etaValue: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
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
  driverMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    ...shadows.medium,
  },
  driverMarkerImage: {
    width: 32,
    height: 32,
  },
});


