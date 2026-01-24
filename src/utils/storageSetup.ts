// Storage Setup Utility
// Run this to verify that all required storage buckets exist

import { supabase } from '../config/supabase';

export interface BucketCheckResult {
  name: string;
  exists: boolean;
  isPublic?: boolean;
}

/**
 * Check if all required storage buckets exist
 */
export const checkStorageBuckets = async (): Promise<{
  allExist: boolean;
  results: BucketCheckResult[];
  error?: string;
}> => {
  try {
    console.log('🔍 Checking storage buckets...');
    
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('❌ Error listing buckets:', error);
      return {
        allExist: false,
        results: [],
        error: error.message,
      };
    }
    
    const requiredBuckets = ['profile-photos', 'driver-documents', 'vehicle-photos'];
    const existingBucketNames = buckets.map(b => b.name);
    
    console.log('📦 Existing buckets:', existingBucketNames);
    
    const results: BucketCheckResult[] = requiredBuckets.map(bucketName => {
      const bucket = buckets.find(b => b.name === bucketName);
      return {
        name: bucketName,
        exists: !!bucket,
        isPublic: bucket?.public,
      };
    });
    
    const allExist = results.every(r => r.exists);
    
    // Log results
    results.forEach(result => {
      if (result.exists) {
        console.log(`✅ ${result.name} exists (public: ${result.isPublic})`);
      } else {
        console.error(`❌ ${result.name} is MISSING - please create it in Supabase Dashboard`);
      }
    });
    
    if (allExist) {
      console.log('✅ All required storage buckets exist!');
    } else {
      console.error('❌ Some storage buckets are missing. Please check the setup guide.');
    }
    
    return {
      allExist,
      results,
    };
  } catch (error: any) {
    console.error('❌ Unexpected error checking storage buckets:', error);
    return {
      allExist: false,
      results: [],
      error: error.message,
    };
  }
};

/**
 * Test upload to a specific bucket
 */
export const testBucketUpload = async (
  bucketName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`🧪 Testing upload to ${bucketName}...`);
    
    // Create a tiny test file (1x1 pixel transparent PNG)
    const testData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const arrayBuffer = Uint8Array.from(atob(testData), c => c.charCodeAt(0)).buffer;
    
    const testPath = `test/test-${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testPath, arrayBuffer, {
        contentType: 'image/png',
        upsert: true,
      });
    
    if (uploadError) {
      console.error(`❌ Test upload to ${bucketName} failed:`, uploadError);
      return { success: false, error: uploadError.message };
    }
    
    console.log(`✅ Test upload to ${bucketName} successful`);
    
    // Clean up test file
    await supabase.storage.from(bucketName).remove([testPath]);
    console.log(`🧹 Test file cleaned up`);
    
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Test upload to ${bucketName} failed:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Run full storage diagnostics
 */
export const runStorageDiagnostics = async (): Promise<void> => {
  console.log('🏥 Running storage diagnostics...\n');
  
  // Check if buckets exist
  const checkResult = await checkStorageBuckets();
  console.log('\n');
  
  if (!checkResult.allExist) {
    console.error('⚠️ Setup Required:');
    console.error('Please create the missing buckets in your Supabase Dashboard.');
    console.error('See docs/SUPABASE_STORAGE_SETUP.md for instructions.\n');
    return;
  }
  
  // Test uploads to each bucket
  console.log('🧪 Testing uploads...\n');
  
  for (const bucket of checkResult.results) {
    if (bucket.exists) {
      await testBucketUpload(bucket.name);
    }
  }
  
  console.log('\n✅ Storage diagnostics complete!');
};

/**
 * Get user-friendly error message for storage errors
 */
export const getStorageErrorMessage = (error: string): string => {
  if (error.includes('Bucket not found')) {
    return 'Storage bucket is not set up. Please contact support or check the setup guide.';
  }
  
  if (error.includes('The resource already exists')) {
    return 'File already exists. This is normal when re-uploading.';
  }
  
  if (error.includes('Permission denied') || error.includes('not authorized')) {
    return 'Permission denied. Please check your storage bucket permissions.';
  }
  
  if (error.includes('Payload too large')) {
    return 'File is too large. Please choose a smaller image.';
  }
  
  if (error.includes('Invalid MIME type')) {
    return 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
  }
  
  return error;
};
