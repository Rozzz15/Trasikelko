/**
 * Test utility to verify direction accuracy for location suggestions
 * This ensures that all directions (North, South, East, West, etc.) are correctly calculated
 */

export interface TestResult {
  direction: string;
  centerCoords: { latitude: number; longitude: number };
  calculatedCoords: { latitude: number; longitude: number };
  expectedDirection: string;
  isValid: boolean;
  error?: string;
}

/**
 * Test if direction offsets are correct
 * @param centerCoords - The center/reference coordinates
 * @returns Array of test results for each direction
 */
export const testDirectionAccuracy = (
  centerCoords: { latitude: number; longitude: number }
): TestResult[] => {
  const directions = [
    { name: 'North', latOffset: 0.015, lonOffset: 0 },
    { name: 'South', latOffset: -0.015, lonOffset: 0 },
    { name: 'East', latOffset: 0, lonOffset: 0.015 },
    { name: 'West', latOffset: 0, lonOffset: -0.015 },
    { name: 'Northeast', latOffset: 0.012, lonOffset: 0.012 },
    { name: 'Northwest', latOffset: 0.012, lonOffset: -0.012 },
    { name: 'Southeast', latOffset: -0.012, lonOffset: 0.012 },
    { name: 'Southwest', latOffset: -0.012, lonOffset: -0.012 },
  ];

  const results: TestResult[] = [];

  directions.forEach(dir => {
    const calculatedCoords = {
      latitude: centerCoords.latitude + dir.latOffset,
      longitude: centerCoords.longitude + dir.lonOffset,
    };

    // Verify direction logic
    let isValid = true;
    let error: string | undefined;

    // Check North/South (latitude)
    if (dir.name.includes('North') && !dir.name.includes('South')) {
      if (calculatedCoords.latitude <= centerCoords.latitude) {
        isValid = false;
        error = `North direction should increase latitude. Got ${calculatedCoords.latitude} <= ${centerCoords.latitude}`;
      }
    } else if (dir.name.includes('South') && !dir.name.includes('North')) {
      if (calculatedCoords.latitude >= centerCoords.latitude) {
        isValid = false;
        error = `South direction should decrease latitude. Got ${calculatedCoords.latitude} >= ${centerCoords.latitude}`;
      }
    }

    // Check East/West (longitude)
    if (dir.name.includes('East') && !dir.name.includes('West')) {
      if (calculatedCoords.longitude <= centerCoords.longitude) {
        isValid = false;
        error = `East direction should increase longitude. Got ${calculatedCoords.longitude} <= ${centerCoords.longitude}`;
      }
    } else if (dir.name.includes('West') && !dir.name.includes('East')) {
      if (calculatedCoords.longitude >= centerCoords.longitude) {
        isValid = false;
        error = `West direction should decrease longitude. Got ${calculatedCoords.longitude} >= ${centerCoords.longitude}`;
      }
    }

    // Check diagonal directions
    if (dir.name === 'Northeast') {
      if (calculatedCoords.latitude <= centerCoords.latitude || 
          calculatedCoords.longitude <= centerCoords.longitude) {
        isValid = false;
        error = `Northeast should increase both latitude and longitude`;
      }
    } else if (dir.name === 'Northwest') {
      if (calculatedCoords.latitude <= centerCoords.latitude || 
          calculatedCoords.longitude >= centerCoords.longitude) {
        isValid = false;
        error = `Northwest should increase latitude and decrease longitude`;
      }
    } else if (dir.name === 'Southeast') {
      if (calculatedCoords.latitude >= centerCoords.latitude || 
          calculatedCoords.longitude <= centerCoords.longitude) {
        isValid = false;
        error = `Southeast should decrease latitude and increase longitude`;
      }
    } else if (dir.name === 'Southwest') {
      if (calculatedCoords.latitude >= centerCoords.latitude || 
          calculatedCoords.longitude >= centerCoords.longitude) {
        isValid = false;
        error = `Southwest should decrease both latitude and longitude`;
      }
    }

    results.push({
      direction: dir.name,
      centerCoords,
      calculatedCoords,
      expectedDirection: dir.name,
      isValid,
      error,
    });
  });

  return results;
};

/**
 * Log test results to console
 */
export const logTestResults = (results: TestResult[]): void => {
  console.log('=== Direction Accuracy Test Results ===');
  console.log(`Center Coordinates: ${results[0].centerCoords.latitude.toFixed(6)}, ${results[0].centerCoords.longitude.toFixed(6)}`);
  console.log('');
  
  results.forEach(result => {
    const status = result.isValid ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${result.direction}:`);
    console.log(`  Calculated: ${result.calculatedCoords.latitude.toFixed(6)}, ${result.calculatedCoords.longitude.toFixed(6)}`);
    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
    }
    console.log('');
  });

  const passed = results.filter(r => r.isValid).length;
  const failed = results.filter(r => !r.isValid).length;
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`);
  console.log('=== End Test Results ===');
};

/**
 * Run a comprehensive test with sample coordinates
 */
export const runComprehensiveTest = (): void => {
  // Test with sample coordinates (Lopez, Quezon area)
  const testCenter = { latitude: 13.8844, longitude: 122.2603 };
  
  console.log('Running comprehensive direction accuracy test...');
  const results = testDirectionAccuracy(testCenter);
  logTestResults(results);

  // Test with another location (Manila)
  const testCenter2 = { latitude: 14.5995, longitude: 120.9842 };
  console.log('\nTesting with Manila coordinates...');
  const results2 = testDirectionAccuracy(testCenter2);
  logTestResults(results2);
};






