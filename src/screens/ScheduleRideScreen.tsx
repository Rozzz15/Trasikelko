import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { Button } from '../components';
import { createScheduledRide } from '../services/scheduledRideService';
import { getUserData } from '../services/userService';
import { getFavoriteLocations, FavoriteLocation } from '../services/favoriteLocationService';

interface ScheduleRideScreenProps {
  navigation: any;
  route: any;
}

export const ScheduleRideScreen: React.FC<ScheduleRideScreenProps> = ({ navigation, route }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDropoffMap, setShowDropoffMap] = useState(false);
  // Lopez, Quezon, Philippines coordinates
  const LOPEZ_QUEZON = {
    latitude: 13.8833,
    longitude: 122.2667,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const [mapRegion, setMapRegion] = useState<Region>(LOPEZ_QUEZON);
  const [tempPickupCoords, setTempPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [tempDropoffCoords, setTempDropoffCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  
  const [notes, setNotes] = useState('');
  const mapRef = useRef<MapView>(null);
  
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [showFavoritesPicker, setShowFavoritesPicker] = useState<'pickup' | 'dropoff' | null>(null);

  useEffect(() => {
    getCurrentLocation();
    loadUserId();
    loadFavoriteLocations();
  }, []);

  const loadFavoriteLocations = async () => {
    try {
      const userData = await getUserData();
      if (userData) {
        const result = await getFavoriteLocations(userData.id);
        if (result.success && result.favorites) {
          setFavoriteLocations(result.favorites);
        }
      }
    } catch (error) {
      console.error('Error loading favorite locations:', error);
    }
  };

  const loadUserId = async () => {
    try {
      const userData = await getUserData();
      if (userData) {
        setUserId(userData.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        // Set default to Lopez, Quezon even without permission
        setMapRegion(LOPEZ_QUEZON);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      
      // Check if user is near Lopez, Quezon (within ~50km)
      const distanceFromLopez = getDistanceFromLatLonInKm(
        location.coords.latitude,
        location.coords.longitude,
        LOPEZ_QUEZON.latitude,
        LOPEZ_QUEZON.longitude
      );

      // If user is near Lopez, use their location, otherwise center on Lopez
      if (distanceFromLopez < 50) {
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setMapRegion(newRegion);
        
        // Set pickup to current location by default
        setPickupCoordinates({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        // Get address for current location
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (address[0]) {
          const addressParts = [];
          if (address[0].name) addressParts.push(address[0].name);
          if (address[0].street) addressParts.push(address[0].street);
          if (address[0].district) addressParts.push(address[0].district);
          if (address[0].city) addressParts.push(address[0].city);
          
          const formattedAddress = addressParts.filter(part => part && part.trim()).join(', ');
          setPickupLocation(formattedAddress || 'Current Location');
        }
      } else {
        // User is far from Lopez, center map on Lopez
        setMapRegion(LOPEZ_QUEZON);
        Alert.alert(
          'Location Notice',
          'You appear to be outside Lopez, Quezon. The map has been centered on Lopez for your convenience.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      // Fallback to Lopez, Quezon
      setMapRegion(LOPEZ_QUEZON);
    }
  };

  // Calculate distance between two coordinates
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      // Ensure the date is not in the past
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (date < now) {
        Alert.alert('Invalid Date', 'Please select a date in the future.');
        return;
      }
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      // Check if the selected time is in the future
      const selectedDateTime = new Date(selectedDate);
      selectedDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
      
      const now = new Date();
      // Add 5 minutes buffer to current time to ensure it's actually in the future
      const minimumTime = new Date(now.getTime() + 5 * 60000);
      
      if (selectedDateTime < minimumTime) {
        Alert.alert('Invalid Time', 'Please select a time at least 5 minutes in the future.');
        return;
      }
      
      setSelectedTime(time);
    }
  };

  const handleMapRegionChange = (region: Region, isPickup: boolean) => {
    // Update temp coordinates based on map center (crosshair position)
    if (isPickup) {
      setTempPickupCoords({ latitude: region.latitude, longitude: region.longitude });
    } else {
      setTempDropoffCoords({ latitude: region.latitude, longitude: region.longitude });
    }
  };

  const confirmLocation = async (isPickup: boolean) => {
    const coords = isPickup ? tempPickupCoords : tempDropoffCoords;
    
    if (!coords) return;

    if (isPickup) {
      setPickupCoordinates(coords);
      await getAddressFromCoordinates(coords.latitude, coords.longitude, true);
      setShowPickupMap(false);
    } else {
      setDropoffCoordinates(coords);
      await getAddressFromCoordinates(coords.latitude, coords.longitude, false);
      setShowDropoffMap(false);
    }
  };

  const recenterMap = (isPickup: boolean) => {
    if (isPickup && pickupCoordinates) {
      setMapRegion({
        ...mapRegion,
        latitude: pickupCoordinates.latitude,
        longitude: pickupCoordinates.longitude,
      });
    } else if (!isPickup && dropoffCoordinates) {
      setMapRegion({
        ...mapRegion,
        latitude: dropoffCoordinates.latitude,
        longitude: dropoffCoordinates.longitude,
      });
    } else {
      // Recenter to Lopez, Quezon
      setMapRegion(LOPEZ_QUEZON);
    }
  };

  const getAddressFromCoordinates = async (latitude: number, longitude: number, isPickup: boolean) => {
    try {
      const address = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address[0]) {
        // Build more detailed address
        const addressParts = [];
        
        if (address[0].name) addressParts.push(address[0].name);
        if (address[0].street) addressParts.push(address[0].street);
        if (address[0].district) addressParts.push(address[0].district);
        if (address[0].city) addressParts.push(address[0].city);
        if (address[0].region && address[0].region !== address[0].city) addressParts.push(address[0].region);
        
        const formattedAddress = addressParts.filter(part => part && part.trim()).join(', ');
        
        if (isPickup) {
          setPickupLocation(formattedAddress || 'Selected Location');
        } else {
          setDropoffLocation(formattedAddress || 'Selected Location');
        }
      }
    } catch (error) {
      console.error('Error getting address:', error);
      // Fallback to coordinates
      const fallbackAddress = `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      if (isPickup) {
        setPickupLocation(fallbackAddress);
      } else {
        setDropoffLocation(fallbackAddress);
      }
    }
  };

  const handleScheduleRide = async () => {
    // Validation
    if (!userId) {
      Alert.alert('Error', 'User not logged in. Please login again.');
      return;
    }

    if (!pickupLocation || !pickupCoordinates) {
      Alert.alert('Missing Information', 'Please select a pickup location.');
      return;
    }
    
    if (!dropoffLocation || !dropoffCoordinates) {
      Alert.alert('Missing Information', 'Please select a dropoff location.');
      return;
    }

    // Create scheduled datetime
    const scheduledDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0
    );

    // Final validation: ensure scheduled time is in the future
    const now = new Date();
    const minimumTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
    
    if (scheduledDateTime < minimumTime) {
      Alert.alert('Invalid Schedule', 'Scheduled time must be at least 5 minutes in the future. Please select a different date or time.');
      return;
    }

    setIsSaving(true);
    
    try {

      // Format date and time properly for PostgreSQL
      const scheduledDateFormatted = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const seconds = '00';
      const scheduledTimeFormatted = `${hours}:${minutes}:${seconds}`; // HH:MM:SS

      // Save to Supabase
      const result = await createScheduledRide(userId, {
        pickupLocation,
        pickupLatitude: pickupCoordinates.latitude,
        pickupLongitude: pickupCoordinates.longitude,
        dropoffLocation,
        dropoffLatitude: dropoffCoordinates.latitude,
        dropoffLongitude: dropoffCoordinates.longitude,
        scheduledDate: scheduledDateFormatted,
        scheduledTime: scheduledTimeFormatted,
        scheduledDatetime: scheduledDateTime.toISOString(),
        notes: notes || undefined,
      });

      setIsSaving(false);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to save scheduled ride. Please try again.');
        return;
      }

      // Show confirmation
      Alert.alert(
        'Ride Scheduled Successfully! 🎉',
        `Your ride is scheduled for:\n\n` +
        `📅 Date: ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
        `⏰ Time: ${selectedTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n\n` +
        `📍 Pickup: ${pickupLocation}\n` +
        `📍 Dropoff: ${dropoffLocation}\n\n` +
        `Drivers will be able to see and accept your scheduled ride.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to history screen
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving scheduled ride:', error);
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save scheduled ride. Please try again.');
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today;
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30); // Allow scheduling up to 30 days in advance
    return maxDate;
  };

  const handleSelectFavorite = (favorite: FavoriteLocation, type: 'pickup' | 'dropoff') => {
    const coords = {
      latitude: favorite.latitude,
      longitude: favorite.longitude,
    };

    if (type === 'pickup') {
      setPickupCoordinates(coords);
      setPickupLocation(favorite.address);
    } else {
      setDropoffCoordinates(coords);
      setDropoffLocation(favorite.address);
    }

    setShowFavoritesPicker(null);
  };

  const getFavoriteIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      home: 'home',
      briefcase: 'briefcase',
      school: 'school',
      location: 'location',
      heart: 'heart',
      star: 'star',
    };
    return iconMap[iconName] || 'location';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule a Ride</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Date & Time Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 When do you need a ride?</Text>
            
            {/* Date Picker */}
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <View style={styles.pickerContent}>
                <Text style={styles.pickerLabel}>Date</Text>
                <Text style={styles.pickerValue}>
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>

            {/* Time Picker */}
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={24} color={colors.primary} />
              <View style={styles.pickerContent}>
                <Text style={styles.pickerLabel}>Time</Text>
                <Text style={styles.pickerValue}>
                  {selectedTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>
          </View>

          {/* Pickup Location Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Pickup Location</Text>
              {favoriteLocations.length > 0 && (
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={() => setShowFavoritesPicker('pickup')}
                >
                  <Ionicons name="heart" size={16} color={colors.primary} />
                  <Text style={styles.favoriteButtonText}>Favorites</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setShowPickupMap(!showPickupMap)}
            >
              <Ionicons name="location" size={24} color={colors.success} />
              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>Pickup Point</Text>
                <Text style={styles.locationValue} numberOfLines={2}>
                  {pickupLocation || 'Tap to select pickup location'}
                </Text>
              </View>
              <Ionicons
                name={showPickupMap ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.gray}
              />
            </TouchableOpacity>

            {showPickupMap && (
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={pickupCoordinates ? {
                    ...mapRegion,
                    latitude: pickupCoordinates.latitude,
                    longitude: pickupCoordinates.longitude,
                  } : LOPEZ_QUEZON}
                  onRegionChangeComplete={(region) => handleMapRegionChange(region, true)}
                  showsUserLocation
                  showsMyLocationButton
                  loadingEnabled
                  loadingIndicatorColor={colors.primary}
                />
                
                {/* Center Crosshair */}
                <View style={styles.crosshairContainer}>
                  <Ionicons name="location-sharp" size={48} color={colors.success} />
                </View>

                <View style={styles.mapInstructions}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.mapInstructionsText}>Move map to select pickup location</Text>
                </View>

                {/* Map Controls */}
                <View style={styles.mapControls}>
                  <TouchableOpacity
                    style={styles.mapControlButton}
                    onPress={() => {
                      setMapRegion({
                        ...mapRegion,
                        latitudeDelta: mapRegion.latitudeDelta / 2,
                        longitudeDelta: mapRegion.longitudeDelta / 2,
                      });
                    }}
                  >
                    <Ionicons name="add" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlButton, { marginTop: spacing.xs }]}
                    onPress={() => {
                      setMapRegion({
                        ...mapRegion,
                        latitudeDelta: mapRegion.latitudeDelta * 2,
                        longitudeDelta: mapRegion.longitudeDelta * 2,
                      });
                    }}
                  >
                    <Ionicons name="remove" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlButton, { marginTop: spacing.xs }]}
                    onPress={() => recenterMap(true)}
                  >
                    <Ionicons name="locate" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Confirm Button */}
                <View style={styles.mapConfirmButton}>
                  <Button
                    title="Confirm Pickup Location"
                    onPress={() => confirmLocation(true)}
                    style={styles.confirmButton}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Dropoff Location Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🎯 Dropoff Location</Text>
              {favoriteLocations.length > 0 && (
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={() => setShowFavoritesPicker('dropoff')}
                >
                  <Ionicons name="heart" size={16} color={colors.primary} />
                  <Text style={styles.favoriteButtonText}>Favorites</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setShowDropoffMap(!showDropoffMap)}
            >
              <Ionicons name="flag" size={24} color={colors.error} />
              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>Dropoff Point</Text>
                <Text style={styles.locationValue} numberOfLines={2}>
                  {dropoffLocation || 'Tap to select dropoff location'}
                </Text>
              </View>
              <Ionicons
                name={showDropoffMap ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.gray}
              />
            </TouchableOpacity>

            {showDropoffMap && (
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={dropoffCoordinates ? {
                    ...mapRegion,
                    latitude: dropoffCoordinates.latitude,
                    longitude: dropoffCoordinates.longitude,
                  } : LOPEZ_QUEZON}
                  onRegionChangeComplete={(region) => handleMapRegionChange(region, false)}
                  showsUserLocation
                  showsMyLocationButton
                  loadingEnabled
                  loadingIndicatorColor={colors.primary}
                >
                  {pickupCoordinates && (
                    <Marker
                      coordinate={pickupCoordinates}
                      title="Pickup Location"
                      pinColor={colors.success}
                      opacity={0.5}
                    />
                  )}
                </MapView>
                
                {/* Center Crosshair */}
                <View style={styles.crosshairContainer}>
                  <Ionicons name="flag-sharp" size={48} color={colors.error} />
                </View>

                <View style={styles.mapInstructions}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.mapInstructionsText}>Move map to select dropoff location</Text>
                </View>

                {/* Map Controls */}
                <View style={styles.mapControls}>
                  <TouchableOpacity
                    style={styles.mapControlButton}
                    onPress={() => {
                      setMapRegion({
                        ...mapRegion,
                        latitudeDelta: mapRegion.latitudeDelta / 2,
                        longitudeDelta: mapRegion.longitudeDelta / 2,
                      });
                    }}
                  >
                    <Ionicons name="add" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlButton, { marginTop: spacing.xs }]}
                    onPress={() => {
                      setMapRegion({
                        ...mapRegion,
                        latitudeDelta: mapRegion.latitudeDelta * 2,
                        longitudeDelta: mapRegion.longitudeDelta * 2,
                      });
                    }}
                  >
                    <Ionicons name="remove" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapControlButton, { marginTop: spacing.xs }]}
                    onPress={() => recenterMap(false)}
                  >
                    <Ionicons name="locate" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Confirm Button */}
                <View style={styles.mapConfirmButton}>
                  <Button
                    title="Confirm Dropoff Location"
                    onPress={() => confirmLocation(false)}
                    style={styles.confirmButton}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Additional Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g., Please wait outside the gate, I have luggage, etc."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>📋 Ride Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date:</Text>
              <Text style={styles.summaryValue}>
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time:</Text>
              <Text style={styles.summaryValue}>
                {selectedTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pickup:</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {pickupLocation || 'Not selected'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Dropoff:</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {dropoffLocation || 'Not selected'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Schedule Button */}
        <View style={styles.buttonContainer}>
          <Button
            title={isSaving ? "Saving..." : "Schedule Ride"}
            onPress={handleScheduleRide}
            disabled={isSaving}
          />
        </View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={getMinDate()}
            maximumDate={getMaxDate()}
          />
        )}

        {/* Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}

        {/* Favorites Picker Modal */}
        <Modal
          visible={showFavoritesPicker !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFavoritesPicker(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Select {showFavoritesPicker === 'pickup' ? 'Pickup' : 'Dropoff'} Location
                </Text>
                <TouchableOpacity onPress={() => setShowFavoritesPicker(null)}>
                  <Ionicons name="close" size={24} color={colors.darkText} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.favoritesListContainer}>
                {favoriteLocations.map((favorite) => (
                  <TouchableOpacity
                    key={favorite.id}
                    style={styles.favoriteItem}
                    onPress={() => handleSelectFavorite(favorite, showFavoritesPicker!)}
                  >
                    <View style={styles.favoriteIconContainer}>
                      <Ionicons
                        name={getFavoriteIcon(favorite.icon)}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.favoriteDetails}>
                      <Text style={styles.favoriteName}>{favorite.name}</Text>
                      <Text style={styles.favoriteAddress} numberOfLines={2}>
                        {favorite.address}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
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
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pickerLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 2,
  },
  pickerValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.darkText,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  locationLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkText,
  },
  mapContainer: {
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  crosshairContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  mapInstructions: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: spacing.sm,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapInstructionsText: {
    fontSize: 12,
    color: colors.darkText,
    marginLeft: spacing.xs,
    flex: 1,
    fontWeight: '500',
  },
  mapControls: {
    position: 'absolute',
    right: spacing.sm,
    bottom: 80,
    zIndex: 2,
  },
  mapControlButton: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  mapConfirmButton: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  notesInput: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    color: colors.darkText,
    minHeight: 100,
  },
  summaryCard: {
    backgroundColor: colors.lightBlue,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: colors.darkText,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
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
  scheduleButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.lightBlue,
    borderRadius: 12,
  },
  favoriteButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.darkText,
  },
  favoritesListContainer: {
    padding: spacing.md,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  favoriteIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  favoriteDetails: {
    flex: 1,
  },
  favoriteName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkText,
    marginBottom: 4,
  },
  favoriteAddress: {
    fontSize: 13,
    color: colors.gray,
  },
});
