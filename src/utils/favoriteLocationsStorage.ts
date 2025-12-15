import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FavoriteLocation {
  id: string;
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  icon?: 'home' | 'briefcase' | 'school' | 'location' | 'heart' | 'star';
  createdAt: string;
  userId: string; // Email of the user who owns this favorite
}

const FAVORITES_KEY = 'favorite_locations';

/**
 * Get all favorite locations for a user
 */
export const getFavoriteLocations = async (userEmail: string): Promise<FavoriteLocation[]> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!data) {
      return [];
    }
    
    const allFavorites: FavoriteLocation[] = JSON.parse(data);
    // Filter favorites by user email
    return allFavorites.filter(fav => fav.userId === userEmail);
  } catch (error) {
    console.error('Error getting favorite locations:', error);
    return [];
  }
};

/**
 * Add a new favorite location
 */
export const addFavoriteLocation = async (
  userEmail: string,
  name: string,
  address: string,
  coordinates: { latitude: number; longitude: number },
  icon?: FavoriteLocation['icon']
): Promise<FavoriteLocation> => {
  try {
    const favorites = await getFavoriteLocations(userEmail);
    
    // Check if location with same coordinates already exists
    const existing = favorites.find(fav => 
      Math.abs(fav.coordinates.latitude - coordinates.latitude) < 0.0001 &&
      Math.abs(fav.coordinates.longitude - coordinates.longitude) < 0.0001
    );
    
    if (existing) {
      throw new Error('This location is already in your favorites');
    }
    
    const newFavorite: FavoriteLocation = {
      id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      address,
      coordinates,
      icon: icon || 'location',
      createdAt: new Date().toISOString(),
      userId: userEmail,
    };
    
    // Get all favorites (from all users) and add the new one
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    const allFavorites: FavoriteLocation[] = data ? JSON.parse(data) : [];
    allFavorites.push(newFavorite);
    
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(allFavorites));
    
    return newFavorite;
  } catch (error) {
    console.error('Error adding favorite location:', error);
    throw error;
  }
};

/**
 * Update an existing favorite location
 */
export const updateFavoriteLocation = async (
  favoriteId: string,
  updates: Partial<Pick<FavoriteLocation, 'name' | 'address' | 'coordinates' | 'icon'>>
): Promise<FavoriteLocation> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!data) {
      throw new Error('Favorite location not found');
    }
    
    const allFavorites: FavoriteLocation[] = JSON.parse(data);
    const index = allFavorites.findIndex(fav => fav.id === favoriteId);
    
    if (index === -1) {
      throw new Error('Favorite location not found');
    }
    
    allFavorites[index] = {
      ...allFavorites[index],
      ...updates,
    };
    
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(allFavorites));
    
    return allFavorites[index];
  } catch (error) {
    console.error('Error updating favorite location:', error);
    throw error;
  }
};

/**
 * Delete a favorite location
 */
export const deleteFavoriteLocation = async (favoriteId: string): Promise<void> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!data) {
      return;
    }
    
    const allFavorites: FavoriteLocation[] = JSON.parse(data);
    const filtered = allFavorites.filter(fav => fav.id !== favoriteId);
    
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting favorite location:', error);
    throw error;
  }
};

/**
 * Get a favorite location by ID
 */
export const getFavoriteLocationById = async (favoriteId: string): Promise<FavoriteLocation | null> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!data) {
      return null;
    }
    
    const allFavorites: FavoriteLocation[] = JSON.parse(data);
    return allFavorites.find(fav => fav.id === favoriteId) || null;
  } catch (error) {
    console.error('Error getting favorite location by ID:', error);
    return null;
  }
};






