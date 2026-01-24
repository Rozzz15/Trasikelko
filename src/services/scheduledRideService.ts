// Scheduled Ride Service - Supabase Integration
import { supabase } from '../config/supabase';

export interface ScheduledRide {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_photo: string | null;
  driver_plate: string | null;
  pickup_location: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_location: string;
  dropoff_latitude: number;
  dropoff_longitude: number;
  scheduled_date: string;
  scheduled_time: string;
  scheduled_datetime: string;
  notes: string | null;
  status: 'scheduled' | 'accepted' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  notification_id?: string | null;
  passenger_name?: string;
  passenger_phone?: string;
}

/**
 * Create a new scheduled ride
 */
export const createScheduledRide = async (
  passengerId: string,
  rideData: {
    pickupLocation: string;
    pickupLatitude: number;
    pickupLongitude: number;
    dropoffLocation: string;
    dropoffLatitude: number;
    dropoffLongitude: number;
    scheduledDate: string;
    scheduledTime: string;
    scheduledDatetime: string;
    notes?: string;
  }
): Promise<{ success: boolean; ride?: ScheduledRide; error?: string }> => {
  try {
    console.log('[createScheduledRide] Creating scheduled ride...');
    console.log('[createScheduledRide] Passenger ID:', passengerId);
    console.log('[createScheduledRide] Ride data:', JSON.stringify(rideData, null, 2));
    
    const insertData = {
      passenger_id: passengerId,
      pickup_location: rideData.pickupLocation,
      pickup_latitude: rideData.pickupLatitude,
      pickup_longitude: rideData.pickupLongitude,
      dropoff_location: rideData.dropoffLocation,
      dropoff_latitude: rideData.dropoffLatitude,
      dropoff_longitude: rideData.dropoffLongitude,
      scheduled_date: rideData.scheduledDate,
      scheduled_time: rideData.scheduledTime,
      scheduled_datetime: rideData.scheduledDatetime,
      notes: rideData.notes || null,
      status: 'scheduled',
    };
    
    console.log('[createScheduledRide] Insert data:', JSON.stringify(insertData, null, 2));
    
    const { data, error } = await supabase
      .from('scheduled_rides')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[createScheduledRide] ❌ Database error:', error);
      console.error('[createScheduledRide] ❌ Error details:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }

    console.log('[createScheduledRide] ✅ Scheduled ride created successfully!');
    console.log('[createScheduledRide] ✅ Ride ID:', data.id);
    console.log('[createScheduledRide] ✅ Scheduled datetime:', data.scheduled_datetime);
    
    return { success: true, ride: data };
  } catch (error: any) {
    console.error('[createScheduledRide] ❌ Unexpected error:', error);
    console.error('[createScheduledRide] ❌ Error message:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get all scheduled rides for a passenger
 */
export const getScheduledRides = async (
  passengerId: string
): Promise<{ success: boolean; rides?: ScheduledRide[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('passenger_id', passengerId)
      .order('scheduled_datetime', { ascending: true });

    if (error) {
      console.error('Error getting scheduled rides:', error);
      return { success: false, error: error.message };
    }

    return { success: true, rides: data || [] };
  } catch (error: any) {
    console.error('Error in getScheduledRides:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get upcoming scheduled rides
 */
export const getUpcomingRides = async (
  passengerId: string
): Promise<{ success: boolean; rides?: ScheduledRide[]; error?: string }> => {
  try {
    const now = new Date();
    console.log('Getting upcoming rides. Current time:', now.toISOString());
    
    const { data, error } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('passenger_id', passengerId)
      .in('status', ['scheduled', 'accepted']) // Include both scheduled and accepted rides
      .order('scheduled_datetime', { ascending: true });

    if (error) {
      console.error('Error getting upcoming rides:', error);
      return { success: false, error: error.message };
    }

    // Filter in JavaScript to handle null scheduled_datetime and ensure future rides only
    const upcomingRides = (data || []).filter(ride => {
      if (!ride.scheduled_datetime) return false; // Don't show if no datetime set
      const rideTime = new Date(ride.scheduled_datetime);
      return rideTime >= now;
    });

    console.log(`Found ${upcomingRides.length} upcoming rides`);
    return { success: true, rides: upcomingRides };
  } catch (error: any) {
    console.error('Error in getUpcomingRides:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get past rides (completed or cancelled)
 */
export const getPastRides = async (
  passengerId: string
): Promise<{ success: boolean; rides?: ScheduledRide[]; error?: string }> => {
  try {
    const now = new Date();
    console.log('Getting past rides. Current time:', now.toISOString());
    
    const { data, error } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('passenger_id', passengerId)
      .or('status.eq.completed,status.eq.cancelled')
      .order('scheduled_datetime', { ascending: false });

    if (error) {
      console.error('Error getting past rides:', error);
      return { success: false, error: error.message };
    }

    // Also get scheduled rides that have passed
    const { data: expiredData } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('passenger_id', passengerId)
      .eq('status', 'scheduled')
      .order('scheduled_datetime', { ascending: false });

    const expiredRides = (expiredData || []).filter(ride => {
      if (!ride.scheduled_datetime) return false;
      const rideTime = new Date(ride.scheduled_datetime);
      return rideTime < now;
    });

    const allPastRides = [...(data || []), ...expiredRides];
    allPastRides.sort((a, b) => {
      const dateA = new Date(a.scheduled_datetime || a.created_at);
      const dateB = new Date(b.scheduled_datetime || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`Found ${allPastRides.length} past rides`);
    return { success: true, rides: allPastRides };
  } catch (error: any) {
    console.error('Error in getPastRides:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel a scheduled ride
 */
export const cancelScheduledRide = async (
  rideId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('scheduled_rides')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', rideId);

    if (error) {
      console.error('Error cancelling scheduled ride:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in cancelScheduledRide:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark a scheduled ride as completed
 */
export const completeScheduledRide = async (
  rideId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('scheduled_rides')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', rideId);

    if (error) {
      console.error('Error completing scheduled ride:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in completeScheduledRide:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a scheduled ride
 */
export const deleteScheduledRide = async (
  rideId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('scheduled_rides')
      .delete()
      .eq('id', rideId);

    if (error) {
      console.error('Error deleting scheduled ride:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteScheduledRide:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get available scheduled rides for drivers (not yet accepted)
 */
export const getAvailableScheduledRides = async (): Promise<{ 
  success: boolean; 
  rides?: ScheduledRide[]; 
  error?: string 
}> => {
  try {
    const now = new Date();
    console.log('[getAvailableScheduledRides] Fetching scheduled rides...');
    console.log('[getAvailableScheduledRides] Current time:', now.toISOString());
    
    // Get rides that are scheduled and not yet accepted
    const { data, error } = await supabase
      .from('scheduled_rides')
      .select(`
        *,
        users:passenger_id (
          full_name,
          phone_number
        )
      `)
      .eq('status', 'scheduled')
      .is('driver_id', null)
      .gte('scheduled_datetime', now.toISOString())
      .order('scheduled_datetime', { ascending: true });

    if (error) {
      console.error('[getAvailableScheduledRides] Error:', error);
      return { success: false, error: error.message };
    }

    console.log('[getAvailableScheduledRides] Raw data from DB:', JSON.stringify(data, null, 2));
    console.log('[getAvailableScheduledRides] Found', data?.length || 0, 'scheduled rides');

    // Transform data to include passenger info
    const ridesWithPassengerInfo = (data || []).map(ride => {
      console.log('[getAvailableScheduledRides] Processing ride:', {
        id: ride.id,
        scheduled_datetime: ride.scheduled_datetime,
        status: ride.status,
        driver_id: ride.driver_id,
        pickup: ride.pickup_location,
        dropoff: ride.dropoff_location
      });
      
      return {
        ...ride,
        passenger_name: ride.users?.full_name || 'Passenger',
        passenger_phone: ride.users?.phone_number || 'N/A',
      };
    });

    console.log('[getAvailableScheduledRides] Returning', ridesWithPassengerInfo.length, 'rides to driver');
    return { success: true, rides: ridesWithPassengerInfo };
  } catch (error: any) {
    console.error('[getAvailableScheduledRides] Unexpected error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Accept a scheduled ride (driver accepts)
 */
export const acceptScheduledRide = async (
  rideId: string,
  driverId: string,
  driverName: string,
  driverPhone: string,
  driverPhoto: string | null,
  driverPlate: string | null
): Promise<{ success: boolean; error?: string }> => {
  try {
    // First, check if the ride is still available
    const { data: currentRide, error: fetchError } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('id', rideId)
      .single();

    if (fetchError) {
      console.error('Error fetching scheduled ride:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Check if already accepted by another driver
    if (currentRide.driver_id !== null || currentRide.status !== 'scheduled') {
      return { 
        success: false, 
        error: 'This scheduled ride has already been accepted by another driver.' 
      };
    }

    // Accept the ride
    const { error } = await supabase
      .from('scheduled_rides')
      .update({
        driver_id: driverId,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_photo: driverPhoto,
        driver_plate: driverPlate,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', rideId)
      .is('driver_id', null); // Ensure it's still null (prevent race condition)

    if (error) {
      console.error('Error accepting scheduled ride:', error);
      return { success: false, error: error.message };
    }

    // Note: Notification system can be added when expo-notifications is installed
    console.log('Scheduled ride accepted successfully:', {
      rideId,
      driverId,
      driverName,
      scheduledTime: currentRide.scheduled_datetime
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error in acceptScheduledRide:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get accepted scheduled rides for a driver
 */
export const getDriverScheduledRides = async (
  driverId: string
): Promise<{ success: boolean; rides?: ScheduledRide[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('scheduled_rides')
      .select(`
        *,
        users:passenger_id (
          full_name,
          phone_number
        )
      `)
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'completed'])
      .order('scheduled_datetime', { ascending: true });

    if (error) {
      console.error('Error getting driver scheduled rides:', error);
      return { success: false, error: error.message };
    }

    // Transform data to include passenger info
    const ridesWithPassengerInfo = (data || []).map(ride => ({
      ...ride,
      passenger_name: ride.users?.full_name || 'Passenger',
      passenger_phone: ride.users?.phone_number || 'N/A',
    }));

    return { success: true, rides: ridesWithPassengerInfo };
  } catch (error: any) {
    console.error('Error in getDriverScheduledRides:', error);
    return { success: false, error: error.message };
  }
};
