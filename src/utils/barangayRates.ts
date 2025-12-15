import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BarangayRate {
  id: string;
  barangayName: string;
  baseFare: number;
  perKilometer: number;
  minimumFare: number;
  nightSurcharge?: number; // Additional fee for night trips (after 10 PM)
  effectiveDate: string;
  isActive: boolean;
}

const BARANGAY_RATES_KEY = 'barangay_rates';
const DEFAULT_BARANGAY = 'Lopez'; // Default barangay name

// Initialize default barangay rates
// Using a flag to prevent recursive calls during initialization
let isInitializing = false;

const initializeDefaultRates = async (): Promise<void> => {
  // Prevent recursive calls
  if (isInitializing) {
    return;
  }

  try {
    isInitializing = true;
    
    // Check AsyncStorage directly to avoid circular dependency
    const data = await AsyncStorage.getItem(BARANGAY_RATES_KEY);
    const existingRates: BarangayRate[] = data ? JSON.parse(data) : [];
    
    // Only initialize if no rates exist
    if (existingRates.length === 0) {
      const defaultRate: BarangayRate = {
        id: 'default_lopez',
        barangayName: DEFAULT_BARANGAY,
        baseFare: 25,
        perKilometer: 12.5, // Average of 10-15
        minimumFare: 25,
        nightSurcharge: 5, // ₱5 additional for night trips
        effectiveDate: new Date().toISOString(),
        isActive: true,
      };
      
      await AsyncStorage.setItem(BARANGAY_RATES_KEY, JSON.stringify([defaultRate]));
    }
  } catch (error) {
    console.error('Error initializing default rates:', error);
  } finally {
    isInitializing = false;
  }
};

// Get barangay rates
export const getBarangayRates = async (barangayName?: string): Promise<BarangayRate[]> => {
  try {
    await initializeDefaultRates();
    const data = await AsyncStorage.getItem(BARANGAY_RATES_KEY);
    const rates: BarangayRate[] = data ? JSON.parse(data) : [];
    
    if (barangayName) {
      return rates.filter(r => r.barangayName === barangayName && r.isActive);
    }
    
    return rates.filter(r => r.isActive);
  } catch (error) {
    console.error('Error getting barangay rates:', error);
    return [];
  }
};

// Get active rate for a barangay
export const getActiveBarangayRate = async (barangayName: string = DEFAULT_BARANGAY): Promise<BarangayRate | null> => {
  try {
    const rates = await getBarangayRates(barangayName);
    if (rates.length === 0) {
      // Return default rate if no specific rate found
      const defaultRates = await getBarangayRates();
      return defaultRates.find(r => r.barangayName === DEFAULT_BARANGAY) || null;
    }
    
    // Return the most recent active rate
    return rates.sort((a, b) => 
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    )[0] || null;
  } catch (error) {
    console.error('Error getting active barangay rate:', error);
    return null;
  }
};

// Calculate fare based on barangay rates
export const calculateFareWithBarangayRate = async (
  distanceKm: number,
  barangayName: string = DEFAULT_BARANGAY,
  isNightTrip: boolean = false
): Promise<{ min: number; max: number; base: number }> => {
  try {
    const rate = await getActiveBarangayRate(barangayName);
    
    if (!rate) {
      // Fallback to default calculation if no rate found
      const baseFare = 25;
      const perKmMin = 10;
      const perKmMax = 15;
      const minFare = baseFare + (distanceKm * perKmMin);
      const maxFare = baseFare + (distanceKm * perKmMax);
      
      return {
        min: Math.round(minFare),
        max: Math.round(maxFare),
        base: baseFare,
      };
    }

    // Calculate fare using barangay rate
    const baseFare = rate.baseFare;
    const perKm = rate.perKilometer;
    const nightSurcharge = isNightTrip ? (rate.nightSurcharge || 0) : 0;
    
    // Use a small variance (±5%) to show min/max range
    const variance = 0.05;
    const calculatedFare = baseFare + (distanceKm * perKm) + nightSurcharge;
    const minFare = calculatedFare * (1 - variance);
    const maxFare = calculatedFare * (1 + variance);
    
    // Ensure minimum fare is met
    const finalMin = Math.max(Math.round(minFare), rate.minimumFare);
    const finalMax = Math.max(Math.round(maxFare), rate.minimumFare);
    
    return {
      min: finalMin,
      max: finalMax,
      base: Math.round(calculatedFare),
    };
  } catch (error) {
    console.error('Error calculating fare with barangay rate:', error);
    // Fallback
    const baseFare = 25;
    const perKmMin = 10;
    const perKmMax = 15;
    return {
      min: Math.round(baseFare + (distanceKm * perKmMin)),
      max: Math.round(baseFare + (distanceKm * perKmMax)),
      base: Math.round(baseFare + (distanceKm * 12.5)),
    };
  }
};

// Set barangay rate (admin function)
export const setBarangayRate = async (rate: Omit<BarangayRate, 'id' | 'effectiveDate'>): Promise<void> => {
  try {
    const rates = await getBarangayRates();
    
    // Deactivate old rates for the same barangay
    const updatedRates = rates.map(r => 
      r.barangayName === rate.barangayName ? { ...r, isActive: false } : r
    );
    
    // Add new rate
    const newRate: BarangayRate = {
      ...rate,
      id: `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      effectiveDate: new Date().toISOString(),
    };
    
    updatedRates.push(newRate);
    await AsyncStorage.setItem(BARANGAY_RATES_KEY, JSON.stringify(updatedRates));
  } catch (error) {
    console.error('Error setting barangay rate:', error);
    throw error;
  }
};




