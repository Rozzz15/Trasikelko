import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTrips } from './tripStorage';
import { getOnlineDriverLocations, updateDriverLocation } from './driverLocationStorage';

export interface HighDemandArea {
  id: string;
  name: string;
  type: 'school' | 'market' | 'terminal' | 'hospital' | 'church' | 'other';
  coordinates: { latitude: number; longitude: number };
  radius: number; // in km
  peakHours: number[]; // Array of hours (0-23) when demand is high
  averageDemand: number; // Average number of bookings per hour during peak
  lastUpdated: string;
}

export interface PredictiveSuggestion {
  areaId: string;
  areaName: string;
  coordinates: { latitude: number; longitude: number };
  suggestedDrivers: number;
  currentDrivers: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

const HIGH_DEMAND_AREAS_KEY = 'high_demand_areas';
const PREDICTIVE_SUGGESTIONS_KEY = 'predictive_suggestions';

// Initialize default high-demand areas (schools, markets, terminals)
// Using a flag to prevent recursive calls during initialization
let isInitializingAreas = false;

const initializeDefaultAreas = async (): Promise<void> => {
  // Prevent recursive calls
  if (isInitializingAreas) {
    return;
  }

  try {
    isInitializingAreas = true;
    
    // Check AsyncStorage directly to avoid circular dependency
    const data = await AsyncStorage.getItem(HIGH_DEMAND_AREAS_KEY);
    const existingAreas: HighDemandArea[] = data ? JSON.parse(data) : [];
    
    // Only initialize if no areas exist
    if (existingAreas.length === 0) {
      // Default areas for Lopez, Quezon (example coordinates - should be updated with actual locations)
      const defaultAreas: HighDemandArea[] = [
        {
          id: 'school_1',
          name: 'Lopez Central Elementary School',
          type: 'school',
          coordinates: { latitude: 13.8844, longitude: 122.2603 }, // Example coordinates
          radius: 0.5,
          peakHours: [6, 7, 12, 13, 16, 17], // Morning drop-off, lunch, afternoon pick-up
          averageDemand: 15,
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'market_1',
          name: 'Lopez Public Market',
          type: 'market',
          coordinates: { latitude: 13.8840, longitude: 122.2600 },
          radius: 0.3,
          peakHours: [7, 8, 9, 10, 15, 16, 17], // Morning and afternoon shopping
          averageDemand: 20,
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'terminal_1',
          name: 'Lopez Terminal',
          type: 'terminal',
          coordinates: { latitude: 13.8845, longitude: 122.2605 },
          radius: 0.4,
          peakHours: [5, 6, 7, 8, 17, 18, 19], // Early morning and evening commutes
          averageDemand: 25,
          lastUpdated: new Date().toISOString(),
        },
      ];
      
      await AsyncStorage.setItem(HIGH_DEMAND_AREAS_KEY, JSON.stringify(defaultAreas));
    }
  } catch (error) {
    console.error('Error initializing default areas:', error);
  } finally {
    isInitializingAreas = false;
  }
};

// Get high-demand areas
export const getHighDemandAreas = async (): Promise<HighDemandArea[]> => {
  try {
    await initializeDefaultAreas();
    const data = await AsyncStorage.getItem(HIGH_DEMAND_AREAS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting high-demand areas:', error);
    return [];
  }
};

// Analyze historical trip data to predict demand
export const analyzeHistoricalDemand = async (): Promise<Map<string, number>> => {
  try {
    const trips = await getTrips();
    const demandMap = new Map<string, number>();
    
    // Group trips by hour and location
    trips.forEach(trip => {
      if (trip.pickupCoordinates && trip.createdAt) {
        const date = new Date(trip.createdAt);
        const hour = date.getHours();
        const locationKey = `${trip.pickupCoordinates.latitude.toFixed(3)},${trip.pickupCoordinates.longitude.toFixed(3)}`;
        const key = `${locationKey}_${hour}`;
        
        demandMap.set(key, (demandMap.get(key) || 0) + 1);
      }
    });
    
    return demandMap;
  } catch (error) {
    console.error('Error analyzing historical demand:', error);
    return new Map();
  }
};

// Predict high-demand areas based on current time and historical data
export const predictHighDemandAreas = async (): Promise<HighDemandArea[]> => {
  try {
    const areas = await getHighDemandAreas();
    const currentHour = new Date().getHours();
    const historicalDemand = await analyzeHistoricalDemand();
    
    // Filter areas that are currently in peak hours
    const predictedAreas = areas.filter(area => 
      area.peakHours.includes(currentHour)
    );
    
    // Enhance predictions with historical data
    const enhancedAreas = predictedAreas.map(area => {
      // Check historical demand near this area
      let historicalCount = 0;
      historicalDemand.forEach((count, key) => {
        const [lat, lon, hour] = key.split('_');
        if (parseInt(hour) === currentHour) {
          const distance = calculateDistance(
            parseFloat(lat),
            parseFloat(lon),
            area.coordinates.latitude,
            area.coordinates.longitude
          );
          if (distance <= area.radius) {
            historicalCount += count;
          }
        }
      });
      
      // Update average demand based on historical data
      const updatedAverageDemand = historicalCount > 0 
        ? (area.averageDemand + historicalCount) / 2 
        : area.averageDemand;
      
      return {
        ...area,
        averageDemand: updatedAverageDemand,
        lastUpdated: new Date().toISOString(),
      };
    });
    
    return enhancedAreas.sort((a, b) => b.averageDemand - a.averageDemand);
  } catch (error) {
    console.error('Error predicting high-demand areas:', error);
    return [];
  }
};

// Generate suggestions for driver positioning
export const generateDispatchingSuggestions = async (): Promise<PredictiveSuggestion[]> => {
  try {
    const predictedAreas = await predictHighDemandAreas();
    const onlineDrivers = await getOnlineDriverLocations();
    const suggestions: PredictiveSuggestion[] = [];
    
    for (const area of predictedAreas) {
      // Count drivers currently in the area
      const driversInArea = onlineDrivers.filter(driver => {
        const distance = calculateDistance(
          driver.latitude,
          driver.longitude,
          area.coordinates.latitude,
          area.coordinates.longitude
        );
        return distance <= area.radius;
      }).length;
      
      // Calculate suggested number of drivers based on demand
      // Aim for 1 driver per 2-3 expected bookings
      const suggestedDrivers = Math.ceil(area.averageDemand / 2.5);
      const neededDrivers = Math.max(0, suggestedDrivers - driversInArea);
      
      if (neededDrivers > 0) {
        const priority: 'high' | 'medium' | 'low' = 
          neededDrivers >= 3 ? 'high' :
          neededDrivers >= 2 ? 'medium' : 'low';
        
        suggestions.push({
          areaId: area.id,
          areaName: area.name,
          coordinates: area.coordinates,
          suggestedDrivers: suggestedDrivers,
          currentDrivers: driversInArea,
          reason: `High demand expected at ${area.name} (${area.type}) during current peak hours`,
          priority,
        });
      }
    }
    
    // Store suggestions
    await AsyncStorage.setItem(PREDICTIVE_SUGGESTIONS_KEY, JSON.stringify(suggestions));
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  } catch (error) {
    console.error('Error generating dispatching suggestions:', error);
    return [];
  }
};

// Get current suggestions
export const getDispatchingSuggestions = async (): Promise<PredictiveSuggestion[]> => {
  try {
    const data = await AsyncStorage.getItem(PREDICTIVE_SUGGESTIONS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    
    // Generate new suggestions if none exist
    return await generateDispatchingSuggestions();
  } catch (error) {
    console.error('Error getting dispatching suggestions:', error);
    return [];
  }
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (
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

// Add or update a high-demand area
export const addHighDemandArea = async (area: Omit<HighDemandArea, 'id' | 'lastUpdated'>): Promise<void> => {
  try {
    const areas = await getHighDemandAreas();
    const newArea: HighDemandArea = {
      ...area,
      id: `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastUpdated: new Date().toISOString(),
    };
    
    areas.push(newArea);
    await AsyncStorage.setItem(HIGH_DEMAND_AREAS_KEY, JSON.stringify(areas));
  } catch (error) {
    console.error('Error adding high-demand area:', error);
    throw error;
  }
};




