import * as FileSystem from 'expo-file-system';

/**
 * Saves an image to a permanent location and returns the new URI
 * @param uri - The temporary file URI of the image
 * @param fileName - Optional custom file name (will use timestamp if not provided)
 * @returns The permanent file URI
 */
export const saveImagePermanently = async (uri: string, fileName?: string): Promise<string> => {
  try {
    // Create a unique filename if not provided
    const timestamp = Date.now();
    const fileExtension = uri.split('.').pop() || 'jpg';
    const finalFileName = fileName || `profile_${timestamp}.${fileExtension}`;
    
    // Get the document directory (persistent storage)
    // Note: In newer versions of expo-file-system, use cacheDirectory
    const documentDirectory = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
    if (!documentDirectory) {
      throw new Error('Document directory not available');
    }
    
    // Create the destination path
    const destinationUri = `${documentDirectory}${finalFileName}`;
    
    // Copy the file to the permanent location
    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri,
    });
    
    return destinationUri;
  } catch (error) {
    console.error('Error saving image permanently:', error);
    // Fallback: return original URI if save fails
    return uri;
  }
};

/**
 * Converts an image URI to base64 string for storage in AsyncStorage
 * Use this for small images or when you need to store in AsyncStorage
 * @param uri - The local file URI of the image
 * @returns Base64 encoded string with data URI prefix
 */
export const convertImageToBase64 = async (uri: string): Promise<string> => {
  try {
    // Use base64 encoding directly (expo-file-system v19+)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    // Return as data URI for easy display
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
};

/**
 * Checks if a string is a base64 data URI
 * @param str - String to check
 * @returns True if the string is a base64 data URI
 */
export const isBase64DataUri = (str: string): boolean => {
  return str.startsWith('data:image/');
};

/**
 * Checks if a file exists at the given URI
 * @param uri - The file URI to check
 * @returns True if the file exists
 */
export const fileExists = async (uri: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists;
  } catch (error) {
    return false;
  }
};

