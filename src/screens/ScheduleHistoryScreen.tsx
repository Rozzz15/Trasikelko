import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { Button } from '../components';
import { getUpcomingRides, getPastRides, cancelScheduledRide, deleteScheduledRide } from '../services/scheduledRideService';
import { getUserData } from '../services/userService';
import { supabase } from '../config/supabase';

interface ScheduledRide {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  pickup_location: string;
  dropoff_location: string;
  notes: string | null;
  status: 'scheduled' | 'accepted' | 'completed' | 'cancelled';
  scheduled_datetime: string;
  driver_name?: string | null;
  driver_phone?: string | null;
}

interface ScheduleHistoryScreenProps {
  navigation: any;
}

export const ScheduleHistoryScreen: React.FC<ScheduleHistoryScreenProps> = ({ navigation }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [upcomingRides, setUpcomingRides] = useState<ScheduledRide[]>([]);
  const [pastRides, setPastRides] = useState<ScheduledRide[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserAndRides();
  }, []);

  useEffect(() => {
    // Refresh when returning to screen
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) {
        loadScheduledRides();
      }
    });
    return unsubscribe;
  }, [navigation, userId]);

  // Real-time subscription for scheduled rides updates
  useEffect(() => {
    if (!userId) {
      return;
    }

    // Subscribe to changes in scheduled_rides table for this user
    const scheduledRidesChannel = supabase
      .channel('user_scheduled_rides')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'scheduled_rides',
          filter: `passenger_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Scheduled rides updated for user:', payload);
          // Reload scheduled rides when any change occurs
          loadScheduledRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduledRidesChannel);
    };
  }, [userId]);

  const loadUserAndRides = async () => {
    try {
      const userData = await getUserData();
      if (userData) {
        setUserId(userData.id);
        await loadScheduledRides(userData.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScheduledRides = async (userIdParam?: string) => {
    const id = userIdParam || userId;
    if (!id) return;

    try {
      setIsLoading(true);
      
      const [upcomingResult, pastResult] = await Promise.all([
        getUpcomingRides(id),
        getPastRides(id),
      ]);

      if (upcomingResult.success && upcomingResult.rides) {
        setUpcomingRides(upcomingResult.rides);
      }

      if (pastResult.success && pastResult.rides) {
        setPastRides(pastResult.rides);
      }
    } catch (error) {
      console.error('Error loading scheduled rides:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallDriver = async (phoneNumber: string) => {
    try {
      const cleanedNumber = phoneNumber.replace(/[^0-9+]/g, '');
      const phoneUrl = `tel:${cleanedNumber}`;
      
      const canCall = await Linking.canOpenURL(phoneUrl);
      if (canCall) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'Unable to make phone calls on this device');
      }
    } catch (error) {
      console.error('Error calling driver:', error);
      Alert.alert('Error', 'Failed to initiate call');
    }
  };

  const handleMessageDriver = async (phoneNumber: string) => {
    try {
      const cleanedNumber = phoneNumber.replace(/[^0-9+]/g, '');
      const smsUrl = `sms:${cleanedNumber}`;
      
      const canMessage = await Linking.canOpenURL(smsUrl);
      if (canMessage) {
        await Linking.openURL(smsUrl);
      } else {
        Alert.alert('Error', 'Unable to send messages on this device');
      }
    } catch (error) {
      console.error('Error messaging driver:', error);
      Alert.alert('Error', 'Failed to open messaging app');
    }
  };

  const handleDeleteRide = (rideId: string) => {
    Alert.alert(
      'Delete Scheduled Ride',
      'Are you sure you want to permanently delete this ride from your history?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteScheduledRide(rideId);
              if (result.success) {
                loadScheduledRides();
                Alert.alert('Deleted', 'Scheduled ride has been deleted.');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete ride.');
              }
            } catch (error) {
              console.error('Error deleting scheduled ride:', error);
              Alert.alert('Error', 'Failed to delete ride. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCancelRide = (rideId: string) => {
    Alert.alert(
      'Cancel Scheduled Ride',
      'Are you sure you want to cancel this scheduled ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelScheduledRide(rideId);
              if (result.success) {
                Alert.alert('Success', 'Scheduled ride cancelled.');
                await loadScheduledRides();
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel ride.');
              }
            } catch (error) {
              console.error('Error cancelling ride:', error);
              Alert.alert('Error', 'Failed to cancel ride. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderRideCard = (ride: ScheduledRide) => {
    const isUpcoming = ride.status === 'scheduled' || ride.status === 'accepted';
    const isPastRide = ride.status === 'completed' || ride.status === 'cancelled';
    
    // Format date and time
    const formattedDate = new Date(ride.scheduled_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    
    const formattedTime = ride.scheduled_time.substring(0, 5); // HH:MM format
    
    return (
      <TouchableOpacity 
        key={ride.id} 
        style={styles.rideCard}
        onLongPress={() => isPastRide && handleDeleteRide(ride.id)}
        delayLongPress={500}
        activeOpacity={isPastRide ? 0.7 : 1}
      >
        <View style={styles.rideHeader}>
          <View style={[styles.statusBadge, {
            backgroundColor: ride.status === 'scheduled' ? colors.warning + '20' :
                           ride.status === 'accepted' ? colors.success + '20' :
                           ride.status === 'completed' ? colors.primary + '20' :
                           colors.error + '20'
          }]}>
            <Text style={[styles.statusText, {
              color: ride.status === 'scheduled' ? colors.warning :
                     ride.status === 'accepted' ? colors.success :
                     ride.status === 'completed' ? colors.primary :
                     colors.error
            }]}>
              {ride.status === 'scheduled' ? '⏳ Pending' :
               ride.status === 'accepted' ? '✅ Accepted by Driver' :
               ride.status === 'completed' ? '🎉 Completed' :
               '❌ Cancelled'}
            </Text>
          </View>
        </View>

        <View style={styles.rideDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={styles.detailText}>{formattedDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={styles.detailText}>{formattedTime}</Text>
          </View>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={20} color={colors.success} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationText} numberOfLines={2}>{ride.pickup_location}</Text>
            </View>
          </View>

          <View style={styles.locationDivider}>
            <View style={styles.dottedLine} />
          </View>

          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <Ionicons name="flag" size={20} color={colors.error} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Dropoff</Text>
              <Text style={styles.locationText} numberOfLines={2}>{ride.dropoff_location}</Text>
            </View>
          </View>
        </View>

        {ride.notes && (
          <View style={styles.notesContainer}>
            <Ionicons name="document-text" size={16} color={colors.gray} />
            <Text style={styles.notesText} numberOfLines={2}>{ride.notes}</Text>
          </View>
        )}

        {/* Driver Info (when accepted) */}
        {ride.status === 'accepted' && ride.driver_name && (
          <View style={styles.driverInfoContainer}>
            <View style={styles.driverInfoHeader}>
              <Ionicons name="car" size={20} color={colors.success} />
              <Text style={styles.driverInfoTitle}>Your Driver</Text>
            </View>
            <View style={styles.driverDetails}>
              <View style={styles.driverDetailRow}>
                <Ionicons name="person" size={16} color={colors.gray} />
                <Text style={styles.driverName}>{ride.driver_name}</Text>
              </View>
              {ride.driver_phone && (
                <View style={styles.driverPhoneRow}>
                  <View style={styles.driverDetailRow}>
                    <Ionicons name="call" size={16} color={colors.gray} />
                    <Text style={styles.driverPhone}>{ride.driver_phone}</Text>
                  </View>
                  <View style={styles.contactButtons}>
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => handleCallDriver(ride.driver_phone!)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call" size={18} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => handleMessageDriver(ride.driver_phone!)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble" size={18} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {isUpcoming && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancelRide(ride.id)}
            >
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {isPastRide && (
          <View style={styles.deleteHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.gray} />
            <Text style={styles.deleteHintText}>Hold to delete</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.darkText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scheduled Rides</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming ({upcomingRides.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past ({pastRides.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'upcoming' ? (
          upcomingRides.length > 0 ? (
            upcomingRides.map(renderRideCard)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color={colors.gray} />
              <Text style={styles.emptyTitle}>No Upcoming Rides</Text>
              <Text style={styles.emptyText}>
                Schedule a ride to see it here
              </Text>
            </View>
          )
        ) : (
          pastRides.length > 0 ? (
            pastRides.map(renderRideCard)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={64} color={colors.gray} />
              <Text style={styles.emptyTitle}>No Past Rides</Text>
              <Text style={styles.emptyText}>
                Your completed and cancelled rides will appear here
              </Text>
            </View>
          )
        )}
      </ScrollView>

      {/* Schedule New Ride Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="+ Schedule New Ride"
          onPress={() => navigation.navigate('ScheduleRide')}
          style={styles.scheduleButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.darkText,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  rideCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rideDetails: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: 14,
    color: colors.darkText,
    fontWeight: '500',
  },
  locationContainer: {
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIcon: {
    width: 32,
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  locationLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: colors.darkText,
    fontWeight: '500',
  },
  locationDivider: {
    marginLeft: 16,
    paddingVertical: spacing.xs,
  },
  dottedLine: {
    width: 2,
    height: 20,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    borderStyle: 'dotted',
  },
  notesContainer: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray,
    fontStyle: 'italic',
  },
  driverInfoContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.success + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  driverInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  driverInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
    marginLeft: spacing.sm,
  },
  driverDetails: {
    marginLeft: spacing.lg + spacing.sm,
  },
  driverDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  driverPhone: {
    fontSize: 14,
    color: colors.gray,
    marginLeft: spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  cancelButton: {
    backgroundColor: colors.error + '15',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  deleteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteHintText: {
    fontSize: 12,
    color: colors.gray,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.darkText,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonContainer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scheduleButton: {
    backgroundColor: colors.primary,
  },
  driverPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  contactButton: {
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
