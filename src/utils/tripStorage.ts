import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Trip {
  id: string;
  passengerId: string;
  driverId?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupCoordinates?: { latitude: number; longitude: number };
  dropoffCoordinates?: { latitude: number; longitude: number };
  fare: number;
  estimatedFare?: number;
  baseFare?: number;
  discountAmount?: number;
  discountType?: 'senior' | 'pwd' | 'none';
  distance?: number; // in km
  duration?: number; // in minutes
  status: 'pending' | 'searching' | 'driver_found' | 'driver_accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  rideType?: 'normal' | 'errand'; // Normal ride or Pasabay/Padala errand
  errandNotes?: string; // Special instructions for errand rides
  paymentMethod?: 'cash' | 'gcash';
  paymentStatus?: 'pending' | 'completed';
  passengerRating?: number;
  passengerFeedback?: string;
  driverRating?: number;
  driverFeedback?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  driverName?: string;
  driverPhoto?: string;
  driverPhone?: string;
  tricyclePlate?: string;
  passengerName?: string;
  passengerPhone?: string;
}

const TRIPS_KEY = 'trips';
const ACTIVE_TRIP_KEY = 'active_trip';

// Store a trip
export const storeTrip = async (trip: Trip): Promise<void> => {
  try {
    const trips = await getTrips();
    trips.push(trip);
    await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  } catch (error) {
    console.error('Error storing trip:', error);
    throw error;
  }
};

// Get all trips
export const getTrips = async (): Promise<Trip[]> => {
  try {
    const tripsJson = await AsyncStorage.getItem(TRIPS_KEY);
    return tripsJson ? JSON.parse(tripsJson) : [];
  } catch (error) {
    console.error('Error getting trips:', error);
    return [];
  }
};

// Get trips by user ID
export const getTripsByUserId = async (userId: string, userType: 'passenger' | 'driver'): Promise<Trip[]> => {
  try {
    const trips = await getTrips();
    if (userType === 'passenger') {
      return trips.filter(trip => trip.passengerId === userId);
    } else {
      return trips.filter(trip => trip.driverId === userId);
    }
  } catch (error) {
    console.error('Error getting trips by user ID:', error);
    return [];
  }
};

// Update trip
export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<void> => {
  try {
    const trips = await getTrips();
    const index = trips.findIndex(trip => trip.id === tripId);
    if (index !== -1) {
      trips[index] = { ...trips[index], ...updates };
      await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    }
  } catch (error) {
    console.error('Error updating trip:', error);
    throw error;
  }
};

// Get active trip
export const getActiveTrip = async (userId: string, userType: 'passenger' | 'driver'): Promise<Trip | null> => {
  try {
    const activeTripJson = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
    if (activeTripJson) {
      const activeTrip: Trip = JSON.parse(activeTripJson);
      if (userType === 'passenger' && activeTrip.passengerId === userId) {
        return activeTrip;
      } else if (userType === 'driver' && activeTrip.driverId === userId) {
        return activeTrip;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting active trip:', error);
    return null;
  }
};

// Set active trip
export const setActiveTrip = async (trip: Trip | null): Promise<void> => {
  try {
    if (trip) {
      await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
    } else {
      await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
    }
  } catch (error) {
    console.error('Error setting active trip:', error);
    throw error;
  }
};

// Calculate fare estimate using Lopez, Quezon fixed fare matrix
// All routes are FROM Poblacion TO various barangays with fixed fares
export const calculateFareEstimate = async (
  distanceKm: number,
  barangayName?: string,
  isNightTrip: boolean = false,
  hasSeniorDiscount: boolean = false,
  hasPWDDiscount: boolean = false,
  isErrandMode: boolean = false
): Promise<{ min: number; max: number; base: number; discountAmount?: number; discountType?: 'senior' | 'pwd' | 'none' }> => {
  console.log('[calculateFareEstimate] Input:', { barangayName, hasSeniorDiscount, hasPWDDiscount, isErrandMode });
  
  try {
    // Use Lopez fare table (fixed fares by barangay)
    const { getLopezFare } = require('./lopezFares');
    
    // Get the fare from Lopez fare matrix
    const fareData = getLopezFare(barangayName || '', hasSeniorDiscount, hasPWDDiscount);
    
    console.log('[calculateFareEstimate] Fare data from Lopez table:', fareData);
    
    if (!fareData.found) {
      console.warn('[calculateFareEstimate] Destination not found in Lopez fare table, using default minimum fare');
    }
    
    // Base fare from the fare matrix (either regular or discounted)
    let baseFare = fareData.regularFare;
    let finalFare = fareData.fare;
    let discountAmount = fareData.discountAmount;
    let discountType = fareData.discountType;
    
    // Apply errand mode surcharge (20% additional for errand/padala services)
    // Errand surcharge applies to the REGULAR fare before discount
    if (isErrandMode) {
      const errandSurcharge = Math.round(baseFare * 0.2);
      baseFare = baseFare + errandSurcharge;
      
      // Recalculate final fare with discount if applicable
      if (hasSeniorDiscount || hasPWDDiscount) {
        // For errand with discount, use the discounted base then add proportional surcharge
        finalFare = fareData.fare + Math.round(fareData.discountAmount * 0.2);
        discountAmount = baseFare - finalFare;
      } else {
        finalFare = baseFare;
      }
    }
    
    // Return exact fares (no variance needed - these are fixed official fares)
    return { 
      min: finalFare,
      max: finalFare, 
      base: baseFare,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      discountType: discountType || 'none'
    };
  } catch (error) {
    // Fallback to minimum fare if Lopez fare lookup fails
    console.error('[calculateFareEstimate] Error looking up Lopez fare, using default:', error);
    const defaultFare = 15; // Default minimum fare for Lopez
    
    return { 
      min: defaultFare, 
      max: defaultFare,
      base: defaultFare,
      discountAmount: undefined,
      discountType: 'none'
    };
  }
};

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get pending bookings (for drivers to see)
// Shows ALL bookings from ALL passengers to ALL drivers - no account-based filtering
export const getPendingBookings = async (driverId?: string): Promise<Trip[]> => {
  try {
    const trips = await getTrips();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds
    
    return trips.filter(trip => {
      // Only show bookings that are still searching/pending (not accepted or completed)
      const isSearching = trip.status === 'searching' || trip.status === 'pending';
      
      // Don't show bookings that have been accepted (status is 'driver_accepted' or later)
      const notAccepted = trip.status !== 'driver_accepted' && 
                          trip.status !== 'arrived' && 
                          trip.status !== 'in_progress' && 
                          trip.status !== 'completed' &&
                          trip.status !== 'cancelled';
      
      // Filter out stale bookings (older than 1 hour)
      const isRecent = new Date(trip.createdAt).getTime() > oneHourAgo;
      
      // Show ALL bookings from ALL passengers to ALL drivers
      // No filtering by passengerId, driverId, account type, or tenant
      // All drivers can see all active bookings from all passenger accounts
      return isSearching && notAccepted && isRecent;
    });
  } catch (error) {
    console.error('Error getting pending bookings:', error);
    return [];
  }
};

// Create a new booking (when passenger books)
export const createBooking = async (
  passengerId: string,
  passengerName: string,
  passengerPhone: string,
  pickupLocation: string,
  dropoffLocation: string,
  pickupCoordinates?: { latitude: number; longitude: number },
  dropoffCoordinates?: { latitude: number; longitude: number },
  distance?: number,
  fareEstimate?: { min: number; max: number; base?: number; discountAmount?: number; discountType?: 'senior' | 'pwd' | 'none' },
  selectedDriverId?: string, // Optional: if passenger selected a specific driver
  rideType?: 'normal' | 'errand',
  errandNotes?: string
): Promise<Trip> => {
  try {
    const baseFare = fareEstimate?.base || (fareEstimate ? Math.round((fareEstimate.min + fareEstimate.max) / 2) : 0);
    const finalFare = baseFare - (fareEstimate?.discountAmount || 0);
    
    const trip: Trip = {
      id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      passengerId,
      passengerName,
      passengerPhone,
      pickupLocation,
      dropoffLocation,
      pickupCoordinates,
      dropoffCoordinates,
      distance,
      estimatedFare: baseFare,
      baseFare: baseFare,
      discountAmount: fareEstimate?.discountAmount,
      discountType: fareEstimate?.discountType || 'none',
      fare: Math.max(finalFare, 0), // Final fare after discount
      rideType: rideType || 'normal',
      errandNotes: errandNotes,
      status: selectedDriverId ? 'searching' : 'searching', // Still searching even if driver pre-selected (driver needs to accept)
      driverId: selectedDriverId, // Store pre-selected driver ID
      createdAt: new Date().toISOString(),
    };
    
    await storeTrip(trip);
    await setActiveTrip(trip);
    return trip;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
};

// Accept booking (when driver accepts)
export const acceptBooking = async (
  tripId: string,
  driverId: string,
  driverName: string,
  driverPhone: string,
  driverPhoto?: string,
  tricyclePlate?: string
): Promise<void> => {
  try {
    // First, verify the booking is still available (not already accepted)
    const trips = await getTrips();
    const trip = trips.find(t => t.id === tripId);
    
    if (!trip) {
      throw new Error('Booking not found');
    }
    
    // Check if booking has already been accepted by another driver
    if (trip.status === 'driver_accepted' || 
        trip.status === 'arrived' || 
        trip.status === 'in_progress' ||
        trip.status === 'completed' ||
        trip.status === 'cancelled') {
      throw new Error('Booking has already been accepted by another driver');
    }
    
    // Allow any driver to accept any available booking
    // All drivers are connected to all passenger accounts, so any driver can accept any booking
    // Pre-selection is informational only - all drivers can see and accept all bookings
    
    // Accept the booking and link driver account
    await updateTrip(tripId, {
      driverId,
      driverName,
      driverPhone,
      driverPhoto,
      tricyclePlate,
      status: 'driver_accepted',
    });
    
    // Update active trip
    const updatedTrips = await getTrips();
    const updatedTrip = updatedTrips.find(t => t.id === tripId);
    if (updatedTrip) {
      await setActiveTrip({ 
        ...updatedTrip, 
        driverId, 
        driverName, 
        driverPhone, 
        driverPhoto, 
        tricyclePlate, 
        status: 'driver_accepted' 
      });
    }
  } catch (error) {
    console.error('Error accepting booking:', error);
    throw error;
  }
};


