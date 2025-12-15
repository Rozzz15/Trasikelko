import AsyncStorage from '@react-native-async-storage/async-storage';

export type DriverStatus = 'offline' | 'available' | 'on_ride';

export interface DriverLocation {
  driverId: string;
  driverEmail: string;
  driverName: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  status: DriverStatus; // New field for driver availability status
  lastUpdated: string;
  tricyclePlate?: string;
  rating?: number;
  totalRides?: number;
}

const DRIVER_LOCATIONS_KEY = 'driver_locations';
const ONLINE_DRIVERS_KEY = 'online_drivers';

// Store or update driver location
export const updateDriverLocation = async (
  driverId: string,
  driverEmail: string,
  driverName: string,
  latitude: number,
  longitude: number,
  isOnline: boolean,
  status: DriverStatus = 'offline',
  tricyclePlate?: string,
  rating?: number,
  totalRides?: number
): Promise<void> => {
  try {
    const locations = await getDriverLocations();
    const existingIndex = locations.findIndex(loc => loc.driverId === driverId);
    
    // Determine status based on isOnline if status is not explicitly provided
    let driverStatus: DriverStatus = status;
    if (!status) {
      driverStatus = isOnline ? 'available' : 'offline';
    }
    
    const driverLocation: DriverLocation = {
      driverId,
      driverEmail,
      driverName,
      latitude,
      longitude,
      isOnline,
      status: driverStatus,
      lastUpdated: new Date().toISOString(),
      tricyclePlate,
      rating,
      totalRides,
    };

    if (existingIndex >= 0) {
      locations[existingIndex] = driverLocation;
    } else {
      locations.push(driverLocation);
    }

    await AsyncStorage.setItem(DRIVER_LOCATIONS_KEY, JSON.stringify(locations));

    // Update online drivers list
    if (isOnline) {
      const onlineDrivers = await getOnlineDrivers();
      if (!onlineDrivers.includes(driverId)) {
        onlineDrivers.push(driverId);
        await AsyncStorage.setItem(ONLINE_DRIVERS_KEY, JSON.stringify(onlineDrivers));
      }
    } else {
      const onlineDrivers = await getOnlineDrivers();
      const filtered = onlineDrivers.filter(id => id !== driverId);
      await AsyncStorage.setItem(ONLINE_DRIVERS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};

// Get all driver locations
export const getDriverLocations = async (): Promise<DriverLocation[]> => {
  try {
    const data = await AsyncStorage.getItem(DRIVER_LOCATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting driver locations:', error);
    return [];
  }
};

// Get only online drivers with 'available' status (excludes 'on_ride' and 'offline')
// Returns ALL available drivers from ALL driver accounts - no account-based filtering
// All passenger accounts are connected to all driver accounts
export const getOnlineDriverLocations = async (): Promise<DriverLocation[]> => {
  try {
    const locations = await getDriverLocations();
    // Filter online drivers with 'available' status and remove stale locations (older than 10 minutes to allow for GPS updates)
    // No filtering by account type, tenant, or any other restriction
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    return locations.filter(loc => {
      // Ensure driver is online, has 'available' status, and has valid coordinates
      // For backward compatibility: if status field doesn't exist, treat as available if online
      const status = loc.status || (loc.isOnline ? 'available' : 'offline');
      const isAvailable = loc.isOnline === true && status === 'available';
      const hasValidCoords = loc.latitude && loc.longitude && 
                            !isNaN(loc.latitude) && 
                            !isNaN(loc.longitude) &&
                            Math.abs(loc.latitude) <= 90 &&
                            Math.abs(loc.longitude) <= 180;
      const isRecent = new Date(loc.lastUpdated) > new Date(tenMinutesAgo);
      
      // Return all available drivers - all passengers can see all drivers
      return isAvailable && hasValidCoords && isRecent;
    });
  } catch (error) {
    console.error('Error getting online driver locations:', error);
    return [];
  }
};

// Get online drivers list
const getOnlineDrivers = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(ONLINE_DRIVERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting online drivers:', error);
    return [];
  }
};

// Update driver status only (without location update)
export const updateDriverStatus = async (
  driverId: string,
  status: DriverStatus
): Promise<void> => {
  try {
    const locations = await getDriverLocations();
    const existingIndex = locations.findIndex(loc => loc.driverId === driverId);
    
    if (existingIndex >= 0) {
      locations[existingIndex].status = status;
      locations[existingIndex].isOnline = status !== 'offline';
      await AsyncStorage.setItem(DRIVER_LOCATIONS_KEY, JSON.stringify(locations));
      
      // Update online drivers list
      if (status === 'offline') {
        const onlineDrivers = await getOnlineDrivers();
        const filtered = onlineDrivers.filter(id => id !== driverId);
        await AsyncStorage.setItem(ONLINE_DRIVERS_KEY, JSON.stringify(filtered));
      } else {
        const onlineDrivers = await getOnlineDrivers();
        if (!onlineDrivers.includes(driverId)) {
          onlineDrivers.push(driverId);
          await AsyncStorage.setItem(ONLINE_DRIVERS_KEY, JSON.stringify(onlineDrivers));
        }
      }
    }
  } catch (error) {
    console.error('Error updating driver status:', error);
    throw error;
  }
};

// Remove driver location (when driver goes offline or logs out)
export const removeDriverLocation = async (driverId: string): Promise<void> => {
  try {
    const locations = await getDriverLocations();
    const filtered = locations.filter(loc => loc.driverId !== driverId);
    await AsyncStorage.setItem(DRIVER_LOCATIONS_KEY, JSON.stringify(filtered));
    
    const onlineDrivers = await getOnlineDrivers();
    const filteredOnline = onlineDrivers.filter(id => id !== driverId);
    await AsyncStorage.setItem(ONLINE_DRIVERS_KEY, JSON.stringify(filteredOnline));
  } catch (error) {
    console.error('Error removing driver location:', error);
    throw error;
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
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

