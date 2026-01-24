// Lopez, Quezon - Fixed Fare Rates by Barangay
// Based on official fare matrix for tricycle transport

export interface FareRoute {
  destination: string;
  regularFare: number;
  seniorPwdFare: number;
  route?: string; // Route identifier (A1, A2, A6, etc.)
}

// Complete fare matrix for Lopez, Quezon
export const LOPEZ_FARES: FareRoute[] = [
  // A1 Route
  { destination: 'POBLACION', regularFare: 13, seniorPwdFare: 10, route: 'A1' },
  
  // A2 Route
  { destination: 'DEL PILAR', regularFare: 13, seniorPwdFare: 10, route: 'A2' },
  { destination: 'MAGUISIAN', regularFare: 13, seniorPwdFare: 10, route: 'A2' },
  { destination: 'CALANTIPAYAN', regularFare: 14, seniorPwdFare: 11, route: 'A2' },
  { destination: 'PULONG MANGGA', regularFare: 15, seniorPwdFare: 12, route: 'A2' },
  { destination: 'JONGO', regularFare: 17, seniorPwdFare: 14, route: 'A2' },
  { destination: 'PANSOL', regularFare: 16, seniorPwdFare: 13, route: 'A2' },
  { destination: 'SUGOD', regularFare: 20, seniorPwdFare: 16, route: 'A2' },
  { destination: 'MAL-AY', regularFare: 22, seniorPwdFare: 18, route: 'A2' },
  { destination: 'SAN RAFAEL', regularFare: 50, seniorPwdFare: 40, route: 'A2' },
  { destination: 'SAN PEDRO SITE', regularFare: 50, seniorPwdFare: 40, route: 'A2' },
  { destination: 'ILAYANG ILOG A', regularFare: 60, seniorPwdFare: 48, route: 'A2' },
  { destination: 'ILAYANG ILOG B', regularFare: 60, seniorPwdFare: 48, route: 'A2' },
  { destination: 'MABINI', regularFare: 60, seniorPwdFare: 48, route: 'A2' },
  { destination: 'VILLANACAOB', regularFare: 65, seniorPwdFare: 52, route: 'A2' },
  { destination: 'SANTA ELENA', regularFare: 65, seniorPwdFare: 52, route: 'A2' },
  
  // A6 PVRSC Route
  { destination: 'BOCBOC (PUROK PANTAY)', regularFare: 15, seniorPwdFare: 12, route: 'A6' },
  { destination: 'BOCBOC (PUROK BULIHAN 1 AND 2)', regularFare: 13, seniorPwdFare: 10, route: 'A6' },
  { destination: 'BOCBOC (PUROK CENTRAL)', regularFare: 15, seniorPwdFare: 12, route: 'A6' },
  { destination: 'BOCBOC (PUROK MANGGAHAN)', regularFare: 15, seniorPwdFare: 12, route: 'A6' },
  { destination: 'VILLAHERMOSA (TULAY LAMPAS)', regularFare: 13, seniorPwdFare: 10, route: 'A6' },
  { destination: 'VILLAHERMOSA', regularFare: 16, seniorPwdFare: 13, route: 'A6' },
  { destination: 'SAN ANTONIO (KAWAYAN)', regularFare: 18, seniorPwdFare: 14, route: 'A6' },
  { destination: 'ROSARIO', regularFare: 18, seniorPwdFare: 14, route: 'A6' },
  { destination: 'CAMBOOT', regularFare: 27, seniorPwdFare: 22, route: 'A6' },
  { destination: 'SILANG', regularFare: 25, seniorPwdFare: 20, route: 'A6' },
  { destination: 'INALUSAN', regularFare: 40, seniorPwdFare: 32, route: 'A6' },
  { destination: 'COGORIN IBABA CENTRO', regularFare: 30, seniorPwdFare: 24, route: 'A6' },
  { destination: 'COGORIN IBABA (CROSSING BINAHIAN ABC)', regularFare: 38, seniorPwdFare: 30, route: 'A6' },
  { destination: 'COGORIN IBABA (BOUNDARY STO. NIÑO IBABA)', regularFare: 35, seniorPwdFare: 28, route: 'A6' },
  { destination: 'COGORIN ILAYA', regularFare: 45, seniorPwdFare: 36, route: 'A6' },
  { destination: 'VILLAMONTE', regularFare: 40, seniorPwdFare: 32, route: 'A6' },
  { destination: 'SAMAT', regularFare: 45, seniorPwdFare: 36, route: 'A6' },
  { destination: 'BAYABAS', regularFare: 55, seniorPwdFare: 44, route: 'A6' },
  { destination: 'BINAHIAN A', regularFare: 55, seniorPwdFare: 44, route: 'A6' },
  { destination: 'BINAHIAN B', regularFare: 65, seniorPwdFare: 52, route: 'A6' },
  { destination: 'BINAHIAN C', regularFare: 70, seniorPwdFare: 56, route: 'A6' },
];

// Aliases for common barangay name variations
export const BARANGAY_ALIASES: Record<string, string> = {
  // Poblacion variations
  'POBLACION': 'POBLACION',
  'TOWN PROPER': 'POBLACION',
  'CENTRO': 'POBLACION',
  
  // Del Pilar variations
  'DEL PILAR': 'DEL PILAR',
  'DELPILAR': 'DEL PILAR',
  
  // Bocboc variations
  'BOCBOC': 'BOCBOC (PUROK CENTRAL)',
  'BOCBOC PANTAY': 'BOCBOC (PUROK PANTAY)',
  'BOCBOC BULIHAN': 'BOCBOC (PUROK BULIHAN 1 AND 2)',
  'BOCBOC CENTRAL': 'BOCBOC (PUROK CENTRAL)',
  'BOCBOC MANGGAHAN': 'BOCBOC (PUROK MANGGAHAN)',
  
  // Villahermosa variations
  'VILLAHERMOSA': 'VILLAHERMOSA',
  'VILLAHERMOSA TULAY LAMPAS': 'VILLAHERMOSA (TULAY LAMPAS)',
  
  // San Antonio variations
  'SAN ANTONIO': 'SAN ANTONIO (KAWAYAN)',
  'KAWAYAN': 'SAN ANTONIO (KAWAYAN)',
  
  // Cogorin variations
  'COGORIN': 'COGORIN IBABA CENTRO',
  'COGORIN IBABA': 'COGORIN IBABA CENTRO',
  
  // Binahian variations
  'BINAHIAN': 'BINAHIAN A',
};

/**
 * Normalize barangay name for lookup
 */
export const normalizeBarangayName = (name: string): string => {
  if (!name) return '';
  
  // Convert to uppercase and trim
  let normalized = name.toUpperCase().trim();
  
  // Remove "POBLACION -" prefix if present (since all routes are FROM poblacion)
  normalized = normalized.replace(/^POBLACION\s*-\s*/i, '');
  
  // Check if there's an alias
  if (BARANGAY_ALIASES[normalized]) {
    normalized = BARANGAY_ALIASES[normalized];
  }
  
  return normalized;
};

/**
 * Get fare for a specific destination in Lopez, Quezon
 * @param destination - Destination barangay name
 * @param hasSeniorDiscount - Whether passenger has approved senior citizen discount
 * @param hasPWDDiscount - Whether passenger has approved PWD discount
 * @returns Fare object with amount and details
 */
export const getLopezFare = (
  destination: string,
  hasSeniorDiscount: boolean = false,
  hasPWDDiscount: boolean = false
): {
  fare: number;
  regularFare: number;
  discountedFare: number | null;
  discountAmount: number;
  discountType: 'senior' | 'pwd' | null;
  destination: string;
  found: boolean;
} => {
  // Normalize the destination name
  const normalizedDestination = normalizeBarangayName(destination);
  
  console.log('[getLopezFare] Looking up fare for:', normalizedDestination);
  
  // Find the fare in our matrix
  const fareRoute = LOPEZ_FARES.find(route => 
    route.destination === normalizedDestination ||
    route.destination.includes(normalizedDestination) ||
    normalizedDestination.includes(route.destination)
  );
  
  if (!fareRoute) {
    console.warn('[getLopezFare] No fare found for destination:', destination);
    return {
      fare: 15, // Default minimum fare
      regularFare: 15,
      discountedFare: null,
      discountAmount: 0,
      discountType: null,
      destination: normalizedDestination,
      found: false,
    };
  }
  
  console.log('[getLopezFare] Found fare route:', fareRoute);
  
  // Determine if discount applies
  const hasDiscount = hasSeniorDiscount || hasPWDDiscount;
  const discountType = hasSeniorDiscount ? 'senior' : (hasPWDDiscount ? 'pwd' : null);
  
  const regularFare = fareRoute.regularFare;
  const discountedFare = hasDiscount ? fareRoute.seniorPwdFare : null;
  const finalFare = hasDiscount ? fareRoute.seniorPwdFare : fareRoute.regularFare;
  const discountAmount = hasDiscount ? (regularFare - fareRoute.seniorPwdFare) : 0;
  
  return {
    fare: finalFare,
    regularFare,
    discountedFare,
    discountAmount,
    discountType,
    destination: fareRoute.destination,
    found: true,
  };
};

/**
 * Get all available destinations with their fares
 */
export const getAllLopezDestinations = (): FareRoute[] => {
  return LOPEZ_FARES;
};

/**
 * Search destinations by partial name
 */
export const searchDestinations = (searchTerm: string): FareRoute[] => {
  const normalized = searchTerm.toUpperCase().trim();
  return LOPEZ_FARES.filter(route => 
    route.destination.includes(normalized)
  );
};
