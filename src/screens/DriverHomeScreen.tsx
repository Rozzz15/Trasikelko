import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
// No AsyncStorage needed - using Supabase sessions
import { BottomNavigation, SOSButton, StatusToggle, Card, Button, SafetyBadge } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { getUserAccount } from '../utils/userStorage';
// Using new Supabase-based services (like Grab/Angkas)
import { getUserTrips as getTripsByUserId, getActiveTrip, acceptTrip } from '../services/tripService';
import { 
  updateDriverLocationAndStatus, 
  removeDriverLocation, 
  updateDriverStatus, 
  DriverStatus 
} from '../services/driverService';
import { calculateSafetyBadge, getDriverSafetyRecord } from '../services/safetyService';
import { getAvailableScheduledRides, acceptScheduledRide, ScheduledRide } from '../services/scheduledRideService';
import { supabase } from '../config/supabase';

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
  const [scheduledRides, setScheduledRides] = useState<ScheduledRide[]>([]);
  const [acceptedScheduledRides, setAcceptedScheduledRides] = useState<ScheduledRide[]>([]);
  const [driverName, setDriverName] = useState<string>('Driver');
  const [hasActiveTrip, setHasActiveTrip] = useState<boolean>(false);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState<number>(0);
  const [safetyBadge, setSafetyBadge] = useState<'green' | 'yellow' | 'red'>('yellow');
  
  // Derived state
  const isOnline = driverStatus !== 'offline';

  // Calculate earnings (today and weekly)
  useEffect(() => {
    const calculateEarnings = async () => {
      if (driverEmail && isVerified && driverAccount?.user_id) {
        try {
          const result = await getTripsByUserId(driverAccount.user_id, 'driver');
          const trips = result.success ? result.trips || [] : [];
          const completedTrips = trips.filter((trip: any) => trip.status === 'completed');
          
          // Today's earnings
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTrips = completedTrips.filter((trip: any) => {
            const tripDate = new Date(trip.completed_at || trip.created_at);
            tripDate.setHours(0, 0, 0, 0);
            return tripDate.getTime() === today.getTime();
          });
          
          const todayTotal = todayTrips.reduce((sum: number, trip: any) => {
            return sum + (trip.fare || 0);
          }, 0);
          setTodayEarnings(todayTotal);
          
          // Weekly earnings (last 7 days)
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          weekAgo.setHours(0, 0, 0, 0);
          const weeklyTrips = completedTrips.filter((trip: any) => {
            const tripDate = new Date(trip.completed_at || trip.created_at);
            return tripDate >= weekAgo;
          });
          
          const weeklyTotal = weeklyTrips.reduce((sum: number, trip: any) => {
            return sum + (trip.fare || 0);
          }, 0);
          setWeeklyEarnings(weeklyTotal);
        } catch (error) {
          console.error('Error calculating earnings:', error);
        }
      }
    };
    
    calculateEarnings();
    
    // Refresh earnings every 30 seconds
    const interval = setInterval(calculateEarnings, 30000);
    return () => clearInterval(interval);
  }, [driverEmail, isVerified, driverAccount]);

  // Load safety badge
  useEffect(() => {
    const loadSafetyBadge = async () => {
      if (driverEmail && isVerified) {
        try {
          const badge = await calculateSafetyBadge(driverEmail);
          setSafetyBadge(badge);
        } catch (error) {
          console.error('Error loading safety badge:', error);
        }
      }
    };
    
    loadSafetyBadge();
    
    // Refresh safety badge every 5 minutes
    const interval = setInterval(loadSafetyBadge, 300000);
    return () => clearInterval(interval);
  }, [driverEmail, isVerified]);

  // Check driver verification status on mount and load driver account
  useEffect(() => {
    let verificationCheckInterval: NodeJS.Timeout | null = null;
    let isFirstCheck = true;
    
    const checkVerificationStatus = async () => {
      try {
        const { getCurrentUser } = require('../utils/sessionHelper');
        const user = await getCurrentUser();
        if (user) {
          setDriverEmail(user.email);
          const { supabase } = require('../config/supabase');
          const { data: account } = await supabase
            .from('drivers')
            .select('*, users(*)')
            .eq('user_id', user.id)
            .single();
          
          console.log('[DriverHomeScreen] Verification check - Account:', account);
          console.log('[DriverHomeScreen] Verification status from DB:', account?.verification_status);
          
          setDriverAccount(account);
          if (account) {
            setDriverName(account.users?.full_name?.split(' ')[0] || 'Driver');
            const newStatus = account.verification_status || 'pending';
            const oldStatus = verificationStatus;
            
            console.log('[DriverHomeScreen] Old status:', oldStatus, 'New status:', newStatus);
            console.log('[DriverHomeScreen] Is first check:', isFirstCheck);
            
            setVerificationStatus(newStatus);
            setIsVerified(newStatus === 'verified');
            
            // If status changed from pending/rejected to verified, show success (NOT on first load if already verified)
            if (oldStatus && oldStatus !== 'verified' && newStatus === 'verified' && !isFirstCheck) {
              console.log('[DriverHomeScreen] Status changed to verified! Showing success alert.');
              Alert.alert(
                '✅ Account Approved!',
                'Congratulations! Your driver account has been approved. You can now start accepting rides.',
                [{ text: 'Get Started' }]
              );
            }
            
            // LoginScreen already blocks unverified drivers - no need for alerts here
            if (newStatus === 'verified' && isFirstCheck) {
              console.log('[DriverHomeScreen] First check - Driver is already verified. No alert needed.');
              // Auto-set driver to available status on first successful login
              console.log('[DriverHomeScreen] Auto-setting driver status to available...');
              setDriverStatus('available');
              if (user.id) {
                await updateDriverStatus(user.id, 'available');
              }
            }
            
            // Mark first check as complete
            if (isFirstCheck) {
              isFirstCheck = false;
            }
          }
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
        setIsVerified(false);
      }
    };

    // Check immediately on mount
    checkVerificationStatus();
    
    // Check every 10 seconds for verification status updates
    verificationCheckInterval = setInterval(checkVerificationStatus, 10000);
    
    // Cleanup interval on unmount
    return () => {
      if (verificationCheckInterval) {
        clearInterval(verificationCheckInterval);
      }
    };
  }, [onLogout]);

  // Check for active trips and update status accordingly
  useEffect(() => {
    const checkActiveTrip = async () => {
      if (driverEmail && isVerified && driverAccount?.user_id) {
        try {
          const trip = await getActiveTrip(driverAccount.user_id, 'driver');
          
          if (trip && trip.status !== 'completed' && trip.status !== 'cancelled') {
            // Driver has an active trip
            setHasActiveTrip(true);
            setActiveTrip(trip);
            // Set status to 'on_ride' if not already
            if (driverStatus !== 'on_ride') {
              setDriverStatus('on_ride');
              await updateDriverStatus(driverAccount.user_id, 'on_ride');
            }
          } else {
            // No active trip
            setHasActiveTrip(false);
            setActiveTrip(null);
            if (driverStatus === 'on_ride') {
              // No active trip but status is still 'on_ride', automatically reset to 'available'
              // This happens when a trip is completed or cancelled
              console.log('No active trip found, resetting driver status from on_ride to available');
              setDriverStatus('available');
              await updateDriverStatus(driverAccount.user_id, 'available');
              
              // Update location with new status if driver location exists
              if (driverLocation && driverAccount?.user_id) {
                await updateDriverLocationAndStatus(
                  driverAccount.user_id,
                  driverLocation.latitude,
                  driverLocation.longitude,
                  'available',
                  true
                );
              }
            }
          }
        } catch (error) {
          console.error('Error checking active trip:', error);
          setHasActiveTrip(false);
          setActiveTrip(null);
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
        // Get pending trips from Supabase
        const { getPendingTrips } = require('../services/tripService');
        const allTrips = await getPendingTrips();
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        
        console.log('[DriverHomeScreen] All trips from DB:', allTrips);
        console.log('[DriverHomeScreen] Number of trips:', allTrips.length);
        
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
          // FIX: Use created_at (snake_case) not createdAt (camelCase)
          const isRecent = new Date(trip.created_at).getTime() > oneHourAgo;
          
          console.log('[DriverHomeScreen] Trip filter:', {
            id: trip.id,
            status: trip.status,
            isSearching,
            notAccepted,
            isRecent,
            created_at: trip.created_at,
            passes: isSearching && notAccepted && isRecent
          });
          
          // Show ALL bookings from ALL passengers to ALL drivers
          // No filtering by passengerId, driverId, account type, or tenant
          // All drivers can see all active bookings from all passenger accounts
          return isSearching && notAccepted && isRecent;
        });
        
        console.log('[DriverHomeScreen] Pending bookings after filter:', pendingBookings.length);
        
        // Fetch passenger info and calculate distance/ETA for each booking
        const bookingsWithDistance = await Promise.all(
          pendingBookings.map(async (trip: any) => {
            // Fetch passenger information from profiles table
            let passengerName = 'Passenger';
            let passengerPhone = 'N/A';
            
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, phone_number')
                .eq('id', trip.passenger_id)
                .single();
              
              if (profile) {
                passengerName = profile.full_name || 'Passenger';
                passengerPhone = profile.phone_number || 'N/A';
              }
            } catch (error) {
              console.error('[DriverHomeScreen] Error fetching passenger info:', error);
            }
            
            let distanceToPickup = 0;
            let etaMinutes = 5; // Default ETA
            
            // Map snake_case to expected format for coordinates
            const pickupCoords = trip.pickup_latitude && trip.pickup_longitude 
              ? { latitude: trip.pickup_latitude, longitude: trip.pickup_longitude }
              : null;
            
            if (driverLocation && pickupCoords) {
              const { calculateDistance } = require('../utils/tripStorage');
              distanceToPickup = calculateDistance(
                driverLocation.latitude,
                driverLocation.longitude,
                pickupCoords.latitude,
                pickupCoords.longitude
              );
              // Estimate ETA: 30 km/h average speed, minimum 1 minute
              etaMinutes = Math.max(1, Math.round((distanceToPickup / 30) * 60));
            }
            
            // Map snake_case database fields to camelCase for UI
            return {
              id: trip.id,
              passengerName,
              passengerPhone,
              pickupLocation: trip.pickup_location || 'Unknown',
              dropoffLocation: trip.dropoff_location || 'Unknown',
              pickupCoordinates: pickupCoords,
              dropoffCoordinates: trip.dropoff_latitude && trip.dropoff_longitude
                ? { latitude: trip.dropoff_latitude, longitude: trip.dropoff_longitude }
                : null,
              fare: trip.fare,
              distance: trip.distance,
              status: trip.status,
              distanceToPickup,
              etaMinutes,
              fareDisplay: `₱${trip.fare || trip.estimated_fare || 0}`,
              distanceDisplay: trip.distance ? `${trip.distance.toFixed(1)} km` : 'N/A',
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

          // Update location in Supabase (primary storage - like Grab/Angkas)
          if (driverAccount?.user_id) {
            await updateDriverLocationAndStatus(
              driverAccount.user_id,
              coords.latitude,
              coords.longitude,
              driverStatus,
              isOnline
            );
          }

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
                
                // Update location in Supabase (primary storage - like Grab/Angkas)
                if (driverAccount?.user_id) {
                  await updateDriverLocationAndStatus(
                    driverAccount.user_id,
                    newCoords.latitude,
                    newCoords.longitude,
                    driverStatus,
                    isOnline
                  );
                }
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
      } else if (!isOnline && driverAccount?.user_id) {
        // Remove location when going offline
        await removeDriverLocation(driverAccount.user_id);
        setDriverLocation(null);
      } else if (driverStatus === 'offline' && driverAccount?.user_id) {
        // Remove location when going offline
        await removeDriverLocation(driverAccount.user_id);
        setDriverLocation(null);
      }
    };

    startLocationTracking();

    return () => {
      if (locationWatchSubscription) {
        locationWatchSubscription.remove();
      }
      // Remove location when component unmounts or goes offline
      if (driverAccount?.user_id && driverStatus === 'offline') {
        removeDriverLocation(driverAccount.user_id).catch(console.error);
      }
    };
  }, [driverStatus, isVerified, driverEmail, driverAccount]);

  // Load scheduled rides (available for drivers to accept)
  const loadScheduledRides = async () => {
    if (driverStatus === 'available' && isVerified) {
      try {
        const result = await getAvailableScheduledRides();
        if (result.success && result.rides) {
          setScheduledRides(result.rides);
        } else {
          setScheduledRides([]);
        }
      } catch (error) {
        console.error('Error loading scheduled rides:', error);
        setScheduledRides([]);
      }
    } else {
      setScheduledRides([]);
    }
  };

  // Load accepted scheduled rides (rides this driver has accepted)
  const loadAcceptedScheduledRides = async () => {
    if (!isVerified) return;

    try {
      const { getCurrentUser } = require('../utils/sessionHelper');
      const currentUser = await getCurrentUser();
      if (!currentUser || !currentUser.id) return;

      console.log('[loadAcceptedScheduledRides] Loading for driver:', currentUser.email, 'ID:', currentUser.id);

      // Get accepted rides using user_id (UUID), not email
      const { data, error } = await supabase
        .from('scheduled_rides')
        .select('*')
        .eq('driver_id', currentUser.id)
        .in('status', ['accepted', 'scheduled'])
        .not('driver_id', 'is', null)
        .order('scheduled_datetime', { ascending: true });

      if (error) {
        console.error('[loadAcceptedScheduledRides] Error:', error);
        return;
      }

      // Fetch passenger info for each ride separately
      const ridesWithPassengerInfo = await Promise.all(
        (data || []).map(async (ride) => {
          console.log('[loadAcceptedScheduledRides] Processing ride:', ride.id);
          console.log('[loadAcceptedScheduledRides] - passenger_id:', ride.passenger_id);
          
          // Get passenger info
          const { data: passengers, error: passengerError } = await supabase
            .from('users')
            .select('full_name, phone_number')
            .eq('id', ride.passenger_id);
          
          const passenger = passengers && passengers.length > 0 ? passengers[0] : null;
          
          console.log('[loadAcceptedScheduledRides] - passenger data:', passenger);
          
          if (!passenger) {
            console.warn('[loadAcceptedScheduledRides] - ⚠️ Passenger not found! Account may have been deleted.');
          } else {
            console.log('[loadAcceptedScheduledRides] - full_name:', passenger.full_name);
            console.log('[loadAcceptedScheduledRides] - phone_number:', passenger.phone_number);
          }
          
          if (passengerError) {
            console.error('[loadAcceptedScheduledRides] - Error fetching passenger:', passengerError);
          }
          
          return {
            ...ride,
            passenger_name: passenger?.full_name || 'Unknown Passenger (Deleted)',
            passenger_phone: passenger?.phone_number || 'N/A',
          };
        })
      );

      console.log('[loadAcceptedScheduledRides] Found', ridesWithPassengerInfo.length, 'accepted rides');
      console.log('[loadAcceptedScheduledRides] Sample ride with passenger info:', JSON.stringify(ridesWithPassengerInfo[0], null, 2));
      setAcceptedScheduledRides(ridesWithPassengerInfo);
    } catch (error) {
      console.error('[loadAcceptedScheduledRides] Error:', error);
    }
  };

  // Real-time subscription for scheduled rides
  useEffect(() => {
    if (driverStatus !== 'available' || !isVerified) {
      return;
    }

    // Subscribe to changes in scheduled_rides table
    const scheduledRidesChannel = supabase
      .channel('scheduled_rides_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'scheduled_rides',
          filter: `status=eq.scheduled`,
        },
        (payload) => {
          console.log('Scheduled rides changed:', payload);
          // Reload scheduled rides when any change occurs
          loadScheduledRides();
        }
      )
      .subscribe();

    // Initial load
    loadScheduledRides();
    loadAcceptedScheduledRides();

    return () => {
      supabase.removeChannel(scheduledRidesChannel);
    };
  }, [driverStatus, isVerified]);

  // Load accepted rides on mount and when status changes
  useEffect(() => {
    if (isVerified) {
      loadAcceptedScheduledRides();
    }
  }, [isVerified]);

  // Load bookings periodically when available (keep polling for trips table)
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
    if (driverAccount?.user_id) {
      await updateDriverStatus(driverAccount.user_id, newStatus);
      
      // Update location with new status if driver is online
      if (driverLocation && (newStatus === 'available' || newStatus === 'on_ride') && driverAccount?.user_id) {
        await updateDriverLocationAndStatus(
          driverAccount.user_id,
          driverLocation.latitude,
          driverLocation.longitude,
          newStatus,
          true
        );
      } else if (newStatus === 'offline' && driverAccount?.user_id) {
        await removeDriverLocation(driverAccount.user_id);
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
      const { getCurrentUserEmail } = require('../utils/sessionHelper');
      const currentUserEmail = await getCurrentUserEmail();
      if (!currentUserEmail) {
        Alert.alert('Error', 'Driver account not found');
        return;
      }

      const driverAccount = await getUserAccount(currentUserEmail);
      if (!driverAccount || driverAccount.accountType !== 'driver') {
        Alert.alert('Error', 'Invalid driver account');
        return;
      }

      // Get current user from Supabase
      const { getCurrentUser } = require('../utils/sessionHelper');
      const user = await getCurrentUser();
      
      if (!user || !user.id) {
        Alert.alert('Error', 'User session not found');
        return;
      }

      // Verify the booking is still available using Supabase tripService
      const { getTripById } = require('../services/tripService');
      const currentBooking = await getTripById(booking.id);
      
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
      
      // Accept the booking using Supabase tripService
      const result = await acceptTrip(booking.id, user.id);
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to accept booking');
        loadAllBookings();
        return;
      }

      // Update driver status to 'on_ride'
      setDriverStatus('on_ride');
      if (user?.id) {
        await updateDriverStatus(user.id, 'on_ride');
        // Update location with new status
        if (driverLocation) {
          await updateDriverLocationAndStatus(
            user.id,
            driverLocation.latitude,
            driverLocation.longitude,
            'on_ride',
            true
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

  const handleCancelAcceptedRide = async (ride: ScheduledRide) => {
    Alert.alert(
      'Cancel Ride?',
      'Are you sure you want to cancel this accepted ride? The passenger will be notified.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[handleCancelAcceptedRide] Cancelling ride:', ride.id);
              
              const { cancelScheduledRide } = require('../services/scheduledRideService');
              const result = await cancelScheduledRide(ride.id);
              
              if (!result.success) {
                console.error('[handleCancelAcceptedRide] ❌ Cancel failed:', result.error);
                Alert.alert('Error', 'Failed to cancel ride. Please try again.');
                return;
              }
              
              console.log('[handleCancelAcceptedRide] ✅ Ride cancelled successfully');
              
              Alert.alert(
                'Ride Cancelled',
                'The ride has been cancelled. It will be available for other drivers to accept.',
                [{ text: 'OK' }]
              );
              
              // Reload lists
              loadScheduledRides();
              loadAcceptedScheduledRides();
            } catch (error: any) {
              console.error('[handleCancelAcceptedRide] ❌ Error:', error);
              Alert.alert('Error', 'Failed to cancel ride. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleResumeActiveRide = async () => {
    if (!activeTrip || !navigation) {
      Alert.alert('Error', 'Unable to resume ride. Please try again.');
      return;
    }

    try {
      // Fetch passenger info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', activeTrip.passenger_id)
        .single();

      const passengerName = profile?.full_name || 'Passenger';
      const passengerPhone = profile?.phone_number || 'N/A';

      // Navigate to accepted ride screen with active trip data
      navigation.navigate('AcceptedRide', {
        bookingId: activeTrip.id,
        passengerName,
        passengerPhone,
        pickupLocation: activeTrip.pickup_location,
        dropoffLocation: activeTrip.dropoff_location,
        fare: `₱${activeTrip.fare || activeTrip.estimated_fare || 0}`,
        distance: activeTrip.distance ? `${activeTrip.distance.toFixed(1)} km` : 'N/A',
        pickupCoordinates: activeTrip.pickup_latitude && activeTrip.pickup_longitude
          ? { latitude: activeTrip.pickup_latitude, longitude: activeTrip.pickup_longitude }
          : null,
        dropoffCoordinates: activeTrip.dropoff_latitude && activeTrip.dropoff_longitude
          ? { latitude: activeTrip.dropoff_latitude, longitude: activeTrip.dropoff_longitude }
          : null,
      });
    } catch (error) {
      console.error('Error resuming active ride:', error);
      Alert.alert('Error', 'Failed to resume ride. Please try again.');
    }
  };

  const handleCallPassenger = async (phoneNumber: string) => {
    try {
      console.log('[handleCallPassenger] Original number:', phoneNumber);
      const cleanedNumber = phoneNumber.replace(/[^0-9+]/g, '');
      console.log('[handleCallPassenger] Cleaned number:', cleanedNumber);
      const phoneUrl = `tel:${cleanedNumber}`;
      console.log('[handleCallPassenger] Phone URL:', phoneUrl);
      
      // Check if device supports tel: URLs
      const canCall = await Linking.canOpenURL(phoneUrl);
      console.log('[handleCallPassenger] Can call:', canCall);
      
      if (canCall) {
        await Linking.openURL(phoneUrl);
      } else {
        // Try without checking (works on some devices)
        try {
          await Linking.openURL(phoneUrl);
        } catch (e) {
          console.error('[handleCallPassenger] Direct open failed:', e);
          Alert.alert(
            'Cannot Make Call',
            'Unable to make phone calls. This may be due to:\n\n' +
            '• Running on emulator/simulator\n' +
            '• Device permissions not granted\n\n' +
            `Phone number: ${cleanedNumber}`
          );
        }
      }
    } catch (error) {
      console.error('[handleCallPassenger] Error:', error);
      Alert.alert('Error', 'Failed to initiate call');
    }
  };

  const handleMessagePassenger = async (phoneNumber: string) => {
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
      console.error('Error messaging passenger:', error);
      Alert.alert('Error', 'Failed to open messaging app');
    }
  };

  const handleAcceptScheduledRide = async (ride: ScheduledRide) => {
    try {
      console.log('[handleAcceptScheduledRide] Starting...');
      console.log('[handleAcceptScheduledRide] Ride ID:', ride.id);
      
      // Get current user (with UUID)
      const { getCurrentUser } = require('../utils/sessionHelper');
      const currentUser = await getCurrentUser();
      console.log('[handleAcceptScheduledRide] Driver email:', currentUser?.email, 'ID:', currentUser?.id);
      
      if (!currentUser || !currentUser.id) {
        console.error('[handleAcceptScheduledRide] No driver user found');
        Alert.alert('Error', 'Driver account not found');
        return;
      }

      const driverAccount = await getUserAccount(currentUser.email);
      console.log('[handleAcceptScheduledRide] Driver account:', driverAccount);
      
      if (!driverAccount || driverAccount.accountType !== 'driver') {
        console.error('[handleAcceptScheduledRide] Invalid driver account');
        Alert.alert('Error', 'Invalid driver account');
        return;
      }

      console.log('[handleAcceptScheduledRide] Calling acceptScheduledRide...');
      
      // Accept the scheduled ride using user_id (UUID), not email
      const result = await acceptScheduledRide(
        ride.id,
        currentUser.id,  // Use UUID instead of email
        driverAccount.fullName,
        driverAccount.phoneNumber,
        driverAccount.profilePhoto || null,
        driverAccount.plateNumber || null
      );

      console.log('[handleAcceptScheduledRide] Result:', JSON.stringify(result, null, 2));

      if (!result.success) {
        console.log('[handleAcceptScheduledRide] ❌ Accept failed:', result.error);
        Alert.alert('Already Accepted', result.error || 'This scheduled ride has already been accepted by another driver.');
        loadScheduledRides(); // Refresh the list
        return;
      }

      console.log('[handleAcceptScheduledRide] ✅ Scheduled ride accepted successfully!');
      
      // Show success message
      Alert.alert(
        'Scheduled Ride Accepted! ✓',
        `You have successfully accepted this scheduled ride:\n\n` +
        `📅 ${new Date(ride.scheduled_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n` +
        `⏰ ${new Date(ride.scheduled_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n\n` +
        `You will receive a notification when it's time to start the ride.`,
        [{ text: 'OK', onPress: () => console.log('[handleAcceptScheduledRide] Alert dismissed') }]
      );
      
      console.log('[handleAcceptScheduledRide] Reloading scheduled rides...');
      
      // Reload both lists
      loadScheduledRides();
      loadAcceptedScheduledRides();
    } catch (error: any) {
      console.error('[handleAcceptScheduledRide] ❌ Unexpected error:', error);
      console.error('[handleAcceptScheduledRide] ❌ Error message:', error.message);
      console.error('[handleAcceptScheduledRide] ❌ Error stack:', error.stack);
      Alert.alert('Error', 'Failed to accept scheduled ride. Please try again.');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // NO VERIFICATION CHECK NEEDED HERE
  // LoginScreen already blocks unverified drivers from logging in
  // If driver reaches this screen, they are already verified

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

        {/* Resume Active Ride Card */}
        {hasActiveTrip && activeTrip && (
          <View style={styles.activeRideContainer}>
            <Card style={styles.activeRideCard}>
              <View style={styles.activeRideHeader}>
                <View style={styles.activeRideBadge}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={styles.activeRideBadgeText}>Active Ride</Text>
                </View>
                <Text style={styles.activeRideStatus}>
                  {activeTrip.status === 'driver_accepted' ? 'Going to pickup' :
                   activeTrip.status === 'arrived' ? 'Arrived at pickup' :
                   activeTrip.status === 'in_progress' ? 'Ride in progress' : 'Active'}
                </Text>
              </View>

              <View style={styles.activeRideRoute}>
                <View style={styles.activeRideRouteItem}>
                  <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.routeContent}>
                    <Text style={styles.routeLabel}>Pickup</Text>
                    <Text style={styles.activeRideLocationText} numberOfLines={1}>
                      {activeTrip.pickup_location}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeDivider} />

                <View style={styles.activeRideRouteItem}>
                  <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
                  <View style={styles.routeContent}>
                    <Text style={styles.routeLabel}>Dropoff</Text>
                    <Text style={styles.activeRideLocationText} numberOfLines={1}>
                      {activeTrip.dropoff_location}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.resumeRideButton}
                onPress={handleResumeActiveRide}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-forward-circle" size={24} color={colors.white} />
                <Text style={styles.resumeRideButtonText}>Continue Ride</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Earnings Summary */}
        {(driverStatus === 'available' || driverStatus === 'on_ride') && (
          <TouchableOpacity
            style={styles.earningsContainer}
            onPress={() => {
              if (navigation) {
                navigation.navigate('DriverEarnings');
              }
            }}
            activeOpacity={0.8}
          >
            <Card style={styles.earningsCard}>
              <View style={styles.earningsContent}>
                <View style={styles.earningsIconContainer}>
                  <Ionicons name="cash" size={24} color={colors.white} />
                </View>
                <View style={styles.earningsInfo}>
                  <Text style={styles.earningsLabel}>Today's Earnings</Text>
                  <Text style={styles.earningsAmount}>₱{todayEarnings.toFixed(2)}</Text>
                  <Text style={styles.earningsSubtext}>₱{weeklyEarnings.toFixed(2)} this week</Text>
                </View>
                <View style={styles.earningsArrow}>
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}

        {/* Active Bookings Section */}
        {driverStatus === 'available' && (
          <View style={styles.bookingsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ride Now Requests</Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{allBookings.length} available</Text>
              </View>
            </View>
            
            {allBookings.length === 0 ? (
              <Card style={styles.emptyBookingsCard}>
                <View style={styles.emptyBookingsContent}>
                  <Ionicons name="notifications-outline" size={48} color={colors.gray} />
                  <Text style={styles.emptyBookingsText}>No ride now requests</Text>
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

        {/* My Accepted Rides Section */}
        {acceptedScheduledRides.length > 0 && (
          <View style={styles.bookingsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Accepted Rides</Text>
              <View style={[styles.badgeContainer, { backgroundColor: colors.success }]}>
                <Text style={styles.badgeText}>{acceptedScheduledRides.length} ride{acceptedScheduledRides.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            
            {acceptedScheduledRides.map((ride) => (
              <Card key={ride.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingStatusBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.bookingStatusText}>Accepted</Text>
                  </View>
                  <Text style={styles.bookingTime}>
                    {new Date(ride.scheduled_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                    {new Date(ride.scheduled_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <View style={styles.locationContainer}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={20} color={colors.primary} />
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationLabel}>Pickup</Text>
                      <Text style={styles.locationText}>{ride.pickup_location}</Text>
                    </View>
                  </View>

                  <View style={styles.locationDivider}>
                    <View style={styles.dottedLine} />
                  </View>

                  <View style={styles.locationRow}>
                    <Ionicons name="flag" size={20} color={colors.error} />
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationLabel}>Dropoff</Text>
                      <Text style={styles.locationText}>{ride.dropoff_location}</Text>
                    </View>
                  </View>
                </View>

                {ride.notes && (
                  <View style={styles.notesContainer}>
                    <Ionicons name="document-text-outline" size={16} color={colors.gray} />
                    <Text style={styles.notesText}>{ride.notes}</Text>
                  </View>
                )}

                <View style={styles.passengerInfo}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
                  <View style={styles.passengerDetails}>
                    <Text style={styles.passengerName}>{ride.passenger_name}</Text>
                    <View style={styles.passengerPhoneRow}>
                      <Ionicons name="call-outline" size={14} color={colors.gray} />
                      <Text style={styles.passengerPhone}>{ride.passenger_phone}</Text>
                    </View>
                  </View>
                  <View style={styles.passengerContactButtons}>
                    <TouchableOpacity
                      style={styles.passengerContactButton}
                      onPress={() => handleCallPassenger(ride.passenger_phone || '')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call" size={16} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.passengerContactButton}
                      onPress={() => handleMessagePassenger(ride.passenger_phone || '')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble" size={16} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.bookingActions}>
                  <Button
                    title="Start Ride"
                    onPress={() => {
                      Alert.alert(
                        'Start Ride',
                        'Are you ready to start this ride? You will be navigated to the ride screen.',
                        [
                          {
                            text: 'Cancel',
                            style: 'cancel',
                          },
                          {
                            text: 'Start',
                            onPress: () => {
                              console.log('[Start Ride] Navigating to DuringRideDriver');
                              console.log('[Start Ride] Ride data:', {
                                pickup: ride.pickup_location,
                                pickupCoords: { lat: ride.pickup_latitude, lng: ride.pickup_longitude },
                                dropoff: ride.dropoff_location,
                                dropoffCoords: { lat: ride.dropoff_latitude, lng: ride.dropoff_longitude },
                              });
                              
                              // Navigate to during ride screen
                              navigation.navigate('DuringRideDriver' as never, {
                                bookingId: ride.id,
                                pickupLocation: ride.pickup_location,
                                dropoffLocation: ride.dropoff_location,
                                pickupCoordinates: {
                                  latitude: ride.pickup_latitude,
                                  longitude: ride.pickup_longitude,
                                },
                                dropoffCoordinates: {
                                  latitude: ride.dropoff_latitude,
                                  longitude: ride.dropoff_longitude,
                                },
                                passengerName: ride.passenger_name,
                                passengerPhone: ride.passenger_phone,
                              } as never);
                            },
                          },
                        ]
                      );
                    }}
                    variant="primary"
                    style={{ flex: 1 }}
                  />
                </View>
                
                <Button
                  title="Cancel Ride"
                  onPress={() => handleCancelAcceptedRide(ride)}
                  variant="primary"
                  style={styles.cancelRideButton}
                />
              </Card>
            ))}
          </View>
        )}

        {/* Scheduled Rides Section */}
        {driverStatus === 'available' && (
          <View style={styles.bookingsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Scheduled Rides</Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{scheduledRides.length} available</Text>
              </View>
            </View>
            
            {scheduledRides.length === 0 ? (
              <Card style={styles.emptyBookingsCard}>
                <View style={styles.emptyBookingsContent}>
                  <Ionicons name="calendar-outline" size={48} color={colors.gray} />
                  <Text style={styles.emptyBookingsText}>No scheduled rides</Text>
                  <Text style={styles.emptyBookingsSubtext}>
                    Scheduled ride requests from passengers will appear here
                  </Text>
                </View>
              </Card>
            ) : (
              scheduledRides.map((ride) => (
              <Card key={ride.id} style={styles.bookingCard}>
                <View style={styles.scheduledBadge}>
                  <Ionicons name="calendar" size={16} color={colors.white} />
                  <Text style={styles.scheduledBadgeText}>Scheduled</Text>
                </View>
                
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingIcon}>
                    <Ionicons name="person" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.bookingHeaderContent}>
                    <Text style={styles.bookingTitle}>
                      {ride.passenger_name || 'Passenger'}
                    </Text>
                    <Text style={styles.bookingPhone}>
                      {ride.passenger_phone || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.scheduledTimeContainer}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                  <Text style={styles.scheduledTimeText}>
                    {new Date(ride.scheduled_datetime).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })} at {new Date(ride.scheduled_datetime).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>

                <View style={styles.routeInfo}>
                  <View style={styles.routeItem}>
                    <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                    <View style={styles.routeContent}>
                      <Text style={styles.routeLabel}>Pickup</Text>
                      <Text style={styles.routeText}>{ride.pickup_location}</Text>
                    </View>
                  </View>

                  <View style={styles.routeDivider} />

                  <View style={styles.routeItem}>
                    <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
                    <View style={styles.routeContent}>
                      <Text style={styles.routeLabel}>Dropoff</Text>
                      <Text style={styles.routeText}>{ride.dropoff_location}</Text>
                    </View>
                  </View>
                </View>

                {ride.notes && (
                  <View style={styles.notesContainer}>
                    <Ionicons name="document-text-outline" size={16} color={colors.gray} />
                    <Text style={styles.notesText}>{ride.notes}</Text>
                  </View>
                )}

                <View style={styles.bookingActions}>
                  <Button
                    title="Accept Scheduled Ride"
                    onPress={() => handleAcceptScheduledRide(ride)}
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
  headerBadgeContainer: {
    marginTop: spacing.xs,
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
  earningsArrow: {
    opacity: 0.8,
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
  earningsSubtext: {
    ...typography.caption,
    color: colors.gray,
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
  scheduledBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  scheduledBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  scheduledTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  scheduledTimeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkText,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray,
    fontStyle: 'italic',
  },
  // Active Ride Card Styles
  activeRideContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  activeRideCard: {
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    ...shadows.medium,
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activeRideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeRideBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  activeRideStatus: {
    fontSize: 13,
    color: colors.gray,
    fontWeight: '500',
  },
  activeRideRoute: {
    marginBottom: spacing.md,
  },
  activeRideRouteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  activeRideLocationText: {
    fontSize: 14,
    color: colors.darkText,
    fontWeight: '500',
    flex: 1,
  },
  resumeRideButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 12,
    ...shadows.small,
  },
  resumeRideButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  passengerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  passengerContactButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  passengerContactButton: {
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRideButton: {
    backgroundColor: colors.error,
    marginTop: 12,
  },
  bookingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: borderRadius.full,
  },
  bookingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  bookingTime: {
    fontSize: 12,
    color: colors.gray,
  },
  locationContainer: {
    gap: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: colors.gray,
    marginBottom: 2,
  },
  locationDivider: {
    paddingLeft: 26,
  },
  dottedLine: {
    width: 2,
    height: 20,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    borderStyle: 'dashed',
  },
});
