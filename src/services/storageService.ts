// Storage Service - Supabase Storage for Images
// Handles profile photos, driver documents, vehicle photos

import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { getStorageErrorMessage } from '../utils/storageSetup';
import Logger from '../utils/logger';

export type BucketName = 'profile-photos' | 'driver-documents' | 'vehicle-photos';

/**
 * Upload image to Supabase Storage
 * @param uri - Local file URI from ImagePicker
 * @param bucket - Bucket name
 * @param path - File path in bucket (e.g., 'user-id/profile.jpg')
 */
export const uploadImage = async (
  uri: string,
  bucket: BucketName,
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    Logger.log(`📤 [uploadImage] Starting upload to bucket: ${bucket}, path: ${path}`);
    Logger.log(`📤 [uploadImage] URI: ${uri}`);
    
    // Compress image before upload
    Logger.log('🗜️ [uploadImage] Compressing image...');
    const compressedImage = await compressImage(uri);
    const imageToUpload = compressedImage || uri;
    Logger.log(`📤 [uploadImage] Using ${compressedImage ? 'compressed' : 'original'} image`);
    
    // Read file as base64
    Logger.log('📤 [uploadImage] Reading file as base64...');
    const base64 = await FileSystem.readAsStringAsync(imageToUpload, {
      encoding: 'base64' as any,
    });
    
    if (!base64) {
      Logger.error('❌ [uploadImage] Failed to read file as base64');
      return { success: false, error: 'Failed to read image file' };
    }
    
    Logger.log(`📤 [uploadImage] File read successfully, size: ${base64.length} chars`);

    // Convert base64 to ArrayBuffer
    Logger.log('📤 [uploadImage] Converting to ArrayBuffer...');
    const arrayBuffer = decode(base64);
    Logger.log(`📤 [uploadImage] ArrayBuffer created, size: ${arrayBuffer.byteLength} bytes`);

    // Determine content type from URI
    const contentType = getContentType(uri);
    Logger.log(`📤 [uploadImage] Content type: ${contentType}`);

    // Upload to Supabase Storage
    Logger.log('📤 [uploadImage] Uploading to Supabase Storage...');
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true, // Replace if exists
      });

    if (error) {
      Logger.error('❌ [uploadImage] Upload failed:', error);
      const userFriendlyError = getStorageErrorMessage(error.message);
      return { success: false, error: userFriendlyError };
    }

    Logger.success('✅ [uploadImage] Upload successful:', data);

    // Get public URL
    Logger.log('📤 [uploadImage] Getting public URL...');
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    Logger.success('✅ [uploadImage] Public URL:', urlData.publicUrl);
    
    return { success: true, url: urlData.publicUrl };
  } catch (error: any) {
    Logger.error('❌ [uploadImage] Unexpected error:', error);
    return { success: false, error: `Unexpected error: ${error.message}` };
  }
};

/**
 * Upload profile photo
 */
export const uploadProfilePhoto = async (
  userId: string,
  imageUri: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('📸 [uploadProfilePhoto] Starting upload...');
    console.log('📸 [uploadProfilePhoto] userId:', userId);
    console.log('📸 [uploadProfilePhoto] imageUri:', imageUri);
    
    if (!imageUri) {
      console.error('❌ [uploadProfilePhoto] No image URI provided');
      return { success: false, error: 'No image URI provided' };
    }
    
    if (!userId) {
      console.error('❌ [uploadProfilePhoto] No user ID provided');
      return { success: false, error: 'No user ID provided' };
    }
    
    const extension = imageUri.split('.').pop() || 'jpg';
    const path = `${userId}/profile.${extension}`;
    
    console.log('📸 [uploadProfilePhoto] Upload path:', path);
    console.log('📸 [uploadProfilePhoto] Calling uploadImage...');
    
    const result = await uploadImage(imageUri, 'profile-photos', path);
    
    console.log('📸 [uploadProfilePhoto] Upload result:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error: any) {
    console.error('❌ [uploadProfilePhoto] Unexpected error:', error);
    return { success: false, error: error.message || 'Unknown error during upload' };
  }
};

/**
 * Upload driver license photo
 */
export const uploadDriverLicense = async (
  userId: string,
  imageUri: string,
  side: 'front' | 'back'
): Promise<{ success: boolean; url?: string; error?: string }> => {
  const extension = imageUri.split('.').pop() || 'jpg';
  const path = `${userId}/license-${side}.${extension}`;
  return uploadImage(imageUri, 'driver-documents', path);
};

/**
 * Upload OR/CR document
 */
export const uploadORCR = async (
  userId: string,
  imageUri: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  const extension = imageUri.split('.').pop() || 'jpg';
  const path = `${userId}/orcr.${extension}`;
  return uploadImage(imageUri, 'driver-documents', path);
};

/**
 * Upload vehicle photo
 */
export const uploadVehiclePhoto = async (
  userId: string,
  imageUri: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  const extension = imageUri.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const path = `${userId}/vehicle-${timestamp}.${extension}`;
  return uploadImage(imageUri, 'vehicle-photos', path);
};

/**
 * Delete image from storage
 */
export const deleteImage = async (
  bucket: BucketName,
  path: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get signed URL for private files (documents)
 */
export const getSignedUrl = async (
  bucket: BucketName,
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * List files in a folder
 */
export const listFiles = async (
  bucket: BucketName,
  folder: string
): Promise<{ success: boolean; files?: any[]; error?: string }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, files: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get content type from file URI
 */
const getContentType = (uri: string): string => {
  const extension = uri.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'image/jpeg';
  }
};

/**
 * Compress image for upload (reduces file size and dimensions)
 * Compresses to max 1024x1024 with 80% quality
 */
export const compressImage = async (uri: string): Promise<string | null> => {
  try {
    Logger.log('🗜️ [compressImage] Starting compression for:', uri);
    
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [
        // Resize to max 1024x1024 while maintaining aspect ratio
        { resize: { width: 1024 } },
      ],
      {
        compress: 0.8, // 80% quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const originalSize = uri.length;
    const compressedSize = manipulatedImage.uri.length;
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    Logger.success(`✅ [compressImage] Compressed successfully! Saved ~${savings}%`);
    Logger.log(`📊 [compressImage] Original: ${originalSize}, Compressed: ${compressedSize}`);
    
    return manipulatedImage.uri;
  } catch (error: any) {
    Logger.error('❌ [compressImage] Compression failed:', error);
    // Return null to use original image as fallback
    return null;
  }
};

/**
 * Download image to device (for offline viewing)
 */
export const downloadImage = async (
  url: string,
  filename: string
): Promise<{ success: boolean; localUri?: string; error?: string }> => {
  try {
    const documentDirectory = (FileSystem as any).documentDirectory;
    if (!documentDirectory) {
      return { success: false, error: 'Document directory not available' };
    }
    
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      documentDirectory + filename
    );

    const result = await downloadResumable.downloadAsync();
    
    if (!result) {
      return { success: false, error: 'Download failed' };
    }

    return { success: true, localUri: result.uri };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
