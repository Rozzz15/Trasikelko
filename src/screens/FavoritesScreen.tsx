import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, spacing } from '../theme';
import { Button } from '../components';
import { getFavoriteLocations, saveFavoriteLocation, deleteFavoriteLocation } from '../services/favoriteLocationService';
import { getUserData } from '../services/userService';

interface FavoriteLocation {
  id: string;
  user_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: 'home' | 'briefcase' | 'school' | 'location' | 'heart' | 'star';
  created_at: string;
  updated_at: string;
}

interface FavoritesScreenProps {
  navigation: any;
  route: any;
}

const iconOptions: Array<{ icon: 'home' | 'briefcase' | 'school' | 'location' | 'heart' | 'star'; label: string }> = [
  { icon: 'home', label: 'Home' },
  { icon: 'briefcase', label: 'Work' },
  { icon: 'school', label: 'School' },
  { icon: 'heart', label: 'Favorite' },
  { icon: 'star', label: 'Special' },
  { icon: 'location', label: 'Other' },
];

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation, route }) => {
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<'home' | 'briefcase' | 'school' | 'location' | 'heart' | 'star'>('location');
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [tempCoords, setTempCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 13.8833,
    longitude: 122.2667,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndFavorites();
  }, []);

  const loadUserAndFavorites = async () => {
    try {
      const userData = await getUserData();
      if (userData) {
        setUserId(userData.id);
        await loadFavorites(userData.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadFavorites = async (userIdParam?: string) => {
    const id = userIdParam || userId;
    if (!id) return;
    
    const result = await getFavoriteLocations(id);
    if (result.success && result.favorites) {
      setFavorites(result.favorites);
    }
  };

  const handleAddFavorite = () => {
    setName('');
    setAddress('');
    setSelectedIcon('location');
    setSelectedCoords(null);
    setShowAddModal(true);
  };

  const handleOpenMapPicker = () => {
    // Open map immediately, then get location in background
    setShowMapPicker(true);
    
    // Load location in background without blocking
    setTimeout(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Faster, less accurate
          });
          setMapRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } catch (error) {
        console.log('Could not get location');
      }
    }, 100);
  };

  const handleMapRegionChange = (region: Region) => {
    setTempCoords({ latitude: region.latitude, longitude: region.longitude });
  };

  const confirmMapLocation = async () => {
    if (!tempCoords) return;
    
    setSelectedCoords(tempCoords);
    
    // Get address
    try {
      const result = await Location.reverseGeocodeAsync(tempCoords);
      if (result[0]) {
        const addr = `${result[0].street || ''}, ${result[0].city || ''}, ${result[0].region || ''}`.trim();
        setAddress(addr);
      }
    } catch (error) {
      console.log('Could not get address');
    }
    
    setShowMapPicker(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim() || !selectedCoords || !userId) {
      Alert.alert('Missing Information', 'Please fill in all fields and select a location on the map.');
      return;
    }

    const result = await saveFavoriteLocation(userId, {
      name: name.trim(),
      address: address.trim(),
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
      icon: selectedIcon,
    });

    if (result.success) {
      await loadFavorites();
      setShowAddModal(false);
      Alert.alert('Success', 'Favorite location saved!');
    } else {
      Alert.alert('Error', result.error || 'Failed to save favorite location.');
    }
  };

  const handleDelete = (favoriteId: string) => {
    Alert.alert(
      'Delete Favorite',
      'Are you sure you want to delete this favorite location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteFavoriteLocation(favoriteId);
            if (result.success) {
              await loadFavorites();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete favorite.');
            }
          },
        },
      ]
    );
  };

  const handleUse = (favorite: FavoriteLocation) => {
    const returnTo = route.params?.returnTo;
    const useAs = route.params?.useAs || 'pickup';
    
    if (returnTo) {
      navigation.navigate(returnTo, {
        selectedLocation: {
          address: favorite.address,
          latitude: favorite.latitude,
          longitude: favorite.longitude,
        },
        useAs,
      });
    } else {
      navigation.goBack();
    }
  };

  const getIconColor = (icon: string) => {
    switch (icon) {
      case 'home': return colors.success;
      case 'briefcase': return colors.primary;
      case 'school': return '#FF9500';
      case 'heart': return colors.error;
      case 'star': return '#FFD700';
      default: return colors.gray;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.darkText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorite Locations</Text>
        <TouchableOpacity onPress={handleAddFavorite} style={styles.addButton}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color={colors.gray} />
            <Text style={styles.emptyTitle}>No Favorite Locations</Text>
            <Text style={styles.emptyText}>
              Save your frequent destinations for quick access
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddFavorite}>
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.emptyButtonText}>Add First Favorite</Text>
            </TouchableOpacity>
          </View>
        ) : (
          favorites.map((favorite) => (
            <View key={favorite.id} style={styles.favoriteCard}>
              <View style={styles.favoriteHeader}>
                <View style={[styles.iconCircle, { backgroundColor: getIconColor(favorite.icon) + '20' }]}>
                  <Ionicons name={favorite.icon} size={24} color={getIconColor(favorite.icon)} />
                </View>
                <View style={styles.favoriteInfo}>
                  <Text style={styles.favoriteName}>{favorite.name}</Text>
                  <Text style={styles.favoriteAddress} numberOfLines={2}>{favorite.address}</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.useButton]}
                  onPress={() => handleUse(favorite)}
                >
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={styles.useButtonText}>Use Location</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(favorite.id)}
                >
                  <Ionicons name="trash" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Favorite Location</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.darkText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Home, Office, Mom's House"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Address Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tap map to auto-fill or type manually"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
              </View>

              {/* Map Picker Button */}
              <TouchableOpacity style={styles.mapPickerButton} onPress={handleOpenMapPicker}>
                <Ionicons name="map" size={24} color={colors.primary} />
                <View style={styles.mapPickerContent}>
                  <Text style={styles.mapPickerLabel}>Location on Map</Text>
                  <Text style={styles.mapPickerValue}>
                    {selectedCoords
                      ? `${selectedCoords.latitude.toFixed(5)}, ${selectedCoords.longitude.toFixed(5)}`
                      : 'Tap to select location'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray} />
              </TouchableOpacity>

              {/* Icon Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Icon</Text>
                <View style={styles.iconGrid}>
                  {iconOptions.map((option) => (
                    <TouchableOpacity
                      key={option.icon}
                      style={[
                        styles.iconOption,
                        selectedIcon === option.icon && styles.iconOptionSelected,
                      ]}
                      onPress={() => setSelectedIcon(option.icon)}
                    >
                      <Ionicons
                        name={option.icon}
                        size={24}
                        color={selectedIcon === option.icon ? colors.white : getIconColor(option.icon)}
                      />
                      <Text
                        style={[
                          styles.iconOptionLabel,
                          selectedIcon === option.icon && styles.iconOptionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Button
                title="Save Favorite"
                onPress={handleSave}
                disabled={!name.trim() || !address.trim() || !selectedCoords}
              />
            </ScrollView>
          </View>
        </View>
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
            <TouchableOpacity onPress={() => setShowMapPicker(false)}>
              <Ionicons name="close" size={28} color={colors.darkText} />
            </TouchableOpacity>
            <Text style={styles.mapPickerTitle}>Select Location</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              initialRegion={mapRegion}
              onRegionChangeComplete={handleMapRegionChange}
              showsUserLocation
              showsMyLocationButton
              loadingEnabled
              loadingIndicatorColor={colors.primary}
              loadingBackgroundColor={colors.background}
            />
            
            {/* Crosshair */}
            <View style={styles.crosshair}>
              <Ionicons name="location-sharp" size={48} color={colors.error} />
            </View>

            {/* Instructions */}
            <View style={styles.mapInstructions}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.mapInstructionsText}>Drag map to position crosshair</Text>
            </View>

            {/* Zoom Controls */}
            <View style={styles.zoomControls}>
              <TouchableOpacity
                style={styles.zoomButton}
                onPress={() => setMapRegion({ ...mapRegion, latitudeDelta: mapRegion.latitudeDelta / 2, longitudeDelta: mapRegion.longitudeDelta / 2 })}
              >
                <Ionicons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomButton, { marginTop: spacing.xs }]}
                onPress={() => setMapRegion({ ...mapRegion, latitudeDelta: mapRegion.latitudeDelta * 2, longitudeDelta: mapRegion.longitudeDelta * 2 })}
              >
                <Ionicons name="remove" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Confirm Button */}
            <View style={styles.mapConfirmContainer}>
              <Button
                title="Confirm Location"
                onPress={confirmMapLocation}
                style={styles.mapConfirmButton}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
  addButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
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
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
  },
  emptyButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  favoriteCard: {
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
  favoriteHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteInfo: {
    flex: 1,
    marginLeft: spacing.md,
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
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  useButton: {
    flex: 1,
    backgroundColor: colors.primary + '15',
  },
  useButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteButton: {
    backgroundColor: colors.error + '15',
    paddingHorizontal: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
  modalScroll: {
    padding: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 14,
    color: colors.darkText,
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  mapPickerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  mapPickerLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 2,
  },
  mapPickerValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkText,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconOption: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  iconOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconOptionLabel: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 4,
  },
  iconOptionLabelSelected: {
    color: colors.white,
  },
  saveButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray,
  },
  mapPickerContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  mapPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.darkText,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -48,
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
    fontWeight: '500',
  },
  zoomControls: {
    position: 'absolute',
    right: spacing.sm,
    top: '40%',
  },
  zoomButton: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  mapConfirmContainer: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
  },
  mapConfirmButton: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
