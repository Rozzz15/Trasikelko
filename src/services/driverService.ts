// Driver Service - Supabase
// Real-time driver location tracking and online status
// This is the PRIMARY storage - used by all screens (like Grab/Angkas)

import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DriverStatus = 'offline' | 'available' | 'on_ride';

export interface DriverLocation {
  user_id: string;
  email?: string;
  latitude: number;
  longitude: number;
  is_online: boolean;
  status: DriverStatus;
  last_location_update?: string;
  // Driver info for display
  full_name?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  plate_number?: string;
  average_rating?: number;
  total_rides?: number;
}

// Local cache keys (for fast startup only)
const CACHED_LOCATION_KEY = 'cached_driver_location';

/**
 * Update driver location and status (PRIMARY METHOD - replaces old AsyncStorage version)
 * Like Grab/Angkas: Stores in database first, then caches locally
 */
export const updateDriverLocationAndStatus = async (
  driverId: string,
  latitude: number,
  longitude: number,
  status: DriverStatus,
  isOnline: boolean = true
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Update in Supabase (primary storage)
    const { error } = await supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        is_online: isOnline,
        driver_status: status,
        last_location_update: new Date().toISOString(),
      })
      .eq('user_id', driverId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Cache locally for faster app startup (secondary)
    try {
      await AsyncStorage.setItem(CACHED_LOCATION_KEY, JSON.stringify({
        driverId,
        latitude,
        longitude,
        status,
        isOnline,
        timestamp: Date.now(),
      }));
    } catch (cacheError) {
      console.warn('Failed to cache location locally:', cacheError);
      // Don't fail the operation if caching fails
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Update driver location (backward compatible)
 */
export const updateDriverLocation = async (
  driverId: string,
  latitude: number,
  longitude: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('user_id', driverId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Update driver status only (available/on_ride/offline)
 */
export const updateDriverStatus = async (
  driverId: string,
  status: DriverStatus
): Promise<{ success: boolean; error?: string }> => {
  try {
    const isOnline = status !== 'offline';
    
    const { error } = await supabase
      .from('drivers')
      .update({
        driver_status: status,
        is_online: isOnline,
        last_location_update: new Date().toISOString(),
      })
      .eq('user_id', driverId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Set driver online/offline status
 */
export const setDriverOnlineStatus = async (
  driverId: string,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        is_online: isOnline,
        last_location_update: new Date().toISOString(),
      })
      .eq('user_id', driverId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Remove driver location (when going offline)
 */
export const removeDriverLocation = async (driverId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        is_online: false,
        driver_status: 'offline',
        current_latitude: null,
        current_longitude: null,
        last_location_update: new Date().toISOString(),
      })
      .eq('user_id', driverId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Clear local cache
    try {
      await AsyncStorage.removeItem(CACHED_LOCATION_KEY);
    } catch (cacheError) {
      console.warn('Failed to clear cached location:', cacheError);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get all online drivers (for passengers to see available drivers)
 */
export const getOnlineDrivers = async (): Promise<DriverLocation[]> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        user_id,
        current_latitude,
        current_longitude,
        is_online,
        last_location_update,
        vehicle_model,
        vehicle_color,
        plate_number,
        average_rating,
        users!inner(full_name)
      `)
      .eq('is_online', true)
      .eq('verification_status', 'verified')
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null);

    if (error) {
      console.error('Error getting online drivers:', error);
      return [];
    }

    return (data || []).map((driver: any) => ({
      user_id: driver.user_id,
      latitude: driver.current_latitude,
      longitude: driver.current_longitude,
      is_online: driver.is_online,
      status: driver.status || 'available',
      last_location_update: driver.last_location_update,
      full_name: driver.users.full_name,
      vehicle_model: driver.vehicle_model,
      vehicle_color: driver.vehicle_color,
      plate_number: driver.plate_number,
      average_rating: driver.average_rating,
    }));
  } catch (error) {
    console.error('Error getting online drivers:', error);
    return [];
  }
};

/**
 * Get nearby drivers (within radius)
 */
export const getNearbyDrivers = async (
  latitude: number,
  longitude: number,
  radiusKm: number = 5
): Promise<DriverLocation[]> => {
  try {
    const allDrivers = await getOnlineDrivers();
    
    // Filter drivers within radius using Haversine formula
    return allDrivers.filter(driver => {
      const distance = calculateDistance(
        latitude,
        longitude,
        driver.latitude,
        driver.longitude
      );
      return distance <= radiusKm;
    });
  } catch (error) {
    console.error('Error getting nearby drivers:', error);
    return [];
  }
};

/**
 * Subscribe to online drivers updates (real-time)
 */
export const subscribeToOnlineDrivers = (callback: (drivers: DriverLocation[]) => void) => {
  const channel = supabase
    .channel('online-drivers')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'drivers',
        filter: 'is_online=eq.true',
      },
      async () => {
        // Refetch all online drivers when any driver updates
        const drivers = await getOnlineDrivers();
        callback(drivers);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Get driver details
 */
export const getDriverDetails = async (driverId: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        users!inner(*)
      `)
      .eq('user_id', driverId)
      .single();

    if (error) {
      console.error('Error getting driver details:', error);
      return null;
    }

    return {
      ...data,
      ...data.users,
    };
  } catch (error) {
    console.error('Error getting driver details:', error);
    return null;
  }
};

/**
 * Find nearest available driver
 */
export const findNearestDriver = async (
  pickupLatitude: number,
  pickupLongitude: number
): Promise<DriverLocation | null> => {
  try {
    const nearbyDrivers = await getNearbyDrivers(pickupLatitude, pickupLongitude, 10);
    
    if (nearbyDrivers.length === 0) {
      return null;
    }

    // Sort by distance and return closest
    nearbyDrivers.sort((a, b) => {
      const distA = calculateDistance(pickupLatitude, pickupLongitude, a.latitude, a.longitude);
      const distB = calculateDistance(pickupLatitude, pickupLongitude, b.latitude, b.longitude);
      return distA - distB;
    });

    return nearbyDrivers[0];
  } catch (error) {
    console.error('Error finding nearest driver:', error);
    return null;
  }
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100;
};

const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Update driver verification status (admin only)
 */
export const updateDriverVerification = async (
  driverId: string,
  status: 'verified' | 'rejected',
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updates: any = {
      verification_status: status,
    };

    if (status === 'verified') {
      updates.verified_at = new Date().toISOString();
    } else {
      updates.rejected_at = new Date().toISOString();
      updates.rejection_reason = reason || '';
    }

    const { error } = await supabase
      .from('drivers')
      .update(updates)
      .eq('user_id', driverId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get pending driver applications (admin only)
 */
export const getPendingDrivers = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        users!inner(*)
      `)
      .eq('verification_status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error getting pending drivers:', error);
      return [];
    }

    return (data || []).map((driver: any) => ({
      ...driver,
      ...driver.users,
    }));
  } catch (error) {
    console.error('Error getting pending drivers:', error);
    return [];
  }
};

/**
 * Notify nearby drivers about a new ride request
 */
export const notifyNearbyDriversAboutRide = async (
  pickupLatitude: number,
  pickupLongitude: number,
  pickupLocation: string,
  dropoffLocation: string,
  passengerName: string,
  tripId: string,
  radiusKm: number = 5
): Promise<{ success: boolean; notifiedCount: number; error?: string }> => {
  try {
    // Get nearby drivers
    const nearbyDrivers = await getNearbyDrivers(pickupLatitude, pickupLongitude, radiusKm);
    
    if (nearbyDrivers.length === 0) {
      console.log('No nearby drivers found');
      return { success: true, notifiedCount: 0 };
    }

    // Send notification to each nearby driver
    let notifiedCount = 0;
    for (const driver of nearbyDrivers) {
      try {
        // TODO: Implement push notification system
        // await notifyRideRequest(driver.user_id, passengerName, pickupLocation, dropoffLocation, tripId);
        console.log(`Would notify driver ${driver.user_id} about trip ${tripId}`);
        notifiedCount++;
      } catch (error) {
        console.error(`Failed to notify driver ${driver.user_id}:`, error);
      }
    }

    console.log(`Notified ${notifiedCount} nearby drivers about trip ${tripId}`);
    return { success: true, notifiedCount };
  } catch (error: any) {
    console.error('Error notifying nearby drivers:', error);
    return { success: false, notifiedCount: 0, error: error.message };
  }
};
