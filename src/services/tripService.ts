// Trip Service - Supabase
// This replaces tripStorage.ts with Supabase Database

import { supabase } from '../config/supabase';

export interface Trip {
  id: string;
  passenger_id: string;
  driver_id?: string;
  driver_name?: string;
  driver_photo?: string;
  tricycle_plate?: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  fare?: number;
  estimated_fare?: number;
  base_fare?: number;
  discount_amount?: number;
  discount_type?: 'senior' | 'pwd' | 'none';
  distance?: number;
  duration?: number;
  status: 'pending' | 'searching' | 'driver_found' | 'driver_accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  ride_type?: 'normal' | 'errand';
  errand_notes?: string;
  payment_method?: 'cash' | 'gcash';
  payment_status?: 'pending' | 'completed';
  passenger_rating?: number;
  passenger_feedback?: string;
  driver_rating?: number;
  driver_feedback?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}

/**
 * Create a new trip booking
 */
export const createTrip = async (tripData: Omit<Trip, 'id' | 'created_at'>): Promise<{ success: boolean; trip?: Trip; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .insert(tripData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, trip: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get trip by ID
 */
export const getTripById = async (tripId: string): Promise<Trip | null> => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (error) {
      console.error('Error getting trip:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting trip:', error);
    return null;
  }
};

/**
 * Get all trips for a user (passenger or driver)
 */
export const getUserTrips = async (userId: string, accountType: 'passenger' | 'driver' = 'passenger'): Promise<{ success: boolean; trips?: any[]; error?: string }> => {
  try {
    const column = accountType === 'passenger' ? 'passenger_id' : 'driver_id';
    
    // Fetch trips with driver and passenger information from profiles
    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        driver:driver_id (
          id,
          full_name,
          phone_number
        ),
        passenger:passenger_id (
          id,
          full_name,
          phone_number
        )
      `)
      .eq(column, userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getUserTrips] Error getting user trips:', error);
      return { success: false, error: error.message };
    }

    // Transform the data to flatten driver and passenger info
    const transformedTrips = trips?.map(trip => ({
      ...trip,
      driver_name: trip.driver?.full_name,
      driver_phone: trip.driver?.phone_number,
      passenger_name: trip.passenger?.full_name,
      passenger_phone: trip.passenger?.phone_number,
    })) || [];

    console.log('[getUserTrips] Transformed trips with names:', transformedTrips);

    return { success: true, trips: transformedTrips };
  } catch (error: any) {
    console.error('[getUserTrips] Error getting user trips:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get active trip for a user
 */
export const getActiveTrip = async (userId: string, accountType: 'passenger' | 'driver'): Promise<Trip | null> => {
  try {
    const column = accountType === 'passenger' ? 'passenger_id' : 'driver_id';
    
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq(column, userId)
      .in('status', ['pending', 'searching', 'driver_found', 'driver_accepted', 'arrived', 'in_progress', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting active trip:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error getting active trip:', error);
    return null;
  }
};

/**
 * Update trip
 */
export const updateTrip = async (
  tripId: string,
  updates: Partial<Trip>
): Promise<{ success: boolean; trip?: Trip; error?: string }> => {
  try {
    console.log('[updateTrip] Updating trip:', tripId, 'with updates:', updates);
    
    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId)
      .select();

    console.log('[updateTrip] Supabase response - data:', data, 'error:', error);

    if (error) {
      console.error('[updateTrip] Supabase error:', error);
      return { success: false, error: error.message };
    }

    // Return the first item if data is an array, otherwise return data
    const trip = Array.isArray(data) ? data[0] : data;
    
    if (!trip || (Array.isArray(data) && data.length === 0)) {
      console.error('[updateTrip] No trip found with ID:', tripId);
      return { success: false, error: 'Trip not found or update failed' };
    }

    console.log('[updateTrip] Success! Updated trip:', trip);
    return { success: true, trip };
  } catch (error: any) {
    console.error('[updateTrip] Exception:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Accept trip (driver accepts booking)
 */
export const acceptTrip = async (tripId: string, driverId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get trip details first
    const trip = await getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Trip not found' };
    }

    // Update trip status
    const { error } = await supabase
      .from('trips')
      .update({
        driver_id: driverId,
        status: 'driver_accepted',
      })
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Start trip
 */
export const startTrip = async (tripId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get trip details
    const trip = await getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Trip not found' };
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Complete trip
 */
export const completeTrip = async (
  tripId: string,
  finalFare: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        fare: finalFare,
        payment_status: 'completed',
      })
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Update driver's total rides count
    const trip = await getTripById(tripId);
    if (trip?.driver_id) {
      await supabase.rpc('increment_driver_rides', { driver_user_id: trip.driver_id });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Mark driver as arrived at pickup location
 */
export const markDriverArrived = async (tripId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get trip details
    const trip = await getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Trip not found' };
    }

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'arrived',
      })
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Cancel trip
 */
export const cancelTrip = async (tripId: string, cancelledBy: 'driver' | 'passenger' = 'passenger'): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get trip details
    const trip = await getTripById(tripId);
    if (!trip) {
      return { success: false, error: 'Trip not found' };
    }

    // Now that updated_at column is fixed, we can use normal UPDATE
    const { error } = await supabase
      .from('trips')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Rate trip (passenger or driver)
 */
export const rateTrip = async (
  tripId: string,
  rating: number,
  feedback: string,
  raterType: 'passenger' | 'driver'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updates = raterType === 'passenger'
      ? { passenger_rating: rating, passenger_feedback: feedback }
      : { driver_rating: rating, driver_feedback: feedback };

    const { error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Update driver's average rating if passenger rated
    if (raterType === 'passenger') {
      const trip = await getTripById(tripId);
      if (trip?.driver_id) {
        await updateDriverRating(trip.driver_id);
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Update driver's average rating
 */
const updateDriverRating = async (driverId: string): Promise<void> => {
  try {
    // Get all completed trips with ratings
    const { data: trips } = await supabase
      .from('trips')
      .select('driver_rating')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .not('driver_rating', 'is', null);

    if (trips && trips.length > 0) {
      const total = trips.reduce((sum, trip) => sum + (trip.driver_rating || 0), 0);
      const average = total / trips.length;

      await supabase
        .from('drivers')
        .update({ average_rating: average })
        .eq('user_id', driverId);
    }
  } catch (error) {
    console.error('Error updating driver rating:', error);
  }
};

/**
 * Get pending trips (for drivers to see available bookings)
 */
export const getPendingTrips = async (): Promise<Trip[]> => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['pending', 'searching'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error getting pending trips:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting pending trips:', error);
    return [];
  }
};

/**
 * Subscribe to trip updates (real-time)
 */
export const subscribeToTrip = (tripId: string, callback: (trip: Trip) => void) => {
  const channel = supabase
    .channel(`trip-${tripId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'trips',
        filter: `id=eq.${tripId}`,
      },
      (payload) => {
        callback(payload.new as Trip);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Calculate fare estimate (keep existing logic from tripStorage.ts)
 */
export const calculateFareEstimate = (
  distance: number,
  discountType: 'senior' | 'pwd' | 'none' = 'none'
): { estimatedFare: number; baseFare: number; discountAmount: number } => {
  const baseFare = 15; // Base fare in pesos
  const perKmRate = 5; // Per kilometer rate
  
  const totalFare = baseFare + (distance * perKmRate);
  let discountAmount = 0;

  if (discountType === 'senior' || discountType === 'pwd') {
    discountAmount = totalFare * 0.20; // 20% discount
  }

  const estimatedFare = Math.max(totalFare - discountAmount, baseFare); // Minimum fare is base fare

  return {
    estimatedFare: Math.round(estimatedFare * 100) / 100,
    baseFare,
    discountAmount: Math.round(discountAmount * 100) / 100,
  };
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export const calculateDistance = (
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
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};
