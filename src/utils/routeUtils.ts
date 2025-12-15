/**
 * Route utilities for generating more accurate route paths
 * Generates intermediate waypoints to simulate road-like routes
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Generate intermediate waypoints to create a more realistic route
 * This simulates a road-like path instead of a straight line
 */
export const generateRouteWaypoints = (
  start: Coordinate,
  end: Coordinate,
  numPoints: number = 5
): Coordinate[] => {
  const waypoints: Coordinate[] = [start];
  
  // For short distances, use fewer points
  const distance = calculateHaversineDistance(start, end);
  if (distance < 1) {
    numPoints = 2;
  } else if (distance < 2) {
    numPoints = 3;
  } else if (distance < 5) {
    numPoints = 4;
  }
  
  // Generate intermediate waypoints with slight variations to simulate roads
  for (let i = 1; i < numPoints; i++) {
    const fraction = i / numPoints;
    
    // Linear interpolation
    const lat = start.latitude + (end.latitude - start.latitude) * fraction;
    const lon = start.longitude + (end.longitude - start.longitude) * fraction;
    
    // Add slight variations to simulate road curves
    // Variation is smaller for shorter distances
    const variationFactor = Math.min(distance * 0.001, 0.002); // Max 0.002 degrees (~200m)
    const latVariation = (Math.random() - 0.5) * variationFactor;
    const lonVariation = (Math.random() - 0.5) * variationFactor;
    
    waypoints.push({
      latitude: lat + latVariation,
      longitude: lon + lonVariation,
    });
  }
  
  waypoints.push(end);
  return waypoints;
};

/**
 * Calculate distance using Haversine formula
 */
const calculateHaversineDistance = (
  start: Coordinate,
  end: Coordinate
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (end.latitude - start.latitude) * Math.PI / 180;
  const dLon = (end.longitude - start.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(start.latitude * Math.PI / 180) *
      Math.cos(end.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Generate a route with waypoints that follows a more realistic path
 * Uses multiple intermediate points with smooth transitions
 */
export const generateAccurateRoute = (
  start: Coordinate,
  end: Coordinate
): Coordinate[] => {
  const distance = calculateHaversineDistance(start, end);
  
  // For very short distances (< 0.5km), use straight line
  if (distance < 0.5) {
    return [start, end];
  }
  
  // Calculate number of waypoints based on distance
  const numWaypoints = Math.min(Math.max(Math.ceil(distance * 2), 3), 10);
  
  // Generate waypoints
  const waypoints: Coordinate[] = [start];
  
  // Calculate bearing (direction)
  const lat1 = start.latitude * Math.PI / 180;
  const lat2 = end.latitude * Math.PI / 180;
  const dLon = (end.longitude - start.longitude) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x);
  
  // Generate intermediate points
  for (let i = 1; i < numWaypoints; i++) {
    const fraction = i / numWaypoints;
    
    // Use great circle interpolation for more accurate paths
    const d = distance * fraction;
    const R = 6371; // Earth's radius in km
    
    const lat1Rad = start.latitude * Math.PI / 180;
    const lon1Rad = start.longitude * Math.PI / 180;
    
    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(d / R) +
      Math.cos(lat1Rad) * Math.sin(d / R) * Math.cos(bearing)
    );
    
    const lon2Rad = lon1Rad + Math.atan2(
      Math.sin(bearing) * Math.sin(d / R) * Math.cos(lat1Rad),
      Math.cos(d / R) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
    
    // Add slight road-like variations (smaller for shorter distances)
    // Use a combination of sin/cos based on fraction and coordinates for deterministic but varied paths
    const variation = Math.min(distance * 0.0004, 0.0015);
    // Create a deterministic but varied pattern based on coordinates and fraction
    const seed = (start.latitude + start.longitude + end.latitude + end.longitude) * 1000;
    const latVariation = Math.sin(i * 1.5 + seed) * variation;
    const lonVariation = Math.cos(i * 1.3 + seed * 0.7) * variation;
    
    waypoints.push({
      latitude: (lat2Rad * 180 / Math.PI) + latVariation,
      longitude: (lon2Rad * 180 / Math.PI) + lonVariation,
    });
  }
  
  waypoints.push(end);
  return waypoints;
};

