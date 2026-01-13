import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
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
  dateObject?: Date; // Store original date for filtering
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
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [fullTripData, setFullTripData] = useState<Map<string, any>>(new Map());

  // Load real trip data from storage
  useEffect(() => {
    const loadTrips = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const currentUserEmail = await AsyncStorage.getItem('current_user_email');
        if (currentUserEmail) {
          const { getTripsByUserId } = require('../utils/tripStorage');
          const userTrips = await getTripsByUserId(currentUserEmail, userType);
          
          // Calculate earnings first using original trip data
          if (userType === 'driver') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            weekAgo.setHours(0, 0, 0, 0);
            
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            monthAgo.setHours(0, 0, 0, 0);
            
            // Calculate earnings by period using original trip dates
            let todayTotal = 0;
            let weeklyTotal = 0;
            let monthlyTotal = 0;
            let totalTotal = 0;
            
            const completedTrips = userTrips.filter((trip: any) => trip.status === 'completed');
            completedTrips.forEach((trip: any) => {
              const fare = trip.fare || 0;
              totalTotal += fare;
              
              const tripDate = new Date(trip.completedAt || trip.createdAt);
              const tripDateOnly = new Date(tripDate);
              tripDateOnly.setHours(0, 0, 0, 0);
              
              if (tripDateOnly >= today) {
                todayTotal += fare;
              }
              if (tripDate >= weekAgo) {
                weeklyTotal += fare;
              }
              if (tripDate >= monthAgo) {
                monthlyTotal += fare;
              }
            });
            
            setTotalEarnings(totalTotal);
            setTodayEarnings(todayTotal);
            setWeeklyEarnings(weeklyTotal);
            setMonthlyEarnings(monthlyTotal);
          }
          
          // Store full trip data for detail view
          const tripDataMap = new Map<string, any>();
          
          // Convert Trip format to display format
          const formattedTrips: Trip[] = userTrips
            .filter((trip: any) => trip.status === 'completed')
            .map((trip: any) => {
              // Store full trip data for detail view
              tripDataMap.set(trip.id, trip);
              
              const tripDate = new Date(trip.completedAt || trip.createdAt);
              return {
                id: trip.id,
                date: tripDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }),
                time: tripDate.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                }),
                dateObject: tripDate, // Store original date for filtering
                pickup: trip.pickupLocation,
                dropoff: trip.dropoffLocation,
                fare: `₱${trip.fare || 0}`,
                driverName: userType === 'passenger' ? trip.driverName : undefined,
                passengerName: userType === 'driver' ? trip.passengerName : undefined,
                status: 'completed' as const,
              };
            })
            .sort((a: any, b: any) => {
              // Sort by date (newest first)
              return b.dateObject.getTime() - a.dateObject.getTime();
            });
          
          setTrips(formattedTrips);
          setFullTripData(tripDataMap);
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
            <>
              <View style={styles.earningsCard}>
                <Text style={styles.earningsLabel}>
                  {selectedPeriod === 'today' ? 'Today\'s Earnings' :
                   selectedPeriod === 'week' ? 'This Week\'s Earnings' :
                   selectedPeriod === 'month' ? 'This Month\'s Earnings' :
                   'Total Earnings'}
                </Text>
                <Text style={styles.earningsAmount}>
                  ₱{selectedPeriod === 'today' ? todayEarnings.toFixed(2) :
                     selectedPeriod === 'week' ? weeklyEarnings.toFixed(2) :
                     selectedPeriod === 'month' ? monthlyEarnings.toFixed(2) :
                     totalEarnings.toFixed(2)}
                </Text>
              </View>
              
              {/* Period Filter */}
              <View style={styles.periodFilter}>
                <TouchableOpacity
                  style={[styles.periodButton, selectedPeriod === 'all' && styles.periodButtonActive]}
                  onPress={() => setSelectedPeriod('all')}
                >
                  <Text style={[styles.periodButtonText, selectedPeriod === 'all' && styles.periodButtonTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, selectedPeriod === 'today' && styles.periodButtonActive]}
                  onPress={() => setSelectedPeriod('today')}
                >
                  <Text style={[styles.periodButtonText, selectedPeriod === 'today' && styles.periodButtonTextActive]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
                  onPress={() => setSelectedPeriod('week')}
                >
                  <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>Week</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
                  onPress={() => setSelectedPeriod('month')}
                >
                  <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>Month</Text>
                </TouchableOpacity>
              </View>
            </>
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
            {trips
              .filter((trip) => {
                if (userType === 'passenger' || selectedPeriod === 'all') {
                  return true;
                }
                if (!trip.dateObject) {
                  return true; // Include if date object missing
                }
                
                const tripDate = new Date(trip.dateObject);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                weekAgo.setHours(0, 0, 0, 0);
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                monthAgo.setHours(0, 0, 0, 0);
                
                if (selectedPeriod === 'today') {
                  const tripDateOnly = new Date(tripDate);
                  tripDateOnly.setHours(0, 0, 0, 0);
                  return tripDateOnly >= today;
                } else if (selectedPeriod === 'week') {
                  return tripDate >= weekAgo;
                } else if (selectedPeriod === 'month') {
                  return tripDate >= monthAgo;
                }
                return true;
              })
              .map((trip) => (
              <TouchableOpacity
                key={trip.id}
                onPress={() => {
                  setSelectedTrip(trip);
                  setShowTripDetails(true);
                }}
                activeOpacity={0.7}
              >
                <Card style={styles.tripCard} variant="elevated">
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
                  <View style={styles.viewDetailsHint}>
                    <Text style={styles.viewDetailsText}>Tap to view details</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray} />
                  </View>
                </Card>
              </TouchableOpacity>
              ))}
          </View>
        )}
      </ScrollView>

      <BottomNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={onTabChange}
      />

      {/* Trip Details Modal */}
      <Modal
        visible={showTripDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTripDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip Details</Text>
              <TouchableOpacity onPress={() => setShowTripDetails(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            
            {selectedTrip && (() => {
              const fullTrip = fullTripData.get(selectedTrip.id);
              return (
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Date & Time</Text>
                        <Text style={styles.detailValue}>{selectedTrip.date}</Text>
                        <Text style={styles.detailSubvalue}>{selectedTrip.time}</Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="location-outline" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Pickup Location</Text>
                        <Text style={styles.detailValue}>{selectedTrip.pickup}</Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="flag-outline" size={20} color={colors.error} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Drop-off Location</Text>
                        <Text style={styles.detailValue}>{selectedTrip.dropoff}</Text>
                      </View>
                    </View>

                    {userType === 'driver' && selectedTrip.passengerName && (
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Ionicons name="person-outline" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Passenger Name</Text>
                          <Text style={styles.detailValue}>{selectedTrip.passengerName}</Text>
                          {fullTrip?.passengerPhone && (
                            <Text style={styles.detailSubvalue}>{fullTrip.passengerPhone}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {userType === 'passenger' && selectedTrip.driverName && (
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Ionicons name="person-outline" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Driver Name</Text>
                          <Text style={styles.detailValue}>{selectedTrip.driverName}</Text>
                          {fullTrip?.driverPhone && (
                            <Text style={styles.detailSubvalue}>{fullTrip.driverPhone}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="cash-outline" size={20} color={colors.success} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Fare Amount</Text>
                        <Text style={styles.detailValue}>{selectedTrip.fare}</Text>
                        {fullTrip?.distance && (
                          <Text style={styles.detailSubvalue}>Distance: {fullTrip.distance.toFixed(2)} km</Text>
                        )}
                        {fullTrip?.duration && (
                          <Text style={styles.detailSubvalue}>Duration: {fullTrip.duration} minutes</Text>
                        )}
                      </View>
                    </View>

                    {fullTrip?.paymentMethod && (
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Ionicons name="card-outline" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Payment Method</Text>
                          <Text style={styles.detailValue}>
                            {fullTrip.paymentMethod === 'cash' ? '💵 Cash' : '📱 GCash'}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconContainer}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Trip Status</Text>
                        <View style={[
                          styles.statusBadgeInline,
                          selectedTrip.status === 'completed' && styles.statusBadgeCompleted
                        ]}>
                          <Text style={[
                            styles.statusTextInline,
                            selectedTrip.status === 'completed' && styles.statusTextCompleted
                          ]}>
                            {selectedTrip.status === 'completed' ? '✅ Completed' : '❌ Cancelled'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
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
  periodFilter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    ...typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray,
  },
  periodButtonTextActive: {
    color: colors.white,
  },
  viewDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  viewDetailsText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.lg,
  },
  detailSection: {
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    marginBottom: 4,
  },
  detailValue: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkText,
  },
  detailSubvalue: {
    ...typography.caption,
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  statusBadgeInline: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.lightGray,
    marginTop: spacing.xs,
  },
  statusTextInline: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray,
  },
});





