import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { getActiveTrip } from '../services/tripService';
// Using Supabase only - no AsyncStorage

interface SearchingDriverScreenProps {
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

export const SearchingDriverScreen: React.FC<SearchingDriverScreenProps> = ({ navigation, route }) => {
  const [searchTime, setSearchTime] = useState(0);
  const [driverFound, setDriverFound] = useState(false);

  useEffect(() => {
    let searchInterval: NodeJS.Timeout;
    
    // Check for driver acceptance periodically
    const checkForDriver = async () => {
      try {
        const { getCurrentUser } = require('../utils/sessionHelper');
        const user = await getCurrentUser();
        if (user && user.id) {
          const activeTrip = await getActiveTrip(user.id, 'passenger');
          if (activeTrip && activeTrip.driver_id && activeTrip.status === 'driver_accepted') {
            setDriverFound(true);
            if (searchInterval) {
              clearInterval(searchInterval);
            }
            
            // Navigate to driver found screen
            setTimeout(() => {
              navigation.replace('DriverFound', {
                ...route.params,
                driver: {
                  name: activeTrip.driver_name || 'Driver',
                  photo: activeTrip.driver_photo,
                  rating: 4.8, // Could be stored in driver account
                  totalRides: 120, // Could be calculated from trip history
                  tricyclePlate: activeTrip.tricycle_plate || 'N/A',
                  estimatedArrival: '3 min',
                },
              });
            }, 1000);
          }
        }
      } catch (error) {
        console.error('Error checking for driver:', error);
      }
    };

    // Update search time and check for driver
    searchInterval = setInterval(() => {
      setSearchTime((prev) => prev + 1);
      // Check for driver every second
      checkForDriver();
    }, 1000);

    // Initial check
    checkForDriver();

    return () => {
      if (searchInterval) {
        clearInterval(searchInterval);
      }
    };
  }, []);

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Loading Animation */}
        <View style={styles.loadingContainer}>
          <View style={styles.iconContainer}>
            {driverFound ? (
              <Ionicons name="checkmark-circle" size={80} color={colors.success || colors.primary} />
            ) : (
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
            )}
          </View>
        </View>

        {/* Status Text */}
        <View style={styles.textContainer}>
          <Text style={styles.mainText}>
            {driverFound ? 'Driver Found!' : 'Finding your Tricycle...'}
          </Text>
          <Text style={styles.subText}>
            {driverFound
              ? 'Connecting you with your driver'
              : 'Searching for nearby available drivers'}
          </Text>
        </View>

        {/* Trip Info Card */}
        <Card style={styles.tripCard}>
          <View style={styles.tripInfo}>
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
        </Card>

        {/* Cancel Button */}
        {!driverFound && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingContainer: {
    marginBottom: spacing.xl,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 150,
  },
  loader: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  mainText: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subText: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    fontSize: 16,
  },
  tripCard: {
    width: '100%',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  tripInfo: {
    gap: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationText: {
    ...typography.body,
    flex: 1,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.error,
    fontSize: 16,
  },
});


