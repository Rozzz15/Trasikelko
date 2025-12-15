import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomNavigation, SOSButton, StatusToggle, Card, Button } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { getUserAccount } from '../utils/userStorage';
import { acceptBooking, getTrips } from '../utils/tripStorage';
import { updateDriverLocation, removeDriverLocation, updateDriverStatus, DriverStatus } from '../utils/driverLocationStorage';

interface DriverHomeScreenProps {
  navigation?: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSOSPress: () => void;
  onLogout?: () => void;
}

interface BookingRequest {
  id: string;
  passengerName: string;
  passengerPhone: string;
  pickupLocation: string;
  dropoffLocation: string;
  fare: string;
  distance: string;
  eta: string;
}

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({
  navigation,
  activeTab,
  onTabChange,
  onSOSPress,
  onLogout,
}) => {
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('offline');
  const [incomingBooking, setIncomingBooking] = useState<BookingRequest | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null);
  const [driverEmail, setDriverEmail] = useState<string>('');
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverAccount, setDriverAccount] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [driverName, setDriverName] = useState<string>('Driver');
  const [hasActiveTrip, setHasActiveTrip] = useState<boolean>(false);
  const todayEarnings = 0; // Placeholder for earnings
  
  // Derived state
  const isOnline = driverStatus !== 'offline';

  // Check driver verification status on mount and load driver account
  useEffect(() => {
    const checkVerificationStatus = async () => {
      try {
        const email = await AsyncStorage.getItem('current_user_email');
        if (email) {
          setDriverEmail(email);
          const account = await getUserAccount(email);
          setDriverAccount(account);
          if (account && account.accountType === 'driver') {
            setDriverName(account.fullName?.split(' ')[0] || 'Driver');
            const status = account.verificationStatus || 'pending';
            setVerificationStatus(status);
            setIsVerified(status === 'verified');
            
            // If not verified, show alert and prevent access
            if (status !== 'verified') {
              if (status === 'pending') {
                Alert.alert(
                  'Account Under Review',
                  'Your driver account is currently under review. Please wait for admin approval before accessing your account.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Clear user data and logout
                        if (onLogout) {
                          onLogout();
                        } else {
                          // Fallback: clear data manually and reload app state
                          AsyncStorage.removeItem('current_user_email').catch(console.error);
                        }
                      },
                    },
                  ],
                  { cancelable: false }
                );
              } else if (status === 'rejected') {
                Alert.alert(
                  'Account Rejected',
                  account.rejectionReason 
                    ? `Your driver account application has been rejected. Reason: ${account.rejectionReason}`
                    : 'Your driver account application has been rejected. Please contact support for more information.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Clear user data and logout
                        if (onLogout) {
                          onLogout();
                        } else {
                          // Fallback: clear data manually and reload app state
                          AsyncStorage.removeItem('current_user_email').catch(console.error);
                        }
                      },
                    },
                  ],
                  { cancelable: false }
                );
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
        setIsVerified(false);
      }
    };

    checkVerificationStatus();
  }, [onLogout]);

  // Check for active trips and update status accordingly
  useEffect(() => {
    const checkActiveTrip = async () => {
      if (driverEmail && isVerified) {
        try {
          const { getActiveTrip } = require('../utils/tripStorage');
          const activeTrip = await getActiveTrip(driverEmail, 'driver');
          
          if (activeTrip && activeTrip.status !== 'completed' && activeTrip.status !== 'cancelled') {
            // Driver has an active trip
            setHasActiveTrip(true);
            // Set status to 'on_ride' if not already
            if (driverStatus !== 'on_ride') {
              setDriverStatus('on_ride');
              await updateDriverStatus(driverEmail, 'on_ride');
            }
          } else {
            // No active trip
            setHasActiveTrip(false);
            if (driverStatus === 'on_ride') {
              // No active trip but status is still 'on_ride', automatically reset to 'available'
              // This happens when a trip is completed or cancelled
              console.log('No active trip found, resetting driver status from on_ride to available');
              setDriverStatus('available');
              await updateDriverStatus(driverEmail, 'available');
              
              // Update location with new status if driver location exists
              if (driverLocation && driverAccount) {
                await updateDriverLocation(
                  driverEmail,
                  driverEmail,
                  driverAccount.fullName || 'Driver',
                  driverLocation.latitude,
                  driverLocation.longitude,
                  true,
                  'available',
                  driverAccount.tricyclePlate,
                  driverAccount.rating,
                  driverAccount.totalRides
                );
              }
            }
          }
        } catch (error) {
          console.error('Error checking active trip:', error);
          setHasActiveTrip(false);
        }
      }
    };

    checkActiveTrip();
    
    // Check periodically for active trip changes
    const interval = setInterval(checkActiveTrip, 5000);
    return () => clearInterval(interval);
  }, [driverEmail, isVerified, driverStatus, driverLocation, driverAccount]);

  const tabs = [
    { name: 'home', label: 'Home', icon: 'home-outline' as const, activeIcon: 'home' as const },
    { name: 'trips', label: 'Trips', icon: 'time-outline' as const, activeIcon: 'time' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
  ];

  // Load all active bookings from all tenant accounts
  const loadAllBookings = async () => {
    if (driverStatus === 'available' && isVerified && driverEmail) {
      try {
        // Get all trips and filter for active bookings
        const allTrips = await getTrips();
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        
        // Filter for active bookings - show ALL bookings from ALL passengers to ALL drivers
        // No filtering by passengerId, driverId, or account type - all drivers see all bookings
        const pendingBookings = allTrips.filter((trip: any) => {
          // Only show bookings that are still searching/pending (not accepted or completed)
          const isSearching = trip.status === 'searching' || trip.status === 'pending';
          
          // Don't show bookings that have been accepted by any driver
          const notAccepted = trip.status !== 'driver_accepted' && 
                              trip.status !== 'arrived' && 
                              trip.status !== 'in_progress' && 
                              trip.status !== 'completed' &&
                              trip.status !== 'cancelled';
          
          // Filter out stale bookings (older than 1 hour)
          const isRecent = new Date(trip.createdAt).getTime() > oneHourAgo;
          
          // Show ALL bookings from ALL passengers to ALL drivers
          // No filtering by passengerId, driverId, account type, or tenant
          // All drivers can see all active bookings from all passenger accounts
          return isSearching && notAccepted && isRecent;
        });
        
        // Calculate distance and ETA for each booking
        const bookingsWithDistance = await Promise.all(
          pendingBookings.map(async (booking: any) => {
            let distanceToPickup = 0;
            let etaMinutes = 5; // Default ETA
            
            if (driverLocation && booking.pickupCoordinates) {
              const { calculateDistance } = require('../utils/tripStorage');
              distanceToPickup = calculateDistance(
                driverLocation.latitude,
                driverLocation.longitude,
                booking.pickupCoordinates.latitude,
                booking.pickupCoordinates.longitude
              );
              // Estimate ETA: 30 km/h average speed, minimum 1 minute
              etaMinutes = Math.max(1, Math.round((distanceToPickup / 30) * 60));
            }
            
            return {
              ...booking,
              distanceToPickup,
              etaMinutes,
              fareDisplay: `₱${booking.fare || booking.estimatedFare || 0}`,
              distanceDisplay: booking.distance ? `${booking.distance.toFixed(1)} km` : 'N/A',
              etaDisplay: `${etaMinutes} min`,
            };
          })
        );
        
        // Sort by distance (closest first)
        bookingsWithDistance.sort((a: any, b: any) => a.distanceToPickup - b.distanceToPickup);
        setAllBookings(bookingsWithDistance);
      } catch (error) {
        console.error('Error loading bookings:', error);
        setAllBookings([]);
      }
    } else {
      setAllBookings([]);
    }
  };

  // Track location when online (available or on_ride)
  useEffect(() => {
    let locationWatchSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      if ((driverStatus === 'available' || driverStatus === 'on_ride') && isVerified && driverEmail && driverAccount) {
        try {
          // Check if location services are enabled
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            Alert.alert(
              'Location Services Disabled',
              'Location services are currently disabled on your device. Please enable location services in your device settings to track your location.',
              [{ text: 'OK' }]
            );
            setDriverStatus('offline'); // Turn off online status if location services are disabled
            return;
          }

          // Request location permissions
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Location Permission Required',
              'Please enable location permission to share your location with passengers.',
              [{ text: 'OK' }]
            );
            setDriverStatus('offline'); // Turn off online status if permission denied
            return;
          }

          // Get initial location
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          
          setDriverLocation(coords);

          // Update location in storage with current status
          await updateDriverLocation(
            driverEmail,
            driverEmail,
            driverAccount.fullName || 'Driver',
            coords.latitude,
            coords.longitude,
            isOnline,
            driverStatus,
            driverAccount.tricyclePlate,
            driverAccount.rating,
            driverAccount.totalRides
          );

          // Watch location changes
          locationWatchSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 10000, // Update every 10 seconds
              distanceInterval: 50, // Or every 50 meters
            },
            async (location) => {
              try {
                const newCoords = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                };
                
                setDriverLocation(newCoords);
                
                // Update location in storage with current status
                await updateDriverLocation(
                  driverEmail,
                  driverEmail,
                  driverAccount.fullName || 'Driver',
                  newCoords.latitude,
                  newCoords.longitude,
                  isOnline,
                  driverStatus,
                  driverAccount.tricyclePlate,
                  driverAccount.rating,
                  driverAccount.totalRides
                );
              } catch (updateError) {
                console.error('Error updating location:', updateError);
                // Check if location services are still enabled
                const stillEnabled = await Location.hasServicesEnabledAsync();
                if (!stillEnabled) {
                  Alert.alert(
                    'Location Services Disabled',
                    'Location services have been disabled. Please enable them in your device settings to continue tracking.',
                    [{ text: 'OK' }]
                  );
                  setDriverStatus('offline');
                  if (locationWatchSubscription) {
                    locationWatchSubscription.remove();
                  }
                }
              }
            }
          );
        } catch (error: any) {
          console.error('Error tracking location:', error);
          
          // Provide user-friendly error messages
          let errorMessage = 'Unable to track your location. ';
          
          if (error.message && error.message.includes('location is unavailable')) {
            errorMessage += 'Please make sure that location services are enabled in your device settings.';
          } else if (error.message && error.message.includes('timeout')) {
            errorMessage += 'Location request timed out. Please check your GPS signal and try again.';
          } else {
            errorMessage += 'Please check your device settings and ensure location services are enabled.';
          }
          
          Alert.alert(
            'Location Tracking Error',
            errorMessage,
            [
              {
                text: 'OK',
                onPress: () => setDriverStatus('offline'), // Turn off online status on error
              },
            ]
          );
        }
      } else if (!isOnline && driverEmail) {
        // Remove location when going offline
        await removeDriverLocation(driverEmail);
        setDriverLocation(null);
      } else if (driverStatus === 'offline' && driverEmail) {
        // Remove location when going offline
        await removeDriverLocation(driverEmail);
        setDriverLocation(null);
      }
    };

    startLocationTracking();

    return () => {
      if (locationWatchSubscription) {
        locationWatchSubscription.remove();
      }
      // Remove location when component unmounts or goes offline
      if (driverEmail && driverStatus === 'offline') {
        removeDriverLocation(driverEmail).catch(console.error);
      }
    };
  }, [driverStatus, isVerified, driverEmail, driverAccount]);

  // Load bookings periodically when available
  useEffect(() => {
    if (driverStatus === 'available' && isVerified) {
      // Load immediately
      loadAllBookings();
      
      // Refresh every 3 seconds to catch bookings accepted by other drivers quickly
      const interval = setInterval(() => {
        loadAllBookings();
      }, 3000);
      
      return () => clearInterval(interval);
    } else {
      // Clear bookings if not available
      setAllBookings([]);
    }
  }, [driverStatus, isVerified, driverEmail, driverLocation]);

  const handleStatusChange = async (newStatus: DriverStatus) => {
    // Prevent going available/on_ride if not verified
    if (newStatus !== 'offline' && !isVerified) {
      Alert.alert(
        'Account Not Verified',
        'You cannot go online until your account has been verified by an administrator.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if driver has active trip before allowing status change to available
    if (newStatus === 'available') {
      try {
        const { getActiveTrip } = require('../utils/tripStorage');
        const activeTrip = await getActiveTrip(driverEmail, 'driver');
        if (activeTrip && activeTrip.status !== 'completed' && activeTrip.status !== 'cancelled') {
          Alert.alert(
            'Active Trip',
            'You have an active trip. Please complete or cancel it before changing your status to available.',
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking active trip:', error);
      }
    }

    setDriverStatus(newStatus);
    
    // Update status in storage
    if (driverEmail) {
      await updateDriverStatus(driverEmail, newStatus);
      
      // Update location with new status if driver is online
      if (driverLocation && (newStatus === 'available' || newStatus === 'on_ride')) {
        await updateDriverLocation(
          driverEmail,
          driverEmail,
          driverAccount?.fullName || 'Driver',
          driverLocation.latitude,
          driverLocation.longitude,
          newStatus === 'available' || newStatus === 'on_ride',
          newStatus,
          driverAccount?.tricyclePlate,
          driverAccount?.rating,
          driverAccount?.totalRides
        );
      } else if (newStatus === 'offline') {
        await removeDriverLocation(driverEmail);
        setIncomingBooking(null);
      }
    }

    // Load bookings when going available
    if (newStatus === 'available') {
      setTimeout(() => loadAllBookings(), 1000);
    }
  };

  const handleAcceptBooking = async (booking: any) => {
    try {
      // Get driver account info
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (!currentUserEmail) {
        Alert.alert('Error', 'Driver account not found');
        return;
      }

      const driverAccount = await getUserAccount(currentUserEmail);
      if (!driverAccount || driverAccount.accountType !== 'driver') {
        Alert.alert('Error', 'Invalid driver account');
        return;
      }

      // Verify the booking is still available (not accepted by another driver)
      const { getTrips } = require('../utils/tripStorage');
      const allTrips = await getTrips();
      const currentBooking = allTrips.find((t: any) => t.id === booking.id);
      
      if (!currentBooking) {
        Alert.alert('Booking Not Found', 'This booking is no longer available.');
        loadAllBookings(); // Refresh the list
        return;
      }
      
      // Check if booking has already been accepted by another driver
      if (currentBooking.status === 'driver_accepted' || 
          currentBooking.status === 'arrived' || 
          currentBooking.status === 'in_progress' ||
          currentBooking.status === 'completed' ||
          currentBooking.status === 'cancelled') {
        Alert.alert('Booking Already Taken', 'This booking has already been accepted by another driver.');
        loadAllBookings(); // Refresh the list
        return;
      }
      
      // Allow any driver to accept any available booking
      // Pre-selected drivers have priority, but any driver can accept if booking is still available
      // Note: Pre-selection is informational only - all drivers can see and accept all bookings

      // Accept the booking and link driver account
      await acceptBooking(
        booking.id,
        currentUserEmail,
        driverAccount.fullName,
        driverAccount.phoneNumber,
        driverAccount.profilePhoto,
        driverAccount.plateNumber
      );

      // Update driver status to 'on_ride'
      setDriverStatus('on_ride');
      if (driverEmail) {
        await updateDriverStatus(driverEmail, 'on_ride');
        // Update location with new status
        if (driverLocation) {
          await updateDriverLocation(
            driverEmail,
            driverEmail,
            driverAccount.fullName || 'Driver',
            driverLocation.latitude,
            driverLocation.longitude,
            true,
            'on_ride',
            driverAccount.plateNumber,
            undefined,
            undefined
          );
        }
      }

      // Navigate to accepted ride screen
      if (navigation) {
        navigation.navigate('AcceptedRide', {
          bookingId: booking.id,
          passengerName: booking.passengerName || 'Passenger',
          passengerPhone: booking.passengerPhone || 'N/A',
          pickupLocation: booking.pickupLocation,
          dropoffLocation: booking.dropoffLocation,
          fare: booking.fareDisplay,
          distance: booking.distanceDisplay,
          pickupCoordinates: booking.pickupCoordinates,
          dropoffCoordinates: booking.dropoffCoordinates,
        });
      } else {
        Alert.alert('Navigation Error', 'Unable to navigate. Please try again.');
      }
      
      // Reload bookings
      loadAllBookings();
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Show verification pending/rejected message if not verified
  if (isVerified === false || verificationStatus !== 'verified') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.verificationContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.verificationContent}>
            <View style={styles.verificationIconContainer}>
              {verificationStatus === 'pending' ? (
                <Ionicons name="time-outline" size={64} color={colors.warning} />
              ) : verificationStatus === 'rejected' ? (
                <Ionicons name="close-circle-outline" size={64} color={colors.error} />
              ) : (
                <Ionicons name="lock-closed-outline" size={64} color={colors.gray} />
              )}
            </View>
            
            <Text style={styles.verificationTitle}>
              {verificationStatus === 'pending' 
                ? 'Account Under Review' 
                : verificationStatus === 'rejected'
                ? 'Account Rejected'
                : 'Account Not Verified'}
            </Text>
            
            <Text style={styles.verificationMessage}>
              {verificationStatus === 'pending'
                ? 'Your driver account is currently under review by our administrators. You will be notified once your account has been approved.'
                : verificationStatus === 'rejected'
                ? 'Your driver account application has been rejected. Please contact support for more information or to appeal the decision.'
                : 'Your driver account has not been verified yet. Please wait for admin approval before accessing your account.'}
            </Text>

            <Button
              title="Back to Login"
              onPress={() => {
                // Clear user data and logout
                if (onLogout) {
                  onLogout();
                } else {
                  // Fallback: clear data manually and reload app state
                  AsyncStorage.removeItem('current_user_email').catch(console.error);
                }
              }}
              variant="primary"
              style={styles.backButton}
            />
          </View>
        </ScrollView>
        
        {/* Bottom Navigation */}
        <BottomNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={onTabChange}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBackground}>
            <View style={styles.headerPattern} />
          </View>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.greetingContainer}>
                <View style={styles.greetingIconWrapper}>
                  <Ionicons name="sunny" size={18} color={colors.buttonPrimary} />
                </View>
                <View style={styles.greetingTextContainer}>
                  <Text style={styles.greetingText}>{getGreeting()}</Text>
                  <Text style={styles.userNameText}>{driverName}</Text>
                </View>
              </View>
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={12} color={colors.primary} />
                <Text style={styles.locationText}>Lopez, Quezon</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={22} color={colors.darkText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Toggle */}
        <View style={styles.statusContainer}>
          <StatusToggle
            status={driverStatus}
            onStatusChange={handleStatusChange}
            disabled={driverStatus === 'on_ride'}
            disabledMessage={driverStatus === 'on_ride' ? 'You are currently on a ride' : undefined}
            disableAvailable={hasActiveTrip}
          />
        </View>

        {/* Earnings Summary */}
        {(driverStatus === 'available' || driverStatus === 'on_ride') && (
          <View style={styles.earningsContainer}>
            <Card style={styles.earningsCard}>
              <View style={styles.earningsContent}>
                <View style={styles.earningsIconContainer}>
                  <Ionicons name="cash" size={24} color={colors.white} />
                </View>
                <View style={styles.earningsInfo}>
                  <Text style={styles.earningsLabel}>Today's Earnings</Text>
                  <Text style={styles.earningsAmount}>₱{todayEarnings}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Active Bookings Section */}
        {driverStatus === 'available' && (
          <View style={styles.bookingsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Bookings</Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{allBookings.length} available</Text>
              </View>
            </View>
            
            {allBookings.length === 0 ? (
              <Card style={styles.emptyBookingsCard}>
                <View style={styles.emptyBookingsContent}>
                  <Ionicons name="notifications-outline" size={48} color={colors.gray} />
                  <Text style={styles.emptyBookingsText}>No active bookings</Text>
                  <Text style={styles.emptyBookingsSubtext}>
                    New booking requests from passengers will appear here
                  </Text>
                </View>
              </Card>
            ) : (
              allBookings.map((booking) => (
                <Card key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingIcon}>
                      <Ionicons name="person" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.bookingHeaderContent}>
                      <Text style={styles.bookingTitle}>
                        {booking.passengerName || 'Passenger'}
                      </Text>
                      <Text style={styles.bookingPhone}>
                        {booking.passengerPhone || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.routeInfo}>
                    <View style={styles.routeItem}>
                      <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                      <View style={styles.routeContent}>
                        <Text style={styles.routeLabel}>Pickup</Text>
                        <Text style={styles.routeText}>{booking.pickupLocation}</Text>
                      </View>
                    </View>

                    <View style={styles.routeDivider} />

                    <View style={styles.routeItem}>
                      <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
                      <View style={styles.routeContent}>
                        <Text style={styles.routeLabel}>Dropoff</Text>
                        <Text style={styles.routeText}>{booking.dropoffLocation}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.bookingStats}>
                    <View style={styles.stat}>
                      <Ionicons name="cash-outline" size={18} color={colors.success} />
                      <Text style={styles.statValue}>{booking.fareDisplay}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                      <Text style={styles.statValue}>{booking.distanceDisplay}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Ionicons name="time-outline" size={18} color={colors.warning} />
                      <Text style={styles.statValue}>{booking.etaDisplay}</Text>
                    </View>
                  </View>

                  <View style={styles.bookingActions}>
                    <Button
                      title="Accept"
                      onPress={() => handleAcceptBooking(booking)}
                      variant="primary"
                      style={styles.acceptButton}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Emergency SOS Section */}
        <View style={styles.sosContainer}>
          <Text style={styles.sectionTitle}>Emergency</Text>
          <TouchableOpacity
            style={styles.sosCard}
            onPress={onSOSPress}
            activeOpacity={0.8}
          >
            <View style={styles.sosIconWrapper}>
              <Ionicons name="alert-circle" size={32} color={colors.white} />
            </View>
            <View style={styles.sosContent}>
              <Text style={styles.sosTitle}>Emergency SOS</Text>
              <Text style={styles.sosSubtext}>Get immediate assistance</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* SOS Button */}
      <SOSButton onPress={onSOSPress} variant="floating" />

      {/* Bottom Navigation */}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  header: {
    backgroundColor: colors.white,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderRadius: 0,
    ...shadows.medium,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF8F5',
  },
  headerPattern: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 152, 0, 0.08)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    zIndex: 1,
  },
  headerLeft: {
    flex: 1,
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  greetingIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.gray,
    marginBottom: 2,
    fontWeight: '500',
  },
  userNameText: {
    ...typography.h2,
    fontSize: 26,
    fontWeight: '800',
    color: colors.darkText,
    letterSpacing: -0.5,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 128, 237, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    gap: 4,
  },
  locationText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  earningsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  earningsCard: {
    ...shadows.medium,
  },
  earningsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  earningsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsInfo: {
    flex: 1,
  },
  earningsLabel: {
    ...typography.caption,
    color: colors.gray,
    fontSize: 12,
    marginBottom: 2,
  },
  earningsAmount: {
    ...typography.h2,
    color: colors.success,
    fontSize: 28,
    fontWeight: '700',
  },
  bookingsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkText,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  bookingCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bookingIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingHeaderContent: {
    flex: 1,
  },
  bookingTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  bookingPhone: {
    ...typography.caption,
    color: colors.gray,
  },
  bookingDetails: {
    gap: spacing.md,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  passengerPhone: {
    ...typography.caption,
    color: colors.gray,
  },
  routeInfo: {
    gap: spacing.sm,
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
  bookingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
  },
  stat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.bodyBold,
    color: colors.darkText,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  acceptButton: {
    paddingVertical: spacing.md,
  },
  emptyBookingsCard: {
    ...shadows.small,
  },
  emptyBookingsContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyBookingsText: {
    ...typography.h3,
    marginTop: spacing.md,
    color: colors.darkText,
    textAlign: 'center',
  },
  emptyBookingsSubtext: {
    ...typography.body,
    marginTop: spacing.xs,
    color: colors.gray,
    textAlign: 'center',
  },
  sosContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sosCard: {
    backgroundColor: colors.error,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.medium,
    elevation: 4,
  },
  sosIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sosContent: {
    flex: 1,
  },
  sosTitle: {
    ...typography.h3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  sosSubtext: {
    ...typography.body,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  verificationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  verificationContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  verificationIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  verificationTitle: {
    ...typography.h1,
    fontSize: 24,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  verificationMessage: {
    ...typography.body,
    textAlign: 'center',
    color: colors.gray,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  backButton: {
    minWidth: 200,
    marginTop: spacing.md,
  },
});
