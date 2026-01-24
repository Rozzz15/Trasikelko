// Discount Verification Service
import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system';

export interface DiscountRequest {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  discount_type: 'senior' | 'pwd';
  id_photo_url: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
}

/**
 * Upload ID photo to Supabase Storage
 */
export const uploadIdPhoto = async (
  userId: string,
  photoUri: string,
  discountType: 'senior' | 'pwd'
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('[uploadIdPhoto] Starting upload for:', discountType);
    console.log('[uploadIdPhoto] Photo URI:', photoUri);
    
    // Create file name
    const timestamp = Date.now();
    const fileName = `${userId}_${discountType}_${timestamp}.jpg`;
    
    // Create FormData for upload
    const formData = new FormData();
    
    // @ts-ignore - React Native handles file uploads differently
    formData.append('file', {
      uri: photoUri,
      type: 'image/jpeg',
      name: fileName,
    });
    
    console.log('[uploadIdPhoto] Uploading to bucket: discount-ids');
    
    // Upload to Supabase Storage using fetch
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/discount-ids/${fileName}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[uploadIdPhoto] Upload error:', errorText);
      return { success: false, error: `Upload failed: ${errorText}` };
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('discount-ids')
      .getPublicUrl(fileName);
    
    console.log('[uploadIdPhoto] Upload successful:', publicUrlData.publicUrl);
    
    return { success: true, url: publicUrlData.publicUrl };
  } catch (error: any) {
    console.error('[uploadIdPhoto] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Request discount verification
 */
export const requestDiscountVerification = async (
  userId: string,
  discountType: 'senior' | 'pwd',
  idPhotoUrl: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[requestDiscountVerification] User ID:', userId, 'Type:', discountType);
    const columnName = discountType === 'senior' ? 'senior_id_photo' : 'pwd_id_photo';
    
    // Update passengers table, not profiles!
    const { error } = await supabase
      .from('passengers')
      .update({
        [columnName]: idPhotoUrl,
        discount_type: discountType,
        discount_verification_status: 'pending',
        discount_requested_at: new Date().toISOString(),
        // Clear any previous rejection reason
        discount_rejection_reason: null,
      })
      .eq('user_id', userId);
    
    if (error) {
      console.error('[requestDiscountVerification] Error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[requestDiscountVerification] Successfully updated passengers table for user:', userId);
    return { success: true };
  } catch (error: any) {
    console.error('[requestDiscountVerification] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get pending discount requests (for admin)
 */
export const getPendingDiscountRequests = async (): Promise<{
  success: boolean;
  requests?: DiscountRequest[];
  error?: string;
}> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone_number, discount_type, senior_id_photo, pwd_id_photo, discount_verification_status, discount_requested_at, discount_verified_at, discount_verified_by, discount_rejection_reason')
      .eq('discount_verification_status', 'pending')
      .order('discount_requested_at', { ascending: true });
    
    if (error) {
      console.error('[getPendingDiscountRequests] Error:', error);
      return { success: false, error: error.message };
    }
    
    const requests: DiscountRequest[] = data?.map((profile: any) => ({
      id: profile.id,
      user_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone_number: profile.phone_number,
      discount_type: profile.discount_type,
      id_photo_url: profile.discount_type === 'senior' ? profile.senior_id_photo : profile.pwd_id_photo,
      verification_status: profile.discount_verification_status,
      requested_at: profile.discount_requested_at,
      verified_at: profile.discount_verified_at,
      verified_by: profile.discount_verified_by,
      rejection_reason: profile.discount_rejection_reason,
    })) || [];
    
    return { success: true, requests };
  } catch (error: any) {
    console.error('[getPendingDiscountRequests] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Approve discount request (admin only)
 */
export const approveDiscountRequest = async (
  userId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        discount_verification_status: 'approved',
        discount_verified_at: new Date().toISOString(),
        discount_verified_by: adminId,
        discount_rejection_reason: null,
      })
      .eq('id', userId);
    
    if (error) {
      console.error('[approveDiscountRequest] Error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[approveDiscountRequest] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reject discount request (admin only)
 */
export const rejectDiscountRequest = async (
  userId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        discount_verification_status: 'rejected',
        discount_verified_at: new Date().toISOString(),
        discount_verified_by: adminId,
        discount_rejection_reason: reason,
      })
      .eq('id', userId);
    
    if (error) {
      console.error('[rejectDiscountRequest] Error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[rejectDiscountRequest] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user's discount status
 */
export const getDiscountStatus = async (userId: string): Promise<{
  success: boolean;
  status?: {
    type: 'none' | 'senior' | 'pwd';
    verification_status: 'none' | 'pending' | 'approved' | 'rejected';
    id_photo_url?: string;
    rejection_reason?: string;
    requested_at?: string;
  };
  error?: string;
}> => {
  try {
    console.log('[getDiscountStatus] Fetching status for user:', userId);
    
    // Query passengers table, not profiles
    const { data, error } = await supabase
      .from('passengers')
      .select('discount_type, discount_verification_status, senior_id_photo, pwd_id_photo, discount_rejection_reason, discount_requested_at')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('[getDiscountStatus] Error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[getDiscountStatus] Raw data from database:', data);
    
    return {
      success: true,
      status: {
        type: data.discount_type || 'none',
        verification_status: data.discount_verification_status || 'none',
        id_photo_url: data.discount_type === 'senior' ? data.senior_id_photo : data.pwd_id_photo,
        rejection_reason: data.discount_rejection_reason,
        requested_at: data.discount_requested_at,
      },
    };
  } catch (error: any) {
    console.error('[getDiscountStatus] Error:', error);
    return { success: false, error: error.message };
  }
};
