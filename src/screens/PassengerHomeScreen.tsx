import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { BottomNavigation, Button, Card, SafetyBadge } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { getCurrentUserFromSupabase, getPassengerFromSupabase } from '../services/userService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PassengerHomeScreenProps {
  navigation?: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSOSPress: () => void;
}

export const PassengerHomeScreen: React.FC<PassengerHomeScreenProps> = ({
  navigation,
  activeTab,
  onTabChange,
  onSOSPress,
}) => {
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [showNearbyTricycles, setShowNearbyTricycles] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('Current Location');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [fareEstimate, setFareEstimate] = useState('₱25 - ₱50');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userName, setUserName] = useState('Passenger');
  const [userLocation, setUserLocation] = useState<Region | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showAddFavoriteModal, setShowAddFavoriteModal] = useState(false);
  const [favoriteLocations, setFavoriteLocations] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const [newFavoriteAddress, setNewFavoriteAddress] = useState('');
  const [newFavoriteCoordinates, setNewFavoriteCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newFavoriteIcon, setNewFavoriteIcon] = useState<'home' | 'briefcase' | 'school' | 'location' | 'heart' | 'star'>('location');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerRegion, setMapPickerRegion] = useState<Region | null>(null);
  const favoriteMapRef = useRef<MapView>(null);
  const mapRef = useRef<MapView>(null);
  
  // Activity stats
  const [totalRides, setTotalRides] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  
  // Active booking state
  const [activeBooking, setActiveBooking] = useState<any>(null);

  const tabs = [
    { name: 'home', label: 'Home', icon: 'home-outline' as const, activeIcon: 'home' as const },
    { name: 'trips', label: 'Trips', icon: 'time-outline' as const, activeIcon: 'time' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
  ];

  // Load user name, favorites, and activity stats from Supabase
  React.useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await getCurrentUserFromSupabase();
        if (user) {
          setUserId(user.id);
          setUserName(user.full_name.split(' ')[0] || 'Passenger');
          
          // Load favorite locations from Supabase
          const { data: favorites, error } = await supabase
            .from('favorite_locations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (!error && favorites) {
            setFavoriteLocations(favorites);
          }
          
          // Load activity stats
          await loadActivityStats(user.id);
          
          // Load active booking
          await loadActiveBooking(user.id);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
    
    // Poll for active booking updates every 3 seconds
    const interval = setInterval(() => {
      if (userId) {
        loadActiveBooking(userId);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [userId]);

  const loadActivityStats = async (passengerId: string) => {
    try {
      // Get completed trips
      const { data: trips, error } = await supabase
        .from('trips')
        .select('*')
        .eq('passenger_id', passengerId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (!error && trips) {
        setTotalRides(trips.length);
        
        // Calculate total spent
        const spent = trips.reduce((sum, trip) => sum + (trip.fare || 0), 0);
        setTotalSpent(spent);
        
        // Calculate average rating (driver's rating of THIS passenger)
        const ratedTrips = trips.filter(trip => trip.driver_rating);
        if (ratedTrips.length > 0) {
          const avgRating = ratedTrips.reduce((sum, trip) => sum + trip.driver_rating, 0) / ratedTrips.length;
          setAverageRating(avgRating);
        } else {
          setAverageRating(null); // No ratings yet
        }
        
        // Get recent 3 trips
        setRecentTrips(trips.slice(0, 3));
      }
    } catch (error) {
      console.error('Error loading activity stats:', error);
    }
  };

  const loadActiveBooking = async (passengerId: string) => {
    try {
      // Get active booking (searching, driver_accepted, arrived, or in_progress)
      const { data: activeTrip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('passenger_id', passengerId)
        .in('status', ['searching', 'driver_accepted', 'arrived', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && activeTrip) {
        setActiveBooking(activeTrip);
      } else {
        setActiveBooking(null);
      }
    } catch (error) {
      console.error('Error loading active booking:', error);
      setActiveBooking(null);
    }
  };

  // Reload favorites when modal opens
  React.useEffect(() => {
    if (showFavoritesModal && userId) {
      const loadFavorites = async () => {
        try {
          const { data: favorites, error } = await supabase
            .from('favorite_locations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          
          if (!error && favorites) {
            setFavoriteLocations(favorites);
          }
        } catch (error) {
          console.error('Error loading favorites:', error);
        }
      };
      loadFavorites();
    }
  }, [showFavoritesModal, userId]);

  // Get user's current location
  useEffect(() => {
    const getLocation = async () => {
      try {
        // Check if location services are enabled
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          Alert.alert(
            'Location Services Disabled',
            'Location services are currently disabled on your device. Please enable location services in your device settings to show your location on the map.',
            [{ text: 'OK' }]
          );
          // Use default location if services disabled
          setUserLocation({
            latitude: 14.5995,
            longitude: 120.9842,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          return;
        }

        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Location permission is required to show your location on the map. Please enable it in your device settings.',
            [{ text: 'OK' }]
          );
          // Use default location if permission denied
          setUserLocation({
            latitude: 14.5995,
            longitude: 120.9842,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          return;
        }

        setLocationPermissionGranted(true);

        // Get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const region: Region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        setUserLocation(region);
        setUserCoordinates({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Animate map to user location
        if (mapRef.current) {
          mapRef.current.animateToRegion(region, 1000);
        }
      } catch (error: any) {
        console.error('Error getting location:', error);
        
        // Provide user-friendly error message
        let errorMessage = 'Unable to get your location. ';
        if (error.message && error.message.includes('location is unavailable')) {
          errorMessage += 'Please make sure that location services are enabled in your device settings.';
        } else if (error.message && error.message.includes('timeout')) {
          errorMessage += 'Location request timed out. Please check your GPS signal and try again.';
        } else {
          errorMessage += 'Please check your device settings and ensure location services are enabled.';
        }
        
        Alert.alert(
          'Location Error',
          errorMessage,
          [{ text: 'OK' }]
        );
        
        // Use default location on error
        setUserLocation({
          latitude: 14.5995,
          longitude: 120.9842,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    };

    getLocation();
  }, []);

  // Real-time tricycle locations will be fetched from online drivers
  const [tricycleLocations, setTricycleLocations] = useState<any[]>([]);

  // Load nearby driver locations function (extracted for reuse)
  // Shows ALL available drivers to ALL passengers - no account-based filtering
  // All passenger accounts are connected to all driver accounts
  const loadNearbyDrivers = React.useCallback(async () => {
    try {
      const { getOnlineDrivers } = require('../services/driverService');
      const { calculateDistance } = require('../services/tripService');
      // Get all online drivers - shows all available drivers from all driver accounts
      const onlineDrivers = await getOnlineDrivers();
      
      if (userCoordinates && onlineDrivers.length > 0) {
        // Filter out drivers with invalid coordinates only
        // No filtering by account type, tenant, or any other restriction
        // All passengers can see all available drivers
        const validDrivers = onlineDrivers.filter((driver: any) => 
          driver.latitude && 
          driver.longitude && 
          !isNaN(driver.latitude) && 
          !isNaN(driver.longitude) &&
          driver.is_online === true
        );
        
        if (validDrivers.length === 0) {
          setTricycleLocations([]);
          return;
        }
        
        // Calculate distance for each driver and format for display
        const driversWithDistance = await Promise.all(
          validDrivers.map(async (driver: any) => {
            const distanceKm = calculateDistance(
              userCoordinates.latitude,
              userCoordinates.longitude,
              driver.latitude,
              driver.longitude
            );
            
            // Estimate ETA (rough calculation: 30 km/h average speed, minimum 1 minute)
            const estimatedMinutes = Math.max(1, Math.round((distanceKm / 30) * 60));
            
            // Get safety badge for driver
            let safetyBadge = 'yellow' as 'green' | 'yellow' | 'red';
            try {
              const { getDriverSafetyRecord } = require('../services/safetyService');
              const safetyRecord = await getDriverSafetyRecord(driver.user_id);
              if (safetyRecord) {
                safetyBadge = safetyRecord.safetyBadge;
              }
            } catch (error) {
              console.error('Error getting safety badge:', error);
            }
            
            return {
              id: driver.user_id,
              name: driver.full_name,
              latitude: driver.latitude,
              longitude: driver.longitude,
              eta: `${estimatedMinutes} min`,
              distance: `${distanceKm.toFixed(1)} km`,
              distanceKm, // Store as number for sorting
              tricyclePlate: driver.plate_number || 'N/A',
              rating: driver.average_rating || 0,
              totalRides: driver.total_rides || 0,
              driverEmail: driver.user_id,
              safetyBadge,
            };
          })
        );
        
        // Sort by distance (closest first) - using the distanceKm number for reliable sorting
        const sortedDrivers = driversWithDistance.sort((a: any, b: any) => {
          return a.distanceKm - b.distanceKm;
        });
        
        setTricycleLocations(sortedDrivers);
      } else {
        setTricycleLocations([]);
      }
    } catch (error) {
      console.error('Error loading nearby drivers:', error);
      setTricycleLocations([]);
    }
  }, [userCoordinates]);

  // Load nearby driver locations
  useEffect(() => {
    // Load drivers when user location is available
    if (userCoordinates) {
      // Load immediately
      loadNearbyDrivers();
      
      // Update every 5 seconds to get fresh locations (more frequent updates)
      const interval = setInterval(loadNearbyDrivers, 5000);
      return () => clearInterval(interval);
    }
  }, [userCoordinates, loadNearbyDrivers]);

  // Refresh drivers when modal opens
  useEffect(() => {
    if (showNearbyTricycles && userCoordinates) {
      // Immediately refresh when modal opens
      loadNearbyDrivers();
    }
  }, [showNearbyTricycles, userCoordinates, loadNearbyDrivers]);

  const handleFindNearby = () => {
    setShowNearbyTricycles(true);
  };

  const handleBookRide = () => {
    // Navigate to EnterDropoffScreen
    if (navigation) {
      navigation.navigate('EnterDropoff', {
        pickupLocation: pickupLocation,
        pickupCoordinates: userCoordinates,
      });
    } else {
      setShowBookingSheet(true);
    }
  };

  const handleSchedule = () => {
    navigation.navigate('ScheduleHistory');
  };

  const handleFavorites = () => {
    navigation.navigate('Favorites', { userId });
  };

  const handleAddFavorite = () => {
    setShowAddFavoriteModal(true);
  };

  const handleSaveFavorite = async () => {
    if (!newFavoriteName.trim() || !newFavoriteAddress.trim() || !newFavoriteCoordinates || !userId) {
      Alert.alert('Missing Information', 'Please provide a name, address, and location for your favorite.');
      return;
    }

    try {
      // Insert into Supabase
      const { error } = await supabase
        .from('favorite_locations')
        .insert({
          user_id: userId,
          name: newFavoriteName.trim(),
          address: newFavoriteAddress.trim(),
          latitude: newFavoriteCoordinates.latitude,
          longitude: newFavoriteCoordinates.longitude,
          icon: newFavoriteIcon,
        });
      
      if (error) throw error;
      
      // Reload favorites
      const { data: favorites } = await supabase
        .from('favorite_locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (favorites) {
        setFavoriteLocations(favorites);
      }
      
      // Reset form
      setNewFavoriteName('');
      setNewFavoriteAddress('');
      setNewFavoriteCoordinates(null);
      setNewFavoriteIcon('location');
      setShowAddFavoriteModal(false);
      
      Alert.alert('Success', 'Favorite location added successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add favorite location');
    }
  };

  const handleDeleteFavorite = async (favoriteId: string) => {
    Alert.alert(
      'Delete Favorite',
      'Are you sure you want to delete this favorite location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('favorite_locations')
                .delete()
                .eq('id', favoriteId);
              
              if (error) throw error;
              
              // Reload favorites
              const { data: favorites } = await supabase
                .from('favorite_locations')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
              
              if (favorites) {
                setFavoriteLocations(favorites);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete favorite location');
            }
          },
        },
      ]
    );
  };

  const handleUseFavorite = (favorite: any, useAs: 'pickup' | 'dropoff') => {
    const coords = { latitude: favorite.latitude, longitude: favorite.longitude };
    
    if (useAs === 'pickup') {
      setPickupLocation(favorite.name);
      if (navigation) {
        navigation.navigate('EnterDropoff', {
          pickupLocation: favorite.name,
          pickupCoordinates: coords,
        });
      } else {
        setShowFavoritesModal(false);
        setShowBookingSheet(true);
      }
    } else {
      setDropoffLocation(favorite.name);
      setShowFavoritesModal(false);
      if (navigation) {
        navigation.navigate('EnterDropoff', {
          pickupLocation: pickupLocation,
          pickupCoordinates: userCoordinates,
          dropoffLocation: favorite.name,
          dropoffCoordinates: coords,
        });
      }
    }
  };

  const handleConfirmBooking = () => {
    Alert.alert('Booking Confirmed', 'Your ride has been booked successfully!');
    setShowBookingSheet(false);
    setShowNearbyTricycles(true);
  };

  const handleScheduleRide = (date: Date, time: string, pickup: string, dropoff: string) => {
    Alert.alert(
      'Ride Scheduled',
      `Your ride is scheduled for ${date.toLocaleDateString()} at ${time}.\n\nPickup: ${pickup}\nDropoff: ${dropoff}`,
      [{ text: 'OK', onPress: () => setShowScheduleModal(false) }]
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleCenterOnUser = async () => {
    try {
      if (locationPermissionGranted) {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const region: Region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        setUserLocation(region);
        if (mapRef.current) {
          mapRef.current.animateToRegion(region, 1000);
        }
      } else {
        // Request permission again
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationPermissionGranted(true);
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const region: Region = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };

          setUserLocation(region);
          setUserCoordinates({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          if (mapRef.current) {
            mapRef.current.animateToRegion(region, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Error centering on user:', error);
      Alert.alert('Error', 'Unable to get your location. Please check your location settings.');
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Modern Header with Design */}
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
                    <Text style={styles.userNameText}>{userName}</Text>
                  </View>
                </View>
                <View style={styles.locationBadge}>
                  <Ionicons name="location" size={12} color={colors.primary} />
                  <Text style={styles.locationText}>Lopez, Quezon</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => {
                  Alert.alert(
                    'Notifications',
                    'No new notifications',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.darkText} />
                <View style={styles.notificationBadge} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Booking Card */}
          {activeBooking && (
            <View style={styles.activeBookingContainer}>
              <View style={styles.activeBookingCard}>
                <View style={styles.activeBookingHeader}>
                  <View style={styles.activeBookingStatusBadge}>
                    <View style={styles.pulseIndicator} />
                    <Text style={styles.activeBookingStatusText}>
                      {activeBooking.status === 'searching' && 'Finding Driver...'}
                      {activeBooking.status === 'driver_accepted' && 'Driver Accepted'}
                      {activeBooking.status === 'arrived' && 'Driver Arrived'}
                      {activeBooking.status === 'in_progress' && 'Trip In Progress'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      // Navigate to appropriate screen based on status
                      if (activeBooking.status === 'searching') {
                        navigation?.navigate('SearchingDriver', {
                          bookingId: activeBooking.id,
                          pickupLocation: activeBooking.pickup_location,
                          dropoffLocation: activeBooking.dropoff_location,
                          pickupCoordinates: {
                            latitude: activeBooking.pickup_latitude,
                            longitude: activeBooking.pickup_longitude,
                          },
                          dropoffCoordinates: {
                            latitude: activeBooking.dropoff_latitude,
                            longitude: activeBooking.dropoff_longitude,
                          },
                          distance: activeBooking.distance,
                          fareEstimate: { min: activeBooking.fare, max: activeBooking.fare },
                        });
                      }
                    }}
                  >
                    <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.activeBookingContent}>
                  <View style={styles.activeBookingRoute}>
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {activeBooking.pickup_location}
                      </Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {activeBooking.dropoff_location}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.activeBookingDetails}>
                    <View style={styles.bookingDetailItem}>
                      <Ionicons name="cash-outline" size={16} color={colors.gray} />
                      <Text style={styles.bookingDetailText}>₱{activeBooking.fare}</Text>
                    </View>
                    <View style={styles.bookingDetailItem}>
                      <Ionicons name="navigate-outline" size={16} color={colors.gray} />
                      <Text style={styles.bookingDetailText}>{activeBooking.distance?.toFixed(1)} km</Text>
                    </View>
                  </View>
                </View>
                
                {/* Cancel Button - Only show when searching for driver */}
                {activeBooking.status === 'searching' && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      Alert.alert(
                        'Cancel Ride',
                        'Are you sure you want to cancel this ride request?',
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
                                // Use cancelTrip from tripService
                                const { cancelTrip } = require('../services/tripService');
                                const result = await cancelTrip(activeBooking.id, 'passenger');

                                if (!result.success) {
                                  console.error('Error cancelling trip:', result.error);
                                  Alert.alert('Error', result.error || 'Failed to cancel ride. Please try again.');
                                } else {
                                  // Refresh active booking
                                  if (userId) {
                                    await loadActiveBooking(userId);
                                  }
                                  Alert.alert('Ride Cancelled', 'Your ride request has been cancelled.');
                                }
                              } catch (error) {
                                console.error('Error cancelling ride:', error);
                                Alert.alert('Error', 'Failed to cancel ride. Please try again.');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                    <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Main Search Bar - Prominent */}
          <View style={styles.searchContainer}>
            <TouchableOpacity
              style={styles.searchBar}
              onPress={handleBookRide}
              activeOpacity={0.9}
            >
              <View style={styles.searchIconWrapper}>
                <Ionicons name="search" size={22} color={colors.white} />
              </View>
              <View style={styles.searchTextWrapper}>
                <Text style={styles.searchPlaceholder}>Where would you like to go?</Text>
                <Text style={styles.searchSubtext}>Tap to book a ride</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.quickActionsContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={handleFindNearby}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconWrapper, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="location" size={24} color={colors.primary} />
                </View>
                <Text style={styles.actionLabel}>Find Nearby</Text>
                <Text style={styles.actionSubtext}>Available rides</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={handleSchedule}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconWrapper, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="time" size={24} color={colors.buttonPrimary} />
                </View>
                <Text style={styles.actionLabel}>Schedule</Text>
                <Text style={styles.actionSubtext}>Plan ahead</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={handleFavorites}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconWrapper, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="heart" size={24} color="#9C27B0" />
                </View>
                <Text style={styles.actionLabel}>Favorites</Text>
                <Text style={styles.actionSubtext}>Saved places</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Discount Verification Card - Redesigned */}
          <TouchableOpacity
            style={styles.discountVerificationCard}
            onPress={() => navigation?.navigate('DiscountVerification')}
            activeOpacity={0.85}
          >
            <View style={styles.discountCardGradient}>
              <View style={styles.discountCardHeader}>
                <View style={styles.discountBadge}>
                  <Ionicons name="pricetag" size={20} color={colors.white} />
                  <Text style={styles.discountBadgeText}>SAVE 20%</Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color={colors.white} />
              </View>
              
              <Text style={styles.discountMainTitle}>
                Get Your Discount Now! 🎉
              </Text>
              
              <Text style={styles.discountDescription}>
                Upload your Senior Citizen or PWD ID and enjoy 20% off on all rides after admin verification
              </Text>
              
              <View style={styles.discountFeatures}>
                <View style={styles.discountFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                  <Text style={styles.discountFeatureText}>Quick verification</Text>
                </View>
                <View style={styles.discountFeatureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                  <Text style={styles.discountFeatureText}>Lifetime discount</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Stats Section */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Your Activity</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="car" size={20} color={colors.success} />
                </View>
                <Text style={styles.statValue}>{totalRides}</Text>
                <Text style={styles.statLabel}>Total Rides</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="star" size={20} color={colors.warning} />
                </View>
                <Text style={styles.statValue}>
                  {averageRating ? averageRating.toFixed(1) : '-'}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="cash" size={20} color={colors.buttonPrimary} />
                </View>
                <Text style={styles.statValue}>₱{totalSpent.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
            </View>
          </View>

          {/* Recent Activity Section */}
          <View style={styles.recentContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Trips</Text>
              <TouchableOpacity onPress={() => navigation?.navigate('PassengerTrips' as never)}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentTrips.length === 0 ? (
              <View style={styles.recentCard}>
                <View style={styles.recentIconWrapper}>
                  <Ionicons name="time-outline" size={24} color={colors.gray} />
                </View>
                <View style={styles.recentContent}>
                  <Text style={styles.recentTitle}>No recent trips</Text>
                  <Text style={styles.recentSubtext}>Your trip history will appear here</Text>
                </View>
              </View>
            ) : (
              recentTrips.map((trip) => (
                <View key={trip.id} style={styles.recentCard}>
                  <View style={styles.recentIconWrapper}>
                    <Ionicons name="car" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.recentContent}>
                    <Text style={styles.recentTitle}>
                      {trip.pickup_location} → {trip.dropoff_location}
                    </Text>
                    <Text style={styles.recentSubtext}>
                      {new Date(trip.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.recentFare}>₱{trip.fare || 0}</Text>
                </View>
              ))
            )}
          </View>

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

        {/* Nearby Tricycles Modal */}
        <Modal
          visible={showNearbyTricycles}
          animationType="slide"
          transparent
          onRequestClose={() => setShowNearbyTricycles(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setShowNearbyTricycles(false)}>
              <View style={styles.modalOverlayPressable} />
            </TouchableWithoutFeedback>
            <View style={styles.bottomSheetOverlay}>
              <View style={styles.nearbyTricyclesContainer}>
                <View style={styles.bottomSheetHandle} />
                <View style={styles.nearbyTricyclesHeader}>
                  <View style={styles.nearbyHeaderContent}>
                    <View>
                      <Text style={styles.bottomSheetTitle}>Available Rides</Text>
                      <View style={styles.headerSubtitleRow}>
                        <View style={styles.badgeContainer}>
                          <Ionicons name="location" size={14} color={colors.primary} />
                          <Text style={styles.badgeText}>{`${tricycleLocations.length} nearby`}</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity 
                      onPress={() => setShowNearbyTricycles(false)}
                      style={styles.closeButtonModern}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={28} color={colors.gray} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  style={styles.tricycleListVertical}
                  contentContainerStyle={styles.tricycleListContent}
                  nestedScrollEnabled={true}
                  bounces={true}
                  scrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {tricycleLocations.length === 0 ? (
                    <View style={styles.emptyTricycleState}>
                      <Ionicons name="bicycle-outline" size={48} color={colors.gray} />
                      <Text style={styles.emptyTricycleText}>No drivers available nearby</Text>
                      <Text style={styles.emptyTricycleSubtext}>Try again in a few moments</Text>
                    </View>
                  ) : (
                    tricycleLocations.map((tricycle, index) => (
                      <View key={tricycle.id || index} style={styles.modernTricycleCard}>
                      <View style={styles.cardTopSection}>
                        <View style={styles.driverAvatarContainer}>
                          <View style={styles.avatarGradient}>
                            <Ionicons name="person" size={24} color={colors.white} />
                          </View>
                          <View style={styles.onlineIndicator} />
                        </View>
                        <View style={styles.driverInfoSection}>
                          <View style={styles.driverNameRow}>
                            <Text style={styles.driverName}>{tricycle.name || 'Available Driver'}</Text>
                            <View style={styles.badgeRow}>
                              {tricycle.safetyBadge && (
                                <SafetyBadge badgeColor={tricycle.safetyBadge} size="small" showLabel={false} />
                              )}
                              {tricycle.rating && tricycle.rating > 0 && (
                                <View style={styles.ratingBadge}>
                                  <Ionicons name="star" size={12} color={colors.warning} />
                                  <Text style={styles.ratingText}>{tricycle.rating.toFixed(1)}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <Text style={styles.vehicleInfo}>
                            {tricycle.tricyclePlate ? `Tricycle • ${tricycle.tricyclePlate}` : 'Tricycle'}
                          </Text>
                          <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                              <Ionicons name="time-outline" size={14} color={colors.primary} />
                              <Text style={styles.statText}>{tricycle.eta || 'N/A'}</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                              <Ionicons name="location-outline" size={14} color={colors.error} />
                              <Text style={styles.statText}>{tricycle.distance || 'N/A'}</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                              <Ionicons name="people-outline" size={14} color={colors.gray} />
                              <Text style={styles.statText}>Available</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.cardBottomSection}>
                        <View style={styles.fareSection}>
                          <Text style={styles.fareLabel}>Available Now</Text>
                          <Text style={styles.fareAmount}>{tricycle.distance || 'Nearby'}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.selectButtonModern}
                          onPress={async () => {
                            // Navigate to booking with selected driver
                            if (navigation) {
                              setShowNearbyTricycles(false);
                              // Navigate to EnterDropoff with driver info
                              navigation.navigate('EnterDropoff', {
                                pickupLocation: pickupLocation || 'Current Location',
                                pickupCoordinates: userCoordinates,
                                selectedDriver: {
                                  id: tricycle.id,
                                  name: tricycle.name,
                                  distance: tricycle.distance,
                                  eta: tricycle.eta,
                                  tricyclePlate: tricycle.tricyclePlate,
                                  rating: tricycle.rating,
                                  coordinates: {
                                    latitude: tricycle.latitude,
                                    longitude: tricycle.longitude,
                                  },
                                },
                              });
                            } else {
                              Alert.alert(
                                'Driver Selected',
                                `You selected ${tricycle.name || 'this driver'}. Proceed to booking?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Book Now',
                                    onPress: () => {
                                      setShowNearbyTricycles(false);
                                      setShowBookingSheet(true);
                                    },
                                  },
                                ]
                              );
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.selectButtonText}>Select & Book</Text>
                          <Ionicons name="arrow-forward" size={18} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>



        {/* Bottom Navigation */}
        <BottomNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={onTabChange}
        />

        {/* Modern Booking Bottom Sheet */}
        <Modal
          visible={showBookingSheet}
          animationType="slide"
          transparent
          onRequestClose={() => setShowBookingSheet(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowBookingSheet(false)}
          >
            <View style={styles.bottomSheetOverlay}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <View style={styles.bottomSheet}>
                  <View style={styles.bottomSheetHandle} />
                  <View style={styles.bottomSheetHeader}>
                    <Text style={styles.bottomSheetTitle}>Book a Ride</Text>
                    <TouchableOpacity onPress={() => setShowBookingSheet(false)}>
                      <Ionicons name="close" size={24} color={colors.gray} />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.bookingForm}>
                      {/* Pickup Location */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#E3F2FD' }]}>
                            <Ionicons name="location" size={20} color={colors.primary} />
                          </View>
                          <Text style={styles.locationCardLabel}>Pickup Location</Text>
                        </View>
                        <View style={styles.locationInputContainer}>
                          <TextInput
                            style={styles.locationInputText}
                            value={pickupLocation}
                            onChangeText={setPickupLocation}
                            placeholder="Enter pickup location"
                            placeholderTextColor={colors.gray}
                          />
                          <TouchableOpacity>
                            <Ionicons name="locate" size={22} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Dropoff Location */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#FFE5E5' }]}>
                            <Ionicons name="location" size={20} color={colors.error} />
                          </View>
                          <Text style={styles.locationCardLabel}>Dropoff Location</Text>
                        </View>
                        <View style={styles.locationInputContainer}>
                          <TextInput
                            style={styles.locationInputText}
                            value={dropoffLocation}
                            onChangeText={setDropoffLocation}
                            placeholder="Where are you going?"
                            placeholderTextColor={colors.gray}
                          />
                          <TouchableOpacity>
                            <Ionicons name="search" size={22} color={colors.gray} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Fare Estimate Card */}
                      <Card style={styles.fareCard}>
                        <View style={styles.fareCardContent}>
                          <View style={styles.fareCardLeft}>
                            <Ionicons name="cash" size={24} color={colors.buttonPrimary} />
                            <View style={styles.fareCardInfo}>
                              <Text style={styles.fareCardLabel}>Estimated Fare</Text>
                              <Text style={styles.fareCardAmount}>{fareEstimate}</Text>
                            </View>
                          </View>
                          <View style={styles.fareCardRight}>
                            <Ionicons name="information-circle-outline" size={20} color={colors.gray} />
                          </View>
                        </View>
                      </Card>

                      {/* Confirm Button */}
                      <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={handleConfirmBooking}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                        <Ionicons name="arrow-forward" size={20} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Schedule Ride Modal */}
        <Modal
          visible={showScheduleModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowScheduleModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowScheduleModal(false)}
          >
            <View style={styles.bottomSheetOverlay}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <View style={styles.bottomSheet}>
                  <View style={styles.bottomSheetHandle} />
                  <View style={styles.bottomSheetHeader}>
                    <Text style={styles.bottomSheetTitle}>Schedule a Ride</Text>
                    <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                      <Ionicons name="close" size={24} color={colors.gray} />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView 
                    showsVerticalScrollIndicator={false}
                    style={styles.modalScrollView}
                    contentContainerStyle={styles.modalScrollContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.bookingForm}>
                      <Text style={styles.scheduleInfo}>
                        Select a date and time for your ride. You'll be notified before your scheduled pickup.
                      </Text>

                      {/* Pickup Location */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#E3F2FD' }]}>
                            <Ionicons name="location" size={20} color={colors.primary} />
                          </View>
                          <Text style={styles.locationCardLabel}>Pickup Location</Text>
                        </View>
                        <View style={styles.locationInputContainer}>
                          <TextInput
                            style={styles.locationInputText}
                            value={pickupLocation}
                            onChangeText={setPickupLocation}
                            placeholder="Enter pickup location"
                            placeholderTextColor={colors.gray}
                          />
                        </View>
                      </View>

                      {/* Dropoff Location */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#FFE5E5' }]}>
                            <Ionicons name="location" size={20} color={colors.error} />
                          </View>
                          <Text style={styles.locationCardLabel}>Dropoff Location</Text>
                        </View>
                        <View style={styles.locationInputContainer}>
                          <TextInput
                            style={styles.locationInputText}
                            value={dropoffLocation}
                            onChangeText={setDropoffLocation}
                            placeholder="Where are you going?"
                            placeholderTextColor={colors.gray}
                          />
                        </View>
                      </View>

                      {/* Date and Time Selection */}
                      <Card style={styles.scheduleCard}>
                        <View style={styles.scheduleRow}>
                          <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                          <View style={styles.scheduleContent}>
                            <Text style={styles.scheduleLabel}>Date</Text>
                            <Text style={styles.scheduleValue}>
                              {new Date().toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.scheduleRow}>
                          <Ionicons name="time-outline" size={24} color={colors.primary} />
                          <View style={styles.scheduleContent}>
                            <Text style={styles.scheduleLabel}>Time</Text>
                            <Text style={styles.scheduleValue}>
                              {new Date().toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </Text>
                          </View>
                        </View>
                      </Card>

                      <Button
                        title="Schedule Ride"
                        onPress={() => {
                          const scheduleDate = new Date();
                          const scheduleTime = scheduleDate.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          });
                          handleScheduleRide(scheduleDate, scheduleTime, pickupLocation, dropoffLocation);
                        }}
                        style={styles.confirmButton}
                      />
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Favorites Modal */}
        <Modal
          visible={showFavoritesModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowFavoritesModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFavoritesModal(false)}
          >
            <View style={styles.bottomSheetOverlay}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <View style={styles.bottomSheet}>
                  <View style={styles.bottomSheetHandle} />
                  <View style={styles.bottomSheetHeader}>
                    <Text style={styles.bottomSheetTitle}>Favorite Locations</Text>
                    <TouchableOpacity onPress={() => setShowFavoritesModal(false)}>
                      <Ionicons name="close" size={24} color={colors.gray} />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView 
                    showsVerticalScrollIndicator={false}
                    style={styles.modalScrollView}
                    contentContainerStyle={styles.modalScrollContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.favoritesContent}>
                      {favoriteLocations.length === 0 ? (
                        <View style={styles.emptyFavoritesContainer}>
                          <Ionicons name="heart-outline" size={64} color={colors.gray} />
                          <Text style={styles.emptyFavoritesText}>No favorite locations yet</Text>
                          <Text style={styles.emptyFavoritesSubtext}>
                            Add your frequently visited places for quick access
                          </Text>
                        </View>
                      ) : (
                        favoriteLocations.map((favorite) => {
                          const iconMap = {
                            home: 'home',
                            briefcase: 'briefcase',
                            school: 'school',
                            location: 'location',
                            heart: 'heart',
                            star: 'star',
                          };
                          return (
                            <View key={favorite.id} style={styles.favoriteItem}>
                              <View style={styles.favoriteIcon}>
                                <Ionicons 
                                  name={(iconMap as any)[favorite.icon || 'location'] || 'location'} 
                                  size={24} 
                                  color={colors.primary} 
                                />
                              </View>
                              <View style={styles.favoriteInfo}>
                                <Text style={styles.favoriteName}>{favorite.name}</Text>
                                <Text style={styles.favoriteAddress} numberOfLines={2}>
                                  {favorite.address}
                                </Text>
                              </View>
                              <View style={styles.favoriteActions}>
                                <TouchableOpacity
                                  onPress={() => handleUseFavorite(favorite, 'pickup')}
                                  style={styles.favoriteActionButton}
                                >
                                  <Ionicons name="arrow-forward" size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleDeleteFavorite(favorite.id)}
                                  style={styles.favoriteActionButton}
                                >
                                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}

                      <TouchableOpacity
                        style={styles.addFavoriteButton}
                        onPress={handleAddFavorite}
                      >
                        <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                        <Text style={styles.addFavoriteText}>Add Favorite Location</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Add Favorite Modal */}
        <Modal
          visible={showAddFavoriteModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAddFavoriteModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddFavoriteModal(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.addFavoriteBottomSheet}
            >
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <View style={styles.addFavoriteContent}>
                    <View style={styles.bottomSheetHandle} />
                    <View style={styles.bottomSheetHeader}>
                      <Text style={styles.bottomSheetTitle}>Add Favorite Location</Text>
                      <TouchableOpacity onPress={() => setShowAddFavoriteModal(false)}>
                        <Ionicons name="close" size={24} color={colors.gray} />
                      </TouchableOpacity>
                    </View>
                    
                    <ScrollView 
                      showsVerticalScrollIndicator={true}
                      style={styles.addFavoriteScrollView}
                      contentContainerStyle={styles.addFavoriteScrollContent}
                      keyboardShouldPersistTaps="handled"
                      bounces={true}
                    >
                      <View style={styles.bookingForm}>
                      <Text style={styles.scheduleInfo}>
                        Save a location you frequently visit for quick access when booking rides.
                      </Text>

                      {/* Location Name */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#E3F2FD' }]}>
                            <Ionicons name="pencil" size={20} color={colors.primary} />
                          </View>
                          <Text style={styles.locationCardLabel}>Location Name</Text>
                        </View>
                        <View style={styles.locationInputContainer}>
                          <TextInput
                            style={styles.locationInputText}
                            value={newFavoriteName}
                            onChangeText={setNewFavoriteName}
                            placeholder="e.g., Home, Work, School"
                            placeholderTextColor={colors.gray}
                          />
                        </View>
                      </View>

                      {/* Address */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#FFE5E5' }]}>
                            <Ionicons name="location" size={20} color={colors.error} />
                          </View>
                          <Text style={styles.locationCardLabel}>Address</Text>
                        </View>
                        <View style={styles.locationInputContainer}>
                          <TextInput
                            style={styles.locationInputText}
                            value={newFavoriteAddress}
                            onChangeText={setNewFavoriteAddress}
                            placeholder="Enter full address"
                            placeholderTextColor={colors.gray}
                            multiline
                          />
                        </View>
                      </View>

                      {/* Location Selection Options */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#E8F5E9' }]}>
                            <Ionicons name="map" size={20} color={colors.success} />
                          </View>
                          <Text style={styles.locationCardLabel}>Select Location</Text>
                        </View>
                        <View style={styles.locationSelectionButtons}>
                          <TouchableOpacity
                            style={styles.locationSelectionButton}
                            onPress={async () => {
                              try {
                                const { status } = await Location.requestForegroundPermissionsAsync();
                                if (status === 'granted') {
                                  const location = await Location.getCurrentPositionAsync({
                                    accuracy: Location.Accuracy.High,
                                  });
                                  const coords = {
                                    latitude: location.coords.latitude,
                                    longitude: location.coords.longitude,
                                  };
                                  setNewFavoriteCoordinates(coords);
                                  
                                  // Try to get address
                                  try {
                                    const addresses = await Location.reverseGeocodeAsync(coords);
                                    if (addresses && addresses.length > 0) {
                                      const address = addresses[0];
                                      const addressParts: string[] = [];
                                      if (address.street) addressParts.push(address.street);
                                      if (address.name) addressParts.push(address.name);
                                      if (address.district) addressParts.push(address.district);
                                      if (address.city) addressParts.push(address.city);
                                      if (address.region) addressParts.push(address.region);
                                      
                                      if (addressParts.length > 0) {
                                        setNewFavoriteAddress(addressParts.join(', '));
                                      }
                                    }
                                  } catch (error) {
                                    console.log('Reverse geocoding failed');
                                  }
                                  
                                  Alert.alert('Success', 'Current location captured!');
                                } else {
                                  Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
                                }
                              } catch (error) {
                                Alert.alert('Error', 'Failed to get your current location.');
                              }
                            }}
                          >
                            <Ionicons name="locate" size={20} color={colors.primary} />
                            <Text style={styles.locationSelectionButtonText}>Current Location</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={styles.locationSelectionButton}
                            onPress={() => {
                              setShowMapPicker(true);
                            }}
                          >
                            <Ionicons name="map" size={20} color={colors.primary} />
                            <Text style={styles.locationSelectionButtonText}>Pick on Map</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Show selected coordinates if available */}
                        {newFavoriteCoordinates && (
                          <View style={styles.selectedCoordinatesContainer}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                            <Text style={styles.selectedCoordinatesText}>
                              Selected: {newFavoriteCoordinates.latitude.toFixed(6)}, {newFavoriteCoordinates.longitude.toFixed(6)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Icon Selection */}
                      <View style={styles.locationCard}>
                        <View style={styles.locationHeader}>
                          <View style={[styles.locationIcon, { backgroundColor: '#FFF3E0' }]}>
                            <Ionicons name="image-outline" size={20} color={colors.warning} />
                          </View>
                          <Text style={styles.locationCardLabel}>Icon</Text>
                        </View>
                        <View style={styles.iconSelectionContainer}>
                          {(['home', 'briefcase', 'school', 'location', 'heart', 'star'] as const).map((icon) => (
                            <TouchableOpacity
                              key={icon}
                              style={[
                                styles.iconOption,
                                newFavoriteIcon === icon && styles.iconOptionSelected
                              ]}
                              onPress={() => setNewFavoriteIcon(icon)}
                            >
                              <Ionicons 
                                name={icon === 'location' ? 'location' : icon as any} 
                                size={24} 
                                color={newFavoriteIcon === icon ? colors.white : colors.primary} 
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Save Button */}
                      <TouchableOpacity
                        style={[
                          styles.confirmButton,
                          (!newFavoriteName.trim() || !newFavoriteAddress.trim() || !newFavoriteCoordinates) && 
                          styles.confirmButtonDisabled
                        ]}
                        onPress={handleSaveFavorite}
                        disabled={!newFavoriteName.trim() || !newFavoriteAddress.trim() || !newFavoriteCoordinates}
                      >
                        <Text style={styles.confirmButtonText}>Save Favorite</Text>
                        <Ionicons name="checkmark" size={20} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </TouchableOpacity>
        </Modal>

        {/* Map Picker Modal */}
        <Modal
          visible={showMapPicker}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowMapPicker(false)}
        >
          <SafeAreaView style={styles.mapPickerContainer}>
            <View style={styles.mapPickerHeader}>
              <TouchableOpacity
                onPress={() => setShowMapPicker(false)}
                style={styles.mapPickerBackButton}
              >
                <Ionicons name="arrow-back" size={24} color={colors.darkText} />
              </TouchableOpacity>
              <Text style={styles.mapPickerTitle}>Pick Location on Map</Text>
              <View style={styles.mapPickerBackButton} />
            </View>
            
            <MapView
              ref={favoriteMapRef}
              style={styles.mapPickerMap}
              initialRegion={
                mapPickerRegion || userLocation || {
                  latitude: 13.8844,
                  longitude: 122.2603,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }
              }
              region={mapPickerRegion || userLocation || undefined}
              showsUserLocation={locationPermissionGranted}
              onPress={async (event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                const coords = { latitude, longitude };
                setNewFavoriteCoordinates(coords);
                
                // Update map region to center on selected location
                setMapPickerRegion({
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
                
                // Get address for selected location
                try {
                  const addresses = await Location.reverseGeocodeAsync(coords);
                  if (addresses && addresses.length > 0) {
                    const address = addresses[0];
                    const addressParts: string[] = [];
                    if (address.street) addressParts.push(address.street);
                    if (address.name) addressParts.push(address.name);
                    if (address.district) addressParts.push(address.district);
                    if (address.city) addressParts.push(address.city);
                    if (address.region) addressParts.push(address.region);
                    
                    if (addressParts.length > 0) {
                      setNewFavoriteAddress(addressParts.join(', '));
                    }
                  }
                } catch (error) {
                  console.log('Reverse geocoding failed');
                }
              }}
              onLongPress={async (event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                const coords = { latitude, longitude };
                setNewFavoriteCoordinates(coords);
                
                // Update map region
                setMapPickerRegion({
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
                
                // Get address
                try {
                  const addresses = await Location.reverseGeocodeAsync(coords);
                  if (addresses && addresses.length > 0) {
                    const address = addresses[0];
                    const addressParts: string[] = [];
                    if (address.street) addressParts.push(address.street);
                    if (address.name) addressParts.push(address.name);
                    if (address.district) addressParts.push(address.district);
                    if (address.city) addressParts.push(address.city);
                    if (address.region) addressParts.push(address.region);
                    
                    if (addressParts.length > 0) {
                      setNewFavoriteAddress(addressParts.join(', '));
                    }
                  }
                } catch (error) {
                  console.log('Reverse geocoding failed');
                }
              }}
            >
              {newFavoriteCoordinates && (
                <Marker
                  coordinate={newFavoriteCoordinates}
                  title="Selected Location"
                  pinColor={colors.primary}
                />
              )}
            </MapView>
            
            <View style={styles.mapPickerFooter}>
              <View style={styles.mapPickerInfo}>
                <Ionicons name="information-circle" size={20} color={colors.primary} />
                <Text style={styles.mapPickerInfoText}>
                  Tap on the map to select a location
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.mapPickerConfirmButton,
                  !newFavoriteCoordinates && styles.mapPickerConfirmButtonDisabled
                ]}
                onPress={() => {
                  if (newFavoriteCoordinates) {
                    setShowMapPicker(false);
                  }
                }}
                disabled={!newFavoriteCoordinates}
              >
                <Text style={styles.mapPickerConfirmButtonText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
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
  activeBookingContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md, // Add space between active booking and search bar
  },
  activeBookingCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  activeBookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activeBookingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.xs,
  },
  activeBookingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  activeBookingContent: {
    gap: spacing.md,
  },
  activeBookingRoute: {
    gap: spacing.xs,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 4,
  },
  activeBookingDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  bookingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bookingDetailText: {
    fontSize: 13,
    color: colors.gray,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorLight || '#fee',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.medium,
  },
  markerImage: {
    width: 32,
    height: 32,
  },
  markerPulse: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.buttonPrimary,
    opacity: 0.3,
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  userMarkerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.medium,
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
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    ...shadows.large,
    elevation: 8,
  },
  searchIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTextWrapper: {
    flex: 1,
  },
  searchPlaceholder: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.white,
    marginBottom: 2,
  },
  searchSubtext: {
    ...typography.caption,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  quickActionsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.medium,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 120,
    justifyContent: 'center',
  },
  actionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.darkText,
    marginBottom: 2,
    textAlign: 'center',
  },
  actionSubtext: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
    textAlign: 'center',
  },
  statsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.small,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    fontSize: 24,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: 4,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    textAlign: 'center',
  },
  recentContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllText: {
    ...typography.body,
    fontSize: 14,
    color: colors.buttonPrimary,
    fontWeight: '600',
  },
  recentCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.small,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  recentContent: {
    flex: 1,
  },
  recentTitle: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.darkText,
    marginBottom: 4,
  },
  recentSubtext: {
    ...typography.caption,
    fontSize: 13,
    color: colors.gray,
  },
  recentFare: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
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
  nearbyCard: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    maxHeight: 280,
    zIndex: 200,
    ...shadows.large,
  },
  nearbyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  nearbyCardTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkText,
  },
  nearbyCardSubtitle: {
    ...typography.caption,
    color: colors.gray,
    marginTop: 2,
  },
  tricycleList: {
    marginBottom: spacing.md,
  },
  tricycleCard: {
    width: 140,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  tricycleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF8F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tricycleName: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  tricycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tricycleEta: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
  },
  tricycleDistance: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
  },
  fareEstimateContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fareEstimateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fareEstimateInfo: {
    flex: 1,
  },
  fareEstimateLabel: {
    ...typography.caption,
    color: colors.gray,
    fontSize: 12,
  },
  fareEstimateAmount: {
    ...typography.h3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.buttonPrimary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalOverlayPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheetOverlay: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.large,
    maxHeight: '90%',
    width: '100%',
    flexDirection: 'column',
    zIndex: 1001,
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  addFavoriteBottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.large,
    maxHeight: SCREEN_HEIGHT * 0.9,
    width: '100%',
    justifyContent: 'flex-end',
  },
  addFavoriteContent: {
    width: '100%',
  },
  addFavoriteScrollView: {
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  addFavoriteScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: SCREEN_HEIGHT * 0.85,
    width: '100%',
    ...shadows.large,
  },
  modalScrollView: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  modalScrollContent: {
    paddingBottom: spacing.xl,
  },
  nearbyTricyclesContainer: {
    flexDirection: 'column',
    height: '90%',
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  nearbyTricyclesHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  nearbyHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bottomSheetTitle: {
    ...typography.h2,
    fontSize: 28,
    fontWeight: '800',
    color: colors.darkText,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  closeButtonModern: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingForm: {
    gap: spacing.lg,
    minHeight: 200,
    flexGrow: 1,
  },
  locationCard: {
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCardLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationInputText: {
    flex: 1,
    ...typography.body,
    fontSize: 16,
    color: colors.darkText,
    paddingVertical: spacing.xs,
  },
  fareCard: {
    marginVertical: spacing.sm,
  },
  fareCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fareCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  fareCardInfo: {
    flex: 1,
  },
  fareCardLabel: {
    ...typography.caption,
    color: colors.gray,
    fontSize: 12,
  },
  fareCardAmount: {
    ...typography.h3,
    fontSize: 22,
    fontWeight: '700',
    color: colors.buttonPrimary,
    marginTop: 2,
  },
  fareCardRight: {
    padding: spacing.xs,
  },
  confirmButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    ...shadows.medium,
  },
  confirmButtonText: {
    ...typography.bodyBold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  centerLocationButton: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    ...shadows.medium,
    elevation: 6,
  },
  scheduleInfo: {
    ...typography.body,
    color: colors.gray,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  scheduleCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 2,
  },
  scheduleValue: {
    ...typography.bodyBold,
    color: colors.darkText,
  },
  favoritesContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    minHeight: 200,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  favoriteIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#FFF8F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteName: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  favoriteAddress: {
    ...typography.caption,
    color: colors.gray,
  },
  addFavoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  addFavoriteText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  favoriteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  favoriteActionButton: {
    padding: spacing.xs,
  },
  emptyFavoritesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyFavoritesText: {
    ...typography.h3,
    marginTop: spacing.md,
    color: colors.darkText,
    textAlign: 'center',
  },
  emptyFavoritesSubtext: {
    ...typography.body,
    marginTop: spacing.xs,
    color: colors.gray,
    textAlign: 'center',
  },
  getLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightGray,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  getLocationButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  iconSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  iconOption: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  locationSelectionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  locationSelectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationSelectionButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  selectedCoordinatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#E8F5E9',
    borderRadius: borderRadius.md,
  },
  selectedCoordinatesText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  mapPickerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.small,
  },
  mapPickerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkText,
  },
  mapPickerMap: {
    flex: 1,
  },
  mapPickerFooter: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.medium,
  },
  mapPickerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: '#E3F2FD',
    borderRadius: borderRadius.md,
  },
  mapPickerInfoText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.primary,
    flex: 1,
  },
  mapPickerConfirmButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerConfirmButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.5,
  },
  mapPickerConfirmButtonText: {
    ...typography.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  nearbyModalSubtitle: {
    ...typography.body,
    color: colors.gray,
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  tricycleListVertical: {
    flex: 1,
    width: '100%',
  },
  tricycleListContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  modernTricycleCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopSection: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  driverAvatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
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
  driverInfoSection: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  driverName: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkText,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  ratingText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  vehicleInfo: {
    ...typography.body,
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.darkText,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
  },
  cardBottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fareSection: {
    flex: 1,
  },
  fareLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
    marginBottom: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fareAmount: {
    ...typography.h3,
    fontSize: 22,
    fontWeight: '800',
    color: colors.buttonPrimary,
    letterSpacing: -0.5,
  },
  selectButtonModern: {
    backgroundColor: colors.buttonPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    ...shadows.medium,
    minWidth: 120,
  },
  selectButtonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  modernFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  footerIconContainer: {
    marginTop: 2,
  },
  modernFooterText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  emptyTricycleState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTricycleText: {
    ...typography.h3,
    marginTop: spacing.md,
    color: colors.darkText,
    textAlign: 'center',
  },
  emptyTricycleSubtext: {
    ...typography.body,
    marginTop: spacing.xs,
    color: colors.gray,
    textAlign: 'center',
  },
  // Discount Verification Card Styles - Redesigned
  discountVerificationCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.medium,
  },
  discountCardGradient: {
    backgroundColor: colors.buttonPrimary,
    padding: spacing.lg,
    paddingVertical: spacing.xl,
  },
  discountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  discountMainTitle: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.white,
    marginBottom: spacing.sm,
    fontSize: 22,
  },
  discountDescription: {
    ...typography.body,
    color: colors.white,
    opacity: 0.95,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  discountFeatures: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  discountFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountFeatureText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
