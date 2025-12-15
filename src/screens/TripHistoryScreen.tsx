import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, BottomNavigation } from '../components';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface TripHistoryScreenProps {
  userType: 'passenger' | 'driver';
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface Trip {
  id: string;
  date: string;
  time: string;
  pickup: string;
  dropoff: string;
  fare: string;
  driverName?: string;
  passengerName?: string;
  status: 'completed' | 'cancelled';
}

export const TripHistoryScreen: React.FC<TripHistoryScreenProps> = ({
  userType,
  activeTab,
  onTabChange,
}) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load real trip data from storage
  useEffect(() => {
    const loadTrips = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const currentUserEmail = await AsyncStorage.getItem('current_user_email');
        if (currentUserEmail) {
          const { getTripsByUserId } = require('../utils/tripStorage');
          const userTrips = await getTripsByUserId(currentUserEmail, userType);
          
          // Convert Trip format to display format
          const formattedTrips: Trip[] = userTrips
            .filter((trip: any) => trip.status === 'completed')
            .map((trip: any) => ({
              id: trip.id,
              date: new Date(trip.completedAt || trip.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              }),
              time: new Date(trip.completedAt || trip.createdAt).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              }),
              pickup: trip.pickupLocation,
              dropoff: trip.dropoffLocation,
              fare: `₱${trip.fare || 0}`,
              driverName: userType === 'passenger' ? trip.driverName : undefined,
              passengerName: userType === 'driver' ? trip.passengerName : undefined,
              status: 'completed' as const,
            }))
            .sort((a: any, b: any) => {
              // Sort by date (newest first)
              const dateA = new Date(a.date + ' ' + a.time);
              const dateB = new Date(b.date + ' ' + b.time);
              return dateB.getTime() - dateA.getTime();
            });
          
          setTrips(formattedTrips);
          
          if (userType === 'driver') {
            const earnings = formattedTrips.reduce((sum, trip) => {
              const fare = parseInt(trip.fare.replace('₱', '')) || 0;
              return sum + fare;
            }, 0);
            setTotalEarnings(earnings);
          }
        }
      } catch (error) {
        console.error('Error loading trips:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTrips();
  }, [userType]);

  const tabs = [
    { name: 'home', label: 'Home', icon: 'home-outline' as const, activeIcon: 'home' as const },
    { name: 'trips', label: 'Trips', icon: 'time-outline' as const, activeIcon: 'time' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {userType === 'passenger' ? 'Trip History' : 'Completed Rides'}
          </Text>
          {userType === 'driver' && (
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Total Earnings</Text>
              <Text style={styles.earningsAmount}>₱{totalEarnings}</Text>
            </View>
          )}
        </View>

        {/* Trip List */}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyStateText}>Loading trips...</Text>
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color={colors.gray} />
            <Text style={styles.emptyStateText}>No trips yet</Text>
            <Text style={styles.emptyStateSubtext}>
              {userType === 'passenger' 
                ? 'Book your first ride to get started'
                : 'Start accepting bookings to see your trips'}
            </Text>
          </View>
        ) : (
          <View style={styles.tripList}>
            {trips.map((trip) => (
              <Card key={trip.id} style={styles.tripCard} variant="elevated">
                <View style={styles.tripHeader}>
                  <View style={styles.tripDate}>
                    <Text style={styles.tripDateText}>{trip.date}</Text>
                    <Text style={styles.tripTimeText}>{trip.time}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    trip.status === 'completed' && styles.statusBadgeCompleted
                  ]}>
                    <Text style={[
                      styles.statusText,
                      trip.status === 'completed' && styles.statusTextCompleted
                    ]}>
                      {trip.status === 'completed' ? 'Completed' : 'Cancelled'}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripRoute}>
                  <View style={styles.routeItem}>
                    <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                    <View style={styles.routeContent}>
                      <Text style={styles.routeLabel}>Pickup</Text>
                      <Text style={styles.routeText}>{trip.pickup}</Text>
                    </View>
                  </View>

                  <View style={styles.routeDivider} />

                  <View style={styles.routeItem}>
                    <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
                    <View style={styles.routeContent}>
                      <Text style={styles.routeLabel}>Dropoff</Text>
                      <Text style={styles.routeText}>{trip.dropoff}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.tripFooter}>
                  <View style={styles.tripInfo}>
                    {userType === 'passenger' && trip.driverName && (
                      <View style={styles.infoItem}>
                        <Ionicons name="person" size={16} color={colors.gray} />
                        <Text style={styles.infoText}>{trip.driverName}</Text>
                      </View>
                    )}
                    {userType === 'driver' && trip.passengerName && (
                      <View style={styles.infoItem}>
                        <Ionicons name="person" size={16} color={colors.gray} />
                        <Text style={styles.infoText}>{trip.passengerName}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.fareContainer}>
                    <Text style={styles.fareAmount}>{trip.fare}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={onTabChange}
      />
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
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.md,
  },
  earningsCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  earningsLabel: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  earningsAmount: {
    ...typography.h1,
    color: colors.white,
  },
  tripList: {
    gap: spacing.md,
  },
  tripCard: {
    padding: spacing.md,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tripDate: {
    flex: 1,
  },
  tripDateText: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  tripTimeText: {
    ...typography.caption,
    color: colors.gray,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.lightGray,
  },
  statusBadgeCompleted: {
    backgroundColor: '#E8F5E9',
  },
  statusText: {
    ...typography.caption,
    color: colors.gray,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: colors.success,
  },
  tripRoute: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  routeItem: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    marginLeft: 18,
    marginVertical: spacing.xs,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tripInfo: {
    flex: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.gray,
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fareAmount: {
    ...typography.h3,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyStateText: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
  },
});





