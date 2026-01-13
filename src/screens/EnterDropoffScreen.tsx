import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Card, Button } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { calculateDistance, calculateFareEstimate } from '../utils/tripStorage';
import { generateAccurateRoute, Coordinate } from '../utils/routeUtils';
import { getFavoriteLocations, FavoriteLocation } from '../utils/favoriteLocationsStorage';
import { getUserAccount } from '../utils/userStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EnterDropoffScreenProps {
  navigation: any;
  route: {
    params?: {
      pickupLocation?: string;
      pickupCoordinates?: { latitude: number; longitude: number };
      selectedDriver?: {
        id: string;
        name: string;
        distance: string;
        eta: string;
        tricyclePlate?: string;
        rating?: number;
        coordinates: { latitude: number; longitude: number };
      };
    };
  };
}

export const EnterDropoffScreen: React.FC<EnterDropoffScreenProps> = ({ navigation, route }) => {
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupLocation, setPickupLocation] = useState(route.params?.pickupLocation || 'Current Location');
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    route.params?.pickupCoordinates || null
  );
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [userLocation, setUserLocation] = useState<Region | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [fareEstimate, setFareEstimate] = useState<{ min: number; max: number } | null>(null);
  const [eta, setEta] = useState<string>('5 min');
  const [availableDrivers, setAvailableDrivers] = useState(3);
  const [isTripDetailsMinimized, setIsTripDetailsMinimized] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [suggestedLocations, setSuggestedLocations] = useState<Array<{ name: string; coordinates: { latitude: number; longitude: number } }>>([]);
  const [userCoordinates, setUserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showDebugMarkers, setShowDebugMarkers] = useState(false); // For testing direction accuracy
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [showFavoritesPicker, setShowFavoritesPicker] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [rideType, setRideType] = useState<'normal' | 'errand'>('normal');
  const [errandNotes, setErrandNotes] = useState('');
  const [isSeniorCitizen, setIsSeniorCitizen] = useState(false);
  const [isPWD, setIsPWD] = useState(false);

  // Listen for keyboard events
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  useEffect(() => {
    const getLocation = async () => {
      try {
        // Check if location services are enabled
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          console.warn('Location services are disabled');
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setUserCoordinates(coords);

          if (!pickupCoordinates) {
            setPickupCoordinates(coords);
          }

          const region: Region = {
            ...coords,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
          setUserLocation(region);
          
          // Generate dynamic location suggestions based on user location
          generateLocationSuggestions(coords);
        }
      } catch (error: any) {
        console.error('Error getting location:', error);
        // Silently fail for this screen as location is optional
        if (error.message && error.message.includes('location is unavailable')) {
          console.warn('Location unavailable. User can manually select location.');
        }
      }
    };

    // Load user account data to check for Senior/PWD status
    const loadUserData = async () => {
      try {
        const currentUserEmail = await AsyncStorage.getItem('current_user_email');
        if (currentUserEmail) {
          setUserEmail(currentUserEmail);
          const userAccount = await getUserAccount(currentUserEmail);
          if (userAccount) {
            setIsSeniorCitizen(userAccount.isSeniorCitizen || false);
            setIsPWD(userAccount.isPWD || false);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    getLocation();
    loadUserData();
  }, []);

  // Test function to verify direction accuracy
  const testDirectionAccuracy = (centerCoords: { latitude: number; longitude: number }) => {
    const { testDirectionAccuracy: testFunc, logTestResults } = require('../utils/locationDirectionTest');
    const results = testFunc(centerCoords);
    logTestResults(results);
    
    // Check if all tests passed
    const allPassed = results.every((r: { isValid: boolean }) => r.isValid);
    if (allPassed) {
      console.log('✅ All direction tests PASSED - directions are accurate!');
    } else {
      console.error('❌ Some direction tests FAILED - please check the errors above');
    }
  };

  // Generate dynamic location suggestions based on user's current location
  const generateLocationSuggestions = async (centerCoords: { latitude: number; longitude: number }) => {
    try {
      // Run direction accuracy test
      testDirectionAccuracy(centerCoords);
      
      const suggestions: Array<{ name: string; coordinates: { latitude: number; longitude: number } }> = [];
      const seenAddresses = new Set<string>(); // Track unique addresses to avoid duplicates
      
      // Use larger offsets to ensure different locations (approximately 0.5-2km away)
      // 0.01 degrees ≈ 1.1km, 0.02 degrees ≈ 2.2km
      // IMPORTANT: Direction offsets are correct:
      // - North: +latitude (increases latitude, moves north)
      // - South: -latitude (decreases latitude, moves south)
      // - East: +longitude (increases longitude, moves east)
      // - West: -longitude (decreases longitude, moves west)
      const directions = [
        { name: 'North', latOffset: 0.015, lonOffset: 0 },
        { name: 'South', latOffset: -0.015, lonOffset: 0 },
        { name: 'East', latOffset: 0, lonOffset: 0.015 },
        { name: 'West', latOffset: 0, lonOffset: -0.015 },
        { name: 'Northeast', latOffset: 0.012, lonOffset: 0.012 },
        { name: 'Northwest', latOffset: 0.012, lonOffset: -0.012 },
        { name: 'Southeast', latOffset: -0.012, lonOffset: 0.012 },
        { name: 'Southwest', latOffset: -0.012, lonOffset: -0.012 },
      ];

      // Try to get reverse geocoded addresses for each direction
      for (const dir of directions) {
        const coords = {
          latitude: centerCoords.latitude + dir.latOffset,
          longitude: centerCoords.longitude + dir.lonOffset,
        };

        try {
          // Use reverse geocoding to get actual address
          const addresses = await Location.reverseGeocodeAsync(coords);
          if (addresses && addresses.length > 0) {
            const address = addresses[0];
            
            // Build a unique key for this address to avoid duplicates
            const addressKey = [
              address.street || '',
              address.name || '',
              address.district || '',
              address.subregion || '',
            ].filter(Boolean).join(', ');
            
            // Skip if we've already seen this address
            if (addressKey && seenAddresses.has(addressKey)) {
              // Use coordinates-based name instead
              const coordKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
              if (!seenAddresses.has(coordKey)) {
                suggestions.push({
                  name: `${dir.name} Area (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
                  coordinates: coords,
                });
                seenAddresses.add(coordKey);
              }
              continue;
            }
            
            // Create a readable location name
            let locationName = '';
            if (address.street && address.street.trim()) {
              locationName = address.street.trim();
            } else if (address.name && address.name.trim()) {
              locationName = address.name.trim();
            } else if (address.district && address.district.trim()) {
              locationName = address.district.trim();
            } else if (address.subregion && address.subregion.trim()) {
              locationName = address.subregion.trim();
            } else {
              locationName = `${dir.name} Area`;
            }
            
            // Add city/region info if available and different
            const cityRegion = address.city || address.region || '';
            if (cityRegion && !locationName.includes(cityRegion)) {
              locationName += `, ${cityRegion}`;
            }
            
            // Add coordinates to make it unique if needed
            const finalName = locationName.trim() || `${dir.name} Location`;
            const uniqueName = seenAddresses.has(finalName) 
              ? `${finalName} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`
              : finalName;

            suggestions.push({
              name: uniqueName,
              coordinates: coords,
            });
            
            if (addressKey) {
              seenAddresses.add(addressKey);
            }
            seenAddresses.add(uniqueName);
          } else {
            // Fallback: use coordinates if geocoding fails
            const coordKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
            if (!seenAddresses.has(coordKey)) {
              suggestions.push({
                name: `${dir.name} Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
                coordinates: coords,
              });
              seenAddresses.add(coordKey);
            }
          }
        } catch (error) {
          // If reverse geocoding fails, still add the location with coordinates
          const coordKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
          if (!seenAddresses.has(coordKey)) {
            suggestions.push({
              name: `${dir.name} Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
              coordinates: coords,
            });
            seenAddresses.add(coordKey);
          }
        }
      }

      // Also try to get current location's address
      try {
        const currentAddresses = await Location.reverseGeocodeAsync(centerCoords);
        if (currentAddresses && currentAddresses.length > 0) {
          const address = currentAddresses[0];
          let locationName = 'Current Area';
          if (address.street && address.street.trim()) {
            locationName = address.street.trim();
          } else if (address.district && address.district.trim()) {
            locationName = address.district.trim();
          }
          if (address.city || address.region) {
            const cityRegion = address.city || address.region || '';
            if (cityRegion && !locationName.includes(cityRegion)) {
              locationName += `, ${cityRegion}`;
            }
          }
          
          const finalName = locationName.trim();
          if (!seenAddresses.has(finalName)) {
            suggestions.unshift({
              name: finalName,
              coordinates: centerCoords,
            });
            seenAddresses.add(finalName);
          }
        }
      } catch (error) {
        console.log('Could not get current location address');
      }

      // Ensure we have at least 4 unique suggestions with different coordinates
      if (suggestions.length < 4) {
        // Add more locations with varying distances
        const additionalOffsets = [
          { name: 'Far North', latOffset: 0.025, lonOffset: 0 },
          { name: 'Far South', latOffset: -0.025, lonOffset: 0 },
          { name: 'Far East', latOffset: 0, lonOffset: 0.025 },
          { name: 'Far West', latOffset: 0, lonOffset: -0.025 },
        ];
        
        for (const dir of additionalOffsets.slice(0, 4 - suggestions.length)) {
          const coords = {
            latitude: centerCoords.latitude + dir.latOffset,
            longitude: centerCoords.longitude + dir.lonOffset,
          };
          
          const coordKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
          if (!seenAddresses.has(coordKey)) {
            try {
              const addresses = await Location.reverseGeocodeAsync(coords);
              if (addresses && addresses.length > 0) {
                const address = addresses[0];
                let locationName = address.street || address.name || address.district || dir.name;
                if (address.city || address.region) {
                  locationName += `, ${address.city || address.region || ''}`;
                }
                suggestions.push({
                  name: locationName.trim(),
                  coordinates: coords,
                });
              } else {
                suggestions.push({
                  name: `${dir.name} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
                  coordinates: coords,
                });
              }
            } catch (error) {
              suggestions.push({
                name: `${dir.name} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
                coordinates: coords,
              });
            }
            seenAddresses.add(coordKey);
          }
        }
      }

      // Remove duplicates based on coordinates (within small tolerance)
      const uniqueSuggestions = suggestions.filter((suggestion, index, self) => {
        return index === self.findIndex((s) => 
          Math.abs(s.coordinates.latitude - suggestion.coordinates.latitude) < 0.0001 &&
          Math.abs(s.coordinates.longitude - suggestion.coordinates.longitude) < 0.0001
        );
      });

      setSuggestedLocations(uniqueSuggestions.slice(0, 8)); // Limit to 8 suggestions
    } catch (error) {
      console.error('Error generating location suggestions:', error);
      // Fallback to default suggestions if generation fails
      setSuggestedLocations([
        { name: 'North Location', coordinates: { latitude: centerCoords.latitude + 0.015, longitude: centerCoords.longitude } },
        { name: 'South Location', coordinates: { latitude: centerCoords.latitude - 0.015, longitude: centerCoords.longitude } },
        { name: 'East Location', coordinates: { latitude: centerCoords.latitude, longitude: centerCoords.longitude + 0.015 } },
        { name: 'West Location', coordinates: { latitude: centerCoords.latitude, longitude: centerCoords.longitude - 0.015 } },
      ]);
    }
  };

  // Generate suggestions when pickup coordinates are available
  useEffect(() => {
    if (pickupCoordinates && !userCoordinates) {
      generateLocationSuggestions(pickupCoordinates);
      setUserCoordinates(pickupCoordinates);
    }
  }, [pickupCoordinates, userCoordinates]);

  // Forward geocoding: get coordinates from location name
  const getCoordinatesForLocation = async (locationName: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      // Try forward geocoding first
      const results = await Location.geocodeAsync(locationName);
      if (results && results.length > 0) {
        return {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
      }
    } catch (error) {
      console.log('Forward geocoding failed, trying fallback methods');
    }

    // Fallback: Check if it's in suggested locations
    const suggested = suggestedLocations.find(loc => 
      loc.name.toLowerCase().includes(locationName.toLowerCase()) ||
      locationName.toLowerCase().includes(loc.name.toLowerCase())
    );
    if (suggested) {
      return suggested.coordinates;
    }

    // Fallback: Check hardcoded map for common locations (backward compatibility)
    const locationMap: Record<string, { latitude: number; longitude: number }> = {
      'Lopez Municipal Hall': { latitude: 13.8844, longitude: 122.2603 },
      'Jollibee Lopez': { latitude: 13.8848, longitude: 122.2607 },
      'Mimings Food House': { latitude: 13.8846, longitude: 122.2605 },
      'Mimings Food Haouse': { latitude: 13.8846, longitude: 122.2605 },
      'Lopez Public Market': { latitude: 13.8840, longitude: 122.2600 },
      'Lopez Central Elementary School': { latitude: 13.8844, longitude: 122.2603 },
      'Lopez Terminal': { latitude: 13.8845, longitude: 122.2605 },
      'Lopez Town Plaza': { latitude: 13.8842, longitude: 122.2602 },
      'Lopez District Hospital': { latitude: 13.8849, longitude: 122.2608 },
    };

    if (locationMap[locationName]) {
      return locationMap[locationName];
    }

    for (const [key, coords] of Object.entries(locationMap)) {
      if (locationName.toLowerCase().includes(key.toLowerCase())) {
        return coords;
      }
    }

    // Last resort: return offset from pickup or default
    if (pickupCoordinates) {
      return {
        latitude: pickupCoordinates.latitude + 0.01,
        longitude: pickupCoordinates.longitude + 0.01,
      };
    }

    return userCoordinates || { latitude: 13.8844, longitude: 122.2603 };
  };

  // Calculate distance and fare when coordinates are available
  const calculateTripDetails = async (pickup: { latitude: number; longitude: number } | null, dropoff: { latitude: number; longitude: number } | null) => {
    if (!pickup || !dropoff) return;

    const dist = calculateDistance(
      pickup.latitude,
      pickup.longitude,
      dropoff.latitude,
      dropoff.longitude
    );
    setDistance(dist);
    
    // Check if it's a night trip (after 10 PM or before 6 AM)
    const currentHour = new Date().getHours();
    const isNightTrip = currentHour >= 22 || currentHour < 6;
    
    // Load user account to check Senior/PWD status
    let hasSeniorDiscount = false;
    let hasPWDDiscount = false;
    try {
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (currentUserEmail) {
        const userAccount = await getUserAccount(currentUserEmail);
        if (userAccount) {
          hasSeniorDiscount = userAccount.isSeniorCitizen || false;
          hasPWDDiscount = userAccount.isPWD || false;
        }
      }
    } catch (error) {
      console.error('Error checking user discount status:', error);
    }
    
    const fare = await calculateFareEstimate(dist, 'Lopez', isNightTrip, hasSeniorDiscount, hasPWDDiscount, rideType === 'errand');
    setFareEstimate(fare);
    
    // Estimate ETA (rough calculation: 30 km/h average speed, minimum 1 minute)
    const estimatedMinutes = Math.max(1, Math.round((dist / 30) * 60));
    setEta(`${estimatedMinutes} min`);
  };

  // Handle location selection from text input or suggestions
  const handleLocationSelect = async (location: string | { name: string; coordinates: { latitude: number; longitude: number } }) => {
    let locationName: string;
    let coords: { latitude: number; longitude: number } | null = null;

    if (typeof location === 'string') {
      locationName = location;
      coords = await getCoordinatesForLocation(location);
    } else {
      locationName = location.name;
      coords = location.coordinates;
    }

    setDropoffLocation(locationName);
    
    if (coords) {
      setDropoffCoordinates(coords);
      
      // Calculate trip details
      if (pickupCoordinates) {
        await calculateTripDetails(pickupCoordinates, coords);
      }
    }
  };

  // Handle map tap to select destination
  const handleMapPress = async (event: any) => {
    try {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      if (!latitude || !longitude) return;
      
      const coords = { latitude, longitude };
      setDropoffCoordinates(coords);
      
      // Use reverse geocoding to get actual address
      try {
        const addresses = await Location.reverseGeocodeAsync(coords);
        if (addresses && addresses.length > 0) {
          const address = addresses[0];
          let locationName = '';
          
          // Build address string from available components
          const addressParts: string[] = [];
          if (address.street) addressParts.push(address.street);
          if (address.name) addressParts.push(address.name);
          if (address.district) addressParts.push(address.district);
          if (address.city) addressParts.push(address.city);
          if (address.region) addressParts.push(address.region);
          
          if (addressParts.length > 0) {
            locationName = addressParts.join(', ');
          } else {
            locationName = `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          }
          
          setDropoffLocation(locationName);
        } else {
          // Fallback to coordinates if geocoding fails
          setDropoffLocation(`Selected Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        }
      } catch (error) {
        console.error('Reverse geocoding error:', error);
        // Fallback to coordinates
        setDropoffLocation(`Selected Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      }
      
      // Calculate trip details
      if (pickupCoordinates) {
        await calculateTripDetails(pickupCoordinates, coords);
      }
    } catch (error) {
      console.error('Error handling map press:', error);
    }
  };

  // Generate route coordinates when pickup and dropoff are available
  useEffect(() => {
    if (pickupCoordinates && dropoffCoordinates) {
      const route = generateAccurateRoute(pickupCoordinates, dropoffCoordinates);
      setRouteCoordinates(route);
    } else {
      setRouteCoordinates([]);
    }
  }, [pickupCoordinates, dropoffCoordinates]);

  const handleContinue = async () => {
    if (!dropoffLocation || dropoffLocation.trim() === '') {
      Alert.alert('Missing Information', 'Please enter your destination or tap on the map to select a location.');
      return;
    }

    // If coordinates are not set, try to get them from location name
    let finalDropoffCoordinates = dropoffCoordinates;
    if (!finalDropoffCoordinates) {
      finalDropoffCoordinates = await getCoordinatesForLocation(dropoffLocation);
      if (finalDropoffCoordinates) {
        setDropoffCoordinates(finalDropoffCoordinates);
      }
    }

    // If still no coordinates, generate default ones based on pickup
    if (!finalDropoffCoordinates && pickupCoordinates) {
      finalDropoffCoordinates = {
        latitude: pickupCoordinates.latitude + 0.01,
        longitude: pickupCoordinates.longitude + 0.01,
      };
      setDropoffCoordinates(finalDropoffCoordinates);
    }

    // Calculate fare and distance if not already calculated
    let finalDistance = distance;
    let finalFareEstimate = fareEstimate;
    
    if (!finalDistance || !finalFareEstimate) {
      if (pickupCoordinates && finalDropoffCoordinates) {
        await calculateTripDetails(pickupCoordinates, finalDropoffCoordinates);
        // Get the updated values
        finalDistance = distance;
        finalFareEstimate = fareEstimate;
      }
    }

    // Allow proceeding even with estimated values
    if (!finalDistance || !finalFareEstimate) {
      // Use default estimates if calculation failed
      finalDistance = finalDistance || 2.0; // Default 2km
      finalFareEstimate = finalFareEstimate || { min: 30, max: 50 }; // Default fare range
      setDistance(finalDistance);
      setFareEstimate(finalFareEstimate);
    }

    navigation.navigate('ConfirmBooking', {
      pickupLocation,
      dropoffLocation,
      pickupCoordinates,
      dropoffCoordinates: finalDropoffCoordinates,
      distance: finalDistance,
      fareEstimate: finalFareEstimate,
      eta,
      availableDrivers,
      rideType,
      errandNotes: rideType === 'errand' ? errandNotes : undefined,
      isSeniorCitizen,
      isPWD,
    });
  };

  // Filter locations based on search input
  const getFilteredLocations = () => {
    if (!dropoffLocation || dropoffLocation.trim() === '') {
      return [];
    }
    const searchTerm = dropoffLocation.toLowerCase();
    return suggestedLocations.filter(location =>
      location.name.toLowerCase().includes(searchTerm)
    );
  };

  const filteredLocations = getFilteredLocations();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Map View */}
        <MapView
          style={styles.map}
          region={
            userLocation || {
              latitude: 13.8844,
              longitude: 122.2603,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }
          }
          showsUserLocation
          onPress={handleMapPress}
          onLongPress={handleMapPress}
          mapType="standard"
          loadingEnabled
          toolbarEnabled={false}
        >
          {pickupCoordinates && (
            <Marker
              coordinate={pickupCoordinates}
              title="Pickup"
              pinColor={colors.primary}
              tappable={false}
            />
          )}
          {dropoffCoordinates && (
            <Marker
              coordinate={dropoffCoordinates}
              title="Dropoff"
              pinColor={colors.error}
              tappable={false}
            />
          )}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.primary}
              strokeWidth={3}
              tappable={false}
            />
          )}
          {/* Debug markers to verify direction accuracy - only show when testing */}
          {showDebugMarkers && userCoordinates && suggestedLocations.map((location, index) => (
            <Marker
              key={`debug-${index}`}
              coordinate={location.coordinates}
              title={location.name}
              description={`${location.coordinates.latitude.toFixed(4)}, ${location.coordinates.longitude.toFixed(4)}`}
              pinColor={index < 4 ? colors.primary : colors.warning}
            />
          ))}
          {/* Center marker for reference */}
          {showDebugMarkers && userCoordinates && (
            <Marker
              coordinate={userCoordinates}
              title="Your Location (Center)"
              description="Reference point for directions"
              pinColor={colors.success}
            />
          )}
        </MapView>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Where are you going?</Text>
          {/* Debug toggle button - for testing only */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => {
                setShowDebugMarkers(!showDebugMarkers);
                if (!showDebugMarkers && userCoordinates) {
                  testDirectionAccuracy(userCoordinates);
                }
              }}
            >
              <Ionicons name={showDebugMarkers ? "eye-off" : "eye"} size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer} pointerEvents="box-none">
          <View style={[
            styles.searchBar,
            isSearchFocused && styles.searchBarFocused
          ]}>
            <View style={styles.searchIconContainer}>
              <Ionicons name="search" size={12} color={colors.buttonPrimary} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search destination..."
              placeholderTextColor={colors.gray}
              value={dropoffLocation}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                // Delay to allow onPress to fire first
                setTimeout(() => setIsSearchFocused(false), 200);
              }}
              onChangeText={async (text) => {
                setDropoffLocation(text);
                // If user types and it matches a known location, auto-calculate
                if (text.length > 3 && pickupCoordinates) {
                  const coords = await getCoordinatesForLocation(text);
                  if (coords) {
                    setDropoffCoordinates(coords);
                    await calculateTripDetails(pickupCoordinates, coords);
                  }
                }
              }}
              onSubmitEditing={() => {
                if (dropoffLocation) {
                  handleLocationSelect(dropoffLocation);
                  setIsSearchFocused(false);
                }
              }}
            />
            {favoriteLocations.length > 0 && (
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={() => setShowFavoritesPicker(true)}
              >
                <Ionicons name="heart" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
            {dropoffLocation.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => {
                  setDropoffLocation('');
                  setDropoffCoordinates(null);
                  setDistance(null);
                  setFareEstimate(null);
                  setIsSearchFocused(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.gray} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Ride Type Toggle */}
        <View style={styles.rideTypeContainer} pointerEvents="box-none">
          <View style={styles.rideTypeCard}>
            <Text style={styles.rideTypeLabel}>Ride Type</Text>
            <View style={styles.rideTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.rideTypeButton,
                  rideType === 'normal' && styles.rideTypeButtonActive
                ]}
                onPress={() => {
                  setRideType('normal');
                  setErrandNotes('');
                  // Recalculate fare when ride type changes
                  if (pickupCoordinates && dropoffCoordinates) {
                    calculateTripDetails(pickupCoordinates, dropoffCoordinates);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="bicycle" 
                  size={20} 
                  color={rideType === 'normal' ? colors.white : colors.primary} 
                />
                <Text style={[
                  styles.rideTypeButtonText,
                  rideType === 'normal' && styles.rideTypeButtonTextActive
                ]}>
                  Normal Ride
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.rideTypeButton,
                  rideType === 'errand' && styles.rideTypeButtonActive
                ]}
                onPress={() => {
                  setRideType('errand');
                  // Recalculate fare when ride type changes
                  if (pickupCoordinates && dropoffCoordinates) {
                    calculateTripDetails(pickupCoordinates, dropoffCoordinates);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="cube" 
                  size={20} 
                  color={rideType === 'errand' ? colors.white : colors.primary} 
                />
                <Text style={[
                  styles.rideTypeButtonText,
                  rideType === 'errand' && styles.rideTypeButtonTextActive
                ]}>
                  Pasabay/Padala
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Errand Notes - Only show when Errand mode is selected */}
            {rideType === 'errand' && (
              <View style={styles.errandNotesContainer}>
                <Text style={styles.errandNotesLabel}>Special Instructions (Optional)</Text>
                <TextInput
                  style={styles.errandNotesInput}
                  placeholder="e.g., Package to be picked up, fragile items, etc."
                  placeholderTextColor={colors.gray}
                  value={errandNotes}
                  onChangeText={setErrandNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          </View>
        </View>

        {/* Search Results Dropdown */}
        {isSearchFocused && dropoffLocation && filteredLocations.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <View style={styles.searchResultsHeader}>
              <Text style={styles.searchResultsHeaderText}>Suggestions</Text>
            </View>
            <ScrollView
              style={styles.searchResultsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {filteredLocations.map((location, index) => {
                // Create unique key based on coordinates to ensure each location is distinct
                const uniqueKey = `${location.coordinates.latitude}-${location.coordinates.longitude}-${index}`;
                return (
                  <TouchableOpacity
                    key={uniqueKey}
                    style={[
                      styles.searchResultItem,
                      index === filteredLocations.length - 1 && styles.searchResultItemLast
                    ]}
                    onPress={() => {
                      handleLocationSelect(location);
                      setIsSearchFocused(false);
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={styles.searchResultIconContainer}>
                      <Ionicons name="location" size={20} color={colors.buttonPrimary} />
                    </View>
                    <View style={styles.searchResultContent}>
                      <Text style={styles.searchResultText}>{location.name}</Text>
                      <Text style={styles.searchResultSubtext} numberOfLines={1}>
                        {location.coordinates.latitude.toFixed(4)}, {location.coordinates.longitude.toFixed(4)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.gray} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Suggested Locations - Only show when not searching, show fewer */}
        {!isSearchFocused && !dropoffLocation && suggestedLocations.length > 0 && (
          <View style={styles.suggestionsContainer} pointerEvents="box-none">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {suggestedLocations.slice(0, 4).map((location, index) => {
                // Create a unique key based on coordinates to ensure each location is distinct
                const uniqueKey = `${location.coordinates.latitude}-${location.coordinates.longitude}-${index}`;
                return (
                  <TouchableOpacity
                    key={uniqueKey}
                    style={styles.suggestionChip}
                    onPress={() => handleLocationSelect(location)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.suggestionIconContainer}>
                      <Ionicons name="location" size={12} color={colors.buttonPrimary} />
                    </View>
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {location.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Fare Estimate Card */}
        {fareEstimate && distance && (
          <Card style={[
            styles.fareCard,
            keyboardHeight > 0 ? { 
              bottom: keyboardHeight + 70,
              maxHeight: keyboardHeight > 0 ? 120 : 250
            } : {}
          ] as any}>
            <TouchableOpacity
              style={styles.fareCardHeader}
              onPress={() => setIsTripDetailsMinimized(!isTripDetailsMinimized)}
              activeOpacity={0.7}
            >
              <Text style={styles.fareCardTitle}>Trip Details</Text>
              <TouchableOpacity
                onPress={() => setIsTripDetailsMinimized(!isTripDetailsMinimized)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isTripDetailsMinimized ? "chevron-down" : "chevron-up"}
                  size={20}
                  color={colors.gray}
                />
              </TouchableOpacity>
            </TouchableOpacity>
            
            {!isTripDetailsMinimized && (
              <ScrollView
                style={styles.fareCardContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                <View style={styles.fareRow}>
                  <Ionicons name="navigate" size={20} color={colors.primary} />
                  <View style={styles.fareInfo}>
                    <Text style={styles.fareLabel}>Distance</Text>
                    <Text style={styles.fareValue}>{distance.toFixed(1)} km</Text>
                  </View>
                </View>
                <View style={styles.fareRow}>
                  <Ionicons name="time" size={20} color={colors.warning} />
                  <View style={styles.fareInfo}>
                    <Text style={styles.fareLabel}>Estimated Time</Text>
                    <Text style={styles.fareValue}>{eta}</Text>
                  </View>
                </View>
                <View style={styles.fareRow}>
                  <Ionicons name="cash" size={20} color={colors.success} />
                  <View style={styles.fareInfo}>
                    <Text style={styles.fareLabel}>Estimated Fare</Text>
                    <Text style={styles.fareValue}>
                      ₱{fareEstimate.min} - ₱{fareEstimate.max}
                    </Text>
                  </View>
                </View>
                <View style={styles.driversRow}>
                  <Ionicons name="bicycle" size={16} color={colors.gray} />
                  <Text style={styles.driversText}>
                    {availableDrivers} drivers available nearby
                  </Text>
                </View>
              </ScrollView>
            )}
            
            {isTripDetailsMinimized && (
              <View style={styles.fareCardContentMinimized}>
                <View style={styles.fareRowMinimized}>
                  <Ionicons name="cash" size={18} color={colors.success} />
                  <Text style={styles.fareValueMinimized}>
                    ₱{fareEstimate.min} - ₱{fareEstimate.max}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        )}

        {/* Favorites Picker Modal */}
        <Modal
          visible={showFavoritesPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowFavoritesPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFavoritesPicker(false)}
          >
            <View style={styles.favoritesPickerContainer}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <View style={styles.favoritesPickerContent}>
                  <View style={styles.favoritesPickerHeader}>
                    <Text style={styles.favoritesPickerTitle}>Select Favorite Location</Text>
                    <TouchableOpacity onPress={() => setShowFavoritesPicker(false)}>
                      <Ionicons name="close" size={24} color={colors.gray} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.favoritesPickerList}>
                    {favoriteLocations.length === 0 ? (
                      <View style={styles.emptyFavoritesContainer}>
                        <Ionicons name="heart-outline" size={48} color={colors.gray} />
                        <Text style={styles.emptyFavoritesText}>No favorites yet</Text>
                        <Text style={styles.emptyFavoritesSubtext}>
                          Add favorites from the home screen
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
                          <TouchableOpacity
                            key={favorite.id}
                            style={styles.favoritePickerItem}
                            onPress={() => {
                              handleLocationSelect({
                                name: favorite.name,
                                coordinates: favorite.coordinates,
                              });
                              setShowFavoritesPicker(false);
                            }}
                          >
                            <View style={styles.favoritePickerIcon}>
                              <Ionicons 
                                name={iconMap[favorite.icon || 'location'] as any} 
                                size={24} 
                                color={colors.primary} 
                              />
                            </View>
                            <View style={styles.favoritePickerInfo}>
                              <Text style={styles.favoritePickerName}>{favorite.name}</Text>
                              <Text style={styles.favoritePickerAddress} numberOfLines={2}>
                                {favorite.address}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Continue Button - Hide when search is focused or when there's no destination */}
        {!isSearchFocused && dropoffLocation && dropoffLocation.trim() !== '' && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.modernButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.modernButtonText}>Continue</Text>
              <View style={styles.buttonIconContainer}>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    zIndex: 100,
    ...shadows.small,
  },
  backButton: {
    marginRight: spacing.sm,
  },
  debugButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 16,
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    zIndex: 99,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    ...shadows.small,
    borderWidth: 0.5,
    borderColor: colors.border,
    elevation: 1,
  },
  searchBarFocused: {
    borderColor: colors.buttonPrimary,
    borderWidth: 0.5,
    backgroundColor: colors.white,
    ...shadows.medium,
    elevation: 2,
  },
  searchIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    ...typography.caption,
    fontSize: 12,
    color: colors.darkText,
    paddingVertical: 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  instructionContainer: {
    position: 'absolute',
    top: 130,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    zIndex: 98,
    ...shadows.small,
  },
  instructionText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 12,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 112,
    left: spacing.md,
    right: spacing.md,
    maxHeight: 280,
    backgroundColor: colors.white,
    borderRadius: 10,
    zIndex: 98,
    ...shadows.medium,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
    elevation: 4,
  },
  searchResultsHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.lightGray,
  },
  searchResultsHeaderText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchResultsList: {
    maxHeight: 240,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'transparent',
  },
  searchResultItemLast: {
    borderBottomWidth: 0,
  },
  searchResultIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultText: {
    ...typography.body,
    fontSize: 15,
    color: colors.darkText,
    fontWeight: '500',
  },
  searchResultSubtext: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    zIndex: 97,
    maxHeight: 32,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    gap: 5,
    ...shadows.small,
    borderWidth: 0.5,
    borderColor: colors.border,
    elevation: 1,
  },
  suggestionIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.darkText,
    fontWeight: '400',
  },
  fareCard: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    maxHeight: 250,
    zIndex: 97,
    ...shadows.large,
  },
  fareCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  fareCardTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  fareCardContentMinimized: {
    paddingVertical: spacing.xs,
  },
  fareRowMinimized: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fareValueMinimized: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.success,
  },
  fareCardContent: {
    gap: spacing.md,
    maxHeight: 200,
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fareInfo: {
    flex: 1,
  },
  fareLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 2,
  },
  fareValue: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  driversRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  driversText: {
    ...typography.caption,
    color: colors.gray,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: 'transparent',
  },
  modernButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    borderRadius: 16,
    gap: spacing.sm,
    ...shadows.large,
    elevation: 12,
    shadowColor: colors.buttonPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 0,
    minHeight: 56,
  },
  modernButtonText: {
    ...typography.bodyBold,
    fontSize: 17,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  favoriteButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  favoritesPickerContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    ...shadows.large,
  },
  favoritesPickerContent: {
    padding: spacing.lg,
  },
  favoritesPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  favoritesPickerTitle: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: '700',
    color: colors.darkText,
  },
  favoritesPickerList: {
    maxHeight: 400,
  },
  favoritePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  favoritePickerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoritePickerInfo: {
    flex: 1,
  },
  favoritePickerName: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.darkText,
    marginBottom: 2,
  },
  favoritePickerAddress: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
  },
  emptyFavoritesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
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
  rideTypeContainer: {
    position: 'absolute',
    top: 110,
    left: spacing.md,
    right: spacing.md,
    zIndex: 96,
  },
  rideTypeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rideTypeLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rideTypeToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rideTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  rideTypeButtonActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  rideTypeButtonText: {
    ...typography.body,
    fontSize: 13,
    color: colors.darkText,
    fontWeight: '600',
  },
  rideTypeButtonTextActive: {
    color: colors.white,
  },
  errandNotesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  errandNotesLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  errandNotesInput: {
    ...typography.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: colors.white,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.darkText,
  },
});


