// Favorite Location Service - Supabase Integration
import { supabase } from '../config/supabase';

export interface FavoriteLocation {
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

/**
 * Get all favorite locations for a user
 */
export const getFavoriteLocations = async (
  userId: string
): Promise<{ success: boolean; favorites?: FavoriteLocation[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('favorite_locations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting favorite locations:', error);
      return { success: false, error: error.message };
    }

    return { success: true, favorites: data || [] };
  } catch (error: any) {
    console.error('Error in getFavoriteLocations:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save a new favorite location
 */
export const saveFavoriteLocation = async (
  userId: string,
  favorite: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    icon: 'home' | 'briefcase' | 'school' | 'location' | 'heart' | 'star';
  }
): Promise<{ success: boolean; favorite?: FavoriteLocation; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('favorite_locations')
      .insert({
        user_id: userId,
        name: favorite.name,
        address: favorite.address,
        latitude: favorite.latitude,
        longitude: favorite.longitude,
        icon: favorite.icon,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving favorite location:', error);
      return { success: false, error: error.message };
    }

    return { success: true, favorite: data };
  } catch (error: any) {
    console.error('Error in saveFavoriteLocation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing favorite location
 */
export const updateFavoriteLocation = async (
  favoriteId: string,
  updates: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    icon?: 'home' | 'briefcase' | 'school' | 'location' | 'heart' | 'star';
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('favorite_locations')
      .update(updates)
      .eq('id', favoriteId);

    if (error) {
      console.error('Error updating favorite location:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateFavoriteLocation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a favorite location
 */
export const deleteFavoriteLocation = async (
  favoriteId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('favorite_locations')
      .delete()
      .eq('id', favoriteId);

    if (error) {
      console.error('Error deleting favorite location:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteFavoriteLocation:', error);
    return { success: false, error: error.message };
  }
};
